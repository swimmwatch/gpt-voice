# Implementation Plan: GPT-Voice UI Redesign

## Overview

Implement the approved renderer redesign from `docs/specs/ui-redesign/spec.md` without changing transcription, provider, Prettify, history-storage, or desktop lifecycle behavior. The work introduces a local shadcn/Tailwind component system, migrates each user-facing screen as a complete slice, preserves Electron security boundaries, and removes the legacy monolithic visual system only after every screen is verified.

The plan is intentionally split into small S/M tasks. Each task changes no more than five likely files, leaves the application buildable, and has focused verification. The full redesign is expected to span several focused implementation sessions rather than one large edit.

## Planning Assumptions

The plan uses the recommendations from the specification as provisional approvals:

1. Neutral graphite dark theme with blue primary actions and distinct semantic colors.
2. Direct History and App Settings icon actions in the main window, in addition to tray access.
3. Wider default App Settings window with a responsive vertical section rail while preserving current minimum dimensions.
4. Dark mode only in this redesign.
5. Three visual concepts are reviewed and one is selected before renderer implementation begins.

If any assumption changes, update the specification and this plan before starting the affected task.

## Architecture Decisions

- Keep Electron, React 19, TypeScript strict mode, Webpack 5, the existing i18n system, and the typed preload boundary.
- Add Tailwind CSS 4 through PostCSS only to the renderer bundle. Main and preload build pipelines remain unchanged.
- Treat shadcn/ui as project-owned source under `src/renderer/components/ui`; do not add a runtime dependency on a prebuilt design system.
- Use CSS variables in `src/renderer/styles/globals.css` as the canonical design tokens. Home, App Settings, History, and About must inherit the same graphite palette; Command Dock variables may only alias shared tokens. Retain only Electron-specific global rules in `electron.scss` after migration.
- Open native windows immediately with the shared graphite startup shell and a cross-platform `progress` cursor. Remove the shell only after that route's initial localization and IPC-backed state is stable.
- Install all approved primitive dependencies in the toolchain task so later generated-component tasks do not repeatedly churn `package.json` and `package-lock.json`.
- Add shadcn primitives in small reviewed batches. Generated files are reviewed for accessibility, imports, and Electron compatibility like handwritten code.
- Reuse existing pure behavior helpers: recording lifecycle, provider state, Prettify model control, App Settings comparison/validation, and history pagination contracts.
- Add visible recording controls through the existing `useRecording` lifecycle. Do not create a parallel recording state machine.
- Reuse `showSettingsWindow()` and `showHistoryWindow()` in main; expose only narrow typed IPC commands to the renderer.
- Migrate one complete screen at a time. Keep legacy SCSS available only while an unmigrated screen still consumes it.
- Keep `node:test` as the test runner. Do not add a second runner or DOM environment without separate approval.
- Use runtime screenshots and keyboard walkthroughs for visual/accessibility verification, backed by pure state tests for deterministic display logic.

## Dependency Graph

```text
Approved visual concept
        |
        v
Tailwind/PostCSS/shadcn toolchain
        |
        v
Design tokens and renderer base styles
        |
        +----------------------+----------------------+
        |                      |                      |
        v                      v                      v
Core controls          Forms and overlays      Feedback/list primitives
        |                      |                      |
        +----------------------+----------------------+
                               |
                               v
                    Localized redesign copy
                               |
              +----------------+----------------+
              |                |                |
              v                v                v
       Main window       Provider dialog    History window
              |                |                |
              +----------------+----------------+
                               |
                               v
              App Settings behavior extraction
                               |
                               v
              App Settings shell and sections
                               |
                               v
              Unsaved-close and window geometry
                               |
                               v
                 Legacy CSS removal and final QA
```

## Delivery Strategy

The recommended review units are:

1. Design selection and renderer foundation.
2. Main window and provider settings.
3. History window.
4. App Settings extraction and redesign.
5. Legacy cleanup, cross-platform verification, and documentation.

These may be commits in one feature branch or stacked pull requests. Do not mix unrelated provider/runtime refactors into the redesign.

## Task List

### Phase 0: Visual Direction

- [x] Task 1: Select the visual direction

