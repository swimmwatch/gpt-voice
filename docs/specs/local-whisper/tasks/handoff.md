# Local Whisper Handoff

## Authoritative State

- Specification revision 6 and plan revision 10 are Approved. Tasks 01–09 are
  committed at `d0083259`, `d516d034`, `14749e88`, `649ec3b9`, `32440674`,
  `e294e8a`, `31c13c54`, `e3639bcc`, and Task 09 commits `2b920b0` and
  `b18700e`.
- Task 09 was authorized by `execution.task-09-revision-10`, sequence 47,
  revision 1, and is complete and committed. The user authorized exact
  dependency acquisition and Codex self-review on 2026-08-02; this record does
  not claim human review.
- Do not start Task 10, push, open a pull request, package, publish, or
  run representative qualification without the matching authorization.

## Completed Task 09

- Protocol v1 has bounded duplicate-aware JSON, exact authority/proof DTOs
  without `modelPath`, canonical PCM16/16-kHz WAV framing, bounded audio
  accumulation, sample-derived deadlines, asynchronous evidence revalidation,
  and fresh probe/full-load lifecycle ownership.
- The checked-in schema-2 vector manifest has SHA-256
  `f2cdb85c0eaf6b3f9b62057d11a38a0a9918c14d7a06fe0b6afe3f7cafb45222`.
  TypeScript, C++20, and Python peers consume the same control, lexical, WAV,
  registry/proof, and model-authority vectors.
- Fixed-width authority records are `LWAR1` 226 bytes, `LWAT1` 236 bytes, and
  `LWAA1` 276 bytes. Linux uses credentialed one-use descriptor transfer, fd 3,
  exact worker acknowledgment/release ordering, and replay rejection. Windows
  retains source/compile contracts; product qualification remains Task 19.
- Native CMake requires only verified nlohmann object
  `1bd7718fe4b5a7e2aebe60abc6f5f94c313d8f472542e715766158a738e8ea47` and
  GoogleTest object
  `9150f03cee9cb222456fcd0945d5285a1742b080c7ad7c47ed88b95c518afe7c`,
  without `FetchContent`, URLs, `find_package`, or ambient fallback.
- The Task-08 locked importer now has a bounded Task-09 provisioning wrapper
  for clean PR runners. Its cold path imported and verified both source objects
  locally. The Linux native-quality job is pinned to Ubuntu 24.04; the existing
  Windows native-quality job remains on `windows-latest` with its MSVC,
  launcher Job Object, and Windows authority contract checks.
- Exact Ubuntu 18.1.3 clang-format, clang-tidy, and builtin headers were
  acquired without sudo into the ignored private toolchain cache. Package
  scripts discover them by default and retain explicit CI overrides.

## Changed Files

- Shared protocol/audio/JSON modules under `src/shared/localWhisper/` and
  authority, lifecycle, deadline, and supervisor modules under
  `src/main/localWhisper/supervisor/`.
- Cross-language native peers under `runtime/local-whisper/common/`, plus
  Linux/Windows authority modules in `runtime/local-whisper/fs-guard/` and
  `runtime/local-whisper/launcher/`.
- Protocol fixtures and focused TypeScript, C++/GoogleTest, Python, supervisor,
  launcher, and authority tests under `tests/` and the native runtime folders.
- Vector generation, native quality resolution, locked-source provisioning,
  and authority verification scripts under `scripts/local-whisper/`, with
  package commands in `package.json`.
- Native CMake/README updates and `.github/workflows/pr-checks.yml` Linux and
  Windows native-quality definitions.

## Verification

- Both verified native-source checks; provisioning reuse and cold-import paths;
  deterministic vector generation and `--check-clean`.
- Worker codec, proof, and authority suites under GCC 13 warnings-as-errors and
  Clang 18 ASan/UBSan warnings-as-errors; Python reference tests pass 3/3.
- Supervisor 33/33; direct protocol 5/5; fs-guard unit 11/11 and integration
  4/4; launcher unit 5/5 and Linux authority integration 3/3.
- Worker-common, fs-guard, and launcher clang-format 18 and clang-tidy 18 gates.
- Linux executable authority and local Windows source-contract-only verification.
  No Windows runner, Windows binary, or remote CI workflow was executed.
- Repository `typecheck`, `test:types`, `lint`, and `format:check`; workflow YAML
  and Linux/Windows job-boundary assertions; scoped and complete
  `git diff --check`.

## Exact Next Step

- Task 09 is committed. The next packet is
  [10 Hardened Whisper.cpp Core And CPU Worker Pack](10_hardened_whisper_cpp_core_and_cpu_pack.md),
  but it requires a later incremental-implementation invocation and explicit
  execution authorization.
- Windows CI runs only after pull-request creation; Task 19 still owns final
  representative Windows product qualification.
