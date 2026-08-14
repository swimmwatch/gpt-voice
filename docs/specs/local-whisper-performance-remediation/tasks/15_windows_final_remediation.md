# 15 Conditional Final Windows Remediation

## Outcome

When Packet 14 discovers a Windows defect or warranted Windows-only improvement, fix it in isolated reviewable
commits, obtain green Linux and Windows CI after every fix, rerun the complete Windows end-to-end matrix on the
regular Windows computer, and close the workstream only with passing privacy-safe evidence.

## Prerequisites

- Packet 14 is complete, its evidence commit is green, and `handoff.md` identifies at least one unresolved Windows
  failure or improvement with owning component and acceptance criterion.
- If Packet 14 passed every Windows gate, this packet is marked not required in Packet 14's reviewed evidence change
  and performs no work or commit.
- The candidate and baseline SHAs, authenticated artifacts, toolchains, and qualification manifest remain available.

## Owned Requirements

CMP-001, CMP-005, PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, RES-002, QUAL-001, AC-AUT-015,
AC-MAN-002, AC-MAN-003, AC-MAN-004, AC-MAN-005, AC-MAN-006.

## In Scope

- Only Windows defects, performance misses, resource regressions, compatibility failures, and warranted Windows-only
  improvements discovered and recorded by Packet 14.
- One logical remediation per separately authorized fix commit, complete CI reruns for each commit, and complete
  direct Windows end-to-end reruns for each candidate that reaches green CI.
- Cross-platform guards required to prove a Windows fix does not regress shared Linux behavior.
- A final privacy-safe Windows acceptance evidence document bound to the accepted fix SHA.

## Out Of Scope

- Unrelated cleanup, speculative optimization, Linux-only improvements, new dependencies, support changes, weaker
  thresholds, release publication, artifact upload, commit squashing, or history rewriting.
- Any behavior, security, privacy, public/IPC, migration, or supported-platform contract change. Such a need returns
  to `/spec`; a materially different task sequence returns to `/plan`.

## Task Contract

1. Diagnose each Packet 14 failure against its evidence and map it to the smallest owning boundary. Do not expose raw
   evidence or infer a fix from source inspection alone.
2. Implement one logical Windows remediation at a time. Preserve shared contracts, explicit platform isolation,
   RAII/thread-safety/security/privacy boundaries, and Linux behavior.
3. Run the originating component checks locally where the Linux development host can do so. Never claim a Windows
   result from Linux; Windows-specific execution occurs in hosted CI and then on the regular Windows computer.
4. Obtain explicit authorization before every fix commit and push. Each fix is a new commit that names the Packet 14
   failure; never amend, squash, or combine it with the original implementation/evidence commit.
5. After each push, wait for the full required CI set below. A non-success result blocks further direct-host testing.
   Diagnose an actionable CI failure and correct it in another separately authorized fix commit.
6. When a fix SHA is green, rerun the complete Packet 14 Windows CPU/CUDA end-to-end matrix on that exact SHA. A
   partial rerun cannot close acceptance. If it exposes another defect, repeat this packet with another fix commit.
7. Once the full matrix passes, create a separately reviewed privacy-safe evidence-only commit bound to the accepted
   fix SHA, push it, and wait for the same required CI checks to succeed.

## Contracts And Boundaries

- Windows-specific code remains behind the existing platform backend/profile boundaries; shared code changes require
  explicit Linux regression evidence.
- No mutable global runtime state, shell execution, unchecked paths, broad recursive actions, secrets, private audio,
  transcripts, device identities, or raw native output are permitted.
- Generated builds, runtime packs, models, packages, caches, and raw qualification data remain uncommitted.

## Expected Files Or Components

- Only the component files required by failures listed in Packet 14's handoff
- Focused tests for every fixed failure
- Existing performance/native/workflow tests when a CI command or platform policy must be corrected
- Final privacy-safe Windows aggregate evidence, `tasks/todo.md`, and `tasks/handoff.md`

## Acceptance Criteria

