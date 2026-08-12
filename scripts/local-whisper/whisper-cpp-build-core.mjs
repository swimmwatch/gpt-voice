import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import { resolveClangFormat, resolveClangTidy } from './native-quality-tools.mjs';
import { assertClosedHostedWindowsProfile } from './native-build/hosted-toolchain-core.mjs';
import { resolveNativeBuildJobs } from './native-build/native-build-parallelism.mjs';
import { runNativeFileToolInParallel } from './native-build/native-file-tool-parallelism.mjs';
import { sanitizerRuntimeEnvironment, sanitizerRuntimeOptions } from './native-build/sanitizer-runtime-policy.mjs';
import { verifyLoaderLimitAuthority } from './native-build/loader-limit-core.mjs';
import { resolveNetworkDeniedCommand } from './native-build/network-denied-build-core.mjs';
import { resolveWindowsMsvcBuildEnvironment } from './native-build/windows-msvc-build-environment.mjs';
import {
  captureToolchainInputLock,
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
export const amdPatchLockPath = resolve(patchRoot, 'amd-preview', 'local-whisper-whisper-cpp-amd-preview-v1.json');
export const patchedSourceRoot = resolve(taskCacheRoot, 'patched-source');
export const amdPatchedSourceRoot = resolve(taskCacheRoot, 'patched-source-amd-preview');
export const generatedIncludeRoot = resolve(taskCacheRoot, 'generated');

const allowedProfiles = new Set([
  'linux-x64-cpu-baseline-v1',
  'linux-x64-clang-18.1.3-asan-ubsan-v1',
  'linux-x64-cuda-12.8.1-sm120a-v1',
  'linux-x64-amd-vulkan-preview-contract-v1',
  'linux-x64-amd-hip-no-approved-row-v1',
  'windows-x64-cpu-msvc-19.39-v1',
  'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1',
  'windows-x64-amd-vulkan-preview-msvc-19.39-v1',
]);

function isAmdPreviewProfile(profileId) {
  return profileId.includes('-amd-');
}

function patchContract(profileId) {
  return isAmdPreviewProfile(profileId)
    ? { lockPath: amdPatchLockPath, sourceRoot: amdPatchedSourceRoot }
    : { lockPath: patchLockPath, sourceRoot: patchedSourceRoot };
}

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

/** Returns platform-specific CMake cache values required by the locked native build. */
export function platformBuildCmakeArguments(profile) {
  return profile.target.os === 'windows' ? ['-DGGML_CCACHE=OFF'] : [];
}

export function requireProfile(profileId) {
  if (!allowedProfiles.has(profileId)) throw new Error(`Unsupported Whisper.cpp profile: ${profileId}`);
  return readJson(resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'profiles', `${profileId}.json`));
}

