# Implementation Plan: GPT-Voice README And LinkedIn Demo Video

## Overview

Produce one deterministic, English, prompt-first GPT-Voice demonstration from the approved video specification. The composition is exactly 3600 frames at 1920×1080 and 60 fps, uses sanitized real product footage with synthetic content, and demonstrates transcription, same-audio retry, translation, Prettify, and the qualified provider benefit. The same master supplies an optimized README MP4/poster and a full-resolution LinkedIn upload file. Publication, external uploads, purchases, marketplace registration, and skill installation remain separately authorized actions.

This document is planning only. Implementation must not begin until the human approves both the specification and this plan. Every task must also satisfy the repository Definition of Done where applicable.

## Scope And Authority

| Concern                               | Authority                                                                        | Planning treatment                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Story, claims, frames, and audio cues | `docs/specs/readme-demo-video/spec.md`                                           | Treat frame ranges, narrow claims, qualifications, and the no-subtitle rule as immutable unless the specification is revised first. |
| Current product behavior              | English application UI and current hotkey/lifecycle source                       | Reconfirm labels immediately before capture; never fabricate a product state.                                                       |
| Product footage                       | Disposable GPT-Voice profile plus synthetic prompt/audio                         | Capture at constant 60 fps and import only after original-resolution privacy review.                                                |
| Motion graphics                       | The nine selected version-aligned Remotion packages                              | Use each package only for its assigned purpose, with ANGLE/WebGL and deterministic CSS/SVG fallback.                                |
| Audio                                 | Approved narration, live sample, licensed stock music, and licensed/original SFX | Keep provenance, use 48 kHz sources, synchronize to frames, and target approximately −14 LUFS-I with true peak at or below −1 dBTP. |
| Distribution                          | One master, README derivative/poster, and LinkedIn derivative                    | Commit only the approved README MP4 and poster; keep captures, masters, reports, and LinkedIn upload ignored.                       |
| External state                        | LinkedIn, GitHub uploads/releases, stock purchases, marketplaces, hosted TTS     | Stop and obtain explicit authorization before changing external state.                                                              |

## Architecture Decisions

- Keep the Remotion project isolated under `media/video/` with its own exact lockfile; do not add video packages to the Electron application dependency graph.
- Register one `GptVoiceDemo` composition at 1920×1080, 60 fps, and 3600 frames. Distribution files are derivatives of this master and cannot change timing or content.
- Store scene boundaries, audio cues, synthetic content, and approved narration in typed data modules. Validate continuity, ownership of cues, and poster-frame stability before rendering.
- Build and approve a functional no-effects animatic before applying plugin treatments. Real UI, concise labels, hotkeys, and qualifications remain normal DOM/capture layers above effects.
- Use `effectsMode: 'webgl' | 'fallback'` and a Studio-only debug overlay. The fallback must preserve content, timing, and layout without WebGL.
- Keep voice-over, live spoken sample, music, and individual SFX independently addressable until final approval. Do not add captions, caption data, SRT/VTT, or subtitle streams.
- Use frame 3540 for the poster. README integration is a linked accessible poster because GitHub README video support is not assumed.
- Preserve raw and review media only in ignored working directories. Never solve a privacy failure by committing a blurred secret; reject and recapture the take.

## Dependency Graph

```text
approval and content gates 1-3
  -> isolated Remotion foundation 4-6
  -> disposable capture and reviewed footage 7-9
  -> content/audio reference and no-effects animatic 10-15
  -> shared plugin primitives and scene plugin passes 16-21
  -> final narration, licensed sound, and mix 22-24
  -> visual/master/distribution verification 25-28
  -> README integration and human handoff 29-30
```

## Phase 0: Human, Claim, And License Gates

### Task 1: Approve the production contract

**Description:** Resolve the specification's review status and four open questions before implementation changes or media acquisition begin.

**Acceptance criteria:**

- [ ] Human approval records one English video, exactly 3600 frames at 60 fps, the frame-accurate scene order, prompt-first opening, and no-subtitle rule.
- [ ] README delivery, narration source, stock library approach, and README file-size ceiling are explicitly accepted or replaced with approved decisions.
- [ ] The specification status and decision record make clear that LinkedIn/GitHub publication is not authorized by production approval.

**Verification:**

- [ ] Review the specification assumptions, open questions, and boundaries against the recorded decisions.
- [ ] Confirm no implementation, package installation, capture, purchase, upload, or publication occurred during approval.

**Dependencies:** None.
**Likely files:** `docs/specs/readme-demo-video/spec.md`, `docs/specs/readme-demo-video/tasks/handoff.md`.
**Estimate:** S.

### Task 2: Complete the tooling and license preflight

**Description:** Establish whether the selected Remotion packages, stock sources, fonts, and requested implementation skills may be used before installing or acquiring anything.

**Acceptance criteria:**

- [ ] One exact Remotion version at or above `4.0.483` is selected for core/CLI and all nine approved packages, with a documented distribution-eligibility decision.
- [ ] Music, SFX, and any local font have a source strategy compatible with repository and LinkedIn distribution; paid or attribution-expanding terms remain blocked pending approval.
- [ ] Availability or authorization is recorded for the official Remotion skills and Humanizer; marketplace registration, skill installation, hosted TTS, and purchases are not inferred.

