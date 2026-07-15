# Task List: MkDocs Project Documentation And GitHub Pages Integration

**Status:** Incremental implementation in progress. Tasks 1–6 and Checkpoint C are complete; Task 7 is next.
**Detailed plan:** `docs/specs/mkdocs-project-documentation/tasks/plan.md`

Every completed item must meet its acceptance criteria, verification steps, and the standing Definition of Done.

## Phase 1: Contract And Foundation

- [x] Task 1: Reconcile the cross-spec contract.
  - Acceptance: Both specs agree on `/docs/`, English/main-screenshot baseline, PR-only current state, Vite-first output,
    release-workflow deployment, and absent `pages.yml`.
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
- [x] Task 5: Apply the product theme.
  - Acceptance: Material uses landing tokens/local assets, accessible navigation, approved screenshot, and no remote
    runtime request.
  - Verify: Docs build/tests plus responsive local inspection.
  - Files: custom CSS, MkDocs config, overview, output test.

### Checkpoint C

- [x] Branded foundation, asset/privacy tests, and user-authorized visual review pass.

## Phase 2: User Documentation Slices

- [x] Task 6: Publish the installation journey.
  - Acceptance: Install/update/uninstall/retained-data and first-launch-to-clipboard flows match current packages/UI.
  - Verify: Strict build plus README/package/UI comparison.
  - Files: `install.md`, `getting-started.md`, `mkdocs.yml`, output contract test.
- [ ] Task 7: Publish the transcription path.
  - Acceptance: Recording/retry/output plus both provider lifecycles and qualifications are complete.
  - Verify: Strict build plus recording/provider contract review.
  - Files: transcription and provider guides plus `mkdocs.yml`.
- [ ] Task 8: Publish the text-action workflow.
  - Acceptance: Translation, Prettify, history, and tray workflows match released behavior and privacy constraints.
  - Verify: Strict build plus text-action/history/tray source review.
  - Files: text-action and history/tray guides plus `mkdocs.yml`.

### Checkpoint D

- [ ] Complete operational journeys build with no undocumented prerequisite.

- [ ] Task 9: Publish the core settings reference.
  - Acceptance: Settings lifecycle, provider controls, six shortcuts, defaults, conflicts, and action enables are covered.
  - Verify: Strict build plus provider/shortcut/settings-close field review.
  - Files: settings overview, provider settings, shortcut settings, `mkdocs.yml`.
- [ ] Task 10: Publish the Prettify reference.
  - Acceptance: Connection, key, model/memory, all generation controls, prompt, validation, and privacy are covered.
  - Verify: Strict build plus field-by-field source/default review.
  - Files: Prettify settings page and `mkdocs.yml`.
- [ ] Task 11: Publish the browser-network reference.
  - Acceptance: Browser behavior/identity and proxy/GeoIP dependencies cover every current field and warning.
  - Verify: Strict build plus browser/network/shared-contract review.
  - Files: Browser and Network settings pages plus `mkdocs.yml`.

### Checkpoint E

- [ ] Every settings surface has a source-derived authoritative page.

- [ ] Task 12: Publish the support reference.
  - Acceptance: Privacy/data, safe troubleshooting, and FAQ pages cover required symptoms and route to authoritative
    guidance.
  - Verify: Strict build plus storage/error/package review.
  - Files: privacy, troubleshooting, FAQ pages, `mkdocs.yml`.
- [ ] Task 13: Enforce documentation coverage.
  - Acceptance: Settings mapping, terminology, required content, screenshots, and maintenance markers are regression
    tested.
  - Verify: Representative negative tests, then docs tests/build.
  - Files: content test, settings test, settings fixture.
- [ ] Task 14: Link the README.
  - Acceptance: README prominently links the full public guide without becoming a duplicate settings manual.
  - Verify: Docs content test and rendered link review.
  - Files: README and content test.

### Checkpoint F

- [ ] Full English content, settings coverage, README link, and human accuracy/privacy review pass.

## Phase 3: Landing And Discoverability

