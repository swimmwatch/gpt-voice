import { resolveLocalWhisperCpuThreads, type LocalWhisperWorkerDeviceBinding } from '@shared/localWhisper';
import type {
  LocalWhisperCoordinatorWorkerPort,
  LocalWhisperCoordinatorWorkerResult,
  LocalWhisperResidentWorkerLease,
} from '../coordinator/LocalWhisperCoordinatorTypes';
import type {
  LocalWhisperAuthenticatedCatalog,
  LocalWhisperCatalogModelEntry,
  LocalWhisperCatalogRuntimeEntry,
} from '../catalog/LocalWhisperCatalogTypes';
import {
  LocalWhisperDeviceChallengeAuthority,
  createLocalWhisperDeviceProof,
  encodeLocalWhisperDeviceAuthority,
  type LocalWhisperDeviceRegistryEntry,
} from '../supervisor/LocalWhisperDeviceAuthority';
import type {
  LocalWhisperProbeRequest,
  LocalWhisperSupervisorResult,
} from '../supervisor/LocalWhisperWorkerSupervisor';
import type { LocalWhisperWorkerLaunchAuthority } from '../supervisor/WorkerProcessOwnership';
import type {
  LocalWhisperDeviceTopologySnapshot,
  LocalWhisperDeviceTopologyAuthority,
} from './LocalWhisperDeviceTopologyAuthority';
import type { LocalWhisperRuntimeLaunchAuthorityFactory } from './LocalWhisperRuntimeLaunchAuthorityFactory';
import type { LocalWhisperModelPathLoadAuthorityFactory } from './LocalWhisperModelPathLoadAuthorityFactory';
import { LocalWhisperProductionResidentWorkerLease } from './LocalWhisperProductionResidentWorkerLease';
import {
  LocalWhisperRuntimeRegistryDiscoveryError,
  type LocalWhisperRuntimeRegistryDiscovery,
} from './LocalWhisperRuntimeRegistryDiscovery';
import type { LocalWhisperWorkerLifecycle } from '../supervisor/LocalWhisperWorkerLifecycle';

const RUNTIME_REGISTRY_DISCOVERY_ATTEMPTS = 3;

export type LocalWhisperQualificationLoadStage =
  | 'MODEL_AUTHORITY'
  | 'RUNTIME_AUTHORITY'
  | 'WORKER_START'
  | 'WARMUP'
  | 'AUTHORITY_REVALIDATION';

export interface LocalWhisperProductionWorkerPortDependencies {
  readonly architecture: 'x64' | 'arm64' | 'other';
  readonly catalog: LocalWhisperAuthenticatedCatalog;
  readonly lifecycle: Pick<
    LocalWhisperWorkerLifecycle,
    'activeFullLoadSession' | 'forceCleanupFullLoad' | 'probeOnce' | 'shutdownFullLoad' | 'startFullLoad'
  >;
  readonly logicalProcessorCount: number;
  readonly modelAuthorities: Pick<LocalWhisperModelPathLoadAuthorityFactory, 'acquire'>;
  readonly onTopology: (snapshot: LocalWhisperDeviceTopologySnapshot) => void;
  /** Qualification-only, content-free progress signal. Production callers do not supply it. */
  readonly onQualificationLoadStage?: (stage: LocalWhisperQualificationLoadStage) => void;
  readonly platform: 'linux' | 'win32' | 'darwin' | 'other';
  readonly randomBytes: (size: number) => Uint8Array;
  readonly registryDiscovery: Pick<LocalWhisperRuntimeRegistryDiscovery, 'discover'>;
  readonly runtimeAuthorities: Pick<LocalWhisperRuntimeLaunchAuthorityFactory, 'acquire'>;
  readonly topology: Pick<LocalWhisperDeviceTopologyAuthority, 'resolve' | 'update'>;
}

type LocalWhisperCoordinatorWorkerFailure = Extract<
  LocalWhisperCoordinatorWorkerResult<never>,
  { readonly success: false }
>;

function failure(code: LocalWhisperCoordinatorWorkerFailure['code']): LocalWhisperCoordinatorWorkerFailure {
  return Object.freeze({ success: false, code });
}

function reportQualificationLoadStage(
  callback: LocalWhisperProductionWorkerPortDependencies['onQualificationLoadStage'],
  stage: LocalWhisperQualificationLoadStage,
): void {
  try {
    callback?.(stage);
  } catch {
    // Qualification diagnostics must not affect a production-equivalent worker lifecycle.
  }
}

