# Task 26: Deferred RTX 30/40 CUDA Runtime Expansion

Status: **Deferred · Non-executable**

## Outcome

Preserve the future intent to add hardware-matched RTX 30 / `sm_86` and RTX
40 / `sm_89` CUDA delivery on Linux and Windows without treating that work as
current scope, an active dependency, a qualification gate, or an executable
task packet.

## Prerequisites

- Specification revision 20 and plan revision 27 are approved.
- A future user request explicitly reopens RTX 30/40 support.
- A later specification revision defines the supported devices, runtime
  identities, driver/toolchain contract, migration, UI behavior, privacy, and
  representative Linux/Windows acceptance gates.
- A later planning revision replaces this deferred placeholder with one or
  more self-contained executable packets and obtains separate approval.

## Owned Requirements

- No active specification revision 20 requirement or automated/manual
  acceptance criterion.
- Historical revision-17 ownership of `CAP-018`, `COMP-013`, `DIST-003`,
  `PRIV-006`, `QUAL-005`–`QUAL-006`, `RUNTIME-005`, `UI-010`, `VAL-004`,
  `OPS-004`, `AC-AUTO-078`–`AC-AUTO-082`, and `AC-MAN-017`–`AC-MAN-018` is
  superseded. Active RTX 50 ownership is assigned by plan revision 27.

## In Scope

- Keep one visible roadmap record that RTX 30/40 support is intentionally
  postponed rather than forgotten.
- Keep the current roadmap validator aware that Task 26 is deferred, has no
  verification command, and owns no active acceptance criterion.
- Require a new specification and plan approval before this file can become
  executable.

## Out Of Scope

- Source, test, catalog, settings, migration, UI, native-worker, runtime-pack,
  installer, documentation, or qualification changes.
- Building, downloading, exposing, installing, launching, or validating
  `sm_86-real` or `sm_89-real` artifacts.
- Treating RTX 30/40 as Supported, Preview, Production-eligible, or a Pending
  release gate.
- Candidate freeze, hardware use, commit, push, PR, signing, upload,
  publication, support promotion, tag, or release.

## Task Contract

This packet SHALL NOT be passed to `incremental-implementation`. The active
catalog and UI continue to expose no RTX 30/40 runtime action. Saved or forged
`sm_86`/`sm_89` selections remain unavailable and authorize no download,
launch, migration, fallback, or qualification record.

The future revision must not assume that the former revision-17 six-cell
design is still correct. It must re-establish current NVIDIA toolchain and
driver facts, supported desktop/laptop boundaries, resource floors, artifact
trust, package architecture, representative hardware availability, and
release impact before executable work is planned.

## Contracts And Boundaries

- Task 26 is absent from the active dependency chain. Tasks 27, 31, 30, 28,
  29, 21, and 22 do not wait for it and must not consume evidence from it.
- RTX 50 / `sm_120a` remains owned by the active Tasks 25, 27, 31, 28, 29,
  21, and 22.
- CPU, AMD Preview, and macOS Planned/unavailable boundaries are unchanged.
- No future support claim follows from retaining this file.

## Expected Files Or Components

- No production or test file is expected to change under this packet.
- A future approved plan may replace this file and update the task registry,
  validator, specification references, and acceptance ownership.

## Acceptance Criteria

- Plan revision 27 marks Task 26 deferred and non-executable.
- Task 26 has no registered verification command and no primary automated
  acceptance owner.
- Active plan sequencing and candidate freeze do not depend on Task 26.
- Active support text and packets contain no RTX 30/40 delivery or Pending
  qualification requirement.

## Verification

No Task 26 execution command is registered. During roadmap validation, the
plan validator must reject any active verification command or automated
acceptance owner assigned to deferred Task 26.

## Failure And Rollback

- If any active artifact still depends on Task 26, plan revision 27 remains
  Draft until that dependency is removed.
- If RTX 30/40 implementation becomes required, return to specification work;
  do not edit around this deferral inside an implementation session.
- Rollback of this planning change restores plan revision 24 and specification
  revision 18 together; never mix the old release roadmap with revision 20.

## Manual Gates

- A future explicit user decision is required to reopen RTX 30/40 scope.
- Representative RTX 30 and RTX 40 hardware, network acquisition, signing,
  upload, publication, and release remain unauthorized and are not current
  blockers.

## References

- Specification revision 20 Sections 3.2, 5, 6, 7.4, 8.2, 9.1, 19.1–19.3,
  and 22.
- Decision `planning.deferred-rtx-roadmap-disposition` revision 1.
- Historical specification revision 17 and plan revision 23 only as context;
  they are not executable authority.

## Completion And Handoff

Task 26 remains unchecked and deferred. It cannot be completed under
specification revision 20. The active handoff points to Task 27 and records no
RTX 30/40 blocker.
