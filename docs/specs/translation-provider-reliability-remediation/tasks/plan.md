# Implementation Plan: Translation Provider Reliability Remediation

Status: Approved

## Goal

Deliver one bounded, deterministic translation lifecycle for Google, Bing, and
Yandex; accelerate every provider's cold and warm successful result path without
weakening result quality; and prove Linux/Windows parity, privacy, and resource
ownership without changing renderer, IPC, settings, database, dependency, or
packaging contracts.

## Ordered Task Index

| Task                                                                                                              | Outcome                                                                                                                                                                                                                         | Dependencies | Covered IDs                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [01 Capture the controlled performance baseline](01_capture_controlled_performance_baseline.md)                   | Repeatable cold/warm fixtures record current application-controlled timing and browser-evaluation baselines for all providers before behavior changes                                                                           | None         | `OUT-004`; `PERF-001`, `PERF-004`–`PERF-005`; `SEC-009`; `OBS-007`; baseline portions of `ACC-019`, `ACC-021`                                                                                                                                                                                                                                                            |
| [02 Build the deadline and timeout contract](02_build_deadline_and_timeout_contract.md)                           | A main-owned, injected lifecycle primitive implements wall-clock budgets and deterministic terminal arbitration, while closed timeout, audit, localization, and connection mappings remain exhaustive                           | 01           | `TIME-005`–`TIME-008`; `ARCH-002`, `ARCH-007`–`ARCH-009`; `CONC-003`–`CONC-006`; contract portions of `FAIL-001`–`FAIL-003`; `SEC-002`–`SEC-003`, `SEC-009`; `OBS-001`–`OBS-005`; `COMP-001`–`COMP-003`, `COMP-005`; `CONF-001`–`CONF-002`; primitive portions of `ACC-001`, `ACC-008`–`ACC-010`                                                                         |
| [03 Integrate bounded operation and resource lifecycle](03_integrate_bounded_operation_and_resource_lifecycle.md) | The 60-second budget begins before registry dispatch, every terminal path receives bounded cleanup, and stale/quarantined browser ownership cannot leak, replay, or affect newer work                                           | 02           | `OUT-002`–`OUT-003`; `TIME-001`, `TIME-003`–`TIME-008`; `ARCH-001`–`ARCH-008`; `CONC-001`–`CONC-006`; `LIFE-001`–`LIFE-008`; `FAIL-001`–`FAIL-008`; `SEC-001`–`SEC-007`; `OBS-001`–`OBS-006`; `COMP-001`, `COMP-003`–`COMP-005`; `CONF-001`–`CONF-003`; `ACC-001`–`ACC-010`                                                                                              |
| [04 Accelerate provider result processing](04_accelerate_provider_result_processing.md)                           | Google, Bing, and Yandex use coherent result snapshots, evidence-gated fast acceptance, absolute result timing, efficient clear confirmation, and versioned fail-closed fallbacks                                               | 03           | `OUT-004`; `TIME-002`–`TIME-003`, `TIME-009`; `PERF-001`–`PERF-007`; `QUAL-001`–`QUAL-002`; `ARCH-007`–`ARCH-009`; `CONC-007`; `LIFE-003`–`LIFE-004`; `FAIL-004`–`FAIL-005`; `SEC-001`, `SEC-004`, `SEC-008`–`SEC-009`; `OBS-006`–`OBS-007`; `COMP-004`, `COMP-006`; `ACC-003`, `ACC-010`–`ACC-011`, `ACC-017`–`ACC-020`                                                 |
| [05 Close automated acceptance and privacy gates](05_close_automated_acceptance_and_privacy_gates.md)             | Cross-cutting races, user effects, privacy, composition, versioning, and baseline-versus-candidate performance pass the full deterministic repository gate                                                                      | 04           | `OUT-001`–`OUT-004`; `SCOPE-001`–`SCOPE-003`; integration coverage for `TIME-001`–`TIME-009`, `PERF-001`–`PERF-007`, `QUAL-001`–`QUAL-002`, `ARCH-001`–`ARCH-009`, `CONC-001`–`CONC-007`, `LIFE-001`–`LIFE-008`, `FAIL-001`–`FAIL-008`, `SEC-001`–`SEC-009`, `OBS-001`–`OBS-007`, `COMP-001`–`COMP-006`, `CONF-001`–`CONF-003`; `ACC-001`–`ACC-012`, `ACC-017`–`ACC-020` |
| [07 Enable selected-text translation cancellation](07_enable_selected_text_translation_cancellation.md)           | The existing Cancel hotkey safely cancels only the active selected-text Translation operation and reports its established renderer status without widening privileged contracts                                                 | 05           | `CONC-008`; `FAIL-009`; `SEC-010`; `ACC-022`                                                                                                                                                                                                                                                                                                                             |
| [08 Show Translation tray activity](08_show_translation_tray_activity.md)                                         | A cache-miss selected-text Translation provider run uses the existing processing tray indicator until its terminal cleanup settles, without changing direct IPC or packaged assets                                              | 07           | `UX-001`; `ACC-023`                                                                                                                                                                                                                                                                                                                                                      |
| [09 Google Translation copy then keyboard clear](09_google_translation_overwrite_and_reuse.md)                    | Google keeps immediate generation-proven results, acknowledges clipboard delivery, then sends focused `Control+A` and `Backspace` without post-clear polling before releasing the provider queue                                | 08           | `PERF-002`, `PERF-007`–`PERF-008`; `QUAL-001`, `QUAL-003`; `LIFE-003`–`LIFE-004`, `LIFE-009`; `FAIL-010`; `SEC-001`, `SEC-005`–`SEC-006`; `CONC-004`–`CONC-007`; `ACC-024`                                                                                                                                                                                               |
| [10 Translation provider switch readiness](10_translation_provider_switch_readiness.md)                           | Persisted Translation provider selection waits for selected-provider terminal readiness and an authoritative renderer snapshot while the existing inline checking state and cross-provider locks remain active                  | 09           | `ARCH-010`; `CONC-009`; `FAIL-011`; `ACC-025`                                                                                                                                                                                                                                                                                                                            |
| [06 Qualify supported packaged platforms](06_qualify_supported_packaged_platforms.md)                             | Representative Linux x64 and Windows x64 packages complete sanitized timeout, suspend, provider-success, tray-activity, Google overwrite/reuse, provider-switching, and before/after latency evidence; all gaps remain explicit | 10           | `OUT-001`–`OUT-004`; `TIME-004`–`TIME-005`; `PERF-001`, `PERF-004`–`PERF-005`, `PERF-008`; `LIFE-003`–`LIFE-009`; `SEC-001`, `SEC-006`–`SEC-010`; `COMP-001`–`COMP-002`, `COMP-006`; `UX-001`; `ACC-013`–`ACC-016`, `ACC-021`–`ACC-025`                                                                                                                                  |

