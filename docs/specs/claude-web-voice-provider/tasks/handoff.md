# Handoff: Claude Web Live Streaming Amendment

Status: Task 26 is complete and uncommitted; it awaits human review. Do not
begin Task 27 until a later explicit incremental-implementation invocation.

Completed:

- Tasks 01-09 and 21-25 are committed through `739f2251`.
- Added one shared streaming IPC contract with canonical opaque UUID operation
  IDs, lifecycle/error enums, exact channels, discriminated safe results, and
  runtime validators. Existing provider imports remain compatible through
  re-exports.
- Added four trusted IPC operations for start, chunk, finish, and cancel. The
  controller accepts only the current main-window `webContents`, binds it to a
  main-only owner token, rejects settings/stale/replaced/destroyed senders, and
  copies only validated PCM/WAV values before service ownership.
- Preserved authoritative service validation for invalid sequence, PCM, and
  WAV inputs without copying oversized values. Service failures retain only
  typed error and retry eligibility; unexpected failures expose no raw output.
- Added cancellation on main-window destruction, background-browser shutdown,
  provider switch, IPC disposal, and application quit. Browser shutdown and
  provider switching now cancel before provider teardown or configured-provider
  mutation; duplicate cleanup is safe and unrelated IPC remains registered.
- Kept batch transcription unchanged. No capture, pacing, notification,
  localization, UI workflow, or packaging behavior was added.

Changed files:

- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `src/shared/streamingTranscription.ts`
- `src/main/backgroundBrowserLifecycle.ts`
- `src/main/browser.ts`
- `src/main/ipc.ts`
- `src/main/main.ts`
- `src/main/preload.ts`
- `src/main/providers/claudeWebAudio.ts`
- `src/main/providers/streamingVoiceProvider.ts`
- `src/main/services/streamingTranscription.ts`
- `src/main/streamingTranscriptionIpcController.ts`
- `src/renderer/types.d.ts`
- `tests/shared/streamingTranscription.test.ts`
- `tests/main/backgroundBrowserLifecycle.test.ts`
- `tests/main/providerSettingsIpcContract.test.ts`
- `tests/main/streamingTranscriptionIpcContract.test.ts`
- `tests/main/streamingTranscriptionIpcController.test.ts`

Checks:

- Focused shared-contract, IPC-controller, lifecycle, Task 25 service, preload,
  and trusted-window suites pass (42 tests).
- Full unit suite passes (470 tests).
- Application and test TypeScript checks pass.
- Full ESLint and Prettier checks pass.
- `git diff --check` and sensitive-artifact/credential scans pass.

Exact next packet:

- After human approval, commit Task 26 as
  `feat(transcription): add trusted streaming IPC`, then execute
  `27_integrate_streaming_recording_workflow.md` only.

Blockers:

- None. Runtime audio activation remains intentionally assigned to Task 27.
