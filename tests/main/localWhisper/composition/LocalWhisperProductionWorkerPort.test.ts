/* eslint-disable max-classes-per-file -- Focused state-owning fakes model independent native boundaries. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  LocalWhisperAuthenticatedCatalog,
  LocalWhisperCatalogPurpose,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import { ManagedArtifactLease } from '@main/localWhisper/filesystem/ManagedArtifactLease';
import {
  LocalWhisperProductionWorkerPort,
  type LocalWhisperProductionWorkerPortDependencies,
} from '@main/localWhisper/composition/LocalWhisperProductionWorkerPort';
import { LocalWhisperRuntimeRegistryDiscoveryError } from '@main/localWhisper/composition/LocalWhisperRuntimeRegistryDiscovery';
import {
  createLocalWhisperDeviceProof,
  createLocalWhisperRegistryFingerprint,
} from '@main/localWhisper/supervisor/LocalWhisperDeviceAuthority';
import type {
  LocalWhisperLoadRequest,
  LocalWhisperProbeRequest,
  LocalWhisperSupervisorResult,
  LocalWhisperTranscriptionRequest,
} from '@main/localWhisper/supervisor/LocalWhisperWorkerSupervisor';
import type { LocalWhisperWorkerLifecycleSession } from '@main/localWhisper/supervisor/LocalWhisperWorkerLifecycle';
import type {
  LocalWhisperModelGuardLaunchAuthority,
  LocalWhisperWorkerLaunchAuthority,
} from '@main/localWhisper/supervisor/WorkerProcessOwnership';
import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  toLocalWhisperOpaqueDeviceId,
  type LocalWhisperBackend,
  type LocalWhisperPublicSettings,
  type LocalWhisperRevisionId,
} from '@shared/localWhisper';
import { createFixtureCatalogPayload } from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';

const RUNTIME_DIGEST = 'a'.repeat(64);
const DEVICE_ID = toLocalWhisperOpaqueDeviceId(`device-v1-${'b'.repeat(64)}`)!;
const ENTRY = Object.freeze({
  ordinal: 0,
  type: 'gpu' as const,
  backendId: 'cuda',
  nativeIdentity: '0000:01:00.0',
});
const REGISTRY = Object.freeze({
  engineId: 'whisperCpp',
  runtimeBuildDigest: RUNTIME_DIGEST,
  backendId: 'cuda',
  entries: Object.freeze([ENTRY]),
});
const REGISTRY_FINGERPRINT = createLocalWhisperRegistryFingerprint(REGISTRY);
const MODEL_DIGEST = 'c'.repeat(64);

function values(
  backend: 'cpu' | 'cuda',
  options: {
    readonly purpose?: LocalWhisperCatalogPurpose;
    readonly qualificationStatus?: 'qualified' | 'estimateOnly' | 'planned';
  } = {},
): {
  readonly catalog: LocalWhisperAuthenticatedCatalog;
  readonly settings: LocalWhisperPublicSettings;
} {
  const source = createFixtureCatalogPayload();
  const sourceRuntime = source.runtimes[0];
  const model = source.models[0];
  assert.ok(sourceRuntime && model);
  const target = backend === 'cpu' ? ('cpu' as const) : ('gpu' as const);
  const runtime = Object.freeze({
    ...sourceRuntime,
    qualificationStatus: options.qualificationStatus ?? sourceRuntime.qualificationStatus,
    identity: Object.freeze({
      ...sourceRuntime.identity,
      backend,
      target,
      buildRevision: RUNTIME_DIGEST as LocalWhisperRevisionId,
    }),
  });
  const payload = Object.freeze({
    ...source,
    purpose: options.purpose ?? source.purpose,
    runtimes: Object.freeze([runtime]),
  });
  return {
    catalog: {
      payload,
      signingKeyId: runtime.identity.signingKeyId,
      isRuntimeDenylisted: () => false,
      isModelDenylisted: () => false,
    },
    settings: Object.freeze({
      schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
      engine: 'whisperCpp',
      runtimeRevision: runtime.identity.packRevision,
      model: Object.freeze({
        family: model.identity.logicalModel,
        revision: model.identity.artifactRevision,
        variant: model.identity.variant,
      }),
      language: 'auto',
      initialPrompt: '',
      decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
      execution:
        backend === 'cpu'
          ? Object.freeze({ target: 'cpu' as const, backend, cpuThreads: 'auto' as const })
          : Object.freeze({
              target: 'gpu' as const,
              backend,
              deviceId: DEVICE_ID,
              gpuCpuThreads: LOCAL_WHISPER_AUTO_CPU_THREADS,
            }),
    }),
  };
}

class RuntimeAuthorities {
  public readonly calls: Array<{ readonly launchMode: string; readonly bootstrap: Uint8Array | undefined }> = [];

  public constructor(private readonly failAcquisition = false) {}

  public acquire(input: { readonly launchMode: string; readonly workerInputBootstrap?: Uint8Array }): Promise<never> {
    this.calls.push({ launchMode: input.launchMode, bootstrap: input.workerInputBootstrap });
    if (this.failAcquisition) return Promise.reject(new Error('runtime revalidation failed'));
    return Promise.resolve({
      launchMode: input.launchMode,
      workerInputBootstrap: input.workerInputBootstrap,
    } as never);
  }
}

class ModelAuthorities {
  public acquire(): Promise<never> {
    return Promise.reject(new Error('Model authority is not expected during a probe'));
  }
}

class RegistryDiscovery {
  public calls = 0;

  public constructor(private failuresRemaining = 0) {}

  public discover(): Promise<typeof REGISTRY> {
    this.calls += 1;
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      return Promise.reject(new LocalWhisperRuntimeRegistryDiscoveryError('DEVICE_PROOF_FAILED'));
    }
    return Promise.resolve(REGISTRY);
  }
}

class Topology {
  public update() {
    return Object.freeze({
      generation: 3,
      registryFingerprint: REGISTRY_FINGERPRINT,
      devices: Object.freeze([
        Object.freeze({
          id: DEVICE_ID,
          label: 'NVIDIA GPU 1',
          vendor: 'nvidia' as const,
          available: true,
          eligibleBackends: Object.freeze(['cuda' as const]),
        }),
      ]),
    });
  }

  public resolve(deviceId: typeof DEVICE_ID, fingerprint: string) {
    return deviceId === DEVICE_ID && fingerprint === REGISTRY_FINGERPRINT ? ENTRY : null;
  }
}

class Lifecycle {
  public activeFullLoadSession = null;
  public bootstraps: Array<Uint8Array | undefined> = [];

  public forceCleanupFullLoad() {
    return Promise.resolve(null);
  }

  public shutdownFullLoad() {
    return Promise.resolve(null);
  }

  public startFullLoad(): Promise<never> {
    return Promise.reject(new Error('Full load is not expected in this probe harness'));
  }

  public async probeOnce(authority: { readonly workerInputBootstrap?: Uint8Array }, request: LocalWhisperProbeRequest) {
    this.bootstraps.push(authority.workerInputBootstrap);
    const before = await request.revalidateDeviceBinding();
    assert.deepEqual(before, request.deviceBinding);
    const evidence =
      request.deviceBinding.kind === 'cpu' || !('probeChallenge' in request)
        ? ({ authorityId: request.authorityId, deviceBinding: request.deviceBinding } as never)
        : ({
            activatedOrdinal: ENTRY.ordinal,
            actualNativeIdentity: ENTRY.nativeIdentity,
            authorityId: request.authorityId,
            deviceBinding: request.deviceBinding,
            primaryExecutionNativeIdentity: ENTRY.nativeIdentity,
            probeProof: createLocalWhisperDeviceProof('probe', {
              activatedOrdinal: ENTRY.ordinal,
              actualNativeIdentity: ENTRY.nativeIdentity,
              authorityId: request.authorityId,
              backendId: ENTRY.backendId,
              challenge: request.probeChallenge,
              configurationEpoch: 7n,
              engineId: 'whisperCpp',
              primaryExecutionNativeIdentity: ENTRY.nativeIdentity,
              registryFingerprint: REGISTRY_FINGERPRINT,
              runtimeBuildDigest: RUNTIME_DIGEST,
              selectedDeviceModelWeightBytes: 0n,
              selectedOrdinal: ENTRY.ordinal,
              topologyGeneration: 3n,
            }),
            registryFingerprint: REGISTRY_FINGERPRINT,
          } as never);
    assert.equal(await request.validateEvidence(evidence), true);
    assert.deepEqual(await request.revalidateDeviceBinding(), request.deviceBinding);
    return Object.freeze({ success: true as const, state: 'probed' as const, value: undefined });
  }
}

function supervisorSuccess<T>(
  state: 'idle' | 'loaded' | 'probed' | 'warmed',
  value: T,
): LocalWhisperSupervisorResult<T> {
  return Object.freeze({ success: true, state, value });
}

function supervisorFailure(code: 'MODEL_LOAD_FAILED' | 'WARMUP_FAILED'): LocalWhisperSupervisorResult {
  return {
    success: false,
    state: 'idle',
    error: {
      code,
      stage: code === 'WARMUP_FAILED' ? 'warmup' : 'modelLoad',
      recoveryAction: 'retry',
      retryable: true,
      stateImpact: 'notReady',
    } as never,
  };
}

class LoadSession implements LocalWhisperWorkerLifecycleSession {
  public readonly calls: string[] = [];

  public constructor(
    private readonly failWarmup: boolean,
    private readonly failCleanup: boolean,
  ) {}

  public cancel(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('cancel');
    return Promise.resolve(supervisorSuccess('warmed', undefined));
  }

  public forceCleanup(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('forceCleanup');
    return Promise.resolve(
      this.failCleanup ? supervisorFailure('MODEL_LOAD_FAILED') : supervisorSuccess('idle', undefined),
    );
  }

  public load(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(supervisorSuccess('loaded', undefined));
  }

  public probe(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(supervisorSuccess('probed', undefined));
  }

  public shutdown(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('shutdown');
    return Promise.resolve(supervisorSuccess('idle', undefined));
  }

  public startAndHandshake(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(supervisorSuccess('loaded', undefined));
  }

  public transcribe(_request: LocalWhisperTranscriptionRequest): Promise<LocalWhisperSupervisorResult<string>> {
    this.calls.push('transcribe');
    return Promise.resolve(supervisorSuccess('warmed', 'fixture transcript'));
  }

  public unload(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('unload');
    return Promise.resolve(supervisorSuccess('idle', undefined));
  }

  public warmup(): Promise<LocalWhisperSupervisorResult> {
    this.calls.push('warmup');
    return Promise.resolve(
      this.failWarmup ? supervisorFailure('WARMUP_FAILED') : supervisorSuccess('warmed', undefined),
    );
  }
}

class LoadLifecycle {
  public activeFullLoadSession: LocalWhisperWorkerLifecycleSession | null = null;
  public readonly authorities: LocalWhisperWorkerLaunchAuthority[] = [];
  public readonly loadRequests: LocalWhisperLoadRequest[] = [];
  private activeModelLease: ManagedArtifactLease | null = null;

  public constructor(
    public readonly session: LoadSession,
    private readonly backend: 'cpu' | 'cuda',
    private readonly modelIdentity: LocalWhisperAuthenticatedCatalog['payload']['models'][number]['identity'],
    private readonly onLoadStarted?: () => void,
  ) {}

  public async startFullLoad(
    authority: LocalWhisperWorkerLaunchAuthority,
    request: LocalWhisperLoadRequest,
  ): Promise<LocalWhisperSupervisorResult> {
    this.authorities.push(authority);
    this.loadRequests.push(request);
    await request.revalidate();
    assert.deepEqual(await request.revalidateDeviceBinding(), request.deviceBinding);
    const evidence =
      this.backend === 'cpu' || !('loadChallenge' in request)
        ? ({
            authorityId: request.authorityId,
            deviceBinding: request.deviceBinding,
            effectiveBackend: 'cpu',
            model: this.modelIdentity,
            modelSha256: MODEL_DIGEST,
            primaryStateOwnership: 'worker',
          } as never)
        : ({
            activatedOrdinal: ENTRY.ordinal,
            actualNativeIdentity: ENTRY.nativeIdentity,
            authorityId: request.authorityId,
            deviceBinding: request.deviceBinding,
            effectiveBackend: 'cuda',
            loadProof: createLocalWhisperDeviceProof('load', {
              activatedOrdinal: ENTRY.ordinal,
              actualNativeIdentity: ENTRY.nativeIdentity,
              authorityId: request.authorityId,
              backendId: ENTRY.backendId,
              challenge: request.loadChallenge,
              configurationEpoch: 7n,
              engineId: 'whisperCpp',
              primaryExecutionNativeIdentity: ENTRY.nativeIdentity,
              registryFingerprint: REGISTRY_FINGERPRINT,
              runtimeBuildDigest: RUNTIME_DIGEST,
              selectedDeviceModelWeightBytes: 1024n,
              selectedOrdinal: ENTRY.ordinal,
              topologyGeneration: 3n,
            }),
            model: this.modelIdentity,
            modelSha256: MODEL_DIGEST,
            primaryExecutionNativeIdentity: ENTRY.nativeIdentity,
            primaryStateOwnership: 'worker',
            registryFingerprint: REGISTRY_FINGERPRINT,
            selectedDeviceModelWeightBytes: 1024,
          } as never);
    if (!(await request.validateEvidence(evidence))) return supervisorFailure('MODEL_LOAD_FAILED');
    assert.deepEqual(await request.revalidateDeviceBinding(), request.deviceBinding);
    this.activeFullLoadSession = this.session;
    this.activeModelLease = request.modelLease;
    this.onLoadStarted?.();
    if (this.onLoadStarted) await new Promise<void>((resolve) => setImmediate(resolve));
    return supervisorSuccess('loaded', undefined);
  }

  public async forceCleanupFullLoad(): Promise<LocalWhisperSupervisorResult | null> {
    const active = this.activeFullLoadSession;
    if (!active) return null;
    const result = await active.forceCleanup();
    if (result.success) {
      this.activeFullLoadSession = null;
      await this.activeModelLease?.release();
      this.activeModelLease = null;
    }
    return result;
  }

  public probeOnce(): Promise<never> {
    return Promise.reject(new Error('Probe is not expected in this load harness'));
  }

  public async shutdownFullLoad(): Promise<LocalWhisperSupervisorResult | null> {
    const active = this.activeFullLoadSession;
    if (!active) return null;
    const result = await active.shutdown();
    if (result.success) {
      this.activeFullLoadSession = null;
      await this.activeModelLease?.release();
      this.activeModelLease = null;
    }
    return result;
  }
}

class LoadModelAuthorities {
  public calls = 0;
  public revalidationCalls = 0;
  public readonly lease: ManagedArtifactLease;

  public constructor(
    private readonly released: { value: number },
    private readonly failRevalidationAtCall: number | null,
  ) {
    this.lease = new ManagedArtifactLease(
      {
        artifactId: 'load-model-fixture' as never,
        artifactKind: 'model',
        canonicalName: `model-${'d'.repeat(64)}`,
        catalogDigest: 'e'.repeat(64),
        identity: {
          deviceOrVolumeId: '1',
          fileId: '2',
          linkCount: 1,
          mode: 0o700,
          parentFileId: '1',
          sizeBytes: 1,
          type: 'directory',
        },
        purpose: 'load',
      },
      'load-model-native-token',
      () => {
        this.released.value += 1;
        return Promise.resolve();
      },
    );
  }

  public acquire(): Promise<LocalWhisperModelGuardLaunchAuthority> {
    this.calls += 1;
    return Promise.resolve(
      Object.freeze({
        modelFileIdentity: Object.freeze({
          deviceOrVolumeId: '1',
          fileId: '3',
          linkCount: 1,
          mode: 0o400,
          parentFileId: '2',
          sizeBytes: 200,
          type: 'regular' as const,
        }),
        modelFilePath: '/managed/models/model/file-model',
        modelFileSha256: MODEL_DIGEST,
        modelFileSizeBytes: 200,
        modelIdentityKey: 'fixture-model',
        modelLease: this.lease,
        modelLeaseTokenDigest: 'f'.repeat(64),
        operationNonce: Uint8Array.from({ length: 16 }, (_value, index) => index + 1),
        revalidate: () => {
          this.revalidationCalls += 1;
          return this.failRevalidationAtCall === this.revalidationCalls
            ? Promise.reject(new Error('model revalidation failed'))
            : Promise.resolve();
        },
      }),
    );
  }
}

function request(settings: LocalWhisperPublicSettings, backend: LocalWhisperBackend) {
  return {
    settings,
    assessment: {
      selectedDeviceId: backend === 'cpu' ? null : DEVICE_ID,
    } as never,
    epochs: {
      provider: 1,
      configuration: 7,
      inventory: 1,
      topology: 1,
      capability: 1,
      worker: 1,
    },
    requestId: 'probe-request',
    signal: new AbortController().signal,
  };
}

function harness(
  backend: 'cpu' | 'cuda',
  options: Parameters<typeof values>[1] & { readonly registryFailures?: number } = {},
) {
  const selected = values(backend, options);
  const authorities = new RuntimeAuthorities();
  const registry = new RegistryDiscovery(options.registryFailures);
  const lifecycle = new Lifecycle();
  let topologyUpdates = 0;
  const dependencies: LocalWhisperProductionWorkerPortDependencies = {
    architecture: 'x64',
    catalog: selected.catalog,
    lifecycle,
    logicalProcessorCount: 8,
    modelAuthorities: new ModelAuthorities(),
    onTopology: () => {
      topologyUpdates += 1;
    },
    platform: 'linux',
    randomBytes: (size) => Uint8Array.from({ length: size }, (_value, index) => index + 1),
    registryDiscovery: registry,
    runtimeAuthorities: authorities,
    topology: new Topology(),
  };
  return {
    authorities,
    lifecycle,
    port: new LocalWhisperProductionWorkerPort(dependencies),
    registry,
    selected,
    topologyUpdates: () => topologyUpdates,
  };
}

function loadHarness(
  backend: 'cpu' | 'cuda',
  options: {
    readonly failModelRevalidation?: boolean;
    readonly failPostWarmupRevalidation?: boolean;
    readonly failCleanup?: boolean;
    readonly failRuntimeAcquisition?: boolean;
    readonly failWarmup?: boolean;
    readonly onLoadStarted?: () => void;
  } = {},
) {
  const selected = values(backend);
  const model = selected.catalog.payload.models[0];
  assert.ok(model);
  const released = { value: 0 };
  const modelAuthorities = new LoadModelAuthorities(
    released,
    options.failModelRevalidation ? 1 : options.failPostWarmupRevalidation ? 2 : null,
  );
  const runtimeAuthorities = new RuntimeAuthorities(options.failRuntimeAcquisition ?? false);
  const registry = new RegistryDiscovery();
  const lifecycle = new LoadLifecycle(
    new LoadSession(options.failWarmup ?? false, options.failCleanup ?? false),
    backend,
    model.identity,
    options.onLoadStarted,
  );
  const port = new LocalWhisperProductionWorkerPort({
    architecture: 'x64',
    catalog: selected.catalog,
    lifecycle,
    logicalProcessorCount: 8,
    modelAuthorities,
    onTopology: () => undefined,
    platform: 'linux',
    randomBytes: (size) => Uint8Array.from({ length: size }, (_value, index) => index + 1),
    registryDiscovery: registry,
    runtimeAuthorities,
    topology: new Topology(),
  });
  return { lifecycle, modelAuthorities, port, registry, released, runtimeAuthorities, selected };
}

describe('LocalWhisperProductionWorkerPort', () => {
  it('refreshes qualified CUDA topology for startup restoration or an explicit settings query', async () => {
    const value = harness('cuda');
    await value.port.refreshAvailableDevices(7);
    assert.equal(value.registry.calls, 1);
    assert.equal(value.topologyUpdates(), 1);
    assert.deepEqual(
      value.authorities.calls.map(({ launchMode }) => launchMode),
      ['registry'],
    );
  });

  it('retries bounded invalid registry subprocess output and still fails closed', async () => {
    const recovered = harness('cuda', { registryFailures: 2 });
    await recovered.port.refreshAvailableDevices(7);
    assert.equal(recovered.registry.calls, 3);
    assert.equal(recovered.topologyUpdates(), 1);
    assert.deepEqual(
      recovered.authorities.calls.map(({ launchMode }) => launchMode),
      ['registry', 'registry', 'registry'],
    );

    const refreshRejected = harness('cuda', { registryFailures: 3 });
    await assert.doesNotReject(refreshRejected.port.refreshAvailableDevices(7));
    assert.equal(refreshRejected.registry.calls, 3);
    assert.equal(refreshRejected.topologyUpdates(), 0);
    assert.deepEqual(
      refreshRejected.authorities.calls.map(({ launchMode }) => launchMode),
      ['registry', 'registry', 'registry'],
    );

    const rejected = harness('cuda', { registryFailures: 3 });
    assert.deepEqual(await rejected.port.probeFresh(request(rejected.selected.settings, 'cuda')), {
      success: false,
      code: 'DEVICE_PROOF_FAILED',
    });
  });

  it('admits a planned CUDA candidate only inside the isolated qualification-purpose graph', async () => {
    const qualification = harness('cuda', { purpose: 'qualification', qualificationStatus: 'planned' });
    await qualification.port.refreshAvailableDevices(7);
    assert.equal(qualification.registry.calls, 1);

    const production = harness('cuda', { purpose: 'production', qualificationStatus: 'planned' });
    await production.port.refreshAvailableDevices(7);
    assert.equal(production.registry.calls, 0);
  });

  it('runs a CPU probe without creating GPU registry or device authority input', async () => {
    const value = harness('cpu');
    assert.deepEqual(await value.port.probeFresh(request(value.selected.settings, 'cpu')), {
      success: true,
      value: undefined,
    });
    assert.equal(value.registry.calls, 0);
    assert.deepEqual(
      value.authorities.calls.map(({ launchMode }) => launchMode),
      ['probe'],
    );
    assert.equal(value.lifecycle.bootstraps[0], undefined);
  });

  it('re-enumerates an exact GPU registry around probe and validates native proof', async () => {
    const value = harness('cuda');
    assert.deepEqual(await value.port.probeFresh(request(value.selected.settings, 'cuda')), {
      success: true,
      value: undefined,
    });
    assert.equal(value.registry.calls, 3);
    assert.equal(value.topologyUpdates(), 3);
    assert.deepEqual(
      value.authorities.calls.map(({ launchMode }) => launchMode),
      ['registry', 'probe', 'registry', 'registry'],
    );
    assert.equal(value.lifecycle.bootstraps[0]?.byteLength, 40);
  });

  it('loads, warms, transcribes, cancels, revalidates, and unloads a CPU resident worker', async () => {
    const value = loadHarness('cpu');
    const loaded = await value.port.loadFresh(request(value.selected.settings, 'cpu'));
    assert.equal(loaded.success, true);
    if (!loaded.success) return;
    assert.deepEqual(
      value.runtimeAuthorities.calls.map(({ launchMode }) => launchMode),
      ['fullLoad'],
    );
    const authority = value.lifecycle.authorities[0];
    assert.ok(authority?.modelGuardAuthority);
    assert.equal(
      value.lifecycle.loadRequests[0]?.authorityId,
      Buffer.from(authority.modelGuardAuthority.operationNonce).toString('base64url'),
    );
    assert.deepEqual(value.lifecycle.session.calls, ['warmup']);
    assert.equal(value.modelAuthorities.revalidationCalls, 2);
    assert.deepEqual(
      await loaded.value.transcribe({
        audio: Uint8Array.from([1, 2, 3]),
        requestId: 'transcription-fixture',
        settings: value.selected.settings as never,
        settingsEpoch: 7,
        signal: new AbortController().signal,
      }),
      { success: true, value: 'fixture transcript' },
    );
    assert.deepEqual(await loaded.value.cancel(), { success: true, value: undefined });
    assert.equal(await loaded.value.revalidate(), true);
    assert.deepEqual(await loaded.value.unload(), { success: true, value: undefined });
    assert.deepEqual(value.lifecycle.session.calls, ['warmup', 'transcribe', 'cancel', 'shutdown']);
    assert.equal(value.released.value, 1);
  });

  it('revalidates exact GPU registry and proof before returning a CUDA resident worker', async () => {
    const value = loadHarness('cuda');
    const loaded = await value.port.loadFresh(request(value.selected.settings, 'cuda'));
    assert.equal(loaded.success, true);
    if (!loaded.success) return;
    assert.equal(value.registry.calls, 4);
    assert.deepEqual(
      value.runtimeAuthorities.calls.map(({ launchMode }) => launchMode),
      ['registry', 'fullLoad', 'registry', 'registry', 'registry'],
    );
    const authority = value.lifecycle.authorities[0];
    assert.ok(authority?.modelGuardAuthority);
    assert.ok(authority.workerInputBootstrap);
    assert.equal(authority.workerInputBootstrap.byteLength, 40);
    assert.deepEqual(authority.workerInputBootstrap.subarray(8, 24), authority.modelGuardAuthority.operationNonce);
    assert.equal(await loaded.value.revalidate(), true);
    assert.equal(value.registry.calls, 5);
    assert.equal(await loaded.value.terminate(), true);
    assert.deepEqual(value.lifecycle.session.calls, ['warmup', 'forceCleanup']);
    assert.equal(value.released.value, 1);
  });

  it('resolves GPU CPU threads into exact reusable residency identity before launch', async () => {
    for (const configured of [LOCAL_WHISPER_AUTO_CPU_THREADS, 1, 4, 8] as const) {
      const value = loadHarness('cuda');
      const model = value.selected.catalog.payload.models[0];
      assert.ok(model);
      const execution = value.selected.settings.execution;
      assert.equal(execution.target, 'gpu');
      if (execution.target !== 'gpu') return;
      const settings = Object.freeze({
        ...value.selected.settings,
        execution: Object.freeze({ ...execution, gpuCpuThreads: configured }),
      });
      const loaded = await value.port.loadFresh(request(settings, 'cuda'));
      assert.equal(loaded.success, true);
      if (!loaded.success) return;
      assert.deepEqual(value.lifecycle.loadRequests[0]?.residency, {
        engine: 'whisperCpp',
        runtimePackRevision: settings.runtimeRevision,
        target: 'gpu',
        backend: 'cuda',
        deviceId: DEVICE_ID,
        model: model.identity,
        configuredGpuCpuThreads: configured,
        resolvedCpuThreads: configured === LOCAL_WHISPER_AUTO_CPU_THREADS ? 8 : configured,
        logicalProcessorTopologyGeneration: 1,
        configurationEpoch: 7,
      });
      assert.equal(await loaded.value.terminate(), true);
    }
  });

  it('rejects stale GPU thread values before acquiring model or worker authority', async () => {
    const value = loadHarness('cuda');
    const execution = value.selected.settings.execution;
    assert.equal(execution.target, 'gpu');
    if (execution.target !== 'gpu') return;
    const settings = Object.freeze({
      ...value.selected.settings,
      execution: Object.freeze({ ...execution, gpuCpuThreads: 9 }),
    });
    assert.deepEqual(await value.port.loadFresh(request(settings, 'cuda')), {
      success: false,
      code: 'INVALID_SETTINGS',
    });
    assert.equal(value.modelAuthorities.calls, 0);
    assert.equal(value.runtimeAuthorities.calls.length, 0);
    assert.equal(value.registry.calls, 0);
    assert.equal(value.lifecycle.loadRequests.length, 0);
  });

  it('cleans the worker and model lease when warmup fails', async () => {
    const value = loadHarness('cpu', { failWarmup: true });
    assert.deepEqual(await value.port.loadFresh(request(value.selected.settings, 'cpu')), {
      success: false,
      code: 'WARMUP_FAILED',
    });
    assert.deepEqual(value.lifecycle.session.calls, ['warmup', 'forceCleanup']);
    assert.equal(value.lifecycle.activeFullLoadSession, null);
    assert.equal(value.released.value, 1);
  });

  it('cleans loaded state when final authority revalidation fails after warmup', async () => {
    const value = loadHarness('cpu', { failPostWarmupRevalidation: true });
    assert.deepEqual(await value.port.loadFresh(request(value.selected.settings, 'cpu')), {
      success: false,
      code: 'MODEL_LOAD_FAILED',
    });
    assert.deepEqual(value.lifecycle.session.calls, ['warmup', 'forceCleanup']);
    assert.equal(value.modelAuthorities.revalidationCalls, 2);
    assert.equal(value.lifecycle.activeFullLoadSession, null);
    assert.equal(value.released.value, 1);
  });

  it('reports and retains uncertain ownership when warmup cleanup fails', async () => {
    const value = loadHarness('cpu', { failCleanup: true, failWarmup: true });
    assert.deepEqual(await value.port.loadFresh(request(value.selected.settings, 'cpu')), {
      success: false,
      code: 'CLEANUP_FAILED',
    });
    assert.deepEqual(value.lifecycle.session.calls, ['warmup', 'forceCleanup']);
    assert.notEqual(value.lifecycle.activeFullLoadSession, null);
    assert.equal(value.released.value, 0);
  });

  it('releases the model lease after model or runtime revalidation failure', async () => {
    for (const options of [{ failModelRevalidation: true }, { failRuntimeAcquisition: true }]) {
      const value = loadHarness('cpu', options);
      assert.deepEqual(await value.port.loadFresh(request(value.selected.settings, 'cpu')), {
        success: false,
        code: 'MODEL_LOAD_FAILED',
      });
      assert.equal(value.lifecycle.activeFullLoadSession, null);
      assert.equal(value.released.value, 1);
    }
  });

  it('rejects a cancelled load before acquiring model or runtime authority', async () => {
    const value = loadHarness('cpu');
    const controller = new AbortController();
    controller.abort();
    assert.deepEqual(
      await value.port.loadFresh({ ...request(value.selected.settings, 'cpu'), signal: controller.signal }),
      { success: false, code: 'CANCELLED' },
    );
    assert.equal(value.modelAuthorities.calls, 0);
    assert.equal(value.runtimeAuthorities.calls.length, 0);
    assert.equal(value.released.value, 0);
  });

  it('force-cleans an in-flight load when its request is cancelled', async () => {
    const controller = new AbortController();
    const value = loadHarness('cpu', { onLoadStarted: () => controller.abort() });
    assert.deepEqual(
      await value.port.loadFresh({ ...request(value.selected.settings, 'cpu'), signal: controller.signal }),
      { success: false, code: 'CANCELLED' },
    );
    assert.deepEqual(value.lifecycle.session.calls, ['forceCleanup']);
    assert.equal(value.lifecycle.activeFullLoadSession, null);
    assert.equal(value.released.value, 1);
  });
});
