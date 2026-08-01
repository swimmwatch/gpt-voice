import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

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

const cmake = process.env.CMAKE_COMMAND || 'cmake';
const preset = process.platform === 'win32' ? 'windows-release' : 'linux-release';
const configureArguments = ['--preset', preset, `-DLOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY=${outputDirectory}`];
if (process.platform === 'linux') {
  configureArguments.push(`-DCMAKE_CXX_COMPILER=${process.env.CXX || 'clang++'}`);
  if (process.env.NINJA_COMMAND) {
    configureArguments.push(`-DCMAKE_MAKE_PROGRAM=${process.env.NINJA_COMMAND}`);
  }
}

function run(arguments_) {
  const result = spawnSync(cmake, arguments_, {
    cwd: sourceDirectory,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'Local Whisper launcher build failed\n');
    process.exit(result.status ?? 1);
  }
}

run(configureArguments);
run(['--build', '--preset', preset]);

if (!existsSync(outputPath)) {
  process.stderr.write('Local Whisper launcher build produced no executable\n');
  process.exit(1);
}

process.stdout.write(`${outputPath}\n`);
