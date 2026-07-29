# 09 Migrate Desktop Controllers DI

## Outcome

Move Electron desktop-shell resources and lifecycle state into
application-owned controllers.

## Prerequisites

- Task 08 is reviewed and committed.
- The owner-first DI plan is approved through `approval.plan` revision 6.
- Task 09 has separate execution authorization.

## Owned Requirements

- Project-wide DI decisions for desktop runtime ownership.
- Existing window security, tray, hotkey, protocol, Linux integration,
  metadata, startup-mode, and platform compatibility requirements.

## In Scope

- `WindowManager`, `TrayController`, and `ShortcutController`.
- `AppProtocolController`, `LinuxDesktopIntegrationController`, and a desktop
  runtime controller for pre-ready/application-ready configuration.
- Main application/composition-root wiring and dependency-seam-only IPC edits.
- Focused controller and adapter tests.

## Out Of Scope

- Provider-family ownership, browser ownership, main IPC controller ownership,
  preload, renderer, packaging, or user-visible behavior changes.

## Task Contract

1. `WindowManager` owns main/settings/history/about/provider windows, quitting
   state, settings-close confirmation, trusted-window checks, navigation
   guards, locale broadcasts, and disposal.
2. `TrayController` owns its Tray resource, icon state, menu/click behavior,
   localized labels, and disposal.
3. `ShortcutController` owns recording lifecycle, retry availability,
   suspension, conflicts, registered hotkeys, callbacks, and cleanup. Keep
   truly stateless shortcut/status decisions as pure functions.
4. `AppProtocolController` owns privileged-scheme and request-handler
   registration while preserving host/path traversal validation and MIME
   behavior.
5. `LinuxDesktopIntegrationController` owns injected filesystem, process,
   spawn, environment, app metadata, and asset adapters while preserving
   AppImage register/remove/icon-refresh behavior.
6. The desktop runtime controller owns app identity, hardware acceleration,
   command-line switches, sandbox settings, native metadata, dock icon,
   session permissions, startup benchmark behavior, and startup-mode flags.
7. Construct controllers in `MainProcessCompositionRoot`; replace
   `MainProcessApplication` callback bags with direct controller dependencies.
   Extend existing IPC dependency objects only where required to access window
   or shortcut state; full IPC ownership remains Task 13.
8. Remove migrated module `let` state and constructed controllers without
   compatibility singletons or pass-through wrappers.

## Contracts And Boundaries

- Main remains the sole owner of privileged Electron resources.
- Window URLs, preload path, sandbox/context isolation, navigation guards,
  trusted-sender validation, hotkeys, tray behavior, startup modes, and
  localized strings remain unchanged.
- Two desktop graphs share no Electron resource or mutable controller state.

## Expected Files Or Components

- Window, tray, shortcuts, protocol, metadata, Linux integration, application,
  composition-root, IPC dependency seams, and focused tests.
- Add focused `windowManager`, `trayController`, `shortcutController`,
  `appProtocolController`, `linuxDesktopIntegrationController`, and
  `desktopRuntimeController` tests; retain existing pure-helper tests.

## Acceptance Criteria

- All targeted desktop state is instance-owned and disposed idempotently.
- Current desktop/security fixtures and pure helper tests remain
  behavior-identical.
- No migrated mutable module state or constructed singleton remains.

## Verification

- Run `node --import tsx --test tests/main/windowManager.test.ts
  tests/main/trayController.test.ts tests/main/shortcutController.test.ts
  tests/main/appProtocolController.test.ts
  tests/main/linuxDesktopIntegrationController.test.ts
  tests/main/desktopRuntimeController.test.ts
  tests/main/mainProcessApplication.test.ts
  tests/main/mainProcessCompositionRoot.test.ts`.
- Run the existing `windowAppearance`, `shortcuts`, `hotkeys`,
  `trayIconState`, `appProtocol`, `appMetadata`, `linuxDesktopIcons`,
  `appSettingsSectionIpcContract`, and affected trusted-sender tests.
- Run `npm run typecheck`, `npm run test:types`, `npm run lint`,
  `npm run format:check`, `npm run test:unit`, and `git diff --check`.

## Failure And Rollback

- Do not weaken window security, trusted-sender checks, config behavior,
  platform switches, or desktop integration to simplify injection.

## Manual Gates

- Electron GUI, packaged AppImage/Windows, and native desktop verification stay
  deferred.

## References

- `AGENTS.md`
- project conventions
- Task 08 handoff

## Completion And Handoff

- Mark only Task 09 complete, update `handoff.md`, and identify Task 10 as next.
- Leave Task 09 uncommitted for review.
