import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { resolveClangFormat, resolveClangTidy } from './native-quality-tools.mjs';
import { runNativeFileToolInParallel } from './native-build/native-file-tool-parallelism.mjs';
import { resolveNativeBuildJobs } from './native-build/native-build-parallelism.mjs';

const allowedActions = new Set(['all', 'authority', 'codec', 'format', 'lint', 'proof']);
const action = process.argv[2] ?? 'all';
if (!allowedActions.has(action)) {
  process.stderr.write('Expected all, authority, codec, format, lint, or proof\n');
  process.exit(2);
}
if (process.platform !== 'linux') {
  process.stderr.write('Local Whisper common native execution is qualified on Linux only in Task 09\n');
  process.exit(2);
}

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const sourceDirectory = resolve(workspaceRoot, 'runtime', 'local-whisper', 'common');
const fixtureRoot = resolve(workspaceRoot, 'tests', 'fixtures', 'local-whisper', 'protocol', 'v1');
const contentStore = resolve(workspaceRoot, '.cache', 'local-whisper', 'native-sources', 'sha256');
const nlohmannSource = resolve(contentStore, '1bd7718fe4b5a7e2aebe60abc6f5f94c313d8f472542e715766158a738e8ea47');
const googleTestSource = resolve(contentStore, '9150f03cee9cb222456fcd0945d5285a1742b080c7ad7c47ed88b95c518afe7c');
const toolchainRoot = resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains');
const cmake = process.env.CMAKE_COMMAND || resolve(toolchainRoot, 'cmake-3.31.8', 'bin', 'cmake');
const ctest = process.env.CTEST_COMMAND || resolve(toolchainRoot, 'cmake-3.31.8', 'bin', 'ctest');
const ninja = process.env.NINJA_COMMAND || resolve(toolchainRoot, 'ninja-1.12.1', 'ninja');
const clangRoot = resolve(toolchainRoot, 'clang-18.1.3', 'usr', 'lib', 'llvm-18', 'bin');

const profiles = [
  {
    buildType: 'Release',
    cCompiler: process.env.LOCAL_WHISPER_GCC_C_COMPILER || '/usr/bin/x86_64-linux-gnu-gcc-13',
    cxxCompiler: process.env.LOCAL_WHISPER_GCC_CXX_COMPILER || '/usr/bin/x86_64-linux-gnu-g++-13',
    id: 'linux-x64-cpu-baseline-v1',
    linker: process.env.LOCAL_WHISPER_GCC_LINKER || '/usr/bin/x86_64-linux-gnu-ld.bfd',
    sanitizers: false,
  },
  {
    buildType: 'Debug',
    cCompiler: process.env.LOCAL_WHISPER_CLANG_C_COMPILER || resolve(clangRoot, 'clang'),
    cxxCompiler: process.env.LOCAL_WHISPER_CLANG_CXX_COMPILER || resolve(clangRoot, 'clang++'),
    id: 'linux-x64-clang-18.1.3-asan-ubsan-v1',
    linker: process.env.LOCAL_WHISPER_CLANG_LINKER || resolve(clangRoot, 'ld.lld'),
    sanitizers: true,
  },
];

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function nativeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return nativeFiles(path);
    return /\.(?:cpp|hpp)$/u.test(entry.name) ? [path] : [];
  });
}

function requireInputs() {
  for (const path of [
    cmake,
    ctest,
    ninja,
    resolve(nlohmannSource, 'single_include', 'nlohmann', 'json.hpp'),
    resolve(googleTestSource, 'CMakeLists.txt'),
    ...profiles.flatMap((profile) => [profile.cCompiler, profile.cxxCompiler, profile.linker]),
  ]) {
    if (!existsSync(path)) throw new Error(`Required verified native input is unavailable: ${path}`);
  }
}

