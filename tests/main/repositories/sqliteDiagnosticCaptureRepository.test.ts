import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import type { DiagnosticActionType, DiagnosticCaptureRecord } from '@main/repositories/diagnosticCaptureRepository';
import { REPOSITORY_ERROR_CODES, RepositoryError } from '@main/repositories/repositoryErrors';
import { AppDatabaseCoordinator } from '@main/repositories/sqlite/appDatabase';
import { AppDatabaseTestDependencies } from './appDatabaseTestDependencies';
import { SqliteDiagnosticCaptureRepository } from '@main/repositories/sqlite/sqliteDiagnosticCaptureRepository';
import { SqliteTranscriptionHistoryRepository } from '@main/repositories/sqlite/sqliteTranscriptionHistoryRepository';
import { registerDiagnosticCaptureRepositoryContract } from './contracts/diagnosticCaptureRepositoryContract';

const PAYLOAD_CAP_BYTES = 104_857_600;
const CURRENT_TIME = '2026-07-27T12:00:00.000Z';
const RETENTION_CUTOFF = '2026-05-28T12:00:00.000Z';
const UNBOUNDED_CAPACITY = Number.MAX_SAFE_INTEGER;

class DiagnosticRepositoryHarness {
  public readonly coordinator: AppDatabaseCoordinator;
  public readonly repository: SqliteDiagnosticCaptureRepository;
  public readonly temporaryDirectory: string;
  private nextId = 1;

  public constructor() {
    this.temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-diagnostic-repository-'));
    this.coordinator = new AppDatabaseCoordinator(
      path.join(this.temporaryDirectory, 'diagnostics.sqlite3'),
      new AppDatabaseTestDependencies(),
    );
    this.repository = new SqliteDiagnosticCaptureRepository(this.coordinator);
  }

  public record(
    overrides: Partial<DiagnosticCaptureRecord> & {
      readonly actionType?: DiagnosticActionType;
    } = {},
  ): DiagnosticCaptureRecord {
    const actionType = overrides.actionType ?? 'translation';
    const actionId = `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`;
    const sourceText = overrides.sourceText ?? 'source';
    const resultText = overrides.resultText ?? 'result';
    const sourceBytes = overrides.sourceBytes ?? Buffer.byteLength(sourceText);
    const resultBytes = overrides.resultBytes ?? Buffer.byteLength(resultText);
    return {
      actionId,
      actionType,
      contractVersion: actionType === 'translation' ? '2026-07-25' : null,
      providerId: actionType === 'translation' ? 'google' : 'ollama',
      providerOperationId: null,
      recordedAt: CURRENT_TIME,
      redactionCount: 0,
      redactorVersion: 1,
      resultBytes,
      resultText,
      retainedBytes: sourceBytes + resultBytes,
      sourceBytes,
      sourceKind: 'provider',
      sourceText,
      targetLanguage: actionType === 'translation' ? 'en' : null,
      ...overrides,
    };
  }

  public seed(record: DiagnosticCaptureRecord): void {
    this.repository.insert(record, {
      capacityBytes: UNBOUNDED_CAPACITY,
      retentionCutoff: '1970-01-01T00:00:00.000Z',
    });
  }

  public close(): void {
    this.coordinator.close();
    fs.rmSync(this.temporaryDirectory, { force: true, recursive: true });
  }
}

const harnesses: DiagnosticRepositoryHarness[] = [];

afterEach(() => {
  for (const harness of harnesses) harness.close();
  harnesses.length = 0;
});

function createHarness(): DiagnosticRepositoryHarness {
  const harness = new DiagnosticRepositoryHarness();
  harnesses.push(harness);
  return harness;
}

registerDiagnosticCaptureRepositoryContract(() => {
  const harness = new DiagnosticRepositoryHarness();
  return {
    dispose: () => harness.close(),
    repository: harness.repository,
  };
});

