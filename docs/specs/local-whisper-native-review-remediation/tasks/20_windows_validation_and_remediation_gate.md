# 20 Windows Validation And Remediation Gate

## Outcome

One final Windows x64 packet performs the separate supported-host manual validation package, including real execution of the existing CUDA 12.8.1 / MSVC 19.39 / `sm_120a-real` profile on the RTX 5090, compares it with the fixed hosted-runner/container matrix, reruns the complete affected Windows native/security surface, fixes every Windows or cross-platform defect it reveals, revalidates affected Linux/shared behavior, and closes the remediation workstream without qualification or release work.

## Prerequisites

- Packets 01–19 are checked complete and every code-bearing Packet 04–19 required Windows Server 2025 native/package/artifact-security job executed successfully without skips.
- This packet has separate execution authorization and no other packet is in progress.
- A supported Windows x64 host with the pinned ordinary MSVC 19.51/SDK toolchain, the separate pinned MSVC 19.39 and CUDA 12.8.1 toolchain, an RTX 5090 compatible with `120a-real`, verified native inputs, and authorized non-sensitive smoke fixtures is available.
- A supported Linux verification path is available for any shared code changed while fixing a Windows finding.

## Owned Requirements

- Primary: final completion of OUT-001–OUT-005, GAT-001–GAT-005, CMP-001, CMP-004–CMP-012, LOG-001–LOG-008, WIN-001–WIN-002, RUN-001–RUN-007, and all Windows-applicable TST requirements.
- Final supported-host/manual Windows evidence: every Windows-applicable behavior, native-quality, structured-logging/archive, package-security, attestation, privacy, and operations requirement from Packets 01–19.
- Acceptance: all Windows-applicable portions of AC-AUT-001–AC-AUT-048; AC-MAN-002, Windows portion of AC-MAN-003, AC-MAN-004, AC-MAN-009, and AC-MAN-011. Linux-only instrumentation remains audited and is never relabeled as Windows coverage.

## In Scope

- Real ordinary and dedicated-ASan MSVC builds/tests for common, filesystem guard, launcher, and project-owned worker targets.
- Preservation of the executable ordinary Windows and CPU profile contract on MSVC 19.51, including hosted-toolchain validation, scripts, workflows, tests, and bounded evidence.
- Real supported-desktop build, deterministic runtime-pack production, optimized-PE inspection, authenticated development activation, and worker/application execution for `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1` on the RTX 5090. Hosted CUDA evidence remains contract-only and AMD Vulkan remains contract-only.
- Real MSVC analysis over the complete Windows source manifests.
- The complete Windows deterministic behavior, handle/resource baseline, exact `LIST`, CNG digest-agreement, process/Job Object, worker race, typed-failure, and frame-boundary suites on the supported host.
- Exact optimized PE inspection and supported-host Windows worker/launcher/guard smoke.
- Packaged-production native log-level selection, worker/launcher/guard JSONL output, strict supervisor forwarding, privacy canaries, current/rotated main-log retention, and ZIP `diagnostics/native-runtime.jsonl` export on the supported Windows host.
- Read-only comparison of the supported Windows desktop host with Windows Server 2025, Ubuntu 24.04, and Fedora 44 records, including exact toolchains, source manifests, package/artifact identities, and claim boundaries.
- Fixing every Windows or shared defect discovered here, retaining focused regressions, and rerunning affected Windows and Linux/shared gates.
- Final platform-truthful coverage report, checklist, and handoff closure.

## Out Of Scope

- `clang-cl`, Windows clang-tidy, Windows UBSan/LeakSanitizer/TSan claims, a CUDA/AMD dependency or compiler-profile migration, any CUDA target other than the existing `120a-real` profile, unsupported host-compiler overrides, signing work, candidate qualification, release, publication, force-pushes, or pull-request modification.
- Treating source review, cross-compilation, contract-only checks, PE fixtures, or unavailable Windows evidence as a pass.

## Task Contract

