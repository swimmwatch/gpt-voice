---
name: interview-me
description: Use only to run a structured GPT-Voice requirements interview when the user explicitly asks to be interviewed or when a requested specification cannot be produced without unresolved material behavior. Inspect repository evidence first, use the global Prompt MCP for material questions, and stop once the requested artifact can be produced without invention.
---

# Interview Me

1. Read `AGENTS.md` and the smallest relevant set of code, tests,
   configuration, documentation, and existing decisions. List observed facts,
   unknowns, and the artifact decision blocked by each unknown.
2. Do not ask for facts the repository already establishes or choices the user
   already committed in the current request. Ask only questions that can change
   scope, user-visible behavior, interfaces, privacy/security, compatibility,
   operations, release behavior, or objective acceptance.
3. Use the globally configured Prompt MCP for each material question:
   - inspect the live schemas before calling;
   - use `single`, `multiple`, or `text` according to answer semantics;
   - use one to five tightly related questions per batch;
   - use stable semantic interview, batch, category, question, and idempotency
     IDs;
   - use the repository's absolute path and `workspace` persistence for a
     recoverable interview;
   - never substitute a plain-chat multiple-choice question while Prompt MCP is
     callable.
4. Put an evidence-backed recommendation first and label it `(Recommended)`;
   include implementation-oriented option descriptions. Do not invent a
   recommendation or add an `Other` option.
5. Treat cancellation, timeout, unavailability, invalid input, conflict, and
   failure as unresolved states. Correct invalid requests against the schema,
   reconcile conflicts by revision, and never infer a user choice.
6. Checkpoint non-sensitive committed answers in the applicable
   `docs/specs/<slug>/decisions.yaml`. After interruption, reload the ledger,
   inspect the persisted interview, and resume only unresolved questions.

Stop when the requested intent, idea, specification, plan, decision, or release
artifact can be produced without inventing material behavior. Do not request or
persist credentials, tokens, passwords, session data, transcripts, or unrelated
personal information.
