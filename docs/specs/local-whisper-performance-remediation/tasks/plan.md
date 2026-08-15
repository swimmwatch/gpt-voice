# Local Whisper Performance Remediation Plan

- Status: Approved (revision 6)
- Previous approvals: revisions 1 through 5 retained as superseded history
- Approval: explicit `approve` recorded in `plan:local-whisper-performance-remediation` on 2026-08-15
- Specification: [Approved contract](../spec.md)
- Decision ledger: [decisions.yaml](../decisions.yaml)
- Revision basis: `b5101edf27631f4e6931d084a1e97b24b66deca9`
- Execution model: one explicitly authorized packet at a time; Packets 05–16 use local/Linux verification only, and all Windows and exact-SHA CI execution is deferred to Packets 17–18

Packet 13 preflight at the revision basis above confirmed seven Linux and six Windows post-reuse full-model proofs
with source digest `a8a6ede6a48ce6d8b591a46e77867ca0e2a26b5a75084b401d9159b4cdd363ee`, but the
repository originally could only analyze a supplied performance bundle. Packet 13 added schema-v2 collection, but
execution preflight at `b5101ed` proved two further gaps: the production orchestrator creates `private-run-root` and
loads a populated authenticated cache while the revision-5 Linux execution packet required an existing private child and empty cache; and no
executable consumes the collector's fixed performance hook, emits the 19 required phases, or returns separately
attributed main/guard/worker/GPU peaks. Hosted CPU/CUDA fixtures remain `contractOnly` and cannot repair these gaps.
Revision 6 adds a derived-source/attempt contract packet and a Linux runner/instrumentation packet, then moves Linux
execution and the final Windows phase later without weakening any gate. The current Windows CPU profile is
`windows-x64-cpu-msvc-19.51-v1`; the CUDA profile remains
`windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1`. No Windows check runs before the final phase. Packet 17 owns the
Windows qualification adapter plus first hosted/direct Windows evidence on the accumulated candidate; Packet 18
selects and freezes the production pipeline window, fixes any Windows failure in separate commits, and reruns the
complete Linux/Windows acceptance set.

| Packet                                                  | Outcome                                                                                                                       | Dependencies | Owned requirements and acceptance                                                                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01](01_qualification_contract_and_baseline.md)         | Add privacy-safe phase evidence, locked paired analysis, source-count baselines, and deterministic candidate-window fixtures. | None         | OUT-001, SCP-003, SCP-007, BASE-001, GAT-001–GAT-004, QUAL-001, OBS-001–OBS-003, PERF-001, PERF-004, RES-002, PRIV-001, AC-AUT-001, AC-AUT-002                  |
| [02](02_launch_lease_directory_result_reuse.md)         | Reuse the acquisition-time directory result once without weakening any later model proof.                                     | 01           | SCP-004, SEC-001–SEC-004, PERF-002, PERF-006, PERF-007, SEC-006, AC-AUT-003, AC-AUT-004                                                                         |
| [03](03_runtime_sha256_dispatch.md)                     | Add race-free x64 SHA-256 runtime dispatch with a hardened scalar fallback.                                                   | 01           | CMP-005, CRY-001, DEP-001, THR-005, SEC-007, RES-003, AC-AUT-008                                                                                                |
| [04](04_fs_guard_protocol_v2_codec.md)                  | Advance the private guard protocol to v2 and decode each raw chunk exactly once within its exact payload budget.              | 01           | CMP-004, IPC-001, CODEC-001, CODEC-002, ARC-004, IPC-003, INST-001, IPC-004, SEC-005, AC-AUT-005, AC-AUT-006                                                    |
| [05](05_bounded_installation_pipeline.md)               | Add candidate-window pipelining, backpressure, ordering, and settlement while retaining serial production behavior.           | 01, 04       | THR-001, RES-001, INST-002, ARC-002, RES-003, FAIL-001–FAIL-003, AC-AUT-007                                                                                     |
| [06](06_worker_warmup_and_log_ordering.md)              | Move real warm-up behind the existing protocol-v1 warmup request and preserve log schema v1.                                  | 01           | FLOW-001, WRM-001, WRM-002, IPC-002, LOG-001, PRIV-002, OPS-001, AC-AUT-009                                                                                     |
| [07](07_wav_buffer_lifetime.md)                         | Release source WAV bytes before inference while preserving cancellation and cleanup.                                          | 01           | MEM-001, MEM-002, THR-006, RES-003, AC-AUT-010                                                                                                                  |
| [08](08_settings_schema_v2_migration.md)                | Add settings schema v2, GPU CPU-thread persistence, deterministic migration, and target-specific selection memory.            | 01           | SCP-002, CMP-006, CFG-001–CFG-004, THR-002, THR-003, MIG-001–MIG-003, SEC-008, OPS-002, AC-AUT-011                                                              |
| [09](09_gpu_thread_runtime_identity.md)                 | Resolve and enforce GPU CPU threads in worker load and residency identity.                                                    | 08           | ARC-003, THR-004, FLOW-001, OPS-001, FAIL-001–FAIL-003, AC-AUT-013                                                                                              |
| [10](10_gpu_thread_renderer_controls.md)                | Present contextual CPU/GPU thread controls with independent draft state and accessibility.                                    | 08           | SCP-002, CFG-004, MIG-003, UI-001, A11Y-001, AC-AUT-012                                                                                                         |
| [11](11_windows_backend_profile_parity.md)              | Prepare Windows current-value option declarations and static audits without executing a Windows check.                        | 01           | CMP-001, PERF-005, BLD-001, DEP-001, AC-AUT-014                                                                                                                 |
| [12](12_cross_platform_integration_and_docs.md)         | Integrate all changes on Linux, prepare deferred Windows coverage, and document operation and rollback.                       | 02–11        | SCP-005, SCP-006, CMP-001–CMP-003, ARC-001, ARC-002, PRIV-002, OPS-001–OPS-003, AC-AUT-015, AC-MAN-005                                                          |
| [13](13_representative_performance_collection.md)       | Implement schema-v2 per-model collection, a bounded Linux collector, frozen run plans, and aggregate-only analysis.           | 12           | OUT-001, SCP-003, QUAL-001, OBS-001–OBS-003, PERF-001, PERF-004, RES-002, PRIV-001, RES-003, AC-AUT-001, AC-AUT-002, AC-AUT-015                                 |
| [14](14_performance_attempt_contract_and_derivation.md) | Add schema-v3 derived-source identity, attempt/resource separation, and fail-closed collector merging.                        | 13           | GAT-003, GAT-004, QUAL-001, OBS-001–OBS-003, PERF-001, PERF-004, RES-002, PRIV-001, RES-003, AC-AUT-001, AC-AUT-002, AC-AUT-015                                 |
| [15](15_linux_performance_attempt_runner.md)            | Implement the identical Linux overlay, real attempt runner, role-aware sampler, input preflight, and run-plan producer.       | 14           | GAT-002–GAT-004, QUAL-001, OBS-001–OBS-003, PERF-001–PERF-005, RES-002, PRIV-001, RES-003, AC-AUT-001–AC-AUT-004, AC-AUT-007–AC-AUT-010, AC-AUT-014, AC-AUT-015 |
| [16](16_representative_linux_host_qualification.md)     | Freeze and run the representative Linux CPU/CUDA matrix for every candidate window without selecting production behavior.     | 15           | OUT-001, SCP-001, PERF-001–PERF-005, RES-002, QUAL-001, OBS-001–OBS-003, AC-MAN-001, AC-MAN-003–AC-MAN-006                                                      |
| [17](17_windows_end_to_end_qualification.md)            | Implement the Windows collector adapter, refresh Linux on its SHA, and run deferred Windows CI/direct-host checks.            | 16           | OUT-001, SCP-001, CMP-001, PERF-001–PERF-005, RES-002, QUAL-001, OBS-001–OBS-003, AC-AUT-003–AC-AUT-015, AC-MAN-001–AC-MAN-006                                  |
| [18](18_windows_final_remediation.md)                   | Select and freeze the production window, fix Windows failures separately, and requalify the final Linux/Windows candidate.    | 17           | CMP-001, CMP-005, THR-001, RES-001, PERF-001–PERF-005, RES-002, QUAL-001, AC-AUT-007, AC-AUT-015, AC-MAN-001–AC-MAN-006                                         |

