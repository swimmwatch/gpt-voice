# Global Hotkey Registration — Implementation Plan

Status: Approved
Revision: 3
Approval: Explicit `approve` recorded in the persistent Prompt MCP planning interview; revised Packet 01 execution authorization is recorded in the decision ledger, and no other packet is authorized
Specification: [`../spec.md`](../spec.md) (`Status: Approved`, `Revision: 2`)
Decision ledger: [`../decisions.yaml`](../decisions.yaml)

This is the ordered index. Each linked packet is the complete contract for one
reviewable increment. Plan approval, packet execution authorization, commits,
and cross-host source transport are separate decisions. Execute exactly one
packet per explicit `incremental-implementation` invocation and stop after
updating the checklist and handoff.

|   # | Task packet                                                                                                      | Outcome                                                                                                                                                                                                        | Depends on              | Covered requirement / acceptance IDs                                                                                                                                                                                  |
| --: | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  01 | [`01_nullable_persistence_and_shared_contracts.md`](./01_nullable_persistence_and_shared_contracts.md)           | Replace runtime shortcut defaults with nullable persistence and shared authority/effective-trigger/failure contracts, plus only the legacy controller/Settings null-compatibility bridges needed to typecheck. | Approved specification  | OUT-003, OUT-004, SCOPE-001, DATA-001..DATA-008, ARCH-005, COMP-001, COMP-002, ROLL-001, QUAL-001 / AC-AUTO-001                                                                                                       |
|  02 | [`02_platform_policy_and_registration_service.md`](./02_platform_policy_and_registration_service.md)             | Add adapter/policy abstractions and one query-verified, generation-safe registration owner with cleanup compensation and irreconcilable suppression.                                                           | 01                      | OUT-001, OUT-002, SCOPE-005, SCOPE-006, DATA-005..DATA-008, ARCH-001..ARCH-003, ARCH-005, FLOW-001..FLOW-006, FLOW-008..FLOW-010, FAIL-001..FAIL-004, SEC-002, SEC-004, QUAL-003, QUAL-006 / AC-AUTO-003, AC-AUTO-006 |
|  03 | [`03_shortcut_controller_and_composition.md`](./03_shortcut_controller_and_composition.md)                       | Compose the service as the sole registration/cleanup authority while preserving all action, lifecycle, and main-lock gates.                                                                                    | 02                      | SCOPE-004, ARCH-004, ARCH-006, ARCH-007, FLOW-001, FLOW-007, FLOW-009, SEC-001, SEC-003, COMP-003, COMP-004                                                                                                           |
|  04 | [`04_trusted_hotkey_ipc.md`](./04_trusted_hotkey_ipc.md)                                                         | Expose validated authority-aware query/event/set/clear/test IPC, migrate both renderer consumers, then remove old channels and fallback defaults atomically.                                                   | 03                      | OUT-001, DATA-005..DATA-008, FLOW-008, FLOW-009, IPC-001..IPC-003, FAIL-002, SEC-001..SEC-004, QUAL-004, QUAL-006 / AC-AUTO-004, AC-AUTO-006                                                                          |
|  05 | [`05_settings_registration_experience.md`](./05_settings_registration_experience.md)                             | Implement truthful Settings UX for application-known versus desktop-managed bindings, reconciliation failures, Apply, Remove, Test, localization, and accessibility.                                           | 04                      | OUT-001, OUT-004, SCOPE-002, UI-001, UI-006..UI-011, FAIL-001..FAIL-004, QUAL-005, QUAL-006 / AC-AUTO-005, AC-AUTO-006                                                                                                |
|  06 | [`06_main_window_status_and_demo.md`](./06_main_window_status_and_demo.md)                                       | Add nullable, authority-aware provider/contextual presentation and deterministic fixtures without changing action availability or 620 × 292 geometry.                                                          | 04, 05                  | OUT-001, OUT-005, SCOPE-004, UI-002..UI-007, UI-011, UI-012, COMP-003, QUAL-005 / AC-AUTO-005                                                                                                                         |
|  07 | [`07_linux_x11_registration_and_qualification.md`](./07_linux_x11_registration_and_qualification.md)             | After the platform-readiness gate, implement X11 application-authority policy and qualify real global grabs, compensation, suppression, and Test on the bound source digest.                                   | 01..06 + readiness gate | SCOPE-003, PLAT-003, COMP-004, QUAL-002, QUAL-009 / AC-AUTO-002, AC-MAN-002                                                                                                                                           |
|  08 | [`08_linux_wayland_portal_package_and_qualification.md`](./08_linux_wayland_portal_package_and_qualification.md) | Implement Wayland desktop-environment authority, pre-ready portal setup, canonical package/runtime identity, exact AppImage launcher migration, and GNOME/KDE/package qualification on the same source digest. | 01..07                  | OUT-003, SCOPE-003, PLAT-004..PLAT-007, COMP-004, COMP-005, DEP-001, DEP-002, QUAL-002, QUAL-007, QUAL-010 / AC-AUTO-002, AC-AUTO-007, AC-MAN-003                                                                     |
|  09 | [`09_windows_registration_and_qualification.md`](./09_windows_registration_and_qualification.md)                 | Implement Windows application-authority policy, reject F12 and every Super-modifier accelerator, and qualify real registration/compensation/Test on the same source digest.                                    | 01..08                  | SCOPE-003, PLAT-001, PLAT-002, COMP-002, COMP-004, QUAL-002, QUAL-008 / AC-AUTO-002, AC-MAN-001                                                                                                                       |
|  10 | [`10_documentation_and_aggregate_qualification.md`](./10_documentation_and_aggregate_qualification.md)           | Reconcile documentation and audit all authority, reconciliation, migration, security, rejection, automated, and bound host-evidence requirements.                                                              | 01..09                  | OUT-001..OUT-005, SCOPE-001..SCOPE-006, FAIL-001..FAIL-004, SEC-001..SEC-004, COMP-001..COMP-005, DEP-001, DEP-002, ROLL-001, QUAL-011 / AC-AUTO-008, DOC-001, all rejection criteria                                 |