function runtimeFor(
  catalog: LocalWhisperAuthenticatedCatalog,
  settings: Parameters<LocalWhisperCoordinatorWorkerPort['probeFresh']>[0]['settings'],
): LocalWhisperCatalogRuntimeEntry | null {
  return (
    catalog.payload.runtimes.find(
      ({ identity }) =>
        identity.engine === settings.engine &&
        identity.packRevision === settings.runtimeRevision &&
        identity.target === settings.execution.target &&
        identity.backend === settings.execution.backend,
    ) ?? null
  );
}

function modelFor(
  catalog: LocalWhisperAuthenticatedCatalog,
  settings: Parameters<LocalWhisperCoordinatorWorkerPort['loadFresh']>[0]['settings'],
): LocalWhisperCatalogModelEntry | null {
  return (
    catalog.payload.models.find(
      ({ identity }) =>
        identity.engine === settings.engine &&
        identity.logicalModel === settings.model.family &&
        identity.artifactRevision === settings.model.revision &&
        identity.variant === settings.model.variant,
    ) ?? null
  );
}

function sameModel(
  actual: LocalWhisperCatalogModelEntry['identity'],
  expected: LocalWhisperCatalogModelEntry['identity'],
): boolean {
  return (
    actual.engine === expected.engine &&
    actual.logicalModel === expected.logicalModel &&
    actual.sourceCheckpointRevision === expected.sourceCheckpointRevision &&
    actual.artifactRevision === expected.artifactRevision &&
    actual.nativeFormat === expected.nativeFormat &&
    actual.variant === expected.variant
  );
}

/** Bridges coordinator probe operations to exact runtime registry and native worker authority. */
export class LocalWhisperProductionWorkerPort implements LocalWhisperCoordinatorWorkerPort {
  private refreshPromise: Promise<void> | null = null;

  public constructor(private readonly dependencies: LocalWhisperProductionWorkerPortDependencies) {}

