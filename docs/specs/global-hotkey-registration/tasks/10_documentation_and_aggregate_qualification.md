# 10 Documentation And Aggregate Qualification

## Outcome

Reconcile user documentation, audit the aggregate implementation and every
rejection criterion, run the platform-neutral full project quality set, and
bind the already completed Windows, Linux X11, and Linux Wayland/package
evidence to the same revision/diff digest in the final handoff. Do not replace
or rerun a missing host packet from the wrong platform.

## Prerequisites

- Packets 01..09 are complete, including bounded AC-MAN-002 X11, both
  GNOME/KDE plus package AC-MAN-003, and later AC-MAN-001 Windows evidence.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and all
  project-convention sections except unrelated provider-specific guidance.
- Inspect the aggregate hotkey diff, directly changed tests, README hotkey
  section, and established project commands. Do not load unrelated Local
  Whisper specs or modify release workflows.

## Owned Requirements

- OUT-001..OUT-005
- SCOPE-001..SCOPE-006
- FAIL-001..FAIL-004
- SEC-001..SEC-004
- COMP-001..COMP-005
- DEP-001, DEP-002
- ROLL-001
- QUAL-011 / AC-AUTO-008
- DOC-001
- Every explicit rejection criterion in the approved specification

## In Scope

- Aggregate diff/requirement/rejection/evidence audit.
- User documentation for first-run assignment and platform behavior.
- Missing integration regressions discovered by platform-neutral aggregate run.
- Full types/lint/format/unit/build and existing package-policy checks that do
  not require regenerating host artifacts.
- Final checklist and handoff state.

## Out Of Scope

- Reimplementing/rerunning Windows, X11, or Wayland qualification on another
  platform; waiving missing host evidence; new features/design polish;
  dependencies; native shortcut libraries; direct D-Bus; provider/protocol or
  support-policy changes; versions, signing, publishing, releases, PR/workflow
  dispatch, or macOS qualification.

## Task Contract

1. Refuse to start finalization unless Packets 07, 08, and 09 each contain
   bounded successful evidence from their required hosts. A unit/CI pass or one
   Linux session cannot substitute for another host packet.
2. Review the aggregate diff against every packet and requirement. Preserve
   unrelated worktree content and remove accidental hotkey scope expansion.
   Confirm no default accelerator remains in production startup, config,
   Settings, main-window, or fallback code.
3. Update README/user-facing documentation: clean installs begin with all seven
   shortcuts unassigned; in-app actions still work; explain assignment,
   registration states/authority, Remove, five-second Test, generic conflicts,
   Windows F12 and Super-modifier reservations, Wayland system approval/
   desktop-environment management, and AppImage legacy-launcher migration. Do
   not claim an exact Wayland effective trigger, external-owner detection, or
   guaranteed portal wording.
4. Run all packet-focused automated suites together, then the full project
   unit/type/lint/format/production-build and existing static package-policy
   checks. Add only regressions for observed integration defects and rerun the
   owning packet checks after repair.
5. Prove startup/reload/event reordering: valid legacy strings remain, nulls
   stay null, registration attempts are independent, failed candidate retains
   old config/binding/UI, verified cleanup and compensation never leave an
   executable stale generation, irreconcilable cleanup is suppressed/
   `ReconciliationFailed`, suppression precedes renderer feedback, and stale
   query/event completion cannot regress state.
6. Prove every in-app provider/contextual action remains independently usable
   by pointer, Enter, and Space when unassigned/failed and otherwise eligible.
   Registration state remains distinct from provider readiness and fixed
   620 × 292 / 114 × 32 layout assertions remain green.
7. Audit logs, diagnostics, IPC, fixtures, and handoff evidence. Retain only
   target, enum status/failure, normalized accelerator, bounded platform/
   session, binding authority, revision/diff digest, relative package role,
   canonical identity, and pass/fail.
   Exclude environment, credentials, sessions, external owners/processes, user
   paths, selected text, clipboard, audio, transcripts, and raw native errors.