**Verification:**

- [ ] Human-review the preflight ledger for license, source URL, creator, attribution, download date, and eligibility fields.
- [ ] Confirm every unresolved license or external-tool decision is marked as a stop condition rather than an implementation assumption.

**Dependencies:** Task 1.
**Likely files:** `media/video/THIRD_PARTY_MEDIA.md`, `docs/specs/readme-demo-video/tasks/handoff.md`.
**Estimate:** S.

### Task 3: Lock the synthetic content and claims

**Description:** Approve the spoken prompt, rough/Prettified pair, target language, translation-review method, and exact comparison/qualification wording before capture.

**Acceptance criteria:**

- [ ] Synthetic source text covers transcription, retry, translation, and Prettify while the cleaned result removes grammar noise, repetition, and filler without changing instructions.
- [ ] Retry wording is limited to resending the same stored audio without re-recording; translation makes no universal model-quality promise.
- [ ] The provider benefit always includes the full plan/availability/fair-use/provider-limits qualification, and no release version appears in the video.

**Verification:**

- [ ] Perform a factual/semantic comparison of source, translation method, rough text, and Prettified result.
- [ ] Search the approved video copy for prohibited guarantees, unqualified `unlimited`, broad ChatGPT retry claims, release numbers, and caption requirements.

**Dependencies:** Tasks 1-2.
**Likely files:** `docs/specs/readme-demo-video/spec.md`, `docs/specs/readme-demo-video/tasks/handoff.md`.
**Estimate:** S.

### Checkpoint A: Tasks 1-3

- [ ] Specification and plan are human-approved, all content decisions are locked, and unresolved license/external-action gates are visible.
- [ ] Implementation may begin only after this checkpoint is explicitly accepted.

## Phase 1: Isolated Remotion Foundation

### Task 4: Scaffold the isolated video project

**Description:** Create the blank strict-TypeScript Remotion project and install only the approved, exact-version video dependencies in its local lockfile.

**Acceptance criteria:**

- [ ] `media/video/` owns its package manifest, exact lockfile, and strict TypeScript configuration without changing root runtime dependencies.
- [ ] Remotion core/CLI plus media, transitions, motion-blur, effects, light-leaks, noise, shapes, paths, and media-utils resolve to one exact version.
- [ ] The project exposes local Studio, typecheck, still, render, and timeline-validation commands suitable for clean-checkout use.

**Verification:**

- [ ] Run the isolated install/typecheck and the specification's `npm --prefix media/video ls ...` version-alignment check.
- [ ] Diff root `package.json`/`package-lock.json` and run the smallest Electron dependency check to prove isolation.

**Dependencies:** Checkpoint A.
**Likely files:** `media/video/package.json`, `media/video/package-lock.json`, `media/video/tsconfig.json`.
**Estimate:** M.

### Task 5: Register the deterministic composition boundary

**Description:** Configure ANGLE rendering, register `GptVoiceDemo`, establish WebGL/fallback/debug props, and protect generated or sensitive working media.

**Acceptance criteria:**

- [ ] The only production composition is 1920×1080, 60 fps, and 3600 frames with typed `effectsMode` and `debugOverlays` props.
- [ ] Chromium uses ANGLE; final paths default to WebGL with an explicit deterministic fallback and exclude debug overlays.
- [ ] Raw captures, review frames, masters, reports, stills, and LinkedIn derivatives remain ignored while `assets/demo/` deliverables can be tracked.

**Verification:**

- [ ] Open Remotion Studio locally and render one frame in both effect modes with debug overlays on and off.
- [ ] Run `git status --ignored` on the planned media paths and confirm no Electron build includes `media/video/`.

**Dependencies:** Task 4.
**Likely files:** `media/video/remotion.config.ts`, `media/video/src/Root.tsx`, `media/video/src/GptVoiceDemo.tsx`, `media/video/src/index.ts`, `.gitignore`.
**Estimate:** M.

### Task 6: Define and validate timeline data

**Description:** Centralize scene ranges and audio cues, then fail renders when continuity, cue ownership, duration, or poster stability is invalid.

**Acceptance criteria:**

- [ ] Typed data declares the eight approved frame ranges, every cue-sheet frame, 60 fps, total frame 3600, and poster frame 3540.
- [ ] Validation rejects gaps/overlaps, non-positive durations, misplaced audio cues, a non-stable poster frame, or a final frame other than 3600.
- [ ] Scene components do not own unexplained absolute frame literals.

**Verification:**

- [ ] Run timeline validation in its passing form and focused negative fixtures for each invariant category.
- [ ] Run isolated TypeScript checks and compare generated scene/cue summaries with the specification tables.

**Dependencies:** Task 5.
**Likely files:** `media/video/src/data/timeline.ts`, `media/video/src/data/audioCues.ts`, `media/video/src/validation/validateTimeline.ts`, `media/video/src/validation/validateTimeline.test.ts`.
**Estimate:** M.

### Checkpoint B: Tasks 4-6

- [ ] The isolated project installs, type-checks, opens, and renders without entering the Electron dependency or output graph.
- [ ] Timeline validation proves an exact 3600-frame contract in both effects modes.

## Phase 2: Disposable Capture And Privacy Review

