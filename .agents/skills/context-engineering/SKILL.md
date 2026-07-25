---
name: context-engineering
description: Use only to improve GPT-Voice agent instructions, skill routing, durable decisions, task context, or handoffs only when the user requests context optimization, stale-guidance repair, workflow migration, or session recovery. Do not invoke merely because a session starts or replace verified project rules with generic guidance.
---

# Context Engineering

Use this skill for repository-owned agent context, not production application
behavior.

1. Establish authority in this order: the current user request, applicable
   `AGENTS.md`, current code/tests/configuration and public contracts, stable
   project documentation or decisions, imported references, then temporary
   notes and conversation history.
2. Inspect the current skill catalog, routing entries, references,
   specification bundles, and handoffs. Identify duplicated, stale,
   contradictory, overly broad, or missing guidance with concrete file
   evidence.
3. Put each durable fact in its narrowest owner:
   - project-wide runtime, privacy, build, and release rules in `AGENTS.md`;
   - workflow triggers and stopping conditions in the owning `SKILL.md`;
   - Prompt MCP specification mechanics in
     `.agents/references/specification-interview.md`;
   - packet structure in `.agents/references/task-packets.md`;
   - product decisions in `docs/specs/<slug>/decisions.yaml`;
   - current execution state in the bundle's `tasks/handoff.md`.
4. Keep public application behavior in `README.md`, contributor workflow in
   `CONTRIBUTING.md`, security reporting and posture in `SECURITY.md`, and
   GitHub delivery expectations under `.github/`. Do not duplicate those facts
   into every skill.
5. Preserve the Electron renderer/preload/main ownership model, provider
   abstraction, sensitive-data constraints, verified npm commands, supported
   packaging targets, and GitHub workflow behavior.
6. After interruption or compaction, reload repository-owned ledgers and
   handoffs before using conversation summaries. Reconcile Prompt MCP answers
   by stable IDs and revisions instead of repeating committed questions.
7. When a conflict requires a material user choice, use the globally configured
   Prompt MCP according to `AGENTS.md`; do not substitute a plain-chat choice
   while it is callable.

Do not modify production code unless the repository's skill-registration
mechanism genuinely requires it. Report the authority map, routing changes,
remaining uncertainty, and the next assistant's exact starting point.
