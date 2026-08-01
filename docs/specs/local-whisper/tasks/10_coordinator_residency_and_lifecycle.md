# 10 Coordinator, Residency, And Lifecycle

## Outcome

One composition-root-owned `LocalWhisperCoordinator` authoritatively combines
settings, artifacts, capability, supervisor, and provider ports. It serializes
one resident worker, implements exact Load/lazy-load/Unload behavior,
coordinates destructive actions and settings epochs through one authoritative
command surface, and performs bounded switch, cancellation, suspend/resume,
hot-plug, and application-exit cleanup.

## Prerequisites

- The Local Whisper plan is approved.
- Tasks 01–09 are complete and committed through their packet boundaries.
- Task 10 has separate execution authorization.
- The packet begins with conformance fakes for every dependency and integrates
  real adapters only after state-machine tests pass.

## Owned Requirements

- `ARCH-003`, `ARCH-006`, `LIFE-001`
- Coordinator portions of `ARCH-005`, `ARCH-009`, `CACHE-002`
- `VRAM-001`, `VRAM-002`, `VRAM-003`
- `LIFE-002`–`LIFE-006`
- `CAP-006`, `CAP-007`, `CAP-011`, `LIFE-005`, `UI-006`
- `MODEL-008`, `FAIL-001`, `FAIL-002`, `RUNTIME-004`, `FAIL-004`
- Lifecycle portions of `RUN-003`, `RUN-005`, `FAIL-005`, `FAIL-007`
- `AC-AUTO-007`, `AC-AUTO-015`, `AC-AUTO-019`–`AC-AUTO-022`,
  `AC-AUTO-034`, `AC-AUTO-042`, `AC-AUTO-047`

## In Scope

- Process-owned coordinator composition and immutable sanitized snapshot
  publication.
- Current normalized settings, configuration/inventory epochs, and exact
  support/setup/capability/residency/activity state machines.
- `Load now`, eligible cache-miss lazy load, successful inference retention,
  `Unload`, replacement, transactional settings save, and settings reset.
- Immediate conflict rejection and per-artifact operation coordination.
- Provider switch, cancellation, app quit, suspend/resume, hot-unplug/reset,
  and device/capability invalidation.
- Typed state/failure results and deterministic tests with fake time/workers.

## Out Of Scope

- New shared types, catalog/download implementation, worker protocol, engine
  adapters, hardware probe internals, IPC, renderer UI, packaging, or docs.
- Multiple resident models, hidden lifecycle queues, transparent retries,
  automatic fallback/reload/download/update, or partial transcription.
- Persisting `Ready`, `Loaded`, worker PID, or capability evidence as truth.
- IPC/preload sender validation or renderer event delivery; Task 11 owns that
  narrow transport boundary and may not create parallel settings/epoch state.

## Task Contract

1. Construct exactly one mutable coordinator in
   `mainProcessCompositionRoot.ts`. Inject settings/catalog/inventory
   repositories, downloader/artifact operations, capability service,
   supervisor, clock, audit, and platform lifecycle ports. Provider instances
   and IPC controllers receive narrow interfaces; no constructed mutable
   module singleton is permitted.
2. Own current normalized settings, a monotonically increasing configuration
   epoch, the current inventory snapshot/epoch, support/setup/capability/
   residency/activity states, one active worker supervisor, one lifecycle
   owner, per-artifact locks, and sanitized progress/error snapshots. Task 03
   remains the injected persistence/catalog/inventory repository adapter, but
   it does not independently activate coordinator state.
3. Implement only these residency transitions:
   `Unloaded -> Loading -> Loaded -> Unloading -> Unloaded` and
   `Loading|Loaded|Unloading -> Failed -> Unloaded`. Activity is independently
   `Idle | Transcribing`. `Ready` requires valid settings, verified artifacts,
   exact `Validated`, `Loaded`, and no blocking fault; same-fingerprint
   validated/unloaded displays `Validated · Unloaded` and is not operationally
   Ready.
4. `Load now` captures epochs, validates settings/setup/support/prerequisites,
   rejects trustworthy insufficient resources, acquires the lifecycle lock,
   rechecks epochs, spawns/handshakes, initializes the exact backend/device,
   performs bounded allocation/dispatch, full model load, embedded nonpersonal
   warm-up, and actual-backend confirmation. Only total success records
   `Validated` and `Loaded`.
