# Spec: GPT-Voice UI Redesign

Status: Implementation complete; final human visual approval pending  
Date: 2026-07-10  
Scope owner: Renderer UX and design system

## Objective

Redesign GPT-Voice as a compact, consistent desktop tool for frequent transcription, translation, and text-prettification work. The redesign must make the current state and next action immediately clear, reduce the effort required to reach common settings and history, and replace the current one-off controls with an accessible component system based on shadcn/ui.

The primary user is a desktop power user who operates GPT-Voice repeatedly through global shortcuts but still needs visible controls, clear provider status, model memory controls, history, and understandable settings.

The redesign succeeds when users can:

1. See provider, recording, transcription, and prettification state at a glance.
2. Start and control recording from the window without needing to learn a shortcut first.
3. Open History and App Settings directly from the main window.
4. Configure providers, shortcuts, Prettify, browser behavior, and proxy settings without scanning one long form.
5. Read, copy, paginate, and clear transcription history confidently.
6. Use every workflow with keyboard, mouse, and supported system accessibility tools on Linux, Windows, and macOS.

## Implementation Verification Status

Automated and isolated Electron runtime verification has been completed with synthetic fixture data and a disposable app profile. The completed evidence covers desktop navigation, recording controls, model-memory state, history pagination and copy feedback, destructive confirmations, settings close confirmation, keyboard focus, reduced motion, contrast, and English, Russian, Ukrainian, and Belarusian layouts at default and minimum window sizes.

The main window has now been rebuilt against the text-based Command Dock contract and captured at exactly 460x420 renderer content. The corrected runtime screenshot was compared beside the supplied reference at the same aspect ratio and state; section bounds, controls, typography, colors, and icon placement have no remaining P0-P2 discrepancy. Supporting-window verification remains valid. Final specification acceptance still requires human approval of the corrected main-window screenshot.

## Assumptions For Review

1. The redesign covers the main window, provider settings dialog, App Settings window, and History window.
2. Existing Electron window boundaries remain: App Settings and History continue to open in separate windows, while provider settings remains a modal dialog in the main window.
3. Existing provider, recording, history, hotkey, translation, Prettify, and GPU-memory behavior remains functionally compatible.
4. Dark mode is the only theme in this redesign. Light mode is a separate future feature.
5. shadcn/ui is adopted as locally owned component source, with Tailwind CSS and Lucide icons, rather than visually imitated in the existing monolithic SCSS file.
6. The visual direction is neutral graphite with a blue action color and distinct semantic colors. The current purple-blue monochrome appearance is not retained as the dominant palette.
7. All current locales and supported desktop platforms remain first-class requirements.
8. On Linux, the current application logo is synchronized into the per-user `hicolor` icon theme at every shipped size when the app starts. This keeps development and packaged windows aligned with the desktop launcher and task switcher.

## Design Inputs

Current-state screenshots supplied for this specification:

- `.artifacts/home.png`
- `.artifacts/provider-settings.png`
- `.artifacts/app-settings.png`
- `.artifacts/history.png`

Component reference:

