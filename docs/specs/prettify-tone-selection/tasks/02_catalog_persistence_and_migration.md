# 02 Catalog Persistence And Migration

## Outcome

Add one process-owned catalog state inside the atomic application
configuration. It must migrate existing Prettify prompts exactly once,
normalize and repair default/order data, preserve unrelated settings, and
commit the catalog/default/order together with the legacy prompt projection
before publishing new in-memory state.

## Prerequisites

- Packet 01 is complete and approved.
- Read `AGENTS.md`, the current `todo.md` entry, `handoff.md`, and the
  **Dependency Injection And Runtime Ownership** and **Code And Logging**
  convention sections.
- Inspect `src/main/config.ts`, `src/main/translationSettings.ts`,
  `src/main/services/prettifySettingsStorage.ts`, their direct tests, and the
  packet 01 profile domain.
- Use the planning decision
  `architecture.profile-catalog-persistence:v1`: the catalog lives in the
  atomic `config.json` snapshot, not in a separate profile file or the encrypted
  provider-settings file.

## Owned Requirements

- OUT-003
- PROF-003, PROF-004, PROF-005, PROF-007
- DATA-001, DATA-002, DATA-003, DATA-004
- FAIL-001
- COMP-001, COMP-002, COMP-003, COMP-004, COMP-006
- PRIV-005
- QUAL-002 / AC-AUTO-001
- QUAL-002 / AC-AUTO-002
- The six unnumbered **Profile Management Flow** steps that concern
  authoritative snapshot/default/order persistence
- The unnumbered corrupt-catalog recovery paragraph

## In Scope

- A stateful profile-catalog state/repository owned by `AppConfigStore`.
- Deep immutable catalog snapshots and authoritative full-snapshot save.
- Fresh-install initialization, legacy prompt migration, downgrade projection,
  order normalization, corrupt-state salvage, and one bounded repair notice.
- Injected UUID generation, a collision-safe process-owned custom-ID allocator,
  and deterministic migration fixtures.
- Immediate main-side ownership of the legacy prompt projection, including
  rejection of stale renderer attempts to edit it through provider saves.
- The narrow non-visual renderer serialization seam that converts the existing
  Prettify Settings draft to a prompt-free provider-save DTO.
- Localized repair-notice copy in every supported locale.
- Atomic persistence-before-publication tests and unrelated-setting
  preservation.

## Out Of Scope

- Provider execution/cache changes.
- Chooser, visual Settings form/component changes, legacy textarea removal,
  hotkey, new IPC channels, or import/export UI. Packet 09 removes the visible
  legacy prompt field; this packet changes only its save serialization.
- Separate profile database/file, cloud storage, sharing, timestamps, hidden
  profiles, or mutable built-ins.
- Immediate per-row persistence; Settings integration remains transactional in
  packet 09.

## Task Contract

1. Introduce a class such as `PrettifyProfileCatalogState` in main. It owns
   normalized catalog state and a one-shot pending repair notice. It does not
   perform filesystem I/O itself; `AppConfigStore` supplies the atomic persist
   callback, following `TranslationSettingsState`.
2. Add `prettifyProfileCatalog` to the versioned application config snapshot.
   Persist only schema version, default ID, custom records, and chooser-order
   IDs. Reconstruct built-ins from packet 01 definitions.
3. Add `AppConfigStore` methods with deep immutable results:
   - get the authoritative catalog view;
   - save one complete candidate catalog atomically;
   - resolve/consume a pending repair notice.
     Use exact names consistent with current store conventions; do not expose
     mutable state or a module-global instance.
4. Inject a custom-ID generator at the composition/config dependency boundary.
   Production uses `crypto.randomUUID()` and emits `custom:<uuid>`; tests use a
   deterministic generator. The process-owned catalog authority exposes
   `allocateCustomProfileId(additionalForbiddenIds)` for all later Settings and
   import wiring. The additional input contains IDs only: main accepts at most
   200 unique, strictly valid `custom:<uuid>` strings and rejects malformed,
   duplicate, or over-limit lists without allocation. The allocator checks the
   authoritative catalog, valid additional forbidden IDs from the current
   unsaved draft/import plan, and IDs already issued during this process;
   reserves the returned ID before returning it; and retries through a named
   finite attempt bound. Exhaustion returns one stable content-free allocation
   error and mutates neither catalog nor config. Never derive IDs from names,
   time, order, or file contents.
5. Save behavior is persistence-before-publication:
   validate/normalize one complete candidate, derive the matching legacy prompt
   projection, atomically write the complete config snapshot, and only then
   replace in-memory catalog and projection. A write failure leaves both prior
   memory and prior bytes authoritative.
