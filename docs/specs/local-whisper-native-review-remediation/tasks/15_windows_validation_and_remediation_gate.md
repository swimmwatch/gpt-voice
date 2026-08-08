# 15 Windows Validation And Remediation Gate

## Outcome

One final Windows x64 packet runs every deferred ordinary MSVC, dedicated MSVC ASan, MSVC analysis, deterministic native, resource-balance, PE hardening, and supported-host smoke gate; fixes every Windows or cross-platform defect it reveals; revalidates affected Linux/shared behavior; and closes the remediation workstream without qualification or release work.

## Prerequisites

- Packets 01–14 are checked complete and `handoff.md` contains the exact deferred Windows run manifest.
- This packet has separate execution authorization and no other packet is in progress.
- A supported Windows x64 host with the pinned MSVC 19.39/SDK toolchain, verified native inputs, and authorized non-sensitive smoke fixtures is available.
- A supported Linux verification path is available for any shared code changed while fixing a Windows finding.

## Owned Requirements

- Primary: completion of CMP-001, CMP-004–CMP-006, WIN-001, WIN-002, TST-001–TST-003, TST-006, TST-007, OUT-001, OUT-002, GAT-001, and GAT-002.
- Deferred Windows evidence: every Windows-applicable behavior and CI requirement from Packets 01–09 plus SEC-001–SEC-004 and OPS-001–OPS-003.
- Acceptance: all Windows-applicable portions of AC-AUT-001–AC-AUT-020 and AC-AUT-024–AC-AUT-025; AC-MAN-002, Windows portion of AC-MAN-003, and AC-MAN-004. AC-AUT-021–AC-AUT-023 remain Linux-only evidence and are audited, not relabeled as Windows instrumentation.

## In Scope

- Real ordinary and dedicated-ASan MSVC builds/tests for common, filesystem guard, launcher, and project-owned worker targets.
- Real MSVC analysis over the complete Windows source manifests.
- All deferred Windows deterministic behavior, handle/resource baseline, exact `LIST`, CNG digest-agreement, process/Job Object, worker race, typed-failure, and frame-boundary suites.
- Exact optimized PE inspection and supported-host Windows worker/launcher/guard smoke.
- Fixing every Windows or shared defect discovered here, retaining focused regressions, and rerunning affected Windows and Linux/shared gates.
- Final platform-truthful coverage report, checklist, and handoff closure.

## Out Of Scope

- `clang-cl`, Windows clang-tidy, Windows UBSan/LeakSanitizer/TSan claims, dependency changes, package/signing work, candidate qualification, release, publication, commits, pushes, or PRs.
- Treating source review, cross-compilation, contract-only checks, PE fixtures, or unavailable Windows evidence as a pass.

## Task Contract

1. Materialize the exact deferred manifest from Packet 14 and reject missing, duplicate, unexpected, wrong-profile, or contract-only substitutions.
2. Run ordinary MSVC 19.39 builds and project-owned tests for every common, guard, launcher, and worker Windows manifest source.
3. Run the dedicated MSVC ASan configurations for every supported target. Confirm `/RTC1` is absent, unsupported sanitizer options are absent, the injected ASan proof fails, and normal suites pass.
4. Run MSVC analysis with warnings as errors over every Windows-owned translation unit and prove the supported bad fixture is detected.
5. Run every deferred behavior suite from Packets 01–07, including handle-count baselines and the deliberately unwrapped-resource visibility proof in AC-AUT-024.
6. Build optimized MSVC executables and run the dedicated hardening verifier on the exact filesystem guard/model launcher, launcher, and CPU worker outputs. Confirm CFG, stack cookie, dynamic base, NX, and high-entropy VA from live PE evidence.
7. Perform AC-MAN-002 and AC-MAN-004 on supported Windows x64. Perform the Windows half of AC-MAN-003 against the exact smoke-tested binaries and match their SHA-256 values.
8. Fix every discovered Windows or shared defect within the approved contract, retain a focused regression, then rerun the failing Windows gate and all affected downstream gates. For shared-source changes, rerun the affected Linux/shared commands from Packet 14 before completion.
9. Generate AC-AUT-025 from completed Linux and Windows evidence. It must distinguish compile, execute, analyze, sanitize, fuzz, TSan, contract inspection, and binary inspection without overclaiming Linux-only instrumentation.
10. Audit all 23 selected comments, all requirements, exclusions, privacy controls, and acceptance IDs. Missing evidence leaves this packet unchecked.

