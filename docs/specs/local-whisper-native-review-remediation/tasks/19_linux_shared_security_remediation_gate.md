# 19 Linux, Shared, And Security Remediation Gate

## Outcome

The complete Linux/shared implementation, native-quality, repository-security, two-runner, package/SBOM/vulnerability, attestation, privacy, and supported-host smoke matrix passes against the approved specification. Every Linux/shared or integrated security defect discovered by this gate is fixed and reverified before final supported-host manual Windows validation begins.

## Prerequisites

- Packets 01–18 are checked complete. Every code-bearing Packet 04–18 has successful exact-candidate CI with the required Ubuntu 24.04 and Windows Server 2025 jobs executed and no required Windows skip.
- This packet has separate execution authorization and no other packet is in progress.
- A supported Linux x64 host, pinned toolchains, verified native inputs, and authorized non-sensitive smoke fixtures are available.

## Owned Requirements

- Primary: OUT-001–OUT-005 and GAT-001–GAT-005 for Linux/shared and integrated automated readiness.
- Final Linux/security audit: all SCP, CMP, ARC, LOG, SEC, OPS, TST, SUP, WF, DEP, DCK, SAST, ART, VUL, ATT, REP, SRV, RUN, native-quality, and advisory requirements owned by Packets 01–18.
- Acceptance: every Linux/shared and CI-applicable portion of AC-AUT-001–AC-AUT-048; AC-MAN-001, Linux portion of AC-MAN-003, AC-MAN-005–AC-MAN-010.

## In Scope

- Full Linux native and TypeScript matrices from a clean validated test-output state.
- Linux Clang ASan/UBSan/analyzer/fuzz/TSan, focused GCC, exact ELF inspection, coverage reporting, and advisory fixtures/evidence.
- Immutable workflow/runner, dependency/signature, secret, Docker, CodeQL, package SBOM/vulnerability, attestation, evidence/redaction, and aggregate security-gate matrices.
- Read-only AC-MAN-006–AC-MAN-008 inspection of exact Linux/Windows candidate chains, GitHub-native attestation permissions, repository required-check/security reporting state, and absence of hosted third-party scanners.
- Supported-host worker/launcher/guard smoke behavior and descriptor/process baselines.
- Supported-host packaged-production native logging, strict `stderr` handling, scoped main-log retention, privacy-canary inspection, and `diagnostics/native-runtime.jsonl` archive validation.
- Fixing failures discovered by these gates within the already approved behavior and CI contracts, then rerunning all affected checks.
- Final inventory of every supported-host manual Windows command, expected binary, fixture, and case reserved for Packet 20, plus the hosted-runner/container evidence needed for AC-MAN-009 and AC-MAN-011 comparison.

## Out Of Scope

- Supported-host manual Windows execution and its host-only findings; new product behavior, dependency/base-image changes outside approved remediation, signing, qualification, release, publication, force-pushes, required-check mutation, or pull-request modification.
- Weakening/suppressing a check, increasing timeouts to hide a defect, or changing an approved contract to obtain a pass.

## Task Contract

1. Audit the final implementation map against all 39 selected source/CI/security/runner subjects, every active requirement ID, AC-AUT-001–AC-AUT-048, and AC-MAN-001–AC-MAN-011. Confirm no requirement was lost during packet decomposition.
2. Run the complete Linux/shared automated matrix, including native logging/schema/archive tests, ordinary native tests, non-recovering sanitizer proof/suites, path-sensitive analysis, all seven fuzz targets, TSan proof/suite, focused GCC, hardening fixtures/live ELF inspection, TypeScript contracts, and coverage reporting.
3. Perform AC-MAN-001 and AC-MAN-010 on supported Linux x64 with authorized synthetic/public fixture inputs: successful transcription, cancel-first, transcript-first nonfatal conflict with preserved transcript, warmed next request, oversized guard restart, graceful EOF shutdown, approved production native events, protocol-only `stdout`, prohibited-data absence, and exact native-runtime archive history.
4. Perform the Linux half of AC-MAN-003 on the exact optimized executables used by the smoke. Match bounded relative-role/SHA-256 reports to those binaries.
5. Perform AC-MAN-005 and confirm each gate used its locked profile, exact source set, bounded budget, and actual evidence kind.
6. Inspect descriptor counts, child/process ownership, native/main logs, diagnostics archive, reports, corpora, caches selected for upload, and retained evidence for leaks or sensitive content.
7. Run the complete repository/artifact security-control matrix: immutable-reference and runner policies, actionlint/zizmor, Dependency Review policy, npm audit/signatures, secret scanning, Hadolint/builder scan, three CodeQL databases, whole-app Linux/Windows SBOM and scans, primary/Fedora artifact smoke, attestations, evidence redaction, Scorecard policy, and every negative/unavailable proof.
8. Perform AC-MAN-006 and AC-MAN-007 by tracing and verifying exact Linux and Windows source → build → package/smoke → checksum → SBOM/scan → attestation identities and job permissions. Perform AC-MAN-008 by read-only inspection of required-check/security-reporting state; do not mutate repository settings.
9. Fix every Linux/shared or integrated security defect found within the approved contract, add/retain a focused regression, and rerun the failing gate plus every affected upstream/downstream check. If remediation needs a new product dependency, package target, public behavior, support change, vulnerability waiver, hosted service, or specification change, stop and return to specification.
10. Produce the exact Packet 20 supported-host manual run manifest: ordinary MSVC, dedicated MSVC ASan, MSVC analysis, Windows deterministic suites, native logging/schema/archive validation, handle baselines, PE outputs, smoke cases, and AC-MAN-009/AC-MAN-011 comparison inputs. Automated CI evidence may be referenced, but manual Windows cases remain unexecuted until Packet 20.

