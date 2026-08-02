# Local Whisper Handoff

## Authoritative State

- Specification revision 7 and plan revision 13 are Approved. Revision 13
  splits the previous combined qualification packet into Tasks 19–21.
- Tasks 01–18 are complete and committed; Task 17 is `b9c3e3b` and Task 18 is
  `16b32ca`.
- The verified public fixture bundle digest is
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- AMD remains **Preview · Untested**. macOS remains
  **Planned · Unavailable**. Representative Windows execution remains
  exclusively in Task 20.

## Task 18 Completed

- Added explicit schema-0 settings migration and a deterministic legacy
  provider chooser fixture that preserves unknown Local Whisper namespaces
  without execution or deletion.
- Added fail-open, closed Local Whisper lifecycle audit operations and bounded
  enum/revision/state metadata. Command audit failures cannot replace completed
  IPC results.
- Added additive diagnostics schema v2 with one optional canonical,
  manifest-bound 64 KiB Local Whisper snapshot; schema-v1 reading remains
  supported and analyzer output is limited to `absent`, `valid`, or `invalid`.
- Added privacy/offline canaries, complete user/operator/runtime documentation,
  downgrade guidance, and the qualification evidence seed template consumed
  beginning in Task 19.
- Added the macOS arm64 `gpu`/`metal` planned skeleton. It returns
  `PLANNED_UNAVAILABLE` before catalog, resource, helper, worker, allocation,
  load, Ready, or transcription authority, with no CPU exception.

## Changed Components

- Migration and audit: `src/main/localWhisper/{settings,audit,ipc}/`,
  `src/main/providerAudit/`, and their fixtures/tests.
- Diagnostics: `src/main/localWhisper/diagnostics/`, diagnostics archive
  services/shared contracts, and analyzer skill/reference updates.
- Platform and composition: deferred Local Whisper environment,
  `MainProcessCompositionRoot`, and macOS package/presentation contract tests.
- Documentation and gates: `docs/local-whisper.md`,
  `runtime/local-whisper/README.md`, root/native READMEs, `package.json`, and
  `docs/specs/local-whisper/qualification/task19-evidence-template.md` (a seed
  to split into Linux, Windows, and aggregate evidence during Tasks 19–21).

## Verification

- Passed every Task 18 focused command and the aggregate
  `verify:local-whisper:migration-privacy`, including migration, audit,
  schema-v1/v2 diagnostics, privacy, offline, macOS skeleton, and documentation
  contracts.
- Passed diagnostics dependency policy, source/test typechecks, ESLint with
  zero issues, Prettier, and `git diff --check`.
- Passed the complete unit suite (**1,593 passed**), production dependency audit
  (**0 vulnerabilities**), and production webpack build. The build retained
  only the repository's existing non-failing entrypoint-size warnings.
- Remote CI, representative Windows execution, physical AMD execution, and
  physical macOS execution were not run and are not claimed.

## Exact Next Step

- Execute [Task 19](19_linux_qualification.md) through a new
  `incremental-implementation` invocation on Linux only.
- Task 20 then executes every representative Windows check on Windows against
  the unchanged Task 19 candidate. Task 21 performs final reconciliation and
  release-blocker reporting without rerunning unchanged expensive profiles.

## Blockers And Manual Gates

- No deterministic Task 18 implementation blocker remains.
- Exact previous packaged-binary rollback evidence is split between Linux Task
  19 and Windows Task 20, then reconciled in Task 21. Every representative
  Windows check remains exclusively in Task 20.
- Production signing inputs, approved origins, frozen production packs,
  license/redistribution approval, AMD claims review, and physical platform
  qualification remain external manual gates.
- Commit, push, pull request, production signing, publication, tag, upload, and
  release authority remain separately gated.
