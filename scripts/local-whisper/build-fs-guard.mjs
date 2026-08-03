import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { resolveNativeBuildJobs } from './native-build/native-build-parallelism.mjs';
import { resolveNativeBuildToolPaths } from './native-build/native-build-tool-paths.mjs';

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
const preset = process.platform === 'win32' ? 'windows-release' : 'linux-release';
const configureArguments = ['--fresh', '--preset', preset, `-DFS_GUARD_OUTPUT_DIRECTORY=${outputDirectory}`];
if (process.platform === 'linux') {
  configureArguments.push(`-DCMAKE_CXX_COMPILER=${tools.compiler}`);
  configureArguments.push(`-DCMAKE_MAKE_PROGRAM=${tools.ninja}`);
}

function run(arguments_) {
  const result = spawnSync(tools.cmake, arguments_, {
    cwd: sourceDirectory,
    encoding: 'utf8',
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
