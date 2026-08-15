import {
  areLocalWhisperResidencyKeysEqual,
  LOCAL_WHISPER_FAILURE_DESCRIPTORS,
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  createLocalWhisperAudioChunk,
  hasLocalWhisperControlCharacter,
  parseLocalWhisperCanonicalWav,
  type LocalWhisperFailureCode,
  type LocalWhisperFailureStage,
  type LocalWhisperRecoveryActionId,
  type LocalWhisperResidencyKey,
  type LocalWhisperStateImpact,
  type LocalWhisperWorkerClientMessage,
  type LocalWhisperWorkerDeviceBinding,
  type LocalWhisperWorkerHelloAck,
  type LocalWhisperWorkerLoadAuthority,
  type LocalWhisperWorkerLoadEvidence,
  type LocalWhisperWorkerLoadedModelEvidence,
  type LocalWhisperWorkerProbeAuthority,
  type LocalWhisperWorkerProbeEvidence,
  type LocalWhisperWorkerServerMessage,
  type LocalWhisperWorkerTranscriptionOptions,
} from '@shared/localWhisper';

import type { ManagedArtifactLease } from '../filesystem/ManagedArtifactLease';
import { BoundedStderrRing } from './BoundedStderrRing';
import type { NativeRuntimeLogStreamDecoder } from './NativeRuntimeLogStreamDecoder';
import {
  LOCAL_WHISPER_HANDSHAKE_TIMEOUT_MS,
  LOCAL_WHISPER_KILL_CONFIRMATION_TIMEOUT_MS,
  LOCAL_WHISPER_LOAD_TIMEOUT_MS,
  LOCAL_WHISPER_PROBE_TIMEOUT_MS,
  LOCAL_WHISPER_TERMINATE_TIMEOUT_MS,
  LOCAL_WHISPER_UNLOAD_TIMEOUT_MS,
  LOCAL_WHISPER_WARMUP_TIMEOUT_MS,
  getLocalWhisperTranscriptionTimeoutMs,
} from './LocalWhisperSupervisorConstants';
import {
  type LocalWhisperTransportTerminalCause,
  LocalWhisperWorkerTransport,
  type LocalWhisperWorkerTransportCallbacks,
  type LocalWhisperWorkerTransportStreams,
} from './LocalWhisperWorkerTransport';
import {
  WorkerProcessOwnership,
  type LocalWhisperExpectedHandshake,
  type LocalWhisperOwnedWorkerProcess,
  type LocalWhisperWorkerLaunchAuthority,
} from './WorkerProcessOwnership';

export type LocalWhisperSupervisorState =
  | 'cleanupFailed'
  | 'handshaken'
  | 'idle'
  | 'loaded'
  | 'loading'
  | 'probing'
  | 'probed'
  | 'starting'
  | 'transcribing'
  | 'unloading'
  | 'warmed'
  | 'warming';

export interface LocalWhisperSupervisorFailure {
  readonly code: LocalWhisperFailureCode;
  readonly stage: LocalWhisperFailureStage;
  readonly retryable: boolean;
  readonly recoveryAction: LocalWhisperRecoveryActionId;
  readonly stateImpact: LocalWhisperStateImpact;
}

export type LocalWhisperSupervisorResult<T = undefined> =
  | { readonly success: true; readonly state: LocalWhisperSupervisorState; readonly value: T }
  | {
      readonly success: false;
      readonly state: LocalWhisperSupervisorState;
      readonly error: LocalWhisperSupervisorFailure;
    };

export interface LocalWhisperSupervisorClock {
  clearTimeout(handle: unknown): void;
  setTimeout(callback: () => void, milliseconds: number): unknown;
}

export interface LocalWhisperWorkerSupervisorDependencies {
  readonly clock: LocalWhisperSupervisorClock;
  readonly createTransport: (
    streams: LocalWhisperWorkerTransportStreams,
    callbacks: LocalWhisperWorkerTransportCallbacks,
  ) => LocalWhisperWorkerTransport;
  readonly createNativeRuntimeLogDecoder?: (
    processInstanceId: string | undefined,
  ) => Pick<NativeRuntimeLogStreamDecoder, 'append' | 'clear' | 'finish'>;
  readonly nextRequestId: () => string;
  readonly nativeRuntimeLogDecoder?: Pick<NativeRuntimeLogStreamDecoder, 'append' | 'clear' | 'finish'>;
  readonly ownership: WorkerProcessOwnership;
}

export interface LocalWhisperDeviceBindingAuthority {
  readonly deviceBinding: LocalWhisperWorkerDeviceBinding;
  readonly revalidateDeviceBinding: () => Promise<LocalWhisperWorkerDeviceBinding | null>;
}

export type LocalWhisperProbeRequest = LocalWhisperDeviceBindingAuthority &
  LocalWhisperWorkerProbeAuthority & {
    readonly configurationEpoch: number;
    readonly validateEvidence: (evidence: LocalWhisperWorkerProbeEvidence) => Promise<boolean>;
  };

