# Handoff: Provider Audit Task 11 Complete

## Status

- Tasks 01–10 are committed; Task 10 is
  `acd6c7dc refactor(di): migrate voice and browser runtime`.
- Task 11 execution was authorized through `execution.task-11` revision 1.
- Task 11 is implemented and verified, with all Task 11 changes left unstaged
  and uncommitted for review.

## Completed Work

- Added an exhaustive `TranslationProviderFactory` and made the lazy
  `TranslationProviderRegistry` require its factory, audit, and clock.
- Made Translation browser launching, context options, page adapters, clocks,
  and sleep behavior explicit provider-factory dependencies.
- Removed the Translation audit, registry, runtime, and selected-text singleton
  exports and all default external provider dependencies.
- Added graph-owned `TranslationProviderAudit`, factory, registry,
  `TranslationRuntime`, selected-text cache, and
  `SelectedTextTranslationService` instances.
- Replaced the selected-text closure with a state-owning service class using
  constructor-injected runtime, action gate, cache, clipboard, automation,
  notification, logger, platform, and wait dependencies.
- Routed shortcut execution, IPC translation and browser-settings shutdown,
  and application quit cleanup through the graph-owned Translation runtime.
- Added isolation and source-contract coverage for factories, providers,
  runtime generations, caches, audits, IPC ownership, and removed singleton
  seams.

## Task 11 Boundary

- Translation providers and audit:
  `src/main/translateProviders/`.
- Translation services:
  `src/main/services/translation.ts` and
  `src/main/services/selectedTextTranslation.ts`.
- Composition and consumers:
  `src/main/di/`, `src/main/main.ts`,
  `src/main/mainProcessApplication.ts`, `src/main/ipc.ts`, and
  `src/main/shortcuts.ts`.
- Focused Translation, shortcut, application, composition, and audit tests.

## Checks

- Focused Translation provider, runtime, lifecycle, settings, selected-text,
  shortcut, application, composition, and Packet 01 audit tests passed.
- Full unit suite passed: 151/151 entrypoints.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `git diff --check` passed.

## Risks And Manual Gaps

- Live Translation pages, browser navigation, accounts, credentials, private
  text, packaged desktop startup, and platform-native verification remain
  deferred manual gates.
- The shared selected-text action gate and Prettify ownership remain unchanged
  for Task 12 so cross-action serialization is preserved.
- No live provider, browser, credential, private content, dependency,
  packaging, push, PR, or release action was used.

## Next Packet

- [12 Prettify DI](12_migrate_prettify_di.md)
- Review and commit authorization for Task 11 are required before Task 12
  begins.
