# Implementation Plan: GPT-Voice README And LinkedIn Demo Video

## Overview

Produce one deterministic, English, prompt-first GPT-Voice demonstration entirely from React-rendered interfaces. The composition remains exactly 3600 frames at 1920x1080 and 60 fps. It demonstrates prompt-writing difficulty, transcription, same-audio retry, translation, Prettify, and the qualified ChatGPT Web provider benefit. The Electron application is never launched or recorded for picture; Remotion renders the canonical Command Dock components with typed fixtures.

Tasks 1–6 remain complete because the production contract, exact Remotion `4.0.483` package set, isolated project, composition schema, and timeline validators are still valid. The former capture phase is deleted. Task 7 now begins the React UI source boundary.

This document is planning only. Resume implementation after the revised specification and plan are accepted. Every increment must satisfy the repository Definition of Done in addition to its task-specific criteria.

## Scope And Authority

| Concern                               | Authority                                                                              | Planning treatment                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Story, claims, frames, and audio cues | `docs/specs/readme-demo-video/spec.md`                                                 | Treat frame ranges, narrow claims, qualifications, prompt-first order, and no-subtitle rule as fixed unless the specification changes first. |
| Product appearance                    | Current renderer components, English dictionary, view-state helpers, and `globals.css` | Reuse canonical React source; do not create a bitmap or independent Command Dock replica.                                                    |
| Rendered product state                | `media/video/src/data/uiFixtures.ts`                                                   | Pure typed fixtures only; no Electron, provider, browser, microphone, clipboard, network, timer, or random value.                            |
| Motion graphics                       | Nine exact version-aligned Remotion packages                                           | Use each only for its mapped purpose with ANGLE/WebGL and deterministic fallback.                                                            |
| Audio                                 | Approved narration/live sample and licensed stock/original audio                       | Use local 48 kHz stems, documented provenance, frame synchronization, approximately -14 LUFS-I, and true peak <= -1 dBTP.                    |
| Distribution                          | One master, README derivative/poster, and unpublished LinkedIn derivative              | Commit only approved README media; keep masters, reports, and LinkedIn output ignored.                                                       |
| External state                        | Skills, stock downloads/purchases, hosted services, GitHub/LinkedIn publishing, pushes | Stop for separate authorization.                                                                                                             |

## Architecture Decisions

1. Keep the Remotion dependency graph isolated under `media/video/` with its exact lockfile. Reusing root renderer source does not move video packages into the Electron runtime.
2. Directly render `MainToolbar`, `PrettifyModelMemoryRow`, `RecordingControls`, and `TranslateSection`. Extract a side-effect-free `ProviderSettingsModalView` that is shared by the Electron modal and Remotion. Reuse their existing UI primitives, CSS, icons, flags, and pure view-state helpers.
3. Do not import `App`, `useRecording`, Electron preload/runtime modules, or effectful `I18nProvider`. Alias `@renderer/hooks/useI18n` to a deterministic video-only hook backed by current English copy and use inert typed callbacks.
4. If any further direct reuse is blocked by Electron access, extract a side-effect-free sibling view and make the Electron wrapper consume it; never fork the visual markup.
5. Configure explicit Remotion/TypeScript aliases for allowed renderer source and test the import graph for forbidden runtime dependencies.
6. Put all visible state in typed fixtures. A state transition is a pure function of scene-local frame; retry validation explicitly rejects any second `recording` state.
7. Disable CSS keyframes/transitions inside the video UI. Spinner, cursor, focus, selection, typing, and modal/menu state are frame-driven.
8. Build and approve a complete no-effects React animatic before applying plugin treatments.
9. Keep product UI and critical copy in normal DOM layers above WebGL backgrounds/effects.
10. Keep voice-over, live sample, music, and SFX independently addressable until the mix is approved. Do not create caption data or subtitle output.
11. Use frame 3540 for a stable poster. README playback remains an accessible poster link to a local MP4.
12. The abandoned screen-capture attempt is historical only. No capture helper, directory, command, blocker, or acceptance criterion carries into implementation.

## Dependency Graph

```text
completed approval/content gates 1-3
  -> completed isolated Remotion foundation 4-6
  -> React product source boundary and deterministic fixtures 7-9
  -> approved content data and functional React scenes 10-18
  -> shared plugin primitives and mapped scene treatments 19-25
  -> final narration, licensed stock audio, and mix 26-28
  -> visual/product/master/distribution QA 29-31
  -> README integration and final handoff 32-33
```

## Phase 0: Completed Human, Claim, And License Gates

### Task 1: Approve the production contract

**Description:** Record the approved duration, audience, prompt-first story, claims, no-subtitle rule, README delivery, narration source, stock approach, and external-action boundaries.

**Acceptance criteria:**

- [ ] One English 1920x1080, 60 fps, 3600-frame video and the frame-accurate scene order are approved.
- [ ] README delivery, neutral-English human narration, stock approach, and 20 MB README target are recorded.
- [ ] Production approval is explicitly separate from publication, upload, purchase, skill installation, or push authorization.

**Verification:**

- [ ] Compare the decision record with the specification assumptions and boundaries.
- [ ] Confirm no external state changed during approval.

**Dependencies:** None.

**Likely files:** `docs/specs/readme-demo-video/spec.md`, `docs/specs/readme-demo-video/tasks/handoff.md`.