export function run(command, arguments_, options = {}) {
  const captureOutput = options.encoding || options.quiet;
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    encoding: options.encoding,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
    stdio: captureOutput ? 'pipe' : 'inherit',
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

function patchedSourceIsCurrent(lock, sourceRoot) {
  if (!existsSync(resolve(sourceRoot, '.git')) || !existsSync(resolve(sourceRoot, 'src', 'whisper.cpp'))) return false;
  try {
    const manifest = buildIndexManifest(sourceRoot);
    const status = spawnSync('git', ['status', '--porcelain=v1'], {
      cwd: sourceRoot,
      encoding: 'utf8',
      shell: false,
    });
    return status.status === 0 && status.stdout.trim() === '' && manifest.manifestSha256 === lock.finalManifestSha256;
  } catch {
    return false;
  }
}

export function preparePatchedSource(profileId = 'linux-x64-cpu-baseline-v1') {
  const sourceLock = readJson(sourceLockPath);
  const contract = patchContract(profileId);
  const lock = readJson(contract.lockPath);
  verifyPatchLock(lock, patchRoot);
  const sourceRoot = verifyMaterializedSource(sourceStoreRoot, sourceLock);
  if (patchedSourceIsCurrent(lock, contract.sourceRoot)) return realpathSync(contract.sourceRoot);
  assertTaskOwnedPath(contract.sourceRoot);
  rmSync(contract.sourceRoot, { force: true, recursive: true });
  mkdirSync(taskCacheRoot, { mode: 0o700, recursive: true });
  cpSync(sourceRoot, contract.sourceRoot, { recursive: true });
  git(contract.sourceRoot, ['init', '--quiet']);
  git(contract.sourceRoot, ['add', '--force', '.']);
  if (process.platform === 'win32') {
    for (const entry of sourceLock.manifest.filter(({ mode }) => mode === '100755')) {
      git(contract.sourceRoot, ['update-index', '--chmod=+x', '--', entry.path]);
    }
  }
  git(contract.sourceRoot, [
    '-c',
    'user.name=Local Whisper Build',
    '-c',
    'user.email=local-whisper.invalid',
    'commit',
    '--quiet',
    '-m',
    'materialized source',
  ]);
  applyPatchLock(contract.sourceRoot, patchRoot, lock);
  git(contract.sourceRoot, [
    '-c',
    'user.name=Local Whisper Build',
    '-c',
    'user.email=local-whisper.invalid',
    'commit',
    '--quiet',
    '-m',
    'strict core patch',
  ]);
  if (!patchedSourceIsCurrent(lock, contract.sourceRoot))
    throw new Error('Strict patched source did not preserve its locked manifest');
  return realpathSync(contract.sourceRoot);
}

function profileTools(profile) {
  const inputs = verifyToolchainInputs(profile, toolchainRoot, { allowCandidate: profile.target.os === 'windows' });
  return {
    cmake: resolveProfileTool(profile, toolchainRoot, 'cmake'),
    cCompiler: resolveProfileTool(profile, toolchainRoot, 'c-compiler'),
    cxxCompiler: resolveProfileTool(profile, toolchainRoot, 'cxx-compiler'),
    cudaHostCompiler:
      profile.target.os === 'windows' && profile.tools.some((tool) => tool.role === 'cuda-compiler')
        ? inputs.tools.get('cxx-compiler').path
        : null,
    cudaCompiler: profile.tools.some((tool) => tool.role === 'cuda-compiler')
      ? resolveProfileTool(profile, toolchainRoot, 'cuda-compiler')
      : null,
    linker: resolveProfileTool(profile, toolchainRoot, 'linker'),
    ninja: resolveProfileTool(profile, toolchainRoot, 'ninja'),
    inputs,
  };
}

/** Resolves the explicit, already-initialized MSVC tools used by hosted Windows quality CI. */
export function resolvePreparedWindowsQualityTools(environment = process.env) {
  const values = {
    ctest: environment.CTEST_COMMAND,
    cCompiler: environment.CXX,
    cmake: environment.CMAKE_COMMAND,
    cxxCompiler: environment.CXX,
    ninja: environment.NINJA_COMMAND,
  };
  for (const [role, path] of Object.entries(values)) {
    if (typeof path !== 'string' || !isAbsolute(path) || !existsSync(path)) {
      throw new Error(`Windows prepared native tool is unavailable: ${role}`);
    }
  }
  return Object.freeze({ ...values, cudaCompiler: null, cudaHostCompiler: null, inputs: null, linker: null });
}

/** Resolves the explicit Linux tools installed by the hosted native-quality workflow. */
export function resolvePreparedLinuxQualityTools(profile, environment = process.env) {
  if (profile.target.os !== 'linux') throw new Error('Prepared Linux quality tools require a Linux profile');
  const prefix =
    environment.LOCAL_WHISPER_PREPARED_LINUX_COMPATIBILITY === 'true'
      ? 'LOCAL_WHISPER_COMPATIBILITY'
      : profile.profileId.includes('clang')
        ? 'LOCAL_WHISPER_CLANG'
        : 'LOCAL_WHISPER_GCC';
  const values = {
    ctest: environment.CTEST_COMMAND,
    cCompiler: environment[`${prefix}_C_COMPILER`],
    cmake: environment.CMAKE_COMMAND,
    cxxCompiler: environment[`${prefix}_CXX_COMPILER`],
    linker: environment[`${prefix}_LINKER`],
    ninja: environment.NINJA_COMMAND,
  };
  for (const [role, path] of Object.entries(values)) {
    if (typeof path !== 'string' || !isAbsolute(path) || !existsSync(path)) {
      throw new Error(`Linux prepared native tool is unavailable: ${role}`);
    }
  }
  return Object.freeze({ ...values, cudaCompiler: null, cudaHostCompiler: null, inputs: null });
}

function networkDeniedEnvironment(profile, tools) {
  const values = {
    LANG: 'C',
    LC_ALL: 'C',
    PATH: [
      ...new Set([
        dirname(tools.cmake),
        dirname(tools.cCompiler),
        dirname(tools.cxxCompiler),
        dirname(tools.ninja),
        '/usr/bin',
        '/bin',
      ]),
    ].join(':'),
    ...sanitizerRuntimeOptions(profile.target.os, profile.profileId.includes('clang-18.1.3')),
  };
  return Object.fromEntries(profile.environmentAllowlist.map((key) => [key, values[key]]));
}

function runBuildCommand(configured, command, arguments_, label, environment = configured.environment) {
  if (!configured.networkDenied) {
    run(command, arguments_, { env: environment, label, quiet: configured.quiet });
    return;
  }
  const networkDenied = resolveNetworkDeniedCommand({
    arguments_,
    buildRoot: configured.buildRoot,
    command,
    profile: configured.profile,
    toolchainRoot,
  });
  run(networkDenied.command, networkDenied.arguments, {
    cwd: configured.buildRoot,
    env: environment,
    label: `${label} in ${networkDenied.strategy}`,
    quiet: configured.quiet,
  });
}

export function configureBuild(
  profileId,
  {
    directEngine = false,
    engine,
    networkDenied = false,
    preparedLinuxQuality = false,
    preparedWindowsQuality = false,
    quiet = false,
    rootTag = '',
    sanitizers = false,
    tests,
    threadSanitizer = false,
  },
) {
  const profileTemplate = requireProfile(profileId);
  const usePreparedLinuxQuality = profileTemplate.target.os === 'linux' && preparedLinuxQuality;
  const usePreparedWindowsQuality = profileTemplate.target.os === 'windows' && preparedWindowsQuality;
  const profile =
    profileTemplate.target.os === 'windows' && !networkDenied && !usePreparedWindowsQuality
      ? captureToolchainInputLock(profileTemplate, toolchainRoot)
      : profileTemplate;
  if (threadSanitizer && profileTemplate.target.os !== 'linux') {
    throw new Error('ThreadSanitizer requires the Linux Clang worker-test graph');
  }
  const sanitizerEnabled = !threadSanitizer && (sanitizers || profileId.includes('clang-18.1.3'));
  if (isAmdPreviewProfile(profileId)) {
    throw new Error('AMD Preview profiles are contract-only until the packet manual gates pass');
  }
  const hostOs = process.platform === 'win32' ? 'windows' : process.platform;
  if (profile.target.os !== hostOs) {
    throw new Error(`Local configure requires a ${hostOs} profile`);
  }
  if (profile.target.os === 'windows' && networkDenied) assertClosedHostedWindowsProfile(profile);
  verifyToolchainContract(profile, {
    allowCandidate: profile.target.os === 'windows',
    contractOnly: usePreparedWindowsQuality,
  });
  const tools = usePreparedWindowsQuality
    ? resolvePreparedWindowsQualityTools()
    : usePreparedLinuxQuality
      ? resolvePreparedLinuxQualityTools(profile)
      : profileTools(profile);
  if (rootTag !== '' && !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(rootTag)) {
    throw new Error('Native build root tag is invalid');
  }
  const buildKind = directEngine ? 'direct-engine' : engine ? 'engine' : 'quality';
  const buildRootName =
    profile.target.os === 'windows'
      ? `${profileId.includes('cuda') ? 'wcuda' : profileId.includes('amd') ? 'wamd' : 'wcpu'}-${
          directEngine ? 'direct' : engine ? 'engine' : 'quality'
        }${sanitizerEnabled ? '-asan' : threadSanitizer ? '-tsan' : ''}${rootTag === '' ? '' : `-${rootTag}`}`
      : `${profileId}-${buildKind}${threadSanitizer ? '-tsan' : ''}${rootTag === '' ? '' : `-${rootTag}`}`;
  const buildRoot = resolve(taskCacheRoot, 'build', buildRootName);
  removeTaskOwnedTree(buildRoot);
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
    `-DLOCAL_WHISPER_GENERATED_INCLUDE_DIR=${generatedIncludeRoot}`,
    `-DLOCAL_WHISPER_NLOHMANN_SOURCE=${nlohmannSource}`,
    `-DLOCAL_WHISPER_GOOGLETEST_SOURCE=${googleTestSource}`,
    `-DLOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT=${fixtureRoot}`,
    `-DLOCAL_WHISPER_BUILD_ENGINE=${engine ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_BUILD_DIRECT_ENGINE=${directEngine ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_BUILD_TESTS=${tests ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_BACKEND_ID=${profileId.includes('cuda') ? 'cuda' : 'cpu'}`,
    `-DLOCAL_WHISPER_ENABLE_SANITIZERS=${sanitizerEnabled ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_ENABLE_THREAD_SANITIZER=${threadSanitizer ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_SOURCE_ROOT=${engine || directEngine ? preparePatchedSource(profileId) : patchedSourceRoot}`,
    `-DLOCAL_WHISPER_RUNTIME_BUILD_DIGEST=${buildIdentity(profileId, profile)}`,
  ];
  arguments_.push(...platformBuildCmakeArguments(profile));
  if (profile.target.os === 'windows' && process.env.LOCAL_WHISPER_MSVC_ANALYZE === 'true') {
    arguments_.push('-DLOCAL_WHISPER_MSVC_ANALYZE=ON');
  }
  if (tools.linker !== null) arguments_.push(`-DCMAKE_LINKER=${tools.linker}`);
  if (tools.cudaCompiler !== null) {
    arguments_.push(`-DCMAKE_CUDA_COMPILER=${tools.cudaCompiler}`);
    if (profile.target.os === 'windows') {
      arguments_.push(`-DCMAKE_CUDA_HOST_COMPILER=${tools.cudaHostCompiler.replaceAll('\\', '/')}`);
    }
  }
  if (engine || directEngine) {
    for (const [key, value] of Object.entries(profile.cmakeCache).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      if (key === 'LOCAL_WHISPER_SOURCE_ROOT') continue;
      const configuredValue = value.startsWith('toolchainRoot:')
        ? resolve(toolchainRoot, ...value.slice('toolchainRoot:'.length).split('/'))
        : value;
      arguments_.push(`-D${key}=${configuredValue}`);
    }
  } else {
    arguments_.push(`-DCMAKE_BUILD_TYPE=${sanitizerEnabled || threadSanitizer ? 'Debug' : 'Release'}`);
    arguments_.push('-DCMAKE_SKIP_BUILD_RPATH=ON', '-DCMAKE_CXX_SCAN_FOR_MODULES=OFF');
  }
  const configured = {
    buildRoot,
    environment:
      profile.target.os === 'windows'
        ? resolveWindowsMsvcBuildEnvironment({
            environment: process.env,
            includeCuda: tools.cudaCompiler !== null,
            toolchainRoot,
            tools: {
              cmake: tools.cmake,
              compiler: tools.cxxCompiler,
              cudaHostCompiler: tools.cudaHostCompiler,
              ninja: tools.ninja,
            },
          })
        : networkDenied
          ? networkDeniedEnvironment(profile, tools)
          : process.env,
    networkDenied,
    profile,
    quiet,
    sanitizers: sanitizerEnabled,
    threadSanitizer,
    tools,
  };
  runBuildCommand(configured, tools.cmake, arguments_, `configure ${profileId}`);
  return configured;
}

