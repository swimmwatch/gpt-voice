# Task List: Build Size Optimization

Status: Draft for human review
Specification: [`../spec.md`](../spec.md)

## Task 1: Define Size Metric Primitives

**Description:** Add small, deterministic helpers for byte measurement, gzip/Brotli calculation, report ordering, and regression threshold evaluation. Keep these functions independent from repository layout so they can be tested with synthetic fixtures.

**Acceptance criteria:**

- [x] Metrics use integer bytes and stable metric identifiers; presentation formatting does not alter stored values.
- [x] The budget rule triggers only when growth exceeds both 2% and 2 MiB and rejects invalid baselines.
- [x] Gzip/Brotli and recursive-size helpers handle empty files, missing paths, and nested fixtures deterministically.

**Verification:**

- [x] Focused tests pass: `node --import tsx --test tests/scripts/buildSizeMetrics.test.ts`
- [x] Types pass: `npm run test:types`
- [x] Lint passes: `npm run lint`

**Dependencies:** None

**Files likely touched:**

- `scripts/build-size-metrics.mjs`
- `tests/scripts/buildSizeMetrics.test.ts`

**Estimated scope:** Small (2 files)

## Task 2: Add Build-Size CLIs

**Description:** Build the `measure:size` and `verify:size` commands around one shared CLI module. Inventory emitted assets, ASAR contents, Electron/CloakBrowser resources, unpacked output, and installer artifacts with platform-aware layouts and machine-readable missing values.

**Increment progress:**

- [x] `measure:size` writes a deterministic report and concise summary from packaged artifacts.
- [x] `verify:size`, the reviewed Linux baseline, and full-lockfile audit integration are complete.

**Acceptance criteria:**

- [x] `measure:size` emits stable JSON plus a concise summary without absolute user paths or sensitive content.
- [x] `verify:size` compares matching report/baseline metrics and fails only under the specified regression rule.
- [x] `@electron/asar`, command scripts, the full audit command, and package metadata are declared explicitly.

**Verification:**

- [x] Focused tests pass: `node --import tsx --test tests/scripts/buildSizeCli.test.ts`
- [x] Linux report succeeds after `npm run pack`: `npm run measure:size -- --platform=linux --arch=x64 --output=release-artifacts/size-linux-x64.json`
- [x] Budget verification succeeds against a fixture baseline: `npm run verify:size -- --report=release-artifacts/size-linux-x64.json --baseline=build/size-baselines/v1.4.0-linux-x64.json`

**Dependencies:** Task 1

**Files likely touched:**

- `scripts/build-size-cli.mjs`
- `tests/scripts/buildSizeCli.test.ts`
- `package.json`
- `package-lock.json`
- `build/size-baselines/v1.4.0-linux-x64.json`

**Estimated scope:** Medium (5 files)

## Task 3: Add Cold-Start Benchmark Harness

**Description:** Add a development-only Electron startup benchmark that launches isolated temporary profiles, waits for the existing stable-window readiness signal, records ten cold runs, and reports the median without touching personal sessions.

**Acceptance criteria:**

- [x] The harness uses temporary app data and closes every Electron process after each run, including failure paths.
- [x] Output records platform, architecture, run count, individual durations, median, and tool versions in stable JSON.
- [x] Benchmark helpers validate run counts and median calculations with deterministic tests.

**Verification:**

- [x] Focused tests pass: `node --import tsx --test tests/scripts/startupBenchmark.test.ts`
- [x] Benchmark completes: `npm run measure:startup -- --runs=10 --output=release-artifacts/startup-linux-x64.json`
- [x] No GPT-Voice or CloakBrowser process remains after the command exits.

**Dependencies:** Task 2

**Files likely touched:**

- `scripts/measure-startup.mjs`
- `scripts/startup-benchmark.mjs`
- `tests/scripts/startupBenchmark.test.ts`
- `package.json`

**Estimated scope:** Medium (4 files)

## Checkpoint 1: Trusted Baseline

- [ ] Tasks 1-3 meet their acceptance criteria.
- [ ] `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:types`, and `npm test` pass.
- [ ] Human reviews report schema, baseline semantics, and startup isolation before packaging changes.

