# Global Hotkey Registration And First-Run Assignment

Status: Approved

## Summary

GPT-Voice must distinguish a configured accelerator from a shortcut that the
operating system actually accepted. A clean installation starts with no global
shortcuts assigned. Users assign, replace, remove, and physically test each
shortcut from Settings. Existing valid non-empty persisted assignments remain
configured across upgrade.

Main owns operating-system registration, rollback, dispatch suppression,
platform policy, and authoritative status. Renderer presents validated status
through typed preload IPC. In-app provider and contextual action buttons remain
usable when their global shortcut is unassigned or failed.

This specification supersedes conflicting default-accelerator, always-present
shortcut-label, and rejected-save behavior in:

- `docs/specs/provider-hotkey-action-buttons/spec.md` (`UI-008`, `FLOW-009`,
  `FAIL-004`, `COMP-001` only where they require a non-null default or label);
- `docs/specs/prettify-tone-selection/spec.md` (`FLOW-001` through `FLOW-005`,
  `COMP-005`, and default F12/Ctrl+F12 requirements only where they prescribe
  a fresh-install accelerator);
- `docs/specs/ui-redesign/spec.md` only where it assumes every shortcut row has
  a non-null value.

All unrelated provider, recording, selected-text, window geometry, security,
privacy, packaging, and release contracts remain active.

## Outcomes

- **OUT-001:** A desktop user can tell whether each shortcut is unassigned,
  registered, temporarily dispatch-suppressed, or rejected by the platform.
- **OUT-002:** A failed replacement never removes or visually replaces the last
  working assignment.
- **OUT-003:** A clean installation performs no global shortcut registration
  and prompts for no Wayland shortcut permission until the user assigns one.
- **OUT-004:** Existing users retain every valid non-empty assignment while
  gaining truthful registration state, Remove, and Test controls.
- **OUT-005:** Pointer, Enter, and Space continue to invoke in-app actions even
  when no global accelerator is assigned.

## Scope And Non-Goals

- **SCOPE-001:** Cover Record, Stop, Cancel, Translation, normal Prettify,
  Quick Prettify, and Retry.
- **SCOPE-002:** Cover configuration persistence, main-process registration,
  platform policy, trusted IPC, Settings, main-window indicators, contextual
  actions, localization, documentation, packaging metadata, and tests.
- **SCOPE-003:** Support Windows, Linux X11, and Linux Wayland. Preserve the
  paused macOS release policy and fail closed on unsupported runtime platforms.
- **SCOPE-004:** Preserve the fixed 620 by 292 main-window content contract and
  the existing provider, recording, selected-text, clipboard, and notification
  lifecycles.
- **SCOPE-005:** Do not add a first-run banner, modal onboarding, automatic
  fallback, silent reassignment, direct D-Bus integration, telemetry, or a new
  dependency.
- **SCOPE-006:** Do not identify or guess which external application owns a
  rejected accelerator.

## Shared Types And Persistence

- **DATA-001:** `HotkeySettings` represents every target as `string | null`.
  `null` is the only unassigned value; empty or malformed strings are invalid
  mutation input and are never persisted as assignments.
- **DATA-002:** A missing configuration file initializes all seven targets to
  `null`. The first persisted snapshot writes explicit nulls and does not
  materialize legacy defaults.
- **DATA-003:** Existing non-empty persisted strings load unchanged. Missing,
  null, empty, or invalid individual legacy fields normalize to `null` without
  borrowing a default from another version.
- **DATA-004:** Reset clears all seven targets. Remove clears only its target.
- **DATA-005:** Shared enum contracts own desktop platform, Linux session type,
  registration status, dispatch status, failure code, and physical-test result.
- **DATA-006:** Registration status has the bounded states `Unassigned`,
  `Registered`, and `Failed`. Dispatch status is independently `Enabled` or
  `Suppressed`; suppression never implies that the OS binding was released.
- **DATA-007:** Failure codes are limited to `InvalidAccelerator`,
  `InternalConflict`, `OsReserved`, `RegistrationRejected`,
  `PersistenceFailed`, and `UnsupportedPlatform`.