- [shadcn/ui documentation](https://ui.shadcn.com/docs)
- [shadcn/ui components](https://ui.shadcn.com/docs/components)
- [shadcn/ui manual installation](https://ui.shadcn.com/docs/installation/manual)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)

shadcn/ui is an open-code distribution system, not a conventional runtime component library. Components are copied into the repository and become project-owned code. Its current manual setup uses Tailwind CSS, CSS-variable theming, a `cn` class helper, Lucide icons, and local component aliases.

## Approved Visual Direction

The selected direction is **Command Dock**, represented by `.artifacts/ui-redesign/concept-1.png`.

The implementation source of truth is now stored as text-based, version-controlled design data:

- `docs/specs/ui-redesign/assets/command-dock-reference.svg` is the editable visual reconstruction.
- `docs/specs/ui-redesign/assets/command-dock-blueprint.svg` exposes section and control bounds.
- `docs/specs/ui-redesign/assets/command-dock-layout.json` contains exact source-image and 460x420 CSS coordinates, tokens, typography, icon mapping, and implementation rules.

The supplied 1312x1199 generated image maps to the 460x420 renderer target with `scaleX = 0.3506097561` and `scaleY = 0.3502919099`. Implementers must use those coordinates instead of estimating spacing from the raster image. The 460x420 contract describes renderer content; native operating-system chrome must not reduce that content area.

The main window remains a compact 460x420 desktop workspace with this fixed information hierarchy:

1. A compact identity row with direct History and App Settings icon actions.
2. A provider row with a microphone icon and concise semantic connection state, not a large status action.
3. A structured model-memory row with a BrainCircuit icon, showing model name, VRAM estimate, loaded state, and the one applicable model-memory command.
4. A full-width primary recording command with the microphone icon and `F9` shortcut hint.
5. A stable operation-state row that can represent idle, recording, processing, or Prettify work without layout shift.
6. A bottom target-language selector.

The token decisions are final for the redesign: near-neutral graphite background and surface layers; off-white foreground; muted gray metadata; quiet gray borders; blue primary and focus states; green success states; amber attention states; and red destructive/error states. Semantic text and icons accompany every color-only cue. Controls use 6px radii, with an 8px maximum for dialogs and repeated-item surfaces. Layout uses separators and aligned rows rather than nested cards or floating panels.

All renderer windows inherit this one token set. The main Command Dock may define layout aliases, but it must not override the shared palette: Home, App Settings, History, and About use the same graphite background, surface, border, text, and semantic colors.

Every BrowserWindow opens immediately with the shared graphite background and a `progress` cursor. The pre-bundle HTML shell paints its loading indicator before React renders; it remains visible until the route has resolved its initial localized and IPC-backed state, then cross-fades once to the stable layout and restores the default cursor. Opening a window must never flash the platform-default white background or expose controls that later shift position.

Navigation must remain distinct from the page background: side rails use a bordered surface, hover uses a raised surface, and the selected item adds a primary-color ring. Native and Radix scroll areas use transparent tracks with rounded thumbs so they blend into the graphite window surface without boxed gutters.

## Current-State Findings

### Main Window

- Provider selection, GPU model state, connection state, recording state, and target language compete vertically without a strong hierarchy.
- The large green connected control visually outweighs the primary transcription task even though it is a status, not an action.
- Recording is discoverable mainly through instructional shortcut text. There is no visible primary recording command.
- History and App Settings are available through the tray menu but are not directly discoverable in the main window.
- The GPU model control is useful, but its panel consumes disproportionate space when the main window is compact.

### Provider Settings

- The dialog is understandable but uses several visually equivalent buttons for primary, secondary, destructive, and dismiss actions.
- Session state is text-only and does not have a compact semantic badge.
- Destructive session clearing needs clearer visual treatment and confirmation.
- Focus behavior, focus return, and keyboard dismissal are not evident from the screenshot and must be explicitly guaranteed.

### App Settings

- All settings are arranged in one long scrolling page, making navigation and change review expensive.
- Hotkeys, Prettify model settings, browser identity, and network configuration need stronger grouping.
- Advanced generation controls are visually dense and become cramped in two columns.
- Repeated bordered inputs and muted labels create low contrast and weak scanability.
- Refresh and model-memory actions are text-heavy where icons and tooltips would be more efficient.

### History

- The screenshot reports 200 entries while the visible content region appears empty, which makes the main purpose of the window look broken.
- The header and destructive action are visible, but list loading, loading-more, empty, error, copied, and end-of-list states need a stronger visual contract.
- The transcript copy affordance must be apparent without relying only on hover.

## Product Principles

### Work-Focused

The interface must feel like a desktop utility, not a landing page. Use dense but calm information hierarchy, predictable controls, and direct access to repeated actions. Avoid decorative hero layouts, oversized headings, gradients, floating page sections, or ornamental imagery.

### State Before Decoration

Recording, paused, processing, prettifying, provider connectivity, and model-memory state must use consistent icon, label, and semantic-color patterns. Color alone must never carry meaning.

### Progressive Disclosure

Show frequent settings first. Put advanced generation and browser fingerprint controls in collapsed sections that retain summary values and validation markers.

### Stable Layout

Dynamic text, loading indicators, copied feedback, translated labels, and provider names must not resize or shift fixed controls. Use stable grid tracks, minimum control heights, and responsive wrapping.

### Local And Private

The redesign must not expose session details, API keys, transcript contents, clipboard contents, or provider payloads beyond their existing intended UI surfaces.

## Visual System

### Palette

Use CSS custom properties with OKLCH values and semantic names. Exact values are finalized during visual design, but the roles are fixed:

| Token role         | Usage                                                 |
| ------------------ | ----------------------------------------------------- |
| `background`       | Main window background, near-neutral charcoal         |
| `surface`          | Dialogs, menus, and individual repeated history items |
| `surface-muted`    | Input backgrounds and subtle selected states          |
| `foreground`       | Primary text                                          |
| `muted-foreground` | Secondary metadata with WCAG-compliant contrast       |
| `border`           | Quiet structural separators                           |
| `primary`          | Blue primary actions and focus indication             |
| `success`          | Connected, loaded, and completed states               |
| `warning`          | Paused, attention, and recoverable conditions         |
| `destructive`      | Clear, remove, authentication loss, and errors        |

Do not use gradients, purple-blue washes, decorative glows, or a palette dominated by one hue family.

### Typography

- Use the native system UI stack for cross-platform rendering.
- Use a restrained scale: 12px metadata, 14px controls/body, 16px section titles, 20px window headings.
- Use 600 weight for headings and important state labels; avoid unnecessary bold body text.
- Letter spacing is `0`.
- Font sizes do not scale with viewport width.
- Hotkey values and model identifiers may use the system monospace stack where it improves recognition.

### Spacing And Shape

- Base spacing unit: 4px.
- Common gaps: 8px, 12px, 16px, and 24px.
- Control height: 36px compact, 40px default, 44px for primary recording actions.
- Radius: 6px for controls and 8px maximum for dialogs and repeated-item surfaces.
- Avoid cards inside cards. Use separators and unframed groups for page sections.
- Interactive icon buttons use stable square dimensions and always have accessible names and tooltips when their purpose is not universally obvious.

### Motion

- Use 120-180ms transitions for hover, focus, menu, and dialog state.
- Recording and processing indicators may animate without moving surrounding layout.
- Respect `prefers-reduced-motion` and disable non-essential animation.

## Component Architecture

Adopt only the shadcn components used by the application. Generated components live in the repository and may be adapted to the GPT-Voice tokens and Electron constraints.

| Need                                                             | shadcn/ui component                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Primary, secondary, destructive, and icon commands               | `Button`                                                        |
| Provider, language, model, locale, and timezone selection        | `Select` or `Native Select` where native behavior is preferable |
| Provider settings and hotkey capture                             | `Dialog`                                                        |
| Clear session, clear API key, discard changes, and clear history | `Alert Dialog`                                                  |
| GPU load/free and other option sets                              | `Dropdown Menu`                                                 |
| Section navigation in App Settings                               | vertical `Tabs`                                                 |
| Advanced generation and browser identity groups                  | `Collapsible`                                                   |
| Inputs and validation structure                                  | `Field`, `Label`, `Input`, `Textarea`                           |
| Temperature, Top P, Min P, and repeat penalty                    | `Slider`                                                        |
| Enable/disable translation, Prettify, and proxy behavior         | `Switch`                                                        |
| Connected, loaded, paused, and provider metadata                 | `Badge`                                                         |
| History viewport                                                 | `Scroll Area`                                                   |
| Initial and incremental loading                                  | `Skeleton` and `Spinner`                                        |
| Empty history and unavailable provider states                    | `Empty` and `Alert`                                             |
| Inline help for icon controls                                    | `Tooltip`                                                       |
| Local save/copy confirmations                                    | `Sonner`, limited to non-persistent feedback                    |
| Keyboard shortcut display in settings                            | `Kbd`                                                           |
| Structural grouping                                              | `Separator`                                                     |

Use Lucide icons from `lucide-react`. Do not add hand-written SVGs or text glyphs for controls when Lucide provides the icon.

## Screen Specifications

### 1. Main Window

Keep the current compact single-window format and native title bar.

#### Header

- Left: active transcription provider `Select` with connection-state `Badge`.
- Adjacent: provider settings icon button with tooltip and accessible label.
- Right: History and App Settings icon buttons that open the existing separate windows.
- Do not repeat the application name inside the content area when it is already present in the native title bar.

#### Prettify Model Memory

- Show only when Ollama is selected in Prettify settings and a model is configured.
- Present one compact unframed status row or individual panel with model name, known VRAM size, loaded state, and one mutually exclusive action.
- Use `Load VRAM` when unloaded or unknown, `Free VRAM` when loaded, and a disabled spinner state during the operation.
- Do not show this row for vLLM.

#### Recording Workspace

- Make recording the primary visual action.
- Idle: show a primary `Record` button with microphone icon and a compact status label.
- Recording: replace the primary command with `Stop`; expose Pause and Cancel as secondary icon commands.
- Paused: expose Resume, Stop, and Cancel.
- Stopping or transcribing: disable recording controls and show the processing icon and label without changing layout dimensions.
- Retrying: show processing state and keep a clear indication that stored audio is being resent.
- Prettifying: use the dedicated Prettify icon/state already supported by the app.
- All commands call the same existing recording lifecycle as the global shortcuts.

#### Translation

- Place target language in a compact footer row with a `Languages` icon and `Select`.
- Keep the control available in idle state and visually disabled only when the current lifecycle truly blocks changes.

#### Status And Errors

- Replace the oversized connected block with a compact badge and an `aria-live` status region.
- Persistent errors appear as an inline `Alert`; successful transient actions may use a toast.
- Do not show raw provider or runtime errors.

#### Window Constraints

- Default size may remain close to the current 460x420 window.
- The screen must fit at the current 400x360 minimum without horizontal scrolling or clipped controls.

### 2. Provider Settings Dialog

- Use a modal `Dialog` with a clear title, description, close command, focus trap, Escape dismissal, and focus return.
- Browser-session providers show a session-state badge, one primary Login/Re-login command, and a separate destructive Clear Session command.
- API-key providers show API key, model, language, prompt, and temperature using standard field components.
- Saved-secret hints must never reveal the secret value.
- Clear Session and Clear API Key require `Alert Dialog` confirmation.
- Save operations show an inline spinner and disable conflicting commands.
- Errors remain inside the dialog and are associated with the relevant field or form summary.
- Dialog width must not exceed the main window viewport minus 32px.

### 3. App Settings Window

Retain the separate settings window, but replace the single long form with section navigation.

#### Navigation

Use four sections:

1. Shortcuts and Actions
2. Prettify
3. Browser
4. Network

At widths of 640px and above, show a vertical icon-and-label tab rail. Below 640px, collapse labels to an icon rail with tooltips while keeping the content full-height and scrollable.

#### Shortcuts And Actions

- Show each shortcut as a compact row with action name, `Kbd` value, and Change command.
- Keep translation and Prettify enable switches in the same rows as their shortcut.
- Hotkey capture continues to use a modal dialog and must reject conflicts as it does today.

#### Prettify

- Keep provider, base URL, model, prompt, and temperature visible in the primary section.
- Use an icon Refresh button and a `Dropdown Menu` for Load VRAM/Free VRAM.
- The model dropdown displays model name and known VRAM size without truncating the selected model beyond recognition.
- Keep provider-specific fields conditional: Ollama and vLLM settings must not appear together.
- Put Top P, Top K, Min P, repeat penalty, max output tokens, and seed in an `Advanced generation` collapsible group.
- The advanced group summary indicates when values differ from defaults.

#### Browser

- Group humanization, preset, background mode, fingerprint seed, locale, and timezone.
- Put rarely changed fingerprint controls in a nested collapsible group, not in the first viewport.
- Preserve existing GeoIP rules that disable locale/timezone ownership when applicable.

#### Network

- Group proxy enablement, server, bypass, username, password, clear-password, and GeoIP behavior.
- Disabled proxy fields remain visible but disabled so users understand what enabling the proxy will reveal.
- SOCKS5 authentication warnings remain inline and human-readable.

#### Save Model

- Use a sticky footer with Save Changes and Close.
- Save Changes is enabled only when the form is dirty and valid.
- Field errors appear next to fields; save-level errors appear in an `Alert` above the footer.
- Closing with unsaved changes opens a discard confirmation.
- A successful save updates the main window immediately through existing typed events.

#### Window Constraints

- Recommended default size: 760x720.
- Preserve a 440x520 minimum with responsive navigation and no horizontal page scrolling.

### 4. History Window

#### Header

- Use a sticky toolbar with title, localized entry count, and destructive Clear History icon/text command.
- Clear History requires `Alert Dialog` confirmation.

#### Entry List

- Render entries newest first as a flat list separated by borders, not nested cards.
- Each entry shows localized date/time, provider name badge, transcript preview, and copy affordance.
- The transcript is a real button-like text surface with a copy icon, visible focus state, tooltip, and pointer cursor.
- Clicking the transcript copies the complete text through existing IPC and shows localized copied feedback.
- Long text wraps naturally and never forces horizontal scrolling.

#### Pagination And States

- Preserve limit/offset pagination and scroll-triggered loading.
- Initial load shows 5-8 stable skeleton rows.
- Incremental load shows a spinner at the list end without replacing existing entries.
- Empty history uses the `Empty` component with a concise message.
- Errors use an inline `Alert` with Retry.
- The end of a non-empty list shows a quiet localized end marker.
- The visible count must agree with loaded entries and total metadata.

#### Window Constraints

- Recommended default size: 760x720.
- Preserve the current 520x420 minimum without hiding metadata or copy controls.

## Shared Interaction States

Every command must define these states where applicable:

- Default
- Hover
- Focus-visible
- Active
- Disabled
- Loading
- Success
- Error

Loading state must disable duplicate submission while preserving control dimensions. Destructive actions use the destructive variant and confirmation. Success feedback must not overwrite persistent errors.

## Accessibility

- Target WCAG 2.2 AA for renderer UI.
- Normal text contrast is at least 4.5:1; large text and graphical control boundaries are at least 3:1.
- Every interaction is keyboard reachable in a logical order.
- Focus is always visible and never clipped by scroll containers.
- Dialogs trap focus, close with Escape where safe, and return focus to the trigger.
- Icon-only buttons have accessible labels; unfamiliar icons have tooltips.
- Status changes use polite `aria-live`; errors use appropriate alert semantics.
- Recording, processing, success, warning, and error states include text or icon differences in addition to color.
- Touch targets are at least 36x36px for compact desktop controls and 44px for primary recording actions.
- `prefers-reduced-motion` is respected.
- English, Russian, Ukrainian, and Belarusian labels are tested for wrapping and clipping.

## Tech Stack

Retain:

- Electron 43 main/preload/renderer isolation model
- React 19 and TypeScript strict mode
- Webpack 5
- Existing typed `window.electronAPI` IPC boundary
- Existing Node test runner
- Existing i18n system

Add for the redesigned renderer:

- Tailwind CSS 4 through PostCSS in the renderer build
- shadcn CLI/configuration for locally generated component code
- `class-variance-authority`, `clsx`, and `tailwind-merge`
- `lucide-react`
- `tw-animate-css` only where generated components require it
- Primitive packages required by the selected generated shadcn components

Configure shadcn with `rsc: false`, `tsx: true`, CSS variables enabled, a neutral base color, Lucide icons, and aliases that map into `src/renderer`.

Do not introduce Next.js, a second React root architecture, a second localization system, or renderer access to Node.js.

## Project Structure

Proposed renderer layout:

```text
src/renderer/
  components/
    ui/                    # Project-owned shadcn primitives
    app/                   # Shared GPT-Voice product components
  screens/
    MainWindow.tsx
    AppSettingsWindow.tsx
    HistoryWindow.tsx
  lib/
    cn.ts                  # clsx + tailwind-merge helper
    viewState/             # Pure display-state helpers
  styles/
    globals.css            # Tailwind import and design tokens
    electron.scss          # Only Electron-specific global/window rules if needed
  hooks/
  index.tsx
tests/renderer/
  components/              # Focused interaction/state tests where feasible
  viewState/               # Pure deterministic state tests
docs/specs/
  ui-redesign/
    spec.md
    tasks/
      plan.md
      todo.md
```

Migration may happen screen by screen, but the completed redesign must not leave two competing visual systems. Legacy selectors in `styles.scss` are removed once their final consumer is migrated.

## Code Style

Use typed, localized, accessible composition. Do not hardcode display text or duplicate primitive styling at call sites.

```tsx
<Button type="button" size="lg" disabled={!canStartRecording} onClick={() => void startRecording()}>
  <Mic aria-hidden="true" />
  {t('recording.start')}
</Button>
```

Additional rules:

- Keep shared primitives generic and product components domain-specific.
- Use `@renderer/*` and `@shared/*` aliases for cross-directory imports.
- Keep renderer access to desktop capabilities behind typed preload methods.
- Use variants for semantic component differences instead of repeated ad hoc class strings.
- Add comments only where Electron or accessibility behavior is non-obvious.

## Commands

```bash
# Build and run the Electron app
npm start

# Development bundle watcher
npm run dev

# Required quality checks
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run validate:dependabot
npm run audit:prod
npm run build:prod
```

Any shadcn generation command used during implementation must be version-pinned through the lockfile and documented in the implementation plan. Generated component diffs are reviewed like handwritten code.

## Testing Strategy

### Unit And State Tests

- Continue using `node:test` and `node:assert/strict`.
- Test pure view-state helpers for recording commands, provider status, model-memory actions, settings dirty state, and history pagination states.
- Keep i18n alignment tests for all new and changed labels.

### Renderer Interaction Tests

- Verify keyboard order, dialog focus behavior, Escape handling, destructive confirmation, loading disablement, and copy feedback.
- Prefer the existing test runner and existing Playwright Core dependency. Adding a DOM test environment or another runner requires explicit approval during planning.

### Visual And Desktop Verification

- Capture the main window at default and minimum size for idle, recording, processing, prettifying, error, and logged-out states.
- Capture App Settings at default and minimum size for every navigation section and provider variant.
- Capture History with populated, empty, loading, loading-more, error, copied, and end states.
- Capture provider settings for ChatGPT Web and OpenAI API.
- Verify Linux, Windows, and macOS title-bar/content spacing using native or CI-available platform checks.
- On Linux, verify the launcher and task switcher resolve the current app logo rather than a stale installed icon.
- Compare implementation screenshots with the approved visual direction at the same viewport before handoff.
- Run an English and Russian clipping pass; spot-check Ukrainian and Belarusian longest labels.

### Regression Requirements

- Existing IPC, settings normalization, provider, recording, history pagination, and localization tests remain green.
- No real provider credentials, browser profiles, API keys, transcripts, or private audio are used in tests.

## Boundaries

### Always Do

- Preserve context isolation, sandboxing, trusted IPC sender checks, and typed preload contracts.
- Localize all user-facing text in English, Russian, Ukrainian, and Belarusian.
- Preserve current functionality and data contracts unless the specification explicitly changes them.
- Use accessible names, focus-visible styling, keyboard interaction, and semantic states.
- Test at current minimum window dimensions and all supported platforms.
- Keep provider secrets, sessions, clipboard data, audio, and transcript text out of logs.
- Add only the shadcn components that are actually used.

### Ask First

- Add dependencies beyond the approved Tailwind/shadcn/Lucide component stack.
- Change Electron window topology, tray behavior, native title bars, or close-to-tray behavior.
- Add light mode, new providers, new settings, search/filtering, or history persistence changes.
- Replace the existing i18n system or test runner.
- Change current minimum window sizes.
- Introduce a broad visual-regression service or external design platform.

### Never Do

- Expose Node.js, Electron internals, raw `ipcRenderer`, or secrets to renderer components.
- Log or render raw stack traces, provider bodies, API keys, session data, clipboard contents, audio, or transcript text outside intended transcript views.
- Use hand-drawn SVGs, emoji, text glyphs, or CSS drawings as substitutes for available Lucide icons.
- Create nested cards, decorative gradients, glow orbs, oversized marketing sections, or viewport-scaled typography.
- Copy complete shadcn blocks without reviewing accessibility, dependencies, and Electron behavior.
- Remove existing tests to make the redesign pass.

## Success Criteria

The specification is implemented successfully when all of the following are true:

1. Main, Provider Settings, App Settings, and History use one shared token and component system.
2. The main window provides visible Record/Stop/Pause/Resume/Cancel controls that invoke the existing recording lifecycle.
3. History and App Settings are directly reachable from the main window and still available from the tray.
4. Provider connectivity and model-memory state are compact, unambiguous, and not presented as oversized actions.
5. App Settings has four navigable sections and a sticky save footer with dirty, validation, saving, success, and error states; native window controls provide closing.
6. History displays entries immediately when data exists, loads subsequent limit/offset pages on scroll, and exposes copy affordance without hover-only discovery.
7. Provider and destructive actions use correct modal, confirmation, loading, and error behavior.
8. No screen has horizontal scrolling, clipped text, overlapping controls, or layout shifts at the current minimum and default window sizes.
9. All controls are usable by keyboard with visible focus and correct dialog focus handling.
10. All normal text and control boundaries meet the specified contrast targets.
11. English, Russian, Ukrainian, and Belarusian translations fit without hiding commands or metadata.
12. Linux, Windows, and macOS packaging and Electron security settings remain functional, and Linux desktop surfaces use the current app-logo assets.
13. The full repository quality command set passes.
14. Final implementation screenshots have been compared against the approved visual direction at matching viewports.

## Out Of Scope

- Changes to transcription, translation, Prettify, or provider algorithms
- New transcription or Prettify providers
- History search, filtering, export, editing, or retention policy changes
- Light theme and user-selectable themes
- Custom title bars or frameless windows
- Tray-menu redesign and native system notification redesign
- Mobile or web deployment
- Changes to SQLite schema or IPC result shapes unless required solely to open existing windows from the main renderer

## Open Questions

No open questions block implementation. Command Dock, direct main-window navigation, dark-mode-only scope, and the graphite/blue token direction are approved. The responsive App Settings section rail remains an implementation decision for Task 17 and must preserve the existing minimum window size.
