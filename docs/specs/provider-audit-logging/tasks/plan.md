# Implementation Plan: Provider Audit Logging, Diagnostics, And Runtime DI

Status: Approved through persistent Prompt MCP question `approval.plan`
revision 4 on 2026-07-27.

## Goal

Deliver correlated metadata-only provider audit lifecycles, bounded optional
diagnostic capture and export, and a repository-local analysis skill. Before
the remaining feature packets, migrate mutable runtime state into explicit
per-process composition roots without changing Electron trust boundaries,
provider behavior, IPC contracts, persistence schemas, or user-visible
results.

## Ordered Task Index

| Task                                                                                  | Outcome                                                                                                                    | Dependencies          | Covered IDs                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01 Provider audit core](01_define_provider_audit_core.md)                            | Main-only schema-v1 contracts, canonical sink, lifecycle state, severity, privacy guards, and exhaustive provider mappings | None                  | `OUT-001`; `SCOPE-001`; `BASE-001`; `ARCH-001`–`ARCH-003`; `AUD-001`–`AUD-007`; `PERF-001`; `SEC-001`–`SEC-003`; `FAIL-001`; `CFG-001`; `OPS-001`–`OPS-003`; `COMP-001`–`COMP-002`; `NONGOAL-001`–`NONGOAL-003`; core `AC-AUTO-001` |
| [02 Translation audit lifecycle](02_migrate_translation_audit_lifecycle.md)           | Google, Bing, and Yandex use the shared lifecycle from validation through cleanup and shutdown                             | 01                    | `SCOPE-002`; `TRANS-001`–`TRANS-004`; Translation `COMP-001`–`COMP-002`, `AC-AUTO-001`                                                                                                                                              |
| [03 Voice batch and browser lifecycle](03_audit_voice_batch_and_browser_lifecycle.md) | Voice registry/browser/session plus ChatGPT and OpenAI API batch operations are audited                                    | 01                    | `SCOPE-002`; `VOICE-001`–`VOICE-003`; `VOICE-006`; Voice batch `COMP-001`–`COMP-002`, `AC-AUTO-001`                                                                                                                                 |
| [04 Claude buffered and streaming voice](04_audit_claude_streaming_voice.md)          | Claude buffered/streaming operations reuse correlation, remain bounded, and terminate once                                 | 01, 03                | `VOICE-001`; `VOICE-004`–`VOICE-006`; streaming `AUD-002`, `PERF-001`, `AC-AUTO-001`                                                                                                                                                |
| [05 Prettify HTTP lifecycle](05_audit_prettify_http_lifecycle.md)                     | Prettify dispatch plus Ollama/vLLM readiness, model lifecycle, execution, cancellation, and cleanup are audited            | 01                    | `SCOPE-002`; `PRETTY-001`–`PRETTY-002`; `PRETTY-004`–`PRETTY-005`; HTTP `AC-AUTO-001`                                                                                                                                               |
| [06 Prettify CLI lifecycle](06_audit_prettify_cli_lifecycle.md)                       | Claude/Codex CLI availability, capability, execution, failures, cancellation, and cleanup are audited                      | 01, 05                | `SCOPE-002`; `PRETTY-001`; `PRETTY-003`–`PRETTY-005`; CLI `AC-AUTO-001`                                                                                                                                                             |
| [07 Diagnostic capture storage](07_build_diagnostic_capture_storage.md)               | Domain repository ports and SQLite adapters provide redaction, shared storage, retention, and deletion primitives          | 01                    | `ARCH-004`; `DATA-003`; `DATA-007`–`DATA-008`; `OPS-004`; `SEC-005`; `SEC-007`; `FAIL-002`–`FAIL-003`; storage `COMP-003`                                                                                                           |
| [08 Main composition root](08_create_main_composition_root.md)                        | A class-owned application graph replaces Task 07 persistence/transcription globals and owns IPC/shutdown state             | 07                    | `ARCH-004`; `COMP-003`; approved DI decisions                                                                                                                                                                                       |
| [09 Runtime and desktop DI](09_migrate_runtime_and_desktop_di.md)                     | Runtime loaders, config, locale, windows, tray, shortcuts, protocol, and desktop state become application-owned            | 08                    | Approved DI decisions; existing desktop/security compatibility contracts                                                                                                                                                            |
| [10 Voice and browser DI](10_migrate_voice_browser_di.md)                             | Voice/browser providers, audits, queues, caches, sessions, and streaming ownership enter the main graph                    | 08, 09                | Approved DI decisions; existing Voice/audit contracts                                                                                                                                                                               |
| [11 Translation DI](11_migrate_translation_di.md)                                     | Translation audit, registry, runtime, browser adapters, cache, and selected-text orchestration become graph-owned          | 08–10                 | Approved DI decisions; existing Translation/audit contracts                                                                                                                                                                         |
| [12 Prettify DI](12_migrate_prettify_di.md)                                           | Prettify HTTP/CLI adapters, audits, model/process ownership, caches, and selected-text orchestration become graph-owned    | 08–11                 | Approved DI decisions; existing Prettify/audit contracts                                                                                                                                                                            |
| [13 Main IPC and lifecycle DI](13_migrate_main_ipc_lifecycle_di.md)                   | All main IPC handlers, sender state, startup branches, and shutdown participants become application-owned                  | 08–12                 | Approved DI decisions; existing IPC/lifecycle/privacy contracts                                                                                                                                                                     |
| [14 Preload and renderer DI](14_migrate_preload_renderer_di.md)                       | Functional preload and React composition roots remove mutable renderer service/coordinator singletons                      | 08–13                 | `dependency-injection.process-boundaries`; existing preload/renderer contracts                                                                                                                                                      |
| [15 Project DI enforcement](15_enforce_project_di_boundaries.md)                      | Transitional stateful globals are removed and static architecture checks enforce the final boundaries                      | 08–14                 | All approved DI decisions and integrated compatibility/privacy coverage                                                                                                                                                             |
| [16 Audit Log settings and deletion](16_add_audit_log_settings_and_deletion.md)       | Default-off capture toggles, confirmed disable/purge, clear actions, trusted IPC, UI, and locale coverage                  | 07, 15                | `DATA-001`; `DATA-004`–`DATA-005`; `UI-004`–`UI-005`; `SEC-006`; settings `COMP-003`                                                                                                                                                |
| [17 Translation and Prettify capture](17_integrate_translation_prettify_capture.md)   | Every successful provider/cache action stores exactly one safe row when enabled                                            | 02, 05–07, 11, 12, 16 | `DATA-002`; `DATA-006`; `SEC-005`–`SEC-007`; `FAIL-002`–`FAIL-003`; capture `PRETTY-005`, `COMP-001`                                                                                                                                |
| [18 Diagnostics archive core](18_build_diagnostics_archive_core.md)                   | Valid audit events, safe manifest data, and enabled diagnostic rows are atomically written as ZIP or tar.gz                | 01, 07, 15, 16        | `SCOPE-003`; `EXPORT-001`–`EXPORT-005`; `SEC-004`–`SEC-005`; `SEC-008`; archive `OPS-001`                                                                                                                                           |
| [19 About diagnostics export](19_integrate_about_diagnostics_export.md)               | About-only trusted IPC owns save dialog, export orchestration, notifications, close, and retry                             | 18                    | `UI-001`–`UI-003`; additive IPC `COMP-003`                                                                                                                                                                                          |
| [20 Diagnostics analysis skill](20_create_diagnostics_analysis_skill.md)              | A validated repository skill inspects untrusted archives and produces a bounded evidence-linked report                     | 18                    | `SKILL-001`–`SKILL-005`; `SEC-009`; analysis `NONGOAL-001`                                                                                                                                                                          |
| [21 Integration gate](21_document_and_run_integration_gate.md)                        | Documentation, cross-surface privacy/regression coverage, dependency audit, and production build pass                      | 02–20                 | Remaining `SEC-001`–`SEC-009`, `COMP-001`–`COMP-003`, `NONGOAL-001`–`NONGOAL-003`, `AC-AUTO-001`                                                                                                                                    |
| [22 Sanitized manual verification](22_complete_sanitized_manual_verification.md)      | Authorized Linux/Windows checks prove the packaged flow with synthetic content                                             | 21                    | `AC-MAN-001` and sanitized manual acceptance                                                                                                                                                                                        |

