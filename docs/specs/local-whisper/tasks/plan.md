# Implementation Plan: Local Whisper Release Sequence

Status: **Approved**
Revision: **37**
Specification baseline: approved `spec.md` revision **28**.

Revision 37 preserves the revision-36 release topology and revises only the Linux Task 34 execution contract. Task 34 no longer downloads or restores `v2.3.0`. It validates or installs the exact public `v2.4.0-alpha.1` Debian package, retains it after testing, creates a private settings-only backup, exercises the ordinary application in an isolated profile, and seals the Linux result. Task 35 keeps its independent Windows current-user NSIS contract.

## Goal

Finish `v2.4.0` only after one completely published alpha has independent truthful Linux and Windows CPU/RTX 50 smoke results. The existing public `v2.4.0-alpha.1` remains immutable. Any platform failure selects only a future sequential alpha; dual pass permits explicit feedback selection of another alpha or final.

## Ordered Task Index

| Task                                                                                  | Outcome                                                                                                                                                                                                   | Dependencies                                                                                | Owned coverage                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [32 Complete production release pipeline](32_complete_production_release_pipeline.md) | **Completed.** Construct and authenticate the production Linux/Windows candidate pipeline while preserving guarded publication.                                                                           | Completed Tasks 01–20 and 23–25                                                             | Production-pipeline slices; primary `AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`–`AC-AUTO-090`.                                                                                                  |
| [33 Release v2.4.0-alpha.1](33_release_v2_4_0_alpha_1.md)                             | **Completed.** Build once, promote the same candidate, and publish the complete immutable prerelease.                                                                                                     | 32                                                                                          | Alpha release slices; `AC-MAN-012`, `AC-MAN-014`, `AC-MAN-020`.                                                                                                                                 |
| [34 Test v2.4.0-alpha.1 on Linux](34_test_v2_4_0_alpha_1_linux.md)                    | Revise the shared alpha-smoke harness, validate or install and retain the exact public alpha, create a private settings-only backup, run ordinary-UI CPU/RTX 50/offline smoke, and seal the Linux result. | 33; current Linux host; exact public-alpha proof; settings-backup and physical manual gates | Linux slices `CI-005`, `REL-001`, `REL-003`–`REL-004`, `QUAL-001`, `QUAL-004`–`QUAL-005`, `QUAL-007`, `COMP-004`, `COMP-013`–`COMP-014`, `OPS-004`; `AC-AUTO-082`; `AC-AUTO-092`; `AC-MAN-017`. |
| [35 Test v2.4.0-alpha.1 on Windows](35_test_v2_4_0_alpha_1_windows.md)                | Reuse the reviewed shared harness, run independent current-user NSIS CPU/RTX 50/offline smoke on the separate Windows computer, and seal the Windows result.                                              | 33; committed shared Task 34 tooling; separate Windows host; manual gates                   | Windows slices `CI-005`, `REL-001`, `REL-003`–`REL-004`, `QUAL-001`, `QUAL-004`–`QUAL-007`, `COMP-004`, `COMP-013`, `OPS-004`; `AC-AUTO-082`; `AC-MAN-018`.                                     |
| [36 Release v2.4.0](36_release_v2_4_0.md)                                             | Build and deploy final only after the latest-alpha Linux and Windows results pass and feedback explicitly selects final.                                                                                  | 34 and 35 Pass; aggregate feedback selects final                                            | Final release slices; `AC-AUTO-071`, `AC-AUTO-091`, `AC-MAN-019`, `AC-MAN-021`.                                                                                                                 |

## Sequencing And Reuse

The active graph is:

`32 complete → 33 complete → 34 Linux tooling and smoke → 35 Windows adapter and smoke → feedback → 36 if final is selected`

- Task 35 depends on the reviewed shared protocol and schemas delivered by Task 34, not on the Linux result value. Linux and Windows digests remain independent.
- Task 34 accepts only a clean host or the exact inactive target alpha proven equivalent to the public `deb`. A different or ambiguous installed package leaves it Pending before launch.
- Task 34 backs up only the closed settings-file allowlist into a separate retained owner-only root. It excludes sessions, tokens, history, SQLite, browser data, logs, and caches. The exercise uses an isolated task profile and never reads or restores the backup.
- Task 34 never downloads or installs a predecessor, uninstalls or downgrades the tested alpha, or deletes the settings backup. A clean-host install has one explicit manual gate; the current exact installed alpha path needs no privileged package command after equivalence is proven.
- Each physical attempt has its own monotonic two-hour deadline and immutable Pass or Fail result after attempt start. Retries do not reset time.
- The published application is never modified for testing. The operator uses the ordinary UI while the runner validates origins, hashes, package identity, backup integrity, processes, backend/device correlation, offline reuse, privacy, and cleanup.

## Historical State And Authority

- Tasks 01–20, 23–25, 32, and 33 are complete. Task 26 remains deferred. Tasks 21, 22, and 27–31 remain superseded historical packets.
- `v2.4.0-alpha.1` is public at source SHA `b651f3a4a309f2c21f83a81869f1ae666f7aa9b2`; its tag and public assets are immutable.
- The current Linux host reports inactive `gpt-voice 2.4.0~alpha.1` installed. Task 34 must independently prove equivalence to the exact public alpha before reuse.
- Plan approval authorizes no implementation, settings read or backup, network download, privilege escalation, package mutation, application launch, physical test, evidence sealing, commit, push, release mutation, feedback selection, support promotion, or final release.
- Every packet requires a separate explicit `$incremental-implementation` invocation. Package commands, settings backup, public downloads, and ordinary-UI physical checkpoints remain explicit `MANUAL GATE` actions in Task 34.
