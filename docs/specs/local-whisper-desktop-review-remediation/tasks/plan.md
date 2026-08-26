# Local Whisper Desktop Review Remediation Plan

Status: Approved

Date: 2026-08-08

Specification: [spec.md](../spec.md)

Decision ledger: [decisions.yaml](../decisions.yaml)

Approval: **PLAN-APPROVAL-001** — explicit `approve` recorded in the persistent `plan:local-whisper-desktop-review-remediation` interview on 2026-08-08.

Execution authorization: **EXEC-AUTH-001** — packet 01 is authorized for a future explicit `incremental-implementation` invocation; no implementation began during planning.

## Ordered Packets

| Order | Packet                                                                      | Outcome                                                                                                                                                          | Depends on                                                                                 | Coverage                                                                                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | [01 Artifact Transport Ownership](01_artifact_transport_ownership.md)       | Give every HTTP response and final transport stream one explicit, bounded, idempotent owner; close redirects before following them; retain the exact URL policy. | Approved specification (APPROVAL-001), approved plan, and separate execution authorization | OUT-001, SCP-002, CMP-002–CMP-003, ARC-001–ARC-002, MNT-001, RES-001–RES-004, CON-001, FAIL-001, URL-001–URL-003, SEC-001, SEC-003, PRV-001, OPS-001–OPS-002, TST-001–TST-002, TST-004, AC-AUT-001–AC-AUT-005, AC-AUT-008–AC-AUT-009 |
| 2     | [02 Renderer Command Lifecycle](02_renderer_command_lifecycle.md)           | Extract a state-owning settings-command lifecycle and suppress every late publication after unmount without cancelling process-owned work.                       | Packet 1                                                                                   | OUT-001, SCP-001–SCP-002, CMP-002–CMP-003, ARC-001, REN-001–REN-002, CON-002, SEC-002–SEC-003, PRV-001, OPS-001–OPS-002, TST-001, TST-003, AC-AUT-006, AC-AUT-008–AC-AUT-009                                                         |
| 3     | [03 Exact-URL Capability Lifecycle](03_exact_url_capability_lifecycle.md)   | Make navigation invalidation and subscriber cleanup exactly once and preserve the canonical-URL/no-routing trust boundary.                                       | Packet 2                                                                                   | OUT-001, SCP-002, CMP-002–CMP-003, ARC-001, NAV-001–NAV-003, SEC-002–SEC-003, PRV-001, OPS-001–OPS-002, TST-001, TST-004, AC-AUT-007–AC-AUT-009                                                                                      |
| 4     | [04 Cross-Platform Remediation Gate](04_cross_platform_remediation_gate.md) | Add the focused Linux/Windows PR matrix and close the automated, privacy, compatibility, and manual merge gates.                                                 | Packets 1–3                                                                                | OUT-001, GAT-001, SCP-001–SCP-003, CMP-001–CMP-003, ARC-001–ARC-002, SEC-001–SEC-003, PRV-001, OPS-001–OPS-002, TST-001–TST-005, AC-AUT-001–AC-AUT-010, AC-MAN-001–AC-MAN-002                                                        |

## Sequencing And Ownership

- Execute exactly one packet per explicit `incremental-implementation` invocation. Verify it, update [todo.md](todo.md) and [handoff.md](handoff.md), present it for review, and stop.
- Packet 1 owns the internal response/stream interface change and therefore precedes every caller, renderer, or workflow gate that compiles the full project.
- Packets 2 and 3 own separate renderer and Electron-main state machines. Their order limits simultaneous changes around Local Whisper IPC while keeping either packet independently reviewable.
- Packet 4 changes the existing PR Checks workflow only after all focused commands and test paths exist. Its manual Linux and Windows gates are required before the workstream is complete.
- The process-owned main composition root, public IPC/preload/renderer DTOs, settings and journal schemas, package targets, dependencies, support matrix, and release procedures retain their existing owners and contracts.

## Approval Boundaries

- Plan approval is a Prompt MCP decision and does not authorize implementation.
- Execution authorization is a separate Prompt MCP decision. Without it, no packet may start.
- Commits, pushes, pull requests, qualification runs, releases, publishing, and installer changes remain outside this plan unless separately authorized.
