# 09 Current-Device Capability Validation

## Outcome

A main-owned capability service enumerates only eligible physical devices,
derives the fixed support tier, runs backend-specific bounded probes, applies
the exact RAM/VRAM policy, and answers whether the selected configuration is
at most estimated or can proceed to full model proof. AMD remains explicitly
untested Preview and macOS remains a non-executable Planned skeleton.

## Prerequisites

- The Local Whisper plan is approved.
- Tasks 01, 03, 04, 06, 07, and 08 are complete and committed through their
  packet boundaries.
- Task 09 has separate execution authorization.
- Runtime/model repositories can provide verified identity and compatibility
  snapshots; worker adapters can expose probe/load/warm-up fakes.

## Owned Requirements

- `COMP-004`, `NVIDIA-001`, `CPU-001`, `COMP-008`
- `AMD-001`–`AMD-006`, `PKG-003`
- `CAP-001`–`CAP-010`, `CAP-012`, `CAP-013`, `FAIL-006`
- Capability portions of `COMP-005`, `COMP-006`, and `UI-005`
- `MAC-001`, `MAC-002`, `MAC-003`
- Support-matrix exclusions `NONGOAL-001` and `NONGOAL-002`
- `AC-AUTO-005`, `AC-AUTO-006`, `AC-AUTO-010`–`AC-AUTO-015`,
  `AC-AUTO-028`, `AC-AUTO-031`, `AC-AUTO-034`
- Capability/resource-gate portion of `AC-AUTO-049`
- Implementation prerequisites for `AC-MAN-001`–`AC-MAN-004`,
  `AC-MAN-009`–`AC-MAN-011`

## In Scope

- Fixed app-shipped support matrix and exact Linux HIP allowlists.
- Main-only OS, architecture, CPU, CUDA, Vulkan, HIP, and device adapters.
- Stable opaque device IDs and sanitized presentation records.
- Non-resident `Check compatibility` and short-lived probe orchestration.
- Matching selected-configuration resource-estimate policy, capability
  fingerprints, stale causes, and typed safe results.
- Metal/Apple Silicon unavailable adapter and fail-closed tests.
- Deterministic mocked backend matrices; no platform Production claim.

## Out Of Scope

- Persistent residency, transcription, lifecycle locking, renderer UI, IPC,
  runtime/model download, pack publication, or hardware qualification.
- Automatic engine/backend/device/precision/target fallback.
- Installing drivers, CUDA toolkits, ROCm, permissions, services, or elevated
  components.
- Faster-Whisper AMD, DirectML, Windows ML, Intel GPU execution, software
  Vulkan, macOS CPU execution, or remote capability data.

## Task Contract

1. Implement an immutable support matrix keyed by OS/architecture, engine,
   target, backend, and reviewed device class. Probes may lower operational
   capability but never promote `Production | Preview | Planned | Unsupported`.
   Production labels remain conditional until Task 16 records the exact manual
   profile evidence.
2. Enumerate physical devices in main and return only a sanitized display name,
   vendor class, eligible backend list, and stable opaque ID. Raw serials,
   hardware UUIDs, full native structures, usernames, and driver paths never
   cross IPC or routine logs. The reviewed opaque mapping must remain stable
   across restart for the same platform device and preserve a disappeared
   selection rather than redirecting it.
3. Apply new-key selection rules from Task 01 without turning enumeration into
   fallback authority: zero or multiple eligible combinations stays unset;
   exactly one initializes once; Intel, unknown, software, and unsupported
   adapters are not eligible defaults.
4. `Check compatibility` performs these non-resident stages only:
   - OS/architecture and app-shipped support eligibility;
   - selected device presence and external prerequisites;
   - runtime/model setup and compatibility snapshot inspection;
   - advisory disk/RAM/VRAM calculation;
   - optionally one bounded short-lived backend allocation/compute probe.
     It never downloads, loads the selected model, retains a worker/allocation,
     or returns `Ready`/`Validated`; its best result is `EstimateOnly`.
5. CUDA probing proves a physical selected NVIDIA device, compatible driver,
   pack-listed compute capability, manifest-owned CUDA dependencies, bounded
   allocation/dispatch, and actual selected device/backend reporting. Provide
   distinct mismatch, driver, capability, dependency, allocation, dispatch,
   load, warm-up, and actual-device failure fixtures. No failure selects CPU,
   Vulkan, another device, engine, model, or precision.
6. Windows AMD exposes `whisperCpp` Vulkan Preview only. Vulkan probing rejects
   software ICDs, API below 1.2, missing `storageBuffer16BitAccess` or any
   manifest-required feature, and failed allocation/dispatch. A successful
   mock remains Preview.
7. Linux AMD HIP is eligible only for the exact immutable intersection of OS
   family, ROCm family, AMD device ID, compiled `gfx` target, system component
   prerequisites, `/dev/kfd`, and DRM render-node access. Every missing or
   unlisted value fails closed. Vulkan is a separately persisted Preview
   choice, never recovery from HIP.
8. CPU probing supports Windows/Linux x64 only and verifies selected engine
   pack, ISA, positive logical processors, resolved thread count, current RAM,
   bounded compute, and absence of GPU initialization. Both engines remain
   conditional Production targets until separate engine-by-OS gates pass.
9. The Metal adapter returns stable `PLANNED_UNAVAILABLE` before catalog lookup,
   download, spawn, allocation, or transcription. macOS runtime and model
   catalog views are empty/non-actionable; CPU cannot bypass the gate.
