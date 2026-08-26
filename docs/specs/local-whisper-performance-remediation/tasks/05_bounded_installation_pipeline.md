# 05 Bounded Installation Pipeline

## Outcome

Implement candidate-window installation pipelining with real Node stream backpressure, source-order completion, a
32 MiB aggregate ownership cap, and deterministic cleanup while production composition remains serial until Packet
15 freezes the measured cross-platform window.

## Prerequisites

- Packets 01 and 04 are complete.
- Packet 01 provides deterministic candidate-window fixtures for 1, 2, 4, and 8; fixture-selected 4 is not
  production authority.
- Protocol v2 and its derived raw chunk bound are the only accepted app/guard wire contract.

## Owned Requirements

THR-001, RES-001, INST-002, ARC-002, RES-003, FAIL-001, FAIL-002, FAIL-003, AC-AUT-007.

## In Scope

- Process-owned TypeScript transport/pipeline state, bounded chunk issuance, write backpressure, correlation,
  response settlement, cancellation, timeouts, EOF/process failure, and staging cleanup.
- Deterministic platform-neutral slow-stream and failure fixtures runnable on the Linux development host.
- A narrow injected/test candidate-window seam covering 1, 2, 4, and 8 while production composition keeps
  current-equivalent serial issuance (`1`).

## Out Of Scope

- Guard worker threads, concurrent artifact installs, read/hash overlap, libuv pool tuning, or adaptive runtime
  window changes.
- A value outside `[1, 2, 4, 8]`, production environment overrides, or a new dependency.
- Protocol encoding/decoding work already completed by Packet 04.

## Task Contract

1. Implement the bounded pipeline for candidate windows 1, 2, 4, and 8, but keep production composition at
   current-equivalent serial issuance (`1`). This is a temporary non-acceptance binding, not a measured selection or
   runtime override. Packet 18 alone may replace it with the cross-platform evidence-selected named constant.
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
- Every candidate window and the 32 MiB cap are observable through deterministic test ownership counters, not
  production telemetry; production remains serial in this packet.
- Every case proves exact ordering, exactly-once settlement, staging removal, baseline handles/descriptors, no hang,
  and a successful clean retry.

## Verification

- `npm run test:local-whisper:filesystem`
- `npm run test:local-whisper:artifacts`
- `node --import tsx --test tests/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.test.ts`
- `npm run typecheck`
- `npm run test:types`
- `npm run format:check`

## Deferred Windows And CI Gate

- Run only the Verification commands above on the Linux development host. Do not push or inspect CI in this packet.
- Packet 17 owns the first Windows transport execution and exact-SHA CI run. Packet 18 owns selection of the
  production window plus every fix commit and complete rerun.
- Record local checks and the unchanged serial production binding in `handoff.md`; do not claim Windows coverage or
  a production window selection.

## Failure And Rollback

- Any aggregate-bound overrun, write after terminal failure, double settlement, staging resurrection, leaked handle,
  or missing retry safety rejects the packet.
- Rollback restores serial protocol-v2 issuance as one coherent TypeScript change; do not roll back the guard to v1.

## Manual Gates

- `MANUAL GATE`: run candidate windows under real slow-pipe, cancellation, and induced mid-window failure on the
  representative Linux host in Packet 16 and the regular Windows computer in Packet 17.

## References

- Specification Section 7.3, Sections 11 and 13, and AC-AUT-007.
- `docs/agent-guides/project-conventions.md` Section “Dependency Injection And Runtime Ownership.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with candidate-window coverage, peak test ownership, cleanup
checks, the retained serial production binding, and Packet 06 as the next ordered packet, then stop for review.
