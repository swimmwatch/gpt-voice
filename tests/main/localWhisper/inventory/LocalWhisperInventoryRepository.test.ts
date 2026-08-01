import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import {
  getLocalWhisperModelIdentityKey,
  getLocalWhisperRuntimeIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogModelEntry,
  type LocalWhisperCatalogPayload,
  type LocalWhisperCatalogRuntimeEntry,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  LocalWhisperInventoryRepository,
  type LocalWhisperManagedArtifactEvidence,
  type LocalWhisperManagedStorageEvidencePort,
  type LocalWhisperUnmanagedEvidence,
} from '@main/localWhisper/inventory/LocalWhisperInventoryRepository';
import {
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperMemoryEstimateRecord,
  type LocalWhisperModelIdentity,
} from '@shared/localWhisper';
import {
  createFixtureCatalogPayload,
  createFixtureCatalogTrustPolicy,
  signFixtureCatalog,
} from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

class RecordingEvidence implements LocalWhisperManagedStorageEvidencePort {
  public readonly runtime = new Map<string, LocalWhisperManagedArtifactEvidence>();
  public readonly model = new Map<string, LocalWhisperManagedArtifactEvidence>();
  public unmanaged: readonly LocalWhisperUnmanagedEvidence[] = [];

  public getRuntimeEvidence(identityKey: string): LocalWhisperManagedArtifactEvidence {
    return this.runtime.get(identityKey) ?? { kind: 'missing' };
  }

  public getModelEvidence(identityKey: string): LocalWhisperManagedArtifactEvidence {
    return this.model.get(identityKey) ?? { kind: 'missing' };
  }

  public listUnmanagedEvidence(): readonly LocalWhisperUnmanagedEvidence[] {
    return this.unmanaged;
  }
}

function loadCatalog(payload = createFixtureCatalogPayload()): LocalWhisperAuthenticatedCatalog {
  const loaded = new LocalWhisperCatalogRepository({
    readDocument: () => signFixtureCatalog(payload),
    trustPolicy: createFixtureCatalogTrustPolicy(),
  }).load();
  if (!loaded.success) assert.fail(`Fixture catalog failed: ${loaded.code}`);
  return loaded.catalog;
}

function installedRuntimeEvidence(catalog: LocalWhisperAuthenticatedCatalog): LocalWhisperManagedArtifactEvidence {
  const identity = catalog.payload.runtimes[0].identity;
  return {
    kind: 'installed',
    manifestIdentityKey: getLocalWhisperRuntimeIdentityKey(identity),
    manifestValid: true,
    files: identity.expectedFiles,
  };
}

function installedModelEvidence(catalog: LocalWhisperAuthenticatedCatalog): LocalWhisperManagedArtifactEvidence {
  const entry = catalog.payload.models[0];
  return {
    kind: 'installed',
    manifestIdentityKey: getLocalWhisperModelIdentityKey(entry.identity),
    manifestValid: true,
    files: entry.expectedFiles,
  };
}