### Task 7: Rehearse the sanitized capture environment

**Description:** Prepare a disposable profile, synthetic editor document, English UI, fixed geometry/cursor/scaling, capture directories, and a privacy-test take before recording source footage.

**Acceptance criteria:**

- [ ] GPT-Voice uses disposable application/OS state; browser login, credentials, sessions, history, logs, notifications, clock, and unrelated desktop content stay off-screen.
- [ ] OBS or equivalent records a window-only 1920×1080 constant-60-fps lossless MKV with no system audio and at least 60 handle frames.
- [ ] A test take passes first/last/one-frame-per-second inspection at original resolution before source capture proceeds.

**Verification:**

- [ ] Inspect recorder metadata with FFprobe and review extracted privacy frames at original resolution.
- [ ] Record the environment, geometry, target language, editor fixture, and privacy result in the implementation handoff without recording secrets.

**Dependencies:** Checkpoint B and Task 3.
**Likely files:** `.artifacts/video-source/`, `.artifacts/video-review/`, `docs/specs/readme-demo-video/tasks/handoff.md`.
**Estimate:** M.

### Task 8: Capture transcription and same-audio retry

**Description:** Record, normalize, and privacy-clear the idle, recording, success, and failure/retry takes while preserving real current UI behavior.

**Acceptance criteria:**

- [ ] `C01_IDLE` through `C04_FAILURE_RETRY` show the required real English states, current hotkeys, clean handles, and constant 60-fps sharp UI.
- [ ] Retry starts from a real failed/unprocessed request, uses the stored audio through `Ctrl+F8`, and succeeds without a second recording action.
- [ ] Every accepted take passes first/last/one-frame-per-second privacy review before entering `public/footage/`.

**Verification:**

- [ ] Use FFprobe on normalized clips and compare visible labels/hotkeys with the current English application source.
- [ ] Watch the retry take frame by frame and confirm audio identity, state order, no second F9 action, and no sensitive frame.

**Dependencies:** Task 7.
**Likely files:** `media/video/public/footage/C01_IDLE.mp4`, `C02_RECORD.mp4`, `C03_STOP_SUCCESS.mp4`, `C04_FAILURE_RETRY.mp4`.
**Estimate:** M.

### Task 9: Capture text actions and provider evidence

**Description:** Record, normalize, and privacy-clear translation, Prettify, provider, saved-session, and cursor-reference takes.

**Acceptance criteria:**

- [ ] `C05_TRANSLATE` and `C06_PRETTIFY` show current F11/F12 state sequences and reviewed synthetic results with meaning preserved.
- [ ] `C07_PROVIDERS` and `C08_SESSION` visibly prove `ChatGPT Web`, `OpenAI API`, and a saved session without account identity or browser login.
- [ ] All five takes, including `C09_CURSOR`, match the established geometry and pass the required original-resolution privacy sampling.

**Verification:**

- [ ] Compare results with the approved content lock and compare every product label with the current English UI.
- [ ] Use FFprobe plus full-resolution privacy frames to reject variable frame rate, soft text, cursor jumps, or private data.

**Dependencies:** Tasks 7-8.
**Likely files:** `media/video/public/footage/C05_TRANSLATE.mp4`, `C06_PRETTIFY.mp4`, `C07_PROVIDERS.mp4`, `C08_SESSION.mp4`, `C09_CURSOR.mp4`.
**Estimate:** M.

### Checkpoint C: Tasks 7-9

- [ ] All nine required takes are current, synthetic, constant-60-fps, readable, and privacy-approved.
- [ ] No raw capture, review image, session, credential, personal data, or system audio is tracked.

## Phase 3: Content Data And Functional Animatic

### Task 10: Materialize approved content and timing references

**Description:** Add typed synthetic content, approved narration, local icon/live sample, and a rough voice timing reference without adding caption infrastructure.

**Acceptance criteria:**

- [ ] `content.ts` matches accepted capture output, including the reviewed translation and meaning-preserving Prettify result.
- [ ] `script.ts` preserves prompt-first positioning, factual qualifications, and the live-sample narration gap while fitting its assigned frame windows at a natural pace.
- [ ] The repository icon and synthetic live sample are local, licensed/project-owned, privacy-safe, and referenced through `staticFile()`.

**Verification:**

- [ ] Read the script aloud against frame windows and compare each spoken action with the cue sheet and captured result.
- [ ] Search the video project for caption/SRT/VTT structures, remote assets, release numbers, and sensitive content; expect none.

**Dependencies:** Checkpoint C.
**Likely files:** `media/video/src/data/content.ts`, `media/video/src/data/script.ts`, `media/video/public/images/gpt-voice-icon.png`, `media/video/public/audio/voiceover/live-transcription-sample.wav`, `.artifacts/video-audio/rough-voiceover.wav`.
**Estimate:** M.

### Task 11: Build the prompt-problem and product-bridge animatic

**Description:** Implement scenes 1-2 with simple backgrounds so the complete problem story and first product reveal can be approved before effects work.

**Acceptance criteria:**

- [ ] Frames 0-899 visibly present all four prompt-problem groups and sixteen issue labels, with GPT-Voice product UI/name/actions absent.
- [ ] Frame 900 is the first product appearance and maps the problem to speak, retry, translate, and Prettify without overclaiming.
- [ ] The opening remains understandable muted without reproducing narration as subtitles.

