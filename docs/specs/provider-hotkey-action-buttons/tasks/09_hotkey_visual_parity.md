# 09 Hotkey Visual Parity

## Outcome

The approved deterministic 620 × 292 demo treatment is the exact visual
baseline for every production provider `HotkeyActionButton`. The Voice,
Prettify, and Translation keys continue to use one shared component and one
shared production stylesheet; no key is redesigned, moved, resized, or given a
demo-only override.

## Prerequisites

- The revised plan containing this packet is approved through Prompt MCP and
  this packet receives separate execution authorization.
- Packets 03 and 07 are complete. Read `AGENTS.md`, this packet, the current
  `tasks/todo.md`, `tasks/handoff.md`, and the **Code And Logging** and
  **Desktop, Browser, And Packaging** sections of
  `docs/agent-guides/project-conventions.md`.
- Inspect the live 620 × 292 demo and these approved visual references before
  changing source: `provider-hotkey-demo-codepen-style-final.png`,
  `provider-hotkey-demo-compact-height.png`, and
  `docs/design/provider-hotkey-buttons-left-aligned.png`.
- Use CodeGraph to inspect `HotkeyActionButton`, `ProviderHotkeyDemo`, the
  shared stylesheet, and focused renderer contract tests before editing.

## Owned Requirements

- OUT-001, OUT-003, OUT-006
- UI-004..UI-006, UI-015, UI-016, UI-022
- FLOW-001
- MOTION-001..MOTION-014
- A11Y-001..A11Y-009
- ARCH-001, FAIL-001, NON-002, NON-003, NON-008
- AC-AUTO-001..AC-AUTO-004, AC-AUTO-019, AC-AUTO-025, AC-MAN-005

## In Scope

- The shared provider-key visual layers, state selectors, and focused
  source/style contract tests.
- A visual baseline comparison at 620 × 292 for idle, hover, focus-visible,
  pointer/Enter/Space press, persistent active, locking, Disabled, busy, and
  reduced-motion states.
- A narrow documentation/handoff update for this packet only.

## Out Of Scope

- Any Hotkey public prop, rendered semantic structure, accessible name,
  hotkey/action dispatch, Provider Lock authority, lifecycle, IPC, preload,
  provider, settings, footer-tile, window-size, grid, or localization change.
- A separate demo key stylesheet, visual selector, override, or a CSS copy of
  the production key rules in `providerHotkeyDemo.css`.
- Changes to non-key Command Dock design, demo fixture behavior, dependencies,
  packaging, commits, pushes, pull requests, releases, or generated assets.

## Task Contract

1. Treat the current approved demo—not an old homepage revision or the
   CodePen reference alone—as the visual source of truth. Capture its baseline
   at 620 × 292, device scale factor 1, before modifications and compare each
   required state after them.
2. Keep `HotkeyActionButton.tsx` as the sole shared markup owner and
   `src/renderer/styles/hotkeyActionButton.css` as the sole reusable
   provider-key visual owner. The demo and production must import/render that
   same component and stylesheet. `providerHotkeyDemo.css` may arrange only
   the review surface and fixture controls; it must contain no provider-key
   visual selector or override.
3. Restore the approved graphite, inset-bevel raised-key language from the
   demo: a 114 × 32 fixed outer key with a raised face, side bevel, and visible
   graphite/black base shadow. Do not substitute a new flat, outline, pill,
   card, or separate-keycap treatment.
4. Preserve the existing internal layered press model. On pointer, Enter, or
   Space press, the key face and legend lower by exactly 3 px inside the fixed
   outer box; the side bevel compresses; and the black base shadow overlaps
   beneath the depressed key instead of visually retracting into it. Release
   uses the existing 110 ms feedback cycle. Adjacent provider status and
   settings controls must not move.
5. Preserve state parity exactly: persistent active uses the same lowered face,
   compressed bevel, overlapping shadow, and legend position as momentary
   press; locked/Disabled uses the darker graphite, pressed-equivalent lowered
   treatment with muted legend and no text shadow; Disabled and busy controls
   have no hover or click animation; focus-visible remains clear; and
   reduced-motion suppresses position/depth travel while retaining the required
   contrast/shadow feedback.
6. Preserve immediate semantic locking, native disabled behavior, delayed
   visual lock grace, input/timer cleanup, busy treatment, and every external
   component interface. A visual restoration must not alter action eligibility
   or allow a second click during Provider Lock.
7. Update/extend focused tests only to lock the shared-owner invariants and the
   approved geometry/layer/state contracts. Tests must reject a future demo
   visual fork and prove the demo/production source path remains shared; do not
   snapshot private or Electron state.

## Contracts And Boundaries

- Geometry is invariant: outer size is 114 × 32 CSS pixels in every state;
  internal motion must not resize the grid cell or the hotkey legend.
- The component remains a real `button type="button"`; pointer click, Enter,
  and Space retain one activation path and existing accessibility semantics.
