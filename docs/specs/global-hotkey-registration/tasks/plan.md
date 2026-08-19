# Global Hotkey Registration — Implementation Plan

Status: Draft revision v1
Approval: Pending explicit user approval; Prompt MCP is unavailable in this session
Specification: [`../spec.md`](../spec.md) (`Status: Approved`)
Decision ledger: [`../decisions.yaml`](../decisions.yaml)

This is the ordered index. Each linked packet is the complete contract for one
reviewable increment. Plan approval and packet execution authorization are
separate. Execute exactly one packet per explicit `incremental-implementation`
invocation and stop after updating the checklist and handoff.

|   # | Task packet                                                                                                      | Outcome                                                                                                                                                                                                     | Depends on             | Covered requirement / acceptance IDs                                                                                                                                                                                  |
| --: | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  01 | [`01_nullable_persistence_and_shared_contracts.md`](./01_nullable_persistence_and_shared_contracts.md)           | Replace runtime shortcut defaults with nullable, enum-backed shared contracts and deterministic persistence/migration behavior.                                                                             | Approved specification | OUT-003, OUT-004, SCOPE-001, DATA-001..DATA-005, ARCH-005, COMP-001, COMP-002, ROLL-001, QUAL-001 / AC-AUTO-001                                                                                                       |
|  02 | [`02_platform_policy_and_registration_service.md`](./02_platform_policy_and_registration_service.md)             | Add platform-neutral adapter/policy abstractions and one transactional registration/test/snapshot owner, leaving supported-host policies to dedicated packets.                                              | 01                     | OUT-001, OUT-002, SCOPE-005, SCOPE-006, DATA-006..DATA-008, ARCH-001..ARCH-003, ARCH-005, FLOW-001..FLOW-006, FLOW-008, FLOW-009, FAIL-001..FAIL-004, SEC-002, SEC-004, QUAL-003, QUAL-006 / AC-AUTO-003, AC-AUTO-006 |
|  03 | [`03_shortcut_controller_and_composition.md`](./03_shortcut_controller_and_composition.md)                       | Delegate OS ownership and suppression from `ShortcutController` to the service while preserving every action/lifecycle gate; unsupported policy remains the safe production placeholder until host packets. | 02                     | SCOPE-004, ARCH-004, ARCH-006, ARCH-007, FLOW-001, FLOW-007, FLOW-009, SEC-001, SEC-003, COMP-003, COMP-004                                                                                                           |
|  04 | [`04_trusted_hotkey_ipc.md`](./04_trusted_hotkey_ipc.md)                                                         | Expose validated query/event/set/clear/test IPC and remove the capture-suspension channel.                                                                                                                  | 03                     | OUT-001, DATA-008, FLOW-008, FLOW-009, IPC-001..IPC-003, FAIL-002, SEC-001..SEC-004, QUAL-004, QUAL-006 / AC-AUTO-004, AC-AUTO-006                                                                                    |
|  05 | [`05_settings_registration_experience.md`](./05_settings_registration_experience.md)                             | Implement truthful Settings state, transactional Apply, Remove, Test, localized failures, and accessibility.                                                                                                | 04                     | OUT-001, OUT-004, SCOPE-002, UI-001, UI-006..UI-011, FAIL-001..FAIL-004, QUAL-005, QUAL-006 / AC-AUTO-005, AC-AUTO-006                                                                                                |
|  06 | [`06_main_window_status_and_demo.md`](./06_main_window_status_and_demo.md)                                       | Make provider/contextual actions nullable and registration-aware without changing action availability or 620 × 292 geometry; add deterministic demo fixtures.                                               | 04, 05                 | OUT-001, OUT-005, SCOPE-004, UI-002..UI-007, UI-011, UI-012, COMP-003, QUAL-005 / AC-AUTO-005                                                                                                                         |
|  07 | [`07_linux_x11_registration_and_qualification.md`](./07_linux_x11_registration_and_qualification.md)             | Implement the Linux X11 policy/factory branch and qualify real global grabs, conflict rollback, and Test on supported X11.                                                                                  | 01..06                 | SCOPE-003, PLAT-003, COMP-004, QUAL-002, QUAL-009 / AC-AUTO-002, AC-MAN-002                                                                                                                                           |
|  08 | [`08_linux_wayland_portal_package_and_qualification.md`](./08_linux_wayland_portal_package_and_qualification.md) | Implement the Wayland branch, pre-ready portal, canonical package identity, and GNOME/KDE packaged qualification.                                                                                           | 01..07                 | OUT-003, SCOPE-003, PLAT-004..PLAT-007, COMP-004, DEP-001, DEP-002, QUAL-002, QUAL-007, QUAL-010 / AC-AUTO-002, AC-AUTO-007, AC-MAN-003                                                                               |
|  09 | [`09_windows_registration_and_qualification.md`](./09_windows_registration_and_qualification.md)                 | Implement the Windows policy/factory branch and qualify real Electron registration, F12 rejection, rollback, and Test on supported Windows.                                                                 | 01..08                 | SCOPE-003, PLAT-001, PLAT-002, COMP-002, COMP-004, QUAL-002, QUAL-008 / AC-AUTO-002, AC-MAN-001                                                                                                                       |
|  10 | [`10_documentation_and_aggregate_qualification.md`](./10_documentation_and_aggregate_qualification.md)           | Reconcile documentation, run the platform-neutral aggregate quality set, audit rejection criteria, and bind the three host packet results.                                                                  | 01..09                 | OUT-001..OUT-005, SCOPE-001..SCOPE-006, FAIL-001..FAIL-004, SEC-001..SEC-004, COMP-001..COMP-004, DEP-001, DEP-002, ROLL-001, QUAL-011 / AC-AUTO-008, DOC-001, all rejection criteria                                 |

