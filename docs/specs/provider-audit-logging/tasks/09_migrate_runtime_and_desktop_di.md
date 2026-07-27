# 09 Migrate Runtime And Desktop DI

## Outcome

Move mutable runtime infrastructure and Electron desktop-shell state into
constructor-injected, application-owned classes.

## Prerequisites

- Task 08 is reviewed and committed.

## Owned Requirements

- Project-wide DI architecture decisions.
- Existing desktop, configuration, localization, security, and compatibility
  requirements from the approved specification.

## In Scope

- Logger/Electron/CloakBrowser runtime loaders.
- Configuration and locale state.
- Windows, tray, shortcuts, protocol, and desktop lifecycle state.

## Out Of Scope

- Provider-family ownership, main IPC migration, preload, or renderer.

## Task Contract

1. Add class-owned `LoggerFactory`, Electron runtime loader, and CloakBrowser
   loader; remove their mutable module caches.
2. Replace mutable config exports with `AppConfigStore` snapshots and typed
   mutation methods while preserving on-disk format/defaults.
3. Replace global locale state with injected `I18nService`.
4. Add `WindowManager`, `TrayController`, and `ShortcutController` owning all
   current mutable state and Electron resources.
5. Inject logger, config, locale, Electron/platform adapters, and callbacks
   through constructors.
6. Preserve current window URLs, trusted sender checks, hotkeys, tray behavior,
   startup modes, AppImage integration, and localized strings.
7. Remove migrated module `let` state and constructed log/runtime/controller
   instances without compatibility singletons.

## Contracts And Boundaries

- Main owns all privileged desktop resources.
- Config snapshots are immutable to consumers.
- UI/preload/IPC contracts do not change.

## Expected Files Or Components

- Runtime/config/i18n modules, window/tray/shortcut modules, composition root,
  and their focused tests.

## Acceptance Criteria

- Two desktop graphs share no config, locale, window, tray, shortcut, or loader
  state.
- Existing configuration fixtures and desktop controller tests remain
  behavior-identical.
- No migrated mutable module state remains.

## Verification

- Run focused config/i18n/window/tray/shortcut/runtime tests, TypeScript, lint,
  format, full unit tests, and `git diff --check`.

## Failure And Rollback

- Do not change config schema, locale fallback, hotkeys, window security, or
  desktop integration to simplify injection.

## Manual Gates

- Packaged desktop/manual platform checks remain deferred.

## References

- `AGENTS.md`, project conventions, Task 08 handoff.

## Completion And Handoff

- Mark only Task 09 complete and hand off to Task 10.
