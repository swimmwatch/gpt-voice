import { existsSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';

const WINDOWS_SDK_VERSION = '10.0.26100.0';
const WINDOWS_SYSTEM_EXECUTABLE_DIRECTORY = 'System32';

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

/** Builds the minimal MSVC and Windows SDK environment required by pinned native tools. */
export function resolveWindowsMsvcBuildEnvironment({ environment, includeCuda, toolchainRoot, tools }) {
  const msvcRoot = resolve(toolchainRoot, 'msvc-14.39');
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
