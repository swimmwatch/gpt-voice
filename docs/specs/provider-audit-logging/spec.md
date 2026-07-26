# Spec: Provider Audit Logging and Diagnostics Archive

Status: Approved  
Date: 2026-07-26  
Scope owner: Provider diagnostics, local diagnostic capture, archive export, and analysis skill

## Objective

Make Voice, Prettify, and Translation failures quickly diagnosable from a correlated local audit trail, and let a user export a bounded diagnostics archive for agent-assisted analysis.

Success means:

- every provider-owned operation has a structured, safe lifecycle trail in the existing application log;
- optional Translation and Prettify source/result capture is separately configurable, disabled by default, bounded, and removable;
- the About window creates a portable archive containing retained audit events, a safe runtime/provider manifest, and enabled diagnostic text capture;
- a repository-local skill validates the archive against a user-supplied issue description and produces an evidence-linked Markdown incident report;
- provider behavior, result contracts, IPC outcomes, retries, clipboard, caches, and history remain compatible.

- **OUT-001:** Provider failures must be diagnosable from normalized cause, phase, attempt, duration, correlation, and safe operational metadata rather than free-form messages alone.
- **SCOPE-001:** Audit coverage includes all registered Voice, Prettify, and Translation providers.
- **SCOPE-003:** The work includes local archive export and agent-assisted archive analysis.

## Observed Baseline

- **BASE-001:** Provider diagnostics are uneven:
  - Voice uses provider and transcription-service scopes with different free-form payloads and error shapes.
  - Prettify uses service and selection scopes with safe notification metadata, but provider, operation, phase, and cause are not consistently present.
  - Translation already emits typed metadata-only terminal diagnostics from `BaseTranslateProvider`.
- `src/main/logger.ts` supplies scoped `electron-log` loggers. File logging is `info` and higher, console logging is `debug` and higher, and absence of the runtime logger degrades to a no-op.
- The Electron main process owns providers, app data, dialogs, filesystem access, browser/session lifecycle, and SQLite. Renderer access remains behind typed `window.electronAPI`.
- The About window has its own trusted window identity and typed IPC surface, but no file-export flow.
- `gpt-voice.sqlite3` currently stores transcription history through `node:sqlite`. It has a versioned migration table and no diagnostic-result tables.
- App Settings uses exhaustive shared section IDs and transactional renderer/main save flows.
- Existing provider secrets use Electron `safeStorage`, but the user selected plaintext diagnostic text with best-effort redaction and per-user file permissions for this feature.

## Scope

### Provider Families

- Voice:
  - `chatgpt`
  - `openai-api`
  - `claude-web`
- Prettify:
  - `ollama`
  - `vllm`
  - `claude-cli`
  - `codex-cli`
- Translation:
  - `google`
  - `bing`
  - `yandex`

New providers added to any of these registries must supply audit mappings before registry/type exhaustiveness checks can pass.

### Provider-Owned Operations

- **SCOPE-002:** Audit all provider-owned operations, not only primary transcribe, prettify, and translate requests.
- Voice includes provider initialization, provider-specific settings readiness, browser session load/save/clear, authentication/readiness, access-token refresh, batch transcription, streaming start/stream/finish/cancel, bounded retry/recovery, cleanup, and shutdown.
- Prettify includes provider-specific settings readiness, availability/capability checks, model discovery/listing, model load/unload, preparation, HTTP or CLI execution, cancellation/timeout, process cleanup, and shutdown where implemented.
- Translation includes settings snapshot and input validation, context creation, navigation, consent/challenge handling, readiness, source detection, target selection, stale-state clearing, submission, result stabilization, recovery, visible-state cleanup, context cleanup, and shutdown.
- Validation that rejects an unknown provider before dispatch still emits a family audit failure, but omits the untrusted identifier.
- A cache hit is not a provider dispatch and does not create a provider-audit operation. It may create a diagnostic result row when its action-specific capture toggle is enabled.

### Diagnostics Archive and Skill

- **EXPORT-001:** The existing app log remains the provider-audit destination; an explicitly user-triggered export collects normalized data into one local archive.
- **SKILL-001:** Add a project-specific skill that accepts an archive plus issue context, performs read-only analysis, and produces a Markdown report.
- The archive includes all valid provider-audit events still present in current and rotated logs.
- **EXPORT-002:** The selected provider-safe bundle adds a generated manifest with schema/runtime versions, platform family/architecture, registered/selected provider IDs, safe capability/readiness booleans, capture state, and extraction counts. It excludes unrelated free-form application logs.
- When Translation or Prettify diagnostic capture is enabled, the archive automatically includes that category’s retained, best-effort-redacted source/result rows.

