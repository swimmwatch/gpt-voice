import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism, freemem, tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { resolveNativeBuildJobs } from './native-build-parallelism.mjs';
import { sanitizerRuntimeEnvironment } from './sanitizer-runtime-policy.mjs';

const GIBIBYTE = 1024 ** 3;
const MEBIBYTE = 1024 ** 2;
export const NATIVE_FUZZ_MUTATION_SECONDS = 60;
export const NATIVE_FUZZ_RSS_LIMIT_MB = 2 * 1024;
const FUZZ_MUTATION_SECONDS = NATIVE_FUZZ_MUTATION_SECONDS;
const FUZZ_RSS_LIMIT_MB = NATIVE_FUZZ_RSS_LIMIT_MB;
const FUZZ_RSS_LIMIT_BYTES = FUZZ_RSS_LIMIT_MB * MEBIBYTE;
const FUZZ_RESERVED_MEMORY_BYTES = 2 * GIBIBYTE;
const MAXIMUM_CONTRACT_OUTPUT_BYTES = 4 * 1024;
const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const FIXTURE_ROOT = resolve(WORKSPACE_ROOT, 'tests', 'fixtures', 'local-whisper');
const NATIVE_SOURCE_ROOT = resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'native-sources', 'sha256');
const NLOHMANN_SOURCE = resolve(NATIVE_SOURCE_ROOT, '1bd7718fe4b5a7e2aebe60abc6f5f94c313d8f472542e715766158a738e8ea47');
const SUPPORTED_MODES = new Set(['corpora', 'fuzz', 'all', 'proof']);

const FUZZ_PROJECTS = Object.freeze({
  common: Object.freeze({
    buildDirectory: resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'fuzz', 'common'),
    contractExecutable: 'local_whisper_common_fuzz_contracts',
    fuzzOption: 'LOCAL_WHISPER_COMMON_ENABLE_FUZZING',
    sanitizerOption: 'LOCAL_WHISPER_COMMON_ENABLE_SANITIZERS',
    sourceDirectory: resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', 'common'),
  }),
  fsGuard: Object.freeze({
    buildDirectory: resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'fuzz', 'fs-guard'),
    contractExecutable: 'fs_guard_fuzz_contracts',
    fuzzOption: 'FS_GUARD_ENABLE_FUZZING',
    sanitizerOption: 'FS_GUARD_ENABLE_SANITIZERS',
    sourceDirectory: resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', 'fs-guard'),
  }),
  launcher: Object.freeze({
    buildDirectory: resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'fuzz', 'launcher'),
    contractExecutable: 'local_whisper_launcher_fuzz_contracts',
    fuzzOption: 'LOCAL_WHISPER_LAUNCHER_ENABLE_FUZZING',
    sanitizerOption: 'LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS',
    sourceDirectory: resolve(WORKSPACE_ROOT, 'runtime', 'local-whisper', 'launcher'),
  }),
});

export const NATIVE_FUZZ_TARGETS = Object.freeze([
  Object.freeze({
    boundaryKind: 'frame',
    corpusDirectories: ['protocol/v1/control', 'protocol/v1/audio', 'protocol/v1/malformed'],
    executable: 'local_whisper_common_fuzz_frame_codec',
    id: 'frame-codec',
    project: 'common',
    seed: 'LWFR1',
  }),
  Object.freeze({
    boundaryKind: 'json',
    corpusDirectories: ['protocol/v1/json'],
    executable: 'local_whisper_common_fuzz_bounded_json',
    id: 'bounded-json',
    project: 'common',
    seed: '{"synthetic":true}',
  }),
  Object.freeze({
    boundaryKind: 'wav',
    corpusDirectories: ['protocol/v1/wav'],
    executable: 'local_whisper_common_fuzz_canonical_wav',
    id: 'canonical-wav',
    project: 'common',
    seed: 'RIFF',
  }),
  Object.freeze({
    boundaryKind: 'authority',
    corpusDirectories: ['protocol/v1/authority'],
    executable: 'local_whisper_common_fuzz_model_authority',
    id: 'model-authority',
    project: 'common',
    seed: 'LWAR1',
  }),
  Object.freeze({
    boundaryKind: 'identity',
    corpusDirectories: ['fuzz/v1/device-proof'],
    executable: 'local_whisper_common_fuzz_device_proof',
    id: 'device-proof',
    project: 'common',
    seed: 'synthetic-device-0',
  }),
  Object.freeze({
    boundaryKind: 'line',
    corpusDirectories: ['fuzz/v1/fs-guard'],
    executable: 'fs_guard_request_fuzz',
    id: 'fs-guard-request',
    project: 'fsGuard',
    seed: '7\t1\tRELEASE\tbGVhc2UtMQ',
  }),
  Object.freeze({
    boundaryKind: 'line',
    corpusDirectories: ['fuzz/v1/launcher'],
    executable: 'local_whisper_launcher_request_fuzz',
    id: 'launcher-request',
    project: 'launcher',
    seed:
      'LWLP2\tfixture_nonce_1234\tprobe\tL21hbmFnZWQvcnVudGltZS93b3JrZXI\tL21hbmFnZWQvcnVudGltZQ\t' +
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tNw\tMTE\t1\t320\tOQ\t4096\tregular\tNw\tOQ\t1\t448\tNQ\t8192\tdirectory',
  }),
]);

