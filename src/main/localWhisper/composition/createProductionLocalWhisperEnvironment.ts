import { createHash, randomUUID } from 'node:crypto';
import type { spawn } from 'node:child_process';
import type fs from 'node:fs';
import { join } from 'node:path';

import {
  createNeverConfiguredLocalWhisperSettings,
  getLocalWhisperMemoryConfigurationKey,
  isLocalWhisperGpuBackend,
  isValidLocalWhisperPublicSettings,
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_MAX_LOGICAL_PROCESSOR_COUNT,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  resolveLocalWhisperCpuThreads,
  validateLocalWhisperSettings,
  type LocalWhisperArtifactAction,
  type LocalWhisperArtifactProgress,
  type LocalWhisperArtifactSetupState,
  type LocalWhisperBackend,
  type LocalWhisperCpuThreads,
  type LocalWhisperFailureCode,
  type LocalWhisperMemoryEstimateRecord,
  type LocalWhisperDeviceDescriptor,
  type LocalWhisperPlatform,
  type LocalWhisperPublicSettings,
  type LocalWhisperRendererArtifact,
  type LocalWhisperRendererOption,
  type LocalWhisperRendererOptionCompatibility,
  type LocalWhisperSettings,
  type LocalWhisperSettingsValidationContext,
  type LocalWhisperSupportTier,
} from '@shared/localWhisper';

import { LocalWhisperCapabilityService } from '../capability/LocalWhisperCapabilityService';
import {
  NvidiaCudaRuntimeApplicability,
  type NvidiaCudaRuntimeApplicabilitySnapshot,
} from '../capability/NvidiaCudaRuntimeApplicability';
import { LocalWhisperResourcePolicy } from '../capability/LocalWhisperResourcePolicy';
import { SelectedDeviceVramAvailability } from '../capability/SelectedDeviceVramAvailability';
import type { NvidiaHostInventoryResult } from '../capability/NvidiaSmiHostInventory';
import { ArtifactCatalogResolver } from '../artifacts/ArtifactCatalogResolver';
import { ArtifactProgressStore } from '../artifacts/ArtifactProgressStore';
import { ArtifactTransferJournalRepository } from '../artifacts/ArtifactTransferJournalRepository';
import { ArtifactTransferQueue } from '../artifacts/ArtifactTransferQueue';
import { CatalogArtifactSignatureVerifier } from '../artifacts/CatalogArtifactSignatureVerifier';
import { CatalogHttpTransport } from '../artifacts/CatalogHttpTransport';
import { FileArtifactTransferJournalStore } from '../artifacts/FileArtifactTransferJournalStore';
import { FileBackedArtifactStreamingWorker } from '../artifacts/FileBackedArtifactStreamingWorker';
import { LocalWhisperArtifactService } from '../artifacts/LocalWhisperArtifactService';
import { NodeArtifactDiskSpace } from '../artifacts/NodeArtifactDiskSpace';
import { NodeArtifactHttpClient } from '../artifacts/NodeArtifactHttpClient';
import type { ArtifactHttpClient } from '../artifacts/ArtifactLifecycleTypes';
import {
  PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,
  StreamingArtifactExtractor,
} from '../artifacts/StreamingArtifactExtractor';
import { StreamingArtifactVerifier } from '../artifacts/StreamingArtifactVerifier';
import type { LocalWhisperBackendProbeInput } from '../capability/LocalWhisperCapabilityAdapters';
import { LocalWhisperSupportPolicy } from '../capability/LocalWhisperSupportPolicy';
import { LocalWhisperCatalogRepository } from '../catalog/LocalWhisperCatalogRepository';
import {
  getLocalWhisperModelIdentityKey,
  getLocalWhisperRuntimeIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogPurpose,
  type LocalWhisperCatalogRuntimeEntry,
  type LocalWhisperCatalogTrustPolicy,
} from '../catalog/LocalWhisperCatalogTypes';
import {
  PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT,
  createPackagedLocalWhisperCatalogTrustPolicy,
} from '../catalog/LocalWhisperPackagedCatalog';
import type {
  LocalWhisperCoordinatorDependencies,
  LocalWhisperCoordinatorEpochs,
} from '../coordinator/LocalWhisperCoordinatorTypes';
import { LinuxManagedFilesystemAdapter } from '../filesystem/LinuxManagedFilesystemAdapter';
import { ManagedArtifactLockRepository } from '../filesystem/ManagedArtifactLockRepository';
import { ManagedArtifactPathResolver } from '../filesystem/ManagedArtifactPathResolver';
import {
  ManagedArtifactRemovalClearanceIssuer,
  ManagedArtifactStore,
  createManagedModelDescriptor,
  createManagedRuntimeDescriptor,
  type ManagedArtifactStagingCleanupFailure,
  type ManagedArtifactStagingCleanupStep,
  type ManagedArtifactStagingPromotionFailure,
} from '../filesystem/ManagedArtifactStore';
import { NativeManagedFilesystemGuardTransport } from '../filesystem/NativeManagedFilesystemGuardTransport';
import { WindowsManagedFilesystemAdapter } from '../filesystem/WindowsManagedFilesystemAdapter';
import {
  LocalWhisperInventoryRepository,
  type LocalWhisperInventorySnapshot,
} from '../inventory/LocalWhisperInventoryRepository';
import type { LocalWhisperSnapshotFacts } from '../ipc/LocalWhisperSnapshotService';
import type { DeferredLocalWhisperEnvironment } from '../ipc/createDeferredLocalWhisperEnvironment';
import { createDeferredLocalWhisperEnvironment } from '../ipc/createDeferredLocalWhisperEnvironment';
import { LocalWhisperPackagedResourceResolver } from '../packaging/LocalWhisperPackagedResourceResolver';
import { FileLocalWhisperDeviceIdentityStore } from '../deviceIdentity/FileLocalWhisperDeviceIdentityStore';
import { LocalWhisperDeviceIdentityRepository } from '../deviceIdentity/LocalWhisperDeviceIdentityRepository';
import {
  FileLocalWhisperPrivateJsonStore,
  LocalWhisperSettingsRepository,
  resolveLocalWhisperSettingsFile,
  type LocalWhisperSettingsSnapshot,
} from '../settings/LocalWhisperSettingsRepository';
import { LocalWhisperDynamicSnapshotFacts } from './LocalWhisperDynamicSnapshotFacts';
import { LocalWhisperDeviceTopologyAuthority } from './LocalWhisperDeviceTopologyAuthority';
import { LocalWhisperModelPathLoadAuthorityFactory } from './LocalWhisperModelPathLoadAuthorityFactory';
import {
  LocalWhisperProductionArtifactInventory,
  LocalWhisperProductionArtifactPort,
  selectedArtifactSetup,
} from './LocalWhisperProductionArtifactPort';
import { LocalWhisperRuntimeLaunchAuthorityFactory } from './LocalWhisperRuntimeLaunchAuthorityFactory';
import {
  LocalWhisperRuntimeRegistryDiscovery,
  LocalWhisperRuntimeRegistryDiscoveryError,
} from './LocalWhisperRuntimeRegistryDiscovery';
import { LinuxProcessGroupOwner } from '../supervisor/LinuxProcessGroupOwner';
import { WindowsJobObjectOwner } from '../supervisor/WindowsJobObjectOwner';
import { FileWorkerOwnershipRecordStore } from '../supervisor/WorkerOwnershipRecordRepository';
import {
  WorkerProcessOwnership,
  type LocalWhisperWorkerProcessLaunchEvent,
} from '../supervisor/WorkerProcessOwnership';
import { LocalWhisperWorkerLifecycle } from '../supervisor/LocalWhisperWorkerLifecycle';
import { LocalWhisperWorkerSupervisor } from '../supervisor/LocalWhisperWorkerSupervisor';
import { LocalWhisperWorkerTransport } from '../supervisor/LocalWhisperWorkerTransport';
import { NativeRuntimeLogRelay, NativeRuntimeLogStreamDecoder } from '../supervisor/NativeRuntimeLogStreamDecoder';
import { LocalWhisperProductionWorkerPort } from './LocalWhisperProductionWorkerPort';

type ProductionFileSystem = Pick<
  typeof fs,
  'chmodSync' | 'existsSync' | 'mkdirSync' | 'readFileSync' | 'renameSync' | 'rmSync' | 'unlinkSync' | 'writeFileSync'
