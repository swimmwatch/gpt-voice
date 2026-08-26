---
name: incremental-implementation
description: Use only to implement exactly one GPT-Voice task packet per explicit invocation, verify it, update its checklist and handoff, then stop. When a completed prior packet is uncommitted, the next invocation authorizes committing only that packet and starting the next executable packet. Use only for an approved packet under docs/specs; never publish or open a pull request.
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
   - treat the current explicit incremental-implementation invocation as
     authorization to commit that completed packet and start the next
     executable packet; do not ask for separate commit or execution approval;
   - commit only that packet and exclude unrelated changes;
   - if no next executable packet exists, stop after committing the completed
     packet.
   When no completed packet awaits commit, the invocation authorizes exactly
   the current executable packet identified by `todo.md` and `handoff.md`, or
   the packet explicitly named by the user. Resolve a genuinely ambiguous or
   conflicting packet selection, but never ask for redundant authorization.
3. Confirm that the packet is self-contained: outcome, prerequisites, owned
   requirement IDs, exact scope, non-goals, contracts and trust boundaries,
   expected files, acceptance, verification, rollback, manual gates, and
   completion instructions. Return an ambiguous, incomplete, or
   contract-changing packet to `/plan` or `/spec`; invocation authority does
   not repair its contract.
4. Implement only the authorized packet. Preserve unrelated worktree changes,
   TypeScript strictness, the renderer/preload/main boundary, typed IPC,
   provider separation, sensitive-data protections, platform behavior, and
   packaging safety.
5. Run the packet's focused checks and the applicable commands from
   `AGENTS.md`. Stop before credentials, real private data, destructive
   operations, publishing, release creation, or any other `MANUAL GATE`.
6. Mark the packet accurately in `todo.md`, update `handoff.md` with changed
   files, checks, remaining risks, blockers, and the next packet, then stop for
   review. Leave the newly completed packet uncommitted so a later explicit
   incremental-implementation invocation can verify and commit it before
   starting the next packet. If the user explicitly requests an immediate
   commit, the invocation already supplies that commit authority; do not ask
   again.

Never start a second packet, push, publish, open a pull request, create a tag,
or release from this skill.
