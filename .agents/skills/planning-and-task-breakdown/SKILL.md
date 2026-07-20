---
name: planning-and-task-breakdown
description: Use only when the user explicitly requests an implementation plan, task decomposition, estimate, dependency map, or delivery sequence. For specification workstreams, create a compact plan index plus one separate self-contained Markdown task packet for every executable task so implementation does not preload the full specification; do not invoke automatically for routine coding.
---

# Planning And Task Breakdown

Plan from a measurable user outcome to independently verifiable delivery
slices. Treat planning as decomposition: task packets are the executable
artifacts, while `plan.md` is only their ordered index.

## Required Context

1. Read applicable `AGENTS.md` files and
   [the task packet contract](../../references/task-packets.md).
2. Resolve the selected `docs/specs/<slug>/` bundle. Ask when more than one
   specification could own the work.
3. Inspect the specification outline, size, requirement IDs, and acceptance IDs
   before reading prose. Read targeted sections while writing each packet.
4. Use CodeGraph first when the repository is indexed. Inspect only the code,
   focused tests, types, one local precedent, and relevant project-conventions
   sections needed to distinguish current behavior from planned work.
5. Identify user, provider, privacy, packaging, or architecture decisions that
   cannot be inferred safely.

Do not write production code during planning.

## Define The Plan Boundary

State:

- goal and observable success;
- user and affected workflow;
- scope and non-goals;
- assumptions and settled decisions;
- unresolved decisions and blockers;
- affected contracts and components;
- quality, privacy, security, compatibility, packaging, and human-review
  constraints.

## Dependency And Slice Order

Prefer this order when applicable:

1. User/provider decision and high-risk feasibility canary.
2. Shared types, protocol, settings, lifecycle states, and validation.
3. Pure transformation with focused tests.
4. Browser, provider, filesystem, subprocess, or persistence adapter.
5. Main service orchestration and typed IPC boundary.
6. Renderer settings, state, and user workflow.
7. Documentation, migration, accessibility, privacy, and platform verification.

Do not schedule downstream UI or orchestration against an undefined contract.
Slice vertically when a small end-to-end behavior can be independently verified.
Use contract-first or risk-first slices when shared contracts or private-provider
uncertainty would otherwise invalidate later work.

## Task Standard

Create one `docs/specs/<slug>/tasks/NN_<slug>.md` file for every executable
task. Make each packet self-contained according to the task packet contract.
Every packet must include:

- outcome rather than activity;
- prerequisites, dependencies, and owned files or boundary;
- in-scope behavior and explicit non-goals;
- task-local architecture, privacy, security, compatibility, and recovery rules;
- specific acceptance criteria;
- smallest automated verification and required manual/platform verification;
- exact scoped references and specification traceability;
- completion instructions for `todo.md` and `handoff.md`;
- explicit blocker when a decision remains unresolved.

Keep a packet small enough for one focused implementation session and normally
no more than about five changed files. Split work that crosses independent
subsystems, has more than one separately observable outcome, or cannot be
verified independently. Use estimate ranges and state uncertainty drivers
instead of false precision.

Each packet is an implementation invocation boundary. Completing it requires a
review or preview pause. Do not plan automatic progression into the next packet.

Include every task-local requirement directly in the packet. Link exact
specification headings and acceptance IDs for traceability, but do not require
the implementer to read `spec.md` before starting.

## Coverage And Coordination

After writing the packets:

1. Map every applicable specification heading and requirement/acceptance ID to
   at least one packet.
2. Order packets by dependency and risk.
3. Mark safe parallel work only after shared contracts are fixed. Keep shared
   state, migrations, provider lifecycle, and IPC changes sequential when they
   overlap.
4. Add review checkpoints after high-risk canaries and major user-visible flows.
5. Put only the compact coverage map in `plan.md`, links/state in `todo.md`, and
   current continuation context in `handoff.md`.

## Output

```markdown
# Implementation Plan: Feature Name

## Goal And Success Measure

## Ordered Task Index

| Task                  | Outcome            | Dependencies | Coverage      |
| --------------------- | ------------------ | ------------ | ------------- |
| [01 Task](01_task.md) | Observable outcome | None         | REQ-01, AC-01 |

## Cross-Task Risks And Blockers

## Parallelization And Checkpoints

## Final Verification
```

Create or update together:

- `docs/specs/<slug>/tasks/plan.md`;
- `docs/specs/<slug>/tasks/todo.md`;
- `docs/specs/<slug>/tasks/handoff.md`;
- one numbered task packet per executable task.

Apply `.agents/references/definition-of-done.md`. Before implementation, confirm
that every packet is independently verifiable, dependencies are ordered,
coverage is complete, and the human has approved the plan.
