# 02 Main Action Dispatch And IPC

## Outcome

Create one process-owned canonical dispatcher for normal chooser Prettify,
Translation, and their provider-specific Cancel actions so global shortcuts,
Escape, and homepage controls share the same gates and side effects. Add
bounded trusted renderer commands plus current/saved Prettify and Translation
enablement/cancellability publication without exposing privileged data or
duplicating services.

## Prerequisites

- Packet 01 is complete and approved.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, and the **Electron And
  Providers** and **Dependency Injection And Runtime Ownership** convention
  sections.
- Inspect `ShortcutController`, its composition root, selected-text Prettify
  and Translation services, `src/main/ipc.ts`, `src/main/preloadApi.ts`,
  `src/main/preload.ts`, `src/renderer/types.d.ts`, hotkey/settings contracts,
  trusted-sender helpers, and their direct tests.

## Owned Requirements

- OUT-002, OUT-005, OUT-007
- SCOPE-002, SCOPE-003, SCOPE-007
- FLOW-003..FLOW-009
- ACTION-002, ACTION-006, ACTION-007, ACTION-009, ACTION-010
- ARCH-002, ARCH-003, ARCH-006, ARCH-008, ARCH-009, ARCH-011, ARCH-015
- SEC-001..SEC-004
- PRIV-001, PRIV-002
- FAIL-001..FAIL-003, FAIL-009
- COMP-001..COMP-003, COMP-008, COMP-009
- AC-AUTO-007..AC-AUTO-009, AC-AUTO-021, AC-AUTO-022

## In Scope

- One main-owned dispatcher for normal chooser Prettify, Translation, and
  provider-specific cancellation.
- Global-shortcut/Escape delegation to that dispatcher.
- Exact renderer-to-preload-to-main start/cancel commands and decoders.
- Trusted main-frame validation and stale-action rejection.
- Typed Prettify/Translation enablement, active-owner, and cancellability
  snapshot/change publication sufficient for fail-closed tile derivation.
- Focused dispatcher, concurrency, IPC, preload, and settings-change tests.

## Out Of Scope

- Voice click IPC; Voice stays in renderer recording orchestration.
- Quick default-profile Prettify, Voice Stop/Cancel/Retry, hotkey persistence,
  or default accelerator changes.
- React/CSS/window/demo changes or any new dependency/schema/migration.

## Task Contract

1. Introduce a stateful main-process action dispatcher constructed by the
   existing composition root with complete injected dependencies. Its bounded
   public targets are exactly normal chooser Prettify start, Translation start,
   Prettify Cancel, and Translation Cancel.
2. Move or delegate the existing `ShortcutController` entry logic so both the
   configured global shortcut and renderer command call the same dispatcher
   method. Preserve enablement, recording/main-interaction gates, selected-text
   capture, chooser behavior for the global shortcut, single-flight ownership,
   clipboard restoration, tray/status/notification presentation,
   cancellation, timeout, provider failures, and cleanup.
3. Homepage repeated Prettify activation while its chooser/action is active is
   rejected before reentry and must not refocus the chooser. Preserve the
   existing configured global shortcut's compatible refocus behavior by
   passing a typed invocation source/policy into the dispatcher rather than
   forking the underlying operation.
4. Define a small shared command DTO with exact bounded provider and action
   identity. The decoder rejects non-objects, missing/extra fields, malformed
   values, Voice, quick Prettify, cross-provider action pairs, unknown strings,
   and renderer legend/icon/accelerator text. Main reads current ownership,
   configuration, and eligibility at dispatch time.
5. Register the command only through the existing trusted main-renderer IPC
   boundary. Validate the live main window, exact main frame, sender identity,
   URL, and payload before reaching the dispatcher. Subframes, supporting
   windows, stale windows, and malformed/unknown targets must fail safely.
6. Extend the general preload API and renderer declaration together with one
   typed method. Do not expose raw IPC, Electron, selected text, clipboard,
   provider sessions/secrets, audio, transcript, filesystem, or process data.
7. Publish current Prettify and Translation enablement to the main renderer and
   emit a sanitized typed change after a successful App Settings save. Reuse
   canonical text-action settings normalization. Failed/conflicting saves keep
   the last authoritative snapshot; renderer reload can query a fresh one.
8. Publish the minimum sanitized action-specific ownership/cancellability
   needed to render one Prettify or Translation Cancel tile. A broad activity
   boolean may fail closed but cannot authorize Cancel. Reordered, stale, or
   contradictory state renders no tile and main still rejects the command.
9. Route the existing Escape fallback for Prettify and Translation through the
   same provider-specific dispatcher cancellation methods as footer clicks.
   Preserve recording-first Escape priority. A Prettify cancel can never fall
   through to or cancel Translation, and vice versa.
