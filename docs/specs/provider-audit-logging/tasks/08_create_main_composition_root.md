# 08 Create Main Composition Root

## Outcome

Create the class-owned Electron main composition root and move the complete
Task 07 persistence/transcription graph out of module scope. No database,
repository, redactor, storage, history, batch-transcription, streaming-service,
or streaming-IPC-controller instance remains global.

## Prerequisites

- Task 07 is committed as `982b49a`.
- The expanded DI plan and this packet have explicit approval and execution
  authorization.
- No live provider, browser, private database, or renderer is used.

## Owned Requirements

- `ARCH-004`
- `COMP-003`
- Architecture decisions `dependency-injection.scope` revision 2,
  `dependency-injection.composition`, `dependency-injection.lifetime`,
  `dependency-injection.process-boundaries`, and
  `dependency-injection.stateful-globals`.

## In Scope

- `MainProcessCompositionRoot` and `MainProcessApplication`.
- Class-owned construction of the Task 07 graph.
- Explicit IPC dependencies and owned IPC registration/disposal.
- Removal of Task 07 singleton/default dependency seams.
- Deterministic composition and lifecycle tests.

## Out Of Scope

- Migrating configuration, locale, windows, tray, shortcuts, background
  browser, provider registries, Translation, Prettify, preload, or React state.
- Changing IPC channels, renderer types, provider results, database schema, or
  provider behavior.
- A DI framework, decorators, reflection, service locator, or global container.

## Task Contract

1. Add `src/main/di/mainProcessCompositionRoot.ts`.
   - `MainProcessCompositionRoot` constructs dependencies as local variables.
   - It returns one `MainProcessApplication`; it does not expose `resolve`,
     `get`, token lookup, mutable registrations, or the database/repositories.
   - Accept a typed environment for clocks, UUIDs, logging, clipboard,
     database path/dependencies, browser/provider access, and other existing
     boundary functions needed by batch/streaming transcription.
   - Production defaults are stateless values/functions only. They must not
     construct or cache stateful services at module scope.
2. Add `src/main/mainProcessApplication.ts`.
   - Own the constructed graph, IPC registration, quit promise, and completion
     flag as private instance state.
   - Register Electron ready/quit callbacks with arrow fields or bound methods
     so Electron retains the application instance without a module-level
     application variable.
   - Create the graph only for normal application startup. Early single-instance
     exit and the Linux integration-removal mode must not open the database.
   - Prune diagnostic storage after config load and before IPC registration.
3. Construct exactly one:
   - `AppDatabaseCoordinator`;
   - `SqliteTranscriptionHistoryRepository`;
   - `SqliteDiagnosticCaptureRepository`;
   - `DiagnosticTextRedactor`;
   - `DiagnosticCaptureStorage`;
   - transcription result cache;
   - batch transcription service;
   - streaming transcription service;
   - `TranscriptionHistoryIpcController`.
4. Keep the database and repositories private to the graph.
   - Expose only typed application services required by the application and IPC
     controller.
   - Do not export a container instance or any constructed dependency.
5. Make constructors explicit.
   - `DiagnosticCaptureStorage` requires a complete dependency object.
   - Remove the exported `diagnosticTextRedactor` instance.
   - Remove default transcription-completion dependencies.
   - Completion dependencies accept the state-owning history repository/store
     object rather than an `addHistoryEntry` forwarding function.
   - Remove exported batch and streaming service instances.
6. Replace global IPC lifecycle state.
   - `registerIpcHandlers` accepts explicit Task 08 dependencies.
   - Return a state-owning registration/controller object with idempotent
     `dispose()`.
   - It owns the streaming controller and removes its handlers/hooks on
     disposal; do not retain it in a module `let`.
   - Existing unrelated IPC handler logic may remain functional until Task 13.
7. Shutdown order remains:
   - stop accepting/disposing IPC-owned streaming work;
   - unload/shutdown existing provider and browser owners;
   - stop diagnostic admission and await accepted operations;
   - close the history service;
   - close the shared database exactly once.
   - Failures remain best effort and use the existing safe logging/result
     contracts.
8. Remove from module scope:
   - `appDatabase`;
   - concrete repository instances;
   - diagnostic redactor/storage instances;
   - lazy history store state and getters;
   - default completion dependency objects containing constructed state;
   - `transcribeAudio`;
   - `streamingTranscriptionService`;
   - streaming IPC controller and quit state.
9. Update the `AGENTS.md` rule to prohibit module-level containers and
   persistence/service instances. Immutable constants and pure declarations
   remain allowed.

## Contracts And Boundaries

- Main remains the only process with database, filesystem, clipboard, provider,
  and Electron authority.
- No database/repository reference crosses into preload or renderer.
- The root is a construction boundary, not a service locator.
- No free wrapper may exist solely to retrieve a global and invoke its method.
- Task 07 privacy, migration, retention, transaction, and shutdown guarantees
  remain unchanged.

## Expected Files Or Components

- Add `src/main/di/mainProcessCompositionRoot.ts`.
- Add `src/main/mainProcessApplication.ts`.
- Modify `src/main/main.ts`, `src/main/ipc.ts`, transcription services,
  diagnostic storage/redactor, and directly related tests.
- Add focused composition-root and application-lifecycle tests.

## Acceptance Criteria

- Two independently constructed graphs share no database, repository, cache,
  storage queue, history, IPC controller, or shutdown state.
- Importing persistence/service modules constructs no stateful object and opens
  no database.
- Normal startup prunes before IPC registration.
- Early/special startup opens no database.
- Shutdown is idempotent, rejects new diagnostic work, drains accepted work,
  disposes streaming IPC, and closes one database once.
- No public or renderer-visible result changes.

## Verification

```bash
rtk node --import tsx --test \
  tests/main/mainProcessCompositionRoot.test.ts \
  tests/main/mainProcessApplication.test.ts \
  tests/main/repositories/*.test.ts \
  tests/main/diagnosticCaptureStorage.test.ts \
  tests/main/transcriptionHistoryIpcController.test.ts \
  tests/main/transcription.test.ts \
  tests/main/streamingTranscription.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm test
rtk git diff --check
```

## Failure And Rollback

- Do not replace the root with a module singleton or setter-based injection to
  obtain passing tests.
- Roll back by restoring Task 07 construction in `main.ts`; do not alter or
  delete the SQLite schema or captured rows.
- Any privacy, lifecycle-order, or cross-process regression blocks completion.

## Manual Gates

- No real app-data profile, provider, browser, credential, commit, push, PR,
  package, or release is authorized.

## References

- `AGENTS.md`.
- `.agents/references/task-packets.md`.
- Task 07 repository contracts and the expanded DI decisions in
  `decisions.yaml`.

## Completion And Handoff

- Mark only Task 08 complete.
- Record changed files, checks, risks, and Task 09 as next.
- Stop without committing Task 08 or starting Task 09.
