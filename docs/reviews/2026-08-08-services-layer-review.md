# Services Layer Review — Uncovered `src/main/services/**`

- **Date:** 2026-08-08
- **Branch:** `feat/local-whisper-provider`
- **Status:** **PARTIAL — interrupted mid-review; coverage limited to the files listed in Scope.**
- **Reviewer focus:** Security (child-process argument construction, clipboard handling, URL/SSRF, secrets in logs), Memory leaks, Performance (blocking sync calls in the main process), Correctness (mutex/in-progress guards, clipboard save/restore races, error swallowing, cross-platform differences)
- **Method:** Static reading of the actual source. Files were triaged by size/risk, then the top uncovered files were read in full; a small number of adjacent call sites (`src/main/logger.ts`, `src/main/main.ts`, `src/shared/diagnosticsArchive.ts`) were sampled only to resolve specific questions. Findings are marked **VERIFIED** (traced in code) or **INFERRED** (reasoned, not directly observed). No source file was modified. No tests were executed.

---

## Scope

`src/main/services/**` is ~11.9k LOC across 41 files. Three prior reviews already cover most of it; this review targets the remainder.

### Excluded — already covered by existing reviews

Per the **Scope** sections of the three prior reviews, the following `src/main/services` files were **excluded** as already covered and were **not** re-reviewed here:

- From `docs/reviews/provider-review-2026-08-08-prettify-providers.md`:
  `prettifyProviderBase.ts`, `prettifyProviders.ts`, `prettifyProviderAudit.ts`, `prettifyHttpProviders.ts`, `prettifyHttpModelContracts.ts`, `prettifyHttpReadiness.ts`, `prettifyCliProviders.ts`, `prettifyCliRunner.ts`, `prettifyClaudeCli.ts`, `prettifyCodexCli.ts`, `prettifyConnectionCheckCoordinator.ts`, `prettifyOneShotExecution.ts`, `prettifyProfileInstruction.ts`, `prettifyProfilePortability.ts`, `prettifySettingsStorage.ts`, `selectedTextPrettify.ts`, `textActionCache.ts`, `textAutomation.ts`, `selectedTextActionState.ts`
- From `docs/reviews/provider-review-2026-08-08-translation-providers.md`:
  `translation.ts`, `selectedTextTranslation.ts`
- From `docs/reviews/provider-review-2026-08-08-voice-providers.md`:
  `streamingTranscription.ts`, `transcription.ts`, `transcriptionCompletion.ts`, `transcriptionResultCache.ts`, `MainStreamingTranscriptionRejection.ts`

Note that `prettifyHttpProviders.ts` (830 LOC) **is** covered by the prettify review (findings PRETTIFY-1, PRETTIFY-2 and the per-vendor notes), and `textAutomation.ts` is covered there as well (PRETTIFY-6 — the `execFile` xdotool/wtype/osascript/powershell path with no timeout). Both were therefore skipped here.

### Reviewed in this pass (read in full)

| File                                              | LOC |
| ------------------------------------------------- | --- |
| `src/main/services/diagnosticCaptureStorage.ts`   | 453 |
| `src/main/services/diagnosticsArchiveFormat.ts`   | 376 |
| `src/main/services/diagnosticsArchive.ts`         | 291 |
| `src/main/services/cloakBrowserSettingsReset.ts`  | 282 |
| `src/main/services/diagnosticsExport.ts`          | 216 |
| `src/main/services/diagnosticCapture.ts`          | 172 |
| `src/main/services/initialProviderReadinessDeadline.ts` | 158 |
| `src/main/services/localWhisperTranscriptionDispatch.ts` | 129 |
| `src/main/services/localWhisperWavValidator.ts`   | 116 |
| `src/main/services/diagnosticTextRedactor.ts`     | 115 |

Sampled (targeted reads only, not full reviews): `src/main/logger.ts` (`readRetainedLogs`), `src/main/main.ts:294` (`removeFile` wiring), `src/shared/diagnosticsArchive.ts:1-80` (member names / limits).

