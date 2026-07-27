/* eslint-disable max-classes-per-file -- the state-owning repository fake and service harness share this suite. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import {
  type DiagnosticActionType,
  type DiagnosticCapturePrunePolicy,
  type DiagnosticCaptureRecord,
  type DiagnosticCaptureRepository,
  type DiagnosticCaptureRow,
} from '@main/repositories/diagnosticCaptureRepository';
import { REPOSITORY_ERROR_CODES, RepositoryError } from '@main/repositories/repositoryErrors';
import {
  DIAGNOSTIC_CAPTURE_CAUSE_CODES,
  DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES,
  DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES,
  DiagnosticCaptureStorage,
  type DiagnosticCaptureInput,
  type DiagnosticCaptureStorageDependencies,
} from '@main/services/diagnosticCaptureStorage';
import { DiagnosticTextRedactor } from '@main/services/diagnosticTextRedactor';

const FIXED_NOW = new Date('2026-07-27T12:00:00.000Z');
const TRANSLATION_CONTRACT_VERSION = '2026-07-25';
const PROVIDER_OPERATION_ID = '10000000-0000-4000-8000-000000000001';
const MAIN_APPLICATION_SOURCE_PATH = path.resolve(__dirname, '../../src/main/mainProcessApplication.ts');
const DIAGNOSTIC_SERVICE_SOURCE_PATH = path.resolve(__dirname, '../../src/main/services/diagnosticCaptureStorage.ts');
const TRANSCRIPTION_COMPLETION_SOURCE_PATH = path.resolve(
  __dirname,
  '../../src/main/services/transcriptionCompletion.ts',
);

class RecordingDiagnosticCaptureRepository implements DiagnosticCaptureRepository {
  public readonly insertCalls: Array<{
    readonly capture: DiagnosticCaptureRecord;
    readonly policy: DiagnosticCapturePrunePolicy;
  }> = [];
  public readonly pruneCalls: DiagnosticCapturePrunePolicy[] = [];
  public readonly purgeCalls: Array<readonly DiagnosticActionType[]> = [];
  public readonly readCalls: Array<readonly DiagnosticActionType[]> = [];
  public rows: DiagnosticCaptureRow[] = [];
  public error: Error | null = null;

  public insert(capture: DiagnosticCaptureRecord, policy: DiagnosticCapturePrunePolicy): void {
    this.throwIfConfigured();
    this.insertCalls.push({ capture, policy });
    this.rows.push(capture);
  }

  public prune(policy: DiagnosticCapturePrunePolicy): number {
    this.throwIfConfigured();
    this.pruneCalls.push(policy);
    return 0;
  }

  public purge(categories: readonly DiagnosticActionType[]): number {
    this.throwIfConfigured();
    this.purgeCalls.push([...categories]);
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !categories.includes(row.actionType));
    return before - this.rows.length;
  }

  public readForArchive(categories: readonly DiagnosticActionType[]): readonly DiagnosticCaptureRow[] {
    this.throwIfConfigured();
    this.readCalls.push([...categories]);
    return this.rows.filter((row) => categories.includes(row.actionType));
  }

  private throwIfConfigured(): void {
    if (this.error) throw this.error;
  }
}

class DiagnosticCaptureStorageHarness {
  public readonly logs: unknown[][] = [];
  public readonly repository: RecordingDiagnosticCaptureRepository;
  public readonly storage: DiagnosticCaptureStorage;
  private nextUuid = 1;

  public constructor(
    overrides: Partial<DiagnosticCaptureStorageDependencies> = {},
    repository = new RecordingDiagnosticCaptureRepository(),
  ) {
    this.repository = repository;
    this.storage = new DiagnosticCaptureStorage(repository, {
      logger: { warn: (...args: unknown[]) => this.logs.push(args) },
      now: () => FIXED_NOW,
      randomUUID: () => this.createUuid(),
      redactor: new DiagnosticTextRedactor(),
      ...overrides,
    });
  }

  private createUuid(): string {
    const suffix = String(this.nextUuid++).padStart(12, '0');
    return `00000000-0000-4000-8000-${suffix}`;
  }
}

function translationInput(overrides: Partial<DiagnosticCaptureInput> = {}): DiagnosticCaptureInput {
  return {
    actionType: 'translation',
    contractVersion: TRANSLATION_CONTRACT_VERSION,
    providerId: 'google',
    providerOperationId: PROVIDER_OPERATION_ID,
    resultText: 'translated result',
    sourceKind: 'provider',
    sourceText: 'source text',
    targetLanguage: 'en',
    ...overrides,
  };
}

describe('diagnostic capture storage service', () => {
  it('redacts and prepares safe repository records before persistence', async () => {
    const harness = new DiagnosticCaptureStorageHarness();
    const sourceSecret = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
    const resultSecret = 'result-password';

    const inserted = await harness.storage.insert(
      translationInput({
        resultText: `password=${resultSecret}`,
        sourceText: `Bearer ${sourceSecret}`,
      }),
    );

    assert.deepEqual(inserted, {
      actionId: '00000000-0000-4000-8000-000000000001',
      status: 'success',
    });
    assert.equal(harness.repository.insertCalls.length, 1);
    assert.deepEqual(harness.repository.insertCalls[0], {
      policy: {
        capacityBytes: DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES,
        retentionCutoff: '2026-05-28T12:00:00.000Z',
      },
      capture: {
        actionId: inserted.actionId,
        actionType: 'translation',
        contractVersion: TRANSLATION_CONTRACT_VERSION,
        providerId: 'google',
        providerOperationId: PROVIDER_OPERATION_ID,
        recordedAt: FIXED_NOW.toISOString(),
        redactionCount: 2,
        redactorVersion: 1,
        resultBytes: Buffer.byteLength('password=[REDACTED]', 'utf8'),
        resultText: 'password=[REDACTED]',
        retainedBytes: Buffer.byteLength('Bearer [REDACTED]password=[REDACTED]', 'utf8'),
        sourceBytes: Buffer.byteLength('Bearer [REDACTED]', 'utf8'),
        sourceKind: 'provider',
        sourceText: 'Bearer [REDACTED]',
        targetLanguage: 'en',
      },
    });
    assert.equal(JSON.stringify(harness.repository.insertCalls).includes(sourceSecret), false);
    assert.equal(JSON.stringify(harness.repository.insertCalls).includes(resultSecret), false);
  });

  it('rejects invalid providers, metadata, and operation identifiers without calling the repository', async () => {
    const harness = new DiagnosticCaptureStorageHarness();

    const results = await Promise.all([
      harness.storage.insert(
        translationInput({ providerId: 'unknown-provider' as DiagnosticCaptureInput['providerId'] }),
      ),
      harness.storage.insert(translationInput({ providerOperationId: 'renderer-candidate-id' })),
      harness.storage.insert(translationInput({ targetLanguage: 'private-language-marker' })),
    ]);

    for (const result of results) {
      assert.deepEqual(result, {
        causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed,
        status: 'failure',
      });
    }
    assert.equal(harness.repository.insertCalls.length, 0);
  });

  it('accepts exactly one MiB after redaction and skips one byte more', async () => {
    const harness = new DiagnosticCaptureStorageHarness();
    const exactText = 'é'.repeat(DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES / 2);

    const exact = await harness.storage.insert(translationInput({ resultText: '', sourceText: exactText }));
    const oversized = await harness.storage.insert(translationInput({ resultText: 'x', sourceText: exactText }));

    assert.equal(exact.status, 'success');
    assert.deepEqual(oversized, {
      causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.RowTooLarge,
      status: 'skipped',
    });
    assert.equal(harness.repository.insertCalls.length, 1);
    assert.equal(harness.repository.insertCalls[0].capture.retainedBytes, DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES);
  });

  it('skips a throwing redactor without calling or leaking to the repository', async () => {
    const canary = 'redaction-exception-private-text';
    const harness = new DiagnosticCaptureStorageHarness({
      redactor: {
        redact(): never {
          throw new Error(canary);
        },
      },
    });

    const result = await harness.storage.insert(translationInput({ sourceText: canary }));

    assert.deepEqual(result, {
      causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.RedactionFailed,
      status: 'skipped',
    });
    assert.equal(harness.repository.insertCalls.length, 0);
    assert.equal(JSON.stringify(harness.logs).includes(canary), false);
  });

  it('normalizes categories and delegates prune, purge, and archive reads', async () => {
    const harness = new DiagnosticCaptureStorageHarness();
    await harness.storage.insert(translationInput());

    assert.deepEqual(await harness.storage.prune(), { affectedRows: 0, status: 'success' });
    assert.deepEqual(await harness.storage.readForArchive(['translation', 'translation']), {
      rows: harness.repository.rows,
      status: 'success',
    });
    assert.deepEqual(await harness.storage.purge(['translation', 'translation']), {
      affectedRows: 1,
      status: 'success',
    });
    assert.deepEqual(harness.repository.pruneCalls, [
      {
        capacityBytes: DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES,
        retentionCutoff: '2026-05-28T12:00:00.000Z',
      },
    ]);
    assert.deepEqual(harness.repository.readCalls, [['translation']]);
    assert.deepEqual(harness.repository.purgeCalls, [['translation']]);
  });

  it('maps repository availability separately from repository operation failures', async () => {
    const unavailableHarness = new DiagnosticCaptureStorageHarness();
    unavailableHarness.repository.error = new RepositoryError(REPOSITORY_ERROR_CODES.Unavailable);
    const failedHarness = new DiagnosticCaptureStorageHarness();
    failedHarness.repository.error = new Error('private repository failure');

    assert.deepEqual(await unavailableHarness.storage.insert(translationInput()), {
      causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable,
      status: 'failure',
    });
    assert.deepEqual(await failedHarness.storage.insert(translationInput()), {
      causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed,
      status: 'failure',
    });
  });

  it('drains accepted work, returns one shutdown promise, and rejects late work', async () => {
    const harness = new DiagnosticCaptureStorageHarness();

    const acceptedInsert = harness.storage.insert(translationInput());
    const firstShutdown = harness.storage.shutdown();
    const secondShutdown = harness.storage.shutdown();

    assert.equal(firstShutdown, secondShutdown);
    assert.equal((await acceptedInsert).status, 'success');
    assert.deepEqual(await firstShutdown, { affectedRows: 0, status: 'success' });
    assert.deepEqual(await harness.storage.insert(translationInput()), {
      causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable,
      status: 'failure',
    });
    assert.equal(harness.repository.insertCalls.length, 1);
  });

  it('fails open on startup maintenance and logs only a closed cause and phase', async () => {
    const harness = new DiagnosticCaptureStorageHarness();
    harness.repository.error = new RepositoryError(REPOSITORY_ERROR_CODES.Unavailable);

    await harness.storage.pruneOnStartup();

    assert.deepEqual(harness.logs, [
      [
        'Diagnostic capture maintenance',
        {
          causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable,
          phase: 'maintenance',
        },
      ],
    ]);
  });

  it('keeps service repository state isolated between instances', async () => {
    const first = new DiagnosticCaptureStorageHarness();
    const second = new DiagnosticCaptureStorageHarness();

    await first.storage.insert(translationInput());

    assert.equal(first.repository.rows.length, 1);
    assert.equal(second.repository.rows.length, 0);
  });

  it('keeps SQLite and raw connection access outside business services', () => {
    const diagnosticSource = fs.readFileSync(DIAGNOSTIC_SERVICE_SOURCE_PATH, 'utf8');
    const transcriptionSource = fs.readFileSync(TRANSCRIPTION_COMPLETION_SOURCE_PATH, 'utf8');
    for (const source of [diagnosticSource, transcriptionSource]) {
      assert.equal(source.includes('node:sqlite'), false);
      assert.equal(source.includes('DatabaseSync'), false);
      assert.equal(source.includes('.prepare('), false);
      assert.equal(source.includes('BEGIN IMMEDIATE'), false);
    }
  });

  it('keeps startup prune before IPC and closes the database after draining diagnostics', () => {
    const source = fs.readFileSync(MAIN_APPLICATION_SOURCE_PATH, 'utf8');
    const configIndex = source.indexOf('dependencies.config.load();');
    const pruneIndex = source.indexOf('await runtime.pruneDiagnostics();');
    const ipcIndex = source.indexOf('runtime.registerIpc();');
    const browserShutdownIndex = source.indexOf('await this.dependencies.backgroundBrowserService.shutdown();');
    const diagnosticShutdownIndex = source.indexOf('await runtime.shutdownDiagnostics();');
    const databaseCloseIndex = source.indexOf('runtime.closeDatabase();');

    assert.equal(configIndex >= 0, true);
    assert.equal(configIndex < pruneIndex, true);
    assert.equal(pruneIndex < ipcIndex, true);
    assert.equal(browserShutdownIndex < diagnosticShutdownIndex, true);
    assert.equal(diagnosticShutdownIndex < databaseCloseIndex, true);
  });
});
