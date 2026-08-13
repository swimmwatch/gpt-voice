# 06 Compact Window And Layout

## Outcome

Change only the production main window to an exact fixed 620 × 292 CSS-pixel
content area and make the preserved Command Dock grid fit it: 60-pixel header,
57-pixel Voice row, 60-pixel Prettify row, 60-pixel Translation row, and fixed
54-pixel status footer with divider/border accounting. Keep all controls in
their existing rows/order, fit lifecycle status, prioritized timer/detail, and
up to three contextual action tiles, prevent overflow, and fit startup
loading/retry/fail states without changing supporting windows or provider-key
design.

## Prerequisites

- Packets 03..05 are complete and approved.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, and the **Desktop,
  Browser, And Packaging** convention section.
- Inspect `src/main/window.ts`, production main-window creation, global
  renderer styles, `LoadingScreen`, settled homepage structure, supporting
  window size constants, and direct window/layout/startup tests.

## Owned Requirements

- OUT-004
- SCOPE-004
- UI-001..UI-003, UI-006, UI-007, UI-011..UI-021
- ACTION-008
- A11Y-006, A11Y-010..A11Y-012
- DEP-010
- ARCH-010
- COMP-004..COMP-007
- OPS-001, OPS-003, OPS-004
- NON-001, NON-008, NON-009
- AC-AUTO-012..AC-AUTO-015, AC-AUTO-017, AC-AUTO-019, AC-AUTO-024

## In Scope

- Production main content-size constants and non-resizable BrowserWindow.
- Exact production header/provider/footer grid and overflow constraints.
- Maximum-density footer fit for timer/status plus Pause or Resume, Stop, and
  Cancel compact tiles with long localized labels/accelerators.
- Action-column alignment without moving adjacent status/settings controls.
- Startup loading, retry, failure, and settled transition fit.
- Replacement of all old 520 × 420 and recording-allocation assertions.

## Out Of Scope

- Supporting-window sizes, installer/package targets, persisted window state,
  provider behavior, action gating, demo fixture behavior, or visual redesign.
- Resizable/adaptive main-window modes or runtime native resize after startup.

## Task Contract

1. Set the main-window content constants to exactly width 620 and height 292.
   Continue to use content-size semantics (`useContentSize: true`) and
   `resizable: false`; native frame/chrome is outside the content contract.
2. Change only the main BrowserWindow. Settings, history, provider settings,
   about, chooser, or other supporting window dimensions and behavior remain
   byte-for-byte or test-equivalent unchanged.
3. Establish one exact vertical grid in production CSS:
   - 60 px header;
   - 57 px Voice row;
   - 60 px Prettify row;
   - 60 px Translation row;
   - 54 px recording/status footer;
   - include the existing one-pixel dividers and outer border accounting so
     the total content box is exactly 620 × 292, not 291/293.
4. Remove flex growth/min-height behavior from the status region. It starts
   immediately below Translation and ends at the bottom content border. No old
   93/142-pixel command-space allocation or empty lower region remains.
5. Preserve the footer's three-column relationship at maximum density:
   lifecycle status at the start, timer or prioritized live detail in the
   bounded center, and up to three compact contextual tiles at the end. The
   group order is Pause/Resume, Stop, Cancel. A higher-priority detail may
   replace the timer but cannot hide an available action.
6. Give all three 114 × 32 action keys the same fixed action column/edges and
   left alignment. Preserve provider status, runtime/login, and settings
   controls in their current row, relative order, vertical alignment, and
   dimensions. Do not reorder/reflow them merely to fit.
7. Bound all grid children with `min-width: 0`/equivalent where necessary.
   Long accelerator/status/localized/failure content cannot expand the native
   window, overlap controls, create horizontal/vertical scrollbars, or clip the
   action/settings controls. Preserve full accessible values from packets 03/05.
8. Fit the longest supported localized contextual action names and effective
   accelerator legends without changing the 54-pixel height, hiding icons or
   actions, or borrowing space from provider rows. Compact tiles may use their
   dedicated tokenized sizing but must remain visually subordinate to and must
   not reuse/restyle the provider hotkey component.
9. Ensure document/root/main containers are exact-size and overflow-safe at
   device scale factor 1. Do not hide a real layout overflow by globally
   clipping focus rings or required controls.
10. Adapt `LoadingScreen` and startup stage/retry/failure presentation to fit
   620 × 292. Retry remains visible/focusable; there is no white flash,
   transient document overflow, hidden action, or post-load native resize.
11. On renderer reload/window recreation, keep the fixed size while application
   snapshots reconcile. Do not unlock provider actions merely to avoid compact
   startup states.