### Non-Goals

- **NONGOAL-001:** No remote telemetry, third-party log shipping, automatic issue creation, or external observability service.
- **NONGOAL-002:** No tamper-evident ledger, cryptographic signing, append-only guarantee, compliance retention, or compliance access-control system.
- **NONGOAL-003:** No general audit framework for renderer actions, clipboard, notifications, history, cache, or unrelated application behavior.
- No dedicated always-on audit file, user-facing log viewer, automatic upload, or support-server integration.
- No Voice audio/transcript capture beyond existing transcription history behavior.
- No raw HTTP/browser/CLI provider response body capture.
- No change to provider results, typed IPC outcomes, retry/fallback policy, cache behavior, clipboard, notifications, or history.
- No full database encryption or SQLCipher migration.
- No claim that best-effort arbitrary-text redaction identifies every possible secret.

## Provider Audit Event Contract

### Shared Main-Process Sink

- **ARCH-001:** Emit provider audit events through the existing `electron-log` file transport under one scope named `provider-audit`.
- **ARCH-002:** The sink, typed builders, correlation state, and provider mappings live in main. Renderer code never receives a logging handle.
- **ARCH-003:** Audit normalization is internal and additive. Existing provider result types, localized user errors, notification presentation, and IPC results remain unchanged.
- Every write uses the stable label `Provider audit event` followed by one canonical, single-line JSON serialization of a typed event. Canonical single-line output lets the exporter extract audit records without copying unrelated log lines.
- Provider code must not pass arbitrary objects, raw `Error` instances, messages, or stacks to the audit logger.

### Required Fields

Every event contains:

| Field           | Contract                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------- |
| `schemaVersion` | Literal `1`.                                                                                  |
| `occurredAt`    | UTC ISO-8601 timestamp generated in main.                                                     |
| `family`        | `voice`, `prettify`, or `translation`.                                                        |
| `providerId`    | An ID accepted by the applicable registry. Omit when unknown and emit `providerKnown: false`. |
| `operation`     | Closed family-owned operation ID.                                                             |
| `operationId`   | Opaque main-generated ID, never content-derived.                                              |
| `sequence`      | Per-operation positive integer beginning at `1`.                                              |
| `event`         | `started`, `phase-entered`, `phase-completed`, `retry`, `recovery`, or `terminal`.            |
| `phase`         | Closed safe lifecycle phase.                                                                  |
| `outcome`       | `in-progress`, `success`, `failure`, `cancelled`, or `stale`.                                 |

- **AUD-004:** One `operationId` follows a top-level operation across phases, attempts, bounded retries, recovery, and terminal outcome.
- Existing main-generated streaming IDs may serve as audit IDs when they satisfy the opaque-ID rule. A manual buffered retry gets a new ID.
- Independent support operations such as model listing get independent IDs. Readiness/recovery inside a primary call reuse the primary ID.
- `occurredAt`, `operationId`, and `sequence` form the archive timeline and do not encode user/account identity, content hashes, paths, settings, or process IDs.

### Operation and Phase Identifiers

Closed operation identifiers cover:

- Voice: `initialize`, `settings-readiness`, `session-load`, `session-save`, `session-clear`, `readiness`, `credential-refresh`, `transcribe-batch`, `transcribe-stream`, `recovery`, `shutdown`.
- Prettify: `settings-readiness`, `availability`, `capability-check`, `model-list`, `model-load`, `model-unload`, `prepare`, `prettify`, `process-cleanup`, `shutdown`.
- Translation: `settings-readiness`, `translate`, `shutdown`.

Closed phase identifiers may be shared where semantics match and family-specific where needed. Version 1 covers `dispatch`, `validation`, `configuration`, `session`, `readiness`, `context`, `navigation`, `consent-or-challenge`, `source-detection`, `target-selection`, `stale-state`, `submission`, `streaming`, `result`, `model-discovery`, `model-lifecycle`, `process`, `recovery`, `cleanup`, and `shutdown`.

- **AUD-007:** Every event declares `schemaVersion: 1`. Adding optional fields/values is compatible; removing, renaming, changing a type, or changing semantics requires a new version.

### Lifecycle Invariants

- **AUD-001:** Every dispatched provider operation emits:
  1. one `started` event before provider work;
  2. semantic phase events sufficient to reconstruct the path;
  3. retry/recovery events whenever those branches occur;
  4. exactly one `terminal` event.
