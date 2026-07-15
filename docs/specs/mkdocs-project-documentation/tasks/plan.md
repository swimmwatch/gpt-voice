# Implementation Plan: MkDocs Project Documentation And GitHub Pages Integration

**Status:** Incremental implementation in progress — Tasks 1–14, 6a, and 14b–14c are complete; Task 14a has a
complete staged Russian source set and staged Belarusian core pages. Both locales remain blocked pending complete
source sets and proficient-speaker review; eight further locale source sets are not yet staged
**Specification:** `docs/specs/mkdocs-project-documentation/spec.md`
**Estimated implementation:** 75–98 focused engineering hours, plus recorded proficient-speaker review for each
non-English locale and the content/privacy/CI/deployment review
**Implementation authorization:** The user approved the CloakBrowser reference-derived visual treatment; Tasks 14b and
14c are complete. The production locale gate remains English-only until Task 14a records complete reviewed
translations.

## Overview

Build an eleven-language MkDocs Material user guide rooted at `/gpt-voice/docs/`, connect the active English Vite
landing to the English guide, reserve tested locale-matched documentation routes for any future landing locales,
validate both surfaces together, and publish one GitHub Pages artifact from the release workflow. English is the
source language; the guide does not claim that the desktop application supports all eleven UI languages. The plan
uses Material for MkDocs as the native documentation UI and matches the landing through its palette and shared product
identity. It adopts the user-authorized, reference-derived content treatment without replacing Material's structural
UI. It preserves the current PR-only English landing checks, the intentional removal of
`.github/workflows/pages.yml`, the Electron/runtime boundary, and all unrelated worktree changes.

The baseline publishes only the already approved `app-main.png` capture. Expanded provider, settings, history,
browser, or network screenshots require a separate public-use decision and are not dependencies for this plan.

## Architecture Decisions

- Public MkDocs input is isolated at `docs/user-guide/`; internal `docs/specs/`, `docs/researches/`, handoffs, agent
  guides, and design artifacts can never enter the site through a broad `docs_dir`.
- MkDocs uses Python 3.12, pinned `docs/requirements.txt`, Material 9.7.6, strict builds, local search, local assets,
  and no runtime CDN or hosted service.
- Material owns documentation layout, navigation, search, typography scale, structural components, spacing,
  breakpoints, focus behavior, and motion. Repository CSS uses the approved landing palette and local font/glyph
  declarations, plus a tested reference-derived content allowlist for buttons, wordmark, hero actions, screenshots,
  cards, and inline code.
- MkDocs uses a pinned, tested `mkdocs-static-i18n` release with suffix-based localized Markdown, localized Material
  navigation/search, and no browser-language redirect. The public route matrix exactly matches the landing registry:
  `en`, `ru`, `be`, `uk`, `es`, `pt-BR`, `zh-CN`, `ja`, `de`, `fr`, and `hi`; public `pt-br` and `zh-cn` routes are
  normalized explicitly rather than inferred from the reference project's `zh` route.
- English Markdown is the factual source of truth. A non-public translation manifest records each localized source
  hash and review; missing or stale translations block that locale's build. The build never calls a translation API or
  requires translation credentials.
- Asset staging includes local Noto Sans SC, Noto Sans JP, and Noto Sans Devanagari in addition to the existing
  Latin/Cyrillic and monospace fonts, so every approved locale has complete local glyph coverage.
- Vite remains the artifact owner: it builds first and empties `build/github-pages/`; MkDocs then writes only to
  `build/github-pages/docs/`.
- Root npm scripts provide one cross-platform entry point for docs authoring, docs validation, combined Pages build,
  and Pages browser tests. Python remains isolated in `.venv-docs/`.
- A deterministic asset-sync script validates source hashes and stages the icon, fonts, and approved main screenshot
  into an ignored MkDocs asset directory. No new screenshot is captured by this baseline.
- Documentation prose is split by user journey and settings surface. Released renderer/shared contracts are factual
  sources, but no application code or generated setting model is coupled to MkDocs at runtime.
- The active landing navigation uses the typed `LandingLinks` content contract and `/gpt-voice/docs/`. A pure,
  base-path-safe route helper is tested against the same locale matrix for future separately approved landing
  localizations: `/gpt-voice/docs/` for English and `/gpt-voice/docs/<locale-slug>/` elsewhere.
- PR validation remains non-deploying in `.github/workflows/pr-checks.yml`. Release-gated Pages jobs are added to
  `.github/workflows/release-builds.yml`; `.github/workflows/pages.yml` stays absent.
- Root landing crawl metadata and MkDocs crawl metadata remain distinct: root robots references both sitemaps, and
  the landing plain-text index links to the guide.
- Deployment and post-deployment verification are separate, authorization-gated work. Local implementation can be
  completed and reviewed without publishing a release or changing repository Pages settings.

## Dependency Graph

```text
Tasks 1–6: English guide foundation and first user journey (complete)
  |
  v
Task 6a: multilingual MkDocs foundation and route contract
  |
  v
Tasks 7–12: complete English guide and settings journeys
  |
  v
Task 13: content/coverage contracts
  |------------------------------|------------------------------|
  v                              v                              v
Task 14: README link       Task 14a: translated-guide     Task 14b: restore Material-native
                           batches/review validation      baseline contract
                                  |                              |
                                  |                              v
                                  |                       Task 14c: reference-derived visual treatment
                                  |                              |
                                  |------------------------------|
                                                 v
                                       Task 15 -> Task 16
                                  locale contract  landing entry points
                                                 |
                                                 v
       Task 17 -> Task 18 -> Task 19
       localized TXT  crawl metadata  combined Pages artifact
                                      |
                                      v
                                   Task 20
                   English landing + all-docs browser/a11y journey
                                      |
                                      v
                                   Task 21 -> Task 22
                             PR validation   release-gated deployment
                                      |
                                      v
                                   Task 23 -> Task 24
                             local review    authorized production verification
```

English Markdown authoring for Tasks 7–12 can run in independent focused sessions after Task 6a. Their explicit
navigation entries must be merged sequentially by the `mkdocs.yml` owner so every intermediate strict build remains
green. Task 14a translates only complete, source-reviewed English content in small locale/page batches and blocks
publication until every manifest record and linguistic review is complete. Task 14b established the Material baseline;
Task 14c then owned the reference-derived visual treatment, logo staging, and theme contract. Tasks 15–16 begin only
after Tasks 14a, 14b, and 14c pass. All integration work from Task 19 onward is sequential.

## Phase 1: Contract And Foundation