### Not reviewed — see "Unreviewed / to resume"

`diagnosticsManifest.ts` (315), `diagnosticCaptureSettings.ts` (134), `localWhisperDiagnosticsArchiveReader.ts` (55), `transcriptionHistoryIpcController.ts` (49).

---

## Summary verdict

The uncovered remainder of the services layer is **the diagnostics/export subsystem plus a few small orchestrators**, and it is written to a noticeably high defensive standard: every path is a closed state machine with explicit validation, canonical-UUID checks, byte caps, compression-ratio caps, exclusive (`wx`) private temp files, and `0600` modes. **No security findings of Medium or higher were identified in the files reviewed.** There is **no `child_process`/`exec` usage, no URL construction from user input, and no SSRF surface** in any file read in this pass — those risks live entirely in the already-covered prettify/translation files. Logged metadata is restricted to enum-ish fields (`causeCode`, `providerId`, `status`, `phase`); **no secrets, no captured text, and no file paths are logged.**

The material issue is a **correctness/cross-platform defect**: the ZIP verifier hard-caps entry count at 3 while the writer and the outer inspector both permit 4 members. On Windows (the only platform that uses ZIP), a diagnostics export that contains **both** captured text actions **and** a Local Whisper snapshot will fail self-verification and abort — reported to the user only as a generic "export failed". The rest are performance findings concentrated on **synchronous zlib and synchronous log-file reads executed on the Electron main thread** during export.

**The clipboard-restore race in `selectedTextPrettify` (previously identified in an earlier session) was NOT re-verified in this pass** — `selectedTextPrettify.ts` fell in the excluded set and the review was interrupted before the cross-check could be performed. See "Unreviewed / to resume".

### Findings table

| ID          | Finding                                                                                                          | File                          | Axis                        | Severity      |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------- | ------------- |
| SERVICES-1  | ZIP verifier rejects `totalEntries > 3`, but writer/inspector allow 4 members → Windows export aborts             | `diagnosticsArchiveFormat.ts` | Correctness / Cross-platform | **High**      |
| SERVICES-2  | Synchronous zlib (`deflateRawSync`/`gunzipSync`/`inflateRawSync`) blocks the Electron main thread during export   | `diagnosticsArchiveFormat.ts` | Performance                 | Medium        |
| SERVICES-3  | `writeAndVerify` re-reads the whole archive and re-inflates every member → ~3× peak memory over archive size       | `diagnosticsArchiveFormat.ts` | Memory / Performance        | Medium        |
| SERVICES-4  | Provider-audit extraction does blocking `readFileSync` of retained logs, then splits the full text into lines      | `diagnosticsArchive.ts`       | Performance / Memory        | Medium        |
| SERVICES-5  | 17 global regex passes run over unbounded captured text **before** the 1 MiB row-size check                        | `diagnosticCaptureStorage.ts` | Performance                 | Medium        |
| SERVICES-6  | JWT-shaped redaction rule over-matches ordinary dotted tokens (domains, `1.2.3`, `foo.bar.baz`)                    | `diagnosticTextRedactor.ts`   | Correctness                 | Low           |
| SERVICES-7  | `dispose()` only runs inside `run()`'s `finally`; `cancel()`-only or never-`run()` instances leak timer + listener | `initialProviderReadinessDeadline.ts` | Memory / lifecycle  | Low           |
| SERVICES-8  | Archive-format `catch {}` collapses every failure into one opaque message, hiding SERVICES-1 from the user         | `diagnosticsArchiveFormat.ts` | Error swallowing            | Low           |
| SERVICES-9  | `selectDestination` re-prompt loop is unbounded (`for(;;)`) with no attempt cap                                    | `diagnosticsExport.ts`        | Correctness                 | Low           |
| SERVICES-10 | Overwrite-confirmation TOCTOU: `pathExists` check, then `rename` clobbers the destination unconditionally          | `diagnosticsExport.ts` / `diagnosticsArchive.ts` | Correctness | Low           |
| SERVICES-11 | All diagnostic-capture repository work is synchronous and serialized on one promise chain on the main thread       | `diagnosticCaptureStorage.ts` | Performance                 | Low           |

