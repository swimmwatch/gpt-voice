# Implementation Plan: Local Whisper

Status: Approved

Revision: 20

Specification baseline: approved `spec.md` revision 15. This revision preserves
completed Tasks 01–19 and 23, adds self-contained Task 24 to make Windows x64
CPU/CUDA runtime delivery executable before candidate freeze, and keeps Tasks
20–22 as distinct Linux qualification, Windows qualification, and aggregate
readiness packets. Qualification packet numbers remain stable; no candidate
identity may freeze before Task 24 is reviewed, committed, and passing.

## Goal

Deliver Local Whisper as an optional main-owned Voice provider with the fixed
`whisperCpp` engine identity; explicit backend, device, runtime, model,
decoding, artifact, and lifecycle controls; deterministic source and artifact
trust; current-device validation; local buffered inference; explicit RAM/VRAM
load and unload; and an accessible settings/status experience. Windows and
Linux are release platforms, AMD remains untested Preview, and macOS remains a
non-executable Planned/unavailable skeleton.

## Ordered Task Index

Coverage below lists packet-owned requirement IDs and registry-primary
automated acceptance IDs. Supporting acceptance and task-local contract detail
remain in the linked packet.

| Task                                                                                                                            | Outcome                                                                                                                                                                                                                                                                                                                                | Dependencies                               | Coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01 Shared Local Whisper Domain Contracts](01_shared_domain_contracts.md)                                                       | Define the closed renderer-safe settings, catalog, identity, state, error, language, worker-message, default, estimate, and validation vocabulary.                                                                                                                                                                                     | None                                       | `OUT-001`, `SCOPE-001`–`SCOPE-002`, `MODEL-003`, `MODEL-005`, `MODEL-009`–`MODEL-010`, `VRAM-001`, `NONGOAL-003`, `ARCH-007`, `RUNTIME-001`, `COMP-005`–`COMP-006`, `COMP-011`, `SET-002`, `SET-004`–`SET-008`, `VAL-002`–`VAL-003`, `PRIV-002`, `CAP-003`, `CAP-010`, `CAP-013`, `CACHE-001`, `MAC-001`; primary `AC-AUTO-001`, `AC-AUTO-008`, `AC-AUTO-036`, `AC-AUTO-037`, `AC-AUTO-044`                                                                                                                                                                         |
| [02 Provider Dispatch And Cache Seam](02_provider_dispatch_and_cache.md)                                                        | Register `localRuntime`, bypass remote authentication, preserve cache eligibility, and delegate stateful work through the coordinator port.                                                                                                                                                                                            | 01                                         | `SCOPE-002`, `ARCH-001`–`ARCH-003`, `ARCH-006`, `ARCH-008`–`ARCH-009`, `SEC-002`, `SEC-006`, `COMP-001`–`COMP-003`, `CACHE-001`–`CACHE-002`, `CAP-008`, `CAP-011`, `LIFE-001`, `LIFE-005`, `UI-006`, `DIAG-001`; primary `AC-AUTO-016`, `AC-AUTO-027`, `AC-AUTO-033`, `AC-AUTO-035`, `AC-AUTO-039`                                                                                                                                                                                                                                                                  |
| [03 Trusted Catalog, Settings, And Inventory](03_trusted_catalog_settings_and_inventory.md)                                     | Own private versioned settings, strict signed catalog/keyring validation, closed estimates, and reconstructed sanitized inventory in main.                                                                                                                                                                                             | 01                                         | `SET-001`, `SET-004`–`SET-008`, `VAL-002`–`VAL-003`, `PRIV-002`, `MODEL-002`–`MODEL-003`, `MODEL-007`, `MODEL-009`–`MODEL-010`, `RUNTIME-003`, `COMP-007`, `COMP-011`, `CAP-013`, `SEC-003`, `SEC-008`, `PKG-002`, `PKG-005`, `OPS-001`; primary `AC-AUTO-009`, `AC-AUTO-031`                                                                                                                                                                                                                                                                                       |
| [04 Managed Filesystem Safety](04_managed_filesystem_safety.md)                                                                 | Provide descriptor/handle-anchored managed storage, leases, locks, quarantine, promotion, and exact deletion for Linux and Windows.                                                                                                                                                                                                    | 01, 03                                     | `MODEL-006`, `MODEL-008`, `SEC-004`, `SEC-007`, `RUN-004`, `RUNTIME-004`, `VRAM-003`, `FAIL-001`, `FAIL-004`; primary `AC-AUTO-041`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [05 Streaming Artifact Lifecycle](05_streaming_artifact_lifecycle.md)                                                           | Stream, resume, verify, promote, update, and remove explicitly selected immutable runtime/model revisions through bounded trusted operations.                                                                                                                                                                                          | 01, 03, 04                                 | `DL-001`–`DL-003`, `PERF-001`, `FAIL-001`, `FAIL-003`–`FAIL-004`, `PKG-002`, `SEC-003`, `OPS-001`, `MODEL-002`, `MODEL-007`–`MODEL-008`, `RUNTIME-003`–`RUNTIME-004`, `COMP-007`; primary `AC-AUTO-017`, `AC-AUTO-018`, `AC-AUTO-043`                                                                                                                                                                                                                                                                                                                               |
| [06 Native C++ Modularization](06_native_cpp_modularization.md)                                                                 | Keep the filesystem guard as modular C++20 with RAII platform backends, CMake/GoogleTest, linting, sanitizers, CI, README, and repository rules.                                                                                                                                                                                       | 04, 05                                     | `SEC-007`, `RUN-004`, `PKG-001`; supporting acceptance only, with final Windows evidence in Task 21                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [07 Framed Worker Supervisor](07_framed_worker_supervisor.md)                                                                   | Own strict framed stdio, authenticated launch, stage deadlines, and Linux/Windows process-tree termination without fallback or private argv data.                                                                                                                                                                                      | 01, 03, 04, 06                             | `ARCH-003`, `ARCH-005`–`ARCH-006`, `RUN-001`–`RUN-005`, `SEC-005`, `SEC-007`, `PRIV-001`, `FAIL-005`, `FAIL-007`, `LIFE-001`; primary `AC-AUTO-024`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [08 Deterministic Native Source Objects And Toolchain Locks](08_deterministic_native_source_and_toolchain_locks.md)             | Establish canonical Whisper.cpp, nlohmann/json, and offline GoogleTest source objects, immutable source/license/patch identities, a reviewed loader-limit table, qualified disconnected Linux CPU/Clang-sanitizer/CUDA profiles, and exact Windows candidates.                                                                         | 03, 04, 06                                 | `SEC-003`, `SEC-009`, `SEC-013`, `PKG-002`–`PKG-004`, `PKG-006`, `PKG-010`, `OPS-001`, `COMP-009`, support for `RUN-009`, `RUN-011`–`RUN-012`; primary `AC-AUTO-050`                                                                                                                                                                                                                                                                                                                                                                                                |
| [09 Shared Worker Protocol, Model Authority, And Lifecycle](09_shared_worker_protocol_model_authority_and_lifecycle.md)         | Complete one bounded TypeScript/C++ protocol with canonical grammar, WAV framing, probe/load split, authenticated model authority, proofs, terminal cleanup, and real GoogleTest suites consuming only Task-08 verified local inputs.                                                                                                  | 01, 03, 04, 06, 07, 08                     | `ARCH-005`, `AUDIO-001`–`AUDIO-002`, `RUN-001`–`RUN-007`, `RUN-009`, `SEC-005`, `SEC-007`, `SEC-010`–`SEC-011`, `CAP-014`, `PRIV-001`, `PRIV-004`, `FAIL-005`, `FAIL-007`–`FAIL-008`; primary `AC-AUTO-053`, `AC-AUTO-054`, `AC-AUTO-056`                                                                                                                                                                                                                                                                                                                           |
| [10 Hardened Whisper.cpp Core And CPU Worker Pack](10_hardened_whisper_cpp_core_and_cpu_pack.md)                                | Atomically migrate the unreleased authority binding to authenticated artifact size/content evidence, then build a modular CPU-only worker and offline pack with slot-3 model access, exact-read loader hardening, bounded parsing, proof, inference, and exit unload.                                                                  | 08, 09                                     | `RUNTIME-001`, `RUN-011`, `SEC-013`, `SCOPE-001`, `MODEL-004`, `ARCH-005`, `RUN-001`–`RUN-006`, `SEC-005`, `SEC-010`, `CAP-007`, `CAP-009`, `CAP-017`, `CPU-001`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-003`–`PKG-004`, `PKG-010`; primary `AC-AUTO-052`, `AC-AUTO-060`                                                                                                                                                                                                                                                                                           |
| [11 Whisper.cpp Device Proof, Cancellation, And CUDA Pack](11_whisper_cpp_device_proof_cancellation_and_cuda_pack.md)           | Add exact NVIDIA binding/proof, cooperative cancellation, and a Linux CUDA 12.8.1 Blackwell pack while rebuilding the CPU pack against the same patch.                                                                                                                                                                                 | 08, 09, 10                                 | `RUN-012`, `CAP-017`, `RUNTIME-001`, `ARCH-005`, `RUN-001`–`RUN-006`, `SEC-005`, `SEC-010`, `SEC-013`, `CAP-007`, `CAP-009`, `CAP-014`, `NVIDIA-001`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-003`–`PKG-004`, `PKG-010`; primary `AC-AUTO-062`                                                                                                                                                                                                                                                                                                                      |
| [12 AMD Vulkan And Linux HIP Preview Packs](12_amd_vulkan_and_linux_hip_preview_packs.md)                                       | Define deterministic Windows/Linux Vulkan and Linux HIP Preview packs without fallback, invented hardware evidence, or an unreviewed HIP catalog row.                                                                                                                                                                                  | 08, 09, 10, 11                             | `AMD-001`–`AMD-004`, `AMD-006`, `CAP-009`, `RUNTIME-001`, `RUN-001`–`RUN-003`, `RUN-005`, `SEC-003`, `SEC-005`, `SEC-013`, `CAP-007`, `CAP-017`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-002`–`PKG-004`, `PKG-010`, `COMP-006`, `COMP-009`; primary `AC-AUTO-011`, `AC-AUTO-012`                                                                                                                                                                                                                                                                                    |
| [13 Single-Engine Cleanup And Contract Normalization](13_single_engine_cleanup_and_contract_normalization.md)                   | Remove active Faster-Whisper/CTranslate2/Python artifacts and normalize the unreleased Local Whisper domain, settings, catalogs, source locks, language mappings, AMD contracts, tests, and research to fixed `whisperCpp`.                                                                                                            | 01, 03, 08, 12                             | `SCOPE-001`, `MODEL-004`, `NONGOAL-004`, `ARCH-007`, `UI-003`, `SET-001`, `SET-004`–`SET-005`, `LIFE-004`, `PKG-010`; primary `AC-AUTO-063`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [14 Capability, Coordinator, Residency, And Lifecycle](14_capability_coordinator_residency_and_lifecycle.md)                    | Make one process-owned coordinator the sole mutable authority for settings, validation, snapshots, devices, artifacts, residency, activity, and worker lifecycle.                                                                                                                                                                      | 02, 03, 05, 09, 10, 11, 12, 13             | `CAP-001`–`CAP-017`, `VRAM-001`–`VRAM-003`, `LIFE-001`–`LIFE-006`, `SET-004`, `SET-006`–`SET-007`, `VAL-001`, `VAL-003`, `ARCH-003`, `ARCH-006`, `CACHE-002`, `UI-005`–`UI-006`, `COMP-004`–`COMP-006`, `COMP-008`, `NVIDIA-001`, `CPU-001`, `AMD-001`–`AMD-004`, `AMD-006`, `MAC-001`–`MAC-003`, `FAIL-001`–`FAIL-002`, `FAIL-004`–`FAIL-008`, `RUNTIME-004`, `MODEL-008`, `NONGOAL-002`; primary `AC-AUTO-005`–`AC-AUTO-007`, `AC-AUTO-010`, `AC-AUTO-013`–`AC-AUTO-015`, `AC-AUTO-019`–`AC-AUTO-022`, `AC-AUTO-034`, `AC-AUTO-042`, `AC-AUTO-047`, `AC-AUTO-051` |
| [15 Protected IPC, Composition, And Provider Selection](15_protected_ipc_composition_and_provider_selection.md)                 | Construct the coordinator once and expose the protected provider, settings-window, and read-only main-status foundations later extended by Task 23 without reopening this completed packet.                                                                                                                                            | 01, 02, 03, 04, 05, 14                     | `ARCH-004`, base slices of `ARCH-010`, `IPC-001`–`IPC-003`, `SET-009`, `UI-008`, `SEC-001`–`SEC-002`, `SET-004`, `SET-006`–`SET-007`, `VAL-001`, `VAL-003`, `LIFE-004`–`LIFE-005`, `PRIV-002`, `DIAG-001`; primary `AC-AUTO-003`, `AC-AUTO-025`; supporting base sender/status coverage for amended `AC-AUTO-059`                                                                                                                                                                                                                                                   |
| [16 Local Whisper Settings And Status UI](16_local_whisper_settings_and_status_ui.md)                                           | Deliver the complete accessible provider settings/management experience, approximate and exact resource guidance, explicit load controls, and compact main-window status.                                                                                                                                                              | 01, 03, 05, 14, 15                         | `UI-001`–`UI-008`, `MODEL-001`, `MODEL-007`–`MODEL-010`, `RUNTIME-003`–`RUNTIME-004`, `SET-002`–`SET-009`, `VAL-001`–`VAL-003`, `VRAM-002`–`VRAM-003`, `CAP-001`, `CAP-008`–`CAP-013`, `LIFE-003`, `LIFE-005`–`LIFE-006`, `FAIL-001`–`FAIL-002`, `FAIL-004`, `FAIL-006`, `AMD-001`–`AMD-004`, `AMD-006`, `MAC-001`–`MAC-003`; primary `AC-AUTO-004`, `AC-AUTO-038`, `AC-AUTO-049`                                                                                                                                                                                   |
| [17 Signed-Envelope Packaging And Fixture CI](17_signed_envelope_packaging_and_fixture_ci.md)                                   | Add disabled/fixture/production signed-envelope modes, one generate-once Linux-consumed fixture, a non-triggered Windows consumer, and minimal base packaging.                                                                                                                                                                         | 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13 | `PKG-001`–`PKG-006`, `PKG-008`–`PKG-010`, `SEC-003`, `SEC-008`–`SEC-009`, `SEC-012`–`SEC-013`, `OPS-001`, `RUNTIME-001`, `RUNTIME-003`, `MODEL-003`, `MODEL-009`–`MODEL-010`, `CAP-013`, `COMP-002`, `COMP-007`, `COMP-009`, `DL-001`–`DL-002`, `MAC-003`; primary `AC-AUTO-030`, `AC-AUTO-048`, `AC-AUTO-057`, `AC-AUTO-061`                                                                                                                                                                                                                                       |
| [18 Migration, Privacy, Diagnostics, Documentation, And macOS Skeleton](18_migration_privacy_diagnostics_and_macos_skeleton.md) | Close migrations, rollback guidance, private audit/diagnostics v2, docs, and an unreachable Planned/unavailable macOS arm64 skeleton.                                                                                                                                                                                                  | 01–17                                      | `DIAG-001`–`DIAG-003`, `PRIV-001`–`PRIV-004`, `COMP-010`, `DOC-001`, `MAC-001`–`MAC-003`, `BASE-001`, `COMP-003`, `SET-001`, `SET-005`, `VAL-002`, `MODEL-010`, `CAP-013`, `UI-007`, `AMD-001`–`AMD-002`, `PKG-005`, `SEC-002`, `NONGOAL-001`–`NONGOAL-002`; primary `AC-AUTO-026`, `AC-AUTO-028`, `AC-AUTO-029`, `AC-AUTO-045`, `AC-AUTO-046`, `AC-AUTO-058`                                                                                                                                                                                                       |
| [19 Cross-Platform Implementation Readiness](19_cross_platform_implementation_readiness.md)                                     | Finish the static Windows/Linux CPU/CUDA implementation, add explicit non-packaged development activation, download/install all six exact models from Hugging Face through the normal Linux app, expose every model for CPU/CUDA selection, and pass bounded `base/full` CPU/CUDA application smoke while qualification stays Pending. | 01–18                                      | `DEV-001`, `SEC-015`, `IMPL-001`–`IMPL-002`, `DL-004`–`DL-005`, `MODEL-001`–`MODEL-002`, `MODEL-005`, `ARCH-010`, `COMP-012`, `DIST-001`–`DIST-002`, `MODEL-011`, `PKG-011`, `SEC-014`, `REL-001`, `QUAL-001`–`QUAL-004`, `PRIV-005`, `OPS-002`–`OPS-003`; applicable prior implementation requirements; primary `AC-AUTO-064`–`AC-AUTO-070`, `AC-AUTO-072`–`AC-AUTO-075`; manual `AC-MAN-015`                                                                                                                                                                      |
| [23 Main-Window Local Whisper Residency Control](23_main_window_residency_control.md)                                           | Add the active-provider-only Load/Free model control through a separate closed main command, exact sender/provider/revision/action gates, sanitized revision-aware UI, and switch-during-pending conflict behavior.                                                                                                                    | 15, 16, 19                                 | `ARCH-011`, `IPC-004`, `UI-009`, `LIFE-007`, `SEC-016`; revision-15 slices of `ARCH-010`, `IPC-003`, `UI-008`, `FAIL-004`; primary `AC-AUTO-059`, `AC-AUTO-076`, `AC-AUTO-077`; manual `AC-MAN-016`                                                                                                                                                                                                                                                                                                                                                                 |
| [24 Windows Runtime Delivery Readiness](24_windows_runtime_delivery_readiness.md)                                               | Build deterministic Windows CPU/CUDA workers and runtime packs, extend authenticated development activation and package validation to Windows, and pass bounded ordinary-app CPU/CUDA smoke before any candidate freeze.                                                                                                               | 19, 23                                     | Windows readiness slices of `IMPL-001`–`IMPL-002`, `COMP-004`, `COMP-008`, `COMP-012`, `CPU-001`, `DIST-001`–`DIST-002`, `PKG-002`–`PKG-005`, `PKG-009`–`PKG-011`, `SEC-008`, `SEC-011`, `SEC-014`–`SEC-015`, `DEV-001`, `MODEL-011`, `QUAL-004`, `OPS-003`; supporting existing automated/manual acceptance only; no primary-owner change or qualification evidence                                                                                                                                                                                                |
| [20 Linux Qualification](20_linux_qualification.md)                                                                             | Freeze a fresh shared candidate and Linux graph after Tasks 19, 23, and 24, then execute all-six-model Linux CPU/CUDA transport, package, parity, resource, lifecycle, privacy, offline, cleanup, and predecessor evidence.                                                                                                            | 19, 23, 24                                 | Linux slices of `REL-001`, `COMP-012`, `MODEL-011`, `QUAL-001`–`QUAL-004`, `PRIV-005`, `OPS-003`; supporting evidence for `AC-AUTO-064`–`AC-AUTO-070`, `AC-AUTO-072`–`AC-AUTO-077`; Linux `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, `AC-MAN-013`, and technical inputs for `AC-MAN-014`; consumes but does not replace `AC-MAN-015`–`AC-MAN-016`                                                                                                                                                                                                       |
| [21 Windows Qualification](21_windows_qualification.md)                                                                         | Consume Task 24's verified delivery tooling plus the unchanged shared/Linux branch, freeze a distinct Windows graph on representative Windows x64, then execute all Windows CPU/CUDA, native, installer, lifecycle, privacy, resource, transport, and predecessor gates without production repair inside frozen evidence.              | 19, 20, 23, 24                             | Windows slices of `REL-001`, `COMP-012`, `MODEL-011`, `QUAL-001`–`QUAL-004`, `PRIV-005`, `OPS-003`; supporting evidence for `AC-AUTO-064`–`AC-AUTO-070`, `AC-AUTO-072`–`AC-AUTO-077`; Windows `AC-MAN-002`–`AC-MAN-008`, `AC-MAN-013`, and technical inputs for `AC-MAN-014`; consumes Tasks 23/24 without replacing their bounded readiness evidence                                                                                                                                                                                                               |
| [22 Aggregate Production Readiness And Release Blockers](22_aggregate_and_release_blockers.md)                                  | Validate the unchanged shared core and both immutable platform branches, seal `aggregateEvidenceDigest`, prove qualification-to-production and protected external gates, and report every blocker without rerunning platform profiles.                                                                                                 | 19, 20, 21, 23, 24                         | Aggregate `REL-001`, `COMP-012`, `PKG-011`, `SEC-014`, `DIST-001`–`DIST-002`, `QUAL-001`–`QUAL-004`, `OPS-002`–`OPS-003`, and applicable prior requirements; primary `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`, `AC-AUTO-071`; reconciliation of all automated acceptance plus `AC-MAN-001`–`AC-MAN-016`                                                                                                                                                                                                                                           |

