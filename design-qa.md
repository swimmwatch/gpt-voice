# Prettify Profiles Settings Design QA

## Comparison Target

- Source visual truth:
  `docs/specs/prettify-tone-selection/design/prettify-profile-chooser-preview.png`
  for the approved Prettify visual language, plus the existing
  `src/renderer/AppSettingsWindow.tsx`,
  `src/renderer/components/settings/SettingsNavigation.tsx`, and
  `src/renderer/components/settings/SettingsFooter.tsx` for Settings structure.
- User-directed search revision comparison:
  `docs/specs/prettify-tone-selection/design/prettify-profiles-settings-search-comparison.png`,
  containing the 760 × 720 pre-search and revised screenshots in one canvas.
- SAFE-004 editor disclosure reference:
  `docs/specs/prettify-tone-selection/design/prettify-profile-editor-boundaries-preview.png`,
  showing the editable Create profile state with its fixed instruction scope
  visible below the transformation textarea.
- Implementation:
  `docs/specs/prettify-tone-selection/design/PrettifyProfilesSettings.blueprint.tsx`.
- Implementation screenshots:
  `docs/specs/prettify-tone-selection/design/prettify-profiles-settings-preview.png`
  and
  `docs/specs/prettify-tone-selection/design/prettify-profile-editor-boundaries-preview.png`.
- Source pixels: 620 × 640 for the chooser and 1420 × 800 for the combined
  search comparison; both Settings frames inside the comparison and the editor
  disclosure reference are 760 × 720.
- Implementation pixels and CSS viewport: 760 × 720 at device scale factor 1.
- Additional responsive viewport: 440 × 520 CSS px at device scale factor 1.
- State: dark theme, Prettify active, mixed built-in/custom order, Prompt-ready
  marked Default, empty search, no dialog or action menu open.
- Additional SAFE-004 state: Create profile dialog open with empty fields, Name
  auto-focused, and the fixed-scope helper persistently visible.

The source and implementation intentionally represent different surfaces:
selection-only chooser versus App Settings management. The comparison therefore
checks continuity of design language, profile identity, mixed ordering, and
component treatment rather than pixel-identical composition.

## Browser Evidence

- The existing chooser and Settings screenshots were previously opened
  together in one comparison canvas at their native dimensions. The new editor
  disclosure screenshot was inspected at its native 760 × 720 dimensions
  against the same component and token hierarchy.
- The implementation was rendered at the repository's preferred Settings size,
  760 × 720, and at its 440 × 520 minimum size.
- Primary interactions tested:
  - action-menu Move Down changed the draft order and enabled Save;
  - pointer drag changed the draft order;
  - `Alt + Arrow Down` on the grip changed the draft order;
  - New profile opened the editor, required Name and Transformation
    instructions, accepted realistic input, and appended a seventh profile;
  - search matched a profile name and a description-only multi-term query;
  - no-match search rendered the expected Empty state;
  - a non-empty search disabled the drag handle and replaced Move commands with
    `Clear search to reorder`, while other profile actions remained available;
  - create, edit, and duplicate editors kept their provider disclosure and
    fixed Custom instruction boundaries visible below
    `Transformation instructions`;
  - the read-only Built-in editor kept the provider disclosure and omitted the
    Custom-only boundary sentence;
  - the fixed-scope helper explicitly limited instructions to wording,
    organization, verbosity, and tone, and excluded provider, model, tools,
    processing flow, output destination, and fixed product rules;
  - the textarea referenced the complete helper through
    `aria-describedby="prettify-profile-instructions-description"`;
  - the persistent Settings footer remained visible at both viewports.
- Current-page console after the final reload: zero errors and zero warnings.
  An initial missing-favicon request in the temporary preview was fixed before
  the final capture.

## Full-View Comparison

The settings blueprint keeps the chooser's compact dark hierarchy, foreground
weights, muted explanatory copy, semantic badges, primary action treatment,
border contrast, radii, and row density. It also preserves the exact mixed
profile order visible in the chooser while adding management-only grip and
overflow affordances. Search occupies the former count slot beside Import and
Export, so the existing Settings navigation and footer proportions remain
unchanged.

No persistent action is clipped at 760 × 720 or 440 × 520. At the minimum size,
the existing navigation collapses to icons and the content column scrolls while
Save remains outside the scroll region.

The Create profile dialog remains centered and fully visible at 760 × 720. The
new boundary copy uses the existing `Field` helper hierarchy, so it adds no
card, tooltip, custom disclosure control, or competing action.

