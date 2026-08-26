# 05 First-launch review remediation

## Outcome

Make the committed first-launch startup work merge-ready by separating provider connection readiness from required startup preparation, awaiting Retry through trusted IPC, restoring generic loader use, correcting accessibility, and clearing the project formatting gate.

## Prerequisites

- Packets 01–04 are complete and committed as `a8029e3b` and `1e0920ea`.
- The approved first-launch specification remains unchanged; this packet repairs its implementation.

## Owned Requirements

- FLR-007, FLR-010, FLR-014–FLR-017

## In Scope

- In the composition-root Voice Provider runner, publish the resolved background status but return startup success even when `status.ready` is false. A rejected initialization remains a coordinator failure.
- Await and sanitize `FirstLaunchStartupCoordinator.retry()` in the trusted Retry handler. Keep zero-argument validation and trusted-sender ownership unchanged.
- Add `LoadingScreen` modes: generic `initializing` by default and explicit `startup` for `App`. The generic mode uses `loading.initializing`; startup-only progress, status, and Retry behavior remain unchanged.
- Make the indeterminate spinner decorative when the status paragraph owns the announcement.
- Replace the whitespace-dependent App subscription assertion with formatting-independent subscription-before-query coverage.
- Format every file reported by the repository-wide Prettier gate, including the two pre-existing formatting-only files.
- Update the plan/checklist/handoff records accurately.

## Out Of Scope

- Shared startup snapshot schema, IPC channel names, preload API signatures, provider selection semantics, authentication, model download, packaging, or new visual primitives.
- Browser/package/manual smoke tests, credentials, commits, pushes, releases, and publication.

## Task Contract

- CloakBrowser preparation is the only Voice Provider prerequisite that blocks the startup view. A signed-out browser provider, unconfigured API provider, or unloaded Local Whisper model leaves the provider disconnected but lets the loader exit after represented work is terminal.
- `retryFirstLaunchStartup()` remains a `Promise<FirstLaunchStartupSnapshot>` and resolves only after the coordinator retry attempt settles. A rejected retry is delivered as an IPC rejection to existing renderer handling; no detached promise is left behind.
- `LoadingScreen` renders exactly one live textual status. The indeterminate spinner has `announce={false}`; determinate progress remains a `progressbar` with its status text separate.
- Main startup passes `mode="startup"`; zero-prop callers continue to display the generic initialization copy.

## Contracts And Boundaries

- Main process remains the sole owner of browser/provider initialization and trusted IPC. The renderer continues to use `window.electronAPI` only.
- No raw provider error, session, URL, filesystem path, or installer detail crosses the startup snapshot, IPC, or loader boundary.
- Reuse `Spinner`, `ProgressSpinner`, `Button`, tokens, localization, and existing status patterns; do not add components, colors, or dependencies.

## Expected Files Or Components

- `src/main/di/mainProcessCompositionRoot.ts`, `src/main/ipc.ts`
- `src/renderer/App.tsx`, `src/renderer/components/LoadingScreen.tsx`, `src/renderer/ProviderSettingsWindow.tsx`
- Focused main/renderer tests, `docs/specs/first-launch-startup-readiness/tasks/{plan,todo,handoff}.md`, and formatting-only files reported by Prettier.

## Acceptance Criteria

- Each disconnected provider case completes the Voice Provider startup job and leaves recovery controls reachable; a CloakBrowser preparation failure still blocks and is retryable.
- Retry remains pending until the coordinator settles, returns a sanitized current snapshot, and has no detached rejection during disposal.
- Provider Settings displays generic initialization copy; startup uses startup copy; indeterminate startup status has one live announcement.
- The App readiness assertion survives Prettier formatting.
- `npm run format:check` passes.

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/main/mainProcessApplication.test.ts tests/main/mainProcessCompositionRoot.test.ts tests/main/firstLaunchStartupCoordinator.test.ts tests/main/firstLaunchStartupIpc.test.ts tests/main/preloadApi.test.ts tests/renderer/firstLaunchStartupState.test.ts tests/renderer/loadingScreen.test.ts tests/renderer/windowStartupState.test.ts tests/renderer/recordingControls.test.ts`
- `npx eslint --quiet` for all changed source and test files
- `npm run format:check`
- `git diff --check`

## Failure And Rollback

- If the new provider runner behavior regresses real preparation, roll back only this packet's runner/IPC/loader/test changes; preserve the already-verified CloakBrowser coordinator and provider-selection contracts.
- Do not bypass CloakBrowser verification or turn disconnected provider status into a connected state.

## Manual Gates

- Package/browser, clean-profile, keyboard Retry, screen-reader, bundled-runtime, and missing-runtime checks require separate network/manual authorization. Do not run them in this packet.

## References

- Specification: FLR-007, FLR-010, FLR-014–FLR-017.
- Review evidence: committed startup runner, Retry IPC, `LoadingScreen`, and focused test failures.

## Completion And Handoff

- Mark Packet 05 complete only after all automated checks pass.
- Update `todo.md` and `handoff.md` with changed files, exact checks, pending manual gates, and no next packet.
- Leave Packet 05 uncommitted and stop for review.
