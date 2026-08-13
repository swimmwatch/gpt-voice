# 05 Recording Footer And CTA Removal

## Outcome

Remove the large primary Record/Stop/Busy command, its dedicated band, hotkey
hint, and obsolete primary view state in every recording lifecycle state.
Replace the icon-only recording controls with the selected provider-neutral
contextual action tiles, add the captured-audio timer with status priority, and
make Voice cancellation safe during transcription and retry. Retain recording
orchestration, global shortcut subscriptions, cleanup, notifications, and
lifecycle publication, and do not change the provider hotkey buttons.

## Prerequisites

- Packets 01..04 are complete and approved.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, and the **Desktop,
  Browser, And Packaging** and **Tests And Documentation** convention sections.
- Inspect `RecordingControls`, `mainWindowViewState`, the recording hook,
  `App` shortcut subscriptions, recording/status localization, global recording
  CSS, and their direct tests.

## Owned Requirements

- OUT-004, OUT-005, OUT-007
- SCOPE-005, SCOPE-007
- UI-010, UI-012, UI-013, UI-016..UI-021
- FLOW-011, FLOW-012
- ACTION-001..ACTION-011
- LOCK-013
- DEP-001..DEP-015
- A11Y-006, A11Y-010..A11Y-012
- ARCH-013, ARCH-016, ARCH-017
- FAIL-009..FAIL-011
- COMP-001, COMP-002, COMP-008, COMP-009
- NON-004, NON-005, NON-008..NON-010
- AC-AUTO-010, AC-AUTO-011, AC-AUTO-014, AC-AUTO-017,
  AC-AUTO-019..AC-AUTO-024

## In Scope

- Status/contextual-action-only footer component/view state.
- Separate compact contextual action tile component and production stylesheet.
- Exact Voice, Prettify, and Translation contextual action rendering/click
  behavior from packet 04's descriptors.
- Voice transcription/retry cancellation and stale-result suppression.
- Captured-audio timer state, status priority, and disposal.
- Complete lifecycle labels/detail and bounded accessible status content.
- Preservation tests for recording orchestration and global shortcut events.
- Removal/audit of primary-only props, CSS, tests, and localization consumers.

## Out Of Scope

- The exact 54-pixel/footer and 620 × 292 production geometry (packet 06).
- Removing Stop, Pause, Resume, Cancel, retry, or any recording action.
- Changing recording semantics except the approved Cancel eligibility expansion
  to `transcribing`/`retrying` and captured-duration presentation.
- Redesigning or modifying `HotkeyActionButton`, provider rows, providers,
  shortcut defaults, or localization beyond contextual labels and proven dead
  primary-only keys.

## Task Contract

1. Refactor `RecordingControls` so it renders no large primary button, primary
   command band, `Record`, `Stop`, or `Busy` action, or primary hotkey hint in
   `idle`, `starting`, `recording`, `paused`, `stopping`, `transcribing`,
   `retrying`, failed, or cancelled states.
2. Retain lifecycle icon/label and live status responsibilities, but replace
   the icon-only secondary controls with one provider-neutral compact tile
   component. Each tile combines an icon and full effective shortcut legend,
   is a real pointer/Enter/Space button, has a localized action-plus-shortcut
   accessible name, and uses a new flat/compact style owner distinct from the
   three-dimensional provider-key component/style.
3. Render only packet 04's currently available ordered descriptors. Voice is
   exactly: none in `idle`; Cancel in `starting`; Pause, Stop, Cancel in
   `recording`; Resume, Stop, Cancel in `paused`; none in `stopping`; Cancel in
   `transcribing` and `retrying`. Prettify/Translation each show one Cancel
   tile only while that provider owns cancellable work. Never render Disabled
   placeholders.
4. Route every tile to the matching existing guarded action: Pause/Resume,
   Stop, and Voice Cancel stay in recording orchestration; Prettify/Translation
   Cancel use packet 02's exact provider/action commands. Repeated, stale,
   owner-mismatched, or post-settlement activation does nothing. When a focused
   tile disappears, move focus deterministically to the footer/status container
   or another explicit safe target.
5. Split/refactor `mainWindowViewState` so it models retained status, timer
   priority, and contextual descriptors only. Remove `Record`/`Stop`/`Busy`
   primary presentation from that model; do not remove recording lifecycle
   states or action methods from the recording hook.
