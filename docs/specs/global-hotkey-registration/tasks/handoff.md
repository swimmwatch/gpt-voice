# Global Hotkey Registration — Handoff

## Completed Packets

- Packet 01 — Nullable Persistence And Shared Contracts. Specification revision
  2, audited plan revision 3, and Packet 01 authorization revision 2 are
  recorded in the decision ledger.
- Packet 02 — Platform Policy And Registration Service. The adapter, fail-closed
  policy factory, transactional registration owner, snapshot validation, and
  focused deterministic tests are complete. Packet 02 execution authorization
  is recorded in the decision ledger.
- Packet 03 — Shortcut Controller And Composition. The controller delegates
  registration lifecycle to the process-owned service, retains all product
  action gates, and leaves the legacy capture API inert pending Packet 04.
  The composition root now owns the adapter, fail-closed policy, service, and
  bounded platform/session classification. Main interaction locking suppresses
  dispatch without unregistering bindings.
- Packet 04 — Trusted Hotkey IPC. A shared validated runtime-state contract
  now carries revisioned settings and binding snapshots through trusted IPC.
  The main process owns mutations, test-session cancellation, and publication;
  preload validates every boundary payload; both renderer consumers project the
  authoritative nullable state without legacy capture suppression or fallback
  defaults.
- Packet 05 — Settings Registration Experience. Settings now subscribes to and
  revision-reconciles the authoritative runtime state, presents configured,
  registration, authority, and effective-trigger truth separately, and provides
  transactional Change, Remove, and Test controls with one polite status
  announcement region. Failed Apply remains open with its bounded localized
  reason; all eleven locale maps and focused renderer coverage are complete.
- Packet 06 — Main Window Status And Demo. Provider keys now present nullable
  authoritative registration snapshots without changing action eligibility;
  contextual legends stay truthful, and the deterministic demo covers
  application, desktop-managed, unassigned, failed, and suppressed states.
- Packet 07 — Linux X11 Registration And Qualification. The X11-specific
  policy, bounded session classifier, factory/composition branch, focused
  tests, and exact-conflict helper are complete. The user completed the
  interactive X11 physical verification on 2026-08-20, confirming that
  assigned global keys register and operate in the isolated application
  profile.

## Changed Files

- `docs/specs/global-hotkey-registration/spec.md` — approved revision 2
  metadata and durable contract.
- `docs/specs/global-hotkey-registration/decisions.yaml` — specification
  revision 2 approval, plan revision 3 approval, revised Packet 01
  authorization, and Packet 05 execution and commit authorization through
  Prompt MCP.
- `docs/specs/global-hotkey-registration/tasks/` — approved plan revision 3,
  checklist, handoff, and ten task packets.
- `src/shared/hotkeys.ts` — nullable settings, unassigned-setting factory,
  enum-backed registration contracts, snapshot validators, and null-safe
  target/conflict helpers.
- `src/main/config.ts` — null initialization/loading, explicit-null persistence,
  atomic single-target persistence, and shortcut-only reset.
- `src/main/shortcuts.ts` — nullable legacy compatibility plus controller-owned
  product callbacks and lifecycle delegation with no direct Electron
  registration or suspension bookkeeping.
- `src/renderer/AppSettingsWindow.tsx`,
  `src/renderer/components/settings/ShortcutsSection.tsx`, and
  `src/renderer/components/HotkeyRow.tsx` — nullable temporary value projection
  with no accelerator fallback.
- `src/renderer/useProviderHotkeyHomeIntegration.ts` — do not publish the
  obsolete idle-record shortcut status when Record is unassigned.
- `tests/main/appConfigStore.test.ts`, `tests/main/hotkeys.test.ts`, and
  `tests/main/shortcutController.test.ts` — nullable persistence/contracts and
  no-registration regression coverage.
- `src/main/hotkeys/GlobalShortcutAdapter.ts` and
  `src/main/hotkeys/ElectronGlobalShortcutAdapter.ts` — bounded abstract and
  Electron global-shortcut adapter contracts.
- `src/main/hotkeys/HotkeyPlatformPolicy.ts`,
  `src/main/hotkeys/UnsupportedHotkeyPlatformPolicy.ts`,
  `src/main/hotkeys/PausedMacosHotkeyPlatformPolicy.ts`, and
  `src/main/hotkeys/HotkeyPlatformPolicyFactory.ts` — platform-policy seam
  that selects only injected qualified host implementations.
- `src/main/hotkeys/HotkeyRegistrationService.ts` — transactional binding
  ownership, generation invalidation, compensation/reconciliation, bounded
  physical tests, lock-backed dispatch suppression, and idempotent disposal.
- `src/shared/hotkeys.ts` and `tests/main/hotkeys.test.ts` — failed snapshot
  invariants preserve the configured preference even when reconciliation leaves
  it unassigned.
