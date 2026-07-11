# Task List: GPT-Voice UI Redesign

Source specification: `docs/specs/ui-redesign/spec.md`  
Implementation plan: `docs/specs/ui-redesign/tasks/plan.md`

## Task 1: Select The Visual Direction

**Description:** Produce exactly three image-based main-window concepts grounded in the current screenshot, real 460x420 viewport, approved graphite/blue direction, and shadcn component language. Record the selected direction and final token/layout decisions before implementation.

**Acceptance criteria:**

- [x] Exactly three materially distinct concepts show provider, GPU memory, recording controls, status, and language selection at the real viewport.
- [x] The selected concept is checked for hierarchy, spacing, contrast intent, localization space, and minimum-window feasibility.
- [x] `docs/specs/ui-redesign/spec.md` records the approved direction and moves from Draft to Approved.

**Verification:**

- [x] Inspect every generated concept at original resolution.
- [x] Human selects one direction explicitly.
- [x] Run `npx prettier --check docs/specs/ui-redesign/spec.md`.

**Dependencies:** None

**Files likely touched:**

- `docs/specs/ui-redesign/spec.md`
- `.artifacts/ui-redesign/concept-1.png`
- `.artifacts/ui-redesign/concept-2.png`
- `.artifacts/ui-redesign/concept-3.png`

**Estimated scope:** Medium (4 files)

## Task 2: Integrate Tailwind And shadcn Tooling

**Description:** Add renderer-only Tailwind 4/PostCSS support, a pinned shadcn configuration, and all approved primitive dependencies while keeping main and preload bundling unchanged.

**Acceptance criteria:**

- [x] Webpack processes Tailwind CSS for the renderer and still emits `index.html`, `settings.html`, and `history.html`.
- [x] `components.json` uses `rsc: false`, TypeScript, CSS variables, Lucide, neutral base color, and renderer aliases.
- [x] Only dependencies required by the approved component set are added and production audit remains clean.

**Verification:**

- [x] Run `npm run typecheck`.
- [x] Run `npm run build:prod`.
- [x] Run `npm run audit:prod`.

**Dependencies:** Task 1

**Files likely touched:**

- `package.json`
- `package-lock.json`
- `webpack.config.js`
- `postcss.config.js`
- `components.json`

**Estimated scope:** Medium (5 files)

## Task 3: Establish Global Tokens And Electron Base Styles

**Description:** Add the approved dark design tokens, Tailwind theme mapping, typography/spacing/radius rules, reduced-motion behavior, and the small set of Electron-specific global rules needed during migration.

**Acceptance criteria:**

- [x] Semantic background, surface, text, border, primary, success, warning, destructive, and focus tokens are defined once.
- [x] Home, App Settings, History, and About inherit the same graphite palette without per-window base-color overrides.
- [x] Every renderer window opens with a graphite loading shell before bundled styles load and does not reveal content until its initial route state is stable.
- [x] Navigation hover and selected states meet the shared surface-contrast contract; scrollbars use transparent tracks and rounded thumbs.
- [x] Renderer roots receive stable sizing, system typography, no horizontal overflow, and reduced-motion behavior.
- [x] Existing unmigrated screens remain usable while both style layers temporarily coexist.

**Verification:**

- [x] Run `npm run build:prod`.
- [x] Launch an isolated Electron instance and inspect Main, Settings, and History shells. Trusted IPC flows remain covered by their existing tests and will be exercised again through normal window navigation in Task 10.
- [x] Inspect default and minimum window sizes for global regressions.

**Dependencies:** Task 2

**Files likely touched:**

- `src/renderer/styles/globals.css`
- `src/renderer/styles/electron.scss`
- `src/renderer/index.tsx`
- `src/renderer/styles.scss`

**Estimated scope:** Medium (4 files)

## Task 4: Add Core Action And Status Primitives

**Description:** Add and review the shared class helper plus the first shadcn primitive batch used by every screen.

**Acceptance criteria:**

