# 08 Integration And Desktop Qualification

## Outcome

Qualify the complete production and demo change across renderer, preload, main,
recording, selected-text, shortcuts, startup, localization, privacy, and fixed
layout. Run the full applicable quality set, audit user documentation and every
explicit rejection case, and record representative supported Linux/Windows
manual evidence for contextual action clicks/shortcuts, provider-specific
Cancel, transcription/retry cancellation, timer/status behavior, and unchanged
provider keys without changing release, packaging, provider, or data scope.

## Prerequisites

- Packets 01..07 are complete, individually approved, and committed or present
  as one reviewable ordered workstream under the repository handoff rules.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, and the **Project And
  Commands**, **Electron And Providers**, **Desktop, Browser, And Packaging**,
  and **Tests And Documentation** convention sections.
- Inspect the aggregate diff, all directly changed tests, relevant README/help
  references to recording controls, and CI workflows only to identify the
  established checks; do not alter release workflows.

## Owned Requirements

- OUT-001..OUT-007
- SCOPE-001..SCOPE-007
- SEC-001..SEC-004
- PRIV-001, PRIV-002
- FAIL-001..FAIL-011
- COMP-001..COMP-009
- OPS-002, OPS-005
- NON-001..NON-010
- AC-AUTO-018..AC-AUTO-025
- AC-MAN-005..AC-MAN-013
- Every explicit rejection case in the approved specification

## In Scope

- Cross-layer focused and full unit/type/lint/format/production-build gates.
- Regression coverage repair discovered only by integration.
- Privacy/log/payload and documentation audits.
- Exact browser recheck and supported desktop manual qualification.
- Compact evidence and final task/handoff state.

## Out Of Scope

- New features or design polish, dependency updates, migrations, live-provider
  tests with private content, installer changes, packaging/signing, release
  notes, versions, commits, pushes, pull requests, publishing, or deployment.
- Weakening a guard/test to make a check pass.

## Task Contract

1. Review the aggregate diff against every packet boundary and the approved
   specification. Remove accidental scope expansion and ensure current dirty
   work unrelated to this workstream remains untouched.
2. Run the full relevant focused tests together so interaction among click and
   hotkey entry points is covered: eligibility, hotkey component/timers,
   renderer subscriptions/rows/status/startup, recording lifecycle and cleanup,
   shortcut dispatcher, selected-text Prettify/Translation, trusted IPC,
   preload, settings enablement publication, main window, localization, demo
   isolation, contextual descriptors/tiles, timer, transcribing/retrying
   cancellation, focus recovery, and privacy/log redaction.
3. Add only missing regression tests needed for an observed integration gap.
   In particular prove mixed click/global-hotkey races cannot duplicate audio
   sessions, selection capture, provider work, clipboard writes,
   notifications, chooser instances, cancellation, or shutdown cleanup.
   Prove a late transcription/retry result after Cancel cannot publish text,
   history, clipboard, success status, retry, or notification.
4. Reconfirm startup/reload reconciliation obtains fresh hotkey, enablement,
   main-interaction, provider-transition, recording-lifecycle, and text-action
   action-specific owner/cancellability, and text-action activity state before
   unlocking or rendering tiles. Lost/reordered change events cannot unlock,
   press the wrong provider, or expose a stale Cancel tile.
5. Audit new payloads, errors, logs, tests, screenshots, and fixtures. They must
   contain no selected text, prompt/user document content, clipboard value,
   transcript/audio, provider secret, API key, cookie/session, account data, or
   private filesystem path. Provider Lock animation produces no routine logs.
6. Audit README/help/setup text for claims that the large primary Record/Stop
   control is the required workflow. Update only factually stale instructions;
   also correct claims that secondary controls are icon-only or Voice cannot be
   cancelled during transcription/retry. Leave shortcut/provider setup
   unchanged when already accurate. Do not add release notes.
7. Verify no persisted hotkey/provider/text-action format or default changed;
   Voice, Stop, Cancel, normal/quick Prettify, Translation, and retry shortcuts
   remain compatible. No schema/migration/provider interface/dependency exists.
8. Reopen the deterministic demo at 620 × 292, reconfirm document bounds,
   console cleanliness, no external requests, every provider contextual-action
   state, timer/status priority, no megabytes, default and lock/reduced-motion
   states, unchanged provider-key evidence, and leave it open for final review.
9. In Electron, execute the manual matrix with synthetic/non-sensitive input:
   saved label/enablement updates; Voice start/pause/resume; separate Stop;
   Prettify chooser; Translation; settings/provider/model locks; selected-text
   work; all recording states; combined reasons; success/failure/cancel/close;
   startup/retry; long locale/status; disconnected/invalid/permission/timeout;
   and stale/repeated/mixed input. Exercise pointer, Enter, Space, and matching
   shortcuts for Pause/Resume, Stop, and provider-specific Cancel. Cancel Voice
   during transcribing and retrying; cancel Prettify and Translation separately;
   verify exact tile insertion/removal and focus recovery.
10. Verify captured time starts at zero, advances only during recording,
    freezes during Pause, resumes without paused duration, yields to processing/
    error/recovery detail, resets on settlement, and does not announce every
    tick. Confirm no byte/megabyte display or hidden accessible placeholder.
11. Run representative checks on supported Linux and Windows. Native UI checks
    that cannot run in the current environment remain explicit **MANUAL GATE**
    evidence requirements; do not claim completion from browser emulation.
    The paused macOS release policy is unchanged and no macOS release gate is
    introduced.