- `tests/main/hotkeys/HotkeyRegistrationService.test.ts` — deterministic
  platform, ownership, cleanup, lock suppression, test-session, publication,
  and disposal tests.
- `src/main/di/mainProcessCompositionRoot.ts` and `src/main/main.ts` —
  process-local adapter/policy/service construction, callback bridge, and
  bounded platform/session classification.
- `tests/main/shortcutController.test.ts`,
  `tests/main/hotkeys/HotkeyRegistrationService.test.ts`,
  `tests/main/mainProcessCompositionRoot.test.ts`, and
  `tests/main/mainProcessApplication.test.ts` — service-backed controller,
  lock suppression, lifecycle, and composition regression coverage.
- `src/shared/hotkeyIpc.ts` — canonical IPC channels, immutable runtime-state
  contracts, and fail-closed request/response/snapshot validators.
- `src/main/ipc.ts`, `src/main/di/mainProcessRuntimeFactory.ts`, and
  `src/main/di/mainProcessCompositionRoot.ts` — process-owned registration
  service injection; trusted query/set/clear/test handlers; revisioned main and
  Settings publication; and Settings-owner/disposal physical-test cancellation.
- `src/main/preloadApi.ts` and `src/renderer/types.d.ts` — typed, decoded
  renderer-safe hotkey capability with no raw IPC exposure.
- `src/renderer/AppSettingsWindow.tsx` and
  `src/renderer/useProviderHotkeyHomeIntegration.ts` — state-revision-aware
  authoritative projection with no renderer registration/suppression control or
  hotkey fallback defaults.
- `src/renderer/AppSettingsWindow.tsx`,
  `src/renderer/hotkeySettingsPresentation.ts`,
  `src/renderer/components/HotkeyModal.tsx`,
  `src/renderer/components/HotkeyRow.tsx`, and
  `src/renderer/components/settings/ShortcutsSection.tsx` — Settings-owned
  runtime-state subscription, transactional mutation/test presentation,
  accessible authority/effective-status rows, failure-preserving capture, and
  focus-safe controls.
- `src/main/i18n/{en,ru,uk,be,de,es,fr,pt-BR,hi,ja,zh}.ts` — complete bounded
  Settings registration, authority, error, Test, and announcement copy.
- `tests/renderer/appSettingsHotkeys.test.ts`,
  `tests/renderer/hotkeySettingsPresentation.test.ts`, and
  `tests/renderer/systemSettingsLanguage.test.ts` — authoritative Settings
  source contracts, state-presentation helpers, and eleven-locale completeness
  checks.
- `tests/main/hotkeyIpc.test.ts`, `tests/main/hotkeyIpcController.test.ts`,
  `tests/main/hotkeyIpcContract.test.ts`, and `tests/main/preloadApi.test.ts`
  — strict boundary, trusted owner, revision, cancellation, and preload decoder
  coverage.
- `tests/main/firstLaunchStartupIpc.test.ts` and
  `tests/main/translationSettingsInitializationIpc.test.ts` — synchronized IPC
  controller construction harnesses.
- `tests/renderer/providerHotkeyHomeIntegration.test.ts` — authoritative-state
  renderer source contract and current bounded recording rejection assertion.
- Packet 06 — `src/renderer/App.tsx`,
  `useProviderHotkeyHomeIntegration.ts`, `HotkeyActionButton`, its state and
  styles, `ContextualActionTile`, and `ProviderHotkeyDemo` now consume
  authoritative nullable registration snapshots; the eleven locale maps and
  focused renderer tests cover truthful markers, legends, and fixtures.
- `scripts/local-whisper/qualification/` — restored the current focused
  performance manifest, explicit artifact validation mode, nullable lifecycle,
  native stream/diagnostic, and process-session contracts that blocked the
  repository-wide test typecheck.
- `tests/main/localWhisper/`, `tests/main/mainProcessApplication.test.ts`, and
  `tests/scripts/localWhisper/qualification/` — synchronized strict fixtures
  with current artifact, IPC, runtime dependency, model, and stream contracts.
- Packet 07 — `LinuxHotkeyPlatformPolicy` accepts X11 Electron bindings with
  application authority, `LinuxSessionTypeClassifier` bounds process-root
  session evidence to the internal enum, and composition creates the policy
  only for the X11 factory branch. Wayland remains unsupported until Packet 08.
- `HotkeyPlatformPolicyFactory.ts`, `main.ts`, and
  `tests/main/hotkeys/HotkeyRegistrationService.test.ts` — removed the
  pre-qualified Wayland creator, wired the X11 policy, and covered bounded
  session classification, factory selection, F12 non-reservation, and
  application-authority registration.
