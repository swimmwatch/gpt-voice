# Local Whisper Task Checklist

Plan revision: **16 (Approved)**

Specification baseline: **revision 10 (Approved)**

Execution state: Tasks 01–18 are complete, committed, and authoritative. Task 19
remains in progress, with its current implementation checkpoint committed as
`3e735853`, `a946c91f`, `f548be15`, `6baa7d1b`, and `f8131c73`.
Deterministic CPU/CUDA direct-engine and runtime-pack bytes pass two-clean-root
network-denied reproducibility. Approved
specification revision 10 replaces the circular digest graph with a shared
candidate input, independent Linux/Windows platform branches, and Task 21
aggregate root. Task 19 requires fresh execution authorization before it resumes; no
shared candidate, platform input/profile/graph, result, evidence index, or
aggregate root is frozen. Production private keys, legal approval, final
GitHub upload, and release authority remain Task 21. Exact Windows inputs and
representative Windows execution remain exclusively Task 20.

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
- [ ] [19 Linux Production Pipeline And Qualification](19_linux_qualification.md)
- [ ] [20 Windows Qualification](20_windows_qualification.md)
- [ ] [21 Aggregate Production Readiness And Release Blockers](21_aggregate_and_release_blockers.md)

Task 08 is committed at `e3639bcc`. Task 09 is committed at `2b920b0`, with
its native-runner CI boundary committed at `b18700e`. Task 10 and the approved
revision-11 authority repair are committed at `f3fe677`. The Windows
native-quality job remains on a Windows runner and owns CPU/CUDA contract-only
checks; it was not executed. Tasks 11 and 12 are committed at `24e268f` and
`916f0d9`. Task 13 is committed at `37fa79a`, and Task 14 is committed at
`df14c118`. Task 15 is committed at `b89a412`, with its verification tooling at
`d8ab1ba`. Task 16 is committed and pushed at `f9befc17`, Task 17 is committed
at `b9c3e3b`, and Task 18 is committed at `16b32ca`. Specification revision 10
and plan revision 16 are durably approved. Task 19 routes Linux and Windows
startup through the production environment factory while preserving the
explicit macOS skeleton. The current Linux state remains `FailClosed` because
no qualification candidate is packaged; shared/Linux graph freeze is
`Pending`, no Windows branch exists, and representative Windows execution is
`NotRun`. The archive and
model formats, public model origin, predecessor rule, qualification trust, and
Linux/Windows/aggregate completion boundaries are no longer unresolved. Task
19 remains unchecked until the approved technical pipeline is implemented and
the full Linux CPU/CUDA/model/transport/resource/privacy/predecessor evidence is
frozen. Every packet requires separate execution authorization. No pull
request, production signing, upload, publication, or release has occurred.