**Estimated scope:** S.

### Task 2: Complete the tooling and license preflight

**Description:** Lock exact Remotion versions, identify license obligations, and record authorization boundaries for stock assets and optional skills.

**Acceptance criteria:**

- [ ] Core/CLI and all nine approved Remotion packages are pinned to `4.0.483` with distribution eligibility recorded.
- [ ] Music, SFX, and font strategies are compatible with GitHub/LinkedIn distribution or explicitly blocked.
- [ ] Remotion/Humanizer skill installation, marketplace registration, hosted TTS, downloads, and purchases are not inferred.

**Verification:**

- [ ] Review `THIRD_PARTY_MEDIA.md` fields and exact package metadata.
- [ ] Confirm unresolved external actions remain stop conditions.

**Dependencies:** Task 1.

**Likely files:** `media/video/THIRD_PARTY_MEDIA.md`, `docs/specs/readme-demo-video/tasks/handoff.md`.

**Estimated scope:** S.

### Task 3: Lock synthetic content and claims

**Description:** Approve the spoken prompt, rough/Prettified pair, Russian target, translation-review method, retry comparison, and provider qualification.

**Acceptance criteria:**

- [ ] Synthetic content covers all four workflows and contains no personal or secret data.
- [ ] Retry is limited to same-audio resend; translation makes no universal quality promise; Prettify preserves required meaning.
- [ ] Every virtually-unlimited claim includes the full qualification and no release version appears.

**Verification:**

- [ ] Perform source/result semantic review.
- [ ] Search approved copy for broad guarantees, release numbers, captions, and unqualified `unlimited`.

**Dependencies:** Tasks 1–2.

**Likely files:** `docs/specs/readme-demo-video/spec.md`, `docs/specs/readme-demo-video/tasks/handoff.md`.

**Estimated scope:** S.

### Checkpoint A: Tasks 1–3

- [ ] Content, claims, licenses, and external-action gates are explicit.
- [ ] Local implementation is approved; publication and acquisition remain separately authorized.

## Phase 1: Completed Isolated Remotion Foundation

### Task 4: Scaffold the isolated video project

**Description:** Create the strict-TypeScript Remotion project and install the approved exact-version packages in its own lockfile.

**Acceptance criteria:**

- [ ] `media/video/` owns a private package manifest, exact lockfile, and strict TypeScript configuration.
- [ ] Remotion core/CLI and media, transitions, motion-blur, effects, light-leaks, noise, shapes, paths, and media-utils resolve to `4.0.483`.
- [ ] Root Electron manifests remain unchanged by video dependencies.

**Verification:**

- [ ] Run isolated install/typecheck and exact-version `npm ls`.
- [ ] Confirm the root dependency graph does not include video-only packages.

**Dependencies:** Checkpoint A.

**Likely files:** `media/video/package.json`, `media/video/package-lock.json`, `media/video/tsconfig.json`.

**Estimated scope:** M.

### Task 5: Register the deterministic composition boundary

**Description:** Configure ANGLE, register `GptVoiceDemo`, establish typed WebGL/fallback/debug props, and ignore generated render output.

**Acceptance criteria:**

- [ ] The production composition is exactly 1920x1080, 60 fps, and 3600 frames.
- [ ] `effectsMode` and `debugOverlays` are Zod-validated; WebGL and fallback frames render.
- [ ] Masters, reports, stills, and the LinkedIn derivative remain ignored; approved README media can be tracked.

**Verification:**

- [ ] Render one frame in both effect modes with debug overlays on/off.
- [ ] Confirm generated video output cannot enter Electron packaging.

**Dependencies:** Task 4.

**Likely files:** `media/video/remotion.config.ts`, `media/video/src/Root.tsx`, `media/video/src/GptVoiceDemo.tsx`, `media/video/src/index.ts`, `.gitignore`.

**Estimated scope:** M.

### Task 6: Define and validate timeline data

**Description:** Centralize scene ranges and audio cues and reject invalid duration, continuity, ownership, or poster ranges.

**Acceptance criteria:**

- [ ] Typed data contains all eight ranges, cue frames, 60 fps, 3600 total frames, and poster frame 3540.
- [ ] Validation rejects gaps, overlaps, invalid cues, non-positive duration, wrong final duration, and unstable poster range.
- [ ] Focused tests cover the invariants.

**Verification:**

- [ ] Run timeline validation/tests and isolated typecheck.
- [ ] Compare ranges/cues to the specification.

**Dependencies:** Task 5.

**Likely files:** `media/video/src/data/timeline.ts`, `media/video/src/data/audioCues.ts`, `media/video/src/validation/validateTimeline.ts`, `media/video/src/validation/validateTimeline.test.ts`.

**Estimated scope:** M.

### Checkpoint B: Tasks 4–6

- [ ] The isolated project installs, type-checks, and renders in both effects modes.
- [ ] Timeline validation proves the exact 3600-frame contract.

## Phase 2: React Product UI Boundary

### Task 7: Configure the canonical renderer import boundary

**Description:** Allow Remotion to import only the approved renderer components, styles, flags, English copy, shared types, and pure view-state helpers. Substitute the Electron-backed i18n hook with a deterministic video adapter and statically reject privileged runtime dependencies.

**Acceptance criteria:**