### Task 1: Reconcile The Cross-Spec Contract

**Description:** Finalize the accepted defaults and keep the documentation and landing specifications consistent
about the current PR-only state, future release-gated deployment, artifact order, route, locale, and screenshot scope.

**Acceptance criteria:**

- [x] Both specs identified `/gpt-voice/docs/`, the original English/main-screenshot baseline, Vite-first artifact
      order, PR-only validation, and future release-workflow deployment without recreating `pages.yml`. The later
      eleven-locale revision is owned by Task 6a and the current cross-spec update.
- [x] The documentation spec is marked approved for implementation only after the human approves this plan.
- [x] Existing landing-spec changes are preserved without duplication or contradictory active-state claims.

**Verification:**

- [x] Run `git diff --check -- docs/specs/mkdocs-project-documentation docs/specs/github-pages-landing-page/spec.md`.
- [x] Manually compare the deployment, boundaries, and success-criteria sections in both specs.

**Dependencies:** None.
**Files likely touched:** `docs/specs/mkdocs-project-documentation/spec.md`,
`docs/specs/github-pages-landing-page/spec.md`.
**Estimated scope:** S, 30–45 minutes, 2 files.

### Checkpoint A: Approved Contract

- [x] Human approves this plan and the accepted specification defaults.
- [x] No application, workflow, dependency, or generated-output change has occurred.

### Task 2: Deliver A Minimal Strict Guide

**Description:** Establish a complete, locally buildable MkDocs slice with pinned Python dependencies, root scripts,
an isolated public source directory, an overview placeholder containing real approved content, and ignored local
outputs.

**Acceptance criteria:**

- [x] `mkdocs.yml` uses `docs/user-guide`, `build/github-pages/docs`, the canonical docs URL, explicit initial nav,
      local search, strict-compatible configuration, and no internal docs directory.
- [x] Pinned requirements and npm scripts install, serve, and build through `.venv-docs` without global MkDocs.
- [x] The minimal overview builds successfully and `.venv-docs`, caches, staged assets, and output remain ignored.

**Verification:**

- [x] Run `npm run docs:install`.
- [x] Run `npm run docs:build` and inspect `build/github-pages/docs/index.html`.
- [x] Run `git status --short` to confirm no environment or generated output is tracked.

**Dependencies:** Task 1.
**Files likely touched:** `mkdocs.yml`, `docs/requirements.txt`, `docs/user-guide/index.md`, `package.json`, `.gitignore`.
**Estimated scope:** M, 90–120 minutes, 5 files.

### Task 3: Guard The Public Source Boundary

**Description:** Add deterministic Node tests that prove MkDocs configuration and output cannot expose internal
engineering artifacts and that the initial metadata/navigation contract is correct.

**Acceptance criteria:**

- [x] Tests reject a docs root broader than `docs/user-guide` and assert canonical site/output paths.
- [x] Generated output contains expected metadata/navigation and no spec, research, agent, handoff, or private paths.
- [x] `npm run docs:test` executes the documentation test directory through the repository's `node:test` stack.

**Verification:**

- [x] Demonstrate the test fails when `docs_dir` is temporarily pointed at `docs`, then restore it.
- [x] Run `npm run docs:build && npm run docs:test`.

**Dependencies:** Task 2.
**Files likely touched:** `tests/documentation/mkdocsOutput.test.ts`, `package.json`.
**Estimated scope:** S, 45–75 minutes, 2 files.

### Checkpoint B: Isolated Build

- [x] A strict guide builds at the planned subpath.
- [x] Internal engineering content is proven absent.
- [x] The root Electron build and packaging inputs are unchanged.

### Task 4: Stage Approved Documentation Assets

**Description:** Implement the deterministic asset pipeline for the repository icon, pinned local fonts, and the
already public main screenshot, including manifest/hash/dimension checks and ignored output staging.

**Acceptance criteria:**

- [x] Asset sync validates source containment, hashes, dimensions, allowed files, and the main screenshot's approved
      public-use status before writing.
- [x] Only local icon/font/main-screenshot derivatives enter the staged MkDocs assets; reference-only captures are
      rejected.
- [x] Staged files are deterministic, ignored, and covered by failure-path tests for missing/tampered sources.

**Verification:**

- [x] Run `npm run docs:sync-assets` twice and compare hashes.
- [x] Run `node --import tsx --test tests/documentation/docsAssets.test.ts`.
- [x] Confirm reference-only capture names do not occur under staged or built docs assets.

**Dependencies:** Tasks 2–3.
**Files likely touched:** `scripts/sync-docs-assets.mjs`, `tests/documentation/docsAssets.test.ts`, `package.json`,
`.gitignore`.
**Estimated scope:** M, 90–120 minutes, 4 files.

### Task 5: Apply The Product Theme

**Historical note:** This completed slice implemented the earlier broader styling contract. Task 14b later established
the Material-native baseline; Task 14c then added the user-authorized CloakBrowser reference-derived content treatment
and its regression contract.

**Description:** Configure Material features and repository-owned CSS so the guide shares the landing identity while
retaining accessible MkDocs navigation, local search, responsive content, and restrained motion.

**Acceptance criteria:**

- [x] Theme uses approved graphite/blue tokens, local Ubuntu Sans/JetBrains Mono, GPT-Voice icon, 10-pixel controls,
      visible focus, reduced-motion behavior, and no remote runtime asset.
- [x] Overview shows the approved optimized main screenshot with dimensions, alt text, caption, and nearby task links.
- [x] Desktop/mobile layout, local search, table of contents, drawer, and home/repository/release links remain usable.

**Verification:**

- [x] Run `npm run docs:sync-assets && npm run docs:build && npm run docs:test`.
- [x] Inspect the local guide at 320, 390, 768, and 1440 CSS pixels with external requests recorded.

**Dependencies:** Task 4.
**Files likely touched:** `docs/user-guide/assets/stylesheets/extra.css`, `mkdocs.yml`, `docs/user-guide/index.md`,
`tests/documentation/mkdocsOutput.test.ts`.
**Estimated scope:** M, 90–120 minutes, 4 files.

### Checkpoint C: Branded Foundation

- [x] Strict build, boundary tests, and asset tests pass.
- [x] Only the approved main capture is public.
- [x] The user confirmed the initial landing/docs visual relationship before bulk authoring.

## Phase 2: User Documentation Slices

### Task 6: Publish The Installation Journey

**Description:** Write release-download, checksum, Windows, deb, rpm, AppImage, update, uninstall, retained-data, and
first-launch guidance as one complete new-user path.