6. Keep `prettifySettings.prompt` as the legacy projection only. It equals the
   current default profile instruction and updates in the same `config.json`
   write whenever:
   - default ID changes;
   - the current default custom instruction changes;
   - the default custom is atomically deleted and replaced.
     Editing/reordering a non-default profile and one-off chooser selection never
     changes it.
     From this packet onward, renderer/provider-save input types omit `prompt`.
     Main must reject any stale or malformed provider-save payload that supplies
     a `prompt` property with one stable content-free validation code; omission
     preserves the current catalog-owned projection. `PrettifySettingsStorage`
     and `AppConfigStore` must update provider/model/generation fields without
     accepting or overwriting that projection.
     Add one explicit renderer helper/DTO conversion in
     `src/renderer/appSettingsUtils.ts` that serializes the current
     `PrettifySettingsDraft` to the prompt-free provider-save input before
     `setPrettifySettings`. Define the shared DTO as
     `PrettifyProviderSettingsInput` and the pure renderer conversion as
     `createPrettifyProviderSettingsInput`; explicitly construct the DTO from the
     canonical existing provider/model/generation fields and secret-update
     markers instead of spreading the draft and deleting `prompt`. Update the
     typed desktop API signature and strict main guard to that DTO. Do not pass
     the whole draft. The legacy textarea may remain visible until packet 09, but
     its draft value is never serialized; authoritative save reconciliation
     restores the catalog-owned projection. Main-side unknown-key validation
     still rejects a direct malicious/stale payload containing `prompt`.
7. Fresh-install and upgrade detection must be explicit:
   - no prior config file: create schema version 1 with default
     `prompt-ready`, no customs, and canonical four-ID order;
   - existing config without a profile catalog: perform the migration below;
   - existing valid catalog: normalize idempotently without creating migration
     records.
8. Legacy migration is exact and idempotent:
   - if the persisted current prompt equals `DEFAULT_PRETTIFY_PROMPT` or any
     recognized `LEGACY_DEFAULT_PRETTIFY_PROMPTS` value, create no custom
     profile, set default to immutable `polish`, and project the current Polish
     instruction;
   - otherwise create exactly one custom profile named
     `Migrated Prettify prompt`, preserve the legacy prompt string
     byte-for-byte as its instruction, generate its ID once, make it default,
     and append it after canonical built-ins;
   - persist the migrated catalog so later starts create no duplicate.
9. Normalized order contains every valid built-in/custom ID exactly once:
   - remove duplicate and unknown IDs while preserving the first valid
     occurrence and relative order;
   - if there is no prior order, use canonical built-ins then customs in stored
     record order;
   - append missing built-ins in canonical relative order, then missing customs
     in stored record order;
   - create/duplicate/new import appends; replace preserves position; delete
     removes the ID.
10. Corrupt-state salvage is deterministic:
    - retain valid custom records in stored order;
    - for duplicate ID/name records retain the first valid record and reject
      later conflicting records;
    - retain at most the first 200 valid records;
    - recover a missing/invalid default to `prompt-ready`;
    - normalize order as above;
    - never reset provider, hotkey, locale, Translation, diagnostic, voice, or
      unrelated settings.
11. Persist every repair atomically and queue exactly one generic repair notice
    for that load. Present it once through the existing localized startup
    notification pattern; it contains no profile IDs, names, descriptions,
    instructions, order, path, or raw parse error. Notice failure cannot block
    startup.
    Add the repair-notice keys to every supported locale catalog in this packet
    and extend locale parity tests; do not defer them to a chooser renderer
    packet.
12. A default custom cannot be deleted in an accepted candidate unless the
    same candidate selects a different valid built-in/custom default. The save
    either commits both changes or none.
13. Do not let strict renderer/import validation replace main authority. The
    full catalog save guard must reject malformed candidate data again.

## Contracts And Boundaries

- `AppConfigStore` owns plaintext application state; keep encrypted vLLM key
  handling in `PrettifySettingsStorage`.
- The catalog state is constructed only by the main composition/config root.
- Built-in instructions are resolved from packet 01 constants, never persisted
  as mutable records.
- Runtime logs may include only repair/category booleans and counts. They may
  not include complete order arrays or any profile content.
- A repaired or failed profile field cannot reset unrelated config fields.
- The state layer returns immutable copies so renderer/IPC callers cannot
  mutate process-owned state.

## Expected Files Or Components

- Add `src/main/prettifyProfileCatalogState.ts` (or the narrowly equivalent
  name).
- Update `src/main/config.ts`.
- Update the provider-save input boundary and
  `src/main/services/prettifySettingsStorage.ts` so `prompt` cannot be supplied
  by Settings.