**Verification:**

- [ ] Render and review frames 60, 180, 360, 540, 720, and 900 at full resolution.
- [ ] Watch frames 0-1139 muted and confirm inventory completeness, title-safe layout, and first-product timing.

**Dependencies:** Tasks 6 and 10.
**Likely files:** `media/video/src/scenes/PromptProblemsScene.tsx`, `media/video/src/scenes/ProductBridgeScene.tsx`, `media/video/src/components/SafeClaim.tsx`.
**Estimate:** M.

### Task 12: Build the transcription-recovery animatic

**Description:** Implement scenes 3-4 as one continuous real-footage workflow from spoken prompt through success, failure, and stored-audio recovery.

**Acceptance criteria:**

- [ ] Transcription shows F9, Recording, F10, Transcribing, clipboard success, and paste in the approved frame windows using the synthetic live sample.
- [ ] Retry shows failure, `Ctrl+F8`, `Resending transcription…`, and the same result with no second record action.
- [ ] The ChatGPT Web comparison is limited to the same-audio retry-without-re-recording workflow.

**Verification:**

- [ ] Render start/mid/end and cue frames for both scenes, including frames 1170, 1428, 1620, 1752, 1902, and 2040.
- [ ] Watch the capture, cursor, hotkeys, result, and narration reference together at normal and half speed.

**Dependencies:** Tasks 8, 10-11.
**Likely files:** `media/video/src/scenes/TranscriptionScene.tsx`, `media/video/src/scenes/RetryScene.tsx`, `media/video/src/components/HotkeyChip.tsx`, `media/video/src/components/CaptureFrame.tsx`.
**Estimate:** M.

### Checkpoint D: Tasks 10-12

- [ ] The first 38 seconds form a factual, privacy-safe, muted-traceable prompt and recovery story.
- [ ] Rough narration fits without racing and every visible product state comes from reviewed footage.

### Task 13: Build the translation and Prettify animatic

**Description:** Implement scenes 5-6 with real selections/results and a clear visual need for model-oriented translation and prompt cleanup.

**Acceptance criteria:**

- [ ] Translation shows F11, processing, clipboard success, reviewed output, and the benefit of avoiding a separate translation tool without guaranteeing a universally best language.
- [ ] Prettify shows F12 and a legible rough/clean comparison that removes grammar noise, repetition, and filler while retaining the required security-review intent.
- [ ] Both actions remain traceable when muted through actual UI states, selection, hotkeys, and concise labels.

**Verification:**

- [ ] Render start/mid/end and cue frames for both scenes, including frames 2342, 2502, 2580, 2790, and 2952.
- [ ] Human-review translation accuracy and perform a clause-by-clause meaning comparison of rough and Prettified text.

**Dependencies:** Tasks 9-10 and Checkpoint D.
**Likely files:** `media/video/src/scenes/TranslationScene.tsx`, `media/video/src/scenes/PrettificationScene.tsx`, `media/video/src/components/SafeClaim.tsx`.
**Estimate:** M.

### Task 14: Build the provider and CTA animatic

**Description:** Implement scenes 7-8 with factual provider evidence, the fully qualified subscription benefit, and a pixel-stable ending.

**Acceptance criteria:**

- [ ] Frames 3120-3419 name ChatGPT Web and OpenAI API, identify ChatGPT Web as the implemented web provider, and keep the complete qualification legible for all 300 frames.
- [ ] The CTA resolves transcription, retry, translation, and Prettify into the prompt-first faster/better/less-effort outcome without a release claim.
- [ ] Frame 3540 falls inside a stable, sharp hold suitable for the README poster and LinkedIn thumbnail.

**Verification:**

- [ ] Render and inspect frames 3120, 3150, 3240, 3419, 3480, 3540, and 3599 at full resolution.
- [ ] Run a frame-span check for qualification presence/contrast and pixel-compare the stable poster interval.

**Dependencies:** Tasks 9-10 and 13.
**Likely files:** `media/video/src/scenes/ProvidersScene.tsx`, `media/video/src/scenes/CtaScene.tsx`, `media/video/src/components/SafeClaim.tsx`.
**Estimate:** M.

### Task 15: Assemble and approve the no-effects animatic

**Description:** Connect all eight scenes, reviewed footage, rough narration, live sample, and debug layers into the complete functional timeline before plugin styling.

**Acceptance criteria:**

- [ ] The animatic renders exactly 3600 frames with the approved scene order, capture alignment, safe areas, and no missing/duplicated product state.
- [ ] Every spoken action is within six frames of its visible action; no narration overlaps the live spoken sample.
- [ ] Muted, audio-only, normal-speed, and half-speed reviews all preserve the intended prompt-first story and action order.

**Verification:**

- [ ] Render one start/mid/end still per scene and a quarter-scale full animatic in WebGL-disabled placeholder mode.
- [ ] Run timeline/type checks, then record human approval of the functional animatic before Task 16.

**Dependencies:** Tasks 11-14.
**Likely files:** `media/video/src/GptVoiceDemo.tsx`, `media/video/src/components/DebugOverlay.tsx`, `media/video/src/data/timeline.ts`, `media/video/src/data/audioCues.ts`.
**Estimate:** M.