- [ ] TypeScript/Remotion resolve approved root sources, substitute only the pure video i18n adapter, and force every root/Radix/Lucide import onto one `media/video` React/ReactDOM runtime.
- [ ] The Remotion webpack override compiles canonical `globals.css` through the repository PostCSS/Tailwind pipeline from a clean root plus video install; no copied CSS snapshot exists.
- [ ] A typed product module exposes the four direct components/view-state helpers and a provider-view slot, while a focused graph test rejects Electron, preload, IPC, `App`, `useRecording`, effectful `I18nProvider`, `window.electronAPI`, microphone/clipboard, and provider/network actions.

**Verification:**

- [ ] Run clean root/video installs, typechecks, dependency/React-singleton inspection, and the import-boundary test.
- [ ] Bundle a minimal still and verify computed canonical Command Dock styles without starting Electron, reaching `window.electronAPI`, or using the network.

**Dependencies:** Checkpoint B.

**Likely files:** `media/video/remotion.config.ts`, `media/video/tsconfig.json`, `media/video/src/product-ui/productImports.ts`, `media/video/src/product-ui/videoI18n.ts`, `media/video/src/validation/validateProductImports.test.ts`.

**Estimated scope:** M.

### Task 8: Build the reused Command Dock render frame

**Description:** Compose the four directly reusable components and a shared pure provider-settings view inside a scaled, clipped, deterministic `ProductUiFrame` using canonical CSS and inert typed callbacks.

**Acceptance criteria:**

- [ ] `MainToolbar`, `PrettifyModelMemoryRow`, `RecordingControls`, and `TranslateSection` render directly from canonical source; `ProviderSettingsModalView` is extracted once, consumed by both Electron and Remotion, exported by the typed product module, and accepted by the forbidden-import test.
- [ ] Native 460x420 geometry, canonical colors/type/icons/flags, and required `data-slot` markers are preserved at video scale.
- [ ] Pointer events and CSS keyframes/transitions are disabled; spinner rotation is controlled by a frame-derived variable.

**Verification:**

- [ ] Render full-resolution idle, recording, processing, and provider-modal stills.
- [ ] Inspect DOM slots/labels and pixel stability across two renders of the same frame.

**Dependencies:** Task 7.

**Likely files:** `src/renderer/components/ProviderSettingsModal.tsx`, `src/renderer/components/ProviderSettingsModalView.tsx`, `media/video/src/product-ui/ProductUiFrame.tsx`, `media/video/src/product-ui/product-ui.css`, `media/video/src/product-ui/ProductUiFrame.test.tsx`.

**Estimated scope:** M.

### Task 9: Define and validate deterministic UI fixtures

**Description:** Model every product/prompt state and legal transition as typed data, with explicit same-audio identity across transcription and retry.

**Acceptance criteria:**

- [ ] Fixtures cover bridge, recording, stopping, transcribing, copied, failed, retrying, translated, Prettified, ChatGPT session saved, and OpenAI API states.
- [ ] Validation rejects unknown providers/statuses, missing content, non-Russian translation target, mismatched retry audio/result IDs, or a retry path containing `recording`.
- [ ] `test:ui` runs fixture, import-boundary, DOM-slot, and deterministic callback checks.

**Verification:**

- [ ] Run positive and negative fixture tests plus root/video typechecks.
- [ ] Generate a concise state-transition summary and compare it with the storyboard.

**Dependencies:** Task 8.

**Likely files:** `media/video/package.json`, `media/video/src/data/uiFixtures.ts`, `media/video/src/validation/validateUiFixtures.ts`, `media/video/src/validation/validateUiFixtures.test.ts`.

**Estimated scope:** M.

### Checkpoint C: Tasks 7–9

- [ ] All relevant Command Dock React components render without Electron or runtime side effects.
- [ ] Product styles and state transitions are canonical, typed, deterministic, and pixel-stable.

## Phase 3: Functional React Animatic

### Task 10: Materialize approved content and narration references

**Description:** Convert the locked prompt, translation placeholder/review gate, Prettify pair, claims, labels, and voice-over windows into typed local data.

**Acceptance criteria:**

- [ ] All visible prompt/problem/claim copy is centralized and matches the specification.
- [ ] Translation remains marked as review-required until a human-approved Russian result is inserted.
- [ ] Content validation rejects prohibited claims, release numbers, caption structures, missing qualifications, or source/result semantic identifiers that do not match.

**Verification:**

- [ ] Run content/type checks and a prohibited-copy search.
- [ ] Human-review the final synthetic text and narration windows.

**Dependencies:** Checkpoint C and Task 3.

**Likely files:** `media/video/src/data/content.ts`, `media/video/src/data/script.ts`, `media/video/src/validation/validateContent.test.ts`.

**Estimated scope:** M.

### Task 11: Build the prompt-problem and product-bridge scenes

**Description:** Render the first 19 seconds as a generic React prompt workspace followed by the first appearance of the reused Command Dock.

**Acceptance criteria:**

- [ ] Frames 0–899 show the four groups and sixteen issue labels with no GPT-Voice UI/name/action.
- [ ] Frame 900 is the first product appearance and renders the canonical Command Dock inside `ProductUiFrame`.
- [ ] The bridge maps Transcribe, Retry, Translate, and Prettify to the problem without implying that the app invents intent or facts.

**Verification:**

- [ ] Render frames 60, 180, 360, 540, 720, 899, 900, and 1080.
- [ ] Review frames 0–1139 muted for completeness, title safety, and first-product timing.