5. An eligible cache-miss request uses the identical load path, waits for it,
   submits canonical audio only after success, and retains a healthy Loaded
   worker after successful final-text inference. It never downloads. An
   eligible cache hit is already completed by Task 02 and does not enter the
   lifecycle lock.
6. Enforce the supervisor bounds from Task 06: handshake 10 seconds, backend
   probe 30 seconds, load 5 minutes, warm-up 2 minutes, graceful unload 15
   seconds, terminate and kill-confirmation stages 5 seconds each. Inference
   uses `max(120 seconds, 10 * validated audio duration)` capped at 30 minutes.
   Expiry returns `OPERATION_TIMEOUT` with exact stage, discards partial output,
   and terminates uncertain ownership.
7. `Unload` rejects active transcription, requests engine-level free, then
   stops the child and confirms exit. Forced confirmed cleanup may succeed with
   a sanitized warning. Unconfirmed exit is `CLEANUP_FAILED`, leaves residency
   failed/unusable, and blocks destructive artifact actions.
8. Expose one authoritative main-only `saveSettings` command consumed by Task 11. It validates the canonical candidate and expected configuration/
   inventory epochs again. Load-affecting fields are engine, runtime, target,
   backend, device, model, variant, Faster-Whisper precision, and CPU threads:
   acquire the lifecycle lock, unload old residency, recheck epochs, commit
   through Task 03, activate the candidate, increment `configurationEpoch`
   exactly once, and publish one coherent snapshot. Conflict, cleanup, stale,
   validation, or commit failure never activates the candidate or increments
   the epoch; a post-unload commit failure truthfully reports Unloaded.
   Language, prompt, temperature, strategy, beam, and best-of commit without
   unload and affect only the next immutable request snapshot.
9. Reject load, unload, replacement, selected/resident deletion, transcription,
   reset, and load-affecting save conflicts immediately as
   `OPERATION_CONFLICT`; do not queue them. An unrelated download may continue.
   Every mutation rechecks configuration and inventory epochs.
10. Integrate Task 05 model/runtime deletion. If the exact artifact is resident,
    unload first; active/conflicting work rejects deletion. Selected complete
    removal retains `Model missing` or `Runtime missing`; partial removal is
    unusable `Delete failed`; no replacement selection/download occurs.
11. Cancellation during lazy Loading terminates the partial/uncertain worker,
    leaves Unloaded, and retains only preexisting capability evidence.
    Cancellation during Transcribing sends a bounded worker cancel: a confirmed
    healthy worker may remain Loaded/Ready; otherwise terminate it and set
    Unloaded. Always return `CANCELLED` with no partial success.
12. An idle provider switch unloads/shuts down Local Whisper before activating
    the next provider. A switch during Loading, Unloading, or Transcribing
    returns conflict and leaves the provider unchanged. It does not cancel or
    hide a queue.
13. Application exit is the authoritative exception: stop accepting commands,
    cancel active load/transcription, discard private buffers/partial output,
    preserve only valid resumable journals, and perform bounded
    graceful-then-forced child-tree cleanup. Wire this before later main-process
    cleanup stages so quit cannot strand a worker, but never wait beyond the
    declared bounds.
14. On suspend, mark capability Stale, reject new work, and attempt bounded
    cancellation/unload. On resume, treat residency as uncertain, terminate
    only a still-proven-owned worker, set Unloaded, re-enumerate devices, and
    require explicit/lazy reload. Hot-unplug or driver reset during activity
    fails the operation and uses the same Stale/Unloaded boundary. Never
    auto-reload or fall back.
15. Expose one authoritative `resetSettings` command. After Tasks 11/12 provide
    the explicit confirmation and expected epochs, reject conflicts, unload,
    invoke Task 03's reset primitive, clear the prompt/provider settings only,
    increment `configurationEpoch` exactly once, and publish the coherent
    snapshot. Installed artifacts and resumable downloads remain untouched.
16. Publish immutable sanitized snapshots with monotonic revisions from this
    coordinator only. Snapshots combine its current normalized settings,
    inventory, support/setup/capability/residency/activity, progress, and safe
    errors. Getters do not start probes/downloads/workers. Task 11 only bridges
    these snapshots to authorized renderer subscribers; closing a renderer
    subscription never cancels process-owned activity.

## Contracts And Boundaries

