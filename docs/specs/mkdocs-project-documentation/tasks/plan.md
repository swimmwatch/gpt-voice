# Implementation Plan: MkDocs Project Documentation And GitHub Pages Integration

**Status:** Incremental implementation in progress — Tasks 1–2 complete
**Specification:** `docs/specs/mkdocs-project-documentation/spec.md`
**Estimated implementation:** 24–32 focused engineering hours, plus human content/privacy review and CI/deployment
runtime
**Implementation authorization:** Approved one task at a time; Task 3 is the next implementation slice.

## Overview

Build an English MkDocs Material user guide at `/gpt-voice/docs/`, connect it to the existing Vite landing page,
validate both surfaces together, and publish one GitHub Pages artifact from the release workflow. The plan preserves
the current PR-only landing checks, the intentional removal of `.github/workflows/pages.yml`, the Electron/runtime
boundary, and all unrelated worktree changes.

The baseline publishes only the already approved `app-main.png` capture. Expanded provider, settings, history,
browser, or network screenshots require a separate public-use decision and are not dependencies for this plan.

## Architecture Decisions

- Public MkDocs input is isolated at `docs/user-guide/`; internal `docs/specs/`, `docs/researches/`, handoffs, agent
  guides, and design artifacts can never enter the site through a broad `docs_dir`.
- MkDocs uses Python 3.12, pinned `docs/requirements.txt`, Material 9.7.6, strict builds, local search, local assets,
  and no runtime CDN or hosted service.
- Vite remains the artifact owner: it builds first and empties `build/github-pages/`; MkDocs then writes only to
  `build/github-pages/docs/`.
- Root npm scripts provide one cross-platform entry point for docs authoring, docs validation, combined Pages build,
  and Pages browser tests. Python remains isolated in `.venv-docs/`.
- A deterministic asset-sync script validates source hashes and stages the icon, fonts, and approved main screenshot
  into an ignored MkDocs asset directory. No new screenshot is captured by this baseline.
- Documentation prose is split by user journey and settings surface. Released renderer/shared contracts are factual
  sources, but no application code or generated setting model is coupled to MkDocs at runtime.
- Landing navigation uses the typed `LandingLinks` content contract and a base-path-safe `/gpt-voice/docs/` target.
- PR validation remains non-deploying in `.github/workflows/pr-checks.yml`. Release-gated Pages jobs are added to
  `.github/workflows/release-builds.yml`; `.github/workflows/pages.yml` stays absent.
- Root landing crawl metadata and MkDocs crawl metadata remain distinct: root robots references both sitemaps, and
  the landing plain-text index links to the guide.
- Deployment and post-deployment verification are separate, authorization-gated work. Local implementation can be
  completed and reviewed without publishing a release or changing repository Pages settings.

## Dependency Graph

```text
Task 1: cross-spec contract
  |
  v
Task 2: minimal strict MkDocs guide
  |--------------------|
  v                    v
Task 3: public boundary Task 4: deterministic assets
                           |
                           v
                       Task 5: product theme
                           |
          |----------------|-----------------------------|
          v                v                             v
     Tasks 6-8        Tasks 9-11                    Task 15
     user guides      settings guides          typed landing link
          |                |                             |
          |                v                             v
          |            Task 12                       Task 16
          |         support reference          rendered navigation
          |                |
          |----------------|
                   v
               Task 13
            content contracts
                   |
          |--------|--------|
          v                 v
      Task 14          Task 17 -> Task 18
      README           TXT link   crawl metadata
          |                 |
          |--------|--------|
                   v
               Task 19
          combined Pages artifact
                   |
                   v
               Task 20
          browser/accessibility journey
                   |
                   v
               Task 21
             PR validation
                   |
                   v
               Task 22
       release-gated Pages deployment
                   |
                   v
               Task 23
       local release-candidate review
                   |
          explicit remote authorization
                   |
                   v
               Task 24
       deployed GitHub Pages verification
```

