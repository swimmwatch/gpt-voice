# 14 Windows End-To-End Qualification

## Outcome

Run the complete locked CPU/CUDA end-to-end acceptance matrix directly on the regular supported Windows computer,
record privacy-safe pass/failure evidence, and either close Windows qualification or route every discovered Windows
defect and improvement to Packet 15.

## Prerequisites

- Packet 13 and all earlier packets are complete, reviewed, and green for their exact pushed SHAs.
- The ordinary Windows computer is not a CI runner. It has the approved MSVC/CUDA toolchains, supported CPU/GPU,
  authenticated release-1 model/runtime artifacts, and sufficient disposable private data roots.
- The exact candidate commit, runtime packs, model artifacts, manifest, input, cache procedures, run ordering,
  sampling interval, statistic, and uncertainty method are frozen before the first sample.
- Hosted Windows CI evidence is available for the same candidate SHA but is not treated as representative CUDA
  performance evidence.

## Owned Requirements

OUT-001, SCP-001, CMP-001, PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, RES-002, QUAL-001, OBS-001,
OBS-002, OBS-003, AC-MAN-002, AC-MAN-003, AC-MAN-004, AC-MAN-005, AC-MAN-006.

## In Scope

- Minimum-five paired cold/warm measurements for `base/full`, `medium/full`, and `large-v3/q5_0` on eligible
  Windows x64 CPU and CUDA configurations using exact MSVC-built helpers and workers.
- Real app-to-guard maximum-model installation, slow-pipe, cancellation, induced mid-window failure, clean retry,
  worker load/warm-up, GPU thread values, stale-residency rejection, UI accessibility, mixed-peer failure, settings
  rollback, package smoke, and evidence-privacy checks.
- Content-free blocker/failure records that identify the owning component and originating packet without exposing
  paths, device identity, native output, model content, audio, transcripts, credentials, or environment dumps.
- Privacy-safe aggregate evidence and the decision whether Packet 15 is required.

## Out Of Scope

- Fixing, tuning, or improving production code in this packet.
- Turning the regular Windows computer into a self-hosted CI runner, weakening thresholds, replacing failed samples,
  changing support claims, publishing a release, uploading evidence, or retaining raw/private inputs.

## Task Contract

1. Verify the checked-out candidate SHA and authenticated artifact digests before building or running. Produce exact
   Windows CPU and CUDA runtime packs with approved toolchains; do not commit generated packs or binaries.
2. Use the locked manifest for every before/after pair and retain failed samples with content-free reasons. Never
   rerun selectively to manufacture a pass.
3. Record all required phases and resources with units. Require at least 25 percent conservative improvement for
   each targeted component and reject end-to-end time or any peak-resource regression above 3 percent after
   uncertainty.
4. Confirm the successful Windows model-load count is 6 after directory-result reuse and every later freshness,
   authority, preflight, and loader-consumption proof remains.
5. Confirm Windows CPU/CUDA profile values have zero unexplained effective drift. Exercise `gpuCpuThreads` values
   `auto`, 1, 4, and host maximum, target switching, restart, warm-up failure/retry, and stale-residency rejection.
6. Run the maximum release-1 artifact through normal, slow-pipe, cancellation, and induced mid-window failure paths.
   The artifact publishes at the authenticated identity or staging is absent; the next retry succeeds without
   manual process cleanup.
7. Exercise protocol-v2 mixed peers, schema-v2 rollback with disposable settings, packaged application startup, and
   keyboard/screen-reader behavior directly on Windows.
8. Inspect all retained benchmark, test, CI, crash, package, and diagnostic evidence for prohibited content before
   adding any sanitized aggregate document to the workstream.
9. If all acceptance gates pass, mark Packet 15 not required in the same reviewed evidence change. If any Windows
   defect, performance miss, resource regression, or warranted Windows-only improvement remains, record it without
   fixing it here and make Packet 15 mandatory.

## Contracts And Boundaries

- The regular Windows computer is a direct manual acceptance host, not a CI runner and not an evidence uploader.
- Qualification records contain only bounded durations, counts, anonymized platform/backend class, aggregate
  resources, stable content-free outcomes, and digests of sanitized documents.