## Sequencing

```text
completed and committed: 01–19, 23
planned next: 24

01,03,08,12 -> 13 -> 14 -> 15 -> 16 --+
03–13 -------------> 17 ---------------+-> 18 -> 19 -> 23 -> 24 -> 20 -> 21 -> 22
```

- Tasks 01–18 remain completed foundations. Revision 19 does not reopen or
  re-execute them. Task 19 remains complete in the worktree and must be
  reviewed and committed before Task 23 production edits begin.
- Task 13 removes the active alternate-engine artifacts introduced by Tasks
  01, 03, and 08 and normalizes Task 12's closed AMD matrix. Git history
  preserves their prior reviewed evidence.
- Task 13 must complete before coordinator, packaging, migration,
  documentation, or aggregate qualification work. It introduces no new
  inference engine, runtime pack, migration compatibility layer, or support
  claim.
- Task 14 consumes the single `whisperCpp` worker family and is the sole owner
  of mutable orchestration. Tasks 15 and 16 then add protected composition/IPC
  and UI.
- Task 17 depends on the normalized source, catalog, and pack boundaries
  through Task 13. It may proceed in parallel with Tasks 14–16 once Task 13 is
  complete.
- Task 18 follows Tasks 01–17 and closes migration, privacy, diagnostics,
  documentation, and the unavailable macOS skeleton.
