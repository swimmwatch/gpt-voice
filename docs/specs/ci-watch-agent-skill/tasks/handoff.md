# `$watch-process` Handoff

## Completed Packets

- [01 — Skill surface and project-local layout](01_skill_surface_and_layout.md)
  - Added the explicit `$watch-process` public skill surface and metadata.
  - Added tracked library/reference/scenario placeholders and private runtime ignore boundary.
  - Added policy coverage for activation, timeout, lifecycle, Goal independence,
    project-local scope, inactive hooks, and GitLab-specific surface absence.
  - No hook, watcher, process, dependency, commit, or external action was created.
- [02 — Scenario contract](02_scenario_contract.md)
  - Added the closed Draft 2020-12 scenario schema and dependency-free portable
    `WatchScenarioRegistry`.
  - Added deterministic defaulting, canonical JSON digests, closed validation,
    substitutions, repair-glob/scope checks, and filename-bound UTF-8 loading.
  - Added complete GitHub Actions, generic CI CLI, Docker build, and local command
    examples with focused standalone Node policy tests.
  - No adapter execution, watcher, hook, repair write, delivery, dependency, or
    external process action was created.
- [03 — Portable runtime core](03_portable_runtime_core.md)
  - Added the Node 22/24 preflight, frozen runtime contracts, shell-free
    `ManagedProcessRunner`, token-bound `ManagedProcessExecution`, and bounded
    private evidence handling.
  - Added monotonic-deadline polling, validated cwd/environment/executable
    preparation, terminal normalization, and sanitized failure fingerprints.
  - Added disposable local fixtures and focused cross-platform contract tests
    for command fidelity, restricted environments, timeout/abort cleanup,
    bounded evidence, and Windows path semantics.
  - No adapter, provider, state store, receipt, hook, watcher, repair write,
    delivery, dependency, or external CI process action was created.
- [04 — State, receipts, and audit](04_state_receipts_and_audit.md)
  - Added private runtime storage with validated relative paths, owner-only
    permissions where available, link defenses, and atomic replacement.
  - Added serialized lock ownership and generation-bound state CAS,
    intent-before-action receipts, bounded audit rotation, and fresh success
    attestation validation.
  - Added focused tests for concurrent operations, corrupt data, link attacks,
    safe cleanup, and privacy-safe persisted shapes.
  - No adapter, provider, watcher, hook, repair write, delivery, dependency,
    or external CI process action was created.
- [05 — Local and Docker adapters](05_local_and_docker_adapters.md)
  - Added shared receipt-bound owned-process orchestration plus concrete local
    command and Docker build adapters.
  - Added immutable command/input/source/start-token identities, intent-before-
    start/retry receipts, safe same-runner reattach, and owned-token-only
    cancellation without PID lookup.
  - Added shell-free preflight/verification command driving, bounded evidence
    projection, declared output verification, Docker daemon probing, and an
    allowlist-based Docker policy that rejects registry, Buildx, login, and
    cleanup actions.
  - Added injected-driver adapter tests; no real Docker daemon, registry,
    external CLI, CI target, hook, repair write, delivery, dependency, or
    external process action was used during automated verification.
- [06 — Generic CI adapter](06_generic_ci_adapter.md)
  - Added the closed, versioned generic-CI result schema, a dependency-free
    runtime validator, and a bounded strict-stdout JSON collector.
  - Added a provider-neutral CLI adapter with shell-free command execution,
    intent-before-start receipts, receipt-bound attach/idempotence, exact
    provider/target/attempt/SHA/operation-key validation, required-member
    checks, and separately authorized declared cancellation.
  - Added focused fake-child coverage for strict protocol parsing, malformed
    and prompt-like stdout, identity and status-map failures, authentication,
    cancellation, evidence, and no-GitLab/no-external-runtime-dependency policy.
  - No provider CLI, remote CI target, credentials, Docker daemon, hook,
    repair write, delivery, dependency installation, or external process was
    invoked during automated verification.
- [07 — GitHub Actions adapter](07_github_actions_adapter.md)
  - Added a shell-free GitHub Actions adapter for exact workflow-run and
    pull-request required-check contracts, using only bounded, closed JSON
    projections from the authenticated `gh` executable.
  - Bound run identity to repository, allowlisted workflow, provider rerun
    attempt, exact source SHA, and watch generation; bound PR aggregates to
    the exact head SHA and fresh branch/ruleset required-check contract.
  - Added fail-closed handling for incomplete, duplicate, pending, neutral,
    cancelled, stale, unexpected-skipped, and unallowlisted required members,
    including external commit statuses and linked multiple workflow runs.
  - Added declared-only dispatch guarded by explicit `start` authorization,
    allowlisted workflow and fixed inputs, intent-before-action receipts, and
    exact operation-key reconciliation without duplicate dispatches.
  - Added sanitized fixtures and fake-child tests only; no live `gh` command,
    GitHub authentication, remote dispatch/cancellation, workflow edit,
    credential, release, publish, or deploy action was performed.