- No event may follow an operation’s terminal event.
- Thrown exceptions are normalized into the same terminal invariant before the existing return/throw behavior continues.
- Cancellation and stale discard remain distinguishable from provider failure.
- Logging observes existing behavior; it never adds a retry, changes a retry limit, replays content, suppresses cancellation, or alters cleanup.

### Bounded High-Frequency Detail

- **AUD-002:** Full lifecycle means semantic phases, not every loop iteration.
- **PERF-001:** Event volume is bounded by phase/attempt/retry/recovery count, never by input size, chunk count, token count, or poll count.
- Voice streaming does not log every PCM chunk. Terminal metadata may include aggregate accepted bytes/chunks/frames; invalid sequence/chunk, overflow, backpressure, and transport failure emit causal events.
- Translation does not log each DOM/result/stability poll.
- CLI Prettify does not log stdout/stderr chunks, JSONL progress, tokens, or subprocess stream data.
- HTTP Prettify does not log request/response bodies or repeated stream reads.

## Audit Metadata and Error Normalization

### Optional Field Allowlist

- **AUD-005:** Typed builders allow only:
  - `attemptCount`, `durationMs`, numeric `httpStatus`;
  - `inputByteLength`, `sourceLength`, `resultLength`, `acceptedByteCount`, `chunkCount`, `frameCount`;
  - `causeCode`, `errorClass`, centrally allowlisted `exceptionType`;
  - `contractVersion`, `targetLanguage`, `transcriptionMode`, `modelSource`;
  - `usesDefaultModel`, `modelConfigured`, `modelNameLength`;
  - safe booleans including `providerKnown`, `hasMimeType`, `retryScheduled`, `recoveryScheduled`, `postSubmission`, `pageClosed`, `discarded`, `wasSanitized`, `hasMessage`, `hasUrl`, `hasFilePath`, and `hasStackTrace`.
- Unknown keys are rejected. Runtime code never falls back to logging rejected raw data.
- Lengths/counters never carry content hashes, cache keys, excerpts, account IDs, or content-derived fingerprints.
- Unrecognized `Error.name` becomes `unknown`; arbitrary provider-controlled names are not persisted.

### Cause Codes

`causeCode` is closed and non-localized:

- Translation preserves `unsupportedProvider`, `unsupportedTargetLanguage`, `emptyInput`, `inputTooLong`, `navigationFailure`, `consentOrChallenge`, `pageContractFailure`, `resultTimeoutOrEmpty`, `cancelledOrStaleOperation`, and `cleanupFailure`.
- Prettify preserves existing CLI runtime codes and adds HTTP/provider codes `not-configured`, `connection-failed`, `request-failed`, `unexpected-response`, `empty-result`, `model-lifecycle-failed`, and `unknown`.
- Voice preserves existing Claude Web and streaming codes. ChatGPT/OpenAI API failures map to `not-configured`, `not-authenticated`, `rate-limited`, `connection-failed`, `request-failed`, `unexpected-response`, `empty-result`, `cancelled`, `provider-contract-changed`, `cleanup-failed`, and `unknown`.
- A localized error, HTTP body, Playwright error, CLI output, stack, or exception message is never used as a code.
- Diagnostic persistence failures use safe internal causes such as `diagnostic-storage-unavailable`, `diagnostic-row-too-large`, `diagnostic-redaction-failed`, and `diagnostic-storage-failed`.

### Severity

- **AUD-003:** Severity derives from outcome/cause:
  - `info`: start, phase progress, retry/recovery, success, explicit cancellation, stale/discarded completion;
  - `warn`: typed validation/configuration/auth failures, provider rejection, rate limit, expected connection failure, timeout, and nonfatal diagnostic-capture failure;
  - `error`: unexpected exceptions, corrupted/changed contracts, malformed internal results, and cleanup failures that leave ownership uncertain.
- Retry/recovery events are not duplicate terminal failures.
- **AUD-006:** The shared scope plus mandatory family/provider fields creates one searchable cross-family timeline.

## Family Requirements

### Voice

