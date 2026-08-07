# Implementation Plan: Local Whisper

Status: Approved

Revision: 26

Specification baseline: approved `spec.md` revision 20. This revision preserves
completed Tasks 01–20, 23, and 24; keeps Task 26 deferred and non-executable;
adds Task 30 release-branch preparation after Task 27; and revises Tasks 28, 29,
21, and 22 for exact release-PR head qualification, pre-merge aggregate
readiness, preserving merge verification, post-merge immutable tag creation,
and exact delivery. No candidate freezes before Tasks 25, 27, and 30 pass, and
no platform qualification runs before Task 28 freezes final signed bytes.

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

| Task                                                                                                                            | Outcome                                                                                                                                                                                                                                                                                                                                                     | Dependencies                               | Coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01 Shared Local Whisper Domain Contracts](01_shared_domain_contracts.md)                                                       | Define the closed renderer-safe settings, catalog, identity, state, error, language, worker-message, default, estimate, and validation vocabulary.                                                                                                                                                                                                          | None                                       | `OUT-001`, `SCOPE-001`–`SCOPE-002`, `MODEL-003`, `MODEL-005`, `MODEL-009`–`MODEL-010`, `VRAM-001`, `NONGOAL-003`, `ARCH-007`, `RUNTIME-001`, `COMP-005`–`COMP-006`, `COMP-011`, `SET-002`, `SET-004`–`SET-008`, `VAL-002`–`VAL-003`, `PRIV-002`, `CAP-003`, `CAP-010`, `CAP-013`, `CACHE-001`, `MAC-001`; primary `AC-AUTO-001`, `AC-AUTO-008`, `AC-AUTO-036`, `AC-AUTO-037`, `AC-AUTO-044`                                                                                                                                                                         |
| [02 Provider Dispatch And Cache Seam](02_provider_dispatch_and_cache.md)                                                        | Register `localRuntime`, bypass remote authentication, preserve cache eligibility, and delegate stateful work through the coordinator port.                                                                                                                                                                                                                 | 01                                         | `SCOPE-002`, `ARCH-001`–`ARCH-003`, `ARCH-006`, `ARCH-008`–`ARCH-009`, `SEC-002`, `SEC-006`, `COMP-001`–`COMP-003`, `CACHE-001`–`CACHE-002`, `CAP-008`, `CAP-011`, `LIFE-001`, `LIFE-005`, `UI-006`, `DIAG-001`; primary `AC-AUTO-016`, `AC-AUTO-027`, `AC-AUTO-033`, `AC-AUTO-035`, `AC-AUTO-039`                                                                                                                                                                                                                                                                  |
| [03 Trusted Catalog, Settings, And Inventory](03_trusted_catalog_settings_and_inventory.md)                                     | Own private versioned settings, strict signed catalog/keyring validation, closed estimates, and reconstructed sanitized inventory in main.                                                                                                                                                                                                                  | 01                                         | `SET-001`, `SET-004`–`SET-008`, `VAL-002`–`VAL-003`, `PRIV-002`, `MODEL-002`–`MODEL-003`, `MODEL-007`, `MODEL-009`–`MODEL-010`, `RUNTIME-003`, `COMP-007`, `COMP-011`, `CAP-013`, `SEC-003`, `SEC-008`, `PKG-002`, `PKG-005`, `OPS-001`; primary `AC-AUTO-009`, `AC-AUTO-031`                                                                                                                                                                                                                                                                                       |
| [04 Managed Filesystem Safety](04_managed_filesystem_safety.md)                                                                 | Provide descriptor/handle-anchored managed storage, leases, locks, quarantine, promotion, and exact deletion for Linux and Windows.                                                                                                                                                                                                                         | 01, 03                                     | `MODEL-006`, `MODEL-008`, `SEC-004`, `SEC-007`, `RUN-004`, `RUNTIME-004`, `VRAM-003`, `FAIL-001`, `FAIL-004`; primary `AC-AUTO-041`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [05 Streaming Artifact Lifecycle](05_streaming_artifact_lifecycle.md)                                                           | Stream, resume, verify, promote, update, and remove explicitly selected immutable runtime/model revisions through bounded trusted operations.                                                                                                                                                                                                               | 01, 03, 04                                 | `DL-001`–`DL-003`, `PERF-001`, `FAIL-001`, `FAIL-003`–`FAIL-004`, `PKG-002`, `SEC-003`, `OPS-001`, `MODEL-002`, `MODEL-007`–`MODEL-008`, `RUNTIME-003`–`RUNTIME-004`, `COMP-007`; primary `AC-AUTO-017`, `AC-AUTO-018`, `AC-AUTO-043`                                                                                                                                                                                                                                                                                                                               |
| [06 Native C++ Modularization](06_native_cpp_modularization.md)                                                                 | Keep the filesystem guard as modular C++20 with RAII platform backends, CMake/GoogleTest, linting, sanitizers, CI, README, and repository rules.                                                                                                                                                                                                            | 04, 05                                     | `SEC-007`, `RUN-004`, `PKG-001`; supporting acceptance only, with final Windows evidence in Task 21                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [07 Framed Worker Supervisor](07_framed_worker_supervisor.md)                                                                   | Own strict framed stdio, authenticated launch, stage deadlines, and Linux/Windows process-tree termination without fallback or private argv data.                                                                                                                                                                                                           | 01, 03, 04, 06                             | `ARCH-003`, `ARCH-005`–`ARCH-006`, `RUN-001`–`RUN-005`, `SEC-005`, `SEC-007`, `PRIV-001`, `FAIL-005`, `FAIL-007`, `LIFE-001`; primary `AC-AUTO-024`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [08 Deterministic Native Source Objects And Toolchain Locks](08_deterministic_native_source_and_toolchain_locks.md)             | Establish canonical Whisper.cpp, nlohmann/json, and offline GoogleTest source objects, immutable source/license/patch identities, a reviewed loader-limit table, qualified disconnected Linux CPU/Clang-sanitizer/CUDA profiles, and exact Windows candidates.                                                                                              | 03, 04, 06                                 | `SEC-003`, `SEC-009`, `SEC-013`, `PKG-002`–`PKG-004`, `PKG-006`, `PKG-010`, `OPS-001`, `COMP-009`, support for `RUN-009`, `RUN-011`–`RUN-012`; primary `AC-AUTO-050`                                                                                                                                                                                                                                                                                                                                                                                                |
| [09 Shared Worker Protocol, Model Authority, And Lifecycle](09_shared_worker_protocol_model_authority_and_lifecycle.md)         | Complete one bounded TypeScript/C++ protocol with canonical grammar, WAV framing, probe/load split, authenticated model authority, proofs, terminal cleanup, and real GoogleTest suites consuming only Task-08 verified local inputs.                                                                                                                       | 01, 03, 04, 06, 07, 08                     | `ARCH-005`, `AUDIO-001`–`AUDIO-002`, `RUN-001`–`RUN-007`, `RUN-009`, `SEC-005`, `SEC-007`, `SEC-010`–`SEC-011`, `CAP-014`, `PRIV-001`, `PRIV-004`, `FAIL-005`, `FAIL-007`–`FAIL-008`; primary `AC-AUTO-053`, `AC-AUTO-054`, `AC-AUTO-056`                                                                                                                                                                                                                                                                                                                           |
| [10 Hardened Whisper.cpp Core And CPU Worker Pack](10_hardened_whisper_cpp_core_and_cpu_pack.md)                                | Atomically migrate the unreleased authority binding to authenticated artifact size/content evidence, then build a modular CPU-only worker and offline pack with slot-3 model access, exact-read loader hardening, bounded parsing, proof, inference, and exit unload.                                                                                       | 08, 09                                     | `RUNTIME-001`, `RUN-011`, `SEC-013`, `SCOPE-001`, `MODEL-004`, `ARCH-005`, `RUN-001`–`RUN-006`, `SEC-005`, `SEC-010`, `CAP-007`, `CAP-009`, `CAP-017`, `CPU-001`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-003`–`PKG-004`, `PKG-010`; primary `AC-AUTO-052`, `AC-AUTO-060`                                                                                                                                                                                                                                                                                           |
| [11 Whisper.cpp Device Proof, Cancellation, And CUDA Pack](11_whisper_cpp_device_proof_cancellation_and_cuda_pack.md)           | Add exact NVIDIA binding/proof, cooperative cancellation, and a Linux CUDA 12.8.1 Blackwell pack while rebuilding the CPU pack against the same patch.                                                                                                                                                                                                      | 08, 09, 10                                 | `RUN-012`, `CAP-017`, `RUNTIME-001`, `ARCH-005`, `RUN-001`–`RUN-006`, `SEC-005`, `SEC-010`, `SEC-013`, `CAP-007`, `CAP-009`, `CAP-014`, `NVIDIA-001`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-003`–`PKG-004`, `PKG-010`; primary `AC-AUTO-062`                                                                                                                                                                                                                                                                                                                      |
| [12 AMD Vulkan And Linux HIP Preview Packs](12_amd_vulkan_and_linux_hip_preview_packs.md)                                       | Define deterministic Windows/Linux Vulkan and Linux HIP Preview packs without fallback, invented hardware evidence, or an unreviewed HIP catalog row.                                                                                                                                                                                                       | 08, 09, 10, 11                             | `AMD-001`–`AMD-004`, `AMD-006`, `CAP-009`, `RUNTIME-001`, `RUN-001`–`RUN-003`, `RUN-005`, `SEC-003`, `SEC-005`, `SEC-013`, `CAP-007`, `CAP-017`, `FAIL-005`, `FAIL-007`–`FAIL-008`, `PKG-002`–`PKG-004`, `PKG-010`, `COMP-006`, `COMP-009`; primary `AC-AUTO-011`, `AC-AUTO-012`                                                                                                                                                                                                                                                                                    |
| [13 Single-Engine Cleanup And Contract Normalization](13_single_engine_cleanup_and_contract_normalization.md)                   | Remove active Faster-Whisper/CTranslate2/Python artifacts and normalize the unreleased Local Whisper domain, settings, catalogs, source locks, language mappings, AMD contracts, tests, and research to fixed `whisperCpp`.                                                                                                                                 | 01, 03, 08, 12                             | `SCOPE-001`, `MODEL-004`, `NONGOAL-004`, `ARCH-007`, `UI-003`, `SET-001`, `SET-004`–`SET-005`, `LIFE-004`, `PKG-010`; primary `AC-AUTO-063`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [14 Capability, Coordinator, Residency, And Lifecycle](14_capability_coordinator_residency_and_lifecycle.md)                    | Make one process-owned coordinator the sole mutable authority for settings, validation, snapshots, devices, artifacts, residency, activity, and worker lifecycle.                                                                                                                                                                                           | 02, 03, 05, 09, 10, 11, 12, 13             | `CAP-001`–`CAP-017`, `VRAM-001`–`VRAM-003`, `LIFE-001`–`LIFE-006`, `SET-004`, `SET-006`–`SET-007`, `VAL-001`, `VAL-003`, `ARCH-003`, `ARCH-006`, `CACHE-002`, `UI-005`–`UI-006`, `COMP-004`–`COMP-006`, `COMP-008`, `NVIDIA-001`, `CPU-001`, `AMD-001`–`AMD-004`, `AMD-006`, `MAC-001`–`MAC-003`, `FAIL-001`–`FAIL-002`, `FAIL-004`–`FAIL-008`, `RUNTIME-004`, `MODEL-008`, `NONGOAL-002`; primary `AC-AUTO-005`–`AC-AUTO-007`, `AC-AUTO-010`, `AC-AUTO-013`–`AC-AUTO-015`, `AC-AUTO-019`–`AC-AUTO-022`, `AC-AUTO-034`, `AC-AUTO-042`, `AC-AUTO-047`, `AC-AUTO-051` |
| [15 Protected IPC, Composition, And Provider Selection](15_protected_ipc_composition_and_provider_selection.md)                 | Construct the coordinator once and expose the protected provider, settings-window, and read-only main-status foundations later extended by Task 23 without reopening this completed packet.                                                                                                                                                                 | 01, 02, 03, 04, 05, 14                     | `ARCH-004`, base slices of `ARCH-010`, `IPC-001`–`IPC-003`, `SET-009`, `UI-008`, `SEC-001`–`SEC-002`, `SET-004`, `SET-006`–`SET-007`, `VAL-001`, `VAL-003`, `LIFE-004`–`LIFE-005`, `PRIV-002`, `DIAG-001`; primary `AC-AUTO-003`, `AC-AUTO-025`; supporting base sender/status coverage for amended `AC-AUTO-059`                                                                                                                                                                                                                                                   |
| [16 Local Whisper Settings And Status UI](16_local_whisper_settings_and_status_ui.md)                                           | Deliver the complete accessible provider settings/management experience, approximate and exact resource guidance, explicit load controls, and compact main-window status.                                                                                                                                                                                   | 01, 03, 05, 14, 15                         | `UI-001`–`UI-008`, `MODEL-001`, `MODEL-007`–`MODEL-010`, `RUNTIME-003`–`RUNTIME-004`, `SET-002`–`SET-009`, `VAL-001`–`VAL-003`, `VRAM-002`–`VRAM-003`, `CAP-001`, `CAP-008`–`CAP-013`, `LIFE-003`, `LIFE-005`–`LIFE-006`, `FAIL-001`–`FAIL-002`, `FAIL-004`, `FAIL-006`, `AMD-001`–`AMD-004`, `AMD-006`, `MAC-001`–`MAC-003`; primary `AC-AUTO-004`, `AC-AUTO-038`, `AC-AUTO-049`                                                                                                                                                                                   |
| [17 Signed-Envelope Packaging And Fixture CI](17_signed_envelope_packaging_and_fixture_ci.md)                                   | Add disabled/fixture/production signed-envelope modes, one generate-once Linux-consumed fixture, a non-triggered Windows consumer, and minimal base packaging.                                                                                                                                                                                              | 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13 | `PKG-001`–`PKG-006`, `PKG-008`–`PKG-010`, `SEC-003`, `SEC-008`–`SEC-009`, `SEC-012`–`SEC-013`, `OPS-001`, `RUNTIME-001`, `RUNTIME-003`, `MODEL-003`, `MODEL-009`–`MODEL-010`, `CAP-013`, `COMP-002`, `COMP-007`, `COMP-009`, `DL-001`–`DL-002`, `MAC-003`; primary `AC-AUTO-030`, `AC-AUTO-048`, `AC-AUTO-057`, `AC-AUTO-061`                                                                                                                                                                                                                                       |
| [18 Migration, Privacy, Diagnostics, Documentation, And macOS Skeleton](18_migration_privacy_diagnostics_and_macos_skeleton.md) | Close migrations, rollback guidance, private audit/diagnostics v2, docs, and an unreachable Planned/unavailable macOS arm64 skeleton.                                                                                                                                                                                                                       | 01–17                                      | `DIAG-001`–`DIAG-003`, `PRIV-001`–`PRIV-004`, `COMP-010`, `DOC-001`, `MAC-001`–`MAC-003`, `BASE-001`, `COMP-003`, `SET-001`, `SET-005`, `VAL-002`, `MODEL-010`, `CAP-013`, `UI-007`, `AMD-001`–`AMD-002`, `PKG-005`, `SEC-002`, `NONGOAL-001`–`NONGOAL-002`; primary `AC-AUTO-026`, `AC-AUTO-028`, `AC-AUTO-029`, `AC-AUTO-045`, `AC-AUTO-046`, `AC-AUTO-058`                                                                                                                                                                                                       |
| [19 Cross-Platform Implementation Readiness](19_cross_platform_implementation_readiness.md)                                     | Finish the static Windows/Linux CPU/CUDA implementation, add explicit non-packaged development activation, download/install all six exact models from Hugging Face through the normal Linux app, expose every model for CPU/CUDA selection, and pass bounded `base/full` CPU/CUDA application smoke while qualification stays Pending.                      | 01–18                                      | `DEV-001`, `SEC-015`, `IMPL-001`–`IMPL-002`, `DL-004`–`DL-005`, `MODEL-001`–`MODEL-002`, `MODEL-005`, `ARCH-010`, `COMP-012`, `DIST-001`–`DIST-002`, `MODEL-011`, `PKG-011`, `SEC-014`, `REL-001`, `QUAL-001`–`QUAL-004`, `PRIV-005`, `OPS-002`–`OPS-003`; applicable prior implementation requirements; primary `AC-AUTO-064`–`AC-AUTO-070`, `AC-AUTO-072`–`AC-AUTO-075`; manual `AC-MAN-015`                                                                                                                                                                      |
| [23 Main-Window Local Whisper Residency Control](23_main_window_residency_control.md)                                           | Add the active-provider-only Load/Free model control through a separate closed main command, exact sender/provider/revision/action gates, sanitized revision-aware UI, and switch-during-pending conflict behavior.                                                                                                                                         | 15, 16, 19                                 | `ARCH-011`, `IPC-004`, `UI-009`, `LIFE-007`, `SEC-016`; revision-15 slices of `ARCH-010`, `IPC-003`, `UI-008`, `FAIL-004`; primary `AC-AUTO-059`, `AC-AUTO-076`, `AC-AUTO-077`; manual `AC-MAN-016`                                                                                                                                                                                                                                                                                                                                                                 |
| [20 Linux Qualification Preparation](20_linux_qualification.md)                                                                 | On Linux, validate candidate-independent qualification tooling, input materialization, host/toolchain readiness, and deterministic checks without freezing or adopting evidence.                                                                                                                                                                            | 19, 23                                     | Candidate-independent preparation for Linux slices of `REL-001`, `COMP-012`, `MODEL-011`, `QUAL-001`–`QUAL-004`, `PRIV-005`, and `OPS-003`; no primary-owner change, qualification identity, or verdict                                                                                                                                                                                                                                                                                                                                                             |
| [24 Windows Runtime Delivery Readiness](24_windows_runtime_delivery_readiness.md)                                               | Build deterministic Windows CPU and RTX 50 `sm_120a` workers/runtime packs with MSVC 14.39 and the separately pinned Microsoft VC Runtime 14.51.36247.0 closure, extend authenticated development activation and package validation to Windows, and pass bounded ordinary-app CPU/RTX 5090 smoke after Task 20 preparation but before any candidate freeze. | 19, 20, 23                                 | Windows `sm_120a` readiness slices of `IMPL-001`–`IMPL-002`, `COMP-004`, `COMP-008`, `COMP-012`, `CPU-001`, `DIST-001`–`DIST-002`, `PKG-002`–`PKG-005`, `PKG-009`–`PKG-011`, `SEC-008`, `SEC-011`, `SEC-014`–`SEC-015`, `DEV-001`, `MODEL-011`, `QUAL-004`, `OPS-003`; supporting existing automated/manual acceptance only; it owns neither `sm_86`/`sm_89` delivery nor qualification evidence.                                                                                                                                                                   |
| [25 RTX 50 Readiness Closure](25_rtx50_readiness_closure.md)                                                                    | Close cross-platform pre-install inventory, exact `sm_120a-real` applicability, catalog, migration, renderer filtering, and fail-closed negative fixtures without freezing a candidate.                                                                                                                                                                     | 19, 20, 23, 24                             | `CAP-018`, `COMP-013`, `DIST-003`, `PRIV-006`, `RUNTIME-005`, `UI-010`, `VAL-004`, `QUAL-005`–`QUAL-006`, `OPS-004`; primary `AC-AUTO-078`, `AC-AUTO-079`, `AC-AUTO-081`                                                                                                                                                                                                                                                                                                                                                                                            |
| [27 Hosted Production-Equivalent CI Builders](27_hosted_production_equivalent_ci.md)                                            | Build and verify Linux/Windows applications plus CPU/RTX 50 packs in read-only hosted CI with reproducibility, disconnected-build, permission, and no-publication guarantees.                                                                                                                                                                               | 25                                         | `CI-001`–`CI-003`; build slices of `PKG-002`–`PKG-004`, `PKG-009`–`PKG-010`, `SEC-003`, `REL-002`; primary `AC-AUTO-083`–`AC-AUTO-084`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [30 Release Branch Preparation And Pull Request Policy](30_release_branch_preparation_and_pr_policy.md)                         | Implement canonical committed version/changelog/manual-registry preparation, deterministic exact-head identity, read-only `release/v<SemVer>` PR checks, and repository merge-commit-only policy verification without creating a release attempt.                                                                                                           | 25, 27                                     | Preparation slices of `CI-004`, `CI-008`, `QUAL-004`, `REL-002`; primary `AC-AUTO-085`; supporting `AC-MAN-014`, `AC-MAN-019`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [28 Protected Signed Release Candidates](28_protected_signed_release_candidates.md)                                             | Consume one exact Task 30-qualified release PR head and freeze its complete natively signed six-output candidate generation and signed release manifest without merging, tagging, uploading, or publishing.                                                                                                                                                 | 27, 30                                     | Candidate/signing slices of `CI-004`–`CI-008`, `DIST-004`, `PKG-011`–`PKG-012`, `SEC-014`, `REL-002`; primary `AC-AUTO-086`–`AC-AUTO-089`; supporting `AC-AUTO-085`, `AC-MAN-014`, `AC-MAN-019`                                                                                                                                                                                                                                                                                                                                                                     |
| [29 Linux RTX 50 Qualification](29_linux_rtx50_qualification.md)                                                                | Consume Task 30/28 exact release head and Linux candidates, freeze the shared/Linux graph, and execute all-six-model CPU/RTX 50 package, transport, parity, resource, lifecycle, privacy, offline, cleanup, and predecessor qualification before merge.                                                                                                     | 20, 25, 27, 30, 28                         | Linux `REL-001`, `COMP-012`, `MODEL-011`, `QUAL-001`–`QUAL-005`, `PRIV-005`–`PRIV-006`, `OPS-003`–`OPS-004`; Linux `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, `AC-MAN-013`, `AC-MAN-017`; support for `AC-AUTO-080`, `AC-AUTO-082`, `AC-AUTO-087`, `AC-MAN-014`                                                                                                                                                                                                                                                                                         |
| [21 Windows RTX 50 Qualification](21_windows_qualification.md)                                                                  | Consume the same exact release head/Windows candidates plus Task 29 unchanged shared/Linux branch, then execute and seal the all-six-model Windows CPU/RTX 50 branch before merge.                                                                                                                                                                          | 24, 25, 27, 30, 28, 29                     | Windows `REL-001`, `COMP-012`–`COMP-013`, `MODEL-011`, `QUAL-001`–`QUAL-006`, `PRIV-005`–`PRIV-006`, `OPS-003`–`OPS-004`; Windows `AC-MAN-002`–`AC-MAN-008`, `AC-MAN-013`, `AC-MAN-018`; support for `AC-AUTO-080`, `AC-AUTO-082`, `AC-AUTO-087`, `AC-MAN-014`                                                                                                                                                                                                                                                                                                      |
| [22 Aggregate Production Readiness And Release Delivery](22_aggregate_and_release_blockers.md)                                  | Seal pre-merge aggregate readiness for the exact release PR, verify its separately authorized preserving merge, and only under later tag/release authorizations tag the qualified head and non-clobberingly stage, verify, and publish its exact assets.                                                                                                    | 21, 28, 29, 30                             | Aggregate `REL-001`–`REL-002`, `CI-004`, `CI-007`–`CI-008`, `DIST-001`–`DIST-004`, `PKG-011`–`PKG-012`, `SEC-014`, `COMP-012`–`COMP-013`, `QUAL-001`–`QUAL-006`, `OPS-002`–`OPS-004`; primary `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`, `AC-AUTO-071`, `AC-AUTO-082`, `AC-AUTO-090`; support for Task 30-primary `AC-AUTO-085`; reconciliation through `AC-MAN-019`                                                                                                                                                                               |
| [26 Deferred RTX 30/40 CUDA Runtime Expansion](26_hardware_matched_nvidia_cuda_runtime_expansion.md)                            | Preserve postponed RTX 30/40 intent as non-executable future work requiring a new approved specification and plan revision.                                                                                                                                                                                                                                 | Deferred · no active dependencies          | No active revision-20 requirement, acceptance owner, verification command, qualification gate, or support claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## Sequencing

```text
completed and committed: 01–20, 23, 24
planned next after plan approval and separate execution authorization: 25
deferred outside the active chain: 26 (RTX 30/40; non-executable)

