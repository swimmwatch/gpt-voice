import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

import {
  listNativeSourceFiles,
  listPlatformNativeImplementationFiles,
  resolveClangFormat,
  resolveClangTidy,
} from './native-quality-tools.mjs';
import { runNativeFileToolInParallel } from './native-build/native-file-tool-parallelism.mjs';
import { resolveNativeBuildJobs } from './native-build/native-build-parallelism.mjs';
import { resolveNativeBuildToolPaths } from './native-build/native-build-tool-paths.mjs';
import { resolvePreparedWindowsSdkInputs } from './native-build/native-toolchain-core.mjs';
import { sanitizerRuntimeEnvironment } from './native-build/sanitizer-runtime-policy.mjs';
import {
  resolveWindowsMsvcBuildEnvironment,
  windowsCmakePath,
} from './native-build/windows-msvc-build-environment.mjs';

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
const configurationArgument = process.argv[3] ?? 'default';
const windowsAsan = configurationArgument === '--configuration=windows-asan';
const linuxGcc = configurationArgument === '--configuration=linux-gcc';
if (!['default', '--configuration=linux-gcc', '--configuration=windows-asan'].includes(configurationArgument)) {
  process.stderr.write('Expected no configuration, --configuration=linux-gcc, or --configuration=windows-asan\n');
  process.exit(2);
}
if (process.platform !== 'win32' && windowsAsan) {
  process.stderr.write('The Windows ASan configuration is available only on Windows\n');
  process.exit(2);
}
if (process.platform !== 'linux' && linuxGcc) {
  process.stderr.write('The Linux GCC configuration is available only on Linux\n');
  process.exit(2);
}
const preset = windowsAsan ? 'windows-asan' : linuxGcc ? 'linux-gcc-test' : `${platformName}-test`;
const testPresetPrefix = windowsAsan ? 'windows-asan' : linuxGcc ? 'linux-gcc' : platformName;
const sanitizers = (process.platform === 'linux' && !linuxGcc) || windowsAsan;
const buildDirectory = resolve(
  workspaceRoot,
  '.cache',
  'local-whisper',
  'fs-guard',
  windowsAsan ? 'build-windows-asan' : `build-${platformName}-test`,
);
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
const gccTools = linuxGcc
  ? Object.freeze({
      cCompiler: process.env.LOCAL_WHISPER_GCC_C_COMPILER || '/usr/bin/x86_64-linux-gnu-gcc-13',
      cxxCompiler: process.env.LOCAL_WHISPER_GCC_CXX_COMPILER || '/usr/bin/x86_64-linux-gnu-g++-13',
      linker: process.env.LOCAL_WHISPER_GCC_LINKER || '/usr/bin/x86_64-linux-gnu-ld.bfd',
    })
  : null;
const buildEnvironment =
  process.platform === 'win32'
    ? resolveWindowsMsvcBuildEnvironment({
        environment: process.env,
        includeCuda: false,
        toolchainRoot,
        tools: nativeBuildTools,
      })
    : process.env;
const windowsSdkTools = process.platform === 'win32' ? resolvePreparedWindowsSdkInputs(buildEnvironment) : null;

function run(command, arguments_, environment = buildEnvironment) {
  const result = spawnSync(command, arguments_, {
    cwd: sourceDirectory,
    env: environment,
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function configureAndBuild() {
  const refreshConfigure = linuxGcc || process.platform === 'win32';
  const arguments_ = [
    ...(linuxGcc
      ? [`-DCMAKE_MAKE_PROGRAM=${nativeBuildTools.ninja}`]
      : windowsSdkTools
        ? [
            `-DCMAKE_CXX_COMPILER=${windowsCmakePath(nativeBuildTools.compiler)}`,
            `-DCMAKE_MAKE_PROGRAM=${windowsCmakePath(nativeBuildTools.ninja)}`,
            `-DCMAKE_RC_COMPILER=${windowsCmakePath(windowsSdkTools.resourceCompiler)}`,
            `-DCMAKE_MT=${windowsCmakePath(windowsSdkTools.manifestTool)}`,
          ]
        : []),
    ...(refreshConfigure ? ['--fresh'] : []),
    '--preset',
    preset,
    `-DLOCAL_WHISPER_GOOGLETEST_SOURCE=${googleTestSource}`,
  ];
  if (process.platform === 'win32' && process.env.LOCAL_WHISPER_MSVC_ANALYZE === 'true') {
    arguments_.push('-DLOCAL_WHISPER_MSVC_ANALYZE=ON');
  }
  if (linuxGcc) {
    arguments_.push(
      `-DCMAKE_C_COMPILER=${gccTools.cCompiler}`,
      `-DCMAKE_CXX_COMPILER=${gccTools.cxxCompiler}`,
      `-DCMAKE_LINKER=${gccTools.linker}`,
    );
  } else if (process.platform === 'linux') {
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
    files: listNativeSourceFiles(sourceDirectory),
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
    files: listPlatformNativeImplementationFiles(resolve(sourceDirectory, 'src'), process.platform),
    label: 'fs-guard clang-tidy',
  });
} else {
  configureAndBuild();
  const testEnvironment = sanitizerRuntimeEnvironment(buildEnvironment, platformName, sanitizers);
  process.stdout.write(`Local Whisper fs-guard ${sanitizers ? 'sanitized' : 'ordinary'} coverage\n`);
  if (action === 'unit' || action === 'all') {
    run(
      ctest,
      ['--preset', `${testPresetPrefix}-unit`, '--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' }))],
      testEnvironment,
    );
  }
  if (action === 'integration' || action === 'all') {
    run(
      ctest,
      ['--preset', `${testPresetPrefix}-integration`, '--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' }))],
      testEnvironment,
    );
  }
}
