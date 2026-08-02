/* eslint-disable max-classes-per-file -- Integration fixtures own isolated audit, storage, and archive state. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  PROVIDER_AUDIT_LABEL,
  PROVIDER_AUDIT_SCHEMA_VERSION,
  type ProviderAuditDependencies,
  type ProviderAuditSink,
} from '@main/providerAudit';
import type {
  DiagnosticActionType,
  DiagnosticCapturePrunePolicy,
  DiagnosticCaptureRecord,
  DiagnosticCaptureRepository,
  DiagnosticCaptureRow,
} from '@main/repositories/diagnosticCaptureRepository';
import {
  ArchiverDiagnosticsArchiveWriterFactory,
  DiagnosticsArchiveFormatAdapter,
  inspectDiagnosticsArchiveForVerification,
} from '@main/services/diagnosticsArchiveFormat';
import {
  DiagnosticsArchiveJsonlSerializer,
  DiagnosticsArchiveService,
  ProviderAuditLogExtractor,
} from '@main/services/diagnosticsArchive';
import { DiagnosticCaptureService } from '@main/services/diagnosticCapture';
import { DiagnosticCaptureStorage } from '@main/services/diagnosticCaptureStorage';
import { DiagnosticTextRedactor, DIAGNOSTIC_REDACTOR_VERSION } from '@main/services/diagnosticTextRedactor';
import { DiagnosticsManifestBuilder } from '@main/services/diagnosticsManifest';
import { PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import { TranslationProviderAudit } from '@main/translateProviders/translationProviderAudit';
import { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';
import {
  DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  type DiagnosticsArchiveEnvironmentSnapshot,
} from '@shared/diagnosticsArchive';
import type { DiagnosticCaptureSettings } from '@shared/diagnosticCaptureSettings';
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';

const OCCURRED_AT = '2026-07-27T12:00:00.000Z';
const ARCHIVE_ID = '20000000-0000-4000-8000-000000000001';
const VOICE_OPERATION_ID = '00000000-0000-4000-8000-000000000041';
const PRETTIFY_OPERATION_ID = '00000000-0000-4000-8000-000000000042';
const TRANSLATION_OPERATION_ID = '00000000-0000-4000-8000-000000000043';
const FALLBACK_OPERATION_ID = '00000000-0000-4000-8000-000000000044';
const ALLOWED_DIAGNOSTIC_MARKERS = Object.freeze({
  prettifyResult: 'enabled-prettify-result-canary',
  prettifySource: 'enabled-prettify-source-canary',
  translationResult: 'enabled-translation-result-canary',
  translationSource: 'enabled-translation-source-canary',
});
const PROHIBITED_MARKERS = Object.freeze({
  account: 'private-account-canary',
  argv: 'private-argv-canary',
  audioAdjacent: 'private-audio-adjacent-canary',
  cacheKey: 'private-cache-key-canary',
  credential: 'sk-proj-private-credential-canary-1234567890',
  environment: 'private-environment-canary',
  exception: 'private-exception-canary',
  httpBody: 'private-http-body-canary',
  model: 'private-model-canary',
  path: 'private-path-canary',
  prompt: 'private-prompt-canary',
  session: 'private-session-canary',
  stderr: 'private-stderr-canary',
  stdin: 'private-stdin-canary',
  stdout: 'private-stdout-canary',
  unrelatedLog: 'private-unrelated-log-canary',
  url: 'https://private.invalid/account?token=private-url-canary',
  voiceTranscript: 'private-voice-transcript-canary',
});
const TEMPORARY_DIRECTORIES: string[] = [];
const ENVIRONMENT = Object.freeze({
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
      ready: true,
      registeredProviderIds: ['chatgpt', 'openai-api', 'claude-web', 'local-whisper'] as const,
      selectedProviderId: 'chatgpt',
    },
    prettify: {
      capabilityAvailable: true,
      configured: true,
      readinessKnown: false,
      ready: false,
      registeredProviderIds: ['ollama', 'vllm', 'claude-cli', 'codex-cli'] as const,
      selectedProviderId: 'ollama',
    },
    translation: {
      capabilityAvailable: true,
      configured: true,
      readinessKnown: false,
      ready: false,
      registeredProviderIds: ['google', 'bing', 'yandex'] as const,
      selectedProviderId: 'google',
    },
  },
} as const satisfies DiagnosticsArchiveEnvironmentSnapshot);

interface CapturedAuditCall {
  readonly arguments: readonly unknown[];
  readonly level: 'error' | 'info' | 'warn';
}

class ProviderAuditCapture implements ProviderAuditSink {
  public readonly calls: CapturedAuditCall[] = [];
  private elapsed = 0;

  public readonly dependencies: ProviderAuditDependencies = {
    elapsedNow: () => {
      this.elapsed += 1;
      return this.elapsed;
    },
    getSink: () => this,
    now: () => new Date(OCCURRED_AT),
    randomUUID: () => FALLBACK_OPERATION_ID,
  };

  public error(...arguments_: unknown[]): void {
    this.calls.push({ arguments: arguments_, level: 'error' });
  }

  public info(...arguments_: unknown[]): void {
    this.calls.push({ arguments: arguments_, level: 'info' });
  }

  public warn(...arguments_: unknown[]): void {
    this.calls.push({ arguments: arguments_, level: 'warn' });
  }
}

class MutableDiagnosticCaptureSettings {
  public constructor(
    private settings: DiagnosticCaptureSettings = {
      capturePrettifyDiagnostics: true,
      captureTranslationDiagnostics: true,
    },
  ) {}

  public getSettings(): DiagnosticCaptureSettings {
    return Object.freeze({ ...this.settings });
  }

  public setSettings(settings: DiagnosticCaptureSettings): void {
    this.settings = Object.freeze({ ...settings });
  }
}

class MemoryDiagnosticCaptureRepository implements DiagnosticCaptureRepository {
  private rows: DiagnosticCaptureRecord[] = [];

  public get records(): readonly DiagnosticCaptureRecord[] {
    return this.rows;
  }

  public insert(capture: DiagnosticCaptureRecord, _policy: DiagnosticCapturePrunePolicy): void {
    this.rows.push(Object.freeze({ ...capture }));
  }

  public prune(_policy: DiagnosticCapturePrunePolicy): number {
    return 0;
  }

  public pruneAndPurge(policy: DiagnosticCapturePrunePolicy, categories: readonly DiagnosticActionType[]): number {
    const pruned = this.prune(policy);
    return pruned + this.purge(categories);
  }

  public purge(categories: readonly DiagnosticActionType[]): number {
    const previousLength = this.rows.length;
    this.rows = this.rows.filter((row) => !categories.includes(row.actionType));
    return previousLength - this.rows.length;
  }

  public readForArchive(categories: readonly DiagnosticActionType[]): readonly DiagnosticCaptureRow[] {
    return this.rows.filter((row) => categories.includes(row.actionType));
  }
}

class DiagnosticsPrivacyHarness {
  public readonly auditCapture = new ProviderAuditCapture();
  public readonly captureSettings = new MutableDiagnosticCaptureSettings();
  public readonly directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-diagnostics-privacy-'));
  public readonly repository = new MemoryDiagnosticCaptureRepository();
  public readonly storage = new DiagnosticCaptureStorage(this.repository, {
    logger: { warn: () => undefined },
    now: () => new Date(OCCURRED_AT),
    randomUUID: (() => {
      let sequence = 0;
      return () => {
        sequence += 1;
        return `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
      };
    })(),
    redactor: new DiagnosticTextRedactor(),
  });
  public readonly captureService = new DiagnosticCaptureService({
    logger: { warn: () => undefined },
    settings: this.captureSettings,
    storage: this.storage,
  });
  public readonly voiceAudit = new VoiceProviderAudit(this.auditCapture.dependencies);
  public readonly prettifyAudit = new PrettifyProviderAudit(this.auditCapture.dependencies);
  public readonly translationAudit = new TranslationProviderAudit(this.auditCapture.dependencies);
  public readonly archiveService: DiagnosticsArchiveService;

  public constructor() {
    TEMPORARY_DIRECTORIES.push(this.directory);
    const fileSystem = {
      chmod: (filePath: string, mode: number) => fs.promises.chmod(filePath, mode),
      createWriteStream: (filePath: string, options: { readonly flags: 'wx'; readonly mode: number }): fs.WriteStream =>
        fs.createWriteStream(filePath, options),
      readFile: (filePath: string) => fs.promises.readFile(filePath),
      removeFile: (filePath: string) => fs.promises.rm(filePath, { force: true }),
      rename: (sourcePath: string, destinationPath: string) => fs.promises.rename(sourcePath, destinationPath),
    };
    this.archiveService = new DiagnosticsArchiveService({
      environment: { getSnapshot: () => ENVIRONMENT },
      fileSystem,
      formatAdapter: new DiagnosticsArchiveFormatAdapter({
        fileSystem,
        platform: 'linux',
        writerFactory: new ArchiverDiagnosticsArchiveWriterFactory(),
      }),
      jsonl: new DiagnosticsArchiveJsonlSerializer(),
      logs: new ProviderAuditLogExtractor({
        readRetainedLogs: () => [
          {
            contents: [
              `${PROHIBITED_MARKERS.unrelatedLog} ${PROHIBITED_MARKERS.path}`,
              ...this.auditCapture.calls.map(({ arguments: arguments_, level }) => {
                assert.equal(arguments_[0], PROVIDER_AUDIT_LABEL);
                assert.equal(typeof arguments_[1], 'string');
                return `[${OCCURRED_AT}] [${level}] (provider-audit) ${PROVIDER_AUDIT_LABEL} ${String(arguments_[1])}`;
              }),
            ].join('\n'),
            generation: 'current',
          },
        ],
      }),
      localWhisperSnapshot: { capture: () => null },
      manifest: new DiagnosticsManifestBuilder({
        databaseSchemaVersion: 2,
        diagnosticRowSchemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
        hash: (payload) => createHash('sha256').update(payload).digest('hex'),
        providerAuditSchemaVersion: PROVIDER_AUDIT_SCHEMA_VERSION,
        redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
      }),
      now: () => new Date(OCCURRED_AT),
      platform: 'linux',
      randomUUID: () => ARCHIVE_ID,
      settings: this.captureSettings,
      storage: this.storage,
    });
  }

  public emitProviderAuditMatrix(): void {
    const prohibitedMetadata = { ...PROHIBITED_MARKERS };
    const voiceContext = this.voiceAudit.startOperation(
      'chatgpt',
      'transcribe-batch',
      'validation',
      {},
      VOICE_OPERATION_ID,
    );
    voiceContext.lifecycle.phaseEntered('submission', prohibitedMetadata as never);
    this.voiceAudit.terminalException(voiceContext, 'result', new Error(PROHIBITED_MARKERS.exception), {
      causeCode: 'unknown',
    });

    const prettifyContext = this.prettifyAudit.startOperation(
      'ollama',
      'prettify',
      'validation',
      {},
      PRETTIFY_OPERATION_ID,
    );
    prettifyContext.lifecycle.phaseEntered('submission', prohibitedMetadata as never);
    prettifyContext.lifecycle.terminal('result', 'success');

    const translationContext = this.translationAudit.startOperation(
      'google',
      'translate',
      'validation',
      {},
      TRANSLATION_OPERATION_ID,
    );
    translationContext.lifecycle.phaseEntered('submission', prohibitedMetadata as never);
    translationContext.lifecycle.terminal('result', 'success');
  }

  public async captureEnabledDiagnostics(): Promise<void> {
    assert.deepEqual(
      await this.captureService.captureTranslationProviderSuccess({
        contractVersion: TRANSLATION_PROVIDER_INFO.google.contractVersion,
        providerId: 'google',
        providerOperationId: TRANSLATION_OPERATION_ID,
        resultText: `${ALLOWED_DIAGNOSTIC_MARKERS.translationResult} password=${PROHIBITED_MARKERS.httpBody}`,
        sourceText: `${ALLOWED_DIAGNOSTIC_MARKERS.translationSource} Bearer ${PROHIBITED_MARKERS.credential}`,
        targetLanguage: 'en',
      }),
      { status: 'success' },
    );
    assert.deepEqual(
      await this.captureService.capturePrettifyProviderSuccess({
        providerId: 'ollama',
        providerOperationId: PRETTIFY_OPERATION_ID,
        resultText: `${ALLOWED_DIAGNOSTIC_MARKERS.prettifyResult} password=${PROHIBITED_MARKERS.session}`,
        sourceText: `${ALLOWED_DIAGNOSTIC_MARKERS.prettifySource} password=${PROHIBITED_MARKERS.url}`,
      }),
      { status: 'success' },
    );

    const rejectedVoice = await this.storage.insert({
      actionType: 'translation',
      contractVersion: TRANSLATION_PROVIDER_INFO.google.contractVersion,
      providerId: 'chatgpt',
      providerOperationId: VOICE_OPERATION_ID,
      resultText: PROHIBITED_MARKERS.voiceTranscript,
      sourceKind: 'provider',
      sourceText: PROHIBITED_MARKERS.audioAdjacent,
      targetLanguage: 'en',
    } as never);
    assert.deepEqual(rejectedVoice, {
      causeCode: 'diagnostic-storage-failed',
      status: 'failure',
    });
    assert.equal(this.repository.records.length, 2);
  }

  public async createArchive(filename: string): Promise<string> {
    const destinationPath = path.join(this.directory, filename);
    assert.deepEqual(await this.archiveService.createArchive(destinationPath), { status: 'success' });
    return destinationPath;
  }
}

afterEach(() => {
  for (const directory of TEMPORARY_DIRECTORIES) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
  TEMPORARY_DIRECTORIES.length = 0;
});

describe('provider audit privacy integration', () => {
  it('keeps prohibited channels out of producer audit, manifest, and diagnostic rows', async () => {
    const harness = new DiagnosticsPrivacyHarness();
    harness.emitProviderAuditMatrix();

    const auditLoggerArguments = JSON.stringify(harness.auditCapture.calls);
    for (const marker of Object.values(PROHIBITED_MARKERS)) {
      assert.equal(auditLoggerArguments.includes(marker), false, marker);
    }

    await harness.captureEnabledDiagnostics();
    const storedRows = JSON.stringify(harness.repository.records);
    for (const marker of [
      PROHIBITED_MARKERS.credential,
      PROHIBITED_MARKERS.httpBody,
      PROHIBITED_MARKERS.session,
      PROHIBITED_MARKERS.url,
    ]) {
      assert.equal(storedRows.includes(marker), false, marker);
    }
    assert.equal(storedRows.includes('[REDACTED]'), true);

    const archivePath = await harness.createArchive('privacy-matrix.tar.gz');
    const members = inspectDiagnosticsArchiveForVerification('tar-gzip', await fs.promises.readFile(archivePath));
    const manifestPayload = members.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest);
    const auditPayload = members.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents);
    const diagnosticPayload = members.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions);
    assert.ok(manifestPayload);
    assert.ok(auditPayload);
    assert.ok(diagnosticPayload);

    for (const marker of [...Object.values(PROHIBITED_MARKERS), ...Object.values(ALLOWED_DIAGNOSTIC_MARKERS)]) {
      assert.equal(manifestPayload.includes(Buffer.from(marker)), false, `manifest:${marker}`);
      assert.equal(auditPayload.includes(Buffer.from(marker)), false, `audit:${marker}`);
    }
    for (const marker of Object.values(PROHIBITED_MARKERS)) {
      assert.equal(diagnosticPayload.includes(Buffer.from(marker)), false, `diagnostic:${marker}`);
    }
    for (const marker of Object.values(ALLOWED_DIAGNOSTIC_MARKERS)) {
      assert.equal(diagnosticPayload.includes(Buffer.from(marker)), true, `diagnostic:${marker}`);
    }
    assert.equal(diagnosticPayload.includes(Buffer.from('[REDACTED]')), true);

    const diagnosticRows = diagnosticPayload
      .toString('utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.deepEqual(
      diagnosticRows.map(({ actionType }) => actionType),
      ['translation', 'prettify'],
    );
    assert.equal(
      diagnosticRows.some(({ providerId }) =>
        ['chatgpt', 'openai-api', 'claude-web', 'local-whisper'].includes(String(providerId)),
      ),
      false,
    );
  });

  it('omits disabled categories and all diagnostic text while preserving metadata audit events', async () => {
    const harness = new DiagnosticsPrivacyHarness();
    harness.emitProviderAuditMatrix();
    await harness.captureEnabledDiagnostics();

    harness.captureSettings.setSettings({
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: true,
    });
    const translationOnlyPath = await harness.createArchive('translation-only.tar.gz');
    const translationOnlyMembers = inspectDiagnosticsArchiveForVerification(
      'tar-gzip',
      await fs.promises.readFile(translationOnlyPath),
    );
    const translationOnlyPayload = translationOnlyMembers.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.DiagnosticTextActions);
    assert.ok(translationOnlyPayload);
    assert.equal(translationOnlyPayload.includes(Buffer.from(ALLOWED_DIAGNOSTIC_MARKERS.translationSource)), true);
    assert.equal(translationOnlyPayload.includes(Buffer.from(ALLOWED_DIAGNOSTIC_MARKERS.prettifySource)), false);
    assert.equal(translationOnlyPayload.toString('utf8').includes('"actionType":"prettify"'), false);

    harness.captureSettings.setSettings({
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: false,
    });
    const metadataOnlyPath = await harness.createArchive('metadata-only.tar.gz');
    const metadataOnlyMembers = inspectDiagnosticsArchiveForVerification(
      'tar-gzip',
      await fs.promises.readFile(metadataOnlyPath),
    );
    assert.deepEqual(
      [...metadataOnlyMembers.keys()],
      [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest, DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents],
    );
    assert.equal((metadataOnlyMembers.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents)?.byteLength ?? 0) > 0, true);
  });
});
