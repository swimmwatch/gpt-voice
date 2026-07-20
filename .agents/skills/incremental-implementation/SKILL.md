---
name: incremental-implementation
description: Use only when the user explicitly requests incremental implementation or continuation of a substantial planned workstream. Implement exactly one self-contained task packet per invocation, stop for review, and resume the next packet only after another explicit request; do not invoke merely because several files change.
---

# Incremental Implementation

Deliver one task packet through thin slices that leave the repository working
and produce an observable result.

## Invocation Boundary

- Implement only the first unchecked linked task packet for this invocation.
- After its verification passes, update `todo.md` and `handoff.md`, present a
  concise review or preview, and stop. Do not begin the next packet.
- Resume only when the user explicitly invokes incremental implementation again
  or explicitly requests its continuation.
- At the start of a resumed invocation, commit the previously completed and
  approved packet with a focused conventional commit. If review requested
  changes, revise the same packet instead and do not commit it yet.
- Do not commit the packet completed in the current invocation. Its commit is
  deferred until the next explicit continuation request.
- Never push without explicit authorization.

## Prepare

1. Read applicable `AGENTS.md` files, the current `todo.md` entry, and its linked
   packet. Follow
   [the task packet contract](../../references/task-packets.md).
2. Read `handoff.md` only when continuing previous work. Do not read the full
   plan, full specification, or unrelated packets by default.
3. Use CodeGraph first when indexed. Read the target code, focused tests/types,
   one local precedent, relevant project-conventions sections, and only the
   references explicitly scoped by the packet.
4. Apply `.agents/references/definition-of-done.md` and confirm the packet's
   outcome, non-goals, risks, manual verification, and rollback/recovery notes.
5. Read a targeted specification section only when the packet links it for a
   conditional detail or current code reveals a material conflict.
6. If the packet is incomplete, repair it through planning instead of loading
   the full specification and reconstructing the task during implementation.
7. Stop for user/provider decisions that would materially change the contract.

## Slice Order

Prefer this dependency order when applicable:

1. Shared types, schema, protocol, settings, or lifecycle contract.
2. Validation and pure transformation with focused tests.
3. Browser, provider, filesystem, subprocess, or persistence boundary with
   controlled failures.
4. Main service orchestration and typed IPC.
5. Renderer state, settings, and user interaction.
6. Documentation, migration, accessibility, privacy, packaging, and manual
   platform verification.

A slice is valid only when it has one observable result, focused acceptance
criteria, and a verification command or inspection artifact.

## Execution Loop

For each slice inside the current packet:

1. State its contract and acceptance criteria.
2. Implement only that slice using the simplest project-consistent design.
3. Run the smallest focused check.
4. Inspect the runtime artifact when behavior is browser-, visual-, audio-, or
   platform-specific.
5. Record changed files, result, assumptions, and the next slice.
6. Stop when the next slice would require inventing a material requirement or
   expanding beyond the packet.

After all packet criteria pass:

1. Run the packet's final applicable checks.
2. Update `todo.md` and `handoff.md`.
3. Present the outcome, verification, manual follow-up, and changed files.
4. Stop at the invocation boundary.

## Guardrails

- Preserve trusted IPC sender validation and main/renderer privilege separation.
- Never log or commit secrets, sessions, audio, transcripts, clipboard content,
  provider output, or personal browser data.
- Keep each slice compilable, testable, and rollback-friendly.
- Preserve intermediate artifacts only when the packet requires them for safe
  diagnosis or rerun; never commit sensitive/generated runtime data.
- Do not broaden a slice with unrelated refactors, dependencies, packaging, or
  release work.
- Do not leave placeholder success paths, disabled validation, or unverified
  generated artifacts between slices.

Apply the complete definition of done before declaring the overall workstream
finished.
