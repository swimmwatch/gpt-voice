# Task List: GitHub Pages Landing Page

Detailed acceptance criteria, verification steps, dependencies, likely files, and estimates are in `plan.md`. Do not mark a task complete until its task-level verification and the applicable checkpoint pass.

## Phase 0: Contract Gates

- [x] Task 1 (M): Reconcile the visible-page artifact contract. Dependencies: none.
- [x] Task 2 (S): Resolve the landing media accessibility boundary. Dependencies: Task 1.

### Checkpoint A

- [x] Landing artifacts agree on the visible information architecture.
- [x] Landing-only caption/transcript policy is approved; absent final media remains a Task 9 blocker.
- [x] Human approval is recorded to begin landing-only implementation.

## Phase 1: Isolated Frontend Foundation

- [x] Task 3 (M): Add the landing dependency and command boundary. Dependencies: Task 2.
- [x] Task 4 (M): Configure Vite and strict TypeScript isolation. Dependencies: Task 3.
- [x] Task 5 (M): Establish landing tokens and shadcn ownership. Dependencies: Task 4.

### Checkpoint B

- [x] Root install, Electron checks, and landing typecheck pass together.
- [x] The landing shell resolves under `/gpt-voice/` without entering `dist/`.

## Phase 2: Component and Asset Foundations

- [x] Task 6 (M): Add shadcn action and surface primitives. Dependencies: Task 5.
- [x] Task 7 (M): Add shadcn navigation primitives. Dependencies: Task 5.
- [x] Task 8 (M): Add shadcn disclosure and media primitives. Dependencies: Task 5.

### Checkpoint C

- [x] The exact selected component inventory is installed and accessible.
- [x] No Electron renderer import or unapproved component exists.

- [ ] Task 9 (M): Build the manifest-driven public asset pipeline. Dependencies: Tasks 2, 3, 8.

## Phase 3: Typed Content and Static Shell

- [x] Task 10 (M): Define the English content and locale contracts. Dependencies: Tasks 1, 5.

### Checkpoint D1

- [ ] Public assets synchronize reproducibly and the English/route content contracts pass.
- [ ] Media-dependent work remains blocked until its required inputs are approved.

- [ ] Task 11 (M): Render the pre-rendered locale route shell. Dependencies: Tasks 4, 8, 10.
- [ ] Task 12 (M): Deliver navigation and the hero slice. Dependencies: Tasks 6, 7, 9, 11.

### Checkpoint D2

- [ ] English navigation/hero/assets/native fallbacks render without JavaScript.
- [ ] Asset sync, typecheck, focused tests, and production build pass.

## Phase 4: Core Product Story Slices

- [ ] Task 13 (M): Deliver the progressive demo video slice. Dependencies: Tasks 2, 8, 9, 11.
- [x] Task 14 (M): Deliver the How it works slice. Dependencies: Tasks 6, 8, 10, 11.
- [x] Task 15 (M): Deliver the provider signal-map slice. Dependencies: Tasks 6, 9, 10, 11.

### Checkpoint E

- [ ] Demo, workflow, and provider story work end-to-end.
- [ ] Claims and desktop/mobile visual comparisons pass.

## Phase 5: Completion and Interaction Enhancement

- [x] Task 16 (M): Deliver FAQ, final CTA, and footer. Dependencies: Tasks 6, 8, 10, 11.
- [ ] Task 17 (M): Hydrate the approved interactions. Dependencies: Tasks 7, 8, 11, 13, 16.
- [ ] Task 18 (M): Implement reveal and responsive accessibility behavior. Dependencies: Tasks 12-17.

### Checkpoint F

- [ ] All eight visible page areas are complete in English.
- [ ] Interaction, no-JavaScript, reduced-motion, keyboard, and responsive checks pass.

## Phase 6: Locale Content

- [ ] Task 19 (M): Add reviewed Cyrillic locale dictionaries. Dependencies: Tasks 10, 18.
- [ ] Task 20 (M): Add reviewed Latin-script locale dictionaries. Dependencies: Tasks 10, 18.
- [ ] Task 21 (M): Add reviewed CJK and Hindi locale dictionaries. Dependencies: Tasks 10, 18.

### Checkpoint G

- [ ] All eleven dictionaries pass schema, route, and layout checks.
- [ ] Every locale has recorded proficient-speaker approval.

## Phase 7: Locale-Aware Public Outputs

- [ ] Task 22 (M): Generate and validate locale font subsets. Dependencies: Tasks 19-21.
- [ ] Task 23 (M): Generate localized SEO and social output. Dependencies: Tasks 9, 11, 19-22.
- [ ] Task 24 (M): Generate the HTML-equivalent TXT and LLM outputs. Dependencies: Tasks 10, 19-23.

### Checkpoint H

- [ ] Eleven HTML routes and 24 TXT outputs validate from shared content.
- [ ] Fonts, metadata, JSON-LD, sitemap, robots, and HTML/TXT parity pass.

## Phase 8: Optimization and Automated Quality Gates

- [ ] Task 25 (M): Enforce optimized modern and legacy builds. Dependencies: Tasks 11, 13, 18, 22-24.
- [ ] Task 26 (M): Complete static and content contract tests. Dependencies: Tasks 12-25.
- [ ] Task 27 (M): Complete deterministic media verification. Dependencies: Tasks 9, 13, 19-24.

### Checkpoint I

- [ ] All landing type, lint, test, build, media, SEO, browser, and size gates pass.
- [ ] Production output contains no private/streaming/remote/Electron artifacts.

## Phase 9: Browser, Accessibility, and Delivery Evidence

- [ ] Task 28 (M): Add browser-responsive end-to-end coverage. Dependencies: Tasks 17-27.
- [ ] Task 29 (M): Complete automated accessibility and local CloakBrowser evidence. Dependencies: Tasks 18, 21, 27, 28.
- [ ] Task 30 (M): Add the GitHub Pages workflow. Dependencies: Tasks 3, 25-29.

### Checkpoint J

- [ ] Cross-browser, locale, accessibility, responsive, media, and local CloakBrowser evidence is complete.
- [ ] The Pages workflow validates without changing remote state.

## Phase 10: Handoff and Authorized Production Verification

- [ ] Task 31 (S): Complete the local implementation handoff. Dependencies: Tasks 1-30.
- [ ] Task 32 (S, authorization-gated): Verify an explicitly authorized production deployment. Dependencies: Task 31 plus all approval gates.

### Checkpoint K

- [ ] Local handoff is complete and honest about unavailable checks.
- [ ] Production is marked complete only after explicit authorization and deployed evidence.
- [ ] Human approval covers visuals, all translations, media, accessibility, and production behavior.

## Approval Gates

- [ ] External WebVTT sidecars versus the no-caption-file video rule is explicitly resolved.
- [ ] The final 60-fps MP4 and poster exist and are approved.
- [ ] All ten non-English locales have recorded proficient-speaker approval.
- [ ] Exact legacy/device and required screen-reader evidence is recorded or remains visibly incomplete.
- [ ] Push/deployment authorization is obtained before any remote mutation or Task 32.
