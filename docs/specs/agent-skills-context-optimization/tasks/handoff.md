# Handoff: Agent Skills Context Optimization

Status: Awaiting skill-removal selection

- Done: Audited the project router, local plugin, global Codex router/config metadata, skill catalog, personas, and cached plugin metadata. Replaced broad routing with on-demand selection and added a policy test.
- Changed: `AGENTS.md`, `.agents/plugin.json`, local skill/persona metadata, `using-agent-skills`, on-demand project conventions, scoped audit artifacts, and `tests/scripts/agentContextPolicy.test.ts`.
- Checks: Focused agent-context policy test, `npm test` (295 passing), `npm run test:types`, `npm run format:check`, and `npm run lint` (133 pre-existing warnings, no errors) pass.
- Next: Remove the skills selected by the user, then run the relevant verification set.
- Blockers: Awaiting the user's removal list. A separate user-level credential rotation is also needed but was not changed here.
