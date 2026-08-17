# 17 Focused Linux Base Qualification

## Outcome

Make the qualification tooling executable under specification revision 7, then qualify the Packet 16 candidate
on representative Linux x64 CPU/CUDA hardware using only `base/full`, three unpaired candidate loads per
cold/warm cell, and one focused packaged lifecycle/privacy flow per backend. Remediate only Linux-specific or
qualification-tool defects and retain sanitized aggregate Linux evidence.

## Prerequisites

- Packet 16 is locally complete and reviewed; its applicable Linux automated checks pass.
- An exact candidate source/runtime/package identity can be recorded. A Git commit is used only if commit creation
  has been separately authorized; an uncommitted candidate must instead use an immutable bounded source manifest
  and artifact digests and cannot be represented as a commit SHA.
- The approved release-1 `base/full` artifact is available privately with exact size 147,951,465 bytes, together
  with candidate CPU/CUDA runtime packs, one private transcription fixture, a validated private mode-0700 parent,
  and representative supported Linux CPU/CUDA hardware.
- Existing private qualification evidence and generated artifacts remain private and must not be deleted.

## Owned Requirements

OUT-002, GAT-001–GAT-004, QUAL-001, QUAL-002, OBS-001–OBS-005, PERF-001, PERF-004,
PERF-008–PERF-012, RES-002, PRIV-001, PRIV-002, OPS-003, AC-AUT-001, AC-AUT-002,
AC-AUT-016, AC-AUT-017, AC-MAN-001–AC-MAN-008 (Linux portions).

## In Scope

- Qualification contract/schema/command/test changes needed to express a candidate-only revision-7 run.
- Candidate package only; no baseline build, package, installation, or execution.
- Linux CPU/CUDA cold-cache and warm-cache Base measurements: four cells and exactly three successful candidate
  loads per cell, for 12 successful timed model loads total.
- One sequential packaged lifecycle flow per backend: load, explicit warm-up, successful transcription,
  cancellation, unload, retry, and process-tree cleanup.
- Real CUDA ownership/no-silent-fallback confirmation, bounded RAM/VRAM evidence, one OS-level privacy inspection,
  Linux-only fixes, focused reruns, and sanitized aggregate evidence.

## Out Of Scope

- Windows source, adapters, compilation, CI, package/E2E, host checks, or Windows claims based on Linux evidence.
- Paired baseline/candidate measurements; `medium`, `large-v3`, or `large-v3-turbo`; p95, variance, uncertainty,
  relative speedup, 25-percent component, 3-percent resource/end-to-end, or absolute timing gates.
- Suspend/resume, unavailable-device, CPU-thread-count, topology/model-switch, delete/redownload, or installation-
  window manual matrices. Existing automated coverage remains unchanged.
- Production installation-window selection, new loader optimization, shared production-contract changes, release
  publication, artifact/evidence upload, private evidence deletion, or a five-second timeout.

## Task Contract

1. Audit the current qualification schemas, contracts, producers, collectors, analyzers, validators, commands,
   and tests. Add one explicit revision-7 candidate-only mode that accepts only `base/full`, candidate artifacts,
   and exactly three successful samples per cell. Historical paired evidence may remain readable, but revision-7
   commands and acceptance must not require or synthesize a baseline side.
2. Remove active assumptions that require four selected models, five or six successful pairs, paired ordering,
   p95/variance/uncertainty, relative speedup, component/resource thresholds, or installation-window selection.
   Keep deterministic validation for sample count, declared ordering, cold/warm cache preparation, phase bounds,
   resource bounds, exact identities, privacy, failures, and evidence digests.
3. Preserve qualification-input authentication as private harness behavior only. It may establish that the same
   exact Base bytes are used across attempts, but ordinary production install/load must still report zero model
   SHA-256/signature/preflight/snapshot/custom-loader work and one standard path-based load call.
4. Bind one immutable manifest to the exact candidate source, runtime, package, Base model bytes, backend,
   configuration, CPU-thread value, hardware profile, cache procedure, run ordering, attempt roots, and timeout.
   Never label a hosted fixture or a dirty source state as a direct-host commit result.
5. Install only the candidate package. Use a fresh absent child under the validated private parent for every
   attempt. The qualification cache is read-only input; it is distinct from the measured cold/warm OS cache state.
   Preserve every failed attempt with a content-free reason. A replacement attempt uses a fresh root and is
   disclosed; never select runs to manufacture a preferred timing.
6. Run, in the locked order, CPU cold, CPU warm, CUDA cold, and CUDA warm cells for the exact 147,951,465-byte
   `base/full` artifact. Each cell completes only with exactly three successful candidate model loads. Measure
   OBS-004 from accepted `load` through main-validated `loaded`; exclude installation, earlier worker handshake,
   and later explicit real-inference warm-up from this interval.
7. For every cell retain bounded aggregate sample count, ordering, three durations, median, minimum, maximum,
   distance from 5,000 ms, phase attribution, peak main/guard/worker RSS, and CUDA VRAM where applicable. Elapsed
   time or resource magnitude alone cannot fail the focused gate; missing, unsafe, malformed, or incomplete
   evidence does fail it.
8. After timed loads, run one sequential packaged flow per backend: load, explicit real-inference warm-up,
   successful transcription, cancel one active request and observe one terminal outcome, unload, retry from a
   known clean state, and confirm owned process/resource cleanup. Confirm the CUDA flow owns the selected GPU and
   never silently falls back to CPU.