10. Resolve memory only for the exact selected
    engine/target/backend/runtime/artifact/variant/precision identity. Use its
    matching qualified peak when available, otherwise its matching catalog
    peak, then calculate minimum required current memory as peak plus
    `max(20% of peak, 512 MiB)`. Section 8.1.1 family ranges are display-only
    and never supply a block threshold. A missing, duplicate, unsafe,
    unit-invalid, or identity-mismatched record is not reusable evidence and
    remains exact-estimate unavailable/catalog-invalid. A trustworthy current
    value below the valid exact threshold blocks with `INSUFFICIENT_RAM` or
    `INSUFFICIENT_VRAM`; equality/above may proceed; an unavailable metric
    yields `Resource availability unknown` and may permit a real attempt.
    There is no override, and real allocation/load failure remains
    authoritative.
11. Build exact capability fingerprints from Task 01 identities plus OS,
    app/catalog/protocol, verified runtime/model files, target/backend/device,
    driver/runtime/ISA/topology, and resolved load-affecting settings. Mark
    evidence stale after any component change, artifact mutation/denylist,
    suspend/resume, topology/hot-plug, driver reset, or process restart.
12. Expose one typed `CapabilityService` port for Task 10 with separate methods
    for enumeration, estimate-only check, short-lived probe, full-proof stage
    assistance, fingerprint capture, and invalidation. No getter causes a deep
    probe.
13. Table-test every support and backend condition with injected platform
    adapters, worker fakes, clocks, manifests, and resource metrics. Tests must
    prove the absence of fallback and side effects, not merely returned labels.

## Contracts And Boundaries

- All OS commands, native APIs, device files, drivers, and runtime libraries
  are accessed by focused main adapters behind repository interfaces. The
  renderer receives sanitized values only through Task 11.
- Runtime libraries are resolved from verified packs or explicitly declared
  system prerequisites, never user `PATH`, `LD_LIBRARY_PATH`, `PYTHONPATH`, or
  arbitrary environment values.
- A successful static or compute probe is not full model validation. Only Task
  10 may turn a successful full load and warm-up into `Validated`/`Loaded`.
- Hardware-unavailable tests must not fabricate Production evidence.

## Expected Files Or Components

- Add cohesive services under `src/main/localWhisper/capability/`, expected to
  include:
  - `LocalWhisperCapabilityService.ts`;
  - `LocalWhisperSupportMatrix.ts`;
  - `LocalWhisperDeviceRepository.ts`;
  - focused `cuda`, `vulkan`, `hip`, `cpu`, and `metal` adapters;
  - versioned Linux HIP allowlist data validated at build/test time.
- Add shared sanitized presentation types only if Task 01 did not already own
  them.
- Add backend matrix/resource/fingerprint tests under
  `tests/main/localWhisper/capability/` and macOS shared/build fixtures.

## Acceptance Criteria

- The complete mocked Section 6 matrix yields exact tiers/actions and no
  unsupported default.
- Removing a selected GPU preserves its opaque ID while another GPU remains.
- CUDA, Vulkan, HIP, and CPU negative fixtures return the most specific safe
  code and prove no alternative path was invoked.
- Resource tests cover below, equal, above, and unknown measurements with the
  mandated headroom formula and no override.
- Tests prove the family guidance never gates load, exact qualified peak wins
  over matching catalog peak, stale/missing/malformed estimate records never
  authorize a load, and every six-family presentation record can be carried as
  advisory metadata without changing capability.
- Every fingerprint component and platform lifecycle event invalidates prior
  evidence; intentional same-process unload alone may retain `Validated`
  evidence for Task 10 to display.
- `Check compatibility` never leaves a worker or allocation and never reports
  `Ready`.
- macOS arm64 and Faster-Whisper AMD cannot reach download, spawn, load, or
  transcription ports.

## Verification

Run:

```text
rtk node --import tsx --test tests/main/localWhisper/capability/*.test.ts tests/shared/localWhisper/*.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk lint
rtk prettier --check
```

Run any platform adapter compile/source-contract fixture named by the final
implementation. Do not run or label a physical AMD/macOS qualification in this
packet.

## Failure And Rollback

- If the selected platform API cannot provide a stable opaque device mapping
  or a required safe probe without elevation/arbitrary loader influence, stop
  and revise the adapter design; do not weaken the support result.
- Rollback removes capability adapters/matrix wiring while retaining verified
  runtime packs and shared contracts. No persisted selection is changed.
- Any proposed new backend, fallback, override, or support-tier promotion
  requires `/spec`.

## Manual Gates

- NVIDIA Linux/Windows, CPU, AMD, and macOS hardware gates remain deferred to
  Task 16 and require the exact environments in `AC-MAN-001`–`AC-MAN-011`.
- AMD review in this packet is code/manifest-only and must remain labeled
  untested Preview.
- No driver/permission change, elevation, pack publication, commit, or next
  packet is authorized.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 6, 8.1.1, 9.2, 9.4, 10.1, 10.3, 11,
    19.1 (`AC-AUTO-049`), 19.2–19.3, 20, and 21;
  - research `docs/researches/local-whisper/main.md`, AMD Feasibility,
    Capability Validation, and Available Test Environment.
- Task dependencies: packets 01, 03, 06, 07, and 08.

## Completion And Handoff

- Mark Task 09 complete in `todo.md`; record adapters, fixtures, and exact
  checks in `handoff.md`.
- Name Task 10 as next.
- Present only synthetic capability evidence and stop. Do not claim platform
  qualification, commit, or begin Task 10.
