# Task List: MkDocs Project Documentation And GitHub Pages Integration

**Status:** Tasks 1–14, 6a, 14b–14c, and Checkpoints D–E are complete; Task 14a has complete staged Russian and
Belarusian source sets plus staged Ukrainian core pages. Russian and Belarusian remain blocked pending
proficient-speaker review; Ukrainian recording is staged, while its remaining workflow/settings/support pages plus
seven further locale source sets remain incomplete.
**Detailed plan:** `docs/specs/mkdocs-project-documentation/tasks/plan.md`

Every completed item must meet its acceptance criteria, verification steps, and the standing Definition of Done.

## Phase 1: Contract And Foundation

- [x] Task 1: Reconcile the cross-spec contract.
  - Acceptance: The original completed slice aligned both specs on `/docs/`, English/main-screenshot baseline,
    PR-only current state, Vite-first output, release-workflow deployment, and absent `pages.yml`; Task 6a owns the
    later eleven-locale revision.
  - Verify: `git diff --check` plus manual deployment/boundary comparison.
  - Files: both scoped specification files.
- [x] Task 2: Deliver a minimal strict guide.
  - Acceptance: Pinned isolated MkDocs builds a canonical overview into `build/github-pages/docs/` with ignored output.
  - Verify: `npm run docs:install && npm run docs:build`; inspect output and `git status`.
  - Files: `mkdocs.yml`, requirements, overview, package scripts, `.gitignore`.
- [x] Task 3: Guard the public source boundary.
  - Acceptance: Tests prevent internal docs exposure and validate metadata/navigation/output paths.
  - Verify: Representative failing mutation, then `npm run docs:build && npm run docs:test`.
  - Files: MkDocs output test and package script.

### Checkpoint B

- [x] Strict guide builds and internal engineering content is proven absent.

- [x] Task 4: Stage approved documentation assets.
  - Acceptance: Deterministic sync publishes only local icon/fonts/approved main screenshot; tampering and reference
    captures fail.
  - Verify: Repeat sync/hash comparison and focused asset tests.
  - Files: asset script/test, package script, `.gitignore`.
- [x] Task 5: Apply the initial product theme (historical contract; superseded by pending Task 14b).
  - Acceptance: The original slice applied landing tokens/local assets, accessible navigation, the approved
    screenshot, and no remote runtime request.
  - Verify: Docs build/tests plus responsive local inspection.
  - Files: initial stylesheet, MkDocs config, overview, output test.

### Checkpoint C

- [x] Branded foundation, asset/privacy tests, and user-authorized visual review pass.

## Phase 2: User Documentation Slices

- [x] Task 6: Publish the installation journey.
  - Acceptance: Install/update/uninstall/retained-data and first-launch-to-clipboard flows match current packages/UI.
  - Verify: Strict build plus README/package/UI comparison.
  - Files: `install.md`, `getting-started.md`, `mkdocs.yml`, output contract test.
- [x] Task 6a: Establish the multilingual MkDocs foundation.
  - Acceptance: Pinned suffix-based `mkdocs-static-i18n` supports `en`, `ru`, `be`, `uk`, `es`, `pt-BR`, `zh-CN`,
    `ja`, `de`, `fr`, and `hi` with localized navigation/search, local glyph fonts, route adapters, no redirect, and
    no fallback publication. The production build remains English-only until Task 14a supplies complete reviewed
    translations.
  - Verify: Localized strict build plus locale/asset/public-boundary tests, including missing-page, stale-manifest,
    wrong-slug, and fallback mutations.
  - Files: requirements, MkDocs config, asset sync, locale contract, asset test.
- [x] Task 7: Publish the transcription path.
  - Acceptance: English source coverage for recording/retry/output plus both provider lifecycles and qualifications is
    complete and ready for translated-guide batches.
  - Verify: Strict build plus recording/provider contract review.
  - Files: transcription and provider guides plus `mkdocs.yml`.
- [x] Task 8: Publish the text-action workflow.
  - Acceptance: Translation, Prettify, history, and tray workflows match released behavior and privacy constraints.
  - Verify: Strict build plus text-action/history/tray source review.
  - Files: text-action and history/tray guides plus `mkdocs.yml`.

### Checkpoint D