- **DATA-008:** The authoritative runtime snapshot contains one entry per
  target with configured accelerator, registered accelerator, registration
  status, dispatch status, and optional failure code. Target ordering is
  deterministic and no platform-native error payload crosses IPC.

## Architecture And Ownership

- **ARCH-001:** An abstract global-shortcut adapter defines register,
  unregister, registration query, and final unregister-all operations. The
  Electron adapter is the only production implementation.
- **ARCH-002:** An abstract platform policy validates normalized accelerators.
  A factory selects Windows, Linux, compatible paused-macOS, or unsupported
  policy from bounded platform/session enums.
- **ARCH-003:** One concrete registration service owns configured-to-registered
  mapping, callbacks, snapshots, replacement, removal, dispatch suppression,
  test sessions, publication, and final cleanup.
- **ARCH-004:** `ShortcutController` owns action callbacks and recording or
  selected-text eligibility, but delegates OS registration and callback
  suppression to the registration service.
- **ARCH-005:** Stateless parsing, normalization, display formatting, and
  internal-conflict detection remain pure functions. No pass-through
  repository class or mutable module-level service is introduced.
- **ARCH-006:** Services and adapters are created only by the main-process
  composition root with complete constructor-injected dependencies.
- **ARCH-007:** All assigned targets remain OS-registered for the process
  lifetime, including Retry. Action availability is enforced by the callback's
  existing runtime gate rather than by releasing the accelerator.

## Registration And Mutation Flows

- **FLOW-001:** Startup attempts every non-null target independently. A failed
  target becomes `Failed`; successful peers remain registered. Existing failed
  configuration is retained for user repair and never silently cleared.
- **FLOW-002:** Replacement validates type, normalization, internal conflicts,
  and platform policy before calling the adapter.
- **FLOW-003:** A replacement registers the candidate beside the current
  binding and confirms both successful registration and registration query.
  Only then may configuration persistence and old-binding removal occur.
- **FLOW-004:** If candidate registration fails, the candidate is not persisted
  and the old assignment and binding remain unchanged.
- **FLOW-005:** If candidate persistence fails, the candidate binding is
  removed, the old assignment and binding remain authoritative, and the result
  is `PersistenceFailed`.
- **FLOW-006:** Remove persists `null` before unregistering the old binding. A
  persistence failure retains the old assignment and binding.
- **FLOW-007:** Main-interaction ownership suppresses callback dispatch without
  unregistering shortcuts. This permits Settings to test a candidate while all
  product actions remain inert. Final application disposal is the only normal
  `unregisterAll` path.
- **FLOW-008:** Settings can run one five-second test for one registered target.
  The next matching callback resolves `Detected` without executing the product
  action. Timeout resolves `TimedOut`; missing or failed registration resolves
  `Unavailable`. Closing the owner window cancels the session and timers.
- **FLOW-009:** Duplicate mutation, close, dispose, and reordered renderer
  events are idempotent and cannot leave two durable callbacks for one target,
  re-enable suppressed dispatch, or publish stale success.

## Settings, IPC, And User Interface

- **UI-001:** Settings displays configured value and authoritative registration
  state separately for every target. A syntax-valid captured value is never
  shown as registered until main confirms it.
- **UI-002:** An unassigned provider action key renders localized “Not
  assigned” in the same 114 by 32 control and remains activatable by pointer,
  Enter, and Space.
- **UI-003:** An unassigned contextual action remains clickable and renders its
  action identity plus a neutral unassigned legend; it does not render a false
  accelerator.
- **UI-004:** A registered provider key has an embedded keyboard/check marker;
  failed registration has an amber warning; dispatch suppression has a neutral
  pause marker. These markers do not alter the provider grid or window bounds.
- **UI-005:** Provider readiness status remains a distinct control and tooltip.
  Its green check never describes shortcut registration.
- **UI-006:** Tooltip and accessible name state the product action, configured
  accelerator or unassigned value, registration state, and recoverable action.
  Status changes use an existing or focused `aria-live` region.
- **UI-007:** No first-run banner or blocking onboarding is added. Settings
  rows, key markers, tooltips, and accessible names provide discovery.