**Acceptance criteria:**

- [x] Installation instructions match current package names, supported Windows/Linux artifacts, checksum files, and
      the paused macOS status.
- [x] Update/uninstall steps clearly distinguish application removal from retained local settings/session data.
- [x] Getting Started reaches a configured provider and first clipboard result with visible success/failure cues.

**Verification:**

- [x] Run `npm run docs:build` with no documentation warnings or broken internal links. The pinned Material package's
      future-release notice is external to this guide and does not affect the strict build.
- [x] Manually compare package commands and first-launch flow with `README.md`, package metadata, and current UI.

**Dependencies:** Task 5.
**Files likely touched:** `docs/user-guide/install.md`, `docs/user-guide/getting-started.md`,
`docs/user-guide/index.md`, `mkdocs.yml`, `tests/documentation/mkdocsOutput.test.ts`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Task 6a: Establish The Multilingual MkDocs Foundation

**Description:** Replace the English-only documentation configuration with a static, suffix-based MkDocs locale
implementation modeled on the relevant `cloakbrowser-mcp` approach, while preserving GPT-Voice's isolated public
source boundary and landing route matrix.

**Acceptance criteria:**

- [x] A pinned `mkdocs-static-i18n` dependency configures the eleven approved locales, translated Material navigation,
      localized search, an accessible language selector, strict no-fallback publication, and no browser-language redirect.
      The production build is intentionally limited to English while translations remain blocked.
- [x] The public roots, source suffixes, and `pt-BR`/`zh-CN` lowercase route adapters exactly match the Localization
      Contract; no `/zh/`, mixed-case public route, alias, or English fallback can be generated.
- [x] The docs asset pipeline stages the local Chinese, Japanese, and Devanagari fonts; locale configuration and the
      translation manifest are excluded from the public output.
- [x] A locale contract test compares MkDocs configuration and output against the landing registry, detects missing
      locale pages/navigation/fonts, and proves internal engineering artifacts remain absent.

**Verification:**

- [x] Run the localized strict MkDocs build with fixtures for every locale and assert all expected roots/canonicals.
- [x] Run the locale, asset, and public-boundary contract tests, including representative missing-page, stale-manifest,
      wrong-slug, and fallback mutations.

**Dependencies:** Task 6 and this revised specification.
**Files likely touched:** `docs/requirements.txt`, `mkdocs.yml`, `scripts/sync-docs-assets.mjs`,
`tests/documentation/localeContract.test.ts`, `tests/documentation/docsAssets.test.ts`.
**Estimated scope:** L, 150–210 minutes, 5 files.

### Task 7: Publish The Transcription Path

**Description:** Document the complete recording lifecycle and both transcription-provider paths, including retry,
clipboard/history output, authentication clearing, quotas, and failure behavior.

**Acceptance criteria:**

- [x] Start, pause, resume, stop, cancel, submit, retry, notification, clipboard, and history states match released
      behavior and shortcut semantics.
- [x] ChatGPT Web and OpenAI API setup, switching, clearing, billing/account ownership, and provider-controlled limits
      remain factually qualified.
- [x] Retry invalidation and in-memory retention are described without permanent-audio or quota-bypass implications.

**Verification:**

- [x] Run `npm run docs:build`.
- [x] Review against `useRecording`, provider settings UI, retry state contracts, and current landing claims.

**Dependencies:** Task 6a.
**Files likely touched:** `docs/user-guide/guides/transcription.md`, `docs/user-guide/guides/providers.md`,
`mkdocs.yml`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Task 8: Publish The Text-Action Workflow

**Description:** Document translation, Prettify operation, selection/clipboard behavior, history reuse/clearing, tray
entry points, and relevant platform qualifications.

**Acceptance criteria:**

- [x] Translation and Prettify prerequisites, enable switches, target language, selection behavior, result handling,
      and error states are explicit.
- [x] Ollama/vLLM services are described as user-operated dependencies, with remote-endpoint privacy qualification.
- [x] History/tray guidance matches progressive loading, recopy, clear, lifecycle, and available menu actions.

**Verification:**

- [x] Run `npm run docs:build`.
- [x] Review against text-action settings, selection automation, history renderer/contracts, and tray menu code.

**Dependencies:** Task 6a.
**Files likely touched:** `docs/user-guide/guides/text-actions.md`,
`docs/user-guide/guides/history-and-tray.md`, `mkdocs.yml`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Checkpoint D: Operational Guide

- [x] Installation, first launch, transcription, providers, text actions, history, and tray form complete linked
      journeys.
- [x] No instruction requires source code, credentials, or undocumented UI knowledge.
- [x] Strict build passes after Tasks 6–8.

### Task 9: Publish The Core Settings Reference

**Description:** Create the settings entry point plus authoritative provider and shortcut/action pages, including
save/dirty/error lifecycle and all provider authentication controls.

**Acceptance criteria:**

- [x] Settings overview explains navigation, dirty state, validation, save progress, close blocking, and discard
      confirmation.
- [x] Provider reference covers ChatGPT session controls and every OpenAI key/model/language/prompt/temperature action.
- [x] Shortcut reference covers all six targets, released defaults, capture/change flow, conflicts, and action enables.

**Verification:**

- [x] Run `npm run docs:build`.
- [x] Review field-by-field against provider modal, `ShortcutsSection`, hotkey defaults, and settings-close state.

**Dependencies:** Task 6a.
**Files likely touched:** `docs/user-guide/settings/index.md`, `docs/user-guide/settings/providers.md`,
`docs/user-guide/settings/shortcuts.md`, `mkdocs.yml`.
**Estimated scope:** M, 90–120 minutes, 4 files.

### Task 10: Publish The Prettify Reference

**Description:** Document every Prettify connection, model-memory, prompt, primary generation, and advanced generation
control with defaults, ranges, dependencies, persistence, validation, and privacy effects.

**Acceptance criteria:**

- [x] Ollama/vLLM provider, base URL, vLLM key, model refresh/selection, load/free, VRAM status, and errors are covered.
- [x] Temperature, top P, min P, repeat penalty, top K, maximum output tokens, seed, and prompt use source-derived
      defaults/ranges.
- [x] Loopback versus remote endpoint behavior and secret storage are accurately qualified.

**Verification:**

- [x] Run `npm run docs:build`.
- [x] Review every row against `PrettifySection`, shared defaults/validation, and persistence services.

**Dependencies:** Task 6a.
**Files likely touched:** `docs/user-guide/settings/prettify.md`, `mkdocs.yml`.
**Estimated scope:** S, 60–90 minutes, 2 files.