function assertDisconnectedGraph(buildDirectory) {
  const ownedCmake = [
    resolve(sourceDirectory, 'CMakeLists.txt'),
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'fs-guard', 'CMakeLists.txt'),
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'launcher', 'CMakeLists.txt'),
  ];
  const generated = [resolve(buildDirectory, 'CMakeCache.txt'), resolve(buildDirectory, 'build.ninja')];
  const forbidden = /FetchContent|find_package|https?:\/\/|git(?:\.exe)?\s+(?:clone|fetch)|DOWNLOAD_COMMAND/u;
  for (const path of [...ownedCmake, ...generated]) {
    if (forbidden.test(readFileSync(path, 'utf8'))) {
      throw new Error(`Network-capable or ambient package discovery found in ${path}`);
    }
  }
}

function testRegex() {
  if (action === 'authority') return '^ModelAuthority\\.';
  if (action === 'proof') return '^DeviceProof\\.';
  if (action === 'codec') return '^(BoundedJson|CanonicalWav|FrameCodec)\\.';
  return null;
}

function buildAndTest(profile) {
  const buildDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', 'worker-common', profile.id);
  run(cmake, [
    '-S',
    sourceDirectory,
    '-B',
    buildDirectory,
    '-G',
    'Ninja',
    `-DCMAKE_MAKE_PROGRAM=${ninja}`,
    `-DCMAKE_BUILD_TYPE=${profile.buildType}`,
    `-DCMAKE_C_COMPILER=${profile.cCompiler}`,
    `-DCMAKE_CXX_COMPILER=${profile.cxxCompiler}`,
    `-DCMAKE_LINKER=${profile.linker}`,
    '-DCMAKE_SKIP_BUILD_RPATH=ON',
    '-DFETCHCONTENT_FULLY_DISCONNECTED=ON',
    `-DLOCAL_WHISPER_COMMON_ENABLE_SANITIZERS=${profile.sanitizers ? 'ON' : 'OFF'}`,
    `-DLOCAL_WHISPER_NLOHMANN_SOURCE=${nlohmannSource}`,
    `-DLOCAL_WHISPER_GOOGLETEST_SOURCE=${googleTestSource}`,
    `-DLOCAL_WHISPER_PROTOCOL_FIXTURE_ROOT=${fixtureRoot}`,
  ]);
  assertDisconnectedGraph(buildDirectory);
  run(cmake, ['--build', buildDirectory, '--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' }))]);
  const arguments_ = ['--test-dir', buildDirectory, '--output-on-failure'];
  arguments_.push('--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' })));
  const regex = testRegex();
  if (regex) arguments_.push('-R', regex);
  run(ctest, arguments_, {
    env: {
      ...process.env,
      ASAN_OPTIONS: 'detect_leaks=1:halt_on_error=1',
      UBSAN_OPTIONS: 'halt_on_error=1:print_stacktrace=1',
    },
  });
}

requireInputs();
if (action === 'format') {
  await runNativeFileToolInParallel({
    arguments_: ['--dry-run', '--Werror'],
    command: resolveClangFormat(workspaceRoot, clangRoot),
    cwd: workspaceRoot,
    env: process.env,
    files: nativeFiles(sourceDirectory),
    label: 'worker common clang-format',
  });
} else if (action === 'lint') {
  const profile = profiles[1];
  buildAndTest(profile);
  const buildDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', 'worker-common', profile.id);
  await runNativeFileToolInParallel({
    arguments_: ['-p', buildDirectory],
    command: resolveClangTidy(workspaceRoot, clangRoot),
    cwd: workspaceRoot,
    env: process.env,
    files: nativeFiles(resolve(sourceDirectory, 'src')).filter((path) => path.endsWith('.cpp')),
    label: 'worker common clang-tidy',
  });
} else {
  for (const profile of profiles) buildAndTest(profile);
  run(process.env.PYTHON || 'python3', [
    '-m',
    'unittest',
    resolve(sourceDirectory, 'python', 'test_reference_codec.py'),
  ]);
}
