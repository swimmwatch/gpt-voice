# 09 App Settings Profile Management — Exact Approved Design

## Outcome

Add complete transactional profile management at the top of App Settings >
Prettify and reproduce the approved management surface exactly. The visible
draft must support unified mixed ordering, search, CRUD, built-in inspection,
default replacement, import preview/conflicts, and explicit custom export,
while one global Save/Discard contract remains authoritative.

## Prerequisites

- Packets 01, 02, 07, and 08 are complete and approved.
- Read `AGENTS.md`, `todo.md`, `handoff.md`, the **Project And Commands**,
  **Electron And Providers**, **Tests And Documentation**, and **Code And
  Logging** convention sections.
- Read every mandatory design artifact in **References** before editing.
- Inspect `AppSettingsWindow`, `appSettingsUtils`, settings close state,
  `usePrettifySettingsController`, `PrettifySection`, navigation/footer, every
  UI primitive used by the blueprint, i18n, and direct tests.
- Do not make an independent design decision. The exact-reproduction and
  stop-on-deviation rules below are mandatory.

## Owned Requirements

- PROF-002, PROF-003, PROF-004, PROF-005, PROF-006, PROF-007
- DATA-001, DATA-002, DATA-003, DATA-004
- UI-004, UI-006, UI-008, UI-009, UI-011, UI-012
- PORT-001, PORT-002, PORT-003, PORT-004
- SAFE-004
- PRIV-003
- FAIL-001
- QUAL-001
- QUAL-002 / AC-AUTO-009
- QUAL-002 / AC-AUTO-010
- AC-MAN-005, AC-MAN-006
- All six unnumbered **Profile Management Flow** steps

## In Scope

- Transactional profile catalog draft/baseline/save/validation/close-discard
  integration.
- Exact profile-management section, rows, menus, editor, delete/default
  replacement, search/reorder, import/export flows and outcome announcements.
- Localized copy, pure reducers/view state, renderer/settings tests, visual and
  accessibility gates.
- Removal of the now-internal legacy prompt textarea while preserving all
  provider/model/generation controls.

## Out Of Scope

- Any change to the main 520×420 window or chooser design.
- New colors, dependencies, drag library, custom assets/SVG, card abstraction,
  second Settings footer, immediate per-action persistence, cloud/share UI, or
  result preview.
- Provider/model/generation setting changes beyond removing direct legacy
  prompt editing.

## Task Contract

### Non-Negotiable Design Reproduction

Implement this surface exactly from the linked design contract: the Markdown
contract is normative for behavior, responsive rules, and accessibility; the
TSX blueprint is normative for component hierarchy, repository primitives,
tokens, dimensions/spacing, interaction states, and copy hierarchy; the main
PNG is the approved visual reference at 760×720; the **right-hand “After —
profile search added”** pane in the search comparison is the current approved
search revision and the left “Before” pane is superseded; the dedicated editor
PNG is the approved visual reference for the persistent SAFE-004 helper in the
Create profile dialog. This is production wiring, not a design exercise.
Reproduce the layout, spacing, typography, colors/tokens, radii, icons,
component variants, borders, row density, badges, state hierarchy, copy
hierarchy, focus/keyboard behavior, roles, accessible names, live regions,
scrolling/wrapping, and responsive behavior exactly. Do not redesign,
reinterpret, simplify, substitute primitives, add/remove controls or
indicators, or make unsolicited UX improvements. Use the existing repository
components and styles named in the blueprint. Replace reference strings only
with equivalent localized keys and replace preview callbacks/data only with
production draft state and typed `window.electronAPI` wiring; neither change
may alter approved presentation/behavior. Do not copy preview mock data or ID
generation into production. If an artifact conflicts with a repository
constraint or any required deviation/ambiguity is found, **STOP this packet**
and return it to planning/specification with evidence; do not improvise. No
deviation is allowed without an approved design/spec revision.

### Transactional State

1. Add a dedicated profile draft controller/reducer; do not couple profile CRUD
   state to provider/model lifecycle. Load authoritative catalog and baseline
   together. Deep equality includes schema/default/custom records/order.
2. Create/edit/duplicate/delete/default/order/import mutate only the profile
   draft. Search, open menus/dialogs, export selection, and export itself do not
   dirty the draft.
