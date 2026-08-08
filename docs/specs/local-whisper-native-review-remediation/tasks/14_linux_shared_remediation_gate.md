# 14 Linux And Shared Remediation Gate

## Outcome

The complete Linux/shared implementation, sanitizer, analyzer, fuzz, TSan, GCC, hardening, privacy, and supported-host smoke matrix passes against the approved specification. Any Linux/shared defects discovered by the integrated gate are fixed and reverified here before final supported-host manual Windows validation begins.

## Prerequisites

- Packets 01–13 are checked complete. Packets 04–13 have successful candidate and completion-record CI for Linux and Windows with no skipped required Windows job.
- This packet has separate execution authorization and no other packet is in progress.
- A supported Linux x64 host, pinned toolchains, verified native inputs, and authorized non-sensitive smoke fixtures are available.

## Owned Requirements

- Primary: OUT-001, OUT-002, GAT-001, GAT-002 for Linux/shared readiness.
- Final Linux audit: SCP-001, SCP-002, SCP-003, CMP-001, CMP-002, CMP-003, CMP-004, ARC-001–ARC-003, SEC-001–SEC-004, OPS-001–OPS-004, TST-001–TST-007, and every Linux/shared requirement owned by Packets 01–13.
- Acceptance: Linux/shared portions of AC-AUT-001–AC-AUT-027; AC-MAN-001, Linux portion of AC-MAN-003, and AC-MAN-005.

## In Scope

- Full Linux native and TypeScript matrices from a clean validated test-output state.
- Linux Clang ASan/UBSan/analyzer/fuzz/TSan, focused GCC, exact ELF inspection, coverage reporting, and advisory fixtures/evidence.
- Supported-host worker/launcher/guard smoke behavior and descriptor/process baselines.
- Fixing failures discovered by these gates within the already approved behavior and CI contracts, then rerunning all affected checks.
- Final inventory of every supported-host manual Windows command, expected binary, fixture, and case reserved for Packet 15.

## Out Of Scope

- Supported-host manual Windows execution and its host-only findings; new product behavior, dependencies, packaging, signing, qualification, release, publication, force-pushes, or pull-request modification.
- Weakening/suppressing a check, increasing timeouts to hide a defect, or changing an approved contract to obtain a pass.

## Task Contract

1. Audit the final implementation map against all 23 selected source/CI review subjects, every active requirement ID, and every acceptance ID. Confirm no requirement was lost during packet decomposition.
2. Run the complete Linux/shared automated matrix, including ordinary native tests, non-recovering sanitizer proof/suites, path-sensitive analysis, all seven fuzz targets, TSan proof/suite, focused GCC, hardening fixtures/live ELF inspection, TypeScript contracts, and coverage reporting.
3. Perform AC-MAN-001 on supported Linux x64 with authorized synthetic/public fixture inputs: successful transcription, cancel-first, transcript-first nonfatal conflict with preserved transcript, warmed next request, oversized guard restart, and graceful EOF shutdown.
4. Perform the Linux half of AC-MAN-003 on the exact optimized executables used by the smoke. Match bounded relative-role/SHA-256 reports to those binaries.
5. Perform AC-MAN-005 and confirm each gate used its locked profile, exact source set, bounded budget, and actual evidence kind.
6. Inspect descriptor counts, child/process ownership, logs, reports, corpora, caches selected for upload, and retained evidence for leaks or sensitive content.
7. Fix every Linux/shared defect found within the approved contract, add/retain a focused regression, and rerun the failing gate plus every affected upstream/downstream check. If the fix requires a new dependency, public behavior, support change, or specification change, stop and return to specification.
8. Produce the exact Packet 15 supported-host manual run manifest: ordinary MSVC, dedicated MSVC ASan, MSVC analysis, Windows deterministic suites, handle baselines, PE outputs, and smoke cases. Automated CI evidence may be referenced, but manual cases must remain explicitly unexecuted until Packet 15.

## Contracts And Boundaries

- Use validated temporary roots and exact fixture processes; do not remove user data or terminate ambient processes.
- Audio/transcripts remain private; evidence records classifications and outcomes, never contents.
- Passing this packet proves Linux supported-host/manual readiness plus complete packet-local automated Linux/Windows CI. It does not satisfy Packet 15's supported-host manual Windows evidence or qualification.

## Expected Files Or Components

- Production/test/configuration files owned by Packets 01–13 only when a gate-discovered fix is required.
- `docs/specs/local-whisper-native-review-remediation/tasks/todo.md` and `handoff.md`.
- Read-only inspection of build outputs/reports; no generated binaries or reports are committed.

