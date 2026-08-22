# Implementation Plan: Local Whisper Release Sequence

Status: Approved

Revision: 31

Specification baseline: approved `spec.md` revision 23.

Revision 31 preserves completed Tasks 01–20 and 23–25, keeps Task 26 deferred
and non-executable, and replaces revision 30's separate Build and Deploy
packets with four finite one-shot packets. Each release version has one
combined Release packet. The public alpha is followed by independent Linux and
Windows smoke packets; the final release has no physical platform-test packet.

## Goal

Build and publish signed sequential `v2.4.0-alpha.N` prereleases, test each
public alpha independently on Linux and Windows, and use feedback to choose
either the next sequential alpha or a fresh reproducible `v2.4.0` release.
Every generation contains Linux and Windows application installers plus CPU
and RTX 50 `sm_120a-real` runtime packs. RTX 30/40 remain unavailable, AMD
remains Preview/Untested, and macOS remains Planned/Unavailable.

## Ordered Task Index

| Task                                                                   | Outcome                                                                                                                                                                                                                                                                          | Dependencies                                                      | Owned coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [32 Release v2.4.0-alpha.1](32_release_v2_4_0_alpha_1.md)              | Finish the target-aware six-output release system, build/sign reproducibly, preserve the release head through merge/tag, stage and final-origin verify without clobbering, then publish the complete public prerelease before physical smoke.                                    | Completed Tasks 01–20 and 23–25; approved specification 23        | Release slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`, `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `DIST-001`–`DIST-004`, `REL-001`–`REL-004`, `QUAL-001`, `QUAL-004`, `QUAL-007`, `COMP-012`–`COMP-013`, `OPS-003`–`OPS-004`; primary `AC-AUTO-080`, `AC-AUTO-082`–`AC-AUTO-090`; supporting `AC-AUTO-073`, `AC-AUTO-091`; `AC-MAN-012`, `AC-MAN-014`, `AC-MAN-020`                                                                                               |
| [33 Test v2.4.0-alpha.1 on Linux](33_test_v2_4_0_alpha_1_linux.md)     | Consume only public alpha.1 Linux assets and seal one bounded CPU/RTX 50 platform-smoke result without release authority.                                                                                                                                                        | 32                                                                | Linux slices of `CI-005`, `REL-001`, `REL-003`–`REL-004`, `QUAL-001`, `QUAL-004`–`QUAL-005`, `QUAL-007`, `COMP-004`, `COMP-013`, `OPS-004`; Linux slice of `AC-AUTO-082`; `AC-MAN-017`                                                                                                                                                                                                                                                                                          |
| [34 Test v2.4.0-alpha.1 on Windows](34_test_v2_4_0_alpha_1_windows.md) | Independently consume only public alpha.1 Windows assets and seal one bounded CPU/RTX 50 platform-smoke result without release authority.                                                                                                                                        | 32; independent of 33                                             | Windows slices of `CI-005`, `REL-001`, `REL-003`–`REL-004`, `QUAL-001`, `QUAL-004`–`QUAL-006`, `QUAL-007`, `COMP-004`, `COMP-013`, `OPS-004`; Windows slice of `AC-AUTO-082`; `AC-MAN-018`                                                                                                                                                                                                                                                                                      |
| [35 Release v2.4.0](35_release_v2_4_0.md)                              | After both latest-alpha smokes pass and feedback selects final, prove the closed final-only delta, freshly rebuild/sign all six outputs reproducibly, preserve and publish the exact final generation, and promote supported Linux/Windows cells without physical final testing. | 33 and 34; sealed passing alpha aggregate; feedback selects final | Final slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`, `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`, `DIST-001`–`DIST-004`, `REL-001`–`REL-004`, `QUAL-001`–`QUAL-007`, `MODEL-011`, `PRIV-005`–`PRIV-006`, `COMP-004`, `COMP-012`–`COMP-013`, `OPS-003`–`OPS-004`; primary `AC-AUTO-071`, `AC-AUTO-091`; supporting `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`, `AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-090`; `AC-MAN-019`, `AC-MAN-021` |

## Historical Packet State

- Tasks 01–20 and 23–25 remain completed evidence and are not reopened.
- Tasks 21, 22, and 27–31 remain superseded historical packets.
- Revision-30 packet definitions for Tasks 32–35 are superseded by the
  revision-31 packet files linked above. Verified partial implementation work
  from the former Task 32 remains an input to the new Task 32; no prior
  prepublication smoke or final qualification claim is carried forward.
- Task 26 remains deferred, non-executable, and outside both releases.
- No other Local Whisper packet is executable under this revision.

## Sequencing And Authority

The materialized graph is:

`32 → (33 || 34) → alpha aggregate and feedback transition → 35 when final is selected`

Tasks 33 and 34 may run in parallel after Task 32 and neither consumes or
rewrites the other's result. After both results exist, a manual feedback gate
seals `alphaAggregateDigest` and records exactly one transition:

- if either result failed, only the next-alpha transition is valid;
- if both passed, feedback may still select another alpha, or may select final
  when no accepted fix is absent from the tested alpha;
- selecting another alpha leaves Task 35 unexecuted and requires a new
  `/plan` revision. That revision supersedes Task 35, appends one exact
  Release/Linux-smoke/Windows-smoke set for `alpha.(N+1)`, and appends a fresh
  conditional final Release packet.

Packets are never repeatable, alpha numbers never skip, and no task consumes a
later release identity. Release packets own candidate creation and external
promotion for one version. Platform-smoke packets consume already-public alpha
assets read-only and hold no release write or signing authority.

Plan approval authorizes no packet execution, network acquisition, workflow
run, protected environment, signing, physical test, feedback selection,
version change, branch or pull-request action, repository-setting change,
commit, push, merge, tag, GitHub Release action, publication, support
promotion, or release. Each packet requires an explicit
`incremental-implementation` invocation, and every external or destructive
action remains a `MANUAL GATE`.
