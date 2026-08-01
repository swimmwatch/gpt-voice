import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const allowedActions = new Set(['format', 'lint', 'unit', 'integration', 'all']);
const action = process.argv[2];
if (!allowedActions.has(action)) {
  process.stderr.write('Expected format, lint, unit, integration, or all\n');
  process.exit(2);
}
if (process.platform !== 'linux' && process.platform !== 'win32') {
  process.stderr.write('Native Local Whisper launcher checks support Linux and Windows only\n');
  process.exit(2);
}

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const sourceDirectory = resolve(workspaceRoot, 'runtime', 'local-whisper', 'launcher');
const outputDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', 'launcher');
const fixtureDirectory = resolve(outputDirectory, 'fixtures');
const platformName = process.platform === 'win32' ? 'windows' : 'linux';
const preset = `${platformName}-test`;
const buildDirectory = resolve(outputDirectory, `build-${platformName}-test`);
const cmake = process.env.CMAKE_COMMAND || 'cmake';
const ctest = process.env.CTEST_COMMAND || 'ctest';

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? sourceDirectory,
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function nativeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return nativeFiles(path);
    return /\.(?:cpp|hpp)$/.test(entry.name) ? [path] : [];
  });
}

function nativeImplementationFiles(directory) {
  const excludedPlatform = process.platform === 'win32' ? 'linux' : 'windows';
  return nativeFiles(directory).filter(
    (path) => path.endsWith('.cpp') && !path.includes(`/platform/${excludedPlatform}/`),
  );
}

function configureAndBuild() {
  const arguments_ = [
    '--preset',
    preset,
    `-DLOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY=${outputDirectory}`,
    `-DLOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY=${fixtureDirectory}`,
  ];
  if (process.platform === 'linux') {
    arguments_.push(`-DCMAKE_CXX_COMPILER=${process.env.CXX || 'clang++'}`);
    if (process.env.NINJA_COMMAND) {
      arguments_.push(`-DCMAKE_MAKE_PROGRAM=${process.env.NINJA_COMMAND}`);
    }
  }
  run(cmake, arguments_);
  run(cmake, ['--build', '--preset', preset]);
}

function runIntegration() {
  run(process.execPath, ['--import', 'tsx', 'scripts/local-whisper/verify-launcher.ts', '--fixture'], {
    cwd: workspaceRoot,
  });
}

if (action === 'format') {
  run(process.env.CLANG_FORMAT || 'clang-format', ['--dry-run', '--Werror', ...nativeFiles(sourceDirectory)]);
} else if (action === 'lint') {
  if (process.platform !== 'linux') {
    process.stderr.write('clang-tidy is enforced by the Linux native-quality job\n');
    process.exit(2);
  }
  configureAndBuild();
  run(process.env.CLANG_TIDY || 'clang-tidy', ['-p', buildDirectory, ...nativeImplementationFiles(sourceDirectory)]);
} else {
  configureAndBuild();
  if (action === 'unit' || action === 'all') {
    run(ctest, ['--preset', `${platformName}-unit`]);
  }
  if (action === 'integration' || action === 'all') runIntegration();
}
