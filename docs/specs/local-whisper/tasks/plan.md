# Implementation Plan: Local Whisper Release Sequence

Status: Approved

Revision: 34

Specification baseline: approved `spec.md` revision 26.

Revision 34 preserves revision 33's packet topology and adds one bounded
execution path across its Task 32/33 boundary. Task 32 must not execute
publication, but it preserves and tests the default-off publication path. The
exact `local-whisper-alpha-release` Watch may prove Task 32, record its
completion, and continue directly into Task 33 under one six-hour
version-scoped authority. Task 33 builds one versioned candidate and promotes
those same prior-run bytes without a second build. The Watch stops after the
green public prerelease workflow; independent Linux and Windows smoke remain
Tasks 34/35, and final has no physical platform-test packet.

## Goal

First make the production release pipeline construct and authenticate every
physical application, runtime, catalog, signature, and verification asset
needed for full Linux and Windows testing. Then build and publish signed
sequential `v2.4.0-alpha.N` prereleases, test each public alpha independently
on Linux and Windows, and use feedback to choose either the next sequential
alpha or a fresh reproducible `v2.4.0` release. The six outputs are logical
classes: the physical set includes Linux AppImage/deb/rpm, Windows NSIS, four
platform/target runtime archives, and all required ancillary trust/evidence
assets. Pinned Hugging Face models remain external inputs.

## Ordered Task Index

| Task                                                                                  | Outcome                                                                                                                                                                                                                                                                                            | Dependencies                                                      | Owned coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [32 Complete production release pipeline](32_complete_production_release_pipeline.md) | Implement and prove the real protected Linux/Windows production builders, disconnected runtime construction, complete physical inventory, trust/verification assets, and fail-closed release validators without creating release state; preserve the guarded default-off Task 33 publication path. | Completed Tasks 01–20 and 23–25; approved specification 26        | Implementation slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`, `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `DIST-001`–`DIST-004`, `REL-001`–`REL-005`, `QUAL-001`, `QUAL-004`, `QUAL-007`, `COMP-012`–`COMP-013`, `OPS-003`–`OPS-005`; primary `AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-090`; supporting `AC-AUTO-082`, `AC-AUTO-091`                                                                                                                                          |
| [33 Release v2.4.0-alpha.1](33_release_v2_4_0_alpha_1.md)                             | Perform one combined Build + Deploy operation: commit/freeze alpha identity, freshly build/sign one complete versioned candidate, preserve merge/tag identity, promote those exact prior-run bytes without rebuilding, final-origin verify, and publish the complete public prerelease.             | 32                                                                | Alpha-release slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`, `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `DIST-001`–`DIST-004`, `REL-001`–`REL-005`, `QUAL-001`, `QUAL-004`, `QUAL-007`, `COMP-012`–`COMP-013`, `OPS-003`–`OPS-005`; target application of `AC-AUTO-085`–`AC-AUTO-091`; `AC-MAN-012`, `AC-MAN-014`, `AC-MAN-020`                                                                                                                                                          |
| [34 Test v2.4.0-alpha.1 on Linux](34_test_v2_4_0_alpha_1_linux.md)                    | Consume only public alpha.1 Linux assets and seal one bounded CPU/RTX 50 platform-smoke result without release authority.                                                                                                                                                                          | 33                                                                | Linux slices of `CI-005`, `REL-001`, `REL-003`–`REL-004`, `QUAL-001`, `QUAL-004`–`QUAL-005`, `QUAL-007`, `COMP-004`, `COMP-013`, `OPS-004`; Linux slice of `AC-AUTO-082`; `AC-MAN-017`                                                                                                                                                                                                                                                                                                                 |
| [35 Test v2.4.0-alpha.1 on Windows](35_test_v2_4_0_alpha_1_windows.md)                | Independently consume only public alpha.1 Windows assets and seal one bounded CPU/RTX 50 platform-smoke result without release authority.                                                                                                                                                          | 33; independent of 34                                             | Windows slices of `CI-005`, `REL-001`, `REL-003`–`REL-004`, `QUAL-001`, `QUAL-004`–`QUAL-006`, `QUAL-007`, `COMP-004`, `COMP-013`, `OPS-004`; Windows slice of `AC-AUTO-082`; `AC-MAN-018`                                                                                                                                                                                                                                                                                                             |
| [36 Release v2.4.0](36_release_v2_4_0.md)                                             | After both latest-alpha smokes pass and feedback selects final, prove the closed final-only delta, freshly build/sign the complete physical inventory reproducibly, preserve and publish the exact final generation, and promote supported Linux/Windows cells without physical final testing.     | 34 and 35; sealed passing alpha aggregate; feedback selects final | Final slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`, `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `DIST-001`–`DIST-004`, `REL-001`–`REL-004`, `QUAL-001`–`QUAL-007`, `MODEL-011`, `PRIV-005`–`PRIV-006`, `COMP-004`, `COMP-012`–`COMP-013`, `OPS-003`–`OPS-004`; primary `AC-AUTO-071`, `AC-AUTO-091`; supporting target-aware reruns of `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`, `AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-090`; `AC-MAN-019`, `AC-MAN-021` |

## Historical Packet State

- Tasks 01–20 and 23–25 remain completed evidence and are not reopened.
- Tasks 21, 22, and 27–31 remain superseded historical packets.
- Plan-31 Tasks 32–35 are superseded by revision 32's Tasks 32–36. Verified
  hosted materializer and partial release-policy implementation remains input
  to Task 32, but static policy success, disabled production packaging, and
  application-only CI artifacts are not completion or release evidence.
- Revision 33 keeps the same Tasks 32–36 and supersedes only revision 32's
  mistaken interpretation that Task 32's nonpublication boundary permitted
  removal of Task 33's tag-and-publication capability.
- Task 26 remains deferred, non-executable, and outside both releases.
- No other Local Whisper packet is executable under this revision.

## Sequencing And Authority

The materialized graph is:

`32 → 33 → (34 || 35) → alpha aggregate and feedback transition → 36 when final is selected`

Task 32 owns reversible production-pipeline implementation and nonpublishing
construction proof. It creates no release identity, leaves publication disabled,
and must preserve regression-tested publication code for the next packet. Task
33 is the combined alpha.1 Build + Deploy packet and owns enabling that gate and
every irreversible source/merge/tag/publication action for that version. Tasks
34 and 35 may run in parallel only after Task 33 publishes the complete public
alpha; neither consumes or rewrites the other's result.

After both platform results exist, a manual feedback gate seals
`alphaAggregateDigest` and records exactly one transition:

- if either result failed, only the next-alpha transition is valid;
- if both passed, feedback may still select another alpha, or may select final
  when no accepted fix is absent from the tested alpha;
- selecting another alpha leaves Task 36 unexecuted and requires a new
  `/plan` revision. That revision supersedes Task 36, appends one exact
  Release/Linux-smoke/Windows-smoke set for `alpha.(N+1)`, and appends a fresh
  conditional final Release packet.

Packets are never repeatable, alpha numbers never skip, and no task consumes a
later release identity. Platform-smoke packets consume already-public alpha
assets read-only and hold no release write/signing authority. The final packet
uses the latest passing alpha lineage, a closed non-behavioral delta, and fresh
production bytes; it has no physical final-test branch.

Plan approval authorizes no packet execution, network acquisition, workflow
run, protected environment, signing, physical test, feedback selection,
version change, branch or pull-request action, repository-setting change,
commit, push, merge, tag, GitHub Release action, publication, support
promotion, or release. Each packet requires an explicit
`incremental-implementation` invocation, and every external or destructive
action remains a `MANUAL GATE`.
