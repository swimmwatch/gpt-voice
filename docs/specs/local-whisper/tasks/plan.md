# Implementation Plan: Local Whisper

Status: Approved

Revision: 9

Specification baseline: approved `spec.md` revision 6. This revision replaces
the superseded revision-8 graph. Completed Tasks 01–07 and their commits remain
authoritative. The preserved dirty protocol/supervisor checkpoint is input to
replacement Task 09 and is not a completed packet.

## Goal

Deliver Local Whisper as an optional main-owned Voice provider with explicit
engine, backend, device, runtime, model, precision, decoding, artifact, and
lifecycle controls; deterministic source and artifact trust; current-device
validation; local buffered inference; explicit RAM/VRAM load and unload; and an
accessible settings/status experience. Windows and Linux are release
platforms, AMD remains untested Preview, and macOS remains a non-executable
Planned/unavailable skeleton.

## Ordered Task Index

Coverage below lists packet-owned requirement IDs and the registry-primary
automated acceptance IDs. Supporting acceptance and task-local contract detail
remain in the linked packet.

| Task                                                                                                                            | Outcome                                                                                                                                                                                                                                      | Dependencies                               | Coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01 Shared Local Whisper Domain Contracts](01_shared_domain_contracts.md)                                                       | Define the closed renderer-safe settings, catalog, identity, state, error, language, worker-message, default, estimate, and validation vocabulary.                                                                                           | None                                       | `OUT-001`, `SCOPE-001`–`SCOPE-002`, `MODEL-003`, `MODEL-005`, `MODEL-009`–`MODEL-010`, `VRAM-001`, `NONGOAL-003`, `ARCH-007`, `RUNTIME-001`–`RUNTIME-002`, `COMP-005`–`COMP-006`, `COMP-011`, `AMD-005`, `SET-002`, `SET-004`–`SET-008`, `VAL-002`–`VAL-003`, `PRIV-002`, `CAP-003`, `CAP-010`, `CAP-013`, `CACHE-001`, `MAC-001`; primary `AC-AUTO-001`, `AC-AUTO-008`, `AC-AUTO-036`, `AC-AUTO-037`, `AC-AUTO-044`                                                                                                                                     |
| [02 Provider Dispatch And Cache Seam](02_provider_dispatch_and_cache.md)                                                        | Register `localRuntime`, bypass remote authentication, preserve cache eligibility, and delegate stateful work through the coordinator port.                                                                                                  | 01                                         | `SCOPE-002`, `ARCH-001`–`ARCH-003`, `ARCH-006`, `ARCH-008`–`ARCH-009`, `SEC-002`, `SEC-006`, `COMP-001`–`COMP-003`, `CACHE-001`–`CACHE-002`, `CAP-008`, `CAP-011`, `LIFE-001`, `LIFE-005`, `UI-006`, `DIAG-001`; primary `AC-AUTO-016`, `AC-AUTO-027`, `AC-AUTO-033`, `AC-AUTO-035`, `AC-AUTO-039`                                                                                                                                                                                                                                                       |
| [03 Trusted Catalog, Settings, And Inventory](03_trusted_catalog_settings_and_inventory.md)                                     | Own private versioned settings, strict signed catalog/keyring validation, closed estimates, and reconstructed sanitized inventory in main.                                                                                                   | 01                                         | `SET-001`, `SET-004`–`SET-008`, `VAL-002`–`VAL-003`, `PRIV-002`, `MODEL-002`–`MODEL-003`, `MODEL-007`, `MODEL-009`–`MODEL-010`, `RUNTIME-003`, `COMP-007`, `COMP-011`, `CAP-013`, `SEC-003`, `SEC-008`, `PKG-002`, `PKG-005`, `OPS-001`; primary `AC-AUTO-009`, `AC-AUTO-031`                                                                                                                                                                                                                                                                            |
| [04 Managed Filesystem Safety](04_managed_filesystem_safety.md)                                                                 | Provide descriptor/handle-anchored managed storage, leases, locks, quarantine, promotion, and exact deletion for Linux and Windows.                                                                                                          | 01, 03                                     | `MODEL-006`, `MODEL-008`, `SEC-004`, `SEC-007`, `RUN-004`, `RUNTIME-004`, `VRAM-003`, `FAIL-001`, `FAIL-004`; primary `AC-AUTO-041`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [05 Streaming Artifact Lifecycle](05_streaming_artifact_lifecycle.md)                                                           | Stream, resume, verify, promote, update, and remove explicitly selected immutable runtime/model revisions through bounded trusted operations.                                                                                                | 01, 03, 04                                 | `DL-001`–`DL-003`, `PERF-001`, `FAIL-001`, `FAIL-003`–`FAIL-004`, `PKG-002`, `SEC-003`, `OPS-001`, `MODEL-002`, `MODEL-007`–`MODEL-008`, `RUNTIME-003`–`RUNTIME-004`, `COMP-007`; primary `AC-AUTO-017`, `AC-AUTO-018`, `AC-AUTO-043`                                                                                                                                                                                                                                                                                                                    |
| [06 Native C++ Modularization](06_native_cpp_modularization.md)                                                                 | Keep the filesystem guard as modular C++20 with RAII platform backends, CMake/GoogleTest, linting, sanitizers, CI, README, and repository rules.                                                                                             | 04, 05                                     | `SEC-007`, `RUN-004`, `PKG-001`; supporting acceptance only, with final Windows evidence in Task 19                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [07 Framed Worker Supervisor](07_framed_worker_supervisor.md)                                                                   | Own strict framed stdio, authenticated launch, stage deadlines, and Linux/Windows process-tree termination without fallback or private argv data.                                                                                            | 01, 03, 04, 06                             | `ARCH-003`, `ARCH-005`–`ARCH-006`, `RUN-001`–`RUN-005`, `SEC-005`, `SEC-007`, `PRIV-001`, `FAIL-005`, `FAIL-007`, `LIFE-001`; primary `AC-AUTO-024`                                                                                                                                                                                                                                                                                                                                                                                                      |
| [08 Deterministic Native Source Objects And Toolchain Locks](08_deterministic_native_source_and_toolchain_locks.md)             | Establish canonical Git content objects, immutable source/license/patch identities, a reviewed loader-limit table, qualified disconnected Linux CPU/Clang-sanitizer/CUDA profiles, and exactly pinned Windows candidates before engine work. | 03, 04, 06                                 | `SEC-003`, `SEC-009`, `SEC-013`, `PKG-002`–`PKG-004`, `PKG-006`, `PKG-010`, `OPS-001`, `COMP-009`, support for `RUN-009`, `RUN-011`–`RUN-012`; primary `AC-AUTO-050`                                                                                                                                                                                                                                                                                                                                                                                     |
| [09 Shared Worker Protocol, Model Authority, And Lifecycle](09_shared_worker_protocol_model_authority_and_lifecycle.md)         | Complete one bounded TypeScript/C++/Python protocol with canonical grammar, WAV framing, probe/load split, authenticated model authority, proofs, and terminal cleanup.                                                                      | 01, 03, 04, 06, 07, 08                     | `ARCH-005`, `AUDIO-001`–`AUDIO-002`, `RUN-001`–`RUN-007`, `RUN-009`, `SEC-005`, `SEC-007`, `SEC-010`–`SEC-011`, `CAP-014`, `PRIV-001`, `PRIV-004`, `FAIL-005`, `FAIL-007`–`FAIL-008`; primary `AC-AUTO-053`, `AC-AUTO-054`, `AC-AUTO-056`                                                                                                                                                                                                                                                                                                                |
| [10 Hardened Whisper.cpp Core And CPU Worker Pack](10_hardened_whisper_cpp_core_and_cpu_pack.md)                                | Build a modular CPU-only worker and offline pack with authenticated slot-3 model access, exact-read loader hardening, bounded parsing, proof, inference, and exit unload.                                                                    | 08, 09                                     | `RUNTIME-001`, `RUN-011`, `SEC-013`, `SCOPE-001`, `MODEL-004`, `ARCH-005`, `RUN-001`–`RUN-006`, `SEC-005`, `SEC-010`, `CAP-007`, `CAP-009`, `CAP-017`, `CPU-001`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-003`–`PKG-004`, `PKG-010`; primary `AC-AUTO-052`, `AC-AUTO-060`                                                                                                                                                                                                                                                                                |
| [11 Whisper.cpp Device Proof, Cancellation, And CUDA Pack](11_whisper_cpp_device_proof_cancellation_and_cuda_pack.md)           | Add exact NVIDIA binding/proof, cooperative cancellation, and a Linux CUDA 12.8.1 Blackwell pack while rebuilding the CPU pack against the same patch.                                                                                       | 08, 09, 10                                 | `RUN-012`, `CAP-017`, `RUNTIME-001`, `ARCH-005`, `RUN-001`–`RUN-006`, `SEC-005`, `SEC-010`, `SEC-013`, `CAP-007`, `CAP-009`, `CAP-014`, `NVIDIA-001`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-003`–`PKG-004`, `PKG-010`; primary `AC-AUTO-062`                                                                                                                                                                                                                                                                                                           |
| [12 AMD Vulkan And Linux HIP Preview Packs](12_amd_vulkan_and_linux_hip_preview_packs.md)                                       | Define deterministic Windows/Linux Vulkan and Linux HIP Preview packs without fallback, invented hardware evidence, or an unreviewed HIP catalog row.                                                                                        | 08, 09, 10, 11                             | `AMD-001`–`AMD-004`, `AMD-006`, `CAP-009`, `RUNTIME-001`, `RUN-001`–`RUN-003`, `RUN-005`, `SEC-003`, `SEC-005`, `SEC-013`, `CAP-007`, `CAP-017`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-002`–`PKG-004`, `PKG-010`, `COMP-006`, `COMP-009`; primary `AC-AUTO-011`, `AC-AUTO-012`                                                                                                                                                                                                                                                                         |
| [13 Isolated Faster-Whisper/CTranslate2 Worker And Packs](13_isolated_faster_whisper_ctranslate2_worker_and_packs.md)           | Build isolated Windows/Linux CPU and NVIDIA CUDA workers with authenticated directory-relative streaming, canonical PCM, real backend proof, and exit-owned unload/cancel.                                                                   | 08, 09                                     | `RUNTIME-002`, `RUN-008`, `RUN-010`, `PKG-007`, `SCOPE-001`, `MODEL-004`, `ARCH-005`, `RUN-001`–`RUN-007`, `RUN-009`, `SEC-005`, `SEC-010`, `SEC-013`, `CAP-007`, `CAP-017`, `PKG-002`, `PKG-004`, `PKG-010`, `CPU-001`, `AMD-005`, `FAIL-005`, `FAIL-007`–`FAIL-008`; primary `AC-AUTO-055`                                                                                                                                                                                                                                                             |
| [14 Capability, Coordinator, Residency, And Lifecycle](14_capability_coordinator_residency_and_lifecycle.md)                    | Make one process-owned coordinator the sole mutable authority for settings, validation, snapshots, devices, artifacts, residency, activity, and worker lifecycle.                                                                            | 02, 03, 05, 09, 10, 11, 12, 13             | `CAP-001`–`CAP-017`, `VRAM-001`–`VRAM-003`, `LIFE-001`–`LIFE-006`, `SET-004`, `SET-006`–`SET-007`, `VAL-001`, `VAL-003`, `ARCH-003`, `ARCH-006`, `CACHE-002`, `UI-005`–`UI-006`, `COMP-004`–`COMP-006`, `COMP-008`, `NVIDIA-001`, `CPU-001`, `AMD-001`–`AMD-006`, `MAC-001`–`MAC-003`, `FAIL-001`–`FAIL-002`, `FAIL-004`–`FAIL-008`, `RUNTIME-004`, `MODEL-008`, `NONGOAL-002`; primary `AC-AUTO-005`–`AC-AUTO-007`, `AC-AUTO-010`, `AC-AUTO-013`–`AC-AUTO-015`, `AC-AUTO-019`–`AC-AUTO-022`, `AC-AUTO-034`, `AC-AUTO-042`, `AC-AUTO-047`, `AC-AUTO-051` |
| [15 Protected IPC, Composition, And Provider Selection](15_protected_ipc_composition_and_provider_selection.md)                 | Construct the coordinator once and expose protected nonoverlapping provider, settings-window, and read-only main-window typed surfaces with atomic mutations.                                                                                | 01, 02, 03, 04, 05, 14                     | `ARCH-004`, `ARCH-010`, `IPC-001`–`IPC-003`, `SET-009`, `UI-008`, `SEC-001`–`SEC-002`, `SET-004`, `SET-006`–`SET-007`, `VAL-001`, `VAL-003`, `LIFE-004`–`LIFE-005`, `PRIV-002`, `DIAG-001`; primary `AC-AUTO-003`, `AC-AUTO-025`, `AC-AUTO-059`                                                                                                                                                                                                                                                                                                          |
| [16 Local Whisper Settings And Status UI](16_local_whisper_settings_and_status_ui.md)                                           | Deliver the complete accessible provider settings/management experience, approximate and exact resource guidance, explicit load controls, and compact main-window status.                                                                    | 01, 03, 05, 14, 15                         | `UI-001`–`UI-008`, `MODEL-001`, `MODEL-007`–`MODEL-010`, `RUNTIME-003`–`RUNTIME-004`, `SET-002`–`SET-009`, `VAL-001`–`VAL-003`, `VRAM-002`–`VRAM-003`, `CAP-001`, `CAP-008`–`CAP-013`, `LIFE-003`, `LIFE-005`–`LIFE-006`, `FAIL-001`–`FAIL-002`, `FAIL-004`, `FAIL-006`, `AMD-001`–`AMD-006`, `MAC-001`–`MAC-003`; primary `AC-AUTO-004`, `AC-AUTO-038`, `AC-AUTO-049`                                                                                                                                                                                   |
| [17 Signed-Envelope Packaging And Fixture CI](17_signed_envelope_packaging_and_fixture_ci.md)                                   | Add disabled/fixture/production signed-envelope modes, one generate-once Linux-consumed fixture, a non-triggered Windows consumer, and minimal base packaging.                                                                               | 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13 | `PKG-001`–`PKG-010`, `SEC-003`, `SEC-008`–`SEC-009`, `SEC-012`–`SEC-013`, `OPS-001`, `RUNTIME-001`–`RUNTIME-003`, `MODEL-003`, `MODEL-009`–`MODEL-010`, `CAP-013`, `COMP-002`, `COMP-007`, `COMP-009`, `DL-001`–`DL-002`, `MAC-003`; primary `AC-AUTO-030`, `AC-AUTO-048`, `AC-AUTO-057`, `AC-AUTO-061`                                                                                                                                                                                                                                                  |
| [18 Migration, Privacy, Diagnostics, Documentation, And macOS Skeleton](18_migration_privacy_diagnostics_and_macos_skeleton.md) | Close migrations, rollback guidance, private audit/diagnostics v2, docs, and an unreachable Planned/unavailable macOS arm64 skeleton.                                                                                                        | 01–17                                      | `DIAG-001`–`DIAG-003`, `PRIV-001`–`PRIV-004`, `COMP-010`, `DOC-001`, `MAC-001`–`MAC-003`, `BASE-001`, `COMP-003`, `SET-001`, `SET-005`, `VAL-002`, `MODEL-010`, `CAP-013`, `UI-007`, `AMD-001`–`AMD-002`, `PKG-005`, `SEC-002`, `NONGOAL-001`–`NONGOAL-002`; primary `AC-AUTO-026`, `AC-AUTO-028`, `AC-AUTO-029`, `AC-AUTO-045`, `AC-AUTO-046`, `AC-AUTO-058`                                                                                                                                                                                            |
| [19 Integration And Qualification Gates](19_integration_and_qualification_gates.md)                                             | Freeze and exercise the release candidate across deterministic integration, Linux, every representative Windows check, previous-binary downgrade, hardware claims, and manual gates without publication.                                     | 01–18                                      | `OUT-001`, `BASE-001`, `ARCH-001`, `ARCH-009`, `COMP-001`–`COMP-004`, `CAP-001`, `CAP-011`, `LIFE-005`, `PRIV-001`–`PRIV-004`, `DIAG-001`–`DIAG-003`, `DOC-001`; orchestration of `AC-AUTO-001`–`AC-AUTO-062` and `AC-MAN-001`–`AC-MAN-013`; primary `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`                                                                                                                                                                                                                                          |

## Sequencing

```text
completed: 01–07

