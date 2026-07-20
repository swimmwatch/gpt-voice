# 02 Prove Buffered Replay And Claude Lifecycle

## Outcome

Authorized, sanitized canaries produce one explicit architecture decision:
Gate A approves buffered PCM replay through the existing batch provider
contract, or Gate B stops voice implementation and requires a revised
streaming-IPC specification.

## Prerequisites

- Task 01 is complete and approved.
- Deterministic authentication and organization discovery are available in the
  isolated test context.
- The user authorizes private-endpoint requests with synthetic, non-personal
  audio.

## In Scope

- Replay generated PCM16, 16 kHz, mono audio through the authenticated page.
- Compare validated chunk sizes and real-time versus bounded faster pacing.
- Measure connect, first-event, endpoint, and post-CloseStream drain timing
  across several runs.
- Exercise fresh sockets, consecutive recordings, stop, silence, cancellation,
  delayed final events, unknown/malformed events, remote close, interruption,
  expired session, feature unavailable, locale, conversation context, and
  optional interim behavior.
- Decide retry duplicate-safety and whether conversation_uuid remains omitted.
- Extend the sanitized research record with the decision, contract fixture
  metadata, and manual revalidation checklist.

## Out Of Scope

- Renderer streaming IPC or recorder changes.
- Production transport/provider code.
- Committing synthetic audio, raw frames, transcripts, HAR data, socket URLs
  containing identifiers, or raw provider responses.
- Automatic reconnect or retry without duplicate-safety evidence.

## Task Contract

1. Generate synthetic audio locally; do not use a microphone recording or
   private speech. Record only a phrase-match boolean, never transcript text.
2. Run the canary through Chrome DevTools MCP against the explicitly authorized
   Claude page. Open each WebSocket from that page and use a fresh socket per
   transcription.
3. Start from the observed 2,730-byte frame size and approximately 85.31 ms
   cadence only as a hypothesis. Test and record the smallest reliable range.
4. Send KeepAlive every four seconds, send CloseStream after the final frame,
   and keep accepting events during a measured bounded drain period.
5. Treat TranscriptText and TranscriptInterim as cumulative snapshots and
   TranscriptEndpoint as a commit boundary during evaluation.
6. Run at least two consecutive successful recordings and prove that no socket,
   timer, or interim state leaks between them.
7. Exercise the lifecycle matrix with metadata-only outcomes and close codes.
8. Determine whether buffered replay is reliable, whether bounded faster replay
   is safe, and whether replay retry can duplicate results.
9. Gate A requires repeatable buffered replay, stable finalization, bounded
   cleanup, and no need for live recorder cadence. Gate B is selected for any
   required live capture/streaming behavior.
10. Under Gate B, stop after updating the research record and handoff. Do not
    open Tasks 03-08; revise and re-approve the specification and task plan.
11. Convert only event shapes, lengths, directions, timing ranges, and synthetic
    pass/fail metadata into fixtures or documentation. Never copy captured
    account or content data.

## Architecture And File Boundaries

- Update docs/researches/claude-web-voice-provider/main.md.
- A deterministic metadata-only fixture may be added under tests/fixtures only
  if it contains no transcript, audio, account, session, or raw response data.
- Do not change production source, IPC, renderer recording, dependencies, or
  package configuration.

## Acceptance Criteria

- The report records run count and sanitized timing ranges for connect,
  first-event, endpoint, and drain.
- Real-time and bounded faster pacing have explicit supported/unsupported
  results and a selected initial chunk/cadence contract.
- Two consecutive recordings use distinct sockets and finalize once each.
- Stop, silence, cancel, delayed final, malformed/unknown event, remote close,
  interruption, expiry, and feature-unavailable outcomes are recorded.
- Optional conversation_uuid, locale, interim, new-chat, and existing-context
  behavior are resolved or explicitly excluded with a safe default.
- Retry is classified as duplicate-safe or disabled.
- The report states exactly Gate A or Gate B and the downstream consequence.
- Revalidation steps identify changes that require rerunning the canary.

## Verification

- Repeat the sensitive-value scans from Task 01.
- Confirm any committed fixture contains metadata only and uses synthetic
  labels.
- Confirm git status contains no audio, HAR, profile, screenshot, session, or
  captured WebSocket export.
- Review the Gate A/Gate B evidence and decision with the human.

## References

- Mandatory: the sanitized Task 01 research record.
- Mandatory: AGENTS.md privacy and provider boundaries.
- Optional traceability: spec headings Audio and Event Contract, Lifecycle
  Findings, R3-R5, Claude Web Requirements 8-16, and Claude Web success
  criteria.

## Completion And Handoff

- Mark Task 02 complete only when the gate decision is explicit and reviewed.
- Record timing ranges, selected gate, changed files, checks, and blockers in
  handoff.md without captured values.
- Under Gate A, set 03_define_claude_settings_and_session.md as next and note
  that Task 04 may be planned in parallel after explicit coordination.
- Under Gate B, set specification revision as the next action and mark the
  remaining Claude Web packets blocked pending replanning.
- Present the decision and stop. Do not commit this packet or begin another
  packet in the same invocation.