Markdown authoring for Tasks 6–11 can run in independent focused sessions after Task 5. Their explicit navigation
entries must be merged sequentially by the `mkdocs.yml` owner so every intermediate strict build remains green.
Tasks 15–16 can proceed alongside those content slices after Task 2, provided shared files are not edited
concurrently. All integration work from Task 19 onward is sequential.

## Phase 1: Contract And Foundation

### Task 1: Reconcile The Cross-Spec Contract

**Description:** Finalize the accepted defaults and keep the documentation and landing specifications consistent
about the current PR-only state, future release-gated deployment, artifact order, route, locale, and screenshot scope.

**Acceptance criteria:**

- [x] Both specs identify `/gpt-voice/docs/`, English-only baseline, main screenshot only, Vite-first artifact order,
  PR-only validation, and future release-workflow deployment without recreating `pages.yml`.
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

- [ ] Tests reject a docs root broader than `docs/user-guide` and assert canonical site/output paths.
- [ ] Generated output contains expected metadata/navigation and no spec, research, agent, handoff, or private paths.
- [ ] `npm run docs:test` executes the documentation test directory through the repository's `node:test` stack.

**Verification:**

- [ ] Demonstrate the test fails when `docs_dir` is temporarily pointed at `docs`, then restore it.
- [ ] Run `npm run docs:build && npm run docs:test`.

**Dependencies:** Task 2.
**Files likely touched:** `tests/documentation/mkdocsOutput.test.ts`, `package.json`.
**Estimated scope:** S, 45–75 minutes, 2 files.

### Checkpoint B: Isolated Build

- [ ] A strict guide builds at the planned subpath.
- [ ] Internal engineering content is proven absent.
- [ ] The root Electron build and packaging inputs are unchanged.

### Task 4: Stage Approved Documentation Assets

**Description:** Implement the deterministic asset pipeline for the repository icon, pinned local fonts, and the
already public main screenshot, including manifest/hash/dimension checks and ignored output staging.

**Acceptance criteria:**

- [ ] Asset sync validates source containment, hashes, dimensions, allowed files, and the main screenshot's approved
  public-use status before writing.
- [ ] Only local icon/font/main-screenshot derivatives enter the staged MkDocs assets; reference-only captures are
  rejected.
- [ ] Staged files are deterministic, ignored, and covered by failure-path tests for missing/tampered sources.

**Verification:**

- [ ] Run `npm run docs:sync-assets` twice and compare hashes.
- [ ] Run `node --import tsx --test tests/documentation/docsAssets.test.ts`.
- [ ] Confirm reference-only capture names do not occur under staged or built docs assets.

**Dependencies:** Tasks 2–3.
**Files likely touched:** `scripts/sync-docs-assets.mjs`, `tests/documentation/docsAssets.test.ts`, `package.json`,
`.gitignore`.
**Estimated scope:** M, 90–120 minutes, 4 files.

### Task 5: Apply The Product Theme

**Description:** Configure Material features and repository-owned CSS so the guide shares the landing identity while
retaining accessible MkDocs navigation, local search, responsive content, and restrained motion.

**Acceptance criteria:**

- [ ] Theme uses approved graphite/blue tokens, local Ubuntu Sans/JetBrains Mono, GPT-Voice icon, 10-pixel controls,
  visible focus, reduced-motion behavior, and no remote runtime asset.
- [ ] Overview shows the approved optimized main screenshot with dimensions, alt text, caption, and nearby task links.
- [ ] Desktop/mobile layout, local search, table of contents, drawer, and home/repository/release links remain usable.

**Verification:**

- [ ] Run `npm run docs:sync-assets && npm run docs:build && npm run docs:test`.
- [ ] Inspect the local guide at 320, 390, 768, and 1440 CSS pixels with external requests recorded.