>;

export interface LocalWhisperProductionEnvironmentDependencies {
  readonly appRevision: string;
  readonly architecture: string;
  readonly availableMemoryBytes: () => number;
  readonly availableVramBytes: (nativeIdentity: string) => Promise<number | null>;
  readonly configurationRoot: string;
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly fileSystem: ProductionFileSystem;
  readonly homeDirectory: () => string;
  readonly logicalProcessorCount: number;
  readonly nextRequestId: () => string;
  readonly nativeRuntimeLogRelay?: NativeRuntimeLogRelay;
  readonly now: () => number;
  readonly openPath: (path: string) => Promise<string>;
  readonly pid: number;
  readonly platform: NodeJS.Platform;
  readonly randomNonce: () => string;
  readonly randomBytes: (size: number) => Uint8Array;
  readonly readNvidiaInventory: () => Promise<NvidiaHostInventoryResult>;
  readonly readFile: (path: string) => Promise<Uint8Array>;
  readonly resourcesPath: string;
  readonly spawnProcess: typeof spawn;
  /** Accepted only by an explicitly qualification-purpose factory input. */
  readonly qualificationHooks?: {
    readonly artifactHttpClient?: ArtifactHttpClient;
    readonly onArtifactTransferFailure?: (
      event: Readonly<{
        readonly artifactId: string;
        readonly cleanupFailed: boolean;
        readonly primaryCode: LocalWhisperFailureCode;
      }>,
    ) => void;
    readonly onStagingCleanupStep?: (step: ManagedArtifactStagingCleanupStep) => void;
    readonly onStagingCleanupFailure?: (failure: ManagedArtifactStagingCleanupFailure) => void;
    readonly onStagingPromotionFailure?: (failure: ManagedArtifactStagingPromotionFailure) => void;
    readonly trustedCertificateAuthorities?: readonly string[];
    readonly onSessionProcessLaunched?: (event: LocalWhisperWorkerProcessLaunchEvent) => void;
    readonly onLoadStage?: (
      stage: import('./LocalWhisperProductionWorkerPort').LocalWhisperQualificationLoadStage,
    ) => void;
  };
}

export interface LocalWhisperProductionCatalogInput {
  /**
   * Production is the default and the only mode used by the packaged app.
   * Qualification must be selected explicitly by an isolated platform-qualification runner.
   */
  readonly activationPurpose?: Extract<LocalWhisperCatalogPurpose, 'production' | 'qualification'>;
  readonly document: Uint8Array;
  readonly trustPolicy: LocalWhisperCatalogTrustPolicy | null;
}

type LocalWhisperProductionEnvironment = DeferredLocalWhisperEnvironment;

type LocalWhisperStartupRuntimeInventoryItem = Pick<
  LocalWhisperInventorySnapshot['runtimes'][number],
  'architecture' | 'backend' | 'platform' | 'state' | 'target'
>;

interface LocalWhisperStartupDeviceInventory {
  readonly revision: number;
  readonly runtimes: readonly LocalWhisperStartupRuntimeInventoryItem[];
}

/** Restores GPU topology only when the current host already has an installed CUDA runtime. */
export async function restoreLocalWhisperStartupDeviceTopology(
  inventory: LocalWhisperStartupDeviceInventory,
  host: Pick<LocalWhisperSettingsValidationContext, 'architecture' | 'platform'>,
  worker: Pick<LocalWhisperProductionWorkerPort, 'refreshAvailableDevices'>,
): Promise<void> {
  const hasInstalledCudaRuntime = inventory.runtimes.some(
    ({ architecture: runtimeArchitecture, backend, platform: runtimePlatform, state, target }) =>
      runtimePlatform === host.platform &&
      runtimeArchitecture === host.architecture &&
      target === 'gpu' &&
      backend === 'cuda' &&
      state === 'Installed',
  );
  if (!hasInstalledCudaRuntime) return;
  await worker.refreshAvailableDevices(inventory.revision).catch(() => undefined);
}

function platform(value: NodeJS.Platform): LocalWhisperPlatform {
  return value === 'linux' || value === 'win32' || value === 'darwin' ? value : 'other';
}

function architecture(value: string): 'x64' | 'arm64' | 'other' {
  return value === 'x64' || value === 'arm64' ? value : 'other';
}

function actions(item: {
  readonly state: LocalWhisperArtifactSetupState;
  readonly updateAvailable: boolean;
}): readonly LocalWhisperArtifactAction[] {
  if (item.state === 'Missing') return Object.freeze(['download']);
  if (item.state === 'Resumable') return Object.freeze(['resume', 'retry']);
  if (item.state === 'Failed') return Object.freeze(['retry']);
  if (item.state === 'Downloading' || item.state === 'Verifying' || item.state === 'Installing') {
    return Object.freeze(['cancel']);
  }
  if (item.state === 'Installed') {
    return Object.freeze(item.updateAvailable ? ['update', 'remove'] : ['remove']);
  }
  if (item.state === 'Corrupt' || item.state === 'Blocked') return Object.freeze(['remove']);
  return Object.freeze([]);
}

function selectedRuntimeEntry(
  catalog: LocalWhisperAuthenticatedCatalog,
  settings: LocalWhisperSettings,
  applicability: Pick<NvidiaCudaRuntimeApplicability, 'supports'>,
  cuda: NvidiaCudaRuntimeApplicabilitySnapshot,
) {
  return catalog.payload.runtimes.find((entry) => {
    const { identity } = entry;
    if (identity.packRevision !== settings.runtimeRevision) return false;
    if (settings.execution.target === 'cpu') {
      return identity.target === 'cpu' && identity.backend === 'cpu';
    }
    return (
      identity.target === 'gpu' &&
      identity.backend === settings.execution.backend &&
      identity.backend === 'cuda' &&
      applicability.supports(cuda, entry, settings.execution.deviceId)
    );
  });
}

function hasRuntimeArtifactAccess(
  catalog: LocalWhisperAuthenticatedCatalog,
  entry: LocalWhisperCatalogRuntimeEntry,
  selectedRuntime: LocalWhisperCatalogRuntimeEntry | undefined,
  host: Pick<LocalWhisperSettingsValidationContext, 'architecture' | 'platform'>,
): boolean {
  return (
    entry === selectedRuntime ||
    (entry.identity.platform === host.platform &&
      entry.identity.architecture === host.architecture &&
      (catalog.payload.purpose === 'qualification' ||
        (entry.identity.target === 'cpu' && entry.identity.backend === 'cpu')))
  );
}

/** Projects the selected runtime plus the current host CPU fallback for draft configuration. */
export function rendererArtifacts(
  catalog: LocalWhisperAuthenticatedCatalog,
  inventory: LocalWhisperInventorySnapshot,
  settings: LocalWhisperSettings,
  runtime: {
    readonly applicability: Pick<NvidiaCudaRuntimeApplicability, 'supports'>;
    readonly cuda: NvidiaCudaRuntimeApplicabilitySnapshot;
    readonly host: Pick<LocalWhisperSettingsValidationContext, 'architecture' | 'platform'>;
  },
): readonly LocalWhisperRendererArtifact[] {
  const selectedRuntime = selectedRuntimeEntry(catalog, settings, runtime.applicability, runtime.cuda);
  const runtimes = catalog.payload.runtimes.flatMap((entry, index) => {
    if (!hasRuntimeArtifactAccess(catalog, entry, selectedRuntime, runtime.host)) return [];
    const item = inventory.runtimes[index];
    if (!item) return [];
    const descriptor = createManagedRuntimeDescriptor(catalog, entry);
    return [
      Object.freeze({
        kind: 'runtime' as const,
        id: descriptor.artifactId,
        revision: entry.identity.packRevision,
        label: `Whisper.cpp ${entry.identity.backend.toUpperCase()} runtime`,
        state: item.state,
        transferSizeBytes: item.transferSizeBytes,
        installedSizeBytes: item.installedSizeBytes,
        updateAvailable: item.updateAvailable,
        actions: actions(item),
        references: Object.freeze([]),
      }),
    ];
  });
  const models = catalog.payload.models.flatMap((entry, index) => {
    if (!selectedRuntime || !entry.compatibleRuntimePackRevisions.includes(selectedRuntime.identity.packRevision)) {
      return [];
    }
    const item = inventory.models[index];
    if (!item) return [];
    const descriptor = createManagedModelDescriptor(catalog, entry);
    return [
      Object.freeze({
        kind: 'model' as const,
        id: descriptor.artifactId,
        revision: entry.identity.artifactRevision,
        label: `${entry.identity.logicalModel} · ${entry.identity.variant}`,
        state: item.state,
        transferSizeBytes: item.transferSizeBytes,
        installedSizeBytes: item.installedSizeBytes,
        updateAvailable: item.updateAvailable,
        actions: actions(item),
        references: Object.freeze([]),
      }),
    ];
  });
  return Object.freeze([...runtimes, ...models]);
}