## Changed Files

- `.agents/skills/watch-process/references/process-watch-scenario.schema.json`
- `.agents/skills/watch-process/scripts/lib/scenario-command-arguments.mjs`
- `.agents/skills/watch-process/scripts/lib/scenario-contract-support.mjs`
- `.agents/skills/watch-process/scripts/lib/scenario-repair-scope.mjs`
- `.agents/skills/watch-process/scripts/lib/watch-scenario-normalizer.mjs`
- `.agents/skills/watch-process/scripts/lib/watch-scenario-registry.mjs`
- `.agents/skills/watch-process/scripts/lib/watch-scenario-validator.mjs`
- `.codex/process-watch/scenarios/github-pr-required-checks.watch.json`
- `.codex/process-watch/scenarios/generic-ci-run.watch.json`
- `.codex/process-watch/scenarios/local-docker-build.watch.json`
- `.codex/process-watch/scenarios/local-long-test.watch.json`
- `tests/skills/watchProcess/scenario-contract.test.mjs`
- `docs/specs/ci-watch-agent-skill/tasks/todo.md`
- `docs/specs/ci-watch-agent-skill/tasks/handoff.md`
- `.agents/skills/watch-process/scripts/lib/bounded-evidence-buffer.mjs`
- `.agents/skills/watch-process/scripts/lib/deadline-aware-poller.mjs`
- `.agents/skills/watch-process/scripts/lib/failure-fingerprint.mjs`
- `.agents/skills/watch-process/scripts/lib/managed-process-execution.mjs`
- `.agents/skills/watch-process/scripts/lib/managed-process-runner.mjs`
- `.agents/skills/watch-process/scripts/lib/managed-process-support.mjs`
- `.agents/skills/watch-process/scripts/lib/monotonic-deadline.mjs`
- `.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs`
- `.agents/skills/watch-process/scripts/lib/runtime-contracts.mjs`
- `.agents/skills/watch-process/scripts/lib/runtime-core-support.mjs`
- `.agents/skills/watch-process/scripts/lib/runtime-preflight.mjs`
- `tests/skills/watchProcess/fixtures/runtime-child.mjs`
- `tests/skills/watchProcess/runtime-core.test.mjs`
- `.agents/skills/watch-process/scripts/lib/atomic-state-store.mjs`
- `.agents/skills/watch-process/scripts/lib/audit-journal.mjs`
- `.agents/skills/watch-process/scripts/lib/operation-receipt-store.mjs`
- `.agents/skills/watch-process/scripts/lib/runtime-state-contracts.mjs`
- `.agents/skills/watch-process/scripts/lib/success-attestation.mjs`
- `.agents/skills/watch-process/scripts/lib/watch-runtime-storage.mjs`
- `tests/skills/watchProcess/state-and-audit.test.mjs`
- `.agents/skills/watch-process/scripts/lib/managed-process-runner.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/adapter-support.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/declared-output-verifier.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/docker-build-process-adapter.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/docker-command-policy.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/local-command-process-adapter.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/owned-process-adapter.mjs`
- `tests/skills/watchProcess/local-docker-adapters.test.mjs`
- `.agents/skills/watch-process/references/generic-ci-result.schema.json`
- `.agents/skills/watch-process/scripts/lib/adapters/generic-ci-result-contract.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/generic-ci-json-output-collector.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/generic-ci-cli-process-adapter.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/adapter-support.mjs`
- `.agents/skills/watch-process/scripts/lib/managed-process-execution.mjs`
- `.agents/skills/watch-process/scripts/lib/managed-process-runner.mjs`
- `tests/skills/watchProcess/generic-ci-adapter.test.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/github-actions-response-contract.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/github-actions-json-output-collector.mjs`
- `.agents/skills/watch-process/scripts/lib/adapters/github-actions-process-adapter.mjs`
- `tests/skills/watchProcess/github-actions-adapter.test.mjs`
- `tests/skills/watchProcess/fixtures/github-workflow-run-success.json`
- `tests/skills/watchProcess/fixtures/github-workflow-run-failure.json`
- `tests/skills/watchProcess/fixtures/github-workflow-run-jobs.json`
- `tests/skills/watchProcess/fixtures/github-pr-required-checks-success.json`
- `tests/skills/watchProcess/fixtures/github-pr-required-checks-failure.json`
- `tests/skills/watchProcess/fixtures/github-workflow-surface.json`
- `docs/specs/ci-watch-agent-skill/tasks/todo.md`
- `docs/specs/ci-watch-agent-skill/tasks/handoff.md`

## Checks

- `npx prettier --check .agents/skills/watch-process/references/process-watch-scenario.schema.json .codex/process-watch/scenarios/*.watch.json .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/scenario-contract.test.mjs`
- `npx eslint --no-warn-ignored .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/scenario-contract.test.mjs`
- `node --check .agents/skills/watch-process/scripts/lib/watch-scenario-registry.mjs`
- `node --test tests/skills/watchProcess/scenario-contract.test.mjs`
- `node --import tsx --test tests/skills/watchProcessSkillSurface.test.ts`
- `npm run test:types`
- Verified the tracked schema is semantically identical to normative `SCHEMA-003`.
- Confirmed every runtime import is either a Node.js built-in or a local module;
  no third-party runtime import, `gitlab`, `glab`, or `GitLabCiProcessAdapter`
  surface exists.