## Task 4: Clean Production Output Deterministically

**Description:** Clean `dist` once before production compilation, preserve development source maps, and exclude source maps/diagnostic files from electron-builder input without allowing one Webpack compiler to delete another compiler's output.

**Acceptance criteria:**

- [x] A reused workspace and a clean workspace produce the same production file inventory.
- [x] Development builds still emit configured source maps; production packaging includes no source maps or stale hashes.
- [x] All production/package scripts invoke the single clean path consistently.

**Verification:**

- [x] Focused tests pass: `node --import tsx --test tests/scripts/cleanDist.test.ts`
- [x] Reproduction passes: `npm run build && npm run build:prod && npm run pack`
- [x] Size inventory reports no `dist/**/*.map` in ASAR.

**Dependencies:** Task 2

**Files likely touched:**

- `scripts/clean-dist.mjs`
- `tests/scripts/cleanDist.test.ts`
- `package.json`

**Estimated scope:** Medium (3 files)

## Task 5: Enforce Packaged Inventory Policy

**Description:** Extend packaged verification with a reusable ASAR/runtime inventory policy. Require critical runtime roots and reject source maps, declarations, tests, stale renderer assets, unexpected modules, and duplicated resource paths.

**Acceptance criteria:**

- [x] Inventory policy has explicit required, allowed, and rejected path categories with cross-platform separators normalized.
- [x] `verify:packaged` inspects ASAR contents and reports concise relative-path violations.
- [x] Synthetic policy tests cover missing required files, unexpected modules, stale assets, and diagnostic files.

**Verification:**

- [x] Focused tests pass: `node --import tsx --test tests/scripts/packagedRuntimePolicy.test.ts`
- [x] Packaged verification passes: `npm run pack && npm run verify:packaged`
- [x] A synthetic forbidden map/module fixture fails with a readable error.

**Dependencies:** Tasks 2 and 4

**Files likely touched:**

- `scripts/packaged-runtime-policy.mjs`
- `scripts/verify-packaged-runtime.mjs`
- `tests/scripts/packagedRuntimePolicy.test.ts`

**Estimated scope:** Medium (3 files)

## Checkpoint 2A: Deterministic Inventory

- [ ] Tasks 4-5 meet their acceptance criteria.
- [ ] Clean/reused workspace inventories match and packaged diagnostics are rejected.
- [ ] Human reviews the packaged inventory policy before dependency ownership changes.

## Task 6: Reclassify Bundled Dependencies

**Description:** Move renderer-only and already-bundled pure JavaScript packages out of the packaged production dependency graph while retaining the complete CloakBrowser/Playwright dynamic runtime closure. Align Dependabot grouping and full-lockfile auditing with the new ownership model.

**Acceptance criteria:**

- [ ] Packaged production dependencies contain only approved external runtime roots and required transitive packages.
- [ ] React/UI and bundled main/preload libraries remain build inputs, receive Dependabot updates, and are covered by `audit:all`.
- [ ] Packaged ChatGPT Web, OpenAI API, translation, Ollama/vLLM, renderer logging, and startup flows resolve without missing modules.

**Verification:**

- [ ] Dependency installation and audits pass: `npm ci && npm run audit:prod && npm run audit:all`
- [ ] Package checks pass: `npm run pack && npm run verify:packaged`
- [ ] `app.asar` measurement is at or below 25 MiB.

**Dependencies:** Task 5

**Files likely touched:**

- `package.json`
- `package-lock.json`
- `.github/dependabot.yml`
- `tests/scripts/packagedRuntimePolicy.test.ts`

**Estimated scope:** Medium (4 files)

## Task 7: Filter Runtime Assets and Electron Locales

**Description:** Remove the duplicate ASAR asset copy, filter `extraResources` to runtime icons, and retain only validated Electron locale packs while preserving installer icon sources and all CloakBrowser locales.

**Acceptance criteria:**

