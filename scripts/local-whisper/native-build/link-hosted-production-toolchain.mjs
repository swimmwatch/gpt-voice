import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { parseArguments } from '../source-import/native-source-core.mjs';

const CMAKE_VERSION = 'cmake version 3.31.8';
const NINJA_VERSION = '1.12.1';
const CUDA_VERSION = 'Cuda compilation tools, release 12.8, V12.8.93';

function requireAbsolutePath(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value) || !existsSync(value)) {
    throw new Error(`Hosted production toolchain ${label} is unavailable`);
  }
  return realpathSync(value);
}

function requireVersion(versionReader, executable, expected, label) {
  const version = versionReader(executable);
  if (typeof version !== 'string' || !version.includes(expected)) {
    throw new Error(`Hosted production toolchain ${label} version is not exact`);
  }
}

function commandVersion(executable) {
  const result = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error('Hosted production toolchain version command failed');
  return `${result.stdout}${result.stderr}`;
}

function assertFreshChild(root, destination, label) {
  const child = relative(root, destination);
  if (child.length === 0 || child.startsWith('..') || isAbsolute(child) || existsSync(destination)) {
    throw new Error(`Hosted production toolchain ${label} destination is not fresh`);
  }
}

function requireRegularFile(path, label) {
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Hosted production toolchain ${label} is not a regular file`);
  }
}

function requireContainedFile(root, file, label) {
  const canonical = requireAbsolutePath(file, label);
  const child = relative(root, canonical);
  if (child.length === 0 || child.startsWith('..') || isAbsolute(child)) {
    throw new Error(`Hosted production toolchain ${label} escaped the CUDA root`);
  }
  requireRegularFile(canonical, label);
}

/** Binds exact action-provisioned tools into the task-owned native toolchain root. */
export class HostedProductionToolchainLinker {
  constructor({ platform = process.platform, versionReader = commandVersion } = {}) {
    this.platform = platform;
    this.versionReader = versionReader;
  }

  link({ cmake, cudaRoot, destinationRoot, ninja, platform }) {
    if (!['linux', 'win32'].includes(platform) || platform !== this.platform) {
      throw new Error('Hosted production toolchain platform does not match the runner');
    }
    const cmakeExecutable = requireAbsolutePath(cmake, 'CMake executable');
    const ninjaExecutable = requireAbsolutePath(ninja, 'Ninja executable');
    const cudaDirectory = requireAbsolutePath(cudaRoot, 'CUDA root');
    const expectedCmakeName = platform === 'win32' ? 'cmake.exe' : 'cmake';
    const expectedNinjaName = platform === 'win32' ? 'ninja.exe' : 'ninja';
    const nvcc = resolve(cudaDirectory, 'bin', platform === 'win32' ? 'nvcc.exe' : 'nvcc');
    if (basename(cmakeExecutable).toLocaleLowerCase('en-US') !== expectedCmakeName) {
      throw new Error('Hosted production toolchain CMake executable name is invalid');
    }
    if (basename(ninjaExecutable).toLocaleLowerCase('en-US') !== expectedNinjaName) {
      throw new Error('Hosted production toolchain Ninja executable name is invalid');
    }
    requireRegularFile(cmakeExecutable, 'CMake executable');
    requireRegularFile(ninjaExecutable, 'Ninja executable');
    requireRegularFile(nvcc, 'CUDA compiler');
    requireVersion(this.versionReader, cmakeExecutable, CMAKE_VERSION, 'CMake');
    requireVersion(this.versionReader, ninjaExecutable, NINJA_VERSION, 'Ninja');
    requireVersion(this.versionReader, nvcc, CUDA_VERSION, 'CUDA');

    const requiredCudaFiles =
      platform === 'win32'
        ? ['LICENSE', 'bin/cudart64_12.dll', 'bin/cublas64_12.dll', 'bin/cublasLt64_12.dll']
        : [
            'EULA.txt',
            'targets/x86_64-linux/lib/libcudart.so.12',
            'targets/x86_64-linux/lib/libcublas.so.12',
            'targets/x86_64-linux/lib/libcublasLt.so.12',
          ];
    for (const file of requiredCudaFiles) {
      requireContainedFile(cudaDirectory, resolve(cudaDirectory, ...file.split('/')), `CUDA component ${file}`);
    }

    const root = resolve(destinationRoot);
    mkdirSync(root, { mode: 0o700, recursive: true });
    const links = [
      { destination: resolve(root, 'cmake-3.31.8'), source: dirname(dirname(cmakeExecutable)) },
      { destination: resolve(root, 'ninja-1.12.1'), source: dirname(ninjaExecutable) },
      { destination: resolve(root, 'cuda-12.8.1'), source: cudaDirectory },
    ];
    for (const { destination, source } of links) {
      assertFreshChild(root, destination, basename(destination));
      symlinkSync(source, destination, platform === 'win32' ? 'junction' : 'dir');
    }
  }
}

function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const required = (name) => {
    const value = arguments_.get(name);
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing hosted toolchain argument: ${name}`);
    return value;
  };
  const allowed = new Set(['platform', 'cmake', 'ninja', 'cuda-root', 'destination-root']);
  if ([...arguments_.keys()].some((name) => !allowed.has(name))) {
    throw new Error('Unknown hosted production toolchain argument');
  }
  new HostedProductionToolchainLinker().link({
    cmake: required('cmake'),
    cudaRoot: required('cuda-root'),
    destinationRoot: required('destination-root'),
    ninja: required('ninja'),
    platform: required('platform'),
  });
  process.stdout.write('Hosted production CMake, Ninja, and CUDA inputs linked and version-checked\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Hosted production toolchain linking failed'}\n`);
    process.exitCode = 1;
  }
}
