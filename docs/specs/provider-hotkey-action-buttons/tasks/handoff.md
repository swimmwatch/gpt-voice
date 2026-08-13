# Provider Hotkey Action Buttons — Handoff

## Completed Packets

- 01 — [Action Eligibility Contracts](./01_action_eligibility_contracts.md)
- 02 — [Main Action Dispatch And IPC](./02_main_action_dispatch_and_ipc.md)
- 03 — [Hotkey Action Button](./03_hotkey_action_button.md)
- 04 — [Home Screen Action Integration](./04_home_screen_action_integration.md)

## Changed Files

- Packet 01 committed as `7194d80`.
- `src/main/providerHomeActionDispatcher.ts` — one main-owned normal Prettify,
  Translation, and provider-specific Cancel dispatcher.
- `src/main/{ipc,preloadApi,window}.ts`, `src/renderer/types.d.ts`, and
  `src/shared/providerHomeAction.ts` — bounded main-frame IPC commands plus
  sanitized snapshot/change publication.
- `src/main/{shortcuts,mainProcessApplication}.ts` and composition/runtime
  roots — global Prettify/Translation/Escape adapters and disposal ownership.
- `src/main/services/selectedText{Prettify,Translation}.ts` — cancellability
  predicates with no sensitive-state publication.
- `tests/main/providerHomeActionDispatcher.test.ts` and related IPC, preload,
  shortcut, lifecycle, and service tests — exact owner/cancel, trusted input,
  and regression coverage.
- `decisions.yaml`, `tasks/todo.md`, and this handoff record packet-02
  authorization and completion.
- Packet 03 committed as `0fde290`.
- `src/renderer/components/HotkeyActionButton.tsx` — one accessible semantic
  button with pointer/Enter/Space feedback, remount-based interruption cleanup,
  semantic unavailable state, and active/busy/locking presentation inputs.
- `src/renderer/hotkeyActionButtonState.ts` — isolated 114 by 32 geometry,
  3px travel, 110ms lock/release timing, visual-state decisions, and
  token-aware accelerator legend formatting.
- `src/renderer/styles/hotkeyActionButton.css` — shared graphite shadow,
  bevel, face, legend, focus, disabled, busy, active, locking, and
  reduced-motion styles; demo CSS remains layout-only.
- `tests/renderer/hotkeyActionButton.test.ts` and
  `tests/renderer/hotkeyActionButtonTransition.test.ts` — source/style and
  deterministic state-transition coverage.
- `src/renderer/App.tsx` — uses the common provider-key integration at the
  existing Voice, Prettify, and Translation action-control seams; Voice keeps
  its renderer-owned Start/Pause/Resume lifecycle.
- `src/renderer/useProviderHotkeyHomeIntegration.ts` — reconciles renderer-safe
  snapshots, derives fail-closed key eligibility, dispatches bounded normal
  Prettify/Translation starts, and prepares non-rendered localized
  Pause/Resume/Stop/Cancel descriptors for packet 05.
- `src/renderer/useMainPrettifyHomeProvider.ts` — focused extraction of the
  existing Prettify settings, connection, and model state needed to keep the
  App component within lint limits without behavior changes.
- `tests/renderer/providerHotkeyHomeIntegration.test.ts` plus updated provider
  row/status contracts — authoritative snapshot, bounded action route,
  contextual descriptor, and unchanged row-seam coverage.

## Checks

- `rtk node --import tsx --test tests/main/providerHomeActionDispatcher.test.ts
tests/main/hotkeyIpcContract.test.ts tests/main/preloadApi.test.ts
tests/main/shortcutController.test.ts tests/main/mainInteractionLockActionGate.test.ts
tests/main/mainProcessApplication.test.ts tests/main/selectedTextPrettify.test.ts
tests/main/selectedTextTranslation.test.ts tests/shared/textActionSettings.test.ts`
  — 111 passing tests.
- `rtk npx eslint --max-warnings 0` on touched files — passed.
- `rtk prettier --check` on touched files — passed.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk git diff --check` — passed.
- `rtk node --import tsx --test tests/renderer/providerHotkeyHomeIntegration.test.ts
tests/renderer/providerHotkeyEligibility.test.ts
tests/renderer/mainPrettifyProviderBand.test.ts tests/renderer/translateSection.test.ts
tests/renderer/providerStatusPresentation.test.ts` — 48 passing tests.
- `rtk node --import tsx --test tests/main/providerHomeActionDispatcher.test.ts
tests/main/hotkeyIpcContract.test.ts tests/main/preloadApi.test.ts
tests/main/shortcutController.test.ts` — 39 passing tests.
- `rtk npx eslint --max-warnings 0` on Packet 04 renderer source and focused
  tests — passed.
- `rtk npm run typecheck`, `rtk npm run test:types`, and `rtk git diff --check`
  — passed.
- `rtk npm run lint -- --max-warnings 0` — exits nonzero on 107 existing
  warnings in unrelated Local Whisper/security sources; no Packet 04 lint
  warnings were reported.
- `rtk node --import tsx --test tests/renderer/hotkeyActionButton*.test.ts` —
  8 passing tests.
- `rtk npx eslint --max-warnings 0 src/renderer/components/HotkeyActionButton.tsx src/renderer/hotkeyActionButtonState.ts tests/renderer/hotkeyActionButton.test.ts tests/renderer/hotkeyActionButtonTransition.test.ts`
  — passed.
- `rtk prettier --check src/renderer/components/HotkeyActionButton.tsx src/renderer/hotkeyActionButtonState.ts src/renderer/styles/hotkeyActionButton.css tests/renderer/hotkeyActionButton.test.ts tests/renderer/hotkeyActionButtonTransition.test.ts`
  — passed.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk git diff --check` — passed.

## Exact Next Packet

On a later explicit `incremental-implementation` request, obtain separate
execution authorization to execute
[`05_recording_footer_and_cta_removal.md`](./05_recording_footer_and_cta_removal.md)
only. Do not commit Packet 04 without separate commit authorization.

## Blockers

- No Packet 04 blocker. Its work is intentionally uncommitted pending separate
  commit authorization. Repository-wide lint has unrelated existing warnings,
  recorded above.