10. Keep main-interaction lock process-wide. A stale renderer request during a
   lock, selected-text work, disabled action, recording conflict, or shutdown
   is rejected even if the renderer still looks enabled during packet 03's
   visual grace period.
11. Add focused tests for exact decode/trust rejection, API exposure, snapshot
   and saved-change publication, shortcut/click parity, click-specific chooser
   reentry rejection, provider-specific Cancel click/Escape parity,
   owner/cancellability mismatch rejection, post-settlement rejection, mixed
   click/hotkey single flight, all existing failure cleanup, and absence of
   sensitive payload/log content.

## Contracts And Boundaries

- Main owns selected text, clipboard, provider/browser/CLI work, process-wide
  lock, single flight, and current settings. Renderer receives booleans and
  bounded provider/action state and safe action outcomes only.
- The dispatcher owns behavior; `ShortcutController` and IPC are adapters.
  Do not add a free pass-through wrapper around an existing service.
- The visual lock delay is irrelevant to this packet's exclusion guarantees.
- No new runtime dependency, provider contract, persisted field, migration,
  network request, or packaging/release change.

## Expected Files Or Components

- Add a shared bounded provider-home command/channel contract and exact guard.
- Add a main dispatcher class or refactor the existing shortcut-owned behavior
  into an equivalent process-owned class.
- Update `src/main/shortcuts.ts`, main composition/runtime ownership,
  `src/main/ipc.ts`, `src/main/preloadApi.ts`, `src/main/preload.ts`, and
  `src/renderer/types.d.ts`.
- Update `src/shared/textActionSettings.ts` only as needed for a renderer-safe
  snapshot/change type.
- Add `tests/main/providerHomeActionDispatcher.test.ts` and extend
  `tests/main/preloadApi.test.ts`,
  `tests/main/shortcutController.test.ts`,
  `tests/main/mainInteractionLockActionGate.test.ts`,
  `tests/main/hotkeyIpcContract.test.ts`, selected-text service tests, and
  `tests/shared/textActionSettings.test.ts` as applicable.

## Acceptance Criteria

- Global shortcuts and homepage commands share one guarded implementation for
  normal Prettify and Translation.
- Only an exact trusted main frame and exact valid target can dispatch.
- Repeated/locked/mixed activation cannot duplicate or enqueue work.
- Click Prettify does not refocus an active chooser; the global shortcut keeps
  its existing refocus compatibility.
- Enablement initializes and updates after successful settings save without
  renderer reload, and reload can reconcile through a fresh snapshot.
- Active cancellable Prettify and Translation can each be cancelled by their
  exact trusted tile command or Escape; owner mismatch and stale commands do
  nothing.
- No privileged or sensitive content crosses to the renderer or logs.
- `AC-AUTO-007`..`AC-AUTO-009`, `AC-AUTO-021`, and `AC-AUTO-022` pass for this
  packet's main/IPC scope.

## Verification

- `rtk node --import tsx --test tests/main/providerHomeActionDispatcher.test.ts tests/main/hotkeyIpcContract.test.ts tests/main/preloadApi.test.ts tests/main/shortcutController.test.ts tests/main/mainInteractionLockActionGate.test.ts tests/main/selectedTextPrettify.test.ts tests/main/selectedTextTranslation.test.ts tests/shared/textActionSettings.test.ts`
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run lint -- --max-warnings 0`
- `rtk git diff --check`

## Failure And Rollback

- On invalid sender/payload or stale eligibility, return/reject through the
  existing safe IPC error convention and start no operation.
- On dispatch failure, retain the existing action-specific cleanup and
  presentation; do not add a second renderer-only error lifecycle.
- Rollback reverts the dispatcher/IPC adapters while preserving existing
  shortcut behavior and persisted settings. No data rollback exists.

## Manual Gates

- None in this packet. Provider-backed and desktop interaction checks belong
  to packet 08 and must not use credentials or private selected text in tests.

## References

- Specification: **Hotkey Action Behavior**, **Contextual Provider Actions**,
  **Architecture, Interfaces, And Data**, **Security And Privacy**,
  `AC-AUTO-007`..`AC-AUTO-009`, and `AC-AUTO-022`.
- Required convention sections: **Electron And Providers**, **Dependency
  Injection And Runtime Ownership**, **Code And Logging**, and **Tests And
  Documentation**.

## Completion And Handoff

After checks pass, mark only packet 02 complete, record files/checks and packet
03 as next in `handoff.md`, present the increment for review, and stop. Do not
commit or start packet 03 without a later explicit invocation.
