# Implementation Plan: GitHub Pages Landing Page

## Overview

Build an isolated static landing page under `src/landing-page/`, emitted to `build/github-pages/` with base `/gpt-voice/`. It will follow the approved 1440x5332 and 390x6580 designs, pre-render eleven locales, embed the progressive demo, and generate matching SEO, accessibility, and TXT/LLM outputs. It must not enter Electron compilation, packaging, or runtime APIs.

Tasks 1-2 are fail-fast contract gates: current artifacts still contain removed-feature references, conflicting screenshot roles, and incompatible caption rules. Implementation stops at a verified local/deployable artifact unless deployment is separately authorized.

## Artifact Authority

| Concern                  | Inputs                                                                      | Required treatment                                                                             |
| ------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Product and architecture | `spec.md`, `assets/content-outline.md`                                      | Reconcile stale `#features`/screenshot prose before coding.                                    |
| Geometry                 | desktop/mobile SVGs, `layout-blueprint.json`                                | Preserve the rendered eight-part order and deterministic layouts.                              |
| Visual system            | `design-tokens.json`                                                        | Convert exactly to landing-owned semantic CSS tokens.                                          |
| Components               | `component-map.json`                                                        | Install and use every mapped shadcn component, with no extras.                                 |
| Behavior                 | `interaction-contract.json`                                                 | Implement only specified click, hover, focus, scroll, open/close, and reduced-motion behavior. |
| Locales                  | `localization-matrix.json`                                                  | Pre-render all eleven tag/route pairs; no runtime translation or redirect.                     |
| Plain text               | `txt-output-contract.json`                                                  | Generate all 24 TXT outputs from the HTML content model.                                       |
| Screenshots              | `capture-manifest.json`, `captures/*.png`                                   | Publish only `app-main.png`; retain four captures as reference-only.                           |
| Icons                    | interface/provider manifests and SVGs                                       | Verify pinned assets and copy only approved public files.                                      |
| Video                    | `docs/specs/readme-demo-video/spec.md`, future `assets/demo/*` deliverables | Consume the approved 60-fps MP4/poster; do not invent or silently alter them.                  |

When artifacts disagree, Tasks 1-2 update the approved contract instead of choosing an implementation ad hoc.

## Architecture Decisions

- React, strict TypeScript, Vite, Tailwind CSS, and landing-owned shadcn source use the root package/lockfile.
- English renders at `/gpt-voice/`; ten localized routes contain complete HTML without JavaScript or a router.
- Hydration is limited to navigation, locale selection, disclosures, tooltips, reveal enhancement, and deferred Plyr.
- Visible order is Navigation, Hero, Demo, How it works, Providers, FAQ, Final CTA, Footer; no Features or “Built for AI-assisted work” block.
- Only `app-main.png` is public; pinned icons and the 31-bar HTML/CSS waveform supply other graphics.
- Media is one `faststart` H.264/AAC MP4 at 60 fps with native fallback and lazy Plyr; no autoplay, HLS/DASH, or embedded subtitles.
- HTML, metadata/JSON-LD, WebVTT/transcripts subject to Task 2, and TXT share typed locale content.
- WCAG 2.2 AA, Lighthouse SEO/Accessibility 100, browser tiers, base-path safety, and transfer budgets are gates.
- `.github/workflows/pages.yml` may be prepared, but no push, deployment, publication, or Pages-setting mutation is authorized.

## Dependency Graph

```text
Contracts 1-2 -> foundation 3-5 -> components/assets 6-9
-> content/static shell 10-12 -> feature slices 13-18
-> locales 19-21 -> public outputs 22-24 -> quality 25-27
-> browser/evidence/workflow 28-30 -> local handoff 31
-> separately authorized production verification 32
```

## Phase 0: Contract Gates

### Task 1: Reconcile the visible-page artifact contract

**Description:** Remove stale requirements from the deleted feature inventory and align page order, screenshot roles, and SVG source history.

**Acceptance criteria:**

- [ ] No rendered contract contains `#features`, feature cards/rail, or non-hero public screenshots; `app-main.png` is the only public capture.
- [ ] Spec, outline, blueprint, manifest, and both SVGs agree on the eight visible areas and dimensions.
- [ ] Hidden `removed-feature-inventory-source` groups are deleted or explicitly classified as non-rendered editor history.

