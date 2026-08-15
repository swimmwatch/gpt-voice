# 16 Representative Linux Host Qualification

## Outcome

Freeze the exact candidate and run the schema-v3 paired baseline/candidate matrix on representative Linux CPU/CUDA
hardware for every model and pipeline window. Retain only privacy-safe aggregate evidence for the later Windows
comparison and mandatory final selection.

## Prerequisites

- Packets 13–15 are complete, reviewed, and committed. Their collector, derived-source contract, attempt runner,
  analyzer, per-model identity, and role-aware Linux resource adapter pass all local checks.
- The baseline commit is `1f6ce9c988a275f1ef9faa295b1bb04879943e89`. The candidate commit is the exact clean
  full SHA containing Packets 01–15; record it before preparing artifacts and never mix later work into the run.
- The operator has authenticated release-1 catalog/model/runtime inputs, the approved predecessor AppImage and
  advisory evidence, representative Linux x64 CPU/CUDA hardware, and one validated disposable run root. None of
  these private paths or artifacts is retained in the repository.
- The current source proof is seven Linux/six Windows full-model hashes with digest
  `a8a6ede6a48ce6d8b591a46e77867ca0e2a26b5a75084b401d9159b4cdd363ee`.

## Owned Requirements

OUT-001, SCP-001, PERF-001, PERF-002, PERF-003, PERF-004, PERF-005, RES-002, QUAL-001, OBS-001, OBS-002,
OBS-003, AC-MAN-001, AC-MAN-003, AC-MAN-004, AC-MAN-005, AC-MAN-006.

## In Scope

- Candidate freeze through the production Linux qualification command and schema-v2 state verification.
- Six planned paired attempts, with at least five successful pairs, for each `base/full`, `medium/full`, and
  `large-v3/q5_0` × CPU/CUDA × window 1/2/4/8 × cold/warm cell that the support contract marks eligible.
- Component gains, end-to-end/resource guardrails, source proof count, effective backend options, real install
  failure/retry, GPU-thread behavior, mixed-peer and settings rollback checks, and evidence privacy inspection.
- Sanitized aggregate Linux result documents and explicit content-free unsupported/unavailable/blocker records.

## Out Of Scope

- Collector/schema implementation, Windows code or execution, CI inspection, branch push, performance tuning,
  replacing failed samples, changing thresholds/support, selecting the production window, publication, upload, or
  retention of private plans, raw samples, paths, models, packages, logs, audio, or transcripts.

## Task Contract

1. Verify that the baseline and candidate worktrees are clean and resolve to their exact full SHAs. Re-run
   `verify:local-whisper:qualification:inputs` and reject any source-proof, catalog, artifact, profile, or fixture
   drift before building or measuring.
2. Prepare the production Linux qualification invocation with all ten existing arguments. Each value has one source:
   `advisory-evidence-dir` is the validated native advisory evidence directory; `cache-root` is an existing populated
   private qualification cache validated by Packet 15's read-only preflight, containing exact model/FLEURS,
   CPU/CUDA runtime-pack, direct-engine, and sibling native-source notice inputs; `candidate-semver` is the exact
   `package.json` version at the candidate SHA; `candidate-worktree` is the clean candidate worktree; `evidence-root`
   is the canonical Local Whisper qualification evidence root; `freeze-timestamp-utc` is one whole-second UTC
   timestamp fixed before building; `predecessor-appimage` is the approved authenticated predecessor;
   `private-run-root` is an absent child path under an existing validated mode-0700 disposable parent and is created
   mode 0700 by the orchestrator; `source-commit` is the candidate full SHA; and `workspace-root` is the candidate
   worktree root. The cache is input, not the performance cold/warm cache, and remains byte-identical throughout.
3. Run the exact command below with all placeholders resolved locally. Do not preserve the expanded command or path
   values in repository evidence. A missing required input, pre-existing private-run child, duplicated, changed,
   non-absolute, unsafe, or identity-mismatched value blocks the run. If a failed run created its private child,
   retain it as private evidence and retry only with a new absent sibling:
   `npm run run:local-whisper:qualification:linux -- --advisory-evidence-dir=<absolute-validated-directory> --cache-root=<absolute-validated-populated-qualification-cache> --candidate-semver=<candidate-package-version> --candidate-worktree=<absolute-clean-candidate-worktree> --evidence-root=<absolute-canonical-evidence-root> --freeze-timestamp-utc=<YYYY-MM-DDTHH:MM:SSZ> --predecessor-appimage=<absolute-authenticated-appimage> --private-run-root=<absolute-absent-private-run-child> --source-commit=<candidate-full-sha> --workspace-root=<absolute-clean-candidate-worktree>`.
4. Run `verify:local-whisper:qualification:linux`. Continue only when the schema-v2 state reports `candidateState:
Frozen`, binds the candidate SHA and expected artifact/result/evidence digests, and still reports representative
   Windows execution as not run.
5. Under the disposable root, use Packet 15's producer to create one schema-v3 performance run plan for Linux CPU and
   one for Linux CUDA. Both plans bind the same baseline/candidate SHAs, exact derived-source receipt and identical
   instrumentation-overlay digest, exact attempt/runtime/model artifacts, model matrix, cold/warm method, fixed
   six-pair alternating order, 100 ms interval, statistic, uncertainty, and source proof. Execute, for each backend:
   `npm run collect:local-whisper:qualification:performance -- --platform=linux --backend=<cpu|cuda> --mode=representativeHost --root=<absolute-disposable-root> --input=<root-relative-run-plan> --output=<root-relative-private-bundle>`.
