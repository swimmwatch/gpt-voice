import { resolve } from 'node:path';

/** Resolves explicit overrides or the repository-pinned native build tools. */
export function resolveNativeBuildToolPaths({ environment, platform, workspaceRoot }) {
  const toolchainRoot = resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains');
  if (platform === 'win32') {
    return Object.freeze({
      cmake: environment.CMAKE_COMMAND || 'cmake.exe',
      ctest: environment.CTEST_COMMAND || 'ctest.exe',
      compiler: environment.CXX || 'cl.exe',
      ninja: environment.NINJA_COMMAND || 'ninja.exe',
    });
  }
  return Object.freeze({
    cmake: environment.CMAKE_COMMAND || resolve(toolchainRoot, 'cmake-3.31.8', 'bin', 'cmake'),
    ctest: environment.CTEST_COMMAND || resolve(toolchainRoot, 'cmake-3.31.8', 'bin', 'ctest'),
    compiler: environment.CXX || resolve(toolchainRoot, 'clang-18.1.3', 'usr', 'lib', 'llvm-18', 'bin', 'clang++'),
    ninja: environment.NINJA_COMMAND || resolve(toolchainRoot, 'ninja-1.12.1', 'ninja'),
  });
}