**Verification:**

- [ ] Prettier-check the edited Markdown/JSON and classify every focused search match for stale feature terms.
- [ ] Open both SVGs in the editor at 1440x5332 and 390x6580.

**Dependencies:** None.  
**Likely files:** `spec.md`, `assets/content-outline.md`, `assets/capture-manifest.json`, both landing SVGs.  
**Estimate:** M.

### Task 2: Resolve the landing media accessibility boundary

**Description:** Keep video production out of scope, authorize external WebVTT only as landing-page accessibility resources, and record final MP4/poster delivery as a hard gate for media-dependent landing tasks.

**Acceptance criteria:**

- [ ] The landing specification clearly distinguishes Pages-only WebVTT sidecars from prohibited burned-in/embedded subtitles and leaves the Remotion/README/LinkedIn deliverables untouched.
- [ ] Missing final MP4/poster are recorded as blockers for Tasks 9, 13, 23, and 27; when supplied, they must preserve 60 fps, `faststart`, H.264/AAC, no subtitle stream, no autoplay, and no HLS/DASH.

**Verification:**

- [ ] Confirm the landing-only exception and unchanged source-video boundary in `spec.md`.
- [ ] Confirm `assets/demo/` is absent or, when later supplied, run the specification’s two `ffprobe` commands before Task 9.

**Dependencies:** Task 1.  
**Likely files:** landing `spec.md`, `tasks/todo.md`.
**Estimate:** S.

### Checkpoint A: Tasks 1-2

- [ ] All landing artifacts and media rules are consistent and human-approved; absent final media remains a visible Task 9 gate.

## Phase 1: Isolated Frontend Foundation

### Task 3: Add the landing dependency and command boundary

**Description:** Pin approved packages, add landing-only scripts/ignores, and preserve Electron dependency/runtime behavior.

**Acceptance criteria:**

- [ ] Root package/lockfile is the sole exact dependency authority and exposes every specified `landing:*` command.
- [ ] Generated site/media/reports are ignored, excluded from desktop packaging, and never emitted to `dist/`.

**Verification:**

- [ ] Run `npm ci`, `npm ls --depth=0`, and assert required script keys.
- [ ] Run `npm run build:prod` and inspect `dist/` for landing artifacts.

**Dependencies:** Task 2.  
**Likely files:** `package.json`, `package-lock.json`, `.gitignore`, `eslint.config.mjs`.  
**Estimate:** M.

### Task 4: Configure Vite and strict TypeScript isolation

**Description:** Define landing Vite/TypeScript/browser configs, aliases, root, base, public path, and output boundary.

**Acceptance criteria:**

- [x] Vite roots at `src/landing-page/`, uses `/gpt-voice/`, and emits only to `build/github-pages/`.
- [x] Strict browser/Node configs and modern/legacy targets match the spec while Electron configs exclude landing source.

**Verification:**

- [x] Run `npm run landing:typecheck`, root `typecheck`, and `test:types`.
- [x] Run focused config assertions for root/base/output/aliases/exclusions.

**Dependencies:** Task 3.  
**Likely files:** `vite.landing.config.ts`, both landing tsconfigs, `.browserslistrc`, landing `index.html`.  
**Estimate:** M.

### Task 5: Establish landing tokens and shadcn ownership

**Description:** Initialize landing-owned shadcn configuration, utilities, semantic tokens, and global accessibility styles.

**Acceptance criteria:**

- [x] `components.json` targets only landing aliases; CSS matches token values, typography, spacing, radii, effects, and focus rules.
- [x] Global behavior supports dark scheme, skip link, 320-pixel reflow, forced colors, reduced motion, and system-font fallback.

**Verification:**

- [x] Run landing typecheck, lint, and format check.
- [x] Compare CSS variables directly with `design-tokens.json`.

**Dependencies:** Task 4.  
**Likely files:** `components.json`, `lib/utils.ts`, `styles/tokens.css`, `styles/globals.css`.  
**Estimate:** M.

### Checkpoint B: Tasks 3-5

- [x] Root install/Electron checks and the isolated landing shell pass together under `/gpt-voice/`.

## Phase 2: Components and Assets