6. Analyze each private bundle with Packet 13's generic aggregate command, writing a new root-contained aggregate
   output exclusively. Require all three model identities and every window/cache cell. Keep failed attempts in place;
   do not add replacements or rerun a subset to manufacture a pass.
7. For every already-selected performance component, require point estimate minus uncertainty of at least 25 percent.
   For every window, report the same component gate and reject any applicable end-to-end or peak-resource regression
   over 3 percent after uncertainty. Keep `selectionStatus: awaitingCrossPlatform` and the production value null.
8. Confirm exactly seven Linux full-model proofs remain; every later freshness, authority, preflight, and
   loader-consumption proof executes. Confirm backend option work has zero unexplained effective-value drift.
9. Run windows 1/2/4/8 against maximum-artifact normal, slow-pipe, cancellation, and induced mid-window failure.
   Publication is exact or staging is absent, owned processes settle, and retry succeeds without manual cleanup.
10. Exercise GPU CPU threads `auto`, 1, 4, and host maximum; target switching; restart; available topology change;
    warm-up failure/retry; stale-residency rejection; mixed protocol peers; and schema-v2 rollback in disposable data.
11. Inspect the proposed aggregate result and handoff text for prohibited content before retaining them. Record only
    content-free blockers, aggregate outcomes, and SHA-256 digests of sanitized documents.

## Contracts And Boundaries

- The disposable run root must not be a filesystem root or user-data root. It contains private worktrees, artifacts,
  run plans, cache receipts, and raw bundles and is never committed, uploaded, or pasted into logs/handoff.
- The populated qualification cache is a separate authenticated read-only input. Packet 15's preflight must validate
  every referenced identity and the required sibling model-notice source before the production command. Neither the
  production freeze nor performance cold/warm preparation may create, replace, chmod, or delete cache entries.
- The production private-run parent must exist as a nonsymlink mode-0700 directory, while the exact child passed to
  the orchestrator must not exist. Any created child is owned by that attempt and is never reused after failure.
- Qualification may output bounded durations, counts, model family/variant, anonymized platform/backend class,
  candidate-window gates, and aggregate resources. It must not output private paths, host/device-native identities,
  model content, audio, transcript, prompt, credential, capability/environment dump, or raw native output.
- Cold-cache preparation is the fixed Packet 13 Linux adapter procedure. If it cannot produce its bounded receipt,
  report the cell blocked; do not use privileged global cache dropping or substitute another procedure.
- A valid failure is evidence. It cannot weaken security, privacy, correctness, compatibility, thresholds, or the
  requirement for Windows evidence before selection.

## Expected Files Or Components

- Canonical schema-v2 Linux qualification state/result/evidence index
- A privacy-safe Linux aggregate evidence document under this specification's qualification evidence directory
- `tasks/todo.md` and `tasks/handoff.md`
- No production source file, generated package, model, runtime pack, raw sample, private run plan, or cache receipt

## Acceptance Criteria

- AC-MAN-001 executes the exact Linux CPU/CUDA matrix; every applicable cell has six planned attempts, at least five
  successful pairs, every required phase/resource, and an aggregate pass/fail/blocker result for each window.
- Linux portions of AC-MAN-003 through AC-MAN-005 pass the real install, failure/retry, GPU-setting, mixed-peer, and
  rollback procedures or retain an explicit content-free blocker.
- Every selected component meets the 25 percent conservative gate and no applicable end-to-end/resource regression
  exceeds 3 percent after uncertainty. Candidate windows remain individually reported and unselected.
- AC-MAN-006 confirms every retained document and handoff is privacy-safe and bound by digest to the exact candidate.

## Verification

- `npm run verify:local-whisper:qualification:inputs`
- Packet 15's read-only populated-cache/private-parent preflight command
- The fully populated ten-argument `npm run run:local-whisper:qualification:linux -- ...` command from Task Contract 3
- `npm run verify:local-whisper:qualification:linux`
- Both CPU/CUDA collector invocations from Task Contract 5
- Packet 13's aggregate command for each private bundle
- Real install, GPU-thread, mixed-peer, rollback, cleanup/retry, and evidence-privacy procedures from this packet

## Failure And Rollback

- Missing freeze identity, invalid samples, unavailable required phases/resources, threshold failure, resource
  regression, cleanup failure, or privacy/security issue leaves Packet 16 unchecked and records a bounded blocker.
- Rollback means reject the candidate evidence and retain the last coherent approved app/guard/settings/runtime set.
  Do not delete managed models, runtime artifacts, settings, user data, or valid failure evidence.

## Manual Gates

- `MANUAL GATE`: the operator authorizes representative Linux CPU/CUDA use, authenticated local artifacts, package
  installation, fixed cache preparation, disposable settings/data, induced failures, and topology changes.
- `MANUAL GATE`: destructive cleanup is limited to the exact validated disposable run root after required private
  evidence has been summarized and reviewed. No broad recursive action or user-data cleanup is permitted.
- No push or CI inspection occurs. Upload, publication, release, and external sharing remain unauthorized.

## References

- Specification Sections 4, 5, 13, 14.2, and 16.
- Packets 13–15's collector, derived-source, attempt-runner, and input-preflight contracts, plus Packet 12's
  operational/rollback documentation.

## Completion And Handoff

After valid Linux evidence is reviewed, mark Packet 16 complete, record the exact candidate SHA, sanitized evidence
digest, per-window outcomes, and any content-free blocker. Name
[17 Windows End-To-End Qualification](17_windows_end_to_end_qualification.md) as the exact next packet and stop. Do
not push, inspect CI, implement Windows APIs, run Windows checks, or select a production window.
