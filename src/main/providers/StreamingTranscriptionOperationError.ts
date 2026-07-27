import type { ProviderAuditExceptionType } from '@main/providerAudit';
import type { StreamingTranscriptionError, StreamingVoiceAuditCauseCode } from './streamingVoiceProvider';

/** Metadata-only rejection for streaming methods whose success contract has no failure arm. */
export class StreamingTranscriptionOperationError extends Error {
  readonly auditCauseCode?: StreamingVoiceAuditCauseCode;
  readonly auditExceptionType?: ProviderAuditExceptionType;
  readonly error: StreamingTranscriptionError;

  constructor(
    error: StreamingTranscriptionError,
    auditCauseCode?: StreamingVoiceAuditCauseCode,
    auditExceptionType?: ProviderAuditExceptionType,
  ) {
    super(error.code);
    this.name = 'StreamingTranscriptionOperationError';
    this.error = error;
    this.auditCauseCode = auditCauseCode;
    this.auditExceptionType = auditExceptionType;
  }
}
