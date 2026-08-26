# SQLite Persistence Layer Review

**Date:** 2026-08-08
**Branch:** `feat/local-whisper-provider`
**Reviewer focus:** Security (SQL construction, identifier interpolation, DB file path/permissions), correctness (migrations, transactions, constraint/corruption/busy handling, concurrent access), performance (indexes, N+1, synchronous main-process calls, statement caching), memory/resource (handle lifecycle, close on quit).
**Method:** Full read of every file in `src/main/repositories/**` (668 LOC), plus targeted grep-and-read of the wiring/lifecycle call sites (`mainProcessCompositionRoot.ts`, `mainProcessRuntimeGraph.ts`, `mainProcessApplication.ts`, `main.ts`, `config.ts`). No code was modified.

**Status: PARTIAL — interrupted mid-review; coverage limited to the files listed in Scope.** All in-scope repository sources were read in full; the consumer-side and test-side verification was cut short. See "Unreviewed / to resume".

---

## Verdict

**The layer is fundamentally sound and notably better than average.** There is **no SQL injection exposure** — every value is bound via `?` placeholders, and the only interpolated fragment is a placeholder *count* (`categories.map(() => '?')`), never a caller-supplied string. There is no identifier (table/column) interpolation anywhere. Migrations are versioned, transactional, and idempotent. Errors are normalized to a content-free `RepositoryError` so raw SQLite messages (which embed table/column names) never escape the boundary.

The findings below are all **Medium and lower**, and cluster in three places: a file-permission TOCTOU window on the DB and its WAL sidecars, an absent recovery/backoff path when the database is corrupt or busy (which blocks the Electron main process synchronously), and O(n) full-table scans on the diagnostic-capture insert path. No Critical or High issues were found.

---

## Scope

Files read in full:

- `src/main/repositories/repositoryErrors.ts` (18 LOC)
- `src/main/repositories/transcriptionHistoryRepository.ts` (42 LOC)
- `src/main/repositories/diagnosticCaptureRepository.ts` (42 LOC)
- `src/main/repositories/sqlite/abstractSqliteRepository.ts` (44 LOC)
- `src/main/repositories/sqlite/appDatabase.ts` (203 LOC)
- `src/main/repositories/sqlite/sqliteDiagnosticCaptureRepository.ts` (206 LOC)
- `src/main/repositories/sqlite/sqliteTranscriptionHistoryRepository.ts` (113 LOC)

Call sites read (partially, for lifecycle only):

- `src/main/di/mainProcessCompositionRoot.ts` (lines ~380–420, ~820–845)
- `src/main/di/mainProcessRuntimeGraph.ts` (close path)
- `src/main/mainProcessApplication.ts` (shutdown sequence, lines ~295–335)
- `src/main/main.ts` (`databaseDependencies` construction, lines ~270–300)
- `src/main/config.ts` (`resolveAppConfigPaths`, `databaseFile`)

Out of scope by instruction: `src/main/localWhisper/catalog/LocalWhisperCatalogRepository.ts`. **Confirmed it does not touch this layer** — a repo-wide grep for `node:sqlite`/`DatabaseSync` outside `repositories/sqlite/` matched only `src/main/main.ts`. Nothing new to add there.

### Lifecycle summary (as established)

One `AppDatabaseCoordinator` is constructed per application graph in `mainProcessCompositionRoot.ts:408`, wrapping `configStore.paths.databaseFile` (`<appDir>/gpt-voice.sqlite3`, `config.ts:44,159`). Both `SqliteTranscriptionHistoryRepository` (`:409`) and `SqliteDiagnosticCaptureRepository` (`:410`) share that single coordinator, i.e. a **single `DatabaseSync` connection for the whole process**. The connection is opened **lazily** on first `run()`, not at startup. Close is driven from `mainProcessApplication.ts:326` → `mainProcessRuntimeGraph.ts:55` (`closeDatabase`, guarded by `databaseClosed`) → `AppDatabaseCoordinator.close()` (guarded by `closeStarted`), inside a `try/catch` that downgrades failure to a warning. Consumers: `services/transcriptionCompletion.ts:100` (`addEntry`, per transcription), `services/transcriptionHistoryIpcController.ts` (renderer-driven list/read/clear), `services/diagnosticCaptureStorage.ts:224,237,253,272,286,300,305` (insert/prune/purge/archive).

