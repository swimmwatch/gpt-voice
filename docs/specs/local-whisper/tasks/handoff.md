# Handoff: Local Whisper Approved Plan Revision 2

## Status

Specification revision 2 is approved with six-family approximate RAM/VRAM
guidance, exact selected-configuration estimate matrices, and `AC-AUTO-049`.
The existing 16 packets have been revised in place and plan revision 2 is
explicitly approved through `approval.plan` revision 2. No implementation
packet has started and Task 01 remains unauthorized.

## Completed Packets

- None.

## Changed Files

- Added the Local Whisper task bundle under `docs/specs/local-whisper/tasks/`.
- Added implementation-local decisions and OpenWhispr adaptation evidence to
  `docs/specs/local-whisper/decisions.yaml`.
- Revised packets 01, 03, 09, 11–16 plus plan/todo/handoff ownership for
  `MODEL-010`, `CAP-013`, `UI-007`, and `AC-AUTO-049`.
- No production code, dependency, generated artifact, workflow execution,
  commit, push, publication, or release was performed.

## Checks

- All 16 packets contain the mandatory headings in order with non-empty
  executable content; all task and documentation links resolve.
- All 191 active specification IDs, `AC-AUTO-001..049`, and
  `AC-MAN-001..012` map to packet ownership; `plan.md` matches every packet's
  ownership section.
- Dependency references exist and form an acyclic graph. The Tasks 07/08/14
  staging/signing sequence has no reverse dependency.
- Coordinator/IPC state ownership follows specification Section 7.1; Task 02
  owns main canonical-WAV validation and Task 13 owns full-screen
  `AC-AUTO-004` integration.
- `decisions.yaml` parses with unique IDs; Prettier, whitespace,
  decision-reference, and Markdown-link checks pass.

## Exact Next Packet

- Obtain separate execution authorization for
  [01 Shared domain contracts](01_shared_domain_contracts.md) before a future
  `incremental-implementation` invocation.

## Blockers

- Task 01 execution is not authorized. `execution.task-01` revision 1 was
  cancelled and is superseded with the earlier plan baseline; no revision-2
  execution decision has been requested.
- Production hosting/publishing is deliberately deferred behind the manual
  gate recorded in `planning.artifact-publishing-target`.