export type LocalWhisperLoadRequest = LocalWhisperDeviceBindingAuthority &
  LocalWhisperWorkerLoadAuthority & {
    readonly configurationEpoch: number;
    readonly modelLease: ManagedArtifactLease;
    readonly residency: LocalWhisperResidencyKey;
    readonly revalidate: () => Promise<void>;
    readonly validateEvidence: (
      evidence: LocalWhisperWorkerLoadEvidence & LocalWhisperWorkerLoadedModelEvidence,
    ) => Promise<boolean>;
  };

export interface LocalWhisperTranscriptionRequest {
  readonly audio: Uint8Array;
  readonly configurationEpoch: number;
  readonly options: LocalWhisperWorkerTranscriptionOptions;
  readonly settingsEpoch: number;
}

type LocalWhisperSupervisorFailureResult = Extract<LocalWhisperSupervisorResult<unknown>, { readonly success: false }>;

interface PendingRequest {
  readonly afterReceive?: (message: LocalWhisperWorkerServerMessage) => Promise<boolean>;
  readonly complete: (message: LocalWhisperWorkerServerMessage) => void;
  readonly expectedType: LocalWhisperWorkerServerMessage['type'];
  readonly fail: (result: LocalWhisperSupervisorFailureResult) => void;
  readonly requestId: string;
  readonly stage: LocalWhisperFailureStage;
  readonly successState: LocalWhisperSupervisorState;
  readonly timer: unknown;
  readonly validate?: (message: LocalWhisperWorkerServerMessage) => boolean;
}

interface PendingHandshake {
  readonly resolve: (result: LocalWhisperSupervisorResult<undefined>) => void;
  readonly timer: unknown;
}

interface StickyTerminalFailure {
  readonly code: LocalWhisperFailureCode;
  readonly stage: LocalWhisperFailureStage;
}

interface SupervisorRequest<T> {
  readonly afterReceive?: (message: LocalWhisperWorkerServerMessage) => Promise<boolean>;
  readonly afterSend?: () => Promise<void>;
  readonly allowAlongsideTranscription?: boolean;
  readonly expectedType: LocalWhisperWorkerServerMessage['type'];
  readonly message: LocalWhisperWorkerClientMessage;
  readonly stage: LocalWhisperFailureStage;
  readonly successState: LocalWhisperSupervisorState;
  readonly sendSettled?: () => void;
  readonly timeoutMs: number;
  readonly transform: (message: LocalWhisperWorkerServerMessage) => T;
  readonly validate?: (message: LocalWhisperWorkerServerMessage) => boolean;
}

const EMPTY_VALUE = undefined;

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameModelIdentity(left: LocalWhisperResidencyKey['model'], right: LocalWhisperResidencyKey['model']): boolean {
  return (
    left.engine === right.engine &&
    left.logicalModel === right.logicalModel &&
    left.sourceCheckpointRevision === right.sourceCheckpointRevision &&
    left.artifactRevision === right.artifactRevision &&
    left.nativeFormat === right.nativeFormat &&
    left.variant === right.variant
  );
}

function sameResidency(left: LocalWhisperResidencyKey, right: LocalWhisperResidencyKey): boolean {
  return areLocalWhisperResidencyKeysEqual(left, right);
}

function sameDeviceBinding(left: LocalWhisperWorkerDeviceBinding, right: LocalWhisperWorkerDeviceBinding): boolean {
  return left.kind === right.kind && (left.kind === 'cpu' || (right.kind === 'gpuIndex' && left.index === right.index));
}

function createProbeMessage(request: LocalWhisperProbeRequest, requestId: string): LocalWhisperWorkerClientMessage {
  if (!('probeChallenge' in request)) {
    return {
      authorityId: request.authorityId,
      deviceBinding: request.deviceBinding,
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId,
      type: 'probe',
    };
  }
  return {
    authorityId: request.authorityId,
    deviceBinding: request.deviceBinding,
    probeChallenge: request.probeChallenge,
    protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
    registryFingerprint: request.registryFingerprint,
    requestId,
    type: 'probe',
  };
}

function createLoadMessage(request: LocalWhisperLoadRequest, requestId: string): LocalWhisperWorkerClientMessage {
  if (!('loadChallenge' in request)) {
    return {
      authorityId: request.authorityId,
      deviceBinding: request.deviceBinding,
      protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      requestId,
      residency: request.residency,
      type: 'load',
    };
  }
  return {
    authorityId: request.authorityId,
    deviceBinding: request.deviceBinding,
    loadChallenge: request.loadChallenge,
    protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
    registryFingerprint: request.registryFingerprint,
    requestId,
    residency: request.residency,
    type: 'load',
  };
}

