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

previous result: passed

# Unauthorized Web Provider Connect Action — Final Design QA

## Evidence

- Source visual truth: `/tmp/gpt-voice-status-column-aligned-final.png`
  (the previously verified 520 × 420 unauthenticated ChatGPT Web state with
  the visible `Connect` label, matching the user's current-state reference).
- Implementation: `/tmp/gpt-voice-connect-icon-final.png`.
- Full comparison: `/tmp/gpt-voice-connect-before-after.png` (source on the
  left, implementation on the right).
- Focused comparison: `/tmp/gpt-voice-connect-focused-comparison.png` (source
  on the left, implementation on the right).
- Viewport and density: both captures are 520 × 420 physical pixels at a
  520 × 420 CSS content size with device scale factor 1; no density
  normalization was required.
- State: dark theme, ChatGPT Web selected, unauthenticated, idle. The same
  renderer contract is selected for unauthenticated Claude Web because both
  providers use the `browserSession` authentication type.

## Full-View Comparison

The implementation removes the visible `Connect` copy and keeps the existing
`LogIn` icon in a fixed 37 × 34 control. The Voice, Prettify, Translation,
recording, and footer rows remain in their original order and retain the same
grid tracks, heights, labels, and surrounding alignment. The API-key
`Configure` action remains text-bearing and outside this visual change.

## Focused Region Comparison

The focused comparison makes the requested control treatment directly
readable. The new Connect action and its adjacent Settings action have equal
37 × 34 bounds, a 1 px `--dock-control-border`, a 3.5 px radius,
`--dock-surface` background, and 22 × 22 Lucide icons. Their top and bottom
edges align exactly. No text footprint remains in the browser-session Connect
action.

## Required Fidelity Surfaces

- Fonts and typography: no new typography was introduced; the visible Connect
  label was intentionally removed. Existing labels keep their font family,
  weight, size, line height, truncation, and antialiasing.
- Spacing and layout rhythm: the icon-only action matches the Settings
  control's dimensions, padding, radius, and vertical position without changing
  provider-row grid tracks or neighboring spacing.
- Colors and visual tokens: the action reuses the Settings border, surface,
  icon, hover-surface, and hover-foreground tokens.
- Image quality and asset fidelity: the existing vector `LogIn` icon from the
  repository's Lucide dependency remains sharp at 22 × 22; no custom SVG,
  raster asset, CSS drawing, placeholder, or new dependency was introduced.
- Copy and content: browser-session providers expose no visible Connect copy.
  The localized action copy remains available through `aria-label`, and the
  existing provider-state tooltip remains unchanged.
- Accessibility and interaction: the action remains a real button with the
  same login callback, disabled/loading behavior, tooltip, keyboard focus, and
  localized accessible name. Source-contract tests verify the action wiring
  without launching an external login session.

## Findings

No actionable P0, P1, or P2 visual, responsive, interaction, or accessibility
findings remain.

## Open Questions

None.

## Implementation Checklist

- Keep browser-session Connect actions icon-only.
- Preserve the text-bearing API-key Configure action.
- Reuse the Settings control tokens and 37 × 34 geometry.
- Retain the localized accessible name, tooltip, loading state, and login
  callback.

## Comparison History

- Pass 1: the 520 × 420 source capture showed the current text-bearing Connect
  action beside the Settings control.
- Fix 1: removed visible Connect copy only for `browserSession` providers and
  matched the Settings control's dimensions, border, background, radius,
  icon size, and hover treatment.
- Pass 2: the full-view and focused comparisons confirm exact control geometry,
  no remaining visible label, and no main-grid movement. No P0–P2 findings
  remain.

final result: passed

# Connection Status Indicator Design QA

## Comparison Target

- Source visual truth:
  `/tmp/gpt-voice-status-settings-aligned-final.png`, together with the user's
  supplied narrow-window screenshot showing the unintended staggered status
  positions.
- Implementation screenshot:
  `/tmp/gpt-voice-status-column-aligned-final.png`.
- Narrow implementation screenshot:
  `/tmp/gpt-voice-status-column-aligned-narrow-final.png`.
- Full-view comparison evidence:
  `/tmp/gpt-voice-status-column-aligned-comparison-final.png`.
- Focused badge comparison evidence:
  `/tmp/gpt-voice-status-column-aligned-focused-final.png`.
- Source pixels: 520 × 420.
- Implementation pixels and CSS viewport: 520 × 420 at device scale
  factor 1.
- Narrow implementation pixels and CSS viewport: 330 × 500 at device scale
  factor 1.
- Comparison pixels: 1060 × 420 for the normalized full view and
  700 × 224 for the focused status-and-settings-control view.
- State: dark theme, Prettify unavailable because no model is selected,
  Translation connected, and the existing main-screen row and column order
  unchanged.

The source and implementation use the same production window, state, and
density. The comparison checks that every connection status remains in one
shared start-aligned column whose center matches the first header-button icon
column, while preserving the approved 22 px borderless icons, semantic states,
and absence of visible status copy inside the unchanged production grid.

## Rendered Evidence

- The production Electron renderer was captured under Xvfb with an isolated
  temporary configuration directory.
- The final connected and unavailable connection slots use the same 37 × 34
  geometry as the header buttons, contain 22 × 22 icons, and have no visible
  border or background.
- Pixel analysis of the 330 × 500 capture places the Help, unavailable, and
  connected glyph centers at exactly x=211.5. This confirms the requested
  horizontal alignment in the narrow layout shown by the user.
- The renderer contract tests cover localized tooltip and accessible-name
  content, keyboard focusability, status semantics, the loading spinner, and
  the absence of visible Connected or Not Connected text.
- The targeted renderer test, source typecheck, test typecheck, formatting
  check, and production renderer build passed before this final visual pass.

## Full-View Comparison

The implementation retains the existing prebuilt Badge as the accessible
status wrapper while rendering only its icon. Removing the square border and
fill does not change the main screen's grid tracks, row order, column order,
provider controls, or action placement. Prettify and Translation connection
statuses are both start-aligned in equal 37 px slots. This keeps them in one
shared column and centers them beneath the first header-button icon column at
both 520 px and 330 px widths. Both states remain recognizable through distinct
icons, semantic color, and tooltip and accessible-name text.

## Focused Region Comparison

The focused comparison places the incorrect staggered result beside the
corrected production result. Before the fix, the unavailable and connected icon
centers were x=445.5 and x=491.5. The corrected layout keeps both slots
start-aligned and gives them the same 37 px width as the button column. The
dedicated narrow capture confirms that all three relevant glyph centers land on
the exact same x coordinate.

## Required Fidelity Surfaces

- Fonts and typography: the indicator has no visible text, as requested.
  Surrounding Ubuntu Sans labels and values keep their existing sizes, weights,
  line heights, wrapping, and grid positions.
- Spacing and layout rhythm: homepage connection statuses use a fixed 37 × 34
  slot around a 22 px icon, matching the header-button geometry. Keeping every
  slot start-aligned places Prettify and Translation on the same horizontal
  center at desktop and narrow responsive widths while preserving row heights,
  grid tracks, gaps, and Settings-button placement.
- Colors and visual tokens: connected, checking, warning, unavailable, and
  error states use the existing muted, success, warning, and destructive
  foreground tokens on a transparent background with no border. No new
  palette, gradient, or shadow was introduced.
- Image quality and asset fidelity: CircleCheck, CircleOff, and LoaderCircle
  come from the repository's existing `lucide-react` dependency and render as
  sharp vector icons at 22 × 22 px. No raster asset, custom SVG, CSS drawing,
  emoji, or placeholder was added to the product UI.
- Copy and content: visible localized status text is deliberately absent.
  Existing localized state copy remains available through `aria-label` and the
  native tooltip.
- Accessibility: the focusable status Badge keeps status semantics and a
  localized accessible name; its icon is decorative, and loading exposes the
  same content-free accessible contract without layout movement.

## Findings

No actionable P0, P1, or P2 visual, responsive, interaction, or accessibility
findings remain.

## Open Questions

None.

## Implementation Checklist

- Keep both provider indicators on the shared `ProviderStatusIndicator`.
- Preserve the 37 × 34 start-aligned connection slot and 22 × 22 icon
  footprint for every state and locale.
- Retain localized tooltip and accessible-name coverage when adding statuses.
- Keep all main-screen grid rows and columns in their current order.

## Comparison History

- Pass 1: the first production capture showed the Translation badge stretched
  to 125 × 24 because the existing translation status slot applied
  `width: 100%`. This was a P2 layout drift because the status footprint was
  neither fixed nor localization-independent.
- Fix 1: constrained the shared Badge to 24 px on every width axis and changed
  the Translation status slot to `justify-self: start` with a 24 px width.
- Pass 2: the final 520 × 420 Electron capture and focused badge crop confirmed
  exact 24 × 24 bounds, stable row and column placement, legible semantic
  icons, and no visible status text. No P0-P2 findings remain.
- Pass 3: user review found that the square Badge border and fill added
  unnecessary visual weight and that the 13 px status glyphs were too quiet.
- Fix 3: removed the visible border and background from every status tone and
  increased CircleCheck, CircleOff, and LoaderCircle to 18 × 18 while retaining
  the 24 × 24 layout slot and keyboard focus target.
- Pass 4: the revised 520 × 420 Electron capture and focused comparison confirm
  that connected and unavailable states now show only the larger icons. The
  provider grid, row density, labels, settings actions, and responsive footprint
  remain unchanged. No P0-P2 findings remain.
- Pass 5: user review found that the 18 px connection glyphs and their
  left-aligned 24 px slots still did not match the homepage Settings controls.
- Fix 5: increased connection glyphs to 22 × 22, but incorrectly changed their
  slots to 37 × 34 and end-aligned them. Because Prettify uses a nested control
  grid and Translation uses the outer row grid, this placed each status at a
  different x coordinate.
- Pass 6: the initial desktop review did not catch that responsive failure. The
  user's narrow-window capture exposed the staggered positions as a P2 layout
  regression.
- Fix 6: restored the original 24 × 24 slots and start alignment for both
  Prettify and Translation, retaining only the requested 22 × 22 icon size.
- Pass 7: the final 520 × 420 capture, focused comparison, CSS responsive
  contract, and pixel-bound analysis confirm both statuses have returned to the
  same horizontal position without changing the grid or Settings controls. No
  P0-P2 findings remain.
- Pass 8: user clarification established that merely returning to the previous
  status position was insufficient: the shared status column also had to align
  with the header-button icon column.
- Fix 8: retained `justify-self: start` for every connection row, expanded each
  invisible status slot to the button geometry of 37 × 34, and kept the glyphs
  centered at 22 × 22. Unlike the failed end-aligned version, this applies the
  same offset from the same column start in every grid.
- Pass 9: captures at 520 × 420 and 330 × 500 confirm the connection icons
  remain vertically aligned with each other. Pixel analysis of the narrow
  capture places Help, unavailable, and connected glyph centers at x=211.5
  exactly. No P0-P2 findings remain.

final result: passed