---

## Findings

### SERVICES-1 — ZIP verifier rejects the 4-member archive the writer is allowed to produce _(High, Correctness / Cross-platform)_ — **VERIFIED**

**Mechanism.** Three places disagree on the maximum member count:

- `diagnosticsArchiveFormat.ts:158-165` — `validateMembers` accepts `members.length` in **2..4** and builds `expectedNames` from four possible names (Manifest, AuditEvents, DiagnosticTextActions, LocalWhisperSnapshot).
- `diagnosticsArchiveFormat.ts:362-370` — `inspectDiagnosticsArchiveForVerification` accepts `members.size` in **2..4** against a four-name allowlist.
- `diagnosticsArchiveFormat.ts:224-233` — `readZipMembers` throws `Unsupported ZIP structure` when **`totalEntries > 3`**.

`DIAGNOSTICS_ARCHIVE_MEMBER_NAMES` (`src/shared/diagnosticsArchive.ts:68-73`) defines exactly four names, and `DiagnosticsArchiveService.createArchiveNow` (`diagnosticsArchive.ts:228-250`) pushes all four whenever `diagnosticRows.length > 0` **and** `localWhisperSnapshot.capture()` returns non-null. The TAR reader (`readTarGzipMembers`, `diagnosticsArchiveFormat.ts:302-341`) has **no** such entry cap — only the ZIP reader does. `getFormat()` (`diagnosticsArchive.ts:266-270`) selects `zip` **only on `win32`**.

**Failure scenario.** A Windows user with diagnostic text capture enabled (so text-action rows exist) and Local Whisper configured (so a snapshot is produced) clicks Export Diagnostics. `writeAndVerify` successfully writes a valid 4-entry ZIP, then `verify` → `readZipMembers` throws on the `totalEntries > 3` check. The `catch` at `diagnosticsArchiveFormat.ts:116` rethrows `Diagnostics archive creation failed`; `createArchiveNow`'s `finally` deletes the temp file; the user sees only the generic "export failed" notification. **Diagnostics export is unconditionally broken on Windows for exactly the configuration where it is most needed** (Local Whisper troubleshooting with capture on). Linux/macOS are unaffected because they take the TAR path.

**Suggested fix.** Raise the ZIP cap to 4 and derive it from a shared constant rather than a literal, e.g. `totalEntries > DIAGNOSTICS_ARCHIVE_MEMBER_NAME_COUNT`, so the writer's `2..4` bound and both readers' bounds cannot drift again. Add a regression test that exercises the 4-member ZIP round-trip.

---

### SERVICES-2 — Synchronous zlib on the Electron main thread _(Medium, Performance)_ — **VERIFIED**

**Mechanism.** The archive-format adapter runs three synchronous zlib calls on the main process:

- `diagnosticsArchiveFormat.ts:181` — `deflateRawSync(member.payload, { level: 9 })` in `validateMembers`, executed for **every** member at or above `MinCompressionRatioMemberBytes`, purely to compute a compression ratio.
- `diagnosticsArchiveFormat.ts:272` — `inflateRawSync(compressed)` per ZIP member during verification.
- `diagnosticsArchiveFormat.ts:306` — `gunzipSync(archiveBytes)` for the whole TAR-GZIP archive during verification.

Level-9 deflate of a multi-megabyte JSONL payload is on the order of hundreds of milliseconds to seconds. All of it happens on the thread that services IPC, window painting, the tray, and global hotkeys.

**Failure scenario.** A user with a large audit-event JSONL exports diagnostics; the whole app — including the Settings window that triggered the export and any in-flight global hotkey — freezes for the duration, and the ratio check runs the *same* compression work the archiver will redo immediately afterwards.

