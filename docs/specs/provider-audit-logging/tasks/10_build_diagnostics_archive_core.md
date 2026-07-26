# 10 Build Diagnostics Archive Core

## Outcome

Build the main-process diagnostics archive service that extracts retained,
valid provider-audit events, snapshots eligible diagnostic text rows, generates
the safe schema-v1 manifest, and writes the fixed archive as ZIP on Windows or
gzip-compressed tar on Linux/macOS. The service creates and verifies a private
sibling temporary file before atomically replacing the caller-approved
destination.

This packet does not expose the service to a renderer or add the About-window
button. Packet 11 owns that trusted UI and IPC integration.

## Prerequisites

- Packet 01 is complete: the schema-v1 `provider-audit` event contract,
  canonical serializer, validator, sink label, registry mappings, and
  correlation rules are stable.
- Packet 07 is complete: diagnostic text rows, redaction metadata, limits,
  retention, pruning, query APIs, and shared-SQLite lifecycle are implemented.
- Packet 08 is complete: persisted capture settings and safe category snapshots
  are available without exposing retained text to renderer code.
- The approved archive dependency choice is final: use `archiver` as a direct
  production dependency for creation of both supported outer formats.
- Run this packet only through an explicit
  `incremental-implementation` invocation. Do not begin packet 11 in the same
  invocation.

## Owned Requirements

- `SCOPE-003`
- `EXPORT-001`
- `EXPORT-002`
- `EXPORT-003`
- `EXPORT-004`
- `EXPORT-005`
- `SEC-004`
- `SEC-005`
- `SEC-008`
- `OPS-001`

## In Scope

- A versioned shared archive/manifest contract and strict validators.
- Narrow access to current and rotated main-process `electron-log` files.
- Oldest-to-newest extraction of valid provider-audit records only.
- Schema validation, invalid-record accounting, and
  `(operationId, sequence)` deduplication.
- Pruning and consistent serialization of eligible Translation/Prettify
  diagnostic rows without copying the live database.
- A safe runtime/provider manifest assembled from allowlisted adapters.
- ZIP creation on `win32` and gzip-compressed tar creation on `linux` and
  `darwin`.
- Fixed archive members, byte accounting, SHA-256 payload hashes, and bounded
  JSON/JSONL.
- Private sibling temporary output, verification, atomic rename, and cleanup.
- Direct production dependency, lockfile, packaging-policy, and dependency
  audit changes required by `archiver`.
- Deterministic synthetic tests for both outer formats on any host.

## Out Of Scope

- About-window renderer UI, save dialog, trusted About-only IPC, localized
  notifications, and duplicate-click suppression; packet 11 owns them.
- Analysis of an exported archive; packet 12 owns the repository-local skill.
- Remote telemetry, upload, issue creation, support-server integration, or any
  network request.
- A general log export, raw log export, live-database copy, configuration
  export, session/browser-profile export, cache export, or crash-dump export.
- Voice audio or transcript capture.
- New audit retention, rotation, deletion, signing, encryption, or
  tamper-evidence policy.
- Provider requests, browser probes, account/session probes, shell commands, or
  external archive processes at runtime.
- Any change to provider results, retries, browser/session behavior, clipboard,
  notification, cache, or history contracts.

## Task Contract

### Archive schema and fixed members

- Archive schema version is literal `1`.
- Use these outer formats:
  - `win32`: ZIP;
  - `linux` and `darwin`: gzip-compressed tar.
- Internal member names and payload bytes are platform-independent:

  ```text
  manifest.json
  provider-audit/events.jsonl
  diagnostics/text-actions.jsonl
  ```

- `manifest.json` and `provider-audit/events.jsonl` are always present.
- `diagnostics/text-actions.jsonl` is present only when at least one enabled
  capture category has at least one retained row included in the snapshot.
- No other member is permitted. Every member is a regular file with exactly
  the relative path above. Do not create directory, symlink, hardlink, device,
  absolute, drive-qualified, parent-traversal, or user-controlled entries.
- Use deterministic canonical JSON. JSONL contains one canonical object per
  line with LF delimiters. Apart from archive ID and creation time, identical
  input snapshots produce identical member payloads and ordering.