3. Add profiles as one `AppSettingsChangedGroup`. Save sends one complete
   catalog candidate to packet 02; main revalidates and atomically commits
   record/default/order/projection. Update profile baseline only from the
   authoritative successful result. A failed group remains dirty/retryable and
   preserves the current partial-save behavior of unrelated Settings groups.
   In the existing sequential save coordinator, attempt the provider settings
   group before the profile catalog group, and continue attempting later dirty
   groups after an earlier group-level failure as today. Reconcile each
   baseline only on that group's authoritative success. Cover provider-success/
   profile-failure, provider-failure/profile-success, and both-success results;
   in every order the packet 02 projection remains catalog-owned.
4. Dirty close uses the existing discard confirmation; Save blocks while
   saving or invalid. Do not add a second footer or per-row save.
5. The legacy `PrettifySettings.prompt` remains an internal rollback projection:
   remove its textarea/field from `PrettifySection` and remove it from editable
   renderer provider drafts. Preserve packet 02's exact main-side contract:
   provider-save input omits `prompt`, and a stale/malformed payload that
   supplies it is rejected with the stable safe validation code; it is never
   ignored or allowed to alter the projection.
   Keep provider, privacy notice, base URL/key, model, model actions,
   temperature, and advanced generation controls below the new section.

### Exact Main Surface

6. Place `Transformation profiles` first under the existing Prettify heading,
   before a `Separator` and existing provider/generation controls. Preserve the
   existing 760×720 shell, 16 px padding, 208 px navigation, 16 px column gap,
   scrollable content, and persistent global Settings footer.
7. Reproduce heading/purpose plus primary `New profile`, the local-data/provider
   disclosure note, then one toolbar containing Search plus outline Import and
   Export, then a 244 px ordered ScrollArea.
8. Render one exact mixed-order `role=list`; never split/group built-in/custom.
   Rows are `role=listitem`, minimum 72 px, with `GripVertical`, wrapping
   name/description, Default and identity badges, and `MoreHorizontal` menu.
   **No check icon, radio, selected-row state, visibility state, or
   selected/default glyph beyond the approved text badge is permitted.**
9. Use only blueprint primitives/tokens/icons. Native pointer drag previews the
   destination with `primary-subtle`; no drag-and-drop dependency. Support
   `Alt+ArrowUp/Down` on the profile-specific grip and Move up/down menu items.
   Invalid first/last moves are disabled.
10. Search uses packet 01's exact normalized multi-term name+description helper,
    preserves draft mixed order, and has a polite result count. Any non-empty
    normalized query disables **every** reorder path: pointer drag, grip,
    Alt+Arrow, Move up/down. Tooltip/menu text is exactly localized
    `Clear search to reorder`. All non-order actions remain available. Empty
    copy is `No profiles found` /
    `Try a different name or description.`
11. Exact action matrix:
    - built-in: View profile, Duplicate, Set as default, Move;
    - custom: Edit profile, Duplicate, Set as default, Move, Delete;
    - current default disables Set as default;
    - built-ins are never editable/deletable/replaceable.
12. Create/duplicate appends a new main-generated custom ID at the draft order
    end. Add one typed Settings-only
    `allocatePrettifyCustomProfileId({ forbiddenCustomProfileIds })`
    API/channel through exact Settings sender validation; it calls packet 02's
    process-owned allocator and exposes no UUID generator to the renderer. On a
    valid Create/Duplicate confirmation, pass every custom ID in the current
    draft, including unsaved imported profiles, as an IDs-only list. Main
    strictly revalidates the bounded list before allocation. Allocation/list
    validation failure keeps the editor open, performs no draft mutation, and
    shows one localized content-free error.
    Main/chooser/history/stale/wrong-URL senders are rejected. Duplicate opens a
    prefilled custom editor and never mutates source. Edit/Replace preserves ID
    and position. Default change never reorders.

### Exact Editor And Delete Flows

13. Reproduce the blueprint `Dialog` editor:
    - Name required, `Input`, max 64;
    - Description optional, `Input`, max 240, chooser-subtitle help;
    - Transformation instructions required, multiline `Textarea`, max 4,000
      after trim, provider-transmission disclosure, and the approved visible
      fixed-boundaries help explaining that custom instructions cannot choose
      provider/model/tools/process/output destination or override product
      invariants and may steer only wording, organization, verbosity, and tone;
    - Custom create/edit/duplicate: Cancel plus correct Create/Save action;
    - Built-in view: disabled fields, Close plus
      `Duplicate to customize`.
      Surface packet 01/main validation by profile and field without logging
      values. Restore focus to the invoking row/menu action.
