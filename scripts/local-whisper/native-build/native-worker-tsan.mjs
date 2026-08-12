import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';

import { buildTargets, configureBuild, workspaceRoot } from '../whisper-cpp-build-core.mjs';
import { resolveNativeBuildJobs } from './native-build-parallelism.mjs';
import { threadSanitizerRuntimeEnvironment } from './tsan-runtime-policy.mjs';

const PROFILE_PATH = resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'tsan-worker-profile.json');
const PROFILE_SCHEMA_PATH = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'toolchains',
  'schema',
  'worker-tsan-profile.schema.json',
);
const MAXIMUM_REPORT_BYTES = 64 * 1024;
const WORKER_TEST_TARGET = 'local_whisper_whisper_cpp_core_tests';
const TSan_ISSUE_PATTERNS = Object.freeze([
  Object.freeze({ classification: 'data-race', pattern: /WARNING: ThreadSanitizer: data race/u }),
  Object.freeze({ classification: 'lock-order', pattern: /WARNING: ThreadSanitizer: lock-order-inversion/u }),
  Object.freeze({ classification: 'thread-lifecycle', pattern: /ThreadSanitizer: thread leak/u }),
  Object.freeze({ classification: 'runtime', pattern: /FATAL: ThreadSanitizer/u }),
  Object.freeze({ classification: 'unsupported-instrumentation', pattern: /ThreadSanitizer: unsupported/u }),
]);

function readProfile() {
  const profile = JSON.parse(readFileSync(PROFILE_PATH, 'utf8'));
  const schema = JSON.parse(readFileSync(PROFILE_SCHEMA_PATH, 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(profile)) throw new Error('Worker TSan profile is malformed');
  return Object.freeze(profile);
}

function requireLinux() {
  if (process.platform !== 'linux') throw new Error('Local Whisper worker ThreadSanitizer supports Linux only');
}

function boundedOutput(result) {
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (Buffer.byteLength(output, 'utf8') > MAXIMUM_REPORT_BYTES)
    throw new Error('Worker TSan report exceeded its bound');
  return output;
}

function classifyReport(output) {
  for (const { classification, pattern } of TSan_ISSUE_PATTERNS) {
    if (pattern.test(output)) return classification;
  }
  return output.includes('ThreadSanitizer') ? 'malformed-report' : null;
}

function executeBounded(command, arguments_, environment, timeoutMilliseconds, label) {
  const result = spawnSync(command, arguments_, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: environment,
    killSignal: 'SIGKILL',
    maxBuffer: MAXIMUM_REPORT_BYTES,
    shell: false,
    timeout: timeoutMilliseconds,
  });
  if (result.error?.code === 'ETIMEDOUT') throw new Error(`Worker TSan ${label} timed out`);
  if (result.error) throw new Error(`Worker TSan ${label} could not execute`);
  return Object.freeze({ classification: classifyReport(boundedOutput(result)), status: result.status });
}

function assertIsolatedInstrumentation(buildRoot) {
  const compilationDatabase = resolve(buildRoot, 'compile_commands.json');
  if (!existsSync(compilationDatabase)) throw new Error('Worker TSan compilation database is unavailable');
  const commands = readFileSync(compilationDatabase, 'utf8');
  if (!commands.includes('-fsanitize=thread')) throw new Error('Worker TSan instrumentation is unavailable');
  if (commands.includes('-fsanitize=address') || commands.includes('-fsanitize=undefined')) {
    throw new Error('Worker TSan graph combined incompatible sanitizer instrumentation');
  }
}

function listWorkerTests(configured, profile, environment) {
  const ctest = resolve(configured.tools.cmake, '..', 'ctest');
  const result = spawnSync(ctest, ['--test-dir', configured.buildRoot, '--show-only=json-v1'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: environment,
    maxBuffer: MAXIMUM_REPORT_BYTES,
    shell: false,
    timeout: profile.suite.timeoutMilliseconds,
  });
  if (result.error?.code === 'ETIMEDOUT') throw new Error('Worker TSan discovery timed out');
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
    throw new Error('Worker TSan discovery failed');
  }
  let discovered;
  try {
    discovered = JSON.parse(result.stdout);
  } catch {
    throw new Error('Worker TSan discovery report is malformed');
  }
  const testPattern = new RegExp(profile.suite.testPattern, 'u');
  const names = discovered.tests
    .map((entry) => entry.name)
    .filter((name) => typeof name === 'string' && testPattern.test(name))
    .sort();
  const required = [...profile.suite.requiredTests].sort();
  if (JSON.stringify(names) !== JSON.stringify(required)) {
    throw new Error('Worker TSan concurrency matrix does not match its profile');
  }
}

function configureWorkerTsan(profile) {
  const asanUbsanEnabled = profile.cmakeCache.LOCAL_WHISPER_ENABLE_SANITIZERS === 'ON';
  const threadSanitizer = profile.cmakeCache.LOCAL_WHISPER_ENABLE_THREAD_SANITIZER === 'ON';
  if (asanUbsanEnabled || !threadSanitizer) throw new Error('Worker TSan profile mixes incompatible instrumentation');
  const configured = configureBuild(profile.baseToolchainProfile, {
    engine: false,
    preparedLinuxQuality: process.env.LOCAL_WHISPER_PREPARED_LINUX_QUALITY === 'true',
    quiet: true,
    rootTag: 'tsan',
    sanitizers: false,
    tests: true,
    threadSanitizer,
  });
  assertIsolatedInstrumentation(configured.buildRoot);
  return configured;
}

function runProof(profile, environment) {
  const configured = configureWorkerTsan(profile);
  buildTargets(configured, [profile.proof.executable]);
  const binary = resolve(configured.buildRoot, profile.proof.executable);
  const result = executeBounded(binary, [], environment, profile.proof.timeoutMilliseconds, 'synthetic-race proof');
  if (result.status === 0) throw new Error('Worker TSan synthetic race unexpectedly passed');
  if (result.classification !== profile.proof.expectedClassification) {
    throw new Error('Worker TSan synthetic race report is missing or malformed');
  }
}

function runSuite(profile, environment) {
  const configured = configureWorkerTsan(profile);
  buildTargets(configured, [WORKER_TEST_TARGET]);
  listWorkerTests(configured, profile, environment);
  const ctest = resolve(configured.tools.cmake, '..', 'ctest');
  const result = executeBounded(
    ctest,
    [
      '--test-dir',
      configured.buildRoot,
      '--output-on-failure',
      '--parallel',
      String(resolveNativeBuildJobs({ backend: 'cpu' })),
      '-R',
      profile.suite.testPattern,
    ],
    environment,
    profile.suite.timeoutMilliseconds,
    'worker concurrency suite',
  );
  if (result.status !== 0) {
    throw new Error(
      `Worker TSan worker concurrency suite failed${result.classification ? `: ${result.classification}` : ''}`,
    );
  }
  if (result.classification !== null) throw new Error(`Worker TSan finding: ${result.classification}`);
}

try {
  const mode = process.argv[2];
  if (mode !== '--mode=proof' && mode !== '--mode=suite') throw new Error('Expected --mode=proof or --mode=suite');
  requireLinux();
  const profile = readProfile();
  const environment = threadSanitizerRuntimeEnvironment(process.env, profile.target.os);
  if (mode === '--mode=proof') runProof(profile, environment);
  else runSuite(profile, environment);
  process.stdout.write(`${profile.profileId}\t${mode.slice('--mode='.length)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Worker TSan gate failed'}\n`);
  process.exitCode = 1;
}
