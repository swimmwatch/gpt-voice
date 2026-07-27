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
import type { StreamingTranscriptionOperationId } from '@shared/streamingTranscription';

export type VoiceAuditLifecycle = ProviderAuditLifecycle<'voice'>;
export type VoiceAuditMetadata = ProviderAuditMetadataForFamily<'voice'>;
export type VoiceAuditOperationContext = ProviderAuditOperationContext<'voice'>;

export interface VoiceBatchAuditContext extends VoiceAuditOperationContext {
  readonly hasMimeType: boolean;
  readonly inputByteLength: number;
}

export interface VoiceStreamingAuditCounters {
  readonly acceptedByteCount: number;
  readonly chunkCount: number;
  readonly frameCount: number;
}

export interface VoiceAuditMetadataOptions {
  readonly acceptedByteCount?: number;
  readonly attemptCount?: number;
  readonly causeCode?: VoiceAuditMetadata['causeCode'];
  readonly chunkCount?: number;
  readonly durationMs?: number;
  readonly exceptionType?: ProviderAuditExceptionType;
  readonly frameCount?: number;
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
  'invalid-chunk': 'provider-rejection',
  'invalid-operation': 'provider-rejection',
  'invalid-sequence': 'provider-rejection',
  'invalid-settings': 'configuration',
  'malformed-event': 'contract',
  'not-authenticated': 'authentication',
  'not-configured': 'configuration',
  'organization-ambiguous': 'provider-rejection',
  'organization-missing': 'provider-rejection',
  'operation-conflict': 'provider-rejection',
  'overall-timeout': 'timeout',
  'page-shutdown': 'cleanup',
  'provider-contract-changed': 'contract',
  'provider-changed': 'provider-rejection',
  'rate-limit': 'rate-limit',
  'rate-limited': 'rate-limit',
  'request-failed': 'provider-rejection',
  'session-expired': 'authentication',
  'session-invalid': 'authentication',
  'session-missing': 'authentication',
  'unexpected-failure': 'internal',
  'unexpected-response': 'contract',
  'upgrade-or-auth': 'authentication',
  'transport-failure': 'connection',
  cancelled: 'cancellation',
  unknown: 'internal',
} as const satisfies Readonly<Record<NonNullable<VoiceAuditMetadata['causeCode']>, ProviderAuditErrorClass>>;

/** Voice-specific audit mapping, batch context, and terminal behavior. */
export class VoiceProviderAudit extends BaseProviderAudit<'voice'> {
  private static readonly EMPTY_STREAMING_COUNTERS = Object.freeze({
    acceptedByteCount: 0,
    chunkCount: 0,
    frameCount: 0,
  }) satisfies VoiceStreamingAuditCounters;

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

  public getExceptionType(error: unknown): ProviderAuditExceptionType {
    return this.normalizeException(error);
  }

  public createMetadata(options: VoiceAuditMetadataOptions = {}): VoiceAuditMetadata {
    return {
      ...(options.acceptedByteCount === undefined ? {} : { acceptedByteCount: options.acceptedByteCount }),
      ...(options.attemptCount === undefined ? {} : { attemptCount: options.attemptCount }),
      ...(options.chunkCount === undefined ? {} : { chunkCount: options.chunkCount }),
      ...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
      ...(options.frameCount === undefined ? {} : { frameCount: options.frameCount }),
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

  public startStreaming(
    providerId: unknown,
    operationId: StreamingTranscriptionOperationId,
  ): VoiceAuditOperationContext {
    return this.startOperation(
      providerId,
      'transcribe-stream',
      'dispatch',
      this.createMetadata({
        acceptedByteCount: 0,
        chunkCount: 0,
        frameCount: 0,
        transcriptionMode: 'streaming',
      }),
      operationId,
    );
  }

  public createStreamingMetadata(
    context: VoiceAuditOperationContext,
    counters: VoiceStreamingAuditCounters,
    options: VoiceAuditMetadataOptions = {},
  ): VoiceAuditMetadata {
    return this.createMetadata({
      ...options,
      acceptedByteCount: counters.acceptedByteCount,
      chunkCount: counters.chunkCount,
      durationMs: this.durationMs(context),
      frameCount: counters.frameCount,
      transcriptionMode: 'streaming',
    });
  }

  public recordStreamingRejection(providerId: unknown, causeCode: NonNullable<VoiceAuditMetadata['causeCode']>): void {
    const context = this.startOperation(
      providerId,
      'transcribe-stream',
      'validation',
      this.createMetadata({
        ...VoiceProviderAudit.EMPTY_STREAMING_COUNTERS,
        causeCode,
        transcriptionMode: 'streaming',
      }),
    );
    this.terminalStreamingFailure(context, VoiceProviderAudit.EMPTY_STREAMING_COUNTERS, causeCode);
  }

  public getStreamingFailurePhase(causeCode: NonNullable<VoiceAuditMetadata['causeCode']>): ProviderAuditPhase {
    switch (causeCode) {
      case 'invalid-audio':
      case 'invalid-chunk':
      case 'invalid-operation':
      case 'invalid-sequence':
      case 'operation-conflict':
        return 'validation';
      case 'invalid-settings':
      case 'not-configured':
        return 'configuration';
      case 'feature-unavailable':
      case 'not-authenticated':
      case 'organization-ambiguous':
      case 'organization-missing':
      case 'session-expired':
      case 'session-invalid':
      case 'session-missing':
        return 'readiness';
      case 'cancelled':
      case 'cleanup-failed':
        return 'cleanup';
      case 'page-shutdown':
        return 'context';
      case 'provider-changed':
        return 'dispatch';
      default:
        return 'result';
    }
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

  public terminalBatchException(
    context: VoiceBatchAuditContext,
    phase: ProviderAuditPhase,
    error: unknown,
    options: Omit<VoiceAuditMetadataOptions, 'exceptionType'> = {},
  ): void {
    context.lifecycle.terminal(
      phase,
      'failure',
      this.createBatchMetadata(context, {
        ...options,
        causeCode: options.causeCode ?? 'unknown',
        exceptionType: this.normalizeException(error),
      }),
    );
  }

  public terminalStreaming(
    context: VoiceAuditOperationContext,
    counters: VoiceStreamingAuditCounters,
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    options: VoiceAuditMetadataOptions = {},
  ): void {
    context.lifecycle.terminal(phase, outcome, this.createStreamingMetadata(context, counters, options));
  }

  public terminalStreamingFailure(
    context: VoiceAuditOperationContext,
    counters: VoiceStreamingAuditCounters,
    causeCode: NonNullable<VoiceAuditMetadata['causeCode']>,
    exceptionType?: ProviderAuditExceptionType,
  ): void {
    context.lifecycle.terminal(
      this.getStreamingFailurePhase(causeCode),
      causeCode === 'cancelled' ? 'cancelled' : 'failure',
      this.createStreamingMetadata(context, counters, {
        causeCode,
        ...(exceptionType === undefined ? {} : { exceptionType }),
      }),
    );
  }
}
