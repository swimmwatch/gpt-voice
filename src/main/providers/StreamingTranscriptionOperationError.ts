import type { StreamingTranscriptionError } from './streamingVoiceProvider';

/** Metadata-only rejection for streaming methods whose success contract has no failure arm. */
export class StreamingTranscriptionOperationError extends Error {
  readonly error: StreamingTranscriptionError;

  constructor(error: StreamingTranscriptionError) {
    super(error.code);
    this.name = 'StreamingTranscriptionOperationError';
    this.error = error;
  }
}
