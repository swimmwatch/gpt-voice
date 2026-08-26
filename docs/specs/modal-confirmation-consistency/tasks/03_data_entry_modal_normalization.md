# 03 Normalize Data-entry Modals

## Outcome

Bring every data-entry modal onto the shared surface and footer-action standard while protecting active submissions and removing the duplicate Hotkey close control.

## Prerequisites

- Packets 01 and 02 are complete, including the shared modal surface contract and cross-app confirmation behavior.

## Owned Requirements

`OUT-001`, `SCOPE-001`–`SCOPE-002`, `UI-002`–`UI-005`, `FLOW-003`–`FLOW-004`, `A11Y-001`, `COMP-001`, `SAFE-001`, `OPS-001`, and `NONGOAL-001`.

## In Scope

- Normalize Hotkey capture and Prettify profile editor, default-replacement, export, and import Dialogs to the shared Dialog surface/footer contract.
- Preserve outline dismissal first and primary normal submission; retain destructive `Delete and set default` because it deletes a profile after selecting its replacement.
- Remove the Hotkey header close button. Its footer Cancel remains the visible dismiss action; keyboard capture behavior stays unchanged.
- Ensure pending submissions disable input controls, both footer actions, Escape/open-state dismissal, and repeated commands until they resolve. A success closes once; a failure stays open with existing safe localized feedback and focus.
- Refactor the Hotkey application callback only as needed to report success/failure to its Dialog owner without altering hotkey IPC or capture activation/cleanup ownership.

## Out Of Scope

- Destructive confirmation migrations from packet 02, non-modal forms, global keyboard shortcuts, IPC/preload/main-process changes, new dependencies/tokens, persistence migrations, commits, and pushes.

## Task Contract

- Use existing `Dialog`, `DialogContent`, `DialogFooter`, `Button`, Spinner, theme tokens, and form controls. Do not add a second dialog primitive or a header close icon.
- Existing feature-specific size, scroll, validation, selection, capture, and error behavior remain intact. Only modal presentation/action lifecycle changes are allowed.
- Pending failure must never expose raw thrown values and must leave user-entered form data available for correction or retry.

## Contracts, Boundaries, And Expected Components

- Expected consumer updates: `src/renderer/components/HotkeyModal.tsx`, `src/renderer/AppSettingsWindow.tsx`, and `src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx`.
- The shared Dialog surface contract from packet 01 remains the sole layout owner.
- Existing typed desktop API methods and local hooks remain unchanged unless a renderer-local callback return value is required for pending ownership.

## Acceptance Criteria

1. Every data-entry modal uses the shared modal surface and a footer with outline dismissal first.
2. Hotkey capture has no redundant header close button and keeps keyboard capture/focus behavior.
3. Save/Apply/Export/Import use primary styling; deletion with a replacement selection uses destructive styling.
4. Pending data-entry work cannot be dismissed, duplicated, or lose its entered data; failure remains safely recoverable in place.
5. Intentional size/scroll behavior for profile editing, replacement selection, export, and import remains available.

## Verification

- Add/adjust focused Hotkey and Prettify profile renderer tests for modal surface consumption, action tone/order, no header close control, pending dismissal guards, single submission, focus recovery, and retained form state after failure.
- Run the focused modal/profile/settings tests, renderer accessibility tests, typecheck, direct lint, format check, build, and `git diff --check`.

## Failure And Rollback

- Restore the existing Dialog event handlers if an interaction regression affects key capture or a form’s validation lifecycle, then add a focused regression test before retrying.
- Reverting this packet changes only renderer dialog presentation/state handling; no persisted profile/hotkey setting schema or main-process behavior is rolled back.

## Manual Gates

- **MANUAL GATE:** Verify Hotkey capture, profile edit, replacement, export, and import on Linux and Windows in dark theme for keyboard-only operation, clipping, visible focus, pending lock, and footer action clarity. Do not mark complete without user-provided platform evidence.

## References

- `docs/specs/modal-confirmation-consistency/spec.md` — shared modal, pending, accessibility, and compatibility contract.
- Packet 01 — common Dialog surface implementation.
- Packet 02 — established confirmation migration and tests.

## Completion And Handoff

- Update `todo.md` and `handoff.md` with exact verification results and remaining manual gates.
- Stop after final packet review. Commit/push require separate explicit authorization.
