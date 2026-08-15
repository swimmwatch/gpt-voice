# Local Whisper Performance Remediation Handoff

- Completed locally: Packets 01–15. Packet 03 is pushed but its CI remains deliberately uninspected. Packet 04 is
  committed as `141ae5bf`; Packet 05 as `bc8ba18f` with source-baseline fix `20260098`; Packet 06 as `e063c0d`
  with TSan registration `e66115d`; Packet 07 as `80cea99`; Packet 08 as `b20e28bf`; Packet 09 as `c1aba25`;
  Packet 10 as `4daa246`; Packet 11 as `b1c0153`; Packet 12 as `0885281`; Packet 13 as `b5101ed`; and Packet 14
  as `e3136f27`. Packet 15 is complete and intentionally uncommitted. No Packet 04–15 change was pushed or inspected
  in CI, and no Windows or representative-host result is claimed.
- Packet 15 adds the reviewed byte-identical baseline/candidate instrumentation overlay, authenticated Linux
  app-to-guard attempt executable, bounded phase-event protocol, role-aware main/guard/worker PSS and owned-PID GPU
  sampling, populated-cache/absent-private-child preflight, streaming runtime-pack inspection, and CPU/CUDA private
  run-plan production. Derived builds compile instrumented CPU and CUDA runtime packs for both parents; authenticated
  packed provenance supplies runtime identity. Baseline keeps its serial installation window, and candidate-window
  activation exists only in private derived sources.
- Failure, cancellation, cleanup, and privacy paths are fail closed: malformed or late native frames, unknown/reused
  process identities, incomplete settlement, unsafe paths, mutable artifacts, cache mutation, overlay/source drift,
  and build interruption produce bounded failures. Attempt-owned roots are cleaned without following symlinks; no PID,
  path, device identity, raw sampler series, model, audio, or transcript enters retained aggregate evidence.
- Changed files are grouped under the schema-v3 performance contracts, `package.json`, the Packet 15 qualification
  modules and CLIs in `scripts/local-whisper/qualification/`, the qualification-only native probe header in
  `runtime/local-whisper/common/include/local_whisper/common/`, focused tests in
  `tests/scripts/localWhisper/qualification/`, and the revision-6 planning artifacts in this task bundle. No generated
  derived tree, executable, runtime pack, model, cache object, raw sample, or private receipt is tracked.
- Packet 15 checks pass: `test:local-whisper:performance-runner` (25/25), performance contracts, full qualification,
  filesystem, artifacts, worker-common native GCC and ASan/UBSan, Whisper.cpp core and cancellation, native-build
  audits, sanitizer proof, TSan proof and suite, native clang-format and clang-tidy, private input/performance
  verifiers, `format:check`, `lint` with repository warnings only, `typecheck`, `test:types`, and
  `git diff --check`. The source proof still reports seven Linux and six Windows full-model proofs, and the pinned
  backend-option inventory has no drift.
- A native clang-format failure in the new probe header was corrected and the affected native, sanitizer, and race
  checks were rerun successfully. Final exact baseline `1f6ce9c988a275f1ef9faa295b1bb04879943e89` and candidate
  `e3136f270e808fac932c23f19cee70dba34551fd` derived trees compiled through CPU/CUDA runtime packaging, bound their
  SEA executables, and passed the invalid-argument smoke with an inherited private channel and empty stderr. No model
  or representative/private workload was executed.
- Disposable derivation/build roots remain operator-owned for review; their paths are intentionally not recorded and
  no destructive cleanup was performed. Candidate qualification state remains `Pending`.
- Exact next packet: [16 Representative Linux host qualification](16_representative_linux_host_qualification.md).
  It is the manual authenticated Linux CPU/CUDA collection gate and requires a populated immutable qualification cache,
  a validated mode-0700 private parent, and an absent orchestrator-owned child. Packet 17 retains all Windows
  implementation, deferred CI/MSVC/package/direct-host checks, and Packet 18 owns separate fixes, cross-platform
  requalification, and final production selection. Commit, push, CI inspection, Windows work, publication, and release
  remain unauthorized.
