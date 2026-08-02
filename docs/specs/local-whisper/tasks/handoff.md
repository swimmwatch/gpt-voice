# Local Whisper Handoff

## Authoritative State

- Specification revision 7 and plan revision 12 are Approved.
- Tasks 01–12 are complete and committed; Task 12 is authoritative at
  `916f0d9`.
- Task 13 is complete, locally verified, and intentionally uncommitted for
  review. Task 14 has not started and is not authorized by this handoff.
- AMD remains **Preview · Untested**. macOS remains
  **Planned · Unavailable**. Representative Windows execution remains
  exclusively in Task 19.

## Task 13 Completed

- Fixed the active engine discriminator to `whisperCpp`, native model format
  to `ggml`, and removed the precision dimension from shared, main, worker,
  cache, residency, capability, catalog, settings, and fixture contracts.
- Deleted the Faster-Whisper and CTranslate2 locks and definitions. Updated the
  three surviving locks with importer implementation digest
  `ca3c39a4a21d5df2ef092bae2f12c906cf820813d7d6d8900c4599d6c40abdab`.
- Normalized Whisper.cpp C++ worker messages, protocol vectors, AMD Preview
  profiles, CPU/CUDA verification helpers, and current research guidance.
- Added `verify-single-engine-cleanup.mjs`, focused negative domain/settings/
  protocol/persistence tests, exact source-lock tests, and the required package
  scripts.

## Changed Files

- Shared/main contracts:
  `src/shared/localWhisper/{domain,catalog,languages,protocol,settings}.ts`,
  `src/main/localWhisper/{catalog/LocalWhisperCatalogRepository,settings/LocalWhisperSettingsRepository}.ts`.
- Native/source contracts: `runtime/local-whisper/sources/README.md`, the three
  surviving source locks, deleted Faster-Whisper/CTranslate2 locks,
  `scripts/local-whisper/source-import/source-definitions.mjs`, AMD profile and
  contract files, Whisper.cpp worker/test files, and CPU/CUDA verification
  helpers.
- Tests/fixtures: affected shared, catalog, settings, inventory, supervisor,
  protocol, catalog-signer, and conformance-worker fixtures; regenerated four
  protocol binaries and `manifest.json`; added
  `tests/main/localWhisper/singleEngineContract.test.ts` and
  `tests/runtime/localWhisper/nativeSources/singleEngineSources.test.mjs`.
- Tooling/docs: `package.json`,
  `scripts/local-whisper/verify-single-engine-cleanup.mjs`,
  `docs/researches/local-whisper/main.md`, `tasks/todo.md`, and this handoff.

## Verification

- Passed every exact Task-13 command: single-engine tests and cleanup verifier,
  native-source and AMD-pack tests, all shared Local Whisper tests, focused
  main catalog/settings/inventory tests, source and test typechecks, ESLint
  with zero warnings, Prettier, and `git diff --check`.
- Additional regression checks passed: regenerated worker vectors, worker
  codec/native common tests, all supervisor tests, and Whisper.cpp core tests
  under Linux GCC plus Clang ASan/UBSan with clang-format and clang-tidy.
- Remote CI and representative Windows, AMD, and macOS execution were not run
  and are not claimed.

## Exact Next Step

- Review the uncommitted Task-13 packet. A later explicitly authorized
  `incremental-implementation` invocation may commit only this approved packet
  before separately authorizing and starting Task 14.

## Blockers And Manual Gates

- No Task-13 implementation blocker remains.
- Commit, push, pull request, signing, packaging, publication, release, and
  representative Windows/AMD/macOS execution remain separately gated.