- [ ] ASAR no longer contains the duplicated root `assets` tree; external resources contain only runtime-required icons/assets.
- [ ] Electron retains `en-US`, `en-GB`, `ru`, and `uk`; CloakBrowser `.pak` files are unchanged.
- [ ] App/tray/Linux desktop icons and English/Russian/Ukrainian/Belarusian fallback behavior pass packaged checks.

**Verification:**

- [ ] Focused tests pass: `node --import tsx --test tests/scripts/packagedRuntimePolicy.test.ts tests/main/linuxDesktopIcons.test.ts`
- [ ] Package checks pass: `npm run pack && npm run verify:packaged`
- [ ] Linux Electron locale measurement is at or below 4 MiB.

**Dependencies:** Task 6

**Files likely touched:**

- `package.json`
- `scripts/packaged-runtime-policy.mjs`
- `tests/scripts/packagedRuntimePolicy.test.ts`
- `tests/main/linuxDesktopIcons.test.ts`

**Estimated scope:** Medium (4 files)

## Checkpoint 2: Lean Packaged Runtime

- [ ] Tasks 4-7 meet their acceptance criteria.
- [ ] Full quality and audit commands pass.
- [ ] `npm run pack`, `npm run smoke:cloakbrowser`, and `npm run verify:packaged` pass.
- [ ] ASAR, asset, locale, and installer deltas are recorded before renderer work.
- [ ] Human reviews dependency/runtime ownership before continuing.

## Task 8: Preserve ESM in the Renderer

**Description:** Add a renderer-only TypeScript configuration that preserves ESM for Webpack tree shaking while leaving main, preload, tests, and the package CommonJS model unchanged.

**Acceptance criteria:**

- [ ] Renderer uses `module: "ESNext"` or `"preserve"`, `moduleResolution: "bundler"`, and the approved modern target.
- [ ] Main/preload production output remains CommonJS-compatible and existing type checks pass.
- [ ] Webpack stats show unused Lucide exports removed and fewer CommonJS/module-concatenation bailouts.

**Verification:**

- [ ] Focused contract tests pass: `node --import tsx --test tests/scripts/webpackConfig.test.ts`
- [ ] Types/build pass: `npm run typecheck && npm run test:types && npm run build:prod`
- [ ] Size report records the renderer delta from 664,025 raw bytes.

**Dependencies:** Task 2

**Files likely touched:**

- `tsconfig.renderer.json`
- `webpack.config.js`
- `tests/scripts/webpackConfig.test.ts`

**Estimated scope:** Medium (3 files)

## Task 9: Create Per-Window Renderer Bootstraps

**Description:** Extract the shared provider/startup/toast renderer shell into one typed bootstrap function and add thin explicit entry modules for Main, App Settings, History, and About without changing the active Webpack entry yet.

**Acceptance criteria:**

- [ ] Each entry selects exactly one top-level window component and uses the shared startup/I18n/tooltip/toast shell.
- [ ] Entry modules contain no pathname routing and no duplicated provider setup.
- [ ] Existing renderer behavior remains active until Task 10 wires the entries.

**Verification:**

- [ ] Types pass: `npm run typecheck && npm run test:types`
- [ ] Existing renderer tests pass: `npm test`
- [ ] Development and production builds remain unchanged: `npm run build && npm run build:prod`

**Dependencies:** Task 8

**Files likely touched:**

- `src/renderer/bootstrapWindow.tsx`
- `src/renderer/entries/main.tsx`
- `src/renderer/entries/settings.tsx`
- `src/renderer/entries/history.tsx`
- `src/renderer/entries/about.tsx`

**Estimated scope:** Medium (5 files)

## Task 10: Wire Per-Window Chunks

**Description:** Replace pathname-based eager routing with explicit Webpack entries, exact HtmlWebpackPlugin chunk assignment, and shared-chunk rules. Verify emitted HTML and guarded `app://` loading for nested hashed assets.

**Acceptance criteria:**

- [ ] Each HTML file references only its own entry plus required shared/runtime chunks.
- [ ] Main does not include Settings/History/About-only modules; supporting windows exclude unrelated window modules.
- [ ] `app://` safely serves nested hashed JS/CSS assets with correct MIME types and no traversal regression.

**Verification:**