export function buildTargets(configured, targets) {
  const backend = configured.profile.profileId.includes('cuda') ? 'cuda' : 'cpu';
  runBuildCommand(
    configured,
    configured.tools.cmake,
    [
      '--build',
      configured.buildRoot,
      '--parallel',
      String(resolveNativeBuildJobs({ backend })),
      '--target',
      ...targets,
    ],
    `build ${targets.join(', ')}`,
  );
}

export function runTests(configured, label) {
  const ctest =
    configured.tools.ctest ??
    resolve(configured.tools.cmake, '..', process.platform === 'win32' ? 'ctest.exe' : 'ctest');
  const environment = sanitizerRuntimeEnvironment(
    configured.environment,
    configured.profile.target.os,
    configured.sanitizers,
  );
  runBuildCommand(
    configured,
    ctest,
    [
      '--test-dir',
      configured.buildRoot,
      '--output-on-failure',
      '--parallel',
      String(resolveNativeBuildJobs({ backend: configured.profile.profileId.includes('cuda') ? 'cuda' : 'cpu' })),
      '-L',
      label,
    ],
    `${label} tests`,
    environment,
  );
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

function nativeSourceFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return nativeSourceFiles(path);
    return /\.(?:cpp|hpp)$/u.test(entry.name) ? [path] : [];
  });
}