- Update the non-visual provider-save DTO/helper in
  `src/renderer/appSettingsUtils.ts`; do not remove or redesign the Settings
  textarea in this packet.
- Update main composition/environment dependency wiring only for injected UUID
  generation and repair notice presentation.
- Update every supported locale catalog.
- Add `tests/main/prettifyProfileCatalogState.test.ts`.
- Extend `tests/main/appConfigStore.test.ts` and
  `tests/main/configPrettifySettings.test.ts`.
- Extend `tests/main/prettifySettingsStorage.test.ts`,
  `tests/shared/prettifySettings.test.ts`,
  `tests/renderer/appSettingsUtils.test.ts`, and `tests/main/i18n.test.ts`.
- Extend the startup-notice test patterned after
  `tests/main/translationSettingsStartupNotice.test.ts`.

Do not add a profile file path to `AppConfigPaths`.

## Acceptance Criteria

- New installs use Prompt-ready; upgrades with an unchanged recognized prompt
  use Polish; upgrades with a custom prompt preserve it byte-for-byte in one
  custom default.
- Repeated loads are idempotent and never duplicate migrated profiles.
- The catalog/default/order and legacy projection update in one atomic config
  snapshot, with persistence-before-publication on success and no partial
  memory/byte change on failure.
- Provider settings saves cannot supply or overwrite `prompt`; a stale payload
  is rejected, an omitted field preserves the projection, and changing the
  catalog default followed by a provider save leaves the new projection
  unchanged.
- An ordinary provider/model/generation-only Settings Save succeeds through the
  prompt-free renderer DTO, its outbound payload has no `prompt` key, and the
  authoritative response preserves the current projection. A temporary edit
  in the still-visible legacy field cannot reach IPC and is reconciled back to
  the authoritative projection.
- Repeated custom-ID allocation returns reserved, valid, non-colliding IDs and
  never returns an ID present only in the validated additional forbidden list
  from an unsaved draft/import. Malformed-list and deterministic
  collision/exhaustion fixtures return only the stable safe failure and do not
  mutate persisted state.
- Every DATA-004 normalization case is fixture-covered.
- Default deletion without a replacement is rejected; replacement plus delete
  commits atomically.
- Corrupt catalogs retain valid custom data and relative order, recover default
  to Prompt-ready, emit one safe warning, and preserve unrelated settings.
- Every supported locale contains the bounded repair-notice copy.
- Deep immutable snapshots cannot be mutated by consumers.

## Verification

```text
rtk test node --import tsx --test tests/main/prettifyProfileCatalogState.test.ts
rtk test node --import tsx --test tests/main/appConfigStore.test.ts
rtk test node --import tsx --test tests/main/configPrettifySettings.test.ts
rtk test node --import tsx --test tests/main/prettifySettingsStorage.test.ts
rtk test node --import tsx --test tests/shared/prettifySettings.test.ts
rtk test node --import tsx --test tests/renderer/appSettingsUtils.test.ts
rtk test node --import tsx --test tests/main/translationSettingsStartupNotice.test.ts
rtk test node --import tsx --test tests/main/i18n.test.ts
rtk npm run typecheck
rtk npm run test:types
```

If a dedicated profile repair-notice test is added, run it alongside (not
instead of) the translation precedent test. Run task-local lint/format checks.

## Failure And Rollback

- JSON parse, validation, normalization, projection, or atomic write failure
  cannot publish partial state.
- A malformed profile branch is isolated from all unrelated settings.
- Before release, rollback consists of reverting this packet; older config
  remains usable through `prettifySettings.prompt`.
- Never delete or rewrite a user's real config during automated tests. Use
  deterministic in-memory/temporary fixtures.

## Manual Gates

- MANUAL GATE: review migration against representative copies of current
  config shapes without exposing private real configs in the repository or
  logs.
- No live profile data, credentials, commit, push, PR, installer, or release
  operation is authorized.

## References

Mandatory:

- Specification sections **Data And Validation**, **Profile Management Flow**,
  **Failure And Recovery**, and **Compatibility And Migration**.
- Planning decisions
  `architecture.profile-catalog-persistence:v1` and
  `data.profile-schema:v2` in `../decisions.yaml`.
- Local precedents `src/main/translationSettings.ts` and
  `src/main/config.ts`.

## Completion And Handoff

After verification:

1. Mark packet 02 complete in `todo.md`.
2. Record exact migrations, changed files, checks, and manual gates in
   `handoff.md`; set packet 03 as next.
3. Present packet 02 for review and stop. Do not commit or start packet 03.
