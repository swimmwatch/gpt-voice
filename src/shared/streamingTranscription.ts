declare const STREAMING_TRANSCRIPTION_OPERATION_ID: unique symbol;

export const MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES = 2_730;
export const MAX_PENDING_STREAMING_TRANSCRIPTION_FRAMES = 64;
export const STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS = 85.31;

export const STREAMING_TRANSCRIPTION_IPC_CHANNELS = {
  start: 'start-streaming-transcription',
  sendChunk: 'send-streaming-transcription-chunk',
  finish: 'finish-streaming-transcription',
  cancel: 'cancel-streaming-transcription',
} as const;

/** Opaque operation identity created in main and returned to the renderer. */
export type StreamingTranscriptionOperationId = string & {
  readonly [STREAMING_TRANSCRIPTION_OPERATION_ID]: never;
};

export enum StreamingTranscriptionLifecycle {
  Starting = 'starting',
  Streaming = 'streaming',
  Finishing = 'finishing',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
}

export enum StreamingTranscriptionErrorCode {
  Cancelled = 'cancelled',
  InvalidAudio = 'invalid-audio',
  InvalidChunk = 'invalid-chunk',
  InvalidOperation = 'invalid-operation',
  InvalidSequence = 'invalid-sequence',
  OperationConflict = 'operation-conflict',
  ProviderChanged = 'provider-changed',
  TransportFailure = 'transport-failure',
}

type StreamingTranscriptionFailureCode = Exclude<
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionErrorCode.Cancelled
>;

export type StreamingTranscriptionError =
  | {
      readonly lifecycle: StreamingTranscriptionLifecycle.Cancelled;
      readonly code: StreamingTranscriptionErrorCode.Cancelled;
    }
  | {
      readonly lifecycle: StreamingTranscriptionLifecycle.Failed;
      readonly code: StreamingTranscriptionFailureCode;
    };

export interface StreamingTranscriptionIpcFailure {
  readonly success: false;
  readonly error: StreamingTranscriptionError;
  readonly retryEligible: boolean;
}

export type StartStreamingTranscriptionIpcResult =
  | {
      readonly success: true;
      readonly operationId: StreamingTranscriptionOperationId;
      readonly lifecycle: StreamingTranscriptionLifecycle.Starting;
    }
  | StreamingTranscriptionIpcFailure;

export type SendStreamingTranscriptionChunkIpcResult =
  | {
      readonly success: true;
      readonly operationId: StreamingTranscriptionOperationId;
      readonly lifecycle: StreamingTranscriptionLifecycle.Streaming;
      readonly acceptedSequence: number;
    }
  | StreamingTranscriptionIpcFailure;

export type FinishStreamingTranscriptionIpcResult =
  | {
      readonly success: true;
      readonly lifecycle: StreamingTranscriptionLifecycle.Completed;
      readonly text: string;
    }
  | StreamingTranscriptionIpcFailure;

export type CancelStreamingTranscriptionIpcResult =
  | {
      readonly success: true;
      readonly operationId: StreamingTranscriptionOperationId;
      readonly lifecycle: StreamingTranscriptionLifecycle.Cancelled;
    }
  | StreamingTranscriptionIpcFailure;

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function isStreamingTranscriptionOperationId(value: unknown): value is StreamingTranscriptionOperationId {
  return typeof value === 'string' && CANONICAL_UUID_PATTERN.test(value);
}

export function isStreamingTranscriptionSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isStreamingTranscriptionPcmChunk(value: unknown, allowEmpty: boolean): value is Uint8Array {
  return (
    value instanceof Uint8Array &&
    (allowEmpty || value.byteLength > 0) &&
    value.byteLength <= MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES &&
    value.byteLength % 2 === 0
  );
}

export function isStreamingTranscriptionRecordingWav(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}
