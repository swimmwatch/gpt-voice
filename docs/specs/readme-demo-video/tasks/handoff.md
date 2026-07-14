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
- Task 10 centralized all visible problem/claim/prompt copy and scene narration references. Content tests reject release versions, LinkedIn/caption copy, and an unqualified provider scale claim. The translation object remains explicitly review-required with no Russian result; do not complete the translation scene or final render until a human-approved result is supplied.
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

Task 14 is blocked: it requires a human-approved Russian translation result. The translation fixture remains intentionally `reviewStatus: 'required'` with `result: null`; do not make up or render a Russian result.

Task 15 was safely implemented out of order because it uses the separately approved Prettify source/result pair. Tasks 16–33 remain blocked by the incomplete translation scene and their documented approval, asset, or publication gates.

## Latest Increment: Task 15 Complete

- Added the independent Prettify sequence for frames 2700–3119: selected rough prompt, F12, canonical `Prettifying selection...` fixture, and the approved meaning-preserving result.
- Added explicit `prettifyingSelection` and `prettifiedSelection` fixtures, validated by the existing UI-fixture suite.
- `ResultComparison` shows the rough and refined text together with `Clearer for the model`, `Meaning preserved`, and the precise removal categories: grammar, repetition, and filler.
- The scene test verifies cue boundaries and preserves the pull-request, security-issues, and top-three requirements across source and result.
- Verification passed: video typecheck; scene/UI/content tests; fallback stills at 2730, 2790, 2880, 2952, and 3040.
- Changed files: `media/video/src/scenes/PrettificationScene.tsx`, `media/video/src/scenes/PrettificationScene.test.ts`, `media/video/src/data/prettificationState.ts`, `media/video/src/data/uiFixtures.ts`, `media/video/src/product-ui/ResultComparison.tsx`, `media/video/src/GptVoiceDemo.tsx`, and `media/video/package.json`.

## Latest Increment: Task 13 Complete

- Added the retry sequence for frames 1740–2279: `Recognition failed`, the fixed stored-audio identity, `Ctrl+F8`, canonical `retrying`, and the matching clipboard result.
- `getRetryViewState()` has an explicit three-fixture path. Its test enumerates every relevant cue and proves no state is `recording`; it also proves failure, resend, and success use `spoken-prompt-01` as both stored and request audio.
- The comparison remains exactly limited to `Same-audio retry is not available in ChatGPT Web`. It makes no wider retry claim.
- The recovered-prompt state collapses the large stored-audio card into a concise same-audio confirmation so all visible content stays in the title-safe area.
- Verification passed: video typecheck; scene/UI tests; timeline validation; fallback stills at 1752, 1840, 1902, 1980, 2040, and 2200.
- Changed files: `media/video/src/scenes/RetryScene.tsx`, `media/video/src/scenes/RetryScene.test.ts`, `media/video/src/data/retryState.ts`, `media/video/src/product-ui/StoredAudioCard.tsx`, `media/video/src/GptVoiceDemo.tsx`, and `media/video/package.json`.

## Latest Increment: Task 12 Complete

- Added the canonical transcription sequence for frames 1140–1739: idle, F9/recording, F10/stopping, transcribing, clipboard success, and paste to a generic prompt destination.
- `getTranscriptionViewState()` is a pure, tested mapping to the existing deterministic product fixtures. The approved spoken sentence is not shown while recording; it appears only at the frame-1692 paste cue.
- `HotkeyChip` and `VideoCursor` are deterministic React primitives. The live-audio activity treatment is temporary; Task 20 must replace it with the exact local-sample-derived waveform.
- The frame-derived processing spinner uses a non-cardinal phase to avoid an ANGLE rasterization defect while retaining deterministic motion.
- Verification passed: video typecheck; scene/UI/content tests; fallback cue frames 1170, 1260, 1428, 1500, 1560, 1620, and 1692, each byte-identical on repeated render. Inspected recording, stopping, processing, copied, and pasted states.
- Changed files: `media/video/src/scenes/TranscriptionScene.tsx`, `media/video/src/scenes/TranscriptionScene.test.ts`, `media/video/src/data/transcriptionState.ts`, `media/video/src/GptVoiceDemo.tsx`, and `media/video/package.json`.

## Latest Increment: Task 11 Complete

- Added the generic `PromptWorkspace` and `PromptProblemMap`, driven directly by the approved four problem groups and sixteen labels. The opening contains no product component, product name, hotkey, or solution claim.
- Added `PromptProblemsScene` for frames 0–899 and `ProductBridgeScene` for frames 900–1139. The bridge mounts the canonical `ProductUiFrame` exactly at frame 900 and maps Transcribe, Retry, Translate, and Prettify to bounded user-controlled outcomes.
- Added a scene boundary test and wired it into `npm --prefix media/video run test:scenes`.
- Verification passed: video typecheck; scene/content tests; fallback stills at 60, 180, 360, 540, 720, 899, 900, and 1080. A repeated frame-720 render had the same SHA-256 hash.
- Changed files: `media/video/src/GptVoiceDemo.tsx`, `media/video/src/scenes/PromptProblemsScene.tsx`, `media/video/src/scenes/ProductBridgeScene.tsx`, `media/video/src/scenes/PromptProblemsScene.test.ts`, `media/video/src/product-ui/PromptWorkspace.tsx`, `media/video/src/product-ui/PromptProblemMap.tsx`, and `media/video/package.json`.

## Blockers And External Gates

- There is no screen-capture blocker; screen capture is no longer part of the architecture.
- Stock downloads/purchases, hosted TTS, marketplace registration, and optional Remotion/Humanizer skill installation require separate authorization.
- GitHub uploads/releases, LinkedIn posting, pushes, and publication require separate authorization.
- A human-reviewed Russian translation is required before the translation scene can be finalized.
- Keep unrelated `design-qa.md` unmodified and uncommitted.
- The full root `npm test` suite currently has one unrelated landing-page failure: `tests/landing-page/localeGeneration.test.ts` cannot resolve `@landing/lib/utils`. Focused video checks, video/root typechecks, and the remaining 342 root tests pass.
