import { BING_TRANSLATION_LANGUAGES } from '@shared/translationLanguages/bing';
import { GOOGLE_TRANSLATION_LANGUAGES } from '@shared/translationLanguages/google';
import { YANDEX_TRANSLATION_LANGUAGES } from '@shared/translationLanguages/yandex';
import type { PrettifyModelSource } from '@shared/prettifySettings';
import type { VoiceTranscriptionMode } from '@shared/voiceProvider';

import type { ProviderAuditCauseCode, ProviderAuditOperation, ProviderAuditProviderId } from './mappings';

export const PROVIDER_AUDIT_SCHEMA_VERSION = 1 as const;
export const PROVIDER_AUDIT_LABEL = 'Provider audit event' as const;

export const PROVIDER_AUDIT_FAMILIES = ['voice', 'prettify', 'translation'] as const;
export const PROVIDER_AUDIT_EVENTS = [
  'started',
  'phase-entered',
  'phase-completed',
  'retry',
  'recovery',
  'terminal',
] as const;
export const PROVIDER_AUDIT_PHASES = [
  'dispatch',
  'validation',
  'configuration',
  'session',
  'readiness',
  'context',
  'navigation',
  'consent-or-challenge',
  'source-detection',
  'target-selection',
  'stale-state',
  'submission',
  'streaming',
  'result',
  'model-discovery',
  'model-lifecycle',
  'process',
  'recovery',
  'cleanup',
  'shutdown',
] as const;
export const PROVIDER_AUDIT_OUTCOMES = ['in-progress', 'success', 'failure', 'cancelled', 'stale'] as const;
export const PROVIDER_AUDIT_TERMINAL_OUTCOMES = ['success', 'failure', 'cancelled', 'stale'] as const;
export const PROVIDER_AUDIT_SEVERITIES = ['info', 'warn', 'error'] as const;
export const PROVIDER_AUDIT_ERROR_CLASSES = [
  'validation',
  'configuration',
  'authentication',
  'provider-rejection',
  'rate-limit',
  'connection',
  'timeout',
  'contract',
  'cancellation',
  'cleanup',
  'internal',
] as const;
export const PROVIDER_AUDIT_EXCEPTION_TYPES = [
  'Error',
  'TypeError',
  'SyntaxError',
  'RangeError',
  'AbortError',
  'TimeoutError',
  'unknown',
] as const;
export const PROVIDER_AUDIT_CONTRACT_VERSIONS = ['2026-07-25'] as const;
export const PROVIDER_AUDIT_MODEL_SOURCES = [
  'http',
  'known-aliases',
  'catalog',
  'bundled',
  'configured-model',
] as const satisfies readonly PrettifyModelSource[];
export const PROVIDER_AUDIT_TRANSCRIPTION_MODES = [
  'batch',
  'streaming',
] as const satisfies readonly VoiceTranscriptionMode[];

export const PROVIDER_AUDIT_METADATA_KEYS = [
  'acceptedByteCount',
  'attemptCount',
  'causeCode',
  'chunkCount',
  'contractVersion',
  'discarded',
  'durationMs',
  'errorClass',
  'exceptionType',
  'frameCount',
  'hasFilePath',
  'hasMessage',
  'hasMimeType',
  'hasStackTrace',
  'hasUrl',
  'httpStatus',
  'inputByteLength',
  'modelConfigured',
  'modelNameLength',
  'modelSource',
  'pageClosed',
  'postSubmission',
  'providerKnown',
  'recoveryScheduled',
  'resultLength',
  'retryScheduled',
  'sourceLength',
  'targetLanguage',
  'transcriptionMode',
  'usesDefaultModel',
  'wasSanitized',
] as const;

