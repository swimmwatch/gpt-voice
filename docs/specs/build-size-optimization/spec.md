# Spec: Build Size Optimization

Status: Approved for planning
Date: 2026-07-11
Scope owner: Build, packaging, renderer bundling, and release engineering
Research source: [`docs/researches/optimization-build-07-11.26/main.md`](../../researches/optimization-build-07-11.26/main.md)

## Assumptions For Review

1. This specification covers measured P0 and P1 optimizations from the research document.
2. On-demand CloakBrowser installation, separate Full/Light editions, replacing Electron, and using a system browser are separate future projects.
3. CloakBrowser `.pak.info` and `chromedriver` pruning is included only as a guarded final phase. It cannot ship without upstream confirmation and complete platform validation.
4. Linux, Windows, and macOS remain supported packaging targets even though the current release workflow publishes only Linux x64 and Windows x64.
5. Size improvements must preserve existing features, security boundaries, browser sessions, signing, installer behavior, and startup appearance.
6. The research measurements are the initial baseline. A new reproducible measurement may correct them only when the environment and reason for the difference are recorded.
7. By scope-owner direction on 2026-07-11, macOS x64 and arm64 measurement and baseline work are deferred. This does not remove macOS runtime or packaging support, and no macOS size claim may be made from this work.

## Objective

Reduce GPT-Voice installer, installed application, and initial renderer sizes through measured production build and packaging improvements without changing product behavior.

The primary users are people downloading and updating GPT-Voice on Linux, Windows, and macOS. Success means smaller, reproducible artifacts that retain the complete transcription, translation, browser automation, local Prettify, History, Settings, About, tray, notification, microphone, and clipboard experience.

The implementation must optimize in this order:

1. Establish reproducible size measurement and regression budgets.
2. Remove stale output, diagnostics, duplicated assets, and duplicated bundled dependency source.
3. Reduce Electron locale payload to the validated application locale set.
4. Improve renderer tree shaking by preserving ESM.
5. Load only the renderer code and production CSS required by each window.
6. Evaluate guarded CloakBrowser metadata pruning only after all safe changes are independently measured.

## Baseline

All values are measured or published as of 2026-07-11. Binary units use `1 MiB = 1,048,576 bytes`.

### Published Installers

| Artifact           |                                  Baseline |
| ------------------ | ----------------------------------------: |
| Linux AppImage x64 |                                323.95 MiB |
| Linux Debian x64   |                                256.18 MiB |
| Linux RPM x64      |                                221.75 MiB |
| Windows NSIS x64   |                                240.26 MiB |
| macOS DMG          | Not measured; no current release artifact |

### Packaged Components

| Component                  |                               Baseline |
| -------------------------- | -------------------------------------: |
| Linux unpacked application |                           1,060.66 MiB |
| Linux CloakBrowser runtime |                             695.55 MiB |
| `app.asar`                 |                              51.86 MiB |
| Electron locale packs      |                              45.88 MiB |
| Renderer JavaScript        | 664,025 bytes raw / 183,104 bytes gzip |

Known removable or duplicated content includes:

- A stale 5,086,875-byte development renderer source map.
- 448,069 bytes of unreferenced hashed renderer assets.
- 29.73 MiB of renderer-only dependency source copied into `app.asar` after bundling.
- 611,572 bytes of application assets copied into both ASAR and `extraResources`.
- 42.63 MiB of Electron locales outside the proposed supported set on Linux.

These values overlap in places and must not be summed without examining the packaged file graph.

## Scope

### Included

- Deterministic production output cleanup.
- Raw, gzip, Brotli, ASAR, runtime, unpacked, and installer size reporting.
- CI-visible size budgets and platform artifact reports.
- Production exclusion of source maps, stale assets, tests, declarations, and other diagnostics that are not runtime requirements.
- Runtime dependency classification so already-bundled renderer/main/preload libraries are not copied into ASAR.
- Full-lockfile security auditing for code bundled from development dependencies.
- Removal of duplicate runtime application assets and filtering of `extraResources` to files used at runtime.
- Electron locale filtering for English, Russian, and Ukrainian, with verified Belarusian fallback.
- A renderer-specific ESM TypeScript configuration while main and preload remain compatible with CommonJS.
- Per-window renderer entries and shared chunks for Main, App Settings, History, and About.
- Production CSS extraction and minification while retaining development style injection.
- Existing production HTML minification with exact per-window chunk injection.
- Cross-platform installer and packaged-runtime verification.
- Guarded CloakBrowser `.pak.info` and `chromedriver` pruning after all release gates are met.

