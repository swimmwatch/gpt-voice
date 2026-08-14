# 20 Windows Validation And Remediation Gate

## Outcome

One final Windows x64 packet performs the separate supported-host manual validation package, compares it with the fixed hosted-runner/container matrix, reruns the complete Windows native/security surface, fixes every Windows or cross-platform defect it reveals, revalidates affected Linux/shared behavior, and closes the remediation workstream without qualification or release work.

## Prerequisites

- Packets 01–19 are checked complete and every code-bearing Packet 04–19 required Windows Server 2025 native/package/artifact-security job executed successfully without skips.
- This packet has separate execution authorization and no other packet is in progress.
- A supported Windows x64 host with the pinned MSVC 19.39/SDK toolchain, verified native inputs, and authorized non-sensitive smoke fixtures is available.
- A supported Linux verification path is available for any shared code changed while fixing a Windows finding.

## Owned Requirements

- Primary: final completion of OUT-001–OUT-005, GAT-001–GAT-005, CMP-001, CMP-004–CMP-012, LOG-001–LOG-008, WIN-001–WIN-002, RUN-001–RUN-007, and all Windows-applicable TST requirements.
- Final supported-host/manual Windows evidence: every Windows-applicable behavior, native-quality, structured-logging/archive, package-security, attestation, privacy, and operations requirement from Packets 01–19.
- Acceptance: all Windows-applicable portions of AC-AUT-001–AC-AUT-048; AC-MAN-002, Windows portion of AC-MAN-003, AC-MAN-004, AC-MAN-009, and AC-MAN-011. Linux-only instrumentation remains audited and is never relabeled as Windows coverage.

## In Scope

- Real ordinary and dedicated-ASan MSVC builds/tests for common, filesystem guard, launcher, and project-owned worker targets.
- Real MSVC analysis over the complete Windows source manifests.
- The complete Windows deterministic behavior, handle/resource baseline, exact `LIST`, CNG digest-agreement, process/Job Object, worker race, typed-failure, and frame-boundary suites on the supported host.
- Exact optimized PE inspection and supported-host Windows worker/launcher/guard smoke.
- Packaged-production native log-level selection, worker/launcher/guard JSONL output, strict supervisor forwarding, privacy canaries, current/rotated main-log retention, and ZIP `diagnostics/native-runtime.jsonl` export on the supported Windows host.
- Read-only comparison of the supported Windows desktop host with Windows Server 2025, Ubuntu 24.04, and Fedora 44 records, including exact toolchains, source manifests, package/artifact identities, and claim boundaries.
- Fixing every Windows or shared defect discovered here, retaining focused regressions, and rerunning affected Windows and Linux/shared gates.
- Final platform-truthful coverage report, checklist, and handoff closure.

## Out Of Scope

- `clang-cl`, Windows clang-tidy, Windows UBSan/LeakSanitizer/TSan claims, dependency changes, package/signing work, candidate qualification, release, publication, force-pushes, or pull-request modification.
- Treating source review, cross-compilation, contract-only checks, PE fixtures, or unavailable Windows evidence as a pass.

## Task Contract