export type ProviderAuditFamily = (typeof PROVIDER_AUDIT_FAMILIES)[number];
export type ProviderAuditEvent = (typeof PROVIDER_AUDIT_EVENTS)[number];
export type ProviderAuditPhase = (typeof PROVIDER_AUDIT_PHASES)[number];
export type ProviderAuditOutcome = (typeof PROVIDER_AUDIT_OUTCOMES)[number];
export type ProviderAuditTerminalOutcome = (typeof PROVIDER_AUDIT_TERMINAL_OUTCOMES)[number];
export type ProviderAuditSeverity = (typeof PROVIDER_AUDIT_SEVERITIES)[number];
export type ProviderAuditErrorClass = (typeof PROVIDER_AUDIT_ERROR_CLASSES)[number];
export type ProviderAuditExceptionType = (typeof PROVIDER_AUDIT_EXCEPTION_TYPES)[number];
export type ProviderAuditContractVersion = (typeof PROVIDER_AUDIT_CONTRACT_VERSIONS)[number];
export type ProviderAuditModelSource = (typeof PROVIDER_AUDIT_MODEL_SOURCES)[number];
export type ProviderAuditTranscriptionMode = (typeof PROVIDER_AUDIT_TRANSCRIPTION_MODES)[number];
export type ProviderAuditMetadataKey = (typeof PROVIDER_AUDIT_METADATA_KEYS)[number];
export type ProviderAuditTargetLanguage =
  | (typeof BING_TRANSLATION_LANGUAGES)[number]['code']
  | (typeof GOOGLE_TRANSLATION_LANGUAGES)[number]['code']
  | (typeof YANDEX_TRANSLATION_LANGUAGES)[number]['code'];

export interface ProviderAuditMetadata {
  readonly acceptedByteCount?: number;
  readonly attemptCount?: number;
  readonly causeCode?: ProviderAuditCauseCode;
  readonly chunkCount?: number;
  readonly contractVersion?: ProviderAuditContractVersion;
  readonly discarded?: boolean;
  readonly durationMs?: number;
  readonly errorClass?: ProviderAuditErrorClass;
  readonly exceptionType?: ProviderAuditExceptionType;
  readonly frameCount?: number;
  readonly hasFilePath?: boolean;
  readonly hasMessage?: boolean;
  readonly hasMimeType?: boolean;
  readonly hasStackTrace?: boolean;
  readonly hasUrl?: boolean;
  readonly httpStatus?: number;
  readonly inputByteLength?: number;
  readonly modelConfigured?: boolean;
  readonly modelNameLength?: number;
  readonly modelSource?: ProviderAuditModelSource;
  readonly pageClosed?: boolean;
  readonly postSubmission?: boolean;
  readonly providerKnown?: boolean;
  readonly recoveryScheduled?: boolean;
  readonly resultLength?: number;
  readonly retryScheduled?: boolean;
  readonly sourceLength?: number;
  readonly targetLanguage?: ProviderAuditTargetLanguage;
  readonly transcriptionMode?: ProviderAuditTranscriptionMode;
  readonly usesDefaultModel?: boolean;
  readonly wasSanitized?: boolean;
}

export interface ProviderAuditRecord extends ProviderAuditMetadata {
  readonly schemaVersion: typeof PROVIDER_AUDIT_SCHEMA_VERSION;
  readonly occurredAt: string;
  readonly family: ProviderAuditFamily;
  readonly providerId?: ProviderAuditProviderId;
  readonly operation: ProviderAuditOperation;
  readonly operationId: string;
  readonly sequence: number;
  readonly event: ProviderAuditEvent;
  readonly phase: ProviderAuditPhase;
  readonly outcome: ProviderAuditOutcome;
}

const PROVIDER_AUDIT_METADATA_KEY_SET = new Set<string>(PROVIDER_AUDIT_METADATA_KEYS);
const PROVIDER_AUDIT_NUMERIC_METADATA_KEY_SET = new Set<ProviderAuditMetadataKey>([
  'acceptedByteCount',
  'attemptCount',
  'chunkCount',
  'durationMs',
  'frameCount',
  'httpStatus',
  'inputByteLength',
  'modelNameLength',
  'resultLength',
  'sourceLength',
]);
const PROVIDER_AUDIT_BOOLEAN_METADATA_KEY_SET = new Set<ProviderAuditMetadataKey>([
  'discarded',
  'hasFilePath',
  'hasMessage',
  'hasMimeType',
  'hasStackTrace',
  'hasUrl',
  'modelConfigured',
  'pageClosed',
  'postSubmission',
  'providerKnown',
  'recoveryScheduled',
  'retryScheduled',
  'usesDefaultModel',
  'wasSanitized',
]);
const PROVIDER_AUDIT_TARGET_LANGUAGE_SET = new Set<string>([
  ...BING_TRANSLATION_LANGUAGES.map((language) => language.code),
  ...GOOGLE_TRANSLATION_LANGUAGES.map((language) => language.code),
  ...YANDEX_TRANSLATION_LANGUAGES.map((language) => language.code),
]);

