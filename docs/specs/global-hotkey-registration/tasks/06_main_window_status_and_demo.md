# 06 Main Window Status And Demo

## Outcome

Make provider and contextual actions truthful when accelerators are null,
failed, registered, or suppressed, while preserving pointer/Enter/Space action
availability, distinct provider readiness, and exact 620 × 292 main-window
geometry. Demonstrate all registration states through deterministic,
privilege-free fixtures.

## Prerequisites

- Packets 01..05 are complete and approved for continuation.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and the
  **Electron And Providers**, **Desktop, Browser, And Packaging**, and **Tests
  And Documentation** convention sections.
- Inspect `HotkeyActionButton`, its state/style, provider-home hotkey
  integration, contextual action descriptors/components, `App`, the
  deterministic provider demo, and focused layout/accessibility tests.

## Owned Requirements

- OUT-001, OUT-005
- SCOPE-004
- UI-002..UI-007, UI-011, UI-012
- COMP-003
- QUAL-005 / AC-AUTO-005

## In Scope

- Main-window consumption of authoritative hotkey snapshots.
- Nullable provider key and contextual action legends.
- Registered/failed/suppressed/unassigned markers, tooltips, accessible names,
  and provider-readiness separation.
- Exact fixed-window layout regression coverage.
- Deterministic demo fixtures for the four states.

## Out Of Scope

- Settings mutation UX, OS registration, IPC definitions, portal/package
  identity, user documentation, and real OS manual tests.
- Provider or contextual action semantics, recording state machine, selected
  text, clipboard, notifications, or window-size changes.

## Task Contract

1. Replace settings-only/fallback-default consumption in provider-home
   integration with Packet 04's authoritative runtime state. Reconcile initial
   query/events by revision and remove every production renderer fallback to
   `DEFAULT_*_HOTKEY`.
2. `HotkeyActionButton` accepts a nullable accelerator and one registration
   snapshot entry. Presentation precedence is:
   - `Unassigned`: localized `Not assigned`, neutral marker;
   - `Failed`: configured value plus amber warning;
   - `Registered` + `Suppressed`: configured/registered value plus neutral
     pause marker;
   - `Registered` + `Enabled`: configured/registered value plus embedded
     keyboard/check marker.
     The marker remains inside the existing 114 × 32 control.
3. Registration presentation does not change product eligibility. An
   unassigned or registration-failed provider action remains a native button
   activatable by pointer, Enter, and Space whenever its provider/action gate
   permits. Existing busy/disabled/locked behavior remains authoritative.
4. Keep provider connection/readiness check as a separate indicator, tooltip,
   state, and accessible description. Its green check must never imply shortcut
   registration and registration markers must never imply provider readiness.
5. Tooltip and accessible name include product action, configured accelerator
   or localized unassigned value, registration state, and recovery action.
   Preserve existing pressed/busy/disabled semantics and focus-visible style.
6. Contextual Stop/Cancel/Pause/Resume tiles accept nullable accelerators. When
   null, render the action label plus a neutral unassigned legend, never a false
   key. The tile remains clickable and keyboard accessible under its existing
   lifecycle gate.
7. Preserve the exact 620 × 292 content/window contract, three-column provider
   grid, 114 × 32 keys, footer density, and no overflow at supported locales.
   Registration markers may not resize/reflow the grid.
8. Extend the deterministic browser demo with separate Registered, Unassigned,
   Failed, and Suppressed fixtures. Fixtures use explicit sample accelerators,
   import no Electron/preload/runtime state, make no network/external request,
   and exercise pointer/Enter/Space feedback.
9. Update only focused locale strings missed by Packet 05; maintain structural
   completeness across all eleven locales.
10. Preserve all provider click/hotkey dispatch, recording lifecycle,
    contextual action insertion/removal, and Provider Lock behavior.

## Contracts And Boundaries

- Renderer receives validated bounded snapshots only. It cannot query Electron
  globalShortcut or infer OS registration from provider state.
- `HotkeyActionButton` owns shared provider-key semantics/styles. Demo CSS must
  not fork or override production key selectors.
- Contextual tiles remain a separate component/style from provider keys.
- No runtime logs or diagnostics need user content for this presentation.

## Expected Files Or Components

- `src/renderer/useProviderHotkeyHomeIntegration.ts`
- `src/renderer/components/HotkeyActionButton.tsx`
- `src/renderer/hotkeyActionButtonState.ts`
- `src/renderer/styles/hotkeyActionButton.css`
- Contextual action descriptor/component/style files directly affected
- `src/renderer/ProviderHotkeyDemo.tsx` and demo fixtures/style only as needed
- `tests/renderer/hotkeyActionButton*.test.ts`
- `tests/renderer/providerHotkeyHome*.test.ts`
- `tests/renderer/providerHotkeyDemo.test.ts`
- Relevant contextual action/layout/accessibility tests

## Acceptance Criteria

- Every presentation state renders the correct internal marker/legend without
  changing 114 × 32 key or 620 × 292 document bounds.
- Unassigned and failed in-app actions still invoke once by pointer, Enter, and
  Space when otherwise eligible.
- Provider readiness and shortcut registration cannot be confused visually or
  accessibly.
- Contextual actions show no fabricated accelerator and preserve exact action
  behavior.
- Demo is deterministic, privilege-free, packaging-isolated, and covers all
  four states.

## Verification

- `node --import tsx --test tests/renderer/hotkeyActionButton.test.ts tests/renderer/hotkeyActionButtonTransition.test.ts tests/renderer/providerHotkeyHomeIntegration.test.ts tests/renderer/providerHotkeyHomeLayout.test.ts tests/renderer/providerHotkeyDemo.test.ts`
- Relevant contextual action, accessibility, fixed-layout, and webpack demo
  isolation tests.
- `npm run typecheck`
- `npm run test:types`
- `npm run build:prod`
- Scoped ESLint and Prettier over changed source/tests/styles.
- `git diff --check`

## Failure And Rollback

- A disabled unassigned button, fabricated legend, provider-status ambiguity,
  duplicate activation, demo/runtime coupling, or any window overflow blocks
  completion.
- If markers cannot fit the existing key, simplify the internal icon/legend;
  do not enlarge the key, grid, footer, or window.
- Rollback restores prior presentation only if null remains safe and no legacy
  default is reintroduced.

## Manual Gates

- Browser/demo check at device scale factor 1: exact 620 × 292 document bounds,
  114 × 32 keys, all four states, pointer/Enter/Space, no console errors, and no
  external requests. Record bounded results in `handoff.md`; do not commit
  screenshots with user or machine data.

## References

- Specification anchors: **Settings, IPC, And User Interface**, **Scope And
  Non-Goals**.
- Required conventions: **Electron And Providers**, **Desktop, Browser, And
  Packaging**, **Tests And Documentation**.

## Completion And Handoff

After checks and the browser gate pass, mark only Packet 06 complete, update
`handoff.md` with exact files/checks and `Exact next packet: 07`, present the
increment, and stop. Do not change package identity, commit, push, or start
Packet 07.