describe('LocalWhisperInventoryRepository', () => {
  it('starts every process Unloaded and classifies absent managed evidence as Missing', () => {
    const catalog = loadCatalog();
    const evidence = new RecordingEvidence();
    evidence.unmanaged = [{ recoveryLabel: 'Unmanaged Local Whisper data requires manual review' }];
    const repository = new LocalWhisperInventoryRepository();

    const first = repository.reconstruct({ catalog, evidence });
    const second = repository.reconstruct({ catalog, evidence });

    assert.equal(first.revision, 1);
    assert.equal(second.revision, 2);
    assert.equal(first.residency, 'Unloaded');
    assert.equal(first.runtimes[0].state, 'Missing');
    assert.equal(first.models[0].state, 'Missing');
    assert.deepEqual(first.recoveryItems, [
      { managed: false, deletable: false, recoveryLabel: 'Unmanaged Local Whisper data requires manual review' },
    ]);
  });

  it('requires exact manifest and file identity for Installed and reports every mismatch as Corrupt', () => {
    const catalog = loadCatalog();
    const runtimeKey = getLocalWhisperRuntimeIdentityKey(catalog.payload.runtimes[0].identity);
    const modelKey = getLocalWhisperModelIdentityKey(catalog.payload.models[0].identity);
    const evidence = new RecordingEvidence();
    evidence.runtime.set(runtimeKey, installedRuntimeEvidence(catalog));
    evidence.model.set(modelKey, installedModelEvidence(catalog));
    const repository = new LocalWhisperInventoryRepository();

    const installed = repository.reconstruct({ catalog, evidence });
    assert.equal(installed.runtimes[0].state, 'Installed');
    assert.equal(installed.models[0].state, 'Installed');

    const corruptModel = installedModelEvidence(catalog);
    assert.equal(corruptModel.kind, 'installed');
    if (corruptModel.kind === 'installed') {
      evidence.model.set(modelKey, {
        ...corruptModel,
        files: [{ ...corruptModel.files[0], sizeBytes: corruptModel.files[0].sizeBytes + 1 }],
      });
    }
    evidence.runtime.set(runtimeKey, {
      ...installedRuntimeEvidence(catalog),
      manifestIdentityKey: 'another-runtime',
    } as LocalWhisperManagedArtifactEvidence);

    const corrupt = repository.reconstruct({ catalog, evidence });
    assert.equal(corrupt.runtimes[0].state, 'Corrupt');
    assert.equal(corrupt.models[0].state, 'Corrupt');
  });

  it('keeps staging states non-executable and lets an exact denylist override valid files', () => {
    for (const state of ['Downloading', 'Resumable', 'Verifying', 'Installing'] as const) {
      const catalog = loadCatalog();
      const evidence = new RecordingEvidence();
      evidence.runtime.set(getLocalWhisperRuntimeIdentityKey(catalog.payload.runtimes[0].identity), {
        kind: 'staging',
        state,
        safelyResumable: state === 'Resumable',
        safelyRemovable: true,
      });
      const snapshot = new LocalWhisperInventoryRepository().reconstruct({ catalog, evidence });
      assert.equal(snapshot.runtimes[0].state, state);
      assert.equal(snapshot.runtimes[0].residency, 'Unloaded');
      assert.deepEqual(snapshot.runtimes[0].stagingRecovery, {
        canResume: state === 'Resumable',
        canRemove: true,
      });
    }

    const resumableCatalog = loadCatalog();
    const unsafeResumeEvidence = new RecordingEvidence();
    unsafeResumeEvidence.runtime.set(getLocalWhisperRuntimeIdentityKey(resumableCatalog.payload.runtimes[0].identity), {
      kind: 'staging',
      state: 'Resumable',
      safelyResumable: false,
      safelyRemovable: true,
    });
    const unsafeResume = new LocalWhisperInventoryRepository().reconstruct({
      catalog: resumableCatalog,
      evidence: unsafeResumeEvidence,
    }).runtimes[0];
    assert.equal(unsafeResume.state, 'Failed');
    assert.deepEqual(unsafeResume.stagingRecovery, { canResume: false, canRemove: true });

    const payload = structuredClone(createFixtureCatalogPayload());
    (payload.models[0] as Mutable<LocalWhisperCatalogModelEntry>).recommended = false;
    (payload.denylist.models as LocalWhisperModelIdentity[]).push(structuredClone(payload.models[0].identity));
    const blockedCatalog = loadCatalog(payload);
    const blockedEvidence = new RecordingEvidence();
    blockedEvidence.model.set(
      getLocalWhisperModelIdentityKey(blockedCatalog.payload.models[0].identity),
      installedModelEvidence(blockedCatalog),
    );

    const blocked = new LocalWhisperInventoryRepository().reconstruct({
      catalog: blockedCatalog,
      evidence: blockedEvidence,
    });
    assert.equal(blocked.models[0].state, 'Blocked');
  });

  it('derives update availability without mutating the selected immutable revisions', () => {
    const payload: LocalWhisperCatalogPayload = structuredClone(createFixtureCatalogPayload());
    (payload.runtimes[0] as Mutable<LocalWhisperCatalogRuntimeEntry>).recommended = false;
    const nextRuntime = structuredClone(payload.runtimes[0]) as Mutable<LocalWhisperCatalogRuntimeEntry>;
    nextRuntime.recommended = true;
    const nextRuntimeIdentity = nextRuntime.identity as Mutable<LocalWhisperCatalogRuntimeEntry['identity']>;
    nextRuntimeIdentity.packRevision = toLocalWhisperRevisionId('whisper-cpp-cpu-pack-v2')!;
    nextRuntimeIdentity.buildRevision = toLocalWhisperRevisionId('whisper-cpp-build-v2')!;
    nextRuntimeIdentity.archiveSha256 = 'd'.repeat(64);
    nextRuntimeIdentity.archiveSignature = Buffer.from('next runtime signature').toString('base64');
    (payload.runtimes as LocalWhisperCatalogRuntimeEntry[]).push(nextRuntime);

    (payload.models[0] as Mutable<LocalWhisperCatalogModelEntry>).recommended = false;
    const nextModel = structuredClone(payload.models[0]) as Mutable<LocalWhisperCatalogModelEntry>;
    nextModel.recommended = true;
    (nextModel.identity as Mutable<LocalWhisperModelIdentity>).artifactRevision =
      toLocalWhisperRevisionId('base-ggml-v2')!;
    const nextModelFile = nextModel.expectedFiles[0] as Mutable<(typeof nextModel.expectedFiles)[number]>;
    nextModelFile.fileId = toLocalWhisperArtifactId('base-model-data-v2')!;
    nextModelFile.sha256 = 'e'.repeat(64);
    (payload.models as LocalWhisperCatalogModelEntry[]).push(nextModel);
    const nextEstimate = structuredClone(payload.memoryEstimates[0]) as Mutable<LocalWhisperMemoryEstimateRecord>;
    nextEstimate.model = structuredClone(nextModel.identity);
    (payload.memoryEstimates as LocalWhisperMemoryEstimateRecord[]).push(nextEstimate);
    const catalog = loadCatalog(payload);
    const evidence = new RecordingEvidence();
    evidence.runtime.set(
      getLocalWhisperRuntimeIdentityKey(catalog.payload.runtimes[0].identity),
      installedRuntimeEvidence(catalog),
    );
    evidence.model.set(
      getLocalWhisperModelIdentityKey(catalog.payload.models[0].identity),
      installedModelEvidence(catalog),
    );

    const snapshot = new LocalWhisperInventoryRepository().reconstruct({ catalog, evidence });

    assert.equal(snapshot.runtimes[0].packRevision, 'whisper-cpp-cpu-pack-v1');
    assert.equal(snapshot.runtimes[0].updateAvailable, true);
    assert.equal(snapshot.models[0].artifactRevision, 'base-ggml-v1');
    assert.equal(snapshot.models[0].updateAvailable, true);
  });

  it('projects only an exact selected estimate and keeps a matching qualified peak separate', () => {
    const catalog = loadCatalog();
    const evidence = new RecordingEvidence();
    const estimate = catalog.payload.memoryEstimates[0];
    const selected = {
      target: estimate.target,
      backend: estimate.backend,
      runtimePackRevision: estimate.runtimePackRevision,
      model: estimate.model,
      precision: estimate.precision,
    };
    const repository = new LocalWhisperInventoryRepository();

    const matched = repository.reconstruct({
      catalog,
      evidence,
      selectedConfiguration: selected,
      qualifiedCapabilityFingerprint: 'fixture-capability-fingerprint',
    });
    assert.equal(matched.selectedMemoryEstimate?.estimatedPeakRamBytes, 2_000_000_000);
    assert.equal(matched.qualifiedMemoryPeak?.measuredPeakRamBytes, 1_900_000_000);
    assert.equal('capabilityFingerprint' in (matched.qualifiedMemoryPeak ?? {}), false);

    const stale = repository.reconstruct({
      catalog,
      evidence,
      selectedConfiguration: { ...selected, runtimePackRevision: toLocalWhisperRevisionId('stale-runtime')! },
      qualifiedCapabilityFingerprint: 'fixture-capability-fingerprint',
    });
    assert.equal(stale.selectedMemoryEstimate, null);
    assert.equal(stale.qualifiedMemoryPeak, null);
  });
});