- [x] Button variants cover primary, secondary, outline, ghost, and destructive actions with stable icon sizes.
- [x] Badge, Tooltip, and Separator use project tokens and visible focus behavior.
- [x] No component contains hardcoded product copy or Electron access.

**Verification:**

- [x] Run `npm run typecheck`.
- [x] Run `npm run lint` on the changed files through the project command.
- [x] Run `npm run build:prod`.

**Dependencies:** Task 3

**Files likely touched:**

- `src/renderer/lib/cn.ts`
- `src/renderer/components/ui/button.tsx`
- `src/renderer/components/ui/badge.tsx`
- `src/renderer/components/ui/tooltip.tsx`
- `src/renderer/components/ui/separator.tsx`

**Estimated scope:** Medium (5 files)

## Task 5: Add Form Primitives

**Description:** Add the shared field, label, input, textarea, and switch components used by provider and application settings.

**Acceptance criteria:**

- [x] Fields support labels, descriptions, required state, disabled state, and associated inline errors.
- [x] Inputs and textareas fit current localized values without fixed-height clipping.
- [x] Switch exposes correct checked, disabled, focus, and accessible-name behavior.

**Verification:**

- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run build:prod`.

**Dependencies:** Task 4

**Files likely touched:**

- `src/renderer/components/ui/field.tsx`
- `src/renderer/components/ui/label.tsx`
- `src/renderer/components/ui/input.tsx`
- `src/renderer/components/ui/textarea.tsx`
- `src/renderer/components/ui/switch.tsx`

**Estimated scope:** Medium (5 files)

## Task 6: Add Overlay And Navigation Primitives

**Description:** Add Select, Dialog, Alert Dialog, Dropdown Menu, and Tabs with Electron-safe portals and keyboard behavior.

**Acceptance criteria:**

- [x] Dialog and Alert Dialog trap focus, close safely with Escape, and return focus to their trigger.
- [x] Select and Dropdown Menu support keyboard selection and stay within compact window bounds.
- [x] Tabs support vertical navigation and an icon-only responsive state with accessible labels.

**Verification:**

- [x] Run `npm run typecheck` and `npm run build:prod`.
- [x] Launch the Electron renderer and manually exercise keyboard navigation for every primitive.
- [x] Check overlays at 400px and 440px window widths.

**Dependencies:** Task 5

**Files likely touched:**

- `src/renderer/components/ui/select.tsx`
- `src/renderer/components/ui/dialog.tsx`
- `src/renderer/components/ui/alert-dialog.tsx`
- `src/renderer/components/ui/dropdown-menu.tsx`
- `src/renderer/components/ui/tabs.tsx`

**Estimated scope:** Medium (5 files)

## Task 7: Add Feedback And Scrolling Primitives

**Description:** Add consistent persistent feedback, progressive disclosure, list scrolling, and loading placeholders.

**Acceptance criteria:**

- [x] Alert supports informational, warning, and destructive states without color-only meaning.
- [x] Collapsible and Scroll Area preserve focus visibility and work at minimum window sizes.
- [x] Skeleton and Spinner reserve stable dimensions and respect reduced motion.

**Verification:**

- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run build:prod`.
- [x] Inspect the primitives in Electron when they are first mounted in Tasks 11 and 14.

**Dependencies:** Task 6

**Files likely touched:**

- `src/renderer/components/ui/alert.tsx`
- `src/renderer/components/ui/collapsible.tsx`
- `src/renderer/components/ui/scroll-area.tsx`
- `src/renderer/components/ui/skeleton.tsx`
- `src/renderer/components/ui/spinner.tsx`

**Estimated scope:** Medium (5 files)

## Task 8: Add Utility And Notification Primitives

**Description:** Complete the approved primitive set with empty state, local toast host, keyboard-key display, and slider controls.

**Acceptance criteria:**

- [x] Empty state, Kbd, and Slider use project tokens and accessible semantics.
- [x] Sonner is mounted once at the renderer root and is limited to transient non-sensitive feedback.
- [x] Toasts, sliders, and keyboard labels fit all three renderer entry points.

