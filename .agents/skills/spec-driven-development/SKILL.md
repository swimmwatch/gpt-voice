---
name: spec-driven-development
description: Use only when the user explicitly requests a specification or approves a significant feature without an existing implementation contract. Define or revise durable behavior, architecture, constraints, and acceptance requirements; keep delivery order and executable task instructions out of the specification and hand decomposition to the planning workflow.
---

# Spec-Driven Development

Write the smallest complete contract that prevents implementation from
inventing product behavior. Treat specification as contract authoring, not task
decomposition.

## Gated Workflow

```text
SPECIFY -> human review -> PLAN/TASK PACKETS -> human review -> IMPLEMENT ONE PACKET -> human review
```

Do not advance through a gate without the required review. Specification work
does not authorize planning or implementation automatically.

## Discover The Requirement

1. Read applicable `AGENTS.md` files and only the closest relevant project
   documentation. Inspect headings or search results before opening long files.
2. Identify the user, problem, current behavior, desired outcome, scope,
   non-goals, constraints, and unresolved choices.
3. Surface assumptions before writing and ask only questions whose answers
   materially change the contract.
4. Separate implemented behavior from planned technologies, private-provider
   observations, and unverified assumptions.
5. Use CodeGraph first when indexed. Inspect only the current code, tests,
   types, and precedent needed to verify affected boundaries.

## Required Specification Content

### Objective And Behavior

- primary user flow and observable outcome;
- validation, edge cases, errors, cancellation, retry, and recovery;
- manual review, override, permission, and destructive-action behavior.

### Contracts And State

- inputs, outputs, schemas, units, ordering, audio/media formats, and file layout;
- lifecycle states and allowed transitions;
- provider/model/settings provenance and compatibility;
- ownership, retention, idempotency, versioning, migration, and cache behavior;
- safe observability and user-facing diagnostics.

### Architecture And Boundaries

- renderer, preload, main, provider, browser, filesystem, subprocess, and
  lifecycle responsibilities when applicable;
- dependency direction and typed IPC contracts;
- privacy, security, performance, cost, packaging, and failure-recovery
  constraints;
- always-do, ask-first, and never-do boundaries.

### Acceptance

- measurable success and explicit non-acceptance cases;
- focused unit, integration, contract, command, build, and manual/platform
  verification requirements;
- deterministic fixtures that do not depend on credentials or personal data.

## Decision Discipline

Record alternatives and tradeoffs. Do not silently select a provider, private
contract, migration policy, or user-visible behavior. Keep unresolved choices
explicit and stop before implementation when they materially change the
contract.

Reframe vague requests as testable acceptance criteria and ask the human to
confirm them.

## Specification Boundary

Keep `spec.md` focused on durable behavior, architecture, constraints, and
acceptance requirements. Use stable requirement and acceptance IDs when they
make later traceability reliable.

Do not put these planning concerns in `spec.md`:

- delivery order, estimates, task status, or parallelization;
- task-owned file lists and task-only verification commands;
- complete executable task descriptions;
- instructions to read the entire specification before implementation.

When planning is requested after the specification is approved, apply
[the task packet contract](../../references/task-packets.md) and the
`planning-and-task-breakdown` skill. Create one self-contained numbered packet
per executable task. During specification-only work, do not invent that task
breakdown.

## Specification Outline

```markdown
# Spec: Feature Name

## Problem, User, And Outcome

## Scope And Non-Goals

## Current State And Dependencies

## Behavior And Failure Handling

## Inputs, Outputs, States, And Contracts

## Architecture, Privacy, And Security

## Quality And Acceptance Criteria

## Rollout, Recovery, And Compatibility

## Alternatives, Decisions, And Open Questions
```

For a substantial workstream, use `docs/specs/<slug>/`:

- `spec.md`: durable implementation contract;
- `tasks/NN_<slug>.md`: execution contracts created only during planning;
- `tasks/plan.md`: compact ordered task index;
- `tasks/todo.md`: linked checklist and completion state;
- `tasks/handoff.md`: completed work, changed files, checks, exact next step,
  and blockers.

If planning has not been requested, keep task-state files as short
planning-pending stubs. If task packets already exist, identify packets affected
by a specification revision and mark them for focused replanning.

Keep external research in `docs/researches/<slug>/main.md` and link it from the
specification rather than copying sensitive or volatile evidence into task
packets.

Before handing off to planning, confirm the human approved the specification,
acceptance criteria are testable, boundaries are explicit, and the contract is
saved in the scoped bundle.
