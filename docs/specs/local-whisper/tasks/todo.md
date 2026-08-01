# Todo: Local Whisper

Plan gate: revision 3 is approved with native C++ modularization as Task 06 and
future non-release-blocking hardening as Task 18. Tasks 01, 02, and 03 are
committed as `d008325`, `d516d03`, and `14749e8`; Task 04 is committed as
`649ec3b9`. Task 05 was authorized through `execution.task-05` revision 1 and is
complete, verified, and included in its authorized isolated implementation
commit after plan revision commit `a239274`. Task 06 still requires explicit
execution authorization.

- [x] [01 Shared domain contracts](01_shared_domain_contracts.md)
- [x] [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md)
- [x] [03 Trusted catalog, settings, and inventory](03_trusted_catalog_settings_and_inventory.md)
- [x] [04 Managed filesystem safety](04_managed_filesystem_safety.md)
- [x] [05 Streaming artifact lifecycle](05_streaming_artifact_lifecycle.md)
- [ ] [06 Native C++ modularization](06_native_cpp_modularization.md)
- [ ] [07 Framed worker supervisor](07_framed_worker_supervisor.md)
- [ ] [08 Hardened whisper.cpp runtime](08_hardened_whisper_cpp_runtime.md)
- [ ] [09 Isolated Faster-Whisper runtime](09_isolated_faster_whisper_runtime.md)
- [ ] [10 Current-device capability validation](10_device_capability_validation.md)
- [ ] [11 Coordinator, residency, and lifecycle](11_coordinator_residency_and_lifecycle.md)
- [ ] [12 Protected IPC and settings service](12_protected_ipc_and_settings_service.md)
- [ ] [13 Provider settings UI](13_provider_settings_ui.md)
- [ ] [14 Artifact, capability, and residency UI](14_artifact_capability_and_residency_ui.md)
- [ ] [15 Packaging and signed fixture pipeline](15_packaging_and_signed_fixture_pipeline.md)
- [ ] [16 Migration, privacy, diagnostics, and docs](16_migration_privacy_diagnostics_and_docs.md)
- [ ] [17 Integration and qualification gates](17_integration_and_qualification_gates.md)
- [ ] [18 Future native hardening and macOS readiness](18_future_native_hardening_and_macos_readiness.md)