**Verification:**

- [x] Run `npm run typecheck` and `npm run build:prod`.
- [x] Verify keyboard slider adjustment and reduced-motion behavior in Electron when it is mounted in Task 15.
- [x] Verify any future toast call site uses sanitized, non-sensitive content before it is added.

**Dependencies:** Task 7

**Files likely touched:**

- `src/renderer/components/ui/empty.tsx`
- `src/renderer/components/ui/sonner.tsx`
- `src/renderer/components/ui/kbd.tsx`
- `src/renderer/components/ui/slider.tsx`
- `src/renderer/index.tsx`

**Estimated scope:** Medium (5 files)

## Task 9: Add Localized Redesign Copy

**Description:** Define the complete display-copy contract for navigation, visible recording commands, settings sections, confirmation dialogs, history states, and accessibility labels.

**Acceptance criteria:**

- [x] English, Russian, Ukrainian, and Belarusian contain every new key with equivalent meaning.
- [x] Copy is concise enough for minimum window widths and avoids internal implementation terms.
- [x] Locale alignment tests fail on any missing or extra key.

**Verification:**

- [x] Run `node --import tsx --test tests/main/i18n.test.ts`.
- [x] Run `npm run test:types`.
- [x] Review the longest Russian and Belarusian labels manually.

**Dependencies:** Task 8

**Files likely touched:**

- `src/main/i18n/en.ts`
- `src/main/i18n/ru.ts`
- `src/main/i18n/uk.ts`
- `src/main/i18n/be.ts`
- `tests/main/i18n.test.ts`

**Estimated scope:** Medium (5 files)

## Task 10: Expose Typed Main-Window Navigation Commands

**Description:** Expose narrow renderer commands that call the existing main-process Settings and History window functions.

**Acceptance criteria:**

- [x] Main renderer can request App Settings and History without receiving Electron objects or raw IPC access.
- [x] IPC handlers use existing trusted-sender validation and existing window single-instance behavior.
- [x] Preload implementation and renderer type contract remain exactly aligned.

**Verification:**

- [x] Run `npm run typecheck` and `npm run test:types`.
- [x] Run `npm run build:prod`.
- [x] Manually click both commands repeatedly and confirm one window instance is focused.

**Dependencies:** Task 9

**Files likely touched:**

- `src/main/ipc.ts`
- `src/main/preload.ts`
- `src/renderer/types.d.ts`

**Estimated scope:** Medium (3 files)

## Task 11: Build The Visible Recording Workspace

**Description:** Add stable visible Record, Stop, Pause, Resume, and Cancel controls that derive from and invoke the existing recording lifecycle.

**Acceptance criteria:**

- [x] Every lifecycle state maps to the correct visible, enabled, disabled, and loading controls.
- [x] Window controls and global shortcuts invoke the same `useRecording` functions without duplicate requests.
- [x] Control dimensions remain stable across idle, recording, paused, stopping, transcribing, and retrying states.

**Verification:**

- [x] Add a failing-then-passing test and run `node --import tsx --test tests/renderer/mainWindowViewState.test.ts`.
- [x] Run existing recording lifecycle/retry tests through `npm test`.
- [x] Manually exercise mouse paths in Electron; existing shortcut tests cover the same lifecycle functions and direct shortcut delivery will be rechecked in the completed main shell.

**Dependencies:** Task 10

**Files likely touched:**

- `src/renderer/App.tsx`
- `src/renderer/hooks/useRecording.ts`
- `src/renderer/components/RecordingControls.tsx`
- `src/renderer/mainWindowViewState.ts`
- `tests/renderer/mainWindowViewState.test.ts`

**Estimated scope:** Medium (5 files)

## Task 12: Complete The Main-Window Shell And Secondary Controls

**Description:** Apply the approved shell hierarchy to provider state, direct window navigation, GPU memory, status feedback, and translation target selection.

**Acceptance criteria:**

