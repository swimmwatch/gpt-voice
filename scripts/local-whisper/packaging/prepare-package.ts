import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import { parsePackageMode, parsePackagePlatform } from './contracts';
import { PackageStager, type LocalWhisperHelperInputs } from './PackageStager';
import { assertOnlyOptions, parseOptions, requiredOption } from './arguments';

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');

function canRun(command: string): boolean {
  const result = spawnSync(command, ['--version'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  return result.status === 0;
}

function requiredTool(explicit: string | undefined, systemCommand: string, localCommand: string): string {
  for (const candidate of [explicit, systemCommand, localCommand]) {
    if (candidate && canRun(candidate)) return candidate;
  }
  throw new Error(`Required Local Whisper packaging tool is unavailable: ${systemCommand}`);
}

function optionalTool(explicit: string | undefined, systemCommand: string, localCommand: string): string | undefined {
  for (const candidate of [explicit, systemCommand, localCommand]) {
    if (candidate && canRun(candidate)) return candidate;
  }
  return undefined;
}

function buildHelpers(platform: 'darwin' | 'linux' | 'win32'): LocalWhisperHelperInputs | undefined {
  if (platform === 'darwin') return undefined;
  if (platform !== process.platform)
    throw new Error(`Cannot build ${platform} Local Whisper helpers on ${process.platform}`);
  const localToolchains = path.join(workspaceRoot, '.cache', 'local-whisper', 'toolchains');
  const localCmake = path.join(localToolchains, 'cmake-3.31.8', 'bin', 'cmake');
  const localNinja = path.join(localToolchains, 'ninja-1.12.1', 'ninja');
  const localClang = path.join(localToolchains, 'clang-18.1.3', 'usr', 'bin', 'clang++-18');
  const buildEnvironment = {
    ...process.env,
    CMAKE_COMMAND: requiredTool(process.env.CMAKE_COMMAND, 'cmake', localCmake),
    NINJA_COMMAND: optionalTool(process.env.NINJA_COMMAND, 'ninja', localNinja),
    CXX: requiredTool(process.env.CXX, 'clang++', localClang),
  };
  for (const script of ['build-fs-guard.mjs', 'build-launcher.mjs']) {
    const result = spawnSync(process.execPath, [path.join(workspaceRoot, 'scripts', 'local-whisper', script)], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: buildEnvironment,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) throw new Error(result.stderr || `Failed to build ${script}`);
  }
  const extension = platform === 'win32' ? '.exe' : '';
  const helpers = {
    filesystemGuard: path.join(workspaceRoot, '.cache', 'local-whisper', 'fs-guard', `fs-guard${extension}`),
    launcher: path.join(workspaceRoot, '.cache', 'local-whisper', 'launcher', `local-whisper-launcher${extension}`),
    license: path.join(workspaceRoot, 'LICENSE'),
  };
  if (!existsSync(helpers.filesystemGuard) || !existsSync(helpers.launcher) || !existsSync(helpers.license)) {
    throw new Error('Local Whisper helper build output is incomplete');
  }
  return helpers;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  assertOnlyOptions(options, ['mode', 'platform', 'output', 'bundle', 'bundle-digest']);
  const mode = parsePackageMode(requiredOption(options, 'mode'));
  const platformInput = requiredOption(options, 'platform');
  const platform = parsePackagePlatform(platformInput === 'current' ? process.platform : platformInput);
  const result = await new PackageStager().stage({
    mode,
    platform,
    outputDirectory: options.get('output') ?? path.join(workspaceRoot, 'build', 'generated', 'local-whisper'),
    bundleDirectory: options.get('bundle'),
    expectedBundleManifestSha256: options.get('bundle-digest'),
    helpers: buildHelpers(platform),
  });
  process.stdout.write(`${JSON.stringify({ mode, platform, packageManifestDigest: result.packageManifestSha256 })}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Local Whisper package preparation failed'}\n`);
  process.exitCode = 1;
});