- Task 19 preserves its uncommitted static-readiness work, reopens its completion
  verdict, and finishes the product as an ordinary testable Linux application.
  It adds the explicit non-packaged CLI activation descriptor, accurate
  catalog-unavailable state, the real public Hugging Face model-download path,
  all-six-model installation/management/CPU-CUDA selection, and bounded
  `base/full` CPU/CUDA load/transcribe/unload smoke. It also preserves complete
  Windows implementation contracts without executing Windows. Linux and
  Windows qualification remain `Pending`; no shared candidate, platform
  branch, result, evidence index, predecessor result, or aggregate root is
  frozen.
- Task 23 consumes the completed Task 19 application graph plus the committed
  Task 15/16 IPC/status/UI foundations. It adds only the approved closed
  main-window `load|unload` command and active-provider Load/Free control,
  moves amended `AC-AUTO-059` ownership to itself, owns `AC-AUTO-076`–
  `AC-AUTO-077` and `AC-MAN-016`, and leaves every platform qualification
  `Pending`. It performs no artifact download, settings migration, native
  change, or candidate freeze.
- Task 24 executes before candidate freeze. It turns the existing static
  Windows contracts into deterministic Windows CPU/CUDA runtime delivery,
  extends the authenticated ordinary-app development activation to `win32`,
  validates unpacked packaging and native ownership, and passes a bounded
  Windows CPU/CUDA smoke. It creates no qualification evidence or Production
  authority.
