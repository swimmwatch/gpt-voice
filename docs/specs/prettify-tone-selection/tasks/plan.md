# Prettify Transformation Profiles — Implementation Plan

Status: Approved
Approval: Prompt MCP `approval.plan:v1`, 2026-07-30
Specification: [`../spec.md`](../spec.md) (`Status: Approved`)
Decision ledger: [`../decisions.yaml`](../decisions.yaml)

This plan is an ordered index only. Each linked packet is the complete
implementation contract for one reviewable increment. Plan approval does not
authorize implementation, commits, pushes, pull requests, packaging, or
publishing.

|   # | Task packet                                                                                                      | Outcome                                                                                                                                                                         | Depends on             | Covered requirement / acceptance IDs                                                                                                                                                                           |
| --: | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  01 | [`01_profile_domain_and_instructions.md`](./01_profile_domain_and_instructions.md)                               | Define the strict profile/catalog domain, the four immutable built-ins, shared search semantics, and deterministic effective-instruction composition.                           | Approved specification | OUT-001, OUT-002, SCOPE-003, CAT-001..CAT-005, PROF-001, PROF-002, PROF-005, DATA-001, DATA-003, SAFE-001..SAFE-004, UI-009, QUAL-002, AC-AUTO-001, AC-AUTO-003                                                |
|  02 | [`02_catalog_persistence_and_migration.md`](./02_catalog_persistence_and_migration.md)                           | Persist, migrate, normalize, repair, and atomically save the catalog/default/order with the legacy prompt projection.                                                           | 01                     | OUT-003, PROF-003..PROF-005, PROF-007, DATA-001..DATA-004, FAIL-001, COMP-001..COMP-004, COMP-006, PRIV-005, QUAL-002, AC-AUTO-001, AC-AUTO-002                                                                |
|  03 | [`03_provider_profile_execution.md`](./03_provider_profile_execution.md)                                         | Pass one explicit effective profile instruction through all providers, cache, audit, and diagnostics without changing provider controls or leaking content.                     | 01, 02                 | FLOW-004, FLOW-005, SAFE-001..SAFE-004, PRIV-001, PRIV-004, PRIV-005, FAIL-006, QUAL-002, QUAL-003, AC-AUTO-003..AC-AUTO-005, AC-AUTO-011                                                                      |
|  04 | [`04_selected_text_profile_orchestration.md`](./04_selected_text_profile_orchestration.md)                       | Refactor selected-text Prettify into chooser and quick-apply paths with early clipboard restoration, single flight, cancellation, and session-only selection memory.            | 02, 03                 | SCOPE-001..SCOPE-003, PROF-004, PROF-006, FLOW-001, FLOW-003..FLOW-006, ARCH-001, ARCH-003, PRIV-002, FAIL-002..FAIL-006, QUAL-002, AC-AUTO-007                                                                |
|  05 | [`05_chooser_window_and_ipc.md`](./05_chooser_window_and_ipc.md)                                                 | Add the single-instance trusted chooser window, active-display placement, operation-scoped typed IPC, and lifecycle integration.                                                | 04                     | PROF-006, UI-001, UI-005, ARCH-001..ARCH-003, PRIV-002, FAIL-002, FAIL-003, OPS-002, QUAL-002, AC-AUTO-008                                                                                                     |
|  06 | [`06_chooser_renderer_exact_design.md`](./06_chooser_renderer_exact_design.md)                                   | Implement the approved chooser UI exactly, including search, keyboard/focus behavior, responsive layout, localization, renderer entry, and packaged assets.                     | 01, 05                 | EVID-001, EVID-002, UI-002..UI-010, QUAL-001, QUAL-002, OPS-002, AC-AUTO-008, AC-AUTO-009, AC-MAN-001, AC-MAN-004, AC-MAN-005                                                                                  |
|  07 | [`07_quick_apply_shortcut.md`](./07_quick_apply_shortcut.md)                                                     | Add configurable Ctrl+F12 quick apply, route F12 to the chooser, and preserve every conflict, enablement, recording, translation, and reentry gate.                             | 04, 05, 06             | FLOW-002, FLOW-005, COMP-005, FAIL-002, FAIL-005, UI-008, UI-009, QUAL-002, AC-AUTO-006, AC-MAN-002                                                                                                            |
|  08 | [`08_profile_import_export_services.md`](./08_profile_import_export_services.md)                                 | Implement strict import/export documents, conflict planning, main-owned dialogs/filesystem, typed Settings-only IPC, and safe failures.                                         | 01, 02                 | PROF-003, PROF-005, PROF-007, DATA-001, DATA-003, DATA-004, PORT-001..PORT-005, ARCH-001..ARCH-003, PRIV-003..PRIV-005, QUAL-002, QUAL-003, AC-AUTO-001, AC-AUTO-010, AC-AUTO-011                              |
|  09 | [`09_settings_profile_management_exact_design.md`](./09_settings_profile_management_exact_design.md)             | Wire transactional profile CRUD/default/order/search/import/export into App Settings and reproduce the approved management design exactly.                                      | 02, 07, 08             | PROF-002..PROF-007, DATA-001..DATA-004, UI-004, UI-006, UI-008, UI-009, UI-011, UI-012, SAFE-004, PRIV-003, PORT-001..PORT-004, FAIL-001, QUAL-001, QUAL-002, AC-AUTO-009, AC-AUTO-010, AC-MAN-005, AC-MAN-006 |
|  10 | [`10_integration_privacy_docs_and_release_readiness.md`](./10_integration_privacy_docs_and_release_readiness.md) | Complete localization/privacy regression coverage, user documentation, production gates, and representative packaged Windows/Linux verification without changing release scope. | 01..09                 | OUT-001..OUT-003, SCOPE-001..SCOPE-003, COMP-004, COMP-005, PRIV-001..PRIV-005, QUAL-001..QUAL-004, OPS-001, OPS-002, AC-AUTO-011, AC-AUTO-012, AC-MAN-001..AC-MAN-007                                         |

## Cross-Cutting Contract Ownership

- The unnumbered **Profile Management Flow** is implemented by packets 02 and 09.
- The unnumbered **Provider And Cache Contract** is implemented by packets 01
  and 03.
- The unnumbered corrupt-catalog recovery paragraph is implemented by packet 02.
- The unnumbered import/export failure contract is implemented by packets 08
  and 09.
- Built-in output-only/fidelity behavior is implemented by packet 01.
- Presentation-only metadata and order remain cache-neutral through packets 01
  and 03.
- The shared Prettify enable/conflict contract is implemented by packet 07.
- The plain-text renderer contract is implemented by packets 06 and 09.
- README/help, downgrade guidance, and every **Explicit Rejection Case** are
  verified by packet 10.
- `EVID-001` and `EVID-002` are research evidence rather than executable
  requirements; packet 06 carries them only as visual/interaction context.

## Sequencing And Review Boundary

Implement exactly one packet per explicit `incremental-implementation`
invocation. After that packet is verified, update [`todo.md`](./todo.md) and
[`handoff.md`](./handoff.md), present it for review, and stop. A later explicit
invocation may commit an already approved prior packet before opening the next
unchecked packet. Never use approval of this plan as authorization to execute a
packet.
