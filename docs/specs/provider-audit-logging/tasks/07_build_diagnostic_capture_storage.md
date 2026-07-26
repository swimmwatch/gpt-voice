# 07 Build Diagnostic Capture Storage

## Outcome

Add the main-process-only redaction and SQLite foundation for bounded Translation and Prettify diagnostic text capture while preserving all existing transcription-history data and APIs.

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
- Changes to transcription-history results, pagination, clear behavior, or renderer APIs.

## Task Contract

1. Introduce a shared main-process database coordinator in `src/main/services/appDatabase.ts`.
   - It owns the one application connection to `gpt-voice.sqlite3`, migration sequencing, WAL setup, permissions, and close lifecycle.
   - Preserve the existing `5000` ms SQLite timeout, `foreign_keys = ON`, and WAL behavior.
   - Refactor `transcriptionHistoryStorage.ts` to use the coordinator without changing its exported history functions or the testable `TranscriptionHistoryStore` behavior.
   - Do not create an independently migrating second connection for diagnostics.
2. Replace the current one-version migration shortcut with ordered, idempotent migrations.
   - Existing schema version `1` remains the transcription-history migration.
   - Add schema version `2` for diagnostic text actions.
   - A new database applies versions `1` and `2` in order; a version-1 database applies only version `2`.
   - Run each unapplied migration transactionally and record it in `schema_migrations` only after its schema changes succeed.
   - Never rewrite, delete, or reinterpret existing transcription-history rows.
3. Create a `STRICT` table named `diagnostic_text_actions` with:
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
4. Add:
   - a unique named index for `action_id`;
   - `idx_diagnostic_text_actions_action_type_recorded_at_id` on `(action_type, recorded_at, id)`.
   - Pruning order across categories is `(recorded_at ASC, id ASC)`, independent of the action-type index.
5. Add `src/main/services/diagnosticTextRedactor.ts`.
   - Redactor schema/version starts at literal `1`.
   - Every replacement is the exact string `[REDACTED]`.
   - Count replacements deterministically and retain the redactor version on every row.
   - Cover Authorization and Proxy-Authorization values, Bearer and Basic tokens, JWT-shaped values, PEM private-key blocks, common known API/token prefixes, Cookie and Set-Cookie values, sensitive key/value assignments, URL userinfo, and sensitive URL query parameters.
   - Sensitive normalized assignment/query names include `password`, `passwd`, `api-key`, `api_key`, `access-token`, `refresh-token`, `authorization`, `secret`, and `cookie`.
   - Use bounded patterns suitable for inputs up to 1 MiB; avoid catastrophic backtracking.
   - Redaction is intentionally best effort: it may change legitimate text or miss an unknown credential format.
6. Add `src/main/services/diagnosticCaptureStorage.ts`.
   - The input API accepts only already-normalized source/result text and safe typed metadata. It must not accept settings objects, raw responses, prompts, URLs, argv, stdout/stderr, cookies, sessions, account data, model values, or credential fields.
   - Generate `action_id` in main from an opaque random UUID; never derive it from content.
   - Validate provider IDs against the applicable registered Translation or known Prettify provider types before storage.
   - Redact source and result before calculating bytes and before any SQLite binding.
   - Calculate `source_bytes` and `result_bytes` with UTF-8 byte length after redaction. `retained_bytes` is their exact sum.
   - The combined redacted source/result limit is exactly `1 MiB` (`1_048_576` bytes). Accept equality. Reject any larger row without truncation or insertion.
   - A redaction exception skips the row with closed cause `diagnostic-redaction-failed`.
   - An oversized row skips the row with closed cause `diagnostic-row-too-large`.
   - Database/open/permission failures use only `diagnostic-storage-unavailable` or `diagnostic-storage-failed`, as applicable.
7. Implement retention and capacity in one `BEGIN IMMEDIATE` insert transaction:
   - Delete rows strictly older than 60 days using an injected main clock and a UTC cutoff.
   - Sum only `diagnostic_text_actions.retained_bytes`; never use the complete SQLite/WAL/SHM file size.
   - The combined Translation and Prettify payload cap is exactly `100 MiB` (`104_857_600` bytes).
   - Before insert, delete the oldest rows across both categories until `current retained bytes + next retained bytes <= 104_857_600`.
   - Insert the new row only after expiry/capacity pruning succeeds.
   - Roll back every delete and insert from that transaction if any database step fails.
