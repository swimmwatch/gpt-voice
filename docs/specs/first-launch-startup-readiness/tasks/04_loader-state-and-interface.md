# 04 Loader state and interface

## Outcome

Expose the safe startup snapshot through the preload boundary and render a centered, accessible first-launch loader that accurately merges main and renderer initialization, gives a concise concurrent status and percentage, and offers Retry without introducing new visual components or colors.

## Prerequisites

- Packets 01–03 are complete and recorded in `handoff.md`.
- Reuse the existing shared `ProgressSpinner` already present in the dirty worktree; do not create a replacement spinner.

## Owned Requirements

- FLR-003 (renderer unselected-provider presentation)
- FLR-009, FLR-010, FLR-011, FLR-012, FLR-013, FLR-014
- FLR-015, FLR-016, FLR-017

## In Scope

- Add typed `window.electronAPI` methods in `src/main/preloadApi.ts` and `src/renderer/types.d.ts` for getting the startup snapshot, subscribing to snapshot changes, and requesting Retry. Decode every inbound snapshot with the shared contract before it reaches React.
- Add renderer startup-state helpers/reducer, for example under `src/renderer/`, that fold:
  - current main-process snapshot and generation;
  - provider bootstrap completion;
  - initial Prettify settings/connection work;
  - translation settings/connection work.
- Derive one deterministic active status presentation in fixed job order. Display all active jobs within a bounded concise line (for example, the first two names followed by a count) rather than accepting last-arriving status text. Ignore stale main generations and disposed/late renderer async results.
- Derive aggregate percentage only from the known complete work units/byte totals supplied by packet 01 and the renderer reducer. Use indeterminate `Spinner` only when no truthful percentage exists. Do not animate a made-up percentage or parse installer log text.
- Update `LoadingScreen` to render a centered vertical group using the existing theme tokens: shared loader, visible percentage when determinate, concise localized status, and a keyboard-accessible Retry action for a retryable safe failure. Ensure text wraps or truncates gracefully without a new background/border/color treatment.
- Update App bootstrap and WindowStartupGate readiness so the screen exits only after represented startup tasks are terminal and the app can present the unselected-provider state. It must not wait for provider login or model download.
- Update `MainToolbar`, `RecordingControls`, and status presentation only as needed to keep unselected-provider controls consistently disabled/hidden after the loader exits.
- Add localized message keys in every supported catalog for preparation, active job labels, retry, unavailable/install failure, and the unselected-provider prompt. Use predefined translations, not runtime error interpolation.
- Add focused tests for preload validation, reducer concurrency/generation semantics, loader markup/accessibility, determinate/indeterminate selection, Retry, and App's first-launch/unselected transition.

## Out Of Scope

- Changing coordinator, installer, IPC channel, binary verification, or provider-selection contract behavior from packets 01–03.
- New Select, tooltip, loader, button, or color system components.
- Provider authentication, Local Whisper setup/model downloads, or any outbound network test.

## Task Contract

- The loader's percentage is a display of the reducer's measured aggregate. It cannot be incremented by a timer, animation duration, or a guessed download size.
- The status line is generated from safe job IDs and localized labels. It must contain neither an `Error.message` nor a file path, URL, session value, or log line.
- A retryable main failure keeps the loader visible. The Retry button is disabled while a retry request is pending and can be activated with keyboard; only the current-generation success allows the screen to leave failure.
- Main snapshot subscription is registered before the first query is treated as authoritative, and cleanup unsubscribes on unmount. Query/event races are resolved by generation and job revision, never arrival order.
- The main loader uses the same foreground/background color tokens as the current app/settings UI. It remains centered and does not introduce a visible container boundary.

## Contracts And Boundaries

- Preload is the sole renderer bridge. Update `src/main/preload.ts`, `src/main/preloadApi.ts`, and `src/renderer/types.d.ts` together.
- Shared snapshot validation remains the only trust boundary for startup events. Renderer reducer input is immutable renderer-safe state.
- Existing Select, `Spinner`, `ProgressSpinner`, `Button`, `Tooltip`, and i18n mechanisms are reused; UI composition remains functional React.
- Do not use browser DOM globals or Electron/Node APIs in shared/reducer code.

## Expected Files Or Components

- `src/main/preload.ts`, `src/main/preloadApi.ts`
- `src/renderer/types.d.ts`
- `src/renderer/providerStartupState.ts` or a focused new startup-state reducer module
- `src/renderer/App.tsx`
- `src/renderer/components/LoadingScreen.tsx`
- `src/renderer/components/MainToolbar.tsx`, `src/renderer/components/RecordingControls.tsx` only for final unselected controls
- `src/main/i18n/*.ts` supported catalogs and generated/typed key checks
- `tests/main/preloadApi.test.ts`, `tests/main/i18n.test.ts`, `tests/renderer/providerStartupState.test.ts`, new `tests/renderer/firstLaunchStartupState.test.ts`, new `tests/renderer/loadingScreen.test.ts`, and App/provider accessibility tests

## Acceptance Criteria

- A fresh startup shows a centered shared loader, concise localized preparation text, and truthful percentage when its aggregate has known work units.
- Concurrent main/renderer activity produces a deterministic bounded summary; an older generation/event cannot overwrite newer status or progress.
- No measurable aggregate causes the existing indeterminate spinner to appear instead of a fabricated percentage.
- Failure shows only safe localized copy and an accessible Retry. Retry leaves completed work reflected, resets only incomplete/failed work, and does not display stale failure text after success.
- On success the main UI shows a visibly unselected provider and disabled recording until user selection; no default ChatGPT appearance is introduced.
- Snapshot decoder rejects malformed/extra-property preload events, and all subscriptions are removed during cleanup.

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/main/preloadApi.test.ts tests/main/i18n.test.ts tests/renderer/providerStartupState.test.ts tests/renderer/firstLaunchStartupState.test.ts tests/renderer/loadingScreen.test.ts tests/renderer/providerSwitching.test.ts tests/renderer/recordingControls.test.ts`
- `npm run lint -- --quiet src/main/preload.ts src/main/preloadApi.ts src/renderer/types.d.ts src/renderer/providerStartupState.ts src/renderer/App.tsx src/renderer/components/LoadingScreen.tsx src/renderer/components/MainToolbar.tsx src/renderer/components/RecordingControls.tsx src/main/i18n`
- `npm run format:check`

## Failure And Rollback

- If renderer startup state becomes inconsistent, keep the main snapshot contract intact and roll back only the reducer/UI changes; do not add a default provider or suppress a main-process failure.
- Restore the previous loading screen markup only if it is necessary to regain accessibility, preserving the shared spinner changes owned by existing dirty work.

## Manual Gates

- With a disposable clean profile, manually inspect narrow and normal main-window sizes, keyboard focus/Retry, screen-reader progress/status announcements, bundled-runtime startup, and missing-runtime Retry after explicit network authorization.
- Do not use real provider sessions, audio, transcripts, or production configuration.
- No commit, push, release, or package publication is authorized.

## References

- Specification: FLR-003, FLR-009–FLR-017.
- Renderer bootstrap: `src/renderer/App.tsx`, `src/renderer/providerStartupState.ts`.
- Shared loaders: `src/renderer/components/ui/spinner.tsx` and `src/renderer/components/LoadingScreen.tsx`.
- Preload pattern: `src/main/preloadApi.ts`.

## Completion And Handoff

- Mark packet 04 complete after all scoped checks and approved manual verification are recorded.
- Update `handoff.md` with final files/checks/manual gates and state that the workstream is ready for review.
- Stop; no commit or release action is implied.
