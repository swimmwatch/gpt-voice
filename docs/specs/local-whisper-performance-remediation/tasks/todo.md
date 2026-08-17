# Local Whisper Performance Remediation Todo

- Plan status: Approved revision 8 on 2026-08-16
- Execution status: Packets 01–16 are locally complete. Packet 03 is pushed with CI deliberately uninspected;
  Packets 04–16 remain unpushed. Packet 16 is committed locally as `0428b76`. Packet 17's candidate-only
  tooling is locally implemented and verified, but its representative Linux manual gates remain pending; Packet
  18 has not started.

- [x] [01 Qualification contract and baseline](01_qualification_contract_and_baseline.md) — implementation
      `8a808757`, fix `d243899f`; required final-SHA CI passed
- [x] [02 Launch-lease directory-result reuse](02_launch_lease_directory_result_reuse.md) — `db85c43e`;
      required final-SHA CI passed
- [x] [03 Runtime SHA-256 dispatch](03_runtime_sha256_dispatch.md) — implementation `f0a199ed`, ledger
      `a39d10dc`; pushed, CI inspection deferred
- [x] [04 Filesystem-guard protocol-v2 codec](04_fs_guard_protocol_v2_codec.md) — `141ae5bf`; local checks passed
- [x] [05 Bounded installation pipeline](05_bounded_installation_pipeline.md) — implementation `bc8ba18f`,
      source-baseline fix `20260098`; local checks passed
- [x] [06 Worker warm-up and log ordering](06_worker_warmup_and_log_ordering.md) — implementation `e063c0d`,
      TSan registration `e66115d`; local checks passed
- [x] [07 WAV buffer lifetime](07_wav_buffer_lifetime.md) — `80cea99`; local checks passed
- [x] [08 Settings schema-v2 migration](08_settings_schema_v2_migration.md) — `b20e28bf`; local checks passed
- [x] [09 GPU thread runtime identity](09_gpu_thread_runtime_identity.md) — `c1aba25`; local checks passed
- [x] [10 GPU thread renderer controls](10_gpu_thread_renderer_controls.md) — `4daa246`; local checks passed
- [x] [11 Windows backend profile parity](11_windows_backend_profile_parity.md) — `b1c0153`; static/local checks
      passed without Windows execution
- [x] [12 Cross-platform integration and documentation](12_cross_platform_integration_and_docs.md) —
      `0885281`; Linux/local checks passed, Windows execution deferred
- [x] [13 Representative performance collection](13_representative_performance_collection.md) — `b5101ed`;
      local contract checks passed
- [x] [14 Performance attempt contract and derivation](14_performance_attempt_contract_and_derivation.md) —
      `e3136f27`; local contract checks passed
- [x] [15 Linux performance attempt runner](15_linux_performance_attempt_runner.md) — `ae21974`; local checks
      passed without representative workload, Windows work, CI inspection, or push
- [x] [16 Linux standard loader implementation](16_representative_linux_host_qualification.md) — standard path
      loader, metadata-only model install/load, retained deprecated legacy path, and local Linux CPU/CUDA checks
      passed; committed locally as `0428b76` without push, CI, representative qualification, Windows work, or
      evidence cleanup
- [ ] [17 Focused Linux Base qualification](17_windows_end_to_end_qualification.md) — candidate-only tooling is
      locally verified, but representative execution is blocked in Linux coordinator preflight after the Base
      artifact operation completes and before worker authority acquisition; identify and fix that confirmed Linux
      path, then run only Base CPU/CUDA cold/warm and focused lifecycle/privacy checks on representative Linux; no CI
      or Windows work
- [ ] [18 Windows implementation and focused Base qualification](18_windows_final_remediation.md) — on real Windows,
      implement the metadata-only validator, obtain positive CI/package results, and run the same Base CPU/CUDA
      qualification plus focused lifecycle/privacy checks; each Windows CI fix is a separate authorized commit
