# 22 Define Streaming Provider Contracts

## Outcome

Generic provider metadata and strict streaming interfaces describe live
transcription without changing existing batch-provider behavior.

## Prerequisites

- Task 21 passed and its human checkpoint is approved.

## In Scope

- `VoiceTranscriptionMode = 'batch' | 'streaming'` in renderer-safe provider
  metadata.
- Exhaustive provider streaming capability, input, result, and error/lifecycle
  interfaces owned by main.
- A common lifecycle base with separate nominal batch and streaming provider
  bases that preserve buffered retry without exposing incomplete live methods.
- Claude advertises streaming; ChatGPT Web and OpenAI API advertise batch.
- Registry, serialization/type guards, and batch compatibility tests.

## Out Of Scope

- Audio capture, WebSocket refactoring, main operation orchestration, IPC,
  renderer workflow, localization, or feature enablement.
- Optional/duck-typed streaming methods or a default that can accidentally
  enable live mode.

## Task Contract

1. Add the closed union `VoiceTranscriptionMode` and require every voice
   provider's renderer-safe metadata to declare one value.
2. Keep batch `transcribe(wav)` behavior available. Define explicit typed
   start/push/finish/cancel provider operations for streaming-capable providers;
   do not add no-op methods to batch providers.
3. Split registered providers between nominal `BatchVoiceProvider` and
   `StreamingVoiceProvider` bases. Keep shared lifecycle and buffered retry on
   `BaseVoiceProvider`; keep callable live operations in a separate capability.
4. Use exhaustive type guards/discriminants so callers cannot invoke streaming
   from metadata alone or fall through an unknown provider/mode.
5. Claude Web is the only initial streaming provider. ChatGPT Web and OpenAI API
   remain batch and all existing readiness/settings/category metadata remains
   unchanged.
6. Streaming chunks are copied `Uint8Array` PCM data with an opaque operation
   identity at the service boundary; provider interfaces never expose account,
   page, socket, or session state.

## Architecture And File Boundaries

- Own shared metadata in the existing provider metadata contract and registry.
- Own nominal batch/streaming bases and privileged streaming interfaces in
  focused main-provider contract modules beside `BaseVoiceProvider`.
- Update `src/main/preload.ts` and renderer declarations only for metadata
  shape, not streaming methods; Task 26 owns operations.
- Update focused base-provider and registry tests.

## Acceptance Criteria

- Every registered voice provider declares exactly one transcription mode.
- Only Claude extends and narrows to the streaming provider base; ChatGPT and
  OpenAI extend the batch provider base.
- Unknown/malformed modes fail closed in renderer-safe guards.
- Existing ChatGPT/OpenAI batch transcription tests pass without behavioral
  changes.
- No credential, session, organization, endpoint, or socket field crosses the
  provider metadata boundary.

## Verification

- Run focused base-provider, provider-registry, preload-contract, and renderer
  provider-state tests.
- Run application and test TypeScript checks.
- Run formatting/lint for changed files.

## References

- Mandatory: current provider metadata/registry, `BaseVoiceProvider`, preload
  provider serialization, renderer `ProviderInfo`, and their focused tests.
- Traceability: Live Streaming Contract 1-3 and 12.

## Completion And Handoff

- Update todo/handoff, present metadata and compatibility evidence, and stop.
- Do not commit this packet or begin Task 23 in the same invocation.