function matchesProbeEvidence(message: LocalWhisperWorkerServerMessage, request: LocalWhisperProbeRequest): boolean {
  if (
    message.type !== 'probed' ||
    message.authorityId !== request.authorityId ||
    !sameDeviceBinding(message.deviceBinding, request.deviceBinding)
  ) {
    return false;
  }
  return (
    !('registryFingerprint' in request) ||
    ('registryFingerprint' in message && message.registryFingerprint === request.registryFingerprint)
  );
}

function matchesLoadEvidence(message: LocalWhisperWorkerServerMessage, request: LocalWhisperLoadRequest): boolean {
  if (
    message.type !== 'loaded' ||
    message.authorityId !== request.authorityId ||
    !sameDeviceBinding(message.deviceBinding, request.deviceBinding) ||
    !sameResidency(message.residency, request.residency)
  ) {
    return false;
  }
  return (
    !('registryFingerprint' in request) ||
    ('registryFingerprint' in message && message.registryFingerprint === request.registryFingerprint)
  );
}

/** Owns one worker tree, request registry, exact stage timers, and cleanup promise. */
export class LocalWhisperWorkerSupervisor {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly pendingRevalidations = new Set<string>();
  private readonly usedRequestIds = new Set<string>();
  private readonly stderrRing = new BoundedStderrRing();
  private activeEpoch: number | null = null;
  private activeModelLease: ManagedArtifactLease | null = null;
  private probedDeviceBinding: LocalWhisperWorkerDeviceBinding | null = null;
  private cleanupPromise: Promise<boolean> | null = null;
  private expectsProbeInputClosure = false;
  private expectedHandshake: LocalWhisperExpectedHandshake | null = null;
  private handshake: PendingHandshake | null = null;
  private nativeRuntimeLogDecoder: Pick<NativeRuntimeLogStreamDecoder, 'append' | 'clear' | 'finish'> | undefined;
  private probeInputClosed = false;
  private process: LocalWhisperOwnedWorkerProcess | null = null;
  private stateValue: LocalWhisperSupervisorState = 'idle';
  private stickyTerminalFailure: StickyTerminalFailure | null = null;
  private terminal = false;
  private transcriptionSendPromise: Promise<void> | null = null;
  private transport: LocalWhisperWorkerTransport | null = null;

  public constructor(private readonly dependencies: LocalWhisperWorkerSupervisorDependencies) {}

  public get state(): LocalWhisperSupervisorState {
    return this.stateValue;
  }

  public async startAndHandshake(authority: LocalWhisperWorkerLaunchAuthority): Promise<LocalWhisperSupervisorResult> {
    if (this.stateValue !== 'idle' || this.process || this.cleanupPromise) {
      return this.failure('OPERATION_CONFLICT', 'workerStart');
    }
    this.resetForNewWorker(authority);
    this.stateValue = 'starting';
    try {
      const recovered = await this.dependencies.ownership.recoverOwnedOrphan();
      if (!recovered) {
        this.stateValue = 'cleanupFailed';
        return this.failure('CLEANUP_FAILED', 'cleanup');
      }
      this.process = await this.dependencies.ownership.launch(authority);
      if (authority.workerInputBootstrap && !authority.modelGuardAuthority) {
        await this.writeWorkerInputBootstrap(this.process, authority.workerInputBootstrap);
      }
      this.bindProcess(this.process);
    } catch {
      const cleaned = this.dependencies.ownership.process
        ? await this.cleanupOwnedProcess().catch(() => false)
        : await this.releaseRuntimeLeaseAfterFailedStart(authority.runtimeLease);
      this.activeEpoch = null;
      this.expectedHandshake = null;
      this.stateValue = cleaned ? 'idle' : 'cleanupFailed';
      return this.failure(cleaned ? 'WORKER_START_FAILED' : 'CLEANUP_FAILED', cleaned ? 'workerStart' : 'cleanup');
    }

    const result = new Promise<LocalWhisperSupervisorResult>((resolve) => {
      const timer = this.dependencies.clock.setTimeout(() => {
        void this.failTerminal('OPERATION_TIMEOUT', 'workerStart');
      }, LOCAL_WHISPER_HANDSHAKE_TIMEOUT_MS);
      this.handshake = Object.freeze({ resolve, timer });
    });
    try {
      await this.requireTransport().sendControl({
        type: 'hello',
        protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      });
    } catch {
      void this.failTerminal('WORKER_START_FAILED', 'workerStart');
    }
    return result;
  }