6. Update `canCancelRecording` and every canonical caller together so Cancel is
   accepted during `starting`, `recording`, `paused`, `transcribing`, and
   `retrying`, and rejected during `idle` and `stopping`. Preserve
   recording-first Escape priority, then Prettify, then Translation.
7. Make batch and streaming transcription/retry cancellation operation-scoped
   and race-safe. User cancellation immediately invalidates the current
   recording generation, publishes the cancelled/idle terminal state, clears
   retry ownership as applicable, stops capture/streams, invokes any existing
   provider-side cancellation when supported, and suppresses late transcript,
   clipboard, history, retry, notification, status-success, or lifecycle
   publication. A too-late provider abort still settles locally as cancelled
   and cannot resurrect the operation.
8. Add a renderer-local captured-audio duration owner with an injectable
   monotonic clock/scheduler. Start at `00:00:00` for each accepted session,
   advance only during `recording`, freeze during `paused`, resume without the
   paused interval, and reset/dispose after settlement, reload, or shutdown.
   Do not persist duration or send it through privileged IPC.
9. Keep the footer center priority deterministic: higher-priority processing,
   error, retry, or recovery detail wins; otherwise show `HH:MM:SS` while
   recording/paused. The timer is non-interactive, labeled as captured-audio
   duration, and must not announce every tick. Display no byte/megabyte value,
   hidden placeholder, or accessible byte label.
10. Update `App` props only to stop feeding obsolete primary concerns and to
    supply packet 04's contextual descriptors/accelerators. Preserve global
    shortcut subscriptions and handlers for toggle/start, Stop, Pause, Resume,
    Cancel, and retry. The compact Stop tile and configured Stop shortcut share
    the same transition to `stopping`.
11. Preserve recording orchestration ownership for start, stop, pause, resume,
    cancel, retry, microphone and permission failure, streaming/batch audio,
    retryable audio, transcription submission, media cleanup, notifications,
    lifecycle publication, renderer reload, and shutdown, except for the
    explicitly expanded cancellation boundary.
12. Keep idle footer guidance that names the current Voice record accelerator
   when it remains part of the status contract. It updates from packet 04's
   effective value and is not a separate primary hotkey hint.
13. Bound visible detail/failure text within the eventual compact footer: no
   intrinsic growth or unbounded wrapping. Preserve the complete localized
   value for assistive technology and any existing tooltip/detail affordance.
   Do not truncate the accessible name/value.
14. Remove only CSS selectors and layout assumptions exclusively owned by the
   primary 93-pixel command band and old 142-pixel combined workspace. Packet
   06 will establish final footer geometry.
15. Audit primary-control localization keys. Remove a key only when repository
   search proves no non-obsolete consumer and locale parity remains valid.
   Lifecycle, Stop-shortcut, status, guidance, and error strings remain.
16. Replace, rather than merely delete, old tests. Keep equivalent coverage for
    every lifecycle, secondary-control visibility/callback, status detail,
    shortcut subscription/action, start/stop/pause/resume/cancel/retry,
    failure, cleanup, streaming/batch, notification, and publication path. Add
    controlled-clock timer/status-priority tests; the exact contextual action
    matrix; click/keyboard parity; focus recovery; provider-specific Cancel;
    transcribing/retrying cancel races; no megabytes; and a contract assertion
    that provider hotkey source/style/public interface did not change.

## Contracts And Boundaries

- This is a presentation replacement plus the narrowly approved Voice Cancel
  expansion; no other recording lifecycle behavior changes.
- Packet 04's Voice key is the visible Start/Pause/Resume entry; the separate
  configured Stop shortcut and compact Stop tile remain supported and are never
  shown on that provider key.
- Full status text remains accessible even when visible text is compacted.
- Contextual tile legend/icon/timer data never grants action authority. Voice
  lifecycle and packet 02's main-owned selected-text dispatcher revalidate at
  activation.
- Provider hotkey markup, CSS, dimensions, props, and motion are frozen; use a
  separate contextual tile component and stylesheet.
- No dependency, provider/settings schema, or persisted data change.

## Expected Files Or Components

- Update `src/renderer/components/RecordingControls.tsx`.
- Add a contextual action tile component and separate production stylesheet;
  do not edit the provider hotkey stylesheet for tile presentation.
- Refactor `src/renderer/mainWindowViewState.ts` to retained status/secondary
  state or replace it with a smaller contextual-action/status equivalent owner.
- Update `src/renderer/App.tsx` only for removed primary props while preserving
  all shortcut subscriptions/action callbacks.