- The manifest inventories every non-manifest payload member with its exact
  uncompressed byte length and SHA-256 hash. It does not attempt a recursive
  self-hash.

### Provider-audit extraction

- Audit input remains the existing main-process `electron-log` file transport.
  Do not introduce a dedicated audit file.
- Extend `src/main/logger.ts` with the narrowest read-only accessor needed to
  identify and read the active main log and every still-retained rotated main
  log. Do not expose a logger, log path, or arbitrary-log reader to preload or
  renderer code.
- The installed default transport retains `main.log` and `main.old.log`; do not
  change its 1 MiB rotation, location, lifecycle, or overwrite behavior in this
  packet.
- Read retained main log files oldest-to-newest. Never depend on directory
  enumeration order.
- Extract only lines with the exact `provider-audit` scope, exact stable label
  `Provider audit event`, and one canonical single-line JSON payload.
- Validate every candidate against audit schema version `1`. Exclude malformed,
  unsupported, non-canonical, or otherwise invalid records and count them.
- Deduplicate valid records by `(operationId, sequence)`. Keep the first record
  in oldest-to-newest order and count later duplicates.
- Serialize valid, deduplicated event objects to
  `provider-audit/events.jsonl`; never copy raw electron-log prefixes, unrelated
  application lines, paths, or parse errors.
- An absent logger/log directory produces a valid archive with zero events and
  safe zero counts. A throwing log accessor fails archive creation safely; it
  must not make provider execution fail or emit raw fallback data.

### Diagnostic text snapshot

- Before serialization, invoke the packet-07 pruning transaction:
  - delete rows older than 60 days;
  - retain at most 100 MiB of summed diagnostic `retained_bytes`;
  - never inspect, join, prune, or export transcription history.
- Query only categories whose capture setting is enabled at snapshot time.
- Include every retained row for each enabled category in deterministic
  `(recorded_at, id)` order. Disabled categories are excluded.
- Serialize rows exactly from their stored, best-effort-redacted values and
  safe row metadata. Do not rerun a lossy alternate redactor during export.
- A row still must satisfy the stored schema and 1 MiB combined redacted
  source/result UTF-8 limit. Invalid rows fail archive creation rather than
  silently producing an unverifiable partial archive.
- Never copy the SQLite database, WAL, SHM, transcription history, raw provider
  bodies, prompts, settings, models, URLs, argv, process output, credentials,
  cookies, sessions, or account data.
- Archive generation is read-only after the required retention/cap pruning. It
  does not delete included rows.

### Manifest allowlist

`manifest.json` contains only:

- archive ID, schema version, and UTC creation time;
- app version;
- audit, database, redactor, and diagnostic-row schema versions;
- platform family and architecture;
- safe Electron, Node, Playwright, and CloakBrowser package/runtime versions
  already available without account or provider probing;
- registered and selected Voice, Prettify, and Translation provider IDs;
- safe capability, configured, and readiness booleans;
- Translation and Prettify capture booleans;
- included category, record-count, time-range, and byte summaries;
- valid, invalid, and duplicate audit extraction counts;
- the fixed member inventory with expected payload byte lengths and SHA-256
  hashes;
- a sensitivity flag/warning when diagnostic text rows are present.

The manifest excludes hostname, username, home/app-data/export paths, locale,
timezone, hardware identifiers, executable paths, endpoints, model names,
prompts, proxy details, credentials, session/account IDs, and raw settings.
Known secrets are represented only by fixed `[REDACTED]` values when a schema
requires a value or, preferably, safe presence/configured booleans. Never copy
secret characters, length, prefix/suffix, or hashes.

Archive adapters must not decrypt credentials, parse session/account content,
or make a provider/browser/network request merely to compute a boolean. Add
presence-only accessors or consume already-safe in-memory state where an
existing view currently decrypts a value.

### Bounds

- Fixed member count is two or three, as defined above.
- Each member is at most 128 MiB uncompressed.
- Total uncompressed member bytes are at most 256 MiB.
- Each JSONL record is one line of at most 8 MiB in UTF-8, excluding the LF
  delimiter.
- Each JSONL member contains at most 1,000,000 records.
- Count and hash bytes before archive finalization. If any bound is exceeded,
  fail the whole export; never silently omit otherwise valid retained records.
