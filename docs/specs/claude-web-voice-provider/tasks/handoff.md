# Handoff: CLI Prettify Runtime Integration

Status: Task 15 was committed as `01bde8c3 feat(prettify): localize CLI
provider states`. Task 16 is complete and deliberately uncommitted for review.
Claude CLI and experimental Codex CLI remain absent from the selectable
provider list. Do not begin Task 17 in this invocation.

Implemented in Task 16:

- Extended model-list contracts with safe availability/capability metadata,
  HTTP/alias/catalog/bundled/configured sources, and proven Codex reasoning and
  verbosity options.
- Added precise invalid-model, schema, no-tools isolation, and model-discovery
  adapter errors. Claude and Codex now prepare capability/auth/model gates once
  and expose one-shot generation handles; existing `prettify()` wrappers remain
  compatible.
- Integrated all four known providers through explicit main-process dispatch.
  HTTP providers receive only fetch behavior; CLI paths use only injected
  adapters and cannot fall through to HTTP. Empty CLI models retain CLI-default
  semantics.
- Added prepared cache contexts before lookup. Capability versions and
  result-affecting settings invalidate cached text; executable paths, auth,
  timeouts, environment, source, and output remain excluded. Generation runs
  only on a miss.
- Preserved selected-text single-flight, clipboard restoration, cancellation,
  notifications, Ollama lifecycle, vLLM requests/API-key handling, and the
  HTTP-only selectable provider gate.
- Allowed known provider IDs on typed model-inspection IPC while keeping
  persistence and renderer selection HTTP-only. IPC logs contain only provider
  IDs, safe enums, booleans, counts, and string lengths.

Task 16 changed files:

- `src/shared/prettifySettings.ts`
- `src/main/services/{prettifyClaudeCli,prettifyCodexCli,prettifyProviders,selectedTextPrettify}.ts`
- Task-scoped hunks in `src/main/{ipc,preload}.ts` and
  `src/renderer/types.d.ts`; unrelated provider-switching hunks remain intact.
- `tests/main/{prettifyClaudeCli,prettifyCodexCli,prettifyProviders,selectedTextPrettify,prettifyIpcPrivacyContract}.test.ts`
- `tests/shared/prettifySettings.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Verification:

- Focused provider, selected-text, adapter, runner, settings, i18n, IPC privacy,
  shared-contract, and renderer model tests pass.
- `npm run typecheck`, `npm run test:types`, `npm run format:check`, and
  `git diff --check` pass.
- `npm run lint` has no errors and retains only two pre-existing warnings in
  `tests/main/streamingTranscription.test.ts`.
- `npm test` passes 99 of 100 test files. The pre-existing unrelated
  `tests/scripts/buildSizeCli.test.ts` stdout-capture failure persists: its
  measure and verify assertions receive empty stdout.
- No test launched a real CLI or provider. Diff/privacy inspection found no
  credentials, identities, account state, source/output values, raw process
  data, or full executable paths in runtime logs or IPC results.

Exact next packet:

- After human review, run Task 17 (`17_add_cli_settings_state.md`). Preserve the
  HTTP-only selectable-provider gate until Task 18 adds capability-correct
  renderer controls.