- `git diff --check`
- `node --check` for every Task 03 runtime module and focused test
- `node --test tests/skills/watchProcess/runtime-core.test.mjs` (15 passing)
- `npx prettier --check .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/runtime-core.test.mjs tests/skills/watchProcess/fixtures/runtime-child.mjs`
- `npx eslint --no-warn-ignored .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/runtime-core.test.mjs tests/skills/watchProcess/fixtures/runtime-child.mjs`
- `node --test tests/skills/watchProcess/scenario-contract.test.mjs` (11 passing)
- `node --import tsx --test tests/skills/watchProcessSkillSurface.test.ts` (5 passing)
- `npm run test:types`
- Confirmed Task 03 runtime modules import only `node:` built-ins and relative
  base-library modules, always use `shell: false`, and expose no adapter,
  provider, state, or hook behavior.
- `node --check` for every Task 04 module and focused test
- `node --test tests/skills/watchProcess/state-and-audit.test.mjs` (9 passing)
- `node --test tests/skills/watchProcess/runtime-core.test.mjs` (15 passing)
- `node --test tests/skills/watchProcess/scenario-contract.test.mjs` (11 passing)
- `node --import tsx --test tests/skills/watchProcessSkillSurface.test.ts` (5 passing)
- `npm run test:types`
- `npx prettier --check .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/state-and-audit.test.mjs`
- `npx eslint --no-warn-ignored .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/state-and-audit.test.mjs`
- `git diff --check`
- `node --check` for the Task 05 adapter modules, test, and updated runner
- `node --test tests/skills/watchProcess/local-docker-adapters.test.mjs` (10 passing)
- `npx prettier --check .agents/skills/watch-process/scripts/lib/managed-process-runner.mjs .agents/skills/watch-process/scripts/lib/adapters/*.mjs tests/skills/watchProcess/local-docker-adapters.test.mjs`
- `npx eslint --no-warn-ignored .agents/skills/watch-process/scripts/lib/managed-process-runner.mjs .agents/skills/watch-process/scripts/lib/adapters/*.mjs tests/skills/watchProcess/local-docker-adapters.test.mjs`
- `node --test tests/skills/watchProcess/runtime-core.test.mjs` (15 passing)
- `node --test tests/skills/watchProcess/state-and-audit.test.mjs` (9 passing)
- `node --test tests/skills/watchProcess/scenario-contract.test.mjs` (11 passing)
- `node --import tsx --test tests/skills/watchProcessSkillSurface.test.ts` (5 passing)
- `npm run test:types`
- Confirmed adapter tests use an injected command driver and fake child-process
  runner only; no Docker CLI/daemon or other external process is invoked.
- `node --check` for Task 06 modules and focused test
- `node --test tests/skills/watchProcess/generic-ci-adapter.test.mjs` (8 passing)
- `node --test tests/skills/watchProcess/generic-ci-adapter.test.mjs tests/skills/watchProcess/runtime-core.test.mjs tests/skills/watchProcess/scenario-contract.test.mjs tests/skills/watchProcess/local-docker-adapters.test.mjs`
- `npx prettier --check` for all Task 06 modules, schema, and focused test
- `npx eslint --no-warn-ignored` for all Task 06 JavaScript modules and focused test
- `npm run test:types`
- `npm run lint` (passes; existing repository warnings remain)
- `npm run format:check`
- `git diff --check`
- Confirmed the generic adapter uses only `node:`/relative imports and exposes
  no `gitlab`, `glab`, or dedicated-provider implementation surface.
- `node --check` for all Task 07 adapter modules and focused test
- `node --test tests/skills/watchProcess/github-actions-adapter.test.mjs`
  (12 passing)
- `node --test` across Task 03–07 watch-process runtime, state, scenario,
  local/Docker, generic-CI, and GitHub Actions suites (65 passing)
- `npx prettier --check` and `npx eslint --no-warn-ignored` for all Task 07
  adapter modules, test, and JSON fixtures
- `node --import tsx --test tests/skills/watchProcessSkillSurface.test.ts`
  (5 passing)
- `npm run test:types`
- `npm run format:check`
- `npm run lint` (passes; only existing repository warnings remain)
- `git diff --check`
- Confirmed the three observed GitHub workflow files remain unchanged and all
  adapter imports are `node:` built-ins or relative local modules.

## Next Packet

[08 — Orchestrator and generated watcher](08_orchestrator_and_generated_watcher.md)

## Blockers

None. Task 07 is complete and intentionally uncommitted for the next explicit
incremental-implementation invocation, which may commit Task 07 and start
Task 08.
