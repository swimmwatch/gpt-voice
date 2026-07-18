import { BaseVoiceProvider, type VoiceProviderInfo } from './BaseVoiceProvider';

/** Primary transcription is live; inherited transcribe remains the explicit buffered-retry contract. */
export abstract class StreamingVoiceProvider extends BaseVoiceProvider {
  abstract readonly info: VoiceProviderInfo & { readonly transcriptionMode: 'streaming' };
}

declare const STREAMING_TRANSCRIPTION_OPERATION_ID: unique symbol;
declare const COPIED_STREAMING_TRANSCRIPTION_CHUNK: unique symbol;

/** Main-owned identity. Renderer and providers may return it but cannot construct a trusted identity from metadata. */
export type StreamingTranscriptionOperationId = string & {
  readonly [STREAMING_TRANSCRIPTION_OPERATION_ID]: never;
};

/** PCM bytes with ownership detached from the renderer-provided source array. */
export type CopiedStreamingTranscriptionChunk = Uint8Array & {
  readonly [COPIED_STREAMING_TRANSCRIPTION_CHUNK]: never;
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

export interface StartStreamingTranscriptionInput {
  readonly operationId: StreamingTranscriptionOperationId;
}

export interface PushStreamingTranscriptionChunkInput {
  readonly operationId: StreamingTranscriptionOperationId;
  readonly sequence: number;
  readonly chunk: CopiedStreamingTranscriptionChunk;
}

export interface FinishStreamingTranscriptionInput {
  readonly operationId: StreamingTranscriptionOperationId;
  readonly sequence: number;
  /** The final copied, even-length PCM fragment; an empty array is valid. */
  readonly finalChunk: CopiedStreamingTranscriptionChunk;
}

export interface CancelStreamingTranscriptionInput {
  readonly operationId: StreamingTranscriptionOperationId;
}

export interface StreamingTranscriptionStarted {
  readonly operationId: StreamingTranscriptionOperationId;
  readonly lifecycle: StreamingTranscriptionLifecycle.Starting;
}

export interface StreamingTranscriptionChunkAccepted {
  readonly operationId: StreamingTranscriptionOperationId;
  readonly lifecycle: StreamingTranscriptionLifecycle.Streaming;
  readonly acceptedSequence: number;
}

export type StreamingTranscriptionResult =
  | {
      readonly success: true;
      readonly operationId: StreamingTranscriptionOperationId;
      readonly lifecycle: StreamingTranscriptionLifecycle.Completed;
      readonly text: string;
    }
  | {
      readonly success: false;
      readonly operationId: StreamingTranscriptionOperationId;
      readonly error: StreamingTranscriptionError;
    };

export interface StreamingTranscriptionCancellation {
  readonly operationId: StreamingTranscriptionOperationId;
  readonly lifecycle: StreamingTranscriptionLifecycle.Cancelled;
}

export interface StreamingVoiceProviderOperations {
  startStreamingTranscription(input: StartStreamingTranscriptionInput): Promise<StreamingTranscriptionStarted>;
  pushStreamingTranscriptionChunk(
    input: PushStreamingTranscriptionChunkInput,
  ): Promise<StreamingTranscriptionChunkAccepted>;
  finishStreamingTranscription(input: FinishStreamingTranscriptionInput): Promise<StreamingTranscriptionResult>;
  cancelStreamingTranscription(input: CancelStreamingTranscriptionInput): Promise<StreamingTranscriptionCancellation>;
}

export interface StreamingVoiceProviderCapability {
  readonly provider: StreamingVoiceProvider;
  readonly operations: StreamingVoiceProviderOperations;
}

export function copyStreamingTranscriptionChunk(chunk: Uint8Array): CopiedStreamingTranscriptionChunk {
  return Uint8Array.from(chunk) as CopiedStreamingTranscriptionChunk;
}
