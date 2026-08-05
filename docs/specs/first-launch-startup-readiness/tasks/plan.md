# First-launch startup readiness plan

Status: Approved

| Order | Packet | Outcome | Depends on | Requirements |
| --- | --- | --- | --- | --- |
| 1 | [01 Startup preparation foundation](01_startup-preparation-foundation.md) | Establish the safe shared startup snapshot, generation-aware coordinator, and CloakBrowser preparation contract. | Approved specification | FLR-005–FLR-006, FLR-008–FLR-009, FLR-012–FLR-014, FLR-017 |
| 2 | [02 Unselected provider flow](02_unselected-provider-flow.md) | Make a new profile explicitly unselected while preserving existing and legacy provider selections. | 01 | FLR-001–FLR-004, FLR-016 |
| 3 | [03 Main startup orchestration and IPC](03_main-startup-orchestration-and-ipc.md) | Wire preparation, provider/translation initialization, retry, and safe snapshot publication into the main process. | 01, 02 | FLR-005–FLR-010, FLR-014, FLR-016–FLR-017 |
| 4 | [04 Loader state and interface](04_loader-state-and-interface.md) | Present merged startup status, truthful percentage, error recovery, and unselected provider controls in the renderer. | 01–03 | FLR-003, FLR-009–FLR-017 |

Safe sequence is 01 → 02 → 03 → 04. Each packet must pass its scoped checks and update [todo.md](todo.md) plus [handoff.md](handoff.md) before the next packet begins.