### Checkpoint E: Tasks 13-15

- [ ] The complete no-effects video is functionally, factually, and temporally approved.
- [ ] Plugin work cannot conceal or change any approved real state, claim, or scene boundary.

## Phase 4: Remotion Plugin Layer

### Task 16: Implement deterministic background effects

**Description:** Build the shared WebGL/fallback background and texture layer using approved effects and noise while preserving text/capture contrast.

**Acceptance criteria:**

- [ ] `@remotion/effects` and `@remotion/noise` produce fixed-seed gradient/grain treatments within the specified glow, opacity, and drift limits.
- [ ] The CSS/SVG fallback preserves palette, geometry, content, and frame timing when WebGL is unavailable.
- [ ] Effects remain below capture/claim layers and never recolor, blur, glow, or texture product UI or required qualifications.

**Verification:**

- [ ] Render matched WebGL/fallback stills from the opening, retry, provider, and CTA scenes; reject black/transparent/color-shifted frames.
- [ ] Sample deterministic rerenders and confirm identical output for the same props/frame.

**Dependencies:** Checkpoint E.
**Likely files:** `media/video/src/visuals/AnimatedBackground.tsx`, `media/video/src/visuals/AnimatedBackground.test.tsx`, `media/video/src/GptVoiceDemo.tsx`.
**Estimate:** M.

### Task 17: Implement waveform and workflow-path primitives

**Description:** Build reusable, typed speech waveform and directional connector visuals from the approved live sample.

**Acceptance criteria:**

- [ ] `@remotion/media-utils` derives the visible waveform from the same local WAV heard in the mix.
- [ ] `@remotion/paths` and `@remotion/shapes` create clamped, meaningfully directed paths/nodes with at most two moving dots.
- [ ] Both primitives preserve title-safe layout and have deterministic CSS/SVG-safe behavior.

**Verification:**

- [ ] Render cue stills across recording, retry, translation, Prettify, and provider flow; compare direction with the transition semantics table.
- [ ] Run focused component/type tests with missing/short audio and path endpoints.

**Dependencies:** Task 16.
**Likely files:** `media/video/src/visuals/AudioWaveform.tsx`, `media/video/src/visuals/FlowPath.tsx`, `media/video/src/visuals/FlowPath.test.tsx`.
**Estimate:** M.

### Task 18: Implement transitions and bounded motion accents

**Description:** Standardize semantic scene transitions, the three approved light leaks, and motion trails for non-critical accent geometry.

**Acceptance criteria:**

- [ ] `@remotion/transitions`, `@remotion/light-leaks`, and `@remotion/motion-blur` stay within duration, opacity, trail-layer, lag, and placement limits.
- [ ] Light leaks occur only at product reveal, retry success, and provider-to-CTA; motion blur never touches capture, result, status, or qualification content.
- [ ] Transition overlaps are represented in timeline math without changing the 3600-frame duration or hiding real states.

**Verification:**

- [ ] Render all transition boundary frames in WebGL/fallback modes and inspect every tenth frame through each transition.
- [ ] Run timeline validation and focused assertions for allowed light-leak count/locations and motion bounds.

**Dependencies:** Tasks 16-17.
**Likely files:** `media/video/src/visuals/SceneTransition.tsx`, `media/video/src/visuals/MotionAccent.tsx`, `media/video/src/visuals/SceneTransition.test.tsx`, `media/video/src/data/timeline.ts`.
**Estimate:** M.

### Checkpoint F: Tasks 16-18

- [ ] All nine selected packages now have a bounded shared implementation path in WebGL and fallback modes.
- [ ] Shared effects are deterministic and cannot reduce critical UI/claim readability.

### Task 19: Apply the plugin map to the opening and recovery story

**Description:** Integrate approved background, shape, path, waveform, transition, leak, and accent primitives into scenes 1-4 without changing the animatic contract.

**Acceptance criteria:**

- [ ] Prompt problems/product bridge use the specified shape/path/reveal treatments while GPT-Voice remains absent before frame 900.
- [ ] Transcription/retry use the live waveform, broken-to-complete retry path, and bounded success punctuation without obscuring real states.
- [ ] Muted traceability, title-safe bounds, and all animatic timing/claims remain unchanged.

**Verification:**

- [ ] Render the mandatory full-resolution frames 60, 180, 360, 540, 720, 900, and 2040 in both effects modes.
- [ ] Compare scene timing/content against the approved animatic and inspect every tenth frame for accidental unreadability.

**Dependencies:** Checkpoint F.
**Likely files:** `media/video/src/scenes/PromptProblemsScene.tsx`, `ProductBridgeScene.tsx`, `TranscriptionScene.tsx`, `RetryScene.tsx`.
**Estimate:** M.

### Task 20: Apply the plugin map to text actions and CTA

**Description:** Integrate approved directional translation, token-refinement, provider flow, and CTA convergence treatments into scenes 5-8.

**Acceptance criteria:**

- [ ] Translation direction, Prettify before/after motion, and provider connectors communicate data flow without altering or softening captured text.
- [ ] Provider qualification remains fully readable for all frames 3120-3419, and CTA convergence leaves frame 3540 pixel-stable.
- [ ] No third-party logo animation, unapproved decorative asset, or effect is added.