**Dependencies:** Task 10.

**Likely files:** `media/video/src/scenes/PromptProblemsScene.tsx`, `media/video/src/scenes/ProductBridgeScene.tsx`, `media/video/src/product-ui/PromptWorkspace.tsx`, `media/video/src/product-ui/PromptProblemMap.tsx`.

**Estimated scope:** M.

### Task 12: Build the transcription scene

**Description:** Render the canonical recording lifecycle, synchronized sample cue, frame-driven cursor/hotkeys, and deterministic prompt paste.

**Acceptance criteria:**

- [ ] F9, Recording, F10, Stopping, Transcribing, Copied, and paste appear in their specified frame windows.
- [ ] `RecordingControls` supplies the product state; processing rotation is frame-derived and stable.
- [ ] The pasted prompt exactly matches the approved spoken sample and no visual transcript acts as subtitles.

**Verification:**

- [ ] Render frames 1170, 1260, 1428, 1500, 1560, 1620, and 1692 twice and compare.
- [ ] Watch frames 1140–1739 muted and at half speed; validate fixture transitions.

**Dependencies:** Task 11.

**Likely files:** `media/video/src/scenes/TranscriptionScene.tsx`, `media/video/src/product-ui/HotkeyChip.tsx`, `media/video/src/product-ui/VideoCursor.tsx`, `media/video/src/scenes/TranscriptionScene.test.tsx`.

**Estimated scope:** M.

### Checkpoint D: Tasks 10–12

- [ ] The first 29 seconds explain the prompt problem and demonstrate transcription using only React-rendered UI.
- [ ] Content, product appearance, timing, and repeated-frame determinism are approved before recovery work.

### Task 13: Build the same-audio retry scene

**Description:** Render failure, stored audio, Ctrl+F8 resend, retrying state, and identical success without a second recording.

**Acceptance criteria:**

- [ ] Failure and `Stored audio` visibly preserve the previous audio identity.
- [ ] Ctrl+F8 and `Resending transcription...` use the actual retry lifecycle mapping and return the identical prompt result.
- [ ] No frame in the retry scene has `recording`; the ChatGPT comparison remains limited to same-audio retry.

**Verification:**

- [ ] Render frames 1752, 1840, 1902, 1980, 2040, and 2200.
- [ ] Run a frame-state enumeration proving no second recording and matching audio/result IDs.

**Dependencies:** Task 12.

**Likely files:** `media/video/src/scenes/RetryScene.tsx`, `media/video/src/product-ui/StoredAudioCard.tsx`, `media/video/src/scenes/RetryScene.test.tsx`.

**Estimated scope:** M.

### Task 14: Build the translation scene

**Description:** Render selected English prompt text, Russian target, F11 processing, copied state, and human-reviewed Russian result without another tool.

**Acceptance criteria:**

- [ ] The reused `TranslateSection` shows Russian before F11.
- [ ] F11, `Translating selection...`, `Translation copied`, and result paste occur in their frame windows.
- [ ] Source/result labels communicate model/task language choice and avoid a universal “best language” guarantee.

**Verification:**

- [ ] Render frames 2300, 2342, 2430, 2502, 2580, and 2660.
- [ ] Human-review the Russian result and watch the scene muted.

**Dependencies:** Task 13 and the completed translation review gate in Task 10.

**Likely files:** `media/video/src/scenes/TranslationScene.tsx`, `media/video/src/product-ui/ResultComparison.tsx`, `media/video/src/scenes/TranslationScene.test.tsx`.

**Estimated scope:** M.

### Task 15: Build the Prettify scene

**Description:** Render selection, F12 processing, and a token-level rough/clean transformation that preserves the security-review instruction.

**Acceptance criteria:**

- [ ] F12, `Prettifying selection...`, and `Selection prettified` occur at specified frames.
- [ ] The result removes grammar noise, repetition, and filler while retaining pull-request security review and top-three output.
- [ ] `Meaning preserved` and `Clearer for the model` are visible; the configured Prettify model row remains canonical and stable.

**Verification:**

- [ ] Render frames 2730, 2790, 2880, 2952, and 3040.
- [ ] Run a clause/token preservation test and muted review.

**Dependencies:** Task 14.

**Likely files:** `media/video/src/scenes/PrettificationScene.tsx`, `media/video/src/scenes/PrettificationScene.test.tsx`.

**Estimated scope:** M.

### Checkpoint E: Tasks 13–15

- [ ] Retry, translation, and Prettify form a factual prompt-recovery/refinement sequence.
- [ ] Every workflow uses canonical product React state and remains understandable without audio.

### Task 16: Build the provider proof scene

**Description:** Render canonical ChatGPT Web/OpenAI API toolbar states, the saved-session modal, and the fixed qualified subscription benefit.

**Acceptance criteria:**

- [ ] `MainToolbar` shows ChatGPT Web connected and OpenAI API as the alternate provider in deterministic states.
- [ ] The shared `ProviderSettingsModalView` shows only synthetic `Session status: Saved`; no key/session content exists.
- [ ] The full qualification is untruncated and visible for frames 3120–3419.

**Verification:**

- [ ] Render frames 3120, 3150, 3240, 3330, and 3419 in both effects modes.
- [ ] Run a 300-frame qualification presence/contrast check and product label comparison.

