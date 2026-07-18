# Handoff: Claude Web Live Streaming Amendment

Status: Task 24 is complete and uncommitted; it awaits human review. Do not
begin Task 25 until a later explicit incremental-implementation invocation.

Completed:

- Tasks 01-09 and 21-23 are committed through `3bad0a89`.
- Refactored the authenticated page transport into opaque start, push, finish,
  per-operation cancel, and lifecycle-wide cancel operations. Start returns
  after page socket creation while connection polling continues, so queued
  audio and Stop-before-open are supported.
- Serialized binary, KeepAlive, and CloseStream writes per operation. Finish
  drains earlier writes, sends the optional even final fragment, stops
  KeepAlive, and sends CloseStream exactly once before waiting for a finalized
  endpoint.
- Preserved the connect, first-event, overall, and drain deadlines, four-second
  KeepAlive, cumulative transcript replacement, multiple endpoints, safe
  diagnostics, and page-owned socket cleanup. Cancellation cannot arm a late
  post-open or drain timer.
- Reimplemented buffered replay through the incremental operations while
  retaining the validated 85.31 ms cadence, exact PCM order, explicit Retry
  compatibility, and no reconnect or automatic replay.
- Implemented Claude's privileged streaming provider operations with main-ID to
  transport-ID binding, copied/even PCM validation, sequence acknowledgements,
  typed lifecycle failures, idempotent cancellation, and no live clipboard
  writes. Buffered Retry retains its existing clipboard behavior.
- Kept renderer capture, IPC, main service completion, queue limits,
  localization, and feature enablement unchanged for Tasks 25-28.

Changed files:

- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `src/main/providers/claudeWebPageTransport.ts`
- `src/main/providers/ClaudeWebVoiceProvider.ts`
- `src/main/providers/StreamingTranscriptionOperationError.ts`
- `src/main/providers/index.ts`
- `tests/main/providers/claudeWebPageTransport.test.ts`
- `tests/main/providers/ClaudeWebVoiceProvider.test.ts`

Checks:

- Focused Claude audio, protocol, page-transport, and provider tests pass (46
  tests).
- Full unit suite passes (429 tests).
- Application and test TypeScript checks pass.
- Full ESLint and Prettier checks pass.
- `git diff --check` and sensitive-artifact/credential scans pass.

Exact next packet:

- After human approval, commit Task 24 with a focused conventional commit, then
  execute `25_build_main_streaming_service.md` only.

Blockers:

- None. Task 24 is at its required human-review checkpoint.
