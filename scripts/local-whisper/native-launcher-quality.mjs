import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import process from 'node:process';

import { resolveClangFormat, resolveClangTidy } from './native-quality-tools.mjs';
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
  process.stderr.write('Native Local Whisper launcher checks support Linux and Windows only\n');
  process.exit(2);
}

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const sourceDirectory = resolve(workspaceRoot, 'runtime', 'local-whisper', 'launcher');
const outputDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', 'launcher');
const fixtureDirectory = resolve(outputDirectory, 'fixtures');
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
const buildDirectory = resolve(outputDirectory, windowsAsan ? 'build-windows-asan' : `build-${platformName}-test`);
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
const windowsAsanRuntime = windowsAsan
  ? resolve(dirname(nativeBuildTools.compiler), 'clang_rt.asan_dynamic-x86_64.dll')
  : null;
if (windowsAsan && (!isAbsolute(nativeBuildTools.compiler) || !existsSync(windowsAsanRuntime))) {
  throw new Error('Verified compiler-adjacent Windows ASan runtime is unavailable');
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? sourceDirectory,
    env: options.env ?? buildEnvironment,
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
    `-DLOCAL_WHISPER_LAUNCHER_OUTPUT_DIRECTORY=${outputDirectory}`,
    `-DLOCAL_WHISPER_LAUNCHER_FIXTURE_OUTPUT_DIRECTORY=${fixtureDirectory}`,
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

function runExecutableIntegration(environment) {
  const fixtureEnvironment = linuxGcc ? { ...environment, LOCAL_WHISPER_NATIVE_QUALITY_GCC: 'true' } : environment;
  run(process.execPath, ['scripts/local-whisper/build-fs-guard.mjs'], { cwd: workspaceRoot, env: fixtureEnvironment });
  run(process.execPath, ['--import', 'tsx', 'scripts/local-whisper/verify-launcher.ts', '--fixture'], {
    cwd: workspaceRoot,
    env: fixtureEnvironment,
  });
}

if (action === 'format') {
  await runNativeFileToolInParallel({
    arguments_: ['--dry-run', '--Werror'],
    command: resolveClangFormat(workspaceRoot, clangRoot),
    cwd: sourceDirectory,
    env: buildEnvironment,
    files: nativeFiles(sourceDirectory),
    label: 'launcher clang-format',
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
    files: nativeImplementationFiles(sourceDirectory),
    label: 'launcher clang-tidy',
  });
} else {
  configureAndBuild();
  const testEnvironment = sanitizerRuntimeEnvironment(
    windowsAsan ? { ...buildEnvironment, LOCAL_WHISPER_MSVC_ASAN_RUNTIME: windowsAsanRuntime } : buildEnvironment,
    platformName,
    sanitizers,
  );
  process.stdout.write(`Local Whisper launcher ${sanitizers ? 'sanitized' : 'ordinary'} coverage\n`);
  if (action === 'unit' || action === 'all') {
    run(
      ctest,
      ['--preset', `${testPresetPrefix}-unit`, '--parallel', String(resolveNativeBuildJobs({ backend: 'cpu' }))],
      {
        env: testEnvironment,
      },
    );
  }
  if (action === 'integration' || action === 'all') {
    if (process.platform === 'linux') {
      run(
        ctest,
        [
          '--preset',
          `${testPresetPrefix}-integration`,
          '--parallel',
          String(resolveNativeBuildJobs({ backend: 'cpu' })),
        ],
        {
          env: testEnvironment,
        },
      );
    }
    runExecutableIntegration(testEnvironment);
  }
}