- **UI-008:** A failed Apply leaves the capture dialog open, retains the old
  value, and presents a localized bounded reason. Success closes only after OS
  registration and persistence both succeed.
- **UI-009:** Every assigned row exposes Remove. Remove success immediately
  publishes the unassigned snapshot to all relevant renderer windows.
- **UI-010:** Every registered row exposes Test and presents waiting, detected,
  timed-out, and unavailable states without running the action.
- **UI-011:** The complete English, Russian, Ukrainian, Belarusian, German,
  Spanish, French, Portuguese, Hindi, Japanese, and Chinese locale maps remain
  structurally complete for all new strings.
- **UI-012:** The deterministic browser demo covers Registered, Unassigned,
  Failed, and Suppressed provider-key states without importing Electron or
  production runtime state.

- **IPC-001:** Trusted IPC exposes one validated runtime snapshot query, one
  snapshot change event, one transactional set operation, one clear operation,
  and one bounded test operation.
- **IPC-002:** Mutation results are discriminated success/failure values and
  include the latest authoritative settings and runtime snapshot. Renderer
  validates all response and event fields before use.
- **IPC-003:** The previous boolean hotkey-capture suspension channel is
  removed. Main interaction ownership and the registration service are the
  only dispatch-suppression authorities.

## Platform Contracts

- **PLAT-001:** Windows rejects every normalized accelerator whose primary key
  is F12 as `OsReserved` before invoking Electron. No clean-install Windows
  default contains F12 because no clean-install default exists.
- **PLAT-002:** Any other Windows registration failure is
  `RegistrationRejected`; UI may say the combination is unavailable or may be
  used by the system or another application, but cannot name an owner.
- **PLAT-003:** Linux X11 uses the Electron adapter. A failed X11 grab is
  `RegistrationRejected` and does not disturb other bindings.
- **PLAT-004:** Linux enables Chromium `GlobalShortcutsPortal` before
  `app.ready`. The feature switch is merged with any existing feature list and
  never overwrites unrelated Chromium features.
- **PLAT-005:** Linux package and runtime identity is
  `com.swimmwatch.gptvoice`: root `desktopName`, generated desktop filename,
  `StartupWMClass`, and portal application identity agree. electron-builder 26
  enables desktop-name synchronization.
- **PLAT-006:** Wayland uses Electron's portal integration only. Portal or
  compositor refusal is `RegistrationRejected`; GPT-Voice does not claim an
  exact system `trigger_description` unavailable through Electron's API.
- **PLAT-007:** AppImage, DEB, and RPM packages preserve the identity and
  shortcut behavior. This work does not publish or release packages.

## Failure, Security, And Privacy

- **FAIL-001:** Invalid input and internal GPT-Voice conflicts are rejected
  before platform registration and do not mutate configuration.
- **FAIL-002:** OS/portal rejection, persistence failure, unsupported platform,
  adapter exception, owner-window destruction, and timeout settle to a bounded
  terminal result and retain recoverable prior state.
- **FAIL-003:** Registration failure never falls back to another accelerator,
  disables an unrelated target, or reports candidate success.
- **FAIL-004:** A configured-but-failed shortcut remains visible with a repair
  affordance after restart.

- **SEC-001:** Main is the sole owner of Electron global shortcuts,
  persistence, timers, and platform inspection. Renderer uses only the typed
  preload surface and trusted sender validation remains mandatory.
- **SEC-002:** Shortcut logs and diagnostics contain only target, bounded
  status/failure codes, normalized accelerator, and platform/session enum.
  They exclude environment contents, paths, external process identity,
  selected text, audio, transcripts, credentials, sessions, and clipboard
  contents.
- **SEC-003:** Callback suppression is authoritative before renderer feedback;
  stale UI cannot execute an action while the main interaction lock is held.
- **SEC-004:** Test mode cannot execute product callbacks, persist data, extend
  its deadline, or survive owner destruction or application disposal.

## Compatibility, Dependencies, And Rollback