- `scripts/hotkeys/qualification/x11GlobalShortcutConflictHolder.mjs` — bounded
  Electron helper that owns only `Ctrl+Shift+F10`, requires a caller-supplied
  private profile root, emits only bounded status, and unregisters only its
  own grab on exact-process termination.

## Checks

- Requirement coverage — passed: all 97 active requirement/acceptance IDs map
  to at least one packet, with no inactive IDs in `Owned Requirements`.
- Packet structure — passed: 10 packets and all 14 mandatory sections in each.
- Local task links — passed across all 13 task Markdown files.
- Plan revision-3 coverage/structure/local-link audit, decision-ledger YAML,
  documentation formatting, and diff hygiene — passed before execution.
- `node --import tsx --test tests/main/hotkeys.test.ts tests/main/appConfigStore.test.ts tests/main/shortcutController.test.ts` — passed: 58 tests.
- Focused Local Whisper qualification, artifact, IPC, sampler, and main-process
  lifecycle regression suite — passed: 56 tests.
- `npm run typecheck` — passed.
- `npm run test:types` — passed.
- Scoped ESLint and Prettier over all Packet 01 source/test files — passed.
- Scoped ESLint and Prettier over verification-unblock source/test files —
  passed.
- `git diff --check` — passed.
- `node --import tsx --test tests/main/hotkeys/HotkeyRegistrationService.test.ts tests/main/hotkeys.test.ts` — passed: 27 tests.
- `npm run typecheck` — passed.
- `npm run test:types` — passed.
- Scoped ESLint and Prettier over all Packet 02 source/test files — passed.
- `git diff --check` — passed after Packet 02.
- `node --import tsx --test tests/main/shortcutController.test.ts tests/main/mainProcessCompositionRoot.test.ts tests/main/mainProcessApplication.test.ts tests/main/mainInteractionLock.test.ts tests/main/mainInteractionLockActionGate.test.ts` — passed: 50 tests.
- `node --import tsx --test tests/main/hotkeys/HotkeyRegistrationService.test.ts tests/main/hotkeys.test.ts` — passed: 27 tests.
- `npm run typecheck` — passed.
- `npm run test:types` — passed.
- Scoped ESLint and Prettier over Packet 03 source/test files — passed.
- `git diff --check` — passed after Packet 03.
- `node --import tsx --test tests/main/hotkeyIpcContract.test.ts tests/main/hotkeyIpc.test.ts tests/main/hotkeyIpcController.test.ts tests/main/preloadApi.test.ts tests/main/firstLaunchStartupIpc.test.ts tests/main/translationSettingsInitializationIpc.test.ts tests/renderer/providerHotkeyHomeIntegration.test.ts` — passed: 39 tests.
- `node --import tsx --test tests/main/hotkeys/HotkeyRegistrationService.test.ts tests/main/hotkeys.test.ts` — passed: 27 tests.
- `npm run typecheck` — passed.
- `npm run test:types` — passed.
- Scoped ESLint — passed with no errors (the existing complexity, unused catch
  binding, and test-double class-count warnings remain outside Packet 04's
  functional checks).
- Scoped Prettier — passed.
- `git diff --check` — passed after Packet 04.
- `node --import tsx --test tests/renderer/appSettingsHotkeys.test.ts tests/renderer/hotkeySettingsPresentation.test.ts tests/renderer/systemSettingsLanguage.test.ts tests/main/hotkeyIpcContract.test.ts` — passed: 10 tests.
- `npm run typecheck` — passed.
- `npm run test:types` — passed.
- Scoped ESLint and Prettier over all Packet 05 source, locale, and test files — passed.
- `git diff --check` — passed after Packet 05.
- Packet 06 focused renderer suite — passed: 48 tests across key presentation,
  integration, layout, demo, eligibility, recording controls, and locales.
- Packet 06 `npm run typecheck` and `npm run test:types` — passed.
- Packet 06 `npm run build:prod` — passed; the existing webpack bundle-size
  recommendations remain warnings only.
- Packet 06 scoped ESLint — passed with no errors; the two existing `App`
  function-size warnings remain.
- Packet 06 scoped Prettier and `git diff --check` — passed.
- Packet 06 CloakBrowser manual gate — passed at device scale factor 1:
  620 × 292 surface, 114 × 32 provider keys, application/desktop-managed/
  unassigned/failed/suppressed fixtures, provider-readiness separation,
  pointer/Enter/Space feedback, no overflow, no console errors, and only
  localhost static requests. The failed-tooltip punctuation was corrected and
  rechecked after the full automated suite and production build passed.
- Packet 07 focused policy/service and composition suite — passed: 30 tests;
  covers X11 factory selection, Wayland fail-closed behavior, bounded session
  classification, F12 registration, the adapter contract, and production
  composition.
