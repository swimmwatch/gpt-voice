# 04 State, Receipts, And Audit

## Outcome

Implement private atomic runtime state, exclusive ownership, compare-and-swap generations, idempotent operation receipts, bounded audit history, and reviewer-attestation primitives.

## Prerequisites

- Tasks 01–03 completed and committed.
- Use Task 03 runtime/path/digest contracts rather than introducing parallel utilities.

## Owned Requirements

`DATA-003`, `SAFE-005`, `CONC-001`, `FLOW-005`, `GIT-001`, `GIT-002`, `ACCEPT-001`

## In Scope

- `AtomicStateStore`, exclusive lock ownership, generation CAS, liveness metadata, `OperationReceiptStore`, `AuditJournal`, and success-attestation builder/validator.
- Private temporary-root tests for atomicity, races, corrupt/stale data, symlinks/reparse points, idempotency, ambiguous responses, bounded journal rotation/retention, and cleanup.

## Out Of Scope

- Provider calls, child execution, state-machine orchestration, hook continuation, agent repair, Git delivery, or accepting success from state alone.

## Task Contract

- Runtime roots resolve strictly inside `.codex/runtime/process-watch/<watch-id>/`; watch IDs and every relative child path are validated before access. No broad recursive operation or user-data path is accepted.
- Locks are exclusive per workspace/worktree. A lock binds watch/workspace/session-safe IDs, process start token, and generation; PID is supplemental only. Parallel writing watches require a different worktree/directory and chat.
- Writes use same-directory temporary files, flush/close, atomic replacement where supported, owner-only permissions where available, size caps, symlink/reparse rejection, and monotonic generation compare-and-swap. Unsupported or ambiguous atomic semantics fail closed.
- `state.json` contains only schema version, safe IDs, phase/outcome/generation, digests, user timeout/deadline, normalized target/attempt identity, heartbeat/start token, receipt IDs, failure fingerprints, and enumerated blocker. It excludes absolute paths, commands, output, prompts, credentials, bodies, and user data.
- Before remote start/retry/dispatch, persist an intent with watch ID, generation, scenario digest, exact source SHA when applicable, operation kind, fixed-input digest, and deterministic operation key. Receipt records immutable provider/local target identity and attempt.
- Ambiguous operations reconcile by operation key and exact identity: one match attaches, zero permits at most one fresh operation, multiple/unprovable matches block. Never blindly repeat an ambiguous operation.
- `events.jsonl` is append-only, bounded, sanitized, schema-versioned, and monotonic. Events carry actor, phase transition, outcome, relevant digests, target identity digest, source SHA where applicable, receipt ID, and summary code—never arbitrary/raw text.
- Attestation structure binds watch/scenario/script/library digests, timeout/generation, immutable target and all aggregate members, required-contract results, receipt IDs, local verification digests/classifications/input identity, final observation time, and cleanup. Its validator requires a fresh external/local proof supplied by a later adapter; state/journal alone cannot satisfy success.

## Contracts And Boundaries

- Stores receive filesystem, clock, and identity dependencies by constructor for race/failure testing.
- Runtime state is cache and recovery input only, never authority or success proof.
- Cleanup is idempotent and can remove only expired artifacts under one validated watch directory; it preserves active/ambiguous evidence and never follows links.

## Expected Files Or Components

- Packet-owned modules under `.agents/skills/watch-process/scripts/lib/`
- `tests/skills/watchProcess/state-and-audit.test.mjs`
- Private disposable fixtures created by tests only

## Acceptance Criteria

- Tests cover concurrent lock acquisition, stale PID/reused PID, CAS conflict, torn/corrupt/oversized files, link attacks, permission best effort, crash between intent/receipt, ambiguous reconciliation, bounded journal, and attestation rejection without fresh proof.
- Serializing any secret/raw-output/absolute-path fixture fails.
- State and cleanup operations remain cross-platform and dependency-free.

## Verification

- `node --test tests/skills/watchProcess/state-and-audit.test.mjs`
- `node --check` for new store/journal modules
- `npx prettier --check .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/state-and-audit.test.mjs`
- Focused privacy/path/atomicity policy assertions.

## Failure And Rollback

On any ambiguous ownership or atomicity result, preserve private artifacts and return a bounded blocker; never guess ownership or delete outside the watch root. Repair packet code forward. Removing packet-owned new files is permitted only through an explicit patch and must not remove earlier task assets.

## Manual Gates

Windows reparse/rename and macOS filesystem semantics are deferred for confirmation in Task 11 when not locally available. No external dispatch, commit, push, or hook action is authorized.

## References

- Mandatory: specification sections 7.1, 8.2, 10, and 11 for exact receipt/state/audit fields.

## Completion And Handoff

After verification, update the checklist/handoff, identify Task 05 as next, and stop.
