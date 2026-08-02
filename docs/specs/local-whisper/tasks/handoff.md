# Local Whisper Handoff

## Authoritative State

- Specification revision 7 and plan revision 14 are Approved.
- Tasks 01–18 are complete and committed; Task 17 is `b9c3e3b` and Task 18 is
  `16b32ca`.
- The verified public fixture bundle digest is
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- AMD remains **Preview · Untested**. macOS remains
  **Planned · Unavailable**. Representative Windows execution remains
  exclusively in Task 20.

## Planning Repair

- Repository inspection found that `src/main/main.ts` unconditionally injects
  `createDeferredLocalWhisperEnvironment` on Linux and Windows.
- The settings, catalog, inventory, managed-filesystem, artifact, capability,
  supervisor/lifecycle, coordinator, IPC, and snapshot components exist, but
  there is no production construction site or complete live adapter graph.
- Missing concrete seams include authenticated packaged catalog input loading,
  managed store/inventory/artifact composition, CPU/CUDA discovery and topology
  authority, worker/runtime/model lease resolution, coordinator ports, dynamic
  snapshot facts, and deterministic graph disposal.
- The packaged production catalog remains a disabled sentinel; no authenticated
  real model/runtime publication input is currently present. Fixture trust must
  never substitute for that external gate.
- Durable planning decision `planning.live-environment-packet-boundary`
  preserves Tasks 19–21 and expands Task 19 with a production-candidate
  activation milestone before Linux qualification.

## Changed Planning Components

- Revised `tasks/plan.md`, `tasks/todo.md`, and Task 19 for plan revision 14.
- Kept Task 20 as the exclusive representative Windows execution packet and
  Task 21 as the aggregate/release-blocker packet.
- Updated revision metadata in Tasks 20–21, the acceptance-owner registry and
  schema, the validator, and the decision ledger.
- No production source, test, package, CI, or runtime artifact was changed or
  executed by this planning revision.

## Verification

- Passed the 233-active-requirement coverage audit, Task 19 executability and
  local-link audits, 21-packet/62-owner task-plan validator, scoped Prettier,
  decision-ledger YAML parse, and `git diff --check` for revision 14.
- Remote CI, representative Windows execution, physical AMD execution, and
  physical macOS execution are not part of this planning invocation.

## Exact Next Step

- Obtain separate execution authorization, then execute
  [Task 19](19_linux_qualification.md) on Linux. First build and prove the
  production-candidate graph; only then freeze authenticated inputs and run the
  Linux qualification profiles.
- Task 20 consumes the unchanged live-composed candidate on representative
  Windows. Task 21 reconciles both platform slices without rerunning unchanged
  expensive profiles.

## Blockers And Manual Gates

- Authenticated production catalog/key/origin inputs, exact approved
  runtime/model artifacts, licenses, and redistribution approval are required
  before candidate freeze. Their absence does not block fail-closed composition
  work but keeps Task 19 incomplete and real qualification rows `Pending`.
- Exact previous packaged-binary rollback evidence remains split between Linux
  Task 19 and Windows Task 20, then reconciled in Task 21.
- Every representative Windows check remains exclusively in Task 20. Physical
  AMD promotion and executable macOS work remain outside the current release.
- Task 19 execution, commit, push, pull request, production signing,
  publication, tag, upload, support-claim change, and release authority remain
  separately gated.
