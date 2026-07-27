# Handoff: Provider Audit Task 12 Complete

## Status

- Tasks 01–11 are committed; Task 11 is
  `87a84aae refactor(di): migrate translation runtime`.
- Task 12 is implemented and verified, with all Task 12 changes left unstaged
  and uncommitted for review.

## Completed Work

- Added graph-owned `PrettifyProviderAudit`, CLI process runner and adapters,
  provider factory/registry/runtime, selected-text gate/service/cache, and
  connection-check coordinator instances.
- Made HTTP and CLI providers constructor-injected and isolated Ollama model
  ownership per registry and graph.
- Moved one-shot execution and renderer-owned connection cancellation into
  state-owning classes.
- Routed Prettify IPC, shortcuts, and application shutdown through the injected
  runtime graph while preserving renderer/preload contracts.
- Removed the Prettify audit/provider/adapter/selected-text singletons, default
  audit construction, free runtime wrappers, IPC `WeakMap`, and dead legacy
  service module.

## Task 12 Boundary

- Composition and consumers: `src/main/di/`, `src/main/main.ts`,
  `src/main/mainProcessApplication.ts`, `src/main/ipc.ts`, and
  `src/main/shortcuts.ts`.
- Prettify providers, adapters, runtime, connection coordination, one-shot
  execution, selected-text service, and action gate under `src/main/services/`.
- Focused Prettify, selected-text, IPC, shortcut, application, composition,
  and Packet 01 audit tests under `tests/main/`.

## Checks

- Focused Prettify, composition, and Packet 01 audit tests passed: 18/18
  entrypoints.
- Full unit suite passed: 152/152 entrypoints.
- `npm run typecheck`, `npm run test:types`, and `npm run lint` passed.
- `npm run format:check` and `git diff --check` passed.

## Risks And Manual Gaps

- Live HTTP/CLI providers, executables, credentials, private selected text,
  packaged desktop startup, and platform-native verification remain deferred
  manual gates.
- No dependency, live-provider, packaging, push, PR, or release action was
  used.

## Next Packet

- [13 Main IPC and lifecycle DI](13_migrate_main_ipc_lifecycle_di.md)
- Review and commit authorization for Task 12 are required before Task 13
  begins.
