# 14 Capability, Coordinator, Residency, And Lifecycle

## Outcome

One process-owned `LocalWhisperCoordinator` is the sole mutable authority for
Local Whisper active settings, prompt mutation, epochs, support/setup/capability/
residency/activity/readiness snapshots, stable opaque device selection,
topology-bound worker authority, artifact conflicts, and the single resident
worker. It serializes save, reset, check, load, lazy load, transcribe, cancel,
unload, artifact removal, provider switch, power, topology, and shutdown without
falling back to another backend, device, model, target, or provider.

## Prerequisites

- Local Whisper specification revision 7 and plan revision 12 are approved.
- Tasks 02, 03, 05, 09, 10, 11, 12, and 13 are complete. Task 12 supplies
  immutable AMD Preview definitions; Task 13 supplies the normalized fixed
  `whisperCpp` domain, settings, catalog, and source contracts.
- Task 14 has separate execution authorization.
- The coordinator consumes workers only through Task 09's supervisor ports and
  repositories only through their domain interfaces. Deterministic tests start
  with injected fakes; no renderer or Electron object enters this packet.
- Representative Windows execution is prohibited until Task 20.

## Owned Requirements

- Primary capability: `CAP-001`, `CAP-002`, `CAP-003`, `CAP-004`, `CAP-005`,
  `CAP-006`, `CAP-007`, `CAP-008`, `CAP-009`, `CAP-010`, `CAP-011`, `CAP-012`,
  `CAP-013`, `CAP-014`, `CAP-015`, `CAP-016`, `CAP-017`.
- Primary resources/lifecycle: `VRAM-001`, `VRAM-002`, `VRAM-003`, `LIFE-001`,
  `LIFE-002`, `LIFE-003`, `LIFE-004`, `LIFE-005`, `LIFE-006`.
- Atomic-settings authority: `SET-004`, `SET-006`, `SET-007`, `VAL-001`,
  `VAL-003`.
- Orchestration/support: `ARCH-003`, `ARCH-006`, `CACHE-002`, `UI-005`,
  `UI-006`, `COMP-004`, `COMP-005`, `COMP-006`, `COMP-008`, `NVIDIA-001`,
  `CPU-001`, `AMD-001`, `AMD-002`, `AMD-003`, `AMD-004`, `AMD-006`,
  `MAC-001`, `MAC-002`, `MAC-003`, `FAIL-001`, `FAIL-002`, `FAIL-004`,
  `FAIL-005`, `FAIL-006`, `FAIL-007`, `FAIL-008`, `RUNTIME-004`, `MODEL-008`,
  `NONGOAL-002`.
- Primary acceptance: `AC-AUTO-005`, `AC-AUTO-006`, `AC-AUTO-007`,
  `AC-AUTO-010`, `AC-AUTO-013`, `AC-AUTO-014`, `AC-AUTO-015`, `AC-AUTO-019`,
  `AC-AUTO-020`, `AC-AUTO-021`, `AC-AUTO-022`, `AC-AUTO-034`, `AC-AUTO-042`,
  `AC-AUTO-047`, `AC-AUTO-051`.
- Supporting acceptance: `AC-AUTO-002`, `AC-AUTO-011`, `AC-AUTO-012`,
  `AC-AUTO-028`, `AC-AUTO-031`, `AC-AUTO-035`, `AC-AUTO-037`, `AC-AUTO-039`,
  `AC-AUTO-049`, `AC-AUTO-052`, `AC-AUTO-056`, `AC-AUTO-059`, `AC-AUTO-063`.
- Manual-gate preparation: `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-003`,
  `AC-MAN-004`, `AC-MAN-005`, `AC-MAN-009`, `AC-MAN-010`, `AC-MAN-011`.

## In Scope

- One main-process coordinator and one immutable snapshot stream.
- Fixed support matrix and focused CPU/CUDA/Vulkan/HIP/Metal adapters.
- Private per-install opaque device identity and topology-bound runtime authority.
- Nonresident compatibility probe and full validation/load transactions.
- Exact RAM/VRAM estimate/headroom/current-resource policy.
- Atomic save/reset transactions, configuration/inventory generations, conflict
  classification, and dependent lifecycle behavior.