- The coordinator is the single owner of current normalized settings,
  configuration epoch, support/setup/capability/residency/activity state,
  lifecycle locking, and coherent sanitized snapshots. Task 03 owns durable
  repository mechanics; Task 11 owns IPC/preload validation and event bridging
  only. Neither may activate parallel state or increment a second epoch.
- It never receives renderer-provided URL/path/executable/hash/argv/environment.
- Worker crashes, protocol violations, allocation uncertainty, and cleanup
  uncertainty always cross a confirmed process-exit boundary before retry.
- Audit metadata is typed and private-content-free. Raw worker/native errors
  never enter snapshots.
- Only the existing final batch completion flow may accept final text, through
  Task 02's provider seam.

## Expected Files Or Components

- Add under `src/main/localWhisper/`:
  - `LocalWhisperCoordinator.ts`;
  - focused state machine, operation arbiter, settings command owner, snapshot
    publisher, and lifecycle dependency ports as needed.
- Modify:
  - `src/main/di/mainProcessCompositionRoot.ts`;
  - `src/main/di/mainProcessRuntimeFactory.ts` or runtime graph wiring;
  - `src/main/mainProcessApplication.ts` quit ordering;
  - provider-switch integration in `src/main/browser.ts` or the Task 02 router;
  - main power-monitor/window lifecycle composition.
- Add deterministic coordinator/lifecycle tests under
  `tests/main/localWhisper/coordinator/` and focused existing provider-switch/
  application-shutdown suites.

## Acceptance Criteria

- State-transition tables reject every illegal transition and never expose
  Ready before full proof.
- Explicit load and eligible lazy load use the same ordered stages; Check
  compatibility remains nonresident.
- The coordinator alone performs load-affecting unload/commit/activation and
  increments the epoch; request-only saves never reload and affect only their
  captured next request.
- Conflict races are rejected immediately while unrelated downloads continue.
- Load/unload, success retention, deletion, reset, provider switch, suspend,
  resume, hot-unplug, cancellation, and exit leave exact specified states and
  no partial success.
- Forced cleanup is bounded and cannot claim release without confirmed child
  exit.
- No operation automatically changes engine, target, backend, device, model,
  revision, variant, precision, or provider. Tests prove Task 11 can only call
  the coordinator command port and cannot publish or increment parallel state.

## Verification

Run:

```text
rtk node --import tsx --test tests/main/localWhisper/coordinator/*.test.ts tests/main/transcription.test.ts tests/main/backgroundBrowserLifecycle.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run test:unit
rtk lint
rtk prettier --check
```

Use fake clocks/processes to prove every timeout and event ordering without
sleeping for production bounds. Run focused source/fixture tests for quit and
power-monitor wiring.

## Failure And Rollback

- Any cleanup path that cannot prove child termination, or any lifecycle API
  that forces hidden queuing/fallback, blocks the packet; do not mark a state
  Ready/Unloaded optimistically.
- Rollback removes coordinator activation and composition wiring while leaving
  prior isolated services and installed test fixtures intact. Provider Task 02
  may return a typed unavailable fake until the packet is reworked.
- New lifecycle semantics or timeout values require `/spec`; a composition
  layout correction may return to `/plan`.

## Manual Gates

- Packaged Windows/Linux process-tree and GPU-allocation settling tests are
  deferred to Task 16. Synthetic coordinator tests are mandatory here.
- Do not suspend the user's host, kill unrelated processes, change drivers, or
  run destructive real-artifact tests without the explicit Task 16 gate.
- No commit, push, publication, or Task 11 execution is authorized.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 7.1, 9.3–9.4, 10.3–10.5, 11.1, 13.2–14,
    and 15;
  - decisions `operations.concurrency-policy`,
    `operations.cancel-switch-exit`, `operations.transcription-deadline`, and
    `failure.resource-estimate-policy`.
- Local precedents:
  - `src/main/di/mainProcessCompositionRoot.ts` for process ownership;
  - `src/main/mainProcessApplication.ts` for quit ordering;
  - Task 02 provider/dispatch port and Tasks 05–09 service interfaces.

## Completion And Handoff

- Mark Task 10 complete in `todo.md`; update `handoff.md` with state-machine,
  wiring, and exact checks.
- Name Task 11 as next.
- Present lifecycle evidence and stop. Do not commit or begin Task 11 in the
  same invocation.