12. Replace every old `520 × 420`, 93-pixel primary band, 142-pixel workspace,
    or flex-growth test with equivalent exact-size/grid/footer/startup
    assertions. Keep unrelated supporting-window and startup-readiness tests.
13. Add explicit layout rejection coverage for a megabyte/byte element or
    hidden placeholder, more than three current tiles, Disabled placeholders,
    provider-key style changes, and timer/status overlap.
14. Do not update installers, platform package metadata, versions, release
    notes, or deployment. Prior compatible builds naturally restore their old
    layout without data migration.

## Contracts And Boundaries

- The main-process composition/window owner defines native content size;
  renderer CSS defines content layout. They must use the same named contract
  values or exact tested literals without runtime resize negotiation.
- Production main size is fixed on supported Linux/Windows. Platform-specific
  accelerator naming remains supported; macOS release policy stays paused.
- Shared hotkey appearance remains packet 03's owner; demo-only sizing remains
  packet 07's owner.
- Contextual tile appearance comes from packet 05's separate production style;
  this packet may adjust only its layout tokens needed for exact footer fit.

## Expected Files Or Components

- Update `src/main/window.ts` main-window size constants/creation only.
- Update `src/renderer/styles/globals.css` for production root, row grid,
  action column, and 54-pixel footer.
- Update `src/renderer/components/LoadingScreen.tsx` and startup styles only as
  required for compact fit.
- Update `tests/main/windowManager.test.ts`.
- Replace size/layout assertions in
  `tests/renderer/mainPrettifyProviderBand.test.ts`,
  `tests/renderer/translateSection.test.ts`,
  `tests/renderer/recordingStatusLayout.test.ts`, provider status tests,
  `tests/renderer/windowStartupState.test.ts`, and
  `tests/renderer/loadingScreen.test.ts`.
- Add `tests/renderer/providerHotkeyHomeLayout.test.ts` for the complete
  60/57/60/60/54 composition and overflow contract.

## Acceptance Criteria

- Main content is exactly 620 × 292, content-sized, and non-resizable; all
  supporting-window dimensions are unchanged.
- The exact rows/footer fill the content area with no empty region, overflow,
  scrollbar, overlap, clipped action/settings control, or layout shift.
- Three action keys share 114 × 32 geometry and edges while adjacent controls
  retain their established positions.
- Status content, prioritized timer/detail, and the maximum three contextual
  tiles fit the fixed footer while complete accessible text remains available.
- No megabyte element or Disabled contextual placeholder consumes layout, and
  provider hotkey source/style/output remains unchanged.
- Loading, retry, failure, and transition-to-home states fit without native
  resize or white flash.
- `AC-AUTO-012`..`AC-AUTO-015`, relevant `AC-AUTO-017`, `AC-AUTO-019`, and
  `AC-AUTO-024` pass.

## Verification

- `rtk node --import tsx --test tests/main/windowManager.test.ts`
- `rtk node --import tsx --test tests/renderer/providerHotkeyHomeLayout.test.ts tests/renderer/mainPrettifyProviderBand.test.ts tests/renderer/translateSection.test.ts tests/renderer/recordingStatusLayout.test.ts tests/renderer/providerStatusPresentation.test.ts tests/renderer/loadingScreen.test.ts tests/renderer/windowStartupState.test.ts`
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run build:prod`
- `rtk npm run lint -- --max-warnings 0`
- `rtk git diff --check`

## Failure And Rollback

- Any clipped required control, hidden retry, overflow, or native resize is a
  packet failure; do not compensate by changing supporting windows or removing
  status semantics.
- Rollback restores the prior main size/layout constants. No migration or data
  rollback exists.

## Manual Gates

- No production desktop manual gate is completed here. Packet 07 visually
  proves browser geometry; packet 08 qualifies production Linux/Windows and
  startup/lifecycle states.

## References

- `docs/design/status-area-options/01-compact-fixed-footer.png`.
- `docs/design/provider-hotkey-buttons-left-aligned.png`.
- `docs/design/recording-hotkey-options/02-shortcut-action-tiles-no-megabytes.png`.
- Specification: **Home-Screen Interface Contract**, `DEP-010`,
  **Compatibility And Specification Precedence**, and
  `AC-AUTO-012`..`AC-AUTO-015`.

## Completion And Handoff

After checks pass, mark only packet 06 complete, record files/checks and packet
07 as next in `handoff.md`, present the increment for review, and stop. Do not
commit or start packet 07 without a later explicit invocation.
