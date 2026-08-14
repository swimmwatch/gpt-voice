# 06 Chooser Renderer — Exact Approved Design

## Outcome

Implement the production chooser renderer and packaged entry as an exact
reproduction of the approved code-native design, wired only to the packet 05
typed chooser API. This packet is production wiring, not a design exercise.

## Prerequisites

- Packets 01 and 05 are complete and approved; packets 02..04 are integrated.
- Read `AGENTS.md`, `todo.md`, `handoff.md`, the **Project And Commands**,
  **Electron And Providers**, **Desktop, Browser, And Packaging**, and **Tests
  And Documentation** convention sections.
- Read every mandatory design reference in the **References** section below
  before editing. Inspect current renderer entry/bootstrap, UI primitives,
  globals tokens, i18n, webpack, packaged runtime policy, and direct tests.
- Do not make any design choice not explicitly stated here or in the mandatory
  design bundle.

## Owned Requirements

- EVID-001, EVID-002 as interaction evidence only
- UI-002, UI-003, UI-004, UI-005, UI-006, UI-007, UI-008, UI-009, UI-010
- QUAL-001
- QUAL-002 / AC-AUTO-008
- QUAL-002 / AC-AUTO-009 (chooser assertions)
- OPS-002 (chooser renderer assets)
- AC-MAN-001, AC-MAN-004, AC-MAN-005 (chooser portions)

## In Scope

- Exact chooser React component/window entry and typed minimal API wiring.
- Search, selection, keyboard/focus, empty/long-content, responsive, accessible,
  localized, and close/apply/manage states.
- Webpack HTML/entry and packaged-runtime asset policy.
- Focused renderer/state/config/packaging tests and visual comparison gates.

## Out Of Scope

- Any redesign, visual improvement, alternate component, new dependency,
  custom asset, custom title bar, profile management, drag/reorder UI, provider
  status, result preview, retry, diff, automatic paste, or main-window control.
- Main window/controller/IPC/preload changes except a narrowly required type
  correction found while wiring packet 05.
- Copying blueprint mock data/callbacks into production.

## Task Contract

### Non-Negotiable Design Reproduction

Implement this surface exactly from the linked three-part design contract: the
Markdown contract is normative for behavior, responsive rules, and
accessibility; the TSX blueprint is normative for component hierarchy,
repository primitives, tokens, dimensions/spacing, interaction states, and
copy hierarchy; the PNG is the approved visual reference at its stated
viewport. This is production wiring, not a design exercise. Reproduce the
layout, spacing, typography, colors/tokens, radii, icons, component variants,
borders, row density, badges, state hierarchy, copy hierarchy, focus/keyboard
behavior, roles, accessible names, live regions, scrolling/wrapping, and
responsive behavior exactly. Do not redesign, reinterpret, simplify,
substitute primitives, add/remove controls or indicators, or make unsolicited
UX improvements. Use the existing repository components and styles named in
the blueprint. Replace reference strings only with equivalent localized keys
and replace preview callbacks/data only with production state and typed
`window.electronAPI` wiring; neither change may alter the approved presentation
or behavior. Do not copy preview-only mock data into production. If any linked
artifact conflicts with repository constraints or a required
deviation/ambiguity is found, **STOP this packet** and return it to
planning/specification with evidence; do not improvise. No deviation is allowed
without an explicitly approved design/spec revision.

### Exact Surface Contract

1. Build a separate chooser renderer, not a `Dialog`. Recommended production
   files are `src/renderer/PrettifyProfileChooserWindow.tsx`, a focused
   component below `src/renderer/components/prettify/`, and
   `src/renderer/entries/prettifyProfileChooser.tsx`. Bootstrap it through a
   chooser-specific or properly genericized narrow provider path that accepts
   only packet 05's `PrettifyProfileChooserAPI`; do not cast that API to the
   full normal `ElectronAPI`, import the full API type into this entry, or make
   the dedicated preload expose placeholder general methods merely to satisfy
   the existing `bootstrapWindow` signature.
2. Reproduce the four-row full-height grid and blueprint values:
   - 20 px side padding;
   - 16 px section rhythm;
   - 8 px control gaps;
   - existing 6 px control and 8 px surface radii;
   - 112 px scrollable read-only original preview;
   - profile section `minmax(0, 1fr)` as the flexible scroll owner;
   - footer visible at all supported sizes.
