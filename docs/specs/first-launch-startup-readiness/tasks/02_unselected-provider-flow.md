# 02 Unselected provider flow

## Outcome

Make a truly new profile explicitly provider-unselected end to end while preserving configured and legacy profiles. The main window must allow a user to choose a provider, but it must not initialize a provider or allow recording beforehand.

## Prerequisites

- Packet 01 is complete and recorded in `handoff.md`.
- Read only the approved provider-selection compatibility requirements plus this packet.

## Owned Requirements

- FLR-001, FLR-002, FLR-003, FLR-004
- FLR-016 (unselected-provider portion)

## In Scope

- Change `AppConfigStore` and its snapshot/configuration normalization so provider selection is `string | null` for a newly created profile.
- Persist intentional `null` selection for future launches. A pre-existing config that lacks a provider field must retain the historical `chatgpt` fallback; an existing string selection must remain unchanged.
- Update main browser/provider lifecycle code so `null` is never passed to `VoiceProviderRegistry.createProvider`, `BackgroundBrowserService.initialize`, provider settings actions, or browser-context creation. Startup with no provider has an explicit unselected status instead of a registry error.
- Update `VoiceProviderSelectionService`, its result types, trusted get/set-provider IPC, and preload/renderer declarations so initial committed provider identity can be `null`, while a user selection still accepts only known string IDs.
- Update renderer provider bootstrap, App state, MainToolbar, and recording controls for an unselected provider:
  - preserve Select's existing placeholder and shared Select components;
  - show no connected/login/settings/local-runtime controls until selection;
  - disable recording controls and hotkey-triggered recording; a main-process attempt with no provider must safely reject rather than construct one;
  - select and persist a provider only after an explicit user action, then retain existing switching/login behavior.
- Update focused configuration, provider lifecycle, IPC/preload, renderer switching, and accessibility tests.

## Out Of Scope

- CloakBrowser installation, startup progress publication, Retry, or loader visual redesign.
- Provider login, Local Whisper readiness/model changes, or changes to provider categories/options.
- New Select, tooltip, color, or recording-control components.

## Task Contract

- `null` means intentionally unselected. Absence of the persisted property in a pre-existing configuration is legacy state and normalizes to `chatgpt`; it is not reclassified as a new profile.
- Fresh configuration persistence must retain its null selection so the second launch remains unselected.
- Existing provider-selected profiles remain behaviorally unchanged, including automatic background initialization and diagnostics status.
- Browser background status and provider-selection events must tolerate a null committed identity without turning it into ChatGPT in renderer state.
- Recording starts are blocked both in the interactive control path and the shortcut/IPC service path. The rejection exposes no raw provider/runtime error.

## Contracts And Boundaries

- Main configuration, provider registry, browser lifecycle, transcription dispatch, and trusted IPC remain main-process owned.
- Renderer uses `window.electronAPI` only. Update `src/main/preload.ts`, `src/main/preloadApi.ts`, and `src/renderer/types.d.ts` together for any public type change.
- Keep Local Whisper selection validation intact: an explicit Local Whisper selection still performs its existing readiness check before provider switching.
- Preserve trusted-sender validation for all existing and changed IPC handlers.

## Expected Files Or Components

- `src/main/config.ts`
- `src/main/browser.ts`
- `src/main/mainProcessApplication.ts`
- `src/main/ipc.ts`
- `src/main/preloadApi.ts`, `src/main/preload.ts`, `src/renderer/types.d.ts`
- `src/main/localWhisper/ipc/VoiceProviderSelectionService.ts`
- relevant shared provider-selection result/type module under `src/shared/`
- `src/renderer/providerSelectionCoordinator.ts`, `src/renderer/App.tsx`
- `src/renderer/components/MainToolbar.tsx`, `src/renderer/components/RecordingControls.tsx`
- focused tests, including new `tests/main/configProviderSelection.test.ts`, `tests/main/backgroundBrowserLifecycle.test.ts`, `tests/main/preloadApi.test.ts`, `tests/renderer/providerSwitching.test.ts`, and new toolbar/recording-control tests

## Acceptance Criteria

- A new profile starts with `provider === null`, persists it, and remains null on a following launch.
- Existing string and legacy missing-provider configurations respectively preserve their string selection and normalize to ChatGPT.
- The fresh-profile startup path never invokes provider construction/background browser initialization before the user chooses a provider.
- The provider Select is visibly unselected, keyboard-operable, and selecting a provider persists and initializes it through the existing switch transaction.
- Before selection, recording actions and hotkey-triggered recording cannot start a provider request; after selection, existing behavior remains covered by switching tests.
- Renderer/preload and main IPC tests accept intentional null only at the explicit active-provider boundary and reject malformed values.

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/main/configProviderSelection.test.ts tests/main/backgroundBrowserLifecycle.test.ts tests/main/preloadApi.test.ts tests/renderer/providerSwitching.test.ts tests/renderer/providerStatusPresentation.test.ts tests/renderer/recordingControls.test.ts`
- `npm run lint -- --quiet src/main/config.ts src/main/browser.ts src/main/mainProcessApplication.ts src/main/ipc.ts src/main/localWhisper/ipc/VoiceProviderSelectionService.ts src/main/preloadApi.ts src/renderer/App.tsx src/renderer/providerSelectionCoordinator.ts src/renderer/components/MainToolbar.tsx src/renderer/components/RecordingControls.tsx`

## Failure And Rollback

- If null propagation reaches a provider registry boundary, restore the prior selected provider state before completing the packet; never substitute a provider merely to make a test pass.
- Preserve existing user config data. Roll back only the files owned by this packet; do not rewrite or delete real user configuration files.

## Manual Gates

- Test with disposable profiles only. Do not inspect or modify real browser session, token, audio, or transcript data.
- Manually verify provider selection and disabled recording in a clean profile after automated checks.
- No commits, pushes, releases, or provider login are authorized.

## References

- Specification: `spec.md` provider selection and FLR-016.
- Existing configuration fallback: `src/main/config.ts`.
- Existing selector: `src/renderer/components/MainToolbar.tsx`.
- Existing selection sequencing: `src/renderer/providerSelectionCoordinator.ts`.

## Completion And Handoff

- Mark packet 02 complete in `todo.md` after its scoped checks and clean-profile manual verification.
- Update `handoff.md` with exact changed files, checks, and packet 03 as next.
- Stop; do not start startup orchestration or make a commit without separate authorization.