- **VOICE-001:** Batch and streaming paths use the same envelope while retaining existing result contracts/modes.
- **VOICE-002:** ChatGPT distinguishes session/readiness, token refresh, transport interruption without replay, HTTP status, rate limit/cooldown, page recovery, response contract, empty result, success, and cleanup.
- **VOICE-003:** OpenAI API distinguishes configuration/key presence, request transport, HTTP status, response parsing/contract, empty result, success, and cleanup without logging authorization, multipart data, prompt, model value, body, or transcript.
- **VOICE-004:** Claude Web preserves safe buffered/streaming codes, readiness/recovery phases, attempts, and aggregate audio counters without organization identity, session data, socket query data, audio, event payloads, or transcript.
- **VOICE-005:** Streaming invalid sequence/chunk, operation conflict, provider change, cancellation, and transport failure terminate once. Per-chunk success logs are prohibited.
- **VOICE-006:** A transcription cache hit does not impersonate a provider call.

### Prettify

- **PRETTY-001:** Dispatch supplies the concrete provider ID and carries it through prepare/execute.
- **PRETTY-002:** Ollama/vLLM distinguish settings readiness, connection, supported model lifecycle, HTTP status, response contract, empty result, cancellation, success, and cleanup.
- **PRETTY-003:** Claude/Codex CLI distinguish availability/auth, capability gate, model discovery, spawn, timeout, cancellation, output limit, exit, structured-output validation, success, and process cleanup.
- **PRETTY-004:** Audit events never contain selected text, prompt, output, model value, executable path, working directory, environment, base URL, API key, argv, stdin/stdout/stderr, schema contents, account data, or debug output.
- **PRETTY-005:** Direct IPC and selected-text flows converge on the same provider audit boundary and do not duplicate terminal events.

### Translation

- **TRANS-001:** Move existing translation diagnostics into the v1 envelope without losing provider ID, contract version, target, phase, attempt, duration, source/result length, outcome, or failure code.
- **TRANS-002:** Google/Bing/Yandex continue using the shared lifecycle and existing safe classifications.
- **TRANS-003:** Audit events never contain source/result text, source-bearing URLs, page content, response data, cookies/storage, screenshots, or browser identity.
- **TRANS-004:** Cancelled/stale generation is an `info` terminal outcome; cleanup failure is `error`.

## Optional Translation and Prettify Result Capture

### Settings Contract

- **DATA-001:** Add a new App Settings navigation section with section ID `audit-log` and localized title **Audit Log**.
- It contains separate booleans:
  - `captureTranslationDiagnostics`
  - `capturePrettifyDiagnostics`
- Both default to `false` for new, missing, legacy, or corrupt configuration.
- Enabling affects future successful actions only; it does not reconstruct earlier text.
- The audit event stream remains always on and metadata-only regardless of these toggles.
- Settings persistence is main-owned, validated, typed through preload/main/renderer, and saved with the existing App Settings transactional workflow.
- The section must disclose:
  - captured source/results are sensitive;
  - storage uses plaintext SQLite protected by per-user filesystem permissions after best-effort redaction, not encryption;
  - arbitrary embedded secrets may evade redaction;
  - enabled categories are automatically included in exported archives;
  - archives are not encrypted.

### Stored Row Contract

- **DATA-002:** When the applicable toggle is enabled, store the selected source and successful normalized result with safe correlation metadata.
- **DATA-006:** Capture every successful Translation/Prettify action, including cache hits.
- Each row contains:
  - unique `action_id`;
  - nullable `provider_operation_id`;
  - `action_type`: `translation` or `prettify`;
  - `source_kind`: `provider` or `cache`;
  - UTC `recorded_at`;
  - registered `provider_id`;
  - optional safe `contract_version` and `target_language`;
  - `redactor_version`, `redaction_count`;
  - redacted plaintext `source_text`, `result_text`;
  - UTF-8 byte counts and authoritative `retained_bytes`.
- A provider dispatch row links to its audit operation ID. A cache-hit row has its own action ID and a null provider operation ID.
- Store only normalized successful source/result text. Never store raw response bodies, partial/error provider bodies, prompts, settings, model values, URLs, argv, stdout/stderr, credentials, cookies, sessions, or account data.
- Capture occurs after a normalized provider/cache success is available. Capture failure never changes provider, clipboard, notification, cache, or action outcome.

### Best-Effort Redaction

- **SEC-005:** Known credential/configuration fields never enter the row/archive pipeline. Manifests represent configured/present state only as booleans or fixed `[REDACTED]`; no value characters, length, prefix/suffix, or hash are copied.
- **SEC-007:** Arbitrary source/result text is stored in plaintext after versioned best-effort redaction, per explicit product decision.
- The minimum deterministic redactor replaces matched values with the exact constant `[REDACTED]` for:
  - `Authorization`/`Proxy-Authorization` values and Bearer/Basic tokens;
  - JWT-shaped values;
  - PEM private-key blocks;
  - common known API/token prefixes;
  - cookie and `Set-Cookie` values;
  - key/value assignments whose normalized key contains `password`, `passwd`, `api-key`, `api_key`, `access-token`, `refresh-token`, `authorization`, `secret`, or `cookie`;
  - URL userinfo and query parameters using those sensitive names.