1. Before any Windows validation command, create the exact supported-host manual run manifest in `handoff.md` from observations made on this host. Record the candidate commit SHA, timestamp with timezone, Windows edition/build, architecture, MSVC and Windows SDK versions, Node and Git versions, native source-lock identities, selected CPU/CUDA profile, authorized synthetic fixture identifiers, and the complete Packet 20 command inventory. Record only bounded classifications, versions, identifiers, and digests: never usernames, paths, environment values, credentials, audio, transcripts, or raw command output. Reject missing, duplicate, unexpected, wrong-profile, stale-candidate, or contract-only substitutions. This setup record establishes provenance only; it is not a passing manual result.
2. Run the ordinary MSVC 19.39 component commands recorded in **Verification** for every common, guard, launcher, and worker Windows manifest source.
3. Run the dedicated MSVC ASan component commands recorded in **Verification** for every supported target. Confirm `/RTC1` is absent, unsupported sanitizer options are absent, the injected ASan proof fails, and normal suites pass.
4. Run the MSVC `/analyze` component commands recorded in **Verification**, with warnings as errors over every Windows-owned translation unit, and prove the supported bad fixture is detected.
5. Run every applicable behavior suite from Packets 01–07 on the supported Windows host, including handle-count baselines and the deliberately unwrapped-resource visibility proof in AC-AUT-024.
6. Build optimized MSVC executables and run the dedicated hardening verifier on the exact filesystem guard/model launcher, launcher, and CPU worker outputs. Confirm CFG, stack cookie, dynamic base, NX, and high-entropy VA from live PE evidence.
7. Perform AC-MAN-002, AC-MAN-004, and AC-MAN-011 on supported Windows x64. Perform the Windows half of AC-MAN-003 against the exact smoke-tested binaries and match their SHA-256 values. Confirm approved production native events, protocol-only `stdout`, prohibited-data absence, failure containment, and exact bounded native-runtime archive history.
8. Perform AC-MAN-009: compare one complete affected-change and exact-candidate run across Ubuntu 24.04, Windows Server 2025, and Fedora 44 with the supported Linux and Windows desktop manual evidence. Confirm hosted servers/containers do not broaden desktop/distribution qualification claims or substitute for AC-MAN-011.
9. Fix every discovered Windows or shared defect within the approved contract, retain a focused regression, then rerun the failing Windows gate and all affected downstream gates. For shared-source changes, rerun the affected Linux/shared/security commands from Packet 18 before completion.
10. Generate the final native and security coverage summaries from completed Linux and Windows evidence. Distinguish host, container, desktop, compile, execute, analyze, CodeQL, sanitize, fuzz, TSan, binary inspection, package smoke, SBOM/scan, and attestation without cross-platform or cross-environment substitution.
11. Audit all 39 selected subjects, all requirements, exclusions, privacy controls, AC-AUT-001–AC-AUT-048, and AC-MAN-001–AC-MAN-011. Missing evidence leaves this packet unchecked.

## Contracts And Boundaries

- Use validated temporary roots and exact Job Object/process ownership. Never clean broad user directories or terminate ambient processes.
- Reports contain only bounded classifications, relative roles, profiles, digests, and mitigation names; never audio, transcripts, model content, paths, handles, tokens, credentials, or raw exceptions.
- Passing means remediation readiness only, not candidate freeze, qualification, signing, publication, or release approval.

## Expected Files Or Components

- Production/test/configuration/security files owned by Packets 01–19 only when a Windows-discovered fix is required.
- Windows workflow/profile/manifest/package/security/reporting components introduced by Packets 08–19.
- `docs/specs/local-whisper-native-review-remediation/tasks/todo.md` and `handoff.md`.
- Read-only exact build outputs and reports; generated binaries/reports are not committed.

## Acceptance Criteria

- Every final Windows suite executes on supported Windows x64 with pinned MSVC and passes; no contract-only, skipped remote job, or Linux result substitutes for it.
- Ordinary, MSVC-analysis, and dedicated-ASan manifests cover every applicable Windows-owned source, and all injected bad fixtures fail their gates.
- AC-MAN-002, Windows AC-MAN-003, AC-MAN-004, and AC-MAN-011 pass with no abort, hang, busy loop, orphan job/process, handle leak, sensitive output, protocol corruption, malformed retained native evidence, or lost committed transcript.
- Live optimized PE outputs pass every BLD-001 property and report digests match the smoke-tested binaries.
- Every Windows-discovered fix has a focused regression and affected Windows plus Linux/shared checks pass afterward.
- Final coverage reporting is platform-truthful, the tree contains no generated build output, and no product runtime dependency was added.
- AC-MAN-009 identifies every hosted runner/container/toolchain/artifact exactly and distinguishes that evidence from supported Linux/Windows desktop verification.

## Verification

Run the canonical Windows completion commands established by Packets 01–19, including at minimum:

