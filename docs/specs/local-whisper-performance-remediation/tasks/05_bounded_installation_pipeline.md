# 05 Bounded Installation Pipeline

## Outcome

Use the Packet 01 frozen in-flight window to pipeline installation writes with real Node stream backpressure,
source-order completion, a 32 MiB aggregate ownership cap, and deterministic cleanup on every terminal path.

## Prerequisites

- Packets 01 and 04 are complete.
- `handoff.md` records exactly one selected window from 1, 2, 4, or 8 plus its sanitized evidence digest.
- Protocol v2 and its derived raw chunk bound are the only accepted app/guard wire contract.

## Owned Requirements

THR-001, RES-001, INST-002, ARC-002, RES-003, FAIL-001, FAIL-002, FAIL-003, AC-AUT-007.

## In Scope

- Process-owned TypeScript transport/pipeline state, bounded chunk issuance, write backpressure, correlation,
  response settlement, cancellation, timeouts, EOF/process failure, and staging cleanup.
- Deterministic slow-stream and failure fixtures for Linux and Windows transport behavior.
- Freezing the measured window as a named production constant.

## Out Of Scope

- Guard worker threads, concurrent artifact installs, read/hash overlap, libuv pool tuning, or adaptive runtime
  window changes.
- A value outside `[1, 2, 4, 8]`, production environment overrides, or a new dependency.
- Protocol encoding/decoding work already completed by Packet 04.

## Task Contract

1. Add the selected fixed window as a named constant owned by the installation transport/pipeline. If Packet 01
   did not produce one qualifying value, stop instead of defaulting.
2. The pipeline may have at most that many issued unsettled writes and must preserve source-order hashing and
   source-order backend writes.
3. Track aggregate live ownership across source chunks, encoded lines, Node writable buffers, decoded command
   bytes, queued chunks, and unsettled payloads. It must never exceed 32 MiB for one installation transfer.
4. When `stdin.write()` returns `false`, issue no more data until the matching `drain`; handle callback error,
   missing `drain`, process exit, EOF, timeout, and cancellation without a hang.
5. Assign unique request IDs and settle each exactly once. A duplicate, late, mismatched, or post-terminal response
   must not resurrect work or publish staging.
6. After first terminal failure or cancellation, stop new issuance, settle or safely invalidate every issued
   request, then discard staging and release process/stream/buffer ownership.
7. The guard remains single-threaded. One app process may not run concurrent installs through this change.

## Contracts And Boundaries

- A process-lifecycle class owns child process, writable backpressure, pending map, buffer accounting, and dispose;
  do not create mutable module-level runtime state or a pass-through wrapper.
- Main retains filesystem/process authority. Raw payloads, file tokens, paths, and native errors remain private and
  content-free at renderer/log boundaries.
- Cleanup is idempotent and non-throwing at ownership boundaries; the next ordinary install must start cleanly.

## Expected Files Or Components

- `src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.ts`
- `src/main/localWhisper/filesystem/NativeManagedFilesystemAdapter.ts`
- `src/main/localWhisper/artifacts/FileBackedArtifactStreamingWorker.ts`
- `src/main/localWhisper/artifacts/StreamingArtifactExtractor.ts`
- Transport, artifact-streaming, Linux-adapter, and Windows-adapter tests

## Acceptance Criteria

- AC-AUT-007 covers slow output/input, `write(false)`, delayed/missing `drain`, early and mid-window failures,
  timeout, cancellation, EOF, process exit, and late/duplicate responses.
- The selected window and 32 MiB cap are observable through deterministic test ownership counters, not production
  telemetry.
- Every case proves exact ordering, exactly-once settlement, staging removal, baseline handles/descriptors, no hang,
  and a successful clean retry.

## Verification

- `npm run test:local-whisper:filesystem`
- `npm run test:local-whisper:artifacts`
- `node --import tsx --test tests/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.test.ts`
- `npm run typecheck`
- `npm run test:types`
- `npm run format:check`

## CI Gate And Commit Discipline

- Task-specific CI commands are the complete Verification list above plus Packet 01's deterministic pipeline-window
  analyzer. Both performance aggregates must execute slow-input/output, backpressure, cancellation, timeout,
  mid-window failure, late-response, and clean-retry fixtures; Windows execution must use the Windows CI runner.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`, and
  `Local Whisper Native Quality (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI failure only in a later explicitly authorized invocation and a separate fix commit. Never
  amend or squash the implementation commit; push and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 06 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any aggregate-bound overrun, write after terminal failure, double settlement, staging resurrection, leaked handle,
  or missing retry safety rejects the packet.
- Rollback restores serial protocol-v2 issuance as one coherent TypeScript change; do not roll back the guard to v1.

## Manual Gates

- `MANUAL GATE`: repeat real slow-pipe, cancel, and induced mid-window failure on the representative Linux host in
  Packet 13 and the regular Windows computer in Packet 14.

## References

- Specification Section 7.3, Sections 11 and 13, and AC-AUT-007.
- `docs/agent-guides/project-conventions.md` Section “Dependency Injection And Runtime Ownership.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with the frozen window, peak test ownership, cleanup checks,
and Packet 06 as the next ordered packet, then stop for review.