**Dependencies:** Checkpoint E.

**Likely files:** `media/video/src/scenes/ProvidersScene.tsx`, `media/video/src/product-ui/SafeClaim.tsx`, `media/video/src/scenes/ProvidersScene.test.tsx`.

**Estimated scope:** M.

### Task 17: Build the CTA and stable poster scene

**Description:** Resolve the four workflows into one prompt-first outcome and create a pixel-stable final hold.

**Acceptance criteria:**

- [ ] CTA contains Speak, Retry, Translate, Refine, Better prompts, Less effort, and GPT-Voice on GitHub.
- [ ] No release or LinkedIn post text appears.
- [ ] Frames 3540–3599 are visually identical and frame 3540 is sharp at README size.

**Verification:**

- [ ] Render frames 3420, 3480, 3540, 3570, and 3599; pixel-compare the stable interval.
- [ ] Inspect the poster at 960 px display width.

**Dependencies:** Task 16.

**Likely files:** `media/video/src/scenes/CtaScene.tsx`, `media/video/src/scenes/CtaScene.test.tsx`.

**Estimated scope:** S.

### Task 18: Assemble and approve the no-effects React animatic

**Description:** Connect all eight functional scenes, UI fixtures, rough narration reference, safe areas, and debug layers before plugin styling.

**Acceptance criteria:**

- [ ] The animatic renders exactly 3600 frames with all scene/state boundaries and no missing or duplicated product state.
- [ ] Spoken actions are within six frames of visible actions and no narration overlaps the live sample.
- [ ] Muted, audio-only, normal-speed, and half-speed reviews preserve the story and action order.

**Verification:**

- [ ] Render one start/mid/end still per scene and a quarter-scale full animatic in fallback placeholder mode.
- [ ] Run timeline, content, UI-fixture, import-boundary, type, and stable-frame tests; record human approval.

**Dependencies:** Tasks 11–17.

**Likely files:** `media/video/src/GptVoiceDemo.tsx`, `media/video/src/components/DebugOverlay.tsx`, `media/video/src/data/timeline.ts`, `media/video/src/data/audioCues.ts`.

**Estimated scope:** M.

### Checkpoint F: Tasks 16–18

- [ ] The complete no-effects React animatic is factually, visually, and temporally approved.
- [ ] Plugin work may decorate but cannot change approved product state, copy, or timing.

## Phase 4: Remotion Plugin Layer

### Task 19: Implement deterministic background effects

**Description:** Build the shared WebGL/fallback gradient, glow, and fixed-seed texture layer.

**Acceptance criteria:**

- [ ] `@remotion/effects` and `@remotion/noise` produce bounded deterministic backgrounds.
- [ ] Fallback preserves palette, geometry, timing, and contrast without WebGL.
- [ ] Effects remain behind product UI, prompts, results, and qualifications.

**Verification:**

- [ ] Render matched WebGL/fallback stills in opening, retry, provider, and CTA scenes.
- [ ] Re-render identical frames and reject black, transparent, shifted, or nondeterministic output.

**Dependencies:** Checkpoint F.

**Likely files:** `media/video/src/visuals/AnimatedBackground.tsx`, `media/video/src/visuals/AnimatedBackground.test.tsx`, `media/video/src/data/visualSeeds.ts`.

**Estimated scope:** M.

### Task 20: Implement the audio-derived waveform

**Description:** Build a reusable waveform from the exact local live-sample WAV with a deterministic static stored-audio form.

**Acceptance criteria:**

- [ ] `@remotion/media-utils` drives the live waveform from the same WAV heard in the mix.
- [ ] Retry uses the identical waveform data frozen as stored audio; no second live input is generated.
- [ ] Missing/short audio falls back safely without changing layout or timing.

**Verification:**

- [ ] Render recording and retry cue frames and compare waveform identity.
- [ ] Run focused tests for normal, missing, silent, and short audio fixtures.

**Dependencies:** Task 19 and authorization/availability of the local project-owned live sample.

**Likely files:** `media/video/src/visuals/AudioWaveform.tsx`, `media/video/src/visuals/AudioWaveform.test.tsx`.

**Estimated scope:** M.

### Task 21: Implement path and shape primitives

**Description:** Build reusable directed connectors, action nodes, rings, and problem markers.

**Acceptance criteria:**

- [ ] `@remotion/paths` and `@remotion/shapes` create clamped, semantically directed flow geometry.
- [ ] No path has more than two moving dots; geometry remains title-safe and subordinate to UI.
- [ ] CSS/SVG fallback preserves endpoints and meaning.

**Verification:**

- [ ] Render opening, bridge, retry, translation, Prettify, and CTA path states.
- [ ] Test progress bounds, endpoint identity, and fallback geometry.

**Dependencies:** Task 19.

**Likely files:** `media/video/src/visuals/FlowPath.tsx`, `media/video/src/visuals/FlowPath.test.tsx`, `media/video/src/visuals/WorkflowNode.tsx`.

**Estimated scope:** M.

### Checkpoint G: Tasks 19–21

- [ ] Background, waveform, path, and shape primitives are deterministic and readable in both modes.
- [ ] Retry visibly reuses the original waveform identity.

### Task 22: Implement transitions, light leaks, and bounded motion accents

**Description:** Standardize scene transitions, exactly three light leaks, and motion trails on non-critical accents.

**Acceptance criteria:**

