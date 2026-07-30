# Prettify Transformation Profiles — Handoff

## Completed Packets

- [`01_profile_domain_and_instructions.md`](./01_profile_domain_and_instructions.md) —
  committed as `fe3cd45`.
- [`02_catalog_persistence_and_migration.md`](./02_catalog_persistence_and_migration.md) —
  committed as `f1b4a16`.
- [`03_provider_profile_execution.md`](./03_provider_profile_execution.md) —
  committed atomically as `764a4c8`.
- [`04_selected_text_profile_orchestration.md`](./04_selected_text_profile_orchestration.md) —
  committed atomically as `c9bbb69`.
- [`05_chooser_window_and_ipc.md`](./05_chooser_window_and_ipc.md) —
  committed atomically as `b87f71a`.
- [`06_chooser_renderer_exact_design.md`](./06_chooser_renderer_exact_design.md) —
  committed atomically as `80d9cd6`.
- [`07_quick_apply_shortcut.md`](./07_quick_apply_shortcut.md) —
  committed atomically as `53e0d8a`.
- [`08_profile_import_export_services.md`](./08_profile_import_export_services.md) —
  complete and intentionally uncommitted for review.

## Changed Files

- Authorization and completion state: `decisions.yaml`, `tasks/todo.md`, and
  this file.
- Portable contract: `src/shared/prettifyProfilePortability.ts`.
- Main service and process wiring:
  `src/main/services/prettifyProfilePortability.ts`, composition/runtime
  factories, `main.ts`, and all 11 locale catalogs.
- Trusted renderer boundary: `src/main/ipc.ts`, `src/main/preloadApi.ts`, and
  `src/renderer/types.d.ts`.
- Tests: strict shared-document parsing/serialization, main file and merge
  flows, Settings-only IPC/preload privacy, and composition ownership.

## Contract, Merge, And Privacy Evidence

- Portable files are fatal-UTF-8 JSON with exact schema
  `gpt-voice.prettify-profiles`, version `1`, at most 200 custom records, and a
  4 MiB raw-byte limit applied before decode or parse.
- Export revalidates the complete Settings draft and explicit custom-ID
  selection, requires `confirmedPlaintext: true`, preserves selection order,
  and writes deterministic two-space JSON plus a trailing newline through an
  atomic private-mode `0o600` adapter.
- Import reads through a bounded main-owned adapter and returns only frozen
  validated records, profile-ID conflict descriptors, allowed actions, and a
  localized dual-target Replace reason. Paths, raw JSON, parser/OS details,
  profile contents, and instructions never enter logs or failure results.
- Apply revalidates the draft, records, conflicts, and decisions. Replace
  preserves the local ID and chooser position; Skip is inert; new and Rename
  profiles append in original file order. Dual-target Replace, repeated
  targets, incomplete/extra decisions, duplicate names, invalid capacity, and
  allocator exhaustion fail transactionally.
- Rename uses only `AppConfigStore.allocatePrettifyCustomProfileId`. Each call
  receives a deduplicated set of current draft IDs, retained no-conflict IDs,
  and earlier allocated IDs; the persisted/process reservation remains
  authoritative.
- Local default and every existing chooser position remain unchanged. No
  catalog persistence is performed by Packet 08.
- Channels `prettify-profile-portability:export`, `:import`, and
  `:apply-import` are registered only through
  `TrustedIpcRegistrar.handleSettingsWindow`; the chooser preload remains
  unchanged.

## Checks

- Packet-focused shared parser/serializer, main import/export/merge,
  Settings-only IPC/preload, composition, diagnostics export, catalog/config,
  and i18n tests — passed.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk npm run format:check` — passed.
- `rtk npm run lint -- --max-warnings 0` — passed.
- `rtk git diff --check` — passed.

## Manual Gates

- Packaged Windows and Linux native open/save dialog, permission, and atomic
  replacement behavior remains a Packet 10 manual gate.
- Tests used synthetic paths and profiles only. No live desktop/provider,
  credential, external endpoint, private user data, dependency, Packet 08
  commit, push, pull request, packaging, or release gate was crossed.

## Exact Next Packet

Review Packet 08 while it remains uncommitted. After its atomic commit boundary
is explicitly authorized and a separate `incremental-implementation`
authorization is given, start
[`09_settings_profile_management_exact_design.md`](./09_settings_profile_management_exact_design.md).

## Blockers

- None.
