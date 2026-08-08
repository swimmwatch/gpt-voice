import type {
  LocalWhisperArtifactId,
  LocalWhisperArtifactSetupState,
  LocalWhisperFailureCode,
  LocalWhisperPublicSettings,
  LocalWhisperSettingsCommand,
} from '@shared/localWhisper';

import type {
  ArtifactInventoryPort,
  LocalWhisperArtifactDownloadRequest,
  LocalWhisperArtifactOperationHandle,
  LocalWhisperArtifactOperationId,
  LocalWhisperArtifactOperationResult,
  LocalWhisperArtifactRemoveRequest,
} from '../artifacts/ArtifactLifecycleTypes';
import type { LocalWhisperAuthenticatedCatalog } from '../catalog/LocalWhisperCatalogTypes';
import {
  getLocalWhisperModelIdentityKey,
  getLocalWhisperRuntimeIdentityKey,
} from '../catalog/LocalWhisperCatalogTypes';
import type {
  LocalWhisperArtifactRemovalCommand,
  LocalWhisperArtifactRemovalResult,
  LocalWhisperCoordinatorArtifactPort,
} from '../coordinator/LocalWhisperCoordinatorTypes';
import type { ManagedArtifactRemovalClearance } from '../filesystem/ManagedArtifactRemovalClearance';
import {
  createManagedModelDescriptor,
  createManagedRuntimeDescriptor,
  type ManagedArtifactDescriptor,
} from '../filesystem/ManagedArtifactStore';
import {
  LocalWhisperInventoryRepository,
  type LocalWhisperInventorySnapshot,
  type LocalWhisperManagedStorageEvidencePort,
} from '../inventory/LocalWhisperInventoryRepository';
import type { LocalWhisperArtifactCommandPort } from '../ipc/LocalWhisperIpcController';

export interface LocalWhisperProductionArtifactStorePort {
  buildEvidenceSnapshot(catalog: LocalWhisperAuthenticatedCatalog): Promise<LocalWhisperManagedStorageEvidencePort>;
}

export interface LocalWhisperProductionRemovalClearancePort {
  issue(artifactId: LocalWhisperArtifactId): ManagedArtifactRemovalClearance;
}

export interface LocalWhisperProductionArtifactInventoryDependencies {
  readonly catalog: LocalWhisperAuthenticatedCatalog;
  readonly initialInventory: LocalWhisperInventorySnapshot;
  readonly inventoryRepository: LocalWhisperInventoryRepository;
  readonly onInventoryChanged: (inventory: LocalWhisperInventorySnapshot) => void;
  readonly store: LocalWhisperProductionArtifactStorePort;
}

/** Owns inventory revisions shared by artifact commands, coordinator epochs, and renderer facts. */
export class LocalWhisperProductionArtifactInventory implements ArtifactInventoryPort {
  private inventoryValue: LocalWhisperInventorySnapshot;
  private readonly listeners = new Set<(inventory: LocalWhisperInventorySnapshot) => void>();
  private refreshTail: Promise<void> = Promise.resolve();

  public constructor(private readonly dependencies: LocalWhisperProductionArtifactInventoryDependencies) {
    this.inventoryValue = dependencies.initialInventory;
  }

  public get snapshot(): LocalWhisperInventorySnapshot {
    return this.inventoryValue;
  }

  public get installedBytes(): number {
    return [...this.inventoryValue.runtimes, ...this.inventoryValue.models]
      .filter(({ state }) => state === 'Installed')
      .reduce((total, item) => total + item.installedSizeBytes, 0);
  }

  public getRevision(): number {
    return this.inventoryValue.revision;
  }

