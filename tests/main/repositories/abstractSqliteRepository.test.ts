/* eslint-disable max-classes-per-file -- the concrete test subclass and temporary-database harness share this suite. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Tests exercise the Node 24 SQLite implementation.
import type { DatabaseSync } from 'node:sqlite';
import { REPOSITORY_ERROR_CODES, RepositoryError } from '@main/repositories/repositoryErrors';
import { AppDatabaseCoordinator } from '@main/repositories/sqlite/appDatabase';
import { AppDatabaseTestDependencies } from './appDatabaseTestDependencies';
import { AbstractSqliteRepository, type SqliteDataSource } from '@main/repositories/sqlite/abstractSqliteRepository';

class TestSqliteRepository extends AbstractSqliteRepository {
  public constructor(dataSource: SqliteDataSource) {
    super(dataSource);
  }

  public executeOperation<Result>(operation: (database: DatabaseSync) => Result): Result {
    return this.execute(operation);
  }

  public transaction<Result>(operation: (database: DatabaseSync) => Result): Result {
    return this.executeImmediateTransaction(operation);
  }
}

class SqliteRepositoryHarness {
  public readonly databasePath: string;
  public readonly coordinator: AppDatabaseCoordinator;
  public readonly repository: TestSqliteRepository;
  public readonly temporaryDirectory: string;

  public constructor() {
    this.temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-sqlite-repository-'));
    this.databasePath = path.join(this.temporaryDirectory, 'test.sqlite3');
    this.coordinator = new AppDatabaseCoordinator(this.databasePath, new AppDatabaseTestDependencies());
    this.repository = new TestSqliteRepository(this.coordinator);
  }

  public close(): void {
    this.coordinator.close();
    fs.rmSync(this.temporaryDirectory, { force: true, recursive: true });
  }
}

const harnesses: SqliteRepositoryHarness[] = [];

afterEach(() => {
  for (const harness of harnesses) harness.close();
  harnesses.length = 0;
});

function createHarness(): SqliteRepositoryHarness {
  const harness = new SqliteRepositoryHarness();
  harnesses.push(harness);
  return harness;
}

describe('SQLite repository base', () => {
  it('delegates native connection work through the shared coordinator', () => {
    const { repository } = createHarness();

    repository.executeOperation((database) => {
      database
        .prepare(
          `
          INSERT INTO transcription_history (requested_at, provider_id, provider_name, text)
          VALUES (?, ?, ?, ?)
        `,
        )
        .run('2026-07-27T12:00:00.000Z', 'chatgpt', 'ChatGPT Web', 'stored');
    });
    const row = repository.executeOperation((database) =>
      database.prepare('SELECT text FROM transcription_history').get(),
    ) as { text: string };

    assert.equal(row.text, 'stored');
  });

  it('commits successful immediate transactions', () => {
    const { repository } = createHarness();

    const value = repository.transaction((database) => {
      database
        .prepare(
          `
          INSERT INTO transcription_history (requested_at, provider_id, provider_name, text)
          VALUES (?, ?, ?, ?)
        `,
        )
        .run('2026-07-27T12:00:00.000Z', 'chatgpt', 'ChatGPT Web', 'committed');
      return 'result';
    });

    assert.equal(value, 'result');
    const count = repository.executeOperation((database) =>
      database.prepare('SELECT COUNT(*) AS total FROM transcription_history').get(),
    ) as { total: number };
    assert.equal(count.total, 1);
  });

  it('rolls back failed transactions and normalizes the original error', () => {
    const { repository } = createHarness();
    const failure = new Error('transaction-canary');

    assert.throws(
      () =>
        repository.transaction((database) => {
          database
            .prepare(
              `
              INSERT INTO transcription_history (requested_at, provider_id, provider_name, text)
              VALUES (?, ?, ?, ?)
            `,
            )
            .run('2026-07-27T12:00:00.000Z', 'chatgpt', 'ChatGPT Web', 'rolled back');
          throw failure;
        }),
      (error: unknown) =>
        error instanceof RepositoryError &&
        error.code === REPOSITORY_ERROR_CODES.OperationFailed &&
        !error.message.includes(failure.message),
    );
    const count = repository.executeOperation((database) =>
      database.prepare('SELECT COUNT(*) AS total FROM transcription_history').get(),
    ) as { total: number };
    assert.equal(count.total, 0);
  });

  it('preserves an original safe repository failure when rollback also fails', () => {
    const safeFailure = new RepositoryError(REPOSITORY_ERROR_CODES.Unavailable);
    const database = {
      exec(statement: string): void {
        if (statement === 'ROLLBACK') throw new Error('rollback-private-canary');
      },
    } as unknown as DatabaseSync;
    const repository = new TestSqliteRepository({
      run: (operation) => operation(database),
    });

    assert.throws(
      () =>
        repository.transaction(() => {
          throw safeFailure;
        }),
      (error: unknown) => error === safeFailure,
    );
  });
});
