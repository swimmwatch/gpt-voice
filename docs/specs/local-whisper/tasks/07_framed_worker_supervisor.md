# 07 Framed Worker Supervisor

## Outcome

Electron main owns one engine-neutral Local Whisper worker supervisor that
starts only an authenticated immutable runtime executable, communicates over a
strict bounded framed-stdio protocol, enforces every stage deadline, and proves
complete Windows/Linux child-tree termination before releasing uncertain
resources. The supervisor has no listening service, private argv values,
automatic restart/replay, PID-only cleanup, or backend/engine/model fallback.

## Prerequisites

- The Local Whisper plan is approved and Task 07 has separate execution
  authorization.
- Tasks 01, 03, 04, and 06 are complete:
  - Task 01 supplies versioned protocol messages, canonical states/failures,
    frame limits, and settings identities;
  - Task 03 supplies authenticated runtime/expected-file/build/protocol
    manifests;
  - Task 04 supplies stable executable/library/model leases, per-artifact
    locks, and revalidation immediately before spawn/load.
  - Task 06 supplies the modular native build/test conventions and the
    production-quality filesystem-guard baseline reused by native launchers.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved`.
- Planning decision `planning.openwhispr-adaptation-boundary` remains
  `hardened-openwhispr-pattern`: only pinned backend-specific packs and a
  persistent main-owned process are reusable ideas. OpenWhispr HTTP/ports,
  shared mutable `bin`, model path in argv, mutable unsigned assets, and
  GPU-to-CPU fallback are forbidden.
- Actual `whisper.cpp` and Faster-Whisper worker peers belong to Tasks 08 and 09. This packet uses a deterministic non-inference conformance worker.

## Owned Requirements

- Supervisor portions of `ARCH-005`, `RUN-001`, `RUN-002`, `RUN-003`,
  `RUN-004`, `RUN-005`, `SEC-005`, `SEC-007`, `PRIV-001`, `FAIL-005`, and
  `FAIL-007`
- Process-owned lifecycle portions of `ARCH-003`, `ARCH-006`, and `LIFE-001`;
  Task 11 owns coordinator state and orchestration
- `AC-AUTO-024`
- Process-tree/ownership portion of `AC-AUTO-040`
- Supervisor/privacy/protocol portions of `AC-AUTO-026`, `AC-AUTO-030`,
  `AC-AUTO-032`, and `AC-AUTO-048`

## In Scope

- A strict incremental length-framed stdin/stdout transport over Task 01
  messages, with golden conformance vectors for Tasks 08/09.
- Authenticated runtime spawn, sanitized environment/argv/cwd, handshake, and
  exact engine/runtime/backend/protocol confirmation.
- Bounded probe/load/warm-up/transcription/cancel/unload/shutdown requests with
  first-terminal-cause semantics.
- Bounded stdout parsing and a sanitized capped stderr ring buffer.
- Windows Job Object and Linux process-group/parent-death ownership through
  reviewed platform adapters/launchers.
- Ownership nonce/PID/start identity/executable identity/configuration epoch
  binding and safe stale-lock evidence.
- Deterministic fixture-worker tests for malformed frames, floods, hangs,
  crashes, child descendants, stream closure, and cleanup uncertainty.

## Out Of Scope

- Actual inference engines, model decoding, language/strategy mapping, runtime
  pack builds, Python/CTranslate2/PyAV, or `whisper.cpp` API adaptation; Tasks
  08/09 own peers.
- Catalog publication, artifact download/extraction, filesystem deletion,
  hardware support policy, capability probing, coordinator state, IPC, UI, or
  provider dispatch.
- Any HTTP/TCP/UDP/Unix-domain/named-pipe listener or loopback server.
- A native Electron/Node inference addon, user executable, `PATH` lookup,
  shell invocation, arbitrary command arguments/environment, or temporary
  audio/model files.
- Transparent worker restart, transcription replay, fallback target/backend,
  or adopting/killing an unrelated process.

## Task Contract

### Mandatory process-ownership feasibility checkpoint

1. Begin by proving race-free process-tree ownership on supported Windows x64
   and Linux x64. Node's ordinary `spawn` plus later PID cleanup is not
   presumed sufficient. The proof must cover a worker that immediately creates
   descendants, parent crash/stream closure, PID reuse, hung graceful exit,
   and confirmation that no unrelated process can be killed.
2. Windows must place the complete tree in a Job Object with
   kill-on-job-close before untrusted worker code can escape ownership. Use a
   race-free create-suspended/assign/resume or equivalent reviewed mechanism;
   assigning an already-running arbitrary child after a spawn race is not
   sufficient. Closing/terminating the job must be bounded and followed by
   confirmed process-tree exit.
3. Linux must start a dedicated process group through a minimal reviewed
   launcher that sets parent-death signaling, rechecks the expected parent
   after setup, binds the control stream/ownership nonce, and terminates the
   group on parent or control-stream death. It must not rely only on a shell,
   orphan reparenting assumptions, or `kill(pid)`.
4. If high-level APIs cannot provide the guarantees, own minimal launcher/job
   helper source in the repository with deterministic build/test scripts and a
   narrow protocol. Do not add an elevated service, general process manager,
   prebuilt opaque helper, or external native dependency without explicit
   approval.
5. If either production platform cannot prove this boundary, stop and return
   to `/plan`; do not substitute `taskkill`, process-name matching, PID-only
   cleanup, or mocked success.

### Supervisor ownership and spawn contract

1. Implement one state-owning `LocalWhisperWorkerSupervisor` per
   main-process composition graph. It owns at most one child tree, framed
   transport, request registry, stderr ring, stage deadline, cancellation, and
   cleanup promise. It is injected into Task 11; no module-level singleton or
   pass-through wrapper.
2. Start only an absolute executable and reviewed libraries supplied by Task
   04's still-valid manifest-backed lease. Revalidate file/directory identity
   immediately before creation and fail if any path/file/build identity
   changed. Never search `PATH`, execute a user file, use a downloaded
   executable before verification, or follow a link/reparse point.
3. Spawn with `shell: false`, a fixed app-owned working directory, closed or
   explicitly owned extra descriptors, and a minimal allowlisted environment.
   Ignore user Python/site packages, dynamic-loader overrides, proxies, and
   unrelated inherited environment. Permit at most fixed non-private
   protocol-mode arguments defined by the runtime manifest.
4. Model path/identity, prompt, audio, device, settings, and all user-specific
   data travel only inside private bounded stdin frames. They never appear in
   argv, process title, environment, URL, temporary filename, or routine log.
5. Bind the child and corresponding lock to a cryptographically random
   app-instance ownership nonce plus PID, OS process start identity, verified
   executable/build identity, runtime identity, and configuration epoch.
   Never adopt, signal, or clean a PID without the full still-matching proof.
6. The worker tree has no listener. Add conformance checks that observe no
   TCP/UDP/Unix-domain/named-pipe endpoint and that successful/failed fixture
   operations generate zero network requests.

### Framed stdio and handshake

1. Consume the canonical versioned control/message schemas from Task 01 and
   implement one incremental binary framing codec. Freeze the exact byte layout
   with checked-in golden vectors before Tasks 08/09 implement peers. The codec
   must support strict control frames and bounded binary audio chunks without
   base64/full-audio buffering.
2. Every frame has an unambiguous length, kind, protocol version, request ID,
   and sequence/terminal semantics as applicable. JSON/control payloads are at
   most 1 MiB. Audio chunks obey Task 01's fixed binary chunk bound. Reject
   negative/overflow lengths, oversized frames before allocation, invalid
   encoding/schema, duplicate request IDs, duplicate/out-of-order sequence,
   unexpected terminal frames, unknown mandatory kinds/fields, and trailing
   garbage.
3. Reserve stdout exclusively for protocol frames. Any non-frame bytes,
   malformed/oversized/flooding output, response for an unknown request, or a
   frame invalid for the current state is `WORKER_PROTOCOL_VIOLATION` and
   makes the child uncertain until cleanup confirms exit.
4. Before probe/load, require a handshake that matches the expected protocol
   version, engine ID, immutable runtime revision/build digest, backend
   capabilities, and maximum frame sizes. Mismatch is
   `WORKER_PROTOCOL_MISMATCH`; terminate before model data or private payloads
   are accepted.
5. Keep the transport engine-neutral. Tasks 08/09 implement the same
   handshake and request semantics independently; Faster-Whisper never shares
   an OpenWhispr/whisper.cpp server or fallback process.
6. Apply backpressure to stdin and stdout. Bound queued outgoing audio/control
   data and parsed-but-unconsumed frames; pause/resume streams instead of
   accumulating unbounded buffers in main.

### Requests, phases, and terminal causes

1. Expose typed supervisor operations needed by the coordinator: start and
   handshake, backend probe, model load, warm-up, transcription, cancel,
   graceful model free/unload, shutdown, and forced cleanup. Each captures one
   immutable runtime/model/configuration epoch and rejects stale responses.
2. Permit one lifecycle/transcription owner at a time. A second conflicting
   request returns `OPERATION_CONFLICT`; it is not queued inside the
   supervisor. Unrelated artifact downloads are outside this component.
3. Implement first-terminal-cause semantics across response, abort, timeout,
   crash, stream error/closure, protocol violation, and application shutdown.
   Once terminal, detach listeners/timers exactly once, discard later frames,
   and prevent double resolution or success after cancellation.
4. Enforce these non-user-editable upper bounds:
   - spawn plus handshake: at most the 10-second handshake phase budget;
   - backend probe: 30 seconds;
   - full model load: 5 minutes;
   - warm-up: 2 minutes;
   - graceful unload/free: 15 seconds;
   - terminate and kill-confirmation stages: 5 seconds each.
5. Enforce inference deadline
   `max(120 seconds, 10 * validated audio duration)`, capped at 30 minutes.
   The coordinator may add preceding probe/load/warm-up phases, but no phase
   hides or resets another expired deadline. Tests use fake clocks.
6. Expiry returns `OPERATION_TIMEOUT` with the exact stage, sends bounded
   cancellation when safe, treats allocation/child state as uncertain, and
   completes no partial transcript. Changing any bound requires qualification
   evidence and specification revision.
7. Cancellation is request-ID-scoped. A confirmed healthy inference cancel may
   leave the worker loaded when the later coordinator chooses; unconfirmed
   cancellation, load cancellation, malformed response, crash, or stream
   closure terminates the tree. Partial text is always discarded.

### Stderr, failures, and cleanup

1. Capture at most the most recent 64 KiB of stderr per worker in a private
   ring. Sanitize at ingestion for control characters/invalid encoding, never
   copy it verbatim into routine logs, audit, diagnostics, IPC, UI, crash
   reports, or thrown public errors, and release it when ownership ends.
2. Convert spawn error, protocol mismatch/violation, crash, timeout, backend
   failure reported by a peer, and cleanup uncertainty into Task 01 typed safe
   results with stage/retryability/recovery action/current state. Do not expose
   raw exit command, environment, path, native exception, stdout/stderr,
   prompt/audio/transcript, serial/UUID, or partial result.
3. On graceful unload/shutdown, request model free and wait up to 15 seconds.
   Then terminate the complete owned tree and wait up to five seconds; if
   needed hard-kill through the Job Object/process group and wait a final five
   seconds. Confirm OS process-tree termination before reporting allocation
   released or supervisor reusable.
4. If complete termination cannot be proven, return `CLEANUP_FAILED`, retain a
   failed/unusable ownership record for restart/manual recovery, and block a
   new worker or destructive artifact action. Never report `Unloaded` or reuse
   the same runtime/model optimistically.
5. A crash, hang, protocol mismatch, load/warm-up failure, or parent stream
   closure fails once, discards partial output, invalidates operational
   readiness, and requires a fresh later explicit/lazy load attempt after
   confirmed cleanup. There is no automatic restart loop or transcription
   replay.
6. Startup may clean an orphan only when lock nonce, PID, OS start identity,
   executable/build identity, and ownership evidence all prove it belongs to
   this application. A reused PID or incomplete/forged record is treated as a
   stale non-authoritative lock; never signal the process.

### Hardened OpenWhispr boundary

1. Reuse only the architectural ideas of immutable pinned backend-specific
   runtime packs and a persistent main-owned worker that can retain one loaded
   model.
2. Do not import or emulate OpenWhispr's `whisper-server`, loopback HTTP ports
   8178–8199, multipart private payloads, shared mutable `bin`, GitHub API
   mutable asset lookup, model path in argv, or GPU-to-CPU fallback.
3. A failure never changes target, backend, device, engine, runtime, model,
   variant, precision, or CPU threads. It returns the exact typed failure and
   leaves the selection for an explicit user decision.

## Contracts And Boundaries

- Task 04's still-held/revalidated lease is required for spawn and model-path
  handoff. A string path alone is not authority.
- Task 07 owns process/framing/deadline/cleanup mechanics. Tasks 08/09 own
  engine peers; Task 11 owns readiness/residency/activity and operation policy.
- `src/main/services/prettifyCliRunner.ts` may inform abort and first-terminal
  patterns only. It must not be reused directly: it accepts user/PATH
  executables, buffers whole output, uses PID-based `taskkill`, and has no
  framed persistent protocol or Job Object/PDEATHSIG contract.
- No native inference code is loaded into Electron/Node; a peer crash remains
  inside the owned child boundary.
- Private buffers are bounded and released on every terminal path. No network
  listener or inference egress is part of the protocol.
- Platform helper/launcher instances are composition-owned and explicitly
  disposed on application shutdown; no constructed mutable module singleton.

## Expected Files Or Components

- Main modules under `src/main/localWhisper/supervisor/`, expected to include:
  - `LocalWhisperWorkerSupervisor.ts`;
  - `LocalWhisperFrameCodec.ts`;
  - `LocalWhisperWorkerTransport.ts`;
  - `WorkerProcessOwnership.ts`;
  - `WindowsJobObjectOwner.ts`;
  - `LinuxProcessGroupOwner.ts`;
  - `BoundedStderrRing.ts`;
  - named timing/frame constants.
- Minimal platform source if required:
  - `runtime/local-whisper/launcher/linux/` for parent-death/process-group
    setup;
  - `runtime/local-whisper/launcher/windows/` for race-free Job Object
    ownership.
- Deterministic build/verification scripts under `scripts/local-whisper/`;
  generated binaries remain ignored until Task 15 packages reviewed fixtures.
- A non-inference conformance worker under
  `tests/fixtures/local-whisper/worker/` supporting scripted handshake,
  response, malformed/oversized/out-of-order, flood, hang, crash, descendant,
  and stream-close modes.
- Tests under `tests/main/localWhisper/supervisor/` and checked-in protocol
  golden vectors consumable by Tasks 08/09.
- Expected package scripts:
  - `build:local-whisper:launcher`;
  - `verify:local-whisper:launcher`;
  - `test:local-whisper:supervisor`.

## Acceptance Criteria

- Only the exact manifest-owned absolute executable starts with `shell: false`,
  fixed cwd, sanitized environment, fixed non-private argv, and complete
  process-tree ownership. Identity change before spawn fails first.
- Handshake mismatch; malformed, oversized, duplicate, out-of-order, unknown,
  and stdout-flood frames; every stage timeout; crash; hung inference;
  failed free; hung exit; and parent stream closure all produce bounded exact
  outcomes with no orphan, listener, fallback, replay, or partial result
  (`AC-AUTO-024`).
- Windows force-closing main/job and Linux parent/control-stream death terminate
  descendants. Restart fixtures with stale locks, reused PID, wrong start
  identity, and forged nonce never kill an unrelated process
  (`AC-AUTO-040` process portion).
- Protocol/control allocation never exceeds declared bounds; JSON/control
  frames over 1 MiB fail before allocation; stderr remains capped at 64 KiB;
  outgoing audio observes backpressure.
- Exact fake-clock assertions cover 10-second handshake, 30-second probe,
  5-minute load, 2-minute warm-up, 15-second free, both 5-second cleanup stages,
  and the bounded duration-derived inference deadline.
- Captured logs/results/diagnostics/process metadata contain no audio,
  transcript, prompt, raw output, full path/URL, argv/environment, serial/UUID,
  or native exception; fixture inference opens no network endpoint
  (`AC-AUTO-026` supervisor portion).
- Golden protocol vectors pass both the main codec and conformance peer and are
  ready for Tasks 08/09; no production runtime pack/publication claim is made.

## Verification

Run deterministic fixture workers and fake-clock tests first:

```text
rtk npm run test:local-whisper:supervisor
rtk node --import tsx --test tests/main/localWhisper/supervisor/*.test.ts
rtk npm run verify:local-whisper:launcher -- --fixture
rtk npm run typecheck
rtk npm run test:types
rtk npm run test:unit
rtk lint
rtk prettier --check
```

Run the real Linux launcher descendant/parent-death suite on supported Linux.
Run the real Windows Job Object descendant/main-kill suite on representative
Windows x64. Use fake clocks for long stage bounds; platform cleanup tests use
short fixture-specific injected bounds without changing production constants.

## Failure And Rollback

- If Job Object assignment has an escape race, Linux parent-death ownership is
  not atomic/rechecked, executable check/use identity cannot be held, or tree
  exit cannot be proven, block the packet and return to `/plan`. Do not use
  `taskkill`, PID-only signals, shell wrappers, or optimistic release.
- If Task 01 framing schemas cannot express strict sequencing/binary chunks,
  repair Task 01 through planning before implementing a divergent private
  protocol.
- A cleanup failure keeps the child/artifact state unusable and blocks retry;
  never force tests green by reporting `Unloaded` without confirmed exit.
- Rollback disables supervisor composition and removes only Task 07 source,
  tests, and generated local launcher fixtures. Do not kill an unproven PID or
  delete installed artifacts/settings.

## Manual Gates

- `MANUAL GATE — Windows Job Object`: real Windows x64 evidence must prove
  race-free assignment, kill-on-job-close descendants, bounded confirmation,
  and no unrelated-PID cleanup before Windows support qualification.
- `MANUAL GATE — Linux parent death`: real supported Linux evidence must prove
  PDEATHSIG/process-group/control-stream behavior for descendants and parent
  crash before Linux support qualification.
- `MANUAL GATE — lifecycle/offline qualification`: the supervisor portions of
  `AC-MAN-005` (orphan/allocation cleanup) and `AC-MAN-006` (offline/no
  inference egress) remain Task 17 gates with real engine/runtime evidence;
  conformance-worker success cannot close them.
- `MANUAL GATE — native helper/dependency`: any external native package,
  prebuilt helper, elevated service, or packaging change requires explicit
  approval and later license/SBOM review.
- No real inference runtime/model, production signing, upload, commit, push,
  release, or Task 08 execution is authorized.

## References

- Mandatory task-local specification sections:
  - `../spec.md` Sections 7.1–7.4, 9.1, 9.3–9.4, 12.1–12.2, 14–16,
    17.2, and 19.1;
  - `../decisions.yaml` entries `security.worker-protocol-boundary`,
    `security.path-and-worker-ownership`, `failure.worker-retry-policy`,
    `operations.transcription-deadline`,
    `planning.openwhispr-adaptation-boundary`, and
    `planning.runtime-source-toolchain`.
- Dependency contracts:
  - `01_shared_domain_contracts.md`;
  - `03_trusted_catalog_settings_and_inventory.md`;
  - `04_managed_filesystem_safety.md`.
  - `06_native_cpp_modularization.md`.
- Local background only:
  - `src/main/services/prettifyCliRunner.ts` for abort/terminal-cause lessons,
    not as a compliant process runner;
  - `src/main/di/mainProcessCompositionRoot.ts` and
    `src/main/mainProcessApplication.ts` for process ownership and shutdown.
- Downstream consumers: `08_hardened_whisper_cpp_runtime.md`, Task 09, Task 10,
  and Task 11.

## Completion And Handoff

- Mark Task 07 complete in `todo.md` only when protocol, cleanup, privacy, and
  all available real platform evidence are recorded; otherwise leave the exact
  platform feasibility blocker.
- Update `handoff.md` with framing byte layout/golden vectors, public
  supervisor interfaces, production bounds, platform ownership mechanism,
  final files, generated fixture outputs, exact commands, and open gates.
- Name Task 08 as the exact next packet.
- Present the Task 07 diff/evidence and stop. Do not commit, publish, or begin
  Task 08 in the same invocation.
