import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Tests exercise the Node 24 SQLite storage implementation.
import { DatabaseSync } from 'node:sqlite';
import {
  TranscriptionHistoryStore,
  normalizeTranscriptionHistoryQuery,
} from '@main/services/transcriptionHistoryStorage';
import { TRANSCRIPTION_HISTORY_DEFAULT_LIMIT, TRANSCRIPTION_HISTORY_MAX_LIMIT } from '@shared/transcriptionHistory';

let tempDirs: string[] = [];

function createTestStore(): { store: TranscriptionHistoryStore; databasePath: string; tempDir: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-history-'));
  tempDirs.push(tempDir);
  return {
    tempDir,
    databasePath: path.join(tempDir, 'history.sqlite3'),
    store: new TranscriptionHistoryStore(path.join(tempDir, 'history.sqlite3')),
  };
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('transcription history storage', () => {
  it('normalizes limit and offset values', () => {
    assert.deepEqual(normalizeTranscriptionHistoryQuery(), {
      limit: TRANSCRIPTION_HISTORY_DEFAULT_LIMIT,
      offset: 0,
    });
    assert.deepEqual(normalizeTranscriptionHistoryQuery({ limit: -1, offset: -10 }), { limit: 1, offset: 0 });
    assert.deepEqual(normalizeTranscriptionHistoryQuery({ limit: 500, offset: 2.9 }), {
      limit: TRANSCRIPTION_HISTORY_MAX_LIMIT,
      offset: 2,
    });
  });

  it('runs migrations and creates future-ready schema tables', () => {
    const { store, databasePath } = createTestStore();
    store.listEntries();
    store.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const indexes = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'transcription_history'")
        .all() as Array<{ name: string }>;
      const migration = database.prepare('SELECT version FROM schema_migrations WHERE version = 1').get() as
        { version: number } | undefined;

      assert.deepEqual(
        tables.map((row) => row.name),
        ['schema_migrations', 'sqlite_sequence', 'transcription_history'],
      );
      assert.equal(
        indexes.some((row) => row.name === 'idx_transcription_history_requested_at_id'),
        true,
      );
      assert.equal(migration?.version, 1);
    } finally {
      database.close();
    }
  });

  it('inserts and reads a successful transcription entry', () => {
    const { store } = createTestStore();

    const saved = store.addEntry({
      requestedAt: '2026-07-08T10:00:00.000Z',
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      text: 'recognized text',
    });
    const page = store.listEntries();

    assert.equal(saved.id > 0, true);
    assert.deepEqual(page, {
      items: [saved],
      total: 1,
      limit: TRANSCRIPTION_HISTORY_DEFAULT_LIMIT,
      offset: 0,
      hasMore: false,
    });
    store.close();
  });

  it('lists entries newest-first with limit and offset pagination', () => {
    const { store } = createTestStore();

    const oldest = store.addEntry({
      requestedAt: '2026-07-08T09:00:00.000Z',
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      text: 'oldest',
    });
    const newest = store.addEntry({
      requestedAt: '2026-07-08T11:00:00.000Z',
      providerId: 'openai-api',
      providerName: 'OpenAI API',
      text: 'newest',
    });
    const sameTimestampFirst = store.addEntry({
      requestedAt: '2026-07-08T10:00:00.000Z',
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      text: 'same timestamp first',
    });
    const sameTimestampSecond = store.addEntry({
      requestedAt: '2026-07-08T10:00:00.000Z',
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      text: 'same timestamp second',
    });

    const firstPage = store.listEntries({ limit: 2, offset: 0 });
    const secondPage = store.listEntries({ limit: 2, offset: 2 });

    assert.deepEqual(
      firstPage.items.map((entry) => entry.id),
      [newest.id, sameTimestampSecond.id],
    );
    assert.equal(firstPage.total, 4);
    assert.equal(firstPage.hasMore, true);
    assert.deepEqual(
      secondPage.items.map((entry) => entry.id),
      [sameTimestampFirst.id, oldest.id],
    );
    assert.equal(secondPage.total, 4);
    assert.equal(secondPage.hasMore, false);
    store.close();
  });

  it('clears entries and returns null for missing copy lookups', () => {
    const { store } = createTestStore();
    const saved = store.addEntry({
      requestedAt: '2026-07-08T10:00:00.000Z',
      providerId: 'chatgpt',
      providerName: 'ChatGPT Web',
      text: 'copy me',
    });

    assert.equal(store.getEntryText(saved.id), 'copy me');
    assert.equal(store.getEntryText(999), null);
    assert.equal(store.getEntryText(-1), null);

    store.clearEntries();

    assert.deepEqual(store.listEntries().items, []);
    assert.equal(store.getEntryText(saved.id), null);
    store.close();
  });
});
