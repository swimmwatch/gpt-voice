# Implementation Plan: Build Size Optimization

Status: Draft for human review
Specification: [`../spec.md`](../spec.md)
Research: [`../../../researches/optimization-build-07-11.26/main.md`](../../../researches/optimization-build-07-11.26/main.md)

## Overview

Implement build-size optimization as a sequence of independently measurable changes. Establish trusted metrics first, remove duplicate package content second, optimize renderer loading third, and integrate cross-platform budgets last. CloakBrowser metadata pruning is isolated behind an external confirmation gate so safe P0/P1 work can complete without depending on it.

## Architecture Decisions

- Use Node built-ins for filesystem traversal and gzip/Brotli measurements, plus an explicit development dependency on `@electron/asar` for ASAR inventory.
- Store reviewed, versioned baselines under `build/size-baselines/`; write generated reports only to ignored `release-artifacts/` paths.
- Clean `dist` once through a dedicated build script before the three Webpack compilers run.
- Keep only dynamically resolved/external runtime dependency closures in production dependencies; audit the full lockfile because renderer code remains shipped after bundling.
- Preserve CommonJS for main/preload and add a renderer-only ESM TypeScript configuration.
- Use four thin renderer entry modules backed by one shared bootstrap function; assign exact chunks to each HTML page.
- Use `mini-css-extract-plugin` and `css-minimizer-webpack-plugin` only in production; retain the inline startup shell and development `style-loader`.
- Keep electron-builder `compression: normal`; size gains must come from removing bytes, not slower compression.
- Measure macOS x64 and arm64 separately. Measurement jobs may build unsigned artifacts, but publication remains subject to existing signing/notarization policy.
- Do not prune CloakBrowser files until written upstream confirmation is recorded. Never prune actual locale `.pak` files.

## Dependency Graph

```text
Task 1: metric primitives
    |
    +--> Task 2: measurement and budget CLIs
             |
             +--> Task 3: startup benchmark
             +--> Task 4: deterministic production clean
                     |
                     +--> Task 5: packaged inventory policy
                              |
                              +--> Task 6: runtime dependency classification
                                      |
                                      +--> Task 7: runtime assets and locales
             |
             +--> Task 8: renderer ESM
                     |
                     +--> Task 9: window bootstraps
                              |
                              +--> Task 10: window chunk wiring
                                       |
                                       +--> Task 11: production CSS

Tasks 7 + 11
    |
    +--> Task 12: Linux measurement integration
    +--> Task 13: Windows measurement integration
    +--> Task 14: macOS x64/arm64 measurement
             |
             +--> Task 15: safe-scope audit and documentation

External upstream confirmation
    |
    +--> Task 16: CloakBrowser manifest policy
             |
             +--> Task 17: guarded pruning integration
                      |
                      +--> Task 18: cross-platform guarded validation
```

## Phase 1: Measurement Foundation

- [x] Task 1: Define size metric primitives.
- [x] Task 2: Add build-size CLIs.
- [x] Task 3: Add a cold-start benchmark harness.

### Checkpoint: Trusted Baseline

- [ ] Pure metric and CLI tests pass.
- [ ] A Linux report can be reproduced from the current package.
- [ ] Missing Windows/macOS values are represented explicitly, not as zero.
- [x] Startup measurements run in an isolated temporary app profile.
- [ ] Human reviews report schema and regression semantics before package changes begin.

## Phase 2: Deterministic Packaging

- [x] Task 4: Clean production output deterministically.
- [x] Task 5: Enforce packaged inventory policy.

### Checkpoint: Deterministic Inventory

- [ ] Clean and reused workspaces produce the same production inventory.
- [ ] Production ASAR contains no source maps, stale assets, tests, declarations, or unexpected top-level modules.
- [ ] Human reviews the packaged inventory rules before dependency ownership changes.

- [ ] Task 6: Reclassify bundled dependencies.
- [ ] Task 7: Filter runtime assets and Electron locales.

### Checkpoint: Lean Packaged Runtime

- [ ] `app.asar` is at or below 25 MiB.
- [ ] Electron locale and runtime asset allowlists pass packaged verification.
- [ ] ChatGPT Web, OpenAI API, Google Translate, Ollama/vLLM, tray, icon, and session smoke checks pass.

## Phase 3: Renderer Optimization

- [ ] Task 8: Preserve ESM in the renderer.
- [ ] Task 9: Create per-window renderer bootstraps.
- [ ] Task 10: Wire per-window chunks.

### Checkpoint: Window Chunk Wiring

- [ ] Main, Settings, History, and About load only their entry and required shared chunks.
- [ ] Main/preload remain CommonJS-compatible and renderer type/build checks pass.
- [ ] All windows open through `app://` without blank or chunk-load errors.

- [ ] Task 11: Extract production CSS.

### Checkpoint: Window Bundles

- [ ] Main-window initial JavaScript, including required initial shared chunks, is at or below 564,421 raw bytes.
- [ ] Production CSS is separate and minified; development style injection remains functional.
- [ ] All windows retain the immediate graphite shell, progress cursor, anti-flicker behavior, styles, and error visibility.
- [ ] Ten-run median cold startup does not regress by more than 5%.

## Phase 4: Platform Integration

- [ ] Task 12: Integrate Linux size reporting.
- [ ] Task 13: Integrate Windows size reporting.
- [ ] Task 14: Establish macOS x64/arm64 measurement.

### Checkpoint: Platform Measurements

