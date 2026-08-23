# `$watch-process` Implementation Plan

Status: Approved

Date: 2026-08-23

Revision: 1

Specification: [../spec.md](../spec.md) (`Status: Approved`, Revision 4)

Decision ledger: [../decisions.yaml](../decisions.yaml)

## Delivery Order

| Task                                           | Outcome                                                                                                              | Depends on | Owned requirements                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01](01_skill_surface_and_layout.md)           | Explicit skill surface, project-local tracked layout, runtime ignore boundary, and lifecycle preflight contract      | None       | `SCOPE-001`, `SAFE-001`, `IFACE-001`, `TIME-001`, `TIME-002`, `IFACE-003`, `OPS-001`, `OPS-002`, `OPS-004`, `SAFE-008`, `DATA-001`, `COMP-003`, `COMP-004`                 |
| [02](02_scenario_contract.md)                  | Dependency-free scenario schema, loader, normalization, migrations, substitutions, globs, and four complete examples | 01         | `ARCH-002`, `SCHEMA-001`, `SCHEMA-002`, `SCHEMA-003`, `SAFE-006`, `SAFE-007`, `SCOPE-002`, `PROV-002`                                                                      |
| [03](03_portable_runtime_core.md)              | Portable Node.js core contracts, process runner, polling, digests, evidence, and failure fingerprints                | 02         | `NODE-001`, `NODE-002`, `PLAT-001`, `DEP-001`, `DEP-002`, `ARCH-001`, `LIB-001`, `LIB-002`, `DATA-002`, `SAFE-006`, `PERF-001`                                             |
| [04](04_state_receipts_and_audit.md)           | Atomic state, locks, CAS generations, idempotent receipts, event journal, and attestation primitives                 | 03         | `DATA-003`, `SAFE-005`, `CONC-001`, `FLOW-005`, `GIT-001`, `GIT-002`, `ACCEPT-001`                                                                                         |
| [05](05_local_and_docker_adapters.md)          | Local-command and Docker adapters with owned process identity and safe cleanup                                       | 03, 04     | `ADAPT-001`, `ADAPT-002`, `COMP-001`, `PROV-004`, `PROV-005`, `SAFE-002`, `SAFE-004`                                                                                       |
| [06](06_generic_ci_adapter.md)                 | Provider-neutral strict JSON CI adapter without dedicated GitLab code                                                | 03, 04     | `ADAPT-001`, `ADAPT-002`, `PROV-002`, `PROV-003`, `SAFE-002`, `FLOW-005`, `GIT-001`, `GIT-002`                                                                             |
| [07](07_github_actions_adapter.md)             | GitHub run and composite PR adapters with exact-SHA, required-check, and idempotent dispatch proof                   | 03, 04     | `CUR-001`, `ADAPT-001`, `ADAPT-002`, `IFACE-002`, `PROV-001`, `SAFE-002`, `FLOW-005`, `GIT-001`, `GIT-002`                                                                 |
| [08](08_orchestrator_and_generated_watcher.md) | State machine, generated watcher, deterministic wait, terminal normalization, and fresh finalization                 | 05, 06, 07 | `OUT-001`, `FLOW-001`, `FLOW-002`, `GEN-001`, `GEN-002`, `FAIL-002`, `FAIL-003`, `FAIL-004`, `PERF-001`, `ACCEPT-001`                                                      |
| [09](09_stop_hook_and_recovery.md)             | Synchronous Stop hook, project-local registration, continuation transport, timeout, cancellation, and recovery       | 08         | `FLOW-003`, `HOOK-001`, `HOOK-002`, `OPS-002`, `OPS-003`, `IFACE-003`, `PERF-001`, `FAIL-002`, `FAIL-003`, `COMP-003`                                                      |
| [10](10_repair_verification_and_delivery.md)   | Bounded evidence-to-repair loop, forward-only patch ownership, verification, atomic delivery, and redispatch         | 08, 09     | `FLOW-004`, `FAIL-001`, `REPAIR-001`, `REPAIR-002`, `REPAIR-003`, `SAFE-003`, `SAFE-004`, `SAFE-007`, `SAFE-009`, `SAFE-010`, `DATA-002`, `FLOW-005`, `GIT-001`, `GIT-002` |
| [11](11_cross_platform_compatibility_ci.md)    | Separate required Node 22/24 × Linux/Windows/macOS workflow and policy coverage                                      | 10         | `COMP-002`, `NODE-002`, `PLAT-001`, `DEP-001`, `PROV-002`, `SAFE-006`                                                                                                      |
| [12](12_documentation_and_acceptance.md)       | Operator/author documentation, integration audit, manual acceptance, reviewer proof, and reversible installation     | 11         | `SCOPE-003`, `COMP-003`, `COMP-004`, `OPS-003`, `OUT-001`, `ACCEPT-001`                                                                                                    |

## Sequencing And Ownership

- Tasks 02–04 establish contracts used by every adapter; adapters may proceed only after those contracts are verified.
- Tasks 05–07 own disjoint adapter modules and fixtures. Task 08 is the first integration point that composes all four adapters.
- Task 09 owns `.codex/hooks.json` and the Stop-hook executable. No earlier task registers an incomplete hook.
- Task 10 is the only packet that authorizes implementation of repair, commit, normal push, or redispatch logic, and only within the scenario contract. It does not perform an external push during implementation.
- Task 11 owns the new compatibility workflow. The existing `.github/workflows/pr-checks.yml` and its `Quality Gates` check remain unchanged.
- Task 12 performs the final contract audit. External targets, hook trust, branch-protection changes, and real CI/Docker runs remain explicit manual gates.

## Plan Approval

This completed revision is approved by the explicit planning request. Approval authorizes no implementation, commit, push, hook trust, remote dispatch, or external-system change. Each executable packet requires a later explicit `incremental-implementation` invocation.
