# Local Whisper Performance Remediation Todo

- Plan status: Approved revision 9 on 2026-08-18
- Execution status: Packets 01–16 and 18 are complete. Former Packet 17 was removed by approved revision 9. No
  executable packet remains.

- [x] [01 Qualification contract and baseline](01_qualification_contract_and_baseline.md)
- [x] [02 Launch-lease directory-result reuse](02_launch_lease_directory_result_reuse.md)
- [x] [03 Runtime SHA-256 dispatch](03_runtime_sha256_dispatch.md)
- [x] [04 Filesystem-guard protocol-v2 codec](04_fs_guard_protocol_v2_codec.md)
- [x] [05 Bounded installation pipeline](05_bounded_installation_pipeline.md)
- [x] [06 Worker warm-up and log ordering](06_worker_warmup_and_log_ordering.md)
- [x] [07 WAV buffer lifetime](07_wav_buffer_lifetime.md)
- [x] [08 Settings schema-v2 migration](08_settings_schema_v2_migration.md)
- [x] [09 GPU thread runtime identity](09_gpu_thread_runtime_identity.md)
- [x] [10 GPU thread renderer controls](10_gpu_thread_renderer_controls.md)
- [x] [11 Windows backend-profile parity](11_windows_backend_profile_parity.md)
- [x] [12 Cross-platform integration and documentation](12_cross_platform_integration_and_docs.md)
- [x] [13 Representative performance collection](13_representative_performance_collection.md)
- [x] [14 Performance attempt contract and derivation](14_performance_attempt_contract_and_derivation.md)
- [x] [15 Linux performance attempt runner](15_linux_performance_attempt_runner.md)
- [x] [16 Shared/Linux standard-loader implementation](16_representative_linux_host_qualification.md)
- [x] [18 Windows functional parity](18_windows_final_remediation.md) — implement Windows behavior matching Linux,
      then run one CPU and one CUDA Local Whisper development flow and verify model loading, recording, and
      transcription; no benchmarks, CI, package qualification, repeated samples, or additional checks
