# Video Implementation Handoff

## Current Direction

The video will render the interface directly in Remotion using React. Screen recording, screenshots, captured Electron windows, OBS, X11, Xephyr, and prerecorded product footage are permanently superseded and are not blockers or implementation options.

The relevant current renderer components are the source of truth:

- `MainToolbar`
- `PrettifyModelMemoryRow`
- `RecordingControls`
- `TranslateSection`
- Shared pure `ProviderSettingsModalView`, consumed by the existing `ProviderSettingsModal` wrapper
- Their existing UI primitives, icons, flags, English labels, CSS tokens, and pure view-state helpers

Remotion must not import `App`, `useRecording`, Electron preload/runtime modules, or effectful `I18nProvider`, and it must never call `window.electronAPI`. The four safe Command Dock components resolve `useI18n` to a deterministic video adapter. Provider settings use a shared pure view extracted from the Electron wrapper. The bundle must force one video React runtime and compile canonical renderer CSS through the repository PostCSS/Tailwind pipeline. All product and prompt states come from typed frame-driven fixtures.

## Completed Work

- Tasks 1–3 approved the 60-second English prompt-first story, synthetic content, narrow claims, qualifications, README delivery, project-owned human voice, and external-action gates.
- Task 4 created the isolated `media/video/` project with strict TypeScript and exact Remotion `4.0.483` packages in its own lockfile.
- Task 5 registered `GptVoiceDemo` at 1920x1080, 60 fps, and 3600 frames with Zod-validated WebGL/fallback/debug props and ANGLE configuration.
- Task 6 centralized all eight scene boundaries, the poster range, and every audio cue. Timeline validation and six focused tests pass.
- The specification now requires a React-rendered interface, direct reuse/shared pure views for all relevant Command Dock components, deterministic fixtures, and no runtime Electron behavior.
- The implementation plan has been rebuilt from Task 7 onward. All old capture tasks, commands, directories, acceptance criteria, and blockers have been removed.
- The exact Remotion package installation list remains pinned to `4.0.483`; product-footage removal does not reduce plugin scope.

## Changed Files In This Planning Revision

- `docs/specs/readme-demo-video/spec.md`
- `docs/specs/readme-demo-video/tasks/plan.md`
- `docs/specs/readme-demo-video/tasks/todo.md`
- `docs/specs/readme-demo-video/tasks/handoff.md`

## Existing Checks

- `npm --prefix media/video run typecheck` passed for the completed foundation.
- Exact-version Remotion dependency inspection passed.
- WebGL and fallback bootstrap stills rendered successfully.
- Timeline geometry/runtime validation and six Node tests passed.
- No screen recording, screenshot, product footage, private media, stock download, upload, purchase, push, or publication is part of the current work.

## Next Step

After the revised specification and plan are accepted, complete Task 7: configure the allowlisted renderer-source import boundary and a static test that rejects Electron/runtime dependencies.

Then Task 8 must render the canonical `MainToolbar`, `PrettifyModelMemoryRow`, `RecordingControls`, and `TranslateSection`, plus the shared pure `ProviderSettingsModalView`, inside `ProductUiFrame` before any scene implementation continues.

## Blockers And External Gates

- There is no screen-capture blocker; screen capture is no longer part of the architecture.
- Stock downloads/purchases, hosted TTS, marketplace registration, and optional Remotion/Humanizer skill installation require separate authorization.
- GitHub uploads/releases, LinkedIn posting, pushes, and publication require separate authorization.
- A human-reviewed Russian translation is required before the translation scene can be finalized.
- Keep unrelated `design-qa.md` unmodified and uncommitted.
