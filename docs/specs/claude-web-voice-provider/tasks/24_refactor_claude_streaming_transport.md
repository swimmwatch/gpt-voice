# 24 Refactor Claude Streaming Transport

## Outcome

Claude's authenticated page transport exposes leak-free start, push, finish,
and cancel operations while preserving buffered replay as an explicit wrapper.

## Prerequisites

- Task 22 is complete and approved.
- Task 21 evidence still validates the endpoint, cadence, controls, and drain.

## In Scope

- Incremental page-owned socket lifecycle.
- Serialized binary/control writes, four-second KeepAlive, cumulative parsing,
  multiple endpoints, existing timeouts, cleanup, and cancellation.
- Buffered `transcribe()` implemented through the incremental transport for
  explicit retry compatibility.
- Focused transport/provider tests with fakes.

## Out Of Scope

- Renderer capture/queue, IPC, main service, clipboard/cache/history,
  localization, feature enablement, reconnect, dependencies, or new deadlines.

## Task Contract

1. Refactor `ClaudeWebPageTransport` into explicit start, push, finish, and
   cancel operations, each using one fresh page-owned native WebSocket and an
   internal opaque operation identity.
2. Start performs query construction and arms the existing connect, first-event,
   overall, drain, and keepalive timing model. Do not introduce a new 120-second
   UI or recording limit.
3. Push accepts copied, nonempty, even-length PCM, serializes writes with
   keepalive/control operations, and never paces faster than the caller's
   validated order. The renderer queue owns frame cadence; transport preserves
   ordering and prevents overlapping page evaluations.
4. Finish accepts one optional even final fragment, waits for prior writes,
   sends `CloseStream` once, and returns only after a finalized endpoint. It
   handles cumulative text/interim snapshots and more than one endpoint without
   appending duplicate text or exposing interim output.
5. Cancel closes the socket without `CloseStream`, clears timers/event buffers,
   rejects pending operations with the typed cancellation code, and is
   idempotent.
6. Preserve safe length/type/count diagnostics and all current typed transport
   errors. Never retain raw events or transcript in diagnostics.
7. Keep `transcribe(pcm)` as a compatibility wrapper that splits and paces the
   complete buffer through start/push/finish. No automatic caller fallback is
   added.

## Architecture And File Boundaries

- Refactor `src/main/providers/claudeWebPageTransport.ts` and focused protocol
  helpers only when necessary.
- Update `ClaudeWebVoiceProvider` only enough to implement the Task 22 streaming
  provider boundary and retain batch retry.
- Update focused page-transport and provider tests; do not touch IPC or renderer.

## Acceptance Criteria

- Start/push/finish/cancel, Stop-before-open, keepalive during no-audio pause,
  cumulative snapshots, multiple endpoints, malformed/unknown events, timeout,
  connection loss, and page shutdown are deterministic tests.
- Every binary/control write is serialized and ordered.
- Finish sends final PCM before exactly one CloseStream and returns finalized
  text only.
- Cancel sends no CloseStream and leaves zero sockets/timers/messages.
- Buffered retry behavior and existing transport error semantics remain covered.
- No reconnect or automatic replay exists.

## Verification

- Run Claude audio/protocol/page-transport/provider suites.
- Run application/test TypeScript checks and formatting/lint for changed files.

## References

- Mandatory: current Claude audio, protocol, page transport, provider, and their
  focused tests.
- Traceability: Live Streaming Contract 5-8 and 11; Claude requirements 8-14.

## Completion And Handoff

- Update todo/handoff, report lifecycle and compatibility evidence, and stop
  without beginning Task 25.