function vendorForBackend(backend: LocalWhisperBackend): 'amd' | 'apple' | 'cpu' | 'nvidia' {
  if (backend === 'cpu') return 'cpu';
  if (backend === 'cuda') return 'nvidia';
  if (backend === 'metal') return 'apple';
  return 'amd';
}

function selectedSupportTier(
  settings: LocalWhisperPublicSettings,
  context: LocalWhisperSettingsValidationContext,
): LocalWhisperSupportTier {
  const backend = settings.execution.backend;
  return new LocalWhisperSupportPolicy().evaluate({
    platform: context.platform,
    architecture: context.architecture,
    target: settings.execution.target,
    backend,
    vendor: backend === null ? null : vendorForBackend(backend),
    hipApproved: false,
  }).tier;
}

function selectedMemoryEstimate(
  catalog: LocalWhisperAuthenticatedCatalog,
  settings: LocalWhisperPublicSettings,
): LocalWhisperMemoryEstimateRecord | null {
  const backend = settings.execution.backend;
  const runtimePackRevision = settings.runtimeRevision;
  if (backend === null || runtimePackRevision === null) return null;
  return (
    catalog.payload.memoryEstimates.find(
      (candidate) =>
        candidate.target === settings.execution.target &&
        candidate.backend === backend &&
        candidate.runtimePackRevision === runtimePackRevision &&
        candidate.model.engine === settings.engine &&
        candidate.model.logicalModel === settings.model.family &&
        candidate.model.artifactRevision === settings.model.revision &&
        candidate.model.variant === settings.model.variant,
    ) ?? null
  );
}

function sampledAvailableMemoryBytes(readAvailableMemoryBytes: () => number): number | null {
  try {
    const availableBytes = Math.trunc(readAvailableMemoryBytes());
    return Number.isSafeInteger(availableBytes) && availableBytes >= 0 ? availableBytes : null;
  } catch {
    return null;
  }
}

function option(input: {
  readonly group: LocalWhisperRendererOption['group'];
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly tier: LocalWhisperSupportTier;
  readonly reason: LocalWhisperFailureCode | null;
  readonly selected: boolean;
  readonly recommended: boolean;
  readonly saved: boolean;
  readonly compatibility?: Partial<LocalWhisperRendererOptionCompatibility>;
}): LocalWhisperRendererOption {
  const compatibility = input.compatibility;
  return Object.freeze({
    ...input,
    selectedButUnavailable: input.selected && !input.available,
    default: input.recommended,
    remembered: input.saved,
    compatibility: Object.freeze({
      target: compatibility?.target ?? null,
      backend: compatibility?.backend ?? null,
      modelFamily: compatibility?.modelFamily ?? null,
      modelVariant: compatibility?.modelVariant ?? null,
      eligibleBackends: Object.freeze([...(compatibility?.eligibleBackends ?? [])]),
    }),
  });
}

/** Projects catalog acquisition choices separately from trusted device execution choices. */
export function createLocalWhisperRendererOptions(
  catalog: LocalWhisperAuthenticatedCatalog,
  context: LocalWhisperSettingsValidationContext,
  settings: LocalWhisperSettings,
  configured: boolean,
  cudaRuntimeIdentityKeys: readonly string[] = Object.freeze([]),
  cudaUnavailableReason: LocalWhisperFailureCode | null = null,
): readonly LocalWhisperRendererOption[] {
  const supportPolicy = new LocalWhisperSupportPolicy();
  const currentRuntimes = catalog.payload.runtimes.filter(({ identity }) => {
    if (identity.platform !== context.platform || identity.architecture !== context.architecture) return false;
    return identity.target === 'cpu' || cudaRuntimeIdentityKeys.includes(getLocalWhisperRuntimeIdentityKey(identity));
  });
  const runtimeOptions = currentRuntimes.map((entry) => {
    const identity = entry.identity;
    const support = supportPolicy.evaluate({
      platform: context.platform,
      architecture: context.architecture,
      target: identity.target,
      backend: identity.backend,
      vendor: vendorForBackend(identity.backend),
      hipApproved: false,
    });
    const blocked = catalog.isRuntimeDenylisted(getLocalWhisperRuntimeIdentityKey(identity));
    const available = support.available && !blocked && entry.qualificationStatus !== 'planned';
    return option({
      group: 'runtime',
      id: identity.packRevision,
      label: `${identity.backend.toUpperCase()} · ${identity.packRevision}`,
      available,
      tier: support.tier,
      reason: blocked
        ? 'RUNTIME_BLOCKED'
        : entry.qualificationStatus === 'planned'
          ? 'RUNTIME_INCOMPATIBLE'
          : support.failureCode,
      selected: settings.runtimeRevision === identity.packRevision,
      recommended: entry.recommended,
      saved: configured && settings.runtimeRevision === identity.packRevision,
      compatibility: { target: identity.target, backend: identity.backend },
    });
  });
  const selectedDeviceId = 'deviceId' in settings.execution ? settings.execution.deviceId : null;
  const cpuRuntimeAvailable = currentRuntimes.some(
    ({ identity, qualificationStatus }) => identity.target === 'cpu' && qualificationStatus !== 'planned',
  );
  const gpuRuntimeAvailable = currentRuntimes.some(
    ({ identity, qualificationStatus }) => identity.target === 'gpu' && qualificationStatus !== 'planned',
  );
  const targetOptions: readonly LocalWhisperRendererOption[] = Object.freeze([
    option({
      group: 'target',
      id: 'cpu',
      label: 'CPU',
      available: cpuRuntimeAvailable,
      tier: 'Production',
      reason: cpuRuntimeAvailable ? null : 'RUNTIME_INCOMPATIBLE',
      selected: settings.execution.target === 'cpu',
      recommended: currentRuntimes.some(({ identity, recommended }) => identity.target === 'cpu' && recommended),
      saved: configured && settings.execution.target === 'cpu',
    }),
    option({
      group: 'target',
      id: 'gpu',
      label: 'GPU',
      available: gpuRuntimeAvailable && context.knownDevices.length > 0,
      tier: 'Production',
      reason: !gpuRuntimeAvailable
        ? (cudaUnavailableReason ?? 'RUNTIME_INCOMPATIBLE')
        : context.knownDevices.length > 0
          ? null
          : 'DEVICE_NOT_FOUND',
      selected: settings.execution.target === 'gpu',
      recommended: currentRuntimes.some(({ identity, recommended }) => identity.target === 'gpu' && recommended),
      saved: configured && settings.execution.target === 'gpu',
    }),
  ]);
  const gpuBackends = [
    ...new Set(currentRuntimes.map(({ identity }) => identity.backend).filter(isLocalWhisperGpuBackend)),
  ];
  const backendOptions = gpuBackends.map((backend) => {
    const runtime = currentRuntimes.find(({ identity }) => identity.target === 'gpu' && identity.backend === backend);
    if (!runtime) throw new Error('Local Whisper GPU runtime option unavailable');
    const support = supportPolicy.evaluate({
      platform: context.platform,
      architecture: context.architecture,
      target: runtime.identity.target,
      backend,
      vendor: vendorForBackend(backend),
      hipApproved: false,
    });
    const hasDevice = context.knownDevices.some(({ eligibleBackends }) => eligibleBackends.includes(backend));
    const available = support.available && hasDevice && runtime.qualificationStatus !== 'planned';
    return option({
      group: 'backend',
      id: backend,
      label: backend.toUpperCase(),
      available,
      tier: support.tier,
      reason:
        runtime.qualificationStatus === 'planned'
          ? 'RUNTIME_INCOMPATIBLE'
          : !hasDevice
            ? 'DEVICE_NOT_FOUND'
            : support.failureCode,
      selected: settings.execution.backend === backend,
      recommended: runtime.recommended,
      saved: configured && settings.execution.backend === backend,
      compatibility: { target: 'gpu', backend },
    });
  });
  const deviceOptions = context.knownDevices.map((device) =>
    option({
      group: 'device',
      id: device.id,
      label: device.label,
      available: device.available,
      tier: device.vendor === 'nvidia' ? 'Production' : device.vendor === 'amd' ? 'Preview' : 'Planned',
      reason: device.available ? null : 'DEVICE_NOT_FOUND',
      selected: selectedDeviceId === device.id,
      recommended: context.knownDevices.length === 1,
      saved: configured && selectedDeviceId === device.id,
      compatibility: { target: 'gpu', eligibleBackends: device.eligibleBackends },
    }),
  );
  const modelOptions = catalog.payload.models.map((entry) => {
    const identity = entry.identity;
    const blocked = catalog.isModelDenylisted(getLocalWhisperModelIdentityKey(identity));
    const selected =
      settings.model.family === identity.logicalModel &&
      settings.model.revision === identity.artifactRevision &&
      settings.model.variant === identity.variant;
    return option({
      group: 'modelRevision',
      id: identity.artifactRevision,
      label: `${identity.logicalModel} · ${identity.variant} · ${identity.artifactRevision}`,
      available: !blocked && entry.qualificationStatus !== 'planned',
      tier: entry.qualificationStatus === 'planned' ? 'Planned' : 'Production',
      reason: blocked ? 'MODEL_BLOCKED' : entry.qualificationStatus === 'planned' ? 'MODEL_INCOMPATIBLE' : null,
      selected,
      recommended: entry.recommended,
      saved: configured && selected,
      compatibility: { modelFamily: identity.logicalModel, modelVariant: identity.variant },
    });
  });
  const familyOptions = [...new Set(catalog.payload.models.map(({ identity }) => identity.logicalModel))].map(
    (family) =>
      option({
        group: 'modelFamily',
        id: family,
        label: family,
        available: catalog.payload.models.some(
          ({ identity, qualificationStatus }) => identity.logicalModel === family && qualificationStatus !== 'planned',
        ),
        tier: 'Production',
        reason: null,
        selected: settings.model.family === family,
        recommended: catalog.payload.models.some(
          ({ identity, recommended }) => identity.logicalModel === family && recommended,
        ),
        saved: configured && settings.model.family === family,
      }),
  );
  const variantOptions = [...new Set(catalog.payload.models.map(({ identity }) => identity.variant))].map((variant) =>
    option({
      group: 'modelVariant',
      id: variant,
      label: variant,
      available: catalog.payload.models.some(
        ({ identity, qualificationStatus }) => identity.variant === variant && qualificationStatus !== 'planned',
      ),
      tier: 'Production',
      reason: null,
      selected: settings.model.variant === variant,
      recommended: catalog.payload.models.some(
        ({ identity, recommended }) => identity.variant === variant && recommended,
      ),
      saved: configured && settings.model.variant === variant,
    }),
  );
  return Object.freeze([
    option({
      group: 'engine',
      id: 'whisperCpp',
      label: 'Whisper.cpp',
      available: true,
      tier: 'Production',
      reason: null,
      selected: true,
      recommended: true,
      saved: configured,
    }),
    ...targetOptions,
    ...backendOptions,
    ...deviceOptions,
    ...runtimeOptions,
    ...familyOptions,
    ...modelOptions,
    ...variantOptions,
  ]);
}

