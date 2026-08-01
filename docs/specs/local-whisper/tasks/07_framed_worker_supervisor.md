# 07 Framed Worker Supervisor

## Outcome

Task 07 first completes the one canonical engine-neutral Local Whisper worker
protocol shared by Electron main and both future engine peers. Electron main
then owns one supervisor that starts only an authenticated immutable runtime
executable, communicates over that strict bounded framed-stdio contract,
enforces every stage deadline, implements complete Windows/Linux child-tree
ownership, and proves the available Linux termination boundary before
releasing uncertain resources. Representative Windows execution is deferred
to Task 19. The protocol and supervisor have no listening service, private argv
values, divergent engine-private messages, automatic restart/replay, PID-only
cleanup, or backend/engine/model fallback.

## Prerequisites

- Local Whisper plan revision 7 is approved. `execution.task-07` revision 2
  separately authorized this expanded packet; representative Windows execution
  is deferred to Task 19 under `planning.native-cpp-windows-gate` revision 2.
- Tasks 01, 03, 04, and 06 are complete:
  - Task 01 supplies the initial versioned protocol types, canonical
    states/failures, frame limits, and settings identities. Its incomplete
    handshake and lifecycle schemas are inputs to the Task 07 completion gate,
    not a frozen contract;
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

### Post-completion protocol repair ownership

Task 07 completed and was committed as `31c13c54`. Subsequent pinned-engine
review found that the strict probe/load schemas lacked the private
runtime-local device selector required by both engines. Under
`planning.native-device-binding-contract` and
`planning.native-device-protocol-version` revision 1, Task 09 owns one targeted
atomic repair of the unreleased protocol-v1 schemas, golden vectors,
conformance worker, supervisor API, and directly affected tests. This does not
reopen Task 07's process ownership, framing, timeout, privacy, or cleanup
implementation and does not authorize an engine-specific dialect.

## Owned Requirements

- Supervisor portions of `ARCH-005`, `RUN-001`, `RUN-002`, `RUN-003`,
  `RUN-004`, `RUN-005`, `SEC-005`, `SEC-007`, `PRIV-001`, `FAIL-005`, and
  `FAIL-007`
- Shared worker-protocol portions of `RUN-002`, `RUN-003`, `RUN-005`, and
  `AC-AUTO-024`
- Process-owned lifecycle portions of `ARCH-003`, `ARCH-006`, and `LIFE-001`;
  Task 11 owns coordinator state and orchestration
- `AC-AUTO-024`
- Process-tree/ownership portion of `AC-AUTO-040`
- Supervisor/privacy/protocol portions of `AC-AUTO-026`, `AC-AUTO-030`,
  `AC-AUTO-032`, and `AC-AUTO-048`

## In Scope

- Completion of Task 01's shared worker protocol types, strict validators,
  encoders/decoders, lifecycle sequencing, and checked-in version-1 golden
  vectors before supervisor implementation begins.
- A strict incremental length-framed stdin/stdout transport over the completed
  shared messages, with the same golden conformance vectors for Tasks 08/09.
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

### Canonical shared-protocol completion gate

1. Before writing supervisor, launcher, or conformance-worker production code,
   update `src/shared/localWhisper/protocol.ts` and its direct exports/tests so
   one public contract expresses every approved handshake and stage. Task 07
   owns this atomic repair under answered decision
   `planning.worker-protocol-repair-ownership` revision 1. No supervisor,
   whisper.cpp, or Faster-Whisper private message union or frame codec may
   coexist with it.
2. Retain protocol version `1`: no production worker peer or runtime pack has
   shipped. Change the shared schemas, validators, codecs, tests, and all
   canonical version-1 vectors atomically; do not retain compatibility with
   the incomplete unshipped Task 01 byte layout.
3. The exact outer frame is
   `[uint32-be bodyLength][uint8 frameKind][body]`. `bodyLength` counts only
   `body`, so total frame bytes are `5 + bodyLength`. Frame kind `0x01` is a
   control body and `0x02` is an audio body; every other kind is mandatory
   unknown input and a protocol violation. A parser reads and validates the
   five-byte prefix and rejects a body length above the kind-specific maximum
   before allocating the body.
