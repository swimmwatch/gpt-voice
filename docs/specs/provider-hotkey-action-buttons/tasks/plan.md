# Provider Hotkey Action Buttons — Implementation Plan

Status: Approved revision v3
Approval: Prompt MCP `approval.plan:v3`, 2026-08-13
Specification: [`../spec.md`](../spec.md) (`Status: Approved`)
Decision ledger: [`../decisions.yaml`](../decisions.yaml)

This is an ordered index. Each linked packet is the complete contract for one
reviewable increment. Plan approval and execution authorization are separate;
neither permits commits, pushes, pull requests, packaging, publishing, or more
than one packet per explicit `incremental-implementation` invocation.

| # | Task packet | Outcome | Depends on | Covered requirement / acceptance IDs |
| --: | --- | --- | --- | --- |
| 01 | [`01_action_eligibility_contracts.md`](./01_action_eligibility_contracts.md) | Define bounded provider/action identities plus pure fail-closed Provider Lock and contextual-action matrices. | Approved specification | OUT-003, OUT-007, SCOPE-002, SCOPE-006, SCOPE-007, FLOW-010, FLOW-011, ACTION-001, ACTION-003, ACTION-004, ACTION-010, ACTION-011, LOCK-001..LOCK-013, ARCH-007, ARCH-012, ARCH-013, FAIL-004..FAIL-006, FAIL-009, COMP-008, NON-007, AC-AUTO-005, AC-AUTO-020 |
| 02 | [`02_main_action_dispatch_and_ipc.md`](./02_main_action_dispatch_and_ipc.md) | Create one main-owned Prettify/Translation start-and-Cancel dispatcher shared by shortcuts, Escape, and trusted renderer commands, plus live action-state publication. | 01 | OUT-002, OUT-005, OUT-007, SCOPE-002, SCOPE-003, SCOPE-007, FLOW-003..FLOW-009, ACTION-002, ACTION-006, ACTION-007, ACTION-009, ACTION-010, ARCH-002, ARCH-003, ARCH-006, ARCH-008, ARCH-009, ARCH-011, ARCH-015, SEC-001..SEC-004, PRIV-001, PRIV-002, FAIL-001..FAIL-003, FAIL-009, COMP-001..COMP-003, COMP-008, COMP-009, AC-AUTO-007..AC-AUTO-009, AC-AUTO-021, AC-AUTO-022 |
| 03 | [`03_hotkey_action_button.md`](./03_hotkey_action_button.md) | Finish and freeze the approved reusable 114 × 32 provider key while explicitly excluding contextual footer-tile styling and props. | 01 | OUT-001, OUT-003, UI-004..UI-006, UI-008, UI-009, UI-015, UI-016, FLOW-001, MOTION-001..MOTION-014, A11Y-001..A11Y-009, ARCH-001, FAIL-001, NON-002, NON-003, NON-008, AC-AUTO-001..AC-AUTO-004, AC-AUTO-019 |
| 04 | [`04_home_screen_action_integration.md`](./04_home_screen_action_integration.md) | Wire provider keys, effective record/Stop/Cancel legends, live ownership/cancellability, and provider-neutral contextual descriptors into the unchanged home composition. | 01..03 | OUT-001..OUT-005, OUT-007, SCOPE-001..SCOPE-003, SCOPE-007, UI-001, UI-004, UI-006..UI-009, UI-016, FLOW-001..FLOW-010, ACTION-003, ACTION-005..ACTION-007, ACTION-009, ACTION-011, LOCK-002..LOCK-013, A11Y-001, A11Y-002, ARCH-003..ARCH-009, ARCH-012..ARCH-016, FAIL-001..FAIL-006, FAIL-009, COMP-001..COMP-003, COMP-009, NON-001..NON-003, NON-008, AC-AUTO-005, AC-AUTO-006, AC-AUTO-008, AC-AUTO-009 |
| 05 | [`05_recording_footer_and_cta_removal.md`](./05_recording_footer_and_cta_removal.md) | Remove the primary CTA, render provider-neutral contextual tiles/timer, and make Voice cancellation safe through transcription and retry while preserving lifecycle cleanup. | 04 | OUT-004, OUT-005, OUT-007, SCOPE-005, SCOPE-007, UI-010, UI-012, UI-013, UI-016..UI-021, FLOW-011, FLOW-012, ACTION-001..ACTION-011, LOCK-013, DEP-001..DEP-015, A11Y-006, A11Y-010..A11Y-012, ARCH-013, ARCH-016, ARCH-017, FAIL-009..FAIL-011, COMP-001, COMP-002, COMP-008, COMP-009, NON-004, NON-005, NON-008..NON-010, AC-AUTO-010, AC-AUTO-011, AC-AUTO-014, AC-AUTO-017, AC-AUTO-019..AC-AUTO-024 |
| 06 | [`06_compact_window_and_layout.md`](./06_compact_window_and_layout.md) | Make production exactly 620 × 292 and fit lifecycle status, prioritized timer/detail, and three compact tiles in the fixed 54px footer without changing provider keys or supporting windows. | 03..05 | OUT-004, SCOPE-004, UI-001..UI-003, UI-006, UI-007, UI-011..UI-021, ACTION-008, DEP-010, A11Y-006, A11Y-010..A11Y-012, ARCH-010, COMP-004..COMP-007, OPS-001, OPS-003, OPS-004, NON-001, NON-008, NON-009, AC-AUTO-012..AC-AUTO-015, AC-AUTO-017, AC-AUTO-019, AC-AUTO-024 |
| 07 | [`07_deterministic_browser_demo.md`](./07_deterministic_browser_demo.md) | Update the privilege-free 620 × 292 demo with the exact contextual-action matrix, timer/status priority, no megabytes, and unchanged production provider keys. | 03..06 | OUT-006, OUT-007, SCOPE-001, SCOPE-006, SCOPE-007, UI-002..UI-006, UI-008, UI-011, UI-014..UI-021, FLOW-011, FLOW-012, ACTION-001..ACTION-011, MOTION-001..MOTION-014, DEMO-001..DEMO-009, PRIV-001, PRIV-002, FAIL-007, FAIL-009, FAIL-011, NON-006, NON-008..NON-010, AC-AUTO-001..AC-AUTO-004, AC-AUTO-016, AC-AUTO-019, AC-AUTO-020, AC-AUTO-023..AC-AUTO-025, AC-MAN-001..AC-MAN-004 |
| 09 | [`09_hotkey_visual_parity.md`](./09_hotkey_visual_parity.md) | Make the approved deterministic demo key treatment the single shared production/provider-key visual baseline, with no semantic or layout change. | 03, 07 | OUT-001, OUT-003, OUT-006, UI-004..UI-006, UI-015, UI-016, UI-022, FLOW-001, MOTION-001..MOTION-014, A11Y-001..A11Y-009, ARCH-001, FAIL-001, NON-002, NON-003, NON-008, AC-AUTO-001..AC-AUTO-004, AC-AUTO-019, AC-AUTO-025, AC-MAN-005 |
| 08 | [`08_integration_and_desktop_qualification.md`](./08_integration_and_desktop_qualification.md) | Run cross-layer regression, privacy/documentation audits, browser evidence, and supported-desktop qualification for provider-specific Cancel, timer/status, exact tiles, and the demo-matched provider keys. | 01..07, 09 | OUT-001..OUT-007, SCOPE-001..SCOPE-007, SEC-001..SEC-004, PRIV-001, PRIV-002, FAIL-001..FAIL-011, COMP-001..COMP-009, OPS-002, OPS-005, NON-001..NON-010, AC-AUTO-018..AC-AUTO-025, AC-MAN-005..AC-MAN-013 |

