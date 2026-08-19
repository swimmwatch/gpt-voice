# 01 Nullable Persistence And Shared Contracts

## Outcome

Make unassigned shortcuts a first-class persisted state. A fresh store exposes
and writes seven explicit nulls, valid legacy assignments survive unchanged,
invalid or absent legacy fields become null, and every later layer receives
stable enum-backed registration contracts and deterministic target ordering.

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
- DATA-001..DATA-005
- ARCH-005
- COMP-001, COMP-002
- ROLL-001
- QUAL-001 / AC-AUTO-001

## In Scope

- Shared hotkey types, enum wire values, validators, target/value lookup, and
  pure normalization/conflict helpers.
- `AppConfigSnapshot` and `HotkeySettings` nullability.
- Fresh-store, load/reload, atomic persist, clear, and reset behavior.
- Removal of runtime dependence on legacy default-shortcut constants.
- Focused shared/config tests and compatible deterministic test fixtures.

## Out Of Scope

- Electron registration, platform reservation policy, callbacks, IPC, UI,
  localization, portal setup, package identity, and manual desktop testing.
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
   - `HotkeyRegistrationStatus`: `unassigned`, `registered`, `failed`;
   - `HotkeyDispatchStatus`: `enabled`, `suppressed`;
   - `HotkeyRegistrationFailureCode`: `invalid-accelerator`,
     `internal-conflict`, `os-reserved`, `registration-rejected`,
     `persistence-failed`, `unsupported-platform`;
   - `HotkeyTestResult`: `detected`, `timed-out`, `unavailable`.
4. Define immutable runtime snapshot entry/snapshot types using the existing
   target order. Each entry contains target, configured accelerator,
   registered accelerator, registration status, dispatch status, and optional
   bounded failure code. Both accelerators are `string | null`.
5. Update pure lookup, conflict, and normalization helpers to skip null values.
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
10. Remove runtime imports and fallback use of `DEFAULT_*_HOTKEY`. Tests and
    demo-only fixture modules may retain explicitly named sample accelerators,
    but production startup/config/renderer code must not derive behavior from
    legacy defaults.

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
- `tests/main/hotkeys.test.ts`
- `tests/main/appConfigStore.test.ts`
- Directly affected type fixtures only; do not update IPC/UI behavior yet.

## Acceptance Criteria

- Fresh, missing, partial, explicit-null, empty, invalid, and valid legacy
  configurations produce the exact required seven-target snapshot.
- A first save contains seven explicit nulls; reload is deterministic.
- Existing valid strings are byte-for-byte preserved.
- Clear/reset survive reload, and injected persistence failure restores both
  bytes and in-memory state.
- Pure conflict helpers ignore unassigned peers while still rejecting actual
  configured conflicts.
- Runtime default constants are no longer imported by production consumers
  changed in this packet; any consumers left for later packets are enumerated
  in `handoff.md` rather than patched out of sequence.

## Verification

- `node --import tsx --test tests/main/hotkeys.test.ts tests/main/appConfigStore.test.ts`
- `npm run typecheck`
- `npm run test:types`
- Scoped ESLint and Prettier over changed source/tests.
- `git diff --check`

## Failure And Rollback

- If another config subsystem assumes string-only shortcut fields, adapt only
  its compile-time fixture or stop and record the exact coupling for its owning
  packet; do not inject a runtime default.
- A write failure that leaves mutated in-memory shortcut state blocks
  completion.
- Rollback restores previous code but preserves null-tolerant loading before
  downgrade; never rewrite nulls to historical defaults.

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
