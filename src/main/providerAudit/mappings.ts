import type { ClaudeWebVoiceProviderErrorCode } from '@main/providers/ClaudeWebVoiceProvider';
import type { KnownPrettifyProviderId, PrettifyCliRuntimeErrorCode } from '@shared/prettifySettings';
import type { StreamingTranscriptionErrorCode } from '@shared/streamingTranscription';
import type { TranslationProviderId } from '@shared/translationProvider';

import type { ProviderAuditFamily } from './contracts';

export type VoiceProviderAuditId = 'chatgpt' | 'openai-api' | 'claude-web' | 'local-whisper';

export interface ProviderAuditProviderIdByFamily {
  readonly voice: VoiceProviderAuditId;
  readonly prettify: KnownPrettifyProviderId;
  readonly translation: TranslationProviderId;
}

export const PROVIDER_AUDIT_PROVIDER_MAPPINGS = {
  voice: {
    chatgpt: true,
    'openai-api': true,
    'claude-web': true,
    'local-whisper': true,
  },
  prettify: {
    ollama: true,
    vllm: true,
    'claude-cli': true,
    'codex-cli': true,
  },
  translation: {
    google: true,
    bing: true,
    yandex: true,
  },
} as const satisfies {
  readonly [Family in ProviderAuditFamily]: Readonly<Record<ProviderAuditProviderIdByFamily[Family], true>>;
};

export const PROVIDER_AUDIT_OPERATION_IDS = {
  voice: [
    'initialize',
    'settings-readiness',
    'session-load',
    'session-save',
    'session-clear',
    'readiness',
    'credential-refresh',
    'transcribe-batch',
    'transcribe-stream',
    'recovery',
    'shutdown',
  ],
  prettify: [
    'settings-readiness',
    'availability',
    'capability-check',
    'model-list',
    'model-load',
    'model-unload',
    'prepare',
    'prettify',
    'process-cleanup',
    'shutdown',
  ],
  translation: ['settings-readiness', 'translate', 'shutdown'],
} as const satisfies Readonly<Record<ProviderAuditFamily, readonly string[]>>;

type ClaudeWebVoiceCauseCode = `${ClaudeWebVoiceProviderErrorCode}`;
type VoiceStreamingCauseCode = `${StreamingTranscriptionErrorCode}`;
type VoiceBatchCauseCode =
  | 'not-configured'
  | 'not-authenticated'
  | 'rate-limited'
  | 'connection-failed'
  | 'timed-out'
  | 'request-failed'
  | 'unexpected-response'
  | 'empty-result'
  | 'cancelled'
  | 'provider-contract-changed'
  | 'cleanup-failed'
  | 'unknown';
type VoiceProviderAuditCauseCode = ClaudeWebVoiceCauseCode | VoiceStreamingCauseCode | VoiceBatchCauseCode;

type PrettifyProviderAuditCauseCode =
  | PrettifyCliRuntimeErrorCode
  | 'not-configured'
  | 'connection-failed'
  | 'request-failed'
  | 'unexpected-response'
  | 'empty-result'
  | 'model-lifecycle-failed'
  | 'unknown';

type TranslationProviderAuditCauseCode =
  | 'unsupportedProvider'
  | 'unsupportedTargetLanguage'
  | 'emptyInput'
  | 'inputTooLong'
  | 'navigationFailure'
  | 'consentOrChallenge'
  | 'pageContractFailure'
  | 'resultTimeoutOrEmpty'
  | 'timed-out'
  | 'cancelledOrStaleOperation'
  | 'cleanupFailure';

export type DiagnosticProviderAuditCauseCode =
  | 'diagnostic-storage-unavailable'
  | 'diagnostic-row-too-large'
  | 'diagnostic-redaction-failed'
  | 'diagnostic-storage-failed';

export interface ProviderAuditCauseCodeByFamily {
  readonly voice: VoiceProviderAuditCauseCode | DiagnosticProviderAuditCauseCode;
  readonly prettify: PrettifyProviderAuditCauseCode | DiagnosticProviderAuditCauseCode;
  readonly translation: TranslationProviderAuditCauseCode | DiagnosticProviderAuditCauseCode;
}

