# 11 Migrate Translation DI

## Outcome

Move Translation audit, provider factories/registry, runtime, browser adapters,
selected-text orchestration, cache, and shutdown state into the main graph.

## Prerequisites

- Tasks 08–10 are complete.

## Owned Requirements

- Existing Translation/audit requirements and project-wide DI decisions.

## In Scope

- All main Translation runtime state and direct selected-text consumers.

## Out Of Scope

- Provider behavior, Translation IPC/result contracts, live pages, and
  diagnostic text capture integration.

## Task Contract

1. Construct one `TranslationProviderAudit`, provider factory/registry,
   `TranslationRuntime`, cache, and selected-text service per graph.
2. Inject browser launcher, page adapters, settings, logger, time, sleep, cache,
   clipboard, notification, and audit dependencies.
3. Remove default registry dependencies, singleton registry/runtime/audit, and
   exported selected-text service instances.
4. Preserve provider definitions, lazy provider reuse, cache keys, language
   validation, retries, cleanup, shutdown retry, and audit correlation.
5. Keep factories exhaustive and testable without global state.

## Contracts And Boundaries

- Translation pages, source/result text, sessions, and browser objects remain
  main only.
- Shared and renderer contracts remain unchanged.

## Expected Files Or Components

- Translation audit/registry/runtime/providers/selected-text modules,
  composition root, and focused tests.

## Acceptance Criteria

- Independent graphs do not share providers, runtime queues, caches, or audits.
- All Translation lifecycle/privacy/provider tests pass.
- No migrated singleton/default dependency seam remains.

## Verification

- Run all Translation tests, Packet 01 audit tests, full types/lint/format/unit
  checks, and `git diff --check`.

## Failure And Rollback

- Preserve selectors, languages, polling, retry, cleanup, clipboard, cache, and
  notification behavior.

## Manual Gates

- No live pages, credentials, or accounts.

## References

- Task 02 contract and Task 10 handoff.

## Completion And Handoff

- Mark only Task 11 complete and hand off to Task 12.
