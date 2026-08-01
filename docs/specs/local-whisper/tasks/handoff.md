# Handoff: Local Whisper Task 01 Complete

## Status

Task 01 was authorized through `execution.task-01` revision 2, implemented,
and verified. Its isolated commit is authorized through `commit.task-01`
revision 1. Task 02 has not started and is not authorized.

## Completed Packets

- [01 Shared domain contracts](01_shared_domain_contracts.md)

## Changed Files

- Recorded `execution.task-01` revision 2 in
  `docs/specs/local-whisper/decisions.yaml`.
- Recorded isolated Task 01 commit authorization as `commit.task-01` revision
  1 in the same decision ledger.
- Added the canonical renderer-safe shared surface under
  `src/shared/localWhisper/`: closed domain/state/failure vocabularies, strict
  settings/default/selection/cache contracts, immutable catalog identities and
  approximate memory guidance, common language mappings, and bounded worker
  frame codecs.
- Added six focused suites under `tests/shared/localWhisper/` with 30 tests.
- Updated this handoff and `todo.md`. No dependency, main/renderer/IPC,
  filesystem, process, network, runtime, download, commit, push, publication,
  or release change was made.

## Checks

- `rtk node --import tsx --test tests/shared/localWhisper/*.test.ts`: 30 passed.
- `rtk npm run typecheck`: passed.
- `rtk npm run test:types`: passed.
- Scoped ESLint and Prettier checks for the Task 01 files: passed.
- `rtk git diff --check`: passed; `decisions.yaml` parses with unique
  `(id, revision)` pairs.
- Shared imports are relative within `src/shared/localWhisper/`; no main,
  renderer, Electron, filesystem, network, child-process, or process import is
  present.
- Full `rtk npm run lint` remains red only because of the pre-existing
  `no-useless-assignment` error in the unrelated modified
  `src/main/prettifyProfileChooserWindowController.ts:373`.

## Exact Next Packet

- After review and separate commit authorization, commit only Task 01 and then
  obtain separate execution authorization for
  [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md).

## Blockers

- Task 02 execution is not authorized.
- The unrelated lint failure above prevents a green repository-wide lint until
  that separate user change is corrected; Task 01's scoped lint is green.
- Production hosting/publishing is deliberately deferred behind the manual
  gate recorded in `planning.artifact-publishing-target`.
