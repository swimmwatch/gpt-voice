# Local Whisper Native Review Remediation Plan

Status: Approved

Date: 2026-08-10

Specification: [../spec.md](../spec.md)

Decision evidence: [../decisions.yaml](../decisions.yaml)

Approval: **PLAN-APPROVAL-005** — explicit `approve` recorded for the `APPROVAL-005` two-runner and parameterized-workflow plan revision in the persistent `plan:local-whisper-native-review-remediation` interview on 2026-08-10.

Execution authorization: **EXEC-AUTH-003** — explicit `authorize-revised-sequence` recorded for later one-packet-at-a-time execution of revised Packets 09–19 in the persistent `plan:local-whisper-native-review-remediation` interview on 2026-08-10. **EXEC-AUTH-002** remains historical authorization for the superseded four-runner plan.

Revision basis: **APPROVAL-005**, `compatibility.runner-version-matrix` revision 2, `operations.workflow-parameterization` revision 1, `plan.amendment-packet-sequencing` revision 1, and `plan.amendment-packet-map` revision 2. This approved revision preserves completed Packets 01–08 and revises only unchecked Packets 09–19. It is not implementation authorization.

## Execution Model

- Execute exactly one numbered packet per explicit `incremental-implementation` invocation. Do not start the next packet in the same invocation.
- Packets 01–08 remain complete under their recorded contracts and evidence. Their files, checklist state, commits, and CI history are not reopened by this plan revision.
- For every code-bearing Packet 09–19 candidate or fix, run all available applicable local tests, linters, type checks, native C++ builds/tests/analyzers/sanitizers, formatting, and policy checks before committing. CI is remote confirmation, not the initial check.
- After local success, create the packet-scoped conventional commit, push without force to the verified pull-request head, confirm CI launched for the exact SHA, and require every selected Linux and Windows job plus every other required check to execute and succeed. No required Windows job or stage may be skipped.
- The fixed runner contract is exactly Ubuntu 24.04 and Windows Server 2025. Ubuntu 22.04 and Windows Server 2022 compatibility lanes are removed. Fedora 44 remains a digest-pinned package-builder container on Ubuntu 24.04, not another runner.
- A missing, cancelled, timed-out, neutral, unexpectedly skipped, malformed, stale, identity-mismatched, latest-alias, or unsuccessful required result is missing evidence. Linux never substitutes for Windows, and hosted servers/containers never substitute for supported-desktop manual evidence.
- Packet-caused in-scope CI failures are fixed in the same packet. All applicable checks run locally again before each fix commit; the replacement exact SHA must pass the complete selected remote gate. Unrelated or out-of-scope failures remain blockers.
- After a code-bearing candidate SHA is green, update `todo.md` and `handoff.md`, create and push a documentation-only completion record, and confirm its CI run launches. Because that commit contains no C++ or TypeScript implementation change, completion does not wait for that documentation-only run.
- Packet 18 is the integrated Linux/shared/security testing-and-fix package. Packet 19 is the final separate supported-host Windows testing-and-fix package and the only owner of final real Windows desktop validation.
- Plan approval and packet execution authorization are separate. Scoped conventional packet/fix commits and non-force pushes are permitted only after execution authorization. Force-pushes, PR creation/modification, manual workflow dispatch, signing, publication, qualification, required-check mutation, and release remain separately unauthorized.

## Ordered Packets