---

## Findings

### 1. DB and WAL sidecar files are created world-readable, then chmodded — TOCTOU window on sensitive text — Medium — VERIFIED

**File:** `src/main/repositories/sqlite/appDatabase.ts:137-141`, `:194-202`; `src/main/main.ts:282`

**Mechanism.** `createDatabase` (`main.ts:282`) does `new DatabaseSync(databasePath, …)`, which creates the file with SQLite's default mode masked by the process umask — typically `0644` on Linux/macOS. Only afterwards does `ensurePermissions()` (`appDatabase.ts:194`) chmod it to `APP_DATABASE_FILE_MODE = 0o600`. The same applies, with a wider window, to the `-wal` and `-shm` sidecars: SQLite creates them itself during write transactions, and `ensurePermissions()` only runs *after* `operation` returns (`:97`) — so for the entire duration of a write, freshly created `-wal` content sits at the umask default.

**Failure scenario.** On a multi-user Linux box (or a macOS machine with a second local account), an unprivileged local user polls `~/.config/<app>/gpt-voice.sqlite3-wal`, opens it during any write, and retains the file descriptor. Unix permissions are checked at `open(2)`, not per-read, so the later chmod does not revoke the handle. The attacker then reads transcription text and diagnostic capture payloads (`source_text`, `result_text`) — the very data this 0600 policy exists to protect.

**Suggested fix.** Set the process umask (or better, pre-create the DB file with `fs.openSync(path, 'wx', 0o600)` before handing the path to `DatabaseSync`), and create the app directory itself at `0o700` so the sidecars are unreachable regardless of their own mode. Directory-level containment is the only fix that closes the `-wal`/`-shm` window, since those files are created by SQLite outside this code's control.

**Note.** `ensurePermissions()` returns early on `win32` (`:195`) with no ACL equivalent. That is a defensible tradeoff, but it means the 0600 guarantee is Unix-only and undocumented as such.

---

### 2. No recovery or backoff when the database is corrupt — every operation re-opens and re-fails — Medium — VERIFIED

**File:** `src/main/repositories/sqlite/appDatabase.ts:131-152`

**Mechanism.** `getDatabase()` catches any open/pragma/migration failure, closes the partial handle, sets `this.database = null`, and throws `RepositoryError(Unavailable)`. Crucially it does **not** set `closeStarted`, so the next `run()` re-enters `getDatabase()` and retries the full open + `PRAGMA` + migration sequence from scratch. There is no failure counter, no backoff, and no quarantine of the bad file.

**Failure scenario.** The user's machine loses power mid-write and `gpt-voice.sqlite3` is left corrupt (`SQLITE_NOTADB` / `SQLITE_CORRUPT`). From then on, *every* transcription completion (`transcriptionCompletion.ts:100`) and *every* diagnostic capture attempts a fresh synchronous `sqlite3_open` + migration + up to 6 `existsSync`/`chmodSync` syscalls on the Electron main process, and fails. The app appears to work but silently persists nothing, forever, with a per-operation stall and no user-visible remediation path — the only fix is for the user to manually delete a file they do not know about.

**Suggested fix.** Track consecutive open failures; after the first, classify the error (corruption vs. transient) and either (a) latch into an unavailable state so subsequent calls fail fast without re-opening, or (b) rename the corrupt file aside (`.corrupt-<timestamp>`) and recreate, surfacing a one-time notification. At minimum, latch to avoid the retry storm.

---

### 3. `busy_timeout` of 5 s blocks the Electron main process synchronously — Medium — INFERRED

**File:** `src/main/repositories/sqlite/appDatabase.ts:6` (`APP_DATABASE_TIMEOUT_MS = 5_000`), consumed at `src/main/main.ts:282`

**Mechanism.** `node:sqlite`'s `DatabaseSync` is fully synchronous, and the `timeout` option maps to SQLite's busy handler. Every repository call runs on the main process's event loop. If a write lock is contended, the busy handler *sleeps in-thread* for up to 5 seconds.