4. A control body is strict fatal UTF-8 JSON for exactly one canonical control
   message. The JSON body remains at most 1 MiB, includes
   `protocolVersion: 1`, rejects duplicate/unknown keys and invalid scalar
   bounds, and never accepts trailing bytes. Length-prefix and kind bytes do
   not count toward the 1 MiB control-body limit.
5. The exact audio body is
   `[uint8 protocolVersion][uint8 finalFlag][uint32-be sequence]`
   `[uint16-be requestIdLength][requestId UTF-8][audioBytes]`. Version is `1`,
   final flag is exactly `0` or `1`, sequence is an unsigned 32-bit integer,
   request ID is 1–128 UTF-8 bytes with no control characters, and audio bytes
   are at most 1 MiB. Empty audio is legal only for the terminal chunk when it
   is needed to finish an exact declared length. The decoder rejects version,
   length, encoding, sequence, terminal, and trailing-data violations before
   exposing bytes to a request.
6. `hello` carries only protocol version. `helloAck` carries exactly protocol
   version, `engine`, immutable `runtimeRevision`, lowercase 64-hex
   `runtimeBuildDigest`, `backend`, ordered unique `capabilities`,
   `maxControlFrameBytes`, and `maxAudioChunkBytes`. Engine/backend reuse the
   canonical shared closed enums. `runtimeRevision` is the manifest
   `packRevision`, `runtimeBuildDigest` is the verified worker executable's
   manifest SHA-256, and capabilities are the manifest's ordered
   `computeTargets` (at most 32 unique 1–64-byte safe identifiers). The
   supervisor compares every value and array order with the authenticated
   runtime manifest and requires both maxima to equal the canonical 1 MiB
   constants before any model path, prompt, or audio is sent.
7. Add strict request/result pairs `probe`/`probed`, `load`/`loaded`,
   `warmup`/`warmed`, and `shutdown`/`shutdownAck`; retain
   `unload`/`unloaded`, `transcribe`/`transcript`, and
   `cancel`/`cancelled`. Every non-handshake message carries protocol version
   and a bounded request ID. `load` additionally carries the private managed
   `modelPath` and the complete structured shared
   `LocalWhisperResidencyKey` (engine, runtime pack revision, target, backend,
   opaque device ID, immutable model identity/variant, precision, and resolved
   CPU threads); `loaded` echoes that exact structure for identity comparison.
   `transcribe` retains settings epoch, exact audio byte length, and validated
   options; its binary chunks carry the same request ID, start at sequence
   zero, increase by one, declare terminal exactly once, and sum exactly to the
   declared audio length. `cancel` has its own unique request ID plus
   `targetRequestId`, and `cancelled` echoes both; only the current in-flight
   operation may be the target.
8. Retain one typed `failure` result with protocol version, request ID, and
   safe `LocalWhisperFailureCode`; request ID may be `null` only for a
   pre-request handshake/fatal peer failure. The wire result never carries a
   stage, raw backend error, path, audio, prompt, transcript, or native detail.
   The supervisor's request registry derives the exact public failure stage
   from the matching request type and current deadline.
9. Freeze the `spawned`, `handshaken`, `probed`, `loaded`, and `warmed` states
   in shared protocol tests. The only forward setup transitions are
   `hello/helloAck`, `probe/probed`, `load/loaded`, and `warmup/warmed` in that
   order. Transcribe is allowed only after `warmed`, and a successful transcript
   returns to `warmed` for a later request. `unload` is allowed from `loaded` or
   `warmed` and returns to `probed`; a later load/warm-up is explicit. `cancel`
   targets only one currently in-flight request. `shutdown` is allowed only
   after a valid handshake when the transport is healthy; `shutdownAck` is
   terminal and no later frame is legal. Duplicate, unknown, stale,
   cross-stage, and out-of-order requests/results are violations, not implicit
   transitions.
