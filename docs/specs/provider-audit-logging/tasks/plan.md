# Implementation Plan: Provider Audit Logging And Diagnostics

Status: Approved

## Goal

Deliver a correlated, metadata-only audit lifecycle for every Voice, Prettify,
and Translation provider operation; optional bounded Translation/Prettify text
capture; a trusted About-window diagnostics export; and a safe repository-local
archive-analysis skill without changing provider, retry, cache, clipboard,
history, notification, or IPC result behavior.

## Ordered Task Index

| Task                                                                                            | Outcome                                                                                                                                                     | Dependencies       | Covered IDs                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01 Provider audit core](01_define_provider_audit_core.md)                                      | Main-only schema-v1 contracts, canonical sink, lifecycle state, severity, privacy guards, and exhaustive provider mappings are ready for family integration | None               | `OUT-001`; `SCOPE-001`; `BASE-001`; `ARCH-001`–`ARCH-003`; `AUD-001`–`AUD-007`; `PERF-001`; `SEC-001`–`SEC-003`; `FAIL-001`; `CFG-001`; `OPS-001`–`OPS-003`; `COMP-001`–`COMP-002`; `NONGOAL-001`–`NONGOAL-003`; core portion of `AC-AUTO-001` |
| [02 Translation audit lifecycle](02_migrate_translation_audit_lifecycle.md)                     | Google, Bing, and Yandex use the shared lifecycle from validation through cleanup and shutdown                                                              | 01                 | `SCOPE-002`; `TRANS-001`–`TRANS-004`; Translation portions of `COMP-001`–`COMP-002` and `AC-AUTO-001`                                                                                                                                          |
| [03 Voice batch and browser lifecycle](03_audit_voice_batch_and_browser_lifecycle.md)           | Voice registry/browser/session operations plus ChatGPT and OpenAI API batch transcription are fully audited                                                 | 01                 | `SCOPE-002`; `VOICE-001`–`VOICE-003`; `VOICE-006`; Voice batch portions of `COMP-001`–`COMP-002` and `AC-AUTO-001`                                                                                                                             |
| [04 Claude buffered and streaming voice](04_audit_claude_streaming_voice.md)                    | Claude Web buffered/streaming operations reuse correlation, remain bounded, and terminate exactly once                                                      | 01, 03             | `VOICE-001`; `VOICE-004`–`VOICE-006`; streaming portions of `AUD-002`, `PERF-001`, and `AC-AUTO-001`                                                                                                                                           |
| [05 Prettify HTTP lifecycle](05_audit_prettify_http_lifecycle.md)                               | Prettify dispatch plus Ollama/vLLM readiness, model lifecycle, execution, cancellation, and cleanup are audited                                             | 01                 | `SCOPE-002`; `PRETTY-001`–`PRETTY-002`; `PRETTY-004`–`PRETTY-005`; HTTP portions of `AC-AUTO-001`                                                                                                                                              |
| [06 Prettify CLI lifecycle](06_audit_prettify_cli_lifecycle.md)                                 | Claude/Codex CLI availability, capability, discovery, process execution, failures, cancellation, and cleanup are audited                                    | 01, 05             | `SCOPE-002`; `PRETTY-001`; `PRETTY-003`–`PRETTY-005`; CLI portions of `AC-AUTO-001`                                                                                                                                                            |
| [07 Diagnostic capture storage](07_build_diagnostic_capture_storage.md)                         | Domain repository ports and concrete SQLite adapters provide versioned redaction, strict shared storage, bounded retention, and deletion primitives         | 01                 | `ARCH-004`; `DATA-003`; `DATA-007`–`DATA-008`; `OPS-004`; `SEC-005`; `SEC-007`; `FAIL-002`–`FAIL-003`; storage portion of `COMP-003`                                                                                                           |
| [08 Audit Log settings and deletion](08_add_audit_log_settings_and_deletion.md)                 | Default-off capture toggles, confirmed disable/purge, clear actions, trusted IPC, UI, and locale coverage are complete                                      | 07                 | `DATA-001`; `DATA-004`–`DATA-005`; `UI-004`–`UI-005`; `SEC-006`; settings portion of `COMP-003`                                                                                                                                                |
| [09 Translation and Prettify capture integration](09_integrate_translation_prettify_capture.md) | Every successful provider or cache action stores exactly one safe row when enabled, without changing the action result                                      | 02, 05, 06, 07, 08 | `DATA-002`; `DATA-006`; `SEC-005`–`SEC-007`; `FAIL-002`–`FAIL-003`; capture portion of `PRETTY-005` and `COMP-001`                                                                                                                             |
| [10 Diagnostics archive core](10_build_diagnostics_archive_core.md)                             | Valid retained audit events, safe manifest data, and enabled diagnostic rows are atomically written as ZIP or tar.gz                                        | 01, 07, 08         | `SCOPE-003`; `EXPORT-001`–`EXPORT-005`; `SEC-004`–`SEC-005`; `SEC-008`; archive portion of `OPS-001`                                                                                                                                           |
| [11 About diagnostics export](11_integrate_about_diagnostics_export.md)                         | About-only trusted IPC owns save dialog, path, export orchestration, notification, close, retry, and localized UI state                                     | 10                 | `UI-001`–`UI-003`; additive IPC portion of `COMP-003`                                                                                                                                                                                          |
| [12 Diagnostics analysis skill](12_create_diagnostics_analysis_skill.md)                        | A validated repository skill safely inspects untrusted ZIP/tar.gz input and produces a bounded evidence-linked report                                       | 10                 | `SKILL-001`–`SKILL-005`; `SEC-009`; analysis portion of `NONGOAL-001`                                                                                                                                                                          |
| [13 Documentation and integration gate](13_document_and_run_integration_gate.md)                | Public privacy/diagnostics guidance, cross-surface privacy canaries, full tests, dependency audit, and production build pass                                | 02–12              | Remaining integrated coverage for `SEC-001`–`SEC-009`, `COMP-001`–`COMP-003`, `NONGOAL-001`–`NONGOAL-003`, and `AC-AUTO-001`                                                                                                                   |
| [14 Sanitized manual verification](14_complete_sanitized_manual_verification.md)                | Authorized Linux/Windows checks prove the packaged user flow and private archive-analysis workflow with synthetic content                                   | 13                 | `AC-MAN-001` and all sanitized manual acceptance bullets                                                                                                                                                                                       |

