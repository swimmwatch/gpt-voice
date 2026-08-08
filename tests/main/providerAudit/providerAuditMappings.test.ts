import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ClaudeWebVoiceProvider } from '@main/providers';
import { ClaudeWebVoiceProviderErrorCode } from '@main/providers/ClaudeWebVoiceProvider';
import { ClaudeCliPrettifyErrorCode } from '@main/services/prettifyClaudeCli';
import { CodexCliPrettifyErrorCode } from '@main/services/prettifyCodexCli';
import {
  PROVIDER_AUDIT_CAUSE_CODE_MAPPINGS,
  PROVIDER_AUDIT_OPERATION_IDS,
  PROVIDER_AUDIT_PROVIDER_MAPPINGS,
  isProviderAuditCauseCode,
  isProviderAuditOperation,
  isProviderAuditProviderId,
  type ProviderAuditCauseCodeByFamily,
  type ProviderAuditProviderIdByFamily,
} from '@main/providerAudit/mappings';
import { KNOWN_PRETTIFY_PROVIDER_IDS } from '@shared/prettifySettings';
import { TRANSLATION_PROVIDER_IDS } from '@shared/translationProvider';
import { VoiceProviderRegistryFixture } from '../providers/voiceProviderRegistryFixture';

const DIAGNOSTIC_CAUSE_CODES = [
  'diagnostic-storage-unavailable',
  'diagnostic-row-too-large',
  'diagnostic-redaction-failed',
  'diagnostic-storage-failed',
] as const;

const providerMappingTypeCheck: {
  readonly [Family in keyof ProviderAuditProviderIdByFamily]: Readonly<
    Record<ProviderAuditProviderIdByFamily[Family], true>
  >;
} = PROVIDER_AUDIT_PROVIDER_MAPPINGS;

const causeMappingTypeCheck: {
  readonly [Family in keyof ProviderAuditCauseCodeByFamily]: Readonly<
    Record<ProviderAuditCauseCodeByFamily[Family], true>
  >;
} = PROVIDER_AUDIT_CAUSE_CODE_MAPPINGS;

void providerMappingTypeCheck;
void causeMappingTypeCheck;
void ClaudeWebVoiceProvider;

describe('provider audit mappings', () => {
  it('exhaustively matches the current provider registries', () => {
    assert.deepEqual(
      Object.keys(PROVIDER_AUDIT_PROVIDER_MAPPINGS.voice),
      new VoiceProviderRegistryFixture().registry.getAvailableProviders().map((provider) => provider.id),
    );
    assert.deepEqual(Object.keys(PROVIDER_AUDIT_PROVIDER_MAPPINGS.prettify), [...KNOWN_PRETTIFY_PROVIDER_IDS]);
    assert.deepEqual(Object.keys(PROVIDER_AUDIT_PROVIDER_MAPPINGS.translation), [...TRANSLATION_PROVIDER_IDS]);

    assert.equal(isProviderAuditProviderId('voice', 'chatgpt'), true);
    assert.equal(isProviderAuditProviderId('prettify', 'codex-cli'), true);
    assert.equal(isProviderAuditProviderId('translation', 'yandex'), true);
    assert.equal(isProviderAuditProviderId('voice', 'missing-provider'), false);
    assert.equal(isProviderAuditProviderId('voice', '__proto__'), false);
  });

  it('defines the exact approved family operation IDs', () => {
    assert.deepEqual(PROVIDER_AUDIT_OPERATION_IDS, {
      voice: [
        'initialize',
        'settings-readiness',
        'session-load',
        'session-save',
        'session-clear',
        'readiness',
        'credential-refresh',
        'local-runtime-check',
        'local-artifact-transfer',
        'local-artifact-remove',
        'local-model-load',
        'local-model-unload',
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
    });

    assert.equal(isProviderAuditOperation('voice', 'transcribe-stream'), true);
    assert.equal(isProviderAuditOperation('prettify', 'translate'), false);
    assert.equal(isProviderAuditOperation('translation', 'shutdown'), true);
    assert.equal(isProviderAuditOperation('translation', 'private-operation'), false);
  });

  it('preserves every approved closed family cause code', () => {
    const voiceCauseCodes = new Set(Object.keys(PROVIDER_AUDIT_CAUSE_CODE_MAPPINGS.voice));
    const prettifyCauseCodes = new Set(Object.keys(PROVIDER_AUDIT_CAUSE_CODE_MAPPINGS.prettify));
    const translationCauseCodes = new Set(Object.keys(PROVIDER_AUDIT_CAUSE_CODE_MAPPINGS.translation));

    assert.deepEqual(
      [...voiceCauseCodes],
      [
        'session-missing',
        'session-expired',
        'session-invalid',
        'feature-unavailable',
        'organization-missing',
        'organization-ambiguous',
        'invalid-settings',
        'invalid-audio',
        'invalid-chunk',
        'invalid-operation',
        'invalid-sequence',
        'operation-conflict',
        'provider-changed',
        'transport-failure',
        'upgrade-or-auth',
        'connect-timeout',
        'connection-loss',
        'malformed-event',
        'rate-limit',
        'first-event-timeout',
        'overall-timeout',
        'drain-timeout',
        'empty-result',
        'cancelled',
        'page-shutdown',
        'unexpected-failure',
        'not-configured',
        'not-authenticated',
        'rate-limited',
        'connection-failed',
        'timed-out',
        'request-failed',
        'unexpected-response',
        'provider-contract-changed',
        'cleanup-failed',
        'unknown',
        ...DIAGNOSTIC_CAUSE_CODES,
      ],
    );
    for (const causeCode of Object.values(ClaudeWebVoiceProviderErrorCode)) {
      assert.equal(voiceCauseCodes.has(causeCode), true);
    }
    for (const causeCode of [
      ...Object.values(ClaudeCliPrettifyErrorCode),
      ...Object.values(CodexCliPrettifyErrorCode),
    ]) {
      assert.equal(prettifyCauseCodes.has(causeCode), true);
    }
    assert.deepEqual(
      [...translationCauseCodes].filter((causeCode) => !DIAGNOSTIC_CAUSE_CODES.includes(causeCode as never)),
      [
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
      ],
    );
    for (const causeCode of DIAGNOSTIC_CAUSE_CODES) {
      assert.equal(voiceCauseCodes.has(causeCode), true);
      assert.equal(prettifyCauseCodes.has(causeCode), true);
      assert.equal(translationCauseCodes.has(causeCode), true);
    }

    assert.equal(isProviderAuditCauseCode('voice', 'session-missing'), true);
    assert.equal(isProviderAuditCauseCode('prettify', 'schema-unavailable'), true);
    assert.equal(isProviderAuditCauseCode('translation', 'unsupportedProvider'), true);
    assert.equal(isProviderAuditCauseCode('voice', 'unsupportedProvider'), false);
    assert.equal(isProviderAuditCauseCode('translation', 'session-missing'), false);
    assert.equal(isProviderAuditCauseCode('translation', 'private-cause'), false);
  });
});
