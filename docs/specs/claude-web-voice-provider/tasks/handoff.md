# Handoff: Claude Web Live Streaming Amendment

Status: Task 22 is complete and uncommitted; it awaits human review. Do not
begin Task 23 until a later explicit incremental-implementation invocation.

Completed:

- Tasks 01-09 and 21 are committed through `1f69fa39`.
- Added the closed renderer-safe `batch | streaming` transcription mode and
  strict metadata guards that reject unknown modes and extra fields.
- Split provider classification into a shared lifecycle base plus nominal
  `BatchVoiceProvider` and `StreamingVoiceProvider` bases. ChatGPT Web and
  OpenAI API are batch; Claude Web is streaming.
- Kept buffered `transcribe()` on the common base for Claude's explicit retry
  path. Callable start/push/finish/cancel operations remain a separate main-only
  capability, so metadata cannot invoke an incomplete live path.
- Added typed opaque operation IDs, copied PCM chunk ownership, lifecycle and
  error enums, operation inputs/results, and nominal exhaustive guards.
- Preserved existing readiness, settings, category, auth, and batch
  transcription behavior. Preload exposes only the updated safe metadata shape
  and no streaming IPC operations.

Changed files:

- `docs/specs/claude-web-voice-provider/spec.md`
- `docs/specs/claude-web-voice-provider/tasks/22_define_streaming_provider_contracts.md`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `src/shared/voiceProvider.ts`
- `src/main/providers/BaseVoiceProvider.ts`
- `src/main/providers/BatchVoiceProvider.ts`
- `src/main/providers/streamingVoiceProvider.ts`
- `src/main/providers/voiceProviderGuards.ts`
- `src/main/providers/ChatGPTVoiceProvider.ts`
- `src/main/providers/ClaudeWebVoiceProvider.ts`
- `src/main/providers/OpenAIApiVoiceProvider.ts`
- `src/main/providers/index.ts`
- `src/renderer/types.d.ts`
- `tests/main/providerSettingsIpcContract.test.ts`
- `tests/main/providers/BaseVoiceProvider.test.ts`
- `tests/main/providers/ClaudeWebVoiceProvider.test.ts`
- `tests/main/providers/providerRegistry.test.ts`
- `tests/main/transcription.test.ts`
- `tests/renderer/providerGrouping.test.ts`
- `tests/renderer/providerSettingsWindowState.test.ts`

Checks:

- Focused provider, preload-contract, renderer-state, Claude, OpenAI, and batch
  service tests pass (46 tests).
- Full unit suite passes (412 tests).
- Application and test TypeScript checks pass.
- Full ESLint and Prettier checks pass.
- `git diff --check` and renderer metadata privacy checks pass.

Exact next packet:

- After human approval, commit Task 22 with a focused conventional commit, then
  execute `23_build_live_pcm_capture.md` only.

Blockers:

- None. Task 22 is at its required human-review checkpoint.
