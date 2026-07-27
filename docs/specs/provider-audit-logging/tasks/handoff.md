# Handoff: Provider Audit Task 08 Complete

## Status

- Tasks 01–07 are committed; Task 07 is `982b49a5 feat(audit): add diagnostic capture repositories`.
- The expanded Tasks 08–22 plan is approved through `approval.plan` revision 4.
- Task 08 was authorized through `execution.task-08` revision 1.
- Task 08 is implemented and verified, unstaged and uncommitted for review.

## Completed Work

- Added `MainProcessCompositionRoot`, `MainProcessRuntimeGraph`, and `MainProcessApplication`.
- Deferred construction of the Task 07 database/repository/redactor/cache/transcription graph until normal Electron
  startup; single-instance rejection and Linux integration removal open no database.
- Constructed one shared database coordinator, both concrete repositories, one diagnostic storage/redactor, one
  history IPC controller, one transcription cache, and batch/streaming services per application instance.
- Made diagnostic storage, batch audit, and streaming service dependencies explicit; removed the exported redactor
  instance and default streaming factory.
- Replaced the global streaming IPC controller with a state-owning `MainIpcRegistration` that removes every
  registered handler and disposes streaming ownership idempotently.
- Moved quit state and ordered cleanup into the application instance: IPC, Prettify, Translation, browser,
  diagnostic drain, then shared SQLite close.
- Added the module-level mutable-runtime prohibition to `AGENTS.md`.

## Changed Files

- `AGENTS.md`
- `src/main/di/mainProcessCompositionRoot.ts`
- `src/main/di/mainProcessRuntimeGraph.ts`
- `src/main/mainProcessApplication.ts`
- `src/main/main.ts`
- `src/main/ipc.ts`
- `src/main/services/diagnosticCaptureStorage.ts`
- `src/main/services/diagnosticTextRedactor.ts`
- `src/main/services/transcription.ts`
- `src/main/services/streamingTranscription.ts`
- `tests/main/mainProcessCompositionRoot.test.ts`
- `tests/main/mainProcessApplication.test.ts`
- Directly affected diagnostic, streaming IPC, Translation lifecycle/settings, Prettify privacy, and agent-policy
  contract tests
- Expanded DI planning, decision, checklist, and renumbered packet artifacts

## Checks

- Task 08 focused composition, lifecycle, repository, diagnostic, history IPC, transcription, streaming, and startup
  tests passed across 12 entrypoints.
- Full unit suite passed: 897 tests in 143 entrypoints.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `git diff --check` passed.

## Risks And Platform Gaps

- Synthetic temporary SQLite databases cover construction, isolation, pruning, disposal, and close ordering.
- No real application-data database, Electron window, browser, provider, credential, or private content was used.
- Packaged/native lifecycle verification remains deferred to its later manual gate.
- Unrelated main runtime, provider-family, IPC, preload, and renderer globals intentionally remain for Tasks 09–15.

## Next Packet

- [09 Runtime and desktop DI](09_migrate_runtime_and_desktop_di.md)
- Task 09 requires separate review, commit authorization for Task 08, and execution authorization.
