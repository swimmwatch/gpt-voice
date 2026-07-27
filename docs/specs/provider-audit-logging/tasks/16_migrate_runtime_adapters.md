# 16 Migrate Runtime Adapters

## Outcome

Replace logger, Electron-runtime, and CloakBrowser module caches with
application-owned classes and explicit dependency injection.

## Prerequisites

- Tasks 08–15 are reviewed and committed.

## Owned Requirements

- Project-wide DI architecture decisions for runtime adapters.
- Existing logging, Electron privilege, CloakBrowser packaging, privacy, and
  provider compatibility requirements.

## In Scope

- `LoggerFactory` and typed scoped/root logger contracts.
- `ElectronRuntimeLoader` for clipboard, notifications, safe storage, and
  shell access.
- `CloakBrowserRuntimeLoader` for packaged configuration and lazy ESM loading.
- Dependency-seam-only edits to every current consumer of those adapters.
- Main composition-root ownership and deterministic unit/integration tests.

## Out Of Scope

- Config or locale state.
- Window, tray, shortcut, protocol, or Linux desktop ownership.
- Provider registries, browser ownership, IPC controller ownership, preload,
  renderer, or provider behavior changes.

## Task Contract

1. Add class-owned runtime adapters whose constructors receive module loaders,
   platform/environment/filesystem inputs, and other side-effecting
   dependencies needed for deterministic tests.
2. `LoggerFactory` owns one lazy `electron-log/main` load result per factory,
   configures current file/console levels, returns stable scoped loggers, and
   preserves the existing no-op fallback when loading fails.
3. `ElectronRuntimeLoader` owns one lazy Electron module load per instance and
   exposes typed methods for existing clipboard, notification, safe-storage,
   and fallback-sound behavior.
4. `CloakBrowserRuntimeLoader` owns one lazy import promise per instance,
   preserves packaged binary discovery and environment configuration, and
   exposes the existing context-launch operations.
5. Construct the production adapter instances in `MainProcessCompositionRoot`;
   inject their narrow interfaces into existing consumers through constructors
   or dependency objects. The migrated owners from Tasks 09–15 receive these
   adapters without compatibility forwarding APIs.
6. Remove mutable module caches, default constructed logger/runtime instances,
   free pass-through wrappers, and compatibility singletons. Keep immutable
   constants and pure normalization/path helpers functional.
7. Preserve log scopes/levels, notification sounds, clipboard types,
   safe-storage failure behavior, packaged executable paths, launch options,
   provider outcomes, and privacy protections.

## Contracts And Boundaries

- Electron and CloakBrowser access remains main-process-only.
- Renderer, preload, typed IPC, provider result, and settings contracts do not
  change.
- Adapter construction or logging failure must not expose sensitive values or
  change existing fail-open logging behavior.
- Two application graphs share no loader cache, import promise, or logger
  runtime state.

## Expected Files Or Components

- Runtime adapter modules under `src/main/`.
- `MainProcessCompositionRoot` and affected constructor/dependency interfaces.
- Existing logger/Electron/CloakBrowser consumers and focused tests.

## Acceptance Criteria

- No module-level mutable loader cache or constructed runtime/logger instance
  remains in the migrated modules.
- Every migrated consumer obtains the adapter through explicit injection.
- Separate graphs load, cache, and fail independently.
- Existing runtime behavior and source-contract privacy assertions pass.

## Verification

- Run `node --import tsx --test tests/main/loggerFactory.test.ts
  tests/main/electronRuntime.test.ts tests/main/cloakBrowserRuntime.test.ts
  tests/main/mainProcessCompositionRoot.test.ts
  tests/main/mainProcessApplication.test.ts`.
- Run focused directly affected provider-audit, settings-storage, selected-text,
  browser/provider, and Translation tests selected from the changed consumer
  set.
- Run `npm run typecheck`, `npm run test:types`, `npm run lint`,
  `npm run format:check`, `npm run test:unit`, and `git diff --check`.
- Statically assert the removed module-cache and compatibility export names do
  not remain.

## Failure And Rollback

- Do not change logger levels, Electron error semantics, packaged paths,
  environment precedence, or provider launch behavior to simplify injection.
- Rollback is code-only and must not remove application data.

## Manual Gates

- Do not launch Electron, CloakBrowser, providers, credentials, packaging, or
  external processes.

## References

- `AGENTS.md`
- `docs/agent-guides/project-conventions.md`
- Task 15 handoff

## Completion And Handoff

- Mark only Task 16 complete, update `handoff.md`, and identify Task 17 as next.
- Leave Task 16 uncommitted for review.
