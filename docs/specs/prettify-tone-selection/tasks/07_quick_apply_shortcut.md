# 07 Quick-Apply Shortcut

## Outcome

Route the existing configurable F12 Prettify target to the chooser and add a
separate configurable quick-apply target defaulting to Ctrl+F12. Both targets
must share the existing Prettify enabled setting, conflict/platform handling,
recording/Translation gates, reentry focus, and duplicate-generation
suppression.

## Prerequisites

- Packets 04..06 are complete and approved.
- Read `AGENTS.md`, `todo.md`, `handoff.md`, and the **Desktop, Browser, And
  Packaging** and **Code And Logging** convention sections.
- Inspect `src/shared/hotkeys.ts`, `src/main/config.ts`,
  `src/main/shortcuts.ts`, `ShortcutsSection`, hotkey modal/preload/IPC, i18n,
  and direct tests.
- Do not change the chooser design, provider settings, other default hotkeys,
  or recording/Translation semantics.

## Owned Requirements

- FLOW-002, FLOW-005
- COMP-005
- FAIL-002, FAIL-005
- UI-008, UI-009 (hotkey Settings surface)
- QUAL-002 / AC-AUTO-006
- AC-MAN-002

## In Scope

- Shared target/default/settings types and config migration/persistence.
- Shortcut registration/dispatch/status integration.
- Existing Settings hotkey row and modal integration/localization.
- Conflict, platform, enablement, recording, Translation, chooser reentry, and
  generation reentry tests.

## Out Of Scope

- Chooser/Settings profile visual changes.
- Provider/cache/clipboard logic already owned by packets 03/04.
- Any new enable toggle, main-window profile indicator, default-hotkey changes
  beyond Ctrl+F12, or automatic paste/result review.

## Task Contract

1. Add exactly one `HotkeyTarget` named `prettifyQuick` and one config field
   `prettifyQuickHotkey`. Define
   `DEFAULT_PRETTIFY_QUICK_HOTKEY = 'Ctrl+F12'`.
2. Preserve current configured `prettifyHotkey` exactly; its action changes from
   immediate execution to packet 04 chooser flow. Missing
   `prettifyQuickHotkey` initializes to Ctrl+F12 on load. No other default,
   configured accelerator, retry migration, or unrelated config changes.
3. Include `prettifyQuick` exhaustively in normalization, keyboard capture,
   target guards, config snapshots, preload/IPC declarations, Settings draft,
   persistence, and conflict detection.
4. Preserve exact-accelerator conflicts and the current bare-key-versus-modified
   conflict rule for every target pair except the two Prettify sibling targets.
   For only `prettify` and `prettifyQuick`, permit distinct normalized
   accelerators that share the same non-modifier key but have different
   modifier sets; this narrow target-aware exception is required so the
   specified `F12` and `Ctrl+F12` defaults register simultaneously. Identical
   accelerators still conflict, and neither sibling receives an exception
   against any other target. Keep platform Command/Super normalization and do
   not relax the reusable conflict helper generically.
5. Render one localized hotkey row for `prettifyQuick` in existing shortcut
   order adjacent to Prettify. The existing Prettify enable toggle controls
   both targets. The quick row has no second enable switch.
6. Dispatch behavior:
   - F12/current Prettify target calls chooser entry;
   - quick target resolves/runs explicit default with no window;
   - both first ask packet 04 to focus an already-open chooser; if focused,
     retain its original source and perform no second copy/provider operation;
   - while generation is active, both are skipped without duplicate request;
   - quick never uses remembered chooser selection.
7. Existing `prettifyEnabled` gates registration/dispatch semantics for both.
   Preserve shortcut registration failure reporting and suspension during
   hotkey capture.
8. Preserve recording lifecycle and selected-text gates:
   - neither path runs while recording state disallows selected-text actions;
   - Translation and Prettify remain mutually exclusive;
   - retry-transcription dynamic registration is unchanged.