- [x] Complete operational journeys build with no undocumented prerequisite.

- [x] Task 9: Publish the core settings reference.
  - Acceptance: Settings lifecycle, provider controls, six shortcuts, defaults, conflicts, and action enables are covered.
  - Verify: Strict build plus provider/shortcut/settings-close field review.
  - Files: settings overview, provider settings, shortcut settings, `mkdocs.yml`.
- [x] Task 10: Publish the Prettify reference.
  - Acceptance: Connection, key, model/memory, all generation controls, prompt, validation, and privacy are covered.
  - Verify: Strict build plus field-by-field source/default review.
  - Files: Prettify settings page and `mkdocs.yml`.
- [x] Task 11: Publish the browser-network reference.
  - Acceptance: Browser behavior/identity and proxy/GeoIP dependencies cover every current field and warning.
  - Verify: Strict build plus browser/network/shared-contract review.
  - Files: Browser and Network settings pages plus `mkdocs.yml`.

### Checkpoint E

- [x] Every settings surface has a source-derived authoritative page.

- [x] Task 12: Publish the support reference.
  - Acceptance: Privacy/data, safe troubleshooting, and FAQ pages cover required symptoms and route to authoritative
    guidance.
  - Verify: Strict build plus storage/error/package review, output/locale contracts, and documentation checks.
  - Files: privacy, troubleshooting, FAQ pages, `mkdocs.yml`, and documentation contracts.
- [x] Task 13: Enforce documentation coverage.
  - Acceptance: Settings mapping, terminology, required content, screenshots, and maintenance markers are regression
    tested.
  - Verify: Representative missing-setting and prohibited-claim tests, then docs tests/build.
  - Files: content test, settings test, settings fixture, and overview links.
- [x] Task 14: Link the README.
  - Acceptance: README prominently links the full public guide without becoming a duplicate settings manual.
  - Verify: Docs content test, negative destination mutations, and rendered link review.
  - Files: README and content test.
- [ ] Task 14a: Publish complete translated-guide batches.
  - Acceptance: Every public page is complete in all ten non-English suffix variants; hashes/review state in the
    non-public manifest are current; no guide silently falls back to English.
  - Verify: Per-locale strict build and negative missing/stale mutations, then `npm run docs:test` and recorded
    proficient-speaker review.
  - Files: Up to five localized Markdown files plus one manifest update per implementation increment.
- [x] Task 14b: Restore the Material-native theme contract.
  - Acceptance: Material for MkDocs owns all documentation components and layout; custom CSS contains only the
    approved landing palette plus required local font/glyph declarations, enforced by a regression contract.
  - Verify: Negative component-selector mutation, docs asset/build/test suite, and responsive Material-native visual
    inspection with no remote requests.
  - Files: palette stylesheet, MkDocs config, output/theme contract, asset test.
- [x] Task 14c: Apply the CloakBrowser reference visual treatment.
  - Acceptance: Hash-pinned GPT-Voice logo/wordmark, useful Material icons/features, icon-led overview cards, and
    reference-derived content styling match the landing palette while structural Material UI remains intact.
  - Verify: Asset sync, strict build, full documentation suite, negative structural-selector mutation, and responsive
    390/1440-pixel rendered checks with no console errors or remote runtime assets.
  - Files: logo staging, MkDocs config, overview sources, stylesheet, parser/asset/theme contracts, task artifacts.

### Checkpoint F

- [ ] English and every translated guide have complete content/settings coverage; README link, manifest, human
      accuracy/privacy review, and recorded proficient-speaker review all pass.
- [x] Material baseline and reference-derived visual contract pass before landing integration begins.

## Phase 3: Landing And Discoverability

- [ ] Task 15: Add the typed guide destination.
  - Acceptance: Typed landing schema/content centralize the active English documentation label and `/gpt-voice/docs/`
    path, while a pure route helper derives all eleven future paths, including `pt-br` and `zh-cn` adapters.
  - Verify: Landing typecheck plus focused all-locale content/route tests.
  - Files: schema, locale registry/content, content test.
- [ ] Task 16: Render the landing guide navigation.
  - Acceptance: Active English desktop, mobile, no-JavaScript, footer, and pre-rendered HTML expose the same guide
    route; no non-English landing content is published in this task.
  - Verify: Landing component/contracts, future-route contract, and English production-build inspection.
  - Files: header, page composition, header/page tests.