### Checkpoint: Visual Approval

- [x] Exactly three main-window concepts have been reviewed at the real default viewport.
- [x] Command Dock is selected and its token/layout decisions are recorded in the specification.
- [x] Human approval is recorded before toolchain or UI implementation begins.

### Phase 1: Renderer Foundation

- [x] Task 2: Integrate Tailwind and shadcn tooling
- [x] Task 3: Establish global design tokens and Electron base styles
- [x] Task 4: Add core action and status primitives

### Checkpoint: Foundation Build

- [x] `npm run typecheck` passes.
- [x] `npm run build:prod` emits all three renderer HTML entry points.
- [x] Existing screens still open and remain usable before migration.
- [x] Production dependency audit has no high-severity findings.

### Phase 2: Component Primitives

- [x] Task 5: Add form primitives
- [x] Task 6: Add overlay and navigation primitives
- [x] Task 7: Add feedback and scrolling primitives
- [x] Task 8: Add utility and notification primitives

### Checkpoint: Component System

- [x] Every added primitive imports through renderer aliases and compiles in Electron.
- [x] Keyboard/focus behavior is manually checked for Select, Dialog, Alert Dialog, Dropdown Menu, Tabs, and Tooltip.
- [x] No generated component exposes Node or Electron APIs.
- [x] Full tests and production build pass.

### Phase 3: Shared Contracts And Main Window

- [x] Task 9: Add localized redesign copy
- [x] Task 10: Expose typed main-window navigation commands
- [x] Task 11: Build the visible recording workspace
- [x] Task 12: Complete the main-window shell and secondary controls

### Checkpoint: Main Workflow

- [x] Provider selection/settings, History, and App Settings are reachable from the main window.
- [x] Record, Stop, Pause, Resume, and Cancel use the existing recording lifecycle.
- [x] Idle, recording, paused, stopping, transcribing, retrying, Prettify, login, error, and GPU states are visually stable.
- [x] Main window passes keyboard and screenshot checks at default and 400x360 minimum sizes.

### Phase 4: Supporting Windows

- [x] Task 13: Redesign provider settings
- [x] Task 14: Redesign transcription history

### Checkpoint: Supporting Workflows

- [x] ChatGPT Web and OpenAI API provider dialogs complete their existing workflows.
- [x] History populated, empty, loading, loading-more, error, copied, cleared, and end states are verified.
- [x] Provider and history destructive actions require confirmation.
- [x] Full tests and production build pass.

### Phase 5: App Settings

- [x] Task 15: Extract Shortcuts and Prettify sections
- [x] Task 16: Extract Browser and Network sections
- [x] Task 17: Build the responsive settings shell and save footer
- [x] Task 18: Redesign Shortcuts and Prettify controls
- [x] Task 19: Redesign Browser and Network controls
- [x] Task 20: Add unsaved-close handling and final window geometry

### Checkpoint: Settings Workflow

- [x] Existing validation, secret handling, model discovery, VRAM actions, hotkeys, browser settings, and proxy behavior remain intact.
- [x] Four settings sections are keyboard navigable at default and 440x520 minimum sizes.
- [x] Dirty, valid, invalid, saving, partial-save, success, error, and discard states are verified.
- [x] English, Russian, Ukrainian, and Belarusian labels do not clip or hide controls.

### Phase 6: Cleanup And Release Verification

- [x] Task 21: Remove legacy renderer styling and dead UI code
- [x] Task 22: Complete accessibility, visual, cross-platform, and documentation verification

### Phase 7: Command Dock Fidelity Correction

- [x] Task 23: Create a text-based Command Dock visual contract
- [x] Task 24: Reimplement the main window against the visual contract

### Checkpoint: Main-Window Fidelity

- [x] The supplied 1312x1199 image is represented as editable SVG geometry.
- [x] Exact 460x420 coordinates, colors, typography, and icon mappings are machine-readable.
- [x] The running Electron main window matches the SVG at the default content viewport.
- [ ] Human review accepts the corrected main-window screenshot.

### Checkpoint: Previous Implementation Verification

