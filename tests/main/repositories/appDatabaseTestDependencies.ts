import * as fs from 'node:fs';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- SQLite is required by the project's Node 24 test runtime.
import { DatabaseSync } from 'node:sqlite';
import { APP_DATABASE_TIMEOUT_MS, type AppDatabaseDependencies } from '@main/repositories/sqlite/appDatabase';

/** Owns one explicit real-SQLite dependency set for repository integration tests. */
export class AppDatabaseTestDependencies implements AppDatabaseDependencies {
  public readonly closeDatabase: AppDatabaseDependencies['closeDatabase'];
  public readonly createDatabase: AppDatabaseDependencies['createDatabase'];
  public readonly fileExists: AppDatabaseDependencies['fileExists'];
  public readonly now: AppDatabaseDependencies['now'];
  public readonly platform: AppDatabaseDependencies['platform'];
  public readonly setFileMode: AppDatabaseDependencies['setFileMode'];

  public constructor(overrides: Partial<AppDatabaseDependencies> = {}) {
    this.closeDatabase = overrides.closeDatabase ?? ((database) => database.close());
    this.createDatabase =
      overrides.createDatabase ??
      ((databasePath) => new DatabaseSync(databasePath, { timeout: APP_DATABASE_TIMEOUT_MS }));
    this.fileExists = overrides.fileExists ?? fs.existsSync;
    this.now = overrides.now ?? (() => new Date('2026-07-27T12:00:00.000Z'));
    this.platform = overrides.platform ?? process.platform;
    this.setFileMode = overrides.setFileMode ?? fs.chmodSync;
  }
}
