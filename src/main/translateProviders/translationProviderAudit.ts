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

import type {
  TranslationProviderFailure,
  TranslationProviderFailureCode,
  TranslationProviderOperationMetadata,
  TranslationProviderPhase,
} from './translationProviderContracts';

export type TranslationProviderAuditLifecycle = ProviderAuditLifecycle<'translation'>;
export type TranslationProviderAuditMetadata = ProviderAuditMetadataForFamily<'translation'>;
export type TranslationProviderAuditOperationContext = ProviderAuditOperationContext<'translation'>;

export interface TranslationProviderAuditMetadataOptions {
  readonly causeCode?: TranslationProviderFailureCode;
  readonly discarded?: boolean;
  readonly durationMs?: number;
  readonly exceptionType?: ProviderAuditExceptionType;
  readonly pageClosed?: boolean;
  readonly postSubmission?: boolean;
  readonly recoveryScheduled?: boolean;
  readonly retryScheduled?: boolean;
}

export interface TranslationProviderAuditFailureOptions extends TranslationProviderAuditMetadataOptions {
  readonly phase?: ProviderAuditPhase;
  readonly signalAborted?: boolean;
}

/** Translation-specific audit mapping and metadata behavior over the shared lifecycle core. */
export class TranslationProviderAudit extends BaseProviderAudit<'translation'> {
  private static readonly POST_SUBMISSION_PHASES: ReadonlySet<TranslationProviderPhase> = new Set([
    'submission',
    'result',
    'cleanup',
  ]);

  public readonly family = 'translation' as const;

  public constructor(dependencies: ProviderAuditDependencies) {
    super(dependencies);
  }

  public startTranslate(
    providerId: unknown,
    metadata: TranslationProviderAuditMetadata = {},
    operationId?: string,
  ): TranslationProviderAuditOperationContext {
    return this.startOperation(providerId, 'translate', 'validation', metadata, operationId);
  }

  public toPhase(phase: TranslationProviderPhase): ProviderAuditPhase {
    switch (phase) {
      case 'sourceDetection':
        return 'source-detection';
      case 'targetSelection':
        return 'target-selection';
      case 'staleState':
        return 'stale-state';
      default:
        return phase;
    }
  }

  public getErrorClass(
    code: TranslationProviderFailureCode,
    exceptionType?: ProviderAuditExceptionType,
  ): ProviderAuditErrorClass {
    if (exceptionType !== undefined && code !== 'cleanupFailure') return 'internal';

    switch (code) {
      case 'unsupportedProvider':
      case 'unsupportedTargetLanguage':
      case 'emptyInput':
      case 'inputTooLong':
        return 'validation';
      case 'navigationFailure':
        return 'connection';
      case 'consentOrChallenge':
        return 'authentication';
      case 'pageContractFailure':
        return 'contract';
      case 'resultTimeoutOrEmpty':
        return 'timeout';
      case 'cancelledOrStaleOperation':
        return 'cancellation';
      case 'cleanupFailure':
        return 'cleanup';
    }
  }

  public createMetadata(
    metadata: TranslationProviderOperationMetadata,
    options: TranslationProviderAuditMetadataOptions = {},
  ): TranslationProviderAuditMetadata {
    const durationMs = options.durationMs ?? metadata.durationMs;
    return {
      attemptCount: metadata.attemptCount,
      durationMs,
      ...(metadata.contractVersion === undefined
        ? {}
        : {
            contractVersion: metadata.contractVersion as TranslationProviderAuditMetadata['contractVersion'],
          }),
      ...(metadata.targetLanguage === undefined
        ? {}
        : {
            targetLanguage: metadata.targetLanguage as TranslationProviderAuditMetadata['targetLanguage'],
          }),
      ...(metadata.sourceLength === undefined ? {} : { sourceLength: metadata.sourceLength }),
      ...(metadata.resultLength === undefined ? {} : { resultLength: metadata.resultLength }),
      ...(options.causeCode === undefined
        ? {}
        : {
            causeCode: options.causeCode,
            errorClass: this.getErrorClass(options.causeCode, options.exceptionType),
          }),
      ...(options.discarded === undefined ? {} : { discarded: options.discarded }),
      ...(options.exceptionType === undefined ? {} : { exceptionType: options.exceptionType }),
      ...(options.pageClosed === undefined ? {} : { pageClosed: options.pageClosed }),
      ...(options.postSubmission === undefined ? {} : { postSubmission: options.postSubmission }),
      ...(options.recoveryScheduled === undefined ? {} : { recoveryScheduled: options.recoveryScheduled }),
      ...(options.retryScheduled === undefined ? {} : { retryScheduled: options.retryScheduled }),
    };
  }

  public getTerminalOutcome(
    code: TranslationProviderFailureCode,
    signalAborted: boolean,
  ): ProviderAuditTerminalOutcome {
    if (code !== 'cancelledOrStaleOperation') return 'failure';
    return signalAborted ? 'cancelled' : 'stale';
  }

  public terminalFailure(
    lifecycle: TranslationProviderAuditLifecycle,
    failure: TranslationProviderFailure,
    options: TranslationProviderAuditFailureOptions = {},
  ): void {
    lifecycle.terminal(
      options.phase ?? this.toPhase(failure.metadata.phase),
      this.getTerminalOutcome(failure.code, options.signalAborted === true),
      this.createMetadata(failure.metadata, {
        causeCode: failure.code,
        discarded: failure.discard,
        durationMs: options.durationMs,
        exceptionType: options.exceptionType,
        pageClosed: options.pageClosed,
        postSubmission:
          options.postSubmission ?? TranslationProviderAudit.POST_SUBMISSION_PHASES.has(failure.metadata.phase),
        recoveryScheduled: options.recoveryScheduled,
        retryScheduled: options.retryScheduled,
      }),
    );
  }
}