## Cross-Cutting Contract Ownership

- `CUR-001`..`CUR-015` are approved discovery evidence, not implementation
  outcomes. Packets 02, 04, 05, and 06 name the affected code and replacement
  tests that those findings require.
- Packet 01 owns the pure eligibility matrix; packets 02 and 04 preserve main
  authority and reconcile renderer snapshots. It also defines the pure ordered
  contextual-action matrix; visual timers never become an action gate.
- Packet 02 owns the single canonical main entry point for normal Prettify,
  Translation, and their exact provider-specific Cancel commands. Packet 04
  owns Voice provider-key reuse of the renderer recording lifecycle and
  composes safe labels/callbacks; Voice remains absent from provider-home
  privileged start IPC.
- Packet 03 owns reusable key behavior and appearance. Packet 07 owns only
  deterministic demo fixture/interaction styles and must not fork production
  key logic. Packet 09 owns the requested visual-parity correction: it may
  change only the shared provider-key component stylesheet and its focused
  assertions, never demo-only visual CSS or key semantics. Contextual tiles
  retain their separate packet 05 component/style owner.
- Packets 05 and 06 jointly replace the old recording workspace assumptions:
  packet 05 removes the primary CTA, renders contextual actions/timer, and owns
  the atomic Voice transcription/retry Cancel expansion; packet 06 owns maximum
  three-tile density, fixed geometry, and startup fit.
- Packet 07 exercises every Voice/Prettify/Translation contextual state with a
  deterministic clock and no privileged work. Packet 08 owns actual desktop
  click/shortcut parity, late-result suppression, timer behavior, and platform
  evidence.
- Packet 08 verifies every explicit rejection case and performs the conditional
  README/help audit required by `OPS-005` after the shared visual baseline is
  restored by Packet 09.

## Sequencing And Review Boundary

Implement exactly one packet per explicit `incremental-implementation`
invocation. After verification, update [`todo.md`](./todo.md) and
[`handoff.md`](./handoff.md), present that packet for review, and stop. A later
explicit invocation may commit an already approved prior packet before opening
the next unchecked packet. Never treat approval of this plan or authorization
to begin execution as authorization to execute multiple packets.