**Suggested fix.** Use the async `zlib` callback/promise APIs (`deflateRaw`, `gunzip`, `inflateRaw` via `node:util.promisify`), or move the whole verify step to a worker thread. The compression-ratio pre-check in particular is a pure guard and is a good candidate for deletion in favour of bounding the *post*-compression size the archiver actually produced.

---

### SERVICES-3 — Verification re-reads and re-inflates the whole archive _(Medium, Memory / Performance)_ — **VERIFIED**

**Mechanism.** `writeAndVerify` (`diagnosticsArchiveFormat.ts:114-115`) reads the just-written archive back in full (`readFile(outputPath)` → one `Buffer`), then `verify` → `inspectDiagnosticsArchiveForVerification` inflates every member into new `Buffer`s (`diagnosticsArchiveFormat.ts:272`, `330`) and holds them in a `Map` while the caller still holds the original `members` array. Peak resident memory is therefore roughly *uncompressed payloads + compressed archive bytes + re-inflated payloads* — about 3× the logical archive size, all live simultaneously in the main process.

**Failure scenario.** With `MaxTotalUncompressedBytes` worth of payload, an export briefly triples main-process heap; on a memory-constrained machine this is a hard OOM or a long GC pause on top of the SERVICES-2 stall.

**Suggested fix.** Verify streaming (hash-per-member as it is written, compare digests) instead of materialising a second full copy, or at minimum drop references to `members` before inflating, and compare digests rather than full `Buffer.equals`.

---

### SERVICES-4 — Blocking `readFileSync` of retained logs during export _(Medium, Performance / Memory)_ — **VERIFIED**

**Mechanism.** `ProviderAuditLogExtractor.extract()` (`diagnosticsArchive.ts:49-84`) iterates `this.logs.readRetainedLogs()`. That accessor (`src/main/logger.ts:117-137`) does `existsSync` + **`readFileSync(candidate.filePath, 'utf8')`** for both the current and the rotated log, returning their entire contents as strings. `extract()` then does `retainedLog.contents.split(/\r?\n/u)` — materialising an array of every line in both files — and runs an anchored regex per line, accumulating a `Set` of `operationId\0sequence` keys plus a `records` array.

The comment at `diagnosticsArchive.ts:32` states the logs are bounded to 1 MiB retained files, so the absolute size is capped; the issue is that the read is **synchronous on the main thread** and the split allocates a large transient array on top of the two full-file strings, immediately before the equally synchronous zlib work of SERVICES-2.

**Failure scenario.** Export stalls the main thread for the duration of two 1 MiB synchronous disk reads plus the line-split allocations, compounding the SERVICES-2 freeze. On a cold/networked home directory the `readFileSync` alone can be seconds.

**Suggested fix.** Add an async `readRetainedLogsAsync` used by the export path (the sync variant can stay for crash-time paths), and stream line-by-line (`readline` over a read stream) instead of `split` on the whole file.

---

### SERVICES-5 — Redaction runs over unbounded text before the row-size cap _(Medium, Performance)_ — **VERIFIED** (upstream bound: **INFERRED**)

**Mechanism.** In `DiagnosticCaptureStorage.insertNow`, redaction happens **first** (`diagnosticCaptureStorage.ts:198-199`) and the size check happens **after**, inside `prepareCapture` (`diagnosticCaptureStorage.ts:318-321`, `DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES = 1_048_576`). `DiagnosticTextRedactor.redact` (`diagnosticTextRedactor.ts:97-107`) applies **17 global regexes** in sequence, each producing a fresh string via `String.replace`, so an input of length *n* is walked and re-allocated 17 times before anything discovers it was too large to store.

Several rules use large bounded quantifiers over overlapping character classes — notably `diagnosticTextRedactor.ts:37` `(\b[a-z][a-z0-9+.-]{1,31}:\/\/)[^/\s:@]{1,1024}:[^/@\s]{1,1024}(?=@)`, where the trailing class *can* contain `:` — which admits quadratic backtracking on near-miss inputs (a URL-ish prefix with many colons and no `@`).