**Failure scenario.** Two processes touch the same DB file. The app does hold a single-instance lock (`desktopRuntimeController.ts:88`, `app.requestSingleInstanceLock()`), which covers the ordinary case — but not a second *profile*/`XDG_CONFIG_HOME` pointing at the same directory, a stale process that lost the lock but still holds the handle, or the DB living on a network/synced filesystem (Dropbox/NFS) where locking is unreliable. In those cases the entire UI, IPC, tray, and window management freeze for up to 5 s per call, and `insert` on the diagnostic path can fire repeatedly.

**Marked INFERRED** because I did not construct a contended-writer reproduction; the single-instance lock makes the common path safe, and the severity rests on the escape hatches above.

**Suggested fix.** Lower the timeout for interactive paths (history list/read are renderer-driven and should fail fast rather than freeze), or move persistence to a worker thread / `node:sqlite` async surface if adopted. At minimum, document that any call can stall the main process for 5 s.

---

### 4. Diagnostic insert performs two-to-three full table scans per capture; `recorded_at` has no usable index — Medium — VERIFIED

**File:** `src/main/repositories/sqlite/sqliteDiagnosticCaptureRepository.ts:42-87`, `:142-145`, `:156-185`; index defined at `src/main/repositories/sqlite/appDatabase.ts:73-74`

**Mechanism.** Every `insert()` runs, inside one transaction: (a) `deleteExpired` — `DELETE … WHERE recorded_at < ?`; (b) `pruneCapacity` — `SELECT COALESCE(SUM(retained_bytes),0) …` with no `WHERE`; then conditionally (c) a window-function subquery (`SUM(…) OVER (ORDER BY recorded_at, id)`) over the whole table to pick eviction victims. The only relevant index is `idx_diagnostic_text_actions_action_type_recorded_at_id ON (action_type, recorded_at, id)`. A bare `recorded_at < ?` predicate **cannot** use that index, because `action_type` is the leading column — so (a) is a full scan. (b) is an unconditional full scan by construction, and (c) scans and sorts the whole table.

**Failure scenario.** With diagnostic capture enabled, each translation/prettify action pays 2–3 O(n) scans over a table whose rows carry full `source_text` + `result_text` blobs — synchronously, on the main process, in the middle of a user-visible interaction. The table is bounded by `DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES` (`diagnosticCaptureStorage.ts:225`) and a 60-day retention window (`:32`), so this will not grow without limit — which is why this is Medium and not High — but the constant factor is paid on every single capture, and the scanned bytes are the payload bytes, not just row headers.

**Suggested fix.** Add `CREATE INDEX idx_diagnostic_text_actions_recorded_at_id ON diagnostic_text_actions(recorded_at, id)` (as a new migration, version 3) so `deleteExpired` and the capacity window ordering both become index-driven. For the `SUM(retained_bytes)` scan, maintain a running total in a small counters table updated in the same transaction, or only run capacity pruning every Nth insert rather than every insert.

---

### 5. Prepared statements are re-compiled on every call and never explicitly finalized — Low — VERIFIED

**File:** all `database.prepare(…)` sites — `sqliteTranscriptionHistoryRepository.ts:41,49,67,71,94`; `sqliteDiagnosticCaptureRepository.ts:47,113,143,150,157,164`; `appDatabase.ts:163,171`

**Mechanism.** Each method calls `database.prepare(sql)` inline and discards the resulting `StatementSync`. Nothing is cached across calls, so every operation pays `sqlite3_prepare_v2` (SQL parse + query plan) in addition to the actual work. `listEntries` prepares two statements per page; `insert` prepares up to four per capture.

**Failure scenario.** Steady per-call overhead on the main process rather than an outright bug. The statement objects themselves are finalized by `DatabaseSync.close()` and by GC, so this is not a true handle leak — but until GC runs, each abandoned `StatementSync` pins a compiled SQLite statement in native memory. On a heavy diagnostic-capture session this is measurable native-heap churn.

**Suggested fix.** Cache the `StatementSync` instances on the repository (lazily, keyed by SQL) and reuse them. This needs care given the coordinator can null out and re-open `this.database` (finding 2) — cached statements must be invalidated when the connection is replaced, which is an argument for holding the cache on the coordinator keyed to the current handle.

---

### 6. No guard against a database written by a newer app version (downgrade) — Low — VERIFIED

**File:** `src/main/repositories/sqlite/appDatabase.ts:8`, `:154-184`