### Task 11: Publish The Browser-Network Reference

**Description:** Document CloakBrowser behavior/identity and proxy configuration as one dependency-aware settings
slice, including GeoIP ownership and protocol-specific warnings.

**Acceptance criteria:**

- [x] Humanization, preset, background mode, fingerprint seed/reset, locale, and timezone use released values/defaults.
- [x] Proxy enablement, server, bypass, username, password, GeoIP, storage, and SOCKS5 credential warning are complete.
- [x] Locale/timezone disabled-state behavior under proxy GeoIP is explained consistently on both pages.

**Verification:**

- [x] Run `npm run docs:build`.
- [x] Review against `BrowserSection`, `NetworkSection`, shared CloakBrowser settings, validation, and persistence.

**Dependencies:** Task 6a.
**Files likely touched:** `docs/user-guide/settings/browser.md`, `docs/user-guide/settings/network.md`, `mkdocs.yml`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Checkpoint E: Settings Guide

- [x] Every visible settings surface has an authoritative page.
- [x] Defaults/ranges come from released contracts, not screenshots or stale prose.
- [x] Strict build passes after Tasks 9–11.

### Task 12: Publish The Support Reference

**Description:** Complete privacy/data, troubleshooting, and FAQ pages that route users to authoritative procedures
without duplicating or weakening provider, data-retention, or platform qualifications.

**Acceptance criteria:**

- [x] Privacy page maps remote flows, local files, encryption qualifications, sensitive data, retry cache, and reset.
- [x] Troubleshooting covers microphone, session, API, model, proxy, shortcut, clipboard, installer, and browser runtime
      symptoms with safe diagnostics.
- [x] FAQ gives concise factual answers and descriptive links to the authoritative guide/settings pages.

**Verification:**

- [x] Run `npm run docs:build`.
- [x] Review against README privacy/install facts, storage services, notification errors, and supported package behavior.

**Dependencies:** Tasks 6a–11.
**Files likely touched:** `docs/user-guide/privacy.md`, `docs/user-guide/troubleshooting.md`, `docs/user-guide/faq.md`,
`mkdocs.yml`.
**Estimated scope:** M, 90–120 minutes, 4 files.

### Task 13: Enforce Documentation Coverage

**Description:** Add content, terminology, navigation, settings-mapping, and maintenance contracts so future behavior
changes cannot silently leave a public field undocumented or reintroduce prohibited claims.

**Acceptance criteria:**

- [x] A machine-readable test mapping covers every released provider/app setting exactly once on an authoritative page.
- [x] Tests enforce required pages/headings, reviewed-release markers, current defaults/shortcuts, terminology, platform
      status, affiliation/license/quota qualifications, screenshot alternatives, and descriptive links.
- [x] Tests fail when a mapped setting or required qualification is removed and pass with the complete guide.

**Verification:**

- [x] Demonstrate one representative settings-coverage failure and one prohibited-claim failure, then restore sources.
- [x] Run `npm run docs:test` and `npm run docs:build`.

**Dependencies:** Tasks 6a–12.
**Files likely touched:** `tests/documentation/contentContract.test.ts`,
`tests/documentation/settingsCoverage.test.ts`, `tests/documentation/fixtures/settings-coverage.json`.
**Estimated scope:** M, 90–120 minutes, 3 files.

### Task 14: Link The README

**Description:** Add one prominent public-guide destination while keeping README as the concise repository,
installation, development, and contribution entry point.

**Acceptance criteria:**

- [x] README links to `https://swimmwatch.github.io/gpt-voice/docs/` near its user-facing introduction/navigation.
- [x] Existing installation/development facts remain, while the link clearly identifies the full user/settings guide.
- [x] Documentation content tests assert the stable public destination without duplicating the guide in README.

**Verification:**

- [x] Run `npm run docs:test`.
- [x] Manually check the rendered README link and surrounding copy.

**Dependencies:** Task 13.
**Files likely touched:** `README.md`, `tests/documentation/contentContract.test.ts`.
**Estimated scope:** XS, 20–30 minutes, 2 files.

### Task 14a: Publish Complete Translated-Guide Batches

**Description:** Produce the ten non-English static guide variants only after their English source pages are complete.
For each locale, translate every public page, localized title/description/navigation/search label, and applicable
image alternative; update the non-public source-hash manifest; and obtain a recorded proficient-speaker review. This
is a parent delivery gate executed as small, independently buildable page batches, not one bulk unverified import.

**Acceptance criteria:**

- [ ] Every published page has a complete suffix source for `ru`, `be`, `uk`, `es`, `pt-BR`, `zh-CN`, `ja`, `de`,
      `fr`, and `hi`; localized prose, metadata, navigation, search labels, language names, and alternatives are human
      readable and no page is silently served from English.
- [ ] Each locale's manifest entry records the exact English source hash, localized source hash, release review state,
      and a non-personal approval reference. Changing English marks affected locale pages stale and blocks publication
      until the translation and review are refreshed.
- [ ] Translation preserves factual parity and code tokens while clearly distinguishing the four desktop-UI locales
      (`en`, `ru`, `uk`, `be`) from the eleven guide locales. All manifest data remains excluded from the public output.

**Verification:**

- [ ] For each locale, run the strict build and locale/content contracts after its final page batch; intentionally
      remove one suffix page and stale one source hash to prove both failures are release-blocking.
- [ ] Run `npm run docs:test` and `npm run docs:build`, then perform the recorded proficient-speaker review for each
      locale before allowing the locale into the combined Pages artifact.

**Dependencies:** Task 13 and Task 6a.
**Files likely touched per increment:** At most five localized Markdown files plus one manifest update; split each
locale into core, workflow, settings, and support batches so a single implementation slice stays reviewable.
**Estimated scope:** Ten locale deliveries, each split into S/M page batches; 26–38 engineering hours plus linguistic
review time.

### Task 14b: Restore The Material-Native Theme Contract

**Description:** Reduce the documentation theme to Material for MkDocs' native UI plus the landing palette. Remove
component-level restyling, preserve only approved local font/glyph declarations, and add a contract that prevents the
stylesheet from growing into a parallel component theme.

**Acceptance criteria:**

- [x] `mkdocs.yml` explicitly uses `theme.name: material` and the dark `slate` scheme; Material continues to own the
      header, drawer, navigation, search, sidebars, content layout, buttons, tables, admonitions, tabs, code blocks,
      footer, typography scale, spacing, radii, elevation, focus behavior, breakpoints, and motion.