10. Commit language-neutral golden fixtures for every control message and
    representative first/middle/final audio frames, plus malformed length,
    kind, version, UTF-8, request-ID, sequence, terminal, oversize, unknown-key,
    and trailing-data cases. Vectors contain only synthetic public fixture
    values and are consumed unchanged by the TypeScript codec/conformance
    worker in this task and by the C++ and Python peers in Tasks 08/09.

### Process-ownership implementation checkpoint

1. After the shared-protocol completion gate passes, implement race-free
   process-tree ownership for Windows x64 and Linux x64. Prove the complete
   behavior on the available Linux host in this packet; representative Windows
   execution is deferred intact to Task 19 under
   `planning.native-cpp-windows-gate` revision 2. Node's ordinary `spawn` plus
   later PID cleanup is not presumed sufficient. The fixtures cover a worker
   that immediately creates descendants, parent crash/stream closure, PID
   reuse, hung graceful exit, and confirmation that no unrelated process can
   be killed.
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
5. A Linux implementation or evidence failure blocks this packet. A discovered
   Windows design/source defect also blocks it, but unavailable Windows runtime
   evidence alone is recorded for Task 19 and does not block Task 07
   completion. Do not substitute `taskkill`, process-name matching, PID-only
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

1. Consume only the canonical versioned schemas and exact byte layout completed
   by this packet and implement one incremental transport parser around them.
   The codec supports strict control frames and bounded binary audio chunks
   without base64/full-audio buffering.
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
   version, engine ID, immutable runtime revision/build digest, backend,
   ordered capabilities, and maximum frame sizes. Mismatch is
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

1. Use only the reviewed architectural ideas from OpenWhispr application
   commit `bf8b7e0b4e1de0c9779c63f4752bd80bdd39ee2c` and OpenWhispr whisper.cpp
   fork commit `dd18d1107cf20feb58f11b2719d66a5bfeaff0dc`: immutable
   backend-specific runtime packs, a persistent state-owning manager that
   retains one loaded model, serialized native context ownership, explicit
   abort, and deterministic context free.
2. Do not import or emulate OpenWhispr's `whisper-server`, loopback HTTP ports
   8178–8199, multipart private payloads, shared mutable `bin`, GitHub API
   mutable asset lookup, model path in argv, inherited environment, temporary
   audio conversion files, raw/private diagnostic logging, PID-file adoption,
   `taskkill` cleanup, published binaries, or GPU-to-CPU fallback.
3. A failure never changes target, backend, device, engine, runtime, model,
   variant, precision, or CPU threads. It returns the exact typed failure and
   leaves the selection for an explicit user decision.

## Contracts And Boundaries

- Task 04's still-held/revalidated lease is required for spawn and model-path
  handoff. A string path alone is not authority.
- Task 07 owns the canonical shared protocol plus
  process/framing/deadline/cleanup mechanics. Tasks 08/09 consume that contract
  and own engine peers; Task 11 owns readiness/residency/activity and operation
  policy.
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

- Shared protocol completion:
  - `src/shared/localWhisper/protocol.ts` and direct barrel exports when needed;
  - `tests/shared/localWhisper/protocol.test.ts`;
  - language-neutral vectors under
    `tests/fixtures/local-whisper/protocol/v1/`, including a manifest and exact
    binary/hex fixtures consumable without TypeScript execution.

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
- Linux parent/control-stream death terminates descendants, and source-contract
  tests prove the Windows assign-before-resume/kill-on-close design. Restart
  fixtures with stale locks, reused PID, wrong start identity, and forged nonce
  never kill an unrelated process. Task 19 owns representative Windows runtime
  execution of this `AC-AUTO-040` process portion.
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
  ready for Tasks 08/09. Exact assertions cover the frame-kind byte, audio
  protocol-version byte, complete handshake identity, every stage request and
  result, shutdown acknowledgement, and legal state transitions; no production
  runtime pack/publication claim is made.

## Verification

