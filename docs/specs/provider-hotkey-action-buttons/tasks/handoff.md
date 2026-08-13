# Provider Hotkey Action Buttons — Handoff

## Completed Packets

- 01 — [Action Eligibility Contracts](./01_action_eligibility_contracts.md)
- 02 — [Main Action Dispatch And IPC](./02_main_action_dispatch_and_ipc.md)
- 03 — [Hotkey Action Button](./03_hotkey_action_button.md)
- 04 — [Home Screen Action Integration](./04_home_screen_action_integration.md)
- 05 — [Recording Footer And CTA Removal](./05_recording_footer_and_cta_removal.md)

## Changed Files

- Packet 05 is committed under the recorded `authorization.commit-packet-05`
  decision.
- `src/renderer/components/RecordingControls.tsx` — removes the primary
  Record/Stop/Busy band, renders only supplied contextual tiles, restores focus
  when a focused tile disappears, and gives status detail priority over the
  captured-audio duration.
- `src/renderer/components/ContextualActionTile.tsx` and
  `src/renderer/styles/contextualActionTile.css` — provider-neutral native
  icon-and-hotkey tiles, isolated from the frozen three-dimensional provider
  key stylesheet.
- `src/renderer/recordingElapsedTime.ts` — renderer-local injectable monotonic
  captured-audio timer that excludes paused and processing intervals.
- `src/main/i18n/*.ts` — localized captured-audio-duration label for every
  supported locale, with no byte or megabyte value.
- `src/renderer/{App,ProviderHotkeyDemo,bootstrapWindow}.tsx` and
  `src/renderer/entries/providerHotkeyDemo.tsx` — pass Packet 04 contextual
  descriptors to the footer and load the separate tile stylesheet without
  changing provider-key behavior or global shortcut subscriptions.
- `src/renderer/{mainWindowViewState.ts,hooks/useRecording.ts}` and
  `src/shared/recordingLifecycle.ts` — remove obsolete primary presentation and
  make batch/retry cancellation generation-scoped through transcribing/retrying.
- `src/renderer/styles/globals.css` — removes only primary-band CSS and bounds
  visible status text; Packet 06 still owns final window/footer geometry.
- Focused renderer/lifecycle tests cover the action matrix, native activation
  contract, focus recovery, elapsed duration, status priority, primary-CTA
  removal, and late-result cancellation suppression.
- `decisions.yaml` records Packet 05 execution authorization.

## Checks

- `rtk node --import tsx --test tests/renderer/recordingControls.test.ts tests/renderer/mainWindowViewState.test.ts tests/renderer/recordingStatusLayout.test.ts tests/renderer/contextualProviderActions.test.ts tests/renderer/recordingElapsedTime.test.ts tests/renderer/recordingCancellation.test.ts tests/renderer/recordingRetryState.test.ts tests/renderer/recordingNotifications.test.ts tests/renderer/streamingRecordingWorkflow.test.ts tests/renderer/streamingTranscriptionQueue.test.ts tests/renderer/streamingTranscriptionPresentation.test.ts tests/renderer/providerHotkeyEligibility.test.ts tests/renderer/providerHotkeyHomeIntegration.test.ts tests/renderer/providerStatusPresentation.test.ts tests/renderer/translateSection.test.ts tests/shared/recordingLifecycle.test.ts`
  — 82 passing tests.
- `rtk node --import tsx --test tests/main/shortcutController.test.ts tests/main/hotkeyIpcContract.test.ts tests/main/providerHomeActionDispatcher.test.ts tests/main/selectedTextPrettify.test.ts tests/main/selectedTextTranslation.test.ts`
  — 87 passing tests.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk npx eslint --max-warnings 0` on all Packet 05 source and focused test
  files — passed.
- `rtk prettier --check` on all Packet 05 source, style, test, and decision
  files — passed.
- `rtk git diff --check` — passed.
- `rtk npm run lint -- --max-warnings 0` — fails only on 107 existing warnings
  in unrelated Local Whisper/security sources; it reports no errors and no
  Packet 05 warnings.

## Exact Next Packet

On a later explicit `incremental-implementation` request, obtain separate
commit authorization for Packet 05, commit only its scoped files, then obtain
separate execution authorization for
[`06_compact_window_and_layout.md`](./06_compact_window_and_layout.md). Do not
execute Packet 06 in this handoff.

## Blockers

- No Packet 05 blocker. Manual Electron lifecycle and Stop-shortcut checks are
  intentionally deferred to Packet 08.
- The worktree contains unrelated user-owned changes and untracked assets; do
  not stage them with Packet 05.
