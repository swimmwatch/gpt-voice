# Handoff: Translation Providers Task 06 Complete

Status: Tasks 01–05 are committed through `93281d0`. Task 06 is implemented
and verified but remains uncommitted. Tasks 07–11 are not authorized.

## Completed Packets

- [01 Shared contracts and inventories](01_define_translation_contracts_and_inventories.md)
  - Added closed Google, Bing, and Yandex metadata with exact checked-in target
    inventories.
- [02 Base provider lifecycle](02_build_base_translate_provider_lifecycle.md)
  - Added the isolated reusable provider lifecycle, bounded pre-submit
    recovery, stable results, sanitized outcomes, and clear-or-close cleanup.
- [03 Google provider](03_migrate_google_translate_provider.md),
  [04 Bing provider](04_implement_bing_translate_provider.md), and
  [05 Yandex provider](05_implement_yandex_translate_provider.md)
  - Added deterministic unregistered public-page subclasses for all enabled
    providers.
- [06 Registry, settings, and IPC](06_add_translation_registry_settings_and_ipc.md)
  - Added exhaustive lazy provider ownership, authoritative per-provider
    settings, legacy migration, persisted repair, atomic saving, trusted typed
    IPC, a one-shot localized repair notice, and the interim renderer bridge.

## Registry And Stored Shape

- The exhaustive registry contains exactly Google, Bing, and Yandex, reuses
  the Task 01 metadata objects, creates at most one instance per ID, and has no
  unknown-ID fallback.
- Metadata listing and all settings operations create zero provider or browser
  instances.
- `config.json` now stores:

  ```json
  {
    "translationSettings": {
      "providerId": "google",
      "targetLanguageByProvider": {
        "google": "en",
        "bing": "en",
        "yandex": "en"
      }
    }
  }
  ```

- When the new key is absent, legacy `targetLang` seeds each provider only
  when that exact code is supported. Persisted provider and target fields are
  repaired independently to checked-in defaults.
- The legacy in-memory target always mirrors Google's remembered target and is
  updated only after normalized load/migration or a successful durable save.
  The legacy `targetLang` key is no longer written.

## Atomic Persistence, Notice, And IPC

- Complete config bytes are written to a same-directory mode-`0600` temporary
  file and renamed over `config.json`. Write or rename failures preserve the
  previous file and in-memory settings and remove the temporary file.
- Repair metadata contains only closed categories and known provider IDs. One
  localized generic notice is consumed after locale setup and before IPC,
  windows, or background-provider initialization.
- `get-translate-settings` returns an immutable authoritative
  `TranslationSettings` snapshot.
- `set-translate-settings` accepts one exact complete candidate and always
  returns `{ success, settings, error? }`; invalid or failed writes return the
  previous authoritative snapshot with a localized safe error.
- Preload and renderer declarations use the shared settings/result types. The
  existing language control changes only the selected provider target and
  retains its last confirmed snapshot on rejected or thrown IPC failures.

## Changed Files

- Added the translation registry, settings state/atomic writer, and renderer
  compatibility helper.
- Updated shared translation contracts, config, IPC, startup, preload,
  renderer declarations, and the minimal main-screen settings state.
- Added repair/save/validation keys to every locale dictionary and parity
  coverage.
- Added focused registry, settings, config, IPC, startup-notice, and renderer
  tests.
- Preserved the unrelated uncommitted
  `.agents/references/specification-interview.md` edit.

## Checks

- Focused Task 06 main and renderer tests passed.
- Existing `configPrettifySettings`, trusted IPC/preload contract, and
  `selectedTextTranslation` tests passed.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npm run lint` passed without warnings.
- `npm run format:check` passed.
- `git diff --check` passed.

## Exact Next Packet

- Review Task 06. The next ordered packet is
  [07 Selected-text runtime integration](07_integrate_selected_text_translation_runtime.md),
  authorized through persistent Prompt MCP question `execution.task-07`
  revision 1.

## Blockers

- None. The Task 06 commit and Task 07 execution are authorized.

## Remaining Risks

- The new registry is intentionally not used by selected-text translation
  until Task 07; legacy runtime translation still uses Google and its
  remembered target.
- The legacy persistent Google translation page remains until the Task 07
  lifecycle migration.
- No live provider or real user configuration was accessed.
