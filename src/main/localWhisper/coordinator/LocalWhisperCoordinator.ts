import {
  createLocalWhisperActionFailure,
  createLocalWhisperActionSuccess,
  createLocalWhisperRendererSafeFailure,
  LOCAL_WHISPER_PROVIDER_ID,
  type LocalWhisperActionId,
  type LocalWhisperActionResult,
  type LocalWhisperCapabilityStaleCause,
  type LocalWhisperCapabilityState,
  type LocalWhisperFailureCode,
  type LocalWhisperRendererSafeFailure,
  type LocalWhisperResidencyState,
  type LocalWhisperRuntimeSnapshot,
  type LocalWhisperPublicSettings,
  type LocalWhisperSettings,
  type LocalWhisperSupportTier,
} from '@shared/localWhisper';

import type {
  LocalWhisperCapabilityAssessment,
  LocalWhisperCapabilityPreflightResult,
} from '../capability/LocalWhisperCapabilityService';
import type {
  LocalWhisperArtifactRemovalRequest,
  LocalWhisperCoordinatorDependencies,
  LocalWhisperCoordinatorEpochs,
  LocalWhisperCoordinatorPort,
  LocalWhisperCoordinatorSnapshot,
  LocalWhisperCoordinatorSnapshotListener,
  LocalWhisperCoordinatorTranscriptionRequest,
  LocalWhisperDispatchSnapshot,
  LocalWhisperEligibilityRequest,
  LocalWhisperProviderReadiness,
  LocalWhisperResidentWorkerLease,
  LocalWhisperSettingsTransaction,
} from './LocalWhisperCoordinatorTypes';
import type { LocalWhisperResourceDecision } from '../capability/LocalWhisperResourcePolicy';

interface ActiveOperation {
  readonly kind: 'check' | 'load' | 'transcribe' | 'unload' | 'settings' | 'remove' | 'providerSwitch';
  readonly requestId: string;
  readonly abortController: AbortController;
  readonly settled: Promise<void>;
  readonly resolveSettled: () => void;
}

function freezeEpochs(epochs: LocalWhisperCoordinatorEpochs): LocalWhisperCoordinatorEpochs {
  return Object.freeze({ ...epochs });
}

function sameEpochs(left: LocalWhisperCoordinatorEpochs, right: LocalWhisperCoordinatorEpochs): boolean {
  return (
    left.provider === right.provider &&
    left.configuration === right.configuration &&
    left.inventory === right.inventory &&
    left.topology === right.topology &&
    left.capability === right.capability &&
    left.worker === right.worker
  );
}

function hasLoadAffectingChange(current: LocalWhisperSettings, next: LocalWhisperSettings): boolean {
  return (
    current.engine !== next.engine ||
    current.runtimeRevision !== next.runtimeRevision ||
    JSON.stringify(current.model) !== JSON.stringify(next.model) ||
    JSON.stringify(current.execution) !== JSON.stringify(next.execution)
  );
}

function settingsWithPrompt(
  current: LocalWhisperSettings,
  candidate: LocalWhisperPublicSettings,
  mutation: Extract<LocalWhisperSettingsTransaction, { readonly kind: 'save' }>['promptMutation'],
): LocalWhisperSettings {
  const initialPrompt =
    mutation.kind === 'unchanged' ? current.initialPrompt : mutation.kind === 'clear' ? '' : mutation.value;
  return { ...candidate, initialPrompt };
}

function projectPublicSettings(settings: LocalWhisperSettings): LocalWhisperPublicSettings {
  const { initialPrompt: _initialPrompt, ...publicSettings } = settings;
  return Object.freeze({
    ...publicSettings,
    model: Object.freeze({ ...publicSettings.model }),
    decoding: Object.freeze({ ...publicSettings.decoding }),
    execution: Object.freeze({ ...publicSettings.execution }),
  });
}

function isValidCanonicalAudio(request: LocalWhisperEligibilityRequest): boolean {
  const { audio } = request;
  return (
    Number.isSafeInteger(audio.byteLength) &&
    Number.isSafeInteger(audio.dataOffset) &&
    Number.isSafeInteger(audio.dataByteLength) &&
    audio.byteLength > 0 &&
    audio.dataOffset >= 0 &&
    audio.dataByteLength > 0 &&
    audio.dataOffset + audio.dataByteLength <= audio.byteLength &&
    audio.sampleRate === 16_000 &&
    audio.channelCount === 1 &&
    audio.bitsPerSample === 16
  );
}

