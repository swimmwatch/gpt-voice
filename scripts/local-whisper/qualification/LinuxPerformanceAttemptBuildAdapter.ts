import { execFile } from 'node:child_process';
import { chmod, copyFile, lstat, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { DevelopmentResourceStager } from '../development/DevelopmentResourceStager';
import {
  DeterministicRuntimePackProducer,
  type QualificationRuntimePackRecord,
} from './DeterministicRuntimePackProducer';
import type {
  PerformanceAttemptBuildInput,
  PerformanceAttemptBuildPort,
  PerformanceAttemptBuildResult,
} from './LinuxPerformanceRunPlanProducer';

const execFileAsync = promisify(execFile);
const EXECUTABLE_RELATIVE_PATH = 'build/performance-attempt/local-whisper-performance-attempt';
const ENTRY_RELATIVE_PATH = 'scripts/local-whisper/qualification/run-linux-performance-attempt.ts';
const COMMAND_OUTPUT_LIMIT = 1024 * 1024;
const RUNTIME_PROFILES = Object.freeze({
  cpu: 'linux-x64-cpu-baseline-v1',
  cuda: 'linux-x64-cuda-12.8.1-sm120a-v1',
} as const);

export interface PerformanceAttemptBuildCommandInput {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly signal?: AbortSignal;
  readonly extraEnvironment?: Readonly<Record<string, string>>;
}

export interface PerformanceAttemptBuildCommandPort {
  run(input: PerformanceAttemptBuildCommandInput): Promise<void>;
}

export interface PerformanceAttemptResourceStagePort {
  stage(workspaceRoot: string, resourcesPath: string, platform: 'linux'): Promise<void>;
}

export interface PerformanceAttemptBuildCachePort {
  stage(toolWorkspaceRoot: string, sourceRoot: string): Promise<void>;
}

export interface PerformanceAttemptRuntimePackPort {
  produce(input: {
    readonly stageRoot: string;
    readonly outputDirectory: string;
    readonly profileId: string;
  }): Promise<QualificationRuntimePackRecord>;
}

export class LinuxPerformanceAttemptBuildError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'LinuxPerformanceAttemptBuildError';
  }
}

function fail(code: string): never {
  throw new LinuxPerformanceAttemptBuildError(code);
}

/** Builds two private derived native graphs and a Node SEA attempt executable. */
export class LinuxPerformanceAttemptBuildAdapter implements PerformanceAttemptBuildPort {
  public constructor(
    private readonly toolWorkspaceRoot: string,
    private readonly dependencies: Readonly<{
      readonly commands: PerformanceAttemptBuildCommandPort;
      readonly cache: PerformanceAttemptBuildCachePort;
      readonly resources: PerformanceAttemptResourceStagePort;
      readonly runtimePacks: PerformanceAttemptRuntimePackPort;
    }>,
  ) {}