describe('SQLite diagnostic capture repository', () => {
  it('inserts and maps retained rows in deterministic order', () => {
    const harness = createHarness();
    const later = harness.record({ recordedAt: '2026-07-02T00:00:00.000Z' });
    const earlier = harness.record({
      actionType: 'prettify',
      recordedAt: '2026-07-01T00:00:00.000Z',
    });

    harness.seed(later);
    harness.seed(earlier);

    assert.deepEqual(harness.repository.readForArchive(['translation', 'prettify']), [earlier, later]);
    assert.deepEqual(harness.repository.readForArchive([]), []);
  });

  it('prunes rows strictly older than retention while retaining the boundary', () => {
    const harness = createHarness();
    const expired = harness.record({ recordedAt: '2026-05-28T11:59:59.999Z' });
    const boundary = harness.record({
      actionType: 'prettify',
      recordedAt: RETENTION_CUTOFF,
    });
    harness.seed(expired);
    harness.seed(boundary);

    const affected = harness.repository.prune({
      capacityBytes: PAYLOAD_CAP_BYTES,
      retentionCutoff: RETENTION_CUTOFF,
    });

    assert.equal(affected, 1);
    assert.deepEqual(harness.repository.readForArchive(['translation', 'prettify']), [boundary]);
    assert.equal(
      harness.repository.prune({
        capacityBytes: PAYLOAD_CAP_BYTES,
        retentionCutoff: RETENTION_CUTOFF,
      }),
      0,
    );
  });

  it('prunes capacity across categories by recorded time and row id', () => {
    const harness = createHarness();
    const oldest = harness.record({
      recordedAt: '2026-07-01T00:00:00.000Z',
      resultBytes: 0,
      resultText: '',
      retainedBytes: 60 * 1_048_576,
      sourceBytes: 60 * 1_048_576,
      sourceText: '',
    });
    const newer = harness.record({
      actionType: 'prettify',
      recordedAt: '2026-07-01T00:00:00.000Z',
      resultBytes: 0,
      resultText: '',
      retainedBytes: 50 * 1_048_576,
      sourceBytes: 50 * 1_048_576,
      sourceText: '',
    });
    harness.seed(oldest);
    harness.seed(newer);

    const affected = harness.repository.prune({
      capacityBytes: PAYLOAD_CAP_BYTES,
      retentionCutoff: RETENTION_CUTOFF,
    });

    assert.equal(affected, 1);
    assert.deepEqual(harness.repository.readForArchive(['translation', 'prettify']), [newer]);
  });

  it('rolls back expiry and capacity deletes when insertion fails', () => {
    const harness = createHarness();
    const expired = harness.record({ recordedAt: '2026-05-01T00:00:00.000Z' });
    const capacity = harness.record({
      actionType: 'prettify',
      recordedAt: '2026-07-01T00:00:00.000Z',
      resultBytes: 0,
      resultText: '',
      retainedBytes: PAYLOAD_CAP_BYTES,
      sourceBytes: PAYLOAD_CAP_BYTES,
      sourceText: '',
    });
    harness.seed(expired);
    harness.seed(capacity);
    harness.coordinator.run((database) => {
      database.exec(`
        CREATE TRIGGER fail_diagnostic_insert
        BEFORE INSERT ON diagnostic_text_actions
        BEGIN
          SELECT RAISE(ABORT, 'private-trigger-canary');
        END;
      `);
    });

    assert.throws(
      () =>
        harness.repository.insert(harness.record(), {
          capacityBytes: PAYLOAD_CAP_BYTES,
          retentionCutoff: RETENTION_CUTOFF,
        }),
      (error: unknown) =>
        error instanceof RepositoryError &&
        error.code === REPOSITORY_ERROR_CODES.OperationFailed &&
        !error.message.includes('private-trigger-canary'),
    );
    assert.deepEqual(harness.repository.readForArchive(['translation', 'prettify']), [expired, capacity]);
  });

  it('purges requested categories without changing transcription history', () => {
    const harness = createHarness();
    const historyRepository = new SqliteTranscriptionHistoryRepository(harness.coordinator);
    const history = historyRepository.addEntry({
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      requestedAt: CURRENT_TIME,
      text: 'history must remain',
    });
    const translation = harness.record();
    const prettify = harness.record({ actionType: 'prettify' });
    harness.seed(translation);
    harness.seed(prettify);

    assert.equal(harness.repository.purge(['translation']), 1);
    assert.equal(harness.repository.purge(['translation']), 0);
    assert.deepEqual(harness.repository.readForArchive(['translation', 'prettify']), [prettify]);
    assert.equal(historyRepository.getEntryText(history.id), 'history must remain');
  });
});
