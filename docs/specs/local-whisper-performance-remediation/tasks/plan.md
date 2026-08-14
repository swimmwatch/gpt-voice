# Local Whisper Performance Remediation Plan

- Status: Approved (revision 2)
- Previous approval: revision 1 retained as superseded history after the 2026-08-14 CI and Windows-qualification changes
- Approval: explicit `approve` recorded in `plan:local-whisper-performance-remediation` on 2026-08-14
- Specification: [Approved contract](../spec.md)
- Decision ledger: [decisions.yaml](../decisions.yaml)
- Revision basis: `e49b5790c6b0b1a6fe417b920da8f45df365fe2f`
- Execution model: one explicitly authorized packet at a time; no packet advances until its required CI checks are green and reviewed

The affected production source still matches the specification revision basis. Pre-existing dirty changes in
`.github/workflows/pr-checks.yml`, `scripts/local-whisper/ci/RunnerPolicyVerifier.ts`, and
`tests/scripts/localWhisper/ci/RunnerPolicy.test.ts` must be preserved and reconciled when Packet 01 adds the
performance CI lanes; they must not be overwritten or silently absorbed as packet work.

| Packet                                          | Outcome                                                                                                                   | Dependencies | Owned requirements and acceptance                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [01](01_qualification_contract_and_baseline.md) | Add privacy-safe phase evidence, locked paired analysis, source-count baselines, and freeze the measured pipeline window. | None         | OUT-001, SCP-003, SCP-007, BASE-001, GAT-001–GAT-004, QUAL-001, OBS-001–OBS-003, PERF-001, PERF-004, RES-002, PRIV-001, AC-AUT-001, AC-AUT-002 |
| [02](02_launch_lease_directory_result_reuse.md) | Reuse the acquisition-time directory result once without weakening any later model proof.                                 | 01           | SCP-004, SEC-001–SEC-004, PERF-002, PERF-006, PERF-007, SEC-006, AC-AUT-003, AC-AUT-004                                                        |
| [03](03_runtime_sha256_dispatch.md)             | Add race-free x64 SHA-256 runtime dispatch with a hardened scalar fallback.                                               | 01           | CMP-005, CRY-001, DEP-001, THR-005, SEC-007, RES-003, AC-AUT-008                                                                               |
| [04](04_fs_guard_protocol_v2_codec.md)          | Advance the private guard protocol to v2 and decode each raw chunk exactly once within its exact payload budget.          | 01           | CMP-004, IPC-001, CODEC-001, CODEC-002, ARC-004, IPC-003, INST-001, IPC-004, SEC-005, AC-AUT-005, AC-AUT-006                                   |
| [05](05_bounded_installation_pipeline.md)       | Introduce the frozen bounded request window, stream backpressure, ordered writes, and deterministic settlement.           | 01, 04       | THR-001, RES-001, INST-002, ARC-002, RES-003, FAIL-001–FAIL-003, AC-AUT-007                                                                    |
| [06](06_worker_warmup_and_log_ordering.md)      | Move real warm-up behind the existing protocol-v1 warmup request and preserve log schema v1.                              | 01           | FLOW-001, WRM-001, WRM-002, IPC-002, LOG-001, PRIV-002, OPS-001, AC-AUT-009                                                                    |
| [07](07_wav_buffer_lifetime.md)                 | Release source WAV bytes before inference while preserving cancellation and cleanup.                                      | 01           | MEM-001, MEM-002, THR-006, RES-003, AC-AUT-010                                                                                                 |
| [08](08_settings_schema_v2_migration.md)        | Add settings schema v2, GPU CPU-thread persistence, deterministic migration, and target-specific selection memory.        | 01           | SCP-002, CMP-006, CFG-001–CFG-004, THR-002, THR-003, MIG-001–MIG-003, SEC-008, OPS-002, AC-AUT-011                                             |
| [09](09_gpu_thread_runtime_identity.md)         | Resolve and enforce GPU CPU threads in worker load and residency identity.                                                | 08           | ARC-003, THR-004, FLOW-001, OPS-001, FAIL-001–FAIL-003, AC-AUT-013                                                                             |
| [10](10_gpu_thread_renderer_controls.md)        | Present contextual CPU/GPU thread controls with independent draft state and accessibility.                                | 08           | SCP-002, CFG-004, MIG-003, UI-001, A11Y-001, AC-AUT-012                                                                                        |
| [11](11_windows_backend_profile_parity.md)      | Complete Windows current-value option declarations without changing effective behavior.                                   | 01           | CMP-001, PERF-005, BLD-001, DEP-001, AC-AUT-014                                                                                                |
| [12](12_cross_platform_integration_and_docs.md) | Integrate all changes, verify compatibility/privacy/quality, and document operation and rollback.                         | 02–11        | SCP-005, SCP-006, CMP-001–CMP-003, ARC-001, ARC-002, PRIV-002, OPS-001–OPS-003, AC-AUT-015, AC-MAN-005                                         |
| [13](13_representative_host_qualification.md)   | Run the locked representative Linux CPU/CUDA qualification and publish only privacy-safe evidence.                       | 12           | OUT-001, SCP-001, PERF-001–PERF-005, RES-002, QUAL-001, OBS-001–OBS-003, AC-MAN-001, AC-MAN-003–AC-MAN-006                                    |
| [14](14_windows_end_to_end_qualification.md)    | Run the complete Windows CPU/CUDA end-to-end matrix directly on the regular supported Windows computer.                  | 13           | OUT-001, SCP-001, CMP-001, PERF-001–PERF-005, RES-002, QUAL-001, OBS-001–OBS-003, AC-MAN-002–AC-MAN-006                                      |
| [15](15_windows_final_remediation.md)           | Conditionally fix and requalify Windows-only failures discovered by Packet 14, using separate fix commits.               | 14           | CMP-001, CMP-005, PERF-001–PERF-005, RES-002, QUAL-001, AC-AUT-015, AC-MAN-002–AC-MAN-006                                                     |

