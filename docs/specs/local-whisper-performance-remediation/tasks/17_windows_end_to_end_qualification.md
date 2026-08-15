# 17 Windows End-To-End Qualification

## Outcome

Complete the qualification-owned Windows collection adapter on the regular Windows host, run every deferred Windows
automated check and the complete locked CPU/CUDA end-to-end matrix, measure pipeline windows 1, 2, 4, and 8 without
freezing one, and route all evidence and failures to Packet 18.

## Prerequisites

- Packet 16 and all earlier packets are complete, locally verified, and reviewed; accumulated commits have not been
  pushed for revision-5 validation.
- Packet 13's schema-v2 run-plan, per-model sample, collector, analyzer, and Linux adapter contracts are green. Packet
  16 provides the locked Linux procedure and pre-Windows-adapter evidence for all candidate windows.
- The ordinary Windows computer is not a CI runner. It has the approved MSVC/CUDA toolchains, supported CPU/GPU,
  authenticated release-1 model/runtime artifacts, and sufficient disposable private data roots.
- The exact baseline and candidate commits, runtime packs, model artifacts, manifest, input, cache procedures, run ordering,
  sampling interval, statistic, and uncertainty method are frozen before the first sample.
- Explicit authorization exists to push the accumulated immutable commits and run the final-phase CI checks.

## Owned Requirements

OUT-001, SCP-001, CMP-001, PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, RES-002, QUAL-001, OBS-001,
OBS-002, OBS-003, AC-AUT-003 through AC-AUT-015, AC-MAN-002, AC-MAN-003, AC-MAN-004,
AC-MAN-005, AC-MAN-006.

## In Scope

- Minimum-five paired cold/warm measurements for `base/full`, `medium/full`, and `large-v3/q5_0` on eligible
  Windows x64 CPU and CUDA configurations using exact MSVC-built helpers and workers.
- A qualification-only Windows process/resource sampler and collection adapter implementing Packet 13's frozen
  interfaces with Windows job/process identity, RAM ownership, and CUDA VRAM ownership checks. It must be developed
  and verified on the regular Windows host; Linux fixtures do not claim that platform behavior.
- Real app-to-guard maximum-model installation, slow-pipe, cancellation, induced mid-window failure, clean retry,
  worker load/warm-up, GPU thread values, stale-residency rejection, UI accessibility, mixed-peer failure, settings
  rollback, package smoke, and evidence-privacy checks.
- All Windows TypeScript, MSVC/native, profile, runtime-pack, packaging, migration, IPC, UI, privacy, and fixture
  checks deferred by Packets 05–16.
- One complete Packet 16 Linux rerun on the exact Windows-adapter commit before direct Windows measurements, so the
  combined selector never consumes different candidate SHAs.
- Separate controlled measurements for pipeline windows 1, 2, 4, and 8 while production composition remains serial.
- Content-free blocker/failure records that identify the owning component and originating packet without exposing
  paths, device identity, native output, model content, audio, transcripts, credentials, or environment dumps.
- Privacy-safe aggregate evidence for Packet 18's mandatory production-window selection and remediation decision.

## Out Of Scope

- Fixing, tuning, or improving production code in this packet. The planned qualification-only Windows collection
  adapter is the sole implementation scope.
- Turning the regular Windows computer into a self-hosted CI runner, weakening thresholds, replacing failed samples,
  changing support claims, publishing a release, uploading evidence, or retaining raw/private inputs.

## Task Contract

1. On the regular Windows host, implement the narrow Packet 13 Windows collection adapter without changing runtime
   behavior or the evidence schema. Add deterministic process-tree, PID-reuse, process-exit, RAM/VRAM ownership,
   cancellation, timeout, output-bound, and privacy tests. Commit it as one separately authorized qualification-only
   change; any failure or required follow-up is recorded for Packet 18 rather than repaired here.
2. Push the accumulated reviewed candidate only after explicit authorization. Wait for `Quality Gates`, both Local
   Whisper Performance checks, both Local Whisper Native Quality checks, and applicable Windows package checks on
   that exact SHA. Record every non-success result without fixing it in this packet and stop before direct-host
   execution; Packet 18 must repair CI in a separate commit and finish the missing qualification.
3. After CI is green, rerun Packet 16's complete Linux CPU/CUDA matrix on the exact Windows-adapter commit. Preserve
   the earlier Linux result as historical evidence, but use only the current-SHA result for cross-platform analysis.
   A missing, partial, blocked, or different-SHA Linux rerun stops this packet before direct Windows execution.
4. Verify the checked-out candidate SHA and authenticated artifact digests before building or running. Produce exact
   Windows CPU and CUDA runtime packs with approved toolchains; do not commit generated packs or binaries.
5. Use the locked schema-v2 run plan for every before/after pair and retain failed samples with content-free reasons. Never
   rerun selectively to manufacture a pass.
6. Record all required phases and resources with units. Apply the 25 percent improvement and 3 percent guardrail to
   every candidate, but do not name the production pipeline window in this packet.
7. Confirm the successful Windows model-load count is 6 after directory-result reuse and every later freshness,
   authority, preflight, and loader-consumption proof remains.
8. Confirm Windows CPU/CUDA profile values have zero unexplained effective drift. Exercise `gpuCpuThreads` values
   `auto`, 1, 4, and host maximum, target switching, restart, warm-up failure/retry, and stale-residency rejection.