- [x] Provider, connection badge, provider settings, History, and App Settings form one compact keyboard-accessible header.
- [x] Ollama memory row remains conditional and Load/Free actions remain mutually exclusive with stable loading state.
- [x] Status/error and language controls fit default and 400x360 minimum windows without horizontal scrolling.

**Verification:**

- [x] Run `node --import tsx --test tests/renderer/prettifyModelControl.test.ts tests/renderer/providerState.test.ts`.
- [x] Run `npm run build:prod`.
- [x] Capture and inspect the remaining provider, model-memory, and error states at default and minimum sizes during final visual verification.

**Dependencies:** Task 11

**Files likely touched:**

- `src/renderer/App.tsx`
- `src/renderer/components/MainToolbar.tsx`
- `src/renderer/components/StatusIndicator.tsx`
- `src/renderer/components/TranslateSection.tsx`
- `src/renderer/prettifyModelControl.ts`

**Estimated scope:** Medium (5 files)

## Task 13: Redesign Provider Settings

**Description:** Replace the provider modal markup with shadcn dialogs and clear browser-session/API-key subviews while preserving all provider actions and secret handling.

**Acceptance criteria:**

- [x] ChatGPT Web and OpenAI API variants show correct fields, status badges, loading, inline error, and disabled states.
- [x] Clear Session and Clear API Key use destructive confirmation; secrets are never echoed after save.
- [x] Dialog focus trap, Escape behavior, and focus return work in the real main window.

**Verification:**

- [x] Add and run `node --import tsx --test tests/renderer/providerSettingsViewState.test.ts`.
- [x] Run `npm run typecheck` and `npm run build:prod`.
- [x] Manually verify both provider variants at default and minimum main-window sizes.

**Dependencies:** Task 12

**Files likely touched:**

- `src/renderer/components/ProviderSettingsModal.tsx`
- `src/renderer/components/ProviderAuthPanel.tsx`
- `src/renderer/components/ProviderApiSettingsForm.tsx`
- `src/renderer/providerSettingsViewState.ts`
- `tests/renderer/providerSettingsViewState.test.ts`

**Estimated scope:** Medium (5 files)

## Task 14: Redesign Transcription History

**Description:** Build a populated-first flat history list with visible copy affordance, existing limit/offset infinite scrolling, confirmations, and complete list states.

**Acceptance criteria:**

- [x] Existing entries render immediately with localized time, provider badge, wrapped transcript button, and visible copy affordance.
- [x] Initial loading, loading-more, empty, error/retry, copied, cleared, and end states are unambiguous and layout-stable.
- [x] Infinite scrolling does not duplicate or skip IDs and Clear History requires confirmation.

**Verification:**

- [x] Add and run `node --import tsx --test tests/renderer/historyViewState.test.ts`.
- [x] Run `node --import tsx --test tests/main/transcriptionHistoryStorage.test.ts`.
- [x] Capture populated, empty, loading, error, copied, and end states at default and 520x420 minimum sizes during final visual verification.

**Dependencies:** Task 12

**Files likely touched:**

- `src/renderer/HistoryWindow.tsx`
- `src/renderer/components/HistoryEntry.tsx`
- `src/renderer/historyViewState.ts`
- `tests/renderer/historyViewState.test.ts`

**Estimated scope:** Medium (4 files)

## Task 15: Extract Shortcuts And Prettify Sections

**Description:** Move the first two App Settings sections behind typed props without visual or behavioral changes, reducing the parent component before redesign.

**Acceptance criteria:**

- [x] App Settings retains identical load, edit, validation, model discovery, VRAM, hotkey, and save behavior.
- [x] Shortcuts and Prettify rendering live in focused components with no direct IPC or secret logging.
- [x] `AppSettingsWindow.tsx` remains the state/save owner and all existing tests stay green.

**Verification:**

- [x] Run `node --import tsx --test tests/renderer/appSettingsUtils.test.ts`.
- [x] Run `npm run typecheck` and `npm run build:prod`.
- [x] Compare current Settings interactions before and after extraction.

**Dependencies:** Tasks 13 and 14

**Files likely touched:**

