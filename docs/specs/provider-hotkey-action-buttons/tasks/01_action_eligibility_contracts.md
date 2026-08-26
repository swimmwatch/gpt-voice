# 01 Action Eligibility Contracts

## Outcome

Define the small typed domain needed by the homepage and implement pure,
fail-closed Provider Lock and contextual-action derivations. The result must
express eligibility per Voice, normal Prettify, and Translation provider key;
represent bounded Pause, Resume, Stop, and provider-specific Cancel actions;
compose simultaneous reasons with logical OR; and remain independent of visual
timers, provider connection color, and persistence.

## Prerequisites

- The specification and this plan are approved, and this packet has separate
  execution authorization.
- Read `AGENTS.md`, `tasks/todo.md`, and `tasks/handoff.md`.
- Inspect `src/shared/recordingLifecycle.ts`,
  `src/shared/mainInteractionLock.ts`, `src/shared/textActionStatus.ts`,
  `src/renderer/App.tsx`, and their direct tests.

## Owned Requirements

- OUT-003, OUT-007
- SCOPE-002, SCOPE-006, SCOPE-007
- FLOW-010, FLOW-011
- ACTION-001, ACTION-003, ACTION-004, ACTION-010, ACTION-011
- LOCK-001..LOCK-013
- ARCH-007, ARCH-012, ARCH-013
- FAIL-004..FAIL-006, FAIL-009
- COMP-008
- NON-007
- AC-AUTO-005, AC-AUTO-020

## In Scope

- Bounded action identities for Voice, normal chooser Prettify, and
  Translation presentation/eligibility.
- Explicit typed eligibility input and per-action result/reason derivation.
- A provider-neutral ordered contextual-action descriptor/view-state contract
  covering Voice Pause/Resume, Stop, Cancel and Prettify/Translation Cancel.
- Unknown-snapshot, combined-reason, recovery, and complete lock-matrix tests.
- Pure contextual-action matrix tests for every Voice lifecycle and every
  selected-text owner/cancellability combination.

## Out Of Scope

- IPC, privileged dispatch, settings publication, React rendering, animation,
  CSS, timer scheduling, window sizing, demo behavior, or production `App`
  integration.
- Persisting Provider Lock or treating provider connection status as lock.
- Making `transcribing`/`retrying` cancellation live before packet 05 can
  update cancellation, abort, cleanup, and lifecycle behavior atomically.

## Task Contract

1. Add one narrowly owned shared/renderer-safe provider-home-action contract.
   It may distinguish the three homepage actions from the smaller privileged
   IPC target set introduced by packet 02; do not imply that Voice needs main
   IPC.
2. Represent every fact required by the matrix explicitly:
   - whether required hotkey/provider/enablement/activity snapshots are known;
   - process-wide main interaction lock;
   - any provider/settings save or switch;
   - Prettify model load/free activity;
   - active Voice provider availability;
   - recording lifecycle;
   - selected-text capture, chooser, generation, Translation, or cleanup;
   - the active selected-text owner and whether that owner is currently
     cancellable;
   - Prettify and Translation enablement.
3. Derive lock independently for each action. Global settings/provider/model
   transitions and selected-text work lock all three. Recording
   `starting`, `stopping`, `transcribing`, or `retrying` locks all three.
   Voice is eligible while idle, performs Pause while `recording`, and Resume
   while `paused`, provided its required authority is known and a Voice
   provider exists. Prettify/Translation require idle recording and their own
   enabled flag.
4. Unknown required state is fail-closed only for the affected action. A valid
   later snapshot may unlock it; reordered or partial events must not manufacture
   an eligible result from stale facts.
5. Model multiple reasons as a set/readonly collection or equivalent explicit
   result. Clearing one reason must leave the action locked while another is
   active. Keep this pure and deterministic; no timers or mutable singleton.
6. Do not use provider status tones (`checking`, `disconnected`, etc.) as an
   eligibility input. Existing action paths must remain able to expose their
   normal configuration/recovery failure when canonical eligibility permits.
