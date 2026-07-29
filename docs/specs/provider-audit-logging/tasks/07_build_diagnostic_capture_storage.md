# 07 Build Diagnostic Capture Storage

## Outcome

Add the main-process-only redaction and repository foundation for bounded Translation and Prettify diagnostic text capture. Business services depend on domain repository contracts, SQLite details remain inside concrete adapters, and all existing transcription-history data and APIs remain compatible.

## Prerequisites

- Packet 01 is complete and has supplied the shared provider-audit operation identity and closed diagnostic persistence cause codes.
- The approved specification remains `Status: Approved`.
- No production database or private user text is used for implementation or verification.

## Owned Requirements

- `ARCH-004`
- `DATA-003`
- `DATA-007`
- `DATA-008`
- `OPS-004`
- `SEC-005`
- `SEC-007`
- `FAIL-002`
- `FAIL-003`
- `COMP-003`

## In Scope

- A single migration owner for the existing `gpt-voice.sqlite3` database.
- Domain-specific repository ports for transcription history and diagnostic capture.
- A shared abstract SQLite repository base plus concrete SQLite implementations.
- An additive strict diagnostic-row schema and indexes.
- Deterministic best-effort redaction before SQLite binding.
- UTF-8 row-size enforcement, 60-day retention, and the 100 MiB combined diagnostic payload cap.
- Oldest-first cross-category pruning in the insert transaction.
- Main-process APIs for insert, prune, purge, and archive-oriented reads.
- Best-practical per-user permissions for the database and SQLite sidecars.
- Startup pruning and coordinated database shutdown.
- Focused migration, redaction, retention, limit, permission, and history-compatibility tests.

## Out Of Scope

- Capture toggles, renderer UI, preload or settings IPC.
- Calling storage from provider or cache-hit action flows.
- Provider audit instrumentation beyond consuming Packet 01 types and closed causes.
- Archive creation or copying the SQLite database.
- Voice audio or transcript capture.
- Encryption, SQLCipher, remote telemetry, or a second database.
- A generic CRUD hierarchy that erases history- or diagnostic-specific operations.
- Refactoring existing provider, browser, HTTP, CLI, settings, or cache integrations into repositories.
- Changes to transcription-history results, pagination, clear behavior, or renderer APIs.

## Task Contract

1. Establish the repository boundary under `src/main/repositories/`.
   - Add backend-neutral `TranscriptionHistoryRepository` and
     `DiagnosticCaptureRepository` interfaces with only their required domain
     operations and safe typed inputs/results.
   - Add an `AbstractSqliteRepository` base class that owns access to the shared
     coordinator and reusable `BEGIN IMMEDIATE` commit/rollback behavior.
   - Add concrete `SqliteTranscriptionHistoryRepository` and
     `SqliteDiagnosticCaptureRepository` classes. Each extends
     `AbstractSqliteRepository` and implements exactly one domain port.
   - Do not add mixins, generic CRUD methods, empty marker base classes, or
     SQLite types to either domain port.
   - Domain services and their unit tests must not import `node:sqlite`,
     accept `DatabaseSync`, prepare SQL, or expose callback access to a raw
     connection.
   - Do not force the two domains through generic CRUD methods; their ports
     remain explicit and independently replaceable by future
     external-source implementations.
2. Introduce a shared main-process database coordinator in
   `src/main/repositories/sqlite/appDatabase.ts`.
   - It owns the one application connection to `gpt-voice.sqlite3`, migration sequencing, WAL setup, permissions, and close lifecycle.
   - Preserve the existing `5000` ms SQLite timeout, `foreign_keys = ON`, and WAL behavior.
   - Expose native SQLite access only to the SQLite repository layer and
     coordinator integration tests.
   - Move transcription-history SQL and row mapping out of
     `transcriptionHistoryStorage.ts` into
     `SqliteTranscriptionHistoryRepository`.
   - Remove the lazy singleton and free history pass-through functions. Inject
     `TranscriptionHistoryRepository` into transcription completion and IPC
     registration while preserving all renderer-visible history operations,
     values, ordering, pagination, copy, and clear behavior.
   - Do not create an independently migrating second connection for diagnostics.
