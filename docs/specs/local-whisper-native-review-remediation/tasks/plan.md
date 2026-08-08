# Local Whisper Native Review Remediation Plan

Status: Approved

Date: 2026-08-08

Specification: [../spec.md](../spec.md)

Decision evidence: [../decisions.yaml](../decisions.yaml)

Approval: **PLAN-APPROVAL-001** — explicit `approve` recorded in the persistent `plan:local-whisper-native-review-remediation` interview on 2026-08-08.

## Execution model

- Execute exactly one numbered packet per explicit `incremental-implementation` invocation.
- Every behavior packet owns Linux and Windows changes and verification together.
- Do not mark a packet complete while its required Windows or Linux gate is unverified.
- After a packet passes, update [todo.md](todo.md) and [handoff.md](handoff.md), present the result, and stop.
- Plan approval is not implementation authorization. Commits, pushes, pull requests, qualification, packaging, and releases remain separately gated.

## Ordered packets

| Packet                                             | Outcome                                                                                                                                                     | Depends on | Owned requirements and acceptance                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| [01](01_worker_concurrency_and_cancel_protocol.md) | Atomically repair inference ownership/completion, guarantee committed-transcript emission, and add the private `cancelTooLate` path through C++, TypeScript, fixtures, and coordinator state. | None       | THR-001, INF-001, INF-002, CAN-001–CAN-003, CMP-003–CMP-004, AC-AUT-001–AC-AUT-004, AC-AUT-016 |
| [02](02_fs_guard_resource_ownership.md)            | Close every transient filesystem-guard resource and enforce the shared 64-live-lease budget with `IO_FAILED` capacity rejection.                            | None       | FSG-001, FSG-005–FSG-006, AC-AUT-005–AC-AUT-006                                |
| [03](03_fs_guard_input_and_typed_commands.md)      | Add the fail-stop bounded reader, exact cross-platform `LIST`, and typed backend command flow.                                                              | 02         | FSG-002–FSG-004, ARC-001, AC-AUT-007–AC-AUT-008, AC-AUT-013                    |
| [04](04_process_and_capability_lifecycle.md)       | Eliminate permanent-channel spin and close every rejected Linux/Windows capability.                                                                         | 01, 02     | LNX-001, CAP-001, AC-AUT-009–AC-AUT-010                                        |
| [05](05_common_crypto_and_frame_contracts.md)      | Consolidate SHA-256 and canonicalize the 136-byte audio-frame overhead across all consumers.                                                                | 02, 04     | CRY-001, FRM-001, AC-AUT-011, AC-AUT-015                                       |
| [06](06_typed_launch_failures.md)                  | Replace message-text launch classification and numeric exit literals with typed errors and named exit contracts.                                            | 04, 05     | ERR-001, AC-AUT-012                                                            |
| [07](07_native_hardening_and_binary_verifier.md)   | Apply one shared CMake hardening policy and add the dedicated ELF/PE verifier to Linux and Windows quality jobs.                                            | 01–06      | BLD-001, AC-AUT-014                                                            |
| [08](08_cross_platform_remediation_gate.md)        | Run the complete automated matrix, perform the supported-host smokes and binary inspection, and close the remediation gates without claiming qualification. | 01–07      | OUT-001, GAT-001, AC-MAN-001–AC-MAN-003 and final coverage of all requirements |

## Global constraints

- Preserve public IPC, renderer/preload APIs, provider behavior, settings, history, artifact schemas, package targets, and persisted data.
- Keep protocol version 1; update both private peers, validators, fixtures, and content-derived runtime identity atomically.
- Do not add dependencies, metadata-keyed digest caching, unmeasured hash-pass removal, Linux acknowledgment redesign, release actions, or generated build outputs.
- Use temporary validated roots for native integration tests. Never log audio, transcripts, absolute paths, capability values, tokens, credentials, or raw native exceptions.
- Linux-only mechanisms may have platform-specific tests, but each packet must also prove the equivalent Windows safety property.

## Coverage audit

| Contract area                                                                        | Packets                              |
| ------------------------------------------------------------------------------------ | ------------------------------------ |
| Outcome, merge/pre-qualification gates, exclusions, public compatibility, operations | 01–08, finalized by 08               |
| Linux/Windows parity, native boundaries, quality baseline                            | Every behavior packet; audited by 08 |
| Worker concurrency, prompt failure, committed-transcript emission, cancel race, protocol compatibility | 01                       |
| Filesystem resources, leases, bounded input, exact listing, typed commands           | 02–03                                |
| Poll/wait closure and capability transfer                                            | 04                                   |
| Common SHA-256, retained OS crypto provider agreement, frame limits | 05                                   |
| Typed launcher/model-launch failures                                                 | 06                                   |
| ELF/PE exploit mitigations                                                           | 07                                   |
| Security/privacy, full automated matrix, supported-host smoke, exact-binary evidence | Every packet; finalized by 08        |

All 34 specification requirements and all 19 acceptance IDs are owned by at least one packet. Packet 08 is an evidence gate, not a substitute for packet-local Linux and Windows verification.
