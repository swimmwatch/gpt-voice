# 21 Revalidate Claude Live Streaming

## Outcome

An authorized, metadata-only canary proves or rejects the private endpoint
assumptions required for live capture before any production streaming contract
is added.

## Prerequisites

- Tasks 01-09 are complete.
- The dedicated Claude CloakBrowser research profile is authenticated and not
  in use by another process.
- The user explicitly authorized synthetic private-endpoint requests.
- The buffered transport constants remain 16-kHz mono PCM16, 2,730-byte frames,
  85.31-ms minimum cadence, four-second KeepAlive, and three-second drain.

## In Scope

- Generated synthetic speech or a publicly licensed, reference-transcribed,
  non-personal fixture; no microphone or personal audio.
- Immediate capture while a fresh page-owned WebSocket connects.
- A bounded pre-connect queue and its high-water mark.
- Short and 30-second live streams, two consecutive streams, pause/resume,
  multiple endpoint observations, Stop/finalization, and cancellation.
- Post-Stop timing and duration-independence evidence.
- Sanitized research, todo, and handoff updates.

## Out Of Scope

- Production source, provider metadata, AudioWorklet, IPC, renderer, settings,
  localization, packaging, or dependencies.
- Raw audio, transcript/reference text, account/organization data, socket URLs,
  raw events, request/response bodies, screenshots, or profiles in repository
  artifacts or command output.
- CI automation or a persistent live-test script.

## Task Contract

1. Launch a fresh page in the existing dedicated persistent CloakBrowser
   research profile. Resolve the active organization inside the authenticated
   page by matching exactly one asynchronous current-access path against exactly
   one eligible organization membership from the authenticated bootstrap
   response. Return only counts/statuses to Node.
2. Use one public LibriSpeech ASR Dummy `clean/validation` clip with its published
   reference transcript. Download and convert it in memory, keep audio/reference
   text transient, compare normalized word order with at least 80% reference
   coverage, and retain only the dataset/config/split/row/utterance attribution
   plus reference-match booleans. Preserve LibriSpeech CC BY 4.0 attribution.
3. For each normal case, create one fresh native WebSocket inside the page.
   Begin the simulated capture clock immediately after constructing the socket,
   accumulate complete frames before open, and drain them serially at no less
   than 85.31 ms between sends.
4. Fail the canary if the queue exceeds 64 complete frames, frame order changes,
   any non-final frame differs from 2,730 bytes, or a chunk has odd length.
5. Run two consecutive successful short streams on distinct sockets. Each must
   phrase-match, finalize, and leave no page-owned socket or timer.
6. Run a pause/resume stream. During a pause of at least four seconds, exclude
   new PCM samples, continue draining queued audio, and observe at least one
   KeepAlive. Resume without inserting silence into retained PCM.
7. Run a long stream that produces or safely tolerates multiple cumulative
   `TranscriptText`/`TranscriptInterim` snapshots and endpoint boundaries. Do
   not expose snapshot data. Insert generated PCM silence between repeated public
   fixture utterances, require at least two endpoints, and require one final
   endpoint after `CloseStream`.
8. Cancel a fresh stream after live audio has begun. Send no `CloseStream`,
   close cleanly, retain no partial transcript, and prove cleanup.
9. Compare a successful short stream with a successful approximately 30-second
   stream. On the stable authorized connection, each must normally finalize
   within three seconds after Stop and the long stream's post-Stop time must not
   scale with its recording duration.
10. Record only evidence date, case count, pass/fail, timing ranges, event
    category/count ranges, close codes, queue high-water ranges, keepalive
    counts, endpoint counts, bytes/frame counts, public fixture attribution,
    reference-match booleans, and zero active resource counts.
11. Any auth/organization ambiguity, queue overflow, missing final endpoint,
    missing repeated endpoint, reference mismatch, non-clean terminal state,
    post-Stop regression, or protocol drift fails the gate and blocks Tasks
    22-28. Do not weaken the threshold or fall back to captured identifiers.

## Architecture And File Boundaries

- Update `docs/researches/claude-web-voice-provider/main.md` with one sanitized
  Task 21 section.
- A transient runner may exist only under ignored `.artifacts/` while executing
  the canary and must be removed afterward.
- Update `tasks/todo.md` and `tasks/handoff.md` only after deciding the gate.
- Do not change `src/`, `tests/`, package files, the saved research profile, or
  application session files.

## Acceptance Criteria

- The evidence identifies pass or fail and the exact downstream consequence.
- Immediate-capture backlog is nonzero, bounded by 64, ordered, and drains at
  the validated cadence.
- Two consecutive fresh sockets each meet the normalized public-reference match
  and finalize once without leaked resources.
- Pause/resume excludes samples and records KeepAlive while paused.
- Cumulative event categories and multiple endpoints are handled without
  retaining text; the long case observes at least two endpoints and a final
  endpoint follows `CloseStream`.
- Cancellation sends audio but no CloseStream and leaves no retained result or
  resource.
- Short and approximately 30-second cases have recorded post-Stop timings; on a
  stable connection the long case normally completes within three seconds and
  does not exhibit duration-proportional replay.
- Sensitive-value scans find no identifiers, URLs with query values, raw
  events, phrase/audio/transcript content, or session/profile data in tracked or
  untracked task output.

## Verification

- Run the opt-in canary once through the authorized profile; it is never an npm
  script or automated test.
- Inspect the sanitized aggregate before writing it to research.
- Run `git status --short --ignored` and confirm no new audio, HAR, profile,
  screenshot, session, or raw canary output is present.
- Scan the changed documentation for UUID, cookie/token, WebSocket query value,
  transcript/reference text, and raw-event leakage.
- Review the gate with the human before Task 22.

## References

- Mandatory: `docs/researches/claude-web-voice-provider/main.md`, especially
  Task 01 authentication and Task 02 cadence/lifecycle evidence.
- Mandatory current constants:
  `src/main/providers/claudeWebAudio.ts`,
  `src/main/providers/claudeWebProtocol.ts`, and
  `src/main/providers/claudeWebPageTransport.ts`.
- Mandatory fixture attribution: LibriSpeech ASR Corpus via OpenSLR 12, CC BY
  4.0, and the selected ASR Dummy dataset/config/split/row/utterance metadata.
- Traceability: specification sections Live Streaming Contract and R6.

## Completion And Handoff

- Mark Task 21 complete only when the sanitized gate passes; otherwise leave it
  unchecked and record Tasks 22-28 as blocked.
- Record changed files, the canary/check results, exact next packet, and blockers
  in `handoff.md`.
- Stop for human review. Do not commit Task 21 or begin Task 22 in this
  invocation.
