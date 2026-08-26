# 01 Shared Confirmation Foundation And Local Whisper

## Outcome

Create the internal shared confirmation composition and modal-surface style contract, then use it to correct Local Whisper runtime/model removal and interruption confirmations.

## Prerequisites

- `docs/specs/modal-confirmation-consistency/spec.md` remains approved.
- This is the first executable packet; no prior packet is required.

## Owned Requirements

`OUT-001`, `SCOPE-001`–`SCOPE-002`, `UI-001`–`UI-004`, `UI-006`, `FLOW-001`–`FLOW-004`, `A11Y-001`, `I18N-001`, `COMP-001`, `SAFE-001`, `OPS-001`, and `NONGOAL-001`.

## In Scope

- Add an internal renderer `ConfirmationDialog` that composes the existing `AlertDialog`, `Button`, and `Spinner`; it accepts controlled visibility, localized title/description/labels, `primary` or `destructive` confirmation tone, optional action icon, and `onConfirm(): Promise<boolean> | boolean`.
- The composition owns transient pending state. It disables confirm/cancel and ignores close requests while pending, sets `aria-busy`, displays the existing spinner, closes only when the callback resolves `true`, and remains open on `false` or rejection without exposing raw exception text.
- Extract a non-React modal surface/layout class contract consumed by both `alert-dialog.tsx` and `dialog.tsx`; retain compact confirmation and larger/scrollable form sizing at callers.
- Replace Local Whisper’s one-off artifact removal dialog with `ConfirmationDialog`. The Keep action is outline and Remove is destructive. A failed removal stays open and keeps focus inside the dialog on its safe error content or confirmation action; cancellation or successful completion restores focus to the trigger when it remains mounted.
- Continue using the existing Local Whisper interruption confirmation, adapted to the shared composition without changing its cancel-every-active-operation semantics.
- Revise all Local Whisper locale catalogs so removal titles identify `model` or `runtime` plus the existing catalog display label, never an artifact ID.

## Out Of Scope

- Other app confirmation call sites, non-destructive data-entry dialogs, IPC/preload/main-process changes, artifact lifecycle semantics, new theme tokens, dependencies, commits, and pushes.

## Task Contract

- The shared composition must not wrap a raw Radix `AlertDialogAction` around an asynchronous operation that may fail; closing is controlled only by its resolved boolean result.
- Feature callbacks own safe localized error presentation. A rejected callback is contained and leaves its modal open with focus contained in the dialog; it must not create an unhandled promise rejection or render an exception/path/ID.
- The component uses the existing outline, primary, destructive, spinner, focus-ring, overlay, and theme-token primitives only.
- Local Whisper removal text uses its existing trusted renderer artifact label, adding localized artifact-kind context instead of transforming or inventing catalog data.

## Contracts, Boundaries, And Expected Components

- Expected new renderer-only component: `src/renderer/components/ui/confirmation-dialog.tsx`.
- Expected shared non-React style owner: `src/renderer/components/ui/modal-styles.ts`, consumed by `alert-dialog.tsx` and `dialog.tsx`.
- Expected consumer updates: `src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx`, `src/renderer/localWhisper/LocalWhisperSettingsPage.tsx`, and all Local Whisper locale modules.
- No `window.electronAPI`, IPC, persistence, provider, catalog, or main-process contract changes are allowed.

## Acceptance Criteria

1. Local Whisper model/runtime removal renders an outline Keep action and destructive Remove action using shared `Button` styles.
2. Its localized title explicitly names the artifact kind and trusted display label.
3. Shared confirmation pending state prevents duplicate submission and all dismissal routes; success closes once and failure stays visible with safe caller feedback and in-dialog focus.
4. Dialog and AlertDialog share the surface/layout contract without changing intentional form sizing.
5. Focus, keyboard operation, and screen-reader semantics remain valid.

## Verification

- Add unit/contract coverage for confirmation result handling, pending lock, close suppression, button variants/order, and raw-action exclusion.
- Extend focused Local Whisper presentation/UI/accessibility/localization coverage for model and runtime removal title/copy, failure focus containment, successful/cancelled trigger restoration, and interruption confirmation.
- Run the focused renderer tests, `npm run typecheck`, direct ESLint for changed files, Prettier check, `npm run build`, and `git diff --check`.

## Failure And Rollback

- If a shared component changes a Radix focus or close behavior, restore the prior shared primitive contract and isolate the regression with a focused test before retrying.
- A failed artifact command leaves the dialog open and preserves the current settings snapshot; it never retries, deletes, or cancels a second artifact automatically.
- Reverting this packet removes only the new shared renderer composition/style contract and Local Whisper presentation migration; no data migration or protocol rollback exists.

## Manual Gates

- **MANUAL GATE:** After automated verification, inspect Local Whisper runtime/model removal and interruption dialogs in Linux and Windows dark theme for clipping, visible focus, keyboard operation, and destructive-action clarity. Do not claim this check without user-performed platform evidence.

## References

- `docs/specs/modal-confirmation-consistency/spec.md` — shared UI, confirmation, accessibility, and localization requirements.
- `src/renderer/components/ui/alert-dialog.tsx`, `src/renderer/components/ui/dialog.tsx`, and `src/renderer/components/ui/button.tsx` — only allowed visual primitives.
- `tests/renderer/localWhisper/LocalWhisperUiContracts.test.ts` — Local Whisper UI precedent.

## Completion And Handoff

- Update `todo.md` to mark packet 01 complete and record exact changed files/check results/manual-gate status in `handoff.md`.
- Stop after reporting the packet for review. Do not start packet 02, commit, or push without separate authorization.
