# 03 Hotkey Action Button

## Outcome

Complete one reusable production hotkey action button with fixed 114 × 32
geometry, one complete accelerator legend, native button semantics, convincing
low-profile keyboard motion, immediate semantic unavailability, and the
required enabled-to-Disabled visual transition. Move reusable key appearance
out of demo-only ownership while keeping demo fixture styles isolated.
This packet retains the already approved provider-key design; contextual
footer actions introduced by later packets must not change this component.

## Prerequisites

- Packet 01 is complete and approved.
- Read `AGENTS.md`, `tasks/todo.md`, and `tasks/handoff.md`.
- Inspect the current uncommitted
  `src/renderer/components/HotkeyActionButton.tsx`,
  `src/renderer/styles/providerHotkeyDemo.css`, one production button/style
  precedent, renderer test conventions, and current design references.

## Owned Requirements

- OUT-001, OUT-003
- UI-004..UI-006, UI-008, UI-009, UI-015, UI-016
- FLOW-001
- MOTION-001..MOTION-014
- A11Y-001..A11Y-009
- ARCH-001
- FAIL-001
- NON-002, NON-003, NON-008
- AC-AUTO-001..AC-AUTO-004, AC-AUTO-019

## In Scope

- Reusable semantic key component/hook and shared production appearance.
- Pointer, Enter, Space, focus, pressed, locking, disabled, busy, blur, and
  reduced-motion behavior.
- Deterministic pure transition/timer state coverage without a new test
  dependency.
- Accelerator display formatting that tightens spacing around `+` independently
  from letter spacing.

## Out Of Scope

- Provider eligibility derivation, privileged dispatch, App integration,
  production row positioning, window size, footer layout, or demo fixtures.
- Homepage hotkey editing, several controls per provider, or separate keycaps
  for one accelerator.
- Contextual footer action tiles, their compact styling, icons, shortcut
  legends, provider/action descriptors, timer, or footer layout.

## Task Contract

1. Preserve one real `<button type="button">` containing exactly one complete
   accelerator string. Pointer click, Enter, and Space use the browser's native
   activation path and call the supplied action at most once.
2. Require an accessible action label supplied by the caller and combine it
   with the complete accelerator. The visible label remains only the effective
   accelerator. Support lifecycle-specific Voice labels at the caller boundary
   without hardcoding provider business logic in the component.
3. Keep geometry exactly 114 × 32 in enabled, hover, focus-visible, active,
   locking, disabled, and busy states. Depth/padding/shadow changes occur inside
   that box and cannot move adjacent layout.
4. Use the approved graphite low-profile 3D key: raised face, edge and shadow;
   depressed face with reduced depth on pointer/keyboard press; clear
   focus-visible ring; and approved darker/muted Disabled treatment with no
   error/warning color.
5. Accept semantic `disabled`/locked and `busy` input. When already enabled
   becomes locked:
   - reject pointer/Enter/Space immediately and expose unavailable semantics
     immediately;
   - retain the enabled/pressed visual treatment for nominally 110 ms so the
     mechanical cycle completes;
   - then transition color, depth, shadow, and padding;
   - reach the final Disabled appearance no later than 200 ms after the lock
     signal.
   Native disabled semantics may be immediate while a separate visual-state
   attribute retains the raised appearance during grace; final presentation
   must still be a native disabled button.
6. If the first trustworthy render is locked, render directly Disabled. If a
   lock clears before transition completion, cancel the pending transition and
   do not flash Disabled. Clear timers/pressed state on unmount, blur, lost
   pointer capture, state replacement, and interrupted/repeated input.
7. Busy is distinguishable and sets `aria-busy`; it remains semantically
   unavailable. Do not let busy/lock animations enqueue activation.
8. Under `prefers-reduced-motion: reduce`, suppress positional/depth movement
   and the delayed positional transition. Keep immediate lock and a short
   non-positional contrast/shadow state indication.
9. Preserve normal letter spacing within key names. Format visual separators
   with spaces around `+` and use word-spacing or equivalent token-aware
   styling to tighten only those spaces so long valid labels fit. Do not mutate
   the Electron accelerator stored or dispatched.