- [ ] Linux AppImage, Debian, and RPM reports are captured and independently budgeted.
- [ ] Windows x64 unpacked and NSIS reports are captured and independently budgeted.
- [ ] macOS x64 and arm64 app/DMG reports are captured separately.
- [ ] Human reviews platform baselines before the safe-scope audit.

- [ ] Task 15: Complete the safe-scope audit.

### Checkpoint: Safe Scope Complete

- [ ] Every produced installer is smaller than its same-platform baseline or has an approved documented exception.
- [ ] Full quality, security, browser, packaged-runtime, and installer gates pass.
- [ ] Research and specification reflect measured final results rather than estimates.

## Phase 5: Guarded CloakBrowser Pruning

This phase starts only after the upstream confirmation checkpoint is satisfied.

- [ ] Task 16: Define the CloakBrowser runtime manifest policy.
- [ ] Task 17: Apply guarded CloakBrowser pruning.
- [ ] Task 18: Validate guarded pruning across platforms.

### Checkpoint: Upstream Confirmation

- [ ] Written upstream confirmation states that `.pak.info` and `chromedriver` are unnecessary for the JavaScript Playwright runtime on supported platforms.
- [ ] Binary redistribution/download terms are recorded and compatible with the release approach.
- [ ] The human explicitly approves enabling Task 17.

### Checkpoint: Guarded Scope Complete

- [ ] Runtime manifests fail closed on unexpected upstream changes.
- [ ] All actual locale `.pak` files remain present.
- [ ] Headed/headless, persistent profile, login, translation, GeoIP, proxy, retry, crash, and shutdown checks pass on every release platform.
- [ ] Linux CloakBrowser runtime is approximately 567 MiB and actual installer savings are recorded separately.
- [ ] No platform artifact or startup metric regresses beyond its approved budget.

## Verification Strategy

Each task runs its focused tests first, then the standing Definition of Done for the changed surface. Checkpoints run the broader commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run validate:dependabot
npm run audit:prod
npm run audit:all
npm run build:prod
```

Packaging checkpoints additionally run the applicable native commands:

```bash
npm run prepare:cloakbrowser
npm run smoke:cloakbrowser
npm run pack
npm run verify:packaged
npm run verify:installers
```

Linux release verification uses the Fedora build path. Windows and macOS verification runs on native CI hosts.

## Parallelization

- Upstream CloakBrowser confirmation research may proceed while safe phases are implemented, but Tasks 16-18 remain blocked until the gate is approved.
- After Task 2, startup benchmark work and deterministic clean work are logically independent, but both touch `package.json`; parallel branches require explicit ownership and lockfile coordination.
- Linux, Windows, and macOS measurement execution can run in parallel after Task 11. Workflow edits and shared collection scripts must be assigned to one owner or integrated sequentially.
- Renderer ESM and packaging policy work are conceptually independent after measurement exists, but both affect production baselines; merge and rebaseline one change at a time.
- Tasks sharing `webpack.config.js`, `package.json`, `package-lock.json`, or release workflows should not be implemented concurrently without a pre-agreed merge order.

## Risks and Mitigations

| Risk                                                                    | Impact | Mitigation                                                                                                            |
| ----------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Size reports differ by filesystem or archive metadata                   | High   | Use integer byte counts, stable sorting, explicit platform metadata, and tolerance only for documented nondeterminism |
| Full-lockfile audit exposes existing development findings               | Medium | Triage explicitly; do not suppress high-severity shipped-code findings or weaken the audit threshold                  |
| Dependency reclassification removes a dynamic runtime import            | High   | Maintain positive runtime roots, inspect ASAR, and smoke every provider/browser flow from packaged output             |
| Electron locale filtering breaks Belarusian fallback or native surfaces | Medium | Test all four app locales and retain English fallback packs on each OS                                                |
| ESM changes main/preload behavior accidentally                          | High   | Use a renderer-only tsconfig and assert main/preload CommonJS output remains unchanged                                |
| Split chunks fail through `app://`                                      | High   | Test nested hashed assets, MIME types, CSP, and each HTML entry from Electron before continuing                       |
| Extracted CSS restores white flashes or layout shifts                   | High   | Keep inline startup styling and run screenshot/startup checks at every window size                                    |
| Startup benchmark is noisy                                              | Medium | Use isolated profiles, ten cold runs, median statistics, and the same host class for comparisons                      |
| macOS measurement lacks signing credentials                             | Medium | Measure unsigned CI artifacts separately; do not publish or weaken signing policy                                     |
| CloakBrowser upstream layout changes                                    | High   | Version the expected manifest and fail closed before copying/pruning files                                            |
| Installer compression hides raw savings                                 | Medium | Report raw runtime, ASAR, unpacked app, and final artifacts independently                                             |

## Rollback Strategy

- Keep every optimization in an isolated commit or pull request so it can be reverted independently.
- Baseline changes are reviewed separately from implementation changes when possible.
- Preserve the previous dependency classification and runtime manifest in version control.
- If renderer chunks or CSS regress startup, revert only the renderer phase without reverting package cleanup.
- If a platform package fails, disable that platform-specific optimization rather than weakening verification globally.
- CloakBrowser pruning must be removable by restoring full-copy behavior in `prepare-cloakbrowser.mjs`.

## Open Questions

No planning question blocks the safe P0/P1 phases. CloakBrowser upstream confirmation and binary terms remain explicit external gates for Phase 5.
