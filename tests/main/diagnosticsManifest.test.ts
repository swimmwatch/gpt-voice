import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import type { DiagnosticCaptureRow } from '@main/repositories/diagnosticCaptureRepository';
import { DIAGNOSTIC_REDACTOR_VERSION } from '@main/services/diagnosticTextRedactor';
import {
  DiagnosticsEnvironmentSnapshotProvider,
  DiagnosticsManifestBuilder,
  createDiagnosticArchiveRow,
  getEnabledDiagnosticCaptureCategories,
} from '@main/services/diagnosticsManifest';
import { TestAppConfigStore } from './appConfigTestUtils';
import {
  DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  DIAGNOSTICS_ARCHIVE_SENSITIVITY_WARNING,
  isDiagnosticArchiveTextActionRow,
  isDiagnosticsArchiveManifest,
  serializeCanonicalDiagnosticsJson,
  type DiagnosticsArchiveEnvironmentSnapshot,
} from '@shared/diagnosticsArchive';
import type { DiagnosticCaptureSettings } from '@shared/diagnosticCaptureSettings';

const ARCHIVE_ID = '00000000-0000-4000-8000-000000000020';
const PROVIDER_OPERATION_ID = '00000000-0000-4000-8000-000000000019';
const ACTION_ID = '00000000-0000-4000-8000-000000000018';
const RECORDED_AT = '2026-07-27T12:00:00.000Z';
const TRANSLATION_CONTRACT_VERSION = '2026-07-25';