- Task 20 consumes Tasks 19, 23, and 24's final committed implementation identity, freezes
  one fresh SemVer/UTC `candidateInputDigest`, and creates only the Linux
  platform input, profiles, graph, result, and evidence index. It performs the
  complete representative Linux qualification and creates no Windows identity.
- Task 21 consumes Task 24's already verified delivery tooling plus the
  unchanged shared candidate and read-only Linux branch. It owns exact Windows
  application/runtime/direct-engine/toolchain/predecessor
  inputs, profiles, platform graph, result, and evidence index and cannot mutate
  production implementation, the shared core, Linux branch, or production
  trust.
- Task 22 validates ownership and both immutable platform branches, seals the
  aggregate evidence root, proves allowed qualification-to-production deltas,
  validates protected production trust/legal/provenance/SBOM/notice/
  redistribution evidence, and validates the final GitHub runtime origin after
  separately authorized upload. It never reruns or rewrites unchanged branch
  evidence.

## Windows Readiness And Qualification Boundary

- Task 24 owns pre-freeze Windows implementation, runtime-pack delivery,
  authenticated ordinary-app activation, unpacked package verification, and
  one bounded CPU/CUDA smoke. Its results are readiness evidence only.
- Every all-six-model representative Windows filesystem, MSVC/native,
  launcher/Job Object, worker, device, lifecycle, installer, privacy,
  diagnostics, downgrade, resource/performance, predecessor, and immutable
  evidence run belongs exclusively to Task 21.