8. Expose storage operations needed by later packets:
   - insert one normalized provider/cache success;
   - prune expired/excess rows without inserting;
   - purge `translation`, `prettify`, or both in one idempotent transaction;
   - read retained rows for explicitly requested enabled categories for archive serialization.
   - Archive reads return redacted stored rows only and never join or return `transcription_history`.
9. Prune on application startup after config load and before IPC registration.
   - Startup maintenance failure must not stop application startup.
   - Emit only a separate metadata-only `diagnostic-capture` warning with a closed cause and maintenance phase; never emit a fabricated provider-audit operation and never log paths, exception messages, or text.
   - Leave the archive packet to invoke the same prune API immediately before archive serialization.
10. Apply the strongest practical per-user permissions:
    - On POSIX, ensure the database and any existing `-wal` and `-shm` sidecars are mode `0600` after creation/open and after operations that create sidecars.
    - On Windows, retain inherited per-user application-data ACLs and do not attempt to broaden permissions.
    - Never log the database or application-data path on a permission failure.
11. All diagnostic persistence is best effort.
    - Storage APIs return a closed success/skipped/failure result or throw only an internal typed failure that later action adapters must contain.
    - No failure may expose source/result text in an exception, logger argument, or renderer-safe result.
12. Coordinate shutdown through the shared database owner.
    - Serialize or explicitly track insert, prune, purge, and archive-read operations.
    - Once shutdown begins, reject new diagnostic work with the safe
      `diagnostic-storage-unavailable` cause, wait for every accepted operation
      to settle, and close the shared SQLite connection exactly once.
    - Update `runQuitCleanup()` so provider/browser/translation cleanup and any
      resulting diagnostic work settle before the database closes. Preserve
      the existing best-effort quit behavior if an operation fails.
    - Do not close history and diagnostics through two independent owners.

## Contracts And Boundaries

- Database, filesystem, clocks, UUID generation, redaction, and captured text stay in main.
- Renderer and preload receive no database handle, row, row count requirement, path, or captured source/result.
- The diagnostic payload cap excludes transcription history and SQLite overhead.
- Diagnostic purge/prune SQL must target `diagnostic_text_actions` explicitly; it must not use broad table discovery or destructive database resets.
- Known provider credential/configuration fields never enter the redactor or row pipeline. Their later manifest representation is presence/configured booleans or fixed `[REDACTED]` only.
- The separate `diagnostic-capture` warning is not labeled `Provider audit event`, is not under `provider-audit`, and therefore cannot be extracted as a provider event.
- Preserve strict TypeScript and synchronous SQLite ownership in Electron main.

## Expected Files Or Components

- Add `src/main/services/appDatabase.ts`.
- Add `src/main/services/diagnosticTextRedactor.ts`.
- Add `src/main/services/diagnosticCaptureStorage.ts`.
- Modify `src/main/services/transcriptionHistoryStorage.ts`.
- Modify `src/main/main.ts`.
- Add `tests/main/diagnosticTextRedactor.test.ts`.
- Add `tests/main/diagnosticCaptureStorage.test.ts`.
- Modify `tests/main/transcriptionHistoryStorage.test.ts`.
- Modify lifecycle/source-contract tests only if required to prove startup pruning and shared close ownership.

## Acceptance Criteria

- Version-1 fixtures migrate to version `2` without changing any transcription-history value or API result.
- New databases contain both ordered migration rows, the strict diagnostic table, and both required indexes.
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
rtk node --import tsx --test tests/main/diagnosticTextRedactor.test.ts tests/main/diagnosticCaptureStorage.test.ts tests/main/transcriptionHistoryStorage.test.ts
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
- Roll back code by restoring the previous history adapter while leaving the additive version-2 table intact. Old code must tolerate the extra table and migration row.
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
- `AGENTS.md`.
- `.agents/references/task-packets.md`.
- `docs/agent-guides/project-conventions.md` sections “Code And Logging”, “Electron And Providers”, and “Tests And Documentation”.

## Completion And Handoff

- Update only this packet’s checkbox in `tasks/todo.md` and the compact continuation state in `tasks/handoff.md` after all verification passes.
- Record migration version, changed files, checks, platform permission gaps, and any blocker.
- Hand off to Packet 08 with the exact insert/prune/purge/read APIs and typed closed failure codes.
- Stop for review; do not begin Packet 08, commit, push, or open a pull request.