Whether truly unbounded input can reach here depends on the selected-text cap applied upstream in `selectedTextPrettify` / `selectedTextTranslation`; that cap was **not verified in this pass** (both files are in the excluded set). Hence the upstream-bound part is INFERRED.

**Failure scenario.** A user prettifies or translates a very large selection with diagnostic capture enabled; the main thread spends 17 full passes plus backtracking on text that is then discarded by the 1 MiB check anyway.

**Suggested fix.** Move the byte-length guard **before** redaction — reject or truncate at `DIAGNOSTIC_CAPTURE_ROW_LIMIT_BYTES` first — and tighten rule `:37` so the two classes cannot overlap on `:`.

---

### SERVICES-6 — JWT-shaped redaction rule over-matches ordinary text _(Low, Correctness)_ — **VERIFIED**

**Mechanism.** `diagnosticTextRedactor.ts:63-66` replaces any `\b[\w-]{2,2048}\.[\w-]{2,4096}\.[\w-]{2,4096}\b` with `[REDACTED]`. That shape matches far more than JWTs: `www.example.com`, `foo.bar.baz`, `1.2.3`, `com.apple.something`, `my.file.txt`, Java/Python dotted identifiers.

**Failure scenario.** Diagnostic captures of ordinary prettify/translate text lose every domain name, semantic version, dotted module path and multi-extension filename to `[REDACTED]`, and `redactionCount` is inflated accordingly — degrading exactly the diagnostic value the subsystem exists to provide, and making it harder to tell real credential redactions from noise.

**Suggested fix.** Require base64url-ish structure and a JWT header prefix (e.g. anchor on `eyJ`), and/or raise the minimum segment lengths so version strings and hostnames fall out. This is a fidelity trade-off, not a security regression — over-redaction is fail-safe.

---

### SERVICES-7 — Readiness deadline leaks its timer and abort listener when `run()` is never reached _(Low, Memory / lifecycle)_ — **VERIFIED**

**Mechanism.** `InitialProviderReadinessDeadline` arms a `setTimeout` in its constructor (`initialProviderReadinessDeadline.ts:71-76`) and optionally attaches an `abort` listener to the caller's signal (`:58-65`). Both are released **only** in `dispose()`, which is called **only** from `run()`'s `finally` (`:104-106`). `cancel()` (`:83-85`) calls `stop()`, which aborts the controller and resolves `stopPromise` but does **not** clear the timer or detach the listener.

**Failure scenario.** Any code path that constructs a deadline and then throws, returns early, or calls `cancel()` without ever awaiting `run()` leaves a 60 s timer armed and an `abort` listener attached to a caller-owned signal. The observed call sites (`cloakBrowserSettingsReset.ts:145-155`, and the translation service per the translation review) do construct-then-`run` immediately, so this is latent rather than active; but it is a footgun for the next caller, and if the caller signal is long-lived the listener outlives the operation.

**Suggested fix.** Call `dispose()` from `stop()` (after resolving `stopPromise`) so `cancel()` and the timeout path both release resources, and/or expose `dispose()` publicly so callers can use it in their own `finally`.

---

### SERVICES-8 — Archive-format failures collapse into one opaque message _(Low, Error swallowing)_ — **VERIFIED**

**Mechanism.** `writeAndVerify`'s `catch` block (`diagnosticsArchiveFormat.ts:116-131`) discards the caught error entirely and throws a fixed `new Error('Diagnostics archive creation failed')`. `DiagnosticsArchiveService.createArchive` (`diagnosticsArchive.ts:163`) then `.catch(() => ARCHIVE_CREATION_FAILURE)`, and `DiagnosticsExportService.exportNow` (`diagnosticsExport.ts:118-121`) turns that into a generic "failed" notification. Nothing is logged in between.

**Failure scenario.** SERVICES-1 (a deterministic Windows logic bug), a full disk, a permission denial, and a genuine corruption-detection event are all indistinguishable to both the user and the maintainer reading the logs — which is why SERVICES-1 could ship undetected.

