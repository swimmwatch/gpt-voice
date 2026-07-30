# Prettify Transformation Profiles — Handoff

## Completed Packets

- [`01_profile_domain_and_instructions.md`](./01_profile_domain_and_instructions.md) —
  committed as `fe3cd45`.
- [`02_catalog_persistence_and_migration.md`](./02_catalog_persistence_and_migration.md) —
  committed as `f1b4a16`.
- [`03_provider_profile_execution.md`](./03_provider_profile_execution.md) —
  committed atomically as `764a4c8`.
- [`04_selected_text_profile_orchestration.md`](./04_selected_text_profile_orchestration.md) —
  complete and intentionally uncommitted for review.

## Changed Files

- Authorization: `decisions.yaml`.
- Chooser contract: `src/shared/prettifyProfileChooser.ts`.
- Main orchestration: `src/main/services/selectedTextPrettify.ts`.
- Ownership and compatibility:
  `src/main/di/mainProcessCompositionRoot.ts`,
  `src/main/mainProcessApplication.ts`, and `src/main/shortcuts.ts`.
- Tests: `tests/main/selectedTextPrettify.test.ts`,
  `mainProcessApplication.test.ts`, and `shortcutController.test.ts`.
- Completion state: `tasks/todo.md` and this file.

## Orchestration And Privacy Evidence

- The service owns explicit `capturing`, `choosing`, and `generating` phases,
  one abortable active run, and idempotent cancellation/disposal.
- Capture restores the previous clipboard exactly once before chooser or
  provider waiting. Later close, cancellation, failure, shutdown, and provider
  completion never restore that old value.
- Chooser requests contain source plus frozen localized summaries only. Main
  retains a defensively normalized, frozen full-profile snapshot with
  instructions and validates Apply exclusively against that snapshot.
- Deferred tests prove that live-object mutation and committed catalog
  replacement cannot change an open chooser. Deleted profiles retain their
  opening semantics, newly added IDs are rejected, and later chooser/quick
  operations observe the new catalog.
- Quick apply resolves the current explicit default and shares the exact
  composer, provider, cache, result-validation, clipboard-write, notification,
  and cancellation path with chooser Apply.
- Last chooser selection exists only in process memory, is eligible only in a
  later snapshot that still contains it, and never affects quick/default
  behavior or cache identity.
- Reentry focuses the existing chooser without recapture; generation reentry is
  skipped. Late or duplicate results cannot write the clipboard.
- The current production F12 remains on the immediate default path until packet
  07. The graph-owned temporary chooser port closes without work until packet
  05 supplies the real window controller.
- Logs, notifications, normal diagnostics, and errors remain free of source,
  profile names, descriptions, instructions, and result content.

## Checks

- `selectedTextPrettify`, `shortcutController`,
  `selectedTextTranslation`, `mainProcessCompositionRoot`, and
  `mainProcessApplication` tests — passed.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk npm run format:check` — passed.
- `rtk npm run lint -- --max-warnings 0` — passed.
- `rtk git diff --check` — passed.

## Manual Gates

- Tests used deterministic synthetic source, clipboard, profile, provider,
  cache, chooser, and lifecycle fixtures only.
- Packaged Windows and Linux clipboard/selection verification remains assigned
  to packet 10.
- No live provider, credential, external endpoint, private user data,
  dependency, packaging, push, pull request, or release gate was crossed.

## Exact Next Packet

Review packet 04 while it remains uncommitted. After its commit boundary is
explicitly resolved and a separate `incremental-implementation` authorization
is given, start
[`05_chooser_window_and_ipc.md`](./05_chooser_window_and_ipc.md).

## Blockers

- None.
