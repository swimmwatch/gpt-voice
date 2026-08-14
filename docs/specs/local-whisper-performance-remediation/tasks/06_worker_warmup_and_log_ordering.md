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

## CI Gate And Commit Discipline

- Task-specific CI commands are the complete Verification list above. Windows native quality must additionally run
  `npm run test:local-whisper:whisper-cpp:msvc-asan` and the deterministic load/warmup/log-order fixtures on
  `${{ vars.CI_WINDOWS_RUNNER }}`; Linux native quality owns TSan and sanitizer ordering evidence.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`, and
  `Local Whisper Native Quality (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI failure only in a later explicitly authorized invocation and a separate fix commit. Never
  amend or squash the implementation commit; push and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 07 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any warm-up during load, early residency commit, schema version change, sensitive logging, or uncertain retry
  rejects the packet.
- Roll back native and supervisor event/state ordering together so the retained protocol sequence remains coherent.

## Manual Gates

- Ordinary Windows MSVC worker verification is mandatory hosted CI evidence. Real GPU allocation/warm-up failure is
  repeated on representative Linux hardware in Packet 13 and the regular Windows computer in Packet 14.
- Do not retain raw native logs from manual runs.

## References

- Specification Section 8, PRIV-002, OPS-001, and AC-AUT-009.
- `docs/agent-guides/project-conventions.md` Sections “Code And Logging” and “Dependency Injection And Runtime Ownership.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with protocol/log versions, ordering checks, and Packet 07 as
the next ordered packet, then stop for review.