## Sequencing And Ownership

```text
01 Audit core ─┬─> 02 Translation audit ───────────────┐
               ├─> 03 Voice batch ─> 04 Streaming ────┤
               ├─> 05 Prettify HTTP ─> 06 CLI ────────┤
               └─> 07 Repositories ─> 08 Main root ─> 09 Runtime/Desktop
                    └──────────────────────────────────> 10 Voice/Browser
                                                        -> 11 Translation
                                                        -> 12 Prettify
                                                        -> 13 Main IPC
                                                        -> 14 Preload/React
                                                        -> 15 Enforcement
                                                        -> 16 Settings ─┬─> 17 Capture
                                                                        └─> 18 Archive ─┬─> 19 About
                                                                                       └─> 20 Skill
                                                                                  17–20 -> 21 -> 22
```

- Main uses a class-owned manual composition root and constructor injection.
  Preload uses a pure API factory; renderer uses functional React providers and
  hooks. No container or dependency crosses an Electron process boundary.
- Stateful business services use domain repository interfaces. Concrete
  SQLite, HTTP, browser, CLI, and filesystem adapters own source-specific
  details and focused integration tests.
- No global container, service locator, decorator/reflection framework,
  mutable runtime singleton, or free pass-through dependency wrapper is
  permitted. Immutable constants, pure functions, readonly lookup structures,
  and React context declarations remain allowed.
- The application database coordinator exclusively owns SQLite connection,
  migrations, permissions, and close ordering. Repositories remain private to
  the main graph and never cross preload or renderer.
- Provider audit schemas, safe metadata mappings, provider results, retries,
  cache behavior, IPC channels, trusted-sender validation, and privacy
  guarantees remain unchanged throughout the DI migration.

## Risk, Rollback, And Gates

- Any privacy, lifecycle-order, process-boundary, persistence, or provider
  behavior regression blocks its packet. Rollback is code-only and never
  silently deletes stored data.
- The DI packets add no dependency and must not launch providers, browsers,
  credentials, personal data, packaging, publishing, or release workflows.
- Windows/Linux packaged checks, credential-backed provider exercises,
  overwrite confirmation, and analysis-skill installation remain explicit
  manual gates in their owning packets.
- Each incremental invocation executes exactly one authorized packet, updates
  `todo.md` and `handoff.md`, and stops uncommitted unless a later authorization
  explicitly covers an atomic boundary commit.

Coverage target: all 80 active requirement and acceptance IDs retain at least
one explicit owner; Tasks 08–15 additionally own the approved project-wide DI
architecture decisions.