- Tasks 08–18 may define Windows source, deterministic source-contract tests,
  build profiles, reusable CI/job definitions, and non-executed fixtures. They
  must not trigger representative Windows checks or claim representative
  Windows evidence.
- Completed Tasks 04, 06, and 07 retain their Linux evidence and defer their
  representative Windows evidence to Task 21. Task 06's packaging ownership
  reference to Task 17 remains distinct from this execution boundary.
- Missing Task 24 Windows readiness blocks candidate freeze. Missing Task 21
  representative qualification remains a release blocker. Neither may be
  substituted by mocks, Wine, cross-compilation, Linux evidence, or compile-only
  CI.

## Manual Prerequisites And Known Gates

- `MANUAL GATE — native source import`: Task 08 used separately authorized
  networked import of exact Git objects into a private temporary/content store.
  Use the GitHub plugin for any future upstream GitHub source review.
  Configure, build, test, and verification remain network-denied from the first
  command.
- `MANUAL GATE — external toolchains`: CUDA, Vulkan, HIP/ROCm, Windows MSVC,
  and redistributable closures must match the frozen locks. Missing inputs
  block only their affected pack or evidence.
- `MANUAL GATE — Linux HIP row`: Task 12 cannot add a physical HIP pack or
  catalog row until one reviewed immutable input pins the full ROCm,
  distro/kernel/amdgpu, PCI ID, `gfx`, package/SONAME, access, license, and
  dependency intersection. Synthetic fixtures do not prove hardware support.
