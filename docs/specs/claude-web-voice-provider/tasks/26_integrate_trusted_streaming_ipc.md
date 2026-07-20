# 26 Integrate Trusted Streaming IPC

## Outcome

Four typed, main-window-only streaming operations connect renderer to the main
service and cancel safely at every privileged lifecycle boundary.

## Prerequisites

- Tasks 22 and 25 are complete and approved.

## In Scope

- Typed start/send/finish/cancel IPC across main, preload, and renderer
  declaration files.
- Trusted sender and main-window ownership checks.
- Cancellation on main-window destruction, provider switch, browser shutdown,
  application exit, and IPC teardown.
- Transfer/copy behavior and contract tests.

## Out Of Scope

- Audio capture, queue pacing, recording UI workflow, transport internals,
  localization, or packaging.

## Task Contract

1. Expose exactly:
   - `startStreamingTranscription()`
   - `sendStreamingTranscriptionChunk(operationId, sequence, chunk)`
   - `finishStreamingTranscription(operationId, sequence, finalChunk, recordingWav)`
   - `cancelStreamingTranscription(operationId)`
2. Update `src/main/ipc.ts`, `src/main/preload.ts`, and
   `src/renderer/types.d.ts` together with one shared argument/result contract.
3. Accept calls only from the current trusted main-window `webContents`. Provider
   settings windows and stale/replaced main windows must be rejected before
   touching the service.
4. Use the current main-window identity as the stable owner token. The renderer
   supplies only opaque operation ID, integer sequence, and copied byte arrays;
   it never supplies provider/account/session/socket/cache identifiers.
5. Validate inexpensive envelope/type/size bounds before copying large arrays;
   the main service remains authoritative for sequence, ownership, provider, and
   PCM/WAV equality.
6. Wire cancellation before provider switch and on main-window destruction,
   browser shutdown, application exit, and handler removal. Late IPC cannot
   complete the cancelled operation.

## Architecture And File Boundaries

- Change typed IPC/preload/renderer contracts as one atomic slice.
- Reuse existing trusted-sender validation and window/browser lifecycle hooks.
- Add focused IPC contract and lifecycle tests; do not integrate recording hook.

## Acceptance Criteria

- All four methods have strict compile-time and runtime input contracts.
- Calls from settings windows, stale windows, or unknown senders fail without
  provider invocation.
- Operation ownership survives normal calls and is cancelled on every listed
  lifecycle boundary.
- No secret/private provider state crosses IPC and no raw IPC surface reaches
  renderer code.
- Existing batch transcription IPC remains unchanged and tested.

## Verification

- Run focused IPC/preload/trusted-sender/window/browser/provider-switch tests.
- Run application and renderer/test TypeScript checks.
- Run formatting/lint for changed files.

## References

- Mandatory: current transcription IPC, trusted sender helper, preload API,
  renderer declarations, main-window lifecycle, browser shutdown, and focused
  contract tests.
- Traceability: Live Streaming Contract 2-3 and 9-10.

## Completion And Handoff

- Update todo/handoff, report sender/lifecycle evidence, and stop without
  beginning Task 27.
