# 11 Worker TSan Gate

## Outcome

A separate Linux Clang ThreadSanitizer configuration detects a synthetic race and runs the complete deterministic remediated worker concurrency matrix without race, lock-order, lifecycle, or runtime findings.

## Prerequisites

- Packets 01, 08, and 09 are complete so worker ownership, profile policy, and source manifests are stable.
- This packet has separate execution authorization and no other packet is in progress.
- The pinned Linux Clang profile and project-owned worker test sources are available.

## Owned Requirements

- Primary: TSN-001, TSN-002.
- Cross-cutting: THR-001, INF-001, CAN-001–CAN-003, CMP-006, SEC-003, SEC-004, TST-003, TST-005, TST-007.
- Acceptance: AC-AUT-022.

## In Scope

- A dedicated TSan worker profile, deterministic concurrency suite, synthetic race proof, bounded runner, and PR workflow wiring.
- Cancel-first, transcript-first, malformed cancel, EOF, immediate/delayed inference failure, completion, cleanup, and next-request cases.

## Out Of Scope

- Combining TSan with ASan, claiming Windows-channel instrumentation, timing-sleep-only assertions, or replacing Packet 01's explicit lifecycle tests.

## Task Contract

1. Add a separate Linux Clang TSan configuration for the project-owned worker concurrency suite; do not combine it with ASan.
2. Reuse Packet 01's deterministic synchronization seams to exercise every TSN-001 ordering and explicit bounded-join/terminal-outcome assertion.
3. Add a test-only deterministic synthetic race target and prove TSan reports it nonzero with a bounded sanitized classification.
4. Fail on any race, lock-order, thread-lifecycle, unsupported-instrumentation, runtime, timeout, malformed report, or unexpected proof success.
5. Keep reports explicit that shared worker state is instrumented on Linux and the Windows channel implementation is not.

## Contracts And Boundaries

- Production synchronization remains owned by the worker application; TSan helpers are test-only.
- No audio, transcript, paths, request content, or toolchain environment dump enters reports.
- The runner owns exact child processes and bounded termination only.

## Expected Files Or Components

- Worker CMake/tests and Packet 01's deterministic concurrency fixtures.
- A TSan profile/runner under `runtime/local-whisper/toolchains/` and `scripts/local-whisper/native-build/`.
- Synthetic race fixture, `package.json`, `.github/workflows/pr-checks.yml`, and workflow tests.

## Acceptance Criteria

- AC-AUT-022 detects the synthetic race and passes the complete remediated worker suite without findings.
- Exception unwind, bounded join, terminal-result uniqueness, warmed-worker reuse, and both cancellation orderings remain explicit assertions.
- The coverage report identifies Linux TSan shared-code coverage without a Windows instrumentation claim.

## Verification

Run on Linux x64:

```text
npm run test:local-whisper:worker-tsan-proof
npm run test:local-whisper:worker-tsan
npm run test:local-whisper:native-ci-workflow
```

## Remote Completion Gate

1. After local verification passes, leave Packet 11 unchecked, update `handoff.md` with candidate state and pending remote evidence, stage only packet-owned paths, and create a conventional Packet 11 candidate commit.
2. Push the candidate commit without force to the verified head of pull request 58 (or its verified successor) and record the exact SHA. Confirm that the push launches CI for that SHA.
3. Require all checks selected for that SHA to finish successfully. At minimum inspect **Local Whisper Native Quality (Linux)**, **Local Whisper Native Quality (Windows)**, **Quality Gates**, **Package Smoke (Fedora Linux)**, **Package Smoke (Windows)**, **Actionlint**, every selected `Local Whisper Fixture Packaging` job, and the worker TSan job introduced by this packet.
4. The Linux TSan proof/suite and the ordinary Windows worker/native jobs must execute and pass. Every required Windows job must run and conclude `success`; a skipped Windows job is never acceptable even though TSan instrumentation remains Linux-only.
5. Fix packet-caused in-scope failures, add focused deterministic regressions where applicable, commit and push the fix, and repeat the exact-SHA gate. Record an unrelated or out-of-scope failure as a blocker and leave the packet unchecked.
6. After the candidate SHA passes, check Packet 11, record the remote run/job evidence in `handoff.md`, create and push a separate completion-record commit, and require all workflows for that final SHA to pass again. That final external check result closes the gate without another self-referential documentation commit.

## Failure And Rollback

- Fix a real worker race in Packet 01-owned code within this authorized packet and rerun Packet 01's Linux/shared completion set plus TSan.
- Do not suppress a finding or raise a timeout to hide deadlock/lifecycle behavior.
- Roll back TSan configuration, proof fixture, runner, package commands, and workflow wiring together.

## Manual Gates

- No Windows TSan instrumentation or supported-host manual Windows smoke applies, but the required Windows worker/native jobs must execute and pass without claiming TSan coverage. Packet 15 retains the final supported-host Windows matrix.
- The packet's non-force PR-head pushes are required; manual workflow dispatch and artifact publication remain unauthorized.

## References

- Specification Sections 5, 10.5, and 12; AC-AUT-022.
- Packet 01 is the behavior owner and Packet 09 owns source-coverage reporting.

## Completion And Handoff

- Record profile, proof classification, concurrency cases, TSan result, exact candidate/completion commits, and successful Linux/Windows CI jobs in `handoff.md`.
- Check Packet 11 only after the proof/remediated suite and both exact-SHA remote phases pass with no skipped Windows job.
- Set the exact next packet to Packet 12 and stop.
