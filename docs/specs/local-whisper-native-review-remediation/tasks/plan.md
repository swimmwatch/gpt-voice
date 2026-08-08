# Local Whisper Native Review Remediation Plan

Status: Approved

Date: 2026-08-08

Specification: [../spec.md](../spec.md)

Decision evidence: [../decisions.yaml](../decisions.yaml)

Approval: **PLAN-APPROVAL-002** — explicit approval recorded in the persistent `plan:local-whisper-native-review-remediation` interview on 2026-08-08. The earlier **PLAN-APPROVAL-001** covered the superseded eight-packet plan only.

## Execution Model

- Execute exactly one numbered packet per explicit `incremental-implementation` invocation, update `todo.md` and `handoff.md`, then stop.
- Packets 01–13 implement behavior and CI contracts and complete their Linux/shared checks. They also author applicable Windows code, tests, profiles, and manifests, but real Windows-host execution is deliberately deferred.
- Packet 14 runs the full Linux/shared matrix and fixes all defects it exposes within the approved contract.
- Packet 15 is the final, separate Windows x64 validation-and-remediation packet. It runs every deferred ordinary MSVC, MSVC ASan, MSVC analysis, deterministic, resource, PE, and smoke gate and fixes all findings before the workstream may complete.
- Checking an earlier packet records implementation plus Linux/shared evidence; it is not a claim that the Windows half passed. Packet 15 is mandatory and unavailable Windows evidence is a blocker, never a pass.
- Plan approval is not implementation authorization. Commits, pushes, pull requests, workflow dispatches, packaging, qualification, publishing, and releases remain separately gated.

## Ordered Packets

| Packet                                              | Outcome                                                                                                                                      | Depends on     | Owned requirements and acceptance                                                                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01](01_worker_concurrency_and_cancel_protocol.md)  | Atomically repair inference ownership, completion, transcript emission, and private cancel-race semantics across C++ and TypeScript peers.   | None           | THR-001, INF-001–INF-002, CAN-001–CAN-003, CMP-003; AC-AUT-001–AC-AUT-004, AC-AUT-016                                                                                                                       |
| [02](02_fs_guard_resource_ownership.md)             | Close every filesystem-guard resource, enforce the shared 64-live-lease budget, and add OS-count failure injection.                          | None           | FSG-001, FSG-005–FSG-006; AC-AUT-005–AC-AUT-006, AC-AUT-024                                                                                                                                                 |
| [03](03_fs_guard_input_and_typed_commands.md)       | Add fail-stop bounded input, exact `LIST`, and typed backend commands.                                                                       | 02             | FSG-002–FSG-004, ARC-001; AC-AUT-007–AC-AUT-008, AC-AUT-013                                                                                                                                                 |
| [04](04_process_and_capability_lifecycle.md)        | Eliminate permanent-channel spin and close every rejected Linux/Windows capability.                                                          | 01, 02         | LNX-001, CAP-001; AC-AUT-009–AC-AUT-010                                                                                                                                                                     |
| [05](05_common_crypto_and_frame_contracts.md)       | Consolidate hand-written SHA-256 and canonicalize the 136-byte audio-frame overhead.                                                         | 02, 04         | CRY-001, FRM-001; AC-AUT-011, AC-AUT-015                                                                                                                                                                    |
| [06](06_typed_launch_failures.md)                   | Replace message-text launch classification and numeric exit literals with typed contracts.                                                   | 04, 05         | ERR-001; AC-AUT-012                                                                                                                                                                                         |
| [07](07_native_hardening_and_binary_verifier.md)    | Apply shared CMake hardening and add the dedicated live ELF/PE verifier.                                                                     | 01–06          | BLD-001; AC-AUT-014, AC-MAN-003                                                                                                                                                                             |
| [08](08_sanitizer_and_stl_hardening.md)             | Enforce non-recovering sanitizers, proof fixtures, Linux bounds hardening, and compatible MSVC ASan/STL configuration.                       | 01–07          | SAN-001–SAN-002, STL-001, WIN-002; AC-AUT-017–AC-AUT-018, AC-AUT-020                                                                                                                                        |
| [09](09_native_execution_analysis_and_reporting.md) | Add complete host source manifests, Linux path-sensitive analysis, real-MSVC workflow wiring, and truthful coverage reports.                 | 07, 08         | WIN-001, ANA-001–ANA-002, CMP-005–CMP-006, TST-003, TST-006; AC-AUT-018–AC-AUT-019, AC-AUT-025                                                                                                              |
| [10](10_bounded_parser_fuzzing.md)                  | Run exactly seven shared parser fuzz targets with bounded synthetic corpora and failure proof.                                               | 03, 05, 08, 09 | FUZ-001–FUZ-003, TST-004; AC-AUT-021, AC-AUT-027                                                                                                                                                            |
| [11](11_worker_tsan_gate.md)                        | Run the deterministic worker concurrency matrix and synthetic race proof under separate Linux TSan.                                          | 01, 08, 09     | TSN-001–TSN-002, TST-005; AC-AUT-022                                                                                                                                                                        |
| [12](12_focused_gcc_quality.md)                     | Add pinned GCC 13 build/test coverage for filesystem guard and launcher without duplicating existing suites.                                 | 02–06, 08, 09  | GCC-001, TST-007; AC-AUT-023                                                                                                                                                                                |
| [13](13_locked_source_advisory_monitoring.md)       | Add weekly credential-free exact-lock advisory monitoring and seven-day freshness enforcement.                                               | 09             | ADV-001–ADV-003, OPS-002–OPS-003; AC-AUT-026–AC-AUT-027                                                                                                                                                     |
| [14](14_linux_shared_remediation_gate.md)           | Run and repair the complete Linux/shared automated and supported-host matrix and produce the exact deferred Windows manifest.                | 01–13          | Linux/shared closure of OUT-001–OUT-002, GAT-001–GAT-002, TST-001–TST-007; AC-AUT-001–AC-AUT-027, AC-MAN-001, Linux AC-MAN-003, AC-MAN-005                                                                  |
| [15](15_windows_validation_and_remediation_gate.md) | Run every deferred real Windows x64 gate, fix all Windows/shared findings, recheck affected Linux paths, and close the remediation evidence. | 01–14          | Windows/final closure of CMP-001, CMP-004–CMP-006, WIN-001–WIN-002, TST-001–TST-003, TST-006–TST-007, OUT-001–OUT-002, GAT-001–GAT-002; Windows AC-AUT evidence, AC-MAN-002, Windows AC-MAN-003, AC-MAN-004 |