3. Replace the current one-version migration shortcut with ordered, idempotent migrations.
   - Existing schema version `1` remains the transcription-history migration.
   - Add schema version `2` for diagnostic text actions.
   - A new database applies versions `1` and `2` in order; a version-1 database applies only version `2`.
   - Run each unapplied migration transactionally and record it in `schema_migrations` only after its schema changes succeed.
   - Never rewrite, delete, or reinterpret existing transcription-history rows.
4. Create a `STRICT` table named `diagnostic_text_actions` with:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`;
   - `action_id TEXT NOT NULL`;
   - nullable `provider_operation_id TEXT`;
   - `action_type TEXT NOT NULL` constrained to `translation` or `prettify`;
   - `source_kind TEXT NOT NULL` constrained to `provider` or `cache`;
   - `recorded_at TEXT NOT NULL`, containing a main-generated UTC ISO-8601 value;
   - `provider_id TEXT NOT NULL`;
   - nullable `contract_version TEXT` and `target_language TEXT`;
   - `redactor_version INTEGER NOT NULL`;
   - non-negative `redaction_count INTEGER NOT NULL`;
   - `source_text TEXT NOT NULL` and `result_text TEXT NOT NULL`;
   - non-negative `source_bytes`, `result_bytes`, and `retained_bytes` integer columns;
   - a check that `retained_bytes = source_bytes + result_bytes`.
5. Add:
   - a unique named index for `action_id`;
   - `idx_diagnostic_text_actions_action_type_recorded_at_id` on `(action_type, recorded_at, id)`.
   - Pruning order across categories is `(recorded_at ASC, id ASC)`, independent of the action-type index.
6. Add `src/main/services/diagnosticTextRedactor.ts`.
   - Redactor schema/version starts at literal `1`.
   - Every replacement is the exact string `[REDACTED]`.
   - Count replacements deterministically and retain the redactor version on every row.
   - Cover Authorization and Proxy-Authorization values, Bearer and Basic tokens, JWT-shaped values, PEM private-key blocks, common known API/token prefixes, Cookie and Set-Cookie values, sensitive key/value assignments, URL userinfo, and sensitive URL query parameters.
   - Sensitive normalized assignment/query names include `password`, `passwd`, `api-key`, `api_key`, `access-token`, `refresh-token`, `authorization`, `secret`, and `cookie`.
   - Use bounded patterns suitable for inputs up to 1 MiB; avoid catastrophic backtracking.
   - Redaction is intentionally best effort: it may change legitimate text or miss an unknown credential format.
7. Add `src/main/services/diagnosticCaptureStorage.ts`.
   - The input API accepts only already-normalized source/result text and safe typed metadata. It must not accept settings objects, raw responses, prompts, URLs, argv, stdout/stderr, cookies, sessions, account data, model values, or credential fields.
   - Inject `DiagnosticCaptureRepository`; do not inject the database
     coordinator or a callable that exposes SQLite.
   - Keep provider validation, redaction, UUID/time generation, byte-limit
     decisions, fail-open result mapping, operation serialization, and
     shutdown admission state in this service.
   - Move row persistence, database-row mapping, retention/capacity SQL,
     purge SQL, and archive-read SQL into
     `SqliteDiagnosticCaptureRepository`.
   - Keep `DiagnosticCaptureStorage` as a state-owning application service,
     not a repository pass-through: it owns validation, redaction, action
     identity/time, byte-policy decisions, admission, serialization, safe
     failure translation, and lifecycle drain behavior.
   - Generate `action_id` in main from an opaque random UUID; never derive it from content.
   - Validate provider IDs against the applicable registered Translation or known Prettify provider types before storage.
   - Redact source and result before calculating bytes and before any SQLite binding.
   - Calculate `source_bytes` and `result_bytes` with UTF-8 byte length after redaction. `retained_bytes` is their exact sum.
   - The combined redacted source/result limit is exactly `1 MiB` (`1_048_576` bytes). Accept equality. Reject any larger row without truncation or insertion.
   - A redaction exception skips the row with closed cause `diagnostic-redaction-failed`.
   - An oversized row skips the row with closed cause `diagnostic-row-too-large`.
   - Database/open/permission failures use only `diagnostic-storage-unavailable` or `diagnostic-storage-failed`, as applicable.
8. Implement retention and capacity in one `BEGIN IMMEDIATE` insert transaction owned by `SqliteDiagnosticCaptureRepository`:
   - Delete rows strictly older than 60 days using an injected main clock and a UTC cutoff.
   - Sum only `diagnostic_text_actions.retained_bytes`; never use the complete SQLite/WAL/SHM file size.
   - The combined Translation and Prettify payload cap is exactly `100 MiB` (`104_857_600` bytes).
   - Before insert, delete the oldest rows across both categories until `current retained bytes + next retained bytes <= 104_857_600`.
   - Insert the new row only after expiry/capacity pruning succeeds.
   - Roll back every delete and insert from that transaction if any database step fails.
9. Expose repository-backed storage operations needed by later packets:
   - insert one normalized provider/cache success;
   - prune expired/excess rows without inserting;
   - purge `translation`, `prettify`, or both in one idempotent transaction;
   - read retained rows for explicitly requested enabled categories for archive serialization.
   - Archive reads return redacted stored rows only and never join or return `transcription_history`.
10. Prune on application startup after config load and before IPC registration.

- Startup maintenance failure must not stop application startup.
- Emit only a separate metadata-only `diagnostic-capture` warning with a closed cause and maintenance phase; never emit a fabricated provider-audit operation and never log paths, exception messages, or text.
- Leave the archive packet to invoke the same prune API immediately before archive serialization.

11. Apply the strongest practical per-user permissions:
    - On POSIX, ensure the database and any existing `-wal` and `-shm` sidecars are mode `0600` after creation/open and after operations that create sidecars.
    - On Windows, retain inherited per-user application-data ACLs and do not attempt to broaden permissions.
    - Never log the database or application-data path on a permission failure.
12. All diagnostic persistence is best effort.
    - Storage APIs return a closed success/skipped/failure result or throw only an internal typed failure that later action adapters must contain.
    - No failure may expose source/result text in an exception, logger argument, or renderer-safe result.
13. Coordinate shutdown through the shared database owner.

- Serialize or explicitly track insert, prune, purge, and archive-read operations.
- Once shutdown begins, reject new diagnostic work with the safe
  `diagnostic-storage-unavailable` cause, wait for every accepted operation
  to settle, and close the shared SQLite connection exactly once.
- `DiagnosticCaptureStorage.shutdown()` stops admission and drains accepted
  repository work; it does not own or conceal the shared database close.
- `runQuitCleanup()` closes the application database directly after the
  diagnostic service drains and after provider/browser/translation cleanup.
- Update `runQuitCleanup()` so provider/browser/translation cleanup and any
  resulting diagnostic work settle before the database closes. Preserve
  the existing best-effort quit behavior if an operation fails.
- Do not close history and diagnostics through two independent owners.

14. Add a concise `AGENTS.md` repository rule for future work.

- Stateful business services use domain repository contracts for database
  and other external-source access.
- Concrete adapters own source-specific details such as SQLite, HTTP,
  browser, CLI, or filesystem APIs.
- Service tests use state-owning fakes; concrete adapters retain focused
  integration tests.
- This packet applies the rule only to history and diagnostic capture.

15. Compose the concrete adapters once in Electron main.

- Construct one `AppDatabaseCoordinator`, one
  `SqliteTranscriptionHistoryRepository`, and one
  `SqliteDiagnosticCaptureRepository`.
- Inject the domain ports into `DiagnosticCaptureStorage`, transcription
  completion dependencies, and IPC handler dependencies. Do not add
  closures or free functions whose only behavior is forwarding to a
  repository method.
- Keep functional IPC callback adapters where Electron requires callbacks;
  those adapters may validate or translate IPC input but must not own SQL.

## Contracts And Boundaries

- Database, filesystem, clocks, UUID generation, redaction, and captured text stay in main.
- Business services see domain repository contracts only. `node:sqlite`,
  `DatabaseSync`, SQL text, migrations, and connection callbacks stay under
  `src/main/repositories/sqlite/`.
- Domain repository ports contain no SQLite types and define no generic
  CRUD operations that are meaningless for their domain.
- The abstract SQLite base is infrastructure-only. It must not know
  transcription-history fields, diagnostic categories, retention policy,
  provider identifiers, redaction, or renderer contracts.
- Repository failures use closed, content-free types. Services translate those
  failures to their existing safe domain results; raw SQLite errors, SQL text,
  paths, and bound values never cross the adapter boundary.
- Renderer and preload receive no database handle, row, row count requirement, path, or captured source/result.
- The diagnostic payload cap excludes transcription history and SQLite overhead.
- Diagnostic purge/prune SQL must target `diagnostic_text_actions` explicitly; it must not use broad table discovery or destructive database resets.
- Known provider credential/configuration fields never enter the redactor or row pipeline. Their later manifest representation is presence/configured booleans or fixed `[REDACTED]` only.
- The separate `diagnostic-capture` warning is not labeled `Provider audit event`, is not under `provider-audit`, and therefore cannot be extracted as a provider event.
- Preserve strict TypeScript and synchronous SQLite ownership in Electron main.

## Expected Files Or Components

- Add `src/main/repositories/transcriptionHistoryRepository.ts`.
- Add `src/main/repositories/diagnosticCaptureRepository.ts`.
- Add `src/main/repositories/repositoryErrors.ts`.
- Add `src/main/repositories/sqlite/abstractSqliteRepository.ts`.
- Add `src/main/repositories/sqlite/appDatabase.ts`.
- Add `src/main/repositories/sqlite/sqliteTranscriptionHistoryRepository.ts`.
- Add `src/main/repositories/sqlite/sqliteDiagnosticCaptureRepository.ts`.
- Add `src/main/services/diagnosticTextRedactor.ts`.
- Add `src/main/services/diagnosticCaptureStorage.ts`.
- Remove `src/main/services/transcriptionHistoryStorage.ts` after all internal
  consumers use the domain repository port.
- Remove the superseded `src/main/services/appDatabase.ts` and
  `src/main/services/appDatabaseErrors.ts` paths after moving their behavior.
- Modify `src/main/services/transcriptionCompletion.ts`.
- Modify `src/main/ipc.ts`.
- Modify `src/main/main.ts`.
- Modify `AGENTS.md` with the approved repository boundary rule.
- Add reusable contract suites under
  `tests/main/repositories/contracts/` for both domain ports.
- Add `tests/main/repositories/abstractSqliteRepository.test.ts`.
- Add `tests/main/repositories/appDatabase.test.ts`.
- Add `tests/main/repositories/sqliteTranscriptionHistoryRepository.test.ts`.
- Add `tests/main/repositories/sqliteDiagnosticCaptureRepository.test.ts`.
- Add `tests/main/diagnosticTextRedactor.test.ts`.
- Add `tests/main/diagnosticCaptureStorage.test.ts`.
- Remove or replace `tests/main/transcriptionHistoryStorage.test.ts` after its
  behavior assertions move to the repository contract and SQLite integration
  suites.
- Modify `tests/main/transcription.test.ts` and
  `tests/main/streamingTranscription.test.ts` to inject state-owning fake
  history repositories.
- Modify lifecycle/source-contract tests only if required to prove startup pruning and shared close ownership.

## Acceptance Criteria

- Version-1 fixtures migrate to version `2` without changing any transcription-history value or API result.
- New databases contain both ordered migration rows, the strict diagnostic table, and both required indexes.
- `DiagnosticCaptureStorage` passes unit tests against a state-owning fake
  `DiagnosticCaptureRepository` without opening SQLite.
- Transcription completion and IPC history behavior pass focused tests against
  a state-owning fake `TranscriptionHistoryRepository` without opening SQLite.
- Reusable contract suites assert each repository port's observable behavior
  and run against the concrete SQLite implementation.
- A concrete test subclass proves `AbstractSqliteRepository` delegates through
  the coordinator, returns values, commits successful immediate transactions,
  rolls back failures, and preserves the original safe repository failure if
  rollback also fails.
- Each concrete SQLite repository passes its own temporary-database integration
  suite. These suites cover row mapping, ordering, pagination, invalid IDs,
  clear/purge idempotence, category filtering, retention boundaries, capacity
  pruning, transaction rollback, and history isolation.
- `AppDatabaseCoordinator` integration tests cover new and version-1
  migrations, ordered/idempotent migration records, migration rollback, WAL,
  foreign keys, the `5000` ms timeout, POSIX modes, the Windows no-chmod path,
  one lazy connection, idempotent close, and post-close rejection.
- Repository error and privacy tests prove raw messages, paths, SQL, bound
  values, source/result text, and SQLite error objects do not cross into
  service results or logger arguments.
- A source-boundary assertion fails if service files import `node:sqlite`,
  name `DatabaseSync`, prepare SQL, or call the coordinator with a raw
  connection callback.
- All required redaction classes have deterministic canaries, replacement counts, false-positive fixtures, and no unredacted marker in bound values or logger arguments.
- A row at exactly `1_048_576` redacted UTF-8 bytes is accepted; a row one byte larger is skipped, not truncated.
- Rows older than 60 days are pruned; the exact boundary remains retained.
- Capacity pruning uses `retained_bytes`, crosses categories, and removes oldest `(recorded_at, id)` rows first.
- Failed insert transactions restore rows deleted for expiry/capacity.
- Startup and explicit prune paths are idempotent and never delete transcription history.
- Shutdown rejects new writes safely, awaits accepted insert/clear/read work,
  closes one shared connection once, and cannot race provider cleanup.
- POSIX tests cover database and existing sidecar mode `0600`; Windows-path tests prove no permission broadening.
- Redaction, permission, and database failures reveal no text, path, raw error, or secret and cannot stop startup.

## Verification

Run focused checks first:

```bash
rtk node --import tsx --test \
  tests/main/repositories/abstractSqliteRepository.test.ts \
  tests/main/repositories/appDatabase.test.ts \
  tests/main/repositories/sqliteTranscriptionHistoryRepository.test.ts \
  tests/main/repositories/sqliteDiagnosticCaptureRepository.test.ts \
  tests/main/diagnosticTextRedactor.test.ts \
  tests/main/diagnosticCaptureStorage.test.ts \
  tests/main/transcription.test.ts \
  tests/main/streamingTranscription.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
