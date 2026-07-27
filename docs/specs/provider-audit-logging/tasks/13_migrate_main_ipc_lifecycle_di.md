# 13 Migrate Main IPC And Lifecycle DI

## Outcome

Complete main-process ownership by moving every IPC handler, controller,
per-sender operation, startup branch, and shutdown participant under
`MainProcessApplication`.

## Prerequisites

- Tasks 08–12 are complete.

## Owned Requirements

- Existing trusted IPC, lifecycle, privacy, and compatibility requirements plus
  project-wide DI decisions.

## In Scope

- `MainIpcController`, IPC registration/disposal, per-sender maps/controllers,
  startup orchestration, and full quit order.

## Out Of Scope

- IPC channel/type changes, preload/renderer migration, and feature behavior.

## Task Contract

1. Replace functional global IPC registration with a state-owning
   `MainIpcController` receiving explicit services/managers.
2. Own every handler registration, WeakMap, AbortController, streaming
   controller, trusted-sender adapter, and disposal hook as instance state.
3. Remove direct imports of service singletons and mutable config exports.
4. Make `MainProcessApplication` own normal/special startup and ordered,
   idempotent shutdown for IPC, shortcuts, Prettify, Translation, Voice/browser,
   diagnostics, history, windows/tray, and database.
5. Preserve trusted-sender checks, channel names, validation, result shapes,
   side effects, and best-effort cleanup logs.

## Contracts And Boundaries

- Renderer input remains untrusted.
- No privileged object crosses preload.
- IPC interface code may remain functional internally but owns no global state.

## Expected Files Or Components

- `ipc.ts`, lifecycle/application classes, composition root, and IPC/lifecycle
  tests.

## Acceptance Criteria

- Two application instances share no IPC/controller/lifecycle state.
- Registration and disposal are idempotent and leave no handler/hook behind.
- Existing IPC and quit-order tests pass unchanged at the contract level.

## Verification

- Run all IPC/controller/lifecycle/privacy tests and the full quality set.

## Failure And Rollback

- Do not weaken sender validation or alter results to simplify handlers.

## Manual Gates

- No live desktop/provider test.

## References

- Project conventions and Task 12 handoff.

## Completion And Handoff

- Mark only Task 13 complete and hand off to Task 14.