14. Non-default custom deletion uses the blueprint `AlertDialog`, exact
    profile-name title hierarchy, Cancel and destructive Delete.
15. A default custom cannot use that simple delete. Open one repository
    `Dialog` titled `Replace default before deleting`, explain that quick apply
    requires a valid default, list every other valid profile in current draft
    order using the existing `Select`, and provide Cancel plus destructive
    `Delete and set default`. Confirm performs replacement+delete in one draft
    reducer action; no valid replacement means confirm disabled. Built-ins
    remain non-deletable.

### Exact Export And Import Flows

16. Export button opens one `Dialog` titled `Export profiles` before filesystem
    access:
    - show an explicit warning that profile instructions can contain private
      text and JSON is plaintext;
    - show only current-draft custom profiles in one scrollable multi-select;
    - no item is preselected;
    - use accessible native checkbox inputs styled only with existing tokens
      because the repository has no checkbox primitive; do not add a
      dependency;
    - Cancel plus `Export selected`; confirm is disabled until at least one;
    - pass exactly selected current-draft records and
      `confirmedPlaintext: true` to packet 08.
      Cancellation/failure restores focus and does not dirty catalog.
17. Import button invokes packet 08's main-owned open dialog. Picker cancellation
    is a no-op. A validated document opens one `Dialog` titled
    `Import profiles` with records in file order and visible no-conflict or
    localized conflict status.
18. For each conflict, use an existing `Select` labeled for that profile with
    Rename, Replace, Skip:
    - Replace disabled for built-in or dual-target conflict, with the packet 08
      reason text;
    - Rename reveals a required Name `Input` and field error;
    - no-conflict records require no choice and will be appended;
    - footer Cancel plus `Apply import`, disabled until every conflict/rename and
      post-import capacity is valid.
19. Apply calls packet 08 main merge authority with the **current draft** and
    decisions, then replaces the profile draft with the returned complete
    catalog. It does not persist until global Save. Default and existing order
    remain; replacements stay; new records append in file order.
20. Show localized, content/path-free errors and polite create/edit/default/
    reorder/delete/import/export outcomes. Do not put profile values, file
    contents/paths, or complete order arrays in renderer logs or exceptions.

### Responsive And Accessibility

21. At preferred width, search/actions share one row. At 440×520, toolbar stacks,
    content column scrolls, metadata wraps, and global footer remains visible.
    Below 640 px, preserve existing icon-collapsed navigation. No persistent
    action may clip.
22. Provide profile-specific accessible names for grip/actions, visible focus,
    list/listitem semantics (not listbox), keyboard reorder, dialog focus
    containment/restoration, disabled states, polite result/action
    announcements, contrast, and reduced motion.
23. Localize all new visible copy, built-in display metadata, validation,
    warnings, conflicts, confirmations, and announcements in every supported
    locale. Validate long strings and 200 customs at minimum viewport.

## Contracts And Boundaries

- Renderer uses only typed `window.electronAPI`; main owns persistence,
  validation, UUID, import/export dialogs/filesystem.
- Catalog/default/order/import merge is one Settings draft group; provider
  settings remain a separate existing group.
- Profile instructions/default/order never enter logs, default diagnostics, OS
  notifications, or provider requests except the selected effective instruction
  during packet 03 execution.
- Reordering affects presentation only, not default, one-off selection,
  instructions, provider settings, projection, or cache identity.
- Existing main window/recording/transcription/Translation behavior is
  unchanged.

## Expected Files Or Components

- Add a dedicated profile draft reducer/controller under `src/renderer`.
- Add
  `src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx`
  (or narrowly equivalent).
- Update:
  - `src/renderer/AppSettingsWindow.tsx`
  - `src/renderer/appSettingsUtils.ts`
  - `src/renderer/components/settings/PrettifySection.tsx`
  - Settings validation/presentation and typed desktop API files
  - Settings-only IPC/preload API declarations for custom-ID allocation
  - every locale catalog
- Add pure reducer/view-state tests and source-contract/component tests for the
  exact surface.
- Extend:
  - `tests/renderer/appSettingsUtils.test.ts`
  - `tests/renderer/settingsCloseViewState.test.ts`
  - `tests/renderer/appSettingsValidationPresentation.test.ts`
  - `tests/renderer/appSettingsPrettifyModels.test.ts`
  - `tests/main/i18n.test.ts`
  - Settings-only IPC/preload tests for allocation sender validation, success,
    collision exhaustion, and stable safe failure