```text
npm run prepare:local-whisper:native-test-sources
npm run test:local-whisper:native-logging
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core -- --profile=windows-x64-cpu-msvc-19.39-v1
npm run test:local-whisper:supervisor
npm run test:local-whisper:diagnostics
npm run test:local-whisper:coordinator
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:filesystem
npm run test:local-whisper:launcher:native
npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
# MSVC /analyze lane (PowerShell)
$env:LOCAL_WHISPER_MSVC_ANALYZE = 'true'
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:launcher:native
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core
npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.39-v1 --skip-runtime-pack
Remove-Item Env:LOCAL_WHISPER_MSVC_ANALYZE
# MSVC AddressSanitizer lane
npm run test:local-whisper:fs-guard:msvc-asan
npm run test:local-whisper:launcher:msvc-asan
npm run test:local-whisper:worker-codec:msvc-asan
npm run test:local-whisper:whisper-cpp:msvc-asan
npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
npm run verify:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.39-v1 --contract-only
npm run test:local-whisper:native-hardening
npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.39-v1
npm run verify:local-whisper:native-hardening -- --platform=windows
npm run test:local-whisper:native-build-audits
npm run test:local-whisper:runner-policy
npm run test:security:codeql-policy
npm run test:security:application-sbom
npm run test:security:artifact-vulnerability-policy
npm run test:security:attestation-policy
npm run test:security:evidence-policy
npm run test:security:aggregate-gates
npm run validate:workflows
npm run typecheck
npm run test:types
```

`--contract-only` remains supplementary and cannot satisfy executable handle, process, worker, or native-log evidence. Use the final canonical command names recorded by Packets 14–19.

## Remote Completion Gate

1. Before the candidate or any fix commit, run every applicable supported-host Windows and affected Linux/shared/security check. Leave Packet 20 unchecked, update `handoff.md`, stage only packet-owned paths, commit conventionally, and push without force.
2. Confirm CI launched for the exact candidate SHA. Require every final selected check to succeed, including Quality Gates; immutable workflow/repository security; both native runners; analyzers, CodeQL, sanitizers, fuzz, TSan, GCC and hardening; Linux/Windows package security and smoke; attestations; evidence proofs; fixture packaging; and every workstream-required job.
3. Every required Linux and Windows native/C++ and security job must execute its complete final manifest. Windows Server 2025 and the Windows artifact-security chain must conclude `success`; no required Windows skip is acceptable.
4. Fix packet-caused or manual-Windows-discovered failures with focused regressions, rerun all applicable local checks before committing, push, and repeat the full exact-SHA remote gate. Record unrelated/out-of-scope failures as blockers.
5. After the candidate SHA passes, check Packet 20 and update `handoff.md`. Push the documentation-only completion record and confirm CI launch; the workstream may close without waiting for that documentation-only run to finish.

## Failure And Rollback

- Keep Packet 20 unchecked until all real Windows, affected Linux/shared/security, and manual gates pass. Record the exact requirement, acceptance ID, manifest source, command, and bounded failure classification.
- Never weaken a warning, sanitizer, analyzer, hardening, resource, or privacy check to obtain a pass.
- If a finding requires a new dependency, protocol/public behavior change, platform support change, or other specification revision, stop and return to specification.

## Manual Gates

- **MANUAL GATE:** AC-MAN-002 requires supported Windows x64 and real MSVC-built native executables.
- **MANUAL GATE:** Windows AC-MAN-003 requires live PE inspection of the exact smoke-tested optimized outputs.
- **MANUAL GATE:** AC-MAN-004 requires one complete ordinary-MSVC, MSVC-analysis, and dedicated-MSVC-ASan run over all four project manifests.
- **MANUAL GATE:** AC-MAN-009 requires read-only comparison of the exact Ubuntu 24.04 and Windows Server 2025 records, Fedora container evidence, and supported Linux/Windows desktop evidence.
- **MANUAL GATE:** AC-MAN-011 requires packaged-production Local Whisper lifecycle, native/main-log inspection, privacy canaries, and diagnostics-archive validation on the supported Windows host.
- If the Windows host or any required evidence is unavailable, record a blocker. The packet's two non-force PR-head pushes are required; manual workflow dispatch, package, signing, qualification, publication, and release remain unauthorized.

## References

- Entire approved specification, especially Sections 4, 9–12.
- Packet 19's Linux/shared/security evidence and the supported-host manual manifest created as Packet 20 step 1.
- Planning decisions `plan.packet-platform-slicing` revision 3 and `plan.windows-job-skip-policy` revision 1.

## Completion And Handoff

- Check Packet 20 only after every supported-host Windows, affected Linux/shared/security, automated, manual, and code-bearing candidate-SHA gate passes with no required Windows skip.
- Update `handoff.md` with completed packets, final changed-file scope, exact check summaries, binary evidence locations/digests, no blockers, and `Exact next packet: none`.
- Present remediation completion for review and stop. The Packet 20 candidate must be green and the documentation-only completion commit must be pushed with CI launch confirmed; do not open or modify a PR, freeze, qualify, sign, publish, or release.