### Task 6: Add shadcn action and surface primitives

**Description:** Add Button, Badge, and Card sources/variants for mapped CTA, status, and surface roles.

**Acceptance criteria:**

- [x] Semantics, focus, disabled/hover states, and token usage remain accessible and do not imply false card actions.
- [x] Variants cover `component-map.json` roles without duplicate bespoke controls.

**Verification:**

- [x] Run landing typecheck/lint and focused accessible-role/variant tests.
- [x] Keyboard-check focus in normal and forced-colors modes.

**Dependencies:** Task 5.  
**Likely files:** `components/ui/button.tsx`, `badge.tsx`, `card.tsx`.  
**Estimate:** M.

### Task 7: Add shadcn navigation primitives

**Description:** Add NavigationMenu, DropdownMenu, Sheet, Tooltip, and Separator for mapped navigation behavior.

**Acceptance criteria:**

- [ ] Radix keyboard navigation, dismissal, naming, focus return, and 44x44 target goal are preserved.
- [ ] Hover content is supplemental; navigation and locale actions work without hover.

**Verification:**

- [ ] Run landing typecheck/lint and focused open/close/keyboard tests.
- [ ] Manually test Escape, outside click, and trigger focus return.

**Dependencies:** Task 5.  
**Likely files:** five corresponding files under `components/ui/`.  
**Estimate:** M.

### Task 8: Add shadcn disclosure and media primitives

**Description:** Add AspectRatio, Accordion, Alert, Kbd, and Skeleton for the exact mapped media/disclosure roles.

**Acceptance criteria:**

- [ ] Disclosures retain pre-rendered content and keyboard semantics; Skeleton stays decorative and never replaces fallback content.
- [ ] Component inventory exactly matches `component-map.json`, with no omission or extra.

**Verification:**

- [ ] Run landing typecheck/lint and disclosure/no-JavaScript tests.
- [ ] Run the component-map inventory assertion.

**Dependencies:** Task 5.  
**Likely files:** five corresponding files under `components/ui/`.  
**Estimate:** M.

### Checkpoint C: Tasks 6-8

- [ ] The exact accessible shadcn inventory is installed with no Electron renderer imports.

### Task 9: Build the manifest-driven public asset pipeline

**Description:** Validate/copy approved icons, one public screenshot, video/poster, and generate deterministic image/social derivatives in ignored staging.

**Acceptance criteria:**

- [ ] Sync rejects missing/hash-drifted assets, reference-only screenshots, private data, remote files, streaming formats, and unapproved media.
- [ ] Only `app-main.png` gets fixed-geometry AVIF/WebP derivatives; generated output is ignored, reproducible, and base-path safe.

**Verification:**

- [ ] Run `landing:sync-media`, `landing:verify:media`, and negative manifest tests.
- [ ] Inspect generated images, poster, and icons for geometry, legibility, and privacy.

**Dependencies:** Tasks 2, 3, 8.  
**Likely files:** three landing build scripts, `tests/landing-page/media-assets.test.ts`, `.gitignore`.  
**Estimate:** M.

## Phase 3: Typed Content and Static Shell

### Task 10: Define English content and locale contracts

**Description:** Centralize the content schema, route registry, factual links, English copy, FAQ, and transcript cue model.

**Acceptance criteria:**

- [ ] Schema covers visible copy, controls, metadata, twelve FAQs, provider status, and cue IDs; English preserves all qualifications without version text.
- [ ] Registry exactly matches eleven tags, slugs, native names, canonicals, and font groups.

**Verification:**

- [ ] Run focused content tests and landing typecheck.
- [ ] Compare ordered IDs/copy with the outline, localization matrix, and TXT contract.

**Dependencies:** Tasks 1, 5.  
**Likely files:** content schema, registry, shared content, video transcripts, `locales/en.ts`.  
**Estimate:** M.

### Checkpoint D1: Tasks 9-10

- [ ] Approved assets synchronize and the English/route content contracts pass; missing media keeps later work blocked.

### Task 11: Render the pre-rendered locale route shell

**Description:** Implement server/client entries and static generation for complete semantic locale HTML without a router/server runtime.

**Acceptance criteria:**

