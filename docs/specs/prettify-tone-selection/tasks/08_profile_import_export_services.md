# 08 Profile Import And Export Services

## Outcome

Implement strict portable profile documents and main-owned import/export
flows. Main must own native dialogs/filesystem, bound and validate all data,
plan deterministic Rename/Replace/Skip outcomes against the current Settings
draft, and return only typed safe results. This packet provides services and
APIs; packet 09 provides the visible dialogs.

## Prerequisites

- Packets 01 and 02 are complete and approved.
- Read `AGENTS.md`, `todo.md`, `handoff.md`, and the **Electron And Providers**,
  **Dependency Injection And Runtime Ownership**, and **Code And Logging**
  convention sections.
- Inspect `DiagnosticsExportService`, diagnostics export IPC/preload tests,
  `TrustedIpcRegistrar.handleSettingsWindow`, `WindowManager`, atomic file
  helpers, profile domain/catalog state, and current Settings preload types.
- Use planning decisions:
  - `portability.export-draft-source:v1`: export the current valid Settings
    draft;
  - `portability.import-dual-conflict:v1`: dual-target conflicts allow Rename
    or Skip only.

## Owned Requirements

- PROF-003, PROF-005, PROF-007
- DATA-001, DATA-003, DATA-004
- PORT-001, PORT-002, PORT-003, PORT-004, PORT-005
- ARCH-001, ARCH-002, ARCH-003
- PRIV-003, PRIV-004, PRIV-005
- QUAL-002 / AC-AUTO-001 (strict malformed-import-data portion)
- QUAL-002 / AC-AUTO-010
- QUAL-003 / AC-AUTO-011
- The unnumbered import/export cancellation/failure contract

## In Scope

- Exact versioned UTF-8 JSON schema and strict parser/serializer.
- Conflict analysis and deterministic draft-merge service.
- Main-owned open/save dialogs, bounded reads, private writes, safe results.
- Settings-only typed IPC/preload API and unit/IPC/privacy tests.

## Out Of Scope

- Visible export selection/plaintext warning/import preview dialogs (packet 09).
- Catalog persistence during import; imports mutate the Settings draft and save
  later through packet 02.
- Built-in export/replacement, chooser order portability, cloud/share links,
  arbitrary paths, or new dependencies.

## Task Contract

1. Define the exact portable JSON document:

   ```json
   {
     "schema": "gpt-voice.prettify-profiles",
     "version": 1,
     "profiles": [
       {
         "id": "custom:<uuid>",
         "name": "…",
         "description": "…",
         "instruction": "…"
       }
     ]
   }
   ```

   `description` may be omitted when empty. Reject extra root/record keys,
   missing keys, arrays/non-objects in wrong positions, unsupported
   schema/version, non-string fields, invalid IDs, duplicates within the file,
   all packet 01 field limits, and more than 200 file records.

2. Enforce 4 MiB on raw bytes **before** UTF-8 decode or JSON parse. Decode with
   a fatal UTF-8 decoder and reject invalid encoding. JSON parsing/validation
   completes for the whole document before returning preview data.
3. Export input comes from the current valid Settings profile draft selected in
   packet 09. Main revalidates the full selected custom records; it never trusts
   renderer validation. Built-ins, zero/unknown IDs, or records not present in
   the supplied validated draft are rejected.
4. Export emits only explicitly selected customs in the explicit selection
   list order. It excludes local default, chooser order, built-ins, provider,
   model/generation settings, hotkeys, credentials/keys/paths, source/result,
   diagnostics, account/session data, timestamps, and machine identifiers.
5. Require a typed `confirmedPlaintext: true` signal from the packet 09 warning
   before opening the save dialog. No profile is preselected in UI; a zero-item
   export request does not open a dialog.
6. Main owns a native save dialog parented to the exact trusted Settings window
   and a native JSON open dialog for import. Use injected dialog/filesystem
   adapters patterned after diagnostics export. Cancel is a successful no-op
   and returns no path.
7. Write export with UTF-8, deterministic two-space JSON plus trailing newline,
   and private file mode `0o600` where supported. Use safe atomic/temp-write
   behavior when practical. Never return/log the selected path or file contents.
8. Import read result sent to renderer contains only validated typed portable
   records and conflict descriptors, not path/raw JSON/parser details.
9. Analyze each imported record against the current valid Settings draft by
   stable ID and packet 01 normalized custom name:
   - no conflict: create record at import apply;
   - one local target (ID, name, or both point to same target): require explicit
     Rename, Replace, or Skip;
   - ID and name point to two different local customs: expose Rename and Skip;
     Replace is unavailable with a localized reason;
   - built-in ID collision is never replaceable.
10. Conflict outcomes are exact:
    - **Rename:** require a user-supplied valid unique name and assign a new
      `custom:<uuid>` ID through packet 02's single process-owned allocator;
    - **Replace:** preserve the one local target's ID and chooser position while
      replacing its name/description/instruction; it cannot target a built-in;
    - **Skip:** no mutation.
11. Applying an import plan is a pure main-authoritative draft transformation:
    revalidate current draft, imported records, every decision, names, IDs, and
    post-import count; require a decision for every conflict; then return one
    complete next catalog draft or no change. Do not persist it here.
12. Keep local default unchanged. Keep every existing profile position.
    Replacements remain in place. Append all newly created no-conflict/Rename
    profiles to the end in original file order. Never import/export/reorder
    chooser order metadata.