3. Use only the named existing primitives: `Input`, `ScrollArea` family,
   `Badge`, `Empty` family, `Button`, `Kbd`, `Separator`, project `cn`, and
   Lucide `Sparkles`, `Search`, `Settings2`. Use only existing global tokens.
   Add no new color, gradient, glass, shadow, SVG, raster UI asset, card
   abstraction, or dependency.
4. Initial focus is the configured default profile option. Render exactly one
   listbox in persisted mixed order; built-in/custom profiles may interleave and
   filtering never sorts/regroups.
   Rows expose name, optional description, identity badge, and Default badge.
5. Search uses packet 01's shared normalized multi-term name+description
   matcher. The one configured default is selected on every opening; filtering
   it out clears the selection and disables Apply.
6. Resolve the one known blueprint ambiguity explicitly: the normative Markdown
   behavior wins. `Arrow Down` while focus is in search selects and focuses the
   **first visible profile**, even when a different selected profile is visible.
   Do not use the blueprint's `activeTabStopId` for this transition.
7. Exact keyboard behavior:
   - click selects only;
   - Arrow Up/Down moves selection and focus in list;
   - Home/End select first/last visible;
   - Enter applies only a valid selected row;
   - Enter with none is a no-op;
   - Escape cancels;
   - Tab/Shift+Tab traverse source, search, list, Manage, Cancel, Apply within
     the native transient window.
8. Exact selected treatment is `border-primary` plus
   `var(--primary-subtle)` plus `aria-selected`. **No separate checkmark, radio,
   selected glyph, or other selection indicator is permitted.**
9. Use `role=listbox`, `role=option`, `aria-selected`, a keyboard-focusable
   labeled source region, profile-specific accessible text, and a polite live
   result count. Focus-visible styling remains independent of selection.
10. Empty search copy and hierarchy are exactly `No profiles found` and
    `Try a different name or description.` using the blueprint `Empty` family.
11. Long source preserves whitespace, wraps long words, permits selection, and
    scrolls within 112 px. Names/descriptions wrap. A 200-custom catalog scrolls
    inside the profile list without clipping footer actions.
12. Footer order is Manage profiles, Cancel, Apply. Keep one row at 440 px,
    hide decorative Enter `Kbd` below 480 px, and stack actions only below
    380 px. Apply closes immediately; show no spinner/result/retry/provider/error
    panel.
13. Localize every visible string and built-in display name/description through
    the existing i18n system for every supported catalog. The operation payload
    may already contain localized metadata; do not localize instructions or
    expose them here. Validate longest translations at 440×520.
14. Wire only through packet 05's minimal chooser object on
    `window.electronAPI`: chooser load/ready/actions and the chooser-namespaced
    read-only locale methods. Do not call any generic localization, Settings,
    provider, recording, diagnostics, history, clipboard, or filesystem API.
    If the existing `I18nProvider` cannot accept the read-only locale subset,
    add a chooser-only/read-only adapter rather than broadening the preload.
    Renderer holds source/payload only for this window lifetime and clears
    component state on submit/cancel/manage/unmount.
15. Add a webpack entry and matching `HtmlWebpackPlugin` output for
    `prettify-profile-chooser.html`, using the current strict CSP template and
    only its chooser chunk. Preserve packet 05's separate Electron-preload
    build and ensure the BrowserWindow continues to use
    `dist/prettify-profile-chooser-preload.js`, never `dist/preload.js`. Update
    the packaged-runtime required-path policy and its fixtures/assertions with
    all three exact artifacts:
    - `dist/prettify-profile-chooser.html`;
    - `dist/prettify-profile-chooser-preload.js`;
    - `dist/renderer/prettifyProfileChooser.js`.
      The production build and packaged file-list tests must fail when any one
      is missing. `package.json` already includes `dist/**/*`; do not add
      package targets/assets/dependencies.

## Contracts And Boundaries

- Renderer has no Node, Electron, raw IPC, filesystem, provider, profile
  instruction, or secret access.
- The main 520×420 window and provider band are unchanged and contain no
  profile control/indicator.
- Native platform frame/title is the only window chrome.
- No profile selection starts provider work before explicit Apply.
- Source/profile content cannot enter renderer logs or thrown errors.

## Expected Files Or Components

- Add production chooser component/window/entry files under `src/renderer`.
- Add the chooser-only/read-only renderer API and i18n provider/adapter files if
  the shared bootstrap/providers cannot accept packet 05's minimal interface.
