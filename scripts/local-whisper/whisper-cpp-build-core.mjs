import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import { resolveClangFormat, resolveClangTidy } from './native-quality-tools.mjs';
import { verifyLoaderLimitAuthority } from './native-build/loader-limit-core.mjs';
import {
  resolveProfileTool,
  verifyToolchainContract,
  verifyToolchainInputs,
} from './native-build/native-toolchain-core.mjs';
import { applyPatchLock, verifyPatchLock } from './source-import/native-patch-core.mjs';
import {
  buildIndexManifest,
  canonicalDigest,
  readJson,
  verifyMaterializedSource,
} from './source-import/native-source-core.mjs';

export const workspaceRoot = resolve(import.meta.dirname, '..', '..');
export const whisperCppRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'whisper-cpp');
export const sourceStoreRoot = resolve(workspaceRoot, '.cache', 'local-whisper', 'native-sources');
export const toolchainRoot = resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains');
export const taskCacheRoot = resolve(workspaceRoot, '.cache', 'local-whisper', 'whisper-cpp');
export const fixtureRoot = resolve(workspaceRoot, 'tests', 'fixtures', 'local-whisper', 'protocol', 'v1');
export const nlohmannSource = resolve(
  sourceStoreRoot,
  'sha256',
  '1bd7718fe4b5a7e2aebe60abc6f5f94c313d8f472542e715766158a738e8ea47',
);
export const googleTestSource = resolve(
  sourceStoreRoot,
  'sha256',
  '9150f03cee9cb222456fcd0945d5285a1742b080c7ad7c47ed88b95c518afe7c',
);
export const sourceLockPath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'sources',
  'locks',
  'whisper-cpp-v1.9.1-f049fff.json',
);
export const nlohmannSourceLockPath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'sources',
  'locks',
  'nlohmann-json-v3.12.0-subset.json',
);
export const limitTablePath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'sources',
  'limits',
  'whisper-cpp-loader-limits-v1.json',
);
const limitProvenancePath = resolve(
  workspaceRoot,
  'runtime',
  'local-whisper',
  'sources',
  'limits',
  'whisper-cpp-loader-limits-v1.provenance.json',
);
export const patchRoot = resolve(whisperCppRoot, 'patches');
export const patchLockPath = resolve(patchRoot, 'device-cancel', 'local-whisper-whisper-cpp-device-cancel-v1.json');
export const patchedSourceRoot = resolve(taskCacheRoot, 'patched-source');
export const generatedIncludeRoot = resolve(taskCacheRoot, 'generated');

const allowedProfiles = new Set([
  'linux-x64-cpu-baseline-v1',
  'linux-x64-clang-18.1.3-asan-ubsan-v1',
  'linux-x64-cuda-12.8.1-sm120a-v1',
  'windows-x64-cpu-candidate-task19-v1',
  'windows-x64-cuda-12.8.1-sm120a-candidate-task19-v1',
]);

function assertTaskOwnedPath(path) {
  const child = relative(taskCacheRoot, path);
  if (child.length === 0 || child.startsWith('..') || isAbsolute(child)) {
    throw new Error('Whisper.cpp generated path escaped its private task root');
  }
}

export function removeTaskOwnedTree(path) {
  assertTaskOwnedPath(path);
  if (!existsSync(path)) return;
  const makeWritable = (entryPath) => {
    const metadata = lstatSync(entryPath);
    if (metadata.isSymbolicLink()) throw new Error('Whisper.cpp task cleanup rejects symbolic links');
    if (metadata.isDirectory()) {
      chmodSync(entryPath, 0o700);
      for (const entry of readdirSync(entryPath, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error('Whisper.cpp task cleanup rejects symbolic links');
        makeWritable(resolve(entryPath, entry.name));
      }
      return;
    }
    if (!metadata.isFile()) throw new Error('Whisper.cpp task cleanup rejects special files');
    chmodSync(entryPath, 0o600);
  };
  makeWritable(path);
  rmSync(path, { force: true, recursive: true });
}

export function parseArguments(arguments_) {
  const result = new Map();
  for (const argument of arguments_) {
    if (!argument.startsWith('--')) throw new Error(`Invalid or duplicate argument: ${argument}`);
    const separator = argument.indexOf('=');
    const key = argument.slice(2, separator === -1 ? undefined : separator);
    const value = separator === -1 ? true : argument.slice(separator + 1);
    if (!/^[a-z][a-z0-9-]*$/u.test(key) || value === '' || result.has(key))
      throw new Error(`Invalid or duplicate argument: ${argument}`);
    result.set(key, value);
  }
  return result;
}

export function requireProfile(profileId) {
  if (!allowedProfiles.has(profileId)) throw new Error(`Unsupported Whisper.cpp profile: ${profileId}`);
  return readJson(resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'profiles', `${profileId}.json`));
}

