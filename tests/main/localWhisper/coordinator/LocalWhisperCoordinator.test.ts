/* eslint-disable max-classes-per-file -- focused stateful fakes model the coordinator's injected ports. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperCoordinator } from '@main/localWhisper/coordinator/LocalWhisperCoordinator';
import type {
  LocalWhisperArtifactRemovalCommand,
  LocalWhisperArtifactRemovalResult,
  LocalWhisperCoordinatorArtifactPort,
  LocalWhisperCoordinatorCapabilityPort,
  LocalWhisperCoordinatorCapabilityRequest,
  LocalWhisperCoordinatorDependencies,
  LocalWhisperCoordinatorInventoryPort,
  LocalWhisperCoordinatorSettingsPort,
  LocalWhisperCoordinatorWorkerPort,
  LocalWhisperCoordinatorWorkerResult,
  LocalWhisperResidentWorkerLease,
} from '@main/localWhisper/coordinator/LocalWhisperCoordinatorTypes';
import type {
  LocalWhisperCapabilityAssessment,
  LocalWhisperCapabilityPreflightResult,
} from '@main/localWhisper/capability/LocalWhisperCapabilityService';
import {
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  toLocalWhisperArtifactId,
  toLocalWhisperRevisionId,
  type LocalWhisperArtifactSetupState,
  type LocalWhisperFailureCode,
  type LocalWhisperSettings,
} from '@shared/localWhisper';

type WorkerProbeRequest = Parameters<LocalWhisperCoordinatorWorkerPort['probeFresh']>[0];
type WorkerLoadRequest = Parameters<LocalWhisperCoordinatorWorkerPort['loadFresh']>[0];

function revision(value: string) {
  const result = toLocalWhisperRevisionId(value);
  if (!result) throw new Error('Invalid fixture revision');
  return result;
}

function artifactId(value: string) {
  const result = toLocalWhisperArtifactId(value);
  if (!result) throw new Error('Invalid fixture artifact ID');
  return result;
}

function settings(overrides: Partial<LocalWhisperSettings> = {}): LocalWhisperSettings {
  return {
    schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
    engine: 'whisperCpp',
    runtimeRevision: revision('runtime-cpu-v1'),
    model: { family: 'base', revision: revision('model-base-v1'), variant: 'full' },
    language: 'auto',
    initialPrompt: 'private prompt',
    decoding: { strategy: 'greedy', temperatureHundredths: 0 },
    execution: { target: 'cpu', backend: 'cpu', cpuThreads: 'auto' },
    ...overrides,
  };
}

const ASSESSMENT: LocalWhisperCapabilityAssessment = Object.freeze({
  supportTier: 'Production',
  runtimeSetup: 'Installed',
  modelSetup: 'Installed',
  selectedDeviceId: null,
  capabilityFingerprint: 'a'.repeat(64),
  resources: Object.freeze({
    success: true,
    failureCode: null,
    evidence: 'catalog',
    requiredRamBytes: 1024,
    requiredVramBytes: 'notApplicable',
    freeRamBytes: null,
    freeVramBytes: null,
  }),
});

const SUCCESSFUL_PREFLIGHT: LocalWhisperCapabilityPreflightResult = Object.freeze({
  success: true,
  assessment: ASSESSMENT,
});

class FakeSettingsPort implements LocalWhisperCoordinatorSettingsPort {
  public saved: LocalWhisperSettings[] = [];
  public resetCount = 0;
  public failPersistence = false;
  public rejectMutations = false;

  public validateInitial(candidate: unknown): LocalWhisperSettings | null {
    return this.validateShape(candidate);
  }

  public validate(candidate: unknown): LocalWhisperSettings | null {
    if (this.rejectMutations) return null;
    return this.validateShape(candidate);
  }

  public supportTier(): 'Production' {
    return 'Production';
  }

  private validateShape(candidate: unknown): LocalWhisperSettings | null {
    if (typeof candidate !== 'object' || candidate === null || !('engine' in candidate)) return null;
    return candidate.engine === 'whisperCpp' ? (structuredClone(candidate) as LocalWhisperSettings) : null;
  }

  public defaultSettings(): LocalWhisperSettings {
    return settings({ initialPrompt: '' });
  }

  public async save(candidate: LocalWhisperSettings): Promise<void> {
    if (this.failPersistence) throw new Error('synthetic persistence failure');
    this.saved.push(structuredClone(candidate));
  }

  public async reset(): Promise<void> {
    if (this.failPersistence) throw new Error('synthetic persistence failure');
    this.resetCount += 1;
  }
}

class FakeCapabilityPort implements LocalWhisperCoordinatorCapabilityPort {
  public calls: LocalWhisperCoordinatorCapabilityRequest[] = [];
  public result: LocalWhisperCapabilityPreflightResult = SUCCESSFUL_PREFLIGHT;
  public deferred: {
    readonly promise: Promise<LocalWhisperCapabilityPreflightResult>;
    readonly resolve: (value: LocalWhisperCapabilityPreflightResult) => void;
  } | null = null;

  public preflight(request: LocalWhisperCoordinatorCapabilityRequest): Promise<LocalWhisperCapabilityPreflightResult> {
    this.calls.push(request);
    return this.deferred?.promise ?? Promise.resolve(this.result);
  }
}

class FakeResidentWorker implements LocalWhisperResidentWorkerLease {
  public unloadCount = 0;
  public terminateCount = 0;
  public shutdownCount = 0;
  public cancelCount = 0;
  public revalidateResult = true;
  public cancelResult: LocalWhisperCoordinatorWorkerResult = { success: true, value: undefined };
  public unloadResult: LocalWhisperCoordinatorWorkerResult = { success: true, value: undefined };
  public terminateResult = true;
  public shutdownResult = true;
  public transcriptionResult: LocalWhisperCoordinatorWorkerResult<string> = { success: true, value: 'fixture text' };
  public deferredTranscription: {
    readonly promise: Promise<LocalWhisperCoordinatorWorkerResult<string>>;
    readonly resolve: (value: LocalWhisperCoordinatorWorkerResult<string>) => void;
  } | null = null;

  public transcribe(): Promise<LocalWhisperCoordinatorWorkerResult<string>> {
    return this.deferredTranscription?.promise ?? Promise.resolve(this.transcriptionResult);
  }

  public cancel(): Promise<LocalWhisperCoordinatorWorkerResult> {
    this.cancelCount += 1;
    return Promise.resolve(this.cancelResult);
  }

  public revalidate(): Promise<boolean> {
    return Promise.resolve(this.revalidateResult);
  }

  public unload(): Promise<LocalWhisperCoordinatorWorkerResult> {
    this.unloadCount += 1;
    return Promise.resolve(this.unloadResult);
  }

  public terminate(): Promise<boolean> {
    this.terminateCount += 1;
    return Promise.resolve(this.terminateResult);
  }

  public shutdown(): Promise<boolean> {
    this.shutdownCount += 1;
    return Promise.resolve(this.shutdownResult);
  }
}

class FakeWorkerPort implements LocalWhisperCoordinatorWorkerPort {
  public probeCount = 0;
  public loadCount = 0;
  public probeResult: LocalWhisperCoordinatorWorkerResult = { success: true, value: undefined };
  public loadFailure: LocalWhisperFailureCode | null = null;
  public probeSettings: WorkerProbeRequest['settings'][] = [];
  public loadSettings: WorkerLoadRequest['settings'][] = [];
  public readonly resident = new FakeResidentWorker();
  public deferredLoad: {
    readonly promise: Promise<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>>;
    readonly resolve: (value: LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>) => void;
  } | null = null;

  public probeFresh(request: WorkerProbeRequest): Promise<LocalWhisperCoordinatorWorkerResult> {
    this.probeCount += 1;
    this.probeSettings.push(request.settings);
    return Promise.resolve(this.probeResult);
  }

  public loadFresh(
    request: WorkerLoadRequest,
  ): Promise<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>> {
    this.loadCount += 1;
    this.loadSettings.push(request.settings);
    if (this.deferredLoad) return this.deferredLoad.promise;
    return Promise.resolve(
      this.loadFailure ? { success: false, code: this.loadFailure } : { success: true, value: this.resident },
    );
  }
}

class FakeArtifactPort implements LocalWhisperCoordinatorArtifactPort {
  public calls = 0;
  public commands: LocalWhisperArtifactRemovalCommand[] = [];
  public result: LocalWhisperArtifactRemovalResult = {
    success: true,
    inventoryEpoch: 2,
    runtimeSetup: 'Installed',
    modelSetup: 'Missing',
  };

  public removeSelected(command: LocalWhisperArtifactRemovalCommand): Promise<LocalWhisperArtifactRemovalResult> {
    this.calls += 1;
    this.commands.push(command);
    return Promise.resolve(this.result);
  }
}

class FakeInventoryPort implements LocalWhisperCoordinatorInventoryPort {
  private readonly listeners = new Set<(inventoryEpoch: number) => void>();
  private value: ReturnType<LocalWhisperCoordinatorInventoryPort['selectedSetup']> = {
    inventoryEpoch: 1,
    runtimeSetup: 'Installed',
    modelSetup: 'Installed',
  };

  public selectedSetup() {
    return this.value;
  }

  public subscribe(listener: (inventoryEpoch: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public publish(
    inventoryEpoch: number,
    runtimeSetup: LocalWhisperArtifactSetupState,
    modelSetup: LocalWhisperArtifactSetupState,
  ): void {
    this.value = { inventoryEpoch, runtimeSetup, modelSetup };
    for (const listener of this.listeners) listener(inventoryEpoch);
  }
}

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: T): void {
      if (!resolvePromise) throw new Error('Deferred resolver unavailable');
      resolvePromise(value);
    },
  };
}

function harness(
  settingsPort = new FakeSettingsPort(),
  initialSupportTier: 'Production' | 'Unsupported' = 'Production',
) {
  const capability = new FakeCapabilityPort();
  const workers = new FakeWorkerPort();
  const artifacts = new FakeArtifactPort();
  const inventory = new FakeInventoryPort();
  let requestId = 0;
  const dependencies: LocalWhisperCoordinatorDependencies = {
    settings: settingsPort,
    capability,
    workers,
    artifacts,
    inventory,
    cache: {
      context(current, epochs) {
        return Object.freeze([
          'local-whisper',
          current.runtimeRevision ?? 'unset',
          current.model.revision,
          String(epochs.configuration),
          'private-prompt-digest',
        ]);
      },
    },
    nextRequestId: () => `request-${++requestId}`,
    initial: {
      settings: settings(),
      configured: true,
      inventoryEpoch: 1,
      runtimeSetup: 'Installed',
      modelSetup: 'Installed',
      supportTier: initialSupportTier,
    },
  };
  return {
    coordinator: new LocalWhisperCoordinator(dependencies),
    settingsPort,
    capability,
    workers,
    artifacts,
    inventory,
  };
}

function validAudioDispatch(coordinator: LocalWhisperCoordinator) {
  return {
    dispatch: coordinator.captureDispatchSnapshot(),
    audio: {
      byteLength: 48,
      dataOffset: 44,
      dataByteLength: 4,
      sampleRate: 16_000,
      channelCount: 1,
      bitsPerSample: 16,
    } as const,
  };
}

describe('LocalWhisperCoordinator', () => {
  it('admits a repository-validated repairable initial state without weakening mutation validation', async () => {
    const settingsPort = new FakeSettingsPort();
    settingsPort.rejectMutations = true;
    const { coordinator } = harness(settingsPort);
    const current = coordinator.snapshot;

    assert.equal(current.configured, true);
    const rejected = await coordinator.applySettingsTransaction({
      kind: 'save',
      candidate: current.settings,
      promptMutation: { kind: 'unchanged' },
      expectedConfigurationEpoch: current.epochs.configuration,
      expectedInventoryEpoch: current.epochs.inventory,
    });
    assert.equal(rejected.success, false);
    if (rejected.success) assert.fail('Strict mutation validation unexpectedly accepted repairable settings');
    assert.equal(rejected.error.code, 'INVALID_SETTINGS');
    await coordinator.shutdown();
  });

  it('synchronizes completed artifact inventory epochs before the next command', async () => {
    const { coordinator, inventory } = harness();

    inventory.publish(2, 'Missing', 'Installed');

    assert.equal(coordinator.snapshot.epochs.inventory, 2);
    assert.equal(coordinator.snapshot.runtime.runtimeSetup, 'Missing');
    assert.equal(coordinator.snapshot.runtime.capability, 'Stale');
    assert.equal(coordinator.snapshot.staleCause, 'runtimeFileIdentityChanged');
    await coordinator.shutdown();
    inventory.publish(3, 'Installed', 'Installed');
    assert.equal(coordinator.snapshot.epochs.inventory, 2);
  });

  it('publishes immutable strictly increasing snapshots without prompt or native authority', () => {
    const { coordinator } = harness();
    const revisions: number[] = [];
    const unsubscribe = coordinator.subscribe((snapshot) => revisions.push(snapshot.snapshotRevision));
    assert.deepEqual(revisions, [1]);
    assert.equal(coordinator.snapshot.hasInitialPrompt, true);
    assert.equal(coordinator.snapshot.configured, true);
    assert.equal('initialPrompt' in coordinator.snapshot.settings, false);
    assert.equal(Object.isFrozen(coordinator.snapshot.settings.model), true);
    assert.equal(coordinator.snapshot.runtime.supportTier, 'Production');
    assert.equal(coordinator.snapshot.runtime.canAttempt, true);
    assert.doesNotMatch(JSON.stringify(coordinator.snapshot), /private prompt|native|ordinal|authority/iu);
    assert.equal(Object.isFrozen(coordinator.snapshot), true);
    unsubscribe();
  });

  it('recomputes support after a valid settings transaction repairs an unavailable initial selection', async () => {
    const { coordinator } = harness(new FakeSettingsPort(), 'Unsupported');
    const current = coordinator.snapshot;
    assert.equal(current.runtime.canAttempt, false);

    const saved = await coordinator.applySettingsTransaction({
      kind: 'save',
      candidate: current.settings,
      promptMutation: { kind: 'unchanged' },
      expectedConfigurationEpoch: current.epochs.configuration,
      expectedInventoryEpoch: current.epochs.inventory,
    });

    assert.equal(saved.success, true);
    assert.equal(coordinator.snapshot.runtime.supportTier, 'Production');
    assert.equal(coordinator.snapshot.runtime.canAttempt, true);
  });

  it('projects exact preflight support and artifact failures without starting a worker', async () => {
    const { coordinator, capability, workers } = harness();
    capability.result = {
      success: false,
      supportTier: 'Production',
      runtimeSetup: 'Missing',
      modelSetup: 'Installed',
      code: 'RUNTIME_MISSING',
      resources: null,
    };
    const result = await coordinator.checkCompatibility();
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.code, 'RUNTIME_MISSING');
    assert.equal(workers.probeCount, 0);
    assert.equal(coordinator.snapshot.runtime.supportTier, 'Production');
    assert.equal(coordinator.snapshot.runtime.runtimeSetup, 'Missing');
    assert.equal(coordinator.snapshot.runtime.capability, 'NotReady');
  });

  it('uses a disposable compatibility probe and never reports it as resident or validated', async () => {
    const { coordinator, capability, workers } = harness();
    const result = await coordinator.checkCompatibility();
    assert.equal(result.success, true);
    assert.equal(capability.calls.length, 1);
    const capabilitySettings = capability.calls[0]?.settings;
    assert.ok(capabilitySettings);
    assert.equal('initialPrompt' in capabilitySettings, false);
    assert.equal(workers.probeCount, 1);
    const probeSettings = workers.probeSettings[0];
    assert.ok(probeSettings);
    assert.equal('initialPrompt' in probeSettings, false);
    assert.equal(workers.loadCount, 0);
    assert.equal(coordinator.snapshot.runtime.capability, 'EstimateOnly');
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'NotReady');
  });

  it('loads through a fresh worker, unloads deterministically, and never falls back', async () => {
    const { coordinator, workers } = harness();
    assert.equal((await coordinator.loadNow()).success, true);
    assert.equal(workers.loadCount, 1);
    const loadSettings = workers.loadSettings[0];
    assert.ok(loadSettings);
    assert.equal('initialPrompt' in loadSettings, false);
    assert.equal(workers.probeCount, 0);
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'Ready');
    assert.equal((await coordinator.unload()).success, true);
    assert.equal(workers.resident.unloadCount, 1);
    assert.equal(coordinator.snapshot.runtime.capability, 'Validated');
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'ValidatedUnloaded');
  });

  it('refuses transcription until the installed configuration has been loaded and validated', async () => {
    const { coordinator, capability, workers } = harness();
    const eligibility = validAudioDispatch(coordinator);

    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'NotReady');
    const eligibilityResult = await coordinator.checkEligibility(eligibility);
    assert.equal(eligibilityResult.success, false);
    if (!eligibilityResult.success) assert.equal(eligibilityResult.error.code, 'INVALID_SETTINGS');

    const transcription = await coordinator.transcribe({
      dispatch: eligibility.dispatch,
      buffer: Uint8Array.from([1, 2, 3, 4]).buffer,
      mimeType: 'audio/wav',
    });

    assert.equal(transcription.success, false);
    if (!transcription.success) assert.equal(transcription.error.code, 'OPERATION_CONFLICT');
    assert.equal(capability.calls.length, 0);
    assert.equal(workers.loadCount, 0);
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'NotReady');
  });

  it('refuses validated but unloaded configurations without creating another worker', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    await coordinator.unload();
    const eligibility = validAudioDispatch(coordinator);
    const eligibilityResult = await coordinator.checkEligibility(eligibility);
    assert.equal(eligibilityResult.success, false);
    if (!eligibilityResult.success) assert.equal(eligibilityResult.error.code, 'INVALID_SETTINGS');
    const stale = {
      ...eligibility,
      dispatch: {
        ...eligibility.dispatch,
        epochs: {
          ...eligibility.dispatch.epochs,
          configuration: eligibility.dispatch.epochs.configuration + 1,
        },
      },
    };
    const staleResult = await coordinator.checkEligibility(stale);
    assert.equal(staleResult.success, false);
    if (!staleResult.success) assert.equal(staleResult.error.code, 'STALE_CONFIGURATION');

    const transcription = await coordinator.transcribe({
      dispatch: eligibility.dispatch,
      buffer: Uint8Array.from([1, 2, 3, 4]).buffer,
      mimeType: 'audio/wav',
    });
    assert.equal(transcription.success, false);
    if (!transcription.success) assert.equal(transcription.error.code, 'OPERATION_CONFLICT');
    assert.equal(workers.loadCount, 1);
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'ValidatedUnloaded');
  });

  it('commits request-only settings atomically without unloading and never exposes prompt text', async () => {
    const { coordinator, settingsPort, workers } = harness();
    await coordinator.loadNow();
    const before = coordinator.snapshot;
    const candidate = settings({ language: 'ru', initialPrompt: '' });
    const result = await coordinator.applySettingsTransaction({
      kind: 'save',
      candidate,
      promptMutation: { kind: 'replace', value: 'replacement private prompt' },
      expectedConfigurationEpoch: before.epochs.configuration,
      expectedInventoryEpoch: before.epochs.inventory,
    });
    assert.equal(result.success, true);
    assert.equal(settingsPort.saved.length, 1);
    assert.equal(settingsPort.saved[0]?.initialPrompt, 'replacement private prompt');
    assert.equal(workers.resident.unloadCount, 0);
    assert.equal(coordinator.snapshot.epochs.configuration, before.epochs.configuration + 1);
    assert.doesNotMatch(JSON.stringify(coordinator.snapshot), /replacement private prompt/u);
  });

  it('unloads before a load-affecting save and preserves old settings when persistence fails', async () => {
    const { coordinator, settingsPort, workers } = harness();
    await coordinator.loadNow();
    settingsPort.failPersistence = true;
    const before = coordinator.snapshot;
    const priorCache = coordinator.captureDispatchSnapshot().cacheContext;
    const result = await coordinator.applySettingsTransaction({
      kind: 'save',
      candidate: settings({ runtimeRevision: revision('runtime-cpu-v2') }),
      promptMutation: { kind: 'unchanged' },
      expectedConfigurationEpoch: before.epochs.configuration,
      expectedInventoryEpoch: before.epochs.inventory,
    });
    assert.equal(result.success, false);
    assert.equal(workers.resident.unloadCount, 1);
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
    assert.equal(coordinator.snapshot.epochs.configuration, before.epochs.configuration);
    assert.deepEqual(coordinator.captureDispatchSnapshot().cacheContext, priorCache);
  });

  it('resets settings as one prompt-safe atomic transaction', async () => {
    const { artifacts, coordinator, settingsPort, workers } = harness();
    await coordinator.loadNow();
    const before = coordinator.snapshot;
    const result = await coordinator.applySettingsTransaction({
      kind: 'reset',
      expectedConfigurationEpoch: before.epochs.configuration,
      expectedInventoryEpoch: before.epochs.inventory,
    });
    assert.equal(result.success, true);
    assert.equal(settingsPort.resetCount, 1);
    assert.equal(settingsPort.saved.length, 0);
    assert.equal(artifacts.calls, 0);
    assert.equal(workers.resident.unloadCount, 0);
    assert.equal(coordinator.snapshot.hasInitialPrompt, false);
    assert.equal(coordinator.snapshot.configured, false);
    assert.equal(coordinator.snapshot.epochs.configuration, before.epochs.configuration + 1);
  });

  it('rejects conflicts immediately and cancellation leaves a partial load unloaded', async () => {
    const { coordinator, workers } = harness();
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>>();
    workers.deferredLoad = pending;
    const loading = coordinator.loadNow();
    await new Promise((resolve) => setImmediate(resolve));
    const conflict = await coordinator.unload();
    assert.equal(conflict.success, false);
    if (!conflict.success) assert.equal(conflict.error.code, 'OPERATION_CONFLICT');
    assert.equal((await coordinator.cancel()).success, true);
    pending.resolve({ success: false, code: 'CANCELLED' });
    const loadResult = await loading;
    assert.equal(loadResult.success, false);
    if (!loadResult.success) assert.equal(loadResult.error.code, 'CANCELLED');
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
  });

  it('lets cancellation win when a partial load incorrectly reports success', async () => {
    const { coordinator, workers } = harness();
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>>();
    workers.deferredLoad = pending;
    const loading = coordinator.loadNow();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await coordinator.cancel()).success, true);
    pending.resolve({ success: true, value: workers.resident });
    const result = await loading;
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.code, 'CANCELLED');
    assert.equal(workers.resident.terminateCount, 1);
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
  });

  it('discards stale asynchronous capability results after topology change', async () => {
    const { coordinator, capability, workers } = harness();
    const pending = deferred<LocalWhisperCapabilityPreflightResult>();
    capability.deferred = pending;
    const checking = coordinator.checkCompatibility();
    await new Promise((resolve) => setImmediate(resolve));
    await coordinator.handleTopologyChanged();
    pending.resolve(SUCCESSFUL_PREFLIGHT);
    const result = await checking;
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.code, 'CANCELLED');
    assert.equal(workers.probeCount, 0);
    assert.equal(coordinator.snapshot.runtime.capability, 'Stale');
    assert.equal(coordinator.snapshot.staleCause, 'deviceTopologyChanged');
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
  });

  it('does not let a late load completion overwrite the topology invalidation snapshot', async () => {
    const { coordinator, workers } = harness();
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>>();
    workers.deferredLoad = pending;
    const loading = coordinator.loadNow();
    await new Promise((resolve) => setImmediate(resolve));
    await coordinator.handleTopologyChanged();
    const invalidatedRevision = coordinator.snapshot.snapshotRevision;
    pending.resolve({ success: true, value: workers.resident });
    assert.equal((await loading).success, false);
    assert.equal(workers.resident.terminateCount, 1);
    assert.equal(coordinator.snapshot.snapshotRevision, invalidatedRevision);
    assert.equal(coordinator.snapshot.runtime.capability, 'Stale');
  });

  it('publishes Failed then Unloaded for device-proof failure with exact precedence', async () => {
    const { coordinator, workers } = harness();
    workers.loadFailure = 'DEVICE_PROOF_FAILED';
    const residencies: string[] = [];
    coordinator.subscribe((snapshot) => residencies.push(snapshot.runtime.residency));
    const result = await coordinator.loadNow();
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.code, 'DEVICE_PROOF_FAILED');
    assert.deepEqual(residencies.slice(-2), ['Failed', 'Unloaded']);
    assert.equal(coordinator.snapshot.runtime.capability, 'Stale');
  });

  it('keeps a cooperatively cancelled healthy worker and terminates uncertain cancellation', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<string>>();
    workers.resident.deferredTranscription = pending;
    const dispatch = coordinator.captureDispatchSnapshot();
    const transcription = coordinator.transcribe({
      dispatch,
      buffer: Uint8Array.from([1, 2]).buffer,
      mimeType: 'audio/wav',
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await coordinator.cancel()).success, true);
    pending.resolve({ success: false, code: 'CANCELLED' });
    const result = await transcription;
    assert.equal(result.success, false);
    assert.equal(workers.resident.cancelCount, 1);
    assert.equal(workers.resident.terminateCount, 0);
    assert.equal(coordinator.snapshot.runtime.residency, 'Loaded');
    assert.equal(coordinator.snapshot.runtime.activity, 'Idle');
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'Ready');
    assert.equal(coordinator.snapshot.runtime.blockingCode, null);
  });

  it('keeps a committed transcript and warmed worker when cancellation loses the race', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    workers.resident.cancelResult = { success: false, code: 'OPERATION_CONFLICT' };
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<string>>();
    workers.resident.deferredTranscription = pending;
    const transcription = coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: Uint8Array.from([1, 2]).buffer,
      mimeType: 'audio/wav',
    });
    await new Promise((resolve) => setImmediate(resolve));
    const cancellation = coordinator.cancel();
    pending.resolve({ success: true, value: 'committed transcript' });

    const [cancelled, result] = await Promise.all([cancellation, transcription]);
    assert.equal(cancelled.success, false);
    if (!cancelled.success) assert.equal(cancelled.error.code, 'OPERATION_CONFLICT');
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.value, 'committed transcript');
    assert.equal(workers.resident.terminateCount, 0);
    assert.equal(coordinator.snapshot.runtime.residency, 'Loaded');
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'Ready');

    workers.resident.deferredTranscription = null;
    workers.resident.transcriptionResult = { success: true, value: 'reuse transcript' };
    const reuse = await coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: Uint8Array.from([1, 2]).buffer,
      mimeType: 'audio/wav',
    });
    assert.equal(reuse.success, true);
  });

  it('keeps a healthy resident worker ready after an empty transcription', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    workers.resident.transcriptionResult = { success: false, code: 'EMPTY_TRANSCRIPTION' };

    const first = await coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: Uint8Array.from([1, 2]).buffer,
      mimeType: 'audio/wav',
    });

    assert.equal(first.success, false);
    if (!first.success) assert.equal(first.error.code, 'EMPTY_TRANSCRIPTION');
    assert.equal(workers.resident.terminateCount, 0);
    assert.equal(coordinator.snapshot.runtime.residency, 'Loaded');
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'Ready');
    assert.equal(coordinator.snapshot.runtime.blockingCode, null);

    workers.resident.transcriptionResult = { success: true, value: 'retry transcript' };
    const retry = await coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: Uint8Array.from([1, 2]).buffer,
      mimeType: 'audio/wav',
    });
    assert.equal(retry.success, true);
    assert.equal(workers.loadCount, 1);
  });

  it('terminates a cooperatively cancelled worker when post-cancel authority is uncertain', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    workers.resident.revalidateResult = false;
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<string>>();
    workers.resident.deferredTranscription = pending;
    const transcription = coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: Uint8Array.from([1, 2]).buffer,
      mimeType: 'audio/wav',
    });
    await new Promise((resolve) => setImmediate(resolve));
    await coordinator.cancel();
    pending.resolve({ success: false, code: 'CANCELLED' });
    assert.equal((await transcription).success, false);
    assert.equal(workers.resident.terminateCount, 1);
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
  });

  it('does not let late transcription completion overwrite a lifecycle invalidation snapshot', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<string>>();
    workers.resident.deferredTranscription = pending;
    const transcription = coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: Uint8Array.from([1, 2]).buffer,
      mimeType: 'audio/wav',
    });
    await new Promise((resolve) => setImmediate(resolve));
    await coordinator.handleTopologyChanged();
    const invalidatedRevision = coordinator.snapshot.snapshotRevision;
    pending.resolve({ success: false, code: 'CANCELLED' });
    assert.equal((await transcription).success, false);
    assert.equal(coordinator.snapshot.snapshotRevision, invalidatedRevision);
    assert.equal(coordinator.snapshot.runtime.capability, 'Stale');
    assert.equal(coordinator.snapshot.runtime.blockingCode, null);
  });

  it('fails closed when unload and fallback termination cannot prove cleanup', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    workers.resident.unloadResult = { success: false, code: 'OPERATION_TIMEOUT' };
    workers.resident.terminateResult = false;
    const result = await coordinator.unload();
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.code, 'CLEANUP_FAILED');
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
    assert.equal(coordinator.snapshot.runtime.blockingCode, 'CLEANUP_FAILED');
  });

  it('invalidates capability and terminates residency on suspend and topology lifecycle changes', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    await coordinator.handleSuspend();
    assert.equal(workers.resident.terminateCount, 1);
    assert.equal(coordinator.snapshot.runtime.capability, 'Stale');
    assert.equal(coordinator.snapshot.staleCause, 'suspendResume');
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
    const topologyEpoch = coordinator.snapshot.epochs.topology;
    await coordinator.handleTopologyChanged();
    assert.equal(coordinator.snapshot.epochs.topology, topologyEpoch + 1);
    assert.equal(coordinator.snapshot.staleCause, 'deviceTopologyChanged');
  });

  it('confirms and sequences selected artifact removal without changing the selection', async () => {
    const { coordinator, artifacts, workers } = harness();
    await coordinator.loadNow();
    const before = coordinator.snapshot;
    const request = {
      kind: 'model',
      artifactId: artifactId('model-base-v1'),
      confirmed: false,
      expectedConfigurationEpoch: before.epochs.configuration,
      expectedInventoryEpoch: before.epochs.inventory,
    } as const;
    assert.equal((await coordinator.removeArtifact(request)).success, false);
    assert.equal(artifacts.calls, 0);
    assert.equal((await coordinator.removeArtifact({ ...request, confirmed: true })).success, true);
    assert.equal(workers.resident.unloadCount, 1);
    assert.equal(artifacts.calls, 1);
    const command = artifacts.commands[0];
    assert.ok(command);
    assert.equal('initialPrompt' in command.settings, false);
    assert.equal(command.settings.model.revision, before.settings.model.revision);
    assert.equal(coordinator.snapshot.runtime.modelSetup, 'Missing');
    assert.equal(coordinator.snapshot.epochs.inventory, 2);
  });

  it('serializes provider switching and performs shutdown exactly once', async () => {
    const { coordinator, workers } = harness();
    await coordinator.loadNow();
    assert.equal((await coordinator.prepareProviderSwitch('openai-api')).success, true);
    assert.equal(workers.resident.unloadCount, 1);
    assert.equal((await coordinator.loadNow()).success, true);
    const first = coordinator.shutdown();
    const second = coordinator.shutdown();
    assert.equal(first, second);
    assert.equal((await first).success, true);
    assert.equal(workers.resident.shutdownCount, 1);
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
  });

  it('rejects Local Whisper provider selection unless the loaded runtime is ready', async () => {
    const { coordinator, workers } = harness();

    const unloaded = await coordinator.prepareProviderSwitch('local-whisper');
    assert.equal(unloaded.success, false);
    if (!unloaded.success) assert.equal(unloaded.error.code, 'OPERATION_CONFLICT');
    assert.equal(workers.loadCount, 0);

    await coordinator.loadNow();
    assert.equal((await coordinator.prepareProviderSwitch('local-whisper')).success, true);
  });

  it('rejects provider switching during a pending load and requires a separate retry after settlement', async () => {
    const { coordinator, workers } = harness();
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>>();
    workers.deferredLoad = pending;
    const loading = coordinator.loadNow();
    await new Promise((resolve) => setImmediate(resolve));

    const rejectedSwitch = await coordinator.prepareProviderSwitch('openai-api');
    assert.equal(rejectedSwitch.success, false);
    if (!rejectedSwitch.success) assert.equal(rejectedSwitch.error.code, 'OPERATION_CONFLICT');
    const rejectedSettings = await coordinator.applySettingsTransaction({
      kind: 'reset',
      expectedConfigurationEpoch: coordinator.snapshot.epochs.configuration,
      expectedInventoryEpoch: coordinator.snapshot.epochs.inventory,
    });
    assert.equal(rejectedSettings.success, false);
    if (!rejectedSettings.success) assert.equal(rejectedSettings.error.code, 'OPERATION_CONFLICT');
    assert.equal(coordinator.snapshot.runtime.residency, 'Loading');
    assert.equal(workers.resident.unloadCount, 0);

    pending.resolve({ success: true, value: workers.resident });
    assert.equal((await loading).success, true);
    assert.equal((await coordinator.prepareProviderSwitch('openai-api')).success, true);
    assert.equal(workers.resident.unloadCount, 1);
  });

  it('waits for an aborted active load to release its late worker before shutdown completes', async () => {
    const { coordinator, workers } = harness();
    const pending = deferred<LocalWhisperCoordinatorWorkerResult<LocalWhisperResidentWorkerLease>>();
    workers.deferredLoad = pending;
    const loading = coordinator.loadNow();
    await new Promise((resolve) => setImmediate(resolve));
    const shutdown = coordinator.shutdown();
    pending.resolve({ success: true, value: workers.resident });
    assert.equal((await loading).success, false);
    assert.equal((await shutdown).success, true);
    assert.equal(workers.resident.terminateCount, 1);
    assert.equal(coordinator.snapshot.runtime.residency, 'Unloaded');
  });
});
