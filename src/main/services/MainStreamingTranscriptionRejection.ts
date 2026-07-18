import type { StreamingTranscriptionError } from '../providers/streamingVoiceProvider';

/** Safe rejection for service methods whose success result has no failure arm. */
export class MainStreamingTranscriptionRejection extends Error {
  readonly error: StreamingTranscriptionError;
  readonly retryEligible: boolean;

  constructor(error: StreamingTranscriptionError, retryEligible: boolean) {
    super(error.code);
    this.name = 'MainStreamingTranscriptionRejection';
    this.error = error;
    this.retryEligible = retryEligible;
  }
}
