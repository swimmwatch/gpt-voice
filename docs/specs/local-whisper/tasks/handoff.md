# Local Whisper Handoff

## Authoritative State

- Specification revision 6 and plan revision 10 are Approved; Tasks 01–07
  remain complete at `d0083259`, `d516d034`, `14749e88`, `649ec3b9`,
  `32440674`, `e294e8a`, and `31c13c54`.
- Task 08 is complete and uncommitted. It was authorized by
  `execution.task-08-revision-10`, sequence 44, revision 1; sequence 45
  authorized the five exact imports and pinned Linux tool
  acquisition/licenses. On 2026-08-02 the user explicitly instructed Codex to
  fix the remaining quality issues and approve the review/promotion itself.
  Generated records truthfully name `Codex agent under explicit user
authorization`; they do not claim human review.
- Do not start Task 09, commit, push, package, publish, or execute Windows.

## Completed Task 08

- Two clean imports reproduced the five candidate/manifest identities:
  `whisper.cpp` `c7af491d629f1db493cc19bf36918dff5d82d06c9c699a9abe17112088084303`
  / `aeaed8ce38467815c0b3ee64f05bd7989bba42bb0baccd5dba853247a7f680de`;
  nlohmann subset
  `f9403ba67793e6617452dc5ff7837a90d3aed03d51e98e7bd42446ae3c460793`
  / `1bd7718fe4b5a7e2aebe60abc6f5f94c313d8f472542e715766158a738e8ea47`;
  GoogleTest
  `22c81a3e561bf824ffe8766e010e1b36feb2c6ac98ca8c7a4aecf2506754de8a`
  / `9150f03cee9cb222456fcd0945d5285a1742b080c7ad7c47ed88b95c518afe7c`;
  Faster-Whisper
  `a95dba2947eb236137fb864ab45f19bb2a17fde43004862c0d5f9f860d267a64`
  / `ed7abd350bfde70876202be6ee6b72085973a8724a529fe7c20df03613bfb9b7`;
  CTranslate2
  `e24221d9ed62a6b32ef4fa6b6f052e550081b0d7dfde5bebe669d2801bb50b7d`
  / `ac415816c406a54e8b5299f4a0bda169406f10304911fff3e41c90a11336823d`.
  All materialized objects verify in the private SHA-256 store.
- Generated source locks preserve complete manifests, licenses, Git identities,
  recursive-input records, and the truthful `reviewed-unverifiable` signature
  state. License SHA-256 identities are Whisper.cpp `94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d`,
  nlohmann `46a65cffd1ea955132d95a8dd921640714a8d6b537d2e4e482d31145ae95b603`,
  GoogleTest `9702de7e4117a8e2b20dafab11ffda58c198aede066406496bef670d40a22138`,
  Faster-Whisper `af6798135e729f8aa6c853936d037dfdea449734d26b8ea6a89805fca758c0d5`,
  and CTranslate2 `54aa79d9fe3c09e67a16dcd95b9e88676405a6ec174efda31036983cf7672ecb`.
  GitHub commit metadata was inspected through the GitHub connector.
- Generated loader table `whisper-cpp-loader-limits-v1` has digest
  `5585ea2aeeb4d4b6a4293f8a044487e8d629d899e9d760d9f143a9fb4c702ff5`.
- Private tools are CMake 3.31.8, Ninja 1.12.1, Ubuntu Clang/LLD 18.1.3, and
  CUDA 12.8.1. The representative Linux host is Ubuntu 24.04 x64 with an
  NVIDIA GeForce RTX 5070 Ti Laptop GPU and driver 595.84.
- Generated qualified evidence digests are CPU
  `2f1ff139dc55368c247990037d4d6f7a2185fa34a6a845bfec24fd8b07546c66`,
  Clang sanitizer
  `93b001b715b581c7b237b1bd5f8850b9f4209824f6280fb9982c1e47d3a043ca`,
  and CUDA
  `477c3c8f9a92883fbc234d61a36399d96880d83e5a63e3dd7cce518d90aa5802`.
  CUDA compiled real `120a-real` code,
  stages shared CUDA runtime/cuBLAS, binds `libcuda.so.595.84`, and uses an
  origin-only runpath. Qualification evidence contains no private absolute
  workspace path.
- Multi-call compiler tools retain reviewed invocation paths while canonical
  target bytes are hashed; a regression test covers `clang++`/`ld.lld` mode
  preservation. Sanitizer targets separately execute clean, ASan, and UBSan
  paths with staged shared runtimes.

## Changed Files

- Task contracts and state under `docs/specs/local-whisper/`, including the
  Task 08/09 boundary, acceptance ownership, checklist, and this handoff.
- Deterministic source locks, loader limits, schemas, profiles, qualification
  evidence, and private-source definitions under `runtime/local-whisper/`.
- Import, materialization, verification, and qualification tooling under
  `scripts/local-whisper/`, with the corresponding package scripts.
- Native source/build audit coverage under `tests/runtime/localWhisper/`.
- Repository-wide quality-gate fixes in the Local Whisper supervisor, the
  Prettify chooser controller, and their focused tests.

## Verification

Passing:

- `test:local-whisper:native-sources`: 16/16;
  `test:local-whisper:native-build-audits`: 7/7.
- All five native-source verifiers and loader-limit verification.
- Sanitizer proof, three promoted-profile verifiers, and all three mandatory
  post-promotion disconnected audits, including the CUDA rebuild.
- Both Windows Task-19 profiles in `--contract-only` mode; no Windows code ran.
- Repository-wide `lint`, `format:check`, `typecheck`, and `test:types`.
- Focused supervisor tests (24/24), chooser tests (12/12), and platform-adapter
  contract tests (3/3).
- `git diff --check` and plan validation (19 packets, 62 owners).

## Next Step And Remaining Gates

- Task 09 is the exact next packet and has not started. It requires its own
  incremental-implementation authorization and must not be inferred from this
  completion.
- Task 08 remains uncommitted; no commit, push, packaging, publication,
  signing, or release action occurred.
- Representative Windows execution and promotion remain solely Task 19. The
  current Windows profiles passed contract-only validation; no Windows code
  executed.
