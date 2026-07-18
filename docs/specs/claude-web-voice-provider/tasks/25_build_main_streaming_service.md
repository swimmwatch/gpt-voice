# 25 Build Main Streaming Service

## Outcome

Main owns one strict live operation and completes existing transcription side
effects exactly once after validating the renderer's final recording WAV.

## Prerequisites

- Tasks 22 and 24 are complete and approved.

## In Scope

- Single active-operation ownership, opaque IDs, active-provider binding,
  strict sequence/chunk validation, byte accumulation, WAV equality validation,
  cancellation, and cleanup.
- Existing cache key, clipboard, history, notification, and safe timing
  completion behavior.
- Explicit failed-audio handoff for manual retry, without automatic replay.

## Out Of Scope

- IPC registration/preload, renderer capture/pacing, settings, localization,
  packaging, dependencies, or provider switching UI.

## Task Contract

1. Add a main-owned streaming transcription service with at most one global
   active operation. Start requires the active provider to be a ready streaming
   provider and returns an unpredictable opaque operation ID.
2. Bind the operation to a stable owner token supplied by trusted IPC, the
   provider ID/instance, settings/cache context, and creation time. Reject
   concurrent starts and any provider change.
3. Require sequence zero for the first chunk and exact increment-by-one
   thereafter across send and finish. Reject replay, skip, negative, noninteger,
   oversized (>2,730 except a final <=2,730 fragment), empty normal chunks, or
   odd-byte chunks before calling the provider.
4. Copy and accumulate PCM bytes in main. On finish, parse the supplied WAV with
   the verified Claude WAV validator and require byte-for-byte equality with all
   accumulated chunks plus final fragment before finalizing.
5. Complete cache, clipboard, history, notification, and safe timing metrics
   through the existing transcription semantics once and only once. Store no
   audio/transcript beyond current in-memory retry/cache/history behavior.
6. After any live audio was accepted, failure never invokes batch transcribe.
   Return retained recording WAV eligibility to the existing explicit Retry
   flow only.
7. Cancel is owner-bound and idempotent. Every success/failure/cancel clears
   provider operation, accumulated bytes, owner/provider references, and
   pending side-effect guards.

## Architecture And File Boundaries

- Add one focused service under `src/main/services/` and reuse current
  transcription/cache/history/clipboard abstractions rather than duplicating
  side effects.
- Keep Electron sender objects out of the service; Task 26 supplies a stable
  owner token and lifecycle callbacks.
- Add focused service tests with injected streaming provider and side-effect
  fakes.

## Acceptance Criteria

- Concurrent start, wrong owner, provider switch, invalid sequences, malformed
  chunks, over-limit chunks, WAV mismatch, duplicate finish, late push, and
  cancel races all fail closed.
- Successful finish proves PCM/WAV equality and writes cache/clipboard/history
  exactly once with no secret IPC result fields.
- Failure after audio performs no automatic replay and exposes explicit retry
  eligibility only in memory.
- Diagnostics contain duration, byte/frame counts, and safe error code only.
- Every terminal path leaves no active operation or retained PCM.

## Verification

- Run focused streaming service plus existing transcription/cache/history tests.
- Run application/test TypeScript checks and formatting/lint for changed files.

## References

- Mandatory: current main transcription orchestration, cache/history/clipboard
  completion flow, Claude streaming provider contract, WAV extractor, and
  provider-switch lifecycle precedent.
- Traceability: Live Streaming Contract 3, 7, and 9-10.

## Completion And Handoff

- Update todo/handoff, report ownership/side-effect evidence, and stop without
  beginning Task 26.