- Single-worker residency, cache pre-gate, cancellation, unload, artifact
  conflicts, provider switching, power/topology/app-exit cleanup.
- Deterministic platform/backend/resource/state/error fixtures plus available
  Linux integration; Windows definitions only for Task 20.

## Out Of Scope

- Renderer/preload IPC, React UI, packaging/signing/publication, source builds,
  model conversion, or direct filesystem/process implementation.
- A second settings repository, mutable service singleton, renderer-owned state,
  or independent component that can commit readiness/settings/epochs.
- Automatic fallback/retry/replay, driver/toolkit/ROCm installation, permission
  modification, elevation, alternate inference engines, DirectML, Windows ML,
  software Vulkan,
  Intel GPU execution, or macOS inference.

## Task Contract

### Sole process-owned authority

Implement one class-based `LocalWhisperCoordinator` constructed in the later
main composition root with narrow injected settings, catalog, inventory,
artifact, capability-adapter, supervisor, cache, clock, power/topology, and
event ports. The coordinator alone owns mutable active settings, prompt presence,
configuration and inventory epochs, current operation, capability evidence,
resident worker lease, activity, blocking failure, and snapshot revision.

Repositories persist facts but cannot activate them. Workers execute commands
but cannot commit product state. Adapters enumerate/probe but cannot promote a
tier. IPC/UI can request one command and render snapshots only. No module-level
constructed mutable runtime instance or second state store is allowed.

Every asynchronous result carries the captured configuration epoch, inventory
epoch, topology generation, capability generation, worker generation, and
request ID. The coordinator commits it only when all still match. It increments
`snapshotRevision` exactly once per published immutable snapshot and publishes
strictly increasing revisions.

### Atomic save/reset command

Expose one coordinator method, `applySettingsTransaction`, accepting exactly one
closed command:

```text
SaveSettings {
  kind: save,
  candidate: complete canonical public settings,
  promptMutation: unchanged | clear | replace(candidate),
  expectedConfigurationEpoch,
  expectedInventoryEpoch
}

ResetSettings {
  kind: reset,
  expectedConfigurationEpoch,
  expectedInventoryEpoch
}
```

The command is serialized with worker/artifact-affecting operations. In one
coordinator transaction it validates epochs and all fields/cross-fields; resolves
every ID against current authenticated catalog/inventory/support policy; derives
the reset candidate where applicable; merges the write-only prompt mutation;
classifies request- versus load-affecting changes; performs any required bounded
idle unload; persists settings/prompt atomically through Task 03 exactly once;
activates the new normalized settings; increments the configuration epoch once;
invalidates affected capability/residency/cache context; and publishes one
coherent result snapshot.

No caller may invoke unload, repository save/reset, prompt update, epoch update,
or snapshot publication separately around this method. A stale/conflicting/
invalid command has no effect. If required unload succeeds but persistence then
fails, prior settings and prompt remain authoritative, configuration epoch does
not change, the worker stays Unloaded, and one failure snapshot reports that
state. There is no attempt to reconstruct or silently reload the old worker.

### Stable product identity and private runtime authority

Focused CPU, CUDA, Vulkan, and HIP adapters enumerate only eligible physical
devices. Normalize one private canonical physical identity from durable
backend/OS-native evidence; never synthesize it from display name, ordinal, or
memory size. A backend without durable identity is unavailable with
`DEVICE_FEATURE_MISSING`.

Persist only a bounded versioned opaque ID computed in main as HMAC-SHA-256 over
the canonical identity with a random 256-bit per-install salt in a dedicated
owner-private repository. Detect collisions and fail closed. Salt/version loss
makes saved IDs unavailable and never rebinds them. Raw UUID/LUID/PCI/serial/
topology/registry data is private HMAC input and never enters settings, IPC,
cache identity, logs, audit, diagnostics, errors, or argv.

Before and after every probe/full load, create and revalidate one nonpersisted
Task-09/CAP-014 authority bound to random authority ID, epochs, exact runtime
build, engine/backend, topology generation, selected opaque ID, ordered native
registry fingerprint, and CPU or bounded runtime-local GPU/IGPU ordinal. Accept
success only from actual activation, challenge-bound durable device proof,
positive selected-device model-weight bytes for GPU, and
the primary execution/state backend. Any reorder, disappearance, substitution,
echo, zero/wrong-device allocation, or state mismatch is
`DEVICE_PROOF_FAILED`, makes evidence Stale, terminates the worker, and ends
Unloaded.