03,04,06 -> 08 -> 09 -> 10 -> 11 -> 12 --+
                       \-> 13 --------------+-> 14 -> 15 -> 16 --+
03–13 ---------------------------> 17 ---------------------------+-> 18 -> 19
```

- Task 08 is the only native-source and toolchain-lock foundation. It leaves
  the dirty protocol/supervisor checkpoint untouched.
- Task 09 consumes that checkpoint and owns the shared protocol, model
  authority, proof grammar, launcher bootstrap, and terminal lifecycle. It
  does not compile an inference engine.
- Tasks 10–12 build the staged Whisper.cpp CPU, CUDA, Vulkan, and HIP packs.
  Task 13 is the independent Faster-Whisper/CTranslate2 worker branch.
- Task 14 consumes both engine branches and is the sole owner of mutable
  orchestration. Tasks 15 and 16 then add protected composition/IPC and UI.
- Task 17 depends only on Tasks 03–13. It generates one fixture bundle and
  executes its Linux consumer; its Windows consumer is reusable but
  non-triggered until Task 19.
- Task 18 follows Tasks 01–17 and closes migration, privacy, diagnostics,
  documentation, and the unavailable macOS skeleton.
- Task 19 is the sole aggregate and representative-platform qualification
  packet.

## Representative Windows Boundary

- Every representative Windows filesystem, MSVC/native, launcher/Job Object,
  worker, engine, device, lifecycle, package/install, privacy, diagnostics,
  downgrade, and applicable hardware execution belongs exclusively to Task 19.
- Tasks 08–18 may define Windows source, deterministic source-contract tests,
  build profiles, reusable CI/job definitions, and non-executed fixtures. They
  must not trigger representative Windows checks or claim representative
  Windows evidence.
- Completed Tasks 04, 06, and 07 retain their Linux evidence and defer their
  representative Windows evidence to Task 19. Task 06's packaging ownership
  reference to Task 17 remains distinct from this execution boundary.
- Windows is unavailable in the current environment. Missing Task-19 evidence
  remains a release blocker, not a reason to mock, move, or infer it earlier.

## Manual Prerequisites And Known Gates

- `MANUAL GATE — native source import`: Task 08 requires separately authorized
  networked import of exact Git objects into a private temporary/content store.
  Use the GitHub plugin for upstream GitHub source review. Configure, build,
  test, and verification remain network-denied from the first command.
- `MANUAL GATE — external toolchains`: CUDA, Vulkan, HIP/ROCm, Windows MSVC,
  packaged Python/wheels, and redistributable closure must match the frozen
  locks. Missing inputs block only their affected pack or evidence.
- `MANUAL GATE — Linux HIP row`: Task 12 cannot add a physical HIP pack or
  catalog row until one reviewed immutable input pins the full ROCm,
  distro/kernel/amdgpu, PCI ID, `gfx`, package/SONAME, access, license, and
  dependency intersection. Synthetic fixtures do not prove hardware support.
- `MANUAL GATE — production artifacts`: Task 17 defines a protected production
  input contract but does not choose an origin, use private signing material,
  convert real models, upload, publish, or admit fixture trust to release.
- `MANUAL GATE — prior binary`: Task 19 requires the exact immediately
  preceding packaged binary for each representative platform, with recorded
  version/hash and a nonprivate fixture profile. A current-binary substitute
  does not satisfy `AC-MAN-013`.
- AMD remains `Preview · Untested`; Faster-Whisper AMD remains Unsupported.
  Promotion requires representative physical AMD evidence in future approved
  work.
- macOS remains Planned/unavailable. Task 18 contains no executable Local
  Whisper path; Apple Silicon/Metal/Core ML and signing/notarization require a
  new approved specification and plan.

## Non-Executable Follow-Up Backlog

- Add measured native fuzzing, coverage, leak, and performance-regression gates
  only after production workers exist and approved work defines corpora,
  budgets, and release impact.
- Research and specify Apple Silicon/Metal/Core ML, app signing/notarization,
  distribution, estimates, proof, and physical qualification before executable
  macOS work.
- Revisit AMD Production eligibility only after representative Windows Vulkan
  and Linux HIP/Vulkan hardware profiles pass. Upstream support and mocked
  probes are insufficient.

## Approval Boundary

Revision 9 is Approved by the durable Prompt MCP answer for
`approval.plan-revision-9`, sequence 40, revision 1. Approval does not
authorize implementation, source import, commit, push, publication, or release.
The former `execution.task-08` authorization targeted a superseded revision-8
packet and is stale. Replacement Task 08 requires separate execution
authorization. Each later `incremental-implementation` invocation executes
exactly one authorized packet, updates `todo.md` and `handoff.md`, and stops
before commit or the next packet.