```

Before packet completion, run the project unit suite because the shared database lifecycle changes existing history behavior:

```bash
rtk npm test
```

Record sanitized platform gaps for POSIX sidecars and Windows inherited ACL behavior in `tasks/handoff.md`; do not use a real profile to fill an automated-test gap.

## Failure And Rollback

- A migration failure must leave the previous migration version and transcription history readable; do not mark version `2` applied on partial failure.
- A repository failure must not cause a service to fall back to raw SQLite or
  bypass the domain port.
- Roll back code by restoring the previous history adapter while leaving the
  additive version-2 table intact. Old code must tolerate the extra table and
  migration row.
- Never implement rollback by dropping the shared database, `transcription_history`, or diagnostic rows automatically.
- A deployed binary rollback alone does not remove previously captured plaintext. Operational rollback must first disable and purge enabled categories with the new code, then roll back binaries.
- If redaction or permission tests expose prohibited data, stop the packet and remove the capture path through normal code rollback; do not weaken redaction, limits, or permissions.

## Manual Gates

- `MANUAL GATE`: Any test against a real application-data database or user profile requires explicit user authorization and a verified backup. It is not required for packet completion.
- `MANUAL GATE`: Windows ACL inspection and POSIX WAL/SHM inspection use only a synthetic temporary profile and must be recorded as sanitized platform verification.
- No dependency addition, production-data deletion, commit, push, pull request, archive export, or release is authorized by this packet.

## References

- Approved specification: `docs/specs/provider-audit-logging/spec.md`, “Optional Translation and Prettify Result Capture” → “Stored Row Contract”, “Best-Effort Redaction”, “SQLite Schema and Limits”, and “Revalidation and Rollback”.
- Decision ledger entries for shared SQLite, 60-day/100 MiB retention, 1 MiB row limit, and best-effort plaintext redaction.
- Decision ledger entries `repository.scope`, `repository.hierarchy`,
  `repository.testing`, and `repository.typescript-shape`.
- `AGENTS.md`.
- `.agents/references/task-packets.md`.
- `docs/agent-guides/project-conventions.md` sections “Code And Logging”, “Electron And Providers”, and “Tests And Documentation”.

## Completion And Handoff

- Update only this packet’s checkbox in `tasks/todo.md` and the compact continuation state in `tasks/handoff.md` after all verification passes.
- Record migration version, changed files, checks, platform permission gaps, and any blocker.
- Hand off to Packet 08 with the exact service APIs, domain repository
  contracts, concrete SQLite composition root, and typed closed failure codes.
- Stop for review; do not begin Packet 08, commit, push, or open a pull request.
