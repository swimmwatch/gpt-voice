import { StreamingTranscriptionErrorCode, type StreamingTranscriptionError } from '@shared/streamingTranscription';
import { StreamingRecordingLocalErrorCode, type StreamingRecordingFailure } from './streamingTranscriptionQueue';

export type StreamingTranscriptionFailureTranslationKey =
  | 'error.streamingAudioUnavailable'
  | 'error.streamingConnectionFailed'
  | 'error.streamingQueueOverflow'
  | 'error.streamingRecordingCancelled'
  | 'error.streamingRecordingRestart';

function getStreamingErrorTranslationKey(
  error: StreamingTranscriptionError,
): StreamingTranscriptionFailureTranslationKey {
  switch (error.code) {
    case StreamingTranscriptionErrorCode.Cancelled:
      return 'error.streamingRecordingCancelled';
    case StreamingTranscriptionErrorCode.InvalidAudio:
    case StreamingTranscriptionErrorCode.InvalidChunk:
      return 'error.streamingAudioUnavailable';
    case StreamingTranscriptionErrorCode.InvalidOperation:
    case StreamingTranscriptionErrorCode.InvalidSequence:
    case StreamingTranscriptionErrorCode.OperationConflict:
    case StreamingTranscriptionErrorCode.ProviderChanged:
      return 'error.streamingRecordingRestart';
    case StreamingTranscriptionErrorCode.TransportFailure:
      return 'error.streamingConnectionFailed';
  }
}

/** Maps typed live-recording failures to fixed user-safe translation keys. */
export function getStreamingTranscriptionFailureTranslationKey(
  failure: StreamingRecordingFailure,
): StreamingTranscriptionFailureTranslationKey {
  if (failure.kind === 'ipc') return getStreamingErrorTranslationKey(failure.error);

  switch (failure.code) {
    case StreamingRecordingLocalErrorCode.InvalidAudio:
      return 'error.streamingAudioUnavailable';
    case StreamingRecordingLocalErrorCode.QueueOverflow:
      return 'error.streamingQueueOverflow';
  }
}
