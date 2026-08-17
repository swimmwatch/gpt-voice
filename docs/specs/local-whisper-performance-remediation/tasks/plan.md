# Local Whisper Performance Remediation Plan

- Status: Approved (revision 8)
- Approval: explicit `approve` recorded in `plan:local-whisper-performance-remediation` on 2026-08-16
- Specification: [Approved revision 7](../spec.md)
- Decision ledger: [decisions.yaml](../decisions.yaml)
- Revision basis: repository `8942b8b311f22bf6daa607b840fc68713c656ab5` plus the inspected working-tree standard-loader and qualification sources
- Execution model: one explicitly authorized packet per incremental-implementation invocation

Revision 8 changes only the two unchecked delivery packets. Packets 01–16 and their completion history remain
intact. Historical paired-baseline, multi-model, speedup, uncertainty, resource-regression, and installation-window
selection requirements do not apply to Packets 17–18.

## Completed Packet History

| Packet                                                  | Historical outcome                                                                           | Dependencies |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------ |
| [01](01_qualification_contract_and_baseline.md)         | Qualification contract, source-count baseline, paired analyzer, and bounded evidence schema. | None         |
| [02](02_launch_lease_directory_result_reuse.md)         | Acquisition-time directory result reuse.                                                     | 01           |
| [03](03_runtime_sha256_dispatch.md)                     | Race-free x64 SHA-256 dispatch retained for non-model uses.                                  | 01           |
| [04](04_fs_guard_protocol_v2_codec.md)                  | Bounded filesystem-guard protocol-v2 codec.                                                  | 01           |
| [05](05_bounded_installation_pipeline.md)               | Candidate-window installation pipeline with serial production binding.                       | 01, 04       |
| [06](06_worker_warmup_and_log_ordering.md)              | Explicit real-inference warm-up and native log ordering.                                     | 01           |
| [07](07_wav_buffer_lifetime.md)                         | Early source-WAV release and deterministic cleanup.                                          | 01           |
| [08](08_settings_schema_v2_migration.md)                | Target-specific CPU/GPU thread settings and migration.                                       | 01           |
| [09](09_gpu_thread_runtime_identity.md)                 | GPU CPU-thread resolution and residency identity.                                            | 08           |
| [10](10_gpu_thread_renderer_controls.md)                | Contextual thread controls and accessibility.                                                | 08           |
| [11](11_windows_backend_profile_parity.md)              | Static Windows backend-profile declarations without Windows execution.                       | 01           |
| [12](12_cross_platform_integration_and_docs.md)         | Linux integration, deferred Windows coverage, operation, and rollback documentation.         | 02–11        |
| [13](13_representative_performance_collection.md)       | Aggregate-only qualification collection contract.                                            | 12           |
| [14](14_performance_attempt_contract_and_derivation.md) | Derived-source identity and fail-closed attempt/resource merging.                            | 13           |
| [15](15_linux_performance_attempt_runner.md)            | Linux attempt runner, role-aware sampler, and private-input preflight.                       | 14           |
| [16](16_representative_linux_host_qualification.md)     | Shared/Linux standard path loader and local Linux verification.                              | 15           |

## Remaining Executable Packets

| Packet                                       | Outcome                                                                                                                                                                                                           | Dependencies | Owned requirements and acceptance                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [17](17_windows_end_to_end_qualification.md) | Adapt qualification tooling to revision 7 and qualify only `base/full` on representative Linux CPU/CUDA cold/warm cells, with one focused packaged lifecycle/privacy flow per backend and Linux-only remediation. | 16           | OUT-002, GAT-001–GAT-004, QUAL-001, QUAL-002, OBS-001–OBS-005, PERF-001, PERF-004, PERF-008–PERF-012, RES-002, PRIV-001, PRIV-002, OPS-003, AC-AUT-001, AC-AUT-002, AC-AUT-016, AC-AUT-017, AC-MAN-001–AC-MAN-008 (Linux)                                                                                                                                                                |
| [18](18_windows_final_remediation.md)        | On a real Windows host, implement the Windows metadata-only validator, obtain required Windows CI/package evidence, and run the same focused `base/full` CPU/CUDA qualification and lifecycle/privacy checks.     | 17           | OUT-001–OUT-003, GAT-002–GAT-004, QUAL-001, QUAL-002, OBS-001–OBS-005, PERF-001, PERF-004, PERF-008–PERF-012, CMP-001–CMP-009, IPC-005, SEC-001, SEC-002, SEC-004, SEC-006, SEC-010–SEC-012, ARC-001, ARC-002, ARC-005, ARC-006, BLD-001, DEP-001, RES-002–RES-004, PRIV-001, PRIV-002, FAIL-001–FAIL-005, OPS-001–OPS-004, AC-AUT-003–AC-AUT-020, AC-MAN-001–AC-MAN-008 (Windows/final) |

