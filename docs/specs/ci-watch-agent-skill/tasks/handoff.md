# `$watch-process` Handoff

## Completed Work

- Tasks 01–11 are complete: project-local skill and schema, portable Node.js
  runtime, private state/receipts/audit, four adapters, orchestrator/generated
  watcher, synchronous Stop hook, repair/delivery controls, and the hosted
  Node 22/24 × Linux/Windows/macOS compatibility workflow.
- Task 12 automated work now includes the executable
  `scripts/process-watch.mjs` operator, production repair-controller wiring,
  explicit resume/deadline recovery, safe abandoned-lock recovery, and active
  local/remote cancellation handling.
- Scenario validation is fail closed: exact schema ID, adapter-specific closed
  capabilities, environment-name allowlists with no serialized values,
  shell/inline-code rejection, forbidden-action enforcement, and schema/runtime
  agreement.
- Specification Revision 5, plan Revision 2, operator guide, traceability, and
  manual acceptance now agree that each live logical target needs one explicit
  scenario invocation and timeout. That invocation covers only the scenario's
  declared normal delivery/dispatch loop without repeated per-attempt approval;
  settings, remote cancellation, release, publish, and deploy remain separate
  gates or forbidden.

## Current Packet

- [12 — Documentation and acceptance](12_documentation_and_acceptance.md) is
  still open only for real manual acceptance.
- Automated implementation and documentation defects found by review have been
  repaired. The final automated verification set must remain green before a
  manual scenario is attempted.

## Current Changed Files

- Watch-process schema, scenarios, validator/normalizer, command policy,
  operator, launcher/runtime/orchestrator, state recovery, repair cancellation,
  and runtime exports/integrity manifest.
- Standalone scenario, adapter, generated-watcher, operator, orchestrator,
  state/audit, and repair regression tests plus the suite entrypoint.
- Approved specification/plan/task documentation, traceability, manual
  acceptance, skill instructions, and scenario-author guide.

## Checks

- Complete dependency-free watch-process suite: 108 passed, 0 failed.
- Complete Node test suite: 2,519 tests; 2,517 passed, 2 skipped, 0 failed
  (11.5 seconds).
- Scenario/adapter, generated-watcher, operator, orchestrator, repair, state,
  audit, skill, Stop-hook, compatibility-workflow, and documentation-policy
  regressions: passing.
- `npm run typecheck` and `npm run test:types`: passing.
- `npm run format:check` plus explicit changed-file Prettier checks: passing.
- Full lint: no errors (existing repository warnings only); focused changed-file
  ESLint: no issues.
- `npm run audit:prod`: 0 vulnerabilities.
- `npm run build:prod`: passing with the existing webpack asset-size warnings;
  `npm run verify:renderer-bundle`: passing.
- `git diff --check`: passing.

## Next Action

1. Keep Task 12 unchecked until the user explicitly invokes one pending manual
   scenario and selects its finite timeout.
2. Record only bounded, attempt-bound IDs/digests in
   [manual-acceptance.md](manual-acceptance.md).

## Manual Blockers

- Review and trust the project-local Stop hook through Codex `/hooks`.
- Obtain a successful six-cell `Watch Process Compatibility` run, then
  separately authorize and verify the repository required-check setting.
- Complete the remaining live GitHub, generic-CI-if-available, Docker, local,
  recovery, cancellation, mutation, authentication, and reviewer-revalidation
  rows in the manual acceptance index.
- No real target, credential, CI dispatch, Docker daemon, remote delivery,
  repository setting, publish, release, or deploy action is authorized by this
  handoff or by incremental implementation alone.
