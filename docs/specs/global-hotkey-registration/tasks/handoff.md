# Global Hotkey Registration — Handoff

## Completed Packets

- Packet 01 — Nullable Persistence And Shared Contracts. Specification revision
  2, audited plan revision 3, and Packet 01 authorization revision 2 are
  recorded in the decision ledger.

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
- `src/main/shortcuts.ts` — skip unassigned legacy registration, including
  Retry synchronization.
- `src/renderer/AppSettingsWindow.tsx`,
  `src/renderer/components/settings/ShortcutsSection.tsx`, and
  `src/renderer/components/HotkeyRow.tsx` — nullable temporary value projection
  with no accelerator fallback.
- `src/renderer/useProviderHotkeyHomeIntegration.ts` — do not publish the
  obsolete idle-record shortcut status when Record is unassigned.
- `tests/main/appConfigStore.test.ts`, `tests/main/hotkeys.test.ts`, and
  `tests/main/shortcutController.test.ts` — nullable persistence/contracts and
  no-registration regression coverage.
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

## Exact Next Packet

- [`02_platform_policy_and_registration_service.md`](./02_platform_policy_and_registration_service.md)

## Blockers

- None for Packet 02.
- The pre-Packet-07 platform-readiness gate remains a future execution
  prerequisite, not a blocker for Packets 01–06.