### Excluded

- Downloading CloakBrowser on first use.
- Publishing separate Full and Lightweight product editions.
- Replacing Electron, Webpack, electron-builder, CloakBrowser, or the package manager.
- Reusing a system-installed browser.
- Removing CloakBrowser `locales/*.pak`, ICU data, graphics libraries, sandbox helpers, crashpad, or browser resources without an upstream-supported runtime manifest.
- Pruning Playwright recorder or trace-viewer files without a supported upstream packaging contract.
- Changing provider behavior, authentication, browser-profile locations, IPC contracts, UI functionality, or app data formats.
- Changing the application version or release notes.
- Emitting `.gz` or `.br` copies beside local runtime assets.

## Functional Requirements

### FR1: Reproducible Measurement

- Add a repository script that writes a deterministic JSON size report and a concise human-readable summary.
- Report raw, gzip, and Brotli sizes for emitted JavaScript, CSS, and HTML.
- Report `app.asar`, largest ASAR package groups, Electron locales, CloakBrowser runtime groups, unpacked application, and final installer sizes.
- Record platform, architecture, app version, commit, Node, Electron, electron-builder, Webpack, and CloakBrowser versions.
- Distinguish missing platform measurements from zero-sized artifacts.
- Never include file contents, user paths, browser profiles, sessions, cookies, tokens, prompts, transcripts, clipboard data, or credentials.
- Compare the current report with a committed or CI-provided baseline and identify regressions by metric.

### FR2: Deterministic Production Output

- Clean the shared `dist` directory exactly once before a production multi-compiler build.
- Do not let one Webpack compiler delete files emitted by another compiler.
- Keep development source maps available for local development.
- Do not package renderer or dependency source maps in public production artifacts.
- Fail packaged verification when stale hashed files, declarations, tests, fixtures, or unexpected source maps are present.
- Preserve dependency and installer license files.

### FR3: Runtime Dependency Packaging

- Package only dependencies resolved dynamically or externalized at runtime and their required transitive closure.
- Keep `cloakbrowser`, `playwright-core`, and verified CloakBrowser runtime dependencies available in packaged builds.
- Treat React, React DOM, Radix UI, Lucide, Tailwind Merge, Sonner, and other renderer-only bundled libraries as build inputs rather than copied runtime source.
- Treat pure JavaScript already bundled into `main.js` or `preload.js` the same way unless runtime resolution tests prove it must remain external.
- Add a packaged-module allowlist verification that fails on an unexpected top-level runtime package.
- Audit the complete lockfile because bundled application code may originate from `devDependencies`.

### FR4: Runtime Asset Ownership

- Keep source assets available to electron-builder for installer and operating-system icon generation.
- Resolve packaged runtime icons from `process.resourcesPath` as today.
- Do not copy the complete `assets` directory into both ASAR and `extraResources`.
- Package only the application icon, required Linux desktop icon sizes, required tray-state PNGs, and other files proven to be loaded at runtime.
- Exclude README screenshots and unused icon variants from application runtime resources.

### FR5: Electron Locale Filtering

- Configure electron-builder to retain `en-US`, `en-GB`, `ru`, and `uk` Electron locale packs.
- Verify English, Russian, Ukrainian, and Belarusian application locales on every supported operating system.
- Verify native dialogs, Chromium error surfaces, login windows, and fallback behavior.
- Do not apply the Electron locale allowlist to CloakBrowser locale packs.

### FR6: Renderer ESM and Tree Shaking

- Add a renderer-specific TypeScript configuration using `module: "ESNext"` or `"preserve"` with `moduleResolution: "bundler"`.
- Use an Electron-supported modern target, initially `ES2022` unless implementation benchmarking justifies another pinned target.
- Preserve strict type checking and existing aliases.
- Keep main and preload output compatible with the repository's CommonJS package/runtime model.
- Verify that unused Lucide icons and other unused ESM exports are removed from the production renderer graph.
- Do not declare the entire package side-effect-free until CSS imports and import-time initialization have been audited.

### FR7: Per-Window Renderer Loading

