# Prettify Transformation Profiles — Handoff

## Completed Packets

- Packets 01–07 are committed through `53e0d8a`.
- [`08_profile_import_export_services.md`](./08_profile_import_export_services.md) —
  committed atomically as `4efcfac`.
- [`09_settings_profile_management_exact_design.md`](./09_settings_profile_management_exact_design.md) —
  complete and intentionally uncommitted for review.

## Packet 09 Changed Files

- Authorization and completion state: `decisions.yaml`, `tasks/todo.md`, and
  this file.
- Catalog contract and trusted boundary:
  `src/shared/prettifyProfileCatalogIpc.ts`, `src/main/ipc.ts`,
  `src/main/preloadApi.ts`, and `src/renderer/types.d.ts`.
- Transactional renderer state and save integration:
  `src/renderer/prettifyProfilesDraft.ts`, `AppSettingsWindow.tsx`,
  `appSettingsUtils.ts`, validation/model helpers, and the prompt-free
  `PrettifySection.tsx`.
- Exact Settings surface:
  `src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx`.
- Localization: the English catalog, all ten non-English catalogs, and
  `src/main/i18n/prettifyProfileSettingsTranslations.ts`.
- Tests: profile reducer/surface contracts, partial-save reconciliation, and
  Settings-only catalog IPC/preload coverage.

## Implemented Contract

- Profiles use a dedicated draft/baseline reducer. CRUD, default, mixed order,
  and import are draft-only; search, dialogs, and export remain clean.
- The save coordinator attempts provider settings first, catalog second, then
  every later dirty group. Each baseline reconciles only from its own
  authoritative success, including both partial-failure directions.
- Renderer provider drafts no longer contain `prompt`; provider IPC omits it,
  while main validation still rejects stale payloads that supply it. The
  catalog-owned rollback projection remains unchanged.
- Catalog get/save/allocation channels are registered only through the exact
  live Settings sender boundary. Allocation accepts one unique IDs-only list
  of at most 200 entries and delegates to the existing process-owned allocator.
- The production section reproduces the approved mixed 72 px list, search,
  disabled reorder paths while filtering, native drag, keyboard/menu reorder,
  action matrix, editors, delete/default replacement, explicit export
  selection, and main-authoritative import preview. No row selection glyph was
  introduced.
- All mutations are disabled during an active Settings save. Profile values,
  instructions, paths, and full order arrays remain absent from logs and
  content-free failures.
- All 93 new profile-management messages are localized in every supported
  catalog with English placeholder parity; existing built-in metadata remains
  localized through its canonical keys.

## Checks

- Packet-focused renderer reducer/UI/save/model/close tests; main
  catalog/portability/IPC/preload/config/i18n tests; and shared
  catalog/portability/provider-setting tests — passed.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk npm run build:prod` — passed; existing Webpack size recommendations
  only.
- `rtk npm run format:check` — passed.
- `rtk npm run lint -- --max-warnings 0` — passed with zero warnings.
- `rtk git diff --check` — passed.

## Visual And Manual Gates

- Production renderer was exercised with synthetic, local-only data at DSF=1.
  Temporary uncommitted screenshots at 760×720, 440×520, and the 760×720
  Create editor matched the approved main/search/editor references with no
  unresolved P0–P2 difference. The persistent footer and fixed-scope helper
  remained visible, and the final browser console had zero errors or warnings.
- Packaged Windows/Linux native file dialogs, pointer drag, full menu/dialog
  matrix, screen-reader/reduced-motion behavior, long localized content, and a
  200-custom-profile stress pass remain Packet 10 manual gates.
- Only synthetic profiles and localhost assets were used. No live provider,
  credential, external endpoint, private user data, dependency, Packet 09
  commit, push, pull request, packaging, or release gate was crossed.

## Exact Next Packet

Review Packet 09 while it remains uncommitted. After its atomic commit boundary
is explicitly authorized and a separate `incremental-implementation`
authorization is recorded, start
[`10_integration_privacy_docs_and_release_readiness.md`](./10_integration_privacy_docs_and_release_readiness.md).

## Blockers

- None.