- [x] `extra.css` contains only the approved landing color custom properties plus documented local `@font-face` and
      locale glyph fallbacks. It contains no Material component selectors, landing-style cards/glows/gradients,
      geometry overrides, custom shadows/radii, or custom component animation.
- [x] A source/output contract rejects disallowed selectors and non-color declarations, verifies the exact palette,
      and proves local search, navigation, language selection, code copy, tables, admonitions, and responsive drawer
      remain functional with no remote asset request.

**Verification:**

- [x] Demonstrate the theme contract fails when a representative `.md-header` geometry override is added, then
      restore the stylesheet.
- [x] Run `npm run docs:sync-assets && npm run docs:build && npm run docs:test`.
- [x] Inspect the built Material configuration, stylesheet selector allowlist, output navigation/search assets, and
      responsive contract coverage at the required widths. Browser forced-colors/reduced-motion inspection remains in
      Task 20's cross-browser Pages journey.

**Dependencies:** Tasks 5 and 13, plus approval of this revised specification and plan.
**Files likely touched:** `docs/user-guide/assets/stylesheets/extra.css`, `mkdocs.yml`,
`tests/documentation/mkdocsOutput.test.ts`, `tests/documentation/docsAssets.test.ts`.
**Estimated scope:** M, 75–120 minutes, 4 files.

### Task 14c: Apply The CloakBrowser Reference Visual Treatment

**Description:** Apply the user-authorized visual elements that are useful to GPT-Voice from the
`swimmwatch/cloakbrowser-mcp` MkDocs implementation. Preserve GPT-Voice branding and the landing palette while adding
the local logo/wordmark, Material navigation/search/code/icon capabilities, and the reference-derived content styling.

**Acceptance criteria:**

- [x] The header and favicon use a self-contained, hash-pinned GPT-Voice PNG rather than an SVG with an unstaged
      raster dependency; a local, hash-pinned wordmark appears in the overview hero.
- [x] Material enables the reference's useful navigation, search, table-of-contents, code, tab, tooltip, and local
      emoji-icon capabilities. It does not add reference-repository metadata, videos, edit links, external branding,
      runtime assets, or a template replacement.
- [x] The overview has useful Material icons and cards. CSS applies only the tested content selector allowlist for
      buttons, wordmark, actions, screenshots/captions, cards, and inline code; structural Material selectors remain
      prohibited.
- [x] English plus staged Russian and Belarusian overview sources use the local wordmark and icon actions. Locale
      publication state and translation-manifest rules remain unchanged.

**Verification:**

- [x] Run `npm run docs:sync-assets`, strict MkDocs build, focused asset/theme/content/locale contracts, then the
      full documentation suite.
- [x] Inspect the rendered overview at 390 and 1440 CSS pixels for wordmark, icon actions, cards, navigation tabs,
      search, screenshot framing, and horizontal overflow; record no console errors or remote runtime assets.
- [x] Demonstrate that an unapproved `.md-header` selector fails the theme contract.

**Dependencies:** Tasks 4, 13, and 14b, plus the user's explicit visual-direction revision.
**Files touched:** local logo/wordmark assets and staging, MkDocs configuration, palette/content stylesheet, overview
sources, parser/asset/theme contracts, and the scoped task artifacts.
**Estimated scope:** M, 120–180 minutes, 10–15 files.

### Checkpoint F: Content Complete

- [ ] English and all ten translated guide variants contain every required page, settings mapping, support path, and
      the README link.
- [ ] Strict builds and all documentation, locale, manifest, asset, and content tests pass for every locale.
- [x] The Material baseline and reference-derived visual contract pass: the local logo/wordmark, useful Material
      icons/features, and approved content styling remain within the selector allowlist without a template replacement.
- [ ] Human accuracy/privacy review and recorded proficient-speaker review for every non-English locale record any
      corrections before landing/Pages integration is finalized.

## Phase 3: Landing And Discoverability

### Task 15: Add The Typed Guide Destination

**Description:** Extend centralized landing content with the active English documentation URL and label, plus a typed
future-locale route contract. Header/footer rendering must not scatter route literals or imply that non-English
landing pages are currently published.

**Acceptance criteria:**

- [ ] `LandingLinks` exposes `documentation`, the active English dictionary exposes its label, and a typed route
      helper derives a future destination from a landing locale definition.
- [ ] The active English landing uses `/gpt-voice/docs/`; the pure route helper maps `pt-BR` and `zh-CN` to
      `/gpt-voice/docs/pt-br/` and `/gpt-voice/docs/zh-cn/`, and every other locale to its lowercase route slug, without
      aliases or fallback.
- [ ] Content/locale tests cover all eleven route values, reject base-path escapes/mixed-case routes, prevent a future
      landing locale from selecting an incomplete guide, and prove only English landing content is published in this task.

**Verification:**

- [ ] Run `npm run landing:typecheck`.
- [ ] Run the focused landing content/locale tests.

**Dependencies:** Tasks 6a, 14a, and 14b.
**Files likely touched:** `src/landing-page/content/schema.ts`, `src/landing-page/content/locale-registry.ts`,
`src/landing-page/content/locales/en.ts`, `tests/landing-page/content.test.ts`.
**Estimated scope:** M, 60–90 minutes, 4 files.

### Task 16: Render The Landing Guide Navigation

**Description:** Render the active English typed guide link in desktop, mobile, no-JavaScript, and footer paths while
preserving existing anchors, primary CTAs, focus handling, and static pre-rendering. The implementation retains the
tested future-locale contract but does not publish or translate landing-page content.

**Acceptance criteria:**

- [ ] The active English landing places Documentation after on-page links; mobile hydrated/fallback navigation and the
      footer expose the same `/gpt-voice/docs/` route.
- [ ] Pre-rendered English HTML contains the guide link without hydration and all existing landing navigation behavior
      remains.
- [ ] Component tests cover active desktop/mobile/fallback/footer destinations, prevent a new-tab target, and retain
      the locale-helper contract without publishing a non-English landing route.

**Verification:**

- [ ] Run `npm run landing:test -- --run` and landing contract tests.
- [ ] Run `npm run landing:build` and inspect generated English HTML for `/gpt-voice/docs/`.

**Dependencies:** Task 15.
**Files likely touched:** `src/landing-page/components/SiteHeader.tsx`,
`src/landing-page/components/LandingPage.tsx`, `src/landing-page/components/SiteHeader.test.tsx`,
`src/landing-page/components/LandingPage.test.tsx`.
**Estimated scope:** M, 60–90 minutes, 4 files.

