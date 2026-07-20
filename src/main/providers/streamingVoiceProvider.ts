import { BaseVoiceProvider, type VoiceProviderInfo } from './BaseVoiceProvider';
import {
  StreamingTranscriptionLifecycle,
  type StreamingTranscriptionError,
  type StreamingTranscriptionOperationId,
} from '@shared/streamingTranscription';

export {
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
  type StreamingTranscriptionError,
  type StreamingTranscriptionOperationId,
} from '@shared/streamingTranscription';

/** Primary transcription is live; inherited transcribe remains the explicit buffered-retry contract. */
export abstract class StreamingVoiceProvider extends BaseVoiceProvider {
  abstract readonly info: VoiceProviderInfo & { readonly transcriptionMode: 'streaming' };
}

declare const COPIED_STREAMING_TRANSCRIPTION_CHUNK: unique symbol;

/** PCM bytes with ownership detached from the renderer-provided source array. */
export type CopiedStreamingTranscriptionChunk = Uint8Array & {
  readonly [COPIED_STREAMING_TRANSCRIPTION_CHUNK]: never;
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
