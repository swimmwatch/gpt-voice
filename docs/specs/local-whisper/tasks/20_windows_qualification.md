# Task 20: Windows Qualification

## Outcome

Consume the exact Task 19 frozen candidate, approved profiles, evidence schema,
and Task 17 fixture digest on an authorized representative Windows x64 host.
Run and record every deferred Windows filesystem, process, native, CPU/CUDA,
application, package/installer, lifecycle, privacy, diagnostics, performance,
memory, and previous-binary downgrade gate. Perform no Linux qualification and
do not issue the final cross-platform release-blocker verdict.

## Prerequisites

- Specification revision 7 and plan revision 14 are approved.
- Task 19 production-candidate activation and Linux qualification are complete,
  and its immutable handoff identifies one live-composed candidate, profile
  set, evidence schema, and fixture bundle digest
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- An authorized real representative Windows x64 host and NVIDIA device are
  available. Cross-compilation, Wine, Linux, compile-only CI, source contracts,
  and mocks are not substitutes.
- The exact previous Windows packaged application and approved nonprivate
  downgrade fixture are available or can be recorded as explicit `Pending`
  inputs.
- Task 20 has separate execution authorization on Windows. Planning approval
  and Task 19 execution do not authorize this packet.

## Owned Requirements

- Windows qualification slices of `OUT-001`, `BASE-001`, `ARCH-001`,
  `ARCH-009`, `COMP-001`–`COMP-004`, `CAP-001`, `CAP-011`, `LIFE-005`,
  `PRIV-001`–`PRIV-004`, `DIAG-001`–`DIAG-003`, and `DOC-001`.
- Representative Windows evidence supporting every applicable deterministic
  criterion in `AC-AUTO-001`–`AC-AUTO-054` and `AC-AUTO-056`–`AC-AUTO-063`.