**Dependencies:** Task 4.
**Files likely touched:** `docs/user-guide/assets/stylesheets/extra.css`, `mkdocs.yml`, `docs/user-guide/index.md`,
`tests/documentation/mkdocsOutput.test.ts`.
**Estimated scope:** M, 90–120 minutes, 4 files.

### Checkpoint C: Branded Foundation

- [ ] Strict build, boundary tests, and asset tests pass.
- [ ] Only the approved main capture is public.
- [ ] A human confirms the initial landing/docs visual relationship before bulk authoring.

## Phase 2: User Documentation Slices

### Task 6: Publish The Installation Journey

**Description:** Write release-download, checksum, Windows, deb, rpm, AppImage, update, uninstall, retained-data, and
first-launch guidance as one complete new-user path.

**Acceptance criteria:**

- [ ] Installation instructions match current package names, supported Windows/Linux artifacts, checksum files, and
  the paused macOS status.
- [ ] Update/uninstall steps clearly distinguish application removal from retained local settings/session data.
- [ ] Getting Started reaches a configured provider and first clipboard result with visible success/failure cues.

**Verification:**

- [ ] Run `npm run docs:build` with zero warnings or broken internal links.
- [ ] Manually compare package commands and first-launch flow with `README.md`, package metadata, and current UI.

**Dependencies:** Task 5.
**Files likely touched:** `docs/user-guide/install.md`, `docs/user-guide/getting-started.md`, `mkdocs.yml`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Task 7: Publish The Transcription Path

**Description:** Document the complete recording lifecycle and both transcription-provider paths, including retry,
clipboard/history output, authentication clearing, quotas, and failure behavior.

**Acceptance criteria:**

- [ ] Start, pause, resume, stop, cancel, submit, retry, notification, clipboard, and history states match released
  behavior and shortcut semantics.
- [ ] ChatGPT Web and OpenAI API setup, switching, clearing, billing/account ownership, and provider-controlled limits
  remain factually qualified.
- [ ] Retry invalidation and in-memory retention are described without permanent-audio or quota-bypass implications.

**Verification:**

- [ ] Run `npm run docs:build`.
- [ ] Review against `useRecording`, provider settings UI, retry state contracts, and current landing claims.

**Dependencies:** Task 5.
**Files likely touched:** `docs/user-guide/guides/transcription.md`, `docs/user-guide/guides/providers.md`,
`mkdocs.yml`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Task 8: Publish The Text-Action Workflow

**Description:** Document translation, Prettify operation, selection/clipboard behavior, history reuse/clearing, tray
entry points, and relevant platform qualifications.

**Acceptance criteria:**

- [ ] Translation and Prettify prerequisites, enable switches, target language, selection behavior, result handling,
  and error states are explicit.
- [ ] Ollama/vLLM services are described as user-operated dependencies, with remote-endpoint privacy qualification.
- [ ] History/tray guidance matches progressive loading, recopy, clear, lifecycle, and available menu actions.

**Verification:**

- [ ] Run `npm run docs:build`.
- [ ] Review against text-action settings, selection automation, history renderer/contracts, and tray menu code.

**Dependencies:** Task 5.
**Files likely touched:** `docs/user-guide/guides/text-actions.md`,
`docs/user-guide/guides/history-and-tray.md`, `mkdocs.yml`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Checkpoint D: Operational Guide

- [ ] Installation, first launch, transcription, providers, text actions, history, and tray form complete linked
  journeys.
- [ ] No instruction requires source code, credentials, or undocumented UI knowledge.
- [ ] Strict build passes after Tasks 6–8.

### Task 9: Publish The Core Settings Reference

**Description:** Create the settings entry point plus authoritative provider and shortcut/action pages, including
save/dirty/error lifecycle and all provider authentication controls.

**Acceptance criteria:**

- [ ] Settings overview explains navigation, dirty state, validation, save progress, close blocking, and discard
  confirmation.