- [x] Every success criterion in `docs/specs/ui-redesign/spec.md` is checked against runtime evidence.
- [x] `npm run format:check` passes.
- [x] `npm run lint` has no errors introduced by the redesign.
- [x] `npm run typecheck` and `npm run test:types` pass.
- [x] `npm test` passes.
- [x] `npm run validate:dependabot` and `npm run audit:prod` pass.
- [x] `npm run build:prod` passes.
- [x] Default/minimum viewport screenshots and keyboard checks were completed for the previous implementation.
- [ ] Human review is complete before merge.

## Verification Policy

Each task must satisfy both its acceptance criteria in `docs/specs/ui-redesign/tasks/todo.md` and the repository Definition of Done. Focused tests run within the task; the full quality set runs at every checkpoint and after any shared primitive or contract change.

Visual work is not accepted from compilation alone. Each migrated screen must be launched in Electron, exercised with realistic non-sensitive fixture state, and inspected at both default and minimum dimensions. Screenshots must show the actual renderer state, not a static mock.

## Parallelization Opportunities

Safe after Task 8:

- Task 9 localization and Task 10 window-navigation IPC can run in parallel.
- After Task 12, Task 13 Provider Settings and Task 14 History can run in parallel because they use separate components and existing IPC contracts.
- After Tasks 15-17 establish section contracts, Task 18 and Task 19 can run in parallel if each agent owns separate section files and neither edits `AppSettingsWindow.tsx`.
- Documentation preparation can run alongside final visual verification after Task 21.

Must remain sequential:

- Tasks 2-8, because later primitives depend on the renderer toolchain and token layer.
- Tasks 15, 16, and 17, because they progressively establish App Settings ownership boundaries.
- Task 20 after Tasks 17-19, because native close behavior depends on the final dirty-state model.
- Task 21 after all screens are migrated, because legacy styles remain the rollback path until then.

## Risks And Mitigations

| Risk                                                                            | Impact | Mitigation                                                                                                                  |
| ------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Tailwind 4/PostCSS integration conflicts with the current Webpack SCSS pipeline | High   | Prove renderer-only integration in Task 2 and keep main/preload configs unchanged                                           |
| Generated shadcn dependencies increase renderer bundle size                     | Medium | Add only used primitives, inspect production bundle at each component checkpoint                                            |
| `AppSettingsWindow.tsx` behavior regresses during its 1,099-line migration      | High   | Extract sections without visual changes first, retain parent-owned state, run existing settings tests after each extraction |
| Direct recording buttons diverge from global shortcut behavior                  | High   | Route both through the same `useRecording` functions and shared lifecycle helpers                                           |
| Dialog portals or focus management behave differently in Electron               | Medium | Verify each overlay inside the real sandboxed renderer at minimum viewport size                                             |
| Native window close bypasses the renderer dirty-state prompt                    | High   | Add an explicit main-to-renderer close request/confirmation contract in Task 20                                             |
| Long localized labels overflow compact controls                                 | Medium | Use stable responsive tracks and perform English/Russian plus Ukrainian/Belarusian clipping passes                          |
| History list appears empty despite existing entries                             | High   | Preserve current pagination contract, add explicit list-state helpers, verify populated fixtures before visual approval     |
| Screen-by-screen migration leaves conflicting CSS                               | Medium | Namespace transitional rules and remove `styles.scss` only in Task 21 after all consumers are migrated                      |
| Cross-platform native title-bar spacing differs                                 | Medium | Preserve native frames and verify packaged or CI-available builds on Linux, Windows, and macOS                              |
| Redesign exposes sensitive data in test fixtures or screenshots                 | High   | Use synthetic providers, transcripts, secrets, and model names; inspect artifacts before sharing                            |

## Rollback Strategy

- Keep each screen migration in an independently revertible commit.
- Retain legacy SCSS until all screen checkpoints pass.
- Do not change persistence schemas or provider contracts, so rollback requires no data migration.
- Keep tray entry points and existing global shortcuts operational throughout the migration.
- If Tailwind integration proves incompatible, revert Tasks 2-8 before screen migration begins.

## Open Questions

No scope question blocks planning. Task 1 is complete: Command Dock is the approved visual direction and its token/layout decisions are recorded in the scoped specification.