**Mechanism.** `runMigrations` iterates `APP_DATABASE_MIGRATIONS` and skips versions already present in `schema_migrations`. It never checks the *maximum* recorded version against `APP_DATABASE_SCHEMA_VERSION`. Separately, `APP_DATABASE_SCHEMA_VERSION = 2` is a hand-maintained constant that must be kept in sync with the highest entry in the migration array; nothing in the module derives or asserts it (it is consumed for reporting at `mainProcessCompositionRoot.ts:541`).

**Failure scenario.** A user installs v(N+1), which applies migration 3 adding a `NOT NULL` column with no default, then rolls back to v(N). Migrations 1–2 are seen as applied, the coordinator reports healthy, and the first `INSERT` fails on the unknown-to-this-build `NOT NULL` column — surfacing as a generic `repository-operation-failed` with no hint that a downgrade is the cause. The `STRICT` tables make this more likely to hard-fail than to silently misbehave, which is the good outcome, but the diagnosis is opaque.

**Suggested fix.** After creating `schema_migrations`, read `MAX(version)`; if it exceeds `APP_DATABASE_SCHEMA_VERSION`, throw `Unavailable` with a distinct code so the UI can say "this profile was created by a newer version". Also add a unit assertion that `APP_DATABASE_SCHEMA_VERSION === max(APP_DATABASE_MIGRATIONS.version)` to prevent drift.

---

### 7. A post-operation `chmod` failure converts a successful write into a reported failure — Low — VERIFIED

**File:** `src/main/repositories/sqlite/appDatabase.ts:93-107`

**Mechanism.** `run()` executes `operation`, then calls `ensurePermissions()` *before* returning the result (`:96-98`). If the chmod throws — e.g. the DB directory was made read-only, or the file is owned by another uid after a botched migration — the already-committed result is discarded and the error propagates, normalized to `repository-operation-failed`.

**Failure scenario.** A transcription is durably written to disk, but `addEntry` reports failure to `transcriptionCompletion.ts:100`. The user is told the save failed; the entry appears anyway on next launch. The inverse of data loss, but still a lie to the caller.

**Suggested fix.** Treat permission-hardening failure as a separate, logged concern: return the result and emit a warning, or hoist `ensurePermissions()` to run only after connection open and after write-type operations, never in a position where it can mask a committed success.

---

### 8. `addEntry` reads back the inserted row in a second, untransacted statement — Low — VERIFIED

**File:** `src/main/repositories/sqlite/sqliteTranscriptionHistoryRepository.ts:39-62`

**Mechanism.** The method `INSERT`s, then issues a separate `SELECT … WHERE id = ?` on `lastInsertRowid`, and throws `OperationFailed` if the row is missing (`:59`). The two statements run via `execute()`, i.e. in **autocommit — no enclosing transaction**, unlike the diagnostic repository which correctly uses `executeImmediateTransaction`.

**Failure scenario.** Any concurrent deleter (a second process, or `clearEntries` racing across the window) makes the read-back miss and raises `OperationFailed` for an insert that in fact succeeded. Narrow given the single-instance lock, but the two-statement round-trip is also pure overhead.

**Suggested fix.** Use `INSERT … RETURNING id, requested_at, provider_id, provider_name, text` — one statement, atomic by construction, and it removes the read-back entirely. Failing that, wrap the pair in `executeImmediateTransaction` for consistency with the sibling repository.

---

### 9. `listEntries` runs an unbounded `COUNT(*)` on every page request — Low — VERIFIED

**File:** `src/main/repositories/sqlite/sqliteTranscriptionHistoryRepository.ts:64-89`

**Mechanism.** Each call issues `SELECT COUNT(*) AS total FROM transcription_history` (full scan, or full index scan at best) alongside the `LIMIT/OFFSET` page query, to compute `total` and `hasMore`. Additionally, `LIMIT ? OFFSET ?` degrades linearly with offset — SQLite must walk and discard `offset` rows.

**Failure scenario.** `transcription_history` has no retention policy in this layer (only a manual `clearEntries`), so it grows for the life of the install. A heavy user with tens of thousands of entries paging to the end pays a full count plus an O(offset) walk per page, synchronously on the main process, on every renderer scroll.

**Suggested fix.** The index `(requested_at DESC, id DESC)` already exists — switch to keyset pagination (`WHERE (requested_at, id) < (?, ?)`) and drop the per-page `COUNT(*)`, or cache the total and invalidate on insert/clear.