- [ ] Provider reference covers ChatGPT session controls and every OpenAI key/model/language/prompt/temperature action.
- [ ] Shortcut reference covers all six targets, released defaults, capture/change flow, conflicts, and action enables.

**Verification:**

- [ ] Run `npm run docs:build`.
- [ ] Review field-by-field against provider modal, `ShortcutsSection`, hotkey defaults, and settings-close state.

**Dependencies:** Task 5.
**Files likely touched:** `docs/user-guide/settings/index.md`, `docs/user-guide/settings/providers.md`,
`docs/user-guide/settings/shortcuts.md`, `mkdocs.yml`.
**Estimated scope:** M, 90–120 minutes, 4 files.

### Task 10: Publish The Prettify Reference

**Description:** Document every Prettify connection, model-memory, prompt, primary generation, and advanced generation
control with defaults, ranges, dependencies, persistence, validation, and privacy effects.

**Acceptance criteria:**

- [ ] Ollama/vLLM provider, base URL, vLLM key, model refresh/selection, load/free, VRAM status, and errors are covered.
- [ ] Temperature, top P, min P, repeat penalty, top K, maximum output tokens, seed, and prompt use source-derived
  defaults/ranges.
- [ ] Loopback versus remote endpoint behavior and secret storage are accurately qualified.

**Verification:**

- [ ] Run `npm run docs:build`.
- [ ] Review every row against `PrettifySection`, shared defaults/validation, and persistence services.

**Dependencies:** Task 5.
**Files likely touched:** `docs/user-guide/settings/prettify.md`, `mkdocs.yml`.
**Estimated scope:** S, 60–90 minutes, 2 files.

### Task 11: Publish The Browser-Network Reference

**Description:** Document CloakBrowser behavior/identity and proxy configuration as one dependency-aware settings
slice, including GeoIP ownership and protocol-specific warnings.

**Acceptance criteria:**

- [ ] Humanization, preset, background mode, fingerprint seed/reset, locale, and timezone use released values/defaults.
- [ ] Proxy enablement, server, bypass, username, password, GeoIP, storage, and SOCKS5 credential warning are complete.
- [ ] Locale/timezone disabled-state behavior under proxy GeoIP is explained consistently on both pages.

**Verification:**

- [ ] Run `npm run docs:build`.
- [ ] Review against `BrowserSection`, `NetworkSection`, shared CloakBrowser settings, validation, and persistence.

**Dependencies:** Task 5.
**Files likely touched:** `docs/user-guide/settings/browser.md`, `docs/user-guide/settings/network.md`, `mkdocs.yml`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Checkpoint E: Settings Guide

- [ ] Every visible settings surface has an authoritative page.
- [ ] Defaults/ranges come from released contracts, not screenshots or stale prose.
- [ ] Strict build passes after Tasks 9–11.

### Task 12: Publish The Support Reference

**Description:** Complete privacy/data, troubleshooting, and FAQ pages that route users to authoritative procedures
without duplicating or weakening provider, data-retention, or platform qualifications.

**Acceptance criteria:**

- [ ] Privacy page maps remote flows, local files, encryption qualifications, sensitive data, retry cache, and reset.
- [ ] Troubleshooting covers microphone, session, API, model, proxy, shortcut, clipboard, installer, and browser runtime
  symptoms with safe diagnostics.
- [ ] FAQ gives concise factual answers and descriptive links to the authoritative guide/settings pages.

**Verification:**

- [ ] Run `npm run docs:build`.
- [ ] Review against README privacy/install facts, storage services, notification errors, and supported package behavior.

**Dependencies:** Tasks 6–11.
**Files likely touched:** `docs/user-guide/privacy.md`, `docs/user-guide/troubleshooting.md`, `docs/user-guide/faq.md`,
`mkdocs.yml`.
**Estimated scope:** M, 90–120 minutes, 4 files.

### Task 13: Enforce Documentation Coverage

**Description:** Add content, terminology, navigation, settings-mapping, and maintenance contracts so future behavior
changes cannot silently leave a public field undocumented or reintroduce prohibited claims.

