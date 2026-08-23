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

## Next Packet

[03 — Portable runtime core](03_portable_runtime_core.md)

## Blockers

None. Task 02 is complete and intentionally uncommitted for the next explicit
incremental implementation invocation.
