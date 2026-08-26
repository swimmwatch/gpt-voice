# 01 Nullable Persistence And Shared Contracts

## Outcome

Make unassigned shortcuts a first-class persisted state. A fresh store exposes
and writes seven explicit nulls, valid legacy assignments survive unchanged,
invalid or absent legacy fields become null, and every later layer receives
stable enum-backed registration contracts, binding-authority/effective-trigger
semantics, exhaustive validators, and deterministic target ordering.

## Prerequisites

- The plan is approved and this packet has a separate explicit
  `incremental-implementation` authorization.
- Read `AGENTS.md`, `tasks/todo.md`, this packet, and the **Project And
  Commands**, **Code And Logging**, and **Tests And Documentation** convention
  sections.
- Inspect `src/shared/hotkeys.ts`, the hotkey fields/load/save path in
  `src/main/config.ts`, and their focused tests only.

## Owned Requirements

- OUT-003, OUT-004
- SCOPE-001
- DATA-001..DATA-008
- ARCH-005
- COMP-001, COMP-002
- ROLL-001
- QUAL-001 / AC-AUTO-001

## In Scope

- Shared hotkey types, enum wire values, validators, target/value lookup, and
  pure normalization/conflict helpers.
- Nullable effective accelerators, explicit binding authority, and the bounded
  reconciliation failure value used by later main/IPC/renderer packets.
- `AppConfigSnapshot` and `HotkeySettings` nullability.
- Fresh-store, load/reload, atomic persist, clear, and reset behavior.
- Removal of runtime dependence on legacy default-shortcut constants.
- Minimal legacy null-compatibility in the existing controller registration
  path and Settings value projection, solely so the nullable contract remains
  strict-type-safe before the later service and IPC migrations.
- Focused shared/config/controller tests and compatible deterministic test
  fixtures.

## Out Of Scope

- New registration service, platform reservation policy, callback generations,
  compensation, lifecycle redesign, IPC, localization, portal setup, package
  identity, and manual desktop testing.
- Runtime IPC query/event/mutation/test contracts, preload, and renderer
  authoritative-state migration (Packet 04), plus final Settings presentation,
  accessibility, localization, capture/modal, and failure UX (Packet 05).
- Deleting legacy valid assignments or rewriting them merely to normalize
  display/platform spelling.
- New dependencies, config files, schema-version fields, or broad application
  reset behavior unrelated to shortcuts.

## Task Contract

1. Keep `HOTKEY_TARGETS` in exact order: `record`, `stop`, `cancel`,
   `translate`, `prettify`, `prettifyQuick`, `retryTranscription`.
2. Change all seven `HotkeySettings` fields and corresponding config snapshot
   fields to `string | null`. `null` is the only unassigned value.
3. Add string enums with these stable wire values:
   - `DesktopPlatform`: `windows`, `linux`, `macos`, `unsupported`;
   - `LinuxSessionType`: `x11`, `wayland`, `unknown`, `not-applicable`;
   - `HotkeyBindingAuthority`: `none`, `application`,
     `desktop-environment`;
   - `HotkeyRegistrationStatus`: `unassigned`, `registered`, `failed`;
   - `HotkeyDispatchStatus`: `enabled`, `suppressed`;
   - `HotkeyRegistrationFailureCode`: `invalid-accelerator`,
     `internal-conflict`, `os-reserved`, `registration-rejected`,
     `persistence-failed`, `reconciliation-failed`,
     `unsupported-platform`;
   - `HotkeyTestResult`: `detected`, `timed-out`, `unavailable`.
4. Define immutable runtime snapshot entry/snapshot types using the existing
   target order. Each entry contains target, configured accelerator, nullable
   effective accelerator, binding authority, registration status, dispatch
   status, and optional bounded failure code. Configured/effective accelerators
   are `string | null`; authority is never inferred from accelerator text.
5. Add exhaustive pure validators for every enum, nullable accelerator,
   snapshot entry, and exact canonical target order. Update pure lookup,
   conflict, and normalization helpers to skip null values.
   Empty strings remain invalid input and cannot become persisted assignments.
   Keep stateless behavior as functions; do not create a parser/formatter class.
6. Initialize every in-memory shortcut field to null before each load. A
   missing config file, missing property, explicit null, empty string, wrong
   type, or syntactically invalid legacy string produces null for that target
   and never borrows a historical default.
7. Preserve each syntactically valid non-empty persisted string byte-for-byte
   in configuration. Platform normalization is for registration/comparison and
   must not silently rewrite stored legacy bytes.
8. The first saved snapshot writes all seven properties explicitly as null.
   Provide an atomic config-store operation for a registration owner to persist
   one target as `string | null`: if the filesystem write throws, restore the
   prior in-memory hotkey snapshot and rethrow a bounded failure to the caller.