12. Run the project quality set: strict typechecks, full unit suite, zero-warning
    lint, format check, production build, and diff hygiene. Investigate failures
    without modifying unrelated work or weakening security/lifecycle tests.
13. Audit every specification rejection case explicitly. A gating, cleanup,
    fixed-size, startup usability, or trusted-IPC regression blocks completion;
    subjective shadow polish does not justify weakening guards.

## Contracts And Boundaries

- Use deterministic fixtures and non-sensitive synthetic desktop input. Do not
  use credentials, personal browser profiles, private audio, or private text.
- Renderer remains capability-minimal; main owns privileged actions and exact
  sender validation.
- No release/packaging/publish action is authorized. A prior compatible build
  is the operational rollback; no data migration is needed.

## Expected Files Or Components

- Primarily tests and task artifacts.
- Update implementation only for a directly evidenced integration defect
  within packets 01..07; record the repair and rerun the owning packet checks.
- Update README/help documentation only if `OPS-005` finds a stale instruction.
- Update `docs/specs/provider-hotkey-action-buttons/tasks/todo.md` and
  `handoff.md` after all available checks/manual gates.
- Do not add screenshots containing user/private data or generated build output
  to the repository.

## Acceptance Criteria

- All focused and full applicable checks pass with no guard weakened.
- Production and demo remain exactly 620 × 292; all actions/locks/lifecycles,
  startup states, localization, and accessibility satisfy the approved
  contract.
- Click and global shortcuts share canonical behavior without duplicate work;
  the primary CTA never reappears and retained Stop/Pause/Resume/Cancel/retry
  behavior is proven.
- The provider hotkey buttons match their approved source/style/output baseline;
  only separate footer contextual actions changed.
- Exact Voice/Prettify/Translation tiles, provider-specific Cancel, safe
  transcription/retry cancellation, timer/status priority, focus recovery, and
  no-megabytes behavior are proven.
- IPC trust/payload and privacy/log audits pass.
- Documentation contains no stale mandatory-primary-CTA instruction.
- Linux/Windows manual evidence and every explicit rejection case are recorded,
  with unavailable platform gates clearly outstanding rather than inferred.
- `AC-AUTO-018`..`025` and `AC-MAN-005`..`013` are satisfied before the
  workstream is declared fully complete.

## Verification

- `rtk npm test`
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run lint -- --max-warnings 0`
- `rtk npm run format:check`
- `rtk npm run build:prod`
- `rtk git diff --check`
- Rerun all packet-focused commands when an integration repair changes their
  owned files.

## Failure And Rollback

- A duplicate operation, stale unlock, stuck key, lost cleanup, trusted-sender
  bypass, privacy leak, clipped/scrolling fixed window, or hidden startup retry
  blocks completion and triggers repair or rollback.
- If safe in-scope repair cannot restore the contract, stop with exact evidence
  and recommend reverting the affected packet(s); do not broaden scope.
- Operational rollback is installing a prior compatible build. Existing
  settings remain compatible and require no migration/recovery.

## Manual Gates

- **MANUAL GATE — AC-MAN-005:** Saved Voice/normal Prettify/Translation labels
  and enablement update in Electron without reopening main.
- **MANUAL GATE — AC-MAN-006:** Voice Start/Pause/Resume, normal Prettify
  chooser, Translation, and matching global shortcuts all work; the provider
  hotkey remains unchanged and Stop remains a separate compact tile/shortcut.
- **MANUAL GATE — AC-MAN-007:** Every settings/provider/model/text-action and
  recording lifecycle lock reason, combined reason, and terminal recovery is
  verified.
- **MANUAL GATE — AC-MAN-008:** Primary CTA is absent in all states while
  the exact Voice Pause/Resume, Stop, and Cancel tile matrix and matching
  shortcuts remain usable.
- **MANUAL GATE — AC-MAN-009:** Disconnected, invalid, permission, cancellation,
  timeout, stale, repeated, and mixed activation preserve failure/cleanup.
- **MANUAL GATE — AC-MAN-010:** Default, long locale/status, active/paused,
  processing, startup, and retry views fit on supported Linux and Windows.
- **MANUAL GATE — AC-MAN-011:** Prettify and Translation started by provider
  button and shortcut each show exactly one Cancel tile while cancellable;
  click/Escape cancel only the active owner and the tile disappears safely.
- **MANUAL GATE — AC-MAN-012:** Captured duration advances only during
  recording, freezes/resumes across Pause, yields to higher-priority status,
  resets on settlement, and has no tick-by-tick announcement or megabyte value.
- **MANUAL GATE — AC-MAN-013:** Saved record, Stop, and Cancel accelerators,
  including long/platform-specific names, update every tile without reload,
  overflow, or legend-driven dispatch.
- Any platform unavailable to the executing agent remains an explicit blocker
  or human evidence request; no credentials/private content may be requested.

## References

- Approved specification sections: **Security And Privacy**, **Failure And
  Recovery**, **Compatibility And Specification Precedence**, **Operations,
  Diagnostics, And Rollback**, **Non-Goals**, **Acceptance Criteria**, and
  **Explicit Rejection Cases**.
- Required conventions: **Project And Commands**, **Code And Logging**,
  **Electron And Providers**, **Desktop, Browser, And Packaging**, and **Tests
  And Documentation**.

## Completion And Handoff

Only after automated checks and every required available manual gate pass, mark
packet 08 complete and make `handoff.md` a compact final record of packets,
changed files, checks, manual/platform evidence, and blockers. Present the
workstream for review and stop. Do not commit, push, open a pull request,
package, publish, or release without separate explicit authorization.