## Sequencing And Ownership

- Packet 01 owns persisted null semantics, legacy normalization, target order,
  shared wire enums, authority/effective-trigger types, and validators. It also
  owns only two temporary compatibility bridges: null-skipping in the existing
  `ShortcutController` registration path (including Retry), and no-fallback
  Settings value rendering. It does not add a service, IPC, final UX, or
  platform behavior. Later packets consume those contracts rather than
  redeclaring them.
- Packet 02 is the sole platform-neutral owner of OS registration state,
  callback generations, query-verified cleanup, compensation, reconciliation,
  snapshots, suppression, and physical tests. Packet 03 composes that owner and
  preserves action/lifecycle gates without introducing another cleanup path.
- Packet 04 owns the main/preload/renderer trust-boundary migration. It replaces
  Packet 01's temporary Settings projection with authoritative runtime state,
  updates `useProviderHotkeyHomeIntegration`, and deletes capture/settings-only
  APIs and fallback defaults in the same increment. Final Settings and
  main-window presentation belong to Packets 05 and 06 respectively.
- Packets 07, 08, and 09 are host-bound and ordered X11, Wayland/package, then
  Windows. Evidence from one host never substitutes for another. Packet 08
  alone owns `src/main/linuxDesktopIntegration.ts`, pre-ready portal setup,
  canonical package/runtime identity, exact legacy launcher migration/removal,
  creation-before-registration ordering, and path-free desktop-integration
  logs. It does not alter release/publish policy.
- Packet 10 may repair only integration defects within Packets 01–09. It owns
  documentation, aggregate checks, evidence binding, and final rejection audit;
  it cannot rerun or waive a missing host packet from a different platform.
- Preserve all unrelated worktree changes. Every implementation handoff names
  only the packet's exact files/hunks; no plan packet authorizes broad staging.

## Manual Gate Before Packet 07 — Platform Execution Readiness

Packet 07 must not start until `handoff.md` records all of the following:

- access to supported native Linux X11, GNOME Wayland, KDE Wayland, a Linux
  AppImage/DEB/RPM packaging host, and native Windows x64;
- one evidence identity for the exact source under test: Git revision plus a
  SHA-256 digest of the working diff and explicit digest entries for any
  in-scope untracked source files;
- a rule that Packets 07–09 record that same identity and rerun affected host
  evidence whenever platform-owned source changes;
- separately granted authorization for any commit, push, archive, copy,
  synchronization, or other source transport needed between hosts.

Plan approval and a packet invocation do not authorize any commit or transport.
Unavailable access or unauthorized transport blocks Packet 07 without
invalidating the already completed platform-neutral packets.

## Review Boundary

After a packet passes its task-local checks, update [`todo.md`](./todo.md) and
[`handoff.md`](./handoff.md), present it for review, and stop. Do not commit,
push, transport source, open or modify a pull request, publish, or start another
packet without the separately required authorization. Packet 08 may build
untrusted local Linux installers as generated qualification artifacts; it may
not commit, sign, upload, publish, or release them.