**Suggested fix.** Log the underlying error (message/code only — the archive contains user text, so do not log payloads) at `warn` before normalising, keyed by a `causeCode` consistent with the rest of the diagnostics subsystem.

---

### SERVICES-9 — Unbounded destination re-prompt loop _(Low, Correctness)_ — **VERIFIED**

**Mechanism.** `selectDestination` (`diagnosticsExport.ts:142-162`) is a `for (;;)` loop: if the chosen path lacks the platform extension **and** the extension-appended path already exists, it re-opens the save dialog with `defaultPath = finalPath` and loops. There is no attempt counter and no terminal condition other than user cancellation or a selection that either already carries the extension or does not collide.

**Failure scenario.** Benign in practice — every iteration blocks on a modal native dialog, so it cannot spin — but a user who repeatedly re-selects the same extension-less colliding name has no exit other than Cancel, and a misbehaving/stubbed dialog implementation that returns a fixed path turns this into an infinite loop with no diagnostics.

**Suggested fix.** Cap the retries (e.g. 3) and return `failed` past the cap.

---

### SERVICES-10 — Overwrite-confirmation TOCTOU on the final rename _(Low, Correctness)_ — **VERIFIED**

**Mechanism.** Overwrite consent is established either by the native dialog's `showOverwriteConfirmation` property (`diagnosticsExport.ts:16-19`) or by the `pathExists(finalPath)` check at `diagnosticsExport.ts:152`. Publication happens much later, via `rename(temporaryPath, destinationPath)` (`diagnosticsArchive.ts:259`), which silently replaces whatever is at the destination.

**Failure scenario.** A file created at the destination between the consent point and the rename — a plausible window, since archive construction, compression and verification (SERVICES-2/3/4) sit in between and can take seconds — is overwritten without any confirmation.

**Suggested fix.** Low priority given the user explicitly chose the path; if tightened, re-check existence immediately before rename, or use a link/rename-if-absent sequence and re-prompt on collision.

---

### SERVICES-11 — Diagnostic capture storage is synchronous and fully serialized on the main thread _(Low, Performance)_ — **VERIFIED (shape) / INFERRED (driver)**

**Mechanism.** `DiagnosticCaptureStorage.enqueue` (`diagnosticCaptureStorage.ts:172-188`) types its work as `operation: () => Result` — **synchronous**, not `Promise<Result>`. Every repository call (`insert`, `prune`, `pruneAndPurge`, `purge`, `readForArchive`) therefore executes synchronously inside a microtask on the main thread; the promise chain provides ordering, not concurrency. `readPrunedArchiveSnapshotNow` (`:294-311`) additionally runs a full `prune` **and** a full `readForArchive` back-to-back in a single synchronous block.

The repository being a synchronous SQLite binding (better-sqlite3-style) is **INFERRED** from the sync signature; the repository file itself was not read.

**Failure scenario.** Every prettify/translate completion with capture enabled performs a synchronous DB insert (plus retention prune with a capacity cap) on the UI thread. During export, the pruned-snapshot read blocks the main thread for the length of a full-table scan, and any concurrent capture waits behind it in the queue.

**Suggested fix.** If the driver is sync-only, move the repository to a worker/utility process; otherwise make `enqueue` genuinely async. At minimum, avoid combining `prune` + `readForArchive` in one uninterruptible block.

---

## Verified sound

Confirmed correct by reading the code, in the files reviewed:

