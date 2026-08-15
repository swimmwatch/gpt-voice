# 18 Final Pipeline Selection And Windows Remediation

## Outcome

Select and freeze the production pipeline window from locked Linux/Windows evidence, fix every Windows failure in
isolated reviewable commits, and close the workstream only after complete Linux/Windows requalification passes.

## Prerequisites

- Packet 17 is complete and `handoff.md` lists every exact-SHA CI/direct-host result, Windows failure, and candidate
  window result with an owning component. A valid failed check is allowed as explicit input to this packet.
- The candidate and baseline SHAs, authenticated artifacts, toolchains, and qualification manifest remain available.

## Owned Requirements

CMP-001, CMP-005, THR-001, RES-001, PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, RES-002, QUAL-001,
AC-AUT-007, AC-AUT-015, AC-MAN-001, AC-MAN-002, AC-MAN-003, AC-MAN-004, AC-MAN-005, AC-MAN-006.

## In Scope

- Deterministic production-window selection across candidates 1, 2, 4, and 8 using Packet 16 Linux and Packet 17
  Windows evidence; ties choose the smaller value.
- The named production-binding change from serial `1` to the selected value.
- Only Windows defects, performance misses, resource regressions, compatibility failures, and warranted Windows-only
  improvements discovered and recorded by Packet 17.
- One logical remediation per separately authorized fix commit, complete CI reruns for each commit, and complete
  direct Windows end-to-end reruns for each candidate that reaches green CI.
- Cross-platform guards required to prove a Windows fix does not regress shared Linux behavior.
- A final privacy-safe Linux/Windows acceptance evidence document bound to the accepted fix SHA.

## Out Of Scope

- Unrelated cleanup, speculative optimization, Linux-only improvements, new dependencies, support changes, weaker
  thresholds, release publication, artifact upload, commit squashing, or history rewriting.
- Any behavior, security, privacy, public/IPC, migration, or supported-platform contract change. Such a need returns
  to `/spec`; a materially different task sequence returns to `/plan`.

## Task Contract

1. Diagnose each Packet 17 failure against its evidence and map it to the smallest owning boundary. Repair any CI or
   behavior defect that prevents valid Windows candidate measurements first, one logical change per separately
   authorized fix commit. Preserve platform isolation, RAII/thread-safety/security/privacy, and Linux behavior.
2. Run the originating component checks locally where the Linux development host can do so, push only with explicit
   authorization, and wait for the full required CI set below. A non-success result requires another separate fix
   commit; never claim a Windows result from Linux.
3. Once CI is green, complete or repeat Packet 17's direct Windows matrix so every pipeline candidate has valid
   Windows evidence. A partial or stale-SHA run cannot authorize selection.
4. Run Packet 01's deterministic selector over the locked Packet 16 and current Packet 17 evidence. Select only a
   candidate satisfying the 25 percent conservative gain and 3 percent end-to-end/resource guardrail on every
   applicable Linux and Windows cell; ties choose the smaller value. If none qualifies after authorized in-scope
   remediation, do not set a production value and stop for plan/spec review.
5. Change the serial production binding to the selected named constant in one separately reviewed commit. Do not
   add runtime overrides, adaptive selection, or an unmeasured fallback.
6. Repair any remaining Packet 17 Windows failure one logical change at a time. Obtain explicit authorization before
   every commit and push; never amend or squash the accumulated implementation/evidence history.
7. After each selection or fix push, wait for the full required CI set. A non-success result requires another
   separately authorized fix commit before direct-host qualification.
8. When the SHA is green, rerun the complete Packet 16 Linux and Packet 17 Windows CPU/CUDA matrices on that exact
   SHA. A partial rerun cannot close acceptance. If another defect appears, repeat with another fix commit.
9. Once both matrices pass, create a separately reviewed privacy-safe evidence-only commit bound to the accepted
   SHA, push it, and wait for the same required CI checks to succeed.

## Contracts And Boundaries

- Windows-specific code remains behind the existing platform backend/profile boundaries; shared code changes require
  explicit Linux regression evidence.
- No mutable global runtime state, shell execution, unchecked paths, broad recursive actions, secrets, private audio,
  transcripts, device identities, or raw native output are permitted.
- Generated builds, runtime packs, models, packages, caches, and raw qualification data remain uncommitted.

## Expected Files Or Components

- Packet 05 installation transport/composition owner of the named production-window constant
- Only the component files required by failures listed in Packet 17's handoff
- Focused tests for every fixed failure
- Existing performance/native/workflow tests when a CI command or platform policy must be corrected
- Final privacy-safe Linux/Windows aggregate evidence, `tasks/todo.md`, and `tasks/handoff.md`

## Acceptance Criteria

- Exactly one production window from 1, 2, 4, and 8 is selected by the locked combined-evidence rule and recorded
  with its sanitized evidence digest; no fixture-only or Linux-only result is promoted.
- Every Packet 17 Windows failure is fixed or remains an explicit blocker; no recorded item is silently dropped.
- Every remediation commit is separate, reviewed, pushed only with authorization, and green for the complete required
  CI set before direct Windows testing.
- The final exact fix SHA passes the complete Packet 16 Linux and Packet 17 Windows CPU/CUDA matrices, 25 percent
  component threshold, 3 percent end-to-end/resource guardrail, compatibility/recovery checks, and privacy
  inspection.
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
  `npm run run:local-whisper:qualification:linux`, `npm run verify:local-whisper:qualification:linux`,
  `npm run run:local-whisper:qualification:windows`, and `npm run verify:local-whisper:qualification:windows` on
  their representative hosts.

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
  and keep Packet 18 open. Restore the last coherent approved set only through a reviewable revert or follow-up
  authorized commit; do not rewrite history.
- Do not delete managed models, runtime artifacts, settings, user data, or retained content-free failure evidence.

## Manual Gates

- `MANUAL GATE`: authorize each representative Linux/Windows run, authenticated local artifacts, disposable data,
  package installation, induced failures, and GPU topology changes.
- `MANUAL GATE`: authorize every commit and push separately. No pull request, release, publication, upload, or
  external sharing is authorized by this packet.

## References

- Packet 16's Linux candidate evidence and Packet 17's Windows/CI evidence and exact handoff.
- Packet 01's deterministic candidate selector and tie-break rule.
- Specification Sections 4, 5, 10–14, and 16.
- `docs/agent-guides/project-conventions.md` relevant component and Git sections only.

## Completion And Handoff

Mark Packet 18 complete only after the selected-window/fix SHA passes all CI and complete Linux/Windows checks and
its privacy-safe evidence-only commit is green. Record the selected integer and evidence digest, every fix/evidence
SHA, every CI run, final AC-MAN-001 through AC-MAN-006 outcomes, and no next packet. Any non-passing gate leaves
Packet 18 unchecked and blocks specification acceptance.