7. Test every row of the specification matrix, pairwise/representative
   combined reasons, unknown initial state, release/reconciliation, disabled
   text actions, and Voice Pause/Resume despite the broad configuration lock
   used elsewhere in the renderer.
8. Define bounded contextual action IDs and ordered view state. The Voice list
   is exactly: none while `idle`; Cancel while `starting`; Pause, Stop, Cancel
   while `recording`; Resume, Stop, Cancel while `paused`; none while
   `stopping`; Cancel while `transcribing` or `retrying`. Prettify and
   Translation expose only their provider-specific Cancel action while that
   provider owns cancellable work. Unknown/contradictory ownership yields no
   actions.
9. Derive active visual ownership separately from eligibility: Voice owns
   `starting` through `retrying`; only active Prettify or Translation owns its
   selected-text operation; peers and ownerless/unknown locks own nothing and
   remain Disabled. Unknown or contradictory selected-text ownership fails
   closed and presses no provider.
10. Keep descriptor data semantic and presentation-safe: bounded provider,
   bounded action, availability/busy state, and stable ordering. Localized
   labels, accelerator strings, icons, callbacks, and elapsed time are injected
   or resolved by later renderer integration; no provider-specific footer JSX
   belongs in this packet.
11. Do not mutate the live `canCancelRecording` behavior unless the complete
    transcribing/retrying abort and cleanup path is also in scope. Packet 05
    owns that atomic behavior change; this packet may define/test the pure
    target matrix without wiring it into production dispatch.

## Contracts And Boundaries

- This derivation is renderer presentation/pre-dispatch policy. Main-process
  gates remain authoritative and packet 02 must reject stale requests.
- No new persisted setting, migration, provider interface, external service,
  or runtime dependency is allowed.
- Contextual actions and Provider Lock are distinct outputs: the active
  provider key may be persistently pressed/locked while its safe Cancel tile is
  available.
- Use strict TypeScript and pure functions/readonly values; no constructed
  module-level runtime instance.

## Expected Files Or Components

- Add a narrow shared action identity/eligibility type file if no existing
  shared owner fits.
- Add a renderer-owned pure Provider Lock derivation module.
- Add focused shared/renderer tests, for example
  `tests/renderer/providerHotkeyEligibility.test.ts`.
- Update existing shared lifecycle types only if required to consume their
  canonical values; do not change lifecycle behavior.

## Acceptance Criteria

- Each matrix condition yields the exact three-action eligibility result.
- Every Voice lifecycle and selected-text ownership state yields the exact
  ordered contextual-action list, with no disabled placeholders.
- Voice remains available for Pause/Resume while text actions are locked.
- Unknown state fails closed and fresh complete state reconciles safely.
- Multiple reasons compose without premature unlock.
- No visual, connection-status, or persisted value becomes action authority.
- `AC-AUTO-005` and `AC-AUTO-020` are satisfied by deterministic unit tests.

## Verification

- `rtk node --import tsx --test tests/renderer/providerHotkeyEligibility.test.ts`
- Add any directly changed shared-contract test to the same focused command.
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk git diff --check`

## Failure And Rollback

- If existing lifecycle states cannot express one matrix row, stop and return
  the conflict to planning/specification; do not invent a second lifecycle.
- Rollback is deletion/reversion of the new pure contract and focused tests;
  there is no data rollback.

## Manual Gates

- None. This packet is pure contract work.

## References

- Specification: **Provider Lock Contract**, **Contextual Provider Actions**,
  **Failure And Recovery**, `AC-AUTO-005`, and `AC-AUTO-020`.
- Required convention sections: **Code And Logging** and **Tests And
  Documentation**.

## Completion And Handoff

After checks pass, mark only packet 01 complete in `todo.md`, record changed
files/checks and packet 02 as the exact next packet in `handoff.md`, present the
packet for review, and stop. Do not commit or start packet 02 without a later
explicit invocation.
