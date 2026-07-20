# 05 Build The Claude Authenticated Page Transport

## Outcome

A testable transport replays verified raw PCM through a WebSocket owned by the
authenticated Claude page, handles final events and timeouts, and closes every
socket and timer on completion, error, cancellation, provider switch, or
shutdown.

## Prerequisites

- Task 04 protocol helpers are approved.
- Task 02 provides the verified chunk cadence and connect, first-event, overall,
  and drain timeout ranges.

## In Scope

- A page-context WebSocket transport with injected page/time dependencies.
- Binary chunk pacing, four-second keepalives, CloseStream, and bounded drain.
- Known event delivery to the protocol accumulator.
- Connect, first-event, overall, and drain timeouts.
- Explicit cancellation and transport shutdown.
- Typed safe transport failures and metadata-only diagnostics.

## Out Of Scope

- Session persistence, organization discovery, provider registration, clipboard
  writes, cache, renderer streaming IPC, auto-reconnect, or replay retry.
- Live-provider tests in the automated suite.
- Logging full URLs, raw audio, transcript/event content, or page errors.

## Task Contract

1. Open the native WebSocket inside the authenticated Claude Page so browser-
   managed origin and session behavior stay in the privileged provider context.
2. Pass only the already validated endpoint inputs and raw PCM required by the
   operation. Do not expose session state to Node or renderer callers.
3. Pace chunks using Task 02 constants and send complete binary PCM frames.
4. Send KeepAlive every four seconds while open, send CloseStream once after
   the final chunk, and accept late final events through the bounded drain.
5. Use separate connect, first-event, overall, and drain timers derived from
   sanitized evidence. Clear every timer on every terminal path.
6. A fresh operation creates a fresh socket and transcript accumulator. No
   state survives into the next operation.
7. Do not reconnect mid-stream or replay on failure. Retry remains disabled
   unless Task 02 proved it duplicate-safe.
8. Expose explicit cancel/shutdown behavior that can close a page-owned socket
   while its operation is pending. A single long-running Page.evaluate promise
   with no external cancellation path is unacceptable.
9. Classify upgrade/auth failure, connection loss, malformed event, rate limit
   signal, first-event timeout, overall timeout, drain timeout, empty result,
   cancellation, and page shutdown distinctly.
10. Diagnostics may include operation phase, event type, byte/event counts,
    durations, and close code only. Never include organization ID, full URL,
    audio, transcript, or raw provider/page error text.

## Architecture And File Boundaries

- Add src/main/providers/claudeWebPageTransport.ts.
- Add tests/main/providers/claudeWebPageTransport.test.ts.
- Use an injected fake Page/socket/clock boundary; automated tests make no
  browser, network, account, or private-endpoint request.
- Do not edit BaseVoiceProvider, transcription IPC, renderer audio, or provider
  registry.

## Acceptance Criteria

- The happy path sends verified chunks in order, keepalives on cadence, and one
  CloseStream, then returns one final transcript.
- Late final events inside the drain window are accepted.
- Every failure and timeout rejects with a typed safe category and closes the
  socket/timers.
- Cancellation during connect, replay, or drain settles promptly and cleanup is
  idempotent.
- Two sequential calls have distinct sockets and isolated accumulators.
- Unknown events do not crash or expose content.
- Tests prove no auto-reconnect/replay and no raw sensitive logging.

## Verification

- node --import tsx --test tests/main/providers/claudeWebPageTransport.test.ts
- node --import tsx --test tests/main/providers/claudeWebAudio.test.ts tests/main/providers/claudeWebProtocol.test.ts
- npm run typecheck
- npm run test:types

## References

- Mandatory: Task 02 Gate A timing/cadence record.
- Mandatory: Task 04 public helper contracts.
- Optional precedent: ChatGPTVoiceProvider same-origin Page.evaluate boundary.
- Optional traceability: Claude Web Requirements 9-14 and Lifecycle Findings.

## Completion And Handoff

- Update todo.md and handoff.md with transport ownership, cleanup proof, changed
  files, checks, and exact timeout constants.
- Set 06_implement_claude_provider_lifecycle.md as the next packet.
- Present transport tests for review and stop. Do not commit this packet or
  begin provider integration in the same invocation.
