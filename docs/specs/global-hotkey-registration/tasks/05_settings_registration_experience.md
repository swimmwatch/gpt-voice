# 05 Settings Registration Experience

## Outcome

Make Settings display the configured value and authoritative OS-registration
state separately, distinguish application-owned effective accelerators from
desktop-environment-managed Wayland bindings, keep failed Apply open with a
bounded explanation, and add Remove and five-second Test controls with complete
localization and accessible status announcements.

## Prerequisites

- Packets 01..04 are complete and approved for continuation.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and the
  **Code And Logging**, **Electron And Providers**, and **Tests And
  Documentation** convention sections.
- Inspect `AppSettingsWindow`, `ShortcutsSection`, `HotkeyRow`, `HotkeyModal`,
  the renderer DesktopApi provider, locale key structure, and focused Settings
  tests.

## Owned Requirements

- OUT-001, OUT-004
- SCOPE-002
- UI-001, UI-006..UI-011
- FAIL-001..FAIL-004
- QUAL-005, QUAL-006 / AC-AUTO-005, AC-AUTO-006

## In Scope

- Settings runtime-state subscription/reconciliation.
- Nullable row rendering and status presentation.
- Transactional capture/apply behavior, Remove, and Test UI.
- Localized bounded errors/statuses in all eleven locale maps.
- Focus management, keyboard access, aria-live, and focused renderer tests.

## Out Of Scope

- Main-window provider/contextual key visuals, deterministic provider demo,
  Electron registration internals, platform/package metadata, user docs, and
  real physical manual testing.
- First-run banner/onboarding, automatic fallback, external-owner naming, or
  renderer access to Electron/native errors.

## Task Contract

1. Replace Settings' settings-only query with Packet 04's runtime state and
   snapshot event. Reconcile initial query against newer events using the
   authoritative revision rule; never replace a newer registered/failed state
   with stale query data.
2. Each row displays its configured preference or localized `Not assigned`
   plus a separate localized state: Unassigned, Registered, Failed, or
   Suppressed. Application-authority success may show the normalized effective
   accelerator as exact. Desktop-environment-authority success labels the
   configured value as a preference, shows no exact effective accelerator, and
   uses localized desktop-managed copy/marker.
3. Add localized failure copy for `InvalidAccelerator`, `InternalConflict`,
   Windows `OsReserved` covering F12 and every Windows/Super-modifier shortcut,
   generic `RegistrationRejected`, `PersistenceFailed`,
   `ReconciliationFailed`, and `UnsupportedPlatform`. Reconciliation copy
   explains that state could not be safely reconciled and offers restart or an
   explicit repair without claiming that any candidate is active. Generic
   rejection may say
   the combination is unavailable or used by the system/another application;
   it must never claim an exact owner.
4. Opening/capturing a modal does not call capture-suspension IPC. The Settings
   window's existing main-interaction lease already suppresses product
   callbacks while OS bindings remain registered.
5. Capture remains local syntax feedback only. Apply sends a transactional set
   request and disables duplicate submission while pending. Close the modal
   and restore focus only after a `success` response. On failure keep it open,
   retain the old row/configured value, preserve the captured candidate for
   correction/retry, and show its localized reason inside the dialog.
6. Every assigned row exposes Remove. Confirm only if an existing UI pattern
   requires it; do not add a new modal solely for removal. Disable duplicate
   requests. Success renders unassigned immediately; persistence failure leaves
   the old row/binding and presents its bounded reason.
7. Every registered row exposes Test. Starting Test shows a five-second waiting
   state; Detected, Timed out, and Unavailable are localized terminal states.
   While waiting, the matching physical callback is consumed and no action
   runs. Only one row may test at a time. On Wayland, Test is the supported
   in-app verification of the desktop-managed binding and the UI never claims
   the configured preference was the detected physical trigger. Closing
   Settings/modal cancels the test through Packet 04 ownership.