- [ ] Focused tests pass: `node --import tsx --test tests/scripts/rendererBundle.test.ts tests/main/appProtocol.test.ts`
- [ ] Production build passes: `npm run build:prod`
- [ ] Manual Electron check opens all four windows without blank/error states.

**Dependencies:** Task 9

**Files likely touched:**

- `webpack.config.js`
- `src/renderer/index.tsx`
- `tests/scripts/rendererBundle.test.ts`
- `tests/main/appProtocol.test.ts`

**Estimated scope:** Medium (4 files)

## Checkpoint 3A: Window Chunk Wiring

- [ ] Tasks 8-10 meet their acceptance criteria.
- [ ] Main/preload CommonJS compatibility and renderer ESM checks pass.
- [ ] All four Electron windows load their exact chunks through `app://`.
- [ ] Human reviews emitted HTML/chunk inventories before CSS extraction.

## Task 11: Extract Production CSS

**Description:** Use maintained Webpack plugins to emit and minify production CSS while retaining development style injection and the inline graphite startup shell.

**Acceptance criteria:**

- [ ] Production HTML loads minified CSS assets; development continues to use `style-loader`.
- [ ] Inline startup background/loader remains visible until existing readiness signals complete, with reduced-motion behavior unchanged.
- [ ] Main-window initial JavaScript, including required initial shared chunks, is at or below 564,421 bytes and no window loses styles.

**Verification:**

- [ ] Dependency and focused tests pass: `npm ci && node --import tsx --test tests/scripts/rendererBundle.test.ts tests/main/windowAppearance.test.ts tests/renderer/windowStartupState.test.ts`
- [ ] Production build/size pass: `npm run build:prod && npm run measure:size -- --platform=linux --arch=x64 --output=release-artifacts/size-linux-x64.json`
- [ ] Ten-run startup benchmark remains within 5% and all four windows show no white flash or layout shift.

**Dependencies:** Task 10

**Files likely touched:**

- `package.json`
- `package-lock.json`
- `webpack.config.js`
- `src/renderer/index.html`
- `tests/scripts/rendererBundle.test.ts`

**Estimated scope:** Medium (5 files)

## Checkpoint 3: Window Bundles

- [ ] Tasks 8-11 meet their acceptance criteria.
- [ ] Full quality, audit, and production build commands pass.
- [ ] Main, Settings, History, and About pass Electron runtime and visual checks.
- [ ] Renderer size and startup budgets pass against the pre-renderer baseline.
- [ ] Human reviews bundle inventory and screenshots before platform workflow changes.

## Task 12: Integrate Linux Size Reporting

**Description:** Run measurement and budget verification inside the Fedora smoke/release path, retain reports with Linux artifacts, and establish independently reviewed AppImage, Debian, RPM, unpacked, ASAR, locale, and browser metrics.

**Acceptance criteria:**

- [ ] Fedora smoke produces an unpacked size report; release mode produces and verifies all three installer metrics.
- [ ] CI uploads Linux JSON/startup reports without generated machine paths or sensitive data.
- [ ] Post-optimization Linux reports remain separate from the immutable v1.4.0 comparison baseline.

**Verification:**

- [ ] Fedora smoke passes: `npm run smoke:fedora`
- [ ] Fedora release path passes: `npm run dist:fedora`
- [ ] Linux `verify:size`, `verify:packaged`, and `verify:installers -- --platform=linux` pass.

**Dependencies:** Tasks 7 and 11

**Files likely touched:**

- `build/fedora-release/fedora-release-entrypoint.mjs`
- `.github/workflows/pr-checks.yml`
- `.github/workflows/release-builds.yml`
- `build/size-baselines/v1.4.0-linux-x64.json`

**Estimated scope:** Medium (4 files)

## Task 13: Integrate Windows Size Reporting

**Description:** Rebuild the v1.4.0 reference and add Windows x64 unpacked/NSIS measurements to package smoke and release jobs. Preserve generated reports during artifact collection and enforce independent Windows budgets.

**Acceptance criteria:**

