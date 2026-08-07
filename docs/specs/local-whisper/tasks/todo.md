# Local Whisper Task Checklist

Plan revision: **26 (Approved)**

Specification baseline: **revision 20 (Approved)**

Execution state: Tasks 01–19 are complete and committed. Task 23 implementation,
Large v3 Turbo Q5_0 compatibility and load-path follow-up fixes, automated
verification, and the authorized CPU/CUDA `AC-MAN-016` smoke are complete and
committed. Task 20 Linux Qualification Preparation completed its authorized
local deterministic preflight without freezing or adopting qualification
evidence. Task 24 Windows Runtime Delivery Readiness was committed and pushed
as `7ebb102`; its provider-selection, CUDA-runtime acquisition, transfer-journal
performance, recoverable-transcription state, and automatic-language native
transcription follow-up is complete and included in the authorized review
commit. Deterministic Windows CPU and RTX 50
`sm_120a` packs, native helpers, development activation, unpacked packaging,
and bounded ordinary-app CPU/RTX 5090 smoke passed without creating Production
evidence. Task 25 RTX 50 Readiness Closure is complete:
deterministic inventory, applicability, catalog, migration, renderer-projection,
and acquisition-guard checks passed without physical-host or qualification
evidence. Tasks 27, 30, 28, 29, 21, and 22 remain unstarted. Task 26 is
retained only as deferred, non-executable RTX 30/40 future work.

- [x] [01 Shared Local Whisper Domain Contracts](01_shared_domain_contracts.md) — `d0083259`
- [x] [02 Provider Dispatch And Cache Seam](02_provider_dispatch_and_cache.md) — `d516d034`
- [x] [03 Trusted Catalog, Settings, And Inventory](03_trusted_catalog_settings_and_inventory.md) — `14749e88`
- [x] [04 Managed Filesystem Safety](04_managed_filesystem_safety.md) — `649ec3b9`
- [x] [05 Streaming Artifact Lifecycle](05_streaming_artifact_lifecycle.md) — `32440674`
- [x] [06 Native C++ Modularization](06_native_cpp_modularization.md) — `e294e8a`
- [x] [07 Framed Worker Supervisor](07_framed_worker_supervisor.md) — `31c13c54`
- [x] [08 Deterministic Native Source Objects And Toolchain Locks](08_deterministic_native_source_and_toolchain_locks.md) — `e3639bcc`
- [x] [09 Shared Worker Protocol, Model Authority, And Lifecycle](09_shared_worker_protocol_model_authority_and_lifecycle.md) — `2b920b0`, CI `b18700e`
- [x] [10 Hardened Whisper.cpp Core And CPU Worker Pack](10_hardened_whisper_cpp_core_and_cpu_pack.md) — `f3fe677`
- [x] [11 Whisper.cpp Device Proof, Cancellation, And CUDA Pack](11_whisper_cpp_device_proof_cancellation_and_cuda_pack.md) — `24e268f`
- [x] [12 AMD Vulkan And Linux HIP Preview Packs](12_amd_vulkan_and_linux_hip_preview_packs.md) — `916f0d9`
- [x] [13 Single-Engine Cleanup And Contract Normalization](13_single_engine_cleanup_and_contract_normalization.md) — `37fa79a`
- [x] [14 Capability, Coordinator, Residency, And Lifecycle](14_capability_coordinator_residency_and_lifecycle.md) — `df14c118`
- [x] [15 Protected IPC, Composition, And Provider Selection](15_protected_ipc_composition_and_provider_selection.md) — `b89a412`, verification `d8ab1ba`
- [x] [16 Local Whisper Settings And Status UI](16_local_whisper_settings_and_status_ui.md) — `f9befc17`
- [x] [17 Signed-Envelope Packaging And Fixture CI](17_signed_envelope_packaging_and_fixture_ci.md) — `b9c3e3b`
- [x] [18 Migration, Privacy, Diagnostics, Documentation, And macOS Skeleton](18_migration_privacy_diagnostics_and_macos_skeleton.md) — `16b32ca`
- [x] [19 Cross-Platform Implementation Readiness](19_cross_platform_implementation_readiness.md) — `b8941279`, Fedora fix `caaecaed`, handoff `4bcd21fa`
- [x] [23 Main-Window Local Whisper Residency Control](23_main_window_residency_control.md) — `043aba8`, Q5_0 fix `b48877d`, load optimization `a4a0a2a`
- [x] [20 Linux Qualification Preparation](20_linux_qualification.md) — advisory local deterministic preflight; reconciliation completed against the clean `b796c46f` checkout, with no Task 20 delta to commit
- [x] [24 Windows Runtime Delivery Readiness](24_windows_runtime_delivery_readiness.md) — baseline pushed as `7ebb102`; provider-selection, CUDA-runtime acquisition, transfer-journal performance, recoverable-transcription state, and automatic-language native transcription follow-up included in the authorized review commit; CPU/RTX 5090 `sm_120a` readiness smoke passed, with no Production claim
- [x] [25 RTX 50 Readiness Closure](25_rtx50_readiness_closure.md) — deterministic verification passed
- [ ] [27 Hosted Production-Equivalent CI Builders](27_hosted_production_equivalent_ci.md)
- [ ] [30 Release Branch Preparation And Pull Request Policy](30_release_branch_preparation_and_pr_policy.md)
- [ ] [28 Protected Signed Release Candidates](28_protected_signed_release_candidates.md)
- [ ] [29 Linux RTX 50 Qualification](29_linux_rtx50_qualification.md)
- [ ] [21 Windows RTX 50 Qualification](21_windows_qualification.md)
- [ ] [22 Aggregate Production Readiness And Release Delivery](22_aggregate_and_release_blockers.md)
- [ ] [26 Deferred RTX 30/40 CUDA Runtime Expansion](26_hardware_matched_nvidia_cuda_runtime_expansion.md) — **Deferred · Non-executable**; not part of the active sequence or release gate

No final signed candidate, `candidateInputDigest`, Linux/Windows branch,
aggregate root, GitHub Release asset, or publication exists. The interrupted
private Linux run is non-authoritative and must not be adopted. Candidate SemVer
input remains `2.4.0`; the Task 17 fixture digest remains
`de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
AMD remains **Preview · Untested** and macOS remains
**Planned · Unavailable**. Task 20's network/model/corpus/hardware checks were
not authorized and remain pending manual gates. Task 24's scoped Windows
host/network/application/unpacked-package gates passed without qualification
evidence. The active sequence is Task 25 → 27 → 30 → 28 → 29 → 21 → 22. Task
30 implements release preparation policy but creates no branch or PR. RTX 30/40
checks are excluded rather than Pending. Task 27 is the next packet and requires
its own incremental-implementation authorization. Every later packet and any
commit, push, release branch/PR,
repository merge-setting change, production secret, signing, qualification,
merge, tag, upload, publication, support promotion, or release require their
own authority.
