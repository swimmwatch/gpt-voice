# Handoff: Provider Audit Task 21 Complete

## Status

- Tasks 01–20 are committed; Task 20 is
  `36186ba5 feat(audit): build diagnostics archive core`.
- Task 21 is implemented and verified. Its corrected Audit Log changes are
  unstaged and uncommitted for review.
- The final export location is durably recorded as
  `ui.diagnostics-export-location` revision 1.

## Completed Work

- Added the closed renderer-safe `export-diagnostics` IPC contract with exact
  `saved`, `cancelled`, and `failed` results and no path or error fields.
- Added a Settings-only trusted handler that requires the current live Settings
  window ID and exact loaded frame URL after generic app-window validation.
- Added the main-owned `DiagnosticsExportService` with parented save dialogs,
  platform filenames and filters, full-suffix normalization, exact-path native
  overwrite confirmation, one active operation, archive invocation, and safe
  notifications. It never closes Settings.
- Added the functional preload method and an accessible Audit Log export action
  with synchronous duplicate suppression, busy status, and competing
  save/clear/close/export lockout.
- Restored About to its original compact informational layout so the full logo
  fits and removed all export controls and diagnostics disclosure from it.
- Added four Audit Log export strings and four notification strings to `en`,
  `be`, `de`, `es`, `fr`, `hi`, `ja`, `pt-BR`, `ru`, `uk`, and `zh`.

## Changed Files

- Shared, main service, and process graph:
  `src/shared/diagnosticsArchive.ts`,
  `src/main/services/diagnosticsExport.ts`, `src/main/window.ts`,
  `src/main/ipc.ts`, `src/main/main.ts`,
  `src/main/di/mainProcessCompositionRoot.ts`, and
  `src/main/di/mainProcessRuntimeFactory.ts`.
- Preload and renderer:
  `src/main/preloadApi.ts`, `src/renderer/types.d.ts`,
  `src/renderer/AppSettingsWindow.tsx`, and
  `src/renderer/components/settings/AuditLogSection.tsx`.
- Localization:
  `src/main/i18n/en.ts`, `be.ts`, `de.ts`, `es.ts`, `fr.ts`, `hi.ts`,
  `ja.ts`, `pt-BR.ts`, `ru.ts`, `uk.ts`, and `zh.ts`.
- Coverage:
  `tests/main/diagnosticCaptureIpcContract.test.ts`,
  `tests/main/diagnosticsExportFlow.test.ts`,
  `tests/main/diagnosticsExportIpc.test.ts`,
  `tests/main/windowManager.test.ts`,
  `tests/main/mainProcessCompositionRoot.test.ts`,
  `tests/main/i18n.test.ts`,
  `tests/renderer/auditLogSettings.test.ts`, and
  `tests/renderer/aboutWindowViewState.test.ts`.
- Contract and packet state:
  `docs/specs/provider-audit-logging/decisions.yaml`, `spec.md`,
  `tasks/plan.md`, `tasks/todo.md`,
  `tasks/21_integrate_about_diagnostics_export.md`, and `tasks/handoff.md`.

## Checks

- Focused export flow, IPC, WindowManager, capture IPC, Audit Log, About layout,
  and localization coverage passed: 59 tests.
- Focused composition, application lifecycle, archive, preload, Settings
  section, and renderer-DI regression coverage passed: 30 tests.
- Full unit suite passed: 1,054 tests.
- `npm run typecheck`, `npm run test:types`, `npm run lint`,
  `npm run format:check`, `npm run build:prod`, and `git diff --check` passed.
- Injected `win32`, `linux`, and `darwin` tests cover filenames, filters,
  suffix handling, overwrite confirmation, cancellation, retry, cleanup,
  notification failure, single-flight identity, stale windows, and privacy
  canaries without renderer path authority.

## Risks And Manual Gaps

- Native Windows ZIP, Linux portal tar.gz, and macOS tar.gz dialog,
  overwrite-confirmation, notification, focus, and Settings-retention checks
  are deferred until those desktop environments are available.
- The production build retains its existing Webpack asset-size warnings; no
  build, dialog, overwrite, cleanup, notification, trust, layout, or privacy
  blocker remains in automated coverage.
- No live providers, credentials, private diagnostic rows, real user
  destinations, browser profiles, external messages, or network actions were
  used.

## Next Packet

- [22 Diagnostics analysis skill](22_create_diagnostics_analysis_skill.md)
- Task 21 must be reviewed before its commit boundary and Task 22 execution.