13. Any parse, schema, capacity, validation, conflict, permission, read, write,
    destroyed-window, stale-sender, or merge failure leaves persisted/draft
    input unchanged and returns one localized safe code/result. Never include
    file path, contents, profile metadata, instruction, order list, stack, or
    raw OS error.
14. Add Settings-only typed channels through
    `TrustedIpcRegistrar.handleSettingsWindow`. Exact live Settings
    WebContents/frame URL is required. Main/chooser/history/stale renderers are
    rejected.
15. Keep the service class process-owned through composition root with injected
    dialogs, filesystem, packet 02 custom-ID allocator, i18n, logger, and
    notification. Do not inject or call an independent UUID generator. Before
    Rename allocation, construct one deduplicated forbidden-ID `Set`
    containing only IDs that will exist in the validated candidate: every
    current-draft custom ID (including Replace targets), each no-conflict
    imported ID that will append, and every Rename ID allocated earlier in this
    plan. Exclude skipped incoming IDs and incoming Rename/Replace IDs that are
    not retained. Pass the set as a duplicate-free IDs-only list on every
    allocation; its size cannot exceed the already validated 200-profile
    post-import candidate. The shared allocator's process reservation remains
    authoritative if several allocations occur. If any allocation
    fails/exhausts, return no next draft; already reserved unused IDs are
    harmless process-local state and no catalog/profile mutation is returned.
    Add no mutable singleton or dependency.

## Contracts And Boundaries

- Renderer chooses records/conflict actions; main owns filesystem, strict
  validation, the one shared profile-ID allocator, merge authority, and safe
  errors.
- Import preview/merge changes only the renderer's transactional draft; packet
  09 Save commits the full catalog atomically through packet 02.
- Profile data is local plaintext and export plaintext; it is not a credential,
  but it is private and prohibited from logs/default diagnostics.
- No portable order/default/provider/machine data.

## Expected Files Or Components

- Add `src/shared/prettifyProfilePortability.ts`.
- Add `src/main/services/prettifyProfilePortability.ts`.
- Update main composition/environment wiring.
- Update `src/main/ipc.ts`, `src/main/preloadApi.ts`, `src/main/preload.ts`,
  `src/renderer/types.d.ts`.
- Add `tests/shared/prettifyProfilePortability.test.ts`.
- Add `tests/main/prettifyProfilePortability.test.ts`.
- Add/extend Settings-only IPC/preload tests, using
  `tests/main/diagnosticsExportFlow.test.ts` and
  `tests/main/diagnosticsExportIpc.test.ts` as precedents.
- Reuse packet 02 allocator tests and add import fixtures where a deterministic
  candidate collides with an ID present only in the unsaved current draft or
  earlier in the same import plan.

## Acceptance Criteria

- Serializer emits exactly the schema above and none of the forbidden fields.
- Parser enforces size-before-parse, fatal UTF-8, full-document strictness,
  field/count/duplicate bounds, and version/shape rejection.
- Shared and main parser tests satisfy the AC-AUTO-001 malformed-import-data
  contract as well as the portability-specific AC-AUTO-010 cases.
- Export validates current draft records, requires confirmation/non-empty
  selection, is deterministic/private, and reveals no path/content.
- Every conflict combination has deterministic choices; dual-target Replace is
  disabled.
- Rename IDs come only from the shared allocator and skip authoritative,
  unsaved-draft, imported, previously allocated, and earlier-plan collisions;
  exhaustion returns no partial draft.
- Merge preserves default and existing positions, replaces in place, appends
  new records in file order, and is all-or-none.
- Cancel/read/write/permission/stale-window/failure paths are safe no-ops for
  catalog state and privacy tests find no prohibited values.

## Verification

```text
rtk test node --import tsx --test tests/shared/prettifyProfilePortability.test.ts
rtk test node --import tsx --test tests/main/prettifyProfilePortability.test.ts
rtk test node --import tsx --test tests/main/diagnosticsExportFlow.test.ts
rtk test node --import tsx --test tests/main/diagnosticsExportIpc.test.ts
rtk npm run typecheck
rtk npm run test:types
```

Run the actual new IPC/preload test files, directly affected config/catalog
tests, and task-local lint/format checks.

## Failure And Rollback

- Filesystem/dialog/parse/merge failures produce no catalog persistence and no
  partial returned draft.
- Temporary files are cleaned up without logging private paths/content.
- Rollback removes channels/service/schema; existing catalog/config remains
  unchanged because import is not persisted by this packet.
- If a conflict cannot be represented by the exact rules above, reject safely
  and return to planning; do not invent a destructive merge.

## Manual Gates

- MANUAL GATE: native open/save dialog and filesystem permission behavior on
  packaged Windows/Linux is deferred to packet 10.
- Use synthetic profiles only. Never inspect or commit real exported profiles.
- No commit, push, PR, installer, external upload, or release action is
  authorized.

## References

Mandatory:

- Specification **Import And Export**, **Data And Validation**, **Architecture
  And IPC**, and **Safety And Privacy**.
- Decisions `portability.file-contract:v2`,
  `portability.export-draft-source:v1`, and
  `portability.import-dual-conflict:v1`.
- `src/main/services/diagnosticsExport.ts` and its IPC tests.

## Completion And Handoff

After verification:

1. Mark packet 08 complete in `todo.md`.
2. Update `handoff.md` with exact schema/channels/services/tests/manual gates
   and packet 09 as next.
3. Present for review and stop. Do not commit or start packet 09.
