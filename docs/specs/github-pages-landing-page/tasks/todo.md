# Task List: GitHub Pages Landing Page

Detailed acceptance criteria, verification steps, dependencies, likely files, and estimates are in `plan.md`. Do not mark a task complete until its task-level verification and the applicable checkpoint pass.

> **Active completion target:** the English static landing at `/gpt-voice/`. Tasks 19–24 are deferred future localization work, not blockers for this delivery. Task 32 remains authorization-gated.

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

- [x] Task 9 (M): Build the manifest-driven public asset pipeline. Dependencies: Tasks 2, 3, 8.

## Phase 3: Typed Content and Static Shell

- [x] Task 10 (M): Define the English content and locale contracts. Dependencies: Tasks 1, 5.

### Checkpoint D1

- [x] Public assets synchronize reproducibly and the English route-content contracts pass.
- [x] Approved English demo media synchronizes reproducibly for the published route.

- [x] Task 11 (M): Render the pre-rendered English route shell. Dependencies: Tasks 4, 8, 10.
- [x] Task 12 (M): Deliver navigation and the hero slice. Dependencies: Tasks 6, 7, 9, 11.

### Checkpoint D2

- [x] English navigation/hero/assets/native fallbacks render without JavaScript.
- [x] Asset sync, typecheck, focused tests, and production build pass.

## Phase 4: Core Product Story Slices

- [x] Task 13 (M): Deliver the progressive demo video slice. Dependencies: Tasks 2, 8, 9, 11.
- [x] Task 14 (M): Deliver the How it works slice. Dependencies: Tasks 6, 8, 10, 11.
- [x] Task 15 (M): Deliver the provider signal-map slice. Dependencies: Tasks 6, 9, 10, 11.

### Checkpoint E

- [x] English demo, workflow, and provider story work end-to-end.
- [x] Claims and English desktop/mobile visual comparisons pass.

## Phase 5: Completion and Interaction Enhancement

- [x] Task 16 (M): Deliver FAQ, final CTA, and footer. Dependencies: Tasks 6, 8, 10, 11.
- [x] Task 17 (M): Hydrate the approved English interactions. Dependencies: Tasks 7, 8, 11, 13, 16.
- [x] Task 18 (M): Implement English reveal and responsive accessibility behavior. Dependencies: Tasks 12-17.

### Checkpoint F

- [x] All eight visible page areas are complete in English.
- [x] Interaction, no-JavaScript, reduced-motion, keyboard, and responsive checks pass.

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

- [x] Task 25 (M): Enforce optimized modern and legacy English builds. Dependencies: Tasks 11, 13, 18.
- [x] Task 26 (M): Complete English static and content contract tests. Dependencies: Tasks 12-25.
- [x] Task 27 (M): Complete deterministic English media verification. Dependencies: Tasks 9, 13.

### Checkpoint I

- [x] All English landing type, lint, test, build, media, SEO, browser, and size gates pass.
- [x] English production output contains no private/streaming/remote/Electron artifacts.

## Phase 9: Browser, Accessibility, and Delivery Evidence

- [x] Task 28 (M): Add English browser-responsive end-to-end coverage. Dependencies: Tasks 17-27.
- [x] Task 29 (M): Complete automated English accessibility and local CloakBrowser evidence. Dependencies: Tasks 18, 27, 28.
- [x] Task 30 (M): Add the GitHub Pages workflow. Dependencies: Tasks 3, 25-29.

### Checkpoint J

- [x] English cross-browser, accessibility, responsive, media, and local CloakBrowser evidence is complete.
- [x] The pull request workflow runs landing validation only before code can merge into `main`; it does not deploy Pages or run during releases.

## Phase 10: Handoff and Authorized Production Verification

- [x] Task 31 (S): Complete the English local implementation handoff. Dependencies: English Tasks 1-30.
- [x] Task 32 (S, scope decision): No landing deployment or release-time landing validation is part of the current delivery flow.

### Checkpoint K

- [x] English local handoff is complete and honest about unavailable checks.
- [x] Landing delivery is complete after required pull request validation; production deployment is outside the current scope.
- [ ] Human approval covers visuals, all translations, media, accessibility, and production behavior.

## Approval Gates

- [ ] External WebVTT sidecars versus the no-caption-file video rule is explicitly resolved.
- [x] The final 60-fps MP4 and poster exist and are approved.
- [ ] All ten non-English locales have recorded proficient-speaker approval.
- [ ] Exact legacy/device and required screen-reader evidence is recorded or remains visibly incomplete.
- [x] No landing deployment or remote Pages mutation is required.