- [ ] Eleven routes pre-render `lang`, landmarks, headings, links, FAQ, transcript, and native-video markup.
- [ ] JavaScript failure leaves content/links usable; output remains only in `build/github-pages/` with safe base paths.

**Verification:**

- [ ] Run locale generation/build plus route-output tests.
- [ ] Inspect English and one nested locale with JavaScript disabled.

**Dependencies:** Tasks 4, 8, 10.  
**Likely files:** both entries, locale routes, render composition, static-output generator.  
**Estimate:** M.

### Task 12: Deliver navigation and the hero slice

**Description:** Build the sticky header, locale-aware navigation, prompt-first hero, CTAs, approved screenshot, and decorative waveform.

**Acceptance criteria:**

- [ ] Hero states the prompt problem and faster/higher-quality/lower-effort AI-agent outcome; only `app-main.png` is displayed with correct responsive media semantics.
- [ ] Skip link, anchors, CTAs, typography, spacing, effects, and static 31-bar waveform match design/interaction contracts.

**Verification:**

- [ ] Run focused site tests and 390/1440 browser smokes with/without JavaScript.
- [ ] Compare Header/Hero screenshots with both SVGs.

**Dependencies:** Tasks 6, 7, 9, 11.  
**Likely files:** `LandingPage.tsx`, Header, Hero, VoiceWaveform, `site.test.tsx`.  
**Estimate:** M.

### Checkpoint D2: Tasks 11-12

- [ ] The static English shell, navigation, hero, assets, and native fallbacks build and work without JavaScript.

## Phase 4: Core Product Story

### Task 13: Deliver the progressive demo video slice

**Description:** Add reserved poster/video markup, approved locale accessibility media, adjacent transcript, lazy Plyr, and native fallback.

**Acceptance criteria:**

- [ ] MP4 never autoplays or loads prematurely; native controls survive Plyr failure and all controls/transcript are keyboard/locale accessible.
- [ ] No HLS/DASH request/dependency/segment or embedded/burned subtitle stream exists.

**Verification:**

- [ ] Run player tests and `landing:verify:media`, including a blocked Plyr chunk.
- [ ] Manually test controls, approved captions, speed, PiP/fullscreen capability, and transcript on desktop/mobile.

**Dependencies:** Tasks 2, 8, 9, 11.  
**Likely files:** DemoSection, DemoVideo, VideoTranscript, player helper, player test.  
**Estimate:** M.

### Task 14: Deliver the How it works slice

**Description:** Implement Speak, Translate, and Refine as the primary ordered flow, with Retry optional only after provider error.

**Acceptance criteria:**

- [ ] Copy explains clearer model input through translation and LLM-focused Prettify cleanup while preserving meaning.
- [ ] Retry branches only from transcription, resends stored audio, and connectors/shortcuts/reading order match both layouts.

**Verification:**

- [ ] Run focused workflow assertions and keyboard/screen-reader review.
- [ ] Compare the section at 390 and 1440 pixels with both SVGs.

**Dependencies:** Tasks 6, 8, 10, 11.  
**Likely files:** HowItWorksSection, WorkflowPath, English locale, site test.  
**Estimate:** M.

### Task 15: Deliver the provider signal-map slice

**Description:** Implement current provider routes, voice-input infographic, exact desktop/mobile connectors, and separate future horizon.

**Acceptance criteria:**

- [ ] ChatGPT Web/OpenAI API show simultaneously as available now with adjacent subscription qualification; provider marks are pinned.
- [ ] Mobile uses the exact vertical voice stack and one downward arrow; Claude/Gemini remain planned in a separate dashed group with no future connector.

**Verification:**

- [ ] Run focused provider semantic/layout tests with images/CSS disabled once.
- [ ] Compare waveform, 48-pixel desktop gutter/connectors, mobile arrow, labels, and marks with both SVGs.

**Dependencies:** Tasks 6, 9, 10, 11.  
**Likely files:** ProvidersSection, ProviderSignalMap, VoiceWaveform, site test.  
**Estimate:** M.

### Checkpoint E: Tasks 13-15

- [ ] Demo, workflow, and provider story work end-to-end with exact qualified claims and visual contracts.

## Phase 5: Completion and Enhancement

### Task 16: Deliver FAQ, final CTA, and footer