- **No shell/child-process surface.** None of the ten files reviewed uses `child_process`, `exec`, `execFile`, or `spawn`. The `execFile`-based text automation is confined to the already-covered `textAutomation.ts` (see PRETTIFY-6).
- **No URL construction and no outbound HTTP.** No `fetch`, no `new URL`, no user-derived host/path anywhere in this pass — there is no SSRF surface in the diagnostics subsystem.
- **No secrets or user text in logs.** Every log call in the reviewed files passes only enum-ish metadata: `diagnosticCaptureStorage.ts:445-448` (`causeCode`, `phase`), `diagnosticCapture.ts:162-167` (`actionType`, `causeCode`, `providerId`, `sourceKind`), `diagnosticsExport.ts:211` (`status`), `localWhisperTranscriptionDispatch.ts:122-125` (`causeCode`, `providerId`). No captured text, no file paths, no tokens.
- **Log-injection defence on captured metadata.** `isSafeOptionalMetadata` (`diagnosticCaptureStorage.ts:378-387`) rejects `\r` and `\n` and caps length at 128 — captured `contractVersion`/`targetLanguage` cannot forge log lines, which matters because the audit extractor parses logs back with an anchored line regex (`diagnosticsArchive.ts:33-35`).
- **Strict capture input validation.** `isValidInput` (`diagnosticCaptureStorage.ts:358-376`) checks source/result types, enum membership for `sourceKind`/`actionType`, canonical-UUID form for `providerOperationId`, and cross-validates provider id against action type (translation provider + target language, or known prettify provider with no target language). Generated `actionId` is re-validated against the canonical UUID pattern (`:323-324`).
- **Private temp file handling.** The archive temp path is `mkstemp`-equivalent by construction: UUID-suffixed name in the destination directory, opened with `flags: 'wx'` (exclusive create) and `mode: 0o600`, plus an explicit `chmod 0600` on non-Windows (`diagnosticsArchiveFormat.ts:92-95, 111-113`). Archive entries are written with a fixed 1980 timestamp and `0o100600` mode, so the archive leaks no mtime metadata.
- **Temp-file registry does not leak.** `DiagnosticsArchiveService.temporaryFiles` (`diagnosticsArchive.ts:156`) is deleted from only on successful removal, which would leak on ENOENT — but the wired implementation is `fs.promises.rm(filePath, { force: true })` (`src/main/main.ts:294`), which succeeds on a missing file. The set is therefore correctly drained after both the success (post-rename) and failure paths, and `shutdown()` sweeps any remainder (`diagnosticsArchive.ts:169-173`).
- **Destination path validation.** `isValidDestinationPath` (`diagnosticsArchive.ts:272-278`) requires an absolute path, rejects embedded `\0`, and rejects the filesystem root / empty basename.
- **Archive member allowlisting and bounds.** Fixed member-name allowlist with ordering enforcement and duplicate rejection (`diagnosticsArchiveFormat.ts:147-165`), per-member byte cap, a dedicated tighter cap for the Local Whisper snapshot, a total-uncompressed cap, and a compression-ratio cap (`:166-192`). The JSONL serializer independently enforces record-count, per-line and per-member byte caps (`diagnosticsArchive.ts:100-122`).
- **Archive parsers are bounds-checked and reject unsafe members.** The ZIP reader rejects encrypted entries, non-stored/non-deflate methods, multi-disk, directory entries, duplicate names, non-regular Unix modes, central/local name mismatches, and trailing-byte inconsistencies (`diagnosticsArchiveFormat.ts:224-278`); the TAR reader validates octal sizes, rejects non-regular types, directory names, duplicates, and requires exactly two terminating zero blocks with a zero tail (`:302-341`). Both are producer-side only (they verify archives this app just wrote), so zip-bomb exposure is not a real attack surface.
- **WAV validator is sound.** `validateLocalWhisperCanonicalWav` (`localWhisperWavValidator.ts:31-116`) does zero copies, checks `RIFF`/`WAVE` magic, requires the declared RIFF size to match the buffer exactly, caps chunk count at 64, uses `Number.isSafeInteger` on both `chunkDataEnd` and the padded end, verifies every chunk stays in bounds, rejects duplicate/out-of-order `fmt `/`data`, and pins format, channels, sample rate, byte rate, block align and bit depth. `hasAscii` bounds-checks its own offset. No integer-overflow or over-read path was found.
- **Single-flight and serialization guards.** `DiagnosticsExportService.activeExport` (`diagnosticsExport.ts:89-106`) correctly returns the in-flight promise for the same window, rejects a second window, checks `isDestroyed()`, and clears itself with an identity check in `finally` (so a stale completion cannot clear a newer export). `CloakBrowserSettingsResetService.queueTail` (`cloakBrowserSettingsReset.ts:56-67`) serializes saves with a chain that absorbs both settle paths. `DiagnosticCaptureStorage.enqueue` likewise never breaks its chain on rejection (`:182-186`), and `shutdown()` is idempotent via a memoized promise (`:165-170`).
- **Settings-reset rollback ordering is coherent.** `restoreAfterPersistenceFailure` (`cloakBrowserSettingsReset.ts:128-181`) releases the browser, re-reads the authoritative snapshot, re-initialises under a bounded readiness deadline, and settles the translation connection state on every branch including the `stopped` (timeout/cancel) branch. No branch was found that leaves the browser initialised without a corresponding settle.
- **Readiness deadline settlement is race-free.** `stop()` is guarded by both `completed` and `stopCause` (`initialProviderReadinessDeadline.ts:126-136`), `resolveStop` is nulled after use, and `run()`'s `Promise.race` cannot resolve twice; `createController`/`getNow` degrade safely if the injected clock throws.
- **Local Whisper dispatch ordering.** `LocalWhisperTranscriptionDispatch.transcribe` (`localWhisperTranscriptionDispatch.ts:62-128`) validates the WAV **before** any provider work, checks readiness before eligibility and eligibility **before** the cache read (so a stale/ineligible configuration cannot serve a cached result), and its catch-all maps to a renderer-safe `TRANSCRIPTION_FAILED` code rather than leaking an internal error object across IPC.
- **Diagnostic capture is genuinely default-off and fail-open.** Every entry point checks `isEnabled` first (`diagnosticCapture.ts:85, 106`), and a throwing settings service degrades to disabled rather than capturing (`:137-147`).