  public subscribe(listener: (inventory: LocalWhisperInventorySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public refresh(catalog: LocalWhisperAuthenticatedCatalog): Promise<number> {
    if (catalog !== this.dependencies.catalog) throw new Error('Local Whisper catalog authority changed');
    const refresh = this.refreshTail.then(async () => await this.refreshNow(catalog));
    this.refreshTail = refresh.then(
      () => undefined,
      () => undefined,
    );
    return refresh;
  }

  private async refreshNow(catalog: LocalWhisperAuthenticatedCatalog): Promise<number> {
    const next = this.dependencies.inventoryRepository.reconstruct({
      catalog,
      evidence: await this.dependencies.store.buildEvidenceSnapshot(catalog),
    });
    this.inventoryValue = next;
    this.dependencies.onInventoryChanged(next);
    for (const listener of this.listeners) listener(next);
    return next.revision;
  }
}

export interface LocalWhisperProductionArtifactPortDependencies {
  readonly catalog: LocalWhisperAuthenticatedCatalog;
  readonly canAcquire: (artifactId: LocalWhisperArtifactId) => boolean;
  readonly clearance: LocalWhisperProductionRemovalClearancePort;
  readonly inventory: LocalWhisperProductionArtifactInventory;
  readonly service: LocalWhisperProductionArtifactLifecyclePort;
}

export interface LocalWhisperProductionArtifactLifecyclePort {
  startDownload(request: LocalWhisperArtifactDownloadRequest): LocalWhisperArtifactOperationHandle;
  resume(request: LocalWhisperArtifactDownloadRequest): LocalWhisperArtifactOperationHandle;
  retry(request: LocalWhisperArtifactDownloadRequest): LocalWhisperArtifactOperationHandle;
  update(request: LocalWhisperArtifactDownloadRequest): LocalWhisperArtifactOperationHandle;
  cancel(operationId: LocalWhisperArtifactOperationId): boolean;
  remove(request: LocalWhisperArtifactRemoveRequest): Promise<LocalWhisperArtifactOperationResult>;
}

export function selectedArtifactSetup(
  settings: LocalWhisperPublicSettings,
  inventory: LocalWhisperInventorySnapshot,
): { readonly runtime: LocalWhisperArtifactSetupState; readonly model: LocalWhisperArtifactSetupState } {
  const runtime = inventory.runtimes.find(
    (item) =>
      item.engine === settings.engine &&
      item.target === settings.execution.target &&
      item.backend === settings.execution.backend &&
      item.packRevision === settings.runtimeRevision,
  );
  const model = inventory.models.find(
    (item) =>
      item.engine === settings.engine &&
      item.family === settings.model.family &&
      item.artifactRevision === settings.model.revision &&
      item.variant === settings.model.variant,
  );
  return Object.freeze({ runtime: runtime?.state ?? 'Missing', model: model?.state ?? 'Missing' });
}

type LifecycleCommand = Extract<
  LocalWhisperSettingsCommand,
  { readonly kind: 'download' | 'resume' | 'retry' | 'update' | 'cancelArtifact' }
>;

/** Composes all production artifact commands without exposing URL, path, or trust authority to IPC. */
export class LocalWhisperProductionArtifactPort
  implements LocalWhisperCoordinatorArtifactPort, LocalWhisperArtifactCommandPort
{
  public constructor(private readonly dependencies: LocalWhisperProductionArtifactPortDependencies) {}

  public get inventory(): LocalWhisperInventorySnapshot {
    return this.dependencies.inventory.snapshot;
  }

  public async execute(command: LifecycleCommand): Promise<{
    readonly success: boolean;
    readonly operationId?: string;
    readonly code?: LocalWhisperFailureCode;
  }> {
    if (command.kind === 'cancelArtifact') {
      return this.dependencies.service.cancel(command.operationId)
        ? Object.freeze({ success: true })
        : Object.freeze({ success: false, code: 'OPERATION_CONFLICT' });
    }
    if (command.expectedInventoryEpoch !== this.dependencies.inventory.getRevision()) {
      return Object.freeze({ success: false, code: 'STALE_CONFIGURATION' });
    }
    const artifactId =
      command.kind === 'update' ? this.resolveUpdate(command.artifactKind, command.artifactId) : command.artifactId;
    if (!artifactId || !this.dependencies.canAcquire(artifactId)) {
      return Object.freeze({ success: false, code: 'INVALID_SETTINGS' });
    }
    const request = Object.freeze({ artifactId, expectedInventoryRevision: command.expectedInventoryEpoch });
    const handle =
      command.kind === 'download'
        ? this.dependencies.service.startDownload(request)
        : command.kind === 'resume'
          ? this.dependencies.service.resume(request)
          : command.kind === 'retry'
            ? this.dependencies.service.retry(request)
            : this.dependencies.service.update(request);
    void handle.completion.catch(() => undefined);
    return Object.freeze({ success: true, operationId: handle.operationId });
  }

  public async removeSelected(command: LocalWhisperArtifactRemovalCommand): Promise<LocalWhisperArtifactRemovalResult> {
    if (!command.request.confirmed) return Object.freeze({ success: false, code: 'INVALID_SETTINGS' });
    if (
      command.request.expectedConfigurationEpoch !== command.epochs.configuration ||
      command.request.expectedInventoryEpoch !== command.epochs.inventory ||
      command.epochs.inventory !== this.dependencies.inventory.getRevision()
    ) {
      return Object.freeze({ success: false, code: 'STALE_CONFIGURATION' });
    }
    if (command.signal.aborted) return Object.freeze({ success: false, code: 'CANCELLED' });
    const descriptor = this.resolveDescriptor(command.request.kind, command.request.artifactId);
    if (!descriptor) return Object.freeze({ success: false, code: 'INVALID_SETTINGS' });
    const result = await this.dependencies.service.remove({
      artifactId: descriptor.artifactId,
      expectedInventoryRevision: command.request.expectedInventoryEpoch,
      clearance: this.dependencies.clearance.issue(descriptor.artifactId),
    });
    if (!result.success) return Object.freeze({ success: false, code: result.error.code });
    const setup = selectedArtifactSetup(command.settings, this.dependencies.inventory.snapshot);
    return Object.freeze({
      success: true,
      inventoryEpoch: result.inventoryRevision,
      runtimeSetup: setup.runtime,
      modelSetup: setup.model,
    });
  }

  private resolveUpdate(kind: 'runtime' | 'model', artifactId: LocalWhisperArtifactId): LocalWhisperArtifactId | null {
    if (kind === 'runtime') {
      const current = this.dependencies.catalog.payload.runtimes.find(
        (entry) => createManagedRuntimeDescriptor(this.dependencies.catalog, entry).artifactId === artifactId,
      );
      if (!current) return null;
      const candidate = this.dependencies.catalog.payload.runtimes.find(
        (entry) =>
          entry.recommended &&
          entry.identity.engine === current.identity.engine &&
          entry.identity.platform === current.identity.platform &&
          entry.identity.architecture === current.identity.architecture &&
          entry.identity.target === current.identity.target &&
          entry.identity.backend === current.identity.backend &&
          getLocalWhisperRuntimeIdentityKey(entry.identity) !== getLocalWhisperRuntimeIdentityKey(current.identity),
      );
      return candidate ? createManagedRuntimeDescriptor(this.dependencies.catalog, candidate).artifactId : null;
    }
    const current = this.dependencies.catalog.payload.models.find(
      (entry) => createManagedModelDescriptor(this.dependencies.catalog, entry).artifactId === artifactId,
    );
    if (!current) return null;
    const candidate = this.dependencies.catalog.payload.models.find(
      (entry) =>
        entry.recommended &&
        entry.identity.engine === current.identity.engine &&
        entry.identity.logicalModel === current.identity.logicalModel &&
        entry.identity.variant === current.identity.variant &&
        getLocalWhisperModelIdentityKey(entry.identity) !== getLocalWhisperModelIdentityKey(current.identity),
    );
    return candidate ? createManagedModelDescriptor(this.dependencies.catalog, candidate).artifactId : null;
  }

  private resolveDescriptor(
    kind: 'runtime' | 'model',
    artifactId: LocalWhisperArtifactId,
  ): ManagedArtifactDescriptor | null {
    const descriptors =
      kind === 'runtime'
        ? this.dependencies.catalog.payload.runtimes.map((entry) =>
            createManagedRuntimeDescriptor(this.dependencies.catalog, entry),
          )
        : this.dependencies.catalog.payload.models.map((entry) =>
            createManagedModelDescriptor(this.dependencies.catalog, entry),
          );
    return descriptors.find((descriptor) => descriptor.artifactId === artifactId) ?? null;
  }
}
