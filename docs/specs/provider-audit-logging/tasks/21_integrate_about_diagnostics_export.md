# 21 Integrate About Diagnostics Export

## Outcome

Expose packet 20's archive service through a typed, About-only trusted IPC
operation and an accessible **Export diagnostics** button. Main owns the
parented save dialog, filename and extension, filesystem authority, archive
invocation, About-window lifecycle, and localized system notifications.

## Prerequisites

- Packet 20 is complete and provides a verified main-process archive service
  supporting ZIP on Windows and tar.gz on Linux/macOS.
- Packet 20 exposes no renderer path authority and cleans every partial
  temporary output on failure.
- Existing About controller, preload API, renderer global types, and
  localization tests pass before changes.
- Run this packet only through an explicit
  `incremental-implementation` invocation. Do not begin packet 22 in the same
  invocation.

## Owned Requirements

- `UI-001`
- `UI-002`
- `UI-003`
- `COMP-003`

This packet also owns the About-specific trusted-sender enforcement required by
the approved IPC contract.

## In Scope

- A shared typed diagnostics-export result.
- A new invoke-only preload/main IPC channel.
- Validation that the sender is the current About window and exact current
  About URL, in addition to the existing generic trusted-app-window wrapper.
- A parented native save dialog with platform-specific default name, extension,
  and filter.
- Main-side duplicate-export protection.
- Accessible renderer pending state and duplicate-click suppression.
- Success/cancel/failure behavior, About close behavior, and safe localized
  system notifications.
- English-source localization across every existing locale.
- Focused controller, IPC-contract, renderer-state, notification, and
  compatibility tests.

## Out Of Scope

- Archive extraction, manifest, hashing, formats, or diagnostic database
  behavior; packet 20 owns those contracts.
- Archive analysis or report generation; packet 22 owns it.
- A renderer file chooser, renderer-provided path, filesystem API, log API,
  database API, or retained-row API.
- Automatic upload, opening/revealing the archive, copying its path, issue
  creation, remote telemetry, or network use.
- Changes to existing provider results, retries, browser/session lifecycle,
  clipboard, cache, notifications unrelated to this flow, or history.
- A log viewer, archive viewer, progress stream, or background export queue.

## Task Contract

### Typed result and IPC

- Add a shared discriminated result with exactly these public states:
  - `{ status: 'saved' }`;
  - `{ status: 'cancelled' }`;
  - `{ status: 'failed' }`.
- The result contains no path, filename, raw error, stack, manifest, log line,
  diagnostic row, or provider metadata.
- Add one preload method such as
  `exportDiagnostics(): Promise<DiagnosticsExportResult>`.
- Register the channel through the existing trusted `handle()` wrapper, then
  perform a second About-only check:
  - sender `webContents.id` equals the current About window's ID;
  - sender-frame URL equals the current About window URL exactly;
  - the window is still current and not destroyed.
- Main, Settings, History, provider-settings, stale About, wrong-frame,
  mismatched-ID, and mismatched-URL senders are rejected before dialog,
  filesystem, archive, close, or notification work.
- Rejection returns/throws only a safe generic IPC failure and never logs the
  sender URL, filesystem path, archive content, or retained text.

### Dialog and destination

- Main obtains the current About `BrowserWindow` and passes it as the parent to
  asynchronous `dialog.showSaveDialog`.
- Generate the unique default filename before opening the dialog:
  - Windows:
    `gpt-voice-diagnostics-<UTC-basic-timestamp>-<8-lowercase-hex>.zip`;
  - Linux/macOS:
    `gpt-voice-diagnostics-<UTC-basic-timestamp>-<8-lowercase-hex>.tar.gz`.
- The timestamp is UTC basic form, contains no locale/timezone/user data, and
  the random suffix is four cryptographically random bytes rendered as eight
  lowercase hexadecimal characters.
- Use a ZIP-only extension filter on Windows and a tar.gz-only filter on
  Linux/macOS. The renderer supplies neither default name nor filter.
- If the returned path omits the full platform suffix, append `.zip` or
  `.tar.gz` in main. Do not double-append case-insensitive matching suffixes.
- OS-native overwrite confirmation remains authoritative for the exact final
  path. If suffix appending changes the path and that final path already
  exists, do not overwrite it without obtaining native confirmation for that
  exact path.