const DIAGNOSTIC_CAUSE_CODE_MAPPING = {
  'diagnostic-storage-unavailable': true,
  'diagnostic-row-too-large': true,
  'diagnostic-redaction-failed': true,
  'diagnostic-storage-failed': true,
} as const satisfies Readonly<Record<DiagnosticProviderAuditCauseCode, true>>;

export const PROVIDER_AUDIT_CAUSE_CODE_MAPPINGS = {
  voice: {
    'session-missing': true,
    'session-expired': true,
    'session-invalid': true,
    'feature-unavailable': true,
    'organization-missing': true,
    'organization-ambiguous': true,
    'invalid-settings': true,
    'invalid-audio': true,
    'invalid-chunk': true,
    'invalid-operation': true,
    'invalid-sequence': true,
    'operation-conflict': true,
    'provider-changed': true,
    'transport-failure': true,
    'upgrade-or-auth': true,
    'connect-timeout': true,
    'connection-loss': true,
    'malformed-event': true,
    'rate-limit': true,
    'first-event-timeout': true,
    'overall-timeout': true,
    'drain-timeout': true,
    'empty-result': true,
    cancelled: true,
    'page-shutdown': true,
    'unexpected-failure': true,
    'not-configured': true,
    'not-authenticated': true,
    'rate-limited': true,
    'connection-failed': true,
    'timed-out': true,
    'request-failed': true,
    'unexpected-response': true,
    'provider-contract-changed': true,
    'cleanup-failed': true,
    unknown: true,
    ...DIAGNOSTIC_CAUSE_CODE_MAPPING,
  },
  prettify: {
    'not-installed': true,
    'not-executable': true,
    'not-authenticated': true,
    unsupported: true,
    cancelled: true,
    'timed-out': true,
    'output-limit': true,
    'nonzero-exit': true,
    'process-failed': true,
    'empty-output': true,
    'malformed-output': true,
    'invalid-model': true,
    'schema-unavailable': true,
    'no-tools-unavailable': true,
    'model-discovery-failed': true,
    'not-configured': true,
    'connection-failed': true,
    'request-failed': true,
    'unexpected-response': true,
    'empty-result': true,
    'model-lifecycle-failed': true,
    unknown: true,
    ...DIAGNOSTIC_CAUSE_CODE_MAPPING,
  },
  translation: {
    unsupportedProvider: true,
    unsupportedTargetLanguage: true,
    emptyInput: true,
    inputTooLong: true,
    navigationFailure: true,
    consentOrChallenge: true,
    pageContractFailure: true,
    resultTimeoutOrEmpty: true,
    'timed-out': true,
    cancelledOrStaleOperation: true,
    cleanupFailure: true,
    ...DIAGNOSTIC_CAUSE_CODE_MAPPING,
  },
} as const satisfies {
  readonly [Family in ProviderAuditFamily]: Readonly<Record<ProviderAuditCauseCodeByFamily[Family], true>>;
};

export type ProviderAuditProviderId<Family extends ProviderAuditFamily = ProviderAuditFamily> =
  ProviderAuditProviderIdByFamily[Family];
export type ProviderAuditOperation<Family extends ProviderAuditFamily = ProviderAuditFamily> =
  (typeof PROVIDER_AUDIT_OPERATION_IDS)[Family][number];
export type ProviderAuditCauseCode<Family extends ProviderAuditFamily = ProviderAuditFamily> =
  ProviderAuditCauseCodeByFamily[Family];

function hasOwnMapping(mapping: object, value: unknown): value is string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(mapping, value);
}

export function isProviderAuditProviderId<Family extends ProviderAuditFamily>(
  family: Family,
  value: unknown,
): value is ProviderAuditProviderId<Family> {
  return hasOwnMapping(PROVIDER_AUDIT_PROVIDER_MAPPINGS[family], value);
}

export function isProviderAuditOperation<Family extends ProviderAuditFamily>(
  family: Family,
  value: unknown,
): value is ProviderAuditOperation<Family> {
  return typeof value === 'string' && (PROVIDER_AUDIT_OPERATION_IDS[family] as readonly string[]).includes(value);
}

export function isProviderAuditCauseCode<Family extends ProviderAuditFamily>(
  family: Family,
  value: unknown,
): value is ProviderAuditCauseCode<Family> {
  return hasOwnMapping(PROVIDER_AUDIT_CAUSE_CODE_MAPPINGS[family], value);
}
