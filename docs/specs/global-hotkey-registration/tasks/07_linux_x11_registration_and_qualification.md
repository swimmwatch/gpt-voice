# 07 Linux X11 Registration And Qualification

## Outcome

On a supported native Linux X11 desktop, implement the X11 platform-policy/
factory branch and qualify real Electron global grabs, independent startup,
transactional conflict rollback, suppression, and physical Test without using
Wayland, Windows, headless-only assertions, or CI as a substitute.

## Prerequisites

- Packets 01..06 are complete and approved for continuation.
- Execute this packet in a supported interactive Linux X11 desktop session,
  not Wayland, WSL, Wine, a headless server, or cross-compilation.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and the
  **Project And Commands**, **Electron And Providers**, and **Desktop, Browser,
  And Packaging** convention sections.
- Inspect Packet 02 policy/factory seams, production composition, and focused
  service/IPC/UI tests.

## Owned Requirements

- SCOPE-003
- PLAT-003
- COMP-004
- QUAL-002, QUAL-009 / AC-AUTO-002, AC-MAN-002

## In Scope

- `LinuxHotkeyPlatformPolicy` X11 selection and exact factory/composition branch.
- Linux session classification for X11 and fail-closed unknown session.
- X11-specific unit/integration tests and real Electron manual qualification.
- Exact test-owned X11 conflict helper and in-scope defect regressions.

## Out Of Scope

- Wayland portal/identity/packages, Windows policy, direct XGrabKey/Xlib/D-Bus,
  new dependencies, automatic fallback, external-owner detection, macOS,
  release/publish/signing/PR/workflow changes, or unrelated Linux work.

## Task Contract

1. Add the Linux policy behind Packet 02's base and register it in the factory
   for `DesktopPlatform.Linux` + `LinuxSessionType.X11`. Unknown/not-applicable
   Linux session fails closed as unsupported until Packet 09 adds Wayland.
2. Linux policy applies syntax/internal conflict rules but no Windows F12
   reservation. Accepted candidates use the same Electron adapter; false,
   throw, or failed `isRegistered` maps only to `registration-rejected`.
3. Detect X11 from bounded process-root session evidence and pass the enum into
   composition without logging raw environment. Do not probe the desktop by
   shell command or expose display/session values over IPC.
4. Prove factory selection is exact: X11 gets Linux policy; Wayland remains
   fail-closed pending Packet 09; Windows and paused macOS branches are
   unchanged.
5. Build a bounded helper only if needed to own one explicit synthetic global
   grab. Prefer an existing Electron helper. It must be spawned/terminated by
   exact handle/PID, use a private temporary root, and never inspect or
   terminate ambient window-manager/application processes.
6. Execute AC-MAN-002 in production/dev Electron:
   - a free combination registers and invokes exactly once while another X11
     application is focused;
   - the helper-owned combination produces generic rejection, retains the old
     binding and unrelated targets, and never names the helper/owner;
   - independent startup keeps successful targets if one grab fails;
   - Settings suppression retains OS grabs while blocking product actions;
   - Test detects a physical press without action execution;
   - Remove/restart preserve authoritative state.
7. Exercise a valid F12 combination to prove Linux does not apply the Windows
   reservation; its result is determined only by the real X11 grab.
8. Record only bounded target/accelerator class, enum results, session enum,
   and pass/fail. Do not record display values, paths, external identities,
   selected text, clipboard, audio, transcripts, credentials, or raw errors.
9. Fix every X11 defect within contract with a focused regression. Stop for a
   dependency, public API/protocol, support-policy, package-target, or
   specification change.

## Contracts And Boundaries

- Electron globalShortcut remains the only production grab mechanism.
- Linux policy does not claim which WM/application rejected a grab.
- X11 evidence cannot substitute for Wayland or Windows evidence.
- Test helpers own only the one synthetic grab and their exact child lifecycle.

## Expected Files Or Components

- Linux policy/session-classification module under the hotkey domain
- Packet 02 policy factory and composition branch
- Focused Linux/X11 policy/service/composition tests
- Bounded X11 qualification helper/script only if necessary
- Task `todo.md` and `handoff.md`; no generated evidence/artifacts in Git

## Acceptance Criteria

- Factory selects Linux policy only for X11 and fails closed for unknown/
  not-yet-enabled Wayland.
- Free grab, helper conflict rollback, independent targets, suppression, Test,
  F12 non-reservation, Remove, and restart pass on supported X11.
- No raw environment/native error/external owner escapes logs or IPC.
- AC-AUTO-002 Linux cases and AC-MAN-002 have bounded recorded evidence.

## Verification

- Packet 02 service/policy tests plus new Linux/X11 tests.
- `node --import tsx --test tests/main/shortcutController.test.ts tests/main/hotkeyIpcContract.test.ts tests/renderer/appSettingsHotkeys.test.ts`
- Linux X11 production Electron/dev build and bounded qualification harness.
- `npm run typecheck`
- `npm run test:types`
- `npm run lint -- --max-warnings 0`
- `npm run format:check`
- `npm run build:prod`
- `git diff --check`

## Failure And Rollback

- False owner claims, unrelated target loss, released grabs during Settings,
  product execution during Test, ambient-process action, or unsupported Wayland
  accidentally using X11 policy blocks completion.
- If Electron cannot demonstrate an X11 global grab in the supported session,
  stop with bounded reproduction; do not add Xlib or weaken the gate.
- Rollback removes the X11 factory branch; settings remain and Linux fails
  closed as unsupported.

## Manual Gates

- **MANUAL GATE — AC-MAN-002:** Complete every real X11 step in Task Contract 6
  plus the F12 non-reservation check.
- A headless/Wayland/CI result cannot replace the interactive X11 gate.

## References

- Specification anchors: **Platform Contracts** (`PLAT-003`), **Acceptance And
  Qualification** (`QUAL-002`, `QUAL-009`).
- Required conventions: **Project And Commands**, **Electron And Providers**,
  **Desktop, Browser, And Packaging**.

## Completion And Handoff

After automated checks and AC-MAN-002 pass, mark only Packet 07 complete,
record bounded X11 evidence and exact files/checks in `handoff.md`, set
`Exact next packet: 08`, present the result, and stop. Do not commit, push, or
start the Wayland packet.
