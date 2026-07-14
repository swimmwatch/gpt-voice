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
- Task 7 configured the allowlisted renderer-source boundary. Remotion resolves the canonical renderer aliases, applies the deterministic English video i18n adapter, compiles `globals.css` through the root PostCSS/Tailwind pipeline, and forces React/ReactDOM runtime imports to `media/video/node_modules`.
- The typed product import module now exposes the four approved direct components and pure state helpers. Its static graph test rejects privileged Electron/runtime, browser media, clipboard, timer, and network paths. A fresh debug still confirms the styled canonical `MainToolbar` renders at full composition resolution without Electron.
- Task 8 added `ProductUiFrame`: the native 460x420 Command Dock composes the four canonical components with typed inert callbacks, clipped video geometry, disabled pointer events/keyframes/transitions, and a frame-derived spinner rotation variable. Fresh idle, recording, processing, and saved-session modal stills render through Remotion.
- `ProviderSettingsModalView` now owns the shared, side-effect-free provider-settings markup. The Electron wrapper retains persistence, focus restoration, and `window.electronAPI` calls; Remotion imports the pure view under the Task 7 graph guard. A 250 ms Remotion render gate prevents first-bundle CSS capture before the canonical Tailwind styles settle; repeated idle stills have identical SHA-256 hashes.
- Task 9 added typed fixtures for every bridge, recording, processing, retry, translation, Prettify, and provider state. Fixture validation rejects unsupported providers/lifecycles, missing content identifiers, non-Russian translation targets, mismatched retry audio identities, and a retry path that includes a new recording state. `npm run test:ui` now runs product-frame, import-boundary, and fixture checks.
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

Next, complete Task 10: materialize approved synthetic content and narration references. The translation result remains review-required until a human-approved Russian version is provided.

## Blockers And External Gates

- There is no screen-capture blocker; screen capture is no longer part of the architecture.
- Stock downloads/purchases, hosted TTS, marketplace registration, and optional Remotion/Humanizer skill installation require separate authorization.
- GitHub uploads/releases, LinkedIn posting, pushes, and publication require separate authorization.
- A human-reviewed Russian translation is required before the translation scene can be finalized.
- Keep unrelated `design-qa.md` unmodified and uncommitted.
- The full root `npm test` suite currently has one unrelated landing-page failure: `tests/landing-page/localeGeneration.test.ts` cannot resolve `@landing/lib/utils`. Focused video checks, video/root typechecks, and the remaining 342 root tests pass.
