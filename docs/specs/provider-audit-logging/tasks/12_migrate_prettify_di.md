# 12 Migrate Prettify DI

## Outcome

Move Prettify audits, provider factories/registries, HTTP/CLI adapters, process
runners, model lifecycle, selected-text orchestration, caches, and cancellation
state into the main graph.

## Prerequisites

- Tasks 08–11 are complete.

## Owned Requirements

- Existing Prettify/audit requirements and project-wide DI decisions.

## In Scope

- All main Prettify runtime state and direct selected-text consumers.

## Out Of Scope

- Provider behavior, prompt/result contracts, capture integration, and live
  HTTP/CLI execution.

## Task Contract

1. Construct one `PrettifyProviderAudit`, provider registry/factory, HTTP/CLI
   adapters, process runner, selected-text gate/service, cache, and model owner
   per graph.
2. Inject fetch, process, filesystem/path, settings, clock, logger, clipboard,
   notification, cache, and audit dependencies.
3. Remove default Claude/Codex CLI adapter instances, audit singleton, selected
   text service/gate instances, and mutable connection/model state outside
   classes.
4. Preserve one-shot execution, cancellation, model ownership, output limits,
   environment filtering, cache behavior, and audit correlation.

## Contracts And Boundaries

- Prompts, selected text, results, argv, stdout/stderr, credentials, and model
  settings remain main only.
- Renderer/preload/IPC results remain unchanged.

## Expected Files Or Components

- Prettify services/providers/audit/CLI modules, composition root, and tests.

## Acceptance Criteria

- Independent graphs share no adapter, process, model, cache, gate, or audit
  state.
- All HTTP/CLI/selected-text/privacy tests pass.
- No migrated singleton/default dependency seam remains.

## Verification

- Run all Prettify tests, Packet 01 audit tests, full quality checks/unit suite,
  and `git diff --check`.

## Failure And Rollback

- Preserve endpoints, requests, process bounds, model policy, prompts, cache,
  clipboard, notification, and cleanup.

## Manual Gates

- No live HTTP/CLI provider or executable.

## References

- Tasks 05–06 contracts and Task 11 handoff.

## Completion And Handoff

- Mark only Task 12 complete and hand off to Task 13.