## Sequencing

```text
01 -> 02 -> 03 -> 04 -> 05 -> 07 -> 08 -> 09 -> 10 -> 06
```

- Task 01 must record the current controlled baseline before any production
  translation behavior changes.
- Task 02 creates the lifecycle and closed contract surface but does not activate
  the 60-second translation behavior until Task 03.
- Task 03 is the reliability activation point and must complete before provider
  result-path optimization begins.
- Task 04 owns all Google/Bing/Yandex public-page result changes and the coordinated
  provider contract-version bump.
- Task 05 is the deterministic feature gate. It may repair only defects within the
  approved implementation surface and cannot weaken an assertion to obtain a pass.
- Task 07 adds explicit caller cancellation through the existing global Cancel hotkey
  without changing renderer, preload, IPC, settings, provider adapters, or direct
  translation IPC. It must complete before final supported-platform qualification.
- Task 08 adds an existing-tray-state presentation hook only for actual selected-text
  Translation provider work. It must complete before the final supported-platform
  qualification can observe that behavior.
- Task 09 is a Google-only overwrite-and-reuse exception to the prior universal
  visible-clear contract. It supersedes the uncommitted Copy-control readiness
  follow-up; it must complete before final supported-platform qualification.
- Task 10 serializes selected-provider settings readiness and keeps the existing
  inline switch presentation truthful through the authoritative connection snapshot.
  It must complete before final supported-platform qualification can observe the
  provider-switching boundary.
- Task 06 contains every external, packaged, suspend/resume, and live-provider
  `MANUAL GATE`. A missing Windows host, provider availability, or network evidence
  leaves the packet incomplete rather than weakening acceptance.

Coverage audit: all 109 active requirement and acceptance IDs have at least one
explicit owner in the numbered packets.

## Approval And Execution Boundary

The user explicitly instructed the planning agent not to ask additional questions
and delegated approval of the completed plan. That delegation and the agent's
post-audit approval are recorded in `../decisions.yaml` as
`planning.approval-delegation` and `approval.plan` revision 1.

Plan approval does not authorize implementation. Task 01 requires a later explicit
`incremental-implementation` invocation. Each invocation executes exactly one
authorized packet, updates `todo.md` and `handoff.md`, and stops for review without
committing or starting the next packet.