## Sequencing And Ownership

- Packet 01 is the only owner of persisted null semantics, legacy normalization,
  target ordering, and the wire enums. Later packets consume those contracts.
- Packet 02 owns platform-neutral OS registration state and transactional
  invariants in isolation. It defines the policy factory seam but no supported
  host policy. Packet 03 is the only owner of action callback/application
  lifecycle integration and uses fail-closed unsupported policy until packets
  07–09 add the host branches. `ShortcutController` never regains direct
  Electron ownership.
- Packet 04 owns the main/preload/renderer trust boundary. Packets 05 and 06
  consume only the validated preload API: Settings owns mutation UX, while the
  main window owns provider/contextual status presentation.
- Packets 07, 08, and 09 are deliberately host-bound and ordered for the
  requested development flow. Packet 07 runs first on supported Linux X11,
  Packet 08 runs next on supported GNOME and KDE Wayland plus a Linux packaging
  host, and Packet 09 runs later on a supported Windows desktop. A pass on one
  platform never substitutes for another platform packet.
- Packet 08 alone owns pre-ready portal setup and Linux package/runtime
  identity. It does not alter release/publish policy.
- Packet 10 may repair only integration defects within packets 01–09. It owns
  user documentation, platform-neutral aggregate checks, evidence binding, and
  final rejection audit; it does not rerun or waive missing host packets.
- Existing unrelated Local Whisper changes are preserved. Packets 03 and 08
  may overlap the currently dirty `src/main/main.ts`; implementation must stage
  and review only hotkey/desktop-runtime hunks and not rewrite those changes.

## Review Boundary

After a packet passes its task-local checks, update [`todo.md`](./todo.md) and
[`handoff.md`](./handoff.md), present it for review, and stop. Do not commit,
push, open or modify a pull request, publish, or start another packet without
the separately required authorization. Packet 08 alone may build untrusted
local Linux installers as generated qualification artifacts; it may not commit,
sign, upload, publish, or release them.