- Update `src/shared/recordingLifecycle.ts`, `src/renderer/hooks/useRecording.ts`,
  streaming recording/transcription owners, and the typed transcription
  preload/main boundary only as required for operation-scoped
  transcribing/retrying cancellation.
- Add a renderer-local duration model/hook with injected clock/scheduler and no
  module-level mutable runtime instance.
- Remove primary-only selectors from `src/renderer/styles/globals.css`; defer
  exact final footer sizing to packet 06.
- Replace assertions in `tests/renderer/recordingControls.test.ts`,
  `tests/renderer/mainWindowViewState.test.ts`,
  `tests/renderer/recordingStatusLayout.test.ts`, and provider status tests.
- Extend existing recording hook/lifecycle/shortcut/localization tests where
  necessary to prove retained dependencies.

## Acceptance Criteria

- No primary Record/Stop/Busy control is rendered in any state.
- The exact Voice/Prettify/Translation contextual matrix renders as compact
  clickable icon-and-shortcut tiles with no Disabled placeholders or megabytes.
- Status and applicable Pause/Resume/Stop/Cancel actions remain complete,
  localized, accessible, and share their guarded shortcut paths.
- Voice cancellation from `transcribing` and `retrying` cannot publish late
  success, transcript, history, clipboard, notification, or retry work.
- Captured duration advances only during recording, freezes during pause,
  yields to higher-priority status detail, resets cleanly, and never becomes
  action authority or a tick-by-tick live announcement.
- Stop, toggle/start, pause, resume, cancel, and retry global subscriptions all
  remain active and covered.
- Recording, failure, media cleanup, streaming/batch, notification, and
  lifecycle tests retain their prior effective coverage.
- Long status content is visibly bounded but fully accessible.
- `AC-AUTO-010`, `011`, `014`, `017`, and `019`..`024` pass for this packet's
  renderer/lifecycle surface.

## Verification

- `rtk node --import tsx --test tests/renderer/recordingControls.test.ts tests/renderer/mainWindowViewState.test.ts tests/renderer/recordingStatusLayout.test.ts tests/renderer/contextualProviderActions.test.ts tests/renderer/recordingElapsedTime.test.ts tests/renderer/recordingRetryState.test.ts tests/renderer/recordingNotifications.test.ts tests/renderer/streamingRecordingWorkflow.test.ts tests/renderer/streamingTranscriptionQueue.test.ts tests/renderer/streamingTranscriptionPresentation.test.ts tests/shared/recordingLifecycle.test.ts`
- `rtk node --import tsx --test tests/main/shortcutController.test.ts tests/main/hotkeyIpcContract.test.ts tests/main/providerHomeActionDispatcher.test.ts tests/main/selectedTextPrettify.test.ts tests/main/selectedTextTranslation.test.ts`
- Run any directly affected batch/streaming transcription IPC/service tests
  needed to prove operation-scoped cancel and stale-result suppression.
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run lint -- --max-warnings 0`
- `rtk git diff --check`

## Failure And Rollback

- If a supposedly primary-only prop/key is still consumed by a retained
  shortcut/status path, keep it and narrow the removal; do not break the path.
- If compacting visible status would hide the full accessible value, stop and
  repair the status contract before packet completion.
- If a transcription backend cannot abort in flight, cancellation must still
  invalidate the local operation and suppress every late side effect; do not
  expose the tile with only a cosmetic state change.
- On timer/scheduler failure, retain recording behavior, recompute from captured
  intervals where possible, and clear the timer rather than changing lifecycle.
- Rollback restores the old presentation component/view state. No persisted
  rollback exists; also revert the expanded Cancel eligibility if its complete
  cancellation/cleanup path is rolled back.

## Manual Gates

- None here. Active Electron lifecycle and Stop-shortcut verification is a
  packet 08 manual gate.

## References

- Specification: **Contextual Provider Actions**, **Recording-Control
  Dependency Contract**, **Accessibility And Localization**, **Failure And
  Recovery**, and `AC-AUTO-010`, `011`, `014`, `017`, `019`..`024`.
- Current-state evidence `CUR-003`..`CUR-006` and `CUR-011` explains the
  dependencies but is not an implementation requirement.

## Completion And Handoff

After checks pass, mark only packet 05 complete, record files/checks and packet
06 as next in `handoff.md`, present the increment for review, and stop. Do not
commit or start packet 06 without a later explicit invocation.