## Sequencing

```text
                         ┌-> 02 Translation ────────────────┐
                         ├-> 03 Voice batch -> 04 Streaming ┤
01 Provider audit core ──┼-> 05 Prettify HTTP -> 06 CLI ───┼-> 09 Capture integration ─┐
                         └-> 07 Storage -> 08 Settings ─────┘                           │
                                      └-> 10 Archive core -> 11 About export ───────────┼-> 13 -> 14
                                                          └-> 12 Analysis skill ────────┘
```

- Tasks 02, 03, 05, and 07 may proceed independently after Task 01.
- Task 04 reuses the Voice operation context and browser lifecycle established
  by Task 03.
- Task 06 extends the shared Prettify operation boundary established by Task 05
  so both packets do not independently refactor the same dispatch contracts.
- Task 09 is the only packet that writes diagnostic rows from successful user
  actions; provider-family packets expose correlation without storing text.
- Task 10 owns the `archiver` production dependency, archive contracts, log
  extraction, manifest, and atomic writer. Task 11 owns Electron UI/IPC only.
- Task 12 consumes the stable archive schema and does not import application
  runtime code or fixtures containing private data.

## Ownership And Integration Boundaries

- `src/main/providerAudit/` owns schema-v1 events, lifecycle state, mappings,
  canonical serialization, and the sole `provider-audit` logger scope.
- Provider and service modules own semantic phase/cause mappings but cannot
  pass arbitrary objects, messages, stacks, content, paths, URLs, or provider
  output to the sink.
- The shared app-database coordinator owns the SQLite connection, ordered
  migrations, permissions, and close lifecycle. Backend-neutral domain ports
  isolate business services from SQLite; concrete repositories own SQL, row
  mapping, and transaction mechanics. Diagnostic queries never join or delete
  transcription history.
- App Settings and About use distinct current-window trusted-sender/URL checks;
  renderer code receives typed results only and never a logger, row text,
  database handle, filesystem path authority, or archive writer.
- Archive creation uses one injected main-process `archiver` adapter. Analysis
  treats the resulting file as untrusted and remains a repository tool, not an
  application dependency.

## Global Risk, Rollback, And Platform Gates

- Privacy failures block the owning packet. Raw provider data is never accepted
  as a fallback when mapping, redaction, serialization, or storage fails.
- Audit rollback is code-only; log rotation remains authoritative. Diagnostic
  schema rollback leaves additive tables readable by SQLite and requires a
  separately authorized purge if retained plaintext must be removed.
- No packet may change retry/fallback policy, provider results, localized
  errors, cache behavior, clipboard behavior, history APIs, release versions,
  signing, or package targets.
- Windows ZIP and Linux tar.gz packaged checks, any credential-backed provider
  exercise, overwrite confirmation, and skill-creator installation are
  `MANUAL GATE` actions. No packet requests or records credentials.

Coverage audit target: all 80 active requirement and acceptance IDs in the
approved specification have at least one explicit packet owner.

## Approval Boundary

Plan approval does not authorize implementation. Task 01 requires a later,
separate `incremental-implementation` request and execution decision. Every
later invocation executes exactly one authorized packet, updates `todo.md` and
`handoff.md`, then stops for review.
