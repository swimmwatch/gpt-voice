# Handoff: CLI Prettify Provider Contracts

Status: Task 28 was committed as `cb4c0d7b feat(claude): complete streaming
feature gate`. Task 10 is complete and deliberately uncommitted for human
review. Do not begin Task 11 in this invocation.

Completed in Task 10:

- Added separate known and enabled Prettify provider IDs. Ollama and vLLM are
  the only enabled/selectable providers; Claude CLI and Codex CLI are known,
  experimental, and fail closed before settings resolution, HTTP, or process
  dispatch.
- Added provider capabilities plus normalized non-secret CLI settings:
  executable path, model, Claude fallback model/effort, Codex reasoning
  effort/verbosity, and a 15–600-second timeout with a 120-second default.
  Empty values retain PATH/default-model/no-fallback semantics.
- Replaced adapter objects with concrete `BasePrettifyProvider` subclasses for
  Ollama, vLLM, Claude CLI, and Codex CLI. Ollama retains its loaded-model
  lifecycle; vLLM and both CLI providers inherit safe unavailable lifecycle
  operations until their assigned packets.
- Deep-merged CLI settings through config and settings storage while retaining
  encrypted vLLM API-key handling. URL validation, cache context, and logging
  remain capability-aware; configured executable paths are never logged.
- Preserved hidden CLI settings through App Settings equality/dirty-state
  handling without adding a selectable CLI UI.

Task 10 changed files:

- `src/shared/prettifySettings.ts`
- `src/main/config.ts`
- `src/main/services/{prettifyProviders,prettifySettingsStorage,selectedTextPrettify}.ts`
- `src/main/ipc.ts`
- `src/renderer/appSettingsUtils.ts`
- `tests/{shared/prettifySettings,main/{prettifyProviders,prettifySettingsStorage,configPrettifySettings},renderer/appSettingsUtils}.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Checks:

- Focused shared-settings, config/storage, provider, cache, and App Settings
  tests pass (6 files).
- `npm run typecheck`, `npm run test:types`, and `npm run format:check` pass.
- `npm run lint` has no errors and only the two pre-existing warnings in
  `tests/main/streamingTranscription.test.ts`.
- `npm test` passes 95/96 files. The unrelated
  `tests/scripts/buildSizeCli.test.ts` fails because its spawned `measure` and
  `verify` commands return empty captured stdout even though direct invocation
  prints the expected summary. No Task 10 code or files participate in that
  failure.

Exact next packet:

- After human review, run Task 11
  (`11_build_cli_process_runner.md`). It may add the isolated CLI runner but
  must not enable a CLI provider or launch a real CLI without its stated
  authorization.

Blockers:

- Resolve or separately triage the pre-existing build-size CLI test stdout
  capture issue before claiming a fully green unit suite.
