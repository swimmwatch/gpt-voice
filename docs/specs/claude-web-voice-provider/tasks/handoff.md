# Handoff: Claude CLI Prettify Adapter

Status: Task 11 was committed as `0c78011a feat(prettify): add private CLI
process runner`. Task 12 is complete and deliberately uncommitted for review.
Do not begin Task 13 or enable the Claude CLI provider in this invocation.

Implemented in Task 12:

- Added standalone `ClaudeCliPrettifyAdapter`, typed availability/result error
  codes, GUI-PATH/configured-path runner use, and a fixed isolated print-mode
  argument contract. It disables tools, skills, Chrome, session persistence,
  and external MCP configuration.
- Added version/help/auth preflight. The authorized local preflight passed with
  capability version `2.1.71` and an authenticated boolean only; identity and
  account fields were discarded.
- Added model/fallback/effort validation, 256 KiB stdout and 16 KiB stderr
  limits, safe runner error mapping, structured-output parsing, and a private
  cache-context helper. No provider registry, renderer, IPC, or UI changed.
- Added deterministic tests for the exact argv, stdin separation, defaults,
  capability/auth gates, failure mapping, envelope validation, and cache
  privacy, plus a metadata-only canary-envelope fixture test.
- The authorized local canary passed through the private runner after a local
  dry run in a context that supports child-process pipe capture. It confirmed
  capability version `2.1.71` and the required nonempty
  `structured_output.text` envelope path. The fixture retains only key/type
  metadata and a synthetic text placeholder; dynamic model and session
  identifiers are redacted or omitted.

Task 12 changed files:

- `src/main/services/prettifyClaudeCli.ts`
- `tests/main/prettifyClaudeCli.test.ts`
- `tests/fixtures/claude-cli-envelope-shape.json`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Checks:

- Focused adapter/runner tests, `npm run typecheck`, `npm run test:types`,
  `npm run lint`, and `npm run format:check` pass. Lint retains only the two
  pre-existing warnings in `tests/main/streamingTranscription.test.ts`.
- `npm test` passes 97/98 files. The unrelated
  `tests/scripts/buildSizeCli.test.ts` stdout-capture failure persists.

Exact next packet:

- After human review, run Task 13
  (`13_implement_codex_cli_adapter.md`). Keep both CLI providers unselectable
  until their runtime-integration packet.
