import type { TranslationProviderId } from '@shared/translationProvider';
import type { ProviderAuditExceptionType } from '@main/providerAudit';
import type { TranslationProviderAudit, TranslationProviderAuditOperationContext } from './translationProviderAudit';
import type { TranslationOperationLifecycle } from './translationOperationLifecycle';

export const TRANSLATION_PROVIDER_FAILURE_CODES = [
  'unsupportedProvider',
  'unsupportedTargetLanguage',
  'emptyInput',
  'inputTooLong',
  'navigationFailure',
  'consentOrChallenge',
  'pageContractFailure',
  'resultTimeoutOrEmpty',
  'timed-out',
  'cancelledOrStaleOperation',
  'cleanupFailure',
] as const;

export const TRANSLATION_PROVIDER_PHASES = [
  'validation',
  'context',
  'navigation',
  'readiness',
  'sourceDetection',
  'targetSelection',
  'staleState',
  'submission',
  'result',
  'cleanup',
  'shutdown',
] as const;

export type TranslationProviderFailureCode = (typeof TRANSLATION_PROVIDER_FAILURE_CODES)[number];
export type TranslationProviderPhase = (typeof TRANSLATION_PROVIDER_PHASES)[number];

export interface TranslationProviderRequest {
  readonly audit: TranslationProviderAudit;
  readonly auditContext: TranslationProviderAuditOperationContext;
  readonly providerId: TranslationProviderId;
  readonly targetLanguage: string;
  readonly sourceText: string;
  readonly signal?: AbortSignal;
  /** Main-process-only deadline owner shared with the runtime. */
  readonly lifecycle?: TranslationOperationLifecycle;
}

export interface TranslationProviderInitializationRequest {
  readonly audit: TranslationProviderAudit;
  readonly auditContext: TranslationProviderAuditOperationContext;
  readonly providerId: TranslationProviderId;
  readonly targetLanguage: string;
  readonly signal?: AbortSignal;
}

export interface TranslationProviderOperationMetadata {
  readonly providerId?: TranslationProviderId;
  readonly targetLanguage?: string;
  readonly contractVersion?: string;
  readonly sourceLength?: number;
  readonly resultLength?: number;
  readonly durationMs: number;
  readonly attemptCount: number;
  readonly phase: TranslationProviderPhase;
}

export interface TranslationProviderSuccess {
  readonly success: true;
  readonly text: string;
  readonly metadata: TranslationProviderOperationMetadata & {
    readonly providerId: TranslationProviderId;
    readonly targetLanguage: string;
    readonly contractVersion: string;
    readonly sourceLength: number;
    readonly resultLength: number;
  };
}

export interface TranslationProviderInitializationSuccess {
  readonly success: true;
  readonly metadata: TranslationProviderOperationMetadata & {
    readonly providerId: TranslationProviderId;
    readonly targetLanguage: string;
    readonly contractVersion: string;
  };
}

export interface TranslationProviderFailure {
  readonly success: false;
  readonly code: TranslationProviderFailureCode;
  /** Stale/cancelled outcomes must not trigger clipboard, cache, or notification effects. */
  readonly discard: boolean;
  readonly metadata: TranslationProviderOperationMetadata;
}

export type TranslationProviderOutcome = TranslationProviderSuccess | TranslationProviderFailure;
export type TranslationProviderInitializationOutcome =
  TranslationProviderInitializationSuccess | TranslationProviderFailure;

export interface TranslationProviderHookSuccess<T> {
  readonly success: true;
  readonly value: T;
}

export interface TranslationProviderHookFailure {
  readonly success: false;
  readonly code: TranslationProviderFailureCode;
  readonly exceptionType?: ProviderAuditExceptionType;
  readonly recoverableBeforeSubmission?: boolean;
}

export type TranslationProviderHookResult<T = void> =
  TranslationProviderHookSuccess<T> | TranslationProviderHookFailure;

/**
 * One provider-owned public-page observation. Completion evidence is advisory:
 * target, route, generation, and text validation remain mandatory.
 */
export type TranslationProviderCompletionClassification =
  'ambiguous' | 'incomplete' | 'unavailable' | 'verified-complete';

export interface TranslationProviderResultObservation {
  readonly completion: TranslationProviderCompletionClassification;
  readonly targetVerified: boolean;
  readonly text: string;
}

export function translationHookSuccess(): TranslationProviderHookSuccess<void>;
export function translationHookSuccess<T>(value: T): TranslationProviderHookSuccess<T>;
export function translationHookSuccess<T>(value?: T): TranslationProviderHookSuccess<T | undefined> {
  return { success: true, value };
}

export function translationHookFailure(
  code: TranslationProviderFailureCode,
  options: {
    readonly exceptionType?: ProviderAuditExceptionType;
    readonly recoverableBeforeSubmission?: boolean;
  } = {},
): TranslationProviderHookFailure {
  return {
    success: false,
    code,
    ...(options.exceptionType === undefined ? {} : { exceptionType: options.exceptionType }),
    ...(options.recoverableBeforeSubmission === undefined
      ? {}
      : {
          recoverableBeforeSubmission: options.recoverableBeforeSubmission,
        }),
  };
}
