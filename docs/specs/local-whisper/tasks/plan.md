# Implementation Plan: Local Whisper Release Sequence

Status: Approved

Revision: 29

Specification baseline: approved `spec.md` revision 21.

Revision 29 preserves completed Tasks 01–20 and 23–25, keeps Task 26 outside
the release as deferred non-executable future work, and supersedes the
remaining Task 27 → 31 → 30 → 28 → 29 → 21 → 22 chain. Its unfinished work is
redistributed without deletion into four and only four executable packets.

## Goal

Build and deploy a public signed `v2.4.0-alpha.1` prerelease first, then build
and deploy a distinct freshly qualified `v2.4.0` stable release. Linux x64 and
Windows x64 each receive an application installer, CPU runtime pack, and RTX 50
`sm_120a-real` runtime pack. RTX 30/40 remain unavailable, AMD remains
Preview/Untested, and macOS remains Planned/Unavailable.

## Ordered Task Index

| Task                                                    | Outcome                                                                                                                                                                                                                                          | Dependencies                                          | Owned coverage                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [32 Build v2.4.0-alpha.1](32_build_v2_4_0_alpha_1.md)   | Finish immutable hosted inputs and six-output builders; implement release preparation and protected candidate production; build/sign one exact alpha generation; complete deterministic checks and bounded Linux/Windows packaged smoke.         | Completed Tasks 01–20 and 23–25; approved revision 21 | Build slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`, `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `DIST-004`, `REL-001`–`REL-004`, `QUAL-001`, `QUAL-004`, `QUAL-007`, `COMP-012`–`COMP-013`, `OPS-003`–`OPS-004`; primary `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-086`; build portion of `AC-MAN-020`                                                   |
| [33 Deploy v2.4.0-alpha.1](33_deploy_v2_4_0_alpha_1.md) | Reconcile the exact alpha evidence; preserve the qualified head through merge; create the immutable alpha tag; stage, final-origin verify, and publish the complete public GitHub prerelease without clobbering.                                 | 32                                                    | Alpha deploy slices of `CI-004`, `CI-007`–`CI-008`, `DIST-001`–`DIST-004`, `PKG-011`–`PKG-012`, `SEC-014`, `REL-001`–`REL-004`, `QUAL-001`, `QUAL-007`, `OPS-002`–`OPS-004`; primary `AC-AUTO-087`–`AC-AUTO-090`; deploy portion of `AC-MAN-020`                                                                                                                   |
| [34 Build v2.4.0](34_build_v2_4_0.md)                   | After verified alpha deployment and reviewed feedback fixes, freeze a new final head; rebuild/sign all six outputs; execute complete all-six-model Linux and Windows CPU/RTX 50 qualification; seal fresh final platform and aggregate evidence. | 33                                                    | Final-build slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`, `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `REL-001`–`REL-004`, `QUAL-001`–`QUAL-007`, `MODEL-011`, `PRIV-005`–`PRIV-006`, `COMP-012`–`COMP-013`, `OPS-003`–`OPS-004`; primary `AC-AUTO-082`; `AC-MAN-017`, `AC-MAN-018`, and build portion of `AC-MAN-021`                               |
| [35 Deploy v2.4.0](35_deploy_v2_4_0.md)                 | Promote only the exact fresh final generation: preserve merge identity, create `v2.4.0`, non-clobbering stage/final-origin verification, publish stable Linux/Windows assets, run clean installs, and promote only qualified support cells.      | 34                                                    | Final deploy and aggregate slices of `REL-001`–`REL-004`, `CI-004`, `CI-007`–`CI-008`, `DIST-001`–`DIST-004`, `PKG-011`–`PKG-012`, `SEC-014`, `COMP-012`–`COMP-013`, `QUAL-001`–`QUAL-007`, `OPS-002`–`OPS-004`; primary `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`, `AC-AUTO-071`, `AC-AUTO-091`; `AC-MAN-019` and deploy portion of `AC-MAN-021` |

## Historical Packet State

- Tasks 01–20 and 23–25 remain completed evidence and are not reopened.
- Tasks 21, 22, and 27–31 are superseded historical packets. Their unfinished
  gates are owned explicitly by Tasks 32–35.
- Task 26 remains deferred, non-executable, and outside both releases.
- No other executable Local Whisper task is permitted by this plan.

## Sequencing And Authority

The active dependency graph is exactly `32 → 33 → 34 → 35`. A packet may not
consume a later release identity or skip an earlier deployment. Build packets
own candidate creation and evaluation; Deploy packets consume candidates
read-only and may never build, re-sign, repack, or rewrite evidence.

Plan approval authorizes no packet execution, network acquisition, workflow
run, protected environment, signing, physical qualification, version change,
branch or pull-request action, repository-setting change, commit, push, merge,
tag, GitHub Release action, publication, support promotion, or release. Each
packet requires a separate incremental-implementation invocation, and every
external or destructive action remains a `MANUAL GATE`.