  public async probe(request: LocalWhisperProbeRequest): Promise<LocalWhisperSupervisorResult> {
    if (!this.hasEpoch(request.configurationEpoch)) return this.failure('STALE_CONFIGURATION');
    if (this.stateValue !== 'handshaken') {
      return this.failure('OPERATION_CONFLICT', 'backendInitialization');
    }
    if (!this.isBindingCompatibleWithExpectedBackend(request.deviceBinding)) {
      return this.failBindingAuthority('backendInitialization');
    }
    if (!(await this.revalidateDeviceBinding(request))) {
      return this.failBindingAuthority('backendInitialization');
    }
    this.stateValue = 'probing';
    const requestId = this.reserveRequestId();
    const result = await this.request({
      afterReceive: async (message) =>
        message.type === 'probed' &&
        (await request.validateEvidence(message)) &&
        (await this.revalidateDeviceBinding(request)),
      expectedType: 'probed',
      message: createProbeMessage(request, requestId),
      stage: 'backendInitialization',
      successState: 'probed',
      timeoutMs: LOCAL_WHISPER_PROBE_TIMEOUT_MS,
      transform: () => EMPTY_VALUE,
      validate: (message) => matchesProbeEvidence(message, request),
    });
    if (result.success) this.probedDeviceBinding = request.deviceBinding;
    return result;
  }

  public async load(request: LocalWhisperLoadRequest): Promise<LocalWhisperSupervisorResult> {
    if (!this.hasEpoch(request.configurationEpoch)) return this.failure('STALE_CONFIGURATION');
    if ((this.stateValue !== 'handshaken' && this.stateValue !== 'probed') || this.activeModelLease) {
      return this.failure('OPERATION_CONFLICT', 'modelLoad');
    }
    if (
      this.stateValue === 'probed' &&
      (!this.probedDeviceBinding || !sameDeviceBinding(this.probedDeviceBinding, request.deviceBinding))
    ) {
      return this.failBindingAuthority('modelLoad');
    }
    try {
      request.modelLease.assertActive();
      if (request.modelLease.metadata.purpose !== 'load' || request.modelLease.metadata.artifactKind !== 'model') {
        return this.failure('MODEL_LOAD_FAILED', 'modelLoad');
      }
      await request.revalidate();
      request.modelLease.assertActive();
    } catch {
      return this.failure('MODEL_LOAD_FAILED', 'modelLoad');
    }
    if (!(await this.revalidateDeviceBinding(request))) return this.failBindingAuthority('modelLoad');
    this.activeModelLease = request.modelLease;
    this.stateValue = 'loading';
    const requestId = this.reserveRequestId();
    return this.request({
      afterReceive: async (message) =>
        message.type === 'loaded' &&
        (await request.validateEvidence(message)) &&
        (await this.revalidateDeviceBinding(request)),
      expectedType: 'loaded',
      message: createLoadMessage(request, requestId),
      stage: 'modelLoad',
      successState: 'loaded',
      timeoutMs: LOCAL_WHISPER_LOAD_TIMEOUT_MS,
      transform: () => EMPTY_VALUE,
      validate: (message) => matchesLoadEvidence(message, request),
    });
  }

  public warmup(configurationEpoch: number): Promise<LocalWhisperSupervisorResult> {
    if (!this.hasEpoch(configurationEpoch)) return Promise.resolve(this.failure('STALE_CONFIGURATION'));
    if (this.stateValue !== 'loaded') {
      return Promise.resolve(this.failure('OPERATION_CONFLICT', 'warmup'));
    }
    this.stateValue = 'warming';
    const requestId = this.reserveRequestId();
    return this.request({
      expectedType: 'warmed',
      message: { type: 'warmup', protocolVersion: 1, requestId },
      stage: 'warmup',
      successState: 'warmed',
      timeoutMs: LOCAL_WHISPER_WARMUP_TIMEOUT_MS,
      transform: () => EMPTY_VALUE,
    });
  }

  public async transcribe(request: LocalWhisperTranscriptionRequest): Promise<LocalWhisperSupervisorResult<string>> {
    if (this.stickyTerminalFailure) {
      return this.failure(this.stickyTerminalFailure.code, this.stickyTerminalFailure.stage);
    }
    if (!this.hasEpoch(request.configurationEpoch)) return this.failure('STALE_CONFIGURATION');
    if (this.stateValue !== 'warmed') return this.failure('OPERATION_CONFLICT', 'transcription');
    let audioDurationMs: number;
    try {
      audioDurationMs = parseLocalWhisperCanonicalWav(request.audio).durationMs;
    } catch {
      return this.failure('AUDIO_FORMAT_UNSUPPORTED', 'transcription');
    }
    this.stateValue = 'transcribing';
    const requestId = this.reserveRequestId();
    let resolveSend: () => void = () => undefined;
    const sendPromise = new Promise<void>((resolve) => {
      resolveSend = resolve;
    });
    this.transcriptionSendPromise = sendPromise;
    try {
      const result = await this.request({
        afterSend: () => this.sendAudio(requestId, request.audio),
        expectedType: 'transcript',
        message: {
          type: 'transcribe',
          protocolVersion: 1,
          requestId,
          settingsEpoch: request.settingsEpoch,
          audioByteLength: request.audio.byteLength,
          options: request.options,
        },
        stage: 'transcription',
        successState: 'warmed',
        sendSettled: resolveSend,
        timeoutMs: getLocalWhisperTranscriptionTimeoutMs(audioDurationMs),
        transform: (message) => (message.type === 'transcript' ? message.text : ''),
      });
      if (result.success && result.value.trim().length === 0) {
        return this.failure('EMPTY_TRANSCRIPTION', 'transcription');
      }
      return result;
    } finally {
      resolveSend();
      if (this.transcriptionSendPromise === sendPromise) this.transcriptionSendPromise = null;
    }
  }

