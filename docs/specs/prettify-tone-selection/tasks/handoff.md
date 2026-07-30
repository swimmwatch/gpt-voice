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
  complete and intentionally uncommitted for review.

## Changed Files

- Authorization: `decisions.yaml`.
- Shared/config: `src/shared/hotkeys.ts` and `src/main/config.ts`.
- Main orchestration: `src/main/shortcuts.ts`,
  `services/selectedTextPrettify.ts`, and hotkey handling in `ipc.ts`.
- Settings/localization: `AppSettingsWindow.tsx` and all 11 locale catalogs;
  the existing generic `ShortcutsSection` and `HotkeyModal` render the new
  adjacent target without another enable toggle.
- Tests: hotkey/config/shortcut/selected-text/application/i18n/preload coverage,
  plus focused hotkey IPC and Settings contracts.
- Completion state: `tasks/todo.md` and this file.

## Runtime, Settings, And Privacy Evidence

- `prettifyQuick` defaults to `Ctrl+F12`; missing persisted state is repaired
  through the existing atomic config path without changing F12 or another
  accelerator.
- Only the `prettify` and `prettifyQuick` sibling pair may share F12 with
  distinct modifiers. Exact duplicates and conflicts with every other target
  retain the previous behavior.
- F12 opens/focuses the chooser and Ctrl+F12 runs the current explicit default
  windowlessly. Both share `prettifyEnabled`, recording/Translation gates,
  capture suspension, cancellation, and single-flight suppression.
- Working status and the Prettify tray icon start only when the selected-text
  service enters generation. Chooser opening, selection, close, and cancel do
  not claim provider work.
- Runtime logs contain only action target/accelerator state. Observer failures
  use content-free metadata and cannot interrupt generation.
- Existing typed IPC/preload methods carry the new target and field; no IPC
  channel, renderer privilege, provider behavior, dependency, or enable state
  was added.

## Checks

- Packet-focused hotkey, shortcut, selected-text, config, preload/IPC,
  application lifecycle, Settings, and localization tests — passed.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk npm run format:check` — passed.
- `rtk npm run lint -- --max-warnings 0` — passed.
- `rtk git diff --check` — passed.

## Manual Gates

- Packaged Windows and Linux registration/dispatch for F12 and Ctrl+F12 remains
  a Packet 10 manual gate.
- No live desktop/provider, credential, external endpoint, private user data,
  dependency, Packet 07 commit, push, pull request, packaging, or release gate
  was crossed.

## Exact Next Packet

Review Packet 07 while it remains uncommitted. After its commit boundary is
explicitly resolved and a separate `incremental-implementation` authorization
is given, start
[`08_profile_import_export_services.md`](./08_profile_import_export_services.md).

## Blockers

- None.
