# 09 GPU Thread Runtime Identity

## Outcome

Resolve `gpuCpuThreads` before worker load, enforce it in the native GPU path, and include both configured and
resolved execution state in reusable worker identity so stale residency cannot be reused.

## Prerequisites

- Packet 08 is complete and settings schema v2 is the only writable schema.
- Worker protocol remains version 1; the existing residency object already carries `resolvedCpuThreads` but the
  current GPU path sends `null` and the native worker substitutes 4.

## Owned Requirements

ARC-003, THR-004, FLOW-001, OPS-001, FAIL-001, FAIL-002, FAIL-003, AC-AUT-013.

## In Scope

- Main-process GPU thread resolution, worker load/residency messages, native GPU validation/use, reusable identity,
  configuration epoch, topology invalidation, and focused tests.

## Out Of Scope

- Settings migration owned by Packet 08 or renderer controls owned by Packet 10.
- Worker protocol-version changes, a new load message shape, runtime adaptive thread tuning, or changing CPU-path
  thread semantics.

## Task Contract

1. Resolve GPU `auto` through the existing bounded logical-processor topology contract to a concrete integer from
   1 through the current host count before worker load. An explicit integer is validated against the same bound.
2. Send the concrete GPU value in the existing residency `resolvedCpuThreads` field and update the native parser to
   require a bounded unsigned value for both CPU and GPU targets.
3. The native worker must confirm or bound the request against its current processor probe and pass the validated
   value to whisper.cpp. Remove the implicit GPU fallback to 4; legacy behavior is supplied only by v1 migration.
4. Include configured `gpuCpuThreads`, resolved value, logical-processor topology generation, and configuration
   epoch in every reusable configuration/residency identity that could reuse the worker.
5. A change in any of those values makes the old resident worker ineligible. Work already running is not silently
   moved; existing stale-configuration cleanup and exactly-one-terminal-result rules apply.
6. Invalid or stale values return `INVALID_SETTINGS` or the existing repair state and launch no worker. Native
   disagreement fails closed with content-free existing codes and removes uncertain state.

## Contracts And Boundaries

- Main owns host topology, configuration resolution, process launch, and residency identity. The worker validates
  but does not gain settings or device authority from the numeric value.
- Renderer and preload boundaries remain unchanged beyond the already typed schema-v2 setting.
- No mutable module-level container or constructed global runtime instance is allowed.

## Expected Files Or Components

- `src/main/localWhisper/composition/LocalWhisperProductionWorkerPort.ts`
- `src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts`
- `src/shared/localWhisper/catalog.ts` and residency/protocol validators as required
- `src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts`
- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp`
- Composition, supervisor, protocol, and native worker tests

## Acceptance Criteria

- AC-AUT-013 proves equality only for identical configured/resolved/topology/epoch state and rejects every stale
  variation.
- GPU values `auto`, 1, 4, and host maximum reach the worker as the expected concrete value; out-of-range values
  never launch or reuse a worker.
- Worker protocol stays at version 1 and migrated v1 GPU settings still execute with 4.

## Verification

- `npm run test:local-whisper:composition`
- `npm run test:local-whisper:supervisor`
- `npm run test:local-whisper:worker-codec`
- `npm run test:local-whisper:worker-common:native`
- `npm run typecheck`
- `npm run test:types`

## Deferred Windows And CI Gate

- Run only the listed Verification commands on the Linux development host. Do not push or inspect CI in this packet.
- Packet 17 runs deferred Windows GPU-thread, residency, and MSVC/ASan checks; Packet 18 owns fixes and reruns.
- Record local results in `handoff.md` without claiming Windows coverage; the next numbered packet becomes
  executable after local review.

## Failure And Rollback

- Any implicit GPU value, host-bound bypass, stale residency reuse, protocol-version drift, or partial worker state
  rejects the packet.
- Rollback must be coherent with schema v2: retain the persisted field and fail closed rather than silently ignore it.

## Manual Gates

- Real GPU execution for `auto`, 1, 4, and host maximum is retained on the representative Linux CUDA host in Packet
  16 and the regular Windows CUDA computer in Packet 17.

## References

- Specification Sections 9.2, 11, and 13; AC-AUT-013.
- `docs/agent-guides/project-conventions.md` Sections “Electron And Providers” and “Dependency Injection And Runtime Ownership.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with identity comparisons, worker bounds, and Packet 10 as
the next ordered packet, then stop for review.
