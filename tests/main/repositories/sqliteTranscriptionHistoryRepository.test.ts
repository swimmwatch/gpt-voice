import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { AppDatabaseCoordinator } from '@main/repositories/sqlite/appDatabase';
import { SqliteTranscriptionHistoryRepository } from '@main/repositories/sqlite/sqliteTranscriptionHistoryRepository';
import { registerTranscriptionHistoryRepositoryContract } from './contracts/transcriptionHistoryRepositoryContract';

class TranscriptionHistoryRepositoryHarness {
  public readonly coordinator: AppDatabaseCoordinator;
  public readonly repository: SqliteTranscriptionHistoryRepository;
  public readonly temporaryDirectory: string;

  public constructor() {
    this.temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-history-repository-'));
    this.coordinator = new AppDatabaseCoordinator(path.join(this.temporaryDirectory, 'history.sqlite3'));
    this.repository = new SqliteTranscriptionHistoryRepository(this.coordinator);
  }

  public close(): void {
    this.coordinator.close();
    fs.rmSync(this.temporaryDirectory, { force: true, recursive: true });
  }
}

const harnesses: TranscriptionHistoryRepositoryHarness[] = [];

afterEach(() => {
  for (const harness of harnesses) harness.close();
  harnesses.length = 0;
});

function createHarness(): TranscriptionHistoryRepositoryHarness {
  const harness = new TranscriptionHistoryRepositoryHarness();
  harnesses.push(harness);
  return harness;
}

registerTranscriptionHistoryRepositoryContract(() => {
  const harness = new TranscriptionHistoryRepositoryHarness();
  return {
    dispose: () => harness.close(),
    repository: harness.repository,
  };
});

describe('SQLite transcription history repository', () => {
  it('inserts, reads, orders, and paginates entries', () => {
    const { repository } = createHarness();
    const oldest = repository.addEntry({
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      requestedAt: '2026-07-08T09:00:00.000Z',
      text: 'oldest',
    });
    const sameTimestampFirst = repository.addEntry({
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      requestedAt: '2026-07-08T10:00:00.000Z',
      text: 'same timestamp first',
    });
    const sameTimestampSecond = repository.addEntry({
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      requestedAt: '2026-07-08T10:00:00.000Z',
      text: 'same timestamp second',
    });
    const newest = repository.addEntry({
      providerId: 'openai-api',
      providerName: 'OpenAI API',
      requestedAt: '2026-07-08T11:00:00.000Z',
      text: 'newest',
    });

    const firstPage = repository.listEntries({ limit: 2, offset: 0 });
    const secondPage = repository.listEntries({ limit: 2, offset: 2 });

    assert.deepEqual(
      firstPage.items.map((entry) => entry.id),
      [newest.id, sameTimestampSecond.id],
    );
    assert.deepEqual(
      secondPage.items.map((entry) => entry.id),
      [sameTimestampFirst.id, oldest.id],
    );
    assert.equal(firstPage.total, 4);
    assert.equal(firstPage.hasMore, true);
    assert.equal(secondPage.hasMore, false);
    assert.equal(repository.getEntryText(newest.id), 'newest');
    assert.equal(repository.getEntryText(999), null);
  });

  it('clears only transcription history', () => {
    const { coordinator, repository } = createHarness();
    repository.addEntry({
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      requestedAt: '2026-07-08T09:00:00.000Z',
      text: 'clear me',
    });
    coordinator.run((database) => {
      database
        .prepare(
          `
          INSERT INTO diagnostic_text_actions (
            action_id, provider_operation_id, action_type, source_kind,
            recorded_at, provider_id, contract_version, target_language,
            redactor_version, redaction_count, source_text, result_text,
            source_bytes, result_bytes, retained_bytes
          )
          VALUES (?, NULL, 'translation', 'provider', ?, 'google', NULL, NULL, 1, 0, '', '', 0, 0, 0)
        `,
        )
        .run('00000000-0000-4000-8000-000000000001', '2026-07-08T09:00:00.000Z');
    });

    repository.clearEntries();

    assert.equal(repository.listEntries({ limit: 10, offset: 0 }).total, 0);
    const diagnostics = coordinator.run(
      (database) =>
        database.prepare('SELECT COUNT(*) AS total FROM diagnostic_text_actions').get() as {
          total: number;
        },
    );
    assert.equal(diagnostics.total, 1);
  });
});