**Acceptance criteria:**

- [ ] A machine-readable test mapping covers every released provider/app setting exactly once on an authoritative page.
- [ ] Tests enforce required pages/headings, reviewed-release markers, current defaults/shortcuts, terminology, platform
  status, affiliation/license/quota qualifications, screenshot alternatives, and descriptive links.
- [ ] Tests fail when a mapped setting or required qualification is removed and pass with the complete guide.

**Verification:**

- [ ] Demonstrate one representative settings-coverage failure and one prohibited-claim failure, then restore sources.
- [ ] Run `npm run docs:test` and `npm run docs:build`.

**Dependencies:** Tasks 6–12.
**Files likely touched:** `tests/documentation/contentContract.test.ts`,
`tests/documentation/settingsCoverage.test.ts`, `tests/documentation/fixtures/settings-coverage.json`.
**Estimated scope:** M, 90–120 minutes, 3 files.

### Task 14: Link The README

**Description:** Add one prominent public-guide destination while keeping README as the concise repository,
installation, development, and contribution entry point.

**Acceptance criteria:**

- [ ] README links to `https://swimmwatch.github.io/gpt-voice/docs/` near its user-facing introduction/navigation.
- [ ] Existing installation/development facts remain, while the link clearly identifies the full user/settings guide.
- [ ] Documentation content tests assert the stable public destination without duplicating the guide in README.

**Verification:**

- [ ] Run `npm run docs:test`.
- [ ] Manually check the rendered README link and surrounding copy.

**Dependencies:** Task 13.
**Files likely touched:** `README.md`, `tests/documentation/contentContract.test.ts`.
**Estimated scope:** XS, 20–30 minutes, 2 files.

### Checkpoint F: Content Complete

- [ ] All required guide pages, settings mappings, support content, and README link exist.
- [ ] Strict build and all documentation tests pass.
- [ ] Human accuracy/privacy review records any corrections before landing/Pages integration is finalized.

## Phase 3: Landing And Discoverability

### Task 15: Add The Typed Guide Destination

**Description:** Extend centralized landing content with the documentation URL and label so header/footer rendering
does not scatter route literals or bypass compile-time locale completeness.

**Acceptance criteria:**

- [ ] `LandingLinks` exposes `documentation` and navigation content exposes its label.
- [ ] English content uses `/gpt-voice/docs/` and includes Documentation in footer content.
- [ ] Content/locale tests enforce the base path and future dictionary completeness.

**Verification:**

- [ ] Run `npm run landing:typecheck`.
- [ ] Run the focused landing content/locale tests.

**Dependencies:** Task 2.
**Files likely touched:** `src/landing-page/content/schema.ts`, `src/landing-page/content/locales/en.ts`,
`tests/landing-page/content.test.ts`.
**Estimated scope:** S, 30–45 minutes, 3 files.

### Task 16: Render The Landing Guide Navigation

**Description:** Render the typed guide link in desktop, mobile, no-JavaScript, and footer paths while preserving
existing anchors, primary CTAs, locale behavior, focus handling, and static pre-rendering.

**Acceptance criteria:**

- [ ] Desktop navigation places Documentation after on-page links; mobile hydrated/fallback navigation exposes the
  same route; footer renders the centralized link.
- [ ] Pre-rendered HTML contains the guide link without hydration and all existing landing navigation behavior remains.
- [ ] Component tests cover desktop/mobile/fallback/footer destinations and prevent a new-tab target.

**Verification:**

- [ ] Run `npm run landing:test -- --run` and landing contract tests.
- [ ] Run `npm run landing:build` and inspect generated HTML for `/gpt-voice/docs/`.

**Dependencies:** Task 15.
**Files likely touched:** `src/landing-page/components/SiteHeader.tsx`,
`src/landing-page/components/LandingPage.tsx`, `src/landing-page/components/SiteHeader.test.tsx`,
`src/landing-page/components/LandingPage.test.tsx`.
**Estimated scope:** M, 60–90 minutes, 4 files.