## Focused Region Comparison

The search toolbar and profile rows were legible at native scale in the
combined full-view canvas, so a separate crop was not needed. Search uses the
same input height, icon placement, placeholder, and token treatment as the
chooser. Row typography, 1 px borders, badge colors, description contrast, and
ordering remain unchanged. The settings rows correctly omit chooser selection
treatment and the removed check indicator.

The dedicated editor screenshot confirms that the helper is readable at native
scale, associated visually with the textarea, and visible without hover,
focus, or expansion. `Fixed scope:` provides enough emphasis without adding a
new visual primitive.

## Required Fidelity Surfaces

- Fonts and typography: both surfaces use the repository Ubuntu Sans stack and
  existing `text-xs`, `text-sm`, `text-base`, and `text-lg` hierarchy. Labels,
  wrapped descriptions, and action copy remain readable without unintended
  truncation.
- Spacing and layout rhythm: existing 16 px Settings padding, 208 px navigation,
  16 px column gap, 8 px surface radius, compact 72 px rows, and persistent
  footer are preserved. The 244 px list viewport offsets the new toolbar and
  exposes several mixed-order rows without pushing Save off-screen.
- Colors and visual tokens: all surfaces use existing background, surface,
  muted, foreground, border, primary, success, and destructive tokens. No new
  palette, gradient, or shadow treatment was introduced.
- Image quality and asset fidelity: no raster UI asset, custom SVG, CSS drawing,
  emoji, or placeholder is used. Icons come from the existing `lucide-react`
  dependency and remain sharp at device scale factor 1.
- Copy and content: management copy prioritizes AI-prompt transformation,
  explains local profile/order storage, distinguishes Built-in and Custom
  capabilities, and keeps search, import/export, reorder filtering, and
  provider behavior explicit. Editable profile dialogs disclose that Custom
  instructions only steer wording, organization, verbosity, and tone and
  cannot choose the provider, model, tools, processing flow, output
  destination, or override fixed product rules.

## Findings

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility
findings remain.

## Open Questions

None for the design contract. Production localization and platform file-dialog
behavior remain implementation-stage verification.

## Implementation Checklist

- Move the blueprint section into the renderer and replace reference copy with
  localized keys.
- Wire profile draft/snapshot state into the existing Settings Save/discard
  lifecycle.
- Keep import/export, persistence, and filesystem access behind typed
  `window.electronAPI` contracts.
- Re-run renderer accessibility and localization checks after production
  wiring.
- Cover normalized name/description search, no results, result announcements,
  and disabled reorder controls in renderer tests.
- Keep the fixed-scope helper visible in create, edit, and duplicate modes;
  verify its textarea description association and exact localized meaning.

## Comparison History

- Pass 1: the heading action wrapped below the description at 760 px and the
  initial 344 px list viewport extended beyond the visible Settings content
  region.
- Fix 1: the heading copy became a flexible column and the list viewport was
  reduced to 260 px. The revised 760 × 720 capture keeps New profile aligned
  top-right and preserves the Settings footer.
- Pass 2: the previous chooser visual still grouped profiles by kind, which
  conflicted with the approved mixed persisted order.
- Fix 2: the chooser blueprint and screenshot now render the same single mixed
  order as Settings, without group headings or a selection check indicator.
- Pass 3: combined full-view and focused profile-row review found no remaining
  P0-P2 differences. Pointer, menu, keyboard, dialog, responsive, and console
  checks passed.
- Pass 4: user review identified that Settings lacked the search available in
  the chooser.
- Fix 4: added the matching normalized name-and-description search beside
  Import/Export, a no-results Empty state, live result count, and explicit
  reorder disabling while filtered. Reduced the list viewport from 260 px to
  244 px so the Provider heading and persistent footer remain cleanly visible.
- Pass 5: pre-search and revised 760 × 720 screenshots were compared in one
  canvas. Search, description matching, no results, filtered action state,
  440 × 520 stacking, and console checks passed with no remaining P0-P2 issues.
- Pass 6: SAFE-004 review found that the editor only disclosed provider
  transmission and did not expose the fixed limits of Custom instructions.
- Fix 6: added a persistent `Field` helper in create, edit, and duplicate modes
  that names the allowed presentation changes and the excluded provider,
  model, tools, processing-flow, destination, and product-invariant controls.
  Captured the 760 × 720 Create profile state; the 512 × 578 dialog remained
  fully visible and the browser console reported zero errors or warnings.

final result: passed