function hash(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

function createTranslationRow(overrides: Partial<DiagnosticCaptureRow> = {}): DiagnosticCaptureRow {
  const sourceText = 'source [REDACTED]';
  const resultText = 'result';
  const sourceBytes = Buffer.byteLength(sourceText, 'utf8');
  const resultBytes = Buffer.byteLength(resultText, 'utf8');
  return {
    actionId: ACTION_ID,
    actionType: 'translation',
    contractVersion: TRANSLATION_CONTRACT_VERSION,
    providerId: 'google',
    providerOperationId: PROVIDER_OPERATION_ID,
    recordedAt: RECORDED_AT,
    redactionCount: 1,
    redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
    resultBytes,
    resultText,
    retainedBytes: sourceBytes + resultBytes,
    sourceBytes,
    sourceKind: 'provider',
    sourceText,
    targetLanguage: 'en',
    ...overrides,
  };
}

function createEnvironment(): DiagnosticsArchiveEnvironmentSnapshot {
  return {
    appVersion: '1.4.0',
    architecture: 'x64',
    cloakBrowserVersion: '0.4.12',
    electronVersion: '43.1.1',
    nodeVersion: '24.0.0',
    platformFamily: 'linux',
    playwrightVersion: '1.61.1',
    providers: {
      voice: {
        capabilityAvailable: true,
        configured: true,
        readinessKnown: true,
        ready: false,
        registeredProviderIds: ['chatgpt', 'openai-api', 'claude-web'],
        selectedProviderId: 'chatgpt',
      },
      prettify: {
        capabilityAvailable: true,
        configured: true,
        readinessKnown: false,
        ready: false,
        registeredProviderIds: ['ollama', 'vllm', 'claude-cli', 'codex-cli'],
        selectedProviderId: 'ollama',
      },
      translation: {
        capabilityAvailable: true,
        configured: true,
        readinessKnown: false,
        ready: false,
        registeredProviderIds: ['google', 'bing', 'yandex'],
        selectedProviderId: 'google',
      },
    },
  };
}

function createBuilder(): DiagnosticsManifestBuilder {
  return new DiagnosticsManifestBuilder({
    databaseSchemaVersion: 2,
    diagnosticRowSchemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
    hash,
    providerAuditSchemaVersion: 1,
    redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
  });
}

describe('diagnostics manifest', () => {
  it('builds and serializes the strict allowlisted schema with exact payload hashes', () => {
    const row = createDiagnosticArchiveRow(createTranslationRow());
    assert.ok(row);
    const auditPayload = Buffer.from('audit\n', 'utf8');
    const diagnosticPayload = Buffer.from('diagnostic\n', 'utf8');
    const captureSettings: DiagnosticCaptureSettings = {
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: true,
    };
    const builder = createBuilder();
    const manifest = builder.build({
      archiveId: ARCHIVE_ID,
      audit: {
        duplicateRecordCount: 1,
        invalidRecordCount: 2,
        validRecordCount: 3,
      },
      captureSettings,
      createdAt: RECORDED_AT,
      diagnosticRows: [row],
      environment: createEnvironment(),
      payloads: new Map([
        [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents, auditPayload],
        [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions, diagnosticPayload],
      ]),
    });

    assert.equal(isDiagnosticsArchiveManifest(manifest), true);
    assert.deepEqual(manifest.diagnostics, {
      includedCategories: ['translation'],
      recordCount: 1,
      recordedAtRange: { from: RECORDED_AT, to: RECORDED_AT },
      retainedBytes: row.retainedBytes,
    });
    assert.deepEqual(manifest.members, [
      {
        byteLength: auditPayload.byteLength,
        name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents,
        sha256: hash(auditPayload),
      },
      {
        byteLength: diagnosticPayload.byteLength,
        name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions,
        sha256: hash(diagnosticPayload),
      },
    ]);
    assert.deepEqual(manifest.sensitivity, {
      containsDiagnosticText: true,
      warning: DIAGNOSTICS_ARCHIVE_SENSITIVITY_WARNING,
    });

    const serialized = builder.serialize(manifest).toString('utf8');
    assert.equal(serialized.includes('\n'), false);
    assert.equal(serialized, serializeCanonicalDiagnosticsJson(manifest));
    const withUnknownField = { ...manifest, homeDirectory: '/private/canary' };
    assert.equal(isDiagnosticsArchiveManifest(withUnknownField), false);
    assert.equal(serialized.includes('homeDirectory'), false);
  });

  it('validates stored byte counts, current redactor, correlation, contracts, and languages before export', () => {
    const validProviderRow = createDiagnosticArchiveRow(createTranslationRow());
    const validCacheRow = createDiagnosticArchiveRow(
      createTranslationRow({
        actionId: '00000000-0000-4000-8000-000000000021',
        providerOperationId: null,
        sourceKind: 'cache',
      }),
    );
    assert.ok(validProviderRow);
    assert.ok(validCacheRow);

    const invalidRows: DiagnosticCaptureRow[] = [
      createTranslationRow({ sourceBytes: 1 }),
      createTranslationRow({ resultBytes: 1 }),
      createTranslationRow({ retainedBytes: 1 }),
      createTranslationRow({ redactorVersion: DIAGNOSTIC_REDACTOR_VERSION + 1 }),
      createTranslationRow({ providerOperationId: null }),
      createTranslationRow({ sourceKind: 'cache' }),
      createTranslationRow({ contractVersion: 'stale-contract' }),
      createTranslationRow({ targetLanguage: null }),
      createTranslationRow({ targetLanguage: 'not-supported' }),
    ];
    for (const row of invalidRows) assert.equal(createDiagnosticArchiveRow(row), null);

    const oversizedSource = 'x'.repeat(1_048_577);
    assert.equal(
      createDiagnosticArchiveRow(
        createTranslationRow({
          resultBytes: 0,
          resultText: '',
          retainedBytes: Buffer.byteLength(oversizedSource, 'utf8'),
          sourceBytes: Buffer.byteLength(oversizedSource, 'utf8'),
          sourceText: oversizedSource,
        }),
      ),
      null,
    );
  });

  it('rejects unknown row fields and preserves canonical category selection', () => {
    const row = createDiagnosticArchiveRow(createTranslationRow());
    assert.ok(row);
    assert.equal(isDiagnosticArchiveTextActionRow({ ...row, endpoint: 'https://private.invalid' }), false);
    assert.deepEqual(
      getEnabledDiagnosticCaptureCategories({
        capturePrettifyDiagnostics: true,
        captureTranslationDiagnostics: true,
      }),
      ['translation', 'prettify'],
    );
  });

  it('creates a safe environment snapshot without provider probing or raw settings', () => {
    const config = new TestAppConfigStore();
    const snapshot = new DiagnosticsEnvironmentSnapshotProvider({
      architecture: 'x64',
      backgroundBrowser: {
        getStatus: () => ({ providerId: 'openai-api', ready: true }),
      },
      config,
      getAppVersion: () => '1.4.0',
      platform: 'linux',
      runtimeVersions: {
        cloakBrowser: '0.4.12',
        electron: '43.1.1',
        node: '24.0.0',
        playwright: '1.61.1',
      },
    }).getSnapshot();

    assert.equal(snapshot.providers.voice.selectedProviderId, 'chatgpt');
    assert.equal(snapshot.providers.voice.ready, false);
    const serialized = serializeCanonicalDiagnosticsJson(snapshot);
    assert.ok(serialized);
    for (const prohibited of ['homeDirectory', 'locale', 'timezone', 'endpoint', 'model', 'credential']) {
      assert.equal(serialized.includes(prohibited), false);
    }
  });
});