**Description:** Complete twelve functionality FAQs, prompt-first final CTA, Windows/Linux promotion, and factual footer links.

**Acceptance criteria:**

- [ ] Twelve approved answers remain pre-rendered when collapsed/without JavaScript; CTA/footer links are descriptive and valid.
- [ ] No version, LinkedIn copy, macOS promotion, false affiliation, hidden SEO copy, or unsupported claim appears.

**Verification:**

- [ ] Run FAQ/footer site tests and broken-link/anchor checks.
- [ ] Compare final section order and bottom geometry with both SVGs.

**Dependencies:** Tasks 6, 8, 10, 11.  
**Likely files:** FAQ, FinalCta, Footer, LandingPage, site test.  
**Estimate:** M.

### Task 17: Hydrate approved interactions

**Description:** Wire navigation, locale menu, disclosures, tooltips, hash preservation, focus return, and isolated progressive enhancement.

**Acceptance criteria:**

- [ ] All click/non-click, hover, focus, open/close, hash, and dismiss behavior matches `interaction-contract.json`.
- [ ] Links work without JavaScript; one failed enhancement cannot disable native video, locale links, or other controls.

**Verification:**

- [ ] Run interaction tests and full keyboard/Escape/focus-return review.
- [ ] Block enhancement chunks individually and verify fallbacks.

**Dependencies:** Tasks 7, 8, 11, 13, 16.  
**Likely files:** client entry, LanguageSelector, Header, locale-navigation helper, interaction test.  
**Estimate:** M.

### Task 18: Implement responsive and motion accessibility

**Description:** Add non-gating reveal, sticky offsets, responsive safeguards, reduced motion, forced colors, and text-spacing behavior.

**Acceptance criteria:**

- [ ] Reveal is mapped/one-time but content starts visible; reduced motion or absent observation removes transforms.
- [ ] No overflow at 320-1440; 200% zoom/text, 400% reflow, forced colors, focus, spacing, and orientation preserve operation.

**Verification:**

- [ ] Run focused accessibility tests and all specified width/zoom/preference manual checks.
- [ ] Verify every deep anchor lands below the sticky header.

**Dependencies:** Tasks 12-17.  
**Likely files:** reveal helper, accessibility preferences, global CSS, client entry, accessibility test.  
**Estimate:** M.

### Checkpoint F: Tasks 16-18

- [ ] The full English page passes interaction, no-JavaScript, keyboard, reduced-motion, and responsive review.

## Phase 6: Locale Content

### Task 19: Add reviewed Cyrillic dictionaries

**Description:** Add Russian, Belarusian, and Ukrainian complete dictionaries and transcript/control copy.

**Acceptance criteria:**

- [ ] All three have exact schema parity, no fallback copy, correct qualifications, and recorded proficient-speaker approval.
- [ ] Cyrillic glyphs/text expansion do not overflow target layouts.

**Verification:**

- [ ] Run localization tests and build all three routes.
- [ ] Inspect each at 390/1440 and record linguistic approval.

**Dependencies:** Tasks 10, 18.  
**Likely files:** `ru.ts`, `be.ts`, `uk.ts`, localization test.  
**Estimate:** M.

### Task 20: Add reviewed Latin-script dictionaries

**Description:** Add Spanish, Brazilian Portuguese, German, and French complete dictionaries.

**Acceptance criteria:**

- [ ] All four have exact mappings/schema parity, natural prompt-first language, equivalent qualifications, and recorded approval.
- [ ] Long localized labels wrap without truncation, overlap, or changed meaning.

**Verification:**

- [ ] Run localization tests and build all four routes.
- [ ] Inspect each at 390/1440 and record linguistic approval.

**Dependencies:** Tasks 10, 18.  
**Likely files:** `es.ts`, `pt-BR.ts`, `de.ts`, `fr.ts`, localization test.  
**Estimate:** M.

### Task 21: Add reviewed CJK and Hindi dictionaries

**Description:** Add Simplified Chinese, Japanese, and Hindi complete dictionaries with language-specific typography hooks.

**Acceptance criteria:**

- [ ] All three have exact mappings/schema parity, natural terminology/qualifications, and recorded proficient-speaker approval.
- [ ] CJK breaking and Devanagari shaping remain legible and overflow-free.

