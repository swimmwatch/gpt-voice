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

## Changed Files

- `docs/specs/global-hotkey-registration/spec.md` — approved revision 2
  metadata and durable contract.
- `docs/specs/global-hotkey-registration/decisions.yaml` — specification
  revision 2 approval, plan revision 3 approval, and revised Packet 01
  authorization.
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
- `tests/main/hotkeyIpc.test.ts`, `tests/main/hotkeyIpcController.test.ts`,
  `tests/main/hotkeyIpcContract.test.ts`, and `tests/main/preloadApi.test.ts`
  — strict boundary, trusted owner, revision, cancellation, and preload decoder
  coverage.
- `tests/main/firstLaunchStartupIpc.test.ts` and
  `tests/main/translationSettingsInitializationIpc.test.ts` — synchronized IPC
  controller construction harnesses.
- `tests/renderer/providerHotkeyHomeIntegration.test.ts` — authoritative-state
  renderer source contract and current bounded recording rejection assertion.
- `scripts/local-whisper/qualification/` — restored the current focused
  performance manifest, explicit artifact validation mode, nullable lifecycle,
  native stream/diagnostic, and process-session contracts that blocked the
  repository-wide test typecheck.
- `tests/main/localWhisper/`, `tests/main/mainProcessApplication.test.ts`, and
  `tests/scripts/localWhisper/qualification/` — synchronized strict fixtures
  with current artifact, IPC, runtime dependency, model, and stream contracts.

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

## Exact Next Packet

- [`05_settings_registration_experience.md`](./05_settings_registration_experience.md)

## Blockers

- None for Packet 05.
- The pre-Packet-07 platform-readiness gate remains a future execution
  prerequisite, not a blocker for Packets 01–06.
