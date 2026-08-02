# Local Whisper Handoff

## Authoritative State

- Specification revision 6 and plan revision 11 are Approved. Tasks 01–09 are
  committed; Task 10 is complete and intentionally uncommitted for review.
- Task 10 was authorized by `execution.task-10-revision-11`. Prompt sequence
  48 authorized local integration use of the exact public MIT model fixture
  below. It was never downloaded, copied into the repository, staged, or
  logged by Task 10.
- Remote CI remains deferred until pull-request creation. The Windows native
  checks remain in the `windows-latest` job, and representative Windows
  product qualification remains Task 19-only.

## Completed Task 10

- Migrated the unreleased authority common binding to 226 bytes with positive
  expected artifact size and authenticated content digest. Exact
  `LWAR1`/`LWAT1`/`LWAA1` sizes are 234/244/284 bytes across TypeScript,
  C++20, Python, Linux handoff, vectors, and tests. The vector manifest SHA-256
  is `632ed822b6a029aa9e01a2f05e394baae44205e78fffb0c67213e13ba2a70baa`.
- Added the modular C++20 Whisper.cpp worker: same-handle authority, checked
  exact reads and observed EOF, immutable loader-limit enforcement, format
  preflight, CPU proof, PCM conversion, state machine, POSIX production
  channels, Windows source skeletons, RAII engine adapter, and deterministic
  typed failures. Stateful worker behavior is covered by injected unit tests.
- Locked source `whisper-cpp-v1.9.1-f049fff` has original manifest
  `aeaed8ce38467815c0b3ee64f05bd7989bba42bb0baccd5dba853247a7f680de`.
  Patch lock `local-whisper-whisper-cpp-core-v1` uses patch SHA-256
  `0581d1a6eb54a4041a41a0db22b1102523eb9bf4f9b880b203e4b2598c03b27b`
  and patched manifest
  `22067a89df003e5b603f34c74cd6c84fc8698efe8a4c55d09523090d390fdc3e`.
  Loader table `whisper-cpp-loader-limits-v1` has SHA-256
  `5585ea2aeeb4d4b6a4293f8a044487e8d629d899e9d760d9f143a9fb4c702ff5`.
- Built and staged profile `linux-x64-cpu-baseline-v1` with runtime build
  digest `d8b8503ebf8debcb7b0b3271bc2c91263078a76e2c9b152351141a8c5171f7f7`.
  The exact pack closure includes the worker, Whisper.cpp and nlohmann/json
  licenses/notices, locked provenance, system runtime dependencies, SPDX 2.3
  SBOM, and expected-files evidence. It includes no model or GPU backend.
- Real integration fixture: `ggml-medium.bin`, 1,533,763,059 bytes, SHA-256
  `6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208`,
  MIT, origin
  `ggerganov/whisper.cpp@5359861c739e955e79d9a303bcbc70fb988958b1`.

## Changed Files

- Approved plan-revision artifacts under `docs/specs/local-whisper/` and the
  Task 10 checklist/handoff.
- Authority codecs, guard validation, supervisor DTO/tests, protocol vectors,
  generator, and Python reference peer under `src/`, `runtime/local-whisper/`,
  `scripts/local-whisper/`, and `tests/fixtures/local-whisper/`.
- New `runtime/local-whisper/whisper-cpp/` modular source, patch lock, CMake,
  GoogleTests, quality configuration, Windows skeleton, and concise README.
- New build, verification, staging, integration, audit, and locked-source
  provisioning scripts; package commands; and Linux/Windows-owned PR workflow
  checks in `.github/workflows/pr-checks.yml`.

## Verification

- Deterministic vector generation and clean verification; TypeScript, C++20,
  and Python authority suites; Linux executable handoff; Windows authority
  contract-only verification; immutable loader-limit verification.
- GCC 13 and Clang 18 ASan/UBSan core 9/9 and loader 5/5 suites with
  warnings-as-errors, clang-format 18, and clang-tidy 18.
- Linux CPU build, staging verification, exact ELF dependency/RPATH checks,
  real probe/load/warm-up/transcription/unload with the approved medium model,
  and repeated relocation/network-denied malicious-environment audit.
- Windows CPU source/CI contract-only verification. No Windows runner, VM,
  Wine, binary, or representative execution was used.
- Worker codec, repeated authority, and supervisor 33/33 suites; repository
  typecheck, type tests, lint, format check, script syntax, scoped
  `git diff --check`, and complete `git diff --check`.

## Exact Next Step

- Review the uncommitted Task 10 and approved plan-revision changes. Task 11,
  [Whisper.cpp CUDA Pack](11_whisper_cpp_device_proof_cancellation_and_cuda_pack.md),
  is the next packet, but must not start in this invocation. There are no Task
  10 implementation blockers.
