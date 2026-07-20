# 11 Build The Private CLI Process Runner

## Outcome

An injectable main-process runner launches one executable without a shell,
sends selected text only through stdin, isolates cwd/environment, bounds output,
supports timeout/cancellation, terminates the process tree, and returns typed
sanitized outcomes.

## Prerequisites

- Task 10 timeout and executable-path contracts are approved.
- Current textAutomation execFile usage is inspected as the single local
  subprocess precedent.

## In Scope

- Executable discovery through effective GUI PATH or an optional absolute path.
- Absolute regular-file/executable validation.
- Per-request empty temporary cwd and audited environment allowlist.
- spawn or execFile with shell false and stdin input.
- AbortSignal, timeout, graceful termination, forced process-tree cleanup.
- stdout/stderr caps and exhaustive process result classification.
- Guaranteed temporary-directory and stream cleanup.

## Out Of Scope

- Claude/Codex argv, auth/model parsing, shell commands, user arguments,
  credentials, CLI installation/update, renderer IPC, or live provider calls.

## Task Contract

1. Implement CliProcessRunner in Electron main with injectable spawn, clock,
   filesystem/temp, environment, executable lookup, and process-tree kill
   dependencies.
2. The API accepts executable path/name, an argument array, stdin bytes/text,
   timeout, AbortSignal, output limits, and a caller-owned non-secret operation
   label.
3. Use shell false. Never join arguments into a command string. Selected text
   appears only on stdin and is never written to argv, cwd files, logs, or error
   messages.
4. Empty executablePath resolves the executable through the GUI process's
   effective PATH. A configured value must be one absolute executable regular
   file; pass it directly so spaces remain valid. Do not parse embedded
   arguments.
5. Create a unique empty cwd for every request and remove it on every terminal
   path. Do not run in the repository, user home, or current document folder.
6. Start from an empty environment and copy only audited platform variables
   needed for executable discovery, locale, OS process launch, and the CLI's
   own standard auth-location discovery. Explicitly exclude API-key/auth
   overrides, model overrides, debug, hooks, telemetry exporters, proxies, MCP,
   tool, and project variables.
7. Bound stdout and stderr independently before buffering can exhaust memory.
   Kill and classify output-limit breaches.
8. Distinguish not found/not executable, spawn error, stdin EPIPE, abort,
   timeout, graceful exit, forced kill, signal exit, nonzero exit, stdout limit,
   stderr limit, and cleanup failure.
9. Nonempty stderr with exit zero is not failure. The adapter decides success
   from exit status and parsed stdout.
10. Abort and timeout first request graceful termination, then force the entire
    process tree after a short internal grace period. The grace period is not a
    user setting.
11. Cleanup and settlement are idempotent under races among exit, error, abort,
    timeout, stream close, and forced termination.
12. Safe diagnostics include executable basename or provider label, phase, exit
    category, signal, duration, and byte counts only. Never include full path,
    cwd, environment, stdin/stdout, raw stderr, username, or auth details.
13. A failed adapter may request a separately sanitized, length-limited stderr
    excerpt, but the runner never logs it and tests prove path/account/token
    redaction.

## Architecture And File Boundaries

- Add src/main/services/prettifyCliRunner.ts.
- Add tests/main/prettifyCliRunner.test.ts.
- Do not add a process dependency or edit packaging.
- Keep all privileged execution out of preload and renderer.

## Acceptance Criteria

- Tests assert exact argv array, shell false, stdin-only source, empty cwd, and
  environment allowlist.
- PATH and explicit paths with spaces work through injected fakes.
- Every result category, output cap, race, and cleanup path has deterministic
  coverage.
- Abort and timeout terminate descendants and settle within bounded fake time.
- No test/log/error fixture includes selected text, output text, full
  environment, full executable path, or credential-like data.

## Verification

- node --import tsx --test tests/main/prettifyCliRunner.test.ts
- npm run typecheck
- npm run test:types
- Run focused platform manual tests later in Task 19; do not launch a real CLI
  in this packet.

## References

- Mandatory precedent: src/main/services/textAutomation.ts CommandRunner and
  runCommand boundaries.
- Mandatory: Task 10 executable path and timeout contracts.
- Optional traceability: Shared CLI Runner Requirements 1-11 and Boundaries.

## Completion And Handoff

- Update todo.md and handoff.md with allowlisted variable names, termination
  strategy, changed files, checks, and platform follow-up.
- Set 12_implement_claude_cli_adapter.md as the next packet; Task 13 may follow
  in parallel only after explicit coordination.
- Present runner failure tests for review and stop. Do not commit this packet or
  launch a real CLI in the same invocation.
