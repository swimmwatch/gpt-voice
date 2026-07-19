# Handoff: Claude Web Live Streaming Amendment

Status: Task 27 was committed as `f2a338f8 feat(transcription): stream audio
during recording`. Task 28 is complete and deliberately uncommitted for human
review. Do not begin Task 10 in this invocation.

Completed in Task 28:

- Added a renderer-safe live-streaming failure presenter. Every shared and
  local queue error maps to a short localized message in English, Russian,
  Ukrainian, and Belarusian; the same safe text is used for status and native
  notification presentation.
- Added exact packaged-runtime worklet policy and tests. The AudioWorklet is
  emitted once at the trusted local renderer path without relaxing the existing
  `self` Content Security Policy.
- Documented Claude Web live recording, pause, Stop, cancellation, explicit
  buffered Retry, in-memory retention, and private-integration volatility in
  the README without documenting private transport details.
- Recorded the sanitized authorized runtime attempt in
  `docs/researches/claude-web-voice-provider/main.md`.
- Completed the visible-app gate with an in-memory zero-gain source: the window
  showed lifecycle state only during capture, exposed no interim transcript,
  and presented the safe localized live-connection message after the expected
  no-speech failure. Foreground renderer focus was confirmed.

Task 28 changed files:

- `README.md`
- `scripts/packaged-runtime-policy.mjs`
- `src/main/i18n/{be,en,ru,uk}.ts`
- `src/renderer/audio/streamingTranscriptionPresentation.ts`
- `src/renderer/hooks/useRecording.ts`
- `tests/renderer/streamingRecordingWorkflow.test.ts`
- `tests/renderer/streamingTranscriptionPresentation.test.ts`
- `tests/scripts/{packagedRuntimePolicy,webpackConfig}.test.ts`
- `docs/researches/claude-web-voice-provider/main.md`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Checks passed:

- Focused Task 28 renderer, Webpack, and packaged-policy tests (14 tests).
- Full unit suite (490 tests), application and test TypeScript checks, and
  Prettier.
- ESLint with two pre-existing warnings in the committed Task 25 streaming
  service test and no errors.
- Production dependency audit, CloakBrowser preparation and smoke, production
  build, fresh unpacked package build, and packaged-runtime verification.
- Final `git diff --check` and privacy scans passed. Task 28 added no session,
  credential, raw-audio, transcript, socket-URL, or browser-profile artifact;
  the renderer build emitted one trusted worklet asset. Existing provider
  transport assembly remains outside this packet and no private endpoint was
  added to user-facing documentation.

Authorized runtime evidence (2026-07-19):

- A corrected ignored runner captured typed transport failures before generic
  presentation, used in-memory 80% word-order coverage for the public fixture,
  and observed actual page-owned socket close events outside post-Stop timing.
- Two consecutive short cases and pause/resume completed and reference-matched.
  They sent 69 audio chunks, used queue high-water 6, finalized 475-660 ms after
  Stop, and closed `1000`.
- The approximately 30-second case completed and reference-matched with 352
  sends, queue high-water 7, 280 ms post-Stop, and close `1000`. Its post-Stop
  time did not scale with duration.
- Immediate Stop before awaiting readiness returned the expected typed
  `empty-result` in 2,946 ms and closed `1000`. Cancellation sent five frames
  and closed `1000`.
- No audio, transcript, reference, raw event, URL, session/account value, or
  profile artifact was retained. The temporary runner was removed. The corrected
  run establishes current behavior but does not reconstruct the discarded typed
  reasons from the earlier failed attempt.

Revalidation checks:

- Focused Task 28 renderer, Webpack, and packaged-policy tests pass (14
  tests), as do Prettier, `git diff --check`, and packaged-runtime verification.
- No product code changed during this revalidation; the previously recorded
  full automated quality set remains the applicable code verification.
- The final diff scan found no full socket URL, audio data URI, bearer/API
  credential, or changed sensitive-artifact path. Descriptive documentation
  references to existing session filenames are not session data.
- The current development build passed the visible check: Claude Web switched
  on the first selection and reached Connected; synthetic silent capture showed
  lifecycle state without interim text; the terminal status used the safe
  localized message; and foreground focus was confirmed.

Exact next packet:

- After human review, commit Task 28. Task 10
  (`10_define_cli_prettify_contracts.md`) is the next packet on a later explicit
  incremental-implementation invocation.

Blockers:

- None for Task 28 review. Preserve the concurrent uncommitted provider-switch
  fix in the shared worktree; it is outside the Task 28 commit boundary.