  public async cancel(): Promise<LocalWhisperSupervisorResult> {
    await this.transcriptionSendPromise;
    const transcription = [...this.pending.values()].find((request) => request.expectedType === 'transcript');
    if (!transcription || this.stateValue !== 'transcribing') {
      return this.failure('OPERATION_CONFLICT', 'cancellation');
    }
    const requestId = this.reserveRequestId();
    let cancellationTooLate = false;
    const result = await this.request({
      allowAlongsideTranscription: true,
      expectedType: 'cancelled',
      message: {
        type: 'cancel',
        protocolVersion: 1,
        requestId,
        targetRequestId: transcription.requestId,
      },
      stage: 'cancellation',
      successState: 'warmed',
      timeoutMs: LOCAL_WHISPER_TERMINATE_TIMEOUT_MS,
      transform: (message) => {
        cancellationTooLate = message.type === 'cancelTooLate';
        return EMPTY_VALUE;
      },
      validate: (message) =>
        (message.type === 'cancelled' || message.type === 'cancelTooLate') &&
        message.targetRequestId === transcription.requestId,
    });
    if (result.success && cancellationTooLate) return this.failure('OPERATION_CONFLICT', 'cancellation');
    if (result.success) {
      this.resolvePendingAsCancelled(transcription.requestId);
    }
    return result;
  }

  public async unload(configurationEpoch: number): Promise<LocalWhisperSupervisorResult> {
    if (!this.hasEpoch(configurationEpoch)) return this.failure('STALE_CONFIGURATION');
    if (this.stateValue !== 'loaded' && this.stateValue !== 'warmed') {
      return this.failure('OPERATION_CONFLICT', 'cleanup');
    }
    this.stateValue = 'unloading';
    const requestId = this.reserveRequestId();
    const unloaded = await this.request({
      expectedType: 'unloaded',
      message: { type: 'unload', protocolVersion: 1, requestId },
      stage: 'cleanup',
      successState: 'probed',
      timeoutMs: LOCAL_WHISPER_UNLOAD_TIMEOUT_MS,
      transform: () => EMPTY_VALUE,
    });
    if (!unloaded.success) return unloaded;
    return this.shutdownHealthyWorker();
  }

  public async shutdown(): Promise<LocalWhisperSupervisorResult> {
    if (this.stateValue === 'idle') return this.success(EMPTY_VALUE);
    if (this.stateValue === 'loaded' || this.stateValue === 'warmed') {
      const epoch = this.activeEpoch;
      if (epoch === null) return this.failure('CLEANUP_FAILED', 'cleanup');
      return this.unload(epoch);
    }
    if (this.stateValue !== 'handshaken' && this.stateValue !== 'probed') {
      return this.failure('OPERATION_CONFLICT', 'cleanup');
    }
    return this.shutdownHealthyWorker();
  }

  public async forceCleanup(): Promise<LocalWhisperSupervisorResult> {
    const cleaned = await this.cleanupOwnedProcess();
    return cleaned ? this.success(EMPTY_VALUE) : this.failure('CLEANUP_FAILED', 'cleanup');
  }

  private bindProcess(process: LocalWhisperOwnedWorkerProcess): void {
    this.nativeRuntimeLogDecoder = this.dependencies.createNativeRuntimeLogDecoder
      ? this.dependencies.createNativeRuntimeLogDecoder(process.nativeRuntimeProcessInstanceId)
      : this.dependencies.nativeRuntimeLogDecoder;
    process.stderr.on('data', this.onStderr);
    process.stderr.once('end', this.onStderrEnd);
    this.transport = this.dependencies.createTransport(
      { input: process.input, output: process.output },
      { onMessage: this.onMessage, onTerminal: this.onTransportTerminal },
    );
  }

  private writeWorkerInputBootstrap(process: LocalWhisperOwnedWorkerProcess, bytes: Uint8Array): Promise<void> {
    if (bytes.byteLength === 0 || bytes.byteLength > 4_096) {
      return Promise.reject(new Error('Invalid Local Whisper worker input bootstrap'));
    }
    return new Promise<void>((resolve, reject) => {
      process.input.write(Buffer.from(bytes), (error) => {
        if (error) reject(new Error('Local Whisper worker input bootstrap failed'));
        else resolve();
      });
    });
  }

