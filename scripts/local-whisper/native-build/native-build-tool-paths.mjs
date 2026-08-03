import { resolve } from 'node:path';

/** Resolves explicit overrides or the repository-pinned Linux native build tools. */
export function resolveNativeBuildToolPaths({ environment, platform, workspaceRoot }) {
  if (platform !== 'linux') {
    return Object.freeze({
      cmake: environment.CMAKE_COMMAND || 'cmake',
      compiler: environment.CXX || null,
      ninja: environment.NINJA_COMMAND || null,
    });
  }
  const toolchainRoot = resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains');
  return Object.freeze({
    cmake: environment.CMAKE_COMMAND || resolve(toolchainRoot, 'cmake-3.31.8', 'bin', 'cmake'),
    compiler: environment.CXX || resolve(toolchainRoot, 'clang-18.1.3', 'usr', 'lib', 'llvm-18', 'bin', 'clang++'),
    ninja: environment.NINJA_COMMAND || resolve(toolchainRoot, 'ninja-1.12.1', 'ninja'),
  });
}
