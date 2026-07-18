# Handoff: Claude Web Live Streaming Amendment

Status: Task 25 is complete and uncommitted; it awaits human review. Do not
begin Task 26 until a later explicit incremental-implementation invocation.

Completed:

- Tasks 01-09 and 21-24 are committed through `b2d3676d`.
- Added a nominal Claude-only capability resolver; streaming metadata or duck
  typing cannot grant access to privileged live provider operations.
- Added one main streaming service with opaque owner identity, injected
  `randomUUID()` operation IDs, exact provider instance/ID and start-time cache
  context binding, one active operation, strict zero-based sequence validation,
  copied PCM retention, and 2,730-byte/even fragment bounds.
- Validated the renderer's canonical 16-kHz mono PCM16 WAV with the existing
  Claude extractor and byte-for-byte equality before provider finish. Invalid
  WAVs and explicit cancellation are never retry-eligible, and no live failure
  invokes buffered `transcribe()` automatically.
- Reused immutable completion helpers and the shared transcription cache so a
  live success writes cache, clipboard, and history once with the captured
  provider/request snapshot. Cancellation, provider switches, duplicate
  finish, and late provider results cannot run side effects.
- Added lifecycle cancellation, safe typed rejection/terminal results, and
  diagnostics limited to error code, monotonic duration, accepted byte/frame
  counts, and retry eligibility. No IPC handlers or renderer activation were
  added.

Changed files:

- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `src/main/providers/index.ts`
- `src/main/providers/streamingVoiceProviderCapability.ts`
- `src/main/services/MainStreamingTranscriptionRejection.ts`
- `src/main/services/streamingTranscription.ts`
- `src/main/services/transcription.ts`
- `src/main/services/transcriptionCompletion.ts`
- `tests/main/streamingTranscription.test.ts`

Checks:

- Focused streaming service, Claude provider, transcription, cache, and history
  suites pass (55 tests).
- Full unit suite passes (450 tests).
- Application and test TypeScript checks pass.
- Full ESLint and Prettier checks pass.
- `git diff --check` and sensitive-artifact/credential scans pass.

Exact next packet:

- After human approval, commit Task 25 as
  `feat(transcription): add main streaming service`, then execute
  `26_integrate_trusted_streaming_ipc.md` only.

Blockers:

- None. Task 25 is at its required human-review checkpoint.
