import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { resolveNativeBuildJobs } from './native-build/native-build-parallelism.mjs';
import { resolveNativeBuildToolPaths } from './native-build/native-build-tool-paths.mjs';
import { resolvePreparedWindowsSdkInputs } from './native-build/native-toolchain-core.mjs';
import {
  resolveWindowsMsvcBuildEnvironment,
  windowsCmakePath,
} from './native-build/windows-msvc-build-environment.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const sourceDirectory = resolve(workspaceRoot, 'runtime', 'local-whisper', 'fs-guard');
const outputDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', 'fs-guard');
const outputPath = resolve(outputDirectory, process.platform === 'win32' ? 'fs-guard.exe' : 'fs-guard');

if (process.platform !== 'linux' && process.platform !== 'win32') {
  process.stderr.write('Local Whisper fs-guard is unavailable on this platform\n');
  process.exit(2);
}

mkdirSync(outputDirectory, { mode: 0o700, recursive: true });

const tools = resolveNativeBuildToolPaths({ environment: process.env, platform: process.platform, workspaceRoot });
const linuxGccQuality = process.platform === 'linux' && process.env.LOCAL_WHISPER_NATIVE_QUALITY_GCC === 'true';
const buildEnvironment =
  process.platform === 'win32'
    ? resolveWindowsMsvcBuildEnvironment({
        environment: process.env,
        includeCuda: false,
        toolchainRoot: resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'),
        tools,
      })
    : process.env;
const windowsSdkTools = process.platform === 'win32' ? resolvePreparedWindowsSdkInputs(buildEnvironment) : null;
const preset =
  process.platform === 'win32' ? 'windows-release' : linuxGccQuality ? 'linux-gcc-release' : 'linux-release';
const configureArguments = ['--fresh', '--preset', preset, `-DFS_GUARD_OUTPUT_DIRECTORY=${outputDirectory}`];
if (process.platform === 'linux' || process.platform === 'win32') {
  const compiler = linuxGccQuality
    ? process.env.LOCAL_WHISPER_GCC_CXX_COMPILER || '/usr/bin/x86_64-linux-gnu-g++-13'
    : tools.compiler;
  configureArguments.push(`-DCMAKE_CXX_COMPILER=${compiler}`);
  configureArguments.push(`-DCMAKE_MAKE_PROGRAM=${tools.ninja}`);
}
if (windowsSdkTools) {
  configureArguments.push(`-DCMAKE_RC_COMPILER=${windowsCmakePath(windowsSdkTools.resourceCompiler)}`);
  configureArguments.push(`-DCMAKE_MT=${windowsCmakePath(windowsSdkTools.manifestTool)}`);
}
if (linuxGccQuality) {
  configureArguments.push(
    `-DCMAKE_C_COMPILER=${process.env.LOCAL_WHISPER_GCC_C_COMPILER || '/usr/bin/x86_64-linux-gnu-gcc-13'}`,
    `-DCMAKE_LINKER=${process.env.LOCAL_WHISPER_GCC_LINKER || '/usr/bin/x86_64-linux-gnu-ld.bfd'}`,
  );
}
function run(arguments_) {
  const result = spawnSync(tools.cmake, arguments_, {
    cwd: sourceDirectory,
    encoding: 'utf8',
    env: buildEnvironment,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    process.stderr.write(
      result.stderr || result.stdout || result.error?.message || 'Local Whisper fs-guard build failed\n',
    );
    process.exit(result.status ?? 1);
  }
}

run(configureArguments);
run(['--build', '--preset', preset, '--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' }))]);

if (!existsSync(outputPath)) {
  process.stderr.write('Local Whisper fs-guard build produced no executable\n');
  process.exit(1);
}

process.stdout.write(`${outputPath}\n`);
