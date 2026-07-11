# Handoff: Agent Skills Context Optimization

Status: Complete

- Done: Audited the project router, local plugin, global Codex router/config metadata, skill catalog, personas, and cached plugin metadata. Replaced broad routing with on-demand selection, removed the 12 user-selected skills plus their two dedicated references, and added policy checks.
- Changed: `AGENTS.md`, `.agents/plugin.json`, local skill/persona metadata, on-demand project conventions, scoped audit artifacts, the removed skill/reference files, and `tests/scripts/agentContextPolicy.test.ts`.
- Checks: Focused policy test and `npm test` (296 passing), `npm run test:types`, and `npm run format:check` pass. `npm run lint` has 133 pre-existing warnings and no errors.
- Next: None.
- Blockers: A separate user-level credential rotation remains outside this task's scope.