- Create explicit renderer bootstrap entries for Main, App Settings, History, and About.
- Inject only the matching entry and required shared chunks into each HTML file.
- Share React and genuinely common UI/runtime modules without creating a single vendor chunk that eagerly includes all Settings dependencies.
- Ensure the guarded `app://` protocol serves hashed JavaScript and CSS chunks with correct MIME types.
- Preserve each window's immediate loading shell, graphite background, progress cursor, and anti-flicker startup gate.
- Route/chunk loading errors must fail visibly and safely rather than leaving a blank window.

### FR8: Production CSS and HTML

- Use `style-loader` for development.
- Extract CSS into production assets with a maintained Webpack extraction plugin.
- Minify emitted production CSS with a maintained Webpack CSS minimizer.
- Keep enough inline HTML styling to prevent a white startup flash before external CSS loads.
- Scope Tailwind source detection to renderer source while preserving complete statically detectable class names.
- Continue production HTML minification.
- Do not add an HTML optimizer whose only benefit is a sub-kilobyte reduction.

### FR9: Size Regression Policy

- Emit warnings locally for size regressions.
- In CI, fail when the same metric grows by both more than 2% and more than 2 MiB without an approved baseline update.
- Baseline updates must include the reason, before/after measurements, affected platform, and reviewer approval.
- Do not hide a regression in one artifact behind a reduction in another artifact.
- Keep installer, installed runtime, ASAR, browser runtime, and renderer budgets separate.

### FR10: Guarded CloakBrowser Metadata Pruning

- This requirement remains disabled until CloakBrowser upstream confirms that `.pak.info` and `chromedriver` are unnecessary for the JavaScript Playwright distribution on supported platforms.
- Prune only during `prepare-cloakbrowser`, before packaging and signing.
- Maintain an expected upstream runtime manifest and fail closed when a new CloakBrowser version changes relevant files.
- Preserve all actual `locales/*.pak` files because proxy GeoIP may choose locales dynamically.
- Verify headed and headless launches, persistent profiles, ChatGPT login, Google Translate, GeoIP, HTTP/SOCKS proxy behavior, crash handling, shutdown, and application exit.
- Run the full verification matrix on Linux x64, Windows x64, and each supported macOS architecture.
- Do not infer final installer savings from raw-file savings; record actual artifacts.

## Tech Stack

- Node.js `>=24` and npm `>=11`.
- Electron 43 with sandboxed renderer/preload/main boundaries.
- TypeScript 6 in strict mode.
- Webpack 5 multi-compiler configuration.
- React 19 and Tailwind CSS 4.
- electron-builder 26 with ASAR, platform installers, security fuses, entitlements, and signing.
- CloakBrowser 0.4.10 with Playwright Core 1.61.1.
- Node's built-in test runner and `node:assert/strict`.

New dependencies are limited to compatible releases of `@electron/asar`, `mini-css-extract-plugin`, and `css-minimizer-webpack-plugin`. All three remain development dependencies. No runtime dependency may be added solely for measurement or formatting.

## Commands

### Development and Quality

```bash
npm ci
npm run dev
npm start
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

`npm run audit:all` must execute `npm audit --audit-level=high` against the complete lockfile, including bundled development dependencies.

### Browser Runtime

```bash
npm run prepare:cloakbrowser
npm run smoke:cloakbrowser
```

### Packaging and Verification

```bash
npm run pack
npm run dist:linux
npm run dist:win
npm run dist:mac
npm run verify:packaged
npm run verify:installers
```

Platform installers must be built and verified on their native supported CI operating systems. Cross-platform commands are not expected to succeed from one developer host.

### Size Measurement

```bash
npm run measure:size -- --platform=linux --arch=x64 --output=release-artifacts/size-linux-x64.json
npm run measure:size -- --platform=win32 --arch=x64 --output=release-artifacts/size-win32-x64.json
# Deferred from the current scope; retained for the future native macOS measurement task.
npm run measure:size -- --platform=darwin --arch=x64 --output=release-artifacts/size-darwin-x64.json
npm run measure:size -- --platform=darwin --arch=arm64 --output=release-artifacts/size-darwin-arm64.json
npm run verify:size -- --report=release-artifacts/size-linux-x64.json --baseline=build/size-baselines/v1.4.0-linux-x64.json
```

Each native CI job runs its matching measurement command after packaging. `verify:size` accepts any matching report/baseline pair and applies the shared regression policy.

## Project Structure

```text
webpack.config.js                         Webpack main, preload, renderer entries and optimization
tsconfig.json                             Shared/main/preload TypeScript contract
tsconfig.renderer.json                    Renderer ESM compiler contract to add
package.json                              Build scripts, dependency classes, electron-builder config
package-lock.json                         Complete dependency and audit source
build/size-baselines/                     Reviewed per-platform machine-readable baselines
scripts/                                  Build cleanup, size reporting, browser preparation, verification
src/renderer/                             Window bootstrap entries, React UI, CSS, and HTML shell
src/main/appProtocol.ts                   Local app protocol and chunk MIME handling
src/main/cloakbrowser.ts                  Packaged CloakBrowser runtime resolution
tests/scripts/                            Pure build/measurement/manifest tests when script tests are added
tests/main/                               Runtime and protocol regression tests
.github/workflows/                        Per-platform size and packaging verification
docs/researches/optimization-build-07-11.26/main.md
                                           Measurement evidence and alternatives