**Verification:**

- [ ] Run localization tests and build all three routes.
- [ ] Inspect at 390/1440 with fallback disabled and record linguistic approval.

**Dependencies:** Tasks 10, 18.  
**Likely files:** `zh-CN.ts`, `ja.ts`, `hi.ts`, localization test.  
**Estimate:** M.

### Checkpoint G: Tasks 19-21

- [ ] Eleven dictionaries pass schema/layout/glyph checks and each locale has recorded human approval.

## Phase 7: Locale-Aware Public Outputs

### Task 22: Generate locale font subsets

**Description:** Produce hashed WOFF2 subsets from actual locale text and validate route isolation, glyphs, fallbacks, and budgets.

**Acceptance criteria:**

- [ ] Specified Latin/Cyrillic/CJK/Devanagari/technical families have complete glyphs and only active-route references.
- [ ] Payloads meet locale budgets or carry an approved measured exception; network failure keeps readable fallback.

**Verification:**

- [ ] Run locale generation, glyph tests, and `landing:verify:sizes`.
- [ ] Simulate font failure on representative script routes.

**Dependencies:** Tasks 19-21.  
**Likely files:** subset script, global CSS, locale registry, font-subset test.  
**Estimate:** M.

### Task 23: Generate localized SEO and social output

**Description:** Generate route metadata, hreflang/canonical, JSON-LD, sitemap, robots, and the shared social image.

**Acceptance criteria:**

- [ ] Every route has self-canonical, eleven reciprocal alternates plus `x-default`, localized social metadata, and absolute safe URLs.
- [ ] Required JSON-LD nodes match visible facts; sitemap/robots/social data contain no version, stale route, crawler-only, or unverified claim.

**Verification:**

- [ ] Run `landing:verify:seo` and focused SEO tests.
- [ ] Validate generated HTML/JSON-LD and representative script routes manually.

**Dependencies:** Tasks 9, 11, 19-22.  
**Likely files:** three SEO helpers, SEO generator, SEO test.  
**Estimate:** M.

### Task 24: Generate equivalent TXT and LLM outputs

**Description:** Generate all 24 required files from shared dictionaries/cues with strict normalization, order, digest, and linkage.

**Acceptance criteria:**

- [ ] Paths are UTF-8/no-BOM, LF, NFC, one trailing newline, and reciprocally linked to the correct HTML route.
- [ ] Ordered IDs/digest prove HTML/TXT equivalence with all qualifications and no crawler-only copy.

**Verification:**

- [ ] Run `landing:generate-txt` and TXT output tests.
- [ ] Serve and verify plain-text MIME/Unicode round-trip for Latin, Cyrillic, CJK, and Devanagari.

**Dependencies:** Tasks 10, 19-23.  
**Likely files:** TXT generator, output validator, content schema, TXT test.  
**Estimate:** M.

### Checkpoint H: Tasks 22-24

- [ ] Eleven HTML routes and 24 TXT files pass font, SEO, structured-data, link, and content-parity checks.

## Phase 8: Optimization and Automated Gates

### Task 25: Enforce optimized modern and legacy builds

**Description:** Configure minification, CSS lowering, HTML post-processing, locale splitting, legacy polyfills, lazy Plyr, and budgets.

**Acceptance criteria:**

- [ ] Modern routes omit legacy/Core-JS; legacy targets receive usage-based SystemJS/polyfills and readable fallback behavior.
- [ ] Manifest checks enforce all HTML/JS/CSS/media/font budgets, locale isolation, lazy Plyr, no source maps/duplicate React/remote assets.

**Verification:**

- [ ] Run browser-support/size verifiers and inspect manifest/network waterfall.
- [ ] Build twice and compare deterministic outputs where hashes should remain stable.

**Dependencies:** Tasks 11, 13, 18, 22-24.  
**Likely files:** Vite config, HTML minifier, browser verifier, size verifier, browser-support test.  
**Estimate:** M.

### Task 26: Complete static and content contract tests

**Description:** Cover schema, full pre-rendered markup, component usage, semantics, links/images, base paths, claims, and dependency boundaries.

**Acceptance criteria:**