### Checkpoint G: Landing Entry Points

- [ ] Active English desktop, mobile, no-JavaScript, and footer guide links work from the pre-rendered landing root.
- [ ] Landing typecheck, component tests, future-route contract, and production build pass.
- [ ] Existing download/GitHub CTAs and on-page anchors remain unchanged.

### Task 17: Expose The Guide In Text Discovery

**Description:** Add a factual documentation link to the active English landing plain-text discovery output without
copying the guide, changing its content equivalence, or claiming crawler/LLM ingestion. Localized guide discovery is
owned by the all-locale MkDocs sitemap and language selector until landing localizations are separately approved.

**Acceptance criteria:**

- [ ] English `llms.txt` links to `/gpt-voice/docs/` with descriptive text and preserves existing qualification/content
      rules.
- [ ] `llms-full.txt` remains content-equivalent to the active landing source without a hidden copy of any guide.
- [ ] Text-generation tests enforce the English guide destination, UTF-8/LF/NFC output, and absence of hidden docs
      copy; the documentation sitemap test enforces every localized guide root.

**Verification:**

- [ ] Run the focused TXT generation tests.
- [ ] Generate text output in a temporary fixture and inspect the documentation link.

**Dependencies:** Tasks 14, 14a, 15.
**Files likely touched:** `src/landing-page/build/generate-txt-files.ts`,
`tests/landing-page/generateTxtFiles.test.ts`.
**Estimated scope:** S, 30–45 minutes, 2 files.

### Task 18: Compose Crawl Metadata

**Description:** Generate root crawl metadata after both builds so the landing sitemap owns landing routes, MkDocs
owns guide routes, and root robots references both without hard-coded drift.

**Acceptance criteria:**

- [ ] Composition reads built landing canonicals and the MkDocs sitemap, then writes a root landing sitemap and
      robots file referencing both canonical sitemap URLs.
- [ ] Output is deterministic, base-path-safe, excludes generated/private paths, and fails on missing or malformed
      inputs.
- [ ] Tests cover the active English landing canonical, all localized guide sitemap entries and reciprocal alternates,
      docs sitemap linkage, and no custom-domain assumptions.

**Verification:**

- [ ] Run the focused metadata composition tests.
- [ ] Build both surfaces, run composition, and validate generated XML/text structure.

**Dependencies:** Tasks 14a, 16–17.
**Files likely touched:** `src/landing-page/build/compose-pages-metadata.ts`,
`tests/landing-page/pagesMetadata.test.ts`, `package.json`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Checkpoint H: Discoverable Site

- [ ] Active English landing HTML/TXT and guide HTML cross-link without hidden duplicate content; every localized guide
      route is directly reachable through its language selector without English fallback.
- [ ] Root robots and both sitemaps use correct canonical project URLs; the docs sitemap carries every locale entry and
      reciprocal alternate.
- [ ] Landing SEO/text tests, docs tests, and locale/manifest tests pass.

## Phase 4: Combined Artifact And Browser Verification

### Task 19: Compose The Pages Artifact

**Description:** Add the canonical combined build command and artifact contracts that enforce Vite-first ordering,
MkDocs subdirectory preservation, metadata composition, and Electron/build-output isolation.

**Acceptance criteria:**

- [ ] `npm run pages:build` runs landing build, docs asset sync, strict MkDocs build, crawl composition, and docs
      contracts in the only safe order.
- [ ] A clean build contains landing roots plus complete `/docs/` roots for all eleven locales, with no internal docs or
      Electron output.
- [ ] Contract tests fail when build order is reversed, a locale root is missing or wrongly cased, either root is
      missing, or a private/generated source leaks.

**Verification:**

- [ ] Run `npm run pages:build` from a clean ignored output state.
- [ ] Run the combined artifact contract test and inspect the generated file tree.

**Dependencies:** Tasks 13, 14a, 16, 18.
**Files likely touched:** `package.json`, `tests/documentation/pagesBuild.test.ts`.
**Estimated scope:** M, 60–90 minutes, 2 files.

### Task 20: Exercise The Browser Journey

**Description:** Serve the combined artifact through the existing landing preview and test landing-to-guide-to-landing
navigation as a dedicated transition contract, then cover direct docs refreshes, responsive layout, local search,
keyboard/focus behavior, accessibility, and same-origin assets.

**Required landing-to-MkDocs transition test:**

1. Load `http://127.0.0.1:4173/gpt-voice/`, click the visible **Documentation** link, and require a successful
   navigation at exactly `/gpt-voice/docs/` with the expected MkDocs H1, English `lang`, and self-canonical URL.
2. Record document, stylesheet, script, font, image, and search-index responses during that transition. Fail on any
   same-origin `4xx`/`5xx`, console/page error, root-relative `/docs/` escape, duplicated
   `/gpt-voice/gpt-voice/` prefix, or asset URL outside the intended `/gpt-voice/` project base.
3. Repeat the active English transition through the mobile menu and no-JavaScript landing fallback so all rendered
   entry points resolve to the same canonical MkDocs route.
4. Parameterize direct-load, refresh, language-selector, local search, and font/glyph checks over all eleven guide
   locales. English uses `/gpt-voice/docs/settings/`; `pt-BR` and `zh-CN` use the lowercase adapter paths; all other
   locales use `/gpt-voice/docs/<landing-route-slug>/settings/`. Require a successful response, stable trailing slash,
   correct `lang`/canonical/language-selector state, working local assets/search, and no fallback to the landing root
   or a GitHub Pages 404.
5. Use the English guide's **GPT-Voice home** link to return to `/gpt-voice/`, then exercise an existing landing anchor
   and FAQ disclosure to prove the active landing round trip did not break hydration, focus, or core interaction.

**Acceptance criteria:**

- [ ] Playwright proves the exact active-English landing-to-MkDocs transition and round trip for desktop, mobile, and
      JavaScript-disabled entry points, then proves all localized guide deep-route refreshes and canonical trailing-slash
      paths.
- [ ] No transition or localized guide route has a same-origin failed response, path-prefix escape/duplication,
      route-case mismatch, English fallback, GitHub Pages 404, console error, or missing local asset; the exercised
      English landing anchor/FAQ behavior remains intact.
- [ ] Axe/keyboard/zoom/text-spacing/reduced-motion/forced-colors checks cover each locale overview plus representative
      procedure/settings paths, with CJK/Indic glyph coverage and no remote asset requests.

**Verification:**

- [ ] Run the parameterized focused transition case in Chromium:
      `npx playwright test --config playwright.landing.config.ts tests/landing-page/e2e/documentation.spec.ts --grep "opens MkDocs from the landing page without path errors"`.