8. Audit every rejection criterion explicitly. Any default registration, false
   registered state, failed rollback, Settings unregister, unrelated target
   loss, Windows F12/Super adapter call, false Wayland effective trigger,
   disabled null in-app action, provider/shortcut ambiguity, missing portal/
   canonical runtime AppImage migration, sensitive evidence, new dependency,
   or release-policy change blocks completion.
9. Verify dependency/lockfile/package-target/release-workflow scope is unchanged.
   Do not regenerate or commit packages/evidence.
10. Confirm Packet 08 tests and evidence cover canonical
    `com.swimmwatch.gptvoice.desktop` creation before shortcut registration,
    exact post-success `gpt-voice.desktop` removal, exact two-name removal
    action, unrelated-entry preservation, and path-free logs.
11. Record exact automated results and references to the three bounded host
    packet sections plus their common revision/diff digest in `handoff.md`; do
    not duplicate raw logs or machine paths.

## Contracts And Boundaries

- Main remains sole privileged owner; renderer uses validated preload only.
- Platform evidence is immutable input from completed Packets 07–09. If a later
  repair touches a platform-owned file/invariant, reopen and rerun that exact
  host packet rather than asserting it remains valid.
- Operational rollback is a prior null-tolerant compatible build; no migration
  or default restoration occurs.
- Paused macOS release policy remains unchanged.

## Expected Files Or Components

- `README.md` and only directly stale user documentation
- Aggregate/focused tests and implementation files only for an evidenced defect
  within Packets 01..09
- `docs/specs/global-hotkey-registration/tasks/todo.md`
- `docs/specs/global-hotkey-registration/tasks/handoff.md`
- No generated binaries, installers, logs, archives, screenshots, environment
  dumps, helper payloads, or machine-specific paths

## Acceptance Criteria

- Every automated acceptance ID and explicit rejection criterion passes.
- Packets 07–09 already contain successful required-host evidence; none is
  inferred or waived in this packet.
- README accurately documents unassigned first run, status, Remove/Test,
  Windows F12/Super reservations, generic conflicts, Wayland managed behavior,
  and AppImage launcher migration.
- Full project quality set passes without weakening any gate.
- All ten packets are checked and final handoff states
  `Exact next packet: none`.

## Verification

- All focused automated commands from Packets 01..09.
- `npm test`
- `npm run typecheck`
- `npm run test:types`
- `npm run lint -- --max-warnings 0`
- `npm run format:check`
- `npm run build:prod`
- Existing package/build-config policy tests.
- `git diff --check`

## Failure And Rollback

- Fix only defects within the approved contract and add a focused regression.
  If repair touches a platform-owned invariant, reopen its packet on the exact
  required host and rerun its manual/automated gates before finalization.
- If repair needs a dependency, public protocol/API, supported platform,
  package target, release policy, or specification change, stop with the exact
  blocker.
- Missing platform evidence is a blocker, never an excuse to infer completion.

## Manual Gates

- No new cross-platform execution gate. Confirm the completed handoff contains:
  - Packet 07 supported Linux X11 AC-MAN-002 evidence;
  - Packet 08 supported GNOME and KDE Wayland plus AppImage/DEB/RPM AC-MAN-003
    evidence;
  - Packet 09 supported Windows AC-MAN-001 evidence.
- Confirm all host evidence cites the same source revision/diff digest and that
  any transport between hosts had separate authorization.
- If an aggregate repair invalidates any item, that exact platform packet must
  be rerun before Packet 10 can complete.

## References

- Approved specification anchors: **Acceptance And Qualification**,
  **Rejection Criteria**, and requirement sections mapped above.
- Required conventions: **Project And Commands**, **Code And Logging**,
  **Electron And Providers**, **Dependency Injection And Runtime Ownership**,
  **Desktop, Browser, And Packaging**, **Tests And Documentation**, **Git And
  Releases**.

## Completion And Handoff

Only after aggregate checks and evidence audit pass, mark Packet 10 and the
workstream complete. Make `handoff.md` a compact final record of all packets,
exact changed-file scope, checks, bounded platform evidence, blockers, and
`Exact next packet: none`. Present the result and stop. Do not commit, push,
open/modify a pull request, dispatch workflows, sign, publish, or release
without separate explicit authorization.