- [ ] `@remotion/transitions`, `@remotion/light-leaks`, and `@remotion/motion-blur` obey duration, count, opacity, and target limits.
- [ ] Light leaks occur only at product reveal, retry success, and provider-to-CTA.
- [ ] Product UI, prompt/results, statuses, and qualifications are never blurred or obscured.

**Verification:**

- [ ] Inspect every tenth frame through every transition in WebGL/fallback modes.
- [ ] Test allowed light-leak frames/count and motion-blur target allowlist.

**Dependencies:** Checkpoint G.

**Likely files:** `media/video/src/visuals/SceneTransition.tsx`, `media/video/src/visuals/MotionAccent.tsx`, `media/video/src/visuals/SceneTransition.test.tsx`, `media/video/src/data/timeline.ts`.

**Estimated scope:** M.

### Task 23: Apply the plugin map to opening, bridge, transcription, and retry

**Description:** Integrate approved plugin primitives into the first four scenes without changing functional states or copy.

**Acceptance criteria:**

- [ ] Each scene uses only its mapped packages and maintains UI/title-safe contrast.
- [ ] Product reveal, live waveform, stored-audio path, and retry success read clearly at normal and half speed.
- [ ] Functional cue frames remain pixel-identical in UI geometry to the approved animatic.

**Verification:**

- [ ] Render all specified cue/still frames in WebGL/fallback and overlay UI bounding boxes against animatic baselines.
- [ ] Watch frames 0–2279 muted and at normal speed.

**Dependencies:** Task 22.

**Likely files:** `media/video/src/scenes/PromptProblemsScene.tsx`, `media/video/src/scenes/ProductBridgeScene.tsx`, `media/video/src/scenes/TranscriptionScene.tsx`, `media/video/src/scenes/RetryScene.tsx`.

**Estimated scope:** M.

### Task 24: Apply the plugin map to translation, Prettify, providers, and CTA

**Description:** Integrate directional flows, cleanup shapes, provider background treatment, and final resolve into the last four scenes.

**Acceptance criteria:**

- [ ] Translation direction, Prettify removal/preservation, provider proof, and CTA resolution remain semantically clear.
- [ ] Qualification is untouched by effects for every provider frame.
- [ ] Stable poster frames remain pixel-identical.

**Verification:**

- [ ] Render all specified cue/still frames in both modes and compare UI/claim geometry with animatic baselines.
- [ ] Watch frames 2280–3599 muted and at normal speed.

**Dependencies:** Task 22.

**Likely files:** `media/video/src/scenes/TranslationScene.tsx`, `media/video/src/scenes/PrettificationScene.tsx`, `media/video/src/scenes/ProvidersScene.tsx`, `media/video/src/scenes/CtaScene.tsx`.

**Estimated scope:** M.

### Task 25: Pass the plugin compliance gate

**Description:** Prove exact version alignment, use of all selected packages, scene-map compliance, deterministic fallback, and license eligibility.

**Acceptance criteria:**

- [ ] All nine selected packages resolve to `4.0.483` and are used only in mapped components/scenes.
- [ ] No unapproved visual/media dependency, caption package, remote asset, or product-video input exists.
- [ ] License ledger and WebGL/fallback comparison are complete.

**Verification:**

- [ ] Run exact `npm ls`, static plugin-usage validation, clean offline render, and license review.
- [ ] Search source/manifests for unselected animation, screenshot, footage, caption, and remote-asset paths.

**Dependencies:** Tasks 23–24.

**Likely files:** `media/video/src/validation/validatePluginUsage.ts`, `media/video/src/validation/validatePluginUsage.test.ts`, `media/video/THIRD_PARTY_MEDIA.md`.

**Estimated scope:** M.

### Checkpoint H: Tasks 22–25

- [ ] Every selected plugin has an approved, deterministic, version-aligned implementation.
- [ ] Plugin styling preserves canonical React UI and approved story in both render modes.

## Phase 5: Voice, Stock Audio, And Mix

### Task 26: Produce and synchronize final voice-over

**Description:** Record project-owned neutral-English narration/live sample, apply the approved prose review, and align each line to frame windows.

**Acceptance criteria:**

- [ ] 48 kHz/24-bit mono sources are clean, natural, project-owned, and match approved copy.
- [ ] Spoken actions align within six frames; no narration overlaps the live sample.
- [ ] Humanizer, if authorized/available, changes rhythm only and a human read-aloud approves the result.

**Verification:**

- [ ] Review raw/processed stems, script diff, audio-only timeline, and picture synchronization.
- [ ] Reject clipped, synthetic-sounding, rushed, or claim-altering takes.

**Dependencies:** Checkpoint H and the optional skill decision from Task 2.

**Likely files:** `media/video/public/audio/voiceover/`, `media/video/src/data/script.ts`, `media/video/THIRD_PARTY_MEDIA.md`.

**Estimated scope:** M.

### Task 27: Acquire and prepare licensed music and SFX

**Description:** After authorization, select one stock music track and the required licensed/original effects, normalize them to local 48 kHz stems, and complete provenance.

**Acceptance criteria:**

- [ ] Every asset has source, creator, license, acquisition date, attribution, and GitHub/LinkedIn eligibility recorded.
- [ ] Music and SFX fit the specified character and do not mimic protected brand/system sounds.
- [ ] Only redistributable final stems enter the repository; receipts/non-redistributable originals stay outside.

