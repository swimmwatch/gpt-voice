# 10 Integration, Privacy, Documentation, And Release Readiness

## Outcome

Finish the feature as one coherent product change: close remaining
localization/privacy/regression gaps, document user behavior and downgrade
safety, run the complete production quality set, and record representative
packaged Windows/Linux manual evidence. Do not change product scope, publish,
or release.

## Prerequisites

- Packets 01..09 are complete and approved.
- Read `AGENTS.md`, `todo.md`, `handoff.md`, all relevant sections of
  `docs/agent-guides/project-conventions.md`, and the approved specification
  acceptance/rejection sections.
- Inspect the aggregate diff, README/help, all locale catalogs, diagnostics/
  audit/logging/notification boundaries, webpack/package policy, and every
  directly affected test.
- This is verification/hardening/documentation, not permission to redesign or
  reopen implemented contracts.

## Owned Requirements

- OUT-001, OUT-002, OUT-003
- SCOPE-001, SCOPE-002, SCOPE-003
- COMP-004, COMP-005
- PRIV-001, PRIV-002, PRIV-003, PRIV-004, PRIV-005
- QUAL-001, QUAL-002, QUAL-003, QUAL-004
- OPS-001, OPS-002
- QUAL-003 / AC-AUTO-011
- QUAL-003 / AC-AUTO-012
- QUAL-004 / AC-MAN-001, AC-MAN-002, AC-MAN-003, AC-MAN-004,
  AC-MAN-005, AC-MAN-006, AC-MAN-007
- The unnumbered README/help, downgrade-warning, and every **Explicit Rejection
  Case** contract

## In Scope

- Final i18n key/placeholder parity and safe validation/error presentation.
- Cross-cutting privacy/logging/diagnostic/notification/provider/export tests.
- README/user-facing help and downgrade guidance.
- Full unit/type/lint/format/audit/build gates.
- Packaged asset/policy verification and documented Windows/Linux manual matrix.
- Narrow fixes found by these checks, within already approved packets.

## Out Of Scope

- New features, new provider, profile sharing/cloud, result preview, paste,
  main-window redesign, new dependency, new installer target, macOS policy
  change, version bump, release note, tag, publish, push, or PR.
- Replacing approved design or changing task packet boundaries.

## Task Contract

1. Audit every locale registered by `src/main/i18n` against English:
   - identical key sets;
   - identical named placeholders;
   - non-empty localized chooser, Settings, built-in metadata, hotkey,
     validation, repair, import/export, privacy, warning, conflict,
     confirmation, error, and announcement copy;
   - concise content/path-free errors;
   - longest translations usable at chooser 440×520 and Settings 440×520.
2. Extend privacy regression tests with unique synthetic canary values for
   source, result, profile name, description, instruction, import contents, and
   full ordered ID list. Assert canaries are absent from:
   - runtime/scoped renderer logs and safe errors;
   - metadata-only provider audit and cache diagnostics;
   - default diagnostics/exported diagnostics;
   - OS notifications and action status;
   - IPC validation/rejection errors;
   - import/export result objects;
   - provider request fields other than source plus selected effective
     instruction;
   - profile exports for order/default/provider/machine fields.
3. Confirm existing explicit local Prettify text capture remains independently
   opt-in and unchanged. Do not weaken/remove diagnostic controls to satisfy a
   privacy test.
4. Confirm chooser source is absent from persistence and cleared on every close
   path; chooser order is stable IDs only, never sent to providers/export or
   logged as a complete list.
5. Update `README.md` and any existing user-facing help location already owning
   Prettify documentation. Document in clear user language:
   - purpose is AI-prompt creation first and general dictated-text cleanup
     second;
   - exactly Prompt-ready, Polish, Professional, Natural and their purposes;
   - F12 opens source/profile chooser and requires Apply;
   - Ctrl+F12 runs explicit default without chooser;
   - both shortcuts are configurable and share Prettify enablement;
   - successful result goes to clipboard; no result review/automatic paste;
   - custom CRUD/default/order/search in App Settings > Prettify;
   - mixed built-in/custom order and search-disables-reorder behavior;
   - custom instructions/profile metadata are local plaintext but selected
     instructions plus source are sent to configured provider;
   - explicit plaintext JSON export, custom-only/no-order/default export, and
     Rename/Replace/Skip import;
   - upgrade migration: unchanged legacy prompt becomes Polish; custom legacy
     prompt becomes one custom default; new installs use Prompt-ready;
   - rollback projection and warning to export/back up custom profiles before
     downgrading and then modifying Prettify settings in an older release.
6. Do not claim Telegram/Apple compatibility, profile cloud sync, encryption,
   auto paste, provider fallback, or supported behavior absent from spec.
7. Audit production/build/package integration:
   - chooser HTML/JS entry exists and strict CSP is retained;
   - `scripts/packaged-runtime-policy.mjs` requires chooser assets;
   - `package.json` existing `dist/**/*` includes them;
   - no new dependency, extraResource, external service, provider, browser
     session, installer target, or release workflow;
   - Windows/Linux resource ownership and idempotent chooser shutdown are
     covered;
   - macOS release policy remains unchanged.
8. Run the complete required project quality set exactly:

   ```text
   rtk npm run typecheck
   rtk npm run test:types
   rtk npm run test:unit
   rtk npm run lint
   rtk npm run format:check
   rtk npm run audit:prod
   rtk npm run build:prod
   ```

   Do not suppress, skip, weaken, or snapshot-update away a real failure.

9. Re-run focused catalog/migration/instruction/providers/cache/shortcuts/
   selected-text/window/IPC/renderer/Settings/import-export/i18n/packaging
   suites when repairing a failure.
