# Handoff: Private CLI Process Runner

Status: Task 10 was committed as `adf5c2ab feat(prettify): define CLI provider
contracts`. Task 11 is complete and deliberately uncommitted for human review.
Do not begin Task 12 in this invocation.

Completed in Task 11:

- Added main-only, injectable `CliProcessRunner` with no adapter, renderer,
  IPC, dependency, packaging, or real CLI integration.
- It resolves only a validated configured absolute executable or a GUI-PATH
  executable without a shell, creates an empty per-operation temporary cwd,
  and passes selected input directly through piped stdin.
- Spawned children use `shell: false`, a strict platform environment allowlist,
  bounded stdout/stderr collection, a 1-second graceful-to-forced tree-kill
  sequence, and idempotent listener/timer/directory cleanup.
- Results use typed safe failure codes and diagnostics. Only successful calls
  retain raw stdout; optional failed stderr excerpts are sanitized and limited
  to 2 KiB. No paths, environment values, input, raw stderr, or credentials
  are logged or returned in diagnostics.
- Added deterministic fakes covering argv, stdin, cwd/environment isolation,
  PATH/PATHEXT and configured-path resolution, exit/error classes, output
  limits, cancellation, timeout, forced cleanup, and cleanup failures.

Task 11 changed files:

- `src/main/services/prettifyCliRunner.ts`
- `tests/main/prettifyCliRunner.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Checks:

- Focused runner test, `npm run typecheck`, `npm run test:types`,
  `npm run lint`, and `npm run format:check` pass. Lint retains only the two
  pre-existing warnings in `tests/main/streamingTranscription.test.ts`.
- `npm test` passes 96/97 files. The unrelated
  `tests/scripts/buildSizeCli.test.ts` still fails because its spawned
  `measure` and `verify` commands produce empty captured stdout even though
  direct invocation prints the expected summary. No Task 11 file participates
  in that failure.

Exact next packet:

- After human review, run Task 12
  (`12_implement_claude_cli_adapter.md`). It may use this runner but must not
  start Codex CLI work or enable the CLI provider UI.

Blockers:

- Resolve or separately triage the existing build-size CLI stdout-capture
  failure before claiming a fully green unit suite.