function validationContext(
  catalog: LocalWhisperAuthenticatedCatalog,
  dependencies: LocalWhisperProductionEnvironmentDependencies,
  knownDevices: readonly LocalWhisperDeviceDescriptor[] = Object.freeze([]),
  cudaRuntimeIdentityKeys: readonly string[] = Object.freeze([]),
): LocalWhisperSettingsValidationContext {
  const currentPlatform = platform(dependencies.platform);
  const currentArchitecture = architecture(dependencies.architecture);
  return Object.freeze({
    platform: currentPlatform,
    architecture: currentArchitecture,
    logicalProcessorCount: Math.min(
      LOCAL_WHISPER_MAX_LOGICAL_PROCESSOR_COUNT,
      Math.max(1, Math.trunc(dependencies.logicalProcessorCount)),
    ),
    knownDevices: Object.freeze([...knownDevices]),
    knownRuntimeSelections: Object.freeze(
      catalog.payload.runtimes
        .filter(
          (entry) =>
            entry.identity.platform === currentPlatform &&
            entry.identity.architecture === currentArchitecture &&
            (entry.identity.target === 'cpu' ||
              cudaRuntimeIdentityKeys.includes(getLocalWhisperRuntimeIdentityKey(entry.identity))),
        )
        .map((entry) =>
          Object.freeze({
            engine: entry.identity.engine,
            target: entry.identity.target,
            backend: entry.identity.backend,
            revision: entry.identity.packRevision,
            recommended: entry.recommended,
          }),
        ),
    ),
    knownModelSelections: Object.freeze(
      catalog.payload.models.map((entry) =>
        Object.freeze({
          engine: entry.identity.engine,
          family: entry.identity.logicalModel,
          revision: entry.identity.artifactRevision,
          variant: entry.identity.variant,
          recommended: entry.recommended,
        }),
      ),
    ),
    // GPU authority is granted only after exact runtime-registry discovery. An OS label is never enough.
    eligibleGpuCombinations: Object.freeze(
      knownDevices.flatMap((device) =>
        device.eligibleBackends.map((backend) =>
          Object.freeze({
            engine: 'whisperCpp' as const,
            backend,
            deviceId: device.id,
          }),
        ),
      ),
    ),
  });
}

function reconcileNvidiaTopology(
  topology: readonly LocalWhisperDeviceDescriptor[],
  inventory: NvidiaCudaRuntimeApplicabilitySnapshot,
): readonly LocalWhisperDeviceDescriptor[] {
  const runtimeIds = new Set(topology.map(({ id }) => id));
  return Object.freeze(inventory.devices.filter(({ id }) => runtimeIds.has(id)));
}

function rememberedThreadSelection(
  snapshot: LocalWhisperSettingsSnapshot,
  target: 'cpu' | 'gpu',
  logicalProcessorCount: number,
): LocalWhisperCpuThreads {
  const remembered = snapshot.dependentSelections.values[`threads:whisperCpp:${target}`];
  if (resolveLocalWhisperCpuThreads(remembered, logicalProcessorCount) !== null) {
    return remembered as LocalWhisperCpuThreads;
  }
  const execution = snapshot.settings.execution;
  let configured: LocalWhisperCpuThreads = LOCAL_WHISPER_AUTO_CPU_THREADS;
  if (target === 'cpu' && execution.target === 'cpu') configured = execution.cpuThreads;
  if (target === 'gpu' && execution.target === 'gpu') configured = execution.gpuCpuThreads;
  return resolveLocalWhisperCpuThreads(configured, logicalProcessorCount) === null
    ? LOCAL_WHISPER_AUTO_CPU_THREADS
    : configured;
}

