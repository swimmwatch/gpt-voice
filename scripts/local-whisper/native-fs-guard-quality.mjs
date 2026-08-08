import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { resolveClangFormat, resolveClangTidy } from './native-quality-tools.mjs';
import { runNativeFileToolInParallel } from './native-build/native-file-tool-parallelism.mjs';
import { resolveNativeBuildJobs } from './native-build/native-build-parallelism.mjs';
import { resolveNativeBuildToolPaths } from './native-build/native-build-tool-paths.mjs';
import { resolveWindowsMsvcBuildEnvironment } from './native-build/windows-msvc-build-environment.mjs';

const allowedActions = new Set(['format', 'lint', 'unit', 'integration', 'all']);
const action = process.argv[2];
if (!allowedActions.has(action)) {
  process.stderr.write('Expected format, lint, unit, integration, or all\n');
  process.exit(2);
}
if (process.platform !== 'linux' && process.platform !== 'win32') {
  process.stderr.write('Native fs-guard quality checks support Linux and Windows only\n');
  process.exit(2);
}

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const sourceDirectory = resolve(workspaceRoot, 'runtime', 'local-whisper', 'fs-guard');
const platformName = process.platform === 'win32' ? 'windows' : 'linux';
const preset = `${platformName}-test`;
const buildDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', 'fs-guard', `build-${platformName}-test`);
const googleTestSource = resolve(
  workspaceRoot,
  '.cache',
  'local-whisper',
  'native-sources',
  'sha256',
  '9150f03cee9cb222456fcd0945d5285a1742b080c7ad7c47ed88b95c518afe7c',
);
const toolchainRoot = resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains');
const clangRoot = resolve(toolchainRoot, 'clang-18.1.3', 'usr', 'lib', 'llvm-18', 'bin');
const nativeBuildTools = resolveNativeBuildToolPaths({
  environment: process.env,
  platform: process.platform,
  workspaceRoot,
});
const { cmake, ctest } = nativeBuildTools;
const buildEnvironment =
  process.platform === 'win32'
    ? resolveWindowsMsvcBuildEnvironment({
        environment: process.env,
        includeCuda: false,
        toolchainRoot,
        tools: nativeBuildTools,
      })
    : process.env;

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: sourceDirectory,
    env: buildEnvironment,
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
  const arguments_ = ['--preset', preset, `-DLOCAL_WHISPER_GOOGLETEST_SOURCE=${googleTestSource}`];
  if (process.platform === 'linux') {
    arguments_.push(`-DCMAKE_CXX_COMPILER=${process.env.CXX || resolve(clangRoot, 'clang++')}`);
    arguments_.push(
      `-DCMAKE_MAKE_PROGRAM=${process.env.NINJA_COMMAND || resolve(toolchainRoot, 'ninja-1.12.1', 'ninja')}`,
    );
  }
  run(cmake, arguments_);
  run(cmake, ['--build', '--preset', preset, '--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' }))]);
}

if (action === 'format') {
  await runNativeFileToolInParallel({
    arguments_: ['--dry-run', '--Werror'],
    command: resolveClangFormat(workspaceRoot, clangRoot),
    cwd: sourceDirectory,
    env: buildEnvironment,
    files: nativeFiles(sourceDirectory),
    label: 'fs-guard clang-format',
  });
} else if (action === 'lint') {
  if (process.platform !== 'linux') {
    process.stderr.write('clang-tidy is enforced by the Linux native-quality job\n');
    process.exit(2);
  }
  configureAndBuild();
  await runNativeFileToolInParallel({
    arguments_: ['-p', buildDirectory],
    command: resolveClangTidy(workspaceRoot, clangRoot),
    cwd: sourceDirectory,
    env: buildEnvironment,
    files: nativeImplementationFiles(resolve(sourceDirectory, 'src')),
    label: 'fs-guard clang-tidy',
  });
} else {
  configureAndBuild();
  if (action === 'unit' || action === 'all') {
    run(ctest, ['--preset', `${platformName}-unit`, '--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' }))]);
  }
  if (action === 'integration' || action === 'all') {
    run(ctest, [
      '--preset',
      `${platformName}-integration`,
      '--parallel',
      String(resolveNativeBuildJobs({ backend: 'cpu' })),
    ]);
  }
}