docs/specs/build-size-optimization/spec.md  Approved requirements and acceptance criteria
```

Planning must keep implementation tasks in `docs/specs/build-size-optimization/tasks/` after this specification is approved.

## Code Style

Use small typed measurement and policy functions, explicit byte values, and structured results. Keep filesystem and compression orchestration at the script boundary.

```ts
const MAX_SIZE_GROWTH_BYTES = 2 * 1024 * 1024;
const MAX_SIZE_GROWTH_RATIO = 0.02;

interface SizeMeasurement {
  bytes: number;
  metric: string;
  platform: NodeJS.Platform;
}

export function exceedsSizeBudget(current: SizeMeasurement, baseline: SizeMeasurement): boolean {
  if (baseline.bytes <= 0) {
    throw new RangeError('Baseline bytes must be positive');
  }

  const byteGrowth = current.bytes - baseline.bytes;
  const ratioGrowth = byteGrowth / baseline.bytes;

  return byteGrowth > MAX_SIZE_GROWTH_BYTES && ratioGrowth > MAX_SIZE_GROWTH_RATIO;
}
```

- Use English identifiers and documentation.
- Use explicit names such as `rendererEntryBytes`, `appAsarBytes`, and `cloakBrowserRuntimeBytes`.
- Keep byte values as integers; format units only at presentation boundaries.
- Use structured parsers and APIs rather than parsing human-formatted command output when a machine-readable source exists.
- Use asynchronous filesystem/process APIs in runtime code. Build scripts may use synchronous APIs only when they simplify a short, sequential CLI without affecting the Electron main process.
- Log paths relative to the project or artifact root. Never log user-data paths or private browser state.
- Use `apply_patch` for manual source edits and preserve the existing CommonJS package model.

## Testing Strategy

### Unit Tests

- Size delta and budget classification, including zero/missing baselines and threshold boundaries.
- Stable JSON report ordering and unit formatting.
- Production output allowlists and stale-file rejection.
- Runtime dependency allowlist classification.
- Runtime asset allowlist classification.
- CloakBrowser manifest comparison and fail-closed version changes.
- Platform/architecture metadata normalization.

Tests use `node:test`, `node:assert/strict`, temporary directories, synthetic fixtures, and no real credentials or personal application data.

### Build Integration Tests

- A development build may emit source maps; a clean production build must not package them.
- Repeated production builds from clean and previously-used workspaces produce the same file inventory.
- Every HTML page references only its expected entry/shared chunks.
- Extracted CSS loads through `app://` with `text/css` and no missing assets.
- Webpack stats prove unused icons and window-specific modules are excluded from unrelated entries.
- ASAR inspection proves only allowed runtime packages/assets remain.

### Packaged Runtime Tests

- Main, Settings, History, and About windows open without white flashes, blank states, missing styles, or chunk errors.
- Transcription through ChatGPT Web and OpenAI API remains functional.
- Google Translate and local Ollama/vLLM Prettify remain functional.
- Persistent ChatGPT authentication survives application restart.
- Tray icons, app icons, Linux desktop integration, notifications, microphone, clipboard, hotkeys, History, and GPU model controls work as before.
- Electron security fuses, sandboxing, context isolation, trusted IPC validation, entitlements, and signing remain unchanged.