9. Existing Escape cancellation closes an open chooser or cancels active
   generation through packet 04. It must not cancel/alter recording unless
   current recording precedence says so.
10. Start generic working/tray presentation only when provider generation
    actually starts (immediately for quick apply, after Apply for chooser).
    Chooser selection/opening must not claim a provider request is in flight.
    Terminal status remains generic completed/failed/cancelled/skipped.
11. Runtime logs may include target/action category and accelerator registration
    state, never source/profile/default/instruction/complete order data.
12. Add localized Settings and migration/help copy. README behavior is finalized
    in packet 10; this packet adds any keys required for a complete UI in every
    supported locale.

## Contracts And Boundaries

- Shortcut controller dispatches only into packet 04 main service.
- Renderer hotkey UI uses typed `window.electronAPI`; it cannot invoke profile
  execution directly.
- F12 one-off selection never changes default; Ctrl+F12 always resolves the
  current explicit default.
- No new global enable state, provider behavior, or main-window UI.

## Expected Files Or Components

- `src/shared/hotkeys.ts`
- `src/main/config.ts`
- `src/main/shortcuts.ts`
- hotkey IPC/preload/renderer declaration files
- `src/renderer/AppSettingsWindow.tsx`
- `src/renderer/components/settings/ShortcutsSection.tsx`
- every locale catalog
- `tests/main/hotkeys.test.ts`
- `tests/main/shortcutController.test.ts`
- config/App Settings hotkey tests directly affected
- `tests/main/i18n.test.ts`

## Acceptance Criteria

- F12 opens/focuses chooser; Ctrl+F12 runs explicit default windowlessly.
- The default F12 and Ctrl+F12 pair is reported as non-conflicting and both
  registrations succeed together; exact sibling duplicates and every
  bare/modified conflict involving another target remain rejected.
- Both are configurable, normalized, conflict-checked, capture-modal compatible,
  and gated by the same Prettify enable switch.
- Missing quick config migrates to Ctrl+F12 without changing any other hotkey.
- Pressing either while chooser is open only focuses it; repeated generation
  produces no duplicate provider request.
- Recording, Translation, retry, cancel precedence, status, tray, and
  registration-failure behavior remain correct.
- Settings copy is localized and quick row has no redundant enable toggle.

## Verification

```text
rtk test node --import tsx --test tests/main/hotkeys.test.ts
rtk test node --import tsx --test tests/main/shortcutController.test.ts
rtk test node --import tsx --test tests/main/appConfigStore.test.ts
rtk test node --import tsx --test tests/renderer/appSettingsUtils.test.ts
rtk test node --import tsx --test tests/main/i18n.test.ts
rtk npm run typecheck
rtk npm run test:types
```

Run directly affected preload/IPC and renderer hotkey tests plus task-local
lint/format checks.

## Failure And Rollback

- A registration conflict/failure leaves the target unregistered and reports
  through current safe mechanisms; it never silently replaces another target.
- Invalid/missing default fails generically without opening chooser/provider
  fallback.
- Rollback removes quick target/config/UI and restores F12 dispatch; persisted
  unknown quick field is harmless to older releases.

## Manual Gates

- MANUAL GATE: verify global shortcut registration and dispatch on packaged
  Windows and Linux in packet 10.
- No commit, push, PR, installer, live provider, or release action is
  authorized.

## References

Mandatory:

- Specification **Quick-Apply Flow**, **Failure And Recovery**, and
  **Compatibility And Migration**.
- Planning decision `workflow.quick-hotkey-default:v1`.
- Existing `src/shared/hotkeys.ts` and `src/main/shortcuts.ts`.

## Completion And Handoff

After verification:

1. Mark packet 07 complete in `todo.md`.
2. Update `handoff.md` with target/config/migration/UI/test changes and packet
   08 as next.
3. Present for review and stop. Do not commit or start packet 08.