## Safe Sequencing And Platform Boundary

1. Packet 17 first updates only qualification contracts, schemas, commands, and tests that still require paired
   baseline/candidate runs, four models, five-to-six pairs, p95/variance/uncertainty, speedup/resource thresholds,
   or installation-window selection. It then installs only the candidate package and runs the representative
   Linux matrix for the exact 147,951,465-byte `base/full` artifact.
2. Linux qualification contains four cells: CPU cold, CPU warm, CUDA cold, and CUDA warm. Each cell records
   exactly three successful candidate loads, declared ordering, median, minimum, maximum, distance from 5,000 ms,
   and bounded RAM/VRAM evidence. Five seconds is informational and cannot fail runtime or qualification.
3. Packet 17 additionally runs one sequential packaged load, warm-up, transcription, cancellation, unload,
   retry, and cleanup flow per backend; proves real CUDA ownership with no silent CPU fallback; and performs one
   bounded privacy inspection. It does not run CI, Windows checks, or excluded manual matrices.
4. Packet 18 is the only remaining Windows implementation and execution packet. On a real Windows x64 host it
   adds the RAII metadata-only path validator, runs focused Windows checks, creates/pushes reviewable commits only
   with explicit authorization, and waits for every required CI result to finish successfully.
5. Every actionable Windows CI failure receives a separate minimal fix commit; no implementation or fix commit
   is amended or squashed. Each push requires separate authorization and reruns the complete required CI set.
6. After green CI, Packet 18 installs only the candidate Windows package and runs the same four Base cells and
   focused per-backend lifecycle/CUDA/privacy checks. It does not produce or install a baseline package, select an
   installation window, or restore any superseded performance threshold.
7. A Packet 18 production change to shared or Linux behavior invalidates the affected Linux evidence and stops
   for planning. A qualification-tool-only compatibility repair reruns its focused tests and revalidates retained
   Linux evidence; representative Linux loads are rerun only if their manifest, collection, or result semantics
   changed.
8. Rollback replaces the whole compatible app/worker set. The deprecated loader remains inactive and is never a
   runtime or per-load fallback.

## Coverage And Executability Audit

- Every active revision-7 requirement is either inherited through completed Packets 01–16 or owned by Packet 17
  (Linux qualification/tooling) or Packet 18 (Windows implementation, CI, qualification, and final evidence).
- The linked Packet 16 contract owns the active shared/Linux foundation: OUT-001, OUT-003, SCP-001–SCP-009,
  BASE-001, CMP-001–CMP-009, IPC-001–IPC-005, SEC-001–SEC-012, ARC-001, ARC-002, ARC-005,
  ARC-006, CRY-001, CODEC-001, CODEC-002, INST-001, INST-002, FLOW-001, FLOW-002, WRM-001,
  WRM-002, LOG-001, MEM-001, MEM-002, CFG-001–CFG-004, MIG-001–MIG-003, UI-001, A11Y-001,
  BLD-001, DEP-001, THR-001–THR-006, RES-001, RES-003, RES-004, PRIV-001, PRIV-002,
  FAIL-001–FAIL-005, OPS-001, OPS-002, OPS-004, AC-AUT-003–AC-AUT-020, and the shared/Linux
  portions of PERF-002, PERF-003, PERF-005–PERF-007, PERF-009, PERF-011, and PERF-012.
- Packet 17 explicitly owns the current paired-baseline tooling gap in `scripts/local-whisper/qualification/`
  and its schemas/tests before representative execution. Packet 18 owns the absent Windows implementation of
  `ModelFileValidator` and the real MSVC/CUDA/package boundary.
- Linux and Windows evidence remains independently attributable. Hosted fixtures and source inspection cannot be
  represented as representative-host evidence.
- Removed from active execution: baseline package production, four-model execution, paired samples, p95,
  variance, uncertainty, 3x speedup, 25-percent component improvement, 3-percent end-to-end/resource guardrail,
  installation-window experiments/selection, and the excluded lifecycle/device/settings matrices.
- Destructive cleanup, private evidence deletion, release publication, and artifact/evidence upload remain
  unauthorized. Private evidence is retained outside source control.

## Execution Boundary

Plan approval does not authorize Packet 17 execution, production changes, commits, pushes, CI, representative-host
runs, package installation, publication, or release work. Execution authorization is a separate Prompt MCP
decision and implementation remains one packet per incremental-implementation invocation.