10. Isolate pure visual-state decisions/timing so `node:test` can use a fake
    clock/reducer without React Testing Library, jsdom, or another dependency.
    Use existing render/source contract techniques for semantic markup and
    fixed geometry, then leave real pointer/focus proof to packet 07.
11. Establish one shared style owner usable by production and demo. Remove the
    duplicated reusable key rules from `providerHotkeyDemo.css`; keep only
    demo container/fixture overrides there.
12. Freeze this provider-key markup, public interface, and production
    stylesheet as the baseline for packets 04 through 08. Do not add generic
    contextual-action props or reuse the three-dimensional key styling for
    footer tiles. Add a focused source/style contract assertion that later
    contextual work can verify without restyling this component.
13. Support the approved persistent active state using the same lowered
    geometry as momentary press without `aria-pressed`. It must span the full
    Voice session, identify only the active Prettify/Translation owner, keep
    Voice semantically available for Pause/Resume, render peers Disabled, and
    release only when authoritative ownership clears.

## Contracts And Boundaries

- The component owns input semantics and visual transition cleanup only. It
  does not know providers, recording, settings, selected text, clipboard,
  sessions, files, or Electron.
- Semantic lock is supplied from packet 01 and must precede visual state.
- Constants such as 114 px, 32 px, 110 ms, and 200 ms have one narrow named
  owner and are reused by implementation/tests.
- Do not add a runtime or testing dependency.

## Expected Files Or Components

- Update `src/renderer/components/HotkeyActionButton.tsx`.
- Add a pure visual-state reducer/helper or hook module if needed for controlled
  tests.
- Add a shared component stylesheet under `src/renderer/styles/` and import it
  through the established renderer style path.
- Remove shared key rules from
  `src/renderer/styles/providerHotkeyDemo.css`; retain demo-only rules.
- Add focused tests such as
  `tests/renderer/hotkeyActionButton.test.ts` and
  `tests/renderer/hotkeyActionButtonTransition.test.ts`.

## Acceptance Criteria

- One semantic 114 × 32 button contains one complete label for every example
  and long valid accelerator.
- Action plus accelerator is accessible; disabled and busy semantics are
  correct.
- Controlled-time tests prove 110 ms nominal grace, final presentation by
  200 ms, immediate rejection, cancellation, cleanup, and no layout change.
- Reduced motion removes positional/delayed motion without removing feedback.
- Demo and production import the same component appearance; demo-specific CSS
  does not leak into production globals.
- Contextual footer-action work has a separate component/style owner and does
  not alter this key's rendered output or public interface.
- `AC-AUTO-001`..`AC-AUTO-004` and `AC-AUTO-019` pass without a dependency
  addition.

## Verification

- `rtk node --import tsx --test tests/renderer/hotkeyActionButton*.test.ts`
- Run any focused stylesheet/source-contract test added for shared ownership.
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run lint -- --max-warnings 0`
- `rtk git diff --check`

## Failure And Rollback

- Any timer/blur/unmount failure must settle to the current authoritative
  semantic state; never leave a half-pressed or clickable locked key.
- If native disabled behavior prevents visible grace through existing CSS,
  separate semantic state from `data-visual-state`; do not delay behavior.
- Rollback restores the prior component/demo style ownership. There is no data
  rollback.

## Manual Gates

- None in this packet. Pointer, keyboard, focus, reduced-motion, and visual
  comparison are packet 07 gates.

## References

- `docs/design/provider-hotkey-buttons-left-aligned.png`.
- Specification: **Home-Screen Interface Contract**, **Enabled-To-Disabled
  Transition**, **Accessibility And Localization**, and
  `AC-AUTO-001`..`AC-AUTO-004`, `AC-AUTO-019`.

## Completion And Handoff

After checks pass, mark only packet 03 complete, record files/checks and packet
04 as next in `handoff.md`, present the increment for review, and stop. Do not
commit or start packet 04 without a later explicit invocation.
