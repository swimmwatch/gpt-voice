# Handoff: Translation Providers Task 08 Complete

## Status

Tasks 01–07 are committed through `3a09594`. Task 08 is implemented and
verified but remains uncommitted. Tasks 09–11 are not authorized.

## Completed Packets

- [01 Shared contracts and inventories](01_define_translation_contracts_and_inventories.md)
- [02 Base provider lifecycle](02_build_base_translate_provider_lifecycle.md)
- [03 Google provider](03_migrate_google_translate_provider.md)
- [04 Bing provider](04_implement_bing_translate_provider.md)
- [05 Yandex provider](05_implement_yandex_translate_provider.md)
- [06 Registry, settings, and IPC](06_add_translation_registry_settings_and_ipc.md)
- [07 Selected-text runtime integration](07_integrate_selected_text_translation_runtime.md)
- [08 Main-screen Select controls](08_expose_translation_select_controls.md)

## Control And State Behavior

- The main translation band exposes exactly Google, Bing, and Yandex plus
  their complete reviewed inventories of 249, 179, and 118 targets.
- Provider and target values remain exact shared-metadata codes. Provider
  changes restore the remembered target and preserve every other provider's
  target.
- Settings changes show one optimistic controlled value, disable both Selects,
  and adopt only the authoritative successful snapshot. Returned failures,
  thrown IPC errors, stale completions, and unmount disposal retain or restore
  the last confirmed snapshot.
- Selection calls only `setTranslateSettings`; it does not translate, create a
  provider, navigate, authenticate, clear, or probe.

## Labels And Layout

- Language labels use `Intl.DisplayNames` for the application locale, fall back
  to checked-in provider labels for construction/lookup/blank/code-echo
  failures, and sort through `Intl.Collator` with exact-code tie breaking.
- The two text-only Radix Selects have localized accessible labels and
  typeahead item text. Flag images and DeepL/Yandex-specific UI are absent.
- Full inventories use a bounded scroll viewport. The translation band stacks
  below 439 px and preserves the existing 520×420 main-window geometry.
- Locale dictionaries have parity for provider, saving, and save-failure copy.

## Changed Files

- Updated the main renderer, translation band, translation settings state
  helper, global dock styles, and locale dictionaries.
- Added the pure translation language-option helper and focused renderer tests.
- Preserved the unrelated uncommitted
  `.agents/references/specification-interview.md` edit.

## Checks

- Focused Task 08 renderer and i18n tests passed: 5 test files.
- Full `npm test` passed: 130 tests.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npm run lint` passed without warnings.
- `npm run format:check` passed.
- `git diff --check` passed.

## Exact Next Packet

- Review Task 08. The next ordered packet is
  [09 Inventory probe engine](09_build_translation_language_probe.md), but it
  has no execution authorization.

## Blockers

- Task 08 commit and Task 09 execution are not authorized.

## Remaining Risks

- Mouse, keyboard, and narrow-window verification in the packaged application
  remains deferred to Task 11.
- Live Google, Bing, and Yandex canaries remain deferred to Task 11.
