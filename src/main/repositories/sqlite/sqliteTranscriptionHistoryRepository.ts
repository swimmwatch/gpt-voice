import { REPOSITORY_ERROR_CODES, RepositoryError } from '../repositoryErrors';
import {
  normalizeTranscriptionHistoryQuery,
  type NewTranscriptionHistoryEntry,
  type TranscriptionHistoryRepository,
} from '../transcriptionHistoryRepository';
import { AbstractSqliteRepository, type SqliteDataSource } from './abstractSqliteRepository';
import type {
  TranscriptionHistoryEntry,
  TranscriptionHistoryPage,
  TranscriptionHistoryQuery,
} from '@shared/transcriptionHistory';

interface TranscriptionHistoryRow {
  id: number;
  provider_id: string;
  provider_name: string;
  requested_at: string;
  text: string;
}

interface CountRow {
  total: number;
}

interface TextRow {
  text: string;
}

/** SQLite adapter for the transcription-history repository port. */
export class SqliteTranscriptionHistoryRepository
  extends AbstractSqliteRepository
  implements TranscriptionHistoryRepository
{
  public constructor(dataSource: SqliteDataSource) {
    super(dataSource);
  }

  public addEntry(entry: NewTranscriptionHistoryEntry): TranscriptionHistoryEntry {
    return this.execute((database) => {
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

      if (!row) throw new RepositoryError(REPOSITORY_ERROR_CODES.OperationFailed);
      return this.mapRow(row);
    });
  }

  public listEntries(query: TranscriptionHistoryQuery = {}): TranscriptionHistoryPage {
    const { limit, offset } = normalizeTranscriptionHistoryQuery(query);
    return this.execute((database) => {
      const count = database
        .prepare('SELECT COUNT(*) AS total FROM transcription_history')
        .get() as unknown as CountRow;
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
      const items = rows.map((row) => this.mapRow(row));
      return {
        items,
        total: count.total,
        limit,
        offset,
        hasMore: offset + items.length < count.total,
      };
    });
  }

  public getEntryText(id: number): string | null {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return this.execute((database) => {
      const row = database.prepare('SELECT text FROM transcription_history WHERE id = ?').get(id) as
        TextRow | undefined;
      return row?.text ?? null;
    });
  }

  public clearEntries(): void {
    this.execute((database) => database.exec('DELETE FROM transcription_history'));
  }

  private mapRow(row: TranscriptionHistoryRow): TranscriptionHistoryEntry {
    return {
      id: row.id,
      requestedAt: row.requested_at,
      providerId: row.provider_id,
      providerName: row.provider_name,
      text: row.text,
    };
  }
}