- Redaction runs before SQLite binding and before any archive serialization. Exceptions contain only safe cause metadata.
- The redactor is conservative and may alter legitimate text or miss an unknown secret format. UI/docs/report state this limitation; no stronger guarantee is claimed.
- Redactor changes are versioned and covered by deterministic canaries. Rows retain the redactor version used.

### SQLite Schema and Limits

- **ARCH-004 / DATA-007:** Add strict diagnostic tables to the existing `gpt-voice.sqlite3` database and increment its migration version. Do not create a second database.
- Diagnostic queries never join or export transcription history.
- Create indexes for `(action_type, recorded_at, id)` and unique `action_id`.
- **DATA-003 / OPS-004:** Retain rows for 60 days and cap combined diagnostic payload accounting at 100 MiB.
- The 100 MiB cap applies to summed diagnostic `retained_bytes`, not the complete shared SQLite/WAL/SHM file. Transcription history remains outside this limit.
- On startup, before archive snapshot, after settings changes, and in the insert transaction:
  1. delete diagnostic rows older than 60 days;
  2. if the next insert would exceed 100 MiB, delete oldest diagnostic rows across both categories until it fits;
  3. insert the new row.
- **DATA-008:** Combined redacted source/result UTF-8 size per row is at most 1 MiB.
- **FAIL-003:** Oversized rows are not truncated or stored. Emit a safe nonfatal audit cause and preserve the successful action.
- The database and sidecars use the strongest per-user permissions practical: mode `0600` on POSIX and inherited per-user application-data ACLs on Windows. The app never relaxes them.

### Deletion

- **UI-004 / DATA-004:** Disabling either toggle requires explicit destructive confirmation. Confirming disables capture and permanently purges that category; cancelling leaves toggle/data unchanged.
- Main rejects a true-to-false transition unless the typed request explicitly confirms purge.
- If purge fails, the setting remains enabled and the UI reports a safe failure. The user must never be shown “disabled and purged” while rows remain.
- **UI-005 / DATA-005:** Provide confirmed **Clear Translation**, **Clear Prettify**, and **Clear all** actions that delete rows without changing capture toggles.
- Clear/disable operations are trusted-sender main IPC, idempotent, and never expose row text to renderer.

## Diagnostics Archive

### About Flow

- **UI-001:** Add an **Export diagnostics** button to the About window.
- **UI-002:** The button calls a typed preload/main IPC operation accepted only from the current trusted About window sender/URL. Main owns dialog, path, filesystem, archive creation, and notification.
- Main opens a parented OS save dialog with a precomputed unique default:
  - Windows: `gpt-voice-diagnostics-<UTC-basic-timestamp>-<8-hex>.zip`
  - Linux/macOS: `gpt-voice-diagnostics-<UTC-basic-timestamp>-<8-hex>.tar.gz`
- The dialog uses the correct extension filter and appends the platform extension when omitted. OS-native overwrite confirmation remains authoritative.
- Renderer never supplies an unrestricted path and receives only a typed `saved`, `cancelled`, or `failed` result.
- While running, disable the export button and prevent duplicate exports.
- Cancellation creates no file, notification, or error and leaves About open.
- **UI-003:** On successful save, close About and show a localized success system notification. On failure, remove partial output, keep About open, and show a localized safe failure notification so the user can retry.

### Format and Contents

- **EXPORT-004:** Use platform-native outer formats: ZIP on Windows; gzip-compressed tar on Linux/macOS.
- Archive schema version is `1`; internal paths are identical across formats:

```text
manifest.json
provider-audit/events.jsonl
diagnostics/text-actions.jsonl   # present only when an enabled category has retained rows
```

- `manifest.json` includes:
  - archive ID/schema, creation time;
  - app version;
  - audit, database, redactor, and diagnostic-row schema versions;
  - platform family/architecture;
  - Electron, Node, Playwright/CloakBrowser package/runtime versions available without probing accounts;
  - registered and selected provider IDs;
  - safe capability/configured/readiness booleans;
  - Translation/Prettify capture booleans;
  - included category/count/time/byte summaries;
  - log extraction valid/invalid/duplicate counts;
  - expected member byte lengths and SHA-256 hashes.