- No credentials, private paths, device-native identities, model/audio/transcript/prompt content, unrestricted logs,
  capability dumps, or environment dumps enter repository files, console captures, commits, or handoffs.
- A failure is evidence and a Packet 15 input; it is never permission to weaken security, correctness, privacy,
  compatibility, or acceptance thresholds.

## Expected Files Or Components

- Packet 01 Windows qualification commands and schemas
- `package.json` command entry points only if Packet 01's planned names require a non-behavioral correction
- Privacy-safe Windows aggregate evidence under this specification's qualification evidence directory
- `tasks/todo.md` and `tasks/handoff.md`
- No production source file

## Acceptance Criteria

- AC-MAN-002 executes the exact representative Windows CPU/CUDA matrix and every cell either passes or has an
  explicit content-free failure/blocker.
- Windows portions of AC-MAN-003 through AC-MAN-005 execute through real app, guard, worker, UI, settings, runtime
  pack, and package mechanisms.
- AC-MAN-006 confirms every retained document and handoff is privacy-safe.
- Passing qualification requires every targeted component to meet the 25 percent conservative improvement gate and
  every end-to-end/resource result to remain within the 3 percent guardrail.
- A valid failing result completes evidence collection but does not complete specification acceptance; it activates
  Packet 15.

## Verification

- `npm run verify:local-whisper:qualification:inputs`
- `npm run produce:local-whisper:windows-runtime-pack:cpu`
- `npm run produce:local-whisper:windows-runtime-pack:cuda`
- `npm run run:local-whisper:qualification:windows`
- `npm run verify:local-whisper:qualification:windows`
- `npm run test:local-whisper:windows-application-smoke`
- Run Packet 01's paired analyzer for every Windows CPU/CUDA matrix cell.
- Run the real installation, GPU-thread, warm-up, mixed-peer, rollback, accessibility, package, and privacy
  procedures above on the regular Windows computer.

## CI Gate And Commit Discipline

- Commit only sanitized aggregate evidence and content-free failures. After the direct Windows run, stop for review
  and obtain explicit authorization for the evidence commit and push.
- Required checks for the exact pushed evidence SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`,
  `Local Whisper Native Quality (Windows)`, `Package Smoke (Windows)`, and `Package Attestation (Windows)`.
- Push the immutable evidence commit and wait until every required check reports `success`; failed, skipped,
  cancelled, neutral, action-required, stale, and timed-out results are non-passing.
- Fix only an evidence-schema, redaction, or deterministic CI-validation defect in this packet, and only in a later
  explicitly authorized separate fix commit. Never amend or squash the evidence commit. A production or Windows
  behavior defect belongs exclusively to Packet 15.
- Record evidence/fix SHAs, workflow run ID, check names, check-run URLs or IDs, final results, sanitized Windows
  evidence digest, and the Packet 15 required/not-required decision in `handoff.md`.

## Failure And Rollback

- Missing phases, invalid samples, threshold failures, resource regressions, security/privacy problems, package
  failures, or unavailable required cells remain visible and activate Packet 15 or block acceptance.
- Rollback means reject the candidate and retain the last coherent approved app/guard/settings/runtime set. Do not
  delete managed models, runtime artifacts, user data, or the failing evidence, and do not publish a release.

## Manual Gates

- `MANUAL GATE`: the operator explicitly authorizes use of the regular Windows CPU/CUDA computer, approved local
  artifacts, disposable settings roots, package installation, induced failures, and GPU topology changes.
- Do not request or store credentials in the task bundle. Do not upload or externally share the results.

## References

- Specification Sections 4, 5, 10, 13, 14.2, and 16.
- Packet 01's locked manifest/analyzer, Packet 12's operational documentation, and Packet 13's Linux evidence.

## Completion And Handoff

After the evidence commit's required CI checks are green and reviewed, mark Packet 14 complete. If every Windows
gate passed, mark Packet 15 not required with the evidence digest and stop. Otherwise leave Packet 15 unchecked,
list each content-free Windows failure with its owning component, and stop with Packet 15 as the exact next packet.