25 -> 27 -> 30 -> 28 -> 29 -> 21 -> 22
```

- Tasks 01–20, 23, and 24 remain completed foundations and are not reopened.
- Task 25 closes only the remaining RTX 50 applicability implementation gap;
  it creates no candidate or qualification identity.
- Task 27 adds the six production-equivalent hosted build classes under
  read-only non-production CI and hands one unchanged builder contract to the
  protected workflow.
- Task 30 adds canonical committed package/changelog/manual-registry
  preparation, generated identity, read-only `release/v<SemVer>` PR checks,
  and verification that repository settings allow merge commits only. It
  creates no branch, commit, PR, or release attempt.
- Task 28 consumes the exact Task 30-qualified release PR head and uses the
  unchanged Task 27 builder contract inside the protected environment to freeze
  final signed application/runtime candidates and the signed release manifest.
  It merges, tags, uploads, and publishes nothing.
- Task 29 consumes exact Task 28 Linux bytes and creates the shared candidate
  plus Linux branch. Task 21 then adds only the Windows branch against the same
  signed generation.
- Task 22 seals a required aggregate pre-merge status, verifies the separately
  authorized merge preserved the exact qualified head, and implements protected
  post-merge tagging plus exact non-clobbering release delivery. Repository
  setting mutation, merge, tag, upload/publication, and clean release installs
  remain separately authorized manual gates.
- Task 26 remains deferred, non-executable, and absent from all dependencies,
  commands, evidence, and support claims.

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
- Task 20 and Task 24 readiness evidence remains advisory until the final
  source/candidates are frozen. Missing Task 25 readiness or Task 27 hosted
  build evidence blocks Task 30. Missing Task 30 release preparation blocks
  Task 28. Missing Task 29 Linux or Task 21 Windows qualification blocks Task
  22 pre-merge readiness. Mocks, Wine,
  cross-compilation, the other platform, and compile-only CI cannot substitute
  for representative evidence.

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
  Missing active CPU or RTX 50 platform qualification results remain `Pending`;
  RTX 30/40 are excluded rather than Pending, and functional smoke is not
  Production evidence.
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
- `TASK 20 LINUX PREFLIGHT`: first, prepare and test candidate-independent Linux
  qualification tooling, exact input verification/materialization, and host/
  toolchain readiness. Do not freeze or adopt a candidate or evidence branch.
- `TASK 24 WINDOWS READINESS`: after Task 20's preflight and before Task 25
  freezes the shared candidate,
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
- `TASK 25 RTX 50 READINESS`: before candidate freeze, implement and validate
  the main-owned bounded shell-free Linux/Windows NVIDIA pre-install inventory,
  exact RTX 50 `sm_120a-real` applicability, safe saved-selection behavior,
  one active CUDA catalog row per platform, renderer-safe filtering, and
  negative `sm_86`/`sm_89`/malformed/ambiguous/cross-platform fixtures. No raw
  hardware identity or out-of-scope action crosses IPC.
- `TASK 27 HOSTED BUILDERS`: build all six production-equivalent output classes
  on hosted Linux/Windows runners under read-only non-production authority.
  CI artifacts are short-lived qualification inputs, never installation
  origins; no physical GPU or production secret is used.
- `TASK 30 RELEASE PREPARATION`: implement non-mutating committed version/
  changelog/manual-registry validation, deterministic release identity, and
  read-only `release/v<SemVer>` pull-request policy. The committed package
  version is canonical and derives `v<SemVer>`. Repository settings must enable
  merge commits and disable squash/rebase repository-wide, but Task 30 only
  verifies them; changing them is a separate manual gate.
- `MANUAL GATE — release branch and pull request`: after Task 30 is committed,
  separately create `release/v2.4.0`, complete and commit `package.json`,
  `package-lock.json`, changelog, catalog/version inputs, and manual-script
  review, push the branch, and open its pull request into current `main`. These
  actions and repository-setting mutation are never implied by packet approval.
- `TASK 28 PROTECTED CANDIDATES`: required reviewers, signing/legal/
  redistribution inputs, exact Task 30 preparation/head, committed SemVer/
  expected tag, and protected environment are manual prerequisites. Freeze
  native-signed application candidates, four signed runtime packs, production
  catalogs, and one signed release manifest. Do not merge, tag, upload, or
  publish.
- `TASK 29 LINUX QUALIFICATION`: consume exact Task 28 bytes, revalidate Task 20
  preparation and unchanged release PR head, freeze the shared/Linux graph,
  and run the complete Linux CPU/RTX 50 qualification before merge.
  Qualification loopback transport and final signed production-package
  evidence remain distinct and bind the same runtime bytes.
- `MANUAL GATE — prior binary`: determine the highest stable release before
  freeze. If no later stable exists, Task 29 uses
  `GPT-Voice-2.3.0.AppImage` SHA-256
  `80674b3a90222b51981fb43b5b757b7af9d3e38a5ff4ca41554ab965ae29f111`
  and Task 21 uses `GPT-Voice.Setup.2.3.0.exe` SHA-256
  `0e2aa1ea97ba357db6d35f53debd01ca1c6124ae10b9f537b2af4427a0328cd0`.
  Task 22 reconciles both; a current-code fixture is not evidence.
- `TASK 22 PRE-MERGE AND RELEASE GATES`: seal the required aggregate status on
  the unchanged release PR head first. Exact merge-commit mode is a separate
  maintainer action after authorization. Task 22 then verifies ancestry; final
  tag creation on the qualified head, GitHub Release draft creation, asset
  upload, canonical-origin verification, publication, clean release
  installation, support promotion, and release are further external manual
  gates. Each action needs its own explicit authorization.
- AMD remains `Preview · Untested`. Promotion requires representative physical
  AMD evidence in future approved work.
- macOS remains Planned/unavailable. Task 18 contains no executable Local
  Whisper path; Apple Silicon/Metal/Core ML and signing/notarization require a
  new approved specification and plan.

## Non-Executable Follow-Up Backlog

- [Task 26](26_hardware_matched_nvidia_cuda_runtime_expansion.md) retains RTX
  30/40 CUDA delivery as deferred, non-executable future work. It requires a
  new approved specification and plan revision before implementation.
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

Revision 26 is Approved and reconciles approved specification revision 20. It
preserves completed work, keeps Tasks 25/27 unchanged, adds Task 30 release
preparation, revises Tasks 28/29/21 for one unchanged pre-merge release head,
assigns aggregate pre-merge readiness plus preserving-merge/tag/delivery policy
to Task 22, and retains Task 26 only as deferred RTX 30/40 future work.

Plan approval authorizes no new packet execution, application launch, hardware
use, commit, push, pull request, repository-setting change, candidate freeze,
qualification, private signing, merge, tag, upload, publication, support
promotion, or release. The existing separate Task 25 authorization remains
valid because its packet scope is unchanged; each later active packet requires
its own incremental-implementation authorization. Each invocation executes
exactly one packet, updates `todo.md` and `handoff.md`, and stops before
committing that packet or opening the next one.