- Manifest excludes hostname, username, home/app-data/export paths, locale, timezone, hardware identifiers, executable paths, endpoints, model names, prompts, proxy details, credentials, session/account IDs, and raw settings.
- `events.jsonl` contains validated schema-v1 event objects, not raw electron-log lines.
- **EXPORT-003:** Scan current and rotated logs oldest-to-newest, extract only the exact scope/label/canonical JSON contract, validate each event, deduplicate by `(operationId, sequence)`, and include all valid retained events. Malformed/unsupported records are excluded and counted in the manifest.
- **EXPORT-005 / SEC-008:** If a capture category is enabled, export all retained rows for that category to `text-actions.jsonl` automatically, decrypted/redacted exactly as stored. No per-export opt-in is added.
- The archive is not encrypted. Its UI/docs/manifest mark it as sensitive whenever result rows are included.

### Safe Creation

- Main snapshots/prunes diagnostic rows before serialization and never copies the live SQLite file, WAL, raw logs, config, session files, browser profiles, caches, or crash dumps.
- JSON serialization is canonical and deterministic apart from archive identity/time.
- Use one private sibling temporary output, write the complete archive, verify member hashes/limits, then atomically rename to the selected path. Clean temporary data on success, cancellation, error, and shutdown.
- Archive members are regular files with relative fixed paths; no symlink, hardlink, device, absolute, parent-traversal, or user-controlled member names.
- Limit total uncompressed input to 256 MiB and member count to the fixed schema. If exceeded, fail safely without a partial archive; do not silently omit valid retained records.
- Archive creation adds no network request, browser action, provider request, shell command, or external process. A new archive dependency, if required, must be pure JavaScript, narrowly scoped, production-audited, and used for creation only.

## Archive Analysis Skill

### Package Contract

- **SKILL-002:** Create repository-local `.agents/skills/analyze-diagnostics-archive/`.
- Use the skill-creator initialization/validation workflow. The package contains only:
  - `SKILL.md`;
  - `agents/openai.yaml`;
  - a deterministic archive validation/inspection script under `scripts/`;
  - focused references only if the archive/audit schema would otherwise bloat `SKILL.md`.
- No README, changelog, installation guide, sample private archive, or generated report is committed.
- The skill description triggers when a user asks to analyze a GPT-Voice diagnostics ZIP/tar.gz archive, correlate provider audit failures, or produce an incident report from the archive.

### Inputs and Output

- **SKILL-003:** Required inputs are:
  - local archive path;
  - issue description;
  - expected behavior;
  - observed behavior/problem summary;
  - approximate occurrence time when known.
- The skill never requests API keys, tokens, passwords, cookies, sessions, account data, or private audio.
- **SKILL-004:** Default report path is `.artifacts/diagnostics/<archive-id>/report.md`; an explicit user output path overrides it.
- The report contains:
  - issue context;
  - archive/schema/integrity validation;
  - safe environment/provider summary;
  - correlated chronological timeline;
  - likely root cause(s) ranked by confidence;
  - evidence references by operation ID, sequence, action ID, and archive member/line;
  - source/result transformation findings when retained data is relevant;
  - contradictions, missing evidence, redaction limitations, and uncertainty;
  - recommended next checks and likely code/provider area.
- Analysis is read-only. The skill does not implement fixes, modify app data, contact providers, upload the archive, or use the network unless separately requested and authorized.
- **SKILL-005 / SEC-009:** Reports cite IDs and use only the minimum best-effort-redacted excerpt needed for a finding, capped at 200 characters per excerpt. Full source/results are never reproduced by default.

### Untrusted Archive Handling

- Treat every archive/member as untrusted data.
- Validate file signature and schema, not extension alone.
- Before reading content, reject:
  - absolute/drive/parent-traversal paths;
  - symlink, hardlink, device, or unsupported entry types;
  - duplicate normalized member paths;
  - unexpected members;
  - more than the fixed schema member count;
  - total uncompressed size above 256 MiB;
  - any member above 128 MiB;
  - pathological compression ratio;
  - checksum/hash mismatch.
- Never execute archive contents or import code from them.
- Parse JSON/JSONL with bounded line/record counts. Validate archive/audit/database/redactor versions and stop with a clear unsupported-schema finding rather than guessing.
- Use a private temporary extraction directory and remove it in `finally`; do not persist extracted sensitive rows beside the report.
- The inspection script emits only validated normalized data required by the skill and never prints complete source/results unnecessarily.