/** Sole mutable owner for Local Whisper settings, capability, residency, activity, and lifecycle state. */
export class LocalWhisperCoordinator implements LocalWhisperCoordinatorPort {
  private readonly listeners = new Set<LocalWhisperCoordinatorSnapshotListener>();
  private activeOperation: ActiveOperation | null = null;
  private residentWorker: LocalWhisperResidentWorkerLease | null = null;
  private shutdownPromise: Promise<LocalWhisperActionResult<undefined>> | null = null;
  private readonly unsubscribeInventory: (() => void) | null;
  private settingsValue: LocalWhisperSettings;
  private configured: boolean;
  private epochs: LocalWhisperCoordinatorEpochs;
  private snapshotRevision = 0;
  private supportTier: LocalWhisperSupportTier = 'Unsupported';
  private runtimeSetup: LocalWhisperRuntimeSnapshot['runtimeSetup'];
  private modelSetup: LocalWhisperRuntimeSnapshot['modelSetup'];
  private capability: LocalWhisperCapabilityState;
  private residency: LocalWhisperResidencyState = 'Unloaded';
  private activity: LocalWhisperRuntimeSnapshot['activity'] = 'Idle';
  private failure: LocalWhisperRendererSafeFailure | null = null;
  private selectedDeviceId: LocalWhisperCoordinatorSnapshot['selectedDeviceId'] = null;
  private capabilityFingerprint: string | null = null;
  private staleCause: LocalWhisperCapabilityStaleCause | null = null;
  private resources: LocalWhisperResourceDecision | null = null;
  private snapshotValue: LocalWhisperCoordinatorSnapshot;
  private stopped = false;

  public constructor(private readonly dependencies: LocalWhisperCoordinatorDependencies) {
    const initialSettings = dependencies.settings.validateInitial(dependencies.initial.settings);
    if (!initialSettings) throw new Error('Invalid initial Local Whisper coordinator settings');
    this.settingsValue = initialSettings;
    this.configured = dependencies.initial.configured;
    this.runtimeSetup = dependencies.initial.runtimeSetup;
    this.modelSetup = dependencies.initial.modelSetup;
    this.capability = dependencies.initial.capability ?? 'Unchecked';
    this.epochs = freezeEpochs({
      provider: 0,
      configuration: 0,
      inventory: dependencies.initial.inventoryEpoch,
      topology: 0,
      capability: 0,
      worker: 0,
    });
    this.snapshotValue = this.createSnapshot();
    this.unsubscribeInventory =
      dependencies.inventory?.subscribe((inventoryEpoch) => this.applyInventoryEpoch(inventoryEpoch)) ?? null;
  }

  public get snapshot(): LocalWhisperCoordinatorSnapshot {
    return this.snapshotValue;
  }

