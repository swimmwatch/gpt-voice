# Handoff: Claude Web Live Streaming Amendment

Status: Task 27 is complete and uncommitted; it awaits the required human
checkpoint. Do not begin Task 28 until a later explicit
incremental-implementation invocation.

Completed:

- Tasks 01-09 and 21-26 are committed through `59640308`.
- Added shared renderer streaming limits and a bounded queue that starts IPC
  immediately, copies at most 64 pending 2,730-byte frames, sends them serially
  at the 85.31-ms cadence, supports Stop before operation start resolves, and
  cancels late or failed operations exactly once.
- Branched recording by the provider mode captured at start. Claude now starts
  AudioWorklet capture and streaming IPC concurrently; batch providers retain
  the existing MediaRecorder path.
- Streaming pause/resume affects capture only. Stop flushes capture, builds the
  canonical WAV, drains complete frames, and forwards the final fragment and
  WAV through finish. Cancel, provider change, and renderer teardown clean up
  the active live operation safely.
- Preserved explicit buffered Retry with retained `audio/wav` data when eligible
  and after success. Live failures never invoke batch transcription
  automatically, and existing final-only status and notification behavior is
  reused pending Task 28 copy.

Changed files:

- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `src/shared/streamingTranscription.ts`
- `src/main/providers/claudeWebAudio.ts`
- `src/renderer/App.tsx`
- `src/renderer/audio/pcm16.ts`
- `src/renderer/audio/streamingTranscriptionQueue.ts`
- `src/renderer/hooks/useRecording.ts`
- `tests/renderer/streamingRecordingWorkflow.test.ts`
- `tests/renderer/streamingTranscriptionQueue.test.ts`

Checks:

- Focused queue, streaming workflow, live capture, retry, and provider suites
  pass.
- Full unit suite passes (486 tests).
- Application and test TypeScript checks pass.
- ESLint passes with two pre-existing warnings in the committed Task 25 service
  test; Prettier and the production build pass.
- `git diff --check` and sensitive-artifact/credential scans pass.
- Interactive authorized-session checks for short, paused, cancelled,
  immediate-Stop, and consecutive microphone recordings remain pending at the
  human checkpoint; no runtime audio or transcript artifact was retained.

Exact next packet:

- After human approval, commit Task 27 as
  `feat(transcription): stream audio during recording`, then execute
  `28_complete_streaming_feature_gate.md` only.

Blockers:

- None for code review. The interactive microphone scenarios above require
  human runtime verification before feature-gate completion.
