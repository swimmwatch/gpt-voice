import {
  isStreamingTranscriptionPcmChunk,
  isStreamingTranscriptionRecordingWav,
  MAX_PENDING_STREAMING_TRANSCRIPTION_FRAMES,
  MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES,
  STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS,
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  type CancelStreamingTranscriptionIpcResult,
  type FinishStreamingTranscriptionIpcResult,
  type SendStreamingTranscriptionChunkIpcResult,
  type StartStreamingTranscriptionIpcResult,
  type StreamingTranscriptionError,
  type StreamingTranscriptionOperationId,
} from '@shared/streamingTranscription';

export enum StreamingRecordingLocalErrorCode {
  InvalidAudio = 'invalid-streaming-audio',
  QueueOverflow = 'streaming-queue-overflow',
}

export type StreamingRecordingFailure =
  | {
      readonly kind: 'ipc';
      readonly error: StreamingTranscriptionError;
      readonly retryEligible: boolean;
    }
  | {
      readonly kind: 'local';
      readonly code: StreamingRecordingLocalErrorCode;
      readonly retryEligible: boolean;
    };

export interface StreamingTranscriptionRendererClient {
  startStreamingTranscription(): Promise<StartStreamingTranscriptionIpcResult>;
  sendStreamingTranscriptionChunk(
    operationId: StreamingTranscriptionOperationId,
    sequence: number,
    chunk: Uint8Array,
  ): Promise<SendStreamingTranscriptionChunkIpcResult>;
  finishStreamingTranscription(
    operationId: StreamingTranscriptionOperationId,
    sequence: number,
    finalChunk: Uint8Array,
    recordingWav: ArrayBuffer,
  ): Promise<FinishStreamingTranscriptionIpcResult>;
  cancelStreamingTranscription(
    operationId: StreamingTranscriptionOperationId,
  ): Promise<CancelStreamingTranscriptionIpcResult>;
}

export interface StreamingTranscriptionQueueScheduler {
  now(): number;
  wait(durationMs: number): Promise<void>;
}

export interface StreamingTranscriptionQueueOptions {
  readonly client: StreamingTranscriptionRendererClient;
  readonly onFailure: (failure: StreamingRecordingFailure) => void;
  readonly scheduler?: StreamingTranscriptionQueueScheduler;
}