- [ ] Every locale passes semantic/content/output assertions and `html-validate` without unexplained suppression.
- [ ] Tests reject version/hidden copy, missing qualifications, reference captures, unapproved components/dependencies, and Electron imports.

**Verification:**

- [ ] Run all landing unit/static tests, build, and SEO verification.
- [ ] Run landing typecheck, lint, and format check.

**Dependencies:** Tasks 12-25.  
**Likely files:** content, localization, site, output-contract tests, output validator.  
**Estimate:** M.

### Task 27: Complete deterministic media verification

**Description:** Enforce capture/icon hashes, progressive-video properties, approved cue policy, no streaming, lazy loading, geometry, and inventory.

**Acceptance criteria:**

- [ ] Verification rejects subtitle streams, HLS/DASH, transport segments, premature loads, autoplay, hash drift, and private/unapproved files.
- [ ] Video/poster/images and approved locale accessibility media meet codec, dimensions, privacy, size, cue, and comprehension contracts.

**Verification:**

- [ ] Run `landing:verify:media`, both `ffprobe` commands, media/player tests.
- [ ] Review poster/first frame/playback/transcript and muted comprehension manually.

**Dependencies:** Tasks 9, 13, 19-24.  
**Likely files:** media verifier/sync, media/player tests, video transcript content.  
**Estimate:** M.

### Checkpoint I: Tasks 25-27

- [ ] Optimized build and all static, content, browser, size, SEO, and media gates pass without private/remote/Electron output.

## Phase 9: Browser, Accessibility, and Delivery Evidence

### Task 28: Add responsive browser end-to-end coverage

**Description:** Cover specified viewports/locales, links/anchors, interactions, media fallback/network timing, browser tiers, orientation, and overflow.

**Acceptance criteria:**

- [ ] Chromium covers 320/390/768/1024/1440 and current Chromium/Firefox/WebKit cover modern behavior.
- [ ] Eleven locale smokes plus Russian/German/Chinese/Japanese/Hindi snapshots cover no-JS, blocked Plyr, preferences, zoom/reflow, and media timing.

**Verification:**

- [ ] Run `landing:test:e2e` against production preview and review snapshots.
- [ ] Record representative legacy Chromium/Safari evidence or leave the unavailable check incomplete.

**Dependencies:** Tasks 17-27.  
**Likely files:** Playwright config and four focused E2E specs.  
**Estimate:** M.

### Task 29: Complete accessibility and local CloakBrowser evidence

**Description:** Run axe/manual accessibility and required CloakBrowser MCP checks against an isolated local production preview.

**Acceptance criteria:**

- [ ] Axe has zero violations across locales/representative states; keyboard, focus, contrast, zoom/reflow, spacing, motion, media, and sampled screen readers meet WCAG 2.2 AA.
- [ ] Fresh-profile CloakBrowser evidence covers 1440x1000/390x844 English, locale smokes, interactions, clean console/network, base paths, and privacy.

**Verification:**

- [ ] Run `landing:verify:a11y` and the full local CloakBrowser checklist.
- [ ] Compare full-page English captures with both SVGs and record URL/commit/viewport/locale/state/findings.

**Dependencies:** Tasks 18, 21, 27, 28.  
**Likely files:** accessibility verifier, unit/E2E accessibility tests, task handoff; evidence stays ignored.  
**Estimate:** M.

### Task 30: Add the GitHub Pages workflow

**Description:** Add the least-privilege, path-filtered official Pages build/deploy workflow without authorizing remote execution.

**Acceptance criteria:**

- [ ] Node 24/root `npm ci` job runs all landing generation/tests/verifiers before uploading `build/github-pages/`.
- [ ] Workflow has specified permissions/concurrency and never writes `gh-pages`, commits output, exposes secrets, or packages/tests providers.

**Verification:**

- [ ] Run actionlint and a local equivalent of all build-job commands.
- [ ] Inspect triggers, permissions, environment, concurrency, scripts, and artifact root.

**Dependencies:** Tasks 3, 25-29.  
**Likely files:** `.github/workflows/pages.yml`, `package.json`, workflow test.  
**Estimate:** M.

### Checkpoint J: Tasks 28-30

- [ ] Browser, locale, accessibility, media, and local CloakBrowser evidence passes; workflow validates without remote mutation.