9. Provide a shortcut-only reset operation that atomically persists seven
   nulls. It must not reset providers, locale, browser, recording, Local
   Whisper, text-action enablement, or any other setting.
10. Remove runtime imports and fallback use of `DEFAULT_*_HOTKEY` from the
    persistence/shared consumers changed here. Add only these compatibility
    bridges required by nullable persistence:
    - the existing `ShortcutController` skips every `null` configured
      accelerator during initial registration and Retry re-synchronization; it
      must not call Electron registration, supply an empty/default accelerator,
      or disable the corresponding in-app product action;
    - the temporary Settings chain (`AppSettingsWindow` → `ShortcutsSection` →
      `HotkeyRow`) carries `string | null`; `null` renders no accelerator text
      and cannot select a historical default, an empty persisted value, a
      localized label, or an asserted effective binding;
    - this bridge changes neither capture nor persistence behavior. Packet 03
      replaces controller registration with service delegation, Packet 04
      replaces the temporary projection with authoritative runtime state, and
      Packet 05 owns final unassigned presentation. Tests and demo-only fixture
      modules may retain explicitly named sample accelerators.

## Contracts And Boundaries

- Persisted settings contain only shortcut strings/null and existing unrelated
  config. Do not log config contents, environment values, or filesystem paths.
- Keep one direct config owner. Do not add a pass-through repository around
  `AppConfigStore`.
- The later registration service will depend on a narrow injected view with a
  read operation and atomic single-target persist operation; Packet 01 must
  make that possible without importing Electron.
- Rollback must continue understanding persisted nulls. Reverting UI/runtime
  code must not rematerialize removed defaults.

## Expected Files Or Components

- `src/shared/hotkeys.ts`
- `src/main/config.ts`
- `src/main/shortcuts.ts`
- `src/renderer/AppSettingsWindow.tsx`
- `src/renderer/components/settings/ShortcutsSection.tsx`
- `src/renderer/components/HotkeyRow.tsx`
- `tests/main/hotkeys.test.ts`
- `tests/main/appConfigStore.test.ts`
- `tests/main/shortcutController.test.ts`
- Directly affected type fixtures only; do not update IPC/UI behavior beyond
  the temporary null-preserving projection.

## Acceptance Criteria

- Fresh, missing, partial, explicit-null, empty, invalid, and valid legacy
  configurations produce the exact required seven-target snapshot.
- A first save contains seven explicit nulls; reload is deterministic.
- Existing valid strings are byte-for-byte preserved.
- Clear/reset survive reload, and injected persistence failure restores both
  bytes and in-memory state.
- Pure conflict helpers ignore unassigned peers while still rejecting actual
  configured conflicts.
- Contract tests distinguish configured preference from nullable effective
  accelerator, validate all three binding-authority values, and accept
  `reconciliation-failed` only as the bounded enum value.
- Legacy registration never calls Electron with `null`: all seven initial
  targets and Retry re-synchronization skip unassigned values while retaining
  product callbacks for assigned values.
- A Settings row receiving `null` displays no accelerator text and does not
  select an old default; this temporary prop chain remains strict-type-safe
  until Packet 04 replaces it with runtime state.
- New service, IPC, and final UI ownership remain exclusively in Packets
  02–05; no temporary fallback/default or registration workaround crosses
  their boundaries.

## Verification

- `node --import tsx --test tests/main/hotkeys.test.ts tests/main/appConfigStore.test.ts tests/main/shortcutController.test.ts`
- `npm run typecheck`
- `npm run test:types`
- Scoped ESLint and Prettier over changed source/tests.
- `git diff --check`

## Failure And Rollback

- If a legacy registration path still assumes a string, make only that path
  null-safe by skipping registration; do not introduce the later service or a
  fallback binding.
- If temporary Settings rendering cannot represent `null` without a
  product-facing semantic change, stop and return to planning; do not turn it
  into an empty persisted value or a historical default.
- A write failure that leaves mutated in-memory shortcut state blocks
  completion.
- Rollback restores the previous type/consumer changes together but preserves
  null-tolerant loading before downgrade; never rewrite nulls to historical
  defaults.

## Manual Gates

- None. This packet is deterministic and automated.

## References

- Specification anchors: **Shared Types And Persistence**, **Architecture And
  Ownership**, **Compatibility, Dependencies, And Rollback**.
- Required conventions: **Project And Commands**, **Code And Logging**, **Tests
  And Documentation**.

## Completion And Handoff

After checks pass, mark only Packet 01 complete in `todo.md`, record exact
changed files/checks and `Exact next packet: 02` in `handoff.md`, present the
increment for review, and stop. Do not commit, push, or start Packet 02.