  /** Enumerates qualified CUDA devices during startup restoration or an explicit settings-surface query. */
  public refreshAvailableDevices(configurationEpoch: number): Promise<void> {
    this.refreshPromise ??= this.runRefresh(configurationEpoch).finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  /** Creates a fresh proof-owning worker and destroys it after one compatibility probe. */
  public async probeFresh(
    request: Parameters<LocalWhisperCoordinatorWorkerPort['probeFresh']>[0],
  ): Promise<LocalWhisperCoordinatorWorkerResult> {
    if (request.signal.aborted) return failure('CANCELLED');
    const runtime = runtimeFor(this.dependencies.catalog, request.settings);
    if (!runtime) return failure('RUNTIME_INCOMPATIBLE');
    const challengeAuthority = new LocalWhisperDeviceChallengeAuthority(this.dependencies.randomBytes);
    try {
      if (request.settings.execution.target === 'cpu') {
        const authority = await this.acquireRuntimeAuthority(runtime, request.epochs.configuration, 'probe');
        const result = await this.dependencies.lifecycle.probeOnce(authority, {
          authorityId: challengeAuthority.authorityId,
          configurationEpoch: request.epochs.configuration,
          deviceBinding: Object.freeze({ kind: 'cpu' as const }),
          revalidateDeviceBinding: () => Promise.resolve(Object.freeze({ kind: 'cpu' as const })),
          validateEvidence: () => Promise.resolve(true),
        });
        return this.fromSupervisor(result);
      }

      const selectedDeviceId = request.settings.execution.deviceId;
      if (!selectedDeviceId) return failure('DEVICE_NOT_FOUND');
      if (request.assessment.selectedDeviceId !== selectedDeviceId) return failure('DEVICE_NOT_FOUND');
      const first = await this.discover(runtime, request.epochs.configuration, request.signal);
      const selected = this.dependencies.topology.resolve(selectedDeviceId, first.registryFingerprint);
      if (!selected) return failure('DEVICE_NOT_FOUND');
      const challenge = challengeAuthority.issue('probe');
      const authority = await this.acquireRuntimeAuthority(
        runtime,
        request.epochs.configuration,
        'probe',
        encodeLocalWhisperDeviceAuthority(
          challengeAuthority.authorityId,
          request.epochs.configuration,
          first.generation,
        ),
      );
      const probeRequest: LocalWhisperProbeRequest = {
        authorityId: challengeAuthority.authorityId,
        configurationEpoch: request.epochs.configuration,
        deviceBinding: Object.freeze({ kind: 'gpuIndex', index: selected.ordinal }),
        probeChallenge: challenge,
        registryFingerprint: first.registryFingerprint,
        revalidateDeviceBinding: async () => {
          const current = await this.discover(runtime, request.epochs.configuration, request.signal);
          const entry = this.dependencies.topology.resolve(selectedDeviceId, current.registryFingerprint);
          return this.sameDevice(entry, selected) ? Object.freeze({ kind: 'gpuIndex', index: entry.ordinal }) : null;
        },
        validateEvidence: (evidence) =>
          Promise.resolve(
            'probeProof' in evidence &&
              challengeAuthority.consume('probe', challenge) &&
              evidence.activatedOrdinal === selected.ordinal &&
              evidence.actualNativeIdentity === selected.nativeIdentity &&
              evidence.primaryExecutionNativeIdentity === selected.nativeIdentity &&
              evidence.registryFingerprint === first.registryFingerprint &&
              evidence.probeProof ===
                createLocalWhisperDeviceProof('probe', {
                  activatedOrdinal: evidence.activatedOrdinal,
                  actualNativeIdentity: evidence.actualNativeIdentity,
                  authorityId: challengeAuthority.authorityId,
                  backendId: runtime.identity.backend,
                  challenge,
                  configurationEpoch: BigInt(request.epochs.configuration),
                  engineId: runtime.identity.engine,
                  primaryExecutionNativeIdentity: evidence.primaryExecutionNativeIdentity,
                  registryFingerprint: first.registryFingerprint,
                  runtimeBuildDigest: runtime.identity.buildRevision,
                  selectedDeviceModelWeightBytes: 0n,
                  selectedOrdinal: selected.ordinal,
                  topologyGeneration: BigInt(first.generation),
                }),
          ),
      };
      return this.fromSupervisor(await this.dependencies.lifecycle.probeOnce(authority, probeRequest));
    } catch (error) {
      if (request.signal.aborted) return failure('CANCELLED');
      if (error instanceof LocalWhisperRuntimeRegistryDiscoveryError) return failure(error.code);
      return failure('DEVICE_PROOF_FAILED');
    } finally {
      challengeAuthority.invalidate();
    }
  }

  /** Loads and warms one separately proven worker, returning residency only after complete success. */
  public async loadFresh(
    request: Parameters<LocalWhisperCoordinatorWorkerPort['loadFresh']>[0],
  ): Promise<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>> {
    if (request.signal.aborted) return failure('CANCELLED');
    if (this.dependencies.platform !== 'linux' && this.dependencies.platform !== 'win32') {
      return failure('PLANNED_UNAVAILABLE');
    }
    const runtime = runtimeFor(this.dependencies.catalog, request.settings);
    const model = modelFor(this.dependencies.catalog, request.settings);
    if (!runtime) return failure('RUNTIME_INCOMPATIBLE');
    if (!model || !model.compatibleRuntimePackRevisions.includes(runtime.identity.packRevision)) {
      return failure('MODEL_INCOMPATIBLE');
    }
    const execution = request.settings.execution;
    const configuredCpuThreads = execution.target === 'cpu' ? execution.cpuThreads : execution.gpuCpuThreads;
    const resolvedCpuThreads = resolveLocalWhisperCpuThreads(
      configuredCpuThreads,
      this.dependencies.logicalProcessorCount,
    );
    if (resolvedCpuThreads === null) return failure('INVALID_SETTINGS');
    let challengeAuthority: LocalWhisperDeviceChallengeAuthority | null = null;
    let modelAuthority: Awaited<ReturnType<LocalWhisperModelPathLoadAuthorityFactory['acquire']>> | null = null;
    try {
      reportQualificationLoadStage(this.dependencies.onQualificationLoadStage, 'MODEL_AUTHORITY');
      modelAuthority = await this.dependencies.modelAuthorities.acquire(this.dependencies.catalog, model);
      const operationAuthority = new LocalWhisperDeviceChallengeAuthority(
        this.dependencies.randomBytes,
        modelAuthority.operationNonce,
      );
      challengeAuthority = operationAuthority;
      const residency = Object.freeze({
        engine: runtime.identity.engine,
        runtimePackRevision: runtime.identity.packRevision,
        target: runtime.identity.target,
        backend: runtime.identity.backend,
        deviceId: request.settings.execution.target === 'gpu' ? request.settings.execution.deviceId : null,
        model: model.identity,
        configuredGpuCpuThreads: execution.target === 'gpu' ? execution.gpuCpuThreads : null,
        resolvedCpuThreads,
        logicalProcessorTopologyGeneration: request.epochs.topology,
        configurationEpoch: request.epochs.configuration,
      });
      let loadRequest: Parameters<LocalWhisperWorkerLifecycle['startFullLoad']>[1];
      let revalidateAuthority: () => Promise<boolean>;
      let workerInputBootstrap: Uint8Array | undefined;

      if (request.settings.execution.target === 'cpu') {
        loadRequest = {
          authorityId: operationAuthority.authorityId,
          configurationEpoch: request.epochs.configuration,
          deviceBinding: Object.freeze({ kind: 'cpu' as const }),
          expectedModelBytes: modelAuthority.modelFileSizeBytes,
          modelPath: modelAuthority.modelFilePath,
          modelLease: modelAuthority.modelLease,
          residency,
          revalidate: modelAuthority.revalidate,
          revalidateDeviceBinding: () => Promise.resolve(Object.freeze({ kind: 'cpu' as const })),
          validateEvidence: (evidence) =>
            Promise.resolve(
              evidence.authorityId === operationAuthority.authorityId &&
                evidence.deviceBinding.kind === 'cpu' &&
                evidence.effectiveBackend === 'cpu' &&
                sameModel(evidence.model, model.identity) &&
                evidence.metadataOnly &&
                evidence.modelFileSizeBytes === modelAuthority?.modelFileSizeBytes &&
                evidence.primaryStateOwnership === 'worker',
            ),
        };
        revalidateAuthority = async () => {
          await modelAuthority?.revalidate();
          return modelAuthority !== null && !modelAuthority.modelLease.released;
        };
      } else {
        const selectedDeviceId = request.settings.execution.deviceId;
        if (!selectedDeviceId || request.assessment.selectedDeviceId !== selectedDeviceId) {
          return failure('DEVICE_NOT_FOUND');
        }
        const first = await this.discover(runtime, request.epochs.configuration, request.signal);
        const selected = this.dependencies.topology.resolve(selectedDeviceId, first.registryFingerprint);
        if (!selected) return failure('DEVICE_NOT_FOUND');
        const challenge = operationAuthority.issue('load');
        let verifiedPostLoadBinding: LocalWhisperWorkerDeviceBinding | null = null;
        workerInputBootstrap = encodeLocalWhisperDeviceAuthority(
          operationAuthority.authorityId,
          request.epochs.configuration,
          first.generation,
        );
        loadRequest = {
          authorityId: operationAuthority.authorityId,
          configurationEpoch: request.epochs.configuration,
          deviceBinding: Object.freeze({ kind: 'gpuIndex' as const, index: selected.ordinal }),
          expectedModelBytes: modelAuthority.modelFileSizeBytes,
          loadChallenge: challenge,
          modelPath: modelAuthority.modelFilePath,
          modelLease: modelAuthority.modelLease,
          registryFingerprint: first.registryFingerprint,
          residency,
          revalidate: modelAuthority.revalidate,
          revalidateDeviceBinding: async () => {
            if (verifiedPostLoadBinding) {
              const binding = verifiedPostLoadBinding;
              verifiedPostLoadBinding = null;
              return binding;
            }
            const current = await this.discover(runtime, request.epochs.configuration, request.signal);
            const entry = this.dependencies.topology.resolve(selectedDeviceId, current.registryFingerprint);
            return this.sameDevice(entry, selected)
              ? Object.freeze({ kind: 'gpuIndex' as const, index: entry.ordinal })
              : null;
          },
          validateEvidence: async (evidence) => {
            const current = await this.discover(runtime, request.epochs.configuration, request.signal);
            const entry = this.dependencies.topology.resolve(selectedDeviceId, current.registryFingerprint);
            const valid =
              this.sameDevice(entry, selected) &&
              'loadProof' in evidence &&
              operationAuthority.consume('load', challenge) &&
              evidence.activatedOrdinal === selected.ordinal &&
              evidence.actualNativeIdentity === selected.nativeIdentity &&
              evidence.primaryExecutionNativeIdentity === selected.nativeIdentity &&
              evidence.registryFingerprint === first.registryFingerprint &&
              evidence.selectedDeviceModelWeightBytes > 0 &&
              evidence.effectiveBackend === runtime.identity.backend &&
              sameModel(evidence.model, model.identity) &&
              evidence.metadataOnly &&
              evidence.modelFileSizeBytes === modelAuthority?.modelFileSizeBytes &&
              evidence.primaryStateOwnership === 'worker' &&
              evidence.loadProof ===
                createLocalWhisperDeviceProof('load', {
                  activatedOrdinal: evidence.activatedOrdinal,
                  actualNativeIdentity: evidence.actualNativeIdentity,
                  authorityId: operationAuthority.authorityId,
                  backendId: runtime.identity.backend,
                  challenge,
                  configurationEpoch: BigInt(request.epochs.configuration),
                  engineId: runtime.identity.engine,
                  primaryExecutionNativeIdentity: evidence.primaryExecutionNativeIdentity,
                  registryFingerprint: first.registryFingerprint,
                  runtimeBuildDigest: runtime.identity.buildRevision,
                  selectedDeviceModelWeightBytes: BigInt(evidence.selectedDeviceModelWeightBytes),
                  selectedOrdinal: selected.ordinal,
                  topologyGeneration: BigInt(first.generation),
                });
            if (valid) {
              verifiedPostLoadBinding = Object.freeze({ kind: 'gpuIndex' as const, index: entry.ordinal });
            }
            return valid;
          },
        };
        revalidateAuthority = async () => {
          await modelAuthority?.revalidate();
          const current = await this.discover(runtime, request.epochs.configuration, request.signal);
          const entry = this.dependencies.topology.resolve(selectedDeviceId, current.registryFingerprint);
          return modelAuthority !== null && !modelAuthority.modelLease.released && this.sameDevice(entry, selected);
        };
      }

      reportQualificationLoadStage(this.dependencies.onQualificationLoadStage, 'RUNTIME_AUTHORITY');
      const runtimeAuthority = await this.dependencies.runtimeAuthorities.acquire({
        catalog: this.dependencies.catalog,
        runtime,
        configurationEpoch: request.epochs.configuration,
        launchMode: 'fullLoad',
        ...(workerInputBootstrap ? { workerInputBootstrap } : {}),
      });
      const authority = runtimeAuthority;
      const cancelStartup = (): void => {
        void this.dependencies.lifecycle.forceCleanupFullLoad().catch(() => undefined);
      };
      request.signal.addEventListener('abort', cancelStartup, { once: true });
      try {
        reportQualificationLoadStage(this.dependencies.onQualificationLoadStage, 'WORKER_START');
        const loaded = await this.dependencies.lifecycle.startFullLoad(authority, loadRequest);
        if (request.signal.aborted) {
          return await this.cleanupAfterCancellation();
        }
        if (!loaded.success) return failure(loaded.error.code);
        const session = this.dependencies.lifecycle.activeFullLoadSession;
        if (!session) return failure('MODEL_LOAD_FAILED');
        reportQualificationLoadStage(this.dependencies.onQualificationLoadStage, 'WARMUP');
        const warmed = await session.warmup(request.epochs.configuration);
        if (request.signal.aborted) {
          return await this.cleanupAfterCancellation();
        }
        if (!warmed.success) {
          const cleaned = await this.dependencies.lifecycle.forceCleanupFullLoad().catch(() => null);
          if (!cleaned?.success) return failure('CLEANUP_FAILED');
          return failure(warmed.error.code);
        }
        let authorityRemainsValid = false;
        try {
          reportQualificationLoadStage(this.dependencies.onQualificationLoadStage, 'AUTHORITY_REVALIDATION');
          authorityRemainsValid = await revalidateAuthority();
        } catch {
          authorityRemainsValid = false;
        }
        if (request.signal.aborted) {
          return await this.cleanupAfterCancellation();
        }
        if (!authorityRemainsValid) {
          const cleaned = await this.dependencies.lifecycle.forceCleanupFullLoad().catch(() => null);
          if (!cleaned?.success) return failure('CLEANUP_FAILED');
          return failure('MODEL_LOAD_FAILED');
        }
        return Object.freeze({
          success: true,
          value: new LocalWhisperProductionResidentWorkerLease({
            configurationEpoch: request.epochs.configuration,
            lifecycle: this.dependencies.lifecycle,
            revalidateAuthority,
            session,
          }),
        });
      } finally {
        request.signal.removeEventListener('abort', cancelStartup);
      }
    } catch (error) {
      if (request.signal.aborted) return await this.cleanupAfterCancellation();
      if (error instanceof LocalWhisperRuntimeRegistryDiscoveryError) return failure(error.code);
      return failure('MODEL_LOAD_FAILED');
    } finally {
      challengeAuthority?.invalidate();
      if (
        modelAuthority &&
        !modelAuthority.modelLease.released &&
        this.dependencies.lifecycle.activeFullLoadSession === null
      ) {
        await modelAuthority.modelLease.release().catch(() => undefined);
      }
    }
  }

  private async runRefresh(configurationEpoch: number): Promise<void> {
    if (!Number.isSafeInteger(configurationEpoch) || configurationEpoch < 0) return;
    const controller = new AbortController();
    const candidates = this.dependencies.catalog.payload.runtimes.filter(
      ({ identity, qualificationStatus }) =>
        identity.platform === this.dependencies.platform &&
        identity.architecture === this.dependencies.architecture &&
        identity.target === 'gpu' &&
        identity.backend === 'cuda' &&
        (qualificationStatus === 'qualified' || this.dependencies.catalog.payload.purpose === 'qualification'),
    );
    for (const runtime of candidates) {
      try {
        await this.discover(runtime, configurationEpoch, controller.signal);
        return;
      } catch {
        // An unavailable or corrupt installed runtime remains fail-closed and does not block the settings snapshot.
      }
    }
  }

  private async cleanupAfterCancellation(): Promise<LocalWhisperCoordinatorWorkerFailure> {
    const cleaned = await this.dependencies.lifecycle.forceCleanupFullLoad().catch(() => null);
    return cleaned && !cleaned.success ? failure('CLEANUP_FAILED') : failure('CANCELLED');
  }

  private async discover(
    runtime: LocalWhisperCatalogRuntimeEntry,
    configurationEpoch: number,
    signal: AbortSignal,
  ): Promise<LocalWhisperDeviceTopologySnapshot> {
    for (let attempt = 1; attempt <= RUNTIME_REGISTRY_DISCOVERY_ATTEMPTS; attempt += 1) {
      try {
        const authority = await this.acquireRuntimeAuthority(runtime, configurationEpoch, 'registry');
        const registry = await this.dependencies.registryDiscovery.discover(authority, signal);
        const snapshot = this.dependencies.topology.update(registry);
        this.dependencies.onTopology(snapshot);
        return snapshot;
      } catch (error) {
        const retryable =
          !signal.aborted &&
          error instanceof LocalWhisperRuntimeRegistryDiscoveryError &&
          error.code === 'DEVICE_PROOF_FAILED';
        if (!retryable || attempt === RUNTIME_REGISTRY_DISCOVERY_ATTEMPTS) throw error;
      }
    }
    throw new LocalWhisperRuntimeRegistryDiscoveryError('DEVICE_PROOF_FAILED');
  }

  private acquireRuntimeAuthority(
    runtime: LocalWhisperCatalogRuntimeEntry,
    configurationEpoch: number,
    launchMode: 'fullLoad' | 'probe' | 'registry',
    workerInputBootstrap?: Uint8Array,
  ): Promise<LocalWhisperWorkerLaunchAuthority> {
    return this.dependencies.runtimeAuthorities.acquire({
      catalog: this.dependencies.catalog,
      runtime,
      configurationEpoch,
      launchMode,
      ...(workerInputBootstrap ? { workerInputBootstrap } : {}),
    });
  }

  private sameDevice(
    current: LocalWhisperDeviceRegistryEntry | null,
    expected: LocalWhisperDeviceRegistryEntry,
  ): current is LocalWhisperDeviceRegistryEntry {
    return (
      current !== null &&
      current.ordinal === expected.ordinal &&
      current.backendId === expected.backendId &&
      current.nativeIdentity === expected.nativeIdentity &&
      current.type === expected.type
    );
  }

  private fromSupervisor(result: LocalWhisperSupervisorResult): LocalWhisperCoordinatorWorkerResult {
    return result.success ? Object.freeze({ success: true, value: undefined }) : failure(result.error.code);
  }
}
