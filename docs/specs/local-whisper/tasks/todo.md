# Local Whisper Task Checklist

Plan revision: **12 (Approved)**

Specification baseline: **revision 7 (Approved)**

Execution state: Tasks 01–16 are complete, committed, and authoritative. Task
17 is complete and uncommitted for review. Remote CI was not run and will
execute only after a pull request is created. Representative Windows execution
remains deferred exclusively to Task 19.

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
- [x] [17 Signed-Envelope Packaging And Fixture CI](17_signed_envelope_packaging_and_fixture_ci.md) — complete, uncommitted
- [ ] [18 Migration, Privacy, Diagnostics, Documentation, And macOS Skeleton](18_migration_privacy_diagnostics_and_macos_skeleton.md)
- [ ] [19 Integration And Qualification Gates](19_integration_and_qualification_gates.md)

Task 08 is committed at `e3639bcc`. Task 09 is committed at `2b920b0`, with
its native-runner CI boundary committed at `b18700e`. Task 10 and the approved
revision-11 authority repair are committed at `f3fe677`. The Windows
native-quality job remains on a Windows runner and owns CPU/CUDA contract-only
checks; it was not executed. Tasks 11 and 12 are committed at `24e268f` and
`916f0d9`. Task 13 is committed at `37fa79a`, and Task 14 is committed at
`df14c118`. Task 15 is committed at `b89a412`, with its verification tooling at
`d8ab1ba`. Task 16 is committed and pushed at `f9befc17`. Task 17 is complete
and uncommitted. No pull request, publication, or release has occurred.