- `TASK 19 TECHNICAL INPUT — approved transports`: runtime packs use
  `restricted-tar-gzip-v1`; models use `pinned-raw-model-v1` directly from the
  six immutable public Hugging Face objects in specification Section 9.2.
  Task 19 owns both strict materializers, production command paths, and
  deterministic contract checks. It must perform real anonymous normal-app
  downloads for all six models, but those downloads are functional readiness,
  not all-model Production qualification.
- `TASK 19 DEVELOPMENT ACTIVATION`: main accepts exactly one
  `--local-whisper-development-activation=<absolute-path>` opt-in only when
  `app.isPackaged === false`. The canonical descriptor embeds qualification
  catalog/keyring/origin and loopback-CA public inputs, binds app revision and
  worker protocol 1, selects one validated development resources root, and is
  never persisted or exposed to renderer. Packaged identity rejects the flag
  before reading it.
- `TASK 19 IMPLEMENTATION READINESS`: both Windows and Linux production
  adapters, helpers, CPU/CUDA roles, packaging mappings, process/model
  authority, lifecycle, and trust-purpose isolation must pass deterministic
  automated contracts. The ordinary Linux app must also download and install
  all six exact models and pass one `base/full` CPU smoke plus one CUDA smoke.
  Missing platform qualification results remain `Pending`; functional smoke is
  not Production evidence.
