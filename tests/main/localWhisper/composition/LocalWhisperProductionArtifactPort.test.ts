/* eslint-disable max-classes-per-file -- Focused fakes model artifact storage and evidence state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LocalWhisperAuthenticatedCatalog } from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  LocalWhisperProductionArtifactInventory,
  LocalWhisperProductionArtifactPort,
  type LocalWhisperProductionArtifactLifecyclePort,
  type LocalWhisperProductionArtifactStorePort,
} from '@main/localWhisper/composition/LocalWhisperProductionArtifactPort';
import type { LocalWhisperArtifactRemovalCommand } from '@main/localWhisper/coordinator/LocalWhisperCoordinatorTypes';
import type { ManagedArtifactRemovalClearance } from '@main/localWhisper/filesystem/ManagedArtifactRemovalClearance';
import { ManagedArtifactRemovalClearanceIssuer } from '@main/localWhisper/filesystem/ManagedArtifactRemovalClearanceIssuer';
import { ManagedArtifactStoreError } from '@main/localWhisper/filesystem/ManagedArtifactStoreError';
import {
  createManagedModelDescriptor,
  createManagedRuntimeDescriptor,
  type ManagedArtifactDescriptor,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';
import type {
  LocalWhisperManagedArtifactEvidence,
  LocalWhisperManagedStorageEvidencePort,
} from '@main/localWhisper/inventory/LocalWhisperInventoryRepository';
import { LocalWhisperInventoryRepository } from '@main/localWhisper/inventory/LocalWhisperInventoryRepository';
import {
  createLocalWhisperRendererSafeFailure,
  type LocalWhisperArtifactId,
  type LocalWhisperPublicSettings,
} from '@shared/localWhisper';
import { createFixtureCatalogPayload } from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

function catalog(): LocalWhisperAuthenticatedCatalog {
  const payload = createFixtureCatalogPayload();
  return Object.freeze({
    signingKeyId: payload.runtimes[0].identity.signingKeyId,
    payload,
    isRuntimeDenylisted: () => false,
    isModelDenylisted: () => false,
  });
}

function installedEvidence(
  manifestIdentityKey: string,
  expectedFiles: readonly {
    readonly fileId: LocalWhisperArtifactId;
    readonly kind: 'executable' | 'library' | 'data' | 'config' | 'tokenizer' | 'license' | 'notice';
    readonly mode: number;
    readonly sizeBytes: number;
    readonly sha256: string;
  }[],
): LocalWhisperManagedArtifactEvidence {
  return Object.freeze({
    kind: 'installed',
    manifestIdentityKey,
    manifestValid: true,
    files: Object.freeze(expectedFiles.map((file) => Object.freeze({ ...file }))),
  });
}

class Evidence implements LocalWhisperManagedStorageEvidencePort {
  public constructor(
    private readonly catalogValue: LocalWhisperAuthenticatedCatalog,
    private readonly missingKind: 'runtime' | 'model' | null = null,
  ) {}

  public getRuntimeEvidence(identityKey: string): LocalWhisperManagedArtifactEvidence {
    const runtime = this.catalogValue.payload.runtimes[0];
    return this.missingKind === 'runtime'
      ? Object.freeze({ kind: 'missing' })
      : installedEvidence(identityKey, runtime.identity.expectedFiles);
  }

  public getModelEvidence(identityKey: string): LocalWhisperManagedArtifactEvidence {
    const model = this.catalogValue.payload.models[0];
    return this.missingKind === 'model'
      ? Object.freeze({ kind: 'missing' })
      : installedEvidence(identityKey, model.expectedFiles);
  }

  public listUnmanagedEvidence(): readonly [] {
    return Object.freeze([]);
  }
}

class ArtifactStore implements LocalWhisperProductionArtifactStorePort {
  public readonly deletions: ManagedArtifactDescriptor[] = [];

  public constructor(
    private readonly evidence: LocalWhisperManagedStorageEvidencePort,
    private readonly error: Error | null = null,
  ) {}

  public deleteArtifact(
    descriptor: ManagedArtifactDescriptor,
    clearance: ManagedArtifactRemovalClearance,
  ): Promise<void> {
    assert.equal(clearance.authorizes(descriptor.artifactId), true);
    this.deletions.push(descriptor);
    return this.error === null ? Promise.resolve() : Promise.reject(this.error);
  }

  public buildEvidenceSnapshot(): Promise<LocalWhisperManagedStorageEvidencePort> {
    return Promise.resolve(this.evidence);
  }
}

class ConcurrentEvidenceStore implements LocalWhisperProductionArtifactStorePort {
  public active = 0;
  public maximumActive = 0;

  public constructor(private readonly evidence: LocalWhisperManagedStorageEvidencePort) {}

  public deleteArtifact(): Promise<void> {
    return Promise.reject(new Error('Deletion is not exercised by this refresh harness'));
  }

  public async buildEvidenceSnapshot(): Promise<LocalWhisperManagedStorageEvidencePort> {
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    await new Promise<void>((resolve) => setImmediate(resolve));
    this.active -= 1;
    return this.evidence;
  }
}

function settings(catalogValue: LocalWhisperAuthenticatedCatalog): LocalWhisperPublicSettings {
  const runtime = catalogValue.payload.runtimes[0].identity;
  const model = catalogValue.payload.models[0].identity;
  return Object.freeze({
    schemaVersion: 1,
    engine: 'whisperCpp',
    runtimeRevision: runtime.packRevision,
    model: Object.freeze({ family: model.logicalModel, revision: model.artifactRevision, variant: model.variant }),
    language: 'auto',
    decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
    execution: Object.freeze({ target: 'cpu', backend: 'cpu', cpuThreads: 'auto' }),
  });
}

function command(
  artifactId: LocalWhisperArtifactId,
  kind: 'runtime' | 'model',
  inventoryEpoch: number,
  settingsValue: LocalWhisperPublicSettings,
  overrides: Partial<LocalWhisperArtifactRemovalCommand['request']> = {},
  signal: AbortSignal = new AbortController().signal,
): LocalWhisperArtifactRemovalCommand {
  return Object.freeze({
    request: Object.freeze({
      kind,
      artifactId,
      confirmed: true,
      expectedConfigurationEpoch: 3,
      expectedInventoryEpoch: inventoryEpoch,
      ...overrides,
    }),
    settings: settingsValue,
    epochs: Object.freeze({
      configuration: 3,
      inventory: inventoryEpoch,
      provider: 1,
      topology: 1,
      capability: 1,
      worker: 1,
    }),
    requestId: 'production-artifact-removal-request',
    signal,
  });
}

function harness(error: Error | null = null, cancelResult = false, canAcquire: () => boolean = () => true) {
  const catalogValue = catalog();
  const inventoryRepository = new LocalWhisperInventoryRepository();
  const initialInventory = inventoryRepository.reconstruct({
    catalog: catalogValue,
    evidence: new Evidence(catalogValue),
  });
  const store = new ArtifactStore(new Evidence(catalogValue, 'model'), error);
  const updates: number[] = [];
  const inventory = new LocalWhisperProductionArtifactInventory({
    catalog: catalogValue,
    initialInventory,
    inventoryRepository,
    onInventoryChanged: (next) => updates.push(next.revision),
    store,
  });
  const unsupportedTransfer = (): never => {
    throw new Error('Transfer is not exercised by this removal harness');
  };
  const cancelCalls: string[] = [];
  const service: LocalWhisperProductionArtifactLifecyclePort = {
    startDownload: unsupportedTransfer,
    resume: unsupportedTransfer,
    retry: unsupportedTransfer,
    update: unsupportedTransfer,
    cancel: (operationId) => {
      cancelCalls.push(operationId);
      return cancelResult;
    },
    remove: async (request) => {
      const descriptor = [
        ...catalogValue.payload.runtimes.map((entry) => createManagedRuntimeDescriptor(catalogValue, entry)),
        ...catalogValue.payload.models.map((entry) => createManagedModelDescriptor(catalogValue, entry)),
      ].find((candidate) => candidate.artifactId === request.artifactId);
      assert.ok(descriptor);
      try {
        await store.deleteArtifact(descriptor, request.clearance);
        const inventoryRevision = await inventory.refresh(catalogValue);
        return {
          success: true as const,
          operationId: 'production-remove-operation-0001',
          artifactId: request.artifactId,
          state: 'Missing' as const,
          inventoryRevision,
        };
      } catch (caught) {
        return {
          success: false as const,
          operationId: 'production-remove-operation-0001',
          artifactId: request.artifactId,
          state: 'Failed' as const,
          error: createLocalWhisperRendererSafeFailure(
            caught instanceof ManagedArtifactStoreError && caught.code === 'OPERATION_CONFLICT'
              ? 'OPERATION_CONFLICT'
              : 'DELETE_FAILED',
          ),
        };
      }
    },
  };
  const port = new LocalWhisperProductionArtifactPort({
    catalog: catalogValue,
    canAcquire: () => canAcquire(),
    clearance: new ManagedArtifactRemovalClearanceIssuer(),
    inventory,
    service,
  });
  return { cancelCalls, catalogValue, initialInventory, port, store, updates };
}

describe('LocalWhisperProductionArtifactPort', () => {
  it('serializes shared evidence refresh while parallel artifact transfers finish', async () => {
    const catalogValue = catalog();
    const repository = new LocalWhisperInventoryRepository();
    const evidence = new Evidence(catalogValue);
    const store = new ConcurrentEvidenceStore(evidence);
    const inventory = new LocalWhisperProductionArtifactInventory({
      catalog: catalogValue,
      initialInventory: repository.reconstruct({ catalog: catalogValue, evidence }),
      inventoryRepository: repository,
      onInventoryChanged: () => undefined,
      store,
    });

    await Promise.all([inventory.refresh(catalogValue), inventory.refresh(catalogValue)]);
    assert.equal(store.maximumActive, 1);
  });

  it('cancels an exact active operation without coupling to a changing inventory epoch', async () => {
    const values = harness(null, true);
    assert.deepEqual(await values.port.execute({ kind: 'cancelArtifact', operationId: 'operation-id-0001' }), {
      success: true,
    });
    assert.deepEqual(values.cancelCalls, ['operation-id-0001']);
  });

  it('rejects forged artifact acquisition before creating a transfer operation', async () => {
    const values = harness(null, false, () => false);
    const descriptor = createManagedRuntimeDescriptor(values.catalogValue, values.catalogValue.payload.runtimes[0]);

    assert.deepEqual(
      await values.port.execute({
        kind: 'download',
        artifactKind: 'runtime',
        artifactId: descriptor.artifactId,
        artifactRevision: values.catalogValue.payload.runtimes[0]!.identity.packRevision,
        expectedSnapshotRevision: 1,
        expectedConfigurationEpoch: 1,
        expectedInventoryEpoch: values.initialInventory.revision,
      }),
      { success: false, code: 'INVALID_SETTINGS' },
    );
  });

  it('deletes one exact catalog model and atomically publishes reconstructed inventory', async () => {
    const values = harness();
    const descriptor = createManagedModelDescriptor(values.catalogValue, values.catalogValue.payload.models[0]);
    const result = await values.port.removeSelected(
      command(descriptor.artifactId, 'model', values.initialInventory.revision, settings(values.catalogValue)),
    );

    assert.deepEqual(result, {
      success: true,
      inventoryEpoch: values.initialInventory.revision + 1,
      runtimeSetup: 'Installed',
      modelSetup: 'Missing',
    });
    assert.equal(values.store.deletions[0]?.artifactId, descriptor.artifactId);
    assert.deepEqual(values.updates, [values.initialInventory.revision + 1]);
    assert.equal(values.port.inventory.models[0]?.state, 'Missing');
  });

  it('rejects unconfirmed, stale, cancelled, and kind-confused requests before deletion', async () => {
    const values = harness();
    const modelDescriptor = createManagedModelDescriptor(values.catalogValue, values.catalogValue.payload.models[0]);
    const runtimeDescriptor = createManagedRuntimeDescriptor(
      values.catalogValue,
      values.catalogValue.payload.runtimes[0],
    );
    const settingsValue = settings(values.catalogValue);
    const aborted = new AbortController();
    aborted.abort();

    assert.deepEqual(
      await values.port.removeSelected(
        command(modelDescriptor.artifactId, 'model', values.initialInventory.revision, settingsValue, {
          confirmed: false,
        }),
      ),
      { success: false, code: 'INVALID_SETTINGS' },
    );
    assert.deepEqual(
      await values.port.removeSelected(
        command(modelDescriptor.artifactId, 'model', values.initialInventory.revision, settingsValue, {
          expectedInventoryEpoch: values.initialInventory.revision + 1,
        }),
      ),
      { success: false, code: 'STALE_CONFIGURATION' },
    );
    assert.deepEqual(
      await values.port.removeSelected(
        command(
          modelDescriptor.artifactId,
          'model',
          values.initialInventory.revision,
          settingsValue,
          {},
          aborted.signal,
        ),
      ),
      { success: false, code: 'CANCELLED' },
    );
    assert.deepEqual(
      await values.port.removeSelected(
        command(runtimeDescriptor.artifactId, 'model', values.initialInventory.revision, settingsValue),
      ),
      { success: false, code: 'INVALID_SETTINGS' },
    );
    assert.equal(values.store.deletions.length, 0);
  });

  it('maps stable store conflicts without exposing native errors or mutating inventory', async () => {
    const values = harness(new ManagedArtifactStoreError('OPERATION_CONFLICT'));
    const descriptor = createManagedModelDescriptor(values.catalogValue, values.catalogValue.payload.models[0]);
    const result = await values.port.removeSelected(
      command(descriptor.artifactId, 'model', values.initialInventory.revision, settings(values.catalogValue)),
    );

    assert.deepEqual(result, { success: false, code: 'OPERATION_CONFLICT' });
    assert.equal(values.port.inventory.revision, values.initialInventory.revision);
    assert.deepEqual(values.updates, []);
  });
});
