/* eslint-disable max-classes-per-file -- integration harnesses own isolated settings, storage, and repository state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DiagnosticCaptureService, type DiagnosticCaptureAttemptResult } from '@main/services/diagnosticCapture';
import {
  DiagnosticCaptureStorage,
  type DiagnosticCaptureInput,
  type DiagnosticCaptureInsertResult,
} from '@main/services/diagnosticCaptureStorage';
import { DiagnosticTextRedactor } from '@main/services/diagnosticTextRedactor';
import type {
  DiagnosticActionType,
  DiagnosticCapturePrunePolicy,
  DiagnosticCaptureRecord,
  DiagnosticCaptureRepository,
  DiagnosticCaptureRow,
} from '@main/repositories/diagnosticCaptureRepository';
import type { DiagnosticCaptureSettings } from '@shared/diagnosticCaptureSettings';
import { TRANSLATION_PROVIDER_INFO } from '@shared/translationProvider';

const PROVIDER_OPERATION_ID = '00000000-0000-4000-8000-000000000019';
const ACTION_ID = '10000000-0000-4000-8000-000000000019';

class TestDiagnosticCaptureSettings {
  public constructor(
    private settings: DiagnosticCaptureSettings = {
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: false,
    },
  ) {}

  public getSettings(): DiagnosticCaptureSettings {
    return this.settings;
  }

  public setSettings(settings: DiagnosticCaptureSettings): void {
    this.settings = settings;
  }
}

class TestDiagnosticCaptureStorage {
  public readonly inputs: DiagnosticCaptureInput[] = [];
  public result: DiagnosticCaptureInsertResult = { actionId: ACTION_ID, status: 'success' };
  public throws = false;

  public async insert(input: DiagnosticCaptureInput): Promise<DiagnosticCaptureInsertResult> {
    this.inputs.push(input);
    if (this.throws) throw new Error('storage-private-canary');
    return this.result;
  }
}

class RecordingDiagnosticCaptureRepository implements DiagnosticCaptureRepository {
  public readonly records: DiagnosticCaptureRecord[] = [];

  public insert(capture: DiagnosticCaptureRecord, _policy: DiagnosticCapturePrunePolicy): void {
    this.records.push(capture);
  }

  public prune(_policy: DiagnosticCapturePrunePolicy): number {
    return 0;
  }

  public pruneAndPurge(_policy: DiagnosticCapturePrunePolicy, _categories: readonly DiagnosticActionType[]): number {
    return 0;
  }

  public purge(_categories: readonly DiagnosticActionType[]): number {
    return 0;
  }

  public readForArchive(_categories: readonly DiagnosticActionType[]): readonly DiagnosticCaptureRow[] {
    return this.records;
  }
}

class DiagnosticCaptureHarness {
  public readonly settings = new TestDiagnosticCaptureSettings();
  public readonly storage = new TestDiagnosticCaptureStorage();
  public readonly warnings: unknown[][] = [];
  public readonly service = new DiagnosticCaptureService({
    logger: {
      warn: (...args) => {
        this.warnings.push(args);
      },
    },
    settings: this.settings,
    storage: this.storage,
  });

  public enable(
    settings: DiagnosticCaptureSettings = {
      capturePrettifyDiagnostics: true,
      captureTranslationDiagnostics: true,
    },
  ): void {
    this.settings.setSettings(settings);
  }

  public async settleCacheCapture(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }
}

function assertFailure(result: DiagnosticCaptureAttemptResult, causeCode: string): void {
  assert.deepEqual(result, { causeCode, status: 'failure' });
}

describe('DiagnosticCaptureService integration', () => {
  it('keeps both categories default-off without touching storage', async () => {
    const harness = new DiagnosticCaptureHarness();

    const translation = await harness.service.captureTranslationProviderSuccess({
      contractVersion: '2026-08-09',
      providerId: 'google',
      providerOperationId: PROVIDER_OPERATION_ID,
      resultText: 'result',
      sourceText: 'source',
      targetLanguage: 'uk',
    });
    const prettify = await harness.service.capturePrettifyProviderSuccess({
      providerId: 'ollama',
      providerOperationId: PROVIDER_OPERATION_ID,
      resultText: 'result',
      sourceText: 'source',
    });
    harness.service.captureTranslationCacheHit({
      contractVersion: '2026-08-09',
      providerId: 'google',
      resultText: 'cached result',
      sourceText: 'source',
      targetLanguage: 'uk',
    });

    assert.deepEqual(translation, { status: 'disabled' });
    assert.deepEqual(prettify, { status: 'disabled' });
    assert.deepEqual(harness.storage.inputs, []);
    assert.deepEqual(harness.warnings, []);
  });

  it('checks independent settings for each future provider success', async () => {
    const harness = new DiagnosticCaptureHarness();
    harness.enable({
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: true,
    });

    await harness.service.captureTranslationProviderSuccess({
      contractVersion: '2026-08-09',
      providerId: 'bing',
      providerOperationId: PROVIDER_OPERATION_ID,
      resultText: 'translated',
      sourceText: 'source',
      targetLanguage: 'ru',
    });
    await harness.service.capturePrettifyProviderSuccess({
      providerId: 'vllm',
      providerOperationId: PROVIDER_OPERATION_ID,
      resultText: 'prettified',
      sourceText: 'source',
    });

    assert.deepEqual(harness.storage.inputs, [
      {
        actionType: 'translation',
        contractVersion: '2026-08-09',
        providerId: 'bing',
        providerOperationId: PROVIDER_OPERATION_ID,
        resultText: 'translated',
        sourceKind: 'provider',
        sourceText: 'source',
        targetLanguage: 'ru',
      },
    ]);

    harness.enable({
      capturePrettifyDiagnostics: true,
      captureTranslationDiagnostics: false,
    });
    await harness.service.capturePrettifyProviderSuccess({
      contractVersion: 'cli-capability-v1',
      providerId: 'codex-cli',
      providerOperationId: PROVIDER_OPERATION_ID,
      resultText: 'prettified',
      sourceText: 'source',
    });
    assert.equal(harness.storage.inputs.length, 2);
    assert.equal(harness.storage.inputs[1]?.actionType, 'prettify');
    assert.equal(harness.storage.inputs[1]?.contractVersion, 'cli-capability-v1');
  });

  it('captures cache hits once without provider-operation correlation', async () => {
    const harness = new DiagnosticCaptureHarness();
    harness.enable();

    harness.service.captureTranslationCacheHit({
      contractVersion: '2026-08-09',
      providerId: 'yandex',
      resultText: 'translated',
      sourceText: 'source',
      targetLanguage: 'be',
    });
    harness.service.capturePrettifyCacheHit({
      providerId: 'claude-cli',
      resultText: 'prettified',
      sourceText: 'source',
    });
    await harness.settleCacheCapture();

    assert.equal(harness.storage.inputs.length, 2);
    assert.equal(
      harness.storage.inputs.every((input) => input.providerOperationId === undefined),
      true,
    );
    assert.deepEqual(
      harness.storage.inputs.map(({ actionType, sourceKind }) => ({ actionType, sourceKind })),
      [
        { actionType: 'translation', sourceKind: 'cache' },
        { actionType: 'prettify', sourceKind: 'cache' },
      ],
    );
  });

  it('returns closed provider failures and emits no separate cache logger event', async () => {
    const harness = new DiagnosticCaptureHarness();
    harness.enable();
    harness.storage.result = {
      causeCode: 'diagnostic-row-too-large',
      status: 'skipped',
    };

    const result = await harness.service.captureTranslationProviderSuccess({
      contractVersion: '2026-08-09',
      providerId: 'google',
      providerOperationId: PROVIDER_OPERATION_ID,
      resultText: 'result',
      sourceText: 'source',
      targetLanguage: 'uk',
    });

    assertFailure(result, 'diagnostic-row-too-large');
    assert.deepEqual(harness.warnings, []);
  });

  it('logs only safe cache metadata for redaction, size, and storage failures', async () => {
    const privateSource = 'source-private-canary';
    const privateResult = 'result-private-canary';

    for (const result of [
      { causeCode: 'diagnostic-redaction-failed', status: 'skipped' },
      { causeCode: 'diagnostic-row-too-large', status: 'skipped' },
      { causeCode: 'diagnostic-storage-unavailable', status: 'failure' },
      { causeCode: 'diagnostic-storage-failed', status: 'failure' },
    ] as const satisfies readonly DiagnosticCaptureInsertResult[]) {
      const harness = new DiagnosticCaptureHarness();
      harness.enable();
      harness.storage.result = result;

      harness.service.capturePrettifyCacheHit({
        providerId: 'ollama',
        resultText: privateResult,
        sourceText: privateSource,
      });
      await harness.settleCacheCapture();

      assert.deepEqual(harness.warnings, [
        [
          'Diagnostic capture action',
          {
            actionType: 'prettify',
            causeCode: result.causeCode,
            providerId: 'ollama',
            sourceKind: 'cache',
          },
        ],
      ]);
      const serializedWarnings = JSON.stringify(harness.warnings);
      assert.equal(serializedWarnings.includes(privateSource), false);
      assert.equal(serializedWarnings.includes(privateResult), false);
      assert.equal(serializedWarnings.includes('provider-audit'), false);
      assert.equal(serializedWarnings.includes(PROVIDER_OPERATION_ID), false);
    }
  });

  it('normalizes throwing storage without exposing exception details', async () => {
    const harness = new DiagnosticCaptureHarness();
    harness.enable();
    harness.storage.throws = true;

    const result = await harness.service.capturePrettifyProviderSuccess({
      providerId: 'vllm',
      providerOperationId: PROVIDER_OPERATION_ID,
      resultText: 'result-private-canary',
      sourceText: 'source-private-canary',
    });

    assertFailure(result, 'diagnostic-storage-failed');
    assert.equal(JSON.stringify(harness.warnings).includes('storage-private-canary'), false);
  });

  it('persists redacted provider and cache rows with distinct action correlation', async () => {
    const repository = new RecordingDiagnosticCaptureRepository();
    let uuidCounter = 0;
    const storage = new DiagnosticCaptureStorage(repository, {
      logger: { warn: () => undefined },
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      randomUUID: () => {
        uuidCounter += 1;
        return `20000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
      },
      redactor: new DiagnosticTextRedactor(),
    });
    const service = new DiagnosticCaptureService({
      logger: { warn: () => undefined },
      settings: new TestDiagnosticCaptureSettings({
        capturePrettifyDiagnostics: true,
        captureTranslationDiagnostics: true,
      }),
      storage,
    });

    await service.captureTranslationProviderSuccess({
      contractVersion: TRANSLATION_PROVIDER_INFO.google.contractVersion,
      providerId: 'google',
      providerOperationId: PROVIDER_OPERATION_ID,
      resultText: 'password=result-password',
      sourceText: 'Bearer sk-proj-abcdefghijklmnopqrstuvwxyz123456',
      targetLanguage: 'uk',
    });
    service.capturePrettifyCacheHit({
      providerId: 'ollama',
      resultText: 'safe cached result',
      sourceText: 'safe cached source',
    });
    await storage.shutdown();

    assert.equal(repository.records.length, 2);
    assert.equal(repository.records[0]?.providerOperationId, PROVIDER_OPERATION_ID);
    assert.equal(repository.records[1]?.providerOperationId, null);
    assert.notEqual(repository.records[0]?.actionId, repository.records[1]?.actionId);
    assert.equal(repository.records[0]?.sourceText, 'Bearer [REDACTED]');
    assert.equal(repository.records[0]?.resultText, 'password=[REDACTED]');
    assert.equal(JSON.stringify(repository.records).includes('abcdefghijklmnopqrstuvwxyz123456'), false);
    assert.equal(JSON.stringify(repository.records).includes('result-password'), false);
  });
});
