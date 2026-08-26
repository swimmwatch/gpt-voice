# 04 Home Screen Action Integration

## Outcome

Integrate one production hotkey action key into each existing provider row.
Initialize and live-update provider-key plus record, Stop, and Cancel
accelerator labels and text-action ownership/enablement, derive the exact
per-action Provider Lock and contextual-action inputs, route Voice through the
existing renderer recording lifecycle, and route normal Prettify/Translation
start/cancel through packet 02 without moving existing provider status or
settings controls or changing the provider-key design.

## Prerequisites

- Packets 01..03 are complete and approved.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, and the **Electron And
  Providers** convention section.
- Inspect `src/renderer/App.tsx`, `MainToolbar`,
  `MainPrettifyProviderBand`, `TranslateSection`, the recording hook,
  main-interaction/provider/text-action subscriptions, and their direct tests.

## Owned Requirements

- OUT-001..OUT-005, OUT-007
- SCOPE-001..SCOPE-003, SCOPE-007
- UI-001, UI-004, UI-006..UI-009, UI-016
- FLOW-001..FLOW-010
- ACTION-003, ACTION-005..ACTION-007, ACTION-009, ACTION-011
- LOCK-002..LOCK-013
- A11Y-001, A11Y-002
- ARCH-003..ARCH-009, ARCH-012..ARCH-016
- FAIL-001..FAIL-006, FAIL-009
- COMP-001..COMP-003, COMP-009
- NON-001..NON-003, NON-008
- AC-AUTO-005, AC-AUTO-006, AC-AUTO-008, AC-AUTO-009

## In Scope

- Renderer initialization/subscriptions for Voice, normal Prettify,
  Translation, Stop, and Cancel effective hotkeys plus text-action enablement,
  active owner, and cancellability.
- Per-action Provider Lock input composition and safe unknown defaults.
- Action controls in the three existing row component seams.
- Voice start/pause/resume and typed Prettify/Translation command calls.
- Provider-neutral contextual-action data/callback composition for packet 05's
  footer without rendering or styling the tiles here.
- Renderer structure/state tests for label, eligibility, and dispatch updates.

## Out Of Scope

- Removing the old recording primary CTA (packet 05).
- Changing production window/footer dimensions or startup layout (packet 06).
- Demo fixture behavior (packet 07), hotkey editing, quick Prettify, or Stop
  display/activation from the Voice key.
- Contextual tile markup/CSS, timer scheduling, recording cancellation-boundary
  changes, and the footer replacement owned by packet 05.

## Task Contract

1. Extend `App` state to initialize from the complete authoritative hotkey
   snapshot and subscribe to its existing change event. Store/display exactly
   the effective Voice record, normal chooser Prettify, and Translation
   accelerators in provider rows, and retain the effective record, Stop, and
   Cancel accelerators for contextual actions. Keep the last valid effective
   values after a rejected or conflicting save; never show an unregistered
   candidate.
2. Query and subscribe to packet 02's Prettify/Translation enablement snapshot
   and successful-save change event. Until each required snapshot is known,
   use a safe presentation legend if necessary but keep that action locked.
   Unsubscribe on renderer cleanup and reconcile from fresh snapshots after
   reload.
3. Reconcile packet 02's action-specific selected-text owner/cancellability
   with the existing broad activity signal. Unknown, missing, reordered, or
   contradictory ownership remains fail-closed, presses no provider, and
   supplies no contextual action until a valid fresh snapshot resolves it.
4. Build packet 01's typed eligibility facts from existing authoritative
   renderer subscriptions/state: recording lifecycle, selected-text activity,
   main interaction lock, provider/settings save/switch, Prettify model
   load/free, active Voice provider, and text-action enablement. Do not pass the
   broad provider-configuration boolean unchanged to all keys.
5. Render exactly one packet-03 key through each component's existing
   `actionControl` seam:
   - Voice in `MainToolbar`;
   - normal Prettify in `MainPrettifyProviderBand`;
   - Translation in `TranslateSection`.
   Preserve selector, provider summary/status/runtime/login/settings controls,
   their order, row, dimensions, and vertical alignment.
6. Voice activation calls the same recording-hook actions already used by the
   configured toggle shortcut: start in `idle`, pause in `recording`, resume in
   `paused`, and no-op otherwise. It displays only the record accelerator and
   never calls or displays Stop. Its accessible action name changes among
   localized Start, Pause, and Resume.
7. Prettify activation sends only the bounded normal-chooser target to packet
   02. Translation sends only its bounded target. Renderer text/legend never
   selects the privileged action. Surface existing action-specific recovery or
   failure presentation; do not create simulated success.
8. Compose packet 01's contextual descriptors with localized action labels,
   effective accelerators, stable icon tokens, and bounded callbacks. Voice
   callbacks remain renderer-owned; Prettify/Translation Cancel callbacks send
   exact provider/action identities through packet 02. Do not render or style
   the footer tiles until packet 05.
