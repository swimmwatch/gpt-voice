# Task 19: Linux Candidate Activation And Qualification

## Outcome

Replace the always-deferred Linux/Windows Local Whisper startup injection with
one process-owned, production-candidate environment assembled from the existing
catalog, settings, inventory, managed-filesystem, artifact, capability,
supervisor, coordinator, IPC, and snapshot components. Prove that the graph
fails closed when authenticated production inputs are unavailable and can run a
real Linux CPU/CUDA Local Whisper flow when those inputs are present.

After the activation milestone passes, freeze one candidate and its approved
qualification profiles, then run and record the complete Linux x64 CPU/CUDA,
native, application, package, lifecycle, privacy, offline, performance, memory,
and downgrade qualification. Produce an immutable privacy-safe Linux evidence
slice that Task 20 must consume without changing the candidate or Task 17
fixture digest. Perform no representative Windows execution.

## Prerequisites

- Specification revision 7 and plan revision 14 are approved.
- Tasks 01–18 are complete; Task 18 changes are reviewed and committed before
  production-candidate activation begins.
- The Task 17 public fixture bundle digest is exactly
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- The current source fact is explicit: `src/main/main.ts` injects
  `createDeferredLocalWhisperEnvironment` for every platform, while the
  concrete repositories and services are otherwise constructed only by tests.
- The current packaged catalog is a disabled publication sentinel. No fixture
  key, fixture origin, fixture catalog, unsigned catalog, or locally invented
  artifact identity may be admitted into a production candidate.
- The Linux x64 NVIDIA host is authorized for bounded qualification and its
  exact OS, kernel, topology, GPU, driver, compute capability, VRAM, CPU, and
  RAM can be collected privately.
- Task 19 has separate execution authorization. Planning approval alone does
  not authorize implementation, qualification, commit, push, publication, or
  release.

Authenticated production catalog/key/origin data, exact runtime/model inputs,
licenses, redistribution approval, and the immediately preceding Linux package
are manual gates. Their absence does not permit a fixture substitution. The
activation code and fail-closed tests may proceed, but candidate freeze and
affected qualification rows remain blocked or `Pending` until the exact inputs
exist.

## Owned Requirements

- Production-candidate integration evidence for `ARCH-003`–`ARCH-006`,
  `ARCH-010`, `CAP-001`–`CAP-017`, `IPC-001`–`IPC-003`, `RUN-001`–`RUN-007`,
  `SEC-001`–`SEC-011`, `LIFE-001`–`LIFE-006`, `SET-001`, `VAL-001`,
  `MODEL-002`, `MODEL-006`–`MODEL-008`, `RUNTIME-003`–`RUNTIME-004`, and
  `PKG-005` without changing their primary implementation owners.
- Linux qualification slices of `OUT-001`, `BASE-001`, `ARCH-001`, `ARCH-009`,
  `COMP-001`–`COMP-004`, `CAP-001`, `CAP-011`, `LIFE-005`, `PRIV-001`–
  `PRIV-004`, `DIAG-001`–`DIAG-003`, and `DOC-001`.
- Linux platform evidence supporting every applicable deterministic acceptance
  criterion in `AC-AUTO-001`–`AC-AUTO-054` and `AC-AUTO-056`–`AC-AUTO-063`.
- Linux portions of `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`,
  and `AC-MAN-013`.
- Candidate freeze, qualification-profile validation, Linux evidence capture,
  and immutable handoff to Tasks 20 and 21.