function isOneOf<const Value extends string>(values: readonly Value[], value: unknown): value is Value {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Error) {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNonnegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isProviderAuditFamily(value: unknown): value is ProviderAuditFamily {
  return isOneOf(PROVIDER_AUDIT_FAMILIES, value);
}

export function isProviderAuditEvent(value: unknown): value is ProviderAuditEvent {
  return isOneOf(PROVIDER_AUDIT_EVENTS, value);
}

export function isProviderAuditPhase(value: unknown): value is ProviderAuditPhase {
  return isOneOf(PROVIDER_AUDIT_PHASES, value);
}

export function isProviderAuditOutcome(value: unknown): value is ProviderAuditOutcome {
  return isOneOf(PROVIDER_AUDIT_OUTCOMES, value);
}

export function isProviderAuditTerminalOutcome(value: unknown): value is ProviderAuditTerminalOutcome {
  return isOneOf(PROVIDER_AUDIT_TERMINAL_OUTCOMES, value);
}

export function isProviderAuditSeverity(value: unknown): value is ProviderAuditSeverity {
  return isOneOf(PROVIDER_AUDIT_SEVERITIES, value);
}

export function isProviderAuditErrorClass(value: unknown): value is ProviderAuditErrorClass {
  return isOneOf(PROVIDER_AUDIT_ERROR_CLASSES, value);
}

export function isProviderAuditExceptionType(value: unknown): value is ProviderAuditExceptionType {
  return isOneOf(PROVIDER_AUDIT_EXCEPTION_TYPES, value);
}

export function normalizeProviderAuditExceptionType(error: unknown): ProviderAuditExceptionType {
  try {
    if (error instanceof TypeError) return 'TypeError';
    if (error instanceof SyntaxError) return 'SyntaxError';
    if (error instanceof RangeError) return 'RangeError';
    if (
      typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      return error.name;
    }
    if (error instanceof Error && Object.getPrototypeOf(error) === Error.prototype && error.name === 'Error') {
      return 'Error';
    }
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

function isProviderAuditMetadataValue(
  key: ProviderAuditMetadataKey,
  candidate: unknown,
  isCauseCode: (value: unknown) => boolean,
): boolean {
  if (PROVIDER_AUDIT_NUMERIC_METADATA_KEY_SET.has(key)) {
    return isFiniteNonnegativeNumber(candidate);
  }
  if (PROVIDER_AUDIT_BOOLEAN_METADATA_KEY_SET.has(key)) {
    return typeof candidate === 'boolean';
  }

  switch (key) {
    case 'causeCode':
      return isCauseCode(candidate);
    case 'contractVersion':
      return isOneOf(PROVIDER_AUDIT_CONTRACT_VERSIONS, candidate);
    case 'errorClass':
      return isProviderAuditErrorClass(candidate);
    case 'exceptionType':
      return isProviderAuditExceptionType(candidate);
    case 'modelSource':
      return isOneOf(PROVIDER_AUDIT_MODEL_SOURCES, candidate);
    case 'targetLanguage':
      return typeof candidate === 'string' && PROVIDER_AUDIT_TARGET_LANGUAGE_SET.has(candidate);
    case 'transcriptionMode':
      return isOneOf(PROVIDER_AUDIT_TRANSCRIPTION_MODES, candidate);
    default:
      return false;
  }
}

export function validateProviderAuditMetadata(
  value: unknown,
  isCauseCode: (candidate: unknown) => boolean,
): ProviderAuditMetadata | null {
  if (value === undefined) return {};
  if (!isPlainRecord(value)) return null;

  const validated: Partial<Record<ProviderAuditMetadataKey, unknown>> = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (!PROVIDER_AUDIT_METADATA_KEY_SET.has(key)) return null;

    const metadataKey = key as ProviderAuditMetadataKey;
    if (!isProviderAuditMetadataValue(metadataKey, candidate, isCauseCode)) return null;
    validated[metadataKey] = candidate;
  }

  return validated as ProviderAuditMetadata;
}