  public async build(input: PerformanceAttemptBuildInput): Promise<PerformanceAttemptBuildResult> {
    if (process.platform !== 'linux' || !path.isAbsolute(this.toolWorkspaceRoot) || input.signal?.aborted) {
      fail('PERFORMANCE_ATTEMPT_BUILD_INPUT_INVALID');
    }
    const sourceRoot = input.authority.rootPath;
    const outputRoot = path.join(sourceRoot, 'build', 'performance-attempt');
    await mkdir(path.dirname(outputRoot), { recursive: true, mode: 0o700 }).catch(() =>
      fail('PERFORMANCE_ATTEMPT_BUILD_WRITE_FAILED'),
    );
    await mkdir(outputRoot, { recursive: false, mode: 0o700 }).catch(() =>
      fail('PERFORMANCE_ATTEMPT_BUILD_OUTPUT_EXISTS'),
    );
    await this.dependencies.cache
      .stage(this.toolWorkspaceRoot, sourceRoot)
      .catch(() => fail('PERFORMANCE_ATTEMPT_BUILD_CACHE_FAILED'));
    await this.run(process.execPath, ['scripts/local-whisper/build-fs-guard.mjs'], sourceRoot, input.signal);
    await this.run(process.execPath, ['scripts/local-whisper/build-launcher.mjs'], sourceRoot, input.signal);
    const runtimeArtifacts = {} as Record<
      keyof typeof RUNTIME_PROFILES,
      Readonly<{ readonly relativePath: string; readonly sizeBytes: number; readonly sha256: string }>
    >;
    for (const backend of ['cpu', 'cuda'] as const) {
      const profile = RUNTIME_PROFILES[backend];
      const buildScript =
        backend === 'cpu'
          ? 'scripts/local-whisper/build-whisper-cpp-core.mjs'
          : 'scripts/local-whisper/build-whisper-cpp-cuda.mjs';
      await this.run(process.execPath, [buildScript, `--profile=${profile}`], sourceRoot, input.signal);
      const outputDirectory = path.join(outputRoot, `runtime-${backend}`);
      const record = await this.dependencies.runtimePacks
        .produce({
          stageRoot: path.join(sourceRoot, '.cache', 'local-whisper', 'whisper-cpp', 'stage', profile),
          outputDirectory,
          profileId: profile,
        })
        .catch(() => fail('PERFORMANCE_ATTEMPT_RUNTIME_PACK_FAILED'));
      runtimeArtifacts[backend] = Object.freeze({
        relativePath: path.relative(sourceRoot, path.join(outputDirectory, record.archive.file)),
        sizeBytes: record.archive.sizeBytes,
        sha256: record.archive.sha256,
      });
    }
    await this.dependencies.resources
      .stage(sourceRoot, path.join(outputRoot, 'resources'), 'linux')
      .catch(() => fail('PERFORMANCE_ATTEMPT_RESOURCE_STAGE_FAILED'));
    const bundlePath = path.join(outputRoot, 'attempt-bundle.cjs');
    await this.run(
      path.join(this.toolWorkspaceRoot, 'node_modules', '.bin', 'esbuild'),
      [
        path.join(sourceRoot, ENTRY_RELATIVE_PATH),
        '--bundle',
        '--platform=node',
        '--format=cjs',
        '--target=node24',
        `--tsconfig=${path.join(sourceRoot, 'tsconfig.json')}`,
        `--outfile=${bundlePath}`,
        '--log-level=error',
      ],
      sourceRoot,
      input.signal,
      Object.freeze({ NODE_PATH: path.join(this.toolWorkspaceRoot, 'node_modules') }),
    );
    const blobPath = path.join(outputRoot, 'attempt-sea.blob');
    const configPath = path.join(outputRoot, 'attempt-sea.json');
    await writeFile(
      configPath,
      `${JSON.stringify({
        main: bundlePath,
        output: blobPath,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: false,
      })}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    ).catch(() => fail('PERFORMANCE_ATTEMPT_BUILD_WRITE_FAILED'));
    await this.run(process.execPath, [`--experimental-sea-config=${configPath}`], sourceRoot, input.signal);
    const executablePath = path.join(sourceRoot, EXECUTABLE_RELATIVE_PATH);
    await copyFile(process.execPath, executablePath).catch(() => fail('PERFORMANCE_ATTEMPT_BUILD_WRITE_FAILED'));
    await this.run(
      process.execPath,
      [
        path.join(this.toolWorkspaceRoot, 'node_modules', 'postject', 'dist', 'cli.js'),
        executablePath,
        'NODE_SEA_BLOB',
        blobPath,
        '--sentinel-fuse',
        'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
      ],
      sourceRoot,
      input.signal,
    );
    await chmod(executablePath, 0o500).catch(() => fail('PERFORMANCE_ATTEMPT_BUILD_WRITE_FAILED'));
    const metadata = await lstat(executablePath).catch(() => fail('PERFORMANCE_ATTEMPT_BUILD_OUTPUT_INVALID'));
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || (metadata.mode & 0o777) !== 0o500) {
      fail('PERFORMANCE_ATTEMPT_BUILD_OUTPUT_INVALID');
    }
    return Object.freeze({ executableRelativePath: EXECUTABLE_RELATIVE_PATH, runtimeArtifacts });
  }

  private async run(
    executable: string,
    arguments_: readonly string[],
    cwd: string,
    signal?: AbortSignal,
    extraEnvironment: Readonly<Record<string, string>> = {},
  ): Promise<void> {
    await this.dependencies.commands
      .run({ executable, arguments: arguments_, cwd, ...(signal ? { signal } : {}), extraEnvironment })
      .catch((error: unknown) => {
        if (
          signal?.aborted ||
          (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
        ) {
          fail('PERFORMANCE_ATTEMPT_BUILD_CANCELLED');
        }
        fail('PERFORMANCE_ATTEMPT_BUILD_FAILED');
      });
  }
}

class NodePerformanceAttemptBuildCommand implements PerformanceAttemptBuildCommandPort {
  public async run(input: PerformanceAttemptBuildCommandInput): Promise<void> {
    await execFileAsync(input.executable, [...input.arguments], {
      cwd: input.cwd,
      env: Object.freeze({ ...process.env, ...input.extraEnvironment }),
      maxBuffer: COMMAND_OUTPUT_LIMIT,
      ...(input.signal ? { signal: input.signal } : {}),
      timeout: 60 * 60 * 1000,
      windowsHide: true,
    });
  }
}

class NodePerformanceAttemptBuildCache implements PerformanceAttemptBuildCachePort {
  public async stage(toolWorkspaceRoot: string, sourceRoot: string): Promise<void> {
    const toolRoot = await realpath(toolWorkspaceRoot);
    const derivedRoot = await realpath(sourceRoot);
    if (
      toolRoot === path.parse(toolRoot).root ||
      derivedRoot === path.parse(derivedRoot).root ||
      toolRoot === derivedRoot
    ) {
      throw new Error('PERFORMANCE_ATTEMPT_BUILD_CACHE_INVALID');
    }
    const destinationRoot = path.join(derivedRoot, '.cache', 'local-whisper');
    await mkdir(destinationRoot, { recursive: true, mode: 0o700 });
    for (const name of ['native-sources', 'toolchains'] as const) {
      const expected = path.join(toolRoot, '.cache', 'local-whisper', name);
      const source = await realpath(expected);
      const metadata = await lstat(expected);
      if (
        source !== expected ||
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        !source.startsWith(`${toolRoot}${path.sep}`)
      ) {
        throw new Error('PERFORMANCE_ATTEMPT_BUILD_CACHE_INVALID');
      }
      await symlink(source, path.join(destinationRoot, name), 'dir');
    }
  }
}

/** Composes the private native/SEA build adapter at the qualification command boundary. */
export function createLinuxPerformanceAttemptBuildAdapter(
  toolWorkspaceRoot: string,
): LinuxPerformanceAttemptBuildAdapter {
  return new LinuxPerformanceAttemptBuildAdapter(toolWorkspaceRoot, {
    cache: new NodePerformanceAttemptBuildCache(),
    commands: new NodePerformanceAttemptBuildCommand(),
    resources: new DevelopmentResourceStager(),
    runtimePacks: new DeterministicRuntimePackProducer(),
  });
}