| Packet | Outcome | Depends on | Owned requirements and acceptance |
| --- | --- | --- | --- |
| [01](01_worker_concurrency_and_cancel_protocol.md) | Atomically repair inference ownership, completion, transcript emission, and private cancel-race semantics across C++ and TypeScript peers. | None | THR-001, INF-001–INF-002, CAN-001–CAN-003, CMP-003; AC-AUT-001–AC-AUT-004, AC-AUT-016 |
| [02](02_fs_guard_resource_ownership.md) | Close every filesystem-guard resource, enforce the shared 64-live-lease budget, and add OS-count failure injection. | None | FSG-001, FSG-005–FSG-006; AC-AUT-005–AC-AUT-006, AC-AUT-024 |
| [03](03_fs_guard_input_and_typed_commands.md) | Add fail-stop bounded input, exact `LIST`, and typed backend commands. | 02 | FSG-002–FSG-004, ARC-001; AC-AUT-007–AC-AUT-008, AC-AUT-013 |
| [04](04_process_and_capability_lifecycle.md) | Eliminate permanent-channel spin and close every rejected Linux/Windows capability. | 01, 02 | LNX-001, CAP-001; AC-AUT-009–AC-AUT-010 |
| [05](05_common_crypto_and_frame_contracts.md) | Consolidate hand-written SHA-256 and canonicalize the 136-byte audio-frame overhead. | 02, 04 | CRY-001, FRM-001; AC-AUT-011, AC-AUT-015 |
| [06](06_typed_launch_failures.md) | Replace message-text launch classification and numeric exit literals with typed contracts. | 04, 05 | ERR-001; AC-AUT-012 |
| [07](07_native_hardening_and_binary_verifier.md) | Apply shared CMake hardening and add the dedicated live ELF/PE verifier. | 01–06 | BLD-001; AC-AUT-014, AC-MAN-003 |
| [08](08_sanitizer_and_stl_hardening.md) | Enforce non-recovering sanitizers, proof fixtures, Linux bounds hardening, and compatible MSVC ASan/STL configuration. | 01–07 | SAN-001–SAN-002, STL-001, WIN-002; AC-AUT-017–AC-AUT-018, AC-AUT-020 |
| [09](09_workflow_supply_chain_and_runner_foundation.md) | Pin workflow/build inputs, enforce least privilege, consolidate reusable CI ownership, and establish the tested Ubuntu 24.04/Windows Server 2025 matrix. | 01–08 | OUT-004, GAT-004, CMP-009–CMP-012, SUP-001–SUP-002, WF-001, RUN-001–RUN-006, TST-008, TST-010; AC-AUT-028–AC-AUT-029, AC-AUT-039–AC-AUT-040, AC-AUT-042 |
| [10](10_repository_dependency_secret_and_builder_security.md) | Add dependency/signature, repository-secret, Dockerfile, and Fedora builder-image blocking controls with synthetic proofs. | 09 | OUT-003, GAT-003, DEP-001–DEP-002, SEC-005–SEC-006, DCK-001, REP-001, TST-008; AC-AUT-030–AC-AUT-031, AC-AUT-033, AC-AUT-038 (repository portion) |
| [11](11_native_execution_codeql_and_reporting.md) | Add canonical host source manifests, real Linux/MSVC analysis, three CodeQL databases, and truthful native coverage reports. | 07–10 | WIN-001–WIN-002, ANA-001–ANA-002, CMP-005–CMP-007, SAST-001, TST-003, TST-006–TST-008; AC-AUT-018–AC-AUT-019, AC-AUT-025, AC-AUT-032 |
| [12](12_bounded_parser_fuzzing.md) | Run exactly seven shared parser fuzz targets with bounded synthetic corpora and failure proof. | 03, 05, 08, 09, 11 | FUZ-001–FUZ-003, TST-004; AC-AUT-021, AC-AUT-027 (fuzzing) |
| [13](13_worker_tsan_gate.md) | Run the deterministic worker concurrency matrix and synthetic race proof under separate Linux TSan. | 01, 08, 09, 11 | TSN-001–TSN-002, TST-005; AC-AUT-022 |
| [14](14_focused_gcc_quality.md) | Add pinned GCC 13 build/test coverage for filesystem guard and launcher without duplicating existing suites. | 02–06, 08–11 | GCC-001, TST-007; AC-AUT-023 |
| [15](15_locked_source_advisory_monitoring.md) | Add weekly credential-free exact-lock advisory monitoring and seven-day freshness enforcement. | 09–11 | ADV-001–ADV-003, OPS-002–OPS-003; AC-AUT-026–AC-AUT-027 |
| [16](16_application_sbom_and_vulnerability_evidence.md) | Produce distinct whole-app SBOM/vulnerability evidence and digest-bound primary-runner/Fedora smoke for every Linux/Windows package format. | 09–15 | OUT-003, GAT-003, CMP-008, ART-001, VUL-001, RUN-007, TST-008–TST-010; AC-AUT-034–AC-AUT-035, AC-AUT-041 |
| [17](17_provenance_attestation_and_security_reporting.md) | Bind exact package chains with GitHub-native attestations and enforce bounded security evidence, aggregate failure proof, and advisory Scorecard reporting. | 10, 11, 16 | GAT-003, ATT-001, REP-001–REP-002, SRV-001, SEC-006, TST-008–TST-009; AC-AUT-036–AC-AUT-038 |
| [18](18_linux_shared_security_remediation_gate.md) | Run and repair the complete Linux/shared/security matrix, inspect final cross-platform artifact evidence, and prepare the exact manual Windows package. | 01–17 | Linux/shared/integrated closure of all active requirements and AC-AUT-001–AC-AUT-042; AC-MAN-001, Linux AC-MAN-003, AC-MAN-005–AC-MAN-008 |
| [19](19_windows_validation_and_remediation_gate.md) | Run final supported-host Windows manual validation, fix Windows/shared findings, compare hosted/container evidence, and close the workstream. | 01–18 | Final Windows and workstream closure of all active requirements and applicable AC-AUT-001–AC-AUT-042; AC-MAN-002, Windows AC-MAN-003, AC-MAN-004, AC-MAN-009 |