  private async request<T>(request: SupervisorRequest<T>): Promise<LocalWhisperSupervisorResult<T>> {
    const { afterReceive, expectedType, message, stage, successState, timeoutMs, transform, validate } = request;
    const allowAlongsideTranscription = request.allowAlongsideTranscription ?? false;
    if (this.terminal || (!allowAlongsideTranscription && this.pending.size !== 0)) {
      return this.failure('OPERATION_CONFLICT', stage);
    }
    const requestId = 'requestId' in message ? message.requestId : null;
    if (!requestId) return this.failure('WORKER_PROTOCOL_VIOLATION', 'protocol');
    const result = new Promise<LocalWhisperSupervisorResult<T>>((resolve) => {
      const timer = this.dependencies.clock.setTimeout(() => {
        void this.failTerminal('OPERATION_TIMEOUT', stage);
      }, timeoutMs);
      this.pending.set(
        requestId,
        Object.freeze({
          afterReceive,
          complete: (serverMessage: LocalWhisperWorkerServerMessage) => resolve(this.success(transform(serverMessage))),
          expectedType,
          fail: (failure: LocalWhisperSupervisorFailureResult) => resolve(failure),
          requestId,
          stage,
          successState,
          timer,
          validate,
        }),
      );
    });
    try {
      await this.requireTransport().sendControl(message);
      await request.afterSend?.();
    } catch {
      void this.failTerminal('WORKER_CRASHED', stage);
    } finally {
      request.sendSettled?.();
    }
    return result;
  }

  private async sendAudio(requestId: string, audio: Uint8Array): Promise<void> {
    let sequence = 0;
    for (let offset = 0; offset < audio.byteLength; offset += LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES) {
      const end = Math.min(offset + LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES, audio.byteLength);
      await this.requireTransport().sendAudio(
        createLocalWhisperAudioChunk(requestId, sequence, end === audio.byteLength, audio.subarray(offset, end)),
      );
      sequence += 1;
    }
  }

  private readonly onMessage = (message: LocalWhisperWorkerServerMessage): void => {
    if (this.terminal) return;
    if (this.pendingRevalidations.size !== 0) {
      void this.failTerminal('WORKER_PROTOCOL_VIOLATION', 'protocol');
      return;
    }
    if (message.type === 'helloAck') {
      this.handleHandshake(message);
      return;
    }
    if (message.type === 'failure' && message.requestId === null && this.handshake) {
      void this.failTerminal(message.code, 'workerStart');
      return;
    }
    if (!('requestId' in message) || message.requestId === null) {
      void this.failTerminal('WORKER_PROTOCOL_VIOLATION', 'protocol');
      return;
    }
    const pending = this.pending.get(message.requestId);
    if (!pending) {
      void this.failTerminal('WORKER_PROTOCOL_VIOLATION', 'protocol');
      return;
    }
    if (message.type === 'failure') {
      void this.failTerminal(message.code, pending.stage);
      return;
    }
    const matchesExpectedType =
      message.type === pending.expectedType ||
      (pending.expectedType === 'cancelled' && message.type === 'cancelTooLate');
    if (!matchesExpectedType || (pending.validate && !pending.validate(message))) {
      void this.failTerminal('WORKER_PROTOCOL_VIOLATION', 'protocol');
      return;
    }
    this.pendingRevalidations.add(pending.requestId);
    void this.completePending(pending, message);
  };

  private async completePending(pending: PendingRequest, message: LocalWhisperWorkerServerMessage): Promise<void> {
    if (pending.afterReceive) {
      let valid: boolean;
      try {
        valid = await pending.afterReceive(message);
      } catch {
        valid = false;
      }
      if (!valid) {
        await this.failTerminal('DEVICE_NOT_FOUND', pending.stage);
        return;
      }
    }
    if (this.terminal || this.pending.get(pending.requestId) !== pending) return;
    this.pendingRevalidations.delete(pending.requestId);
    this.pending.delete(pending.requestId);
    this.dependencies.clock.clearTimeout(pending.timer);
    this.stateValue = pending.successState;
    const completeAfterProbeCleanup = pending.expectedType === 'probed' && this.probeInputClosed;
    if (completeAfterProbeCleanup) {
      const cleaned = await this.cleanupOwnedProcess();
      if (!cleaned) {
        pending.fail(this.failureResult('CLEANUP_FAILED', 'cleanup'));
        return;
      }
    }
    pending.complete(message);
  }

  private handleHandshake(message: LocalWhisperWorkerHelloAck): void {
    const handshake = this.handshake;
    const expected = this.expectedHandshake;
    if (!handshake || !expected || this.stateValue !== 'starting') {
      void this.failTerminal('WORKER_PROTOCOL_VIOLATION', 'protocol');
      return;
    }
    if (
      message.engine !== expected.engine ||
      message.runtimeRevision !== expected.runtimeRevision ||
      message.runtimeBuildDigest !== expected.runtimeBuildDigest ||
      message.backend !== expected.backend ||
      !sameStringList(message.capabilities, expected.capabilities) ||
      message.maxControlFrameBytes !== LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES ||
      message.maxAudioChunkBytes !== LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES
    ) {
      void this.failTerminal('WORKER_PROTOCOL_MISMATCH', 'protocol');
      return;
    }
    this.dependencies.clock.clearTimeout(handshake.timer);
    this.handshake = null;
    this.stateValue = 'handshaken';
    handshake.resolve(this.success(EMPTY_VALUE));
  }

