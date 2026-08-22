import { existsSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

const WINDOWS_SDK_VERSION = '10.0.26100.0';
const WINDOWS_SYSTEM_EXECUTABLE_DIRECTORY = 'System32';

export function windowsCmakePath(path) {
  if (typeof path !== 'string' || path.length === 0) throw new Error('Windows CMake tool path is missing');
  return path.replaceAll('\\', '/');
}

function requireDirectory(path, label) {
  if (!existsSync(path)) throw new Error(`Windows native toolchain is missing ${label}`);
  return path;
}

function requiredEnvironmentValue(environment, key) {
  const value = environment[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Windows native toolchain environment is missing ${key}`);
  }
  return value;
}

function requiredDirectoryList(environment, key) {
  const directories = requiredEnvironmentValue(environment, key)
    .split(';')
    .filter((directory) => directory.length > 0);
  if (directories.length === 0) throw new Error(`Windows native toolchain environment has no ${key} directories`);
  for (const directory of directories) requireDirectory(directory, `${key} directory`);
  return directories.join(';');
}

function preparedDeveloperEnvironment(environment) {
  if (!['INCLUDE', 'LIB', 'LIBPATH', 'PATH'].every((key) => environment[key])) return null;
  return {
    INCLUDE: requiredDirectoryList(environment, 'INCLUDE'),
    LIB: requiredDirectoryList(environment, 'LIB'),
    LIBPATH: requiredDirectoryList(environment, 'LIBPATH'),
    PATH: requiredEnvironmentValue(environment, 'PATH'),
    PROCESSOR_ARCHITECTURE: 'AMD64',
    SystemRoot: requiredEnvironmentValue(environment, 'SystemRoot'),
    TEMP: requiredEnvironmentValue(environment, 'TEMP'),
    TMP: requiredEnvironmentValue(environment, 'TMP'),
    WINDIR: requiredEnvironmentValue(environment, 'WINDIR'),
  };
}

/** Builds the MSVC environment from a prepared developer prompt or pinned local toolchain. */
export function resolveWindowsMsvcBuildEnvironment({ environment, includeCuda, toolchainRoot, tools }) {
  const prepared = preparedDeveloperEnvironment(environment);
  if (prepared && !includeCuda) return Object.freeze(prepared);
  if (prepared && includeCuda) {
    const cudaRoot = requireDirectory(requiredEnvironmentValue(environment, 'CUDA_PATH'), 'CUDA root');
    const cudaBinaryDirectory = requireDirectory(resolve(cudaRoot, 'bin'), 'CUDA binary directory');
    return Object.freeze({
      ...prepared,
      CUDA_PATH: cudaRoot,
      PATH: [cudaBinaryDirectory, prepared.PATH].join(';'),
      Platform: 'x64',
      VCINSTALLDIR: requiredEnvironmentValue(environment, 'VCINSTALLDIR'),
      VCToolsInstallDir: requiredEnvironmentValue(environment, 'VCToolsInstallDir'),
      VCToolsVersion: requiredEnvironmentValue(environment, 'VCToolsVersion'),
      VisualStudioVersion: requiredEnvironmentValue(environment, 'VisualStudioVersion'),
      VSCMD_ARG_HOST_ARCH: 'x64',
      VSCMD_ARG_TGT_ARCH: 'x64',
      VSINSTALLDIR: requiredEnvironmentValue(environment, 'VSINSTALLDIR'),
    });
  }

  const relativeCompiler = relative(toolchainRoot, tools.compiler);
  const [msvcDirectory] = relativeCompiler.split(sep);
  if (relativeCompiler.startsWith('..') || !/^msvc-14\.(?:39|51)$/u.test(msvcDirectory)) {
    throw new Error('Windows native compiler is outside an approved pinned MSVC root');
  }
  const msvcRoot = resolve(toolchainRoot, msvcDirectory);
  const sdkRoot = resolve(toolchainRoot, 'windows-sdk-10.0.26100.0');
  const compilerDirectory = dirname(tools.compiler);
  const windowsRoot = requiredEnvironmentValue(environment, 'SystemRoot');
  const includeDirectories = [
    resolve(msvcRoot, 'include'),
    resolve(sdkRoot, 'Include', WINDOWS_SDK_VERSION, 'ucrt'),
    resolve(sdkRoot, 'Include', WINDOWS_SDK_VERSION, 'shared'),
    resolve(sdkRoot, 'Include', WINDOWS_SDK_VERSION, 'um'),
    resolve(sdkRoot, 'Include', WINDOWS_SDK_VERSION, 'winrt'),
  ];
  const libraryDirectories = [
    resolve(msvcRoot, 'lib', 'x64'),
    resolve(sdkRoot, 'Lib', WINDOWS_SDK_VERSION, 'ucrt', 'x64'),
    resolve(sdkRoot, 'Lib', WINDOWS_SDK_VERSION, 'um', 'x64'),
  ];
  const executableDirectories = [
    dirname(tools.cmake),
    compilerDirectory,
    dirname(tools.ninja),
    resolve(sdkRoot, 'bin', WINDOWS_SDK_VERSION, 'x64'),
    resolve(windowsRoot, WINDOWS_SYSTEM_EXECUTABLE_DIRECTORY),
  ];

  for (const [label, directory] of [
    ['MSVC include directory', includeDirectories[0]],
    ['MSVC library directory', libraryDirectories[0]],
    ['Windows SDK executable directory', executableDirectories[3]],
    ['Windows SDK include directory', includeDirectories[3]],
    ['Windows SDK library directory', libraryDirectories[2]],
  ]) {
    requireDirectory(directory, label);
  }

  const result = {
    INCLUDE: includeDirectories.join(';'),
    LIB: libraryDirectories.join(';'),
    LIBPATH: libraryDirectories.join(';'),
    PATH: executableDirectories.join(';'),
    PROCESSOR_ARCHITECTURE: 'AMD64',
    SystemRoot: windowsRoot,
    TEMP: requiredEnvironmentValue(environment, 'TEMP'),
    TMP: requiredEnvironmentValue(environment, 'TMP'),
    WINDIR: requiredEnvironmentValue(environment, 'WINDIR'),
  };
  if (includeCuda) {
    const cudaRoot = resolve(toolchainRoot, 'cuda-12.8.1');
    const cudaBinaryDirectory = requireDirectory(resolve(cudaRoot, 'bin'), 'CUDA binary directory');
    const cudaHostCompiler = tools.cudaHostCompiler;
    if (typeof cudaHostCompiler !== 'string' || cudaHostCompiler.length === 0) {
      throw new Error('Windows CUDA builds require the verified canonical CUDA host compiler path');
    }
    const msvcInstallationRoot = resolve(dirname(cudaHostCompiler), '..', '..', '..');
    const vcInstallRoot = resolve(msvcInstallationRoot, '..', '..', '..');
    const vsInstallRoot = resolve(vcInstallRoot, '..');
    requireDirectory(
      resolve(vcInstallRoot, 'Auxiliary', 'Build', 'vcvarsall.bat'),
      'Visual Studio vcvarsall.bat required by nvcc',
    );
    result.CUDA_PATH = cudaRoot;
    result.PATH = [cudaBinaryDirectory, result.PATH].join(';');
    result.Platform = 'x64';
    result.VCINSTALLDIR = `${vcInstallRoot}${sep}`;
    result.VCToolsInstallDir = `${msvcInstallationRoot}${sep}`;
    result.VCToolsVersion = basename(msvcInstallationRoot);
    result.VisualStudioVersion = '17.0';
    result.VSCMD_ARG_HOST_ARCH = 'x64';
    result.VSCMD_ARG_TGT_ARCH = 'x64';
    result.VSINSTALLDIR = `${vsInstallRoot}${sep}`;
  }
  return Object.freeze(result);
}
