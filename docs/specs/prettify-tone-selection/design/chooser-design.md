# Prettify Profile Chooser — Implementation Design

Status: design blueprint for the approved
[`Prettify Transformation Profiles` specification](../spec.md)

Code reference:
[`PrettifyProfileChooser.blueprint.tsx`](./PrettifyProfileChooser.blueprint.tsx)

Rendered reference:
[`prettify-profile-chooser-preview.png`](./prettify-profile-chooser-preview.png)

## Design Intent

The chooser should make one decision feel immediate and safe: verify the captured
text, choose how it should be transformed, then explicitly apply that choice.
Prompt creation is the primary use case; general dictated-text cleanup is the
secondary use case.

The user-supplied Telegram AI Editor screenshot is the composition reference:
a compact dark surface, a clear title, a bounded original-text card, an obvious
transformation choice, and one primary bottom action. This design adapts that
hierarchy rather than cloning Telegram:

- Telegram mode/style navigation becomes one searchable profile catalog.
- GPT-Voice uses its own dark tokens, typography, controls, radii, and focus
  treatment.
- `Prompt-ready`, `Polish`, `Professional`, and `Natural` replace Telegram's
  entertainment-oriented style catalog.
- Selection never starts generation. `Apply` or Enter is always required.
- There is no generated-result preview, automatic paste, or main-window profile
  control.

## Window Contract

Use a separate trusted renderer window, not `Dialog` over the 520 × 420 main
window.

| Property                      | Design value                                            |
| ----------------------------- | ------------------------------------------------------- |
| Preferred content size        | 620 × 640 px                                            |
| Small-work-area layout target | 440 × 520 px                                            |
| Work-area inset               | 16 px preferred; 8 px when space is constrained         |
| Frame                         | Native platform frame and title bar                     |
| Native title                  | `Choose a Prettify profile`                             |
| Resizing                      | Fixed at the size calculated for the active work area   |
| Background                    | `var(--background)` / `#181a1b`                         |
| Initial focus                 | Configured default profile option                       |
| Close paths                   | Escape, native close, Cancel, Manage profiles, or Apply |

Calculate the content size against the OS-active display containing the cursor
before showing the window. Use active-display geometry first; only when it is
ambiguous use nearest-display identity, then the active primary display, then
the first active display. Use nearest/primary best effort only when active
display enumeration is unavailable. Use the preferred size when it fits.
Otherwise reduce width and height to preserve the inset. The renderer is
responsive down to the target size; if the operating-system work area is
smaller, use the available area and keep the profile list as the flexible scroll
region. Center the chooser within the resolved work area, apply its final bounds
before `show()`, and show it only after its operation-scoped payload is ready.

A physical display input switch is outside Electron's visibility. When the OS
removes that display from the desktop, it is unavailable to the chooser; when it
remains extended, the cursor's active display remains eligible.

Do not add a custom title bar or a second close icon. Existing secondary windows
use native chrome, and duplicate window controls add noise to this short task.

## Structure

```text
PrettifyProfileChooserWindow
├── Header
│   ├── Sparkles icon tile
│   ├── “Choose a Prettify profile”
│   └── One-line purpose
├── Original text
│   ├── Label + “Read-only”
│   └── Bounded plain-text ScrollArea
├── Profiles
│   ├── Label + current selection summary
│   ├── Search Input
│   └── ScrollArea / listbox
│       ├── One persisted mixed-order profile list
│       └── No-results Empty state
└── Footer
    ├── Manage profiles
    ├── Cancel
    └── Apply + Enter hint
```

The layout is a full-height four-row grid:

1. Header: intrinsic, approximately 76 px.
2. Original-text section: intrinsic, with a 112 px preview.
3. Profile section: `minmax(0, 1fr)` and owns vertical overflow.
4. Footer: intrinsic, approximately 65 px at the preferred width.

Use 20 px window-side padding, 16 px section separation, 8 px control gaps, the
existing 6 px control radius, and the existing 8 px surface radius. The footer
stays on one row at the 440 px target and hides the decorative Enter keycap
below 480 px. Only widths below 380 px stack actions below `Manage profiles`;
actions must never be clipped.

## Existing Component Mapping

| Element             | Repository primitive                                      | Notes                                                           |
| ------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Search              | `Input` + Lucide `Search`                                 | Uses the existing 40 px input and focus ring.                   |
| Source preview      | `ScrollArea`, `ScrollAreaViewport`, `ScrollAreaScrollbar` | `tabIndex={0}`, selectable plain text, no editor behavior.      |
| Profile identity    | `Badge`                                                   | `outline` for Built-in/Custom; identity never changes ordering. |
| Default marker      | `Badge`                                                   | `success` for Default.                                          |
| Empty search result | `Empty` family                                            | Search icon from `lucide-react`; no custom SVG or raster asset. |
| Footer actions      | `Button`                                                  | `ghost`, `outline`, and default primary variants.               |
| Enter hint          | `Kbd`                                                     | Restyled only for contrast inside the primary button.           |
| Footer boundary     | `Separator`                                               | Uses `border` token through the primitive.                      |
| Icons               | `Sparkles`, `Search`, `Settings2`                         | All come from the project's existing `lucide-react` dependency. |