9. Inspect bounded logs, diagnostics, errors/crash surfaces, and retained evidence once for Linux. No model path,
   model/audio/transcript content, raw native output, environment/capability dump, or device-native identity may
   enter retained source-controlled evidence.
10. If qualification tooling fails its new contract, make the smallest tooling/schema/test correction and rerun
    the affected contract checks before representative execution. If valid host evidence exposes a Linux-only
    production defect, make the smallest Linux fix, run focused local checks, and rerun every affected cell/flow.
    Preserve failed private evidence. Stop for planning if a fix changes shared production behavior or the
    approved qualification contract.
11. Write only privacy-safe aggregate Linux results, exact non-sensitive candidate/evidence identities, and gate
    outcomes in the specification bundle. Do not commit generated packages, models, runtime packs, raw samples,
    private manifests, caches, paths, or hardware/device identities.

## Contracts And Boundaries

- The representative host is a supported regular Linux computer; fixtures cannot claim CPU/CUDA host acceptance.
- Model load/inference stays single-owner and non-concurrent. Native resources use RAII and deterministic cleanup.
- The private model path remains absent from argv, environment, renderer/preload IPC, retained logs, diagnostics,
  errors, crash output, and aggregate evidence.
- Qualification-only input digests never become ordinary production model authentication.
- A failed load has no legacy fallback, no late success, and no reusable uncertain residency.

## Expected Files Or Components

- `scripts/local-whisper/qualification/` contracts, document producers, run-plan/attempt runners, collectors,
  aggregators, validators, and commands that currently encode paired-baseline assumptions.
- `docs/specs/local-whisper/qualification/schemas/` performance manifest, run-plan, and result schemas when the
  candidate-only contract requires schema changes.
- Focused tests under `tests/scripts/localWhisper/qualification/`.
- Privacy-safe aggregate Linux evidence inside this specification bundle plus `tasks/todo.md` and
  `tasks/handoff.md`.
- Linux-only production files only when representative evidence proves a defect.

## Acceptance Criteria

- Candidate-only schemas and validators accept no baseline side and reject a wrong model/size, wrong sample count,
  inconsistent ordering/cache/identity, timing-gate semantics, missing resource data, and privacy-unsafe evidence.
- The exact Base artifact completes CPU/CUDA cold/warm qualification with three successful candidate loads per
  cell. Every cell reports median, minimum, maximum, and distance from five seconds without timing pass/fail.
- Candidate package CPU and CUDA flows pass load, warm-up, transcription, cancellation, unload, retry, cleanup,
  zero ordinary model-content proofs, one standard path API call, and no legacy fallback.
- CUDA ownership is real and explicit; no CPU fallback is accepted as CUDA evidence.
- Bounded RAM/VRAM and Linux privacy evidence is complete, sanitized, bound to exact candidate identity, and all
  private evidence remains retained outside source control.

## Verification

Run the smallest applicable checks after each tooling change, then the focused Linux set:

- `npm run test:local-whisper:performance-contracts`
- `npm run test:local-whisper:performance-runner`
- `npm run test:local-whisper:qualification`
- `npm run verify:local-whisper:qualification:inputs`
- `npm run verify:local-whisper:qualification:linux-private-inputs`
- `npm run produce:local-whisper:qualification:linux-performance-plans`
- `npm run run:local-whisper:qualification:linux`
- `npm run verify:local-whisper:qualification:linux`
- `npm run verify:local-whisper:performance:linux`
- Candidate-package CPU/CUDA procedures in Task Contract 6–9.
- `npx prettier --check docs/specs/local-whisper-performance-remediation scripts/local-whisper/qualification tests/scripts/localWhisper/qualification`
- `git diff --check`

Commands that consume private arguments run only after their private-input preflight succeeds. No CI or Windows
check is run or inspected in this packet.

## Failure And Rollback

- Missing hardware/artifacts, invalid identity, partial cells, wrong sample counts, malformed/missing evidence,
  CUDA fallback, lifecycle/cleanup failure, privacy leakage, or unsafe retry leaves Packet 17 unchecked.
- Keep failed private evidence. Retry only from a new safe attempt root after resources reach a known clean state.
- Revert qualification-tool edits if the candidate-only contract cannot be made backward-safe. Reject the
  candidate for a production defect; never activate the deprecated loader as fallback.

## Manual Gates

- `MANUAL GATE`: private model/fixture/runtime/package access, candidate package installation, cache preparation,
  representative Linux CPU/CUDA execution, induced cancellation, and private evidence retention.
- `MANUAL GATE`: any commit requires separate authorization. No push, CI, external upload, publication, release,
  or private evidence deletion is authorized in this packet.

## References

- Specification Sections 4, 5, 12–16.
- Packets 13–16 for the retained private evidence, attempt-runner, and standard-loader foundations.
- `docs/agent-guides/project-conventions.md` sections “Tests And Documentation” and “Git And Releases”.

## Completion And Handoff

After all Linux gates pass, mark Packet 17 complete and update `todo.md` and `handoff.md` with the exact
non-sensitive candidate identity, sanitized aggregate evidence digest, four cell outcomes, lifecycle/CUDA/
resource/privacy outcomes, changed files, and verification results. Name
[Packet 18](18_windows_final_remediation.md) as the sole next packet and stop without Windows work, push, CI,
publication, installation-window selection, or private evidence deletion.