- `src/renderer/AppSettingsWindow.tsx`
- `src/renderer/components/settings/types.ts`
- `src/renderer/components/settings/ShortcutsSection.tsx`
- `src/renderer/components/settings/PrettifySection.tsx`

**Estimated scope:** Medium (4 files)

## Task 16: Extract Browser And Network Sections

**Description:** Move CloakBrowser identity and proxy fields into focused components without changing validation, GeoIP ownership, encrypted password, or save behavior.

**Acceptance criteria:**

- [x] Browser and Network rendering are owned by separate section components.
- [x] Proxy enablement, SOCKS5 warnings, password clearing, GeoIP, locale, timezone, and fingerprint behavior remain unchanged.
- [x] App Settings still loads, validates, partially saves, and reports errors exactly as before.

**Verification:**

- [x] Run `node --import tsx --test tests/renderer/appSettingsUtils.test.ts tests/main/cloakBrowserSettingsUtils.test.ts`.
- [x] Run `npm run typecheck` and `npm run build:prod`.
- [x] Manually exercise proxy and GeoIP dependencies.

**Dependencies:** Task 15

**Files likely touched:**

- `src/renderer/AppSettingsWindow.tsx`
- `src/renderer/components/settings/BrowserSection.tsx`
- `src/renderer/components/settings/NetworkSection.tsx`

**Estimated scope:** Medium (3 files)

## Task 17: Build The Responsive Settings Shell And Save Footer

**Description:** Add four-section responsive navigation, stable content ownership, dirty-state derivation, and a sticky Save Changes/Close footer around the extracted sections.

**Acceptance criteria:**

- [x] Vertical tabs show labels at default width and collapse to accessible icon controls below 640px.
- [x] Save is enabled only for dirty valid state and the footer presents saving, save-level error, and success feedback without shifting.
- [x] Section changes preserve unsaved values and focus remains visible within the scrolling content area.

**Verification:**

- [x] Add failing-then-passing dirty/shell state cases to `tests/renderer/appSettingsUtils.test.ts`.
- [x] Run `node --import tsx --test tests/renderer/appSettingsUtils.test.ts`.
- [x] Inspect every section at default and 440x520 minimum sizes.

**Dependencies:** Task 16

**Files likely touched:**

- `src/renderer/AppSettingsWindow.tsx`
- `src/renderer/components/settings/SettingsNavigation.tsx`
- `src/renderer/components/settings/SettingsFooter.tsx`
- `src/renderer/appSettingsUtils.ts`
- `tests/renderer/appSettingsUtils.test.ts`

**Estimated scope:** Medium (5 files)

## Task 18: Redesign Shortcuts And Prettify Controls

**Description:** Convert the extracted Shortcuts and Prettify sections to the approved primitives, progressive disclosure, icon actions, and compact responsive field layout.

**Acceptance criteria:**

- [x] Shortcut rows use Kbd, Change, and existing enable switches with clear focus/disabled states.
- [x] Prettify provider-specific fields, model metadata, refresh, VRAM menu, prompt, temperature, and advanced controls preserve existing behavior.
- [x] Advanced summary identifies non-default values and long model/locale labels do not hide actions.

**Verification:**

- [x] Run `node --import tsx --test tests/renderer/appSettingsUtils.test.ts tests/renderer/prettifyModelControl.test.ts`.
- [x] Run `npm run build:prod`.
- [x] Manually verify Ollama, vLLM, model-loading, field-error, and hotkey-dialog states.

**Dependencies:** Task 17

**Files likely touched:**

- `src/renderer/components/settings/ShortcutsSection.tsx`
- `src/renderer/components/settings/PrettifySection.tsx`
- `src/renderer/components/HotkeyRow.tsx`
- `src/renderer/components/HotkeyModal.tsx`

**Estimated scope:** Medium (4 files)

## Task 19: Redesign Browser And Network Controls

**Description:** Convert Browser and Network sections to accessible fields, switches, selects, collapsible fingerprint controls, and dependency-aware disabled states.

**Acceptance criteria:**

