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
  complete and intentionally uncommitted for review.

## Changed Files

- Authorization: `decisions.yaml`.
- Shared/renderer-safe contracts:
  `src/shared/prettifyProfileChooser.ts` and
  `src/renderer/prettifyProfileChooserTypes.ts`.
- Chooser window and IPC:
  `src/main/prettifyProfileChooserWindowController.ts`,
  `prettifyProfileChooserIpcRegistrar.ts`,
  `prettifyProfileChooserPreloadApi.ts`, and
  `prettifyProfileChooserPreload.ts`.
- Graph/lifecycle integration:
  `src/main/ipc.ts`, `main.ts`, `mainProcessApplication.ts`,
  `di/mainProcessCompositionRoot.ts`, and `di/mainProcessRuntimeFactory.ts`.
- Build: `webpack.config.js`.
- Tests: chooser window/IPC/preload tests plus WindowManager, general preload,
  application/composition, DI-boundary, and webpack contract updates.
- Completion state: `tasks/todo.md` and this file.

## Window, Trust, And Privacy Evidence

- The graph-owned controller provides one fixed native 620×640 chooser,
  cursor-display placement with primary fallback and constrained/tiny work-area
  bounds, dedicated sandboxed preload preferences, exact navigation guards, and
  hidden-until-payload/renderer/native readiness.
- Each operation uses a branded UUID token, frozen cloned source/summary
  payload, and private profile-ID allow-list. Reentry retains the same promise
  and payload; Apply, Cancel, Manage, native close, load failure, crash,
  unresponsive, and dispose share one exact-once terminal cleanup.
- The dedicated registrar registers only chooser-namespaced load, ready, apply,
  cancel, manage, translation-read, and locale-read channels directly on
  `MainIpcTransport`. It requires the exact live window/WebContents object and
  ID, mandatory exact frame URL, exact token, argument count, and allowed
  profile ID.
- Invalid, stale, malformed, duplicate, wrong-window, and wrong-profile calls
  use one content-free rejection and leave a valid operation unchanged.
  Generic, Settings-only, and streaming trust continue to reject the chooser;
  `WindowManager` trust and window enumeration remain unchanged.
- The chooser preload exposes only eight minimal API methods. General
  localization and preload APIs remain unchanged; locale updates are published
  only to the current chooser through its namespaced event.
- Shutdown order is selected-text cancellation, chooser disposal, IPC disposal,
  then provider shutdown. Logs and errors contain no source/profile content.
- Webpack retains three configurations, emits `dist/preload.js` and
  `dist/prettify-profile-chooser-preload.js`, and adds no chooser renderer or
  HTML before packet 06.

## Checks

- Packet-focused chooser window, IPC, preload, WindowManager, general preload,
  application/composition, webpack, DI-boundary, selected-text, and affected
  generic/Settings/streaming IPC tests — passed.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk npm run build:prod` — passed; both preload bundles emitted, with only
  existing webpack size warnings.
- `rtk npm run format:check` — passed.
- `rtk npm run lint -- --max-warnings 0` — passed.
- `rtk git diff --check` — passed.

## Manual Gates

- Tests used deterministic synthetic display, window, WebContents, token,
  source, profile, locale, IPC, and lifecycle fixtures only.
- Multi-display focus and native platform chrome verification remain assigned
  to packets 06/10.
- No live desktop/provider, credential, external endpoint, private user data,
  dependency, packaging, Packet 05 commit, push, pull request, or release gate
  was crossed.

## Exact Next Packet

Review packet 05 while it remains uncommitted. After its commit boundary is
explicitly resolved and a separate `incremental-implementation` authorization
is given, start
[`06_chooser_renderer_exact_design.md`](./06_chooser_renderer_exact_design.md).

## Blockers

- None.