- [ ] Run `npm run pages:test:e2e` to preserve the complete existing landing browser suite.
- [ ] Run Chromium, Firefox, and WebKit coverage in CI-equivalent mode where platform libraries are available.

**Dependencies:** Task 19.
**Files likely touched:** `playwright.landing.config.ts`, `tests/landing-page/e2e/documentation.spec.ts`, `package.json`.
**Estimated scope:** M, 90–120 minutes, 3 files.

### Checkpoint I: Local Pages Candidate

- [ ] One local artifact passes docs, landing, crawl, integration, browser, and accessibility checks, including all
      localized guide roots.
- [ ] The dedicated active-English landing-to-MkDocs transition and return-path test passes with zero failed
      same-origin responses, path-prefix errors, missing assets, console errors, or landing regressions; every localized
      guide deep route passes its direct-load/refresh/language-selector check.
- [ ] Existing landing E2E remains green across configured browsers.
- [ ] No provider, microphone, personal profile, real clipboard, or external-service assertion is used.

## Phase 5: Continuous Integration And Release Deployment

### Task 21: Integrate Pull-Request Validation

**Description:** Extend the current PR-only landing job with cached Python setup, pinned docs installation, combined
Pages build/tests, and browser checks while retaining least privilege and zero deployment actions.

**Acceptance criteria:**

- [ ] PR job uses `actions/setup-python@v6` Python 3.12 with requirements caching and runs the canonical all-locale
      docs, artifact, and browser scripts.
- [ ] Existing quality dependency, Node/FFmpeg/browsers, landing gates, `contents: read`, and PR-only triggers remain.
- [ ] Workflow contracts prove PR checks contain no configure/upload/deploy Pages action and `pages.yml` stays absent.

**Verification:**

- [ ] Run the focused workflow contract test and `actionlint` when available.
- [ ] Compare local command order with the PR job step order.

**Dependencies:** Task 20.
**Files likely touched:** `.github/workflows/pr-checks.yml`, `tests/landing-page/pagesWorkflow.test.ts`.
**Estimated scope:** M, 60–90 minutes, 2 files.

### Task 22: Add Release-Gated Pages Deployment

**Description:** Add least-privilege combined Pages build/deploy jobs to the existing release workflow after release
assets are published, without restoring the standalone workflow or changing release creation semantics.

**Acceptance criteria:**

- [ ] Pages build runs only for a published release, depends on successful release-asset publication, installs the
      pinned docs environment, validates all eleven static guide locales, configures Pages, and uploads one artifact.
- [ ] Deploy depends on that build, uses the `github-pages` environment, `pages: write`/`id-token: write` only there,
      official pinned-major actions, and non-cancelling `github-pages` concurrency.
- [ ] Workflow contracts prove release/PR separation, dependency order, permissions, artifact root, absent
      `pages.yml`, and no write-back to a branch.

**Verification:**

- [ ] Run the expanded workflow contract test and `actionlint` when available.
- [ ] Execute every release Pages build command locally without publishing or deploying.

**Dependencies:** Task 21.
**Files likely touched:** `.github/workflows/release-builds.yml`, `tests/landing-page/pagesWorkflow.test.ts`.
**Estimated scope:** M, 90–120 minutes, 2 files.

### Checkpoint J: CI And Release Contract

- [ ] PR validation is non-deploying and release publication is the sole automatic Pages deployment trigger.
- [ ] One least-privilege artifact/deploy chain is represented in workflow tests.
- [ ] No remote mutation, release, or Pages setting change has occurred.

## Phase 6: Review And Authorized Production Verification

### Task 23: Complete Local Release-Candidate Review

**Description:** Run the proportionate full verification set, conduct manual content/privacy/visual review against the
release candidate, record results and blockers, and leave a deploy-ready handoff without remote mutation.

**Acceptance criteria:**

- [ ] All documentation locales plus the active English landing, combined artifact, browser, workflow, relevant root
      checks, and Definition of Done pass; any unrelated baseline failure is recorded precisely.
- [ ] A human follows the English documented workflows against the release candidate and approves main-screenshot
      privacy, factual accuracy, accessibility, and landing/docs consistency; recorded proficient-speaker review covers
      every non-English locale.
- [ ] Handoff records changed files, checks, manual evidence, deployment prerequisites, rollback (previous Pages
      deployment), and the remaining authorization boundary.

**Verification:**

- [ ] Run `npm run pages:build`, `npm run docs:test`, `npm run pages:test:e2e`, landing checks, `npm run typecheck`,
      `npm run test:types`, `npm test`, relevant lint/format checks, and `git diff --check`.
- [ ] Inspect the complete diff against both approved specs and this plan.

**Dependencies:** Task 22.
**Files likely touched:** `docs/specs/mkdocs-project-documentation/tasks/handoff.md`,
`docs/specs/mkdocs-project-documentation/tasks/todo.md`.
**Estimated scope:** M, 90–120 minutes plus human review, 2 task artifacts.

### Task 24: Verify The Authorized Deployment

**Description:** After separate explicit authorization and an approved published release, verify the live GitHub
Pages landing and guide, record production evidence, and stop without unrelated repository or external mutations.

**Acceptance criteria:**

- [ ] The active English landing root and every guide locale route load from the canonical URLs; landing/docs
      navigation, direct refreshes, language switching, local search, assets, sitemaps, robots, canonicals, response
      types, console, and 404 behavior are correct.
- [ ] Deployed accessibility/SEO smoke checks meet the specification, and the release downloads/guide describe the
      same revision.
- [ ] Handoff records deployment URL/run/release, verification evidence, issues, and rollback result if needed.

**Verification:**

- [ ] Run the deployed Playwright smoke subset and manual browser checks only after authorization.
- [ ] Confirm GitHub Pages environment reports the expected deployment and no unintended branch/artifact mutation.

**Dependencies:** Task 23, explicit release/deployment authorization, published release, configured GitHub Pages.
**Files likely touched:** `docs/specs/mkdocs-project-documentation/tasks/handoff.md`,
`docs/specs/mkdocs-project-documentation/tasks/todo.md`.
**Estimated scope:** S, 45–90 minutes plus GitHub Actions runtime, 2 task artifacts.

### Final Checkpoint: Complete

- [ ] All specification success criteria are met or an approved exception is recorded.
- [ ] Every task satisfies its acceptance criteria and the standing Definition of Done.
- [ ] Landing and documentation are live, mutually navigable, release-consistent, and verified.
- [ ] Human review is recorded before merge/deploy completion.

