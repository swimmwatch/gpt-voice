# 08 Cross-Platform Remediation Gate

## Outcome

The completed source is audited against every approved requirement, the full Linux and Windows automated matrices pass, supported-host smoke tests demonstrate the repaired runtime behavior, and exact-binary hardening evidence closes the merge and pre-qualification remediation gates without performing qualification or release work.

## Prerequisites

- Packets 01–07 are checked complete with their Linux and Windows evidence.
- This packet has separate execution authorization and no other packet is in progress.
- No production implementation change is expected. A discovered defect reopens its owning packet instead of being fixed opportunistically here.

## Owned Requirements

- Primary: OUT-001, GAT-001.
- Final audit: SCP-001, SCP-002, CMP-001, CMP-002, CMP-003, CMP-004, ARC-001, ARC-002, ARC-003, THR-001, INF-001, INF-002, CAN-001, CAN-002, CAN-003, FSG-001–FSG-006, LNX-001, CAP-001, CRY-001, ERR-001, FRM-001, BLD-001, SEC-001, SEC-002, OPS-001, TST-001, TST-002.
- Acceptance: AC-AUT-001–AC-AUT-016, AC-MAN-001, AC-MAN-002, AC-MAN-003.

## In Scope

- Requirement/file/test/decision traceability audit.
- Complete relevant native and TypeScript quality sets on Linux and Windows.
- Supported-host worker/launcher/guard smokes for both cancellation orderings, oversized guard restart, and closed-control shutdown.
- Exact optimized-binary ELF/PE report comparison to the binaries used by the smokes.
- Final `todo.md` and `handoff.md` state.

## Out Of Scope

- New remediation code, unrelated cleanup, task-plan restructuring, model qualification, performance qualification, installer/package production, signing, candidate freeze, release, publication, support-tier changes, or commits/pushes/PRs.
- Downloading private inputs, requesting credentials, using private audio/transcripts, or treating unavailable Windows evidence as a pass.

## Task Contract

1. Audit the final diff and source tree against all 13 selected review comments and every requirement ID. Confirm each behavior is implemented in the component owned by Packets 01–07 and each acceptance ID has an executable test or explicit manual procedure.
2. Audit exclusions:
   - no metadata-keyed digest cache;
   - the Windows CNG digest provider is still present and the digest-agreement test passes (CRY-001);
   - no unmeasured model-hash pass removal;
   - no Linux acknowledgment redesign;
   - no stale `MSG_CMSG_CLOEXEC` regression;
   - no new dependency, public IPC/API, setting, persisted schema, package target, generated artifact, qualification, or release action.
3. Run the complete Linux native/TypeScript remediation matrix from a clean test-output state without deleting user data or unrelated caches.
4. Run the equivalent Windows MSVC matrix on a supported Windows x64 host. Every packet-local Windows gate must be represented by an actual passing result, not source inspection.
5. Perform AC-MAN-001 on Linux using non-sensitive fixture/public test audio and an already authorized Local Whisper development/runtime input set:
   - one successful transcription;
   - cancel-first;
   - transcript-first with `OPERATION_CONFLICT` for cancel and preserved transcript;
   - a successful next request on the same warmed worker;
   - oversized guard fail-stop followed by fresh-guard success; and
   - graceful shutdown after permanent control EOF with no CPU spin or orphan.
6. Repeat the same observable matrix through Windows launcher, guard, handle transfer, wait, and worker paths for AC-MAN-002.
7. Run the dedicated hardening verifier against the exact optimized executables used by the host smokes. Record relative roles and SHA-256 values and prove they match the retained AC-MAN-003 reports. Do not retain binaries in the repository.
8. Inspect process resource baselines before/after the smokes. No leaked descriptor/handle, orphan process/job, raw exception, path, token, audio, or transcript may remain in output or logs.
9. If any check fails or any platform evidence is unavailable, leave Packet 08 unchecked, record the exact failing acceptance ID and owning packet in `handoff.md`, and stop. Reopen that packet through planning/implementation rather than patching here.

## Contracts And Boundaries

- Use validated temporary roots and exact fixture process ownership. No broad recursive cleanup, ambient process termination, or user artifact mutation.
- Manual transcripts/audio are sensitive; use only repository/public fixtures and do not persist transcript contents in evidence.
- Hardening reports contain relative roles, digests, and mitigation results only.
- Passing this packet means remediation readiness, not candidate freeze, platform qualification, production eligibility, or release approval.