- Every Packet 14 Windows failure is fixed or remains an explicit blocker; no recorded item is silently dropped.
- Every remediation commit is separate, reviewed, pushed only with authorization, and green for the complete required
  CI set before direct Windows testing.
- The final exact fix SHA passes the complete Packet 14 Windows CPU/CUDA end-to-end matrix, 25 percent component
  threshold, 3 percent end-to-end/resource guardrail, compatibility/recovery checks, and privacy inspection.
- AC-AUT-015 remains green on Linux and Windows, and AC-MAN-002 through AC-MAN-006 pass on the regular Windows
  computer without weakening any gate.

## Verification

Run the smallest originating component set before the aggregate gates, selecting every applicable group:

- Filesystem/install: `npm run test:local-whisper:filesystem`, `npm run test:local-whisper:artifacts`, and
  `npm run test:local-whisper:fs-guard:msvc-asan` in Windows CI.
- Crypto/worker: `npm run test:local-whisper:worker-common:native`,
  `npm run test:local-whisper:whisper-cpp-cancellation`, `npm run test:local-whisper:supervisor`, and
  `npm run test:local-whisper:whisper-cpp:msvc-asan` in Windows CI.
- Settings/UI/runtime identity: `npm run test:local-whisper:migration`, `npm run test:local-whisper:ipc`,
  `npm run test:local-whisper:composition`, and `npm run verify:local-whisper:ui`.
- Profiles/package: `npm run test:local-whisper:native-build-audits`,
  `npm run verify:local-whisper:native-toolchain`, `npm run audit:local-whisper:disconnected-build`, and
  `npm run test:local-whisper:packaging`.
- Qualification: `npm run verify:local-whisper:qualification:inputs`,
  `npm run run:local-whisper:qualification:windows`, and
  `npm run verify:local-whisper:qualification:windows` on the regular Windows computer.

## CI Gate And Commit Discipline

- Minimum required checks for every pushed fix and final evidence SHA: `Quality Gates`,
  `Local Whisper Performance (Linux)`, `Local Whisper Performance (Windows)`,
  `Local Whisper Native Quality (Linux)`, and `Local Whisper Native Quality (Windows)`.
- If a fix affects profiles, packaging, runtime packs, packaged startup, workflow/package policy, or their evidence,
  also require `Package Smoke (Fedora Linux)`, `Package Smoke (Windows)`,
  `Package Attestation (Fedora Linux)`, and `Package Attestation (Windows)`.
- Wait for every named check to report `success` for the exact SHA. Failed, skipped, cancelled, neutral,
  action-required, stale, and timed-out results are non-passing.
- Every CI repair is another separately authorized fix commit. Never amend or squash. Record all fix/evidence SHAs,
  workflow run IDs, check names, check-run URLs or IDs, and final results in `handoff.md`.

## Failure And Rollback

- If a fix weakens a contract, regresses Linux, fails CI, or fails the direct Windows matrix, reject that candidate
  and keep Packet 15 open. Restore the last coherent approved set only through a reviewable revert or follow-up
  authorized commit; do not rewrite history.
- Do not delete managed models, runtime artifacts, settings, user data, or retained content-free failure evidence.

## Manual Gates

- `MANUAL GATE`: authorize each use of the regular Windows computer, authenticated local artifacts, disposable data,
  package installation, induced failures, and GPU topology changes.
- `MANUAL GATE`: authorize every commit and push separately. No pull request, release, publication, upload, or
  external sharing is authorized by this packet.

## References

- Packet 14's failure evidence and exact handoff.
- Specification Sections 4, 5, 10–14, and 16.
- `docs/agent-guides/project-conventions.md` relevant component and Git sections only.

## Completion And Handoff

Mark Packet 15 complete only after the final accepted fix SHA passes all required CI and the complete direct Windows
matrix, and its privacy-safe evidence-only commit is also green and reviewed. Record no next packet, every fix SHA,
the final evidence digest, and any external release work still explicitly unauthorized.