---

## Verified sound

These were checked specifically and are correct — recorded so a resumed review does not re-litigate them.

1. **No SQL injection, anywhere.** Every value reaching SQLite is bound through `?` parameters. The two dynamic SQL fragments — `sqliteDiagnosticCaptureRepository.ts:112` and `:149` — build `placeholders` as `categories.map(() => '?').join(', ')`, i.e. the array contents determine only the *count* of placeholders, never the emitted text. Values are then spread as bindings (`.all(...categories)`, `.run(...categories)`). **No identifier (table/column/order-by) interpolation exists in the layer.**
2. **Error messages are content-free at the boundary.** `normalizeRepositoryError` (`repositoryErrors.ts:16-18`) collapses any non-`RepositoryError` into `RepositoryError(OperationFailed)`, whose message is just the code. Raw SQLite errors — which embed table and column names, and for constraint violations can echo values — never cross out of `AbstractSqliteRepository.execute`. The `getDatabase` catch block (`appDatabase.ts:143-151`) is explicitly commented as omitting paths.
3. **Migrations are ordered, idempotent, and transactional.** The array is iterated in declaration order; each version is guarded by a `schema_migrations` lookup (`appDatabase.ts:163-166`); each is applied inside `BEGIN IMMEDIATE` … `COMMIT` with a `ROLLBACK` on failure (`:168-182`); the DDL itself uses `CREATE TABLE/INDEX IF NOT EXISTS` for belt-and-braces idempotency. Re-running against an up-to-date DB is a no-op. A crash mid-migration leaves no half-applied version.
4. **Multi-statement writes in the diagnostic repository are properly transactional.** `insert`, `prune`, `pruneAndPurge`, and `purge` all route through `executeImmediateTransaction` (`abstractSqliteRepository.ts:27-43`), which uses `BEGIN IMMEDIATE` (correct choice — it takes the write lock upfront rather than risking a mid-transaction upgrade deadlock) with `ROLLBACK` in the catch. No nesting exists: the public transactional methods call private helpers that take the `database` handle directly rather than re-entering `execute`.
5. **Schema integrity is enforced in the database, not just in TypeScript.** Both tables are `STRICT`; `action_type` and `source_kind` carry `CHECK … IN (…)` constraints matching their TS union types; byte counters carry `>= 0` checks; and `retained_bytes = source_bytes + result_bytes` is enforced as an invariant (`appDatabase.ts:64-67`). `idx_diagnostic_text_actions_action_id` is `UNIQUE`, so duplicate `action_id` inserts fail loudly.
6. **Indexes match the read paths that matter.** `idx_transcription_history_requested_at_id (requested_at DESC, id DESC)` exactly matches `listEntries`' `ORDER BY requested_at DESC, id DESC`. `getEntryText` looks up by primary key.
7. **BigInt conversions are handled.** `node:sqlite` returns `changes` and `lastInsertRowid` as `BigInt`; both are wrapped in `Number(...)` at every use (`sqliteDiagnosticCaptureRepository.ts:144,153,184`; `sqliteTranscriptionHistoryRepository.ts:57`). No implicit-coercion `TypeError` lurking.
8. **Input validation on the query surface.** `normalizeTranscriptionHistoryQuery` (`transcriptionHistoryRepository.ts:33-42`) clamps `limit` to `[1, TRANSCRIPTION_HISTORY_MAX_LIMIT]` and `offset` to `>= 0`, coercing non-finite/non-numeric input to defaults — so a hostile renderer cannot request an unbounded page. `getEntryText` rejects non-safe-integer and non-positive ids before touching the DB (`sqliteTranscriptionHistoryRepository.ts:92`).
9. **Close is idempotent and double-guarded.** `AppDatabaseCoordinator.close()` latches `closeStarted` (`appDatabase.ts:110-111`) and nulls the handle before closing; `MainProcessRuntimeGraph.closeDatabase()` independently latches `databaseClosed`. Post-close `run()` correctly throws `Unavailable` rather than reopening (`:132`). `DatabaseSync.close()` finalizes outstanding statements, so finding 5 is a churn concern, not a leak-on-quit concern.
10. **Close is actually reached on quit, and failure there is non-fatal.** `mainProcessApplication.ts:326` calls `runtime.closeDatabase()` inside the shutdown sequence, after the diagnostics archive and diagnostics storage have been flushed (`:307-323`) — correct ordering, since those still need the DB. It is wrapped in `try/catch` that logs `DATABASE_CLEANUP_FAILURE_LOG`, so a chmod or close failure cannot wedge app exit.
11. **No N+1 query loops.** `readForArchive` fetches all matching rows in a single statement and maps in memory; no per-row follow-up queries exist anywhere in the layer.
12. **The DB path is not attacker-influenced.** `databaseFile` is `path.join(appDirectory, 'gpt-voice.sqlite3')` (`config.ts:44,159`), where `appDirectory` derives from platform app-data conventions. No runtime/user/IPC input reaches the path, so there is no traversal or symlink-target-injection surface from the renderer. The `${this.databasePath}${suffix}` concatenation in `ensurePermissions` (`appDatabase.ts:197`) is safe because the suffixes are the fixed `['', '-wal', '-shm']` literal.
13. **`getMigrationTimestamp` validates its injected clock** (`appDatabase.ts:186-192`), rejecting non-`Date` and non-finite values rather than writing `"Invalid Date"` into `schema_migrations.applied_at`.
14. **`LocalWhisperCatalogRepository` does not share this layer.** A repo-wide grep for `node:sqlite`/`DatabaseSync` outside `src/main/repositories/sqlite/` matched only `src/main/main.ts:9,282`. Nothing from the prior local-whisper review interacts with these files.

