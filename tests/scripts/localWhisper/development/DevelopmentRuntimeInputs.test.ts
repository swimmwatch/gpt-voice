import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { toLocalWhisperArtifactId } from '@shared/localWhisper';
import { DevelopmentRuntimeInputLoader } from '@scripts/local-whisper/development/DevelopmentRuntimeInputs';
import { sha256File, writeCanonicalJson } from '@scripts/local-whisper/packaging/fileIntegrity';

const RUNTIMES = Object.freeze([
  Object.freeze({
    backend: 'cpu' as const,
    profileId: 'linux-x64-cpu-baseline-v1',
    packRevision: 'whisper-cpp-linux-x64-cpu-baseline-v1',
    runtimeBuildDigest: 'a'.repeat(64),
  }),
  Object.freeze({
    backend: 'cuda' as const,
    profileId: 'linux-x64-cuda-12.8.1-sm120a-v1',
    packRevision: 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
    runtimeBuildDigest: 'b'.repeat(64),
  }),
]);

const WINDOWS_RUNTIMES = Object.freeze([
  Object.freeze({
    backend: 'cpu' as const,
    profileId: 'windows-x64-cpu-msvc-19.39-v1',
    packRevision: 'whisper-cpp-windows-x64-cpu-v1',
    runtimeBuildDigest: '1'.repeat(64),
  }),
  Object.freeze({
    backend: 'cuda' as const,
    profileId: 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1',
    packRevision: 'whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1',
    runtimeBuildDigest: '2'.repeat(64),
  }),
]);

async function stageRuntime(
  workspace: string,
  runtime: (typeof RUNTIMES)[number] | (typeof WINDOWS_RUNTIMES)[number],
): Promise<{ readonly manifestPath: string; readonly packPath: string }> {
  const stageRoot = path.join(workspace, '.cache', 'local-whisper', 'whisper-cpp', 'stage', runtime.profileId);
  const packRoot = path.join(
    workspace,
    '.cache',
    'local-whisper',
    'qualification',
    'runtime-packs',
    runtime.backend,
    'build-a',
  );
  await Promise.all([mkdir(stageRoot, { recursive: true }), mkdir(packRoot, { recursive: true })]);
  const manifestPath = path.join(stageRoot, 'runtime-manifest.json');
  await writeCanonicalJson(manifestPath, {
    schemaId: 'local-whisper-runtime-manifest-v1',
    engine: 'whisperCpp',
    backend: runtime.backend,
    profileId: runtime.profileId,
    runtimeRevision: runtime.packRevision,
    runtimeBuildDigest: runtime.runtimeBuildDigest,
    modelIncluded: false,
    signed: false,
    productionOrigin: false,
  });
  const archive = Buffer.from(`development-${runtime.backend}-archive`, 'utf8');
  const archiveSha256 = createHash('sha256').update(archive).digest('hex');
  const archiveFile = `${runtime.profileId}.tar.gz`;
  await writeFile(path.join(packRoot, archiveFile), archive, { mode: 0o600 });
  const packPath = path.join(packRoot, 'runtime-pack.json');
  await writeCanonicalJson(packPath, {
    schemaVersion: 1,
    profileId: runtime.profileId,
    transferProfile: 'restricted-tar-gzip-v1',
    archive: {
      file: archiveFile,
      sizeBytes: archive.byteLength,
      sha256: archiveSha256,
      signatureInputSha256: archiveSha256,
    },
    expectedFiles: [
      {
        fileId: toLocalWhisperArtifactId(`${runtime.backend}-worker`)!,
        kind: 'executable',
        mode: 0o500,
        sizeBytes: 1,
        sha256: 'c'.repeat(64),
      },
    ],
    evidence: {
      runtimeManifestSha256: await sha256File(manifestPath),
      provenanceSha256: 'd'.repeat(64),
      sbomSha256: 'e'.repeat(64),
      noticesSha256: 'f'.repeat(64),
    },
  });
  return Object.freeze({ manifestPath, packPath });
}

describe('DevelopmentRuntimeInputLoader', () => {
  it('binds each catalog runtime to the authenticated worker build digest', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-runtime-'));
    try {
      await Promise.all(RUNTIMES.map((runtime) => stageRuntime(workspace, runtime)));
      const loaded = await new DevelopmentRuntimeInputLoader('linux').load(workspace, 'linux');
      assert.deepEqual(
        loaded.map(({ backend, catalog }) => ({ backend, buildRevision: catalog.buildRevision })),
        RUNTIMES.map(({ backend, runtimeBuildDigest }) => ({ backend, buildRevision: runtimeBuildDigest })),
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects a runtime manifest whose authenticated bytes changed', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-runtime-'));
    try {
      const staged = await Promise.all(RUNTIMES.map((runtime) => stageRuntime(workspace, runtime)));
      const cuda = RUNTIMES[1];
      await writeCanonicalJson(staged[1]!.manifestPath, {
        schemaId: 'local-whisper-runtime-manifest-v1',
        engine: 'whisperCpp',
        backend: cuda.backend,
        profileId: cuda.profileId,
        runtimeRevision: cuda.packRevision,
        runtimeBuildDigest: 'c'.repeat(64),
        modelIncluded: false,
        signed: false,
        productionOrigin: false,
      });
      await assert.rejects(
        () => new DevelopmentRuntimeInputLoader('linux').load(workspace, 'linux'),
        /Local Whisper development runtime manifest identity changed/u,
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('selects the closed Windows profiles and freezes current to the admitted host', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-runtime-'));
    try {
      await Promise.all(WINDOWS_RUNTIMES.map((runtime) => stageRuntime(workspace, runtime)));
      const loader = new DevelopmentRuntimeInputLoader('win32');
      const loaded = await loader.load(workspace, 'current');
      assert.deepEqual(
        loaded.map(({ backend, catalog }) => ({
          backend,
          platform: catalog.platform,
          architecture: catalog.architecture,
          packRevision: catalog.packRevision,
        })),
        WINDOWS_RUNTIMES.map(({ backend, packRevision }) => ({
          backend,
          platform: 'win32',
          architecture: 'x64',
          packRevision,
        })),
      );
      await assert.rejects(loader.load(workspace, 'linux'), /runtime host invalid/u);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