**Verification:**

- [ ] Human-review the license ledger and audition all stems on headphones/laptop speakers.
- [ ] Confirm no asset was acquired before required authorization.

**Dependencies:** Tasks 2 and 25; explicit authorization for external acquisition.

**Likely files:** `media/video/public/audio/music/`, `media/video/public/audio/sfx/`, `media/video/THIRD_PARTY_MEDIA.md`.

**Estimated scope:** M.

### Task 28: Integrate and approve the final mix

**Description:** Add frame-driven audio envelopes, music ducking, SFX cues, and final loudness/peak control.

**Acceptance criteria:**

- [ ] Every cue matches `audioCues.ts`; voice/live sample/music/SFX remain separately controllable.
- [ ] Mix measures approximately -14 LUFS-I, true peak <= -1 dBTP, and reaches silence at the end.
- [ ] Speech remains intelligible on laptop speakers and headphones; no subtitle stream exists.

**Verification:**

- [ ] Run audio cue tests, full listen, EBU R128 analysis, peak check, and subtitle-stream check.
- [ ] Review picture/audio at normal and half speed.

**Dependencies:** Tasks 26–27.

**Likely files:** `media/video/src/components/AudioLayer.tsx`, `media/video/src/data/audioCues.ts`, `media/video/src/validation/validateAudioMix.ts`, `media/video/src/validation/validateAudioMix.test.ts`.

**Estimated scope:** M.

### Checkpoint I: Tasks 26–28

- [ ] Voice, live sample, music, and effects are owned/licensed, synchronized, intelligible, and within mix targets.
- [ ] No caption source/output exists.

## Phase 6: Visual QA, Masters, And Distribution Files

### Task 29: Complete frame-accurate product and visual QA

**Description:** Review all required frames, product component parity, UI state, claims, safe areas, deterministic renders, and WebGL/fallback behavior.

**Acceptance criteria:**

- [ ] Required direct/shared component, label, data-slot, color, and geometry parity checks pass against current source.
- [ ] Repeated stills are pixel-stable; fallback preserves content/layout/timing.
- [ ] No raster product UI, screen recording, screenshot, private data, release copy, caption, clipping, or unreadable qualification exists.

**Verification:**

- [ ] Render and inspect the full specification still list plus every tenth frame through transitions.
- [ ] Run complete root/video focused checks and muted/audio-only/normal/half-speed human reviews.

**Dependencies:** Checkpoint I.

**Likely files:** `media/video/out/stills/`, `media/video/out/reports/`, `docs/specs/readme-demo-video/tasks/handoff.md`.

**Estimated scope:** M.

### Task 30: Render and approve master variants

**Description:** Render WebGL and fallback masters, compare them, and select the final 1080p/60 source.

**Acceptance criteria:**

- [ ] Both masters are exactly 3600 frames, <=60 seconds, 1920x1080, 60 fps, H.264/AAC, and contain audio/no subtitles.
- [ ] WebGL has no black/missing/corrupt frames; fallback changes decoration only.
- [ ] Selected master passes claim, product, privacy, audio, and license gates.

**Verification:**

- [ ] Run FFprobe, frame count, loudness/peak, subtitle, black-frame, and sampled-frame comparisons.
- [ ] Record human master approval before derivatives.

**Dependencies:** Task 29.

**Likely files:** `media/video/out/gpt-voice-demo-master.mp4`, `media/video/out/gpt-voice-demo-fallback.mp4`, `media/video/out/reports/`.

**Estimated scope:** M.

### Task 31: Create and verify distribution derivatives

**Description:** Encode the 1280x720 README MP4, full-resolution LinkedIn file, and stable poster from the approved master.

**Acceptance criteria:**

- [ ] README MP4 is 1280x720, 60 fps, fast-start, readable, and targets <=20 MB.
- [ ] LinkedIn derivative is 1920x1080, 60 fps, H.264/AAC, and remains unpublished.
- [ ] Poster comes from frame 3540 and matches the approved stable CTA interval.

**Verification:**

- [ ] Run FFprobe/file-size checks and inspect desktop/mobile playback from a local server.
- [ ] Compare derivative UI/qualification legibility with the master.

**Dependencies:** Task 30 and human master approval.

**Likely files:** `assets/demo/gpt-voice-demo.mp4`, `assets/demo/gpt-voice-demo-poster.png`, `media/video/out/gpt-voice-linkedin.mp4`, `media/video/out/reports/`.

**Estimated scope:** M.

### Checkpoint J: Tasks 29–31

- [ ] Master, fallback, README derivative, poster, and unpublished LinkedIn derivative pass all technical/content checks.
- [ ] Human approval authorizes README integration, not external publication.

## Phase 7: README Integration And Handoff

### Task 32: Integrate the accessible README demo block

**Description:** Add the approved poster-linked video near the README introduction and verify relative paths and accessible text.

**Acceptance criteria:**

- [ ] Poster link appears after badges and before `Why GPT-Voice?` with approved alt text and visible label.
- [ ] Activating the poster opens the local MP4 in GitHub-compatible rendering.
- [ ] Only README MP4/poster are tracked; masters/reports/LinkedIn output remain ignored.

**Verification:**

- [ ] Preview GitHub-compatible Markdown, activate the link, and test paths from a clean checkout.
- [ ] Run Markdown formatting, `git diff --check`, and tracked/ignored media review.