- The archive-analysis compression-ratio rejection is a consumer-side
  untrusted-input rule. The producer still uses ordinary bounded compression
  and must produce fixtures accepted by packet 12.

### Safe archive creation

- Add `archiver` as a direct production dependency and lock it. Use it only for
  archive creation through a narrow adapter.
- Confirm the resolved dependency graph is pure JavaScript, has no native
  postinstall, and adds no runtime shell, external process, or network action.
- Append only in-memory/generated fixed member payloads with controlled regular
  file metadata. Do not ask `archiver` to traverse a user-controlled directory.
- Create one cryptographically unique private sibling temporary output in the
  destination directory, with the strongest per-user permissions practical
  (`0600` on POSIX and inherited per-user ACLs on Windows).
- Write and finalize the complete archive, verify expected format signature,
  member names/types, byte lengths, hashes, and limits, then atomically rename
  the sibling file to the caller-approved destination.
- A destination path is privileged main-process input. This core service may
  receive it only from the packet-11 dialog orchestration or directly injected
  tests; it is never renderer-supplied.
- Remove temporary output on success, cancellation before creation, any error,
  and application shutdown. Never log destination or temporary paths.

## Contracts And Boundaries

- Main owns log access, database access, manifest snapshots, hashing,
  filesystem writes, and archive creation.
- Preload and renderer receive no archive writer, log handle, database handle,
  manifest internals, path, or retained diagnostic text in this packet.
- Provider audit remains always-on when ordinary file logging is active.
- Optional text capture remains the sole approved default-off plaintext
  exception. The archive is unencrypted and sensitive whenever text rows are
  included.
- `archiver` is creation-only. Do not reuse it in packet 12 to trust or extract
  untrusted input.
- Canonical schema validators reject unknown fields and unsupported versions;
  rejection never falls back to raw logging or raw serialization.
- Archive creation performs no live provider/account readiness probe and no
  external action.

## Expected Files Or Components

- `package.json`
- `package-lock.json`
- `scripts/packaged-runtime-policy.mjs` when packaged dependency output requires
  an allowlist adjustment
- `src/main/logger.ts`
- `src/main/services/diagnosticsArchive.ts` or equivalently focused archive
  orchestration
- `src/main/services/diagnosticsArchiveFormat.ts` or an equivalent narrow
  `archiver` adapter
- `src/main/services/diagnosticsManifest.ts` if separating the allowlist keeps
  the archive service focused
- `src/shared/diagnosticsArchive.ts`
- Packet-07 diagnostic storage/query component for prune/snapshot integration
- Safe provider/runtime snapshot adapters only where existing accessors would
  read secrets
- `tests/main/diagnosticsArchive.test.ts`
- `tests/main/diagnosticsArchiveFormat.test.ts`
- `tests/main/diagnosticsManifest.test.ts`
- `tests/scripts/packagedRuntimePolicy.test.ts` when packaging policy changes

Use fewer files when the same boundaries remain explicit and testable. Do not
put archive logic into `src/main/ipc.ts`.

## Acceptance Criteria

- Synthetic current/rotated logs yield all valid schema-v1 audit events in
  chronological retained order and no unrelated log text.
- Malformed, unsupported, and non-canonical records are excluded and counted;
  duplicate `(operationId, sequence)` pairs are counted and emitted once.
- ZIP and tar.gz fixtures contain identical fixed member names and payload
  bytes for the same snapshot.
- Manifest fields are allowlisted, versioned, internally consistent, and
  contain correct non-manifest byte lengths and SHA-256 hashes.
- Privacy canaries in log lines, paths, raw settings, credentials, sessions,
  account data, endpoints, models, prompts, history, and provider bodies do not
  appear in archive bytes or captured logger arguments.
- Enabled diagnostic categories are included automatically; disabled
  categories and transcription history are absent.
- Empty enabled categories do not create `text-actions.jsonl`.
- Archive creation prunes before snapshot, never copies the database or logs,
  and does not mutate provider/settings state.
- Two/three-member, 128 MiB member, 256 MiB total, 8 MiB line, and 1,000,000
  records/member bounds are enforced without partial output.