## Security and Privacy

- **SEC-001:** Provider audit logs never contain API keys, access tokens, cookies, sessions/storage, account/organization IDs, audio, selected text, prompts, transcripts, translations, prettified output, model output, bodies, stdout/stderr, browser content, cache keys/digests, environments, executable paths, or URLs.
- **SEC-002:** Raw messages, stacks, paths, URLs, bodies, output, and provider-controlled error names are not retained in audit events even after attempted redaction.
- **SEC-003:** Error presentation may contribute only safe classification, numeric status, known error class, message length, and presence flags.
- **SEC-004:** The archive excludes unrelated application logs and is assembled from validated provider-audit events, the generated allowlisted manifest, and optional result rows only.
- **SEC-005:** Known credential values are represented only by fixed redaction/presence and are never read into archive generation.
- **SEC-006:** Translation/Prettify result retention is an explicit default-off exception to the normal metadata-only posture.
- The exception is limited to successful selected source/result text after best-effort redaction. It does not permit raw provider responses, credentials, sessions, prompts, model values, or Voice audio/transcript export.
- Because the user selected plaintext storage and unencrypted automatic export, UI/docs must plainly state that arbitrary embedded secrets may remain and the resulting database/archive/report must be treated as private.
- The app never uploads, opens, reveals, or sends an archive automatically.

## Failure Behavior

- **FAIL-001:** Audit emission is best-effort/fail-open. A missing/throwing logger, serialization rejection, or write failure never changes provider behavior or crosses IPC.
- **FAIL-002:** Redaction or SQLite capture failure skips only diagnostic persistence and emits a metadata-only safe cause. It never changes a successful Translation/Prettify action.
- **FAIL-003:** A row above 1 MiB is skipped rather than truncated.
- Event-builder rejection never falls back to raw logging.
- Settings purge failure keeps the relevant capture setting enabled and data visible to deletion controls.
- Archive generation failure removes partial output and does not mutate logs, diagnostic rows, settings, or provider state.
- Skill validation failure produces a report/status explaining the invalid/unsupported archive without partial untrusted extraction.

## Configuration and Operations

- **CFG-001:** Metadata-only provider audit is always on whenever normal file logging is active.
- **OPS-001:** Audit events use existing electron-log and are additionally collectible through explicit local export.
- **OPS-002:** Existing log location/rotation/retention/deletion remains authoritative.
- **OPS-003:** Audit/log rollback is code-only. Existing audit lines rotate normally; no migration is required for them.
- Diagnostics settings default off; diagnostic database migration is additive.
- On rollback, old code must continue opening `gpt-voice.sqlite3` without depending on new diagnostic tables. Rollback does not decrypt, export, or reinterpret rows.
- Application shutdown closes the shared SQLite store only after in-flight diagnostic writes/clear operations settle or fail safely.
- Documentation covers audit logging, optional plaintext result capture/redaction limits, 60-day/100 MiB/1 MiB limits, clear behavior, archive contents/formats, privacy warnings, and analysis-skill usage.

## Compatibility

- **COMP-001:** Provider results, localized errors, renderer state, IPC outcomes, retry/browser/session lifecycle, clipboard, notifications, caches, and history remain compatible.
- **COMP-002:** Superseded free-form provider-operation logs are consolidated into audit events. Distinct settings/infrastructure/application logs remain, but are not archived.
- Old free-form operation wording is not a parsing contract; the versioned event/archive schema is.
- **COMP-003:** Existing settings default new capture booleans to false. Existing transcription history rows and APIs remain unchanged.
- IPC changes are additive and update main/preload/renderer types together with trusted About/App Settings sender validation.
- Archive creation and skill analysis support Windows ZIP and Linux/macOS tar.gz.
- All new UI text is English-source localized across every existing locale; repository docs remain English.

## Acceptance Criteria

### Provider Audit

- **AC-AUTO-001:** Shared tests prove required fields, canonical single-line serialization, UTC time, opaque IDs, monotonic sequence, one terminal event, no post-terminal event, severity, unknown-provider omission, allowlist rejection, and throwing-sink fail-open behavior.
- Voice tests cover ChatGPT/OpenAI/Claude success, typed failure, exception, retry/recovery, cancellation, rate limit, contract failure, cleanup, and bounded streaming events/counters.
- Prettify tests cover all four providers, availability/model/prepare/execute, HTTP/process codes, timeout/cancel, structured-output failure, cleanup, and no duplicate terminal.
- Translation tests preserve existing codes/metadata while adding correlation/lifecycle/severity. Poll growth does not increase event count.
- Privacy canaries place unique markers in audio-adjacent data, source, prompt, transcript/result, model, credential/session/account data, URL, bodies, exceptions, argv/stdin/stdout/stderr, and environment. Captured audit logger arguments contain none.
- Registry/type tests fail when a provider lacks an audit mapping.

