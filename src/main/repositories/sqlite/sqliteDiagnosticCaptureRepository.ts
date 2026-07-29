// eslint-disable-next-line n/no-unsupported-features/node-builtins -- SQLite is required by the project's Node 24 runtime.
import type { DatabaseSync } from 'node:sqlite';
import {
  type DiagnosticActionType,
  type DiagnosticCaptureProviderId,
  type DiagnosticCaptureRepository,
  type DiagnosticCapturePrunePolicy,
  type DiagnosticCaptureRecord,
  type DiagnosticCaptureRow,
  type DiagnosticSourceKind,
} from '../diagnosticCaptureRepository';
import { AbstractSqliteRepository, type SqliteDataSource } from './abstractSqliteRepository';

interface DiagnosticCaptureDatabaseRow {
  action_id: string;
  action_type: DiagnosticActionType;
  contract_version: string | null;
  provider_id: DiagnosticCaptureProviderId;
  provider_operation_id: string | null;
  recorded_at: string;
  redaction_count: number;
  redactor_version: number;
  result_bytes: number;
  result_text: string;
  retained_bytes: number;
  source_bytes: number;
  source_kind: DiagnosticSourceKind;
  source_text: string;
  target_language: string | null;
}

interface RetainedBytesRow {
  retained_bytes: number;
}

/** SQLite adapter for bounded diagnostic capture persistence. */
export class SqliteDiagnosticCaptureRepository extends AbstractSqliteRepository implements DiagnosticCaptureRepository {
  public constructor(dataSource: SqliteDataSource) {
    super(dataSource);
  }

  public insert(capture: DiagnosticCaptureRecord, policy: DiagnosticCapturePrunePolicy): void {
    this.executeImmediateTransaction((database) => {
      this.deleteExpired(database, policy.retentionCutoff);
      this.pruneCapacity(database, capture.retainedBytes, policy.capacityBytes);
      database
        .prepare(
          `
          INSERT INTO diagnostic_text_actions (
            action_id,
            provider_operation_id,
            action_type,
            source_kind,
            recorded_at,
            provider_id,
            contract_version,
            target_language,
            redactor_version,
            redaction_count,
            source_text,
            result_text,
            source_bytes,
            result_bytes,
            retained_bytes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          capture.actionId,
          capture.providerOperationId,
          capture.actionType,
          capture.sourceKind,
          capture.recordedAt,
          capture.providerId,
          capture.contractVersion,
          capture.targetLanguage,
          capture.redactorVersion,
          capture.redactionCount,
          capture.sourceText,
          capture.resultText,
          capture.sourceBytes,
          capture.resultBytes,
          capture.retainedBytes,
        );
    });
  }

  public prune(policy: DiagnosticCapturePrunePolicy): number {
    return this.executeImmediateTransaction((database) => {
      const expiredRows = this.deleteExpired(database, policy.retentionCutoff);
      return expiredRows + this.pruneCapacity(database, 0, policy.capacityBytes);
    });
  }

  public pruneAndPurge(policy: DiagnosticCapturePrunePolicy, categories: readonly DiagnosticActionType[]): number {
    return this.executeImmediateTransaction((database) => {
      const expiredRows = this.deleteExpired(database, policy.retentionCutoff);
      const capacityRows = this.pruneCapacity(database, 0, policy.capacityBytes);
      return expiredRows + capacityRows + this.purgeCategories(database, categories);
    });
  }

  public purge(categories: readonly DiagnosticActionType[]): number {
    if (categories.length === 0) return 0;
    return this.executeImmediateTransaction((database) => this.purgeCategories(database, categories));
  }

  public readForArchive(categories: readonly DiagnosticActionType[]): readonly DiagnosticCaptureRow[] {
    if (categories.length === 0) return [];
    return this.execute((database) => {
      const placeholders = categories.map(() => '?').join(', ');
      const rows = database
        .prepare(
          `
          SELECT
            action_id,
            provider_operation_id,
            action_type,
            source_kind,
            recorded_at,
            provider_id,
            contract_version,
            target_language,
            redactor_version,
            redaction_count,
            source_text,
            result_text,
            source_bytes,
            result_bytes,
            retained_bytes
          FROM diagnostic_text_actions
          WHERE action_type IN (${placeholders})
          ORDER BY recorded_at ASC, id ASC
        `,
        )
        .all(...categories) as unknown as DiagnosticCaptureDatabaseRow[];
      return rows.map((row) => this.mapRow(row));
    });
  }

  private deleteExpired(database: DatabaseSync, cutoff: string): number {
    const result = database.prepare('DELETE FROM diagnostic_text_actions WHERE recorded_at < ?').run(cutoff);
    return Number(result.changes);
  }

  private purgeCategories(database: DatabaseSync, categories: readonly DiagnosticActionType[]): number {
    if (categories.length === 0) return 0;
    const placeholders = categories.map(() => '?').join(', ');
    const result = database
      .prepare(`DELETE FROM diagnostic_text_actions WHERE action_type IN (${placeholders})`)
      .run(...categories);
    return Number(result.changes);
  }

  private pruneCapacity(database: DatabaseSync, nextRetainedBytes: number, payloadCapBytes: number): number {
    const retained = database
      .prepare('SELECT COALESCE(SUM(retained_bytes), 0) AS retained_bytes FROM diagnostic_text_actions')
      .get() as unknown as RetainedBytesRow;
    const requiredBytes = retained.retained_bytes + nextRetainedBytes - payloadCapBytes;
    if (requiredBytes <= 0) return 0;

    const result = database
      .prepare(
        `
        DELETE FROM diagnostic_text_actions
        WHERE id IN (
          SELECT id
          FROM (
            SELECT
              id,
              retained_bytes,
              SUM(retained_bytes) OVER (
                ORDER BY recorded_at ASC, id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS cumulative_bytes
            FROM diagnostic_text_actions
          )
          WHERE cumulative_bytes - retained_bytes < ?
        )
      `,
      )
      .run(requiredBytes);
    return Number(result.changes);
  }

  private mapRow(row: DiagnosticCaptureDatabaseRow): DiagnosticCaptureRow {
    return {
      actionId: row.action_id,
      actionType: row.action_type,
      contractVersion: row.contract_version,
      providerId: row.provider_id,
      providerOperationId: row.provider_operation_id,
      recordedAt: row.recorded_at,
      redactionCount: row.redaction_count,
      redactorVersion: row.redactor_version,
      resultBytes: row.result_bytes,
      resultText: row.result_text,
      retainedBytes: row.retained_bytes,
      sourceBytes: row.source_bytes,
      sourceKind: row.source_kind,
      sourceText: row.source_text,
      targetLanguage: row.target_language,
    };
  }
}