### Fixed support matrix and prerequisites

Tier comes only from immutable app/catalog policy:

- Windows/Linux x64 CPU for `whisperCpp`: conditional Production target only
  after each OS gate;
- Windows/Linux x64 NVIDIA CUDA for `whisperCpp`: conditional Production target
  only after each exact OS gate;
- Windows x64 AMD `whisperCpp` Vulkan: `Preview · Untested`;
- Linux x64 AMD `whisperCpp` Vulkan: `Preview · Untested`;
- Linux x64 AMD `whisperCpp` HIP: `Preview · Untested`, visible only with one
  complete approved Task-12 immutable pre-signing/catalog intersection;
- macOS arm64 Metal: Planned/unavailable skeleton; every CPU/other macOS route
  unavailable;
- unlisted OS, architecture, vendor, or device: Unsupported.

Backend checks are exact:

- CUDA: physical NVIDIA identity, system driver compatibility with the
  pack-pinned CUDA runtime family, compiled compute capability, manifest-owned
  runtime dependency closure, allocation/dispatch, and
  full-load proof. Never search for or require a system CUDA toolkit.
- Vulkan: hardware AMD ICD, API at least
  `max(1.2, pack.generatedShaderTarget)` (initially 1.3), exact generated target,
  required features/extensions, memory evidence when trustworthy,
  allocation/dispatch, and full-load proof.
- HIP: exact approved row across distro/version, x64, kernel/amdgpu ABI, one
  ROCm/HIP release, package/SONAME/build identities, PCI device/`gfx`, applicable
  PCIe atomics, nonmixed closure, effective `/dev/kfd`/matching render-node
  access, allocation/dispatch, and full-load proof. HIP `>= 6.1` is a build floor
  only. The coordinator cannot invent or approve a missing row and never changes
  permissions.
- CPU: Windows/Linux x64 only, exact engine pack and ISA, positive logical
  processors, resolved thread bound, RAM, bounded compute, and no GPU init.

Mock/source results prove contracts only. They cannot make AMD non-Preview,
macOS executable, or a conditional Production cell pass.

### Compatibility and full validation transactions

`Check compatibility` performs OS/matrix eligibility, installed verified runtime
and protocol, exact backend prerequisites/topology/private authority, selected
model setup metadata, and resource policy. It may start one Task-10/12
probe-only worker with no model authority for bounded activation/allocation/
dispatch proof. It never downloads, loads a selected model, retains a worker or
allocation, reports Loaded/Ready, or upgrades that probe process. Its best
result is `EstimateOnly` and lists exact missing prerequisites/artifacts.

`Load now` and an eligible uncached lazy load perform, in order:

1. OS/architecture and fixed support eligibility;
2. exact installed verified compatible runtime/protocol;
3. backend prerequisites, topology, and fresh device authority;
4. exact installed verified model lease;
5. disk/RAM/VRAM policy;
6. fresh full-load worker activation and bounded allocation/dispatch;
7. model-authority transfer and full model load;
8. embedded nonpersonal warm-up;
9. post-load authority/device/model-weight/state proof.

Only total success commits `Validated` and `Loaded`. Probe success, context
construction, echoed backend names, or CPU participation in a GPU engine is
insufficient. A probe worker is always reaped before a distinct full-load worker
is created.

### Resource policy

Use only a selected-configuration estimate whose engine, target, backend,
runtime/model revisions, variant, unit, source, and methodology all
match. Prefer a matching qualified peak, then matching catalog peak, and add at
least `max(20% of peak, 512 MiB)` headroom. The six family guidance ranges are
display-only and never block.

For GPU compare required VRAM with trustworthy current free VRAM; for CPU compare
required total RAM with trustworthy free RAM. A known deficit returns
`INSUFFICIENT_VRAM` or `INSUFFICIENT_RAM` and blocks load with no override. An
unknown current value is displayed as unknown and may proceed to real allocation;
allocation/load remains authoritative. Unknown is never converted to zero or a
pass guarantee.