function nativeSourceDigest() {
  const roots = [whisperCppRoot, resolve(workspaceRoot, 'runtime', 'local-whisper', 'common')];
  const paths = [resolve(whisperCppRoot, 'CMakeLists.txt'), ...roots.flatMap((root) => nativeSourceFiles(root))].sort();
  return canonicalDigest(
    paths.map((path) => ({
      path: relative(workspaceRoot, path).replaceAll('\\', '/'),
      sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    })),
  );
}

export async function runFormattingAndTidy(configured, engineConfigured) {
  const clangRoot = resolve(toolchainRoot, 'clang-18.1.3', 'usr', 'lib', 'llvm-18', 'bin');
  const files = projectNativeFiles();
  await runNativeFileToolInParallel({
    arguments_: ['--dry-run', '--Werror'],
    command: resolveClangFormat(workspaceRoot, clangRoot),
    cwd: workspaceRoot,
    env: process.env,
    files,
    label: 'Whisper.cpp project clang-format',
  });
  const qualityFiles = files.filter(
    (path) =>
      (path.includes('/core/') && !path.endsWith('/core/main.cpp')) ||
      path.includes('/device/') ||
      path.includes('/amd/'),
  );
  const engineFiles = files.filter((path) => path.includes('/adapter/') || path.endsWith('/core/main.cpp'));
  const qualificationFiles = files.filter((path) => path.includes('/qualification/'));
  await runNativeFileToolInParallel({
    arguments_: ['-p', configured.buildRoot],
    command: resolveClangTidy(workspaceRoot, clangRoot),
    cwd: workspaceRoot,
    env: process.env,
    files: qualityFiles,
    label: 'Whisper.cpp project core clang-tidy',
  });
  await runNativeFileToolInParallel({
    arguments_: ['-p', engineConfigured.buildRoot],
    command: resolveClangTidy(workspaceRoot, clangRoot),
    cwd: workspaceRoot,
    env: process.env,
    files: engineFiles,
    label: 'Whisper.cpp project engine clang-tidy',
  });
  if (qualificationFiles.length > 0) {
    await runNativeFileToolInParallel({
      arguments_: ['-p', engineConfigured.buildRoot],
      command: resolveClangTidy(workspaceRoot, clangRoot),
      cwd: workspaceRoot,
      env: process.env,
      files: qualificationFiles,
      label: 'Whisper.cpp project qualification clang-tidy',
    });
  }
}

