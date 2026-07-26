import {
  BaseProviderAudit,
  type ProviderAuditDependencies,
  type ProviderAuditErrorClass,
  type ProviderAuditExceptionType,
  type ProviderAuditLifecycle,
  type ProviderAuditMetadataForFamily,
  type ProviderAuditOperationContext,
  type ProviderAuditPhase,
  type ProviderAuditTerminalOutcome,
} from '@main/providerAudit';

export type VoiceAuditLifecycle = ProviderAuditLifecycle<'voice'>;
export type VoiceAuditMetadata = ProviderAuditMetadataForFamily<'voice'>;
export type VoiceAuditOperationContext = ProviderAuditOperationContext<'voice'>;

export interface VoiceBatchAuditContext extends VoiceAuditOperationContext {
  readonly hasMimeType: boolean;
  readonly inputByteLength: number;
}

export interface VoiceAuditMetadataOptions {
  readonly attemptCount?: number;
  readonly causeCode?: VoiceAuditMetadata['causeCode'];
  readonly durationMs?: number;
  readonly exceptionType?: ProviderAuditExceptionType;
  readonly hasMimeType?: boolean;
  readonly httpStatus?: number;
  readonly inputByteLength?: number;
  readonly pageClosed?: boolean;
  readonly recoveryScheduled?: boolean;
  readonly resultLength?: number;
  readonly retryScheduled?: boolean;
  readonly transcriptionMode?: VoiceAuditMetadata['transcriptionMode'];
}

const VOICE_AUDIT_ERROR_CLASS_BY_CAUSE = {
  'cleanup-failed': 'cleanup',
  'connect-timeout': 'connection',
  'connection-failed': 'connection',
  'connection-loss': 'connection',
  'diagnostic-redaction-failed': 'internal',
  'diagnostic-row-too-large': 'internal',
  'diagnostic-storage-failed': 'internal',
  'diagnostic-storage-unavailable': 'internal',
  'drain-timeout': 'timeout',
  'empty-result': 'provider-rejection',
  'feature-unavailable': 'provider-rejection',
  'first-event-timeout': 'timeout',
  'invalid-audio': 'provider-rejection',
  'invalid-settings': 'configuration',
  'malformed-event': 'contract',
  'not-authenticated': 'authentication',
  'not-configured': 'configuration',
  'organization-ambiguous': 'provider-rejection',
  'organization-missing': 'provider-rejection',
  'overall-timeout': 'timeout',
  'page-shutdown': 'cleanup',
  'provider-contract-changed': 'contract',
  'rate-limit': 'rate-limit',
  'rate-limited': 'rate-limit',
  'request-failed': 'provider-rejection',
  'session-expired': 'authentication',
  'session-invalid': 'authentication',
  'session-missing': 'authentication',
  'unexpected-failure': 'internal',
  'unexpected-response': 'contract',
  'upgrade-or-auth': 'authentication',
  cancelled: 'cancellation',
  unknown: 'internal',
} as const satisfies Readonly<Record<NonNullable<VoiceAuditMetadata['causeCode']>, ProviderAuditErrorClass>>;

/** Voice-specific audit mapping, batch context, and terminal behavior. */
export class VoiceProviderAudit extends BaseProviderAudit<'voice'> {
  public readonly family = 'voice' as const;

  public constructor(dependencies: Partial<ProviderAuditDependencies> = {}) {
    super(dependencies);
  }

  public getErrorClass(
    causeCode: NonNullable<VoiceAuditMetadata['causeCode']>,
    exceptionType?: ProviderAuditExceptionType,
  ): ProviderAuditErrorClass {
    if (exceptionType !== undefined && causeCode !== 'cleanup-failed') return 'internal';
    return VOICE_AUDIT_ERROR_CLASS_BY_CAUSE[causeCode];
  }

  public createMetadata(options: VoiceAuditMetadataOptions = {}): VoiceAuditMetadata {
    return {
      ...(options.attemptCount === undefined ? {} : { attemptCount: options.attemptCount }),
      ...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
      ...(options.httpStatus === undefined ? {} : { httpStatus: options.httpStatus }),
      ...(options.inputByteLength === undefined ? {} : { inputByteLength: options.inputByteLength }),
      ...(options.resultLength === undefined ? {} : { resultLength: options.resultLength }),
      ...(options.causeCode === undefined
        ? {}
        : {
            causeCode: options.causeCode,
            errorClass: this.getErrorClass(options.causeCode, options.exceptionType),
          }),
      ...(options.exceptionType === undefined ? {} : { exceptionType: options.exceptionType }),
      ...(options.transcriptionMode === undefined ? {} : { transcriptionMode: options.transcriptionMode }),
      ...(options.hasMimeType === undefined ? {} : { hasMimeType: options.hasMimeType }),
      ...(options.pageClosed === undefined ? {} : { pageClosed: options.pageClosed }),
      ...(options.recoveryScheduled === undefined ? {} : { recoveryScheduled: options.recoveryScheduled }),
      ...(options.retryScheduled === undefined ? {} : { retryScheduled: options.retryScheduled }),
    };
  }

  public startBatch(providerId: unknown, buffer: ArrayBuffer, mimeType: string): VoiceBatchAuditContext {
    const metadata = this.createMetadata({
      hasMimeType: Boolean(mimeType),
      inputByteLength: buffer.byteLength,
      transcriptionMode: 'batch',
    });
    return Object.freeze({
      ...this.startOperation(providerId, 'transcribe-batch', 'dispatch', metadata),
      hasMimeType: Boolean(mimeType),
      inputByteLength: buffer.byteLength,
    });
  }

  public createBatchMetadata(
    context: VoiceBatchAuditContext,
    options: VoiceAuditMetadataOptions = {},
  ): VoiceAuditMetadata {
    return this.createMetadata({
      ...options,
      durationMs: this.durationMs(context),
      hasMimeType: context.hasMimeType,
      inputByteLength: context.inputByteLength,
      transcriptionMode: 'batch',
    });
  }

  public terminalException(
    context: VoiceAuditOperationContext,
    phase: ProviderAuditPhase,
    error: unknown,
    options: Omit<VoiceAuditMetadataOptions, 'exceptionType'> = {},
  ): void {
    const exceptionType = this.normalizeException(error);
    context.lifecycle.terminal(
      phase,
      'failure',
      this.createMetadata({
        ...options,
        causeCode: options.causeCode ?? 'unknown',
        durationMs: this.durationMs(context),
        exceptionType,
      }),
    );
  }

  public terminalBatch(
    context: VoiceBatchAuditContext,
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    options: VoiceAuditMetadataOptions = {},
  ): void {
    context.lifecycle.terminal(phase, outcome, this.createBatchMetadata(context, options));
  }
}

export const voiceProviderAudit = new VoiceProviderAudit();
