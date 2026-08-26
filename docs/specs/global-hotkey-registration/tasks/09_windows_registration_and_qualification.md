# 09 Windows Registration And Qualification

## Outcome

On a supported native Windows x64 desktop, implement the Windows platform
policy/factory branch and qualify real Electron global-shortcut registration,
reserved F12 and Windows/Super-modifier behavior, transactional replacement/
rollback, suppression, and physical Test without relying on Linux, CI, or
contract-only substitutes.

## Prerequisites

- Packets 01..08 are complete and approved for continuation.
- The plan-level platform execution readiness gate remains satisfied and the
  exact source revision/diff digest qualified by Packets 07/08 is available on
  the Windows host through separately authorized transport.
- Execute this packet on a supported native Windows x64 desktop in PowerShell,
  not WSL, Wine, cross-compilation, or Windows Server.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and the
  **Project And Commands**, **Electron And Providers**, and **Desktop, Browser,
  And Packaging** convention sections.
- Inspect Packet 02 policy/factory seams, production composition, Settings and
  provider-key state, and the focused service/IPC/UI tests.

## Owned Requirements

- SCOPE-003
- PLAT-001, PLAT-002
- COMP-002, COMP-004
- QUAL-002, QUAL-008 / AC-AUTO-002, AC-MAN-001

## In Scope

- `WindowsHotkeyPlatformPolicy` and exact factory/composition branch.
- Windows-specific pure and production integration tests.
- Real Windows Electron registration, cross-application activation, exact
  test-owned conflict helper, Settings result, restart, and physical Test.
- In-scope fixes/regressions discovered by Windows execution.

## Out Of Scope

- Linux X11/Wayland policy, portal/package identity, macOS support, new native
  dependencies/APIs, automatic fallback, external-owner detection, release,
  publish, signing, PR/workflow changes, or unrelated Windows work.

## Task Contract

1. Add `WindowsHotkeyPlatformPolicy` behind the Packet 02 abstract base and
   register its creator in `HotkeyPlatformPolicyFactory` only for
   `DesktopPlatform.Windows`.
2. Parse the normalized accelerator's primary non-modifier key and modifier
   set. Reject every F12 primary-key form and every accelerator containing the
   `Super` modifier as `os-reserved` before
   `GlobalShortcutAdapter.register` is called. This includes plain/modified F12
   and `Super` with any otherwise valid primary key. Do not reject F1–F11/F13+
   merely by range when `Super` is absent.
3. Syntax/internal conflict still precede adapter registration. Other Electron
   false/throw/query failure maps only to `registration-rejected` and never
   names an external owner or exposes a native message.
4. Preserve configured legacy F12 and Super-modifier values after startup.
   Their snapshot is `failed`/`os-reserved`, effective accelerator null,
   binding authority `none`, and repair controls remain available. Never delete
   or silently replace them.
5. Prove the production composition selects Windows policy on Windows and does
   not affect Linux/macOS factory branches. Do not add Win32 hooks or shell
   execution; continue using Electron's adapter.
6. Build a bounded qualification helper/harness only if existing Electron test
   infrastructure cannot own a second process. It may register one explicit
   synthetic accelerator, must report only bounded status, and must be started
   and stopped by exact process handle/PID. Never enumerate or terminate
   ambient processes.
7. Execute AC-MAN-001 in the production/dev Electron UI using synthetic data:
   - every representative F12 form and every representative Super-modifier
     form is rejected with the reserved localized explanation before adapter
     invocation;
   - a chosen free combination registers and invokes exactly once while another
     application is focused;
   - replacing a working binding with the exact helper-owned combination returns
     generic rejection, leaves old binding and unrelated targets working, and
     never shows the candidate as active;
   - opening Settings suppresses product callbacks without unregistering;
   - Test detects the physical press and does not run the action;
   - Remove and restart preserve authoritative unassigned/registered/failed
     states.
8. Successful Windows bindings expose the exact normalized effective
   accelerator with `application` authority. Use only a validated private
   temporary root for helper state/evidence. Record the source revision/diff
   digest but do not print environment contents, credentials, paths, selected
   text, audio, transcripts, clipboard, external process identity, or raw
   Electron errors.
9. Fix every Windows defect within the approved contract and add a focused
   regression. A dependency, public API/protocol, support-policy, package-target,
   or specification change is a blocker rather than an in-packet workaround.

## Contracts And Boundaries

- Windows policy is the only owner of the F12/Super reservation; renderer copy
  maps the bounded code and must not duplicate the rule.
- Electron adapter remains the only production registration mechanism.
- Manual evidence is classification-only: target role, accelerator class,
  expected/observed enum result, and pass/fail. No machine/user paths.
- A Windows pass cannot complete or substitute for Packets 07 or 08.

## Expected Files Or Components

- New Windows policy module under the Packet 02 hotkey domain
- Packet 02 policy factory and production composition wiring
- Focused Windows policy/service/composition tests
- A bounded Windows qualification script/test only if necessary
- Task `todo.md` and `handoff.md`; no generated logs/binaries/evidence in Git

## Acceptance Criteria

- Windows policy rejects all F12 primary-key variants and all Super-modifier
  accelerators before adapter invocation while preserving allowed non-Super
  F1–F11/F13+ behavior.
- Free real Electron registration/activation, helper conflict rollback,
  suppression, Test, Remove, and restart all pass on supported Windows.
- Existing F12/Super values persist visibly as configured-but-failed.
- No Linux/Wayland behavior or unrelated dirty work changes.
- AC-AUTO-002 Windows cases and AC-MAN-001 have bounded recorded evidence.

## Verification

- Packet 02 service/policy tests plus new Windows policy tests.
- `node --import tsx --test tests/main/shortcutController.test.ts tests/main/hotkeyIpcContract.test.ts tests/renderer/appSettingsHotkeys.test.ts`
- Windows production Electron/dev build and bounded qualification harness.
- `npm run typecheck`
- `npm run test:types`
- `npm run lint -- --max-warnings 0`
- `npm run format:check`
- `npm run build:prod`
- `git diff --check`

## Failure And Rollback

- Any F12 or Super-modifier adapter call, old-binding loss, false success,
  product callback during Test/suppression, ambient process action, or raw
  native detail blocks completion.
- If Windows denies all candidate-first registrations due an Electron contract
  mismatch, stop with a focused deterministic reproduction; do not unregister
  the old binding first or add an automatic fallback.
- Rollback removes the Windows factory branch; persisted values remain intact
  and fail closed as unsupported.

## Manual Gates

- **MANUAL GATE — AC-MAN-001:** Complete every real Windows step in Task
  Contract 7 on the supported native desktop and bind evidence to the source
  revision/diff digest.
- Any unavailable Windows capability remains a blocker. CI or source assertions
  cannot replace this gate.
- Commits, pushes, source copying/synchronization, or other host transport need
  separate explicit authorization; plan or packet authorization does not grant
  it.

## References

- Specification anchors: **Platform Contracts** (`PLAT-001`, `PLAT-002`),
  **Acceptance And Qualification** (`QUAL-002`, `QUAL-008`).
- Required conventions: **Project And Commands**, **Electron And Providers**,
  **Desktop, Browser, And Packaging**.

## Completion And Handoff

After automated checks and AC-MAN-001 pass, mark only Packet 09 complete,
record bounded Windows evidence and exact files/checks in `handoff.md`, set
`Exact next packet: 10`, present the result, and stop. Do not commit, push, or
start the aggregate packet.