Do not use `SearchableSelectInput` directly. Its editable combobox is the local
interaction precedent, but its option contract only supports a label and value.
The chooser must also render descriptions, deterministic groups, profile
identity, the default marker, multi-line metadata, and up to 200 custom
profiles. The blueprint retains the same normalized multi-term search,
Arrow-key navigation, active option, and visible selection behavior while
composing the richer option row from existing primitives.

Do not wrap the renderer in the repository `Dialog`: the BrowserWindow itself is
the transient chooser and must not render a redundant overlay.

## Visual States

### Resting

- `Prompt-ready` is the default marker on a new installation.
- Every opening selects and keyboard-focuses the configured default profile.
- Apply is enabled on open and becomes disabled only when filtering removes the
  selected profile.
- Profile rows use `bg-surface`; the source preview and search input use
  `bg-surface-muted`.

### Hover and focus

- Hover uses `surface-muted` plus the normal border.
- Keyboard focus uses the project's primary 2 px ring.
- Focus must remain visible independently of selection.

### Selected

- Use `border-primary` and `var(--primary-subtle)`.
- Convey selection through the high-contrast surface, primary border, and
  `aria-selected`; do not add a separate check indicator.
- Keep both identity and Default badges visible.
- The row is selected only; it does not submit or alter the persistent default.

### No search result

- Keep the search input and footer visible.
- Show `Empty` with `No profiles found` and
  `Try a different name or description.`
- Apply is disabled because filtering out the current selection clears the
  one-off selection and prevents an invisible profile from being submitted.

### Long content

- Original text preserves whitespace, wraps long words, permits text selection,
  and scrolls inside its 112 px region.
- Profile names and descriptions wrap instead of truncating required meaning.
- The list preserves the exact mixed built-in/custom order configured in
  Settings; filtering never regroups it.
- The profile list, not the entire footer, absorbs catalog growth.

### Submission and failure

- Apply closes the chooser immediately and delegates working, success, and
  failure feedback to the existing main-window/tray mechanisms.
- Do not add a spinner, transformed-text view, retry action, provider status,
  or error panel inside this chooser.
- If the catalog or operation payload cannot be prepared, do not show a
  half-loaded chooser; use the existing localized failure channel.

## Keyboard And Focus

| Input                         | Result                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Open                          | Select and focus the configured default row, exposing it through `aria-selected`.                         |
| Arrow Down in search          | Move to and select the first visible profile.                                                             |
| Arrow Up/Down in list         | Move the one-off selection and focus together.                                                            |
| Home/End in list              | Select the first/last visible profile.                                                                    |
| Single click                  | Select only. Never run generation.                                                                        |
| Enter with a selected profile | Apply the selection.                                                                                      |
| Enter with no selection       | No-op; Apply remains disabled.                                                                            |
| Tab / Shift+Tab               | Traverse source preview, search, listbox, Manage profiles, Cancel, and Apply without leaving the chooser. |
| Escape                        | Cancel and close without provider work.                                                                   |

The native window owns focus containment. On close, main restores focus according
to the existing selected-text workflow. Reopening while the chooser exists
focuses the same window and does not replace its source.

The list uses `role="listbox"` and grouped `role="option"` rows with
`aria-selected`. Visual badges are real text so assistive technology announces
Default and Built-in/Custom identity. Search result count uses a polite live
region. Source preview is a labeled, keyboard-focusable region.

## Color And Motion

Use only tokens already defined in `src/renderer/styles/globals.css`:

- surfaces: `background`, `surface`, `surface-muted`, `surface-raised`;
- content: `foreground`, `muted-foreground`;
- boundaries: `border`;
- action/selection: `primary`, `primary-hover`, `primary-subtle`;
- marker: `success`;
- focus and timing: `focus-ring`, `duration-fast`.

Do not add gradients, glass effects, new brand colors, custom shadows, emoji, or
hand-authored SVG. The global `prefers-reduced-motion` rule already reduces the
short color transitions used by rows and buttons.

## Copy And Localization

The blueprint uses English reference copy. Production code must route every
visible string and profile metadata through the existing i18n system. Required
concepts:

- Choose a Prettify profile
- Choose how GPT-Voice should transform the selected text.
- Original text
- Read-only
- Profiles
- Selected: {profile}
- Search profiles
- {count} profiles available
- Default
- Built-in
- Custom
- No profiles found
- Try a different name or description.
- Manage profiles
- Cancel
- Apply

Validate the longest supported localized strings at the 440 × 520 target.

## Implementation Boundary

The TSX file is a design reference, not a production renderer entry. It
intentionally contains:

- strict, portable props for source text, ordered profile metadata, and the
  three user outcomes;
- representative built-in and custom data;
- full ready, selected, unselected, filtered, and empty interaction states;
- no Electron, preload, IPC, provider, persistence, clipboard, or filesystem
  calls.

Production implementation should move the visual component into
`src/renderer`, replace reference strings with localized keys, and wire it only
through the typed `window.electronAPI` chooser contract defined during planning.
The main process remains responsible for source lifetime, window lifecycle,
provider execution, clipboard delivery, and opening Settings.