- [ ] The Windows baseline is reproduced from v1.4.0 on the same runner class used for optimized measurements.
- [ ] Windows release reports and verifies NSIS size without hiding a Windows regression behind Linux savings.
- [ ] Collected Windows artifacts include sanitized size/startup JSON and checksums.

**Verification:**

- [ ] Windows native CI runs `npm run measure:size -- --platform=win32 --arch=x64 --output=release-artifacts/size-win32-x64.json`.
- [ ] Windows `verify:size`, `verify:packaged`, and `verify:installers -- --platform=win32` pass.
- [ ] Collected release artifacts contain installer, checksum, and report files.

**Dependencies:** Tasks 7 and 11

**Files likely touched:**

- `.github/workflows/pr-checks.yml`
- `.github/workflows/release-builds.yml`
- `scripts/collect-release-artifacts.mjs`
- `build/size-baselines/v1.4.0-win32-x64.json`

**Estimated scope:** Medium (4 files)

## Task 14: Establish macOS Measurements

**Description:** Add native macOS x64 and arm64 measurement jobs that build separate v1.4.0 reference and optimized DMGs, verify packaged runtime contents, and establish platform baselines without publishing unsigned artifacts.

**Acceptance criteria:**

- [ ] Native x64 and arm64 jobs reproduce v1.4.0 and optimized app/DMG/startup reports on matching runner classes and never substitute a universal artifact.
- [ ] Packaged runtime verification covers icons, license, privacy manifest, ASAR, fuses, and CloakBrowser for both architectures.
- [ ] Unsigned measurement artifacts remain CI-only until existing signing/notarization policy is satisfied.

**Verification:**

- [ ] Both native jobs run matching `measure:size` and `verify:size` commands.
- [ ] `npm run verify:packaged` succeeds for each architecture layout.
- [ ] Reports establish reviewed x64 and arm64 baselines with missing values prohibited.

**Dependencies:** Tasks 7 and 11

**Files likely touched:**

- `.github/workflows/macos-package-measurement.yml`
- `scripts/collect-release-artifacts.mjs`
- `build/size-baselines/v1.4.0-darwin-x64.json`
- `build/size-baselines/v1.4.0-darwin-arm64.json`

**Estimated scope:** Medium (4 files)

## Checkpoint 4A: Platform Measurements

- [ ] Tasks 12-14 meet their acceptance criteria.
- [ ] Linux, Windows, macOS x64, and macOS arm64 reports are complete and independently reviewed.
- [ ] No missing metric is represented as zero.
- [ ] Human approves the platform evidence before the safe-scope audit.

## Task 15: Complete Safe-Scope Audit

**Description:** Run the complete repository and platform verification set, compare every final measurement with research baselines, and update durable documentation with measured safe-scope results and remaining guarded work.

**Acceptance criteria:**

- [ ] Every safe requirement and numeric budget in the specification has linked evidence or an approved exception.
- [ ] Research distinguishes final measured values from original estimates and records platform limitations.
- [ ] Pull request documentation includes artifact deltas, startup results, security impact, screenshots, and rollback notes.

**Verification:**

- [ ] Full CI-equivalent quality, audit, browser, build, package, and installer commands pass.
- [ ] All supported platform reports pass `verify:size` independently.
- [ ] Human reviews the safe-scope report before Phase 5 is considered.

**Dependencies:** Tasks 12-14

**Files likely touched:**

