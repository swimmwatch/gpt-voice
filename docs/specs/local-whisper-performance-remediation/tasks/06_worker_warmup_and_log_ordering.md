# 06 Worker Warm-Up And Log Ordering

## Outcome

End model load at `loaded`, execute the real one-second inference warm-up only for the existing protocol-v1
`warmup` request, and align existing native log events without changing the wire or log schema versions.

## Prerequisites

- Packet 01 is complete.
- The current supervisor still sends `load`/expects `loaded`, then sends `warmup`/expects `warmed` under worker
  protocol version 1.
- Native structured logging remains a closed schema-version-1 contract.

## Owned Requirements

FLOW-001, WRM-001, WRM-002, IPC-002, LOG-001, PRIV-002, OPS-001, AC-AUT-009.

## In Scope

- Native worker load/warmup control flow, supervisor state/evidence checks, timeout/failure cleanup, and existing
  log-event placement.
- Tests for ordering, retry, device/allocation proof, unload, and protocol violations.

## Out Of Scope

- Worker protocol version or message-shape changes.
- New log event names, production performance telemetry, diagnostics migration, or changed retention.
- Warm-up duration tuning, changed model behavior, or residency before warm-up success.

## Task Contract

1. Native `load` must authenticate and load the model, finish device/upload/allocation evidence applicable to that
   phase, emit `modelLoadCompleted`, and reply `loaded` without running inference warm-up.
2. Native `warmup` must require the loaded state, execute the existing real one-second inference warm-up, return
   `warmed` only on success, and provide only bounded existing evidence fields.
3. Preserve worker protocol version 1 and exact `load`/`loaded` then `warmup`/`warmed` shapes. Reject reordered,
   duplicate, or missing transitions through existing protocol failure behavior.
4. Emit existing `stateWarming` when explicit warm-up starts and `stateWarmed` only after success. Do not add event
   names or fields; retain optional `elapsedMs` validation and content-free failure records.
5. Commit reusable residency only after model evidence, explicit warm-up, device/allocation proof, and all authority
   revalidations succeed.
6. Warm-up failure or timeout returns `WARMUP_FAILED` or the existing stage-specific timeout, unloads or terminates
   uncertain state, releases the model lease, and permits retry only from a defined clean state.

## Contracts And Boundaries

- `worker_application.cpp` owns native state and engine lifetime; `LocalWhisperWorkerSupervisor` owns process/state
  arbitration; neither introduces mutable global runtime ownership.
- Main continues to validate native log records before retention. No audio, transcript, path, device identity, or
  raw native output is added.
- Provider setup, lazy/load-now behavior, transcription, cancellation, and renderer-safe results remain compatible.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp`
- `runtime/local-whisper/whisper-cpp/tests/worker_application_test.cpp`
- `src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts`
- `tests/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.test.ts`
- Native log decoder/relay tests where event ordering is asserted

## Acceptance Criteria

- AC-AUT-009 proves `loaded` and `modelLoadCompleted` precede real warm-up, followed by `stateWarming`, `warmed`,
  and `stateWarmed` in order.
- Load-only timing excludes warm-up work; the protocol and log schema versions remain 1.
- Failure, timeout, unload, retry, and device-proof cases leave no reusable uncertain state or invalid log record.

## Verification

- `npm run test:local-whisper:supervisor`
- `npm run test:local-whisper:worker-common:native`
- `npm run test:local-whisper:native-logging`
- `npm run test:local-whisper:worker-tsan`
- `npm run typecheck`
- `npm run format:check`

## Deferred Windows And CI Gate

- Run only the listed Verification commands on the Linux development host. Do not push or inspect CI in this packet.
- Packet 17 runs the deferred Windows MSVC/ASan load, warm-up, and log-order checks; Packet 18 owns fixes and reruns.
- Record local results in `handoff.md` without claiming Windows coverage; the next numbered packet becomes
  executable after local review.

## Failure And Rollback

- Any warm-up during load, early residency commit, schema version change, sensitive logging, or uncertain retry
  rejects the packet.
- Roll back native and supervisor event/state ordering together so the retained protocol sequence remains coherent.

## Manual Gates

- Packet 17 owns ordinary Windows MSVC worker verification. Real GPU allocation/warm-up failure runs on
  representative Linux hardware in Packet 16 and the regular Windows computer in Packet 17.
- Do not retain raw native logs from manual runs.

## References

- Specification Section 8, PRIV-002, OPS-001, and AC-AUT-009.
- `docs/agent-guides/project-conventions.md` Sections “Code And Logging” and “Dependency Injection And Runtime Ownership.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with protocol/log versions, ordering checks, and Packet 07 as
the next ordered packet, then stop for review.