  private readonly onTransportTerminal = (cause: LocalWhisperTransportTerminalCause): void => {
    if (cause === 'inputClosed' && this.isExpectedProbeInputClosure()) {
      this.probeInputClosed = true;
      if (this.stateValue === 'probed') void this.cleanupOwnedProcess();
      return;
    }
    void this.failTerminal(
      cause === 'protocolViolation' ? 'WORKER_PROTOCOL_VIOLATION' : 'WORKER_CRASHED',
      cause === 'protocolViolation' ? 'protocol' : this.currentFailureStage(),
    );
  };

  private readonly onStderr = (chunk: Buffer): void => {
    this.stderrRing.append(chunk);
    this.nativeRuntimeLogDecoder?.append(chunk);
  };

  private readonly onStderrEnd = (): void => this.nativeRuntimeLogDecoder?.finish();

  private async failTerminal(code: LocalWhisperFailureCode, stage: LocalWhisperFailureStage): Promise<void> {
    if (this.terminal) return;
    this.terminal = true;
    const handshake = this.handshake;
    this.handshake = null;
    if (handshake) this.dependencies.clock.clearTimeout(handshake.timer);
    const pending = [...this.pending.values()];
    this.pending.clear();
    this.pendingRevalidations.clear();
    for (const request of pending) this.dependencies.clock.clearTimeout(request.timer);
    const cleaned = await this.cleanupOwnedProcess();
    const finalCode: LocalWhisperFailureCode = cleaned ? code : 'CLEANUP_FAILED';
    const finalStage: LocalWhisperFailureStage = cleaned ? stage : 'cleanup';
    this.stickyTerminalFailure = Object.freeze({ code: finalCode, stage: finalStage });
    const failure = this.failureResult(finalCode, finalStage);
    handshake?.resolve(failure);
    for (const request of pending) request.fail(failure);
  }

  private async shutdownHealthyWorker(): Promise<LocalWhisperSupervisorResult> {
    const requestId = this.reserveRequestId();
    const acknowledged = await this.request({
      expectedType: 'shutdownAck',
      message: { type: 'shutdown', protocolVersion: 1, requestId },
      stage: 'cleanup',
      successState: this.stateValue,
      timeoutMs: LOCAL_WHISPER_UNLOAD_TIMEOUT_MS,
      transform: () => EMPTY_VALUE,
    });
    if (!acknowledged.success) return acknowledged;
    const cleaned = await this.cleanupOwnedProcess();
    return cleaned ? this.success(EMPTY_VALUE) : this.failure('CLEANUP_FAILED', 'cleanup');
  }

  private cleanupOwnedProcess(): Promise<boolean> {
    this.cleanupPromise ??= this.runCleanup().finally(() => {
      this.cleanupPromise = null;
    });
    return this.cleanupPromise;
  }

  private async runCleanup(): Promise<boolean> {
    const process = this.process;
    this.transport?.dispose();
    this.transport = null;
    if (!process) {
      await this.releaseModelLease();
      this.stateValue = 'idle';
      this.terminal = false;
      return true;
    }
    process.stderr.off('data', this.onStderr);
    let exited = await process.waitForExit(0).catch(() => false);
    if (!exited) {
      await process.requestTreeTermination().catch(() => undefined);
      exited = await process.waitForExit(LOCAL_WHISPER_TERMINATE_TIMEOUT_MS).catch(() => false);
    }
    if (!exited) {
      process.closeOwnershipControl();
      await process.forceTreeTermination().catch(() => undefined);
      exited = await process.waitForExit(LOCAL_WHISPER_KILL_CONFIRMATION_TIMEOUT_MS).catch(() => false);
    }
    if (!exited) {
      this.dependencies.ownership.retainFailedOwnership();
      this.stateValue = 'cleanupFailed';
      return false;
    }
    try {
      await this.dependencies.ownership.releaseAfterConfirmedExit();
      await this.releaseModelLease();
    } catch {
      this.dependencies.ownership.retainFailedOwnership();
      this.stateValue = 'cleanupFailed';
      return false;
    }
    this.process = null;
    this.expectedHandshake = null;
    this.activeEpoch = null;
    this.probedDeviceBinding = null;
    this.stderrRing.clear();
    this.nativeRuntimeLogDecoder?.finish();
    this.nativeRuntimeLogDecoder?.clear();
    this.nativeRuntimeLogDecoder = undefined;
    this.stateValue = 'idle';
    this.terminal = false;
    return true;
  }