function assertWithin(root, candidate, label) {
  const path = resolve(candidate);
  const pathRelative = relative(root, path);
  if (pathRelative === '' || pathRelative.startsWith('..') || pathRelative.includes('..' + '/')) {
    throw new Error(`${label} escaped its allowed root`);
  }
  return path;
}

function requireFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is unavailable`);
  return path;
}

function preparedLinuxTools(environment) {
  if (process.platform !== 'linux') throw new Error('Bounded native parser fuzzing supports Linux only');
  if (environment.LOCAL_WHISPER_PREPARED_LINUX_QUALITY !== 'true') {
    throw new Error('Bounded native parser fuzzing requires the prepared Linux quality toolchain');
  }
  const tools = Object.freeze({
    cCompiler: environment.LOCAL_WHISPER_CLANG_C_COMPILER || environment.CC || '',
    cmake: environment.CMAKE_COMMAND || '',
    cxxCompiler: environment.LOCAL_WHISPER_CLANG_CXX_COMPILER || environment.CXX || '',
    ninja: environment.NINJA_COMMAND || '',
  });
  for (const [label, path] of Object.entries(tools)) requireFile(path, `Prepared ${label}`);
  requireFile(resolve(NLOHMANN_SOURCE, 'single_include', 'nlohmann', 'json.hpp'), 'Verified nlohmann/json');
  return tools;
}

function execute(command, arguments_, { cwd = WORKSPACE_ROOT, env, stdio = 'ignore' } = {}) {
  return new Promise((_resolve) => {
    const child = spawn(command, arguments_, { cwd, env, shell: false, stdio });
    child.once('error', () => _resolve(Object.freeze({ code: null, signal: null, started: false })));
    child.once('exit', (code, signal) => _resolve(Object.freeze({ code, signal, started: true })));
  });
}

async function runRequired(command, arguments_, options, label) {
  const result = await execute(command, arguments_, options);
  if (!result.started || result.code !== 0 || result.signal !== null) {
    throw new Error(`${label} failed without emitting attacker-controlled diagnostics`);
  }
  return result;
}

function projectTargets(projectId, includeProof) {
  const selected = NATIVE_FUZZ_TARGETS.filter((target) => target.project === projectId).map(
    (target) => target.executable,
  );
  if (includeProof && projectId === 'common') selected.push('local_whisper_common_fuzz_proof');
  return selected;
}

async function configureAndBuildProjects(tools, includeProof) {
  for (const [projectId, project] of Object.entries(FUZZ_PROJECTS)) {
    const configureArguments = [
      '-S',
      project.sourceDirectory,
      '-B',
      project.buildDirectory,
      '-G',
      'Ninja',
      `-DCMAKE_BUILD_TYPE=Debug`,
      '-DBUILD_TESTING=OFF',
      `-DCMAKE_C_COMPILER=${tools.cCompiler}`,
      `-DCMAKE_CXX_COMPILER=${tools.cxxCompiler}`,
      `-DCMAKE_MAKE_PROGRAM=${tools.ninja}`,
      '-DCMAKE_SKIP_BUILD_RPATH=ON',
      '-DFETCHCONTENT_FULLY_DISCONNECTED=ON',
      `-D${project.fuzzOption}=ON`,
      `-D${project.sanitizerOption}=ON`,
    ];
    if (projectId === 'common') {
      configureArguments.push(`-DLOCAL_WHISPER_NLOHMANN_SOURCE=${NLOHMANN_SOURCE}`);
    }
    await runRequired(
      tools.cmake,
      configureArguments,
      { env: process.env, stdio: 'inherit' },
      `${projectId} configure`,
    );
    await runRequired(
      tools.cmake,
      [
        '--build',
        project.buildDirectory,
        '--parallel',
        String(resolveNativeBuildJobs({ backend: 'cpu' })),
        '--target',
        project.contractExecutable,
        ...projectTargets(projectId, includeProof),
      ],
      { env: process.env, stdio: 'inherit' },
      `${projectId} fuzz build`,
    );
  }
}

function parseContracts(output, expectedIds) {
  const contracts = new Map();
  for (const line of output.trim().split('\n')) {
    const matched = /^([a-z-]+)\t([1-9]\d*)$/u.exec(line);
    if (!matched || contracts.has(matched[1])) throw new Error('Fuzz contract metadata is malformed');
    contracts.set(matched[1], Number(matched[2]));
  }
  if (contracts.size !== expectedIds.size || [...contracts.keys()].some((id) => !expectedIds.has(id))) {
    throw new Error('Fuzz contract metadata does not match the required targets');
  }
  return contracts;
}

function readProjectContracts(projectId) {
  const project = FUZZ_PROJECTS[projectId];
  const executable = requireFile(
    resolve(project.buildDirectory, project.contractExecutable),
    'Fuzz contract executable',
  );
  const result = spawnSync(executable, [], {
    cwd: project.buildDirectory,
    encoding: 'utf8',
    env: sanitizerRuntimeEnvironment(process.env, 'linux', true),
    maxBuffer: MAXIMUM_CONTRACT_OUTPUT_BYTES,
    shell: false,
  });
  if (result.error || result.status !== 0 || result.signal !== null) {
    throw new Error('Fuzz contract executable failed');
  }
  return parseContracts(
    result.stdout,
    new Set(NATIVE_FUZZ_TARGETS.filter((target) => target.project === projectId).map((target) => target.id)),
  );
}

function readFuzzContracts() {
  const contracts = new Map();
  for (const projectId of Object.keys(FUZZ_PROJECTS)) {
    for (const [id, inputLimit] of readProjectContracts(projectId)) {
      if (contracts.has(id)) throw new Error('Fuzz contract metadata has duplicate targets');
      contracts.set(id, inputLimit);
    }
  }
  return contracts;
}

function listRegularFiles(root, allowedRoot = FIXTURE_ROOT) {
  const directory = assertWithin(allowedRoot, root, 'Fuzz corpus directory');
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = assertWithin(directory, resolve(directory, entry.name), 'Fuzz corpus entry');
    if (entry.isDirectory()) {
      files.push(...listRegularFiles(path, allowedRoot));
    } else if (entry.isFile() && !lstatSync(path).isSymbolicLink()) {
      files.push(path);
    } else {
      throw new Error('Fuzz corpus contains an unsupported filesystem entry');
    }
  }
  return files;
}

function writeCanonicalWav(path, size) {
  const wav = Buffer.alloc(size);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(size - 8, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16_000, 24);
  wav.writeUInt32LE(48_000, 28);
  wav.writeUInt16LE(3, 32);
  wav.writeUInt16LE(24, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(size - 44, 40);
  writeFileSync(path, wav, { mode: 0o600 });
}

function writeBoundaryInput(path, kind, size) {
  if (kind === 'frame') {
    const frame = Buffer.alloc(size);
    frame.writeUInt32BE(size - 5, 0);
    frame[4] = 2;
    writeFileSync(path, frame, { mode: 0o600 });
    return;
  }
  if (kind === 'wav') {
    writeCanonicalWav(path, size);
    return;
  }
  if (kind === 'identity') {
    writeFileSync(path, Buffer.alloc(size, 'a'), { mode: 0o600 });
    return;
  }
  writeFileSync(path, Buffer.alloc(size, kind === 'json' ? ' ' : 'a'), { mode: 0o600 });
}

function stageTargetCorpus(target, inputLimit, temporaryRoot) {
  if (!Number.isSafeInteger(inputLimit) || inputLimit < 2) throw new Error('Fuzz input limit is invalid');
  const corpusRoot = assertWithin(temporaryRoot, resolve(temporaryRoot, 'corpora', target.id), 'Staged fuzz corpus');
  mkdirSync(corpusRoot, { mode: 0o700, recursive: true });
  mkdirSync(resolve(corpusRoot, 'artifacts'), { mode: 0o700 });
  let fileIndex = 0;
  for (const corpusDirectory of target.corpusDirectories) {
    for (const source of listRegularFiles(resolve(FIXTURE_ROOT, corpusDirectory))) {
      copyFileSync(source, resolve(corpusRoot, `fixture-${fileIndex++}.bin`), 0);
    }
  }
  writeFileSync(resolve(corpusRoot, 'synthetic-seed.bin'), target.seed, { mode: 0o600 });
  writeBoundaryInput(resolve(corpusRoot, 'exact-limit.bin'), target.boundaryKind, inputLimit - 1);
  writeBoundaryInput(resolve(corpusRoot, 'one-over-limit.bin'), target.boundaryKind, inputLimit);
  return corpusRoot;
}

export function resolveNativeFuzzJobs({ availableCores = availableParallelism(), freeMemoryBytes = freemem() } = {}) {
  if (!Number.isSafeInteger(availableCores) || availableCores <= 0) throw new Error('Fuzz CPU count is invalid');
  if (!Number.isSafeInteger(freeMemoryBytes) || freeMemoryBytes < 0) {
    throw new Error('Fuzz free memory is invalid');
  }
  const usableMemoryBytes = Math.max(0, freeMemoryBytes - FUZZ_RESERVED_MEMORY_BYTES);
  const memoryJobs = Math.max(1, Math.floor(usableMemoryBytes / FUZZ_RSS_LIMIT_BYTES));
  return Math.max(1, Math.min(availableCores, memoryJobs));
}

async function runInBatches(work, maximumParallelism) {
  for (let offset = 0; offset < work.length; offset += maximumParallelism) {
    await Promise.all(work.slice(offset, offset + maximumParallelism).map((run) => run()));
  }
}

function targetExecutable(target) {
  const project = FUZZ_PROJECTS[target.project];
  return requireFile(resolve(project.buildDirectory, target.executable), 'Fuzz target executable');
}

function fuzzArguments(inputLimit, corpusRoot) {
  return [
    `-max_total_time=${FUZZ_MUTATION_SECONDS}`,
    `-rss_limit_mb=${FUZZ_RSS_LIMIT_MB}`,
    `-max_len=${inputLimit}`,
    `-artifact_prefix=${resolve(corpusRoot, 'artifacts')}/`,
    corpusRoot,
  ];
}

async function runCorpusRegression(target, corpusRoot) {
  const files = listRegularFiles(corpusRoot, resolve(corpusRoot, '..'));
  if (files.length === 0) throw new Error('Staged fuzz corpus is empty');
  const executable = targetExecutable(target);
  await runInBatches(
    files.map((file) => async () => {
      await runRequired(
        executable,
        [file],
        { env: sanitizerRuntimeEnvironment(process.env, 'linux', true) },
        `Fuzz corpus regression ${target.id}`,
      );
    }),
    resolveNativeFuzzJobs(),
  );
}

async function runMutation(target, inputLimit, corpusRoot) {
  await runRequired(
    targetExecutable(target),
    fuzzArguments(inputLimit, corpusRoot),
    { env: sanitizerRuntimeEnvironment(process.env, 'linux', true) },
    `Fuzz mutation ${target.id}`,
  );
}

async function runProof(temporaryRoot) {
  const proofInput = assertWithin(temporaryRoot, resolve(temporaryRoot, 'proof.bin'), 'Fuzz proof input');
  writeFileSync(proofInput, Buffer.from([0]), { mode: 0o600 });
  const executable = targetExecutable({ executable: 'local_whisper_common_fuzz_proof', project: 'common' });
  const result = await execute(executable, ['-runs=1', proofInput], {
    env: sanitizerRuntimeEnvironment(process.env, 'linux', true),
  });
  if (!result.started || (result.code === 0 && result.signal === null)) {
    throw new Error('The deterministic fuzz failure proof did not fail closed');
  }
}

function requestedMode(arguments_) {
  if (arguments_.length !== 1 || !arguments_[0].startsWith('--mode=')) {
    throw new Error('Expected exactly one --mode=corpora|fuzz|all|proof argument');
  }
  const mode = arguments_[0].slice('--mode='.length);
  if (!SUPPORTED_MODES.has(mode)) throw new Error('Unsupported native fuzz mode');
  return mode;
}

export async function runNativeFuzzing(mode) {
  const tools = preparedLinuxTools(process.env);
  const includeProof = mode === 'proof';
  await configureAndBuildProjects(tools, includeProof);
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'local-whisper-fuzz-'));
  try {
    if (mode === 'proof') {
      await runProof(temporaryRoot);
      process.stdout.write('Local Whisper fuzz failure proof passed\n');
      return;
    }
    const contracts = readFuzzContracts();
    const stagedCorpora = new Map(
      NATIVE_FUZZ_TARGETS.map((target) => [
        target.id,
        stageTargetCorpus(target, contracts.get(target.id), temporaryRoot),
      ]),
    );
    await runInBatches(
      NATIVE_FUZZ_TARGETS.map((target) => async () => {
        process.stdout.write(`Local Whisper fuzz corpus regression: ${target.id}\n`);
        await runCorpusRegression(target, stagedCorpora.get(target.id));
      }),
      resolveNativeFuzzJobs(),
    );
    if (mode === 'corpora') return;
    await runInBatches(
      NATIVE_FUZZ_TARGETS.map((target) => async () => {
        process.stdout.write(`Local Whisper fuzz mutation: ${target.id}\n`);
        await runMutation(target, contracts.get(target.id), stagedCorpora.get(target.id));
      }),
      resolveNativeFuzzJobs(),
    );
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runNativeFuzzing(requestedMode(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(
      `Local Whisper bounded parser fuzzing failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