### Checkpoint G: Landing Entry Points

- [ ] Desktop, mobile, no-JavaScript, and footer guide links work from the pre-rendered root.
- [ ] Landing typecheck, component tests, and production build pass.
- [ ] Existing download/GitHub CTAs and on-page anchors remain unchanged.

### Task 17: Expose The Guide In Text Discovery

**Description:** Add a factual documentation link to the landing plain-text discovery index without copying the
guide, changing locale content equivalence, or claiming crawler/LLM ingestion.

**Acceptance criteria:**

- [ ] `llms.txt` links to the canonical guide with descriptive text and preserves existing qualification/content rules.
- [ ] `llms-full.txt` and locale text outputs remain content-equivalent to their landing sources.
- [ ] Text-generation tests enforce the guide destination, UTF-8/LF/NFC output, and absence of hidden docs copy.

**Verification:**

- [ ] Run the focused TXT generation tests.
- [ ] Generate text output in a temporary fixture and inspect the documentation link.

**Dependencies:** Tasks 13–14.
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
- [ ] Tests cover English now, future landing routes, docs sitemap linkage, and no custom-domain assumptions.

**Verification:**

- [ ] Run the focused metadata composition tests.
- [ ] Build both surfaces, run composition, and validate generated XML/text structure.

**Dependencies:** Tasks 5, 16–17.
**Files likely touched:** `src/landing-page/build/compose-pages-metadata.ts`,
`tests/landing-page/pagesMetadata.test.ts`, `package.json`.
**Estimated scope:** M, 75–105 minutes, 3 files.

### Checkpoint H: Discoverable Site

- [ ] Landing HTML/TXT and guide HTML cross-link without hidden duplicate content.
- [ ] Root robots and both sitemaps use correct canonical project URLs.
- [ ] Landing SEO/text tests and docs tests pass.

## Phase 4: Combined Artifact And Browser Verification

### Task 19: Compose The Pages Artifact

**Description:** Add the canonical combined build command and artifact contracts that enforce Vite-first ordering,
MkDocs subdirectory preservation, metadata composition, and Electron/build-output isolation.

**Acceptance criteria:**

- [ ] `npm run pages:build` runs landing build, docs asset sync, strict MkDocs build, crawl composition, and docs
  contracts in the only safe order.
- [ ] A clean build contains landing root plus complete `/docs/`, with no internal docs or Electron output.
- [ ] Contract tests fail when build order is reversed, either root is missing, or a private/generated source leaks.

**Verification:**

- [ ] Run `npm run pages:build` from a clean ignored output state.
- [ ] Run the combined artifact contract test and inspect the generated file tree.

**Dependencies:** Tasks 13, 16, 18.
**Files likely touched:** `package.json`, `tests/documentation/pagesBuild.test.ts`.
**Estimated scope:** M, 60–90 minutes, 2 files.

### Task 20: Exercise The Browser Journey

**Description:** Serve the combined artifact through the existing landing preview and test landing-to-guide-to-landing
navigation as a dedicated transition contract, then cover direct docs refreshes, responsive layout, local search,
keyboard/focus behavior, accessibility, and same-origin assets.

**Required landing-to-MkDocs transition test:**

1. Load `http://127.0.0.1:4173/gpt-voice/`, click the visible **Documentation** link, and require the navigation
   response to succeed at the exact pathname `/gpt-voice/docs/` with the expected MkDocs H1 and canonical URL.
2. Record document, stylesheet, script, font, image, and search-index responses during the transition. Fail on any
   same-origin `4xx`/`5xx`, console/page error, root-relative `/docs/` escape, duplicated
   `/gpt-voice/gpt-voice/` prefix, or asset URL outside the intended `/gpt-voice/` project base.