## Acceptance Criteria

- Every applicable Linux/shared AC-AUT case passes under its intended evidence class and locked profile.
- AC-MAN-001, Linux AC-MAN-003, and AC-MAN-005 pass without abort, hang, busy loop, orphan, descriptor leak, sensitive output, or lost committed transcript.
- Every gate-discovered defect has a focused regression and all affected checks pass after the fix.
- The Packet 15 manual manifest is complete and no automated Windows result is mislabeled as supported-host manual evidence.
- Exclusions, privacy constraints, and no-release/no-qualification boundaries remain intact.

## Verification

Run the canonical Linux completion commands introduced by Packets 01–13, including at minimum:

```text
npm run prepare:local-whisper:native-test-sources
npm run verify:local-whisper:worker-vectors -- --check-clean
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:supervisor
npm run test:local-whisper:coordinator
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:filesystem
npm run test:local-whisper:launcher:native
npm run verify:local-whisper:worker-authority -- --platform=linux
npm run test:local-whisper:native-sanitizer-proof
npm run test:local-whisper:native-analysis
npm run test:local-whisper:native-fuzz
npm run test:local-whisper:worker-tsan
npm run test:local-whisper:fs-guard:gcc
npm run test:local-whisper:launcher:gcc
npm run test:local-whisper:native-hardening
npm run verify:local-whisper:native-hardening -- --platform=linux
npm run test:local-whisper:native-advisory
npm run format:check
npm run lint
npm run typecheck
npm run test:types
```

Use canonical command names established during implementation and update this packet if they differ before execution.

## Remote Completion Gate

1. After local and supported-host Linux verification passes, leave Packet 14 unchecked, update `handoff.md` with candidate state and pending remote evidence, stage only packet-owned paths, and create a conventional Packet 14 candidate commit.
2. Push the candidate commit without force to the verified head of pull request 58 (or its verified successor) and record the exact SHA. Confirm that the push launches CI for that SHA.
3. Require all checks selected for that SHA to finish successfully. At minimum inspect **Local Whisper Native Quality (Linux)**, **Local Whisper Native Quality (Windows)**, **Quality Gates**, **Package Smoke (Fedora Linux)**, **Package Smoke (Windows)**, **Actionlint**, every selected `Local Whisper Fixture Packaging` job, and all sanitizer, analyzer, fuzz, TSan, GCC, hardening, and reporting jobs introduced by Packets 04–13.
4. Every required Linux and Windows job must execute the complete final native/C++ surface. Every required Windows job must run and conclude `success`; a skipped Windows job is never acceptable. This automated Windows rerun does not replace Packet 15's supported-host manual Windows cases.
5. Fix packet-caused in-scope failures, add focused regressions where applicable, commit and push the fix, and repeat the exact-SHA gate. Record an unrelated or out-of-scope failure as a blocker and leave the packet unchecked.
6. After the candidate SHA passes, check Packet 14, record the remote run/job evidence in `handoff.md`, create and push a separate completion-record commit, and require all workflows for that final SHA to pass again. That final external check result closes the gate without another self-referential documentation commit.

## Failure And Rollback

- Keep Packet 14 unchecked until every Linux/shared gate passes. Record the exact requirement, acceptance ID, command, and bounded failure classification.
- Roll back only the gate-discovered fix and its regression if necessary; do not erase prior packet work or evidence.
- Never suppress a security finding or treat missing evidence as clean.

## Manual Gates

- **MANUAL GATE:** AC-MAN-001 requires a supported Linux x64 host and already authorized non-sensitive Local Whisper inputs.
- **MANUAL GATE:** Linux AC-MAN-003 and AC-MAN-005 require exact binary/profile evidence from that host.
- No supported-host manual Windows execution, manual workflow dispatch, package, qualification, or release action is authorized. The packet's two required non-force PR-head pushes are part of the remote completion gate.

## References

- Entire approved specification, especially Sections 3, 9–12.
- Packet-local handoff evidence from Packets 01–13.

## Completion And Handoff

- Record all Linux/shared results, gate-discovered fixes, exact ELF roles/digests, manual evidence, the Packet 15 manual manifest, exact candidate/completion commits, and successful final Linux/Windows CI jobs in `handoff.md`.
- Check Packet 14 only after every local/manual Linux gate and both exact-SHA remote phases pass with no skipped required Windows job.
- Set `Exact next packet: 15 — Windows Validation And Remediation Gate` and stop.