- Pass the final dialog-approved path directly to packet 20. Never send it to
  renderer code or include it in logs/notifications.

### Concurrency and renderer state

- Render an accessible **Export diagnostics** button in the About action area.
- While an export promise is pending:
  - disable the button;
  - expose an accessible busy state/status;
  - prevent a second renderer invocation.
- Main also permits at most one active About export. A forged or racing second
  invocation must not open another dialog or start another archive. For the
  same still-current About window, return the exact in-flight promise so every
  caller observes the same typed result without duplicate side effects; every
  stale or different sender fails the About-only trust check.
- Pending state clears after `cancelled` or `failed`. Successful export closes
  About, so no renderer state update may be required after disposal.
- Escape/Close behavior remains compatible when no export is active. Do not
  close the About window while its modal save dialog is active through a
  duplicate renderer action.

### Outcomes

- Cancellation:
  - return `{ status: 'cancelled' }`;
  - create no archive or temporary output;
  - show no notification or error;
  - leave About open and retryable.
- Success, only after packet 20 has atomically installed and verified the
  archive:
  - return `{ status: 'saved' }`;
  - close the current About window;
  - show a localized success system notification from main.
- Failure:
- packet 20 removes partial temporary output;
  - return `{ status: 'failed' }`;
  - keep About open and retryable;
  - show a localized, safe failure system notification from main;
  - never show or log a raw error/path.
- If About closes independently while work is pending, complete or fail cleanup
  in main without addressing a replacement About window and without leaking a
  path/result.

### Localization and disclosure

- Add English-source localized strings to every existing locale module:
  `en`, `be`, `de`, `es`, `fr`, `hi`, `ja`, `pt-BR`, `ru`, `uk`, and `zh`.
- Cover button label, pending status if visible, native dialog title, success
  title/body, failure title/body, and the concise archive sensitivity warning
  presented in About.
- The warning states that exported archives are unencrypted and may contain
  enabled, best-effort-redacted Translation/Prettify text whose embedded
  secrets may not all be detected.
- Do not expose retained text or detailed manifest contents in About.

### Compatibility

- IPC changes are additive and update main, preload, shared result, and renderer
  global types together.
- Existing missing, legacy, and corrupt settings still default both capture
  booleans to `false`; this integration must not alter packet-16 persistence,
  purge, or clear semantics.
- Existing About app-info loading, Project/License links, Escape/Close behavior,
  startup-ready gate, focus handling, navigation guards, and locale broadcasts
  remain compatible.

## Contracts And Boundaries

- Renderer calls only `window.electronAPI.exportDiagnostics()` and never imports
  Electron, Node, filesystem, log, database, or archive code.
- Preload exposes the fixed no-argument method and typed result only; it does
  not expose `ipcRenderer`, channel names, paths, or callbacks for privileged
  progress.
- Main owns window identity, sender validation, dialog, path normalization,
  overwrite authority, archive creation, cleanup, close, and notification.
- The generic `isTrustedAppWindow` check is necessary but not sufficient. Add
  an About-specific guard based on the current controller identity and exact
  URL.
- The archive is local and unencrypted. This flow never uploads, opens, reveals,
  copies, or sends it automatically.

## Expected Files Or Components

- `src/shared/diagnosticsArchive.ts` for the additive export result, or the
  packet-18 shared archive contract file
- `src/main/aboutWindowController.ts` only if a focused current-window guard
  belongs there
- `src/main/window.ts` for a narrow current-About getter/guard
- `src/main/ipc.ts`
- `src/main/preload.ts`
- `src/main/electronRuntime.ts` only if a safe diagnostics notification helper
  is warranted
- `src/renderer/types.d.ts`
- `src/renderer/AboutWindow.tsx`
- `src/renderer/aboutWindowViewState.ts` or another pure helper for pending
  state when useful for deterministic tests
- `src/main/i18n/{en,be,de,es,fr,hi,ja,pt-BR,ru,uk,zh}.ts`
- `tests/main/aboutWindowController.test.ts`
- `tests/main/diagnosticsExportIpc.test.ts`
- `tests/main/diagnosticsExportFlow.test.ts`
- `tests/renderer/aboutWindowViewState.test.ts`
- `tests/main/i18n.test.ts`

Keep dialog/orchestration logic in a dependency-injected main service rather
than embedding filesystem behavior in `src/main/ipc.ts`.

