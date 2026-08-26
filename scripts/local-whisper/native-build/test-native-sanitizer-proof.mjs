import { spawnSync } from 'node:child_process';
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';

import { parseArguments, readJson, requiredArgument, writeJsonAtomic } from '../source-import/native-source-core.mjs';
import { auditDisconnectedBuild } from './disconnected-build-core.mjs';
import { verifyQualificationEvidence } from './native-toolchain-evidence-core.mjs';
import { readSanitizerFixtureIdentity } from './qualification-fixture-core.mjs';
import { resolveNativeBuildJobs } from './native-build-parallelism.mjs';
import { sanitizerRuntimeEnvironment } from './sanitizer-runtime-policy.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');
const REQUIRED_PROFILE = 'linux-x64-clang-18.1.3-asan-ubsan-v1';
const PREPARED_LINUX_QUALITY_MODE = 'prepared-linux-quality';

function runPrepared(command, arguments_, environment, label) {
  const result = spawnSync(command, arguments_, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0) throw new Error(`Prepared sanitizer ${label} failed`);
}

function verifyPreparedFailure(command, environment, label, markers) {
  const result = spawnSync(command, [], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (
    result.error ||
    result.status === null ||
    result.status === 0 ||
    !markers.every((marker) => output.includes(marker))
  ) {
    throw new Error(`Prepared sanitizer ${label} did not fail with its expected classification`);
  }
}

function stagePreparedRuntime(compiler, buildRoot, environment) {
  const result = spawnSync(compiler, ['--print-resource-dir'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 1024 * 1024,
    shell: false,
  });
  const resourceDirectory = result.stdout?.trim() ?? '';
  if (result.error || result.status !== 0 || !resourceDirectory.startsWith('/')) {
    throw new Error('Prepared sanitizer runtime directory is unavailable');
  }
  const runtimeDirectory = resolve(resourceDirectory, 'lib', 'linux');
  const stagingDirectory = resolve(buildRoot, 'lib');
  mkdirSync(stagingDirectory, { mode: 0o700 });
  for (const name of ['libclang_rt.asan-x86_64.so', 'libclang_rt.ubsan_standalone-x86_64.so']) {
    const source = resolve(runtimeDirectory, name);
    if (!existsSync(source)) throw new Error('Prepared sanitizer runtime is unavailable');
    copyFileSync(source, resolve(stagingDirectory, name), constants.COPYFILE_EXCL);
  }
}

function provePreparedLinuxSanitizers(profile) {
  if (process.platform !== 'linux') throw new Error('Prepared sanitizer proof supports Linux only');
  const fixture = readSanitizerFixtureIdentity(workspaceRoot);
  if (fixture.manifestSha256 !== profile.qualificationFixture.manifestSha256) {
    throw new Error('Prepared sanitizer fixture identity changed');
  }
  const buildRoot = mkdtempSync(resolve(tmpdir(), 'local-whisper-prepared-sanitizer-proof-'));
  const cmake = process.env.CMAKE_COMMAND ?? 'cmake';
  const ninja = process.env.NINJA_COMMAND ?? 'ninja';
  const compiler = process.env.LOCAL_WHISPER_CLANG_CXX_COMPILER ?? process.env.CXX ?? 'clang++-18';
  const environment = sanitizerRuntimeEnvironment(
    { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH ?? '/usr/bin:/bin' },
    'linux',
    true,
  );
  try {
    runPrepared(
      cmake,
      [
        '-S',
        fixture.root,
        '-B',
        buildRoot,
        '-G',
        'Ninja',
        `-DCMAKE_CXX_COMPILER=${compiler}`,
        `-DCMAKE_MAKE_PROGRAM=${ninja}`,
      ],
      environment,
      'configure',
    );
    runPrepared(
      cmake,
      [
        '--build',
        buildRoot,
        '--target',
        ...profile.expectedBuildGraph,
        '--parallel',
        String(resolveNativeBuildJobs({ backend: 'cpu' })),
      ],
      environment,
      'build',
    );
    stagePreparedRuntime(compiler, buildRoot, environment);
    const binary = (name) => resolve(buildRoot, 'bin', name);
    runPrepared(binary('local-whisper-sanitizer-clean'), [], environment, 'clean execution');
    verifyPreparedFailure(binary('local-whisper-sanitizer-asan-trigger'), environment, 'ASan trigger', [
      'AddressSanitizer',
      'heap-use-after-free',
    ]);
    verifyPreparedFailure(binary('local-whisper-sanitizer-ubsan-trigger'), environment, 'UBSan trigger', [
      'runtime error:',
      'signed integer overflow',
    ]);
  } finally {
    rmSync(buildRoot, { force: true, recursive: true });
  }
}

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = requiredArgument(arguments_, 'profile');
  if (profileId !== REQUIRED_PROFILE) throw new Error('Sanitizer proof accepts only the pinned Clang profile');
  const profile = readJson(
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'profiles', `${profileId}.json`),
  );
  const mode = arguments_.get('mode');
  if (mode !== undefined && mode !== PREPARED_LINUX_QUALITY_MODE) {
    throw new Error(`Unsupported sanitizer proof mode: ${mode}`);
  }
  if (mode === PREPARED_LINUX_QUALITY_MODE) {
    provePreparedLinuxSanitizers(profile);
    process.stdout.write(`${profileId}\t${PREPARED_LINUX_QUALITY_MODE}\n`);
    process.exit(0);
  }
  const toolchainRoot = resolve(
    arguments_.get('toolchain-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'),
  );
  const sourceStoreRoot = resolve(
    arguments_.get('source-store-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'native-sources'),
  );
  const evidence = auditDisconnectedBuild(workspaceRoot, profile, sourceStoreRoot, toolchainRoot);
  const schema = JSON.parse(
    readFileSync(
      resolve(
        workspaceRoot,
        'runtime',
        'local-whisper',
        'toolchains',
        'schema',
        'native-toolchain-evidence.schema.json',
      ),
      'utf8',
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(evidence))
    throw new Error(`Native sanitizer evidence schema failed: ${ajv.errorsText(validate.errors)}`);
  verifyQualificationEvidence(profile, evidence);
  const output = resolve(
    arguments_.get('output') ??
      resolve(workspaceRoot, '.cache', 'local-whisper', 'qualification-candidates', `${profileId}.evidence.json`),
  );
  writeJsonAtomic(output, evidence);
  process.stdout.write(`${profileId}\t${output}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native sanitizer proof failed'}\n`);
  process.exitCode = 1;
}