### Checkpoint G

- [ ] Active English landing guide entry points and the future-locale route matrix work without regressing CTAs,
      anchors, locale, or focus behavior.

- [ ] Task 17: Expose the guide in text discovery.
  - Acceptance: English `llms.txt` links to the guide without duplicated/hidden content or changed landing-content
    equivalence; the all-locale documentation sitemap remains the localized discovery source.
  - Verify: Focused English text-generation tests and fixture inspection, plus all-locale documentation sitemap test.
  - Files: TXT generator and test.
- [ ] Task 18: Compose crawl metadata.
  - Acceptance: Deterministic root robots/active-English landing sitemap reference the all-locale MkDocs sitemap,
    guide reciprocal alternates are complete, and private paths are excluded.
  - Verify: All-locale metadata tests and built XML/text validation.
  - Files: metadata composer/test and package script.

### Checkpoint H

- [ ] Active English landing/docs HTML and TXT cross-link with valid canonical ownership; every guide locale appears
      in the docs sitemap and language selector.

## Phase 4: Combined Artifact And Browser Verification

- [ ] Task 19: Compose the Pages artifact.
  - Acceptance: Canonical Vite-first build produces landing root plus all eleven `/docs/` locale roots, preserves
    isolation, and fails on reversed order, route mismatch, or leakage.
  - Verify: Clean `npm run pages:build`, artifact contract, tree inspection.
  - Files: package scripts and combined-build test.
- [ ] Task 20: Exercise the browser journey.
  - Acceptance: Active English desktop/mobile/no-JavaScript links reach the exact MkDocs canonical; every localized
    guide deep refresh has no `4xx`/`5xx`, wrong-case/fallback, prefix duplication/escape, console error, or Pages
    404; returning to the English landing preserves an anchor and FAQ interaction.
  - Verify: `opens MkDocs from the landing page without path errors` Playwright case for the active landing plus
    parameterized all-guide-locale direct-route checks, then full local Chromium and CI-equivalent cross-browser
    `pages:test:e2e`.
  - Files: Playwright config, documentation E2E, package script.

### Checkpoint I

- [ ] One local Pages candidate passes all integration, browser, and accessibility checks without external accounts,
      including a zero-error landing-to-MkDocs transition and functional return trip.

## Phase 5: Continuous Integration And Release Deployment

- [ ] Task 21: Integrate pull-request validation.
  - Acceptance: PR-only job installs cached Python docs tooling and validates all localized combined Pages output with
    no deploy action.
  - Verify: Workflow tests, actionlint, local command-order comparison.
  - Files: PR workflow and workflow test.
- [ ] Task 22: Add release-gated Pages deployment.
  - Acceptance: Published-release build depends on release assets, validates every guide locale, uploads one artifact,
    and deploys with least privilege; `pages.yml` remains absent.
  - Verify: Workflow tests, actionlint, local execution of all build commands without remote mutation.
  - Files: release workflow and workflow test.

### Checkpoint J

- [ ] PR/release separation, dependencies, permissions, artifact root, and no-write-back contracts pass.

## Phase 6: Review And Authorized Production Verification

- [ ] Task 23: Complete local release-candidate review.
  - Acceptance: Full all-guide-locale automated suite, English landing/content/privacy/visual walkthrough, recorded
    proficient-speaker reviews, and deploy-ready handoff pass.
  - Verify: Commands listed in detailed plan plus complete spec/diff review.
  - Files: handoff and this checklist only unless findings create separately scoped fixes.
- [ ] Task 24: Verify the authorized deployment.
  - Acceptance: After explicit authorization, the active English landing and every live guide locale route, assets,
    navigation, language switching, search, crawl metadata, accessibility/SEO, release consistency, and rollback
    evidence pass.
  - Verify: Deployed smoke subset and GitHub Pages environment inspection.
  - Files: handoff and this checklist.

### Final Checkpoint

- [ ] All specification success criteria and Definition of Done items are satisfied.
- [ ] Human review is recorded before merge and before deployment.
- [ ] Landing and documentation are live, mutually navigable, release-consistent, and verified.
