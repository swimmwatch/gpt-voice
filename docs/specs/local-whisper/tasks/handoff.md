# Local Whisper Handoff

## Authoritative State

- Specification revision 7 and plan revision 12 are Approved.
- Tasks 01–14 are complete and committed; Task 14 is authoritative at
  `df14c118`.
- Task 15 is complete and committed at `b89a412`, with its verification tooling
  committed at `d8ab1ba`. Task 16 has not started and is not authorized by this
  handoff.
- AMD remains **Preview · Untested**. macOS remains
  **Planned · Unavailable**. Representative Windows execution remains
  exclusively in Task 19.

## Task 15 Completed

- Added closed shared Local Whisper IPC commands, acknowledgements, snapshots,
  provider-selection results, prompt-free public settings, and strict runtime
  decoders for prototypes, exact keys, bounds, IDs, revisions, epochs, prompt
  mutations, safe failures, and renderer-returned values.
- Added one main-owned snapshot projector, exact live main/settings window and
  top-level frame capabilities, atomic replay/subscription ordering, targeted
  revocation, action-authority checks, safe exception projection, and isolated
  settings, main-status, artifact, folder, and catalog-reference routes.
- Wired the sole process coordinator through provider dispatch, IPC,
  composition, startup, and exactly-once shutdown. Production remains
  fail-closed on a deferred prompt-free environment until Task 17 composes
  authenticated catalog/package inputs; startup performs no probe, download,
  spawn, allocation, or load.
- Added main-authoritative provider selection with rollback, commit-on-success
  renderer state, Local Runtime readiness semantics without login/API-key UI,
  strict preload decoding, stale event reconciliation, and subscriber/status
  publication failure isolation.
- Added Task-15 IPC/composition package scripts and a deterministic verifier.
  Its defined Windows profiles reject execution until Task 19.

## Changed Files

- Shared contracts: `src/shared/localWhisper/{failures,index,ipc,settings}.ts`.
- Main IPC and ownership: `src/main/localWhisper/ipc/`,
  `src/main/{ipc,main,mainProcessApplication,preloadApi,window}.ts`,
  `src/main/providerSettingsWindowController.ts`, and `src/main/di/`.
- Provider and coordinator seams:
  `src/main/providers/LocalWhisperVoiceProvider.ts` and
  `src/main/localWhisper/coordinator/LocalWhisperCoordinatorTypes.ts`.
- Renderer: `src/renderer/localWhisper/`,
  `src/renderer/{App,providerSelectionCoordinator,providerState}.ts*`,
  `src/renderer/types.d.ts`, and `src/renderer/components/MainToolbar.tsx`.
- Tests: focused shared/main/preload/renderer/composition/window/provider suites
  under `tests/`.
- Tooling and workflow state: `scripts/local-whisper/verify-ipc.ts`,
  `package.json`, `tasks/todo.md`, and this handoff.

## Verification

- Passed every exact Task-15 command: IPC tests, composition tests,
  deterministic IPC verification, source and test typechecks, ESLint with zero
  warnings, Prettier, and `git diff --check`.
- The complete TypeScript unit suite passed: **1,547 passed**.
- Additional Local Whisper provider/dispatch/registry/window/provider-state
  regressions passed. The negative `windows-cpu` verifier profile rejected
  before execution as required.
- Remote CI and representative Windows, AMD, and macOS execution were not run
  and are not claimed.

## Exact Next Step

- Task 16 is the next eligible packet. Start it only through a separately
  authorized `incremental-implementation` invocation.

## Blockers And Manual Gates

- No deterministic Task-15 implementation blocker remains.
- Authenticated production Local Whisper catalog/package inputs and their
  privileged artifact/reference adapters remain intentionally deferred to Task
  17; the current production composition fails closed.
- The defined Windows IPC profiles must not run before Task 19. Representative
  AMD and macOS execution is not claimed.
- Push, pull request, signing, packaging, publication, tag, upload, and release
  authority remain separately gated.
