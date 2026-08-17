# Local Whisper Performance Remediation Handoff

- Approved specification revision 7 selects standard path-based `whisper.cpp` loading with zero ordinary
  model-content proofs and a focused Base-only representative qualification. Approved plan revision 8 replaces
  the stale remaining paired/multi-model qualification plan.
- Packets 01–15 remain complete with their existing history. Packet 16 is committed locally as `0428b76` and
  intentionally unpushed; no CI, Windows, package installation, representative qualification, release, or
  evidence cleanup was performed.
- Packet 16 activates protocol-v2 metadata-only model installation and private main-to-worker path loading,
  validates Linux path/type/size immediately before one standard `whisper_init_from_file_with_params` call, and
  keeps authenticated reader, preflight, descriptor/handle authority, and model-proof code deprecated and
  inactive.
- The pinned exact-read patch preserves exact EOF detection for the standard file API. CPU and CUDA local
  build/pack/lifecycle checks pass. All private evidence remains retained.
- Passing Packet 16 checks include typecheck, lint, Prettier, protocol codec/vectors, supervisor, composition,
  filesystem, artifacts, qualification, native core/loader/cancellation, TSan, native hardening, CPU and CUDA
  build/verify/integration, and `git diff --check`.
- Packet 17 now has uncommitted candidate-only revision-7 qualification tooling: Base/full-only v4 schemas and
  document/result validators, six-cell (three cold + three warm) candidate collection and aggregation, a
  candidate-only Linux plan command, and local contract fixtures. The source/overlay identity pins were corrected
  to the already committed Packet 16 sources; the checks did not weaken the standard-loader source proof.
- Passing Packet 17 local checks: `npm run test:local-whisper:performance-contracts`,
  `npm run test:local-whisper:qualification`, `npm run verify:local-whisper:qualification:inputs`,
  `npm run verify:local-whisper:performance:linux`, `npm run typecheck`, targeted Prettier, and `git diff --check`.
- Packet 17 Linux manual gates remain incomplete. Retained private CPU collections from fresh roots recorded only
  the content-free `RESOURCE_SAMPLER_TIMEOUT` failure, so none is accepted as qualification evidence. The
  collector now bounds and owns sampler cleanup, waits for the attempt event pipe to close, and serializes attempt
  requests canonically; targeted adapter/resource/runner tests, typecheck, and Prettier pass. A fresh packaged CPU
  diagnostic now reports `ATTEMPT_RUNTIME_ARTIFACT_PRIMARY_CLEANUP_FAILED` with a clean process exit and incomplete
  event proof: runtime staging cleanup fails before model loading. Qualification-only safe failure propagation in
  local commits `8c162e2`, `9255d24`, `4d0147c`, and `e23ecbf` distinguishes this from model/CUDA failure without
  emitting paths, native output, or private manifest data. Private roots and a private file-syscall trace remain
  retained. Do not begin CPU/CUDA sample series, lifecycle checks, or CUDA work until the Linux runtime staging
  cleanup failure has a confirmed minimal fix and a fresh CPU attempt has complete event proof.
- Packet 17 remains unchecked: private Base model/fixture/runtime/package access, candidate-package installation,
  cache preparation, representative CPU/CUDA execution, lifecycle/cancellation/cleanup, CUDA ownership, resource
  and privacy inspection, and retained sanitized Linux evidence are explicit manual gates. Resume Packet 17 for
  those gates; then Packet 18 is the sole Windows implementation, CI, package/E2E, remediation, and final focused
  qualification task.
- Follow-up Linux-only diagnostic commits `a6d01f0` and `d0c3f54` retain a failed staging lease for cleanup and
  construct native promotion responses before rename on Linux and Windows. Focused store/native guard tests,
  qualification-runner tests, typecheck, changed-file formatting, and `git diff --check` pass; the repository-wide
  fs-guard format gate remains blocked by a pre-existing format violation in an untouched legacy header.
- Fresh private Base CPU cold diagnostics after those fixes still terminate before model loading with the safe
  `ATTEMPT_RUNTIME_STAGING_REMOVE_FAILED` response and incomplete resource proof. The attempt process itself exits
  cleanly; all private evidence is retained. A system-call trace attach was unavailable on this Linux host, so it
  produced no trace evidence. Do not start a further CPU/CUDA qualification sample series until the staging-remove
  failure has an observable root cause and a minimal validated fix.
- Current Packet 17 work supersedes the stale staging-removal diagnosis above. Uncommitted qualification-only
  telemetry now reports fixed, content-free milestones from staging through artifact completion, settings, and the
  worker load boundary. Fresh private Base CPU diagnostics reached `loadRequested` within 20 seconds, but a separate
  60-second attempt did not reach `modelAuthorityStarted` or create a native load event. Therefore installation,
  inventory refresh, terminal artifact completion, and settings persistence are not the active blocker; the remaining
  Linux-only blocker is the coordinator preflight immediately before worker authority acquisition. Retain all private
  roots and do not start CPU/CUDA sample series, lifecycle checks, Windows work, or CI until that boundary has a
  minimal verified fix. Passing local checks for this diagnostic update: performance-runner, composition, focused
  artifact tests, typecheck, targeted Prettier, and `git diff --check`.
