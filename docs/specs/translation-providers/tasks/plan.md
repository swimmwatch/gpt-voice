# Implementation Plan: Translation Providers and Language Inventory Monitoring

Status: Approved

## Goal

Deliver an exhaustive Google/Bing/Yandex translation-provider architecture,
provider-specific target memory and main-screen Select controls, isolated
nonpersistent browser lifecycles, provider-aware selected-text behavior, and a
daily no-text language-inventory monitor. DeepL remains absent.

## Ordered Task Index

| Task                                                                                      | Outcome                                                                                                                                             | Dependencies | Covered IDs                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01 Shared contracts and inventories](01_define_translation_contracts_and_inventories.md) | Closed provider types, exact metadata, and reviewed runtime inventories pass baseline parity checks                                                 | None         | `LANG-001`–`LANG-006`; metadata portions of `GOOG-001`–`GOOG-003`, `BING-001`, `BING-003`–`BING-004`, `YNDX-001`, `YNDX-005`; `SEC-008`; inventory portions of `AC-AUTO-004` |
| [02 Base provider lifecycle](02_build_base_translate_provider_lifecycle.md)               | The shared lifecycle owns isolated contexts, submission, bounded readiness/results, cleanup, invalidation, and shutdown                             | 01           | `ARCH-001`–`ARCH-003`, `ARCH-005`–`ARCH-008`; `RUN-005`–`RUN-013`; `SEC-002`–`SEC-006`; `AC-AUTO-001`                                                                        |
| [03 Google provider](03_migrate_google_translate_provider.md)                             | Google public-page behavior is implemented as an unregistered subclass with deterministic fixtures                                                  | 02           | `GOOG-001`–`GOOG-007`; Google portion of `AC-AUTO-002`                                                                                                                       |
| [04 Bing provider](04_implement_bing_translate_provider.md)                               | Bing exact-value selection, readiness recovery, translation, and clearing are implemented with fixtures                                             | 02           | `BING-001`–`BING-007`; Bing portion of `AC-AUTO-002`                                                                                                                         |
| [05 Yandex provider](05_implement_yandex_translate_provider.md)                           | Yandex exact-code selection and one-shot contenteditable insertion are implemented with fixtures                                                    | 02           | `YNDX-001`–`YNDX-008`; `SEC-007`; Yandex portion of `AC-AUTO-002`                                                                                                            |
| [06 Registry, settings, and IPC](06_add_translation_registry_settings_and_ipc.md)         | Providers register exhaustively and typed settings migrate, repair, persist atomically, and cross trusted IPC without breaking the current renderer | 03, 04, 05   | `ARCH-004`; `SET-001`–`SET-007`; `COMP-004`; `AC-AUTO-003`, `AC-AUTO-005`                                                                                                    |
| [07 Selected-text runtime integration](07_integrate_selected_text_translation_runtime.md) | The hotkey flow snapshots provider settings, validates limits, routes through the registry, and preserves clipboard/cache behavior                  | 06           | `RUN-001`–`RUN-004`; integrated `ARCH-005`–`ARCH-008` and `RUN-005`–`RUN-013`; `SEC-001`–`SEC-006`; `COMP-001`–`COMP-003`; `AC-AUTO-006`; `AC-MAN-002`–`AC-MAN-003`          |
| [08 Main-screen Select controls](08_expose_translation_select_controls.md)                | Controlled provider and full-inventory language Selects persist authoritative settings and roll back failed saves                                   | 06, 07       | `UI-001`–`UI-009`; display-name portion of `AC-AUTO-004`; `AC-AUTO-007`; `AC-MAN-004`                                                                                        |
| [09 Inventory probe engine](09_build_translation_language_probe.md)                       | A deterministic no-text CloakBrowser probe produces complete sanitized language maps and diff fingerprints                                          | 01           | `OPS-002`–`OPS-007`, `OPS-009`, `OPS-012`; probe portions of `AC-AUTO-008`                                                                                                   |
| [10 Issue workflow and operator guidance](10_schedule_translation_language_monitor.md)    | A 06:00 UTC workflow creates or reuses one sanitized issue per provider+diff fingerprint                                                            | 09           | `OPS-001`, `OPS-007`–`OPS-012`; `DOC-005`; issue/workflow portions of `AC-AUTO-008`; implementation prerequisites for `AC-MAN-005`                                           |
| [11 Documentation and feature gate](11_document_and_verify_translation_providers.md)      | Documentation, full quality/privacy checks, and all authorized synthetic manual criteria complete the feature gate                                  | 01–10        | `DOC-001`–`DOC-004`; `COMP-005`; `AC-AUTO-009`–`AC-AUTO-010`; `AC-MAN-001`–`AC-MAN-006`                                                                                      |

## Sequencing

```text
01 -> 02 -> 03 ─┐
          -> 04 ─┼-> 06 -> 07 -> 08 ─┐
          -> 05 ─┘                    ├-> 11
01 -> 09 -> 10 ───────────────────────┘
```

- Tasks 03–05 may execute in any order after Task 02 but remain unregistered
  until all three pass and Task 06 begins.
- Task 06 owns the minimal renderer compatibility update required by its new
  settings IPC; Task 08 owns the final provider/full-language UI.
- Task 07 is the activation point that removes Google translation from the
  persistent voice-provider browser context.
- Task 09 may follow Task 01 independently. Task 10 alone owns the
  `issues: write` boundary.
- Task 11 requires every automated and manual acceptance criterion. Missing
  live-provider or repository authorization leaves it unchecked unless the
  approved specification is revised.

Coverage audit: all 111 active requirement and acceptance IDs have an explicit
owner in the numbered packets.

## Approval Boundary

Plan approval does not authorize implementation. Task 01 requires a separate
execution decision, and each later `incremental-implementation` invocation
executes exactly one authorized packet before stopping for review.