## Verification Strategy Summary

| Layer                 | Primary evidence                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MkDocs configuration  | Strict all-locale build, config/output tests, Material/reference-derived visual allowlist contract, public-source and route-matrix boundary tests                                                               |
| Assets/privacy        | Hash/dimension/containment tests, locale font/glyph checks, staged tree inspection, human public-use review                                                                                                     |
| Content               | Navigation/terminology/settings coverage, translation-manifest tests, source-code review, human workflow walkthrough                                                                                            |
| Landing               | Typecheck, active-English Vitest/Node contracts, future-locale route-matrix contract, pre-render inspection, existing SEO/accessibility/media checks                                                            |
| Combined artifact     | Clean `pages:build`, all-locale artifact tree/canonical/private-path contracts, sitemap/robots validation                                                                                                       |
| Browser/accessibility | Active-English landing-to-MkDocs transition/round-trip test plus all-guide-locale direct-route assertions, same-origin response log, Playwright across configured engines, axe, keyboard, reflow, forced colors |
| CI/release            | All-guide-locale workflow contract tests, actionlint, local execution of build commands, permission/dependency inspection                                                                                       |
| Production            | Authorized active-landing/all-guide-locale deployed smoke, response/canonical/console checks, GitHub Pages environment evidence                                                                                 |

Every task also applies `.agents/references/definition-of-done.md`: scoped changes, runtime verification, regression
coverage, passing lint/format for touched surfaces, integration review, current-state documentation, privacy/security
review where applicable, rollback awareness, and human approval before merge/deploy.

## Parallelization Opportunities

- Safe after Task 6a: English Markdown authoring for Tasks 7–12 is independent if each session owns distinct pages
  and reads current released contracts. One designated owner merges their `mkdocs.yml` navigation entries sequentially
  and runs the strict build after each merge.
- Safe after Task 13: Task 14 and the small, locale-specific page batches within Task 14a are independent once a
  shared terminology/glossary decision is recorded. A locale may not be marked complete until its full guide and
  manifest/review record are present.
- Tasks 14b and 14c completed independently from translation prose work and established the Material baseline plus
  reference-derived visual ownership of `mkdocs.yml`, `extra.css`, local logo assets, and the theme contract.
- Coordination required: `package.json`, `mkdocs.yml`, documentation tests, landing content schema, and workflow tests
  are shared contracts and must not be edited concurrently without explicit ownership.
- Sequential: Tasks 15–24 depend on complete shared locale outputs and must follow the graph.
- No sub-agent delegation is assumed by this plan. Parallel sessions are optional and require the human to assign
  ownership before implementation.

## Risks And Mitigations

| Risk                                                   | Impact                                | Mitigation                                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| MkDocs accidentally publishes internal `docs/` content | High privacy/process leak             | Isolated `docs_dir`, strict nav, negative output tests before bulk content                                                                    |
| Vite erases MkDocs output                              | High broken deployment                | Vite-first canonical script plus reversed-order failure contract                                                                              |
| Release deployment conflicts with current PR-only work | High workflow regression              | Preserve PR job, keep `pages.yml` absent, add separate release jobs only after plan approval                                                  |
| Documentation defaults drift from application settings | High user harm                        | Field-to-page mapping, source-derived values, reviewed-release markers, same-PR maintenance rule                                              |
| Screenshots expose sensitive state                     | High privacy harm                     | Main capture only, hash manifest, deterministic staging, negative reference-capture tests, human approval                                     |
| Material theme loads remote fonts/assets               | Medium privacy/reliability            | `theme.font: false`, local assets, browser request-origin assertions                                                                          |
| Custom CSS replaces Material behavior or drifts again  | Medium accessibility/maintenance risk | Palette/font allowlist, prohibited Material-selector contract, native-component browser checks, and ask-first exceptions                      |
| Python tooling adds unreproducible environment         | Medium CI drift                       | Python 3.12, pinned requirements, isolated venv, cached requirements key, no global install                                                   |
| Combined browser suite becomes slow                    | Medium CI cost                        | Reuse existing preview/engines, focused docs cases, full cross-browser only in CI/release gates                                               |
| Landing/docs base paths drift or double-prefix         | High broken navigation                | Exact pathname/canonical assertions, response failure collection, deep refresh, mobile/no-JS variants, and round-trip landing regression test |
| A translation is missing or stale                      | High misleading or inaccessible guide | Complete suffix-page contract, source-hash manifest, negative stale/missing-page tests, and release-blocking proficient-speaker review        |
| Locale route adapter diverges from landing registry    | High future broken cross-site journey | One typed matrix for `pt-br`/`zh-cn`, generated route tests, all-guide-locale HTML assertions, and direct-route browser checks                |
| CJK or Indic glyphs regress                            | Medium unreadable content             | Self-hosted locale font staging, visual glyph snapshots, and CJK/Indic browser smoke coverage                                                 |
| Crawl metadata duplicates or omits URLs                | Medium discoverability                | Generate from built canonicals/sitemap, validate XML, keep landing/docs ownership explicit                                                    |
| Release docs describe a different app revision         | High trust issue                      | Release-gated build from release ref, deploy depends on release assets, post-deploy revision review                                           |
| Dirty worktree edits are overwritten                   | High data loss                        | Patch only scoped lines, inspect diffs before every shared-file task, never reset/checkout destructively                                      |

## Accepted Defaults And Remaining Decisions

Accepted for planning unless the human changes them during plan review:

- Route: `/gpt-voice/docs/`.
- Language: static guides for `en`, `ru`, `be`, `uk`, `es`, `pt-BR`, `zh-CN`, `ja`, `de`, `fr`, and `hi`, implemented
  with pinned `mkdocs-static-i18n`, suffix sources, no browser-language redirect, and no fallback publication.
- Screenshots: approved main screenshot only.
- Domain: `https://swimmwatch.github.io/gpt-voice/`.
- Deployment: published-release event through `.github/workflows/release-builds.yml`; PR validation never deploys.
- Theme: Material for MkDocs structural components with the dark landing palette, local logo/wordmark, useful Material
  icons/features, and the approved reference-derived content-style selector allowlist.
- No custom domain, analytics, hosted search, blog, version selector, third-party runtime assets, or contributor docs.

Decisions still requiring explicit authorization later:

- Implementation start after this plan is approved.
- Any expanded screenshot public-use scope.
- Any dependency/version departure from the approved baseline.
- Publishing the release, changing repository Pages settings, or performing deployed verification.