## Expected Files Or Components

- `docs/specs/local-whisper-native-review-remediation/tasks/todo.md`
- `docs/specs/local-whisper-native-review-remediation/tasks/handoff.md`
- Read-only inspection of the final remediation diff, native build outputs, and test reports.
- No production source change is expected. A task-artifact correction may be made only to record accurate evidence/state.

## Acceptance Criteria

- Every active decision and specification requirement maps to a completed packet and passing Linux/Windows evidence.
- AC-AUT-001–AC-AUT-016 pass in their canonical suites on both applicable platforms.
- AC-MAN-001 and AC-MAN-002 demonstrate identical observable outcomes with no abort, hang, busy loop, orphan, leak, sensitive output, or lost committed transcript.
- AC-MAN-003 reports match the exact smoke-tested optimized binaries by SHA-256 and contain every required ELF/PE property.
- Items 1–8 of the source review are confirmed merge-ready; items 9–13 are confirmed complete before any future candidate freeze or qualification.
- The final tree contains no generated native build output or new dependency and makes no qualification/release claim.

## Verification

Linux x64 completion set:

```text
npm run prepare:local-whisper:native-test-sources
npm run verify:local-whisper:worker-vectors -- --check-clean
npm run format:check:local-whisper:worker-common
npm run lint:local-whisper:worker-common
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:whisper-cpp-cancellation
npm run test:local-whisper:supervisor
npm run test:local-whisper:coordinator
npm run format:check:local-whisper:fs-guard
npm run lint:local-whisper:fs-guard
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:filesystem
npm run format:check:local-whisper:launcher
npm run lint:local-whisper:launcher
npm run test:local-whisper:launcher:native
npm run verify:local-whisper:worker-authority -- --platform=linux
npm run test:local-whisper:native-sanitizer-proof
npm run test:local-whisper:native-hardening
npm run verify:local-whisper:native-hardening -- --platform=linux
npm run format:check
npm run lint
npm run typecheck
npm run test:types
```

Windows x64 completion set:

```text
npm run prepare:local-whisper:native-test-sources
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core -- --profile=windows-x64-cpu-msvc-19.39-v1
npm run test:local-whisper:whisper-cpp-cancellation -- --profile=windows-x64-cpu-msvc-19.39-v1
npm run test:local-whisper:supervisor
npm run test:local-whisper:coordinator
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:filesystem
npm run test:local-whisper:launcher:native
npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
npm run test:local-whisper:native-hardening
npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.39-v1
npm run verify:local-whisper:native-hardening -- --platform=windows
npm run format:check
npm run lint
npm run typecheck
npm run test:types
```

The hardening command is introduced by Packet 07. If its canonical spelling changes there, update this packet before executing it.

## Failure And Rollback

- This packet does not repair implementation failures. Identify the failing requirement/acceptance ID, uncheck or reopen its owner packet, update `handoff.md`, and stop.
- Do not weaken a check, suppress a warning, change a timeout, omit Windows, or edit evidence to obtain a pass.
- Task-state rollback consists only of restoring accurate unchecked status and handoff details; production rollback belongs to the owning packet.

## Manual Gates

- **MANUAL GATE:** AC-MAN-001 requires a supported Linux x64 host and already authorized non-sensitive Local Whisper runtime/model inputs.
- **MANUAL GATE:** AC-MAN-002 requires a supported Windows x64 host and real MSVC-built native executables.
- **MANUAL GATE:** AC-MAN-003 requires platform-appropriate binary inspection of the exact smoke-tested outputs.
- If inputs or hosts are unavailable, record a blocker. Do not request credentials, download private artifacts, push, dispatch workflows, package, sign, qualify, or publish.

## References

- Entire approved remediation specification, especially Sections 3, 10, 11, and 12.
- Packet-local handoff evidence from Packets 01–07.
- Source review selection document for final 13-item reconciliation.

## Completion And Handoff

- Check Packet 08 only after every automated and manual gate passes on both platforms.
- Update `handoff.md` with all completed packets, final changed-file scope, exact check summaries, binary evidence digests/locations, no blockers, and `Exact next packet: none`.
- Present remediation completion for review and stop. Do not commit, push, open a PR, freeze a candidate, qualify, package, or release.