- Injected archive, filesystem, hashing, logger, and database failures remove
  temporary output and leave the destination, logs, rows, settings, provider
  state, and user action outcomes unchanged.
- No runtime shell, external process, network, native postinstall, or live
  provider action is introduced.
- Production dependency audit, production bundle, and packaged-runtime policy
  pass with the approved direct dependency.

## Verification

Run the smallest focused files first, adapting filenames only if implementation
uses an equivalent split:

```bash
rtk proxy node --import tsx --test tests/main/diagnosticsArchive.test.ts
rtk proxy node --import tsx --test tests/main/diagnosticsArchiveFormat.test.ts
rtk proxy node --import tsx --test tests/main/diagnosticsManifest.test.ts
rtk proxy node --import tsx --test tests/scripts/packagedRuntimePolicy.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run audit:prod
rtk npm run build:prod
```

If the dependency changes packaged ASAR contents, also run the applicable
packaging preparation and verification:

```bash
rtk npm run prepare:cloakbrowser
rtk npm run pack
rtk npm run verify:packaged
```

Record but do not bypass any platform-only packaging failure.

## Failure And Rollback

- Missing or unreadable audit logs do not affect provider execution. If no logs
  exist, export zero events; if log access fails unexpectedly, fail the archive
  without raw fallback data.
- Database prune/snapshot, serialization, bounds, hashing, archive finalization,
  verification, or rename failure removes the sibling temporary output and
  leaves no partial destination created by this attempt.
- Never weaken validation, privacy allowlists, limits, or cleanup to obtain a
  successful export.
- Rollback removes archive code and the direct dependency/build-policy changes.
  Existing audit lines rotate normally; no audit-log migration is required.
- Diagnostic tables/rows remain an additive packet-07 concern. Rollback of this
  packet neither decrypts nor reinterprets them.

## Manual Gates

- **MANUAL GATE — dependency resolution:** adding the approved direct
  `archiver` dependency and lockfile is in scope. If the exact package is not
  available from the configured local npm cache, networked registry access
  requires explicit authorization before running the install; do not use an
  unapproved substitute or hand-edit resolved lockfile integrity data.
- **MANUAL GATE — dependency review:** inspect the exact locked `archiver`
  dependency graph and licenses; confirm pure JavaScript, no native postinstall,
  and no runtime network/shell/external process before accepting the packet.
- **MANUAL GATE — packaged runtime:** inspect one packaged build to confirm the
  required archive code is present once, no unapproved diagnostic/test files
  are packaged, and no unnecessary duplicate dependency tree inflates ASAR.
- **MANUAL GATE — platform format smoke:** with synthetic non-private data,
  create a ZIP on Windows and a tar.gz on Linux. Open each with an independent
  local tool and confirm the fixed members, hashes, and absence of paths or
  unrelated content. macOS uses the same tar.gz branch and requires native
  verification when a macOS environment is available.
- No credential, personal profile, private text/audio, live provider, commit,
  push, pull request, release, or publish action is authorized. Network use is
  limited to the separately approved dependency-resolution gate above.

## References

- Approved specification:
  - `# Diagnostics Archive`
  - `# Security and Privacy`
  - `# Failure Behavior`
  - `# Configuration and Operations`
  - `# Compatibility`
  - `# Acceptance Criteria`
- `docs/specs/provider-audit-logging/decisions.yaml` for the approved
  `archiver` planning decision.
- `src/main/logger.ts` for the existing file-transport wrapper.
- Packet-01 audit schema/validator implementation.
- Packet-07 diagnostic storage/pruning implementation.
- Packet-08 capture-settings snapshot implementation.
- `scripts/packaged-runtime-policy.mjs` for packaged module constraints.

## Completion And Handoff

1. Check only packet 10 in `tasks/todo.md`.
2. Update `tasks/handoff.md` with:
   - archive contracts and dependency version;
   - exact changed files;
   - focused and project checks run;
   - packaging/manual checks still outstanding;
   - any compatibility or privacy blocker.
3. Set the exact next packet to
   `11_integrate_about_diagnostics_export.md`.
4. Stop for review. Do not commit, start packet 11, push, or publish.