  public subscribe(listener: LocalWhisperCoordinatorSnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshotValue);
    return () => this.listeners.delete(listener);
  }

  public getReadinessSnapshot(): LocalWhisperProviderReadiness {
    return Object.freeze({ snapshot: this.snapshotValue.runtime, failure: this.failure });
  }

  public captureDispatchSnapshot(): LocalWhisperDispatchSnapshot {
    return Object.freeze({
      epochs: Object.freeze({
        provider: this.epochs.provider,
        configuration: this.epochs.configuration,
        inventory: this.epochs.inventory,
      }),
      readiness: this.getReadinessSnapshot(),
      cacheContext: Object.freeze([...this.dependencies.cache.context(this.settingsValue, this.epochs)]),
    });
  }

  public checkEligibility(request: LocalWhisperEligibilityRequest): Promise<LocalWhisperActionResult<undefined>> {
    const dispatchFailure = this.dispatchFailure(request.dispatch);
    if (dispatchFailure) return Promise.resolve(this.failureResult('transcribe', dispatchFailure));
    if (!isValidCanonicalAudio(request)) {
      return Promise.resolve(this.failureResult('transcribe', 'AUDIO_FORMAT_UNSUPPORTED'));
    }
    const status = this.snapshotValue.runtime.operationalStatus;
    if (status === 'Ready' || status === 'ValidatedUnloaded') {
      return Promise.resolve(this.successResult('transcribe', undefined));
    }
    if (status === 'Busy') return Promise.resolve(this.failureResult('transcribe', 'OPERATION_CONFLICT'));
    return Promise.resolve(
      this.failureResult('transcribe', this.snapshotValue.runtime.blockingCode ?? 'INVALID_SETTINGS'),
    );
  }

  public async checkCompatibility(): Promise<LocalWhisperActionResult<undefined>> {
    const operation = this.beginOperation('check');
    if (!operation) return this.failureResult('checkCompatibility', 'OPERATION_CONFLICT');
    try {
      this.capability = 'Checking';
      this.failure = null;
      this.capabilityFingerprint = null;
      this.staleCause = null;
      this.resources = null;
      this.bumpEpoch('capability');
      this.publish();
      const preflightEpochs = this.epochs;
      const preflight = await this.preflight(operation, preflightEpochs);
      if (!preflight.success) {
        if (!this.isStageCurrent(preflightEpochs, operation)) {
          return this.failureResult('checkCompatibility', preflight.code);
        }
        return this.applyPreflightFailure('checkCompatibility', preflight);
      }
      this.applyAssessment(preflight.assessment);
      const workerEpochs = this.bumpEpoch('worker');
      const probed = await this.dependencies.workers.probeFresh({
        settings: projectPublicSettings(this.settingsValue),
        assessment: preflight.assessment,
        epochs: workerEpochs,
        requestId: operation.requestId,
        signal: operation.abortController.signal,
      });
      if (!this.isStageCurrent(workerEpochs, operation)) {
        return this.failureResult(
          'checkCompatibility',
          operation.abortController.signal.aborted ? 'CANCELLED' : 'STALE_CONFIGURATION',
        );
      }
      if (!probed.success) return this.applyWorkerFailure('checkCompatibility', probed.code, false);
      this.capability = 'EstimateOnly';
      this.residency = 'Unloaded';
      this.failure = null;
      this.publish();
      return this.successResult('checkCompatibility', undefined);
    } finally {
      this.finishOperation(operation);
    }
  }

  public async loadNow(): Promise<LocalWhisperActionResult<undefined>> {
    const operation = this.beginOperation('load');
    if (!operation) return this.failureResult('load', 'OPERATION_CONFLICT');
    try {
      const loaded = await this.performLoad(operation);
      return loaded.success ? this.successResult('load', undefined) : this.failureResult('load', loaded.code);
    } finally {
      this.finishOperation(operation);
    }
  }

  public async unload(): Promise<LocalWhisperActionResult<undefined>> {
    const operation = this.beginOperation('unload');
    if (!operation) return this.failureResult('unload', 'OPERATION_CONFLICT');
    try {
      const code = await this.unloadResident(true);
      return code ? this.failureResult('unload', code) : this.successResult('unload', undefined);
    } finally {
      this.finishOperation(operation);
    }
  }

  public async applySettingsTransaction(
    command: LocalWhisperSettingsTransaction,
  ): Promise<LocalWhisperActionResult<undefined>> {
    const action: LocalWhisperActionId = command.kind === 'save' ? 'saveSettings' : 'resetSettings';
    const operation = this.beginOperation('settings');
    if (!operation) return this.failureResult(action, 'OPERATION_CONFLICT');
    try {
      if (
        command.expectedConfigurationEpoch !== this.epochs.configuration ||
        command.expectedInventoryEpoch !== this.epochs.inventory
      ) {
        return this.failureResult(action, 'STALE_CONFIGURATION');
      }
      const candidate =
        command.kind === 'reset'
          ? this.dependencies.settings.defaultSettings()
          : settingsWithPrompt(this.settingsValue, command.candidate, command.promptMutation);
      const validated = this.dependencies.settings.validate(candidate);
      if (!validated) return this.failureResult(action, 'INVALID_SETTINGS');
      const loadAffecting = hasLoadAffectingChange(this.settingsValue, validated);
      if (loadAffecting && this.residentWorker) {
        const unloadFailure = await this.unloadResident(false);
        if (unloadFailure) return this.failureResult(action, unloadFailure);
      }
      try {
        if (command.kind === 'reset') await this.dependencies.settings.reset();
        else await this.dependencies.settings.save(validated);
      } catch {
        this.residency = 'Unloaded';
        this.failure = createLocalWhisperRendererSafeFailure('INVALID_SETTINGS');
        this.publish();
        return this.failureResult(action, 'INVALID_SETTINGS');
      }
      this.settingsValue = validated;
      this.configured = command.kind !== 'reset';
      this.bumpEpoch('configuration');
      if (loadAffecting) {
        this.bumpEpoch('capability');
        this.bumpEpoch('worker');
        this.capability = 'Stale';
        this.staleCause = 'loadAffectingSettingsChanged';
        this.capabilityFingerprint = null;
        this.selectedDeviceId = null;
        this.resources = null;
      }
      this.failure = null;
      this.publish();
      return this.successResult(action, undefined);
    } finally {
      this.finishOperation(operation);
    }
  }

  public async transcribe(
    request: LocalWhisperCoordinatorTranscriptionRequest,
  ): Promise<LocalWhisperActionResult<string>> {
    const dispatchFailure = this.dispatchFailure(request.dispatch);
    if (dispatchFailure) return this.failureResult('transcribe', dispatchFailure);
    if (request.buffer.byteLength === 0) return this.failureResult('transcribe', 'AUDIO_FORMAT_UNSUPPORTED');
    const operation = this.beginOperation('transcribe');
    if (!operation) return this.failureResult('transcribe', 'OPERATION_CONFLICT');
    try {
      if (!this.residentWorker) {
        const loaded = await this.performLoad(operation);
        if (!loaded.success) return this.failureResult('transcribe', loaded.code);
      }
      const worker = this.residentWorker;
      if (!worker) return this.failureResult('transcribe', 'WORKER_START_FAILED');
      const stageEpochs = this.epochs;
      this.activity = 'Transcribing';
      this.failure = null;
      this.publish();
      const result = await worker.transcribe({
        audio: new Uint8Array(request.buffer),
        settings: this.settingsValue,
        settingsEpoch: this.epochs.configuration,
        requestId: operation.requestId,
        signal: operation.abortController.signal,
      });
      if (!this.isStageCurrent(stageEpochs, operation)) {
        await this.terminateResident();
        this.activity = 'Idle';
        this.residency = 'Unloaded';
        return this.failureResult(
          'transcribe',
          operation.abortController.signal.aborted ? 'CANCELLED' : 'STALE_CONFIGURATION',
        );
      }
      this.activity = 'Idle';
      if (operation.abortController.signal.aborted) {
        if (!result.success && result.code === 'CANCELLED' && (await worker.revalidate().catch(() => false))) {
          this.publishFailure('CANCELLED');
        } else {
          await this.terminateResident();
          this.residency = 'Unloaded';
          this.publishFailure('CANCELLED');
        }
        return this.failureResult('transcribe', 'CANCELLED');
      }
      if (!result.success) {
        await this.handleTranscriptionFailure(result.code, worker);
        return this.failureResult('transcribe', result.code);
      }
      this.failure = null;
      this.publish();
      return this.successResult('transcribe', result.value);
    } finally {
      this.finishOperation(operation);
    }
  }

  public async cancel(): Promise<LocalWhisperActionResult<undefined>> {
    const operation = this.activeOperation;
    if (!operation || (operation.kind !== 'load' && operation.kind !== 'transcribe')) {
      return this.failureResult('cancel', 'OPERATION_CONFLICT');
    }
    operation.abortController.abort();
    if (operation.kind === 'transcribe' && this.residentWorker) {
      const cancelled = await this.residentWorker.cancel();
      if (!cancelled.success) {
        await this.terminateResident();
        this.residency = 'Unloaded';
        this.activity = 'Idle';
        this.publishFailure(cancelled.code);
        return this.failureResult('cancel', cancelled.code);
      }
    }
    return this.successResult('cancel', undefined);
  }

  public async removeArtifact(
    request: LocalWhisperArtifactRemovalRequest,
  ): Promise<LocalWhisperActionResult<undefined>> {
    const action: LocalWhisperActionId = request.kind === 'runtime' ? 'removeRuntime' : 'deleteModel';
    const operation = this.beginOperation('remove');
    if (!operation) return this.failureResult(action, 'OPERATION_CONFLICT');
    try {
      if (
        !request.confirmed ||
        request.expectedConfigurationEpoch !== this.epochs.configuration ||
        request.expectedInventoryEpoch !== this.epochs.inventory
      ) {
        return this.failureResult(action, request.confirmed ? 'STALE_CONFIGURATION' : 'INVALID_SETTINGS');
      }
      if (this.residentWorker) {
        const unloadFailure = await this.unloadResident(false);
        if (unloadFailure) return this.failureResult(action, unloadFailure);
      }
      const removed = await this.dependencies.artifacts.removeSelected({
        request,
        settings: projectPublicSettings(this.settingsValue),
        epochs: this.epochs,
        requestId: operation.requestId,
        signal: operation.abortController.signal,
      });
      if (!removed.success) return this.failureResult(action, removed.code);
      if (removed.inventoryEpoch < this.epochs.inventory) return this.failureResult(action, 'STALE_CONFIGURATION');
      if (removed.inventoryEpoch > this.epochs.inventory) {
        this.epochs = freezeEpochs({ ...this.epochs, inventory: removed.inventoryEpoch });
      }
      this.runtimeSetup = removed.runtimeSetup;
      this.modelSetup = removed.modelSetup;
      this.capability = 'Stale';
      this.staleCause = request.kind === 'runtime' ? 'runtimeFileIdentityChanged' : 'modelFileIdentityChanged';
      this.capabilityFingerprint = null;
      this.resources = null;
      this.failure = null;
      this.publish();
      return this.successResult(action, undefined);
    } finally {
      this.finishOperation(operation);
    }
  }

  public async prepareProviderSwitch(nextProviderId: string): Promise<LocalWhisperActionResult<undefined>> {
    if (nextProviderId === LOCAL_WHISPER_PROVIDER_ID) return this.successResult('providerSwitch', undefined);
    const operation = this.beginOperation('providerSwitch');
    if (!operation) return this.failureResult('providerSwitch', 'OPERATION_CONFLICT');
    try {
      const unloadFailure = await this.unloadResident(false);
      if (unloadFailure) return this.failureResult('providerSwitch', unloadFailure);
      this.bumpEpoch('provider');
      this.failure = null;
      this.publish();
      return this.successResult('providerSwitch', undefined);
    } finally {
      this.finishOperation(operation);
    }
  }

  public handleSuspend(): Promise<void> {
    return this.invalidateLifecycle('suspendResume');
  }

  public handleResume(): Promise<void> {
    return this.invalidateLifecycle('suspendResume');
  }

  public handleTopologyChanged(): Promise<void> {
    return this.invalidateLifecycle('deviceTopologyChanged');
  }

  public shutdown(): Promise<LocalWhisperActionResult<undefined>> {
    this.shutdownPromise ??= this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<LocalWhisperActionResult<undefined>> {
    this.stopped = true;
    this.unsubscribeInventory?.();
    const operation = this.activeOperation;
    operation?.abortController.abort();
    await operation?.settled;
    let cleaned = true;
    if (this.residentWorker) {
      cleaned = await this.residentWorker.shutdown().catch(() => false);
      if (!cleaned) cleaned = await this.residentWorker.terminate().catch(() => false);
      this.residentWorker = null;
    }
    this.activity = 'Idle';
    this.residency = 'Unloaded';
    this.bumpEpoch('worker');
    if (!cleaned) {
      this.publishFailure('CLEANUP_FAILED');
      return this.failureResult('shutdown', 'CLEANUP_FAILED');
    }
    this.failure = null;
    this.publish();
    return this.successResult('shutdown', undefined);
  }

  private applyInventoryEpoch(inventoryEpoch: number): void {
    if (!Number.isSafeInteger(inventoryEpoch) || inventoryEpoch <= this.epochs.inventory || this.stopped) return;
    const inventory = this.dependencies.inventory;
    if (!inventory) return;
    const setup = inventory.selectedSetup(this.settingsValue);
    if (setup.inventoryEpoch !== inventoryEpoch) return;
    const runtimeSetupChanged = setup.runtimeSetup !== this.runtimeSetup;
    const selectedSetupChanged = runtimeSetupChanged || setup.modelSetup !== this.modelSetup;
    this.epochs = freezeEpochs({ ...this.epochs, inventory: inventoryEpoch });
    this.runtimeSetup = setup.runtimeSetup;
    this.modelSetup = setup.modelSetup;
    if (selectedSetupChanged) {
      this.capability = 'Stale';
      this.staleCause = runtimeSetupChanged ? 'runtimeFileIdentityChanged' : 'modelFileIdentityChanged';
      this.capabilityFingerprint = null;
      this.resources = null;
    }
    this.failure = null;
    this.publish();
  }

  private async preflight(
    operation: ActiveOperation,
    stageEpochs: LocalWhisperCoordinatorEpochs,
  ): Promise<LocalWhisperCapabilityPreflightResult> {
    const result = await this.dependencies.capability.preflight({
      settings: projectPublicSettings(this.settingsValue),
      epochs: stageEpochs,
      requestId: operation.requestId,
      signal: operation.abortController.signal,
    });
    if (!this.isStageCurrent(stageEpochs, operation)) {
      return {
        success: false as const,
        supportTier: this.supportTier,
        runtimeSetup: this.runtimeSetup,
        modelSetup: this.modelSetup,
        code: operation.abortController.signal.aborted ? ('CANCELLED' as const) : ('STALE_CONFIGURATION' as const),
        resources: null,
      };
    }
    return result;
  }

  private async performLoad(
    operation: ActiveOperation,
  ): Promise<{ readonly success: true } | { readonly success: false; readonly code: LocalWhisperFailureCode }> {
    if (this.residentWorker && this.residency === 'Loaded' && this.capability === 'Validated') {
      return { success: true };
    }
    this.capability = 'Checking';
    this.residency = 'Loading';
    this.failure = null;
    this.capabilityFingerprint = null;
    this.resources = null;
    this.bumpEpoch('capability');
    this.publish();
    const preflightEpochs = this.epochs;
    const preflight = await this.preflight(operation, preflightEpochs);
    if (!preflight.success) {
      if (!this.isStageCurrent(preflightEpochs, operation)) return { success: false, code: preflight.code };
      this.applyPreflightFailure('load', preflight);
      return { success: false, code: preflight.code };
    }
    this.applyAssessment(preflight.assessment);
    if (operation.abortController.signal.aborted) {
      this.residency = 'Unloaded';
      this.capability = 'EstimateOnly';
      this.publishFailure('CANCELLED');
      return { success: false, code: 'CANCELLED' };
    }
    const workerEpochs = this.bumpEpoch('worker');
    const loaded = await this.dependencies.workers.loadFresh({
      settings: projectPublicSettings(this.settingsValue),
      assessment: preflight.assessment,
      epochs: workerEpochs,
      requestId: operation.requestId,
      signal: operation.abortController.signal,
    });
    if (!this.isStageCurrent(workerEpochs, operation)) {
      if (loaded.success) await loaded.value.terminate().catch(() => false);
      const code = operation.abortController.signal.aborted ? 'CANCELLED' : 'STALE_CONFIGURATION';
      return { success: false, code };
    }
    if (operation.abortController.signal.aborted) {
      if (loaded.success) await loaded.value.terminate().catch(() => false);
      const code = 'CANCELLED';
      this.bumpEpoch('worker');
      this.residency = 'Unloaded';
      this.capability = 'EstimateOnly';
      this.publishFailure(code);
      return { success: false, code };
    }
    if (!loaded.success) {
      this.applyWorkerFailure('load', loaded.code, true);
      return { success: false, code: loaded.code };
    }
    this.residentWorker = loaded.value;
    this.capability = 'Validated';
    this.residency = 'Loaded';
    this.activity = 'Idle';
    this.failure = null;
    this.publish();
    return { success: true };
  }

  private applyAssessment(assessment: LocalWhisperCapabilityAssessment): void {
    this.supportTier = assessment.supportTier;
    this.runtimeSetup = assessment.runtimeSetup;
    this.modelSetup = assessment.modelSetup;
    this.selectedDeviceId = assessment.selectedDeviceId;
    this.capabilityFingerprint = assessment.capabilityFingerprint;
    this.staleCause = null;
    this.resources = assessment.resources;
  }

  private applyPreflightFailure(
    action: LocalWhisperActionId,
    failure: Exclude<LocalWhisperCapabilityPreflightResult, { readonly success: true }>,
  ): LocalWhisperActionResult<undefined> {
    const { code } = failure;
    this.supportTier = failure.supportTier;
    this.runtimeSetup = failure.runtimeSetup;
    this.modelSetup = failure.modelSetup;
    this.resources = failure.resources;
    this.capabilityFingerprint = null;
    this.selectedDeviceId = null;
    this.staleCause = null;
    this.capability = code === 'STALE_CONFIGURATION' ? 'Stale' : 'NotReady';
    this.residency = 'Unloaded';
    this.activity = 'Idle';
    this.publishFailure(code);
    return this.failureResult(action, code);
  }

  private applyWorkerFailure(
    action: LocalWhisperActionId,
    code: LocalWhisperFailureCode,
    publishFailedResidency: boolean,
  ): LocalWhisperActionResult<undefined> {
    this.capability = code === 'DEVICE_PROOF_FAILED' ? 'Stale' : 'NotReady';
    this.capabilityFingerprint = null;
    this.activity = 'Idle';
    if (publishFailedResidency) {
      this.residency = 'Failed';
      this.publishFailure(code);
    }
    this.residency = 'Unloaded';
    this.publishFailure(code);
    return this.failureResult(action, code);
  }

  private async unloadResident(publishTransitions: boolean): Promise<LocalWhisperFailureCode | null> {
    const worker = this.residentWorker;
    if (!worker) {
      this.residency = 'Unloaded';
      if (publishTransitions) this.publish();
      return null;
    }
    this.residency = 'Unloading';
    if (publishTransitions) this.publish();
    const unloaded = await worker.unload().catch(() => ({ success: false, code: 'CLEANUP_FAILED' as const }));
    if (!unloaded.success) {
      const terminated = await worker.terminate().catch(() => false);
      this.residentWorker = null;
      this.residency = 'Unloaded';
      const code = terminated ? unloaded.code : 'CLEANUP_FAILED';
      this.publishFailure(code);
      return code;
    }
    this.residentWorker = null;
    this.residency = 'Unloaded';
    this.activity = 'Idle';
    this.failure = null;
    this.bumpEpoch('worker');
    if (publishTransitions) this.publish();
    return null;
  }

  private async handleTranscriptionFailure(
    code: LocalWhisperFailureCode,
    worker: LocalWhisperResidentWorkerLease,
  ): Promise<void> {
    if (code === 'AUDIO_FORMAT_UNSUPPORTED') {
      this.failure = createLocalWhisperRendererSafeFailure(code);
      this.publish();
      return;
    }
    if (code === 'CANCELLED' && (await worker.revalidate().catch(() => false))) {
      this.failure = createLocalWhisperRendererSafeFailure(code);
      this.publish();
      return;
    }
    await this.terminateResident();
    this.residency = 'Unloaded';
    this.capability = code === 'DEVICE_PROOF_FAILED' ? 'Stale' : 'NotReady';
    this.capabilityFingerprint = null;
    this.publishFailure(code);
  }

  private async terminateResident(): Promise<boolean> {
    const worker = this.residentWorker;
    this.residentWorker = null;
    if (!worker) return true;
    const terminated = await worker.terminate().catch(() => false);
    this.bumpEpoch('worker');
    return terminated;
  }

  private async invalidateLifecycle(cause: LocalWhisperCapabilityStaleCause): Promise<void> {
    this.activeOperation?.abortController.abort();
    this.bumpEpoch('topology');
    this.bumpEpoch('capability');
    const terminated = await this.terminateResident();
    this.activity = 'Idle';
    this.residency = 'Unloaded';
    this.capability = 'Stale';
    this.staleCause = cause;
    this.capabilityFingerprint = null;
    this.selectedDeviceId = null;
    this.resources = null;
    this.failure = terminated ? null : createLocalWhisperRendererSafeFailure('CLEANUP_FAILED');
    this.publish();
  }

  private beginOperation(kind: ActiveOperation['kind']): ActiveOperation | null {
    if (this.stopped || this.activeOperation) return null;
    let resolveSettled = (): void => undefined;
    const settled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    const operation = Object.freeze({
      kind,
      requestId: this.dependencies.nextRequestId(),
      abortController: new AbortController(),
      settled,
      resolveSettled,
    });
    this.activeOperation = operation;
    return operation;
  }

  private finishOperation(operation: ActiveOperation): void {
    if (this.activeOperation === operation) this.activeOperation = null;
    operation.resolveSettled();
  }

  private bumpEpoch(key: keyof LocalWhisperCoordinatorEpochs): LocalWhisperCoordinatorEpochs {
    const next = this.epochs[key] + 1;
    if (!Number.isSafeInteger(next)) throw new Error('Local Whisper coordinator epoch exhausted');
    this.epochs = freezeEpochs({ ...this.epochs, [key]: next });
    return this.epochs;
  }

  private isStageCurrent(epochs: LocalWhisperCoordinatorEpochs, operation: ActiveOperation): boolean {
    return !this.stopped && this.activeOperation === operation && sameEpochs(epochs, this.epochs);
  }

  private dispatchFailure(dispatch: LocalWhisperDispatchSnapshot): LocalWhisperFailureCode | null {
    if (
      dispatch.epochs.provider !== this.epochs.provider ||
      dispatch.epochs.configuration !== this.epochs.configuration ||
      dispatch.epochs.inventory !== this.epochs.inventory
    ) {
      return 'STALE_CONFIGURATION';
    }
    return null;
  }

  private publishFailure(code: LocalWhisperFailureCode): void {
    this.failure = createLocalWhisperRendererSafeFailure(
      code,
      this.selectedDeviceId ? { deviceId: this.selectedDeviceId } : {},
    );
    this.publish();
  }

  private publish(): void {
    this.snapshotValue = this.createSnapshot();
    for (const listener of this.listeners) listener(this.snapshotValue);
  }

  private createSnapshot(): LocalWhisperCoordinatorSnapshot {
    const nextRevision = this.snapshotRevision + 1;
    if (!Number.isSafeInteger(nextRevision)) throw new Error('Local Whisper snapshot revision exhausted');
    this.snapshotRevision = nextRevision;
    const runtime = this.createRuntimeSnapshot();
    return Object.freeze({
      snapshotRevision: nextRevision,
      epochs: this.epochs,
      configured: this.configured,
      settings: projectPublicSettings(this.settingsValue),
      runtime,
      failure: this.failure,
      hasInitialPrompt: this.settingsValue.initialPrompt.length > 0,
      selectedDeviceId: this.selectedDeviceId,
      capabilityFingerprint: this.capabilityFingerprint,
      staleCause: this.staleCause,
      resources: this.resources,
    });
  }

  private createRuntimeSnapshot(): LocalWhisperRuntimeSnapshot {
    const installed = this.runtimeSetup === 'Installed' && this.modelSetup === 'Installed';
    const ready = installed && this.capability === 'Validated' && this.residency === 'Loaded' && !this.failure;
    const operationalStatus =
      this.supportTier === 'Unsupported'
        ? 'Unsupported'
        : this.supportTier === 'Planned'
          ? 'Planned'
          : ready
            ? this.activity === 'Transcribing'
              ? 'Busy'
              : 'Ready'
            : installed && this.capability === 'Validated' && this.residency === 'Unloaded'
              ? 'ValidatedUnloaded'
              : 'NotReady';
    return Object.freeze({
      supportTier: this.supportTier,
      runtimeSetup: this.runtimeSetup,
      modelSetup: this.modelSetup,
      capability: this.capability,
      residency: this.residency,
      activity: this.activity,
      operationalStatus,
      canAttempt: !this.stopped && (this.supportTier === 'Production' || this.supportTier === 'Preview'),
      blockingCode: this.failure?.code ?? null,
    });
  }

  private successResult<T>(action: LocalWhisperActionId, value: T): LocalWhisperActionResult<T> {
    return createLocalWhisperActionSuccess(action, this.snapshotValue.runtime, value);
  }

  private failureResult(action: LocalWhisperActionId, code: LocalWhisperFailureCode): LocalWhisperActionResult<never> {
    return createLocalWhisperActionFailure(action, code, this.snapshotValue.runtime);
  }
}
