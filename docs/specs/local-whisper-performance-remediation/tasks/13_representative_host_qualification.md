# 13 Representative Linux Host Qualification

## Outcome

Run the locked paired baseline/candidate matrix on representative Linux CPU/CUDA hosts, accept only results that
satisfy every component and guardrail, and record privacy-safe completion evidence or explicit blockers before the
Windows end-to-end packet.

## Prerequisites

- Packet 12 and every automated criterion are complete.
- Exact baseline and candidate commits, authenticated release-1 model/runtime artifacts, manifests, cache-state
  procedures, fixtures, tools, and host/backend/device classes are frozen before the first sample.
- Recheck affected source against the revision basis and refresh any stale source counts or manifests.

## Owned Requirements

OUT-001, SCP-001, PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, RES-002, QUAL-001, OBS-001, OBS-002,
OBS-003, AC-MAN-001, AC-MAN-003, AC-MAN-004, AC-MAN-005, AC-MAN-006.

## In Scope

- Minimum-five paired cold/warm measurements for `base/full`, `medium/full`, and `large-v3/q5_0` on representative
  eligible Linux x64 CPU/CUDA hosts.
- Component gains, end-to-end/resource guardrails, real install failure/retry, GPU thread behavior, mixed-peer and
  rollback checks, and retained-evidence privacy inspection.
- Sanitized aggregate result documents and explicit unsupported/unavailable/blocker records.

## Out Of Scope

- Further tuning, changing thresholds, replacing failed samples, adding unsupported platform claims, publishing a
  release, uploading evidence, or retaining raw/private inputs.

## Task Contract

1. Use the same manifest within each before/after pair: app lineage, authenticated artifacts, host, backend, device,
   settings, cache state, input, run order, sampling interval, statistic, and uncertainty method.
2. Record every required phase/resource with units and distinguish cold/warm cases. Retain failed samples with
   content-free reasons; never rerun only to obtain a pass.
3. For each performance-changing component, require conservative gain of at least 25 percent. Reject the candidate
   if end-to-end time or any peak resource regresses more than 3 percent after uncertainty.
4. Confirm the model-load count is 7 on Linux after reuse while all later proofs remain.
5. Confirm backend option work has zero unexplained effective drift rather than an invented speedup claim.
6. Run maximum-artifact install under normal, slow-pipe, cancel, and induced mid-window failure. Publication is exact
   or staging is absent, and retry succeeds without manual process cleanup.
7. Exercise GPU CPU threads `auto`, 1, 4, and host maximum, target switches, restart, topology change where available,
   warm-up failure/retry, stale-residency rejection, and accurate labels/persistence.
8. Inspect all retained benchmark, CI, crash, package, and diagnostic evidence for prohibited content before it is
   added to the workstream.

## Contracts And Boundaries

- Qualification records may contain bounded durations, counts, anonymized platform/backend class, and aggregate
  resources only. They contain no paths, device-native/private hardware identities, audio, transcripts, prompts,
  model content, credentials, capabilities, environment dumps, or unrestricted logs.
- Unsupported/unavailable cells remain explicit; another platform or backend cannot substitute.
- A failing result is a candidate rejection/blocker, not permission to weaken security, correctness, or acceptance.

## Expected Files Or Components

- Existing qualification commands and schemas from Packet 01
- Privacy-safe aggregate evidence under a dedicated qualification subdirectory of this specification if retained
- `tasks/todo.md` and `tasks/handoff.md` completion state
- No production source change unless a discovered defect is returned to its owning packet through planning

## Acceptance Criteria

- AC-MAN-001 passes the exact Linux CPU/CUDA matrix or names explicit blockers.
- The Linux portions of AC-MAN-003 through AC-MAN-005 pass install, GPU setting, mixed-peer, and rollback recovery.
- AC-MAN-006 confirms all retained evidence is privacy-safe.
- Every selected component passes 25 percent conservative improvement and the 3 percent end-to-end/resource guardrail.

## Verification

- `npm run verify:local-whisper:qualification:inputs`
- `npm run run:local-whisper:qualification:linux`
- `npm run verify:local-whisper:qualification:linux`
- Run the Packet 01 paired-analysis command for every Linux matrix cell.
- Run the real app-to-guard install, GPU-thread, rollback, and evidence-privacy procedures defined above.

## CI Gate And Commit Discipline

- Commit only privacy-safe aggregate Linux evidence and explicit content-free blockers; never commit raw samples,
  models, audio, logs, paths, or device identities. The performance CI aggregates must validate the evidence schema,
  digest chain, locked paired analysis, thresholds, source counts, and privacy rules on both platform runners.
- Required checks for the exact pushed evidence SHA: `Quality Gates`, `Local Whisper Performance (Linux)`, and
  `Local Whisper Performance (Windows)`.
- After direct Linux verification, stop for review and obtain explicit authorization for the evidence commit and
  push. Push the immutable evidence commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI validation failure only in a later explicitly authorized invocation and a separate fix
  commit. Never amend or squash the evidence commit; push and rerun the same checks until green.
- Record evidence/fix SHAs, workflow run ID, check names, check-run URLs or IDs, final results, and the sanitized
  Linux evidence digest in `handoff.md`. Packet 14 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any missing phase, invalid sample set, threshold failure, resource regression, security/privacy issue, or platform
  blocker prevents completion and is recorded without concealment.
- Rollback means reject the candidate and restore the last coherent approved app/guard/settings/runtime set. Do not
  delete managed artifacts or user data and do not publish a release.

## Manual Gates

- `MANUAL GATE`: all representative Linux runs require authorized hardware and authenticated local artifacts. Do
  not request or store credentials in the task bundle.
- `MANUAL GATE`: package installation, disposable settings rollback, GPU topology changes, and induced failures must
  be explicitly confirmed by the operator and limited to validated disposable roots/data.
- No push occurs without the CI-gate authorization above. Upload, release, and external sharing are not authorized.

## References

- Specification Sections 4, 5, 13, 14.2, and 16.
- Packet 01's locked manifest/analyzer and Packet 12's operational documentation.

## Completion And Handoff

If every Linux gate and required CI check passes, mark Packet 13 complete, record sanitized evidence digests and
Packet 14 as the exact next packet in `handoff.md`, and stop for review. If any Linux gate fails or cannot run, leave
Packet 13 unchecked, record the exact blocker, and stop without claiming completion.