9. Run every pipeline window against the maximum release-1 artifact under normal, slow-pipe, cancellation, and
   induced mid-window failure paths. The artifact publishes at the authenticated identity or staging is absent; the
   next retry succeeds without manual process cleanup.
10. Exercise protocol-v2 mixed peers, schema-v2 rollback with disposable settings, packaged application startup, and
    keyboard/screen-reader behavior directly on Windows.
11. Inspect all retained benchmark, test, CI, crash, package, and diagnostic evidence for prohibited content before
    adding any sanitized aggregate document to the workstream.
12. Record every CI/direct-host failure and all candidate-window results without production changes. Packet 18 is
    always mandatory because it alone selects and freezes the production window.

## Contracts And Boundaries

- The regular Windows computer is a direct manual acceptance host, not a CI runner and not an evidence uploader.
- Qualification records contain only bounded durations, counts, anonymized platform/backend class, aggregate
  resources, stable content-free outcomes, and digests of sanitized documents.
- No credentials, private paths, device-native identities, model/audio/transcript/prompt content, unrestricted logs,
  capability dumps, or environment dumps enter repository files, console captures, commits, or handoffs.
- A failure is evidence and a Packet 18 input; it is never permission to weaken security, correctness, privacy,
  compatibility, or acceptance thresholds.

## Expected Files Or Components

- Packet 13's collector/run-plan interfaces and a Windows-specific sampler/adapter under
  `scripts/local-whisper/qualification/`, with focused tests under `tests/scripts/localWhisper/qualification/`
- `package.json` command entry points for the Windows collector and analyzer
- Privacy-safe Windows aggregate evidence under this specification's qualification evidence directory
- `tasks/todo.md` and `tasks/handoff.md`
- No production source file

## Acceptance Criteria

- AC-MAN-002 executes the exact representative Windows CPU/CUDA matrix and every cell either passes or has an
  explicit content-free failure/blocker.
- Windows portions of AC-MAN-003 through AC-MAN-005 execute through real app, guard, worker, UI, settings, runtime
  pack, and package mechanisms.
- AC-MAN-006 confirms every retained document and handoff is privacy-safe.
- Each pipeline candidate has a complete pass/fail record for the 25 percent improvement and 3 percent guardrail;
  none is represented as the production selection.
- The retained current Linux and Windows aggregates bind the same exact Windows-adapter candidate SHA, baseline SHA,
  source proof, model identities, run contract, and statistic/uncertainty method.
- A valid passing or failing result completes evidence collection but not specification acceptance; Packet 18
  remains mandatory.

## Verification

- `npm run verify:local-whisper:qualification:inputs`
- Repeat Packet 16's production freeze, CPU/CUDA collector, analyzer, and manual matrix on the Windows-adapter SHA
- `npm run produce:local-whisper:windows-runtime-pack:cpu`
- `npm run produce:local-whisper:windows-runtime-pack:cuda`
- `npm run collect:local-whisper:qualification:performance -- --platform=win32 --backend=<cpu|cuda> --mode=representativeHost --root=<validated-disposable-root> --input=<root-relative-run-plan> --output=<root-relative-private-bundle>`
- `npm run run:local-whisper:qualification:windows`
- `npm run verify:local-whisper:qualification:windows`
- `npm run test:local-whisper:windows-application-smoke`
- Run Packet 01's paired analyzer for every Windows CPU/CUDA matrix cell and pipeline window 1, 2, 4, and 8.
- Run the real installation, GPU-thread, warm-up, mixed-peer, rollback, accessibility, package, and privacy
  procedures above on the regular Windows computer.

## CI Gate And Commit Discipline

- Required checks for the exact pushed accumulated candidate SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`,
  `Local Whisper Native Quality (Windows)`, `Package Smoke (Windows)`, and `Package Attestation (Windows)`.
- Push only after explicit authorization and wait until every required check reports `success`; failed, skipped,
  cancelled, neutral, action-required, stale, and timed-out results are non-passing.
- Do not fix any CI, production, or Windows behavior failure in this packet. Packet 18 owns every separate fix commit
  and rerun. Never amend or squash an accumulated implementation commit.
- Retain only sanitized aggregate evidence and content-free failures. Record candidate SHA, run ID, check names,
  URLs or IDs, final results, and the sanitized Windows evidence digest in `handoff.md`.

## Failure And Rollback

- Missing phases, invalid samples, threshold failures, resource regressions, security/privacy problems, package
  failures, or unavailable required cells remain visible and activate Packet 18 or block acceptance.
- Rollback means reject the candidate and retain the last coherent approved app/guard/settings/runtime set. Do not
  delete managed models, runtime artifacts, user data, or the failing evidence, and do not publish a release.

## Manual Gates

- `MANUAL GATE`: the operator explicitly authorizes use of the regular Windows CPU/CUDA computer, approved local
  artifacts, disposable settings roots, package installation, induced failures, and GPU topology changes.
- Do not request or store credentials in the task bundle. Do not upload or externally share the results.

## References

- Specification Sections 4, 5, 10, 13, 14.2, and 16.
- Packet 01's locked analyzer, Packet 12's operational documentation, Packets 14–15's attempt contract/runner, and Packet 16's
  Linux evidence.

## Completion And Handoff

After the deferred checks either execute or are explicitly blocked by the first non-success prerequisite, review the
evidence and mark Packet 17 complete as evidence collection. List every content-free failure, unrun dependent check,
and available candidate-window result with its owning component, then stop with mandatory Packet 18 as the exact
next packet. Packet 18 must repair the blocker and complete all missing checks before selection or acceptance.