1. Before any Windows validation command, create the exact supported-host manual run manifest in `handoff.md` from observations made on this host. Record the candidate commit SHA, timestamp with timezone, Windows edition/build, architecture, MSVC and Windows SDK versions, Node and Git versions, native source-lock identities, selected CPU/CUDA profile, authorized synthetic fixture identifiers, and the complete Packet 20 command inventory. Record only bounded classifications, versions, identifiers, and digests: never usernames, paths, environment values, credentials, audio, transcripts, or raw command output. Reject missing, duplicate, unexpected, wrong-profile, stale-candidate, or contract-only substitutions. This setup record establishes provenance only; it is not a passing manual result.
2. Keep the executable ordinary Windows and CPU semantic profile on MSVC 19.51 across the profile lock, native-quality profile IDs, build/verification scripts, hosted-toolchain initialization, workflow commands, documentation, and focused tests. Require compiler version `19.51` before executing ordinary Windows evidence. Derive the private execution candidate by hashing the exact prepared compiler, linker, archiver, PE inspector, CMake, Ninja, Windows SDK library, and locked VC Runtime DLL inputs used by the run. Use either the exact locked VC Runtime installer or the explicit installed-runtime proof with exact registry, DLL digest, Authenticode, and current locked-license checks.
3. Independently materialize and verify the existing CUDA execution profile `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1`. Hash the exact MSVC 19.39 compiler/linker/archiver/PE inspector, CUDA 12.8.1 compiler and runtime DLLs, CMake, Ninja, Windows SDK, and locked VC Runtime bytes. Build and stage the CUDA worker/runtime twice from independent validated roots, require deterministic archive and manifest identities, verify `120a-real` generated-code evidence and complete DLL closure, and reject MSVC 19.51, another CUDA version, another compute target, ambient lookup, or an unsupported host-compiler override. AMD Vulkan remains contract-only.
4. Run the ordinary MSVC 19.51 component commands recorded in **Verification** for every common, guard, launcher, and worker Windows manifest source.
5. Run the dedicated MSVC ASan component commands recorded in **Verification** for every supported target. Confirm `/RTC1` is absent, unsupported sanitizer options are absent, the injected ASan proof fails, and normal suites pass. This lane remains MSVC 19.51 and is not replaced by CUDA execution.
6. Run the MSVC `/analyze` component commands recorded in **Verification**, with warnings as errors over every Windows-owned translation unit, and prove the supported bad fixture is detected. This lane remains MSVC 19.51.
7. Run every applicable behavior suite from Packets 01–07 on the supported Windows host, including handle-count baselines and the deliberately unwrapped-resource visibility proof in AC-AUT-024.
8. Build optimized MSVC executables and run the dedicated hardening verifier on the exact filesystem guard/model launcher, launcher, CPU worker, and CUDA worker outputs. Confirm CFG, stack cookie, dynamic base, NX, and high-entropy VA from live PE evidence.
9. Extend the existing authenticated non-packaged Windows development activation to admit the exact CPU and CUDA runtime set. Through the ordinary app graph, install or reuse the authenticated CUDA runtime and pinned public smoke model, select the exact RTX 5090, prove compatibility, load, warm up, transcribe the authorized public WAV, cancel one request, unload, restart offline, reuse without transfer, and clean up the worker/allocation. A CUDA failure remains a safe Not ready result and SHALL NOT fall back to CPU, another GPU, another runtime, or another model.
10. Perform AC-MAN-002, AC-MAN-004, and AC-MAN-011 on supported Windows x64 for the amended CPU and CUDA scope. Perform the Windows half of AC-MAN-003 against the exact smoke-tested CPU and CUDA binaries and match their SHA-256 values. Confirm approved production native events, protocol-only `stdout`, prohibited-data absence, failure containment, exact bounded native-runtime archive history, and no CUDA resource remaining after unload/shutdown.
11. Perform AC-MAN-009: compare one complete affected-change and exact-candidate run across Ubuntu 24.04, Windows Server 2025, and Fedora 44 with the supported Linux and Windows desktop manual evidence. Confirm hosted servers/containers do not broaden desktop/distribution qualification claims or substitute for AC-MAN-011 or the supported-desktop CUDA execution.
12. Fix every discovered Windows or shared defect within the approved contract, retain a focused regression, then rerun the failing Windows gate and all affected downstream gates. For shared-source changes, rerun the affected Linux/shared/security commands from Packet 18 before completion.
13. Generate the final native and security coverage summaries from completed Linux and Windows evidence. Distinguish host, container, desktop, CPU, CUDA, compile, execute, analyze, CodeQL, sanitize, fuzz, TSan, binary inspection, package smoke, SBOM/scan, and attestation without cross-platform or cross-environment substitution. Audit all 39 selected subjects, all requirements, exclusions, privacy controls, AC-AUT-001–AC-AUT-048, and AC-MAN-001–AC-MAN-011. Missing evidence leaves this packet unchecked.

## Contracts And Boundaries

- Use validated temporary roots and exact Job Object/process ownership. Never clean broad user directories or terminate ambient processes.
- Reports contain only bounded classifications, relative roles, profiles, digests, and mitigation names; never audio, transcripts, model content, paths, handles, tokens, credentials, or raw exceptions.
- Passing means remediation readiness only, not candidate freeze, qualification, signing, publication, or release approval.
- A version banner without readable executable bytes is not a pinned tool identity. An unreadable prepared input fails closed; do not substitute a known archive digest, a version-only claim, another copy, or a contract-only check.
- CUDA evidence is accepted only from the supported RTX 5090 desktop with the exact existing profile and is supplementary to, never a replacement for, the ordinary MSVC 19.51 evidence. It creates no Task 21 qualification or Production claim.

## Expected Files Or Components