## CI and commit protocol

Packet 01 establishes `Local Whisper Performance (Linux)` on `${{ vars.CI_LINUX_RUNNER }}` and
`Local Whisper Performance (Windows)` on `${{ vars.CI_WINDOWS_RUNNER }}`. Revision 5 changes when those lanes are
used, not their acceptance strength:

1. Packets 05–16 run their listed local checks on the Linux development host. They do not push or inspect CI and
   must not claim Windows execution. Each packet still stops after its local verification and handoff update.
2. Any local implementation commit remains immutable. Creating a commit still requires the packet's review
   authorization; no further branch push occurs before Packet 17. Packet 03's already-pushed SHA remains historical
   and its CI is not inspected or accepted as revision-5 Windows evidence.
3. Packet 17 implements its narrow qualification-only Windows adapter on the regular Windows host, then pushes the
   reviewed accumulated candidate only with explicit authorization and waits for `Quality
Gates`, both Local Whisper Performance checks, and both Local Whisper Native Quality checks on the exact SHA.
   Windows package checks are added when affected. Every non-`success` conclusion is non-passing.
4. After green CI, Packet 17 reruns the complete Linux matrix on the Windows-adapter SHA, then runs the complete
   direct Windows CPU/CUDA matrix on the regular supported Windows computer. It records failures without modifying
   production code, gathers same-SHA candidate-window evidence, and does not freeze a production window.
5. Packet 18 selects the production window from the locked Linux and Windows evidence, makes that freeze and every
   discovered Windows repair in separate reviewable commits, pushes only with explicit authorization, and reruns
   the complete required CI and representative-host checks after each fix.
6. Never amend or squash an implementation or fix commit. Record SHAs, run IDs, check names, URLs or IDs, results,
   and sanitized evidence digests in `handoff.md`.

Hosted Windows CI owns deterministic TypeScript, MSVC/native, CPU, packaging, and fixture verification because the
development host is Linux. It does not claim representative CUDA hardware. Direct representative Windows CPU/CUDA
performance remains a regular-computer manual gate in Packets 17–18.

## Execution boundary

Revision 6 approval does not authorize packet execution, commit, or push. The next explicit incremental-
implementation invocation authorizes only the next executable packet under the standing one-packet rule. Commit and
push authorization remains separate. Pull requests, releases, package publication, and destructive cleanup remain
outside this plan unless separately authorized.