- `MANUAL GATE — Task 19 public downloads and bounded hardware smoke`: Task 19
  execution authorization permits anonymous GETs only for the six exact pinned
  Hugging Face objects and local loopback runtime bytes, plus storage under the
  fixed managed root. It permits no credentials, private audio, upload,
  publication, or arbitrary origin. The Linux NVIDIA host must have sufficient
  disk and network access; a public outage remains an explicit blocker rather
  than authorizing a mirror.
- `TASK 23 MAIN RESIDENCY CONTROL`: after the Task 19 completion delta is
  reviewed and committed, add one closed active-provider main command and one
  accessible main-toolbar Load/Free control. Main validates exact sender,
  committed provider, positive current snapshot revision, and action state
  before delegating once to the existing coordinator. Status subscription
  remains read-only; no settings, artifact, path, URL, raw error, cancellation,
  or second lifecycle authority crosses the new boundary.
- `TASK 24 WINDOWS READINESS`: before Task 20 freezes the shared candidate,
  build and reproduce the exact Windows x64 CPU/CUDA runtimes, extend the
  qualification-purpose non-packaged activation to Windows, verify only the two
  base-package helpers, and pass one bounded ordinary-app `base/full` CPU/CUDA
  smoke on an authorized Windows host. The workflow remains reusable/manual-
  gated; this creates no qualification branch or Production claim.
