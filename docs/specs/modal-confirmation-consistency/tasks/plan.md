# Implementation Plan: Cross-app Modal Confirmation Consistency

**Status:** Approved

**Specification:** [Approved modal-consistency contract](../spec.md)

| Order | Packet | Outcome | Depends on | Requirements |
| --- | --- | --- | --- | --- |
| 01 | [Shared confirmation foundation and Local Whisper](01_shared_confirmation_and_local_whisper.md) | Reusable confirmation composition, unified modal surface contract, and the repaired model/runtime removal flow. | None | `OUT-001`, `SCOPE-001`–`SCOPE-002`, `UI-001`–`UI-004`, `UI-006`, `FLOW-001`–`FLOW-004`, `A11Y-001`, `I18N-001`, `COMP-001`, `SAFE-001`, `OPS-001`, `NONGOAL-001` |
| 02 | [Migrate remaining confirmation flows](02_cross_app_confirmation_migration.md) | History, provider, Settings, diagnostic, and Prettify deletion confirmations use the shared contract. | 01 | `OUT-001`, `SCOPE-001`–`SCOPE-002`, `UI-001`, `UI-003`–`UI-004`, `FLOW-001`–`FLOW-004`, `A11Y-001`, `COMP-001`, `SAFE-001`, `OPS-001`, `NONGOAL-001` |
| 03 | [Normalize data-entry modals](03_data_entry_modal_normalization.md) | Dialog surface/action consistency, protected pending submission, and the single footer dismissal affordance. | 01, 02 | `OUT-001`, `SCOPE-001`–`SCOPE-002`, `UI-002`–`UI-005`, `FLOW-003`–`FLOW-004`, `A11Y-001`, `COMP-001`, `SAFE-001`, `OPS-001`, `NONGOAL-001` |

No packet authorizes a commit, push, package, release, data migration, or Electron IPC change.