Do not edit/move the approved design artifacts.

## Acceptance Criteria

- The 760×720 and 440×520 production surface matches approved designs with no
  unresolved P0–P2 difference.
- One exact mixed list supports every action, search, reorder-disabled,
  menu/dialog/delete/default replacement, empty, long, 200-profile, and dirty
  state without clipping.
- Search preserves order and disables every reorder mechanism until cleared.
- No Settings row selection/check/radio/visibility state exists.
- Every mutation remains draft-only; one Save atomically commits the profile
  group and updates baseline from authoritative result; dirty close uses
  current confirmation.
- Built-ins remain immutable; default deletion requires atomic replacement.
- The editor shows the exact approved provider-transmission and fixed-boundary
  disclosures required by SAFE-004/PRIV-003.
- Create and Duplicate obtain IDs only through the Settings-only main allocator;
  it never collides with an ID present only in the unsaved/imported draft, and
  rejected/stale senders, malformed forbidden lists, or allocation failure
  cannot mutate the draft.
- Export has no preselection and explicit plaintext warning; import preview
  resolves all conflicts and changes draft only.
- Legacy prompt cannot be edited independently; all provider/generation
  controls remain otherwise unchanged.
- Full keyboard/accessibility/localization contracts pass with no console
  errors/warnings or prohibited logs.

## Verification

```text
rtk test node --import tsx --test tests/renderer/prettifyProfilesDraft.test.ts
rtk test node --import tsx --test tests/renderer/appSettingsUtils.test.ts
rtk test node --import tsx --test tests/renderer/settingsCloseViewState.test.ts
rtk test node --import tsx --test tests/renderer/appSettingsValidationPresentation.test.ts
rtk test node --import tsx --test tests/renderer/appSettingsPrettifyModels.test.ts
rtk test node --import tsx --test tests/main/appSettingsSectionIpcContract.test.ts
rtk test node --import tsx --test tests/main/preloadApi.test.ts
rtk test node --import tsx --test tests/main/i18n.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run build:prod
```

Use actual new test filenames if split; run directly affected main catalog,
portability, IPC, and preload tests plus task-local lint/format checks.

## Failure And Rollback

- Invalid draft/import/export input never mutates baseline/persisted state.
- Failed profile save keeps draft retryable; successful unrelated groups retain
  current partial-save reconciliation behavior.
- Dialog/picker/IPC failure restores focus and shows only safe localized error.
- Rollback restores prior Settings component/prompt field while packet 02's
  projection/catalog remains compatible; never delete user catalog data.
- Any design ambiguity/deviation stops the packet rather than inviting
  implementation improvisation.

## Manual Gates

- MANUAL GATE: capture DSF=1 screenshots at 760×720 and 440×520 and compare
  against the main PNG and the right-hand current search-comparison pane;
  capture the Create profile dialog at 760×720 and compare its persistent
  fixed-boundaries helper against the dedicated editor PNG.
- Exercise menu, editor, built-in read-only, non-default delete, default
  replacement, export zero/preselected states, import no-conflict/single/dual
  conflicts, filter-empty, reorder-disabled, dirty Save/Discard, long localized
  metadata, and 200 customs.
- Require footer visible, zero console errors/warnings, full keyboard/focus/
  screen-reader/reduced-motion behavior, and no unresolved P0–P2 difference.
- No generated screenshot commit, real profile export, commit, push, PR,
  installer, or release action is authorized.

## References

Mandatory design bundle — direct links:

- [Settings design contract](../design/profiles-settings-design.md)
- [Settings code-native blueprint](../design/PrettifyProfilesSettings.blueprint.tsx)
- [Approved Settings PNG](../design/prettify-profiles-settings-preview.png)
- [Approved search revision comparison](../design/prettify-profiles-settings-search-comparison.png)
- [Approved editor fixed-boundaries PNG](../design/prettify-profile-editor-boundaries-preview.png)
- [Approved design QA](../../../../design-qa.md)

The right comparison pane is current; the left is historical and must not be
implemented. Specification behavior/default/import rules override preview-only
mock callbacks; any resulting ambiguity must stop the packet.

## Completion And Handoff

After automated and available manual verification:

1. Mark packet 09 complete in `todo.md`.
2. Update `handoff.md` with exact draft/UI/locale/API files, checks, visual gates
   or outstanding platform gates, and packet 10 as next.
3. Present the faithful Settings implementation for review and stop. Do not
   commit or start packet 10.