Run deterministic fixture workers and fake-clock tests first:

```text
rtk node --import tsx --test tests/shared/localWhisper/protocol.test.ts
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
Task 19 runs the real Windows Job Object descendant/main-kill suite on
representative Windows x64. Use fake clocks for long stage bounds; platform
cleanup tests use short fixture-specific injected bounds without changing
production constants.

## Failure And Rollback

- If source review finds a Job Object assignment escape race, Linux
  parent-death ownership is not atomic/rechecked, executable check/use identity
  cannot be held, or the available Linux tree exit cannot be proven, block the
  packet and return to `/plan`. A later Windows runtime failure in Task 19
  returns the defect to a separately authorized Task 07 repair. Do not use
  `taskkill`, PID-only signals, shell wrappers, or optimistic release.
- If Task 01 framing schemas cannot express strict sequencing/binary chunks,
  stop before supervisor code. Any further behavior or compatibility change
  returns to planning/specification; never implement a divergent private
  protocol.
- A cleanup failure keeps the child/artifact state unusable and blocks retry;
  never force tests green by reporting `Unloaded` without confirmed exit.
- Rollback disables supervisor composition and removes only Task 07 source,
  tests, shared protocol/vector changes, and generated local launcher fixtures
  as one atomic unshipped compatibility unit. Do not kill an unproven PID or
  delete installed artifacts/settings.

## Manual Gates

- `DEFERRED TO TASK 17 — Windows Job Object`: real Windows x64 evidence must
  prove race-free assignment, kill-on-job-close descendants, bounded
  confirmation, and no unrelated-PID cleanup before Windows support
  qualification. Its absence does not block Task 07 completion.
- `MANUAL GATE — Linux parent death`: real supported Linux evidence must prove
  PDEATHSIG/process-group/control-stream behavior for descendants and parent
  crash before Linux support qualification.
- `MANUAL GATE — lifecycle/offline qualification`: the supervisor portions of
  `AC-MAN-005` (orphan/allocation cleanup) and `AC-MAN-006` (offline/no
  inference egress) remain Task 19 gates with real engine/runtime evidence;
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
    `planning.runtime-source-toolchain`, plus
    `planning.worker-protocol-repair-ownership`.
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
- User-supplied external pattern references, pinned and non-authoritative:
  - OpenWhispr application commit
    [`bf8b7e0b4e1de0c9779c63f4752bd80bdd39ee2c`](https://github.com/OpenWhispr/openwhispr/tree/bf8b7e0b4e1de0c9779c63f4752bd80bdd39ee2c),
    specifically `src/helpers/whisperServer.js` and `src/utils/process.js`;
  - OpenWhispr whisper.cpp fork commit
    [`dd18d1107cf20feb58f11b2719d66a5bfeaff0dc`](https://github.com/OpenWhispr/whisper.cpp/tree/dd18d1107cf20feb58f11b2719d66a5bfeaff0dc),
    specifically `examples/server/server.cpp` and
    `.github/workflows/build-binaries.yml`.
  - These references provide implementation evidence only. Their listener,
    HTTP/upload, argv/environment, download, fallback, logging, process-kill,
    artifact, and support claims remain rejected by this packet.
- Downstream consumers:
  `09_shared_worker_protocol_model_authority_and_lifecycle.md`, Task 10,
  Task 11, Task 12, Task 13, and Task 14.

## Completion And Handoff

- Mark Task 07 complete in `todo.md` when the canonical shared protocol,
  vectors, supervisor, cleanup, privacy, deterministic/source-contract tests,
  and available Linux evidence are recorded. Carry every representative
  Windows execution check explicitly into Task 19 without making a Windows
  qualification claim.
- Update `handoff.md` with framing byte layout/golden vectors, public
  supervisor interfaces, production bounds, platform ownership mechanism,
  final files, generated fixture outputs, exact commands, and open gates.
- Name Task 08 as the exact next packet.
- Present the Task 07 diff/evidence and stop. Do not commit, publish, or begin
  Task 08 in the same invocation.