## Contracts And Boundaries

- Use validated temporary roots and exact Job Object/process ownership. Never clean broad user directories or terminate ambient processes.
- Reports contain only bounded classifications, relative roles, profiles, digests, and mitigation names; never audio, transcripts, model content, paths, handles, tokens, credentials, or raw exceptions.
- Passing means remediation readiness only, not candidate freeze, qualification, package production, or release approval.

## Expected Files Or Components

- Production/test/configuration files owned by Packets 01–09 only when a Windows-discovered fix is required.
- Windows workflow/profile/manifest/reporting components introduced by Packets 08–09.
- `docs/specs/local-whisper-native-review-remediation/tasks/todo.md` and `handoff.md`.
- Read-only exact build outputs and reports; generated binaries/reports are not committed.

## Acceptance Criteria

- Every deferred Windows suite executes on real Windows x64 with pinned MSVC and passes; no contract-only or Linux result substitutes for it.
- Ordinary, MSVC-analysis, and dedicated-ASan manifests cover every applicable Windows-owned source, and all injected bad fixtures fail their gates.
- AC-MAN-002, Windows AC-MAN-003, and AC-MAN-004 pass with no abort, hang, busy loop, orphan job/process, handle leak, sensitive output, or lost committed transcript.
- Live optimized PE outputs pass every BLD-001 property and report digests match the smoke-tested binaries.
- Every Windows-discovered fix has a focused regression and affected Windows plus Linux/shared checks pass afterward.
- AC-AUT-025 truthfully reports final cross-platform evidence and the tree contains no generated output or new dependency.

## Verification

Run the canonical Windows completion commands established by Packets 01–09, including at minimum:

```text
npm run prepare:local-whisper:native-test-sources
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core -- --profile=windows-x64-cpu-msvc-19.39-v1
npm run test:local-whisper:supervisor
npm run test:local-whisper:coordinator
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:filesystem
npm run test:local-whisper:launcher:native
npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
npm run test:local-whisper:native-windows
npm run test:local-whisper:native-windows-asan
npm run test:local-whisper:native-windows-analysis
npm run test:local-whisper:native-hardening
npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.39-v1
npm run verify:local-whisper:native-hardening -- --platform=windows
npm run test:local-whisper:native-build-audits
npm run typecheck
npm run test:types
```

`--contract-only` remains supplementary and cannot satisfy executable handle, process, or worker evidence. Use the final canonical command names recorded by Packet 14.

## Failure And Rollback

- Keep Packet 15 unchecked until all real Windows, affected Linux/shared, and manual gates pass. Record the exact requirement, acceptance ID, manifest source, command, and bounded failure classification.
- Never weaken a warning, sanitizer, analyzer, hardening, resource, or privacy check to obtain a pass.
- If a finding requires a new dependency, protocol/public behavior change, platform support change, or other specification revision, stop and return to specification.

## Manual Gates

- **MANUAL GATE:** AC-MAN-002 requires supported Windows x64 and real MSVC-built native executables.
- **MANUAL GATE:** Windows AC-MAN-003 requires live PE inspection of the exact smoke-tested optimized outputs.
- **MANUAL GATE:** AC-MAN-004 requires one complete ordinary-MSVC, MSVC-analysis, and dedicated-MSVC-ASan run over all four project manifests.
- If the Windows host or any required evidence is unavailable, record a blocker. No workflow dispatch, push, package, signing, qualification, publication, or release is authorized by this packet.

## References

- Entire approved specification, especially Sections 4, 9–12.
- Packet 14's exact deferred Windows manifest and Linux/shared evidence.
- Planning decision `plan.packet-platform-slicing` revision 2.

## Completion And Handoff

- Check Packet 15 only after every Windows, affected Linux/shared, automated, and manual gate passes.
- Update `handoff.md` with completed packets, final changed-file scope, exact check summaries, binary evidence locations/digests, no blockers, and `Exact next packet: none`.
- Present remediation completion for review and stop. Do not commit, push, open a PR, freeze a candidate, qualify, package, or release.
