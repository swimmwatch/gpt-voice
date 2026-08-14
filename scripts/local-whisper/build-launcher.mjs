import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { resolveNativeBuildJobs } from './native-build/native-build-parallelism.mjs';
import { resolveNativeBuildToolPaths } from './native-build/native-build-tool-paths.mjs';
import { resolvePreparedWindowsSdkInputs } from './native-build/native-toolchain-core.mjs';
import {
  resolveWindowsMsvcBuildEnvironment,
  windowsCmakePath,
} from './native-build/windows-msvc-build-environment.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const sourceDirectory = resolve(workspaceRoot, 'runtime', 'local-whisper', 'launcher');
const outputDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', 'launcher');
const executableName = process.platform === 'win32' ? 'local-whisper-launcher.exe' : 'local-whisper-launcher';
const outputPath = resolve(outputDirectory, executableName);

if (process.platform !== 'linux' && process.platform !== 'win32') {
  process.stderr.write('Local Whisper launcher is unavailable on this platform\n');
  process.exit(2);
}

mkdirSync(outputDirectory, { mode: 0o700, recursive: true });

const tools = resolveNativeBuildToolPaths({ environment: process.env, platform: process.platform, workspaceRoot });
const windowsSdkTools = process.platform === 'win32' ? resolvePreparedWindowsSdkInputs(process.env) : null;
const preset = process.platform === 'win32' ? 'windows-release' : 'linux-release';
const configureArguments = [
  '--fresh',
  '--preset',
  preset,
  `-DLOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY=${outputDirectory}`,
];
if (process.platform === 'linux' || process.platform === 'win32') {
  configureArguments.push(`-DCMAKE_CXX_COMPILER=${tools.compiler}`);
  configureArguments.push(`-DCMAKE_MAKE_PROGRAM=${tools.ninja}`);
}
if (windowsSdkTools) {
  configureArguments.push(`-DCMAKE_RC_COMPILER=${windowsCmakePath(windowsSdkTools.resourceCompiler)}`);
  configureArguments.push(`-DCMAKE_MT=${windowsCmakePath(windowsSdkTools.manifestTool)}`);
}
const buildEnvironment =
  process.platform === 'win32'
    ? resolveWindowsMsvcBuildEnvironment({
        environment: process.env,
        includeCuda: false,
        toolchainRoot: resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'),
        tools,
      })
    : process.env;

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
      result.stderr || result.stdout || result.error?.message || 'Local Whisper launcher build failed\n',
    );
    process.exit(result.status ?? 1);
  }
}

run(configureArguments);
run(['--build', '--preset', preset, '--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' }))]);

if (!existsSync(outputPath)) {
  process.stderr.write('Local Whisper launcher build produced no executable\n');
  process.exit(1);
}

process.stdout.write(`${outputPath}\n`);
