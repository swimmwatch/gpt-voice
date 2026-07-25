---
name: planning-and-task-breakdown
description: Use only to author or revise the authoritative /plan artifacts for substantial GPT-Voice work when the user explicitly requests planning, decomposition, milestones, or task packets. Require an approved specification, use Prompt MCP for unresolved material choices, create self-contained packets, obtain explicit plan or execution authorization, and stop before implementation.
---

# Planning And Task Breakdown

This skill is the only authoritative `/plan` route. Planning is read-only with
respect to production implementation.

1. Read `AGENTS.md`, `.agents/references/task-packets.md`, the approved
   `docs/specs/<slug>/spec.md`, its requirement identifiers and decision ledger,
   the worktree, and the smallest relevant set of code, tests, configuration,
   documentation, and workflows.
2. For substantial work, stop if `spec.md` is absent or not
   `Status: Approved`. Send any question that changes product behavior, public
   or IPC contracts, privacy/security, compatibility, migration, supported
   platforms, or acceptance back to `/spec`.
3. Resolve implementation-local material choices through the globally
   configured Prompt MCP. Inspect the live schemas, start or reopen a
   `workspace` interview named `plan:<slug>`, use the repository absolute path
   and stable semantic IDs, and persist normalized non-sensitive results in the
   decision ledger. Do not infer an answer from a non-answered status.
4. Create `docs/specs/<slug>/tasks/plan.md`, `todo.md`, `handoff.md`, and one
   numbered `NN_<task>.md` packet per independently executable unit. Map every
   active requirement to at least one packet and every packet to its owned
   requirements.
5. Record dependencies, safe sequencing, file and interface ownership,
   integration points, risks, rollback, verification commands, platform
   coverage, and external or destructive `MANUAL GATE` actions. Keep the plan
   index compact; put executable detail in packets.
6. Make every packet self-contained. Include outcome, prerequisites, owned
   requirement IDs, exact scope, non-goals, local contract values and failure
   behavior, trust boundaries, expected files or components, acceptance,
   verification, rollback, manual gates, and handoff instructions. Never write
   only “implement as described in spec.md.”
7. Run a coverage and executability audit. Then ask a separate Prompt MCP
   `single` question with stable options to approve the plan, request changes,
   or leave it unapproved. Ask for execution authorization separately; approval
   of the plan is not authorization to implement a packet.

Stop before code changes, commits, pushes, pull requests, releases, or packet
execution.
