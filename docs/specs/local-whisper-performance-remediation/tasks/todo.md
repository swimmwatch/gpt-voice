# Local Whisper Performance Remediation Todo

- Plan status: Approved revision 6 on 2026-08-15
- Execution status: Packets 01–15 are locally complete. Packet 03 is pushed but its CI remains deliberately
  uninspected; Packet 04 is committed locally as `141ae5bf`, Packet 05 as `bc8ba18f` with source-baseline fix
  `20260098`, and Packet 06 as `e063c0d` with TSan registration `e66115d`; none of Packets 04–06 was pushed. Packet
  07 is committed locally as `80cea99`, Packet 08 as `b20e28bf`, Packet 09 as `c1aba25`, Packet 10 as `4daa246`,
  and Packet 11 as `b1c0153`. Packet 12 is committed locally as `0885281`; Packet 13 is committed locally as
  `b5101ed`, and Packet 14 as `e3136f27`. Packet 15 is complete and intentionally uncommitted. None of Packets
  04–15 was pushed. Do not push or inspect CI before Packet 17; all remaining
  Windows checks run in Packets 17–18, and Packet 18 alone selects the production window.

- [x] [01 Qualification contract and baseline](01_qualification_contract_and_baseline.md) — implementation
      `8a808757`, separate fix `d243899f`, and all required final-SHA CI checks completed successfully
- [x] [02 Launch-lease directory-result reuse](02_launch_lease_directory_result_reuse.md) — implementation
      `db85c43e` reduces Linux/Windows full-model proof counts from 8/7 to 7/6; all required exact-SHA CI checks
      completed successfully
- [x] [03 Runtime SHA-256 dispatch](03_runtime_sha256_dispatch.md) — implementation `f0a199ed` and ledger
      `a39d10dc` are pushed; exact-SHA CI inspection is deferred until Packet 17
- [x] [04 Filesystem-guard protocol-v2 codec](04_fs_guard_protocol_v2_codec.md) — local implementation derives a
      193,483-byte raw chunk and passes all required Linux checks; committed locally as `141ae5bf`; push and exact-SHA
      CI are deferred until Packet 17
- [x] [05 Bounded installation pipeline](05_bounded_installation_pipeline.md) — locally verified candidate windows
      `[1, 2, 4, 8]`, bounded ownership, backpressure, failure/cancellation/timeout cleanup, and clean retry while
      retaining serial production behavior; implementation `bc8ba18f`, source-baseline fix `20260098`, and selection
      remains deferred to Packet 18
- [x] [06 Worker warm-up and log ordering](06_worker_warmup_and_log_ordering.md) — locally verified protocol-v1
      `loaded` before explicit real warm-up, schema-v1 native log ordering, typed warm-up failure/timeout cleanup,
      final authority revalidation, retry, and TSan coverage; implementation `e063c0d`, TSan registration `e66115d`
- [x] [07 WAV buffer lifetime](07_wav_buffer_lifetime.md) — locally verified maximum accepted WAV storage release
      before inference, PCM release before a second resident-worker request, conversion failure and retry,
      cancellation/inference failure cleanup, GCC, ASan/UBSan, and TSan coverage
- [x] [08 Settings schema-v2 migration](08_settings_schema_v2_migration.md) — locally verified exact CPU/GPU thread
      shapes, v0/v1 migration, independent target memory, safe unknown-field preservation, reset/default behavior,
      unsupported-newer handling, typed IPC, and dependent schema-v2 fixtures; committed locally as `b20e28bf`
- [x] [09 GPU thread runtime identity](09_gpu_thread_runtime_identity.md) — locally verified bounded GPU `auto` and
      explicit resolution before authority acquisition, protocol-v1 native enforcement, and configured/resolved/
      topology/epoch residency and cache invalidation; committed locally as `c1aba25`
- [x] [10 GPU thread renderer controls](10_gpu_thread_renderer_controls.md) — locally verified one contextual
      CPU/GPU control, target-specific persisted drafts, exact shared bounds, active-only errors, stable accessible
      associations, stale-epoch commands, and complete locale-key coverage; committed locally as `4daa246`
- [x] [11 Windows backend profile parity](11_windows_backend_profile_parity.md) — locally verified pinned-source
      option inventory, exact Linux baseline preservation, explicit Windows CPU/CUDA current values, source-backed
      MSVC differences, strict cache rejection, and runtime-pack profile binding; committed locally as `b1c0153`
- [x] [12 Cross-platform integration and documentation](12_cross_platform_integration_and_docs.md) — locally
      verified the complete Linux matrix, coherent protocol/settings/runtime/log/profile contracts, exact recovery
      guidance, v1-backup recovery, reset/artifact separation, lint-safe bounded pipeline behavior, and the complete
      TSan worker matrix; committed locally as `0885281` and Windows execution remains deferred
- [x] [13 Representative performance collection contract](13_representative_performance_collection.md) — locally
      verified schema-v2 frozen run plans, exact 288-attempt per-backend model/cell ordering, bounded Linux
      collection, strict private-root CLI contracts, failure preservation, cleanup/retry, and aggregate-only results;
      committed locally as `b5101ed`; no representative run, production selection, Windows implementation, push, or
      CI inspection occurred
- [x] [14 Performance attempt contract and derived source identity](14_performance_attempt_contract_and_derivation.md)
      — added schema-v3 identical-overlay receipts, safe one-shot derived-source production, phase/resource
      separation, and fail-closed role-attributed collector merging; local checks passed without representative or
      Windows execution, CI inspection, push, or ordinary production activation; committed locally as `e3136f27`
- [x] [15 Linux performance attempt runner](15_linux_performance_attempt_runner.md) — locally verified identical
      baseline/candidate overlays, authenticated instrumented CPU/CUDA builds, bounded app-to-guard attempts, native
      phase collection, role-aware PSS/GPU sampling, populated-cache/absent-child preflight, and private run-plan
      production; no representative workload, Windows work, CI inspection, commit, or push occurred
- [ ] [16 Representative Linux host qualification](16_representative_linux_host_qualification.md) — freeze the exact
      candidate, validate the populated read-only qualification cache and orchestrator-owned absent private child,
      then run the complete Linux CPU/CUDA candidate-window matrix without pushing, inspecting CI, or selecting
      production behavior
- [ ] [17 Windows end-to-end qualification](17_windows_end_to_end_qualification.md) — implement the Windows collector
      adapter on Windows, refresh Linux evidence on that exact SHA, run all deferred Windows
      CI/native/package/regular-host checks, and collect evidence without fixing failures
- [ ] [18 Final pipeline selection and Windows remediation](18_windows_final_remediation.md) — mandatory production
      selection, separate fix commits, and complete Linux/Windows requalification