8. Unassigned and failed rows do not offer Test. Remove is hidden/disabled for
   unassigned state. Change remains available for repair unless the platform is
   unsupported, in which case capture may remain available but Apply returns
   the bounded unsupported failure.
9. Publish mutation/test/status/authority changes through one polite
   `aria-live` region.
   Row controls have accessible names that include action, configured value or
   unassigned, registration state, binding authority, whether the effective
   accelerator is exact or desktop-managed, and the operation. Focus returns
   to the originating control after successful Apply, Remove, Test completion,
   or close; it stays in the dialog after failure.
10. Add the complete key set to English, Russian, Ukrainian, Belarusian,
    German, Spanish, French, Portuguese, Hindi, Japanese, and Chinese locale
    maps. Structural locale tests must fail if any new key is missing.
11. Preserve all existing text-action enablement switches and Settings close/
    save behavior. Hotkey mutations are immediately authoritative and are not
    silently batched into unrelated Settings persistence.

## Contracts And Boundaries

- Renderer consumes only validated enum/status data from `window.electronAPI`.
- Do not log candidates, native errors, selected text, audio, transcripts,
  clipboard contents, settings paths, or environment values from Settings.
- Provider readiness is not present in this row state and must not be reused as
  registration truth.
- Renderer never derives binding authority or effective accelerator from the
  configured preference; it renders the validated main-owned fields.
- Use React functions/hooks and functional state updates; do not create a
  stateful class for presentation-only state.

## Expected Files Or Components

- `src/renderer/AppSettingsWindow.tsx`
- `src/renderer/components/settings/ShortcutsSection.tsx`
- `src/renderer/components/HotkeyRow.tsx`
- `src/renderer/components/HotkeyModal.tsx`
- Focused renderer view-state/helper module if it materially simplifies tests
- `src/main/i18n/{en,ru,uk,be,de,es,fr,pt-BR,hi,ja,zh}.ts`
- `tests/renderer/appSettingsHotkeys.test.ts`
- Focused Hotkey row/modal tests and locale completeness tests

## Acceptance Criteria

- Settings renders configured preference, effective accelerator, and authority
  truth for all presentation states and all seven targets, including
  application and desktop-environment success.
- Failed Apply stays open, keeps the old authoritative row, and shows the exact
  bounded localized reason; success alone closes.
- Remove and Test obey availability, pending, completion, cancellation, focus,
  and aria-live requirements.
- F12 and every Super-modifier shortcut on Windows show reserved copy; generic
  conflict never names an owner. Reconciliation failure never shows success.
- All eleven locale maps are structurally complete.
- No `setHotkeyCaptureActive` or renderer-side unregister behavior returns.

## Verification

- `node --import tsx --test tests/renderer/appSettingsHotkeys.test.ts tests/renderer/systemSettingsLanguage.test.ts tests/main/hotkeyIpcContract.test.ts`
- New focused row/modal/view-state tests.
- `npm run typecheck`
- `npm run test:types`
- Scoped ESLint and Prettier over changed source/tests/locales.
- `git diff --check`

## Failure And Rollback

- Closing on failure, displaying a candidate as active before main success,
  presenting a Wayland preference as effective, losing focus, executing an
  action during Test, missing locale keys, or exposing raw errors blocks
  completion.
- If the existing Settings lock is not guaranteed for the full window
  lifetime, stop and repair its owner in Packet 03 rather than adding renderer
  suspension state.
- Rollback removes the new presentation while retaining Packet 04 IPC and
  Packet 01 null settings; it must still render null safely.

## Manual Gates

- None. Physical and OS-specific Settings checks belong to the exact host
  Packets 07–09.

## References

- Specification anchors: **Settings, IPC, And User Interface**, **Failure,
  Security, And Privacy**.
- Required conventions: **Code And Logging**, **Electron And Providers**,
  **Tests And Documentation**.

## Completion And Handoff

After checks pass, mark only Packet 05 complete, update `handoff.md` with exact
files/checks and `Exact next packet: 06`, present the increment, and stop. Do
not modify the main-window key/demo, commit, push, or start Packet 06.