## CI and commit protocol

Packet 01 establishes two aggregate required checks in `.github/workflows/pr-checks.yml`:
`Local Whisper Performance (Linux)` on `${{ vars.CI_LINUX_RUNNER }}` and
`Local Whisper Performance (Windows)` on `${{ vars.CI_WINDOWS_RUNNER }}`. It also makes changes under this
specification directory trigger the workflow, so evidence-only Packets 13 and 14 cannot bypass CI. Each packet
lists the exact task-specific commands exercised by those aggregates and any additional existing required checks.

For every packet:

1. Implement and run the packet's local verification, then stop for review.
2. Obtain explicit authorization before creating the packet implementation commit and before pushing it.
3. Push the immutable implementation commit and wait for every named required check to report `success` for that
   exact SHA. Failed, skipped, cancelled, neutral, action-required, stale, and timed-out results are non-passing.
4. If CI exposes an actionable defect, leave the implementation commit unchanged. Repair it only in a later
   explicitly authorized invocation, create a separate fix commit, push it, and rerun the same named checks.
5. Repeat separate fix commits until all required checks are green. Record implementation and fix SHAs, workflow
   run IDs, check names, check-run URLs or IDs, and final results in `handoff.md`.
6. Do not mark the packet complete or start the next packet until the green result has been reviewed.

Hosted Windows CI owns deterministic TypeScript, MSVC/native, CPU, packaging, and fixture verification because the
development host is Linux. It does not claim representative CUDA hardware. Packet 14 therefore runs the complete
CPU/CUDA end-to-end acceptance directly on the regular supported Windows computer; Packet 15 owns every subsequent
Windows fix, improvement, and rerun. If Packet 14 passes without a Windows defect, Packet 15 is marked not required
with the Packet 14 evidence digest and creates no commit.

## Execution boundary

Revision 2 plan approval does not authorize packet execution, commit, or push. After approval, the first execution
request may authorize Packet 01 implementation only. Commit and push authorization is obtained at the packet review
boundary described above. Pull requests, releases, package publication, and destructive cleanup remain outside this
plan unless separately authorized.