## Global Constraints

- Preserve public IPC, renderer/preload APIs, provider behavior, settings, history, artifact schemas, package targets, persisted data, Linux acknowledgment asymmetry, and protocol version 1.
- Keep changes modular C++20 with RAII, narrow dependency injection, deterministic cleanup, strict typed errors, shared contracts, and platform APIs behind Linux/Windows boundaries.
- Do not add dependencies, metadata-keyed digest caching, unmeasured hash-pass removal, `clang-cl`, Windows clang-tidy, unsupported Windows sanitizer claims, generated build outputs, or release/qualification actions.
- Use synthetic non-sensitive tests and validated temporary roots. Never log or retain audio, transcripts, model content, absolute paths, capabilities, lease tokens, credentials, raw exceptions, or unrestricted environment dumps.
- A final Windows-discovered shared-code fix must rerun every affected Linux/shared gate before Packet 15 can complete.

## Coverage Audit

| Contract area                                                                                                   | Packets                                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Source-remediation behavior, native ownership, protocol compatibility, and public exclusions                    | 01–07; integrated by 14–15                                                                             |
| Linux/Windows equivalent safety with deferred real Windows execution                                            | Windows code/tests in 01–09; Linux/shared evidence in 01–14; all real Windows evidence and fixes in 15 |
| Sanitizers, standard-library hardening, source manifests, real MSVC execution, and analysis                     | 08–09; integrated by 14–15                                                                             |
| Parser fuzzing, worker TSan, and focused GCC                                                                    | 10–12; Linux/manual audit in 14                                                                        |
| Exact locked-source advisory monitoring and freshness                                                           | 13; audited by 14–15 without qualification                                                             |
| Security/privacy, evidence classification, complete automated matrix, supported-host smokes, and exact binaries | Every packet; finalized by 14–15                                                                       |

All active specification requirements and AC-AUT-001–AC-AUT-027 plus AC-MAN-001–AC-MAN-005 are owned. Packet 15 is intentionally both the final Windows verification package and the bounded remediation owner for findings discovered only on Windows.