- Windows portions of `AC-MAN-002`–`AC-MAN-008` and `AC-MAN-013`.
- All Windows execution deferred by Tasks 04, 06–12, and 14–18.
- Task 20 owns no aggregate automated acceptance result. Primary ownership of
  `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, and `AC-AUTO-040` belongs to
  Task 21 after both platform evidence slices exist.

## In Scope

- Validate the exact frozen Windows toolchain before any candidate build.
- Run representative filesystem-handle/reparse safety, process/Job Object,
  worker protocol, model authority, CPU/CUDA, package/installer, IPC/UI,
  privacy/diagnostics, lifecycle, performance/memory, offline, and downgrade
  checks against the unchanged candidate.
- Prove the Windows package consumes the unchanged Task 17 fixture and contains
  only the approved base-package contents.
- Record actual executable paths only in approved private evidence; repository
  results contain sanitized tool identity/version/digest only.
- Produce an immutable privacy-safe Windows evidence slice for Task 21.
- Update task checklist and handoff with exact Pass/Fail/Pending results and
  evidence digests without changing Task 19 evidence.

## Out Of Scope

- Any Linux qualification rerun, Linux evidence mutation, or candidate/profile
  regeneration.
- Wine, cross-compilation, compile-only CI, source-contract tests, or mocks as a
  substitute for representative Windows behavior.
- AMD hardware success without an authorized physical AMD profile; Windows
  Vulkan remains `Preview · Untested` otherwise.
- Executable macOS inference or physical Apple qualification.
- Final aggregate acceptance result, claims reconciliation, release-blocker
  report, publication, tag, upload, push, pull request, or release.
- Repairing owner-packet defects or changing thresholds after results.

## Task Contract

### Exact frozen Windows inputs

Before building or running the candidate, validate:

| Input                       | Required candidate value |
| --------------------------- | ------------------------ |
| CUDA toolkit                | `12.8.1`                 |
| MSVC toolset                | v143 `14.39`             |
| Compiler macro              | `_MSC_VER 1939`          |
| CMake                       | `3.31.8`                 |
| Windows SDK                 | `10.0.26100.0`           |
| Ninja                       | `1.12.1`                 |
| Effective CUDA architecture | `120a-real`              |

Reject ambient MSVC v143 14.44, `_MSC_VER 1944`, generic “Visual Studio 2022”
identity, any different CUDA/CMake/SDK/Ninja value, or merely requesting a
profile string without proving effective `120a-real` generation. Do not modify
the candidate to fit the host.

### Representative filesystem and process behavior

Run managed filesystem identity, ownership, junction/reparse/hard-link/rename/
volume races, locks, quarantine/delete, and stale PID/start-identity checks on
real Windows filesystems.

Run arbitrary inherited model `HANDLE` mapping to logical slot `3`,
authenticated one-use pipe peer, restricted
`PROC_THREAD_ATTRIBUTE_HANDLE_LIST`, suspended child creation, Job assignment,
resume, private bootstrap acknowledgement, framing/parsing, nested-Job
compatibility/fail-closed behavior, parent/app crash, descendant cleanup,
ignored graceful exit, and kill-on-close behavior. No process path, authority,
environment, prompt, audio, or transcript may enter public evidence.

### Native, worker, hardware, and lifecycle qualification

- Run MSVC warnings-as-errors and native format/lint/unit/integration/build
  equivalents for the filesystem guard, launcher, and worker.
- Run the real `whisperCpp` CPU pack with GPU absent and prove no GPU
  initialization.
- Run the real CUDA worker on representative NVIDIA hardware with exact device
  proof, load, warm-up, inference, WER/direct-reference comparison, timing/RTF,
  RAM/VRAM, repeat, cancellation, crash/reload, unload, cleanup, provider
  switch, suspend/resume, app exit, and offline restart behavior.
- Apply the same preapproved stage, accuracy, RTF, memory, repetition, orphan,
  allocation, and settling limits defined by the unchanged profiles from Task 19. A failure cannot lower a threshold.
- Exercise Windows Vulkan package/failure behavior. Without representative AMD
  hardware, record physical hardware promotion as Not Run and retain Preview.

### Package, installer, privacy, and downgrade

Validate base installer, ASAR, exactly two native helpers, on-demand pack
integrity, relocation/dependency closure, install/upgrade/uninstall policy, and
release-collection rejection of fixture or missing production inputs. The
Windows consumer must record the exact Task 17 digest without regeneration or
signing.

Run trusted-window IPC, settings/main-window accessibility, privacy canaries,
diagnostics v1/v2, process-argument/environment/network inspection, provider
switch, suspend/resume, crash, app exit, and offline lifecycle checks.

For downgrade, execute the exact immediately preceding Windows package from the
approved source against the nonprivate fixture. Record version, hash,
signature/provenance where available. It must remain Not ready, execute/delete
no Local Whisper data, preserve namespaces, and recover via a provider known by
that version. A current-code fixture cannot substitute.

## Contracts And Boundaries

- Candidate, profile, schema, Task 17 fixture digest, and Task 19 evidence are
  read-only inputs to Task 20.
- Every representative Windows execution in this workstream occurs only in
  Task 20 on a real authorized Windows host.
- Platform, hardware, deterministic, manual, and external evidence classes are
  distinct and non-substitutable.
- Raw private evidence remains outside the repository and chat; checked-in
  results are sanitized and digest-linked.
- Task 20 records a Windows platform verdict but does not aggregate Linux,
  external approvals, AMD/macOS claims, or release authority.
- No qualification command publishes, signs, tags, uploads, pushes, or releases.

## Expected Files Or Components

- Windows qualification orchestration and strict input validation under
  `scripts/local-whisper/`.
- Windows-specific result/evidence template and sanitized result document using
  the schemas established by Task 19.
- Native MSVC, CPU/CUDA, filesystem/process, package/installer, lifecycle,
  privacy, diagnostics, performance, memory, and downgrade runners with
  validated task-owned temporary roots.
- `package.json` commands required by Verification.
- Updated `todo.md` and `handoff.md` containing sanitized Windows results and
  exact Task 21 reconciliation inputs.

## Acceptance Criteria

- The exact CUDA 12.8.1, MSVC v143 14.39, `_MSC_VER 1939`, CMake 3.31.8,
  Windows SDK 10.0.26100.0, Ninja 1.12.1, and effective `120a-real` inputs are
  validated before candidate execution.
- Every deferred representative Windows gate runs on real Windows and is tied
  to the same candidate/profile/fixture digests as Task 19, or has a precise
  `Pending` reason.
- Real Windows filesystem, process-tree, CPU/CUDA, package/installer,
  accessibility, privacy, diagnostics, lifecycle, performance, memory, offline,
  and downgrade results are recorded without substitute evidence.
- CPU proves no GPU initialization; CUDA proves exact selected device, real
  inference, lifecycle cleanup, and no fallback.
- Windows Vulkan does not claim physical AMD success without approved hardware.
- No Linux profile reruns and no aggregate release/support claim occur.
- Task 21 can verify both platform slices without rerunning expensive profiles.

## Verification

Run on the separately authorized representative Windows x64 host only:

```bash
rtk npm run verify:local-whisper:qualification:inputs -- --platform=win32
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:filesystem
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run dist:win -- --dir
rtk npm run verify:local-whisper:qualification:windows
rtk npm run verify:local-whisper:downgrade -- --platform=win32
```

The registered Task 20 command is:

```bash
rtk npm run verify:local-whisper:qualification:windows
```

Do not run Linux qualification or `verify:local-whisper:all` in this packet.

## Failure And Rollback

- Preserve the frozen candidate identity, Task 19 evidence, and failed Windows
  evidence. Clean only exact task-owned temporary roots and proven task-owned
  processes/allocations.
- A cleanup, privacy, filesystem-trust, process-authority, signature,
  toolchain-identity, or evidence-integrity failure stops Windows qualification
  and returns to the primary owner through newly authorized work.
- Missing host, device, pack, previous binary, license, origin, redistribution
  approval, or external input is `Pending`, never a mock-derived Pass.
- A candidate/profile/fixture change invalidates the run and requires returning
  to Task 19 for a new candidate; never merge old and new evidence.

## Manual Gates

- `AC-MAN-003`: exact Windows NVIDIA Production profile.
- Windows slices of `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and
  `AC-MAN-013`.
- Physical Windows AMD Vulkan promotion remains future `AC-MAN-010` evidence
  and may be Not Run without blocking the approved untested Preview label.
- Missing representative Windows access or exact toolchain/hardware inputs
  remains an explicit release blocker.
- Commit, push, PR, signing, publication, tag, upload, release, and final
  support-claim decisions remain outside this packet.

## References

- `../spec.md`, especially Sections 19.2, 20, 21, and 22 and all automated and
  manual acceptance rows.
- Tasks 04, 06–12, and 14–19 for deferred Windows contracts and the immutable
  candidate handoff.
- Project Windows packaging, MSVC/native-quality, privacy, diagnostics,
  installer, and release conventions.

## Completion And Handoff

Update `todo.md` and `handoff.md` with exact sanitized tool identities,
candidate/profile/fixture digests, Windows Pass/Fail/Pending/Not Applicable
summaries, previous-binary status, and evidence-index digest. Mark Task 20
complete when the packet has produced truthful Windows results and a valid
handoff; qualification failures and external blockers remain explicit. Stop
before Task 21, commit, push, PR, publication, or release unless separately
authorized.