- Renderer code remains capability-minimal. This packet introduces no
  `window.electronAPI` usage, IPC payload, provider request, recording,
  selected text, clipboard, audio, network, log, or persisted-data change.
- Reuse existing named constants for travel/timing/geometry. Do not add a
  dependency or global runtime state.

## Expected Files Or Components

- `src/renderer/styles/hotkeyActionButton.css` — shared visual correction only
  if live baseline comparison shows a mismatch.
- `src/renderer/components/HotkeyActionButton.tsx` — only if an existing
  internal visual layer/state hook is required to preserve the approved shared
  presentation without changing markup semantics or public props.
- `tests/renderer/hotkeyActionButton.test.ts`,
  `tests/renderer/hotkeyActionButtonTransition.test.ts`, and
  `tests/renderer/providerHotkeyDemo.test.ts` — focused visual-owner and
  state/geometry contract coverage.
- `docs/specs/provider-hotkey-action-buttons/tasks/todo.md` and `handoff.md`
  after successful verification.

## Acceptance Criteria

- Production and demo use the same shared component, markup, and reusable key
  stylesheet; demo CSS has no provider-key visual rule.
- The production Voice, Prettify, and Translation keys visually match the
  approved demo in all required states, while remaining 114 × 32 and leaving
  the provider grid and neighboring controls stationary.
- Pointer, Enter, Space, active, locking, Disabled, busy, focus-visible, and
  reduced-motion presentations retain their approved behavior and cannot leave
  a stuck depressed key.
- `AC-AUTO-001`..`AC-AUTO-004`, `AC-AUTO-019`, and `AC-AUTO-025` pass. The
  Electron visual comparison remains the Packet 08 manual gate
  `AC-MAN-005`.

## Verification

- `rtk node --import tsx --test tests/renderer/hotkeyActionButton.test.ts tests/renderer/hotkeyActionButtonTransition.test.ts tests/renderer/providerHotkeyDemo.test.ts`
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npx eslint --max-warnings 0 src/renderer/components/HotkeyActionButton.tsx src/renderer/styles/hotkeyActionButton.css tests/renderer/hotkeyActionButton.test.ts tests/renderer/hotkeyActionButtonTransition.test.ts tests/renderer/providerHotkeyDemo.test.ts`
- `rtk prettier --check src/renderer/components/HotkeyActionButton.tsx src/renderer/styles/hotkeyActionButton.css tests/renderer/hotkeyActionButton.test.ts tests/renderer/hotkeyActionButtonTransition.test.ts tests/renderer/providerHotkeyDemo.test.ts`
- `rtk git diff --check`
- Browser **MANUAL GATE:** Open `dist/provider-hotkey-demo.html` at exactly
  620 × 292 and inspect the required states at DPR 1, including reduced motion.
  Confirm document bounds, no overflow, stationary adjacent controls, no demo
  visual override, and no external/privileged requests.

## Failure And Rollback

- If a proposed change causes visual drift from the approved demo, restore the
  last matching shared stylesheet/component state; do not compensate in demo
  CSS or change production layout.
- A stuck key, changed click/keyboard dispatch, changed disabled semantics,
  changed 114 × 32 geometry, layout shift, or new visual-owner fork blocks
  completion. Revert only the packet-scoped key visual change and rerun focused
  tests; no data recovery or migration exists.

## Manual Gates

- **MANUAL GATE — AC-MAN-005 (deferred to Packet 08):** In Electron, verify
  saved Voice, normal Prettify, and Translation accelerators update in place
  and their enabled, active, and Disabled visuals match the 620 × 292 demo.
- This packet's browser comparison uses only deterministic fixtures and no
  sensitive data, credentials, live providers, private audio, selected text,
  transcript, clipboard, session, or filesystem content.

## References

- Specification: **Home-Screen Interface Contract** `UI-004`..`UI-006`,
  `UI-015`, `UI-016`, `UI-022`; **Enabled-To-Disabled Transition**
  `MOTION-001`..`MOTION-014`; and **Acceptance Criteria**
  `AC-AUTO-001`..`AC-AUTO-004`, `AC-AUTO-019`, `AC-AUTO-025`,
  `AC-MAN-005`.
- [`03_hotkey_action_button.md`](./03_hotkey_action_button.md) and
  [`07_deterministic_browser_demo.md`](./07_deterministic_browser_demo.md).
- Approved visual evidence: `provider-hotkey-demo-codepen-style-final.png`,
  `provider-hotkey-demo-compact-height.png`, and
  `docs/design/provider-hotkey-buttons-left-aligned.png`.

## Completion And Handoff

After checks and the deterministic browser gate pass, mark only Packet 09
complete. Record changed files, check results, visual comparison result, and
Packet 08 as the exact next packet in `todo.md` and `handoff.md`; present the
increment for review and stop. Do not commit or begin Packet 08 without a
later explicit `incremental-implementation` invocation and authorization.