**Verification:**

- [ ] Render the mandatory frames 3240 and 3480 plus start/mid/end stills for scenes 5-8 in both effects modes.
- [ ] Run muted, frame-span qualification, stable-poster, and every-tenth-frame reviews.

**Dependencies:** Checkpoint F.
**Likely files:** `media/video/src/scenes/TranslationScene.tsx`, `PrettificationScene.tsx`, `ProvidersScene.tsx`, `CtaScene.tsx`.
**Estimate:** M.

### Task 21: Pass the plugin compliance gate

**Description:** Prove version alignment, actual approved use, deterministic rendering, and removal of any unused selected dependency before final audio.

**Acceptance criteria:**

- [ ] `npm ls` reports one exact valid version for Remotion core/CLI and every retained selected package.
- [ ] Each retained plugin has a mapped, visible, approved use and no unselected animation/caption/remote-asset package is present.
- [ ] Required WebGL and fallback stills render without black frames, missing textures, alpha defects, or content/timing differences.

**Verification:**

- [ ] Run package-tree, import-map, timeline, typecheck, and deterministic still checks from a clean install.
- [ ] Human-review a side-by-side plugin checklist against the scene-to-plugin map and parameter bounds.

**Dependencies:** Tasks 19-20.
**Likely files:** `media/video/package.json`, `media/video/package-lock.json`, `media/video/THIRD_PARTY_MEDIA.md`, `media/video/out/stills/`.
**Estimate:** M.

### Checkpoint G: Tasks 19-21

- [ ] The vibrant plugin pass is complete, deterministic, licensed, version-aligned, and subordinate to product legibility.
- [ ] WebGL and fallback pictures tell the same approved story in exactly 3600 frames.

## Phase 5: Final Voice, Stock Audio, And Mix

### Task 22: Produce and synchronize the final voice-over

**Description:** Naturalize the approved script with the requested Humanizer skill when authorized/available, complete the human read-aloud pass, and record the final narration.

**Acceptance criteria:**

- [ ] Humanizer edits improve cadence without changing factual meaning, claim qualifications, prompt-first positioning, or scene ownership; unavailable tooling remains an explicit blocker.
- [ ] Final narration is clean project-owned 48 kHz/24-bit WAV and contains no private content or narration during the live sample.
- [ ] Spoken actions align with visible states within six frames at natural speed without audible time stretching.

**Verification:**

- [ ] Diff reviewed/final script semantics, then record Humanizer and human read-aloud approvals.
- [ ] Listen with picture at normal/half speed and without picture; confirm intelligibility, order, and cue alignment.

**Dependencies:** Checkpoint G and Task 2's skill/voice-source decision.
**Likely files:** `media/video/src/data/script.ts`, `media/video/public/audio/voiceover/voiceover-main.wav`, `media/video/src/data/audioCues.ts`, `media/video/THIRD_PARTY_MEDIA.md`.
**Estimate:** M.

### Task 23: Acquire and prepare licensed music and SFX

**Description:** Select approved stock music/effects, document provenance, and normalize editable 48 kHz/24-bit stems without mimicking real system notifications.

**Acceptance criteria:**

- [ ] Every music/SFX file has documented source, creator, license, download date, attribution, and repository/LinkedIn eligibility before import.
- [ ] The music bed supports a restrained 60-second edit; action, processing, failure, success, and transition sounds match the cue sheet and remain distinguishable.
- [ ] No unlicensed, purchase-required, private, remote-runtime, or opaque all-in-one final stem enters the project.

**Verification:**

- [ ] Audit `THIRD_PARTY_MEDIA.md` against every imported audio file and stop on any missing/unclear right.
- [ ] Inspect sample rate/bit depth/channel metadata and audition each stem at working level for clipping or notification confusion.

**Dependencies:** Tasks 2 and 21.
**Likely files:** `media/video/THIRD_PARTY_MEDIA.md`, `media/video/public/audio/music/`, `media/video/public/audio/sfx/`.
**Estimate:** M.

### Task 24: Integrate and approve the final mix

**Description:** Place final narration, live sample, music, and individual SFX by frame with controlled ducking, fades, and loudness.

**Acceptance criteria:**

- [ ] All cue-sheet events occur at their approved frames; music ducks 6-8 dB under the live sample/voice and reaches digital silence by frame 3599.
- [ ] The integrated master is approximately −14 LUFS-I with true peak at or below −1 dBTP, with voice/live sample always intelligible.
- [ ] Final audio remains independently editable and synchronized in both effects modes.

**Verification:**

- [ ] Render an audio-review master, run EBU R128/true-peak analysis, and inspect waveform endpoints for silence/clipping.
- [ ] Listen once with picture, once without picture, and on speakers/headphones; record human mix approval.

**Dependencies:** Tasks 22-23.
**Likely files:** `media/video/src/GptVoiceDemo.tsx`, `media/video/src/data/audioCues.ts`, `media/video/src/components/AudioMix.tsx`, `media/video/out/reports/loudness.txt`.
**Estimate:** M.

### Checkpoint H: Tasks 22-24

- [ ] Final voice, live sample, music, and SFX are licensed/owned, frame-synchronized, intelligible, and technically within mix targets.
- [ ] No caption asset, subtitle stream, or narration-derived on-screen transcript has been introduced.