### Residency, cache, commands, and lifecycle

Capability is `Unchecked -> Checking -> EstimateOnly | Validated | NotReady`,
with `Validated -> Stale | NotReady`. Residency is
`Unloaded -> Loading -> Loaded -> Unloading -> Unloaded` and
`Loading | Loaded | Unloading -> Failed -> Unloaded`; activity is `Idle` or
`Transcribing`. Exactly one resident worker exists. Ready/Busy requires valid
settings, verified artifacts, current Validated evidence, Loaded residency, and
no blocking failure. `Validated · Unloaded` is Not ready but lazy-load eligible.

The provider/cache eligibility gate runs before cache lookup. Known missing,
blocked, corrupt, incompatible, unsupported, absent-device, or insufficient
states never return a cache hit or remote fallback. Eligible unloaded cache hits
remain unloaded; eligible misses may lazy-load through the complete transaction.

Serialize worker/artifact-affecting commands. Conflicting load, unload,
transcription, delete/remove, runtime replacement, save/reset, provider switch,
or epoch change fails immediately with `OPERATION_CONFLICT`; it is never queued.
Unrelated downloads may continue under Task 05 locks. Delete/remove a selected
loaded artifact only after confirmation, idle validation, bounded unload, and
exact Task-05 lease/lock deletion. Preserve the now-Missing selection. Never
delete an unknown path or alternate revision.

Cancellation uses one terminal arbiter across request, worker, authority, and
epoch generations. Cancellation during load terminates the partial worker. A
cooperatively cancelled `whisperCpp` transcription worker may remain only when its
health/current authority is positively revalidated; uncertainty terminates it.
Suspend/resume, hot unplug/reset, topology/driver change, provider switch, and
app exit cancel active work, invalidate evidence, terminate as required, release
authorities, and publish one final coherent snapshot. Shutdown runs exactly once.

### Failure precedence and projection

Preserve the exact shared code, stage, retryability, recovery action ID, and
resulting state from Tasks 05, 08, 10, and 12. Model-authority, corruption,
protocol, device-proof, allocation, timeout, and cleanup errors precede generic
worker failure. No error is mapped to authentication/login, raw exception text,
or another configuration. No failed inference mutates clipboard, successful
history, or cache.

## Contracts And Boundaries

- Task 03 owns persisted schema/default/migration and atomic repository writes;
  the coordinator is its only runtime command owner and calls it only inside
  `applySettingsTransaction`.
- Task 05 owns artifact transfer/install/delete and cross-process locks. The
  coordinator sequences those ports but never accesses arbitrary paths.
- Task 09 owns worker protocol/authority/process semantics. Tasks 10, 11, and
  12 own `whisperCpp` backend implementations and private proofs. The coordinator
  never parses native logs or calls engine APIs directly.
- Task 15 exposes commands/snapshots through protected IPC. For save or reset it
  must call `applySettingsTransaction` exactly once and must not call repository,
  unload, epoch, prompt, or snapshot operations separately.
- Later UI code renders sanitized snapshots and local drafts only; it cannot
  commit state or infer support/readiness.
- Task 17 may package/sign immutable facts but cannot promote support. Task 19
  executes Linux hardware qualification, Task 20 alone executes representative
  Windows qualification, and Task 21 reconciles both evidence slices.
- Only main owns private salts, canonical physical identities, native ordinals,
  authority/proof material, artifact leases, and worker handles. Snapshot DTOs
  contain sanitized stable product data only.

## Expected Files Or Components

- `src/main/localWhisper/capability/` support/resource policy, backend adapters,
  authority factory/proof validator, and fixtures.
- `src/main/localWhisper/deviceIdentity/` private salt/opaque-ID repository and
  reset/collision tests.
- `src/main/localWhisper/coordinator/` state owners, atomic settings transaction,
  command arbiter, lifecycle hooks, snapshot projector, and composition ports.
- Updated provider/cache/artifact interfaces without a second state store.
- Deterministic platform/backend/resource/failure/power/topology fakes and
  focused integration tests.
- Package scripts: `test:local-whisper:capability`,
  `test:local-whisper:coordinator`, and `verify:local-whisper:coordinator`.
