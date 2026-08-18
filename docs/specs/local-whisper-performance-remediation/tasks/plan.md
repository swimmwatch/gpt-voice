# Local Whisper Performance Remediation Plan

- Status: Approved (revision 9)
- Approval: explicit user approval on 2026-08-18
- Specification: [Approved revision 8](../spec.md)
- Decision ledger: [decisions.yaml](../decisions.yaml)
- Execution model: one explicitly authorized packet per incremental-implementation invocation

Revision 9 removes former Packet 17 and all remaining representative qualification, benchmark, CI, package,
and evidence-collection gates. Packets 01–16 and their completion history remain intact. Packet 18 is the sole
remaining executable packet.

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
| [16](16_representative_linux_host_qualification.md)     | Shared/Linux standard path loader and successful local Linux CPU/CUDA verification.          | 15           |

Former Packet 17 is removed. Its unfinished Linux qualification and diagnostic work is not a prerequisite or
completion gate for revision 9.

## Remaining Executable Packet

| Packet                                | Outcome                                                                                                                           | Dependencies | Owned requirements and acceptance                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| [18](18_windows_final_remediation.md) | Implement Windows parity with Linux, run the Windows development application on CPU and CUDA, and verify Local Whisper functions. | 16           | OUT-001, OUT-002, WIN-001–WIN-005, AC-WIN-001–AC-WIN-003, OPS-004 |

## Safe Sequencing And Platform Boundary

1. Implement only the missing Windows platform adapter behavior required by the existing shared standard-loader
   contract. Preserve the completed Linux implementation as the functional reference.
2. Compile the Windows code through the ordinary development path and start the application on a real supported
   Windows x64 host.
3. Run one ordinary Local Whisper flow with the CPU backend and one with the CUDA backend: load the configured
   application-managed weights, record audio, and obtain a transcription. Confirm CUDA does not silently fall
   back to CPU.
4. If either flow fails, make the smallest Windows-specific correction and rerun only the failed build or
   functional flow. Do not add benchmarks, repeated samples, qualification tooling, CI gates, package checks,
   or expanded matrices.
5. Stop after both flows work. Do not publish, release, delete private evidence, or change unrelated shared/Linux
   behavior.

## Coverage And Executability Audit

- Every active remaining revision-8 requirement is owned by Packet 18.
- Packets 01–16 retain responsibility for the completed shared/Linux contracts and historical automated evidence;
  Packet 18 does not rerun them merely for reconfirmation.
- Former revision-7 qualification, timing/statistical/resource, representative-host, CI, package, and evidence
  gates are superseded and have no active packet owner.
- A real Windows host is required because Linux source inspection cannot establish Windows runtime behavior.
- The packet is executable without inventing a model matrix, sample count, benchmark threshold, CI workflow, or
  evidence format.

## Execution Boundary

Plan approval does not itself start Packet 18 or authorize commits, pushes, CI, publication, or release work.
Packet execution remains a separate incremental-implementation action.
