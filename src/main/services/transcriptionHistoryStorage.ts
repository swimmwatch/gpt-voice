import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { APP_DIR } from '../config';
import { createLogger } from '../logger';
import {
  TRANSCRIPTION_HISTORY_DEFAULT_LIMIT,
  TRANSCRIPTION_HISTORY_MAX_LIMIT,
  type TranscriptionHistoryEntry,
  type TranscriptionHistoryPage,
  type TranscriptionHistoryQuery,
} from '@shared/transcriptionHistory';

const log = createLogger('transcription-history');
const CURRENT_SCHEMA_VERSION = 1;
export const APP_DATABASE_FILE = path.join(APP_DIR, 'gpt-voice.sqlite3');

interface NewTranscriptionHistoryEntry {
  requestedAt: string;
  providerId: string;
  providerName: string;
  text: string;
}

interface TranscriptionHistoryRow {
  id: number;
  requested_at: string;
  provider_id: string;
  provider_name: string;
  text: string;
}

interface CountRow {
  total: number;
}

interface TextRow {
  text: string;
}

interface Pagination {
  limit: number;
  offset: number;
}

function normalizeInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.trunc(value);
}

export function normalizeTranscriptionHistoryQuery(query: TranscriptionHistoryQuery = {}): Pagination {
  const requestedLimit = normalizeInteger(query.limit, TRANSCRIPTION_HISTORY_DEFAULT_LIMIT);
  const requestedOffset = normalizeInteger(query.offset, 0);
  return {
    limit: Math.min(TRANSCRIPTION_HISTORY_MAX_LIMIT, Math.max(1, requestedLimit)),
    offset: Math.max(0, requestedOffset),
  };
}

function mapHistoryRow(row: TranscriptionHistoryRow): TranscriptionHistoryEntry {
  return {
    id: row.id,
    requestedAt: row.requested_at,
    providerId: row.provider_id,
    providerName: row.provider_name,
    text: row.text,
  };
}

export class TranscriptionHistoryStore {
  private database: DatabaseSync | null = null;

  constructor(private readonly databasePath: string = APP_DATABASE_FILE) {}

  addEntry(entry: NewTranscriptionHistoryEntry): TranscriptionHistoryEntry {
    const database = this.getDatabase();
    const result = database
      .prepare(
        `
        INSERT INTO transcription_history (requested_at, provider_id, provider_name, text)
        VALUES (?, ?, ?, ?)
      `,
      )
      .run(entry.requestedAt, entry.providerId, entry.providerName, entry.text);
    const row = database
      .prepare(
        `
        SELECT id, requested_at, provider_id, provider_name, text
        FROM transcription_history
        WHERE id = ?
      `,
      )
      .get(Number(result.lastInsertRowid)) as TranscriptionHistoryRow | undefined;

    if (!row) {
      throw new Error('Saved transcription history entry could not be read back');
    }
    return mapHistoryRow(row);
  }

  listEntries(query: TranscriptionHistoryQuery = {}): TranscriptionHistoryPage {
    const database = this.getDatabase();
    const { limit, offset } = normalizeTranscriptionHistoryQuery(query);
    const count = database.prepare('SELECT COUNT(*) AS total FROM transcription_history').get() as unknown as CountRow;
    const rows = database
      .prepare(
        `
        SELECT id, requested_at, provider_id, provider_name, text
        FROM transcription_history
        ORDER BY requested_at DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      )
      .all(limit, offset) as unknown as TranscriptionHistoryRow[];
    const items = rows.map(mapHistoryRow);

    return {
      items,
      total: count.total,
      limit,
      offset,
      hasMore: offset + items.length < count.total,
    };
  }

  getEntryText(id: number): string | null {
    if (!Number.isSafeInteger(id) || id <= 0) {
      return null;
    }
    const row = this.getDatabase().prepare('SELECT text FROM transcription_history WHERE id = ?').get(id) as
      TextRow | undefined;
    return row?.text ?? null;
  }

  clearEntries(): void {
    this.getDatabase().exec('DELETE FROM transcription_history');
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  private getDatabase(): DatabaseSync {
    if (!this.database) {
      this.database = new DatabaseSync(this.databasePath, { timeout: 5000 });
      this.database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      this.runMigrations(this.database);
    }
    return this.database;
  }

  private runMigrations(database: DatabaseSync): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);

    const migration = database
      .prepare('SELECT version FROM schema_migrations WHERE version = ?')
      .get(CURRENT_SCHEMA_VERSION);
    if (migration) {
      return;
    }

    database.exec(`
      CREATE TABLE IF NOT EXISTS transcription_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requested_at TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        text TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_transcription_history_requested_at_id
      ON transcription_history(requested_at DESC, id DESC);

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (${CURRENT_SCHEMA_VERSION}, datetime('now'));
    `);
    log.info('Transcription history database migrated:', { version: CURRENT_SCHEMA_VERSION });
  }
}

let store: TranscriptionHistoryStore | null = null;

function getStore(): TranscriptionHistoryStore {
  if (!store) {
    store = new TranscriptionHistoryStore();
  }
  return store;
}

export function addTranscriptionHistoryEntry(entry: NewTranscriptionHistoryEntry): TranscriptionHistoryEntry {
  return getStore().addEntry(entry);
}

export function getTranscriptionHistoryPage(query: TranscriptionHistoryQuery = {}): TranscriptionHistoryPage {
  return getStore().listEntries(query);
}

export function getTranscriptionHistoryText(id: number): string | null {
  return getStore().getEntryText(id);
}

export function clearTranscriptionHistory(): void {
  getStore().clearEntries();
}

export function closeTranscriptionHistoryStore(): void {
  store?.close();
  store = null;
}