- [x] Frequent browser settings are visible while fingerprint controls use progressive disclosure with a meaningful summary.
- [x] Disabled proxy and GeoIP-dependent fields remain understandable and preserve current values.
- [x] Field errors, saved-password hints, SOCKS5 warnings, and secret-safe summaries remain correct.

**Verification:**

- [x] Add focused dependency/dirty-state cases to `tests/renderer/appSettingsUtils.test.ts`.
- [x] Run App Settings and CloakBrowser settings unit tests.
- [x] Manually verify browser/network sections at default and minimum sizes.

**Dependencies:** Task 17

**Files likely touched:**

- `src/renderer/components/settings/BrowserSection.tsx`
- `src/renderer/components/settings/NetworkSection.tsx`
- `src/renderer/appSettingsUtils.ts`
- `tests/renderer/appSettingsUtils.test.ts`

**Estimated scope:** Medium (4 files)

## Task 20: Add Unsaved-Close Handling And Final Window Geometry

**Description:** Coordinate native Settings-window close requests with renderer dirty state, then apply approved default dimensions while preserving minimum sizes and single-instance behavior.

**Acceptance criteria:**

- [x] Clean Settings closes immediately; dirty Settings opens Discard/Continue Editing confirmation for both the Close button and native window close.
- [x] Main can force confirmed close without an event loop, duplicate dialog, or lost save state.
- [x] Default Settings and History dimensions match the spec while current minimum dimensions remain supported.

**Verification:**

- [x] Run `npm run typecheck`, `npm run test:types`, and `npm run build:prod`.
- [x] Manually test clean, dirty, saving, confirmed-discard, cancelled-discard, and repeated native-close states.
- [x] Verify Linux, Windows, and macOS window creation paths compile.

**Dependencies:** Tasks 18 and 19

**Files likely touched:**

- `src/main/window.ts`
- `src/main/ipc.ts`
- `src/main/preload.ts`
- `src/renderer/types.d.ts`
- `src/renderer/AppSettingsWindow.tsx`

**Estimated scope:** Medium (5 files)

## Task 21: Remove Legacy Renderer Styling And Dead UI Code

**Description:** Remove the obsolete monolithic SCSS selectors and components after all screens use the new token/component system, preserving only Electron-specific style rules still required at runtime.

**Acceptance criteria:**

- [x] No migrated screen imports or references legacy class names or duplicate token definitions.
- [x] Unused legacy presentation components are removed only after reference searches prove they are unreachable.
- [x] Renderer bundle and all three HTML entries build without the old stylesheet.

**Verification:**

- [x] Use `rg` to confirm removed selectors/components have no consumers.
- [x] Run the full unit and type test suites.
- [x] Run `npm run build:prod` and inspect renderer bundle warnings for regressions.

**Dependencies:** Task 20

**Files likely touched:**

- `src/renderer/styles.scss`
- `src/renderer/index.tsx`
- `src/renderer/styles.d.ts`
- `src/renderer/components/LoginButton.tsx`
- `src/renderer/components/LoadingScreen.tsx`

**Estimated scope:** Medium (5 files)

## Task 22: Complete Final Accessibility, Visual, Platform, And Documentation Verification

**Description:** Run the complete Definition of Done, capture accepted runtime evidence, document the redesigned behavior, and mark the specification implemented only after human review.

**Acceptance criteria:**

- [x] Every specification success criterion has runtime or automated evidence, including default/minimum states and all four locales.
- [x] Linux verification passes and Windows/macOS builds or platform checks complete without renderer regressions.
- [x] User documentation and specification accurately describe the final UI without exposing sensitive test data.

**Verification:**

- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:types`, and `npm test`.
- [x] Run `npm run validate:dependabot`, `npm run audit:prod`, and `npm run build:prod`.
- [x] Complete keyboard, focus, contrast, reduced-motion, localization, default-size, and minimum-size screenshot review.

**Implementation evidence (2026-07-11):**

- [x] Used an isolated Electron profile with synthetic model names and transcription history entries to verify the main window, provider modal, settings sections, history pagination/copy/clear states, dirty-close confirmation, recording controls, and validation feedback.
- [x] Verified default and minimum window layouts, focus restoration, keyboard navigation, reduced-motion behavior, contrast, and English, Russian, Ukrainian, and Belarusian clipping behavior.
- [x] Ran `npm run pack` and `npm run verify:packaged` on Linux. The Windows/macOS package commands, CI packaging jobs, native-title-bar setup, and Electron security configuration were reviewed as unchanged; their native package execution remains covered by those platform jobs.

**Dependencies:** Task 21

**Files likely touched:**

- `README.md`
- `docs/specs/ui-redesign/spec.md`

**Estimated scope:** Medium (2 tracked files plus review artifacts)

## Task 23: Create A Text-Based Command Dock Visual Contract

**Description:** Convert the selected 1312x1199 Command Dock image into lossless-scaling, machine-readable design artifacts before changing the main-window layout again.

**Acceptance criteria:**

- [x] An editable SVG reconstructs every visible band, control, label, state, icon slot, and alignment relationship.
- [x] A blueprint SVG exposes exact section and interactive-control bounds.
- [x] A JSON manifest maps source-image coordinates to the 460x420 renderer target and records tokens, typography, icon sources, and implementation constraints.
- [x] The artifacts identify that native window chrome must not consume the 460x420 renderer-content target.

**Verification:**

- [x] Render both SVG files at their declared dimensions with FFmpeg.
- [x] Parse the JSON manifest with Node.js.
- [x] Compare the reference and reconstructed SVG render together at 1312x1199.
- [x] Record quantitative and visual results in `docs/specs/ui-redesign/tasks/command-dock-text-source-qa.md`.

**Dependencies:** Task 1

**Files touched:**

- `docs/specs/ui-redesign/assets/command-dock-reference.svg`
- `docs/specs/ui-redesign/assets/command-dock-blueprint.svg`
- `docs/specs/ui-redesign/assets/command-dock-layout.json`
- `docs/specs/ui-redesign/spec.md`

**Estimated scope:** Medium (4 tracked files plus QA evidence)

## Task 24: Reimplement The Main Window Against The Visual Contract

**Description:** Replace the current main-window composition with a faithful implementation of the text-based Command Dock contract while preserving existing provider, model-memory, recording, history, settings, and language behavior.

**Acceptance criteria:**

- [x] The default 460x420 renderer content matches `command-dock-reference.svg` in section heights, alignment, typography, color, and control bounds.
- [x] History, Settings, provider selection, provider configuration, GPU actions, recording controls, and target-language selection remain functional and keyboard accessible.
- [x] Recording, paused, processing, error, disconnected, model-unloaded, and loading states preserve the same geometry without overlap or layout shift.
- [x] Minimum and enlarged window sizes remain usable without weakening default-viewport fidelity.

**Verification:**

- [x] Capture the Electron main window at exactly 460x420 renderer content.
- [x] Compare the runtime screenshot and SVG reference together and resolve all P0-P2 discrepancies.
- [x] Run focused renderer tests and the repository quality suite.
- [ ] Obtain human visual approval.

**Dependencies:** Task 23

**Files likely touched:**

- `src/renderer/App.tsx`
- `src/renderer/components/MainToolbar.tsx`
- `src/renderer/components/PrettifyModelMemoryRow.tsx`
- `src/renderer/components/RecordingControls.tsx`
- `src/renderer/components/TranslateSection.tsx`
- `src/renderer/styles/globals.css`
- `src/main/window.ts`
- `src/main/i18n/{en,ru,uk,be}.ts`
- `src/renderer/assets/flags/`

**Estimated scope:** Medium (5 primary files plus tests/locales as required)

## Final Human Gate

- [ ] Human has reviewed and approved `docs/specs/ui-redesign/tasks/plan.md` and this task list.
- [ ] Human has selected the Task 1 visual direction.
- [ ] Human has approved the completed runtime screenshots before merge.
