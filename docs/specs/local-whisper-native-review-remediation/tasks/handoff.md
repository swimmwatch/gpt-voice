# Local Whisper Native Review Remediation Handoff

## State

- Packets 01–20 are complete. Their packet files, checklist state, commits, and CI evidence remain historical and are not reopened.
- The C++ CI optimization revision adds approved Packets 21–24 under the existing RUN-003 / AC-AUT-040 consolidation contract.
- PLAN-APPROVAL-010 is recorded. EXEC-AUTH-008 permits a later explicit incremental-implementation invocation to implement and verify Packet 21 locally. Commits, pushes, cache publication, CI actions, and Packets 22–24 remain unauthorized.
- User decisions: balanced retention gate (at least 15% lower median native critical path, no more than 25% additional native runner-minutes) and authorization for one pinned CI-only compiler-cache tool when all supply-chain, invalidation, privacy, correctness, and performance gates pass.

## Baseline

- Named revision/run: `eb06376b51e05b75e79f6c48c3e3208663d58b8b`, Pull Request Checks `32473799030`.
- Three-run observed median: 28m55s native critical path and 91m57s combined runner use across Linux Core + CodeQL, Windows Core + CodeQL, Windows Analyze, Windows ASan, Linux Static Analysis, and Linux GCC + Package.
- CTest bodies are generally milliseconds; repeated configure/compile, Windows npm signature verification, and verified-source materialization dominate.

## Planning Changes

- Updated `decisions.yaml`, `tasks/plan.md`, and `tasks/todo.md`.
- Added Packets 21–24 for telemetry/aggregation, profile-keyed build sessions, verified native input reuse, and conditional cache/fan-out evaluation.
- Compacted this handoff to current continuation state. Historical detail remains in completed packet files and Git history.
- Existing uncommitted Node/TypeScript CI optimization files were not modified.

## Checks

- Passed: Prettier validation for every changed planning artifact.
- Passed: task-packet section, plan/todo link, requirement-reference, and whitespace audits.
- Passed: explicit revised-plan approval through Prompt MCP (`approval.plan` ledger revision 10 / Prompt revision 7).

## Exact Next Packet

- On a later explicit `incremental-implementation` invocation, execute [Packet 21](21_native_ci_telemetry_and_command_aggregation.md) only and stop before Packet 22.

## Blockers

- Controlled Ubuntu 24.04 / Windows Server 2025 before/after samples require separately authorized commits, pushes, and CI runs.
- Packets 22–24 require later packet-specific execution authorization.