## Contracts And Boundaries

- Use validated temporary roots and exact fixture processes; do not remove user data or terminate ambient processes.
- Audio/transcripts remain private; evidence records classifications and outcomes, never contents.
- Passing this packet proves Linux supported-host/manual readiness plus complete automated two-runner and security evidence. It does not satisfy Packet 20's supported-host manual Windows evidence, AC-MAN-009, AC-MAN-011, or qualification.

## Expected Files Or Components

- Production/test/configuration/workflow/security files owned by Packets 01–18 only when a gate-discovered fix is required.
- `docs/specs/local-whisper-native-review-remediation/tasks/todo.md` and `handoff.md`.
- Read-only inspection of build outputs/reports; no generated binaries or reports are committed.

## Acceptance Criteria

- Every applicable Linux/shared/security AC-AUT case through AC-AUT-048 passes under its intended evidence class, platform, and locked profile.
- AC-MAN-001, Linux AC-MAN-003, AC-MAN-005, and AC-MAN-010 pass without abort, hang, busy loop, orphan, descriptor leak, sensitive output, protocol corruption, malformed retained native evidence, or lost committed transcript.
- Every gate-discovered defect has a focused regression and all affected checks pass after the fix.
- AC-MAN-006–AC-MAN-008 pass without identity gaps, excess attestation permissions, hosted scanner connections, or external-state mutation.
- The Packet 20 manual-manifest template and required command inventory are ready, and no hosted Windows Server or automated result is mislabeled as supported-desktop manual evidence. The real supported-host manifest is created only by Packet 20 on that host; Packet 19 cannot create or substitute it.
- Exclusions, privacy constraints, and no-release/no-qualification boundaries remain intact.

## Verification

Run the canonical Linux/shared/security completion commands introduced by Packets 01–18, including at minimum:

```text
npm run prepare:local-whisper:native-test-sources
npm run test:local-whisper:native-logging
npm run verify:local-whisper:worker-vectors -- --check-clean
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:supervisor
npm run test:local-whisper:diagnostics
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
npm run test:security:workflow-policy
npm run test:local-whisper:runner-policy
npm run test:security:repository-gates
npm run test:security:codeql-policy
npm run test:security:application-sbom
npm run test:security:artifact-vulnerability-policy
npm run test:security:attestation-policy
npm run test:security:evidence-policy
npm run test:security:aggregate-gates
npm run validate:workflows
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm run test
npm run build:prod
```

Use canonical command names established during implementation and update this packet if they differ before execution.

## Remote Completion Gate

1. Before the candidate or any fix commit, run every applicable local check. After local/supported-host Linux verification passes, leave Packet 19 unchecked, update `handoff.md`, stage only packet-owned paths, commit conventionally, and push without force.
2. Confirm CI launched for the exact candidate SHA. Require every selected final check to succeed: Quality Gates; immutable workflow/repository security; both native runner jobs; analyzers, CodeQL, sanitizers, fuzz, TSan, GCC and hardening; primary package/SBOM/scans; Ubuntu/Fedora/Windows artifact smoke; attestations; evidence proofs; fixture packaging; and all other required checks.
3. Every required Ubuntu 24.04 and Windows Server 2025 job must execute the complete final applicable native/C++ and security surface, including native logging/schema/archive validation. The Windows native and package/security chain must conclude `success`; no required Windows skip is acceptable. This does not replace Packet 20 manual Windows cases.
4. Fix packet-caused defects with focused regressions, rerun all applicable local checks before committing, push, and repeat the full exact-SHA gate. Record unrelated/out-of-scope failures as blockers.
5. After the candidate SHA passes, check Packet 19 and update `handoff.md`. Push a documentation-only completion commit and confirm CI launch without waiting for that documentation-only run.

## Failure And Rollback

- Keep Packet 19 unchecked until every Linux/shared/security gate passes. Record the exact requirement, acceptance ID, command, and bounded failure classification.
- Roll back only the gate-discovered fix and its regression if necessary; do not erase prior packet work or evidence.
- Never suppress a security finding or treat missing evidence as clean.

## Manual Gates

- **MANUAL GATE:** AC-MAN-001 requires a supported Linux x64 host and already authorized non-sensitive Local Whisper inputs.
- **MANUAL GATE:** Linux AC-MAN-003 and AC-MAN-005 require exact binary/profile evidence from that host.
- **MANUAL GATE:** AC-MAN-010 requires packaged-production Local Whisper lifecycle and diagnostics-archive inspection on the supported Linux host using only authorized non-sensitive inputs.
- **MANUAL GATE:** AC-MAN-006–AC-MAN-008 require read-only GitHub artifact/attestation/job-permission and repository-setting inspection. Any setting mutation requires separate authorization.
- No supported-host manual Windows execution, manual workflow dispatch, package, qualification, or release action is authorized. The packet's two required non-force PR-head pushes are part of the remote completion gate.

## References

- Entire approved specification, especially Sections 3–4 and 9–12.
- Packet-local handoff evidence from Packets 01–18.

## Completion And Handoff

- Record all Linux/shared/security results, fixes, exact ELF/artifact/attestation identities, native-runtime log/archive evidence, manual evidence, the Packet 20 manifest, candidate SHA, and successful final two-runner/security jobs in `handoff.md`.
- Check Packet 19 only after every local/manual Linux/security gate and the code-bearing exact-SHA remote gate pass with no required Windows skip.
- Set `Exact next packet: 20 — Windows Validation And Remediation Gate` and stop.
