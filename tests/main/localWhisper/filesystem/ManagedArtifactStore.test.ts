import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import type { ManagedArtifactIdentitySnapshot } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import { ManagedArtifactLockRepository } from '@main/localWhisper/filesystem/ManagedArtifactLockRepository';
import type { ManagedArtifactRootResolution } from '@main/localWhisper/filesystem/ManagedArtifactPathResolver';
import {
  ManagedArtifactStore,
  ManagedArtifactStoreError,
  getManagedArtifactStorageFileName,
  type ManagedArtifactDescriptor,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';
import {
  ManagedFilesystemAdapterError,
  type ManagedFilesystemDirectoryEntry,
  type ManagedFilesystemOpenResult,
  type ManagedFilesystemPlatformAdapter,
} from '@main/localWhisper/filesystem/ManagedFilesystemPlatformAdapter';
import { toLocalWhisperArtifactId } from '@shared/localWhisper';

const MANAGED_MANIFEST_NAME = 'managed-manifest-v1';
const MANAGED_MANIFEST_MODE = 0o600;
const PLATFORMS = ['linux', 'win32'] as const;

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function artifactId(value: string) {
  const result = toLocalWhisperArtifactId(value);
  assert.ok(result);
  return result;
}

function identity(
  fileId: string,
  type: ManagedArtifactIdentitySnapshot['type'],
  mode: number,
  sizeBytes: number,
): ManagedArtifactIdentitySnapshot {
  return Object.freeze({
    deviceOrVolumeId: 'test-volume',
    fileId,
    linkCount: 1,
    mode,
    parentFileId: 'test-parent',
    sizeBytes,
    type,
  });
}

function modelDescriptor(): ManagedArtifactDescriptor {
  const identityKey = 'base/full';
  const canonicalName = `model-${sha256(identityKey)}`;
  const modelBytes = Buffer.from('model-fixture', 'utf8');
  return Object.freeze({
    artifactId: artifactId(canonicalName),
    canonicalName,
    catalogDigest: sha256('catalog'),
    expectedFiles: Object.freeze([
      Object.freeze({
        fileId: artifactId('model-data'),
        kind: 'data' as const,
        mode: 0o600,
        sha256: sha256(modelBytes),
        sizeBytes: modelBytes.byteLength,
      }),
    ]),
    identityKey,
    kind: 'model' as const,
    namespace: 'models' as const,
  });
}

function managedManifestBytes(descriptor: ManagedArtifactDescriptor): Buffer {
  return Buffer.from(
    JSON.stringify({
      canonicalName: descriptor.canonicalName,
      catalogDigest: descriptor.catalogDigest,
      expectedFiles: descriptor.expectedFiles.map(({ fileId, kind, mode, sha256: digest, sizeBytes }) => ({
        fileId,
        kind,
        mode,
        sha256: digest,
        sizeBytes,
      })),
      identityKey: descriptor.identityKey,
      kind: descriptor.kind,
      schemaVersion: 1,
    }),
    'utf8',
  );
}

function directoryEntries(descriptor: ManagedArtifactDescriptor): readonly ManagedFilesystemDirectoryEntry[] {
  const expected = descriptor.expectedFiles[0];
  assert.ok(expected);
  const manifest = managedManifestBytes(descriptor);
  return Object.freeze([
    Object.freeze({
      canonicalName: MANAGED_MANIFEST_NAME,
      identity: identity('manifest-file', 'regular', MANAGED_MANIFEST_MODE, manifest.byteLength),
      sha256: sha256(manifest),
    }),
    Object.freeze({
      canonicalName: getManagedArtifactStorageFileName(descriptor, expected.fileId),
      identity: identity('model-file', 'regular', expected.mode, expected.sizeBytes),
      sha256: expected.sha256,
    }),
  ]);
}

type EntryMutation = (entry: ManagedFilesystemDirectoryEntry) => ManagedFilesystemDirectoryEntry;

function mutateModelEntry(
  entries: readonly ManagedFilesystemDirectoryEntry[],
  mutation: EntryMutation,
): readonly ManagedFilesystemDirectoryEntry[] {
  return Object.freeze(entries.map((entry, index) => (index === 1 ? Object.freeze(mutation(entry)) : entry)));
}

function createHarness(
  platform: (typeof PLATFORMS)[number],
  options: {
    readonly failRevalidateAt?: number;
    readonly reinspectionEntries?: readonly ManagedFilesystemDirectoryEntry[];
  } = {},
) {
  const descriptor = modelDescriptor();
  const stableEntries = directoryEntries(descriptor);
  const releases = new Map<string, number>();
  let inspections = 0;
  let revalidations = 0;
  const rootNative: ManagedFilesystemOpenResult = Object.freeze({
    identity: identity('root-directory', 'directory', 0o700, 0),
    token: 'root-token',
  });
  const lockNative: ManagedFilesystemOpenResult = Object.freeze({
    identity: identity('lock-file', 'regular', 0o600, 1),
    token: 'lock-token',
  });
  const modelNative: ManagedFilesystemOpenResult = Object.freeze({
    identity: identity('model-directory', 'directory', 0o700, 0),
    token: 'model-token',
  });
  const adapter = {
    acquireArtifactLock: async () => lockNative,
    dispose: async () => undefined,
    initialize: async () => rootNative,
    inspectDirectory: async () => {
      inspections += 1;
      return inspections === 1 ? stableEntries : (options.reinspectionEntries ?? stableEntries);
    },
    openArtifactDirectory: async () => modelNative,
    release: async (token: string) => {
      releases.set(token, (releases.get(token) ?? 0) + 1);
    },
    revalidate: async () => {
      revalidations += 1;
      if (revalidations === options.failRevalidateAt) {
        throw new ManagedFilesystemAdapterError('IDENTITY_CHANGED');
      }
    },
  } as Pick<
    ManagedFilesystemPlatformAdapter,
    | 'acquireArtifactLock'
    | 'dispose'
    | 'initialize'
    | 'inspectDirectory'
    | 'openArtifactDirectory'
    | 'release'
    | 'revalidate'
  > as ManagedFilesystemPlatformAdapter;
  const rootResolution: ManagedArtifactRootResolution = Object.freeze({
    availability: 'available',
    baseDirectory: `/managed/${platform}`,
    managedRoot: `/managed/${platform}/local-whisper`,
    platform,
    sanitizedLabel: 'Local Whisper managed storage',
  });
  const lockRepository = new ManagedArtifactLockRepository({
    adapter,
    appInstanceNonce: 'app-instance-00000001',
    osProcessStartIdentity: 'process-start',
    pid: 42,
  });
  const store = new ManagedArtifactStore({
    adapter,
    generateOperationNonce: () => 'operation-00000000000001',
    lockRepository,
    rootResolution,
  });
  return Object.freeze({
    counts: () => Object.freeze({ inspections, revalidations }),
    descriptor,
    releaseCount: (token: string) => releases.get(token) ?? 0,
    rootResolution,
    stableEntries,
    store,
  });
}

function artifactUnprovable(error: unknown): boolean {
  return error instanceof ManagedArtifactStoreError && error.code === 'ARTIFACT_UNPROVABLE';
}

function createPromotionFailureHarness() {
  const descriptor = modelDescriptor();
  const stableEntries = directoryEntries(descriptor);
  const metadataEntries = Object.freeze(stableEntries.map((entry) => Object.freeze({ ...entry, sha256: null })));
  const releases = new Map<string, number>();
  let promotionAttempts = 0;
  let stagingInspectionCount = 0;
  const rootNative: ManagedFilesystemOpenResult = Object.freeze({
    identity: identity('root-directory', 'directory', 0o700, 0),
    token: 'root-token',
  });
  const lockNative: ManagedFilesystemOpenResult = Object.freeze({
    identity: identity('lock-file', 'regular', 0o600, 1),
    token: 'lock-token',
  });
  const stagingNative: ManagedFilesystemOpenResult = Object.freeze({
    identity: identity('staging-directory', 'directory', 0o700, 0),
    token: 'staging-token',
  });
  const manifestNative: ManagedFilesystemOpenResult = Object.freeze({
    identity: identity('manifest-file', 'regular', MANAGED_MANIFEST_MODE, 0),
    token: 'manifest-token',
  });
  const adapter = {
    acquireArtifactLock: async () => lockNative,
    appendStagedFile: async () => undefined,
    createStagedFile: async () => manifestNative,
    createStagingDirectory: async () => stagingNative,
    deleteStagingFile: async () => undefined,
    dispose: async () => undefined,
    initialize: async () => rootNative,
    inspectDirectory: async () => {
      stagingInspectionCount += 1;
      return stagingInspectionCount === 1 ? stableEntries : [];
    },
    inspectDirectoryMetadataOnly: async () => metadataEntries,
    promoteStagingDirectory: async () => {
      promotionAttempts += 1;
      throw new ManagedFilesystemAdapterError('IO_FAILED');
    },
    release: async (token: string) => {
      releases.set(token, (releases.get(token) ?? 0) + 1);
    },
    removeEmptyStagingDirectory: async () => undefined,
    revalidate: async () => {
      throw new ManagedFilesystemAdapterError('IDENTITY_CHANGED');
    },
    sealStagedFile: async () => manifestNative.identity,
  } as Pick<
    ManagedFilesystemPlatformAdapter,
    | 'acquireArtifactLock'
    | 'appendStagedFile'
    | 'createStagedFile'
    | 'createStagingDirectory'
    | 'deleteStagingFile'
    | 'dispose'
    | 'initialize'
    | 'inspectDirectory'
    | 'inspectDirectoryMetadataOnly'
    | 'promoteStagingDirectory'
    | 'release'
    | 'removeEmptyStagingDirectory'
    | 'revalidate'
    | 'sealStagedFile'
  > as ManagedFilesystemPlatformAdapter;
  const lockRepository = new ManagedArtifactLockRepository({
    adapter,
    appInstanceNonce: 'app-instance-00000001',
    osProcessStartIdentity: 'process-start',
    pid: 42,
  });
  const store = new ManagedArtifactStore({
    adapter,
    generateOperationNonce: () => 'operation-00000000000001',
    lockRepository,
    rootResolution: Object.freeze({
      availability: 'available',
      baseDirectory: '/managed/linux',
      managedRoot: '/managed/linux/local-whisper',
      platform: 'linux',
      sanitizedLabel: 'Local Whisper managed storage',
    }),
  });
  return Object.freeze({
    descriptor,
    promotionAttempts: () => promotionAttempts,
    releaseCount: (token: string) => releases.get(token) ?? 0,
    store,
  });
}

describe('ManagedArtifactStore model launch acquisition', () => {
  for (const platform of PLATFORMS) {
    it(`reuses the acquisition directory result on ${platform} and keeps the later fresh inspection`, async () => {
      const harness = createHarness(platform);
      await harness.store.initialize();
      const launch = await harness.store.leaseInstalledModelForLaunch(harness.descriptor);
      const expectedModel = harness.descriptor.expectedFiles[0];
      assert.ok(expectedModel);

      assert.deepEqual(harness.counts(), { inspections: 1, revalidations: 2 });
      assert.equal(launch.modelFileSha256, expectedModel.sha256);
      assert.equal(
        launch.modelFilePath,
        path.join(
          harness.rootResolution.managedRoot,
          'models',
          harness.descriptor.canonicalName,
          getManagedArtifactStorageFileName(harness.descriptor, expectedModel.fileId),
        ),
      );

      await launch.revalidate();
      assert.deepEqual(harness.counts(), { inspections: 2, revalidations: 3 });
      await launch.modelLease.release();
      await launch.modelLease.release();
      assert.equal(harness.releaseCount('model-token'), 1);
      assert.equal(harness.releaseCount('lock-token'), 1);
      await harness.store.dispose();
    });

    for (const [mutationName, mutation] of Object.entries<EntryMutation>({
      content: (entry) => ({ ...entry, sha256: sha256('changed-model') }),
      identity: (entry) => ({ ...entry, identity: { ...entry.identity, fileId: 'replacement-model-file' } }),
      size: (entry) => ({ ...entry, identity: { ...entry.identity, sizeBytes: entry.identity.sizeBytes + 1 } }),
    })) {
      it(`fails closed and releases once for ${mutationName} mutation on ${platform}`, async () => {
        const descriptor = modelDescriptor();
        const stableEntries = directoryEntries(descriptor);
        const harness = createHarness(platform, {
          reinspectionEntries: mutateModelEntry(stableEntries, mutation),
        });
        await harness.store.initialize();
        const launch = await harness.store.leaseInstalledModelForLaunch(harness.descriptor);

        await assert.rejects(launch.revalidate(), artifactUnprovable);
        assert.equal(launch.modelLease.released, true);
        assert.equal(harness.releaseCount('model-token'), 1);
        assert.equal(harness.releaseCount('lock-token'), 1);
        await launch.modelLease.release();
        assert.equal(harness.releaseCount('model-token'), 1);
        await harness.store.dispose();
      });
    }

    for (const proofPoint of [1, 2, 3]) {
      it(`releases once when retained identity proof ${proofPoint} fails on ${platform}`, async () => {
        const harness = createHarness(platform, { failRevalidateAt: proofPoint });
        await harness.store.initialize();
        if (proofPoint < 3) {
          await assert.rejects(harness.store.leaseInstalledModelForLaunch(harness.descriptor), artifactUnprovable);
        } else {
          const launch = await harness.store.leaseInstalledModelForLaunch(harness.descriptor);
          await assert.rejects(launch.revalidate(), artifactUnprovable);
          await launch.modelLease.release();
        }
        assert.equal(harness.releaseCount('model-token'), 1);
        assert.equal(harness.releaseCount('lock-token'), 1);
        await harness.store.dispose();
      });
    }
  }
});

describe('ManagedArtifactStore staging promotion', () => {
  it('retains a failed metadata-only staging lease until the extractor can discard it', async () => {
    const harness = createPromotionFailureHarness();
    await harness.store.initialize();
    const staging = await harness.store.createStaging(harness.descriptor);

    await assert.rejects(
      harness.store.promoteMetadataOnlyModel(harness.descriptor, staging),
      (error: unknown) => error instanceof ManagedArtifactStoreError && error.code === 'INSTALL_FAILED',
    );
    assert.equal(harness.promotionAttempts(), 1);
    assert.equal(staging.released, false);
    assert.equal(harness.releaseCount('staging-token'), 0);

    await harness.store.discardStaging(staging);
    assert.equal(staging.released, true);
    assert.equal(harness.releaseCount('staging-token'), 1);
    assert.equal(harness.releaseCount('lock-token'), 1);
  });
});
