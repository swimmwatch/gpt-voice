# 08 Linux Wayland Portal, Package, And Qualification

## Outcome

On supported GNOME and KDE Wayland desktops plus a supported Linux packaging
host, implement the Wayland policy/factory branch, enable Electron's Global
Shortcuts Portal before ready, migrate the application-owned AppImage launcher,
align runtime/AppImage/DEB/RPM identity, and qualify approve/deny/restart/Test
behavior using real packaged artifacts.

## Prerequisites

- Packets 01..07 are complete and approved for continuation.
- The plan-level platform execution readiness gate remains satisfied and the
  exact source revision/diff digest from Packet 07 is available on both
  Wayland hosts and the packaging host through separately authorized transport.
- Execute interactive gates in supported native GNOME Wayland and KDE Wayland
  sessions, not X11, WSL, Wine, headless-only CI, or cross-compilation. Use a
  supported Linux packaging host for AppImage, DEB, and RPM inspection.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and the
  **Project And Commands**, **Electron And Providers**, and **Desktop, Browser,
  And Packaging** convention sections.
- Inspect Packet 07 Linux policy/factory, `desktopRuntimeController`, the
  synchronous pre-ready call in `main.ts`, `package.json`, installer verifier,
  and focused startup/package tests.

## Owned Requirements

- OUT-003
- SCOPE-003
- PLAT-004..PLAT-007
- COMP-004, COMP-005
- DEP-001, DEP-002
- QUAL-002, QUAL-007, QUAL-010 / AC-AUTO-002, AC-AUTO-007, AC-MAN-003

## In Scope

- Wayland factory selection using the existing Linux policy.
- Synchronous pre-ready portal feature and desktop identity.
- Runtime AppImage launcher creation, exact legacy migration/removal, startup
  ordering before shortcut registration, and path-free logging.
- electron-builder 26 desktop metadata for AppImage, DEB, and RPM.
- GNOME/KDE real Electron/package qualification and in-scope regressions.

## Out Of Scope

- Direct D-Bus/portal APIs, exact portal trigger-description claims, Windows/
  X11 reimplementation, new dependencies, package targets, macOS support,
  release/publish/signing/PR/workflow changes, or generated artifacts in Git.

## Task Contract

1. Reuse Packet 07's `LinuxHotkeyPlatformPolicy` through Packet 02's factory
   for `DesktopPlatform.Linux` + `LinuxSessionType.Wayland`; do not duplicate an
   identical Wayland policy class. Preserve X11 selection and fail closed for
   unknown Linux sessions.
2. A successful Wayland registration exposes `desktop-environment` binding
   authority and a null effective accelerator. The configured accelerator is
   retained only as a preferred trigger. Portal/compositor false, throw, or
   failed registration query maps only to
   `registration-rejected`; do not expose or invent portal owner,
   `trigger_description`, raw response, desktop identity internals, or native
   error payload.
3. Define/reuse one canonical desktop identity with exact value
   `com.swimmwatch.gptvoice`. On Linux, the synchronous
   `configureDesktopApplicationBeforeReady` path calls
   `app.setDesktopName('com.swimmwatch.gptvoice')` and sets Linux class to the
   same identity before `app.ready`.
4. Enable Chromium `GlobalShortcutsPortal` synchronously before ready. Read the
   existing `enable-features` switch value, split/trim comma-separated values,
   preserve their order and every unrelated non-empty feature, add the portal
   exactly once, and append the merged list. Do not overwrite features or add
   it on non-Linux.
5. Make pre-ready setup idempotent and test ordering before any
   `whenReady`/ready-owned operation. Do not defer portal setup behind Local
   Whisper/provider/bootstrap awaits.
6. At root `package.json`, set `desktopName` exactly to
   `com.swimmwatch.gptvoice`; set `build.linux.syncDesktopName` to true; set
   desktop `StartupWMClass` to the same value. Electron-builder 26 must emit
   `com.swimmwatch.gptvoice.desktop` for AppImage, DEB, and RPM.