---

## Unreviewed / to resume

The review was cut short before the following were examined. None of them are in `src/main/repositories/**` — the in-scope 668 LOC were read in full — but they bear on the confidence level of several findings above.

1. **`tests/main/repositories/*.test.ts`** (`appDatabase.test.ts`, `abstractSqliteRepository.test.ts`, `sqliteTranscriptionHistoryRepository.test.ts`, `sqliteDiagnosticCaptureRepository.test.ts`). Not read. These exist and appear substantial (`appDatabase.test.ts` alone constructs the coordinator at 6 sites, and asserts on `[1, APP_DATABASE_SCHEMA_VERSION]` at `:65`). **Resume here first** — they likely already cover migration idempotency and close semantics, and may or may not cover findings 2, 6, and 7. Confirm whether a regression test would be new before writing one.
2. **`src/main/services/diagnosticCaptureStorage.ts` (full body).** Only the repository call sites were grepped (`:224,237,253,272,286,300,305`) plus the retention constants (`:32,411-414`). The queueing/serialization wrapper around those calls (`:108-142` appear to route through some scheduler) was not read — **this matters for finding 3 and 4**: if calls are already serialized off the interaction path, the main-process-stall severity drops.
3. **`src/main/services/transcriptionCompletion.ts`** — only line 100 (`addEntry`) was located; whether it is on a user-blocking path was not confirmed. Bears on finding 8's severity.
4. **`src/main/services/transcriptionHistoryIpcController.ts`** — not read. Determines how renderer input reaches `listEntries`/`getEntryText`/`clearEntries` and whether the clamping in finding-9's context is the only validation layer.
5. **`src/main/services/diagnosticsArchive`** (consumer of `readForArchive`) — not read. **Open question:** `readForArchive` materializes every matching row, including full `source_text` and `result_text`, into a JS array (`sqliteDiagnosticCaptureRepository.ts:137-138`). Bounded by `DIAGNOSTIC_CAPTURE_PAYLOAD_CAP_BYTES`, but that constant's value was not read — if it is large (tens of MB), this is a main-process memory spike worth its own finding. **Resolve this before considering the review complete.**
6. **Contended-writer / WAL behavior.** Finding 3 is INFERRED; no reproduction was attempted. Also unverified: `PRAGMA journal_mode = WAL` (`appDatabase.ts:138`) is issued via `exec`, which discards the returned row — so if WAL is refused (network filesystem), the code silently proceeds in rollback-journal mode with no error. Worth confirming whether that matters in practice.
7. **App directory creation mode.** `config.ts:577,601` call `mkdirSync(…, { recursive: true })` with **no `mode` option**, i.e. `0o777 & ~umask` → typically `0755`. This is the directory containing the DB and its sidecars, and it is the load-bearing detail in finding 1's suggested fix. Not fully traced; confirm before implementing.
