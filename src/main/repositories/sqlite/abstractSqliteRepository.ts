// eslint-disable-next-line n/no-unsupported-features/node-builtins -- SQLite is required by the project's Node 24 runtime.
import type { DatabaseSync } from 'node:sqlite';
import { normalizeRepositoryError } from '../repositoryErrors';

export const SQLITE_TRANSACTION_STATEMENTS = {
  BeginImmediate: 'BEGIN IMMEDIATE',
  Commit: 'COMMIT',
  Rollback: 'ROLLBACK',
} as const;

export interface SqliteDataSource {
  run<T>(operation: (database: DatabaseSync) => T): T;
}

/** Centralizes shared SQLite access and transaction invariants for concrete repositories. */
export abstract class AbstractSqliteRepository {
  protected constructor(private readonly dataSource: SqliteDataSource) {}

  protected execute<T>(operation: (database: DatabaseSync) => T): T {
    try {
      return this.dataSource.run(operation);
    } catch (error: unknown) {
      throw normalizeRepositoryError(error);
    }
  }

  protected executeImmediateTransaction<T>(operation: (database: DatabaseSync) => T): T {
    return this.execute((database) => {
      database.exec(SQLITE_TRANSACTION_STATEMENTS.BeginImmediate);
      try {
        const result = operation(database);
        database.exec(SQLITE_TRANSACTION_STATEMENTS.Commit);
        return result;
      } catch (error: unknown) {
        try {
          database.exec(SQLITE_TRANSACTION_STATEMENTS.Rollback);
        } catch {
          // Preserve the original failure; the repository boundary normalizes it.
        }
        throw error;
      }
    });
  }
}
