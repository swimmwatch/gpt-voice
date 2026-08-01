# Todo: Local Whisper

Plan revision 7 is committed as `195fb076`. Under
`planning.native-cpp-windows-gate` revision 2, all representative Windows
checks execute only in Task 17 and remain mandatory before release. Task 07 is
committed as `31c13c54`. Task 08 execution is authorized by
`execution.task-08` revision 1 but is blocked before production changes by the
missing main-to-worker native device-selector contract. Task 09, commit, push,
pull request, packaging, publication, and release are not authorized.

- [x] [01 Shared domain contracts](01_shared_domain_contracts.md)
- [x] [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md)
- [x] [03 Trusted catalog, settings, and inventory](03_trusted_catalog_settings_and_inventory.md)
- [x] [04 Managed filesystem safety](04_managed_filesystem_safety.md)
- [x] [05 Streaming artifact lifecycle](05_streaming_artifact_lifecycle.md)
- [x] [06 Native C++ modularization](06_native_cpp_modularization.md)
- [x] [07 Framed worker supervisor](07_framed_worker_supervisor.md)
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