- Task 19 owns no aggregate automated acceptance result. Primary ownership of
  cross-platform assertions `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, and
  `AC-AUTO-040` remains in Task 21.

## In Scope

### Milestone A — production-candidate activation

- Add one production Local Whisper environment factory/composition module. It
  consumes only injected process facts and immutable packaged inputs, owns the
  complete mutable graph, and returns the existing
  `MainProcessLocalWhisperEnvironment` surfaces plus deterministic disposal.
- Change `src/main/main.ts` so Linux and Windows request that production
  factory. Keep `createDeferredLocalWhisperEnvironment` only as the explicit
  unavailable/fail-closed result and the macOS Planned skeleton; it may not be
  the unconditional Linux/Windows graph.
- Load and authenticate the packaged production catalog before it grants
  runtime, model, origin, download, settings-option, or worker authority.
  Preserve the disabled sentinel when production publication is absent.
- Compose the existing settings store/repository, packaged resource resolver,
  native guard transport and platform adapter, managed root/locks/store,
  catalog/inventory repositories, artifact pipeline, device-identity store,
  capability policy, worker process ownership/supervisor/lifecycle,
  coordinator ports, dynamic snapshot facts, audit-safe command ports, and
  open-managed-folder/reference ports.
- Add the missing concrete adapters for catalog input loading, inventory
  refresh, disk/resource facts, Linux CPU/CUDA discovery, exact device registry
  binding, worker/runtime/model lease resolution, coordinator worker and
  artifact ports, and graph disposal. Reuse existing state-owning classes; do
  not replace them with pass-through wrappers or a mutable service locator.
- Repair capability sequencing so static catalog/artifact/resource checks do
  not manufacture allocation/dispatch/device proof. A fresh probe worker owns
  bounded backend activation and proof; a fresh full-load worker repeats proof,
  receives the authenticated model authority, loads/warm-ups, and becomes the
  only resident lease after total success.
- Add production composition and Linux live-path integration tests with
  task-owned temporary roots. Include disabled/invalid catalog, missing helper,
  missing/corrupt artifact, stale inventory, topology change, cancellation,
  crash, unload, shutdown, and fixture-isolation negatives.
- Align active documentation, validation messages, source-contract tests, and
  immutable profile commentary with Task 20 as the exclusive representative
  Windows executor. Legacy profile IDs containing `candidate-task19` remain
  opaque IDs and are not silently rewritten.

### Milestone B — candidate freeze and Linux qualification

- Add strict versioned candidate, profile, platform-result, and evidence-index
  schemas plus bounded privacy-safe validators required to execute Linux
  qualification and later reconcile the same candidate on Windows.
- Freeze the application commit/package identity, approved
  source/runtime/model identities, Task 17 fixture digest, qualification
  profiles, and nonsecret tool identities only after Milestone A passes on the
  candidate inputs.
- Run deterministic application, native C++, source, artifact, package,
  lifecycle, UI/accessibility, migration, privacy, diagnostics, and offline
  checks applicable to Linux.
- Run every approved Linux x64 CPU and NVIDIA CUDA profile, including direct
  pinned-engine comparison, accuracy, timing, RTF, RAM/VRAM, repetition, crash,
  cancellation, unload, cleanup, provider-switch, suspend/resume, app-exit,
  and offline restart behavior.
- Run the exact immediately preceding Linux packaged binary against the
  approved nonprivate downgrade fixture and record its identity and outcome.
- Record unavailable inputs or external approvals as `Pending`; never infer a
  pass from source, mocks, compilation, another device, or another platform.
- Update task checklist and handoff with activation state, frozen candidate
  identity, Linux Pass/Fail/Pending results, evidence digests, and exact Task 20
  inputs.

## Out Of Scope

- Creating or selecting production signing keys, signing with private material,
  choosing a production hosting origin, uploading artifacts, publishing a
  catalog, or converting/downloading an unapproved model.
- Any representative Windows command, Windows CI/job execution, Wine run,
  cross-compiled Windows substitute, or Windows support conclusion.
- Physical AMD promotion evidence or a Production AMD claim.
- Executable macOS inference, Metal, Core ML, signing, or notarization. The
  macOS arm64 path remains `Planned · Unavailable`.
- Final cross-platform reconciliation, aggregate acceptance ownership result,
  release-blocker report, support-claim promotion, publication, tag, upload,
  push, pull request, or release.
- Repairing a failed earlier owner packet outside the integration seam,
  changing a profile threshold after observing results, or regenerating the
  frozen candidate in place.

## Task Contract

### A1. Composition ownership and startup

The new factory is the only production construction site for Local Whisper
runtime state. It must create no module-level mutable instance and must transfer
all cleanup to the main-process application lifecycle. Startup and metadata
reads perform no download, inference-network access, worker launch, backend
probe, or RAM/VRAM allocation.

On Linux and Windows, an authenticated catalog plus valid packaged helper
manifest exposes normalized catalog/settings/inventory facts. Missing,
disabled, malformed, unsigned, wrongly signed, wrong-purpose, wrong-app,
wrong-protocol, non-allowlisted, or fixture-only inputs produce a stable
Not-ready snapshot and no artifact URL, worker path, device authority, or
mutation authority. macOS continues to take the existing Planned/unavailable
skeleton before any executable resource resolution.

Configuration paths must be derived from the canonical application directory.
Managed artifact paths remain descriptor/handle-anchored, private settings and
device salt remain owner-only, and renderer-facing surfaces receive only
sanitized IDs and labels. Opening the managed folder or an approved reference
is an explicit trusted-main action; renderer-supplied paths and URLs are never
accepted.

### A2. Catalog, settings, inventory, and artifact graph

Use `LocalWhisperCatalogRepository` with packaged production bytes and the
reviewed production trust policy. Use `LocalWhisperSettingsRepository` and
`LocalWhisperInventoryRepository` against the validation context and evidence
derived from that exact authenticated catalog. Startup reconstructs inventory
from managed evidence; it never trusts a persisted inventory snapshot.

`ManagedArtifactStore` owns exact runtime/model authorities through the native
guard. The artifact command adapter resolves only catalog entries, serializes
same-artifact operations, refreshes inventory epochs after promotion/removal,
and maps typed failures without paths or URLs. Explicit download/resume/retry,
cancel, update, rollback selection, delete, and runtime removal use the existing
artifact service and never run merely because the settings screen opened.

The disabled packaged publication remains an expected fail-closed state. It is
not replaced with the Task 17 fixture. An authenticated real catalog and its
artifacts are external candidate inputs and must be recorded before freeze.

### A3. Device, capability, and resource authority

Add a narrow device-discovery owner that enumerates CPU plus backend-native
devices for the selected installed runtime. Stable renderer IDs come only from
`LocalWhisperDeviceIdentityRepository`; canonical native identities, registry
entries, ordinals, fingerprints, driver details, and allocation evidence remain
private. Topology generation is monotonic and invalidates saved capability and
residency when the exact registry changes.

CPU discovery validates the available logical processors and required ISA.
CUDA discovery accepts only a physical NVIDIA device exposed by the exact
runtime registry and records driver/runtime/compiled-target/dependency facts.
It must not treat `nvidia-smi`, a display label, a generic OS index, a copied
request value, or an ordinal alone as authority. AMD stays Preview and may be
presented only through its existing fail-closed contracts; no physical AMD
success is produced. Metal remains unavailable.

Refine the coordinator capability seam as needed so the sequence is:

1. validate settings, catalog membership, installed artifact identities,
   current topology, prerequisite facts, and conservative RAM/VRAM policy;
2. create a one-use process-local device authority;
3. launch a fresh probe-only worker with no model authority and validate its
   activation/allocation/dispatch proof;
4. terminate that probe and publish `ValidatedUnloaded`; or, for load, launch a
   separate fresh full-load worker, repeat proof, bind the model lease, load and
   warm up, then publish `Ready`.

No port may pre-fill successful allocation/dispatch booleans before native
proof. Any stale epoch, topology, catalog, artifact, registry, proof, resource,
or device identity fails closed without fallback.

### A4. Worker and lifecycle graph

The worker adapter resolves the selected installed runtime executable from its
authenticated manifest and lease, verifies identity, and constructs a fresh
`LocalWhisperWorkerLifecycle` session around
`NativeLauncherProcessOwner`, `WorkerProcessOwnership`,
`LocalWhisperWorkerSupervisor`, and `LocalWhisperWorkerTransport`. It passes no
path, prompt, audio, device authority, or model identity through argv.

Probe and full-load sessions are distinct. Full load acquires the exact model
lease and the existing one-use native guard-to-launcher authority handoff.
Linux uses the defined descriptor-3 contract. Windows source wiring preserves
the arbitrary-handle/Job Object contract but is not executed in this packet.
Cancellation, timeout, protocol failure, stale proof, crash, unload, provider
switch, suspend/resume, topology change, and app exit must deterministically
release or terminate the complete owned worker tree before a released state is
reported.

The application-owned disposer shuts down the coordinator, worker ownership,
artifact operations, managed store/locks, native guard transport, subscriptions,
and process records in a deterministic order. Cleanup failure remains typed and
does not silently claim unloaded resources.

### B1. Frozen candidate and evidence foundation

Create the candidate once. Its manifest binds the exact source commit,
application/package hashes, approved profile digests, runtime/model/source-lock
identities, fixture digest, schema versions, and sanitized tool identities. Raw
host paths, unique hardware identifiers, environment data, audio, transcripts,
prompts, and private logs remain outside the repository and chat.

Every result row uses exactly `Pass`, `Fail`, `Pending`, or `Not Applicable`, a
stable reason code, candidate digest, profile digest when applicable, evidence
digest, platform, and evidence class. Validators reject merged candidates,
unknown statuses, missing units/bounds, fabricated hardware evidence, and a
fixture digest different from Task 17.

Task 20 must consume the checked-in schemas, commands, sanitized candidate
identity, live-composition contract, and immutable evidence index without
executing Linux again.

### B2. Deterministic and native Linux sweep

Run all deterministic checks needed to establish the Linux slice, including:

- settings, validation, provider selection, IPC, catalog, inventory, artifact
  download/resume/install/update/delete/quarantine, and residency/lifecycle;
- the real production-candidate construction path, fail-closed publication
  path, descriptor-anchored filesystem safety, locks, races, worker framing,
  model authority, process-group/parent-death cleanup, cancellation, and crash
  reload;
- `whisperCpp` fixed-engine, CPU/CUDA isolation, no fallback, no inference
  network, no ambient/path loader resolution, terminal cleanup, and fresh load;
- source/patch/license/SBOM/provenance/expected-file/dependency-closure checks,
  disconnected build/configure, relocation, malicious CWD/environment, and
  Task 17 fixture consumption;
- migration, legacy chooser, UI/accessibility, privacy/audit/diagnostics, base
  package boundary, and macOS/AMD presentation contracts where deterministic.

Source inspection, compilation, mocks, or source-contract checks remain their
actual evidence class and cannot satisfy a real Linux platform/hardware row.

### B3. Linux production profiles

Before execution, validate each profile's exact OS family/build, architecture,
reference hardware, driver/runtime/ISA, engine/backend, source/runtime/model
identities, fixture hashes/licenses, repetitions, algorithms, tool versions,
units, tolerances, warm-up/discard rules, and pass limits. Reject an incomplete
profile before measurement.

For each applicable profile:

- every worker stage stays within its preapproved bound;
- normalized WER is no worse than one absolute percentage point above the
  pinned direct-engine reference on nonpersonal reference audio;
- output has no missing, duplicated, partial, or cross-request text;
- `base` median RTF is at most 1.0 over at least five 60-second fixtures after
  warm-up on the declared reference hardware;
- measured peak RAM/VRAM stays within the published qualified peak plus the
  predefined tolerance;
- 10 load/unload cycles and 20 sequential transcriptions complete without a
  crash, orphan, or monotonically growing owned memory;
- no owned process or GPU allocation remains after unload/forced termination
  and the predefined settling interval;
- injected crash recovery, provider switch, suspend/resume, app-exit cleanup,
  and offline restart/load/transcription pass.

Run CUDA profiles only for the exact claimed NVIDIA cells and prove selected
device identity without exposing unique hardware data. Run CPU profiles with
GPU access explicitly absent and prove no GPU initialization. A missing pack,
profile, origin, redistribution approval, device, or toolchain is `Pending`.

### B4. Linux downgrade

Obtain the exact immediately preceding Linux package from the approved release
source and record version, hash, signature/provenance where available. Against
the nonprivate fixture, the older binary must remain Not ready, execute and
delete no Local Whisper data, preserve the namespaces, and recover through its
known-provider chooser. A current-code legacy fixture is preparation only and
does not satisfy `AC-MAN-013`.

## Contracts And Boundaries

- One frozen candidate and one Task 17 fixture digest cross Tasks 19–21.
- Milestone A may be tested before external production inputs exist, but
  Milestone B may freeze only an authenticated production candidate. Missing
  inputs are never repaired with fixture trust.
- Task 19 may add cross-platform composition source required by the shared
  application graph, but executes and claims Linux only. Every representative
  Windows check remains exclusive to Task 20 and on Windows.
- Task 19 creates the shared evidence foundation but records only Linux
  execution results; it does not issue the final aggregate verdict.
- Platform, hardware, deterministic, manual, and external evidence classes are
  distinct and non-substitutable.
- Expensive profiles are immutable evidence producers; Task 21 validates their
  digests and results instead of rerunning them.
- Qualification tooling performs no publication or support-matrix mutation.

## Expected Files Or Components

- A production environment factory and focused adapters under
  `src/main/localWhisper/composition/` (or one equivalently cohesive folder),
  with `src/main/main.ts`, `src/main/di/`, and application shutdown owning its
  construction and disposal.
- Canonical Local Whisper settings, device-identity, ownership-record, journal,
  and managed-root paths derived from the application data directory.
- Production catalog input resolution through
  `LocalWhisperPackagedCatalog`, `LocalWhisperCatalogRepository`, and
  `LocalWhisperPackagedResourceResolver`, preserving the disabled sentinel and
  fixture isolation.
- Concrete Linux CPU/CUDA discovery and capability evidence adapters, dynamic
  snapshot facts, coordinator port adapters, and worker session factory.
- Existing `ManagedArtifactStore`, artifact pipeline, native guard/launcher,
  supervisor/lifecycle, coordinator, IPC, audit, and diagnostics components
  integrated rather than duplicated.
- Windows-boundary text repaired in the known active sources
  `scripts/local-whisper/verify-coordinator.ts`,
  `scripts/local-whisper/verify-ipc.ts`,
  `scripts/local-whisper/native-build/audit-disconnected-build.mjs`,
  `scripts/local-whisper/native-build/native-toolchain-core.mjs`, and
  `scripts/local-whisper/amd-packs/verify-amd-packs.mjs`; immutable legacy
  profile IDs remain unchanged.
- Unit and integration tests under `tests/main/localWhisper/composition/` plus
  Linux live-path tests using validated task-owned temporary roots and
  nonprivate fixtures where real evidence is not claimed.
- Versioned candidate, profile, platform-result, and evidence-index schemas and
  validators under `docs/specs/local-whisper/qualification/` and
  `scripts/local-whisper/`.
- A Linux-specific evidence template derived from the Task 18 qualification
  seed template; the existing Task 18 file may be renamed only with all links
  updated in the same packet.
- Linux native, engine, package, lifecycle, privacy, performance, and downgrade
  orchestration plus `package.json` commands required by Verification.
- Updated `todo.md` and `handoff.md` containing activation status, sanitized
  identities, and exact Task 20 prerequisites, never raw evidence.

## Acceptance Criteria

### Activation acceptance

- Linux/Windows startup no longer unconditionally injects the deferred
  environment; macOS remains Planned/unavailable and non-executable.
- The production factory has one process owner, no module-global mutable
  instances, no pass-through service locator, and deterministic cleanup.
- Disabled, missing, fixture, malformed, or unauthenticated publication input
  remains Not ready and cannot download, probe, load, transcribe, or expose
  privileged facts.
- With authenticated candidate inputs on Linux, the UI sees the real catalog,
  reconstructed inventory, settings validation context, installed artifacts,
  current CPU/NVIDIA options, resource facts, and sanitized progress.
- `Check compatibility` launches and destroys a fresh proof-owning probe;
  `Load now`/lazy load launches a distinct proof-owning full-load worker with
  the exact model lease; unload and exit release the worker tree and allocation.
- CPU proves no GPU initialization. CUDA proves the exact selected physical
  device, runtime registry, activated backend, positive model-weight ownership,
  and primary execution backend without exposing native identity.
- Download, resume, cancel, update, remove, settings save/reset, topology
  invalidation, cancellation, crash recovery, provider switch, suspend/resume,
  and shutdown update epochs/snapshots atomically and fail without fallback.
- Production composition tests prove fixture isolation, trust failure, path and
  process ownership, stale-epoch rejection, privacy, and cleanup.

### Qualification acceptance

- Candidate/profile/evidence schemas reject mutation, mixed candidates,
  missing required algorithms/units/bounds, private fields, and an altered Task
  17 fixture digest.
- Every applicable Linux deterministic and platform row has evidence tied to
  the frozen candidate or a precise `Pending` reason.
- Linux CPU runs prove no GPU initialization; Linux CUDA runs prove exact
  NVIDIA selection, real inference, lifecycle cleanup, and no fallback.
- Accuracy, RTF, peak memory, repeat, crash, cancellation, unload, cleanup,
  offline, package, privacy, and diagnostics gates follow preapproved profiles.
- Exact previous-Linux-binary downgrade evidence is recorded truthfully.
- No representative Windows execution or Windows claim occurs.
- No active prose or validation message incorrectly assigns representative
  Windows execution to Task 19; legacy opaque profile IDs are documented rather
  than silently rewritten.
- Task 20 can consume the same candidate, profiles, schemas, evidence index,
  live-composition contract, and fixture digest without regenerating inputs.

## Verification

Run the activation checks and qualification suite on the authorized Linux x64
host only:

```bash
rtk node --import tsx --test tests/main/localWhisper/composition/*.test.ts
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:filesystem
rtk npm run verify:local-whisper:ui
rtk npm run verify:local-whisper:packaging
rtk npm run verify:local-whisper:migration-privacy
rtk npm run verify:local-whisper:qualification:linux
rtk npm run verify:local-whisper:downgrade -- --platform=linux
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run smoke:fedora
```

`verify:local-whisper:qualification:linux` must include the production
composition/startup tests before it permits candidate evidence generation. Do
not invoke `verify:local-whisper:qualification:windows`, `dist:win`, or any
representative Windows job in this packet. The registered Task 19 command is:

```bash
rtk npm run verify:local-whisper:qualification:linux
```

## Failure And Rollback

- If activation fails, restore the prior fail-closed startup behavior without
  deleting user data. Do not freeze a candidate or reinterpret deferred-source
  tests as live execution.
- Preserve the disabled publication sentinel and all fixture-isolation guards.
  A real input failure remains Not ready or `Pending`; it never enables fixture
  trust, an unsigned catalog, ambient executable lookup, or fallback.
- Preserve the frozen manifest and failed evidence. Clean only exact task-owned
  temporary roots and proven task-owned processes/allocations.
- A privacy, cleanup, path-trust, signature, candidate-integrity, or
  evidence-integrity failure stops Linux qualification and returns to the
  primary owner through newly authorized work.
- Missing hardware, toolchain, previous binary, artifact, or external approval
  remains `Pending`; it is not repaired with a mock or inferred pass.
- Any frozen candidate/input change invalidates existing evidence and requires
  a new freeze; never combine evidence from different candidates.

## Manual Gates

- Authenticated production catalog bytes, public verifier keys, allowlisted
  origins, exact source/runtime/model identities, licenses, redistribution
  approval, and real artifacts are required before candidate freeze. Private
  signing material, upload, and publication remain outside this packet.
- `AC-MAN-001`: exact Linux NVIDIA Production profile.
- Linux slices of `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and `AC-MAN-013`.
- Exact external toolchains and the immediately preceding Linux package may
  remain blockers; their rows stay `Pending`.
- Physical AMD promotion, physical macOS review, representative Windows, final
  aggregation, commit, push, PR, tag, signing, upload, publication, and release
  remain outside this packet.

## References

- `../spec.md`, especially Sections 7.1–7.4, 11, 12, 13, 18, 19.2, 19.3,
  and 22 plus all automated and manual acceptance rows.
- Tasks 01–18 and their recorded handoffs; these are implementation foundations,
  not substitutes for the activation acceptance above.
- `src/main/main.ts`, `src/main/di/mainProcessCompositionRoot.ts`,
  `src/main/localWhisper/ipc/createDeferredLocalWhisperEnvironment.ts`, and the
  existing Local Whisper repositories/services named in this packet.
- `../qualification/task19-evidence-template.md` as the Task 18 seed input to
  split into platform-specific and aggregate evidence during Tasks 19–21.
- Project runtime, provider, Linux packaging, native-quality, privacy,
  diagnostics, and release conventions.

## Completion And Handoff

Update `todo.md` and `handoff.md` with the activation result,
candidate/profile/fixture digests, Linux Pass/Fail/Pending/Not Applicable
summaries, exact previous-binary status, and the immutable inputs Task 20 must
consume. Mark Task 19 complete only when the production-candidate graph is
active, one authenticated candidate is frozen, and the packet has produced
truthful Linux results. An external input that prevents freeze keeps Task 19
incomplete and names the exact manual gate; it does not authorize Task 20.

Stop before Task 20, commit, push, PR, publication, or release unless separately
authorized.