/** Builds renderer-safe catalog, inventory, and read-only resource facts for the current selection. */
function factsSnapshot(
  catalog: LocalWhisperAuthenticatedCatalog,
  inventory: LocalWhisperInventorySnapshot,
  context: LocalWhisperSettingsValidationContext,
  settingsSnapshot: LocalWhisperSettingsSnapshot,
  applicability: NvidiaCudaRuntimeApplicability,
  cuda: NvidiaCudaRuntimeApplicabilitySnapshot,
  sample: {
    readonly availableMemoryBytes: () => number;
    readonly availableVramBytes: () => number | null;
    readonly now: number | null;
  },
  progress: readonly LocalWhisperArtifactProgress[] = Object.freeze([]),
): LocalWhisperSnapshotFacts {
  const estimate = selectedMemoryEstimate(catalog, settingsSnapshot.settings);
  const inventoryPeak = inventory.qualifiedMemoryPeak;
  const peak =
    estimate &&
    inventoryPeak &&
    getLocalWhisperMemoryConfigurationKey(inventoryPeak.configuration) ===
      getLocalWhisperMemoryConfigurationKey(estimate)
      ? inventoryPeak
      : null;
  const resources = estimate
    ? new LocalWhisperResourcePolicy().evaluate({
        configuration: estimate,
        estimate,
        qualifiedPeak: peak,
        availability: Object.freeze({
          freeRamBytes: sampledAvailableMemoryBytes(sample.availableMemoryBytes),
          freeVramBytes: sample.availableVramBytes(),
        }),
      })
    : null;
  const artifacts = rendererArtifacts(catalog, inventory, settingsSnapshot.settings, {
    applicability,
    cuda,
    host: context,
  });
  const installed = [...inventory.runtimes, ...inventory.models].filter(({ state }) => state === 'Installed');
  return Object.freeze({
    catalogRevision: catalog.payload.catalogRevision,
    options: createLocalWhisperRendererOptions(
      catalog,
      context,
      settingsSnapshot.settings,
      settingsSnapshot.configured,
      cuda.runtimeIdentityKeys,
      cuda.unavailableReason,
    ),
    validationIssues: settingsSnapshot.repairIssues,
    host: Object.freeze({
      label:
        context.knownDevices.length === 0
          ? `CPU · ${context.logicalProcessorCount} logical processors`
          : `CPU · ${context.logicalProcessorCount} logical processors · ${context.knownDevices
              .map(({ label }) => label)
              .join(' · ')}`,
      logicalProcessorCount: context.logicalProcessorCount,
    }),
    threadSelections: Object.freeze({
      cpuThreads: rememberedThreadSelection(settingsSnapshot, 'cpu', context.logicalProcessorCount),
      gpuCpuThreads: rememberedThreadSelection(settingsSnapshot, 'gpu', context.logicalProcessorCount),
    }),
    memory: Object.freeze({
      selectedEstimate: estimate,
      qualifiedPeak: peak
        ? Object.freeze({
            measuredPeakRamBytes: peak.measuredPeakRamBytes,
            measuredPeakVramBytes: peak.measuredPeakVramBytes,
            qualificationProfileId: peak.qualificationProfileId,
          })
        : null,
      exactEstimateUnavailable: estimate === null,
    }),
    resources,
    storage: Object.freeze({
      label: 'Local Whisper managed storage',
      installedArtifactCount: installed.length,
      installedBytes: installed.reduce((sum, artifact) => sum + artifact.installedSizeBytes, 0),
    }),
    artifacts,
    progress: Object.freeze([...progress]),
    prerequisites: Object.freeze([
      Object.freeze(
        catalog.payload.purpose === 'qualification'
          ? {
              id: 'development-qualification-artifacts',
              label: 'Development qualification artifacts',
              version: null,
            }
          : {
              id: 'production-artifact-pipeline',
              label: 'Authenticated production artifact pipeline',
              version: null,
            },
      ),
    ]),
    lastValidatedAtMs: sample.now,
  });
}

function fallbackSettings(context: LocalWhisperSettingsValidationContext): LocalWhisperSettingsSnapshot | null {
  const created = createNeverConfiguredLocalWhisperSettings(context);
  if (!created.success) return null;
  return Object.freeze({
    configured: false,
    settings: created.settings,
    dependentSelections: Object.freeze({ values: Object.freeze({}) }),
    repairIssues: Object.freeze([{ path: 'settings', reason: 'invalid-shape' as const }]),
  });
}

function capabilityFingerprint(
  catalog: LocalWhisperAuthenticatedCatalog,
  settings: LocalWhisperPublicSettings,
  inventoryRevision: number,
  logicalProcessorCount: number,
  epochs: Pick<LocalWhisperCoordinatorEpochs, 'configuration' | 'topology'>,
): string {
  const execution = settings.execution;
  const resolvedCpuThreads = resolveLocalWhisperCpuThreads(
    execution.target === 'cpu' ? execution.cpuThreads : execution.gpuCpuThreads,
    logicalProcessorCount,
  );
  if (resolvedCpuThreads === null) throw new Error('Local Whisper execution thread identity is invalid');
  return createHash('sha256')
    .update(
      JSON.stringify({
        catalogRevision: catalog.payload.catalogRevision,
        inventoryRevision,
        runtimeRevision: settings.runtimeRevision,
        model: settings.model,
        execution,
        configuredGpuCpuThreads: execution.target === 'gpu' ? execution.gpuCpuThreads : null,
        resolvedCpuThreads,
        logicalProcessorTopologyGeneration: epochs.topology,
        configurationEpoch: epochs.configuration,
      }),
    )
    .digest('hex');
}

function staticBackendProbe(
  settings: LocalWhisperPublicSettings,
  logicalProcessorCount: number,
): LocalWhisperBackendProbeInput {
  const execution = settings.execution;
  if (execution.backend === 'cpu') {
    return Object.freeze({
      backend: 'cpu',
      logicalProcessorCount,
      resolvedThreads:
        execution.cpuThreads === 'auto' ? logicalProcessorCount : Math.min(execution.cpuThreads, logicalProcessorCount),
      isaSupported: true,
    });
  }
  if (execution.backend === 'cuda') {
    return Object.freeze({
      backend: 'cuda',
      physicalNvidiaDevice: false,
      driverCompatible: false,
      computeTargetCompiled: false,
      dependencyClosureValid: false,
    });
  }
  if (execution.backend === 'vulkan') {
    return Object.freeze({
      backend: 'vulkan',
      physicalAmdDevice: false,
      apiVersion: Object.freeze([0, 0] as const),
      generatedShaderTarget: Object.freeze([1, 2] as const),
      storageBuffer16BitAccess: false,
      requiredExtensionsPresent: false,
    });
  }
  if (execution.backend === 'hip') {
    return Object.freeze({
      backend: 'hip',
      approvedRow: false,
      exactOsKernelDriverMatch: false,
      exactRuntimeClosureMatch: false,
      exactPciAndGfxMatch: false,
      pcieAtomicsSatisfied: false,
      permissionsSatisfied: false,
    });
  }
  return Object.freeze({ backend: 'metal' });
}

function discoveredBackendProbe(settings: LocalWhisperPublicSettings): LocalWhisperBackendProbeInput {
  if (settings.execution.backend === 'cuda') {
    return Object.freeze({
      backend: 'cuda',
      physicalNvidiaDevice: true,
      driverCompatible: true,
      computeTargetCompiled: true,
      dependencyClosureValid: true,
    });
  }
  return staticBackendProbe(settings, 1);
}

/** Builds one process-owned graph after production catalog and helper authentication succeed. */
export class ProductionLocalWhisperEnvironmentFactory {
  public constructor(
    private readonly dependencies: LocalWhisperProductionEnvironmentDependencies,
    private readonly catalogInput: LocalWhisperProductionCatalogInput,
  ) {}