- [ ] Task 15: Add the typed guide destination.
  - Acceptance: Typed landing schema/content centralize the documentation label and `/gpt-voice/docs/` URL.
  - Verify: Landing typecheck plus focused content/locale tests.
  - Files: schema, English content, content test.
- [ ] Task 16: Render the landing guide navigation.
  - Acceptance: Desktop, mobile, no-JavaScript, footer, and pre-rendered HTML expose the same guide route.
  - Verify: Landing component/contracts and production build inspection.
  - Files: header, page composition, header/page tests.

### Checkpoint G

- [ ] All landing guide entry points work without regressing CTAs, anchors, locale, or focus behavior.

- [ ] Task 17: Expose the guide in text discovery.
  - Acceptance: `llms.txt` links to the guide without duplicated/hidden content or changed locale equivalence.
  - Verify: Focused text-generation tests and fixture inspection.
  - Files: TXT generator and test.
- [ ] Task 18: Compose crawl metadata.
  - Acceptance: Deterministic root robots/landing sitemap reference the MkDocs sitemap and exclude private paths.
  - Verify: Metadata tests and built XML/text validation.
  - Files: metadata composer/test and package script.

### Checkpoint H

- [ ] Landing/docs HTML, TXT, robots, and sitemaps cross-link with valid canonical ownership.

## Phase 4: Combined Artifact And Browser Verification

- [ ] Task 19: Compose the Pages artifact.
  - Acceptance: Canonical Vite-first build produces root plus `/docs/`, preserves isolation, and fails on reversed order
    or leakage.
  - Verify: Clean `npm run pages:build`, artifact contract, tree inspection.
  - Files: package scripts and combined-build test.
- [ ] Task 20: Exercise the browser journey.
  - Acceptance: Desktop/mobile/no-JavaScript links reach the exact `/gpt-voice/docs/` canonical; docs assets and deep
    refreshes have no `4xx`/`5xx`, prefix duplication/escape, console error, or Pages 404; returning to the landing
    preserves an existing anchor and FAQ interaction.
  - Verify: Focused `opens MkDocs from the landing page without path errors` Playwright case, then full local Chromium
    and CI-equivalent cross-browser `pages:test:e2e`.
  - Files: Playwright config, documentation E2E, package script.

### Checkpoint I

- [ ] One local Pages candidate passes all integration, browser, and accessibility checks without external accounts,
  including a zero-error landing-to-MkDocs transition and functional return trip.

## Phase 5: Continuous Integration And Release Deployment

- [ ] Task 21: Integrate pull-request validation.
  - Acceptance: PR-only job installs cached Python docs tooling and validates combined Pages with no deploy action.
  - Verify: Workflow tests, actionlint, local command-order comparison.
  - Files: PR workflow and workflow test.
- [ ] Task 22: Add release-gated Pages deployment.
  - Acceptance: Published-release build depends on release assets, uploads one validated artifact, and deploys with
    least privilege; `pages.yml` remains absent.
  - Verify: Workflow tests, actionlint, local execution of all build commands without remote mutation.
  - Files: release workflow and workflow test.

### Checkpoint J

- [ ] PR/release separation, dependencies, permissions, artifact root, and no-write-back contracts pass.

## Phase 6: Review And Authorized Production Verification

- [ ] Task 23: Complete local release-candidate review.
  - Acceptance: Full relevant automated suite, human content/privacy/visual walkthrough, and deploy-ready handoff pass.
  - Verify: Commands listed in detailed plan plus complete spec/diff review.
  - Files: handoff and this checklist only unless findings create separately scoped fixes.
- [ ] Task 24: Verify the authorized deployment.
  - Acceptance: After explicit authorization, live root/docs routes, assets, navigation, search, crawl metadata,
    accessibility/SEO, release consistency, and rollback evidence pass.
  - Verify: Deployed smoke subset and GitHub Pages environment inspection.
  - Files: handoff and this checklist.

### Final Checkpoint

- [ ] All specification success criteria and Definition of Done items are satisfied.
- [ ] Human review is recorded before merge and before deployment.
- [ ] Landing and documentation are live, mutually navigable, release-consistent, and verified.
