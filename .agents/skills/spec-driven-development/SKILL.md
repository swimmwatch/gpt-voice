---
name: spec-driven-development
description: Use only to author or revise the authoritative /spec contract for substantial GPT-Voice work when the user requests a specification or approves work that lacks one. Establish repository facts, use a persistent global Prompt MCP interview for every material user decision, maintain a decision ledger, approve the completed revision without a separate final-approval prompt, and stop before planning or implementation.
---

# Spec-Driven Development

This skill is the only authoritative `/spec` route. Use it for substantial
desktop, renderer, IPC, provider, browser, settings/data, privacy, packaging,
compatibility, or release work. Do not use it for a small, fully specified
correction.

1. Read `AGENTS.md`,
   `.agents/references/specification-interview.md`, the closest relevant
   documentation, code, tests, interfaces, configuration, workflows, and
   existing specification bundle.
2. Establish repository-observable facts before asking questions. Record
   verified facts as `observed`, explicit choices already present in the
   request as `answered`, and irrelevant categories as `not_applicable`.
3. Create `docs/specs/<slug>/decisions.yaml` before the first material
   question. Start or reopen a globally configured Prompt MCP interview with
   ID `spec:<slug>`, the repository absolute path, and `workspace`
   persistence. Inspect the callable schemas instead of guessing a namespace or
   argument shape.
4. Checkpoint each pending question definition in the ledger before displaying
   it. Ask one to five related questions per batch using stable semantic
   interview, batch, category, question, option, and idempotency IDs. Use
   `single`, `multiple`, or `text` according to answer semantics.
5. Use Prompt MCP for every unresolved choice that materially changes outcome,
   stakeholders, scope, normal or alternate flows, invalid input or failure
   behavior, interfaces/data, architecture constraints, security/privacy,
   configuration/operations, compatibility/migration, or acceptance.
6. Save every result immediately. A committed answer may be used; cancellation,
   timeout, unavailability, invalid input, conflict, failure, pause, or an
   unresolved question is not an answer. Correct schemas, reconcile revisions,
   and never infer a choice.
7. After interruption or compaction, reload the ledger, inspect the persisted
   interview and question revisions, reconcile committed answers by stable ID,
   and resume unresolved questions only. Preserve contradictions and changed
   answers as superseding revisions.
8. Run the reference's final gap analysis from user, operator, implementer,
   tester, security reviewer, and maintainer perspectives. Normalize active
   decisions into numbered requirements, defaults, constraints, non-goals, and
   objective automated and manual acceptance criteria.
9. Keep `docs/specs/<slug>/spec.md` at `Status: Draft` while material decisions
   or the final gap analysis remain unresolved. Keep raw transcripts, model
   reasoning, option history, task ordering, estimates, and packet detail out
   of the specification.
10. When every material decision is resolved and the final gap analysis
    passes, finalize the revision with `Status: Approved`. The user's request
    to create or revise the specification authorizes approval of that completed
    revision; do not ask a separate final-approval question. Treat later
    requested changes as a new revision and iteration, not as retroactive
    disapproval.

Stop after automatic approval or an unresolved blocker. Never begin `/plan`,
implementation, commits, pushes, pull requests, or releases automatically, and
never request or persist secrets.