## Phase 10: Handoff and Authorized Production Verification

### Task 31: Complete the local implementation handoff

**Description:** Run complete landing/root checks and record changed files, approvals, evidence, budgets, incomplete platform checks, and blockers.

**Acceptance criteria:**

- [ ] Clean local install/build passes all available landing and root regression checks without unexpected Electron output.
- [ ] Handoff honestly records visual, media, locale, accessibility, browser, budget, and CloakBrowser status; generated/private files remain ignored.

**Verification:**

- [ ] Run every required `landing:*` command and the root quality command set from the specification.
- [ ] Inspect output inventory for eleven HTML routes, 24 TXT files, media/metadata/assets, and absence rules.

**Dependencies:** Tasks 1-30.  
**Likely files:** `tasks/handoff.md`, `tasks/todo.md`.  
**Estimate:** S.

### Task 32: Verify an explicitly authorized production deployment

**Description:** After separate authorization and all human gates, verify the deployed Pages URL; this task does not infer permission to push or change settings.

**Acceptance criteria:**

- [ ] All HTML/TXT/media/metadata/deep-link URLs and MIME types work; CloakBrowser console/network evidence is clean.
- [ ] Sample Lighthouse SEO/Accessibility scores are 100, budgets pass, and required keyboard/media/screen-reader/indexability checks are recorded.

**Verification:**

- [ ] Run deployed CloakBrowser checks and Lighthouse on English, Cyrillic, CJK, and Hindi mobile/desktop samples.
- [ ] Validate production HTML, JSON-LD, MIME/Unicode, canonical/indexability, and broken resources.

**Dependencies:** Task 31, explicit authorization, visual/media approval, all locale approvals, and required accessibility/device evidence.  
**Likely files:** `tasks/handoff.md`, `tasks/todo.md`.  
**Estimate:** S.

### Checkpoint K: Tasks 31-32

- [ ] Local handoff may complete without deployment; production completes only after authorization and all evidence/human approvals.

## Risks and Mitigations

| Risk                                                | Impact | Mitigation                                                                    |
| --------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Stale feature/screenshot contracts                  | High   | Task 1 reconciliation and approval before code.                               |
| WebVTT versus no-caption conflict                   | High   | Task 2 makes one explicit cross-spec rule.                                    |
| MP4/poster currently absent                         | High   | Hard-block media-dependent Tasks 9, 13, 23, 27+.                              |
| Overstated provider/subscription claim              | High   | Shared facts and visible/HTML/TXT/JSON-LD parity tests.                       |
| Translation drift/layout failure                    | High   | Typed parity, snapshots, glyph checks, proficient-speaker approval.           |
| Font/media budgets harm legibility                  | Medium | Measure early; request approval instead of silently degrading quality/60 fps. |
| Legacy payload leaks to modern clients              | Medium | Explicit targets, usage-based polyfills, manifest/network assertions.         |
| `/gpt-voice/` paths break nested routes             | High   | Central path helpers, deep-route tests, deployed verification.                |
| Public assets expose private data                   | High   | Hash allowlists, isolated profiles, manual review, ignored evidence.          |
| Legacy/device/screen-reader environment unavailable | Medium | Mark incomplete and block production sign-off; never infer passing.           |
| Landing dependencies regress Electron               | Medium | Isolated configs plus root checks at foundation/final checkpoints.            |

## Approval Gates and Open Questions

1. Approve whether external, user-toggleable WebVTT sidecars are allowed for landing accessibility while burned-in/embedded subtitles remain prohibited; otherwise revise the accessibility solution.
2. Complete and approve the currently absent `assets/demo/gpt-voice-demo.mp4` and poster.
3. Assign proficient-speaker approval for every non-English locale.
4. Retain `https://swimmwatch.github.io/gpt-voice/` unless a custom domain is explicitly approved before Task 23.
5. Provide separate authorization before any push, Pages-setting change, deployment, or Task 32.

## Plan Verification

- [ ] All 32 tasks have a description, at most three acceptance criteria, verification, dependencies, no more than five likely files, and XS/S/M estimates only.
- [ ] Checkpoints occur after every two or three tasks and every artifact/media dependency has an owner.
- [ ] Human approval is required before Task 1 implementation begins.
