# Prettify Transformation Profiles — Handoff

## Completed Packets

- [`01_profile_domain_and_instructions.md`](./01_profile_domain_and_instructions.md) —
  committed as `fe3cd45`.
- [`02_catalog_persistence_and_migration.md`](./02_catalog_persistence_and_migration.md) —
  committed as `f1b4a16`.

## Changed Files

- `src/main/prettifyProfileCatalogState.ts`
- `src/main/config.ts`
- `src/main/di/mainProcessCompositionRoot.ts`
- `src/main/ipc.ts`
- `src/main/mainProcessApplication.ts`
- `src/main/preloadApi.ts`
- `src/main/services/prettifySettingsStorage.ts`
- `src/shared/prettifyProfiles.ts`
- `src/shared/prettifySettings.ts`
- `src/renderer/appSettingsUtils.ts`
- `src/renderer/types.d.ts`
- `src/main/i18n/en.ts`
- `src/main/i18n/ru.ts`
- `src/main/i18n/be.ts`
- `src/main/i18n/uk.ts`
- `src/main/i18n/es.ts`
- `src/main/i18n/pt-BR.ts`
- `src/main/i18n/zh.ts`
- `src/main/i18n/ja.ts`
- `src/main/i18n/de.ts`
- `src/main/i18n/fr.ts`
- `src/main/i18n/hi.ts`
- `tests/main/prettifyProfileCatalogState.test.ts`
- `tests/main/appConfigStore.test.ts`
- `tests/main/appConfigTestUtils.ts`
- `tests/main/configPrettifySettings.test.ts`
- `tests/main/i18n.test.ts`
- `tests/main/mainProcessApplication.test.ts`
- `tests/main/prettifySettingsStorage.test.ts`
- `tests/renderer/appSettingsUtils.test.ts`
- `tests/shared/prettifySettings.test.ts`
- `docs/specs/prettify-tone-selection/tasks/todo.md`
- `docs/specs/prettify-tone-selection/tasks/handoff.md`

## Migration And Persistence

- Fresh installs persist schema version 1 with Prompt-ready as default, no
  custom profiles, and canonical built-in order.
- Existing recognized legacy defaults migrate idempotently to Polish. A custom
  legacy prompt migrates once to `Migrated Prettify prompt`, preserving its
  instruction byte-for-byte.
- Corrupt catalogs salvage valid custom profiles, normalize chooser order,
  recover invalid defaults to Prompt-ready, preserve unrelated settings, and
  queue one content-free localized startup notice.
- Catalog, default, chooser order, Translation normalization, and the legacy
  prompt projection share one atomic `config.json` write. New catalog and
  projection state publish only after persistence succeeds.
- Renderer provider saves use a prompt-free DTO; strict main/storage validation
  rejects stale `prompt`, unknown keys, accessors, symbols, and non-plain
  objects. Provider saves preserve the catalog-owned legacy projection.
- Custom profile IDs are process-owned, collision-safe UUIDs with validated
  draft/import exclusions, reservation, and bounded content-free failure.
- Config load/save failures emit stable content-free log messages so profile
  content, paths, and raw errors cannot enter runtime logs.

## Checks

- `rtk test node --import tsx --test tests/main/prettifyProfileCatalogState.test.ts` —
  passed.
- `rtk test node --import tsx --test tests/main/appConfigStore.test.ts` — passed.
- `rtk test node --import tsx --test tests/main/configPrettifySettings.test.ts` —
  passed.
- `rtk test node --import tsx --test tests/main/prettifySettingsStorage.test.ts` —
  passed.
- `rtk test node --import tsx --test tests/shared/prettifySettings.test.ts` —
  passed.
- `rtk test node --import tsx --test tests/renderer/appSettingsUtils.test.ts` —
  passed.
- `rtk test node --import tsx --test tests/main/translationSettingsStartupNotice.test.ts` —
  passed.
- `rtk test node --import tsx --test tests/main/mainProcessApplication.test.ts` —
  passed.
- `rtk test node --import tsx --test tests/main/i18n.test.ts` — passed.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk npm run format:check` — passed.
- `rtk npm run lint -- --max-warnings 0` — passed with zero warnings.
- `rtk git diff --check` — passed.

## Manual Gates

- Automated migration coverage used only deterministic in-memory and temporary
  synthetic config fixtures. No real config, live profile data, credentials,
  private prompt content, or private filesystem path was read or logged.
- The manual review against representative private copies of current config
  shapes was not crossed and remains a human-only follow-up.
- No push, pull request, installer, or release action was performed.

## Exact Next Packet

The packet 02 commit boundary is resolved. After a separate explicit
`incremental-implementation` authorization, start
[`03_provider_profile_execution.md`](./03_provider_profile_execution.md).

## Blockers

- None for packet 03 execution authorization.
