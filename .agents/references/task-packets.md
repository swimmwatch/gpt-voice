# Task Packet Contract

Use task packets to keep substantial workstreams executable without loading
their entire specification into one implementation session.

## Bundle Layout

```text
docs/specs/<slug>/
  decisions.yaml
  spec.md
  tasks/
    plan.md
    todo.md
    handoff.md
    01_<slug>.md
    02_<slug>.md
```

- `decisions.yaml` owns normalized material decisions and revision history.
- `spec.md` owns durable behavior, architecture, constraints, and acceptance
  requirements. Do not put delivery steps or task execution instructions in it.
- `plan.md` is a compact ordered index. Link each task packet and record only
  its outcome, dependencies, and covered requirement or acceptance IDs.
- `todo.md` is the only completion-state checklist. Link task packets instead
  of repeating their descriptions.
- `handoff.md` contains only current continuation state: completed packets,
  changed files, checks, exact next packet, and blockers.
- `NN_<slug>.md` is the complete execution contract for one independently
  verifiable task.

## Planning With Progressive Disclosure

1. Inspect the specification size, headings, and requirement or acceptance IDs
   before reading prose.
2. Build a preliminary task-to-section map from that outline.
3. Read only the sections needed to write one task packet at a time. Do not
   load a long specification in one command or paste it into a task file.
4. Copy or restate every task-local requirement, exact value, path, boundary,
   and acceptance assertion needed for execution. Do not use instructions such
   as "implement as described in `spec.md`."
5. Add source section anchors and acceptance IDs for traceability, not as
   mandatory pre-reading.
6. Map every applicable specification heading and acceptance ID to at least one
   task before finalizing the plan. Split a packet when its instructions and
   required references are too large for a focused implementation session.
7. Keep external guides as links. State which task-relevant sections must be
   read and why; never require unrelated references as general pre-reading.

Planning may inspect all relevant specification sections over several targeted
reads. The resulting task packets must make that discovery work unnecessary
during normal implementation.

## Task Packet Contents

Each task packet must contain:

```markdown
# NN Task Title

## Outcome

## Prerequisites

## Owned Requirements

## In Scope

## Out Of Scope

## Task Contract

## Contracts And Boundaries

## Expected Files Or Components

## Acceptance Criteria

## Verification

## Failure And Rollback

## Manual Gates

## References

## Completion And Handoff
```

Make the packet self-contained:

- include all implementation requirements and non-goals for this task;
- include exact files or owned boundaries when known;
- include failure, security, migration, compatibility, and recovery behavior
  that applies to this task;
- include concrete tests, acceptance IDs, commands, and manual checks;
- mark credentials, private data, external systems, destructive actions,
  commits, pushes, pull requests, tags, publishing, installers, and
  platform-only checks as manual gates when they require human action;
- distinguish mandatory references from optional background;
- require updates to `todo.md` and `handoff.md` after verification.

Do not copy unrelated specification prose, history, completed discovery, or
requirements assigned to other packets.

## Prompt MCP Decisions And Finalization

- Use the globally configured Prompt MCP for unresolved material planning
  choices. Return contract-changing questions to `/spec`.
- Reuse the specification interview and stable decision identifiers when
  possible; persist new planning decisions in the repository decision ledger.
- When coverage and executability checks pass with no unresolved material
  choice, mark the plan revision Approved without a separate final-approval
  question. Later change requests start a new iteration.
- Plan approval alone performs no implementation. An explicit
  incremental-implementation invocation authorizes its selected current packet.
- A cancellation, timeout, conflict, failure, pause, or pending answer to a
  material planning question remains unresolved and blocks finalization.

## Review And Commit Boundary

Implement one packet per explicit incremental-implementation invocation. After
verification, update `todo.md` and `handoff.md`, present the completed packet
for review or preview, and stop. Do not commit that packet or start another one.
Only a later explicit incremental-implementation request may resume work. That
invocation itself authorizes verifying and committing the completed packet,
excluding unrelated changes, and then opening the next executable packet; do
not ask for separate commit or packet-execution approval.

## Execution Context

For implementation, read:

1. applicable `AGENTS.md` files;
2. the current `todo.md` entry and its linked task packet;
3. `handoff.md` only when continuing previous work;
4. the files, tests, local precedent, project-conventions sections, and
   task-scoped references named by the packet.

Do not read `spec.md`, the full `plan.md`, or unrelated task packets by default.
Read a specific specification section only when the packet provides a targeted
anchor for a conditional detail or when a discovered conflict cannot be
resolved from the packet and current code. Never replace a missing task
contract by loading the entire specification: repair the packet first.