- **COMP-001:** Existing valid non-empty persisted assignments remain
  byte-for-byte configuration values until the user changes them. Newly
  missing or invalid targets are unassigned rather than defaulted.
- **COMP-002:** Existing Windows F12 assignments remain configured but fail
  visibly as `OsReserved`; they are never deleted or silently replaced.
- **COMP-003:** Provider selection, model settings, recording, selected-text
  flows, retry data, history, clipboard, notification, and package targets are
  unchanged.
- **COMP-004:** Supported production qualification remains Windows and Linux;
  macOS publishing remains paused.
- **DEP-001:** No production or development dependency is added.
- **DEP-002:** The Electron and electron-builder versions already present in
  the lockfile remain the dependency authority.
- **ROLL-001:** Rollback restores the previous registration owner and UI, but
  must continue accepting persisted `null` values. It must not recreate legacy
  defaults for users who intentionally cleared a target.

## Acceptance And Qualification

- **QUAL-001 / AC-AUTO-001:** Config tests prove seven nulls for a clean store,
  preservation of existing strings, partial/null/invalid legacy handling,
  clear/reset, atomic failure, and reload.
- **QUAL-002 / AC-AUTO-002:** Platform-policy tests prove Windows F12 rejection
  before adapter invocation, non-Windows behavior, and unsupported-platform
  failure.
- **QUAL-003 / AC-AUTO-003:** Registration-service tests cover independent
  startup, candidate success, OS rejection, persistence rollback, clear
  rollback, conflicts, suppression, constant Retry registration, publication,
  owner cleanup, and dispose.
- **QUAL-004 / AC-AUTO-004:** Trusted IPC/preload tests reject malformed input
  and output, preserve exact enums and target ordering, and prove failed
  mutation retains the prior state.
- **QUAL-005 / AC-AUTO-005:** Renderer tests cover every key state, unassigned
  click behavior, failed-dialog retention, Remove, provider-status separation,
  localization, accessibility, and exact 620 by 292 no-overflow layout.
- **QUAL-006 / AC-AUTO-006:** Test-session tests prove Detected, TimedOut,
  Unavailable, no action dispatch, one active test, fixed deadline, window
  destruction, and dispose cleanup.
- **QUAL-007 / AC-AUTO-007:** Packaging and startup tests prove the portal
  feature is enabled before ready and desktopName, desktop filename, and
  StartupWMClass are canonical for AppImage, DEB, and RPM metadata.
- **QUAL-008 / AC-MAN-001:** On supported Windows, F12 is rejected with the
  reserved explanation; a free combination registers and activates from
  another application; a helper-owned conflict preserves the old binding; and
  Test detects a physical press without running the action.
- **QUAL-009 / AC-MAN-002:** On Linux X11, a free combination activates outside
  GPT-Voice and a helper-owned grab produces visible rejection without
  disturbing other targets.
- **QUAL-010 / AC-MAN-003:** On GNOME and KDE Wayland, approve and deny portal
  flows are exercised across restart and exact package identity is verified
  for representative AppImage, DEB, and RPM artifacts.
- **QUAL-011 / AC-AUTO-008:** Typecheck, lint, format, unit/integration tests,
  production build, packaging-policy checks, and relevant platform smoke gates
  pass without weakening warnings or required checks.
- **DOC-001:** User documentation explains first-run unassigned behavior,
  assignment, Remove, Test, status markers, Windows F12, generic conflicts,
  and Wayland system dialogs without promising exact external-owner detection.

## Rejection Criteria

Reject the implementation if any of the following is true:

- a clean installation registers or displays a default global shortcut;
- a syntax-valid candidate is presented as registered without OS confirmation;
- failed replacement changes persisted or working prior state;
- opening Settings releases OS bindings or permits a product callback;
- one registration failure unregisters an unrelated target;
- F12 is passed to Electron on Windows;
- a null shortcut disables its in-app action control;
- provider readiness and shortcut registration share one ambiguous indicator;
- Wayland lacks the portal feature or canonical desktop identity;
- logs, IPC, diagnostics, or tests expose sensitive content or machine paths;
- a new dependency, release, publish, or macOS-support change is introduced.
