# Provider Hotkey Action Buttons — Handoff

## Completed Packets

- 01 — [Action Eligibility Contracts](./01_action_eligibility_contracts.md)
- 02 — [Main Action Dispatch And IPC](./02_main_action_dispatch_and_ipc.md)

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

## Exact Next Packet

On a later explicit `incremental-implementation` request, obtain separate
execution authorization to execute
[`03_hotkey_action_button.md`](./03_hotkey_action_button.md) only.

## Blockers

- Packet 03 has no execution authorization.
