# Handoff: Capability-Driven CLI Settings State

Status: Task 16 was committed as `f4b517b9 feat(prettify): integrate CLI
runtime and cache`. Task 17 is complete and deliberately uncommitted for review.
Claude CLI and experimental Codex CLI remain absent from the selectable
provider list. Do not begin Task 18 in this invocation.

Implemented in Task 17:

- Added a renderer-only four-provider settings draft while preserving the
  HTTP-only persisted/selectable provider type and list.
- Centralized absolute CLI path and Claude/Codex model syntax validation in the
  shared contract. The main adapters reuse the same model validators, while the
  main runner remains authoritative for file existence and executability.
- Replaced renderer non-vLLM-to-Ollama fallthroughs with exhaustive active
  provider handling. HTTP generation and URL rules apply only to HTTP
  providers; CLI model/fallback, effort, verbosity, and 15-600 second timeout
  validation applies only to the selected CLI.
- Added provider-transition metadata that preserves every provider draft,
  clears provider-specific field errors, and requests model-action state reset.
- Kept dirty/save equality sensitive to all persisted drafts while restricting
  active change summaries and advanced counts to supported controls.
- Removed raw model values from App Settings summaries. Runtime summary fields
  contain only provider IDs, safe enums, booleans, counts, lengths, and active
  HTTP numeric settings.
- Added capability/availability-aware provider view state. Codex unavailable
  status remains fail-closed without erasing or invalidating its draft.

Task 17 changed files:

- `src/shared/prettifySettings.ts`
- `src/main/services/{prettifyClaudeCli,prettifyCodexCli}.ts`
- `src/renderer/{appSettingsUtils,prettifySettingsViewState}.ts`
- `tests/{shared/prettifySettings,renderer/appSettingsUtils,renderer/prettifySettingsViewState}.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Verification:

- Focused renderer settings, view-state, shared validation, and both CLI adapter
  suites pass.
- `npm run typecheck`, `npm run test:types`, `npm run format:check`, and
  `git diff --check` pass.
- `npm run lint` has no errors and retains only two pre-existing warnings in
  `tests/main/streamingTranscription.test.ts`.
- `npm test` passes 99 of 100 test files. The pre-existing unrelated
  `tests/scripts/buildSizeCli.test.ts` stdout-capture failure persists.
- No test launched a CLI or provider. Privacy inspection found no executable
  paths, free-text models, prompts, credentials, account data, or process output
  in runtime settings summaries.

Exact next packet:

- After human review, run Task 18 (`18_render_cli_prettify_controls.md`). Wire
  the Task 17 draft/transition/view-state contracts into the UI and enable CLI
  selection only when every required provider-specific control is rendered.
