import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  LinuxQualificationPackageBuilder,
  type QualificationCommandPort,
  type QualificationCommandRequest,
} from '../../../../scripts/local-whisper/qualification/LinuxQualificationPackageBuilder';
import { sha256File, writeCanonicalJson } from '../../../../scripts/local-whisper/packaging/fileIntegrity';

const COMMIT = 'a'.repeat(40);

class BuildCommands implements QualificationCommandPort {
  public readonly requests: QualificationCommandRequest[] = [];

  public constructor(private readonly worktree: string) {}

  public async run(request: QualificationCommandRequest): Promise<string> {
    this.requests.push(request);
    if (request.command === 'git' && request.arguments[0] === 'rev-parse') return COMMIT;
    if (request.command === 'git') return '';
    if (request.command.endsWith('electron-builder')) {
      const releaseRoot = path.join(this.worktree, 'release');
      await mkdir(releaseRoot, { recursive: true });
      await Promise.all([
        writeFile(path.join(releaseRoot, 'GPT-Voice-2.4.0.AppImage'), 'appimage'),
        writeFile(path.join(releaseRoot, 'gpt-voice_2.4.0_amd64.deb'), 'deb'),
        writeFile(path.join(releaseRoot, 'gpt-voice-2.4.0.x86_64.rpm'), 'rpm'),
      ]);
    }
    return '';
  }
}

async function createBundle(root: string): Promise<{ readonly directory: string; readonly manifestSha256: string }> {
  const directory = path.join(root, 'bundle');
  await mkdir(directory);
  const manifestPath = path.join(directory, 'bundle-manifest.json');
  await writeCanonicalJson(manifestPath, { purpose: 'qualification', schemaVersion: 1 });
  return Object.freeze({ directory, manifestSha256: await sha256File(manifestPath) });
}

describe('LinuxQualificationPackageBuilder', () => {
  it('projects the explicit candidate version into metadata and all three Linux packages', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-package-builder-test-'));
    try {
      const bundle = await createBundle(root);
      const commands = new BuildCommands(root);
      const result = await new LinuxQualificationPackageBuilder(commands).build({
        bundleDirectory: bundle.directory,
        bundleManifestSha256: bundle.manifestSha256,
        candidateSemVer: '2.4.0',
        freezeTimestampUtc: '2026-08-03T12:00:00Z',
        sourceCommit: COMMIT,
        worktree: root,
      });

      assert.deepEqual(
        result.packages.map(({ format }) => format),
        ['AppImage', 'deb', 'rpm'],
      );
      const metadata = commands.requests.find(({ arguments: values }) =>
        values.includes('scripts/generate-package-metadata.mjs'),
      );
      assert.ok(metadata?.arguments.includes('--version=2.4.0'));
      const builder = commands.requests.find(({ command }) => command.endsWith('electron-builder'));
      assert.ok(builder?.arguments.includes('-c.extraMetadata.version=2.4.0'));
      assert.equal(result.resourcesPath, path.join(root, 'build', 'generated'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a dirty or different worktree before build commands run', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-package-builder-test-'));
    try {
      const bundle = await createBundle(root);
      const commands: QualificationCommandPort = {
        run: (request) => Promise.resolve(request.arguments[0] === 'rev-parse' ? 'c'.repeat(40) : ' M source.ts'),
      };
      await assert.rejects(
        new LinuxQualificationPackageBuilder(commands).build({
          bundleDirectory: bundle.directory,
          bundleManifestSha256: bundle.manifestSha256,
          candidateSemVer: '2.4.0',
          freezeTimestampUtc: '2026-08-03T12:00:00Z',
          sourceCommit: COMMIT,
          worktree: root,
        }),
        /exact clean source commit/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a changed qualification bundle before any build command', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-package-builder-test-'));
    try {
      const bundle = await createBundle(root);
      const commands = new BuildCommands(root);
      await assert.rejects(
        new LinuxQualificationPackageBuilder(commands).build({
          bundleDirectory: bundle.directory,
          bundleManifestSha256: 'b'.repeat(64),
          candidateSemVer: '2.4.0',
          freezeTimestampUtc: '2026-08-03T12:00:00Z',
          sourceCommit: COMMIT,
          worktree: root,
        }),
        /bundle identity changed/u,
      );
      assert.equal(commands.requests.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