- Linux checks and nonexecuting Task-20 Windows workflow definitions.

## Acceptance Criteria

- Exactly one coordinator owns all mutable state and snapshot revisions; stale
  async results and every alternate commit path are rejected.
- Save and reset each execute as one atomic coordinator command. Stale,
  conflicting, invalid, or persistence-failed commands preserve prior settings/
  prompt/epoch; no caller performs an adjacent unload or repository write.
- Support fixtures expose only the exact CPU/NVIDIA/AMD/macOS matrix. Unlisted
  engine/backend rows are unavailable and HIP stays unavailable without a
  complete approved row.
- No CUDA check requires a system toolkit. Vulkan 1.1/1.2/1.3, exact/unlisted
  HIP, CUDA driver/compute/dependency, CPU ISA/thread, and Metal-unavailable
  fixtures return exact results without fallback or tier promotion.
- Opaque IDs remain stable only for the same salt/identity/version; raw identity
  never crosses main. Every topology/authority/device/model/state mismatch
  prevents Validated/Loaded and ends Unloaded.
- Compatibility probe is nonresident/no-authority and cannot become load.
  Full-load success requires all ten stages and exact post-load proof.
- Resource known/equal/below/above/unknown cases, load/lazy/cache/unload,
  cancellation, deletion, provider switch, power/topology, and exit follow the
  exact state machines and failure precedence.
- No representative Windows command is executed before Task 20.

## Verification

Run exactly with deterministic fakes and available Linux integrations:

```text
rtk npm run test:local-whisper:capability
rtk npm run test:local-whisper:coordinator
rtk npm run verify:local-whisper:coordinator -- --profile=deterministic-linux
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

If authorized exact Linux runtime/model inputs are available, additionally run:

```text
rtk npm run verify:local-whisper:coordinator -- --profile=real-linux-cpu
rtk npm run verify:local-whisper:coordinator -- --profile=real-linux-cuda
```

Define, but do not invoke before Task 20:

```text
rtk npm run verify:local-whisper:coordinator -- --profile=windows-cpu
rtk npm run verify:local-whisper:coordinator -- --profile=windows-cuda
rtk npm run verify:local-whisper:coordinator -- --profile=windows-vulkan
```

## Failure And Rollback

- Any second mutable owner, stale commit, fallback, incorrect failure/state,
  leaked private identity, uncertain cleanup, or deterministic test failure
  blocks completion; never weaken epochs/proof/serialization to pass.
- An unavailable real runtime/hardware profile remains a recorded manual
  dependency, not a synthetic pass. AMD stays Preview and macOS unavailable.
- Roll back only Task-14 coordinator/adapters/tests and task-owned ephemeral
  state. Preserve persisted settings/catalog/inventory/artifacts, worker/source
  packets, private user data, and managed storage.

## Manual Gates

- Exact authorized Linux runtime/model inputs for real integration.
- All representative Windows execution and independent Windows CPU/NVIDIA gates
  belong exclusively to Task 20.
- AMD physical execution is future `AC-MAN-010`; absence preserves Preview.
- Apple Silicon execution is outside scope; only Planned/unavailable remains.
- No driver/toolkit/ROCm/permission mutation, signing, publication, commit, push,
  PR, tag, upload, or release authority.

## References

- Mandatory task-local contract: `../spec.md` Sections 6, 7.1–7.4, 9–11,
  13–15, 19–21; acceptance `AC-AUTO-005`, `AC-AUTO-006`, `AC-AUTO-007`,
  `AC-AUTO-010`, `AC-AUTO-011`, `AC-AUTO-012`, `AC-AUTO-013`, `AC-AUTO-014`,
  `AC-AUTO-015`, `AC-AUTO-019`, `AC-AUTO-020`, `AC-AUTO-021`, `AC-AUTO-022`,
  `AC-AUTO-034`, `AC-AUTO-042`, `AC-AUTO-047`, `AC-AUTO-051`.
- Tasks 02, 03, 05, 09, 10, 11, 12, and 13.

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with coordinator/state/
authority/resource coverage, exact checks, real-profile dependencies, deferred
Windows commands, and next eligible Task 15. Present Task 14 for review and
stop. Do not implement Task 15, commit, push, package, publish, or execute
Windows.
