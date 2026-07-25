---
name: incremental-implementation
description: Use only to implement exactly one explicitly authorized GPT-Voice task packet per invocation, verify it, update its checklist and handoff, then stop. Use only for an approved packet under docs/specs; do not invoke merely because several files change, begin another packet, commit without authorization, publish, or open a pull request.
---

# Incremental Implementation

1. Read the applicable `AGENTS.md`,
   `.agents/references/task-packets.md`, the current
   `docs/specs/<slug>/tasks/todo.md` item, and its linked packet. Read
   `handoff.md` only when continuing. Do not load the full specification,
   complete plan, or unrelated packets unless the packet identifies a material
   conflict.
2. Before starting a newly authorized packet, inspect the worktree. If the
   completed previous packet remains uncommitted:
   - verify that its files and checks match the handoff;
   - verify that explicit commit authorization exists; if it was not already
     given, obtain it through the globally configured Prompt MCP;
   - commit only that packet and exclude unrelated changes;
   - do not start the new packet while required commit authorization is
     unresolved.
3. Confirm that the packet is self-contained: outcome, prerequisites, owned
   requirement IDs, exact scope, non-goals, contracts and trust boundaries,
   expected files, acceptance, verification, rollback, manual gates, and
   completion instructions. Return an incomplete or contract-changing packet
   to `/plan` or `/spec`.
   Treat packet selection and execution authorization as material decisions
   governed by the Prompt MCP rules in `AGENTS.md`.
4. Implement only the authorized packet. Preserve unrelated worktree changes,
   TypeScript strictness, the renderer/preload/main boundary, typed IPC,
   provider separation, sensitive-data protections, platform behavior, and
   packaging safety.
5. Run the packet's focused checks and the applicable commands from
   `AGENTS.md`. Stop before credentials, real private data, destructive
   operations, publishing, release creation, or any other `MANUAL GATE`.
6. Mark the packet accurately in `todo.md`, update `handoff.md` with changed
   files, checks, remaining risks, blockers, and the next packet, then stop for
   review. Leave the completed current packet uncommitted unless commit
   authorization explicitly covers it.

Never start a second packet, push, publish, open a pull request, create a tag,
or release from this skill.