---

## Unreviewed / to resume

The review was interrupted. To resume, the following remain:

1. **`src/main/services/diagnosticsManifest.ts` (315 LOC)** — highest-value remaining file. It builds the manifest and `createDiagnosticArchiveRow`, and owns `getEnabledDiagnosticCaptureCategories` and the environment snapshot. Check: what environment/PII fields the snapshot embeds (hostname, username, paths, model paths), and whether `createDiagnosticArchiveRow` can pass unredacted fields through.
2. **`src/main/services/diagnosticCaptureSettings.ts` (134 LOC)** — check that `getSettings()` does not re-read from disk on every call (it is invoked per capture via `diagnosticCapture.ts:139` and per export via `diagnosticsArchive.ts:189`), and that category enablement defaults to off.
3. **`src/main/services/localWhisperDiagnosticsArchiveReader.ts` (55 LOC)** — a *consumer*-side archive reader; unlike the producer-side inspector reviewed here, this one may parse archives the app did not write, which would make zip-bomb / path-traversal handling a genuine security concern rather than a theoretical one. **Treat as the highest-risk unreviewed file on the security axis.**
4. **`src/main/services/transcriptionHistoryIpcController.ts` (49 LOC)** — IPC boundary; check argument validation and sender authentication.
5. **The `selectedTextPrettify` clipboard save/restore race previously identified in an earlier session was NOT re-verified.** `selectedTextPrettify.ts` (595 LOC) was excluded as covered by the prettify review, but that review does not enumerate a clipboard-restore race among PRETTIFY-1..7 — so the earlier finding is neither confirmed present nor confirmed fixed in current code. A resumed pass should read the clipboard save → automation → restore sequence in `selectedTextPrettify.ts` (and the parallel path in `selectedTextTranslation.ts`) and determine whether concurrent actions, or a user copy landing mid-operation, can restore a stale clipboard over newer content. **Credit: originally identified in a prior session.**
6. **Cross-platform axis is only partially covered.** X11/Wayland/macOS/Windows command differences live in `textAutomation.ts`, which is in the excluded set; the only cross-platform finding surfaced here is SERVICES-1 (Windows ZIP). A resumed pass may want to re-examine `textAutomation.ts` specifically for Wayland fallbacks even though the prettify review covers its timeout gap.
