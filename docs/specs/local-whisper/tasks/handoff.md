# Local Whisper Handoff

## Authoritative State

- Specification revision 6 and plan revision 11 are Approved. Tasks 01–11 are
  committed; Task 11 is authoritative at `24e268f`.
- Task 12 has not started and requires a new explicit incremental-implementation
  invocation.
- Remote CI remains deferred until pull-request creation. Windows CPU/CUDA
  checks remain contract-only in the dedicated `windows-latest` job;
  representative Windows execution remains Task 19-only.

## Completed Task 11

- Added the private 40-byte `LWDA1` device authority, canonical CUDA PCI
  registry, stable double enumeration, exact `LWREG1`/`LWDEV1P`/`LWDEV1L`
  proof generation, selected-device dispatch, model-buffer ownership, and
  primary-state validation. Raw device identities stay on private worker
  channels and are hashed in local evidence.
- Added state-owned cooperative cancellation and terminal arbitration across
  project checkpoints and the locked upstream abort patch. Cancellation wins
  over later native success and emits no transcript; supervisor timeouts retain
  the existing forced process-cleanup boundary.
- Locked patch series `local-whisper-whisper-cpp-device-cancel-v1`: core patch
  SHA-256
  `0581d1a6eb54a4041a41a0db22b1102523eb9bf4f9b880b203e4b2598c03b27b`,
  device/cancellation patch SHA-256
  `57dd199f02d05062ef25d6599f3ff626dc30faf02c86e1de47235445ea04821b`,
  intermediate manifest
  `22067a89df003e5b603f34c74cd6c84fc8698efe8a4c55d09523090d390fdc3e`,
  final manifest
  `a6215efee754e586d7346a1d6716e3ccc4426cf38efb211c4397789fc2127404`.
- Built and verified CUDA profile
  `linux-x64-cuda-12.8.1-sm120a-v1`, runtime build digest
  `6e57c20eb881e2fd17f109b14a723f0719a4fd21c2b0fa573f81b4d483b4c88a`.
  It contains only `sm_120a` code, stages the reviewed CUDA 12.8.1 runtime
  closure, includes no model, disables dynamic backend discovery, and records
  source plus transformed hashes for staged NVIDIA libraries.
- Real local evidence is limited to the available NVIDIA GeForce RTX 5070 Ti
  Laptop GPU, driver 595.84, CUDA 12.8.1, GCC 13.3.0, and the approved medium
  model. Three load cycles produced stable selected-device model-weight
  evidence of 1,533,143,040 bytes, two transcriptions, one cooperative
  cancellation, and unload memory observations. Private evidence remains under
  ignored `.cache/local-whisper/`.
- Rebuilt and verified CPU profile `linux-x64-cpu-baseline-v1` against the same
  final patch series; runtime build digest is
  `a87307c3b6cf367dd3f47df58b84cd9d8437a96bc409afc6838dbdce9866dd36`.
  Real CPU load, warm-up, transcription, cancellation, and unload passed.
- Hardened relocation with manifest-owned ELF RPATH. CUDA and CPU packs pass
  network-denied malicious-CWD, `GGML_BACKEND_PATH`, `PATH`, and
  `LD_LIBRARY_PATH` audits. Windows source contracts and CI commands were added
  without executing a Windows host, VM, Wine, or substitute runner.

## Changed Areas

- `runtime/local-whisper/whisper-cpp/`: modular device authority/registry,
  cancellation, adapter evidence, Windows skeleton, GoogleTests, CMake, README,
  and immutable upstream patch series.
- `scripts/local-whisper/`: CPU/CUDA build, staging, verification, real
  integration, pack audit, shared harness, and patch-lock validation.
- `runtime/local-whisper/sources/schema/`, `package.json`, and
  `.github/workflows/pr-checks.yml`: patch-series schema, commands, format/lint
  coverage, and platform-owned CI contracts.
- `docs/specs/local-whisper/tasks/todo.md` and this handoff.

## Verification

- GCC 13 and Clang 18 ASan/UBSan: core 10/10, loader 5/5, device-proof 7/7,
  cancellation 3/3; warnings-as-errors, clang-format 18, and clang-tidy 18.
- Language-neutral proof vectors passed in TypeScript, C++20, and Python.
  Supervisor conformance passed 33/33.
- Exact CUDA build/verify/integration/audit and CPU
  build/verify/integration-with-cancellation/audit commands passed. Both
  Windows CPU/CUDA contract-only commands passed without Windows execution.
- Repository typecheck, type tests, zero-warning lint, format check, scoped
  `git diff --check`, and complete `git diff --check` passed. Remote CI was not
  run.

## Exact Next Step

- A later explicitly authorized incremental-implementation invocation may
  implement Task 12. There are no Task 11 blockers.