## Phase 6: Visual QA, Masters, And Distribution Files

### Task 25: Complete frame-accurate visual and content QA

**Description:** Run the required still suite and motion reviews, then correct only evidence-backed visual, synchronization, claim, or privacy defects.

**Acceptance criteria:**

- [ ] All required timestamps and mandatory full-resolution frames pass title-safe, legibility, capture sharpness, effect-bound, and claim checks.
- [ ] Full-speed, half-speed, muted, audio-only, and every-tenth-frame reviews preserve functionality and prompt-first comprehension.
- [ ] A renewed privacy/content review finds only synthetic data and confirms all narrow claims, results, labels, and qualifications.

**Verification:**

- [ ] Render the specification's mandatory still commands plus scene start/mid/end frames in WebGL/fallback modes.
- [ ] Record each review outcome and any bounded correction in the handoff; repeat failed evidence after correction.

**Dependencies:** Checkpoint H.
**Likely files:** `media/video/out/stills/`, `media/video/out/reports/`, `docs/specs/readme-demo-video/tasks/handoff.md`.
**Estimate:** M.

### Task 26: Render and compare the master variants

**Description:** Produce the full-quality WebGL master and deterministic fallback master from a clean, offline-capable checkout.

**Acceptance criteria:**

- [ ] Both masters render exactly 3600 frames with identical content, scene order, audio timing, and no debug overlays or network dependency.
- [ ] The WebGL master has no black/transparent frames, missing textures, alpha/color defects, or plugin instability.
- [ ] The fallback master remains fully readable and distribution-capable if WebGL is unavailable.

**Verification:**

- [ ] Run the two specification render commands after a clean install with runtime network access disabled.
- [ ] Compare FFprobe metadata, selected pixel frames, audio synchronization, and full-duration playback between variants.

**Dependencies:** Task 25.
**Likely files:** `media/video/out/gpt-voice-demo-master.mp4`, `media/video/out/gpt-voice-demo-fallback.mp4`, `media/video/out/reports/master-compare.json`.
**Estimate:** M.

### Task 27: Pass master technical acceptance

**Description:** Verify the selected master before deriving any distribution output.

**Acceptance criteria:**

- [ ] The master is at most 60.0 seconds, 1920×1080, H.264/AAC, 60/1 fps, and contains at least one valid audio stream.
- [ ] Loudness remains approximately −14 LUFS-I with true peak at or below −1 dBTP after the final render.
- [ ] No subtitle stream, caption dependency/data, SRT/VTT file, remote asset, debug overlay, or sensitive media exists.

**Verification:**

- [ ] Run FFprobe JSON metadata, EBU R128/true-peak, subtitle-stream, package, and focused source searches.
- [ ] Watch the selected master end to end and obtain human picture/sound/content approval before encoding derivatives.

**Dependencies:** Task 26.
**Likely files:** `media/video/out/gpt-voice-demo-master.mp4`, `media/video/out/reports/master-ffprobe.json`, `media/video/out/reports/master-loudness.txt`, `media/video/out/reports/subtitles.json`.
**Estimate:** S.

### Checkpoint I: Tasks 25-27

- [ ] The selected 1080p/60 master passes deterministic picture, sound, claims, privacy, license, and no-subtitle acceptance.
- [ ] No derivative is produced from an unapproved or technically failing master.

### Task 28: Create and verify distribution derivatives

**Description:** Derive the optimized README MP4, full-resolution LinkedIn upload, and frame-3540 poster from the approved master.

**Acceptance criteria:**

- [ ] README output is 1280×720, H.264/AAC, 60 fps, `faststart`, readable, and targets the approved size ceiling without sacrificing UI clarity.
- [ ] LinkedIn output is 1920×1080, H.264/AAC, 60 fps, `faststart`, readable when muted, and remains ignored/unpublished.
- [ ] The PNG poster exactly matches the stable frame-3540 CTA and is sharp at a 960-pixel README display width.

**Verification:**

- [ ] Run FFprobe on both MP4s, inspect file size/startup from a local HTTP server, and repeat the no-subtitle check.
- [ ] Pixel-compare the poster with master frame 3540 and review all three outputs at their expected display sizes.

**Dependencies:** Checkpoint I.
**Likely files:** `assets/demo/gpt-voice-demo.mp4`, `assets/demo/gpt-voice-demo-poster.png`, `media/video/out/gpt-voice-linkedin.mp4`.
**Estimate:** M.

## Phase 7: README Integration And Handoff

### Task 29: Integrate the accessible README demo block

**Description:** Place the linked poster after the badges and before `Why GPT-Voice?`, then verify repository-relative playback in GitHub-compatible rendering.

**Acceptance criteria:**

- [ ] The centered poster link opens the tracked README MP4, uses accurate video-opening alt text, and includes the concise one-minute demo label.
- [ ] Relative paths/case work from the repository README; unsupported inline `<video>` behavior is not assumed.
- [ ] The README remains factually consistent with the video and contains no broken whitespace or media links.

**Verification:**

- [ ] Preview the README with a GitHub-compatible renderer and activate the poster by keyboard and pointer.
- [ ] Run link/path checks, `git diff --check`, and the smallest applicable documentation/format checks.

