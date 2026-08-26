# 03 Main startup orchestration and IPC

## Outcome

Integrate the dedicated startup coordinator into the composed Electron application so CloakBrowser is prepared before browser-dependent initialization, concurrent main-process jobs produce coherent snapshots, and the renderer can retrieve, subscribe to, and retry safe state.

## Prerequisites

- Packets 01 and 02 are complete and verified.
- Re-read the packet-01 shared contract and the current `handoff.md`; do not reconstruct contracts from memory.

## Owned Requirements

- FLR-005, FLR-006, FLR-007, FLR-008
- FLR-009, FLR-010, FLR-011, FLR-014
- FLR-016, FLR-017

## In Scope

- Construct the approved dedicated coordinator in `MainProcessCompositionRoot` with injected CloakBrowser preparation, selected-provider predicate, background-browser initialization, translation initialization, safe logger, and snapshot publication dependencies.
- Update `MainProcessApplication.startRuntime` ordering:
  - register trusted IPC and create the main window before beginning startup work, so a renderer can obtain the initial snapshot;
  - start the coordinator after window creation;
  - prepare CloakBrowser before any browser-dependent voice or translation work;
  - after preparation succeeds, run applicable selected-provider background initialization and translation initialization through coordinator-owned jobs, allowing independent jobs to run concurrently;
  - for an unselected provider, mark the voice-provider job not required and do not create/initialize a provider.
- Maintain existing tray, shortcuts, diagnostics pruning, benchmark, shutdown, and existing-selected-provider startup behavior. Coordinator cancellation/teardown must not publish late events after quit.
- Give `WindowManager` one narrowly named publisher for safe startup snapshots to the main window. It must tolerate an absent/destroyed window and must not persist sensitive failure data.
- Add shared IPC channel constants and a `MainIpcController` surface for:
  - retrieving the current coordinator snapshot;
  - subscribing/unsubscribing to snapshot-change events if an explicit subscription lifecycle is required by the existing IPC convention;
  - retrying only when the current snapshot is retryable.
- Register all invoke handlers through `TrustedIpcRegistrar`; reject malformed retry arguments and untrusted senders. Main handlers return decoder-compatible safe snapshots/acknowledgements only.
- Test lifecycle order, concurrent job summary/publication ordering, fresh/unselected skip behavior, failure/retry behavior, trusted IPC validation, and window publication.

## Out Of Scope

- Renderer subscriptions, loader layout, translations, and the visual Retry button.
- Changing the shared contract or provider selection semantics established in packets 01–02.
- Downloading models, logging into providers, package rebuilding, or altering `prepare:cloakbrowser`.

## Task Contract

- The coordinator owns all main-process bootstrap jobs it exposes. A provider/translation job cannot emit a direct loader string; it transitions its own job state and the coordinator derives the snapshot.
- The CloakBrowser job gates browser-dependent jobs. If it fails, dependent jobs do not construct a browser or provider. Retry starts a higher generation, preserves only confirmed succeeded jobs, and ignores all older completions.
- Every public snapshot is frozen/sanitized and contains predefined status codes, job state, generation, and only a truthful percentage from packet 01. It contains no exception text, file paths, URLs, session data, or logs.
- A late IPC query receives the same current snapshot that a current subscriber would receive. Publishing order may vary by job scheduling, but the snapshot's deterministic summary and generation must make it unambiguous.
- Existing configured users keep their selected provider's normal startup after runtime preparation; fresh users receive no provider initialization.

## Contracts And Boundaries

- `MainProcessCompositionRoot` is the only composition point for the coordinator; no global mutable instance.
- Electron window delivery remains owned by `WindowManager`; IPC ownership remains `MainIpcController` and `TrustedIpcRegistrar`.
- The renderer-facing transport must use shared decoders from packet 01; no raw `Error` crosses Electron boundaries.
- CloakBrowser installation and browser/process launch remain main-process-only.
- Maintain trusted sender checks, including on Retry. A renderer cannot select a download source, binary path, or arbitrary job.

## Expected Files Or Components

- `src/main/di/mainProcessCompositionRoot.ts`
- `src/main/di/mainProcessRuntimeFactory.ts` and related runtime-controller dependency types
- `src/main/mainProcessApplication.ts`
- `src/main/window.ts`
- `src/main/ipc.ts`
- `src/shared/firstLaunchStartup.ts`
- focused lifecycle and IPC tests: `tests/main/mainProcessApplication.test.ts`, new `tests/main/firstLaunchStartupIpc.test.ts`, `tests/main/preloadApi.test.ts` (preload compatibility), `tests/main/firstLaunchStartupCoordinator.test.ts`, and `tests/main/windowManager.test.ts`

Amend packet-01 coordinator/runtime tests only for integration behavior; retain their pure state-machine coverage.

## Acceptance Criteria

- The initial snapshot is queryable after IPC/main-window creation and before any job completes.
- On a fresh profile, startup prepares CloakBrowser but performs no background provider initialization or provider instantiation.
- With an existing selected provider, CloakBrowser preparation completes before browser-dependent provider/translation initialization; independent applicable jobs can run concurrently and appear coherently in snapshots.
- A runtime verification/install failure blocks dependent jobs, is safe to publish, and Retry resumes the same app process without rerunning confirmed jobs.
- Untrusted IPC calls and malformed inputs cannot retrieve privileged data or trigger preparation/retry.
- Quitting during startup does not retain a background context or publish a late generation event.

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/main/mainProcessApplication.test.ts tests/main/cloakBrowserRuntime.test.ts tests/main/firstLaunchStartupCoordinator.test.ts tests/main/firstLaunchStartupIpc.test.ts tests/main/preloadApi.test.ts tests/main/windowManager.test.ts`
- `npm run lint -- --quiet src/main/firstLaunchStartupCoordinator.ts src/main/cloakbrowser.ts src/main/mainProcessApplication.ts src/main/ipc.ts src/main/window.ts src/main/di/mainProcessCompositionRoot.ts src/main/di/mainProcessRuntimeFactory.ts`

## Failure And Rollback

- If coordinator wiring causes a lifecycle failure, preserve the previous application's browser/translation startup ordering for existing profiles while fixing the injection graph; never bypass binary verification or recreate a provider for an unselected profile.
- Roll back only packet-03 integration and test files. Do not remove cached runtime data or mutate production user configuration.

## Manual Gates

- Package/browser smoke checks require a disposable profile and may initiate a vendor runtime download; obtain explicit authorization before running them.
- After authorization, test both bundled and missing-runtime package cases on each supported Linux/Windows target. macOS remains subject to the repository's paused platform policy.
- No provider login, model download, commit, push, or release is authorized.

## References

- Specification: FLR-005–FLR-011, FLR-014, FLR-016–FLR-017.
- Coordinator contract: packet 01 and `src/shared/firstLaunchStartup.ts`.
- Lifecycle: `src/main/mainProcessApplication.ts`.
- Composition: `src/main/di/mainProcessCompositionRoot.ts` and `src/main/di/mainProcessRuntimeFactory.ts`.
- IPC trust boundary: `src/main/ipc.ts`.

## Completion And Handoff

- Mark packet 03 complete only after all scoped automated checks pass; record package smoke as pending if the manual gate was not authorized.
- Update `handoff.md` with changed files, checks, manual-gate status, and packet 04 as the exact next task.
- Stop without beginning renderer work or committing.