### Performance and Size Verification

- Run at least ten cold starts per supported platform before and after renderer entry changes.
- Median time from process launch to the stable main window must not regress by more than 5%.
- Record raw/gzip/Brotli renderer assets, ASAR, runtime directories, unpacked app, and installers.
- Compare each platform and format independently.
- Preserve the raw JSON reports as CI artifacts; do not commit generated installers or report output that contains machine paths.

### CloakBrowser Guarded Tests

When FR10 is enabled, test headed and headless browser modes, persistent profiles, login, transcription, translation, GeoIP, HTTP/SOCKS proxies, retries, network loss, graceful shutdown, and complete app exit on every release platform. A Linux headless smoke alone is insufficient.

## Boundaries

### Always Do

- Measure before and after every optimization in isolation.
- Preserve security fuses, sandboxing, context isolation, trusted IPC, signing, and entitlements.
- Preserve all current user-visible behavior and supported locales.
- Keep source maps private and outside public installers.
- Verify ASAR and runtime contents from the packaged artifact, not only source configuration.
- Run full quality, browser, package, and installer gates appropriate to the affected platforms.
- Document measured results and limitations in the pull request.

### Ask First

- Enable CloakBrowser metadata pruning without written upstream confirmation.
- Change the supported platform or architecture matrix.
- Change installer formats, compression algorithms, signing, notarization, or update behavior.
- Add dependencies other than the approved CSS extraction/minification tooling.
- Change CI release topology beyond adding measurement and verification to existing platform jobs.
- Revise size/startup budgets or accept a platform-specific regression.
- Move on-demand browser installation or separate product editions into this scope.

### Never Do

- Remove browser runtime files based only on a successful Linux headless smoke.
- Remove CloakBrowser locale `.pak` files while GeoIP remains supported.
- Expose or log sessions, cookies, access tokens, API keys, prompts, transcripts, clipboard contents, browser profiles, or raw provider responses.
- Disable security controls, signing, notarization, tests, or installer verification to reduce size.
- Package source maps, generated installers, caches, private profiles, or release artifacts in the repository.
- Replace Electron, CloakBrowser, Webpack, npm, or the module model as an incidental optimization.
- Count overlapping byte reductions twice or present estimated compression savings as measured installer results.

## Success Criteria

1. A deterministic size report covers emitted assets, ASAR, Electron locales, CloakBrowser, unpacked app, and final installers for every built platform.
2. CI rejects unexplained growth that exceeds both 2% and 2 MiB for the same metric.
3. Clean and reused workspaces produce a production package without stale renderer assets or packaged source maps.
4. `app.asar` is at or below 25 MiB after duplicate dependency and asset removal.
5. Linux Electron locale packs are at or below 4 MiB while English, Russian, Ukrainian, and Belarusian behavior passes on all supported systems.
6. Main-window initial renderer JavaScript, including its entry and required initial shared chunks, is at or below 564,421 raw bytes, a minimum 15% reduction from the measured baseline.
7. Every window loads only its entry and required shared chunks, and production CSS is emitted separately and minified.
8. Median cold startup does not regress by more than 5% on any supported platform.
9. Every produced installer is smaller than its recorded same-platform baseline or has an explicitly approved documented exception.
10. All current product workflows, authentication persistence, privacy guarantees, and Electron security controls remain intact.
11. macOS size claims remain deferred until separate native x64 and arm64 measurements are completed; this work makes no such claim.
12. CloakBrowser runtime size does not grow. If guarded pruning is approved, the Linux target is approximately 567 MiB and actual installer savings are recorded separately.
13. All commands in the quality, browser-runtime, packaging, and verification sections pass on their applicable platform jobs.

## Resolved Planning Decisions

1. Keep the `app.asar <= 25 MiB`, renderer `>= 15%` reduction, and startup `<= 5%` regression budgets.
2. Keep guarded CloakBrowser metadata pruning in this specification as a final gated phase after written upstream confirmation.
3. Defer macOS x64 and arm64 measurement/baseline work by scope-owner direction on 2026-07-11; retain the future separate-artifact approach rather than a universal DMG.
4. Complete and measure all safe P0/P1 work before evaluating an on-demand CloakBrowser runtime in a separate specification.