### Result Capture and Settings

- Settings tests cover missing/legacy/corrupt defaults, independent toggles, typed IPC, transactional save, trusted sender, enable, confirmed disable/purge, cancelled disable, purge failure, and per-category/all clear without changing toggles.
- Migration tests add strict diagnostic tables/indexes without changing transcription history.
- Capture tests cover Translation/Prettify provider success, cache hit, default-off behavior, action/provider correlation, no retroactive capture, redactor version/count, all minimum redaction classes, false-positive fixtures, redaction failure, write failure, and no provider/action behavior change.
- Limit tests use UTF-8 bytes and cover 1 MiB accept/reject boundary, 60-day expiry, 100 MiB diagnostic payload pruning, oldest-first cross-category pruning, startup/archive pruning, and no transcription-history deletion.
- Filesystem tests verify best available permissions and never log text on permission/database errors.

### Archive and About UI

- About tests cover button state/accessibility, trusted sender/URL, save-dialog parent/default/filter/extension, unique filename, cancel, duplicate-click suppression, success close+notification, failure cleanup+notification+retry, and no renderer filesystem path authority.
- Archive fixtures verify Windows ZIP and non-Windows tar.gz have identical fixed members, valid manifest/hashes, all retained valid audit events, deduplication, malformed-event counts, safe provider/runtime metadata, no unrelated log/config/session/database content, and automatic enabled-category result inclusion.
- Archive limit/cleanup tests cover fixed members, relative paths, 256 MiB cap, temporary cleanup, atomic destination, overwrite response, and injected archive/filesystem failures.
- Dependency/build tests prove archive creation uses no shell, external process, network, native postinstall, or live provider.

### Analysis Skill

- Skill package passes `quick_validate.py`; `agents/openai.yaml` matches `SKILL.md`.
- Deterministic script tests cover valid ZIP/tar.gz, bad signature, unsupported schema, hash mismatch, malformed JSONL, traversal, absolute/drive paths, symlink/hardlink/device, duplicate members, unexpected member, member/total limits, and compression bomb.
- Report fixtures prove required issue context, validation/environment/timeline/root-cause/evidence/uncertainty/recommendation sections, operation/action correlation, 200-character excerpt cap, no full text duplication, and workspace-artifact default path.
- Skill tests require no credentials, network, provider account, private fixture, code mutation, or external action.

### Project Verification

- Focused tests, `npm run typecheck`, `npm run lint`, `npm run format:check`, project unit tests, production dependency audit, and production build pass.
- No automated test uses credentials, personal profiles, private audio/text, live provider calls, or real user archives.

### Sanitized Manual Verification

- **AC-MAN-001:** With synthetic non-private inputs, exercise one success/failure per family and confirm correlation, semantic phases, terminal cause, severity, and absence of prohibited audit content.
- Verify default-off capture, independent enable, provider/cache success rows, best-effort redaction, 60-day/100 MiB/1 MiB behavior, confirmed purge, and clear actions.
- On Windows create ZIP; on Linux create tar.gz. Confirm unique default filename, cancel, success notification/About close, failure cleanup/About retry, fixed contents, and enabled-category text inclusion.
- Run the repository skill against both synthetic formats with issue context; confirm safe validation, evidence-linked report under `.artifacts/diagnostics`, minimal excerpts, and no persistent extraction.

## Revalidation and Rollback

- Revalidate provider mappings whenever a provider adds a failure code, operation, retry/recovery branch, or phase.
- Revalidate audit/archive schemas and privacy canaries whenever a field/member changes.
- Revalidate redaction patterns/version when supported credential formats change; never claim exhaustive arbitrary-secret detection.
- A new provider cannot ship without audit mapping, archive manifest coverage, and privacy tests.
- If audit changes affect provider behavior, roll back code without migrating logs.
- If diagnostic capture or export exposes prohibited non-opt-in data, disable the affected capture/export code by normal rollback; do not weaken redaction, trusted sender checks, confirmation, limits, or cleanup to keep the feature active.
