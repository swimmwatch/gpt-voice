import * as fs from 'node:fs';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- SQLite is required by the project's Node 24 runtime.
import { DatabaseSync } from 'node:sqlite';
import { REPOSITORY_ERROR_CODES, RepositoryError } from '../repositoryErrors';
import type { SqliteDataSource } from './abstractSqliteRepository';

export const APP_DATABASE_TIMEOUT_MS = 5_000;
export const APP_DATABASE_FILE_MODE = 0o600;
export const APP_DATABASE_SCHEMA_VERSION = 2;

const APP_DATABASE_SIDECAR_SUFFIXES = ['', '-wal', '-shm'] as const;

interface AppDatabaseMigration {
  readonly version: number;
  apply(database: DatabaseSync): void;
}

export interface AppDatabaseDependencies {
  readonly closeDatabase: (database: DatabaseSync) => void;
  readonly createDatabase: (databasePath: string) => DatabaseSync;
  readonly fileExists: (filePath: string) => boolean;
  readonly now: () => Date;
  readonly platform: NodeJS.Platform;
  readonly setFileMode: (filePath: string, mode: number) => void;
}

const DEFAULT_DEPENDENCIES: AppDatabaseDependencies = {
  closeDatabase: (database) => database.close(),
  createDatabase: (databasePath) => new DatabaseSync(databasePath, { timeout: APP_DATABASE_TIMEOUT_MS }),
  fileExists: fs.existsSync,
  now: () => new Date(),
  platform: process.platform,
  setFileMode: fs.chmodSync,
};

const APP_DATABASE_MIGRATIONS: readonly AppDatabaseMigration[] = [
  {
    version: 1,
    apply(database): void {
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
      `);
    },
  },
  {
    version: 2,
    apply(database): void {
      database.exec(`
        CREATE TABLE IF NOT EXISTS diagnostic_text_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_id TEXT NOT NULL,
          provider_operation_id TEXT,
          action_type TEXT NOT NULL CHECK (action_type IN ('translation', 'prettify')),
          source_kind TEXT NOT NULL CHECK (source_kind IN ('provider', 'cache')),
          recorded_at TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          contract_version TEXT,
          target_language TEXT,
          redactor_version INTEGER NOT NULL,
          redaction_count INTEGER NOT NULL CHECK (redaction_count >= 0),
          source_text TEXT NOT NULL,
          result_text TEXT NOT NULL,
          source_bytes INTEGER NOT NULL CHECK (source_bytes >= 0),
          result_bytes INTEGER NOT NULL CHECK (result_bytes >= 0),
          retained_bytes INTEGER NOT NULL CHECK (
            retained_bytes >= 0
            AND retained_bytes = source_bytes + result_bytes
          )
        ) STRICT;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_diagnostic_text_actions_action_id
        ON diagnostic_text_actions(action_id);

        CREATE INDEX IF NOT EXISTS idx_diagnostic_text_actions_action_type_recorded_at_id
        ON diagnostic_text_actions(action_type, recorded_at, id);
      `);
    },
  },
] as const;

/** Owns the single application SQLite connection, migrations, permissions, and close lifecycle. */
export class AppDatabaseCoordinator implements SqliteDataSource {
  private readonly dependencies: AppDatabaseDependencies;
  private database: DatabaseSync | null = null;
  private closeStarted = false;

  public constructor(
    private readonly databasePath: string,
    dependencies: Partial<AppDatabaseDependencies> = {},
  ) {
    this.dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  }

  public run<T>(operation: (database: DatabaseSync) => T): T {
    const database = this.getDatabase();
    try {
      const result = operation(database);
      this.ensurePermissions();
      return result;
    } catch (error: unknown) {
      try {
        this.ensurePermissions();
      } catch {
        throw new RepositoryError(REPOSITORY_ERROR_CODES.Unavailable);
      }
      throw error;
    }
  }

  public close(): void {
    if (this.closeStarted) return;
    this.closeStarted = true;

    const database = this.database;
    this.database = null;
    if (!database) return;

    let closeFailed = false;
    try {
      this.ensurePermissions();
    } catch {
      closeFailed = true;
    }
    try {
      this.dependencies.closeDatabase(database);
    } catch {
      closeFailed = true;
    }
    if (closeFailed) throw new RepositoryError(REPOSITORY_ERROR_CODES.Unavailable);
  }

  private getDatabase(): DatabaseSync {
    if (this.closeStarted) throw new RepositoryError(REPOSITORY_ERROR_CODES.Unavailable);
    if (this.database) return this.database;

    let database: DatabaseSync | null = null;
    try {
      database = this.dependencies.createDatabase(this.databasePath);
      database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      this.runMigrations(database);
      this.database = database;
      this.ensurePermissions();
      return database;
    } catch {
      try {
        if (database) this.dependencies.closeDatabase(database);
      } catch {
        // The safe unavailable marker intentionally omits paths and raw failures.
      }
      this.database = null;
      throw new RepositoryError(REPOSITORY_ERROR_CODES.Unavailable);
    }
  }

  private runMigrations(database: DatabaseSync): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);

    for (const migration of APP_DATABASE_MIGRATIONS) {
      const applied = database
        .prepare('SELECT version FROM schema_migrations WHERE version = ?')
        .get(migration.version);
      if (applied) continue;

      database.exec('BEGIN IMMEDIATE');
      try {
        migration.apply(database);
        database
          .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .run(migration.version, this.getMigrationTimestamp());
        database.exec('COMMIT');
      } catch (error: unknown) {
        try {
          database.exec('ROLLBACK');
        } catch {
          // Preserve the original migration failure without exposing either error.
        }
        throw error;
      }
    }
  }

  private getMigrationTimestamp(): string {
    const timestamp = this.dependencies.now();
    if (!(timestamp instanceof Date) || !Number.isFinite(timestamp.getTime())) {
      throw new RepositoryError(REPOSITORY_ERROR_CODES.Unavailable);
    }
    return timestamp.toISOString();
  }

  private ensurePermissions(): void {
    if (this.dependencies.platform === 'win32') return;
    for (const suffix of APP_DATABASE_SIDECAR_SUFFIXES) {
      const filePath = `${this.databasePath}${suffix}`;
      if (this.dependencies.fileExists(filePath)) {
        this.dependencies.setFileMode(filePath, APP_DATABASE_FILE_MODE);
      }
    }
  }
}