- Update `webpack.config.js` for the chooser renderer/HTML while preserving and
  testing packet 05's isolated
  `dist/prettify-profile-chooser-preload.js` output.
- Update `scripts/packaged-runtime-policy.mjs` with the chooser HTML, minimal
  preload, and renderer JS required paths.
- Add/extend chooser renderer pure-state/source-contract tests.
- Extend `tests/scripts/webpackConfig.test.ts` and
  `tests/scripts/packagedRuntimePolicy.test.ts`, including one missing-path case
  for each of the three chooser artifacts.
- Extend `tests/scripts/rendererBundle.test.ts` so the production renderer build
  emits the chooser HTML/entry, injects its own entry chunk, and excludes every
  other window entry from that HTML.
- Extend `tests/main/prettifyProfileChooserPreloadApi.test.ts` only if renderer
  wiring changes the minimal contract; it must still prove that no normal
  `ElectronAPI` capability is present.
- Add chooser-only copy to every locale catalog. Consume and assert the eight
  built-in display metadata keys delivered by packet 01 without redefining or
  duplicating them. Extend `tests/main/i18n.test.ts`.

Do not edit or move the approved design artifacts.

## Acceptance Criteria

- Production output matches the approved PNG and blueprint hierarchy/states at
  620×640 and 440×520 with no unresolved P0–P2 fidelity difference.
- Default-focused, selected/unselected, filter-empty, long source/metadata,
  200-custom, and constrained-work-area states meet the exact contract.
- No check/radio/glyph appears in selected rows.
- Keyboard/focus/listbox/live-region behavior is deterministic and fully
  localized.
- Apply alone invokes submit; selection never invokes provider work.
- Chooser HTML, renderer JS, and isolated minimal preload are present in the
  production build and packaged-runtime policy; omission of each artifact is
  covered independently.
- The chooser entry type-checks against only `PrettifyProfileChooserAPI`, and
  its BrowserWindow never loads the general `dist/preload.js`.
- No console error/warning, clipped persistent action, or new dependency/asset.

## Verification

```text
rtk test node --import tsx --test tests/renderer/prettifyProfileChooser.test.ts
rtk test node --import tsx --test tests/main/prettifyProfileChooserPreloadApi.test.ts
rtk test node --import tsx --test tests/scripts/webpackConfig.test.ts
rtk test node --import tsx --test tests/scripts/rendererBundle.test.ts
rtk test node --import tsx --test tests/scripts/packagedRuntimePolicy.test.ts
rtk test node --import tsx --test tests/main/i18n.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run build:prod
```

Use the actual focused chooser renderer test filename if the implementation
splits pure state and source-contract tests. Run task-local lint/format checks.

## Failure And Rollback

- Missing/malformed payload renders no half-loaded chooser; request main cancel
  and use a generic safe failure path.
- IPC failure clears local state and closes/cancels without exposing payload.
- Rollback removes only chooser renderer/build entries; packet 05 controller
  remains inert without a renderer URL and persists no data.
- Any design deviation or ambiguous artifact stops the packet; do not
  approximate.

## Manual Gates

- MANUAL GATE: capture deterministic DSF=1 screenshots at content viewports
  620×640 and 440×520 and compare with the approved PNG/design QA.
- Exercise selected, unselected, filter-empty, long-content, keyboard-only,
  screen-reader naming, reduced-motion, and longest-localization states.
- Require footer visibility, zero console errors/warnings, and no unresolved
  P0–P2 fidelity difference.
- Do not commit generated comparison screenshots unless separately requested;
  no commit, push, PR, installer, or release action is authorized.

## References

Mandatory design bundle — direct links:

- [Chooser design contract](../design/chooser-design.md)
- [Chooser code-native blueprint](../design/PrettifyProfileChooser.blueprint.tsx)
- [Approved chooser PNG](../design/prettify-profile-chooser-preview.png)
- [Approved design QA](../../../../design-qa.md)

The Markdown/TSX/PNG authority hierarchy is defined in the task contract above.
The Telegram/Apple evidence is background only; do not clone either product.

## Completion And Handoff

After automated and available manual verification:

1. Mark packet 06 complete in `todo.md`.
2. Update `handoff.md` with exact UI/build/locale files, checks, screenshot gate
   results or outstanding platform gates, and packet 07 as next.
3. Present the faithful implementation for review and stop. Do not commit or
   start packet 07.