  /** Authenticates immutable inputs before constructing any privileged adapter. */
  public async create(): Promise<LocalWhisperProductionEnvironment> {
    const nativePlatform = this.dependencies.platform;
    const deferred = (): LocalWhisperProductionEnvironment =>
      createDeferredLocalWhisperEnvironment({
        platform: nativePlatform,
        architecture: this.dependencies.architecture,
        logicalProcessorCount: this.dependencies.logicalProcessorCount,
        nextRequestId: this.dependencies.nextRequestId,
        unavailableReason: 'CATALOG_UNAVAILABLE',
      });
    const activationPurpose = this.catalogInput.activationPurpose ?? 'production';
    if (
      (nativePlatform !== 'linux' && nativePlatform !== 'win32') ||
      this.catalogInput.trustPolicy?.purpose !== activationPurpose ||
      (activationPurpose === 'production' && this.dependencies.qualificationHooks !== undefined)
    ) {
      return deferred();
    }
    const loaded = new LocalWhisperCatalogRepository({
      readDocument: () => Uint8Array.from(this.catalogInput.document),
      trustPolicy: this.catalogInput.trustPolicy,
    }).load();
    if (!loaded.success) return deferred();

    let store: ManagedArtifactStore | null = null;
    let facts: LocalWhisperDynamicSnapshotFacts | null = null;
    let registryDiscovery: LocalWhisperRuntimeRegistryDiscovery | null = null;
    let topologyAuthority: LocalWhisperDeviceTopologyAuthority | null = null;
    let unsubscribeArtifactProgress: (() => void) | null = null;
    const nativeRuntimeLogRelay = this.dependencies.nativeRuntimeLogRelay ?? new NativeRuntimeLogRelay();
    try {
      const resources = await new LocalWhisperPackagedResourceResolver({
        platform: nativePlatform,
        resourcesPath: this.dependencies.resourcesPath,
        readFile: this.dependencies.readFile,
      }).resolve();
      if (resources.availability !== 'available') return deferred();
      const transport = new NativeManagedFilesystemGuardTransport({
        environment: this.dependencies.environment,
        executablePath: resources.filesystemGuardExecutable,
        generateProcessInstanceId: randomUUID,
        nativeRuntimeLogRelay,
        platform: nativePlatform,
        spawnProcess: this.dependencies.spawnProcess,
      });
      const adapter =
        nativePlatform === 'linux'
          ? new LinuxManagedFilesystemAdapter(transport)
          : new WindowsManagedFilesystemAdapter(transport);
      const rootResolution = new ManagedArtifactPathResolver({
        environment: this.dependencies.environment,
        homeDirectory: this.dependencies.homeDirectory,
        platform: this.dependencies.platform,
      }).resolve();
      if (rootResolution.availability !== 'available') return deferred();
      const processStartIdentity = await adapter.getProcessStartIdentity(this.dependencies.pid);
      store = new ManagedArtifactStore({
        adapter,
        generateOperationNonce: this.dependencies.randomNonce,
        lockRepository: new ManagedArtifactLockRepository({
          adapter,
          appInstanceNonce: this.dependencies.randomNonce(),
          osProcessStartIdentity: processStartIdentity,
          pid: this.dependencies.pid,
        }),
        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onStagingCleanupStep
          ? { onStagingCleanupStep: this.dependencies.qualificationHooks.onStagingCleanupStep }
          : {}),
        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onStagingCleanupFailure
          ? { onStagingCleanupFailure: this.dependencies.qualificationHooks.onStagingCleanupFailure }
          : {}),
        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onStagingPromotionFailure
          ? { onStagingPromotionFailure: this.dependencies.qualificationHooks.onStagingPromotionFailure }
          : {}),
        rootResolution,
      });
      await store.initialize();
      const managedStore = store;
      const removalClearanceIssuer = new ManagedArtifactRemovalClearanceIssuer();
      const privateStateRoot = join(this.dependencies.configurationRoot, 'local-whisper');
      const processOwner =
        this.dependencies.platform === 'linux'
          ? new LinuxProcessGroupOwner({
              environment: this.dependencies.environment,
              getProcessStartIdentity: (pid) => adapter.getProcessStartIdentity(pid),
              launcherExecutablePath: resources.launcherExecutable,
              launcherExecutableSha256: resources.launcherSha256,
              modelGuardExecutablePath: resources.filesystemGuardExecutable,
              spawnProcess: this.dependencies.spawnProcess,
            })
          : new WindowsJobObjectOwner({
              environment: this.dependencies.environment,
              getProcessStartIdentity: (pid) => adapter.getProcessStartIdentity(pid),
              launcherExecutablePath: resources.launcherExecutable,
              launcherExecutableSha256: resources.launcherSha256,
              modelGuardExecutablePath: resources.filesystemGuardExecutable,
              spawnProcess: this.dependencies.spawnProcess,
            });
      const createWorkerOwnership = (role: 'registry' | 'session'): WorkerProcessOwnership =>
        new WorkerProcessOwnership({
          processOwner,
          randomNonce: this.dependencies.randomNonce,
          recordStore: new FileWorkerOwnershipRecordStore({
            filePath: join(privateStateRoot, `worker-${role}-ownership.json`),
            fileSystem: this.dependencies.fileSystem,
            temporaryPath: () =>
              join(privateStateRoot, `worker-${role}-ownership.${this.dependencies.randomNonce()}.tmp`),
          }),
          ...(role === 'session' &&
          activationPurpose === 'qualification' &&
          this.dependencies.qualificationHooks?.onSessionProcessLaunched
            ? { onProcessLaunched: this.dependencies.qualificationHooks.onSessionProcessLaunched }
            : {}),
        });
      const registryOwnership = createWorkerOwnership('registry');
      const sessionOwnership = createWorkerOwnership('session');
      if (!(await registryOwnership.recoverOwnedOrphan()) || !(await sessionOwnership.recoverOwnedOrphan())) {
        throw new Error('Local Whisper worker cleanup unavailable');
      }
      registryDiscovery = new LocalWhisperRuntimeRegistryDiscovery(registryOwnership, nativeRuntimeLogRelay);
      const lifecycle = new LocalWhisperWorkerLifecycle({
        createSession: () =>
          new LocalWhisperWorkerSupervisor({
            clock: {
              clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
              setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
            },
            createTransport: (streams, callbacks) => new LocalWhisperWorkerTransport(streams, callbacks),
            nextRequestId: this.dependencies.nextRequestId,
            createNativeRuntimeLogDecoder: (processInstanceId) =>
              new NativeRuntimeLogStreamDecoder({
                ...(processInstanceId ? { expectedProcessInstanceId: processInstanceId } : {}),
                onRecord: (record) => nativeRuntimeLogRelay.accept(record),
              }),
            ownership: sessionOwnership,
          }),
      });
      const deviceIdentities = new LocalWhisperDeviceIdentityRepository(
        new FileLocalWhisperDeviceIdentityStore({
          filePath: join(privateStateRoot, 'device-identity.json'),
          platform: this.dependencies.platform,
          createTemporaryPath: () => join(privateStateRoot, `device-identity.${this.dependencies.randomNonce()}.tmp`),
          fileSystem: this.dependencies.fileSystem,
        }),
        this.dependencies.randomBytes,
      );
      const deviceTopologyAuthority = new LocalWhisperDeviceTopologyAuthority(deviceIdentities);
      topologyAuthority = deviceTopologyAuthority;
      const runtimeAuthorityFactory = new LocalWhisperRuntimeLaunchAuthorityFactory(managedStore);
      const modelAuthorityFactory = new LocalWhisperModelPathLoadAuthorityFactory({
        randomBytes: this.dependencies.randomBytes,
        store: managedStore,
      });
      const evidence = await managedStore.buildEvidenceSnapshot(loaded.catalog);
      const inventoryRepository = new LocalWhisperInventoryRepository();
      let inventory = inventoryRepository.reconstruct({ catalog: loaded.catalog, evidence });
      const cudaApplicability = new NvidiaCudaRuntimeApplicability({
        catalog: loaded.catalog,
        platform: platform(this.dependencies.platform),
        architecture: architecture(this.dependencies.architecture),
        identities: deviceIdentities,
      });
      const cuda = cudaApplicability.resolve(
        await this.dependencies
          .readNvidiaInventory()
          .catch(() => Object.freeze({ available: false as const, reason: 'DEVICE_NOT_FOUND' as const })),
      );
      let context = validationContext(loaded.catalog, this.dependencies, cuda.devices, cuda.runtimeIdentityKeys);
      const settingsRepository = new LocalWhisperSettingsRepository(
        new FileLocalWhisperPrivateJsonStore({
          filePath: resolveLocalWhisperSettingsFile(this.dependencies.configurationRoot),
          fileSystem: this.dependencies.fileSystem,
          platform: this.dependencies.platform,
        }),
      );
      const loadedSettings = settingsRepository.load(context);
      const initialSettingsSnapshot =
        loadedSettings.status === 'default' ||
        loadedSettings.status === 'configured' ||
        loadedSettings.status === 'repairable'
          ? loadedSettings.snapshot
          : fallbackSettings(context);
      if (!initialSettingsSnapshot) throw new Error('Local Whisper catalog has no valid default settings');
      let settingsSnapshot: LocalWhisperSettingsSnapshot = initialSettingsSnapshot;
      const selectedVram = new SelectedDeviceVramAvailability({
        resolve: (deviceId, registryFingerprint) => deviceTopologyAuthority.resolve(deviceId, registryFingerprint),
        sample: this.dependencies.availableVramBytes,
      });
      const resourceSample = (now: number | null) =>
        Object.freeze({
          availableMemoryBytes: this.dependencies.availableMemoryBytes,
          availableVramBytes: () => selectedVram.availableBytes(settingsSnapshot.settings.execution),
          now,
        });
      facts = new LocalWhisperDynamicSnapshotFacts(
        factsSnapshot(
          loaded.catalog,
          inventory,
          context,
          settingsSnapshot,
          cudaApplicability,
          cuda,
          resourceSample(null),
        ),
      );
      const setup = selectedArtifactSetup(settingsSnapshot.settings, inventory);
      const capabilityService = new LocalWhisperCapabilityService();
      const settingsPort: LocalWhisperCoordinatorDependencies['settings'] = Object.freeze({
        // Repository load has already shape/catalog-validated this exact default,
        // configured, or repairable snapshot. Mutations remain strict below.
        validateInitial: (candidate: unknown) =>
          candidate === settingsSnapshot.settings ? settingsSnapshot.settings : null,
        validate: (candidate: unknown) => {
          const result = validateLocalWhisperSettings(candidate, context);
          return result.success ? result.settings : null;
        },
        supportTier: (settings: LocalWhisperSettings) => selectedSupportTier(settings, context),
        defaultSettings: () => {
          const defaults = createNeverConfiguredLocalWhisperSettings(context);
          if (!defaults.success) throw new Error('Local Whisper defaults unavailable');
          return defaults.settings;
        },
        save: (settings: LocalWhisperSettings) => {
          const saved = settingsRepository.save(settings, context);
          settingsSnapshot = saved;
          facts?.update(
            factsSnapshot(loaded.catalog, inventory, context, saved, cudaApplicability, cuda, resourceSample(null)),
          );
          return Promise.resolve();
        },
        reset: () => {
          settingsRepository.reset();
          const defaults = createNeverConfiguredLocalWhisperSettings(context);
          if (!defaults.success) return Promise.reject(new Error('Local Whisper defaults unavailable'));
          settingsSnapshot = Object.freeze({
            configured: false,
            settings: defaults.settings,
            dependentSelections: Object.freeze({ values: Object.freeze({}) }),
            repairIssues: Object.freeze([]),
          });
          facts?.update(
            factsSnapshot(
              loaded.catalog,
              inventory,
              context,
              settingsSnapshot,
              cudaApplicability,
              cuda,
              resourceSample(null),
            ),
          );
          return Promise.resolve();
        },
      });
      const workerPort = new LocalWhisperProductionWorkerPort({
        architecture: context.architecture,
        catalog: loaded.catalog,
        lifecycle,
        logicalProcessorCount: context.logicalProcessorCount,
        modelAuthorities: modelAuthorityFactory,
        onTopology: (snapshot) => {
          selectedVram.updateTopology(snapshot);
          context = validationContext(
            loaded.catalog,
            this.dependencies,
            reconcileNvidiaTopology(snapshot.devices, cuda),
            cuda.runtimeIdentityKeys,
          );
          if (settingsSnapshot.repairIssues.length > 0) {
            const revalidated = validateLocalWhisperSettings(settingsSnapshot.settings, context);
            if (revalidated.success) {
              settingsSnapshot = Object.freeze({
                ...settingsSnapshot,
                settings: revalidated.settings,
                repairIssues: Object.freeze([]),
              });
            }
          }
          facts?.update(
            factsSnapshot(
              loaded.catalog,
              inventory,
              context,
              settingsSnapshot,
              cudaApplicability,
              cuda,
              resourceSample(this.dependencies.now()),
            ),
          );
        },
        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onLoadStage
          ? { onQualificationLoadStage: this.dependencies.qualificationHooks.onLoadStage }
          : {}),
        platform: context.platform,
        randomBytes: this.dependencies.randomBytes,
        registryDiscovery,
        runtimeAuthorities: runtimeAuthorityFactory,
        topology: deviceTopologyAuthority,
      });
      const refreshAvailableDevices = async (configurationEpoch: number): Promise<void> => {
        await workerPort.refreshAvailableDevices(configurationEpoch);
        await selectedVram.refresh(settingsSnapshot.settings.execution);
        facts?.update(
          factsSnapshot(
            loaded.catalog,
            inventory,
            context,
            settingsSnapshot,
            cudaApplicability,
            cuda,
            resourceSample(this.dependencies.now()),
          ),
        );
      };
      await restoreLocalWhisperStartupDeviceTopology(inventory, context, { refreshAvailableDevices });
      const artifactInventory = new LocalWhisperProductionArtifactInventory({
        catalog: loaded.catalog,
        initialInventory: inventory,
        inventoryRepository,
        onInventoryChanged: (nextInventory) => {
          inventory = nextInventory;
          facts?.update(
            factsSnapshot(
              loaded.catalog,
              nextInventory,
              context,
              settingsSnapshot,
              cudaApplicability,
              cuda,
              resourceSample(this.dependencies.now()),
            ),
          );
          if (
            nextInventory.runtimes.some(
              ({ backend, state, target }) => backend === 'cuda' && target === 'gpu' && state === 'Installed',
            )
          ) {
            void refreshAvailableDevices(nextInventory.revision).catch(() => undefined);
          }
        },
        store: managedStore,
      });
      const artifactClock = Object.freeze({
        now: this.dependencies.now,
        clearTimeout: (handle: unknown) => clearTimeout(handle as NodeJS.Timeout),
        setTimeout: (callback: () => void, milliseconds: number) => setTimeout(callback, milliseconds),
      });
      const artifactProgressStore = new ArtifactProgressStore(artifactClock);
      unsubscribeArtifactProgress = artifactProgressStore.subscribe((updates) => {
        const projected = updates.map(
          ({ operationId, artifactId, action, state, receivedBytes, totalBytes, queuedPosition, failure }) =>
            Object.freeze({
              operationId,
              artifactId,
              action,
              state,
              receivedBytes,
              totalBytes,
              queuedPosition,
              failure,
            }),
        );
        facts?.update(
          factsSnapshot(
            loaded.catalog,
            inventory,
            context,
            settingsSnapshot,
            cudaApplicability,
            cuda,
            resourceSample(this.dependencies.now()),
            projected,
          ),
        );
      });
      const artifactService = new LocalWhisperArtifactService({
        catalogResolver: new ArtifactCatalogResolver({ getCatalog: () => loaded.catalog }),
        clock: artifactClock,
        diskSpace: new NodeArtifactDiskSpace(rootResolution.managedRoot, () => artifactInventory.installedBytes),
        extractor: new StreamingArtifactExtractor({
          clock: artifactClock,
          maximumInFlightWrites: PRODUCTION_ARTIFACT_INSTALLATION_PIPELINE_WINDOW,
          observePipeline: null,
          store: managedStore,
        }),
        generateOperationId: this.dependencies.randomNonce,
        inventory: artifactInventory,
        journals: new ArtifactTransferJournalRepository(
          new FileArtifactTransferJournalStore(
            join(privateStateRoot, 'artifact-journals'),
            this.dependencies.randomNonce,
          ),
        ),
        logger: Object.freeze({
          info: () => undefined,
          warn: () => undefined,
        }),
        ...(activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.onArtifactTransferFailure
          ? { onTransferFailure: this.dependencies.qualificationHooks.onArtifactTransferFailure }
          : {}),
        progress: artifactProgressStore,
        queue: new ArtifactTransferQueue(),
        store: managedStore,
        transport: new CatalogHttpTransport({
          client:
            activationPurpose === 'qualification' && this.dependencies.qualificationHooks?.artifactHttpClient
              ? this.dependencies.qualificationHooks.artifactHttpClient
              : new NodeArtifactHttpClient(
                  activationPurpose === 'qualification' &&
                    this.dependencies.qualificationHooks?.trustedCertificateAuthorities
                    ? {
                        trustedCertificateAuthorities:
                          this.dependencies.qualificationHooks.trustedCertificateAuthorities,
                      }
                    : {},
                ),
          clock: artifactClock,
        }),
        verifier: new StreamingArtifactVerifier({
          clock: artifactClock,
          signatureVerifier: new CatalogArtifactSignatureVerifier(this.catalogInput.trustPolicy.publicKeys),
          worker: new FileBackedArtifactStreamingWorker(join(rootResolution.managedRoot, 'staging', 'transfers')),
        }),
      });
      const canAcquireArtifact = (artifactId: string): boolean => {
        const runtime = loaded.catalog.payload.runtimes.find(
          (entry) => createManagedRuntimeDescriptor(loaded.catalog, entry).artifactId === artifactId,
        );
        const selectedRuntime = selectedRuntimeEntry(
          loaded.catalog,
          settingsSnapshot.settings,
          cudaApplicability,
          cuda,
        );
        if (runtime) return hasRuntimeArtifactAccess(loaded.catalog, runtime, selectedRuntime, context);
        const model = loaded.catalog.payload.models.find(
          (entry) => createManagedModelDescriptor(loaded.catalog, entry).artifactId === artifactId,
        );
        return (
          model !== undefined &&
          selectedRuntime !== undefined &&
          model.compatibleRuntimePackRevisions.includes(selectedRuntime.identity.packRevision)
        );
      };
      const artifactPort = new LocalWhisperProductionArtifactPort({
        catalog: loaded.catalog,
        canAcquire: canAcquireArtifact,
        clearance: removalClearanceIssuer,
        inventory: artifactInventory,
        service: artifactService,
      });
      const coordinator: LocalWhisperCoordinatorDependencies = {
        settings: settingsPort,
        capability: {
          /** Revalidates installed artifacts and exact runtime registry before coordinator proof. */
          preflight: async (request) => {
            const current = selectedArtifactSetup(request.settings, inventory);
            const runtime = loaded.catalog.payload.runtimes.find(
              (entry) => entry.identity.packRevision === request.settings.runtimeRevision,
            );
            const model = loaded.catalog.payload.models.find(
              (entry) =>
                entry.identity.logicalModel === request.settings.model.family &&
                entry.identity.artifactRevision === request.settings.model.revision &&
                entry.identity.variant === request.settings.model.variant,
            );
            const estimate = loaded.catalog.payload.memoryEstimates.find(
              (record) =>
                record.runtimePackRevision === request.settings.runtimeRevision &&
                record.model.logicalModel === request.settings.model.family &&
                record.model.artifactRevision === request.settings.model.revision &&
                record.backend === request.settings.execution.backend,
            );
            if (!runtime || !model || !estimate) {
              return {
                success: false as const,
                supportTier: 'Production' as const,
                runtimeSetup: current.runtime,
                modelSetup: current.model,
                code: 'INVALID_SETTINGS' as const,
                resources: null,
              };
            }
            const execution = request.settings.execution;
            let device = null;
            let freeVramBytes: number | null = null;
            let backendProbe = staticBackendProbe(request.settings, context.logicalProcessorCount);
            if (execution.target === 'gpu') {
              try {
                const authority = await runtimeAuthorityFactory.acquire({
                  catalog: loaded.catalog,
                  runtime,
                  configurationEpoch: request.epochs.configuration,
                  launchMode: 'registry',
                });
                const registry = await registryDiscovery?.discover(authority, request.signal);
                if (!registry) throw new Error('Local Whisper registry unavailable');
                const topology = deviceTopologyAuthority.update(registry);
                selectedVram.updateTopology(topology);
                context = validationContext(
                  loaded.catalog,
                  this.dependencies,
                  reconcileNvidiaTopology(topology.devices, cuda),
                  cuda.runtimeIdentityKeys,
                );
                if (!isValidLocalWhisperPublicSettings(request.settings, context)) {
                  throw new Error('Local Whisper selected device unavailable');
                }
                const selected = topology.devices.find((candidate) => candidate.id === execution.deviceId);
                if (!selected) throw new Error('Local Whisper selected device unavailable');
                device = Object.freeze({ id: selected.id, vendor: selected.vendor, available: selected.available });
                backendProbe = discoveredBackendProbe(request.settings);
                freeVramBytes = await selectedVram.refresh(request.settings.execution);
                facts?.update(
                  factsSnapshot(
                    loaded.catalog,
                    inventory,
                    context,
                    settingsSnapshot,
                    cudaApplicability,
                    cuda,
                    resourceSample(this.dependencies.now()),
                  ),
                );
              } catch (error) {
                const code =
                  error instanceof LocalWhisperRuntimeRegistryDiscoveryError ? error.code : 'DEVICE_PROOF_FAILED';
                return {
                  success: false as const,
                  supportTier: 'Production' as const,
                  runtimeSetup: current.runtime,
                  modelSetup: current.model,
                  code,
                  resources: null,
                };
              }
            }
            return capabilityService.preflight({
              settings: request.settings,
              platform: context.platform,
              architecture: context.architecture,
              runtimeSetup: current.runtime,
              modelSetup: current.model,
              device,
              hipApproved: false,
              backendProbe,
              configuration: {
                target: execution.target,
                backend: execution.backend ?? 'metal',
                runtimePackRevision: runtime.identity.packRevision,
                model: model.identity,
              },
              estimate,
              qualifiedPeak: null,
              availability: {
                freeRamBytes: Math.max(0, Math.trunc(this.dependencies.availableMemoryBytes())),
                freeVramBytes,
              },
              capabilityFingerprint: capabilityFingerprint(
                loaded.catalog,
                request.settings,
                inventory.revision,
                context.logicalProcessorCount,
                request.epochs,
              ),
            });
          },
        },
        workers: workerPort,
        artifacts: artifactPort,
        cache: {
          context: (settings, epochs) => {
            const execution = settings.execution;
            const resolvedCpuThreads = resolveLocalWhisperCpuThreads(
              execution.target === 'cpu' ? execution.cpuThreads : execution.gpuCpuThreads,
              context.logicalProcessorCount,
            );
            if (resolvedCpuThreads === null) throw new Error('Local Whisper execution thread identity is invalid');
            return Object.freeze([
              String(loaded.catalog.payload.catalogRevision),
              String(settings.runtimeRevision ?? 'none'),
              String(settings.model.revision),
              String(epochs.inventory),
              String(execution.target === 'gpu' ? execution.gpuCpuThreads : 'none'),
              String(resolvedCpuThreads),
              String(epochs.topology),
              String(epochs.configuration),
            ]);
          },
        },
        inventory: {
          selectedSetup: (settings) => {
            const selected = selectedArtifactSetup(settings, artifactInventory.snapshot);
            return Object.freeze({
              inventoryEpoch: artifactInventory.getRevision(),
              runtimeSetup: selected.runtime,
              modelSetup: selected.model,
            });
          },
          subscribe: (listener) => artifactInventory.subscribe((nextInventory) => listener(nextInventory.revision)),
        },
        nextRequestId: this.dependencies.nextRequestId,
        initial: {
          settings: settingsSnapshot.settings,
          configured: settingsSnapshot.configured,
          inventoryEpoch: inventory.revision,
          runtimeSetup: setup.runtime,
          modelSetup: setup.model,
          supportTier: selectedSupportTier(settingsSnapshot.settings, context),
        },
      };
      let disposed = false;
      const ownedStore = store;
      const ownedFacts = facts;
      const ownedRegistryDiscovery = registryDiscovery;
      const ownedTopologyAuthority = deviceTopologyAuthority;
      const ownedLifecycle = lifecycle;
      return Object.freeze({
        coordinator,
        facts,
        artifacts: artifactPort,
        managedFolder: {
          open: async () => {
            if (rootResolution.availability !== 'available') {
              return { success: false as const, code: 'RUNTIME_PREREQUISITE_MISSING' as const };
            }
            const error = await this.dependencies.openPath(rootResolution.managedRoot);
            return error === ''
              ? { success: true as const }
              : { success: false as const, code: 'RUNTIME_PREREQUISITE_MISSING' as const };
          },
        },
        references: {
          open: () => Promise.resolve({ success: false as const, code: 'INVALID_SETTINGS' as const }),
        },
        nativeRuntimeLogRelay,
        refreshDevices: (configurationEpoch: number) =>
          disposed ? Promise.resolve() : refreshAvailableDevices(configurationEpoch),
        dispose: async () => {
          if (disposed) return;
          disposed = true;
          await ownedLifecycle.shutdownFullLoad().catch(() => undefined);
          ownedRegistryDiscovery.dispose();
          ownedTopologyAuthority.invalidate();
          selectedVram.invalidate();
          unsubscribeArtifactProgress?.();
          ownedFacts.dispose();
          await ownedStore.dispose();
        },
      });
    } catch {
      unsubscribeArtifactProgress?.();
      registryDiscovery?.dispose();
      topologyAuthority?.invalidate();
      facts?.dispose();
      await store?.dispose().catch(() => undefined);
      return deferred();
    }
  }
}

/** Production entry point: fixture catalog bytes and keys cannot be injected through this boundary. */
export function createProductionLocalWhisperEnvironment(
  dependencies: LocalWhisperProductionEnvironmentDependencies,
): Promise<LocalWhisperProductionEnvironment> {
  return new ProductionLocalWhisperEnvironmentFactory(dependencies, {
    activationPurpose: 'production',
    document: PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT,
    trustPolicy: createPackagedLocalWhisperCatalogTrustPolicy(
      dependencies.appRevision,
      LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
    ),
  }).create();
}