- `MANUAL GATE — Task 23 CPU/CUDA main-window smoke`: through the existing
  authenticated non-packaged activation and already installed `base/full`
  model, exercise the main Load/Free control once on CPU and once on the
  available NVIDIA CUDA device, including keyboard/screen-reader behavior,
  switch-during-pending conflict, renderer replay, confirmed resource release,
  and orphan cleanup. This gate authorizes no download, private audio,
  publication, or qualification claim.
- `TASK 20 QUALIFICATION TRUST`: after Tasks 19 and 23's final committed source exists,
  freeze one explicit SemVer/UTC shared candidate input, then a Linux
  qualification-purpose catalog/keyring, single-use loopback HTTPS origin,
  platform input, profiles, and platform graph for the exact Linux runtime
  bytes. Fixture and production trust remain disjoint. Exact Windows branch
  inputs, final production keys, GitHub upload, and legal publication approval
  are not Task 20 prerequisites.
- `TASK 20 QUALIFICATION INPUTS`: deterministic CPU/CUDA runtime archives,
  exact raw models, pinned FLEURS `en_us`/`ru_ru` corpus, direct-engine binary,
  immutable Linux profiles, measurement adapters, and clean Linux package/
  source identities must be frozen before measurements. Missing technical
  inputs block only the affected Linux branch and cannot be replaced by mocks.
- `MANUAL GATE — prior binary`: determine the highest stable release before
  freeze. If no later stable exists, Task 20 uses
  `GPT-Voice-2.3.0.AppImage` SHA-256
  `80674b3a90222b51981fb43b5b757b7af9d3e38a5ff4ca41554ab965ae29f111`
  and Task 21 uses `GPT-Voice.Setup.2.3.0.exe` SHA-256
  `0e2aa1ea97ba357db6d35f53debd01ca1c6124ae10b9f537b2af4427a0328cd0`.
  Task 22 reconciles both; a current-code fixture is not evidence.
- `TASK 22 PRODUCTION GATES`: protected production keyring/catalog inputs,
  legal and redistribution approval, provenance/SBOM/notices, final GitHub
  runtime asset upload authorization, and release authority remain external.
  Task 22 may validate and report them but may not fabricate or perform upload,
  publication, signing, tag, or release without separate authorization.
- AMD remains `Preview · Untested`. Promotion requires representative physical
  AMD evidence in future approved work.
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

Revision 19 was explicitly approved through durable decision
`approval.plan-revision-19`, sequence 77, in the persistent
`plan:local-whisper` interview. The user selected standalone Task 23 placement
through `planning.main-control-packet-placement`, sequence 76.

Plan approval authorizes no packet execution, application launch, hardware
use, commit, push, pull request, candidate freeze, qualification, private
signing, upload, publication, support promotion, tag, or release. Task 23
requires a separate execution-authorization decision after plan approval. Each
incremental-implementation invocation executes exactly one packet, updates
`todo.md` and `handoff.md`, and stops before committing that packet or opening
the next one.
