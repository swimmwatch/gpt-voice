import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Tests exercise the Node 24 SQLite implementation.
import { DatabaseSync } from 'node:sqlite';
import { REPOSITORY_ERROR_CODES, RepositoryError } from '@main/repositories/repositoryErrors';
import {
  APP_DATABASE_FILE_MODE,
  APP_DATABASE_SCHEMA_VERSION,
  APP_DATABASE_TIMEOUT_MS,
  AppDatabaseCoordinator,
} from '@main/repositories/sqlite/appDatabase';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
  temporaryDirectories.length = 0;
});

function createDatabasePath(prefix = 'gpt-voice-app-database-'): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return path.join(directory, 'test.sqlite3');
}

describe('application SQLite coordinator', () => {
  it('applies ordered migrations and configures the shared connection', () => {
    const databasePath = createDatabasePath();
    const coordinator = new AppDatabaseCoordinator(databasePath, { now: () => new Date('2026-07-27T12:00:00Z') });

    const state = coordinator.run((database) => {
      const migrations = database.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
        version: number;
      }>;
      const journalMode = database.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      const foreignKeys = database.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
      const diagnosticTable = database
        .prepare("SELECT strict FROM pragma_table_list WHERE name = 'diagnostic_text_actions'")
        .get() as { strict: number } | undefined;
      const diagnosticIndexes = database
        .prepare(
          `
          SELECT name
          FROM sqlite_schema
          WHERE type = 'index' AND tbl_name = 'diagnostic_text_actions'
          ORDER BY name
        `,
        )
        .all() as Array<{ name: string }>;
      return { diagnosticIndexes, diagnosticTable, foreignKeys, journalMode, migrations };
    });
    coordinator.close();

    assert.deepEqual(
      state.migrations.map((migration) => migration.version),
      [1, APP_DATABASE_SCHEMA_VERSION],
    );
    assert.equal(state.journalMode.journal_mode, 'wal');
    assert.equal(state.foreignKeys.foreign_keys, 1);
    assert.equal(state.diagnosticTable?.strict, 1);
    assert.deepEqual(
      state.diagnosticIndexes.map((index) => index.name),
      ['idx_diagnostic_text_actions_action_id', 'idx_diagnostic_text_actions_action_type_recorded_at_id'],
    );
    assert.equal(APP_DATABASE_TIMEOUT_MS, 5_000);
  });

  it('migrates a version-1 fixture without changing transcription history', () => {
    const databasePath = createDatabasePath();
    const fixture = new DatabaseSync(databasePath);
    fixture.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE transcription_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requested_at TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        text TEXT NOT NULL
      ) STRICT;
      INSERT INTO schema_migrations (version, applied_at)
      VALUES (1, '2026-07-01T00:00:00.000Z');
      INSERT INTO transcription_history (requested_at, provider_id, provider_name, text)
      VALUES ('2026-07-08T10:00:00.000Z', 'chatgpt', 'ChatGPT Web', 'preserved history text');
    `);
    fixture.close();

    const coordinator = new AppDatabaseCoordinator(databasePath);
    const state = coordinator.run((database) => ({
      history: database.prepare('SELECT text FROM transcription_history').get() as { text: string },
      migrations: database.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
        version: number;
      }>,
    }));
    coordinator.close();

    assert.equal(state.history.text, 'preserved history text');
    assert.deepEqual(
      state.migrations.map((migration) => migration.version),
      [1, 2],
    );
  });

  it('does not record version 2 or change history when migration 2 fails', () => {
    const databasePath = createDatabasePath();
    const fixture = new DatabaseSync(databasePath);
    fixture.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE transcription_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requested_at TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        text TEXT NOT NULL
      ) STRICT;
      INSERT INTO schema_migrations (version, applied_at)
      VALUES (1, '2026-07-01T00:00:00.000Z');
      INSERT INTO transcription_history (requested_at, provider_id, provider_name, text)
      VALUES ('2026-07-08T10:00:00.000Z', 'chatgpt', 'ChatGPT Web', 'still readable');
      CREATE TABLE diagnostic_text_actions (wrong_column TEXT) STRICT;
    `);
    fixture.close();

    const coordinator = new AppDatabaseCoordinator(databasePath);
    assert.throws(
      () => coordinator.run(() => undefined),
      (error: unknown) => error instanceof RepositoryError && error.code === REPOSITORY_ERROR_CODES.Unavailable,
    );

    const readable = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const history = readable.prepare('SELECT text FROM transcription_history').get() as { text: string };
      const migrations = readable.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
        version: number;
      }>;
      assert.equal(history.text, 'still readable');
      assert.deepEqual(
        migrations.map((migration) => migration.version),
        [1],
      );
    } finally {
      readable.close();
    }
  });

  it('enforces POSIX database and sidecar mode 0600', (context) => {
    if (process.platform === 'win32') {
      context.skip('POSIX file modes are unavailable on Windows');
      return;
    }
    const databasePath = createDatabasePath();
    const coordinator = new AppDatabaseCoordinator(databasePath);

    coordinator.run((database) => database.prepare('SELECT 1').get());

    for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
      assert.equal(fs.existsSync(filePath), true);
      assert.equal(fs.statSync(filePath).mode & 0o777, APP_DATABASE_FILE_MODE);
    }
    coordinator.close();
  });

  it('does not broaden permissions on Windows and closes exactly once', () => {
    const databasePath = createDatabasePath();
    const changedPaths: string[] = [];
    let closeCount = 0;
    let createCount = 0;
    const coordinator = new AppDatabaseCoordinator(databasePath, {
      closeDatabase(database): void {
        closeCount += 1;
        database.close();
      },
      createDatabase(filePath): DatabaseSync {
        createCount += 1;
        return new DatabaseSync(filePath, { timeout: APP_DATABASE_TIMEOUT_MS });
      },
      platform: 'win32',
      setFileMode(filePath): void {
        changedPaths.push(filePath);
      },
    });

    coordinator.run((database) => database.prepare('SELECT 1').get());
    coordinator.run((database) => database.prepare('SELECT 2').get());
    coordinator.close();
    coordinator.close();

    assert.deepEqual(changedPaths, []);
    assert.equal(createCount, 1);
    assert.equal(closeCount, 1);
    assert.throws(
      () => coordinator.run(() => undefined),
      (error: unknown) => error instanceof RepositoryError && error.code === REPOSITORY_ERROR_CODES.Unavailable,
    );
  });

  it('hides permission paths behind the safe unavailable marker', () => {
    const databasePath = createDatabasePath('gpt-voice-private-database-');
    const coordinator = new AppDatabaseCoordinator(databasePath, {
      fileExists: () => true,
      platform: 'linux',
      setFileMode(): never {
        throw new Error(`permission failed for ${databasePath}`);
      },
    });

    assert.throws(
      () => coordinator.run(() => undefined),
      (error: unknown) =>
        error instanceof RepositoryError &&
        error.code === REPOSITORY_ERROR_CODES.Unavailable &&
        !error.message.includes(databasePath),
    );
  });
});