7. Preserve executable/package names, appId, AppImage/DEB/RPM targets,
   categories, icons, dependencies, signing, workflows, versions, and release
   policy. Do not touch lockfile.
8. Update `src/main/linuxDesktopIntegration.ts` so runtime AppImage integration
   creates `com.swimmwatch.gptvoice.desktop` with canonical
   `StartupWMClass=com.swimmwatch.gptvoice`. The application lifecycle must
   await successful canonical launcher creation before starting shortcut
   registration.
9. After canonical creation succeeds, migrate by inspecting/removing only the
   exact application-owned legacy sibling `gpt-voice.desktop`; never use a
   glob, broad directory cleanup, substring match, or unrelated desktop entry.
   The explicit removal action cleans only the exact canonical and exact legacy
   filenames. A failed canonical write leaves the legacy entry untouched.
   Desktop-integration logs state only action, canonical identity, bounded
   result, and platform/session enum—never resolved paths.
10. Update installer verification to require the canonical desktop filename,
    `StartupWMClass`, and runtime identity for all three targets while retaining
    every existing metadata/security assertion.
11. Add automated tests for factory Wayland selection, unknown-session failure,
    portal feature merge/idempotence/pre-ready ordering/non-Linux exclusion, and
    exact builder/installer metadata. Add focused runtime-integration tests for
    canonical creation, creation-before-registration ordering, exact legacy
    migration after success, failed-write preservation, removal of both exact
    entries, unrelated-entry preservation, and path-free logs.
12. Execute AC-MAN-003 on both GNOME and KDE Wayland:
    - approve a free shortcut and invoke it once outside GPT-Voice;
    - deny/refuse a candidate and observe generic rejection with old/unrelated
      bindings preserved;
    - run physical Test without product action;
    - close/restart and verify authoritative configured/registered/failed state;
    - confirm desktop-environment-managed assignment behavior, null effective
      accelerator, managed UI copy, and physical Test without claiming the
      preferred configured trigger or exact portal wording is effective.
13. Build representative local AppImage, DEB, and RPM artifacts and run
    `npm run verify:installers`. Inspect only relative desktop-file roles and
    canonical identity. Do not commit packages, extracted trees, reports, or
    machine paths.
14. Use validated private temporary roots and exact test-owned helper/process
    cleanup. Record only desktop/session classification, target role, bounded
    enum result, binding authority, relative package role, canonical identity,
    evidence revision/diff digest, and pass/fail. Do not record environment
    contents, credentials, sessions, paths, selected text, clipboard, audio,
    transcripts, external owners, or raw portal errors.
15. Preserve unrelated worktree content and patch only scoped desktop-runtime,
    package, and hotkey startup ownership. Stop if implementation requires a
    dependency, package-target, support-policy, public protocol/API, or
    specification change.

## Contracts And Boundaries

- Electron globalShortcut/GlobalShortcutsPortal is the only production portal
  mechanism. No D-Bus dependency or shell probe.
- `app.setDesktopName` and feature switches are main-only and pre-ready.
- GNOME and KDE are two required executions of this one Wayland platform packet;
  X11/Windows evidence cannot substitute for either.
- Generated packages/evidence are private, local, and never committed or
  published.

## Expected Files Or Components

- Packet 02 policy factory and Linux session composition branch
- `src/main/appMetadata.ts` if it owns the canonical app ID
- `src/main/desktopRuntimeController.ts`
- `src/main/linuxDesktopIntegration.ts`
- `src/main/main.ts` only for the exact pre-ready signature/call
- `package.json`
- `scripts/verify-installers.mjs`
- `tests/main/desktopRuntimeController.test.ts`
- `tests/main/linuxDesktopIntegrationController.test.ts`
- Focused factory/package/build-config tests
- Task `todo.md` and `handoff.md`; no generated artifacts/evidence in Git

