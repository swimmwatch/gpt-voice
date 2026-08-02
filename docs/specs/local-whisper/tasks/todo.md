# Local Whisper Task Checklist

Plan revision: **10 (Approved)**

Specification baseline: **revision 6 (Approved)**

Execution state: Tasks 01–09 are complete, committed, and authoritative. Repaired plan
revision 10 is approved by `approval.plan-revision-10` (sequence 43, revision
1). Task 09 is authorized by `execution.task-09-revision-10` (sequence 47,
revision 1). On 2026-08-02 the user authorized dependency acquisition and Codex
self-review; all mandatory local Task 09 gates passed. Remote CI was not run and
will execute only after a pull request is created.

- [x] [01 Shared Local Whisper Domain Contracts](01_shared_domain_contracts.md) — `d0083259`
- [x] [02 Provider Dispatch And Cache Seam](02_provider_dispatch_and_cache.md) — `d516d034`
- [x] [03 Trusted Catalog, Settings, And Inventory](03_trusted_catalog_settings_and_inventory.md) — `14749e88`
- [x] [04 Managed Filesystem Safety](04_managed_filesystem_safety.md) — `649ec3b9`
- [x] [05 Streaming Artifact Lifecycle](05_streaming_artifact_lifecycle.md) — `32440674`
- [x] [06 Native C++ Modularization](06_native_cpp_modularization.md) — `e294e8a`
- [x] [07 Framed Worker Supervisor](07_framed_worker_supervisor.md) — `31c13c54`
- [x] [08 Deterministic Native Source Objects And Toolchain Locks](08_deterministic_native_source_and_toolchain_locks.md) — `e3639bcc`
- [x] [09 Shared Worker Protocol, Model Authority, And Lifecycle](09_shared_worker_protocol_model_authority_and_lifecycle.md) — `2b920b0`, CI `b18700e`
- [ ] [10 Hardened Whisper.cpp Core And CPU Worker Pack](10_hardened_whisper_cpp_core_and_cpu_pack.md)
- [ ] [11 Whisper.cpp Device Proof, Cancellation, And CUDA Pack](11_whisper_cpp_device_proof_cancellation_and_cuda_pack.md)
- [ ] [12 AMD Vulkan And Linux HIP Preview Packs](12_amd_vulkan_and_linux_hip_preview_packs.md)
- [ ] [13 Isolated Faster-Whisper/CTranslate2 Worker And Packs](13_isolated_faster_whisper_ctranslate2_worker_and_packs.md)
- [ ] [14 Capability, Coordinator, Residency, And Lifecycle](14_capability_coordinator_residency_and_lifecycle.md)
- [ ] [15 Protected IPC, Composition, And Provider Selection](15_protected_ipc_composition_and_provider_selection.md)
- [ ] [16 Local Whisper Settings And Status UI](16_local_whisper_settings_and_status_ui.md)
- [ ] [17 Signed-Envelope Packaging And Fixture CI](17_signed_envelope_packaging_and_fixture_ci.md)
- [ ] [18 Migration, Privacy, Diagnostics, Documentation, And macOS Skeleton](18_migration_privacy_diagnostics_and_macos_skeleton.md)
- [ ] [19 Integration And Qualification Gates](19_integration_and_qualification_gates.md)

Task 08 is committed at `e3639bcc`. Task 09 is committed at `2b920b0`, with
its native-runner CI boundary committed at `b18700e`: its
protocol, vectors, supervisor, cross-language native common library, Linux
model-authority handoff, Clang formatting/tidy gates, and locked CI source
provisioning pass locally. The Windows native-quality job remains on a Windows
runner and was not executed. No Task 10 work, commit, push, pull request, or
publication has occurred.