**Dependencies:** Task 28.
**Likely files:** `README.md`, `assets/demo/gpt-voice-demo.mp4`, `assets/demo/gpt-voice-demo-poster.png`.
**Estimate:** S.

### Task 30: Complete final human approval and local handoff

**Description:** Close the production checklist, preserve only approved tracked deliverables, and hand off the unpublished LinkedIn file without mutating remote state.

**Acceptance criteria:**

- [ ] Human approval covers master, README derivative, LinkedIn derivative, poster, narration, music/SFX, claims, privacy, license ledger, and muted comprehension.
- [ ] Git status contains no raw capture, review frame, master, report, cache, credential, session, unlicensed file, or unrelated edit; unrelated `design-qa.md` remains untouched.
- [ ] Handoff records changed files, completed checks, exact local LinkedIn path, remaining platform-specific checks, and that upload/publication still requires explicit authorization.

**Verification:**

- [ ] Run final isolated type/timeline/package checks, media probes, README checks, `git diff --check`, and scoped `git status` review.
- [ ] Reconcile every success criterion in the specification and every task/checkpoint in `todo.md` before marking complete.

**Dependencies:** Tasks 1-29.
**Likely files:** `media/video/THIRD_PARTY_MEDIA.md`, `docs/specs/readme-demo-video/tasks/todo.md`, `docs/specs/readme-demo-video/tasks/handoff.md`.
**Estimate:** S.

### Checkpoint J: Tasks 28-30

- [ ] The approved README assets and unpublished LinkedIn derivative are complete, verified, and handed off.
- [ ] No upload, LinkedIn post, GitHub publication, purchase, release, push, or other remote mutation has occurred without separate authorization.

## Parallelization And Coordination

- Tasks 1-15 are sequential because approvals, capture truth, content, and the functional animatic establish the source of truth.
- After Task 15, Tasks 16-18 may be developed in separate sessions only if their component contracts and ownership are fixed first; they converge before scene integration.
- Tasks 19 and 20 affect disjoint scene files and may run in parallel after Checkpoint F, but Task 21 must validate their combined package/render state.
- Tasks 22 and 23 may proceed in parallel only after the script and stock-source decisions are locked; Task 24 consumes both.
- Tasks 25-30 are sequential because every artifact must derive from the same approved master.
- Any work sharing `GptVoiceDemo.tsx`, `timeline.ts`, `audioCues.ts`, `package-lock.json`, or `THIRD_PARTY_MEDIA.md` needs an agreed merge order.

## Risks And Mitigations

| Risk                                           | Impact | Mitigation                                                                                                                                 |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Specification or claims change after capture   | High   | Lock Tasks 1-3 before recording; revise the spec and recapture affected footage rather than patching claims in motion graphics.            |
| Remotion/plugin distribution terms are unclear | High   | Treat Task 2 as a stop gate; do not install/distribute until eligibility is documented or an approved CSS/SVG replacement is specified.    |
| Sensitive data appears in one frame            | High   | Inspect original-resolution samples and reject/recapture the take; never commit raw captures or use blur as the primary remedy.            |
| A real retry cannot recover continuously       | High   | Capture real failure and real retry success separately if necessary, while preserving truthful state order and never fabricating recovery. |
| Translation or Prettify output changes meaning | High   | Make reviewed captured output authoritative, update typed content, and recapture/reject semantically unsafe results.                       |
| WebGL renders black or inconsistently          | High   | Run early still gates, keep the deterministic fallback, and select fallback output if final WebGL eligibility fails.                       |
| No subtitles weakens muted comprehension       | Medium | Use real states, hotkeys, concise labels, visible before/after text, and longer holds; never add narration-derived captions.               |
| 60-fps README encode exceeds the size ceiling  | Medium | Compare CRF 21-24/max-rate variants and prefer a modest size increase over unreadable UI.                                                  |
| Voice-over drifts from picture                 | Medium | Re-record or move cue frames within the approved scene; reject audible speech time-stretching.                                             |
| Plugin energy reduces legibility               | Medium | Enforce layer order/parameter bounds and sample every tenth frame; disable an effect rather than obscure product truth.                    |
| External skill or stock source is unavailable  | Medium | Record the blocker, use an explicitly approved alternative, and do not silently skip the required Humanizer/license review.                |

## Approval And Authorization Gates

- [ ] Human approves the draft specification and this plan before Task 4.
- [ ] Remotion/plugin and stock-media distribution eligibility is documented before installation/import.
- [ ] Purchases, attribution-expanding terms, hosted TTS, marketplace registration, and skill installation have separate approval when needed.
- [ ] The functional animatic is approved before the plugin pass.
- [ ] The selected master is approved before derivatives and README integration.
- [ ] LinkedIn/GitHub upload, publication, push, or release remains outside this plan unless separately authorized.

## Plan Validation

- [x] Every task has no more than three acceptance criteria, explicit verification, ordered dependencies, likely files, and an S/M estimate.
- [x] No task is L/XL or intentionally touches more than five likely files/directories.
- [x] Checkpoints occur after every two or three tasks and include human approval at high-risk boundaries.
- [x] The plan preserves all unrelated work, especially the untracked `design-qa.md` file.