export function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    encoding: options.encoding,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
    stdio: options.encoding ? 'pipe' : 'inherit',
  });
  if (result.error || result.status !== 0) {
    const diagnostics = options.encoding ? `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim() : '';
    throw new Error(`${options.label ?? command} failed${diagnostics ? `: ${diagnostics}` : ''}`);
  }
  return result;
}

function verifyLimitTable() {
  const sourceLock = readJson(sourceLockPath);
  const table = readJson(limitTablePath);
  const provenance = readJson(limitProvenancePath);
  verifyLoaderLimitAuthority(workspaceRoot, sourceLock, table, provenance);
  return table;
}

function range(name, value) {
  return `inline constexpr RangeLimit ${name}{${value.minimum}ULL, ${value.maximum}ULL};`;
}

export function generateLimitHeader() {
  const table = verifyLimitTable();
  mkdirSync(generatedIncludeRoot, { mode: 0o700, recursive: true });
  const limits = table.limits;
  const contents = [
    '#pragma once',
    '',
    '#include "local_whisper/whisper_cpp/loader_limits.hpp"',
    '',
    '#include <cstdint>',
    '#include <string_view>',
    '',
    'namespace local_whisper::whisper_cpp::generated {',
    `inline constexpr std::string_view kTableId = "${table.tableId}";`,
    `inline constexpr std::string_view kTableSha256 = "${table.tableSha256}";`,
    range('kAuthenticatedModelBytes', limits.authenticatedModelBytes),
    range('kVocabularyCount', limits.vocabularyCount),
    range('kAudioContext', limits.audioContext),
    range('kAudioState', limits.audioState),
    range('kAudioHeads', limits.audioHeads),
    range('kAudioLayers', limits.audioLayers),
    range('kTextContext', limits.textContext),
    range('kTextState', limits.textState),
    range('kTextHeads', limits.textHeads),
    range('kTextLayers', limits.textLayers),
    range('kMelDimension', limits.melDimension),
    range('kTokenBytes', limits.tokenBytes),
    range('kTensorRank', limits.tensorRank),
    range('kTensorNameBytes', limits.tensorNameBytes),
    range('kTensorDimension', limits.tensorDimension),
    `inline constexpr std::uint64_t kMelFilterElements = ${limits.melFilterElements}ULL;`,
    `inline constexpr std::uint64_t kMelFilterBytes = ${limits.melFilterBytes}ULL;`,
    `inline constexpr std::uint64_t kAggregateTokenBytes = ${limits.aggregateTokenBytes}ULL;`,
    `inline constexpr std::uint64_t kTensorCount = ${limits.tensorCount}ULL;`,
    `inline constexpr std::uint64_t kTensorElementProduct = ${limits.tensorElementProduct}ULL;`,
    `inline constexpr std::uint64_t kTensorPayloadBytes = ${limits.tensorPayloadBytes}ULL;`,
    `inline constexpr std::uint64_t kAggregateTensorPayloadBytes = ${limits.aggregateTensorPayloadBytes}ULL;`,
    `inline constexpr std::uint64_t kAggregateParsedMetadataBytes = ${limits.aggregateParsedMetadataBytes}ULL;`,
    '} // namespace local_whisper::whisper_cpp::generated',
    '',
  ].join('\n');
  writeFileSync(resolve(generatedIncludeRoot, 'local_whisper_loader_limits.hpp'), contents, {
    mode: 0o600,
  });
  return table;
}

function git(repositoryRoot, arguments_) {
  run('git', ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=true', ...arguments_], {
    cwd: repositoryRoot,
    label: 'strict patch repository operation',
  });
}

function patchedSourceIsCurrent(lock) {
  if (!existsSync(resolve(patchedSourceRoot, '.git')) || !existsSync(resolve(patchedSourceRoot, 'src', 'whisper.cpp')))
    return false;
  try {
    const manifest = buildIndexManifest(patchedSourceRoot);
    const status = spawnSync('git', ['status', '--porcelain=v1'], {
      cwd: patchedSourceRoot,
      encoding: 'utf8',
      shell: false,
    });
    return status.status === 0 && status.stdout.trim() === '' && manifest.manifestSha256 === lock.finalManifestSha256;
  } catch {
    return false;
  }
}

export function preparePatchedSource() {
  const sourceLock = readJson(sourceLockPath);
  const lock = readJson(patchLockPath);
  verifyPatchLock(lock, patchRoot);
  const sourceRoot = verifyMaterializedSource(sourceStoreRoot, sourceLock);
  if (patchedSourceIsCurrent(lock)) return realpathSync(patchedSourceRoot);
  assertTaskOwnedPath(patchedSourceRoot);
  rmSync(patchedSourceRoot, { force: true, recursive: true });
  mkdirSync(taskCacheRoot, { mode: 0o700, recursive: true });
  cpSync(sourceRoot, patchedSourceRoot, { recursive: true });
  git(patchedSourceRoot, ['init', '--quiet']);
  git(patchedSourceRoot, ['add', '--force', '.']);
  git(patchedSourceRoot, [
    '-c',
    'user.name=Local Whisper Build',
    '-c',
    'user.email=local-whisper.invalid',
    'commit',
    '--quiet',
    '-m',
    'materialized source',
  ]);
  applyPatchLock(patchedSourceRoot, patchRoot, lock);
  git(patchedSourceRoot, [
    '-c',
    'user.name=Local Whisper Build',
    '-c',
    'user.email=local-whisper.invalid',
    'commit',
    '--quiet',
    '-m',
    'strict core patch',
  ]);
  if (!patchedSourceIsCurrent(lock)) throw new Error('Strict patched source did not preserve its locked manifest');
  return realpathSync(patchedSourceRoot);
}

function profileTools(profile) {
  const inputs = verifyToolchainInputs(profile, toolchainRoot, { allowCandidate: false });
  return {
    cmake: resolveProfileTool(profile, toolchainRoot, 'cmake'),
    cCompiler: resolveProfileTool(profile, toolchainRoot, 'c-compiler'),
    cxxCompiler: resolveProfileTool(profile, toolchainRoot, 'cxx-compiler'),
    cudaCompiler: profile.tools.some((tool) => tool.role === 'cuda-compiler')
      ? resolveProfileTool(profile, toolchainRoot, 'cuda-compiler')
      : null,
    linker: resolveProfileTool(profile, toolchainRoot, 'linker'),
    ninja: resolveProfileTool(profile, toolchainRoot, 'ninja'),
    inputs,
  };
}

export function configureBuild(profileId, { engine, tests }) {
  const profile = requireProfile(profileId);
  if (profile.target.os !== 'linux') throw new Error('Local configure requires a Linux profile');
  verifyToolchainContract(profile, { allowCandidate: false, contractOnly: false });
  const tools = profileTools(profile);
  const buildRoot = resolve(taskCacheRoot, 'build', `${profileId}-${engine ? 'engine' : 'quality'}`);
  mkdirSync(buildRoot, { mode: 0o700, recursive: true });
  const arguments_ = [
    '-S',
    whisperCppRoot,
    '-B',
    buildRoot,
    '-G',
    'Ninja',
    `-DCMAKE_MAKE_PROGRAM=${tools.ninja}`,
    `-DCMAKE_C_COMPILER=${tools.cCompiler}`,
    `-DCMAKE_CXX_COMPILER=${tools.cxxCompiler}`,
    `-DCMAKE_LINKER=${tools.linker}`,
    `-DLOCAL_WHISPER_GENERATED_INCLUDE_DIR=${generatedIncludeRoot}`,
    `-DLOCAL_WHISPER_NLOHMANN_SOURCE=${nlohmannSource}`,
    `-DLOCAL_WHISPER_GOOGLETEST_SOURCE=${googleTestSource}`,
    `-DLOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT=${fixtureRoot}`,
    `-DLOCAL_WHISPER_BUILD_ENGINE=${engine ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_BUILD_TESTS=${tests ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_BACKEND_ID=${profileId.includes('cuda') ? 'cuda' : 'cpu'}`,
    `-DLOCAL_WHISPER_ENABLE_SANITIZERS=${profileId.includes('clang-18.1.3') ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_SOURCE_ROOT=${engine ? preparePatchedSource() : patchedSourceRoot}`,
    `-DLOCAL_WHISPER_RUNTIME_BUILD_DIGEST=${buildIdentity(profileId)}`,
  ];
  if (tools.cudaCompiler !== null) arguments_.push(`-DCMAKE_CUDA_COMPILER=${tools.cudaCompiler}`);
  if (engine) {
    for (const [key, value] of Object.entries(profile.cmakeCache).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      if (key === 'LOCAL_WHISPER_SOURCE_ROOT') continue;
      arguments_.push(`-D${key}=${value}`);
    }
  } else {
    arguments_.push(`-DCMAKE_BUILD_TYPE=${profileId.includes('clang-18.1.3') ? 'Debug' : 'Release'}`);
    arguments_.push('-DCMAKE_SKIP_BUILD_RPATH=ON', '-DCMAKE_CXX_SCAN_FOR_MODULES=OFF');
  }
  run(tools.cmake, arguments_, { label: `configure ${profileId}` });
  return { buildRoot, profile, tools };
}

export function buildTargets(configured, targets) {
  run(configured.tools.cmake, ['--build', configured.buildRoot, '--parallel', '2', '--target', ...targets], {
    label: `build ${targets.join(', ')}`,
  });
}

export function runTests(configured, label) {
  const ctest = resolve(configured.tools.cmake, '..', 'ctest');
  run(ctest, ['--test-dir', configured.buildRoot, '--output-on-failure', '-L', label], {
    env: {
      ...process.env,
      ASAN_OPTIONS: 'detect_leaks=1:halt_on_error=1:strict_string_checks=1',
      UBSAN_OPTIONS: 'halt_on_error=1:print_stacktrace=1',
    },
    label: `${label} tests`,
  });
}

export function projectNativeFiles() {
  const result = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:cpp|hpp)$/u.test(entry.name)) result.push(path);
    }
  };
  walk(whisperCppRoot);
  return result;
}

export function runFormattingAndTidy(configured, engineConfigured) {
  const clangRoot = resolve(toolchainRoot, 'clang-18.1.3', 'usr', 'lib', 'llvm-18', 'bin');
  const files = projectNativeFiles();
  run(resolveClangFormat(workspaceRoot, clangRoot), ['--dry-run', '--Werror', ...files], {
    label: 'Whisper.cpp project clang-format',
  });
  const qualityFiles = files.filter(
    (path) => (path.includes('/core/') && !path.endsWith('/core/main.cpp')) || path.includes('/device/'),
  );
  const engineFiles = files.filter((path) => path.includes('/adapter/') || path.endsWith('/core/main.cpp'));
  run(resolveClangTidy(workspaceRoot, clangRoot), ['-p', configured.buildRoot, ...qualityFiles], {
    label: 'Whisper.cpp project core clang-tidy',
  });
  run(resolveClangTidy(workspaceRoot, clangRoot), ['-p', engineConfigured.buildRoot, ...engineFiles], {
    label: 'Whisper.cpp project engine clang-tidy',
  });
}

export function buildIdentity(profileId = 'linux-x64-cpu-baseline-v1') {
  const patchLock = readJson(patchLockPath);
  const table = readJson(limitTablePath);
  const profile = requireProfile(profileId);
  return canonicalDigest({
    sourceLockId: patchLock.sourceLockId,
    patchedManifestSha256: patchLock.finalManifestSha256,
    patchLockId: patchLock.lockId,
    tableSha256: table.tableSha256,
    profileId: profile.profileId,
    profileEvidenceDigest: profile.evidenceDigest,
  });
}

export function requireVerifiedInputs() {
  for (const path of [
    nlohmannSource,
    googleTestSource,
    sourceLockPath,
    nlohmannSourceLockPath,
    patchLockPath,
    limitTablePath,
  ]) {
    if (!existsSync(path)) throw new Error(`Required verified Whisper.cpp input is unavailable: ${path}`);
  }
  generateLimitHeader();
  preparePatchedSource();
}
