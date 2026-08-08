import { lstat } from 'node:fs/promises';
import * as path from 'node:path';

import { readCanonicalJson, sha256File } from '../packaging/fileIntegrity';
import { QualificationCommandRunner, type QualificationCommandPort } from './QualificationCommandRunner';

const SEMVER_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const FREEZE_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

export { QualificationCommandRunner } from './QualificationCommandRunner';
export type { QualificationCommandPort, QualificationCommandRequest } from './QualificationCommandRunner';

export interface LinuxQualificationPackageIdentity {
  readonly format: 'AppImage' | 'deb' | 'rpm';
  readonly fileName: string;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface LinuxQualificationPackageBuildResult {
  readonly packages: readonly LinuxQualificationPackageIdentity[];
  readonly resourcesPath: string;
}

export interface LinuxQualificationPackageBuildInput {
  readonly bundleDirectory: string;
  readonly bundleManifestSha256: string;
  readonly candidateSemVer: string;
  readonly freezeTimestampUtc: string;
  readonly sourceCommit: string;
  readonly worktree: string;
}

async function packageIdentity(
  releaseRoot: string,
  format: LinuxQualificationPackageIdentity['format'],
  fileName: string,
): Promise<LinuxQualificationPackageIdentity> {
  const filePath = path.join(releaseRoot, fileName);
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size <= 0) {
    throw new Error(`Qualification package missing: ${fileName}`);
  }
  return Object.freeze({
    format,
    fileName,
    filePath,
    sizeBytes: metadata.size,
    sha256: await sha256File(filePath),
  });
}

/** Builds exact Linux candidate packages from one clean, commit-pinned worktree. */
export class LinuxQualificationPackageBuilder {
  public constructor(private readonly commands: QualificationCommandPort = new QualificationCommandRunner()) {}

  public async build(input: LinuxQualificationPackageBuildInput): Promise<LinuxQualificationPackageBuildResult> {
    if (
      process.platform !== 'linux' ||
      !path.isAbsolute(input.worktree) ||
      path.resolve(input.worktree) === path.parse(path.resolve(input.worktree)).root ||
      !path.isAbsolute(input.bundleDirectory) ||
      !/^[a-f0-9]{64}$/u.test(input.bundleManifestSha256) ||
      !SEMVER_PATTERN.test(input.candidateSemVer) ||
      !COMMIT_PATTERN.test(input.sourceCommit) ||
      !FREEZE_TIMESTAMP_PATTERN.test(input.freezeTimestampUtc) ||
      !Number.isFinite(Date.parse(input.freezeTimestampUtc))
    ) {
      throw new Error('Qualification package build input invalid');
    }
    const bundleManifestPath = path.join(input.bundleDirectory, 'bundle-manifest.json');
    await readCanonicalJson(bundleManifestPath);
    if ((await sha256File(bundleManifestPath)) !== input.bundleManifestSha256) {
      throw new Error('Qualification package bundle identity changed');
    }
    const worktree = path.resolve(input.worktree);
    const sourceCommit = await this.commands.run({ command: 'git', arguments: ['rev-parse', 'HEAD'], cwd: worktree });
    const status = await this.commands.run({
      command: 'git',
      arguments: ['status', '--porcelain=v1', '--untracked-files=no'],
      cwd: worktree,
    });
    if (sourceCommit !== input.sourceCommit || status !== '') {
      throw new Error('Qualification package worktree is not the exact clean source commit');
    }

    const environment = Object.freeze({ ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' });
    const run = (command: string, arguments_: readonly string[]): Promise<string> =>
      this.commands.run({ command, arguments: arguments_, cwd: worktree, environment });
    await run('npm', ['run', 'build:prod']);
    await run('npm', ['run', 'prepare:cloakbrowser', '--', '--target=linux']);
    await run(process.execPath, [
      'scripts/generate-package-metadata.mjs',
      `--version=${input.candidateSemVer}`,
      `--release-date=${input.freezeTimestampUtc}`,
    ]);
    await run(process.execPath, [
      '--import',
      'tsx',
      'scripts/local-whisper/packaging/prepare-package.ts',
      '--mode=qualification',
      '--platform=linux',
      `--bundle=${input.bundleDirectory}`,
      `--bundle-digest=${input.bundleManifestSha256}`,
    ]);
    await run(path.join(worktree, 'node_modules', '.bin', 'electron-builder'), [
      '--linux',
      'AppImage',
      'deb',
      'rpm',
      '--x64',
      '--publish',
      'never',
      `-c.extraMetadata.version=${input.candidateSemVer}`,
    ]);

    const releaseRoot = path.join(worktree, 'release');
    const packages = await Promise.all([
      packageIdentity(releaseRoot, 'AppImage', `GPT-Voice-${input.candidateSemVer}.AppImage`),
      packageIdentity(releaseRoot, 'deb', `gpt-voice_${input.candidateSemVer}_amd64.deb`),
      packageIdentity(releaseRoot, 'rpm', `gpt-voice-${input.candidateSemVer}.x86_64.rpm`),
    ]);
    return Object.freeze({
      packages: Object.freeze(packages),
      resourcesPath: path.join(worktree, 'build', 'generated'),
    });
  }
}