- `docs/researches/optimization-build-07-11.26/main.md`
- `docs/specs/build-size-optimization/spec.md`
- `docs/specs/build-size-optimization/tasks/plan.md`
- `docs/specs/build-size-optimization/tasks/todo.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

**Estimated scope:** Medium (5 files)

## Checkpoint 4: Safe Scope Complete

- [ ] Tasks 12-15 meet their acceptance criteria.
- [ ] All safe P0/P1 success criteria are satisfied.
- [ ] Platform artifacts and startup results are reviewed independently.
- [ ] Human approves completion of safe scope.

## External Gate: CloakBrowser Confirmation

- [ ] Written upstream confirmation covers `.pak.info` and `chromedriver` for JavaScript Playwright distributions on Linux, Windows, and macOS.
- [ ] Binary redistribution/download terms are documented and compatible with GPT-Voice releases.
- [ ] Human explicitly authorizes guarded implementation.

## Task 16: Define CloakBrowser Runtime Manifest Policy

**Description:** Encode the confirmed upstream runtime contract as a versioned, fail-closed manifest policy without changing prepared browser files yet.

**Acceptance criteria:**

- [ ] Policy identifies required runtime roots, allowed metadata removals, preserved locale `.pak` files, and supported platform layouts.
- [ ] Unknown CloakBrowser versions or changed expected files fail before packaging.
- [ ] Tests cover Linux, Windows, macOS, missing required files, and unexpected upstream layout changes.

**Verification:**

- [ ] Focused tests pass: `node --import tsx --test tests/scripts/cloakBrowserRuntimePolicy.test.ts`
- [ ] Current unpruned runtime passes the policy on the native platform.
- [ ] A synthetic version/layout change fails closed with a concise error.

**Dependencies:** Task 15 and the external confirmation gate

**Files likely touched:**

- `scripts/cloakbrowser-runtime-policy.mjs`
- `tests/scripts/cloakBrowserRuntimePolicy.test.ts`
- `docs/researches/optimization-build-07-11.26/main.md`

**Estimated scope:** Medium (3 files)

## Task 17: Apply Guarded CloakBrowser Pruning

**Description:** Apply the approved manifest during browser preparation, remove only confirmed `.pak.info`/`chromedriver` files, and verify the prepared and packaged runtime against the same policy.

**Acceptance criteria:**

- [ ] Pruning happens before packaging/signing and removes only manifest-approved paths.
- [ ] Every actual locale `.pak` and required browser runtime file remains present.
- [ ] Prepared and packaged runtime verification reports version, platform, safe counts, and byte totals without private paths.

**Verification:**

- [ ] Focused policy tests pass.
- [ ] Native preparation/smoke/package checks pass: `npm run prepare:cloakbrowser && npm run smoke:cloakbrowser && npm run pack && npm run verify:packaged`
- [ ] Linux runtime is approximately 567 MiB and installer savings are measured separately.

**Dependencies:** Task 16

**Files likely touched:**

- `scripts/prepare-cloakbrowser.mjs`
- `scripts/cloakbrowser-runtime-policy.mjs`
- `scripts/verify-packaged-runtime.mjs`
- `scripts/smoke-cloakbrowser.mjs`
- `tests/scripts/cloakBrowserRuntimePolicy.test.ts`

**Estimated scope:** Medium (5 files)

## Task 18: Validate Guarded Pruning Across Platforms

**Description:** Run the expanded runtime checks on every supported platform, enforce guarded size baselines in CI, and record actual artifact/startup results before declaring pruning shippable.

**Acceptance criteria:**

- [ ] Linux, Windows, macOS x64, and macOS arm64 pass headed/headless and packaged runtime smoke checks.
- [ ] Persistent profile, login, transcription, translation, GeoIP, HTTP/SOCKS proxy, retry, crash, shutdown, and complete app-exit checks are recorded.
- [ ] Every guarded baseline reflects actual artifacts, and no platform exceeds approved size/startup budgets.

**Verification:**

- [ ] Native CI quality, browser, package, installer, size, and startup jobs pass on every platform/architecture.
- [ ] Manual authenticated checks use test-safe accounts/profiles and record no secrets in artifacts or logs.
- [ ] Human approves guarded results before merge or release.

**Dependencies:** Task 17

**Files likely touched:**

- `.github/workflows/pr-checks.yml`
- `.github/workflows/release-builds.yml`
- `.github/workflows/macos-package-measurement.yml`
- `build/fedora-release/fedora-release-entrypoint.mjs`
- `docs/researches/optimization-build-07-11.26/main.md`

**Estimated scope:** Medium (5 files)

## Final Checkpoint

- [ ] Every applicable task and checkpoint is complete.
- [ ] The standing Definition of Done is satisfied.
- [ ] No generated installers, reports with machine paths, caches, profiles, or sensitive data are committed.
- [ ] Final measurements, exceptions, rollback path, and remaining architecture options are documented.
- [ ] Human approval is recorded before merge and release.
