# Handoff: Provider Audit Task 15 Complete

## Status

- Tasks 01–14 are committed; Task 14 is
  `7d6c4445 refactor(di): migrate preload and renderer`.
- Task 15 is implemented and verified, with all Task 15 changes left unstaged
  and uncommitted for review.

## Completed Work

- Added side-effect-free `AppConfigStore` construction, immutable
  `AppConfigSnapshot` values, injected paths/filesystem/fingerprint/logger/
  atomic-write dependencies, and explicit load/save ownership.
- Preserved the config JSON shape, field-isolated normalization, fingerprint
  and hotkey migration, Translation repair notices, legacy directory migration,
  and atomic persistence behavior.
- Replaced global locale state with isolated `I18nService` instances and
  immutable locale catalogs.
- Added application-owned `CloakBrowserSettingsRepository` and
  `PrettifySettingsStorage` instances with injected filesystem, secure-storage,
  logger, and config dependencies.
- Migrated Voice, Translation, Prettify, browser, IPC, selected-text,
  transcription, shortcut, tray, and startup consumers to graph-owned config
  and localization services.
- Added persistence, migration, immutability, encrypted-settings, startup,
  composition-isolation, and stale-source-contract coverage.

## Task 15 Boundary

- Core services: `src/main/config.ts`, `src/main/i18n/index.ts`,
  `src/main/cloakBrowserSettings.ts`, and
  `src/main/services/prettifySettingsStorage.ts`.
- Composition and startup: `src/main/main.ts`,
  `src/main/mainProcessApplication.ts`, `src/main/di/`,
  `src/main/ipc.ts`, and `src/main/repositories/sqlite/appDatabase.ts`.
- Direct consumers: Voice providers/browser, Translation providers/runtime,
  Prettify providers/runtime, selected-text services, transcription,
  shortcuts, tray, launch options, and Translation settings.
- Focused tests include new `tests/main/appConfigStore.test.ts`,
  `tests/main/appConfigTestUtils.ts`, and
  `tests/main/cloakBrowserSettingsRepository.test.ts`, plus updated config,
  i18n, settings-storage, startup, composition, provider, browser,
  selected-text, controller, and renderer presentation tests.

## Checks

- Core config/localization/settings/composition set passed: 75 tests.
- Directly affected provider/browser/controller/renderer set passed: 239
  tests.
- Full unit suite passed: 952 tests.
- `npm run typecheck`, `npm run test:types`, `npm run lint`, and
  `npm run format:check` passed.
- `git diff --check` passed.

## Risks And Manual Gaps

- `APP_DIR` remains only as an immutable path bridge for the OpenAI settings
  and Claude settings/session file adapters assigned to Task 16; it owns no
  mutable state or import-time filesystem work.
- Live Electron startup, real configuration directories, secure storage,
  providers, credentials, private audio/text, and packaged smoke testing remain
  deferred manual gates.
- No dependency, IPC wire, renderer/preload contract, provider behavior,
  package, push, PR, or release change was used.

## Next Packet

- [16 Runtime adapters](16_migrate_runtime_adapters.md)
- Task 15 review and commit authorization are required before Task 16 begins.