**Dependencies:** Checkpoint J.

**Likely files:** `README.md`, `assets/demo/gpt-voice-demo.mp4`, `assets/demo/gpt-voice-demo-poster.png`.

**Estimated scope:** S.

### Task 33: Complete final approval and local handoff

**Description:** Re-run the final scoped checks, record outputs/provenance, close the task list, and hand the unpublished files to the user without pushing or publishing.

**Acceptance criteria:**

- [ ] Specification success criteria, Definition of Done, task checklist, license ledger, and final reports are complete.
- [ ] Handoff records changed files, checks, local deliverables, remaining external publication action, and no blockers.
- [ ] No push, upload, publication, release, purchase, or external message occurred without explicit authorization.

**Verification:**

- [ ] Review staged/tracked scope, final diff, ignored outputs, and media metadata.
- [ ] Human final review accepts README behavior and local deliverables.

**Dependencies:** Tasks 1–32.

**Likely files:** `docs/specs/readme-demo-video/tasks/todo.md`, `docs/specs/readme-demo-video/tasks/handoff.md`, `media/video/THIRD_PARTY_MEDIA.md`.

**Estimated scope:** S.

### Checkpoint K: Tasks 32–33

- [ ] README demo and local LinkedIn derivative are complete and verified.
- [ ] Only approved README media is tracked; no external publication or push occurred.

## Parallelization And Coordination

- Tasks 7–10 are sequential because aliases/import boundaries, canonical UI frame, fixtures, and content contracts build on each other.
- After Task 10, prompt visual components may be prepared independently, but Tasks 11–18 should be integrated in storyboard order to preserve one continuous state narrative.
- Tasks 19–21 are safe to implement independently after the animatic is approved; Task 22 depends on their contracts.
- Tasks 23 and 24 can proceed independently after Task 22, provided they do not edit shared timeline/plugin primitives simultaneously.
- Voice recording and stock selection may be prepared after their authorization gates, but the final mix waits for plugin/content lock.
- Master, derivatives, README integration, and handoff are sequential approval gates.
- No sub-agent or parallel worker should edit the same scene/data file without explicit coordination.

## Risks And Mitigations

| Risk                                                          | Impact | Mitigation                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer import pulls Electron/runtime code                   | High   | Allowlisted product import module plus static forbidden-import test; never polyfill Electron.                                                                                               |
| Canonical components depend on CSS keyframes or portal state  | High   | Scope render overrides, control open state with props, and drive all motion from frames.                                                                                                    |
| Direct reuse becomes a second visual fork                     | High   | Extract shared pure views in original source when necessary; prohibit copied Command Dock markup.                                                                                           |
| Root/video dependency resolution becomes fragile              | High   | Explicit source aliases, one forced video React runtime, repository PostCSS/Tailwind compilation, clean root/video installs, isolated video lockfile, and clean-checkout bundle/style test. |
| Product UI is too small at 720p                               | High   | Fixed native geometry, minimum scaled text threshold, full-size/720p still review before scene approval.                                                                                    |
| Retry accidentally implies re-recording or persistent storage | High   | Fixture identity validation, no `recording` state in retry scene, precise copy.                                                                                                             |
| Translation/Prettify overclaim model quality                  | Medium | Reviewed examples, non-universal wording, explicit meaning-preservation check.                                                                                                              |
| CSS/WebGL nondeterminism changes pixels                       | High   | Disable wall-clock motion, fixed seeds, repeat-render pixel comparisons, fallback mode.                                                                                                     |
| Provider qualification is unreadable                          | High   | Dedicated `SafeClaim`, 300-frame presence/contrast test, no effect layer above it.                                                                                                          |
| Plugin layer overwhelms canonical UI                          | Medium | No-effects approval baseline, target allowlists, bounded opacity/duration, UI geometry comparison.                                                                                          |
| Stock licensing is unclear                                    | High   | Separate acquisition gate and complete provenance before import.                                                                                                                            |
| 60 fps README file exceeds 20 MB                              | Medium | Readability-first CRF comparison; request approval before raising ceiling.                                                                                                                  |
| No subtitles reduces muted comprehension                      | Medium | Product state, hotkeys, prompt examples, concise labels, and structured infographic—not voice-over transcription.                                                                           |

## Approval And Authorization Gates

1. Revised React-rendered specification and plan approved before Task 7 implementation.
2. Canonical product UI boundary/fixture checkpoint approved before functional scenes.
3. No-effects animatic approved before plugin treatment.
4. Exact package/license/plugin compliance approved before final audio.
5. Stock download/purchase and optional external skill actions separately authorized.
6. Master approved before derivatives.
7. README integration approved before task closure.
8. GitHub/LinkedIn publication, uploads, pushes, and releases separately authorized.

## Plan Validation

- [ ] Every task has acceptance criteria, verification, dependencies, likely files, and estimated scope.
- [ ] No task requires more than five likely source/document files.
- [ ] Tasks are dependency-ordered and checkpoints occur after every major two-to-three-task slice.
- [ ] The plan contains no screen-capture task, command, directory, media requirement, or capture blocker.
- [ ] All relevant existing React components and their source-of-truth boundaries are explicit.
- [ ] Exact Remotion `4.0.483` plugin scope is preserved.
- [ ] Human approval is recorded before implementation resumes.
