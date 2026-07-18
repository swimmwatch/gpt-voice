# Handoff: Claude Web Live Streaming Amendment

Status: Task 23 is complete and uncommitted; it awaits human review. Do not
begin Task 24 until a later explicit incremental-implementation invocation.

Completed:

- Tasks 01-09 and 21-22 are committed through `2fc2355b`.
- Added a deterministic renderer pipeline that normalizes browser channel
  blocks to mono, resamples 44.1/48 kHz input statefully to 16 kHz, converts to
  signed little-endian PCM16, and emits exact 2,730-byte frames plus one even
  final fragment.
- Added explicit pause, resume, flush, and cancel behavior. Paused samples are
  discarded before audio state, and cancellation clears retained PCM while
  making late worklet messages inert.
- Retained emitted PCM only in memory for the active capture and constructed a
  canonical mono/16-bit/16-kHz retry WAV whose data bytes exactly match the
  emitted frames and final fragment.
- Added a self-hosted AudioWorklet and browser capture session with idempotent
  node, track, and audio-context cleanup. The development build emits
  `dist/renderer/assets/livePcmCapture.worklet.js` (665 bytes).
- Kept capture inactive: no recording hook, transport, IPC, main-process,
  localization, dependency, or feature-gate behavior changed in this packet.

Changed files:

- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `src/renderer/audio/pcm16.ts`
- `src/renderer/audio/streamingLinearResampler.ts`
- `src/renderer/audio/pcmFrameAccumulator.ts`
- `src/renderer/audio/livePcmPipeline.ts`
- `src/renderer/audio/livePcmCapture.worklet.js`
- `src/renderer/audio/livePcmCaptureAsset.ts`
- `src/renderer/audio/livePcmCaptureSession.ts`
- `src/renderer/audio/livePcmCaptureBrowser.ts`
- `src/renderer/audioEncoding.ts`
- `src/renderer/entries/main.tsx`
- `src/renderer/styles.d.ts`
- `webpack.config.js`
- `eslint.config.mjs`
- `tests/renderer/livePcmPipeline.test.ts`
- `tests/renderer/livePcmCapture.test.ts`
- `tests/scripts/rendererBundle.test.ts`

Checks:

- Focused renderer audio and capture tests pass.
- Full unit suite passes (423 tests).
- Application and test TypeScript checks pass.
- Full ESLint and Prettier checks pass.
- Development build and production renderer bundle asset assertions pass.
- `git diff --check` and sensitive-artifact/credential scans pass.

Exact next packet:

- After human approval, commit Task 23 with a focused conventional commit, then
  execute `24_refactor_claude_streaming_transport.md` only.

Blockers:

- None. Task 23 is at its required human-review checkpoint.
