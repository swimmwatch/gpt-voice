# Prettify Profiles Settings — Implementation Design

Status: code-native design blueprint for the approved
[`Prettify Transformation Profiles` specification](../spec.md)

Code reference:
[`PrettifyProfilesSettings.blueprint.tsx`](./PrettifyProfilesSettings.blueprint.tsx)

Rendered reference:
[`prettify-profiles-settings-preview.png`](./prettify-profiles-settings-preview.png)

Editor boundary reference:
[`prettify-profile-editor-boundaries-preview.png`](./prettify-profile-editor-boundaries-preview.png)

## Design Intent

Profile management belongs at the top of `App Settings > Prettify`, before the
existing provider and generation controls. The section optimizes first for
creating reusable AI-prompt transformations and second for cleaning general
voice dictation.

The visual language follows the approved chooser and current App Settings:
compact dark surfaces, existing GPT-Voice tokens, 8 px surface radii, small
semantic badges, Lucide icons, and the transactional Settings footer. It is a
management surface, not another chooser: rows never select a one-off profile or
start Prettify.

## Settings Placement

```text
AppSettingsWindow (existing 760 × 720 preferred size)
├── SettingsNavigation (existing, Prettify active)
├── PrettifySection
│   ├── Transformation profiles (new, first)
│   │   ├── Heading + New profile
│   │   ├── Local-storage/order note
│   │   ├── Search + Import + Export
│   │   └── One unified ordered profile list
│   ├── Separator
│   └── Provider and generation controls (existing)
└── SettingsFooter (existing transactional Save)
```

The new section participates in the current draft/snapshot model. Create, edit,
duplicate, delete, default, import, and reorder operations mutate only the
Settings draft. `Save changes` persists the complete draft; closing a dirty
window uses the existing discard confirmation. No list action writes through
immediately.

## Ordered List Contract

Render one list in the exact persisted chooser order. Do not split it into
Built-in and Custom groups: the approved contract allows the two kinds to be
interleaved.

Each row contains:

1. A `GripVertical` handle, using native pointer drag in the blueprint.
2. Name, short chooser description, `Default` badge when applicable, and a
   `Built-in` or `Custom` identity badge.
3. One `MoreHorizontal` action menu.

Dragging a row over another row moves it to that position. A primary-colored
target surface previews the destination. Dropping updates only the draft order.
To avoid pointer-only behavior, the grip supports `Alt + Arrow Up/Down`, and the
action menu exposes explicit `Move up` and `Move down` commands. The first and
last invalid moves are disabled.

No check icon, radio marker, selected row, or visibility toggle belongs in this
list. The chooser uses the same order but remains selection-only.

## Search Contract

Use the same normalized multi-term matching as the chooser. Search compares the
visible profile name and description, ignores case and diacritics, and
preserves the current mixed chooser order in its results.

While a non-empty search query is active:

- the drag handle, `Alt + Arrow Up/Down`, Move up, and Move down are disabled;
- the tooltip explains `Clear search to reorder`;
- create, inspect, edit, duplicate, set default, delete, import, and export
  remain available;
- an `aria-live` result count reports how many profiles are shown;
- no matches use `Empty` with `No profiles found` and
  `Try a different name or description.`

Clearing the query restores the complete list and every ordering control. This
avoids changing the position of profiles hidden by a filter.

## Action Matrix

| Action              | Built-in | Custom | Result                                                      |
| ------------------- | :------: | :----: | ----------------------------------------------------------- |
| View profile        |    ✓     |   —    | Opens the profile editor read-only.                         |
| Edit profile        |    —     |   ✓    | Opens an editable profile dialog.                           |
| Duplicate           |    ✓     |   ✓    | Opens a prefilled Custom draft; Save appends the new copy.  |
| Set as default      |    ✓     |   ✓    | Changes the draft Default marker; does not reorder.         |
| Move up / Move down |    ✓     |   ✓    | Changes the shared draft chooser order.                     |
| Delete              |    —     |   ✓    | Requires confirmation; removes only the local draft record. |
| Import              |    —     |   ✓    | Appends imported Custom profiles after existing profiles.   |
| Export              |    —     |   ✓    | Exports Custom profiles only; excludes local ordering.      |

Replacing a custom profile during import preserves its current position. The
production import conflict dialog is a workflow concern defined by the
specification; it should reuse `AlertDialog` or `Dialog` and must not insert a
second settings footer.

## Profile Editor Dialog

Use the repository `Dialog` with:

- `Name`, required, one line, maximum 64 characters.
- `Description`, optional, one line, maximum 240 characters; this is the
  chooser subtitle.
- `Transformation instructions`, required, multiline; explain that these
  instructions are sent to the configured provider together with selected text.

In every editable editor mode (create, edit, and duplicate), keep the helper
below `Transformation instructions` expanded and visible. Do not replace it
with a tooltip, transient toast, or collapsed disclosure. Use this exact copy
after the provider disclosure:

> **Fixed scope:** Custom instructions only steer wording, organization,
> verbosity, and tone. They cannot choose the provider, model, tools,
> processing flow, or output destination, or override fixed product rules.

`Fixed product rules` is the user-facing label for the product-owned
invariants defined by SAFE-001 through SAFE-004.

The read-only Built-in editor keeps the provider disclosure but omits the
Custom-only scope sentence. The helper remains associated with the textarea
through the repository `Field` description contract.

For Custom profiles the footer is `Cancel` plus `Create profile` or
`Save profile`. For Built-in profiles all fields are disabled and the footer is
`Close` plus `Duplicate to customize`. Built-in content never becomes editable
in place.

Deletion uses `AlertDialog`, names the profile, and explains that other profiles
and the current default are unaffected. Production validation must prevent a
state with no valid default.

## Existing Component Mapping

| Element                | Repository primitive                                      |
| ---------------------- | --------------------------------------------------------- |
| Primary/add action     | `Button` + Lucide `Plus`                                  |
| Profile search         | `Input` + Lucide `Search`                                 |
| Import/export          | outline `Button` + `FileUp` / `Download`                  |
| Profile identity       | outline `Badge`                                           |
| Default marker         | success `Badge`                                           |
| Ordered viewport       | `ScrollArea`, `ScrollAreaViewport`, `ScrollAreaScrollbar` |
| Profile actions        | `DropdownMenu` family + `MoreHorizontal`                  |
| Reorder help           | `Tooltip` family + `GripVertical`                         |
| Profile fields         | `Field`, `Input`, `Textarea`                              |
| Create/edit/inspect    | `Dialog` family                                           |
| Delete confirmation    | `AlertDialog` family                                      |
| Empty profile state    | `Empty` family                                            |
| Settings boundary/save | `Separator`, existing `SettingsFooter`                    |

Use only the color, radius, timing, and typography tokens in
`src/renderer/styles/globals.css`. Do not add a dependency for drag-and-drop,
new colors, gradients, custom SVG, raster UI assets, or a card abstraction.

## Responsive Behavior

The preferred Settings content width is approximately 504 px after the existing
208 px navigation and 16 px gap.

- At the 760 × 720 preferred window, the list viewport is 244 px tall and the
  persistent Settings footer remains visible.
- At widths below 640 px, the existing navigation collapses to icons. The
  section gains the recovered horizontal space automatically.
- Heading actions wrap instead of clipping.
- Search shares one toolbar row with Import/Export at the preferred width and
  stacks above those actions at the 440 px minimum.
- Profile metadata wraps to two description lines; required meaning is not
  truncated horizontally.
- At the 440 × 520 minimum window, the content column scrolls while the global
  Settings footer remains outside that scroll region.

## Accessibility And Focus

- Use `role="list"` / `role="listitem"` for ordered management rows; this is
  not a listbox because rows are not selectable.
- Give every grip and overflow action a profile-specific accessible name.
- Preserve visible focus through existing component focus rings.
- Announce reorder, create, edit, default, import, export, and delete outcomes
  through a polite live region.
- Announce filtered result count and the requirement to clear search before
  reordering.
- Restore focus to the row action after closing a dialog in production.
- Disable invalid moves and the Set Default action for the current default.
- Provide keyboard reordering through both explicit menu commands and
  `Alt + Arrow Up/Down` on the drag handle.

## Implementation Boundary

The TSX blueprint is intentionally stored with the specification and does not
modify production behavior. Its controlled callback contract separates visual
interaction from persistence, filesystem import/export, IPC, provider work,
and Settings lifecycle.

Production implementation should:

- move the section into `src/renderer/components/settings`;
- localize every visible string and profile field;
- add profile draft/snapshot state to `AppSettingsWindow`;
- route import/export only through typed `window.electronAPI`;
- keep filesystem and persistence work in the main process;
- keep profile content and order out of logs;
- preserve the existing trusted IPC sender validation;
- reuse the existing Settings Save/close-discard behavior.