- Production/test/configuration/security files owned by Packets 01–19 only when a Windows-discovered fix is required.
- Windows workflow/profile/manifest/package/security/reporting components introduced by Packets 08–19.
- `runtime/local-whisper/toolchains/profiles/windows-x64-cpu-msvc-19.51-v1.json` and all executable-profile consumers; the superseded CPU MSVC 19.39 profile is removed only after the new ID is exact and fully referenced.
- `runtime/local-whisper/toolchains/profiles/windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1.json`, CUDA build/stage/pack/audit consumers, and the authenticated development runtime/descriptor path, changed only where a real Windows CUDA execution defect or the prior CPU-only regression requires it.
- `docs/specs/local-whisper-native-review-remediation/tasks/todo.md` and `handoff.md`.
- Read-only exact build outputs and reports; generated binaries/reports are not committed.

## Acceptance Criteria

- Every ordinary final Windows suite executes on supported Windows x64 with pinned MSVC 19.51 and passes; the existing CUDA profile separately builds and executes with exact MSVC 19.39, CUDA 12.8.1, `120a-real`, and RTX 5090 identity. No hosted contract-only accelerator profile, skipped remote job, CPU fallback, or Linux result substitutes for either lane.
- Ordinary, MSVC-analysis, and dedicated-ASan manifests cover every applicable Windows-owned source, and all injected bad fixtures fail their gates.
- AC-MAN-002, Windows AC-MAN-003, AC-MAN-004, and AC-MAN-011 pass with no abort, hang, busy loop, orphan job/process, handle leak, sensitive output, protocol corruption, malformed retained native evidence, or lost committed transcript.
- Live optimized PE outputs, including the exact CUDA worker, pass every applicable BLD-001 property and report digests match the smoke-tested binaries.
- Every Windows-discovered fix has a focused regression and affected Windows plus Linux/shared checks pass afterward.
- Final coverage reporting is platform-truthful, the tree contains no generated build output, and no product runtime dependency was added.
- AC-MAN-009 identifies every hosted runner/container/toolchain/artifact exactly and distinguishes that evidence from supported Linux/Windows desktop verification.

## Verification

Run the canonical Windows completion commands established by Packets 01–19, including at minimum:

```text
npm run prepare:local-whisper:native-test-sources
npm run test:local-whisper:native-logging
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core -- --profile=windows-x64-cpu-msvc-19.51-v1
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
npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.51-v1 --skip-runtime-pack
Remove-Item Env:LOCAL_WHISPER_MSVC_ANALYZE
# MSVC AddressSanitizer lane
npm run test:local-whisper:fs-guard:msvc-asan
npm run test:local-whisper:launcher:msvc-asan
npm run test:local-whisper:worker-codec:msvc-asan
npm run test:local-whisper:whisper-cpp:msvc-asan
npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
npm run verify:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.51-v1 --contract-only
npm run verify:local-whisper:whisper-cpp-cuda -- --profile=windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1 --contract-only
npm run build:local-whisper:whisper-cpp-cuda -- --profile=windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1
npm run verify:local-whisper:whisper-cpp-cuda -- --profile=windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1
npm run produce:local-whisper:windows-runtime-pack:cuda
npm run test:local-whisper:whisper-cpp-cuda-integration
npm run audit:local-whisper:whisper-cpp-pack
npm run test:local-whisper:development
npm run test:local-whisper:native-hardening
npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.51-v1
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

`--contract-only` remains supplementary and cannot satisfy executable handle, process, worker, CUDA, or native-log evidence. Before execution, materialize these exact commands and their required prepared roots in the private supported-host run manifest; do not silently substitute commands. Use the final canonical command names recorded by Packets 14–19.

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
- **MANUAL GATE:** the amended CUDA scope requires the exact CUDA 12.8.1 and MSVC 19.39 inputs, the physical RTX 5090, deterministic CUDA runtime-pack production, exact optimized CUDA-worker PE inspection, and the bounded ordinary-app CUDA lifecycle. Public model/audio acquisition remains limited to the already authorized pinned smoke fixtures; do not retain their contents or output.
- If the Windows host or any required evidence is unavailable, record a blocker. The packet's two non-force PR-head pushes are required; manual workflow dispatch, package, signing, qualification, publication, and release remain unauthorized.

## References

- Entire approved specification, especially Sections 4, 9–12.
- Packet 19's Linux/shared/security evidence and the supported-host manual manifest created as Packet 20 step 1.
- Planning decisions `plan.packet-platform-slicing` revision 3 and `plan.windows-job-skip-policy` revision 1.

## Completion And Handoff

- Check Packet 20 only after every supported-host Windows CPU and CUDA, affected Linux/shared/security, automated, manual, and code-bearing candidate-SHA gate passes with no required Windows skip.
- Update `handoff.md` with completed packets, final changed-file scope, exact check summaries, binary evidence locations/digests, no blockers, and `Exact next packet: none`.
- Present remediation completion for review and stop. The Packet 20 candidate must be green and the documentation-only completion commit must be pushed with CI launch confirmed; do not open or modify a PR, freeze, qualify, sign, publish, or release.
