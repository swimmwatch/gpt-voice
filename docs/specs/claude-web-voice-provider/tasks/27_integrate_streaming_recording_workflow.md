# 27 Integrate Streaming Recording Workflow

## Outcome

Claude captures and sends PCM while the user speaks, while batch providers and
the explicit retry path retain their existing behavior.

## Prerequisites

- Tasks 23 and 26 are complete and approved.

## In Scope

- Capability branch in the recording workflow.
- Concurrent AudioWorklet capture and streaming start.
- Bounded 64-frame queue, strict serial 85.31-ms pacing, Stop-before-connect,
  pause/resume, Stop drain/finish, cancellation, overflow, and manual retry WAV.
- Renderer workflow tests with deterministic clocks and IPC fakes.

## Out Of Scope

- Interim transcript UI, settings, new duration limit, automatic replay,
  transport/service internals, dependency, localization copy, or final packaging
  gate.

## Task Contract

1. Branch recording by the selected provider's transcription mode. Batch mode
   retains the current MediaRecorder/WAV/`transcribeAudio` workflow exactly;
   streaming mode is enabled only for Claude metadata.
2. On Claude start, start microphone capture and invoke
   `startStreamingTranscription()` concurrently. Capture must not wait for the
   IPC result.
3. Queue only complete 2,730-byte frames until the operation ID is available and
   while earlier sends are pending. Keep at most 64 complete frames; overflow
   cancels capture/operation safely and retains the current in-memory WAV for an
   explicit Retry action.
4. Drain frames in sequence through one promise chain and wait at least 85.31 ms
   between send starts. Never parallelize IPC sends or emit a later sequence
   first.
5. Pause tells capture to exclude new microphone samples. Existing queued audio
   continues draining; the provider transport owns KeepAlive. Resume continues
   without inserting silence.
6. Stop flushes capture, waits for all complete frames, sends the final optional
   even fragment and canonical WAV through finish, and waits for the finalized
   result. Stop is valid before start returns or before the socket opens.
7. Cancel stops capture immediately, clears the queue, invokes cancel when an
   operation ID exists, and invokes it on a late start result before discarding
   that result.
8. After any live byte is accepted, any failure surfaces the safe streaming
   error and offers only explicit Retry using the retained WAV/batch method.
   Never invoke retry automatically.
9. Preserve final-only status, clipboard, cache, history, notifications,
   keyboard shortcut semantics, and current recording duration behavior.

## Architecture And File Boundaries

- Integrate in `src/renderer/hooks/useRecording.ts` and focused extracted queue
  state rather than embedding untestable timers in React callbacks.
- Reuse Task 23 capture and Task 26 preload methods.
- Update recording workflow/notification tests; do not add localization strings
  beyond temporary existing safe fallbacks owned by Task 28.

## Acceptance Criteria

- Capture begins before streaming start resolves and produces a nonzero bounded
  backlog in tests.
- Queue cap, exact pacing/order, Stop-before-start/connect, final fragment/WAV,
  pause/resume, cancel-before/after-start, late result, overflow, provider
  switch, and component teardown are deterministic tests.
- Claude never calls batch transcription during normal live flow or automatic
  recovery.
- Explicit Retry calls the preserved buffered path with the retained WAV.
- ChatGPT Web and OpenAI API recording tests remain behaviorally unchanged.
- Final-only UI and current side effects occur once.

## Verification

- Run focused capture, queue, recording hook, provider-state, and existing batch
  workflow tests.
- Run both TypeScript checks and formatting/lint for changed files.
- Manually verify one short, paused, cancelled, Stop-immediately, and consecutive
  Claude recording with the authorized session; retain metadata only.
- Stop for the required human checkpoint.

## References

- Mandatory: Task 23 capture API, Task 26 preload contract, current
  `useRecording`, audio encoding, provider state, retry UI, and focused tests.
- Traceability: Live Streaming Contract 4-7 and 10-11.

## Completion And Handoff

- Update todo/handoff, present live/batch/manual-retry evidence, and stop for
  human review without beginning Task 28.
