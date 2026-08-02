# Local Whisper Handoff

## Authoritative State

- Specification revision 7 and plan revision 12 are Approved. Plan approval is
  recorded by durable Prompt MCP answer `approval.plan-revision-12`, sequence
  55, revision 1.
- Tasks 01–12 are complete and committed. Task 12 is authoritative at
  `916f0d9`.
- The prior Faster-Whisper Task-13 execution authorization applies only to the
  superseded revision-11 packet and does not authorize the replacement cleanup
  packet.
- AMD remains **Preview · Untested**. macOS remains
  **Planned · Unavailable**. Representative Windows execution remains
  exclusively in Task 19.

## Planning Revision 12

- Replaced obsolete Task 13 with
  `13_single_engine_cleanup_and_contract_normalization.md`.
- Preserved all completed task numbers and commit evidence.
- Removed Faster-Whisper/CTranslate2/Python/precision ownership from Tasks
  01–19 and made Task 13 the atomic owner of active-artifact removal plus
  fixed-`whisperCpp` contract normalization.
- Updated the acceptance registry to replace removed `AC-AUTO-055` with
  `AC-AUTO-063` while retaining exactly 62 automated criteria.
- Preserved Task 19 as the sole representative Windows execution owner.

## Verification

- Revision-12 task-plan validation passes with 19 packets, 62 unique automated
  acceptance owners, and all 233 active product requirement and acceptance IDs
  covered.
- All 23 local Markdown files have resolving local links; scoped Prettier,
  decision-ledger YAML parsing, planning stale-reference auditing, and
  `git diff --check` pass. The remaining implementation references are exact
  Task 13 cleanup targets.

## Exact Next Step

- Stop after planning. A later explicit `incremental-implementation`
  invocation must separately authorize exactly Task 13 before implementation;
  the obsolete revision-11 Task-13 authorization does not transfer.

## Blockers And Manual Gates

- No implementation blocker is open at the planning layer.
- Task 13 execution, lock deletion, commit, push, pull request, signing,
  packaging, publication, release, and representative Windows/AMD/macOS
  execution remain separately gated.