9. Treat semantic Provider Lock as immediate. Repeated pointer/Enter/Space or
   mixed click/hotkey activation while locked cannot dispatch, even while
   packet 03 still renders the brief enabled appearance. Main remains the
   final stale-request authority.
10. Preserve connection/recovery behavior: `checking`, disconnected, or invalid
   provider presentation does not itself lock an otherwise canonical action.
   Preserve global shortcuts for Stop, Cancel, quick Prettify, retry, and all
   configured actions.
11. Provide full accessible action + accelerator names. For Voice, keep the
   visible legend stable while its name changes with lifecycle. Provide
   localized lock/recovery reason only where an existing actionable reason can
   be exposed without leaking data.
12. Add tests for snapshot/change initialization, rejected-save last-valid
    display, every integrated matrix input, combined reason release, all three
    action routes, Voice Pause/Resume exception, no Stop/quick-Prettify route,
    repeated-lock rejection, provider-specific cancellation descriptor/callback
    identity, stale-owner omission, Stop/Cancel legend updates, and unchanged
    provider key/status/settings structure.

## Contracts And Boundaries

- Renderer uses only `window.electronAPI`; it receives no selected text,
  clipboard content, transcript/audio, provider secret/session, filesystem,
  process, or raw Electron capability.
- Voice stays owned by the existing renderer recording lifecycle. Packet 02's
  dispatcher remains canonical for main-owned text actions.
- Label formatting is presentation-only and never changes Electron's
  accelerator string or persisted setting.
- The contextual-action model may reference packet 03's stable provider/action
  identities but must not add props, styles, or visual states to
  `HotkeyActionButton`.
- Do not change provider interfaces, settings schemas, defaults, or add a
  dependency.

## Expected Files Or Components

- Update `src/renderer/App.tsx`.
- Update `src/renderer/components/MainToolbar.tsx`,
  `MainPrettifyProviderBand.tsx`, and `TranslateSection.tsx` only as needed to
  consume the common action-control contract while preserving their grids.
- Reuse packet 01 eligibility and packet 03 key; do not fork either.
- Extend `tests/renderer/mainPrettifyProviderBand.test.ts`,
  `tests/renderer/translateSection.test.ts`, provider status/presentation tests,
  and add `tests/renderer/providerHotkeyHomeIntegration.test.ts`.
- Extend main/preload tests only if integration exposes an uncovered contract
  issue; do not reopen packet 02 behavior casually.

## Acceptance Criteria

- Each provider row renders exactly one aligned action key with the effective
  current accelerator and unchanged adjacent provider controls.
- Saved hotkeys and enablement update without reopening the main window.
- Stop/Cancel contextual legends and selected-text cancellability update from
  authoritative snapshots without hardcoded defaults or reload.
- Voice starts/pauses/resumes only; normal Prettify opens the chooser;
  Translation uses selected-text Translation; no click route invokes Stop or
  quick Prettify.
- The exact Provider Lock matrix is applied and main still rejects stale work.
- Rejected hotkey saves retain the last registered label.
- Source/style contract evidence confirms provider hotkey buttons are unchanged
  while contextual-action data remains a separate boundary.
- `AC-AUTO-005`, `006`, `008`, and `009` have integrated coverage.

## Verification

- `rtk node --import tsx --test tests/renderer/providerHotkeyHomeIntegration.test.ts tests/renderer/providerHotkeyEligibility.test.ts tests/renderer/mainPrettifyProviderBand.test.ts tests/renderer/translateSection.test.ts tests/renderer/providerStatusPresentation.test.ts`
- `rtk node --import tsx --test tests/main/providerHomeActionDispatcher.test.ts tests/main/hotkeyIpcContract.test.ts tests/main/preloadApi.test.ts tests/main/shortcutController.test.ts`
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run lint -- --max-warnings 0`
- `rtk git diff --check`

## Failure And Rollback

- Unknown/malformed initial data leaves only the affected key locked until a
  valid snapshot; it must not crash or unlock on stale events.
- A click rejection retains existing status/recovery behavior and starts no
  work. Timer state settles through packet 03.
- Rollback removes row integration and subscriptions while leaving packets
  01..03 reusable contracts intact. No data rollback exists.

## Manual Gates

- None in this packet. Production desktop action and settings-update checks are
  packet 08 gates.

## References

- Specification: **Home-Screen Interface Contract**, **Hotkey Action
  Behavior**, **Provider Lock Contract**, and **Architecture, Interfaces, And
  Data**.
- `docs/design/provider-hotkey-buttons-left-aligned.png` is visual context only;
  packet 06 owns exact full-screen geometry.

## Completion And Handoff

After checks pass, mark only packet 04 complete, record files/checks and packet
05 as next in `handoff.md`, present the increment for review, and stop. Do not
commit or start packet 05 without a later explicit invocation.
