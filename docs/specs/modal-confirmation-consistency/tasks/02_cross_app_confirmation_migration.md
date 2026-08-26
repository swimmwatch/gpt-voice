# 02 Migrate Remaining Confirmation Flows

## Outcome

Migrate every remaining destructive confirmation to the shared composition while preserving each feature’s existing domain action and safe failure presentation.

## Prerequisites

- Packet 01 is complete and its `ConfirmationDialog` contract is verified.

## Owned Requirements

`OUT-001`, `SCOPE-001`–`SCOPE-002`, `UI-001`, `UI-003`–`UI-004`, `FLOW-001`–`FLOW-004`, `A11Y-001`, `COMP-001`, `SAFE-001`, `OPS-001`, and `NONGOAL-001`.

## In Scope

- Migrate transcription-history clearing, provider-auth clearing, Settings discard, diagnostic capture disable/clear, and Prettify custom-profile deletion to `ConfirmationDialog`.
- Adapt each feature’s confirmation callback to return a success boolean and retain its existing safe localized error/focus-restoration behavior.
- Preserve destructive action labels/icons and use an outline first action. Diagnostic disable remains destructive because it may purge selected local diagnostic categories.
- Preserve Prettify’s replacement-default workflow as a data-entry Dialog for packet 03 because deletion requires a replacement selection.

## Out Of Scope

- Local Whisper UI already owned by packet 01, all non-destructive data-entry dialog normalization, domain delete/clear behavior, persistence, IPC, new strings unless an existing caller lacks a required localized label, commits, and pushes.

## Task Contract

- A confirmation’s pending state must prevent its `onOpenChange`, Escape, Cancel, and confirm controls from issuing duplicate work or dismissing an active command.
- Existing feature code continues to own request validation, safe errors, action-specific icons, and focus restoration; the shared component owns generic modal state only.
- Do not pass raw error data into shared dialog props or logs. Existing localized feature errors remain the recovery surface.

## Contracts, Boundaries, And Expected Components

- Expected consumer updates: `src/renderer/HistoryWindow.tsx`, `src/renderer/components/ProviderSettingsForm.tsx`, `src/renderer/AppSettingsWindow.tsx`, and `src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx`.
- Expected tests: focused history, provider-settings, audit-log/settings, and Prettify profile tests plus shared confirmation tests from packet 01.
- No main/preload/shared-domain contract changes are allowed.

## Acceptance Criteria

1. Every scoped destructive confirmation uses `ConfirmationDialog`; no feature assembles a raw `AlertDialog` action footer.
2. History/provider/diagnostic/discard/profile deletion close only after their command succeeds and remain open after failure.
3. Each footer has outline dismissal first and destructive action second, preserving current labels/icons and focus behavior.
4. Existing domain mutations execute once per accepted confirmation and maintain their current typed IPC paths.

## Verification

- Add/adjust deterministic renderer tests for every migrated flow: action order/tone, pending lock, true/false callback close behavior, safe failure retention, Escape/open-state guard, and focus restoration.
- Run the focused history, provider-settings, audit-log/settings, Prettify-profile, and shared-confirmation suites; then typecheck, direct lint, format check, build, and `git diff --check`.

## Failure And Rollback

- If a caller cannot express success as a boolean without changing a domain interface, keep the existing domain method and add a renderer-local adapter; do not widen IPC or persist new state.
- Revert only consumer migrations to restore their former dialogs if a feature-specific regression occurs; no stored data is modified by this packet beyond user-confirmed existing actions.

## Manual Gates

- **MANUAL GATE:** Verify each migrated confirmation in Linux and Windows dark theme with keyboard-only navigation, focus restoration, failure feedback, and no duplicate action under repeated clicks. This requires platform user evidence.

## References

- `docs/specs/modal-confirmation-consistency/spec.md` — confirmation behavior and safety requirements.
- Packet 01 shared component and tests — required local interface precedent.
- Existing feature tests — preserve current action semantics rather than reimplementing them.

## Completion And Handoff

- Update `todo.md` and `handoff.md` with changed files, exact checks, and uncompleted manual gates.
- Stop after review. Do not begin packet 03, commit, or push without separate authorization.