10. Audit every explicit rejection case and retain a test or manual evidence
    item proving:
    - selection alone never starts a request;
    - F12 is chooser and Ctrl+F12 is windowless quick apply;
    - one-off selection never changes default;
    - Prompt-ready invents no context/placeholders/clarification;
    - no profile translates or changes meaning;
    - custom instruction cannot override product/provider/process boundaries;
    - failure/cancel never overwrites restored/subsequently changed clipboard;
    - import is atomic, never replaces built-in/changes default/order;
    - export contains none of the forbidden data;
    - prohibited content never appears in logs/audit/default diagnostics/OS
      notifications;
    - main-window/voice/transcription behavior is unchanged;
    - order changes affect no content/default/selection/provider/cache;
    - chooser uses exact persisted mixed order without regrouping.
11. Narrow fixes discovered here stay inside an existing packet contract. If a
    failure requires changed behavior, public/IPC/privacy/compatibility
    contract, design deviation, dependency, or platform scope, stop and return
    to specification/planning.
12. Do not mark packaged/manual acceptance as passed without actual evidence.
    Record unavailable platform checks in `handoff.md` as outstanding manual
    gates, not inferred success.

## Contracts And Boundaries

- Repository documentation and code remain English; all app-visible copy is
  localized.
- Main owns privileged operations and renderer uses only typed
  `window.electronAPI`.
- No secrets/private user data are used for verification.
- This packet authorizes no commit, push, PR, tag, version, installer upload,
  publish, or release action.

## Expected Files Or Components

Expected changes only where gaps exist:

- `README.md`
- locale catalogs and `tests/main/i18n.test.ts`
- privacy/audit/diagnostic/IPC/notification tests directly affected
- `tests/scripts/webpackConfig.test.ts`
- `tests/scripts/packagedRuntimePolicy.test.ts`
- narrowly affected production files for verified defects
- `todo.md` and `handoff.md`

Do not add release notes, version changes, generated screenshots, packaged
artifacts, or installer binaries to the repository.

## Acceptance Criteria

- All 12 automated acceptance groups are covered and the required full quality
  set passes.
- README/help accurately documents the complete approved behavior/privacy/
  migration/downgrade contract.
- Every supported locale passes key/placeholder/safe-error parity and long-copy
  usability review.
- Privacy canary tests prove no prohibited content/order leakage and explicit
  diagnostic capture remains unchanged.
- Production build contains the chooser assets with strict trust/CSP and no
  dependency/package/release-scope expansion.
- Every explicit rejection case has automated or recorded manual evidence.
- Representative packaged Windows/Linux checks are passed or explicitly
  recorded as outstanding manual gates; nothing is fabricated.

## Verification

Required automated commands:

```text
rtk npm run typecheck
rtk npm run test:types
rtk npm run test:unit
rtk npm run lint
rtk npm run format:check
rtk npm run audit:prod
rtk npm run build:prod
```

When a local packaged build is explicitly authorized and the platform/runtime
is available:

```text
rtk npm run pack
rtk npm run verify:packaged
```

Platform installer verification remains a manual gate unless separately
authorized.

## Failure And Rollback

- A failed gate keeps packet 10 incomplete; record the exact failure and do not
  claim readiness.
- Privacy/security failures block completion and cannot be waived by removing
  assertions or content sanitization.
- Documentation/build-test-only changes can be reverted independently; never
  delete profile data or destructive-reset the worktree.
- If packaged verification creates artifacts, keep them untracked/outside the
  hand-authored diff and remove only exact known generated targets through the
  repository's safe cleanup workflow.

## Manual Gates

### Windows And Linux Packaged Matrix

- Select text in another app; F12 appears on active display with exact source;
  mouse/keyboard apply each built-in; generic status and clipboard output.
- Ctrl+F12 applies explicit default windowlessly; changed default is used next
  time without provider-setting changes.
- Escape, close, Manage, no/over-limit source, unavailable provider, timeout,
  cancel, and quit leave no source in clipboard/stale chooser.
- Multi-display placement/focus and small work-area fallback.
- 200 customs/long localized metadata, mixed persisted order, filtered order,
  keyboard navigation/reorder/search-disabled state, scrolling/default marker.
- Export plaintext warning/custom selection/no order; second-catalog import
  with Rename/Replace/Skip; local default/order preservation and append order.
- Main window, recording/transcription/retry/history, Translation, provider
  readiness/model actions, diagnostics controls, and unrelated hotkeys
  unchanged.

### Authorization Boundary

- `pack`, `verify:packaged`, platform installers, use of a second machine/VM,
  and any destructive cleanup are MANUAL GATE actions requiring appropriate
  environment and authority.
- Commit, push, PR, tag, publish, upload, release, and version changes are not
  authorized by this packet.

## References

Mandatory:

- Specification **Acceptance Criteria**, **Explicit Rejection Cases**,
  **Operations And Packaging**, **Compatibility And Migration**, and **Safety
  And Privacy**.
- [`plan.md`](./plan.md) for aggregate requirement mapping.
- [Approved design QA](../../../../design-qa.md) and both packet 06/09 mandatory
  design bundles for final fidelity evidence.
- `docs/agent-guides/project-conventions.md`.

## Completion And Handoff

After all automated checks and available manual gates:

1. Mark packet 10 complete only if its required automated criteria pass.
2. Update `handoff.md` with all completed packets, aggregate changed files,
   exact command results, platform evidence/outstanding gates, and no next
   implementation packet.
3. Present the completed workstream for review and stop. Do not commit, push,
   open a PR, package/publish further, or release.