## Acceptance Criteria

- Factory selects the shared Linux policy for Wayland and fails closed for
  unknown sessions.
- Portal feature exists exactly once before ready and preserves unrelated
  features; non-Linux pre-ready behavior is unchanged.
- Runtime desktop name/class, builder desktopName, emitted desktop filename,
  and `StartupWMClass` all equal `com.swimmwatch.gptvoice`.
- Runtime AppImage integration creates the canonical launcher before shortcut
  registration, migrates/removes only the two exact application-owned names,
  preserves unrelated entries/failure recovery, and logs no paths.
- GNOME approve/deny/Test/restart and KDE approve/deny/Test/restart pass.
- AppImage/DEB/RPM installer verification passes with no target/dependency/
  workflow/release change.
- AC-AUTO-002/007 and AC-MAN-003 have bounded recorded evidence.

## Verification

- Packet 02 service/factory tests plus Packet 07 Linux policy tests.
- `node --import tsx --test tests/main/desktopRuntimeController.test.ts tests/main/linuxDesktopIntegrationController.test.ts tests/main/shortcutController.test.ts tests/main/hotkeyIpcContract.test.ts tests/renderer/appSettingsHotkeys.test.ts`
- Focused package/build-config/installer tests.
- GNOME and KDE production Electron/package qualification.
- `npm run verify:installers` against local AppImage/DEB/RPM artifacts.
- `npm run typecheck`
- `npm run test:types`
- `npm run lint -- --max-warnings 0`
- `npm run format:check`
- `npm run build:prod`
- `git diff --check`

## Failure And Rollback

- Late/absent portal setup, overwritten feature, incorrect package identity,
  retained/recreated legacy identity, broad or premature legacy deletion, path
  logging, false effective-trigger claims, false approval, old-binding loss,
  direct D-Bus, new dependency, or missing GNOME/KDE/package gate blocks
  completion.
- If electron-builder 26 does not emit the documented synchronized filename,
  stop with bounded extracted metadata; do not handcraft a second desktop file
  or upgrade the dependency without specification review.
- Rollback removes Wayland selection/portal/identity changes while retaining
  X11/Windows branches and null settings; Wayland then fails closed.

## Manual Gates

- **MANUAL GATE — AC-MAN-003 GNOME:** Complete approve, deny, Test, restart,
  external activation, and desktop-managed/null-effective verification on
  supported GNOME Wayland; bind evidence to the source revision/diff digest.
- **MANUAL GATE — AC-MAN-003 KDE:** Complete the same matrix on supported KDE
  Wayland and bind it to the same digest.
- **MANUAL GATE — package identity:** Build and inspect representative local
  AppImage, DEB, and RPM outputs with `npm run verify:installers`.
- Missing GNOME, KDE, or package-host evidence remains a blocker; no other
  platform or static config can substitute.
- Commits, pushes, source copying/synchronization, or other host transport need
  separate explicit authorization; plan or packet authorization does not grant
  it.

## References

- Specification anchors: **Platform Contracts** (`PLAT-004`..`PLAT-007`),
  **Acceptance And Qualification** (`QUAL-002`, `QUAL-007`, `QUAL-010`).
- Installed dependency authority:
  `package.json`/lockfile (`electron` `^43.1.1`, `electron-builder`
  `^26.15.7`),
  `node_modules/electron/electron.d.ts` (`app.setDesktopName`) and
  `node_modules/app-builder-lib/out/options/linuxOptions.d.ts`
  (`syncDesktopName`).
- Required conventions: **Project And Commands**, **Electron And Providers**,
  **Desktop, Browser, And Packaging**.

## Completion And Handoff

After automated checks, both Wayland desktop gates, and package verification
pass, mark only Packet 08 complete, record bounded evidence and exact files/
checks in `handoff.md`, set `Exact next packet: 09`, present the result, and
stop. Do not commit, push, publish, or start the Windows packet.
