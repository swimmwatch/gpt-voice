# Task List: GPT-Voice README And LinkedIn Demo Video

The video is rendered entirely from React components in Remotion. Screen recording, screenshots, captured application windows, and product footage are not part of this task graph. Detailed acceptance criteria, verification, dependencies, likely files, risks, and authorization gates are in `plan.md`.

## Phase 0: Completed Human, Claim, And License Gates

- [x] Task 1 (S): Approve the production contract. Dependencies: none.
- [x] Task 2 (S): Complete the tooling and license preflight. Dependencies: Task 1.
- [x] Task 3 (S): Lock synthetic content and claims. Dependencies: Tasks 1–2.

### Checkpoint A

- [x] Content, claims, licenses, and external-action gates are explicit.
- [x] Local implementation is approved; publication/acquisition remain separately authorized.

## Phase 1: Completed Isolated Remotion Foundation

- [x] Task 4 (M): Scaffold the isolated video project. Dependencies: Checkpoint A.
- [x] Task 5 (M): Register the deterministic composition boundary. Dependencies: Task 4.
- [x] Task 6 (M): Define and validate timeline data. Dependencies: Task 5.

### Checkpoint B

- [x] The isolated project installs, type-checks, and renders in both effects modes.
- [x] Timeline validation proves the exact 1920x1080, 60 fps, 3600-frame contract.

## Phase 2: React Product UI Boundary

- [x] Task 7 (M): Configure the canonical renderer import boundary. Dependencies: Checkpoint B.
- [x] Task 8 (M): Build the reused Command Dock render frame. Dependencies: Task 7.
- [x] Task 9 (M): Define and validate deterministic UI fixtures. Dependencies: Task 8.

### Checkpoint C

- [x] All relevant Command Dock React components render without Electron/runtime side effects.
- [x] Product styles and state transitions are canonical, typed, deterministic, and pixel-stable.

## Phase 3: Functional React Animatic

- [x] Task 10 (M): Materialize approved content and narration references. Dependencies: Checkpoint C and Task 3.
- [x] Task 11 (M): Build the prompt-problem and product-bridge scenes. Dependencies: Task 10.
- [x] Task 12 (M): Build the transcription scene. Dependencies: Task 11.

### Checkpoint D

- [x] The first 29 seconds explain the prompt problem and demonstrate transcription with React-rendered UI.
- [ ] Content, product appearance, timing, and repeat-frame determinism are approved.

- [x] Task 13 (M): Build the same-audio retry scene. Dependencies: Task 12.
- [x] Task 14 (M): Build the translation scene. Dependencies: Task 13.
- [x] Task 15 (M): Build the Prettify scene. Dependencies: Task 14. Implemented independently; Task 14 remains blocked.

### Checkpoint E

- [x] Retry, translation, and Prettify form a factual prompt recovery/refinement sequence.
- [x] Every workflow uses canonical product React state and remains understandable muted.

- [x] Task 16 (M): Build the provider proof scene. Dependencies: Checkpoint E.
- [x] Task 17 (S): Build the CTA and stable poster scene. Dependencies: Task 16.
- [ ] Task 18 (M): Assemble and approve the no-effects React animatic. Dependencies: Tasks 11–17.

### Checkpoint F

- [ ] The complete no-effects React animatic is factually, visually, and temporally approved.
- [ ] Plugin work cannot change approved product state, copy, or timing.

## Phase 4: Remotion Plugin Layer

- [ ] Task 19 (M): Implement deterministic background effects. Dependencies: Checkpoint F.
- [ ] Task 20 (M): Implement the audio-derived waveform. Dependencies: Task 19 and local live sample.
- [ ] Task 21 (M): Implement path and shape primitives. Dependencies: Task 19.

### Checkpoint G

- [ ] Background, waveform, path, and shape primitives are deterministic in both modes.
- [ ] Retry visibly reuses the original waveform identity.

- [ ] Task 22 (M): Implement transitions, light leaks, and bounded motion accents. Dependencies: Checkpoint G.
- [ ] Task 23 (M): Apply the plugin map to opening, bridge, transcription, and retry. Dependencies: Task 22.
- [ ] Task 24 (M): Apply the plugin map to translation, Prettify, providers, and CTA. Dependencies: Task 22.
- [ ] Task 25 (M): Pass the plugin compliance gate. Dependencies: Tasks 23–24.

### Checkpoint H

- [ ] Every selected plugin has an approved, deterministic, version-aligned implementation.
- [ ] Plugin styling preserves canonical React UI in WebGL and fallback modes.

## Phase 5: Voice, Stock Audio, And Mix

- [ ] Task 26 (M): Produce and synchronize final voice-over. Dependencies: Checkpoint H and optional skill decision.
- [ ] Task 27 (M): Acquire and prepare licensed music and SFX. Dependencies: Tasks 2 and 25 plus authorization.
- [ ] Task 28 (M): Integrate and approve the final mix. Dependencies: Tasks 26–27.

### Checkpoint I

- [ ] Voice, live sample, music, and effects are owned/licensed, synchronized, and within mix targets.
- [ ] No caption source or subtitle stream exists.

## Phase 6: Visual QA, Masters, And Distribution Files

- [ ] Task 29 (M): Complete frame-accurate product and visual QA. Dependencies: Checkpoint I.
- [ ] Task 30 (M): Render and approve master variants. Dependencies: Task 29.
- [ ] Task 31 (M): Create and verify distribution derivatives. Dependencies: Task 30 and master approval.

### Checkpoint J

- [ ] Master, fallback, README media, and unpublished LinkedIn derivative pass technical/content checks.
- [ ] Human approval authorizes README integration, not external publication.

## Phase 7: README Integration And Handoff

- [ ] Task 32 (S): Integrate the accessible README demo block. Dependencies: Checkpoint J.
- [ ] Task 33 (S): Complete final approval and local handoff. Dependencies: Tasks 1–32.

### Checkpoint K

- [ ] README demo and local LinkedIn derivative are complete and verified.
- [ ] Only approved README media is tracked; no external publication or push occurred.

## Approval Gates

- [ ] Revised React-rendered specification and plan approved before Task 7.
- [ ] Canonical product UI/fixture checkpoint approved before functional scenes.
- [ ] No-effects animatic approved before plugin work.
- [ ] Plugin/license compliance approved before final audio.
- [ ] Stock acquisition and optional external skill actions separately authorized.
- [ ] Master approved before derivatives.
- [ ] README integration approved before task closure.
- [ ] GitHub/LinkedIn publication, uploads, pushes, and releases separately authorized.