export function buildIdentity(profileId = 'linux-x64-cpu-baseline-v1', executionProfile = null) {
  const patchLock = readJson(patchContract(profileId).lockPath);
  const table = readJson(limitTablePath);
  const profile = executionProfile ?? requireProfile(profileId);
  if (profile.profileId !== profileId) throw new Error('Runtime build identity profile mismatch');
  return canonicalDigest({
    sourceLockId: patchLock.sourceLockId,
    patchedManifestSha256: patchLock.finalManifestSha256,
    patchLockId: patchLock.lockId,
    projectSourceDigest: nativeSourceDigest(),
    tableSha256: table.tableSha256,
    profileId: profile.profileId,
    profileEvidenceDigest: profile.target.os === 'windows' ? canonicalDigest(profile) : profile.evidenceDigest,
  });
}

export function requireVerifiedInputs(profileId = 'linux-x64-cpu-baseline-v1') {
  const contract = patchContract(profileId);
  for (const path of [
    nlohmannSource,
    googleTestSource,
    sourceLockPath,
    nlohmannSourceLockPath,
    contract.lockPath,
    limitTablePath,
  ]) {
    if (!existsSync(path)) throw new Error(`Required verified Whisper.cpp input is unavailable: ${path}`);
  }
  generateLimitHeader();
  preparePatchedSource(profileId);
}
