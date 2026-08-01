# Handoff: Local Whisper Task 02 Complete

## Status

Task 02 was authorized through `execution.task-02` revision 1, implemented,
and verified. Its isolated commit is authorized through `commit.task-02`
revision 1. Task 03 has not started and is not authorized.

## Completed Packets

- [01 Shared domain contracts](01_shared_domain_contracts.md)
- [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md)

## Changed Files

- Recorded Task 02 authorization in `decisions.yaml`; updated `todo.md` and this
  handoff.
- Registered the renderer-safe `local-whisper` batch provider and exhaustive
  audit/diagnostics metadata in shared, provider, factory, registry, guard, and
  composition-root contracts.
- Added the injected Local Whisper provider/coordinator port and safe temporary
  unavailable adapter in `src/main/providers/LocalWhisperVoiceProvider.ts`.
- Added local-runtime activation and conflict-safe switching in
  `src/main/browser.ts`, plus Local Whisper dispatch routing in
  `src/main/services/transcription.ts` and runtime-factory wiring.
- Added the canonical WAV validator and eligibility-before-cache dispatch under
  `src/main/services/`, reusing existing completion/cache/history behavior.
- Added or updated focused provider, dispatch, lifecycle, audit, diagnostics,
  and transcription tests; synchronized the private diagnostics schema reference.
- No dependency, renderer/IPC, filesystem, native process, network, download,
  commit, push, publication, or release change was made.

## Checks

- Focused main/provider/lifecycle/audit suite: 175 passed.
- `rtk npm run test:unit`: 1377 passed.
- `rtk npm run typecheck`: passed.
- `rtk npm run test:types`: passed.
- Scoped ESLint and Prettier checks for Task 02 files: passed.
- `rtk git diff --check`: passed.
- Full `rtk npm run lint` remains red only because of the pre-existing
  `no-useless-assignment` error in the unrelated modified
  `src/main/prettifyProfileChooserWindowController.ts:373`.
- Full `rtk npm run format:check` remains red only for the unrelated modified
  `tests/main/prettifyProfileChooserWindowController.test.ts`.

## Exact Next Packet

- After the isolated Task 02 commit, obtain separate execution authorization for
  [03 Trusted catalog, settings, and inventory](03_trusted_catalog_settings_and_inventory.md).

## Blockers

- Task 03 execution is not authorized.
- The two unrelated formatting/lint issues above prevent green repository-wide
  style checks; Task 02's scoped checks are green.