## Acceptance Criteria

- Only the current About sender with its exact URL can reach the save dialog.
  Every other trusted, stale, mismatched, or wrong-frame sender is rejected
  before privileged side effects.
- Main passes the current About window as the native dialog parent.
- Windows uses a unique `.zip` default/filter; Linux and macOS use a unique
  `.tar.gz` default/filter.
- The full extension is appended exactly once when omitted, and overwrite
  confirmation applies to the actual final path.
- Renderer never sends or receives a path and has no direct filesystem/archive
  authority.
- One click starts one operation; pending UI and main-side single-flight
  protection suppress duplicate dialog/archive work.
- Cancellation has no file, notification, error, or About close.
- Success occurs only after verified atomic save, then closes the originating
  About window and shows the localized success notification.
- Failure leaves About open/retryable, shows a localized safe failure
  notification, and leaves no partial output.
- All existing locale dictionaries remain key-compatible.
- Existing About behavior and default-off diagnostic settings compatibility
  remain intact.
- Tests capture no credential, personal path, private text, live provider
  response, or real user archive.

## Verification

Run focused checks first:

```bash
rtk proxy node --import tsx --test tests/main/aboutWindowController.test.ts
rtk proxy node --import tsx --test tests/main/diagnosticsExportIpc.test.ts
rtk proxy node --import tsx --test tests/main/diagnosticsExportFlow.test.ts
rtk proxy node --import tsx --test tests/renderer/aboutWindowViewState.test.ts
rtk proxy node --import tsx --test tests/main/i18n.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm test
rtk npm run build:prod
```

Use injected `win32`, `linux`, and `darwin` values in unit tests so both archive
branches are covered on any development host.

## Failure And Rollback

- Treat dialog rejection, archive failure, notification failure, and a closed
  About window as separate safe failures; none may expose a path/raw error or
  leave the main single-flight lock stuck.
- Archive/rename failure uses packet-18 cleanup and never closes About.
- Notification failure after a successfully saved archive must not delete or
  corrupt the valid archive. The operation still returns `saved` and closes
  the originating About window; log only a safe notification-failure
  classification. A failure notification error likewise leaves the export
  result `failed` and About retryable.
- Never weaken sender validation, overwrite authority, path privacy, or cleanup
  to make a test pass.
- Rollback removes the additive channel, preload/type method, About button/state,
  and localization keys. Packet-18 core remains internal and existing About and
  settings behavior continues unchanged.

## Manual Gates

- **MANUAL GATE — Windows:** with synthetic non-private data, confirm a parented
  ZIP save dialog, unique default/filter, omitted-extension behavior, native
  overwrite confirmation, cancel, success close/notification, and
  failure/retry cleanup.
- **MANUAL GATE — Linux:** repeat with tar.gz and a supported desktop portal;
  confirm the actual returned/final path receives overwrite confirmation.
- **MANUAL GATE — macOS:** when a macOS environment is available, confirm the
  asynchronous parented tar.gz dialog and notification behavior. No current CI
  workflow performs this native check.
- Manual checks must use synthetic non-private events/text. Do not use
  credentials, personal profiles, private archives, live providers, or network
  access.
- No commit, push, pull request, release, installer publication, or external
  message is authorized.

## References

- Approved specification:
  - `# Diagnostics Archive > About Flow`
  - `# Diagnostics Archive > Safe Creation`
  - `# Security and Privacy`
  - `# Failure Behavior`
  - `# Compatibility`
  - `# Acceptance Criteria > Archive and About UI`
- `src/main/aboutWindowController.ts`
- `src/main/window.ts`
- `src/main/ipc.ts`
- `src/main/preload.ts`
- `src/renderer/types.d.ts`
- `src/renderer/AboutWindow.tsx`
- Packet 20 archive service contract.

## Completion And Handoff

1. Check only packet 21 in `tasks/todo.md`.
2. Update `tasks/handoff.md` with:
   - the exact IPC result/channel and About-only guard;
   - changed files and localization coverage;
   - focused/project checks;
   - native platform checks still outstanding;
   - any dialog, overwrite, cleanup, or notification blocker.
3. Set the exact next packet to
   `22_create_diagnostics_analysis_skill.md`.
4. Stop for review. Do not commit, start packet 22, push, or publish.