## Global Constraints

- Preserve public IPC, renderer/preload APIs, provider behavior, settings, history, runtime artifact schemas, package targets, persisted data, Linux acknowledgment asymmetry, and private worker protocol version 1 semantics already completed in Packet 01.
- Keep modular C++20 RAII ownership, deterministic non-throwing cleanup, narrow dependency injection, typed failures, shared contracts, and Linux/Windows platform APIs behind their boundaries. Add no product runtime dependency or mutable global runtime state.
- Preserve fixed supported targets: Linux x64 and Windows x64 only; no macOS, ARM, preview runner, `clang-cl`, Windows clang-tidy, unsupported sanitizer claim, hosted third-party scanner, or support-tier expansion.
- Use only synthetic non-sensitive tests and validated temporary roots. Never log, retain, cache, or upload audio, transcripts, model contents, credentials, sessions, capability/token values, user paths, raw exceptions, unrestricted environment dumps, unrelated files, or generated build outputs.
- Fail closed on high/critical findings, malformed/stale/unavailable evidence, identity mismatch, source omission, tool failure, or required-job absence. Do not suppress, waive, weaken, or relabel evidence to obtain a pass.
- Preserve unrelated dirty-worktree files. Stage explicit packet paths only and never overwrite or remove other specifications, reviews, tests, or user-authored changes.

## Coverage Audit

| Contract area | Packets |
| --- | --- |
| Native behavior, protocol compatibility, resource/process ownership, hardening, and public exclusions | 01–08; analyzed by 11; integrated by 18–19 |
| Sanitizers, analyzers, source manifests, real MSVC, CodeQL, fuzzing, TSan, GCC, and advisory freshness | 08, 11–15; integrated by 18–19 |
| Immutable workflow/container inputs, least privilege, consolidated reusable configuration, fixed runners/toolchains, and claim boundaries | 09; exact artifact evidence in 16; integrated by 18–19 |
| Dependency/signature, secret, Dockerfile, and builder-image controls | 10; aggregate proof in 17; integrated by 18–19 |
| Whole-application SBOM, vulnerability, package identity, and format-truthful primary/Fedora smoke | 16; manual evidence inspection in 18 and final comparison in 19 |
| Provenance, attestation, SARIF/evidence privacy, Scorecard, and no-hosted-scanner boundary | 17; AC-MAN-006–AC-MAN-008 in 18 |
| Supported-host/manual platform closure | Linux/shared/security in 18; final Windows and AC-MAN-009 in 19 |

Every active specification requirement, AC-AUT-001–AC-AUT-042, and AC-MAN-001–AC-MAN-009 maps to at least one independently executable packet. OUT-001, OUT-002, GAT-001, GAT-002, SCP-001, SCP-002, SCP-003, CMP-001, CMP-002, CMP-003, CMP-004, ARC-002, ARC-003, SEC-001, SEC-002, SEC-003, SEC-004, OPS-001, OPS-004, TST-001, TST-002, and TST-003 are cross-cutting constraints applied by each relevant packet and audited explicitly in Packets 18–19.