3. Repeat through the mobile menu and the no-JavaScript landing fallback so all rendered entry points resolve to the
   same canonical MkDocs route.
4. Direct-load and refresh `/gpt-voice/docs/settings/`; require a successful response, stable trailing-slash URL,
   working local assets/search initialization, and no fallback to the landing root or a GitHub Pages 404.
5. Use the guide's **GPT-Voice home** link to return to `/gpt-voice/`, then exercise an existing landing anchor and
   FAQ disclosure to prove the round trip did not break landing hydration, focus, or core interaction behavior.

**Acceptance criteria:**

- [ ] Playwright proves the exact landing-to-MkDocs transition and round trip above for desktop, mobile, and
  JavaScript-disabled entry points, including successful deep-route refresh and canonical trailing-slash paths.
- [ ] The transition has no same-origin failed response, path-prefix escape/duplication, GitHub Pages 404, console
  error, missing local asset, or regression in the exercised landing anchor/FAQ behavior.
- [ ] Axe/keyboard/zoom/text-spacing/reduced-motion/forced-colors checks cover overview, one procedure, settings index,
  and the longest settings page with no remote asset requests.

**Verification:**

- [ ] Run the focused transition case in Chromium:
  `npx playwright test --config playwright.landing.config.ts tests/landing-page/e2e/documentation.spec.ts --grep "opens MkDocs from the landing page without path errors"`.
- [ ] Run `npm run pages:test:e2e` to preserve the complete existing landing browser suite.
- [ ] Run Chromium, Firefox, and WebKit coverage in CI-equivalent mode where platform libraries are available.

**Dependencies:** Task 19.
**Files likely touched:** `playwright.landing.config.ts`, `tests/landing-page/e2e/documentation.spec.ts`, `package.json`.
**Estimated scope:** M, 90–120 minutes, 3 files.

### Checkpoint I: Local Pages Candidate

- [ ] One local artifact passes docs, landing, crawl, integration, browser, and accessibility checks.
- [ ] The dedicated landing-to-MkDocs transition and return-path test passes with zero failed same-origin responses,
  path-prefix errors, missing assets, console errors, or landing regressions.
- [ ] Existing landing E2E remains green across configured browsers.
- [ ] No provider, microphone, personal profile, real clipboard, or external-service assertion is used.

## Phase 5: Continuous Integration And Release Deployment

### Task 21: Integrate Pull-Request Validation

**Description:** Extend the current PR-only landing job with cached Python setup, pinned docs installation, combined
Pages build/tests, and browser checks while retaining least privilege and zero deployment actions.

**Acceptance criteria:**

- [ ] PR job uses `actions/setup-python@v6` Python 3.12 with requirements caching and runs the canonical npm scripts.
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
  pinned docs environment, runs the combined validation set, configures Pages, and uploads one artifact.
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

- [ ] Documentation, landing, combined artifact, browser, workflow, relevant root checks, and Definition of Done pass;
  any unrelated baseline failure is recorded precisely.
- [ ] A human follows the documented workflows against the release candidate and approves main-screenshot privacy,
  factual accuracy, accessibility, and landing/docs consistency.
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

- [ ] Root and every required guide route load from the canonical URLs; landing/docs navigation, direct refreshes,
  local search, assets, sitemaps, robots, canonicals, response types, console, and 404 behavior are correct.
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

| Layer | Primary evidence |
| --- | --- |
| MkDocs configuration | Strict build, config/output tests, public-source boundary test |
| Assets/privacy | Hash/dimension/containment tests, staged tree inspection, human public-use review |
| Content | Navigation/terminology/settings coverage tests, source-code review, human workflow walkthrough |
| Landing | Typecheck, Vitest, Node contracts, pre-render inspection, existing SEO/accessibility/media checks |
| Combined artifact | Clean `pages:build`, artifact tree/canonical/private-path contracts, sitemap/robots validation |
| Browser/accessibility | Dedicated landing-to-MkDocs transition/round-trip test, exact path assertions, same-origin response log, Playwright across configured engines, axe, keyboard, reflow, forced colors |
| CI/release | Workflow contract tests, actionlint, local execution of build commands, permission/dependency inspection |
| Production | Authorized deployed smoke, response/canonical/console checks, GitHub Pages environment evidence |

