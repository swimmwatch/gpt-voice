import {
  createProviderAuditLifecycle,
  type ProviderAuditErrorClass,
  type ProviderAuditExceptionType,
  type ProviderAuditLifecycle,
  type ProviderAuditLifecycleInput,
  type ProviderAuditMetadataForFamily,
  type ProviderAuditPhase,
  type ProviderAuditTerminalOutcome,
  type UnknownProviderAuditLifecycleInput,
} from '@main/providerAudit';

import type {
  TranslationProviderFailureCode,
  TranslationProviderOperationMetadata,
  TranslationProviderPhase,
} from './translationProviderContracts';

export type TranslationProviderAuditLifecycle = ProviderAuditLifecycle<'translation'>;
export type TranslationProviderAuditMetadata = ProviderAuditMetadataForFamily<'translation'>;
export type TranslationProviderAuditLifecycleInput =
  ProviderAuditLifecycleInput<'translation'> | UnknownProviderAuditLifecycleInput<'translation'>;
export type TranslationProviderAuditLifecycleFactory = (
  input: TranslationProviderAuditLifecycleInput,
) => TranslationProviderAuditLifecycle;

const NOOP_TRANSLATION_AUDIT_LIFECYCLE: TranslationProviderAuditLifecycle = Object.freeze({
  started: () => undefined,
  phaseEntered: () => undefined,
  phaseCompleted: () => undefined,
  retry: () => undefined,
  recovery: () => undefined,
  terminal: () => undefined,
});

export const defaultTranslationProviderAuditLifecycleFactory: TranslationProviderAuditLifecycleFactory = (input) =>
  createProviderAuditLifecycle<'translation'>(input);

function callAuditSafely(run: () => void): void {
  try {
    run();
  } catch {
    // Provider audit is diagnostic-only and cannot alter Translation behavior.
  }
}

export function makeTranslationProviderAuditLifecycleFailOpen(
  lifecycle: TranslationProviderAuditLifecycle,
): TranslationProviderAuditLifecycle {
  const failOpenLifecycle: TranslationProviderAuditLifecycle = {
    started: (metadata) => callAuditSafely(() => lifecycle.started(metadata)),
    phaseEntered: (phase, metadata) => callAuditSafely(() => lifecycle.phaseEntered(phase, metadata)),
    phaseCompleted: (phase, metadata) => callAuditSafely(() => lifecycle.phaseCompleted(phase, metadata)),
    retry: (phase, metadata) => callAuditSafely(() => lifecycle.retry(phase, metadata)),
    recovery: (phase, metadata) => callAuditSafely(() => lifecycle.recovery(phase, metadata)),
    terminal: (phase, outcome, metadata) => callAuditSafely(() => lifecycle.terminal(phase, outcome, metadata)),
  };
  return Object.freeze(failOpenLifecycle);
}

export function createTranslationProviderAuditLifecycleSafely(
  factory: TranslationProviderAuditLifecycleFactory,
  input: TranslationProviderAuditLifecycleInput,
): TranslationProviderAuditLifecycle {
  try {
    return makeTranslationProviderAuditLifecycleFailOpen(factory(input));
  } catch {
    return NOOP_TRANSLATION_AUDIT_LIFECYCLE;
  }
}

export function toProviderAuditPhase(phase: TranslationProviderPhase): ProviderAuditPhase {
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

export function getTranslationProviderAuditErrorClass(
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

export function createTranslationProviderAuditMetadata(
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
          errorClass: getTranslationProviderAuditErrorClass(options.causeCode, options.exceptionType),
        }),
    ...(options.discarded === undefined ? {} : { discarded: options.discarded }),
    ...(options.exceptionType === undefined ? {} : { exceptionType: options.exceptionType }),
    ...(options.pageClosed === undefined ? {} : { pageClosed: options.pageClosed }),
    ...(options.postSubmission === undefined ? {} : { postSubmission: options.postSubmission }),
    ...(options.recoveryScheduled === undefined ? {} : { recoveryScheduled: options.recoveryScheduled }),
    ...(options.retryScheduled === undefined ? {} : { retryScheduled: options.retryScheduled }),
  };
}

export function getTranslationProviderAuditTerminalOutcome(
  code: TranslationProviderFailureCode,
  signalAborted: boolean,
): ProviderAuditTerminalOutcome {
  if (code !== 'cancelledOrStaleOperation') return 'failure';
  return signalAborted ? 'cancelled' : 'stale';
}