  private async releaseModelLease(): Promise<void> {
    const lease = this.activeModelLease;
    this.activeModelLease = null;
    if (lease && !lease.released) await lease.release().catch(() => undefined);
  }

  private async releaseRuntimeLeaseAfterFailedStart(lease: ManagedArtifactLease): Promise<boolean> {
    try {
      if (!lease.released) await lease.release();
      return true;
    } catch {
      return false;
    }
  }

  private resolvePendingAsCancelled(requestId: string): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    this.pendingRevalidations.delete(requestId);
    this.dependencies.clock.clearTimeout(pending.timer);
    pending.fail(this.failureResult('CANCELLED', 'cancellation'));
  }

  private reserveRequestId(): string {
    const requestId = this.dependencies.nextRequestId();
    if (
      requestId.length === 0 ||
      requestId.length > 128 ||
      hasLocalWhisperControlCharacter(requestId) ||
      Buffer.byteLength(requestId, 'utf8') > 128 ||
      this.usedRequestIds.has(requestId)
    ) {
      throw new Error('Invalid Local Whisper request ID');
    }
    this.usedRequestIds.add(requestId);
    return requestId;
  }

  private resetForNewWorker(authority: LocalWhisperWorkerLaunchAuthority): void {
    this.activeEpoch = authority.configurationEpoch;
    this.expectsProbeInputClosure = authority.launchMode === 'probe';
    this.expectedHandshake = authority.expectedHandshake;
    this.probeInputClosed = false;
    this.probedDeviceBinding = null;
    this.usedRequestIds.clear();
    this.stderrRing.clear();
    this.stickyTerminalFailure = null;
    this.terminal = false;
  }

  private isBindingCompatibleWithExpectedBackend(binding: LocalWhisperWorkerDeviceBinding): boolean {
    return this.expectedHandshake?.backend === 'cpu' ? binding.kind === 'cpu' : binding.kind === 'gpuIndex';
  }

  private isExpectedProbeInputClosure(): boolean {
    if (!this.expectsProbeInputClosure) return false;
    if (this.stateValue === 'probed' && this.pending.size === 0 && this.pendingRevalidations.size === 0) return true;
    if (this.stateValue !== 'probing' || this.pending.size !== 1 || this.pendingRevalidations.size !== 1) return false;
    const pending = this.pending.values().next().value as PendingRequest | undefined;
    return pending?.expectedType === 'probed' && this.pendingRevalidations.has(pending.requestId);
  }

  private async revalidateDeviceBinding(authority: LocalWhisperDeviceBindingAuthority): Promise<boolean> {
    try {
      const current = await authority.revalidateDeviceBinding();
      return current !== null && sameDeviceBinding(current, authority.deviceBinding);
    } catch {
      return false;
    }
  }

  private async failBindingAuthority(stage: LocalWhisperFailureStage): Promise<LocalWhisperSupervisorFailureResult> {
    this.terminal = true;
    const cleaned = await this.cleanupOwnedProcess();
    return this.failureResult(cleaned ? 'DEVICE_NOT_FOUND' : 'CLEANUP_FAILED', cleaned ? stage : 'cleanup');
  }

  private hasEpoch(configurationEpoch: number): boolean {
    return this.activeEpoch !== null && this.activeEpoch === configurationEpoch;
  }

  private requireTransport(): LocalWhisperWorkerTransport {
    if (!this.transport) throw new Error('Local Whisper transport is unavailable');
    return this.transport;
  }

  private currentFailureStage(): LocalWhisperFailureStage {
    return this.pending.values().next().value?.stage ?? (this.handshake ? 'workerStart' : 'cleanup');
  }

  private success<T>(value: T): LocalWhisperSupervisorResult<T> {
    return Object.freeze({ success: true, state: this.stateValue, value });
  }

  private failure<T = undefined>(
    code: LocalWhisperFailureCode,
    stage: LocalWhisperFailureStage = LOCAL_WHISPER_FAILURE_DESCRIPTORS[code].stage,
  ): LocalWhisperSupervisorResult<T> {
    return this.failureResult(code, stage);
  }

  private failureResult(
    code: LocalWhisperFailureCode,
    stage: LocalWhisperFailureStage = LOCAL_WHISPER_FAILURE_DESCRIPTORS[code].stage,
  ): LocalWhisperSupervisorFailureResult {
    const descriptor = LOCAL_WHISPER_FAILURE_DESCRIPTORS[code];
    return Object.freeze({
      success: false,
      state: this.stateValue,
      error: Object.freeze({
        code,
        stage,
        retryable: descriptor.retryable,
        recoveryAction: descriptor.recoveryAction,
        stateImpact: descriptor.stateImpact,
      }),
    });
  }
}

export type { LocalWhisperWorkerLaunchAuthority };