const defaultScheduler: StreamingTranscriptionQueueScheduler = {
  now: () => performance.now(),
  wait: (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
};

function createTransportFailure(retryEligible: boolean): StreamingRecordingFailure {
  return {
    kind: 'ipc',
    error: {
      lifecycle: StreamingTranscriptionLifecycle.Failed,
      code: StreamingTranscriptionErrorCode.TransportFailure,
    },
    retryEligible,
  };
}

function toIpcFailure(
  result: Extract<
    | StartStreamingTranscriptionIpcResult
    | SendStreamingTranscriptionChunkIpcResult
    | FinishStreamingTranscriptionIpcResult,
    { success: false }
  >,
): StreamingRecordingFailure {
  return { kind: 'ipc', error: result.error, retryEligible: result.retryEligible };
}

function toFinishFailure(failure: StreamingRecordingFailure): FinishStreamingTranscriptionIpcResult {
  if (failure.kind === 'ipc') {
    return { success: false, error: failure.error, retryEligible: failure.retryEligible };
  }
  return {
    success: false,
    error: {
      lifecycle: StreamingTranscriptionLifecycle.Failed,
      code:
        failure.code === StreamingRecordingLocalErrorCode.InvalidAudio
          ? StreamingTranscriptionErrorCode.InvalidAudio
          : StreamingTranscriptionErrorCode.OperationConflict,
    },
    retryEligible: failure.retryEligible,
  };
}

/** Owns one renderer streaming operation, its bounded backlog, and deterministic send cadence. */
export class StreamingTranscriptionQueue {
  private readonly client: StreamingTranscriptionRendererClient;
  private readonly onFailure: (failure: StreamingRecordingFailure) => void;
  private readonly operationPromise: Promise<StreamingTranscriptionOperationId | null>;
  private readonly pendingFrames: Uint8Array[] = [];
  private readonly scheduler: StreamingTranscriptionQueueScheduler;
  private cancelPromise: Promise<void> | null = null;
  private cancelled = false;
  private drainPromise: Promise<void> | null = null;
  private failure: StreamingRecordingFailure | null = null;
  private finishPromise: Promise<FinishStreamingTranscriptionIpcResult> | null = null;
  private finishing = false;
  private lastSendStartedAt: number | null = null;
  private nextSequence = 0;
  private operationId: StreamingTranscriptionOperationId | null = null;

  constructor(options: StreamingTranscriptionQueueOptions) {
    this.client = options.client;
    this.onFailure = options.onFailure;
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.operationPromise = this.startOperation();
  }

  enqueueFrame(frame: Uint8Array): boolean {
    if (this.cancelled || this.failure || this.finishing) return false;
    if (
      !isStreamingTranscriptionPcmChunk(frame, false) ||
      frame.byteLength !== MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES
    ) {
      this.fail({ kind: 'local', code: StreamingRecordingLocalErrorCode.InvalidAudio, retryEligible: false });
      return false;
    }
    if (this.pendingFrames.length >= MAX_PENDING_STREAMING_TRANSCRIPTION_FRAMES) {
      this.fail({ kind: 'local', code: StreamingRecordingLocalErrorCode.QueueOverflow, retryEligible: true });
      return false;
    }

    this.pendingFrames.push(frame.slice());
    this.ensureDrain();
    return true;
  }

  finish(finalChunk: Uint8Array, recordingWav: ArrayBuffer): Promise<FinishStreamingTranscriptionIpcResult> {
    if (this.finishPromise) return this.finishPromise;
    this.finishing = true;
    this.finishPromise = this.finishOperation(finalChunk.slice(), recordingWav.slice(0));
    return this.finishPromise;
  }

  cancel(): Promise<void> {
    if (this.cancelPromise) return this.cancelPromise;
    this.cancelled = true;
    this.clearPendingFrames();
    this.cancelPromise = this.cancelOperation();
    return this.cancelPromise;
  }

  private async startOperation(): Promise<StreamingTranscriptionOperationId | null> {
    let result: StartStreamingTranscriptionIpcResult;
    try {
      result = await this.client.startStreamingTranscription();
    } catch {
      this.fail(createTransportFailure(false));
      return null;
    }

    if (!result.success) {
      this.fail(toIpcFailure(result));
      return null;
    }
    if (this.cancelled || this.failure) {
      await this.cancelOperationId(result.operationId);
      return null;
    }

    this.operationId = result.operationId;
    this.ensureDrain();
    return result.operationId;
  }

  private ensureDrain(): void {
    if (this.drainPromise || this.pendingFrames.length === 0 || this.cancelled || this.failure || this.finishing) {
      return;
    }

    const drainPromise = this.drainFrames();
    this.drainPromise = drainPromise;
    void drainPromise.finally(() => {
      if (this.drainPromise !== drainPromise) return;
      this.drainPromise = null;
      if (this.pendingFrames.length > 0) this.ensureDrain();
    });
  }

  private async drainFrames(): Promise<void> {
    const operationId = await this.operationPromise;
    if (!operationId) return;

    while (this.pendingFrames.length > 0 && !this.cancelled && !this.failure) {
      const frame = this.pendingFrames.shift();
      if (!frame) return;
      await this.waitForCadence();
      if (this.cancelled || this.failure) {
        frame.fill(0);
        return;
      }

      const sequence = this.nextSequence;
      this.lastSendStartedAt = this.scheduler.now();
      let result: SendStreamingTranscriptionChunkIpcResult;
      try {
        result = await this.client.sendStreamingTranscriptionChunk(operationId, sequence, frame);
      } catch {
        frame.fill(0);
        this.fail(createTransportFailure(true));
        return;
      }
      frame.fill(0);
      if (!result.success) {
        this.fail(toIpcFailure(result));
        return;
      }
      if (result.operationId !== operationId || result.acceptedSequence !== sequence) {
        this.fail(createTransportFailure(true));
        return;
      }
      this.nextSequence += 1;
    }
  }

  private async waitForCadence(): Promise<void> {
    if (this.lastSendStartedAt === null) return;
    const remaining = STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS - (this.scheduler.now() - this.lastSendStartedAt);
    if (remaining > 0) await this.scheduler.wait(remaining);
  }

  private async finishOperation(
    finalChunk: Uint8Array,
    recordingWav: ArrayBuffer,
  ): Promise<FinishStreamingTranscriptionIpcResult> {
    if (!isStreamingTranscriptionPcmChunk(finalChunk, true) || !isStreamingTranscriptionRecordingWav(recordingWav)) {
      const failure = {
        kind: 'local',
        code: StreamingRecordingLocalErrorCode.InvalidAudio,
        retryEligible: false,
      } satisfies StreamingRecordingFailure;
      this.fail(failure);
      return toFinishFailure(failure);
    }

    const operationId = await this.operationPromise;
    await this.waitForDrain();
    if (this.failure) return toFinishFailure(this.failure);
    if (this.cancelled || !operationId) {
      return {
        success: false,
        error: {
          lifecycle: StreamingTranscriptionLifecycle.Cancelled,
          code: StreamingTranscriptionErrorCode.Cancelled,
        },
        retryEligible: false,
      };
    }

    let result: FinishStreamingTranscriptionIpcResult;
    try {
      result = await this.client.finishStreamingTranscription(
        operationId,
        this.nextSequence,
        finalChunk.slice(),
        recordingWav.slice(0),
      );
    } catch {
      result = toFinishFailure(createTransportFailure(this.nextSequence > 0 || finalChunk.byteLength > 0));
    }
    if (!result.success) this.failure = toIpcFailure(result);
    return result;
  }

  private async waitForDrain(): Promise<void> {
    while (this.drainPromise) await this.drainPromise;
  }

  private async cancelOperation(): Promise<void> {
    const operationId = this.operationId ?? (await this.operationPromise);
    if (operationId) await this.cancelOperationId(operationId);
  }

  private async cancelOperationId(operationId: StreamingTranscriptionOperationId): Promise<void> {
    try {
      await this.client.cancelStreamingTranscription(operationId);
    } catch {
      // Renderer cancellation is best effort; main lifecycle cancellation remains authoritative.
    }
  }

  private fail(failure: StreamingRecordingFailure): void {
    if (this.cancelled || this.failure) return;
    this.failure = failure;
    this.clearPendingFrames();
    if (this.operationId && !this.cancelPromise) {
      this.cancelPromise = this.cancelOperationId(this.operationId);
    }
    try {
      this.onFailure(failure);
    } catch {
      // A presentation callback cannot alter queue ownership or terminal cleanup.
    }
  }

  private clearPendingFrames(): void {
    for (const frame of this.pendingFrames) frame.fill(0);
    this.pendingFrames.length = 0;
  }
}