- Packet 07 cross-boundary suite — passed: 29 tests across shortcut control,
  trusted hotkey IPC, and Settings presentation.
- Packet 07 `npm run typecheck`, `npm run test:types`, and `npm run build:prod`
  — passed. Production build retains only the existing webpack bundle-size
  recommendations.
- Packet 07 scoped ESLint, scoped Prettier, and `git diff --check` — passed.
  Repository-wide lint with `--max-warnings 0` and format check remain blocked
  by unrelated Local Whisper warnings and formatting changes; no Packet 07
  file is among them.
- Packet 07 real Electron X11 attempt — confirmed application authority and
  exact effective accelerator for a free binding, generic helper-conflict
  rejection with the prior and unrelated bindings retained, independent
  startup with the conflicting target failed and F12 target registered, F12
  non-reservation, and Remove/restart persistence in an isolated temporary
  profile. The profile and every owned helper/application/focus process were
  terminated and removed after the attempt.
- Packet 07 AC-MAN-002 interactive X11 gate — passed on 2026-08-20 through
  user confirmation that assigned keys registered and operated in the running
  isolated profile. The relevant X11 source-set digest was
  `d3536c75f80a07fb3717cc925448ad6731ecc8e765e5b7639aa8ad09fa09e3e8`
  at Git revision `8b988dc38368f114d340c3c435523935fc348d9e`; no raw
  environment, input, external-owner, or profile data was recorded.
- Packet 07 completion recheck — `tests/main/hotkeys/HotkeyRegistrationService.test.ts`,
  `tests/main/shortcutController.test.ts`, `tests/main/hotkeyIpcContract.test.ts`,
  and `tests/renderer/appSettingsHotkeys.test.ts`, plus `npm run typecheck`,
  `npm run test:types`, scoped Prettier, and `git diff --check` — passed.

## Packet 08 In Progress

- Packet 08 execution is directly authorized as
  `authorization.packet-08-execution:v1`. Its scoped Wayland policy, pre-ready
  portal and desktop identity, AppImage launcher migration, builder metadata,
  installer verification, and focused automated coverage are implemented.
- Post-review corrections place `desktopName` in electron-builder's top-level
  package metadata, configure the canonical Linux class synchronously before
  ready, and require exact canonical AppImage/DEB/RPM desktop roles while
  rejecting the legacy package role.
- Changed files: `package.json`, `scripts/verify-installers.mjs`,
  `src/main/desktopRuntimeController.ts`,
  `src/main/di/mainProcessCompositionRoot.ts`,
  `src/main/hotkeys/HotkeyPlatformPolicyFactory.ts`,
  `src/main/hotkeys/LinuxHotkeyPlatformPolicy.ts`,
  `src/main/linuxDesktopIntegration.ts`, `src/main/main.ts`, the focused main
  and hotkey tests, and `tests/scripts/linuxDesktopIdentity.test.ts`.
- Packet 08 automated verification passed: the focused cross-boundary suite
  (84 tests), `npm run typecheck`, `npm run test:types`, scoped ESLint with
  zero warnings, scoped Prettier, `npm run build:prod` (only existing webpack
  bundle-size recommendations), and `git diff --check`.
- Repository-wide `npm run lint -- --max-warnings 0` remains blocked by 258
  existing warnings outside Packet 08; `npm run format:check` remains blocked
  by 12 unrelated Local Whisper files. No Packet 08 file appears in either
  result.
- Manual evidence must bind to Git revision
  `0e6786251ad639f0533e7965755a930db3a7fbaa` and Packet 08 source-set diff
  digest `2119b903fe9b23805c56452628628cff25aa6bbf32861003685e2d95d4fba85b`.

## Exact Next Packet

- Resume [`08_linux_wayland_portal_package_and_qualification.md`](./08_linux_wayland_portal_package_and_qualification.md)
  only to record its required native GNOME, KDE, and package-artifact manual
  gates. Do not start Packet 09 until Packet 08 is complete and separately
  committed with explicit authorization.

## Blockers

- No blocker remains for completed Packet 06.
- Packet 07 platform readiness is confirmed through Prompt MCP decision
  `workflow.platform-readiness-packet-07:v2`; no source transport is authorized
  or needed. Packet 07 execution is authorized through
  `authorization.packet-07-execution:v1`.
- No blocker remains for completed Packet 07. Do not use automated, headless,
  Wayland, Windows, or CI evidence as a substitute for the recorded interactive
  X11 gate.
- Packet 08 cannot be checked complete until AC-MAN-003 is recorded on both
  native GNOME Wayland and KDE Wayland, and representative local AppImage, DEB,
  and RPM artifacts pass `npm run verify:installers` on a supported package
  host. Source transport, if required for those hosts, needs separate user
  authorization.