Every task also applies `.agents/references/definition-of-done.md`: scoped changes, runtime verification, regression
coverage, passing lint/format for touched surfaces, integration review, current-state documentation, privacy/security
review where applicable, rollback awareness, and human approval before merge/deploy.

## Parallelization Opportunities

- Safe after Task 5: Markdown authoring for Tasks 6, 7, 8, 9, 10, and 11 is independent if each session owns
  distinct pages and reads current released contracts. One designated owner merges their `mkdocs.yml` navigation
  entries sequentially and runs the strict build after each merge.
- Safe after Task 2: Task 15 can proceed independently of bulk guide authoring; Task 16 follows it.
- Coordination required: `package.json`, `mkdocs.yml`, documentation tests, landing content schema, and workflow tests
  are shared contracts and must not be edited concurrently without explicit ownership.
- Sequential: Tasks 12–14 consolidate content; Tasks 17–24 depend on complete shared outputs and must follow the graph.
- No sub-agent delegation is assumed by this plan. Parallel sessions are optional and require the human to assign
  ownership before implementation.

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| MkDocs accidentally publishes internal `docs/` content | High privacy/process leak | Isolated `docs_dir`, strict nav, negative output tests before bulk content |
| Vite erases MkDocs output | High broken deployment | Vite-first canonical script plus reversed-order failure contract |
| Release deployment conflicts with current PR-only work | High workflow regression | Preserve PR job, keep `pages.yml` absent, add separate release jobs only after plan approval |
| Documentation defaults drift from application settings | High user harm | Field-to-page mapping, source-derived values, reviewed-release markers, same-PR maintenance rule |
| Screenshots expose sensitive state | High privacy harm | Main capture only, hash manifest, deterministic staging, negative reference-capture tests, human approval |
| Material theme loads remote fonts/assets | Medium privacy/reliability | `theme.font: false`, local assets, browser request-origin assertions |
| Python tooling adds unreproducible environment | Medium CI drift | Python 3.12, pinned requirements, isolated venv, cached requirements key, no global install |
| Combined browser suite becomes slow | Medium CI cost | Reuse existing preview/engines, focused docs cases, full cross-browser only in CI/release gates |
| Landing/docs base paths drift or double-prefix | High broken navigation | Exact pathname/canonical assertions, response failure collection, deep refresh, mobile/no-JS variants, and round-trip landing regression test |
| Crawl metadata duplicates or omits URLs | Medium discoverability | Generate from built canonicals/sitemap, validate XML, keep landing/docs ownership explicit |
| Release docs describe a different app revision | High trust issue | Release-gated build from release ref, deploy depends on release assets, post-deploy revision review |
| Dirty worktree edits are overwritten | High data loss | Patch only scoped lines, inspect diffs before every shared-file task, never reset/checkout destructively |

## Accepted Defaults And Remaining Decisions

Accepted for planning unless the human changes them during plan review:

- Route: `/gpt-voice/docs/`.
- Language: English-only baseline; no redirect and no i18n plugin.
- Screenshots: approved main screenshot only.
- Domain: `https://swimmwatch.github.io/gpt-voice/`.
- Deployment: published-release event through `.github/workflows/release-builds.yml`; PR validation never deploys.
- No custom domain, analytics, hosted search, blog, version selector, third-party runtime assets, or contributor docs.

Decisions still requiring explicit authorization later:

- Implementation start after this plan is approved.
- Any expanded screenshot public-use scope.
- Any dependency/version departure from the approved baseline.
- Publishing the release, changing repository Pages settings, or performing deployed verification.
