# Build Size Optimization Research

| Field             | Value                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Date              | 2026-07-11                                                                                                  |
| Repository commit | `acfa76b`                                                                                                   |
| Status            | Research complete; implementation not started                                                               |
| Scope             | JavaScript, CSS, HTML, Electron packaging, and installers for Linux, Windows, and macOS                     |
| Stack reviewed    | Electron 43, electron-builder 26.15.3, Webpack 5.108.3, TypeScript 6.0.3, React 19.2.7, CloakBrowser 0.4.10 |

## Executive Summary

GPT-Voice is large primarily because it ships two browser runtimes: Electron embeds Chromium, and ChatGPT Web/Google Translate automation requires a separate CloakBrowser Chromium. The current unpacked Linux application is 1,060.66 MiB, of which the bundled CloakBrowser runtime is 695.55 MiB, or about 65.6%. Optimizing HTML or a few application modules cannot offset that architecture.

There are still meaningful, production-ready improvements:

1. Make production output deterministic and exclude source maps. The current local package contains a stale 4.85 MiB renderer source map and stale hashed assets because `dist` is not cleaned before production builds.
2. Stop packaging renderer-only dependency source after it has already been bundled. React, Radix, Lucide, and related packages occupy 29.73 MiB in `app.asar` while the renderer already contains their compiled code.
3. Keep only Electron locale packs used by the application. On Linux, retaining `en-US`, `en-GB`, `ru`, and `uk` removes 42.63 MiB installed and about 10.99 MiB under gzip-like compression. Belarusian app translations are application data; Electron does not ship a `be.pak`, so its fallback must be verified.
4. Compile renderer TypeScript as ESM. The shared CommonJS TypeScript configuration prevents effective Webpack tree shaking. The production profile includes 1.53 MiB of Lucide source modules even though the application uses only 42 icon exports.
5. Split renderer entry points by window and extract/minify production CSS. This primarily reduces parsing and startup work; it should not be presented as a large installer-size reduction because all window chunks remain packaged.
6. Investigate pruning CloakBrowser packaging metadata. On an isolated Linux copy, deleting all `.pak.info` files and the unused `chromedriver` removed 128.25 MiB installed and about 21.95 MiB under gzip-like compression. Headless smoke launches passed, but this is not ready to ship until headed, persistent-session, GeoIP, proxy, Windows, and macOS tests pass and upstream confirms those files are unnecessary.

The only option likely to reduce the initial download by more than 100 MiB is architectural: download a pinned and verified CloakBrowser runtime on first use, or publish a lightweight OpenAI API-only edition. Both choices add operational, offline, security, licensing, and user-experience costs and require a separate specification.

## Evidence Definitions

- **Measured**: produced from this repository or its published release artifacts on 2026-07-11.
- **Derived**: arithmetic based on measured values.
- **Estimated**: expected direction or range that still requires a build benchmark.
- **External**: a claim from linked official documentation or an upstream project.

All sizes use binary units (`1 MiB = 1,048,576 bytes`) unless exact bytes are shown.

## Current Architecture

- Webpack emits three runtime bundles: `main.js`, `preload.js`, and one shared `renderer.js`.
- The same renderer entry statically imports the main, Settings, History, and About windows. All four HTML pages inject the same renderer bundle.
- CSS and SCSS use `style-loader`, so production CSS and the style injection runtime are embedded in JavaScript.
- `tsconfig.json` compiles every target to CommonJS, including the browser renderer.
- electron-builder packages `dist`, application assets, production dependencies, and the complete `.cache/cloakbrowser` directory.
- Release CI currently publishes Linux x64 and Windows x64. A macOS DMG is configured in `package.json`, but the release workflow has no macOS build job and v1.4.0 has no macOS artifact.

Electron intentionally bundles Chromium and Node.js so applications control runtime security and compatibility across operating systems. Replacing Electron with a system webview would change that guarantee and still would not remove the separate browser needed for CloakBrowser automation. See [Electron's explanation of its bundled runtime](https://www.electronjs.org/docs/latest/why-electron).

Existing practices to retain:

- Webpack production mode already enables JavaScript minification and renderer production source maps are disabled with `devtool: false`.
- ASAR packaging is enabled and Electron security fuses remain enforced.
- Windows PDB inclusion is disabled by default.
- Tailwind 4 generates utilities from detected source usage rather than shipping its complete utility catalog.
- Browser binaries are prepared per target platform rather than copying one platform's executable into every package.

## Measurement Method

The baseline was gathered with:

```bash
npm run build:prod
npm run pack
npx electron-builder --linux AppImage deb rpm --publish never
NODE_ENV=production npx webpack --config webpack.config.js --profile --json > /tmp/gpt-voice-webpack-stats.json
du -sb release/linux-unpacked .cache/cloakbrowser
stat -c '%s %n' <measured-files>
gzip -c <bundle>
brotli -c <bundle>
npx asar extract release/linux-unpacked/resources/app.asar <temporary-directory>
gh release view v1.4.0 --json assets
```

`npm run pack`, AppImage creation, and Debian package creation succeeded. A local current RPM rebuild could not run because `rpmbuild` is not installed; the RPM figure below comes from the published v1.4.0 release. Windows and macOS runtime trees were not available locally. No authenticated browser profile or user data was used in the CloakBrowser pruning smoke test; it loaded only a `data:` URL.

## Published Installer Baseline

These are exact artifact sizes from the [GPT-Voice v1.4.0 release](https://github.com/swimmwatch/gpt-voice/releases/tag/v1.4.0):

| Platform and format |         Bytes |          MiB | Evidence   |
| ------------------- | ------------: | -----------: | ---------- |
| Linux AppImage x64  |   339,688,623 |       323.95 | Published  |
| Linux Debian x64    |   268,626,820 |       256.18 | Published  |
| Linux RPM x64       |   232,519,653 |       221.75 | Published  |
| Windows NSIS x64    |   251,932,013 |       240.26 | Published  |
| macOS DMG           | Not published | Not measured | Limitation |

The AppImage is 102.20 MiB larger than the RPM. This is consistent with AppImage being a self-contained portable format, while native packages can rely more on system package dependencies. electron-builder documents AppImage as a self-contained format in its [configuration reference](https://www.electron.build/docs/configuration/).

The current working tree produced a 328.46 MiB AppImage and a 256.95 MiB Debian package. Published release sizes remain the stable comparison point because the branch contains post-release changes.

## Linux Unpacked Baseline

| Component                      |         Bytes |      MiB | Share of unpacked app |
| ------------------------------ | ------------: | -------: | --------------------: |
| Entire unpacked application    | 1,112,180,332 | 1,060.66 |                  100% |
| Bundled CloakBrowser directory |   729,336,146 |   695.55 |                 65.6% |
| Electron executable            |   221,687,032 |   211.42 |                 19.9% |
| `app.asar`                     |    54,377,920 |    51.86 |                  4.9% |
| Electron locale packs          |    48,106,060 |    45.88 |                  4.3% |

The remaining space consists of Electron libraries/resources, application resources outside ASAR, and packaging support files. Values overlap only where explicitly described; for example, `app.asar` is already part of the entire unpacked application.

### CloakBrowser Breakdown

| Component            |       Bytes |    MiB | Notes                                         |
| -------------------- | ----------: | -----: | --------------------------------------------- |
| `chrome` executable  | 465,371,408 | 443.81 | Required browser binary                       |
| `locales/*.pak`      |  78,227,437 |  74.60 | Runtime locale data                           |
| `locales/*.pak.info` | 105,352,698 | 100.47 | CSV metadata; runtime need is not documented  |
| `chromedriver`       |  29,125,448 |  27.78 | Not referenced by GPT-Voice's Playwright path |

Actual `.pak` locale files must not be broadly pruned today. Browser Settings supports 16 explicit locales, and proxy GeoIP can derive a locale outside that list. Missing locale resources could create a mismatch between browser fingerprint data and rendered Chromium UI.

Playwright states that its version expects specific browser binaries and that browser installations consume hundreds of megabytes. It also supports downloading browser binaries to managed cache locations, which establishes a viable pattern for an optional runtime, but GPT-Voice uses CloakBrowser's patched Chromium rather than stock Playwright Chromium. See [Playwright browser management](https://playwright.dev/docs/browsers).

## Application Bundle Baseline

| Asset                    |   Raw bytes | Gzip bytes | Brotli bytes |
| ------------------------ | ----------: | ---------: | -----------: |
| `renderer.js`            |     664,025 |    183,104 |      153,619 |
| `main.js`                |     189,433 |     47,683 |       38,668 |
| `preload.js`             |       4,132 |      1,120 |        1,020 |
| Each generated HTML page | About 1,880 |  About 780 |    About 570 |

All four generated HTML files total only about 7.34 KiB raw. HTML minification can save at most a few KiB here and is not a meaningful installer optimization.

The Webpack profile reports these pre-minification renderer module totals:

| Module group                | Profiled source bytes | Finding                                                                        |
| --------------------------- | --------------------: | ------------------------------------------------------------------------------ |
| `lucide-react`              |             1,606,792 | 42 icon exports are used, but CommonJS compilation retains a much larger graph |
| `react-dom`                 |               545,403 | Core renderer runtime                                                          |
| Application renderer source |               297,771 | All four windows are eagerly included                                          |
| `tailwind-merge`            |               105,871 | CommonJS module causes an optimization bailout                                 |
| Floating UI packages        |     More than 149,000 | Primarily Settings/select/menu behavior                                        |
| Processed global CSS module |                42,365 | Embedded into JavaScript through `style-loader`                                |

Webpack's TypeScript guide explicitly warns that `module: "CommonJS"` prevents tree shaking and recommends preserving ESM for Webpack. Its tree-shaking guide also requires ES module syntax to survive compilation. See [Webpack TypeScript guidance](https://webpack.js.org/guides/typescript/) and [Webpack tree shaking](https://webpack.js.org/guides/tree-shaking/).

### Duplicate Packaged Dependency Source

The extracted `app.asar` contains renderer packages after their code has already been compiled into `renderer.js`:

| Packaged source                                     |              Logical bytes |
| --------------------------------------------------- | -------------------------: |
| Lucide React                                        |                 19,541,095 |
| React DOM                                           |                  7,318,213 |
| Radix UI packages                                   |                  2,254,450 |
| Tailwind Merge                                      |                    876,408 |
| React                                               |                    170,359 |
| Sonner                                              |                    158,841 |
| Other renderer-only helpers and transitive packages |              About 856,000 |
| **Measured renderer-only candidate total**          | **31,175,501 (29.73 MiB)** |

electron-builder always includes production dependencies and offers either a two-package structure or an `onNodeModuleFile` hook to control packaged runtime files. See [application content rules](https://www.electron.build/docs/contents/), [two-package structure](https://www.electron.build/docs/tutorials/two-package-structure/), and the [build hook reference](https://www.electron.build/docs/configuration/).

### Stale and Diagnostic Files

- `dist/renderer.js.map`: 5,086,875 bytes. It was generated by a development build and survived a later production build.
- Unreferenced stale hashed assets: 448,069 bytes combined, including two PNGs and earlier icon/flag SVGs.
- Source maps under packaged `node_modules`: 16,252,453 bytes, including renderer dependencies. This overlaps with the renderer-only dependency total and must not be added to it when estimating savings.
- Type declaration variants not covered by electron-builder's default `*.d.ts` exclusion also remain in some packages.

Webpack recommends cleaning the output directory before each build. Because this repository has three compiler configurations writing to the same `dist` directory, a single explicit pre-build clean is safer than enabling independent `output.clean` operations that could remove sibling compiler output. See [Webpack output management](https://webpack.js.org/guides/output-management/).

## Prioritized Recommendations

### P0: Add Reproducible Size Measurement

Create a build-size script that emits machine-readable JSON and a concise table for:

- Raw, gzip, and Brotli JS/CSS/HTML assets.
- `app.asar` and its largest package/file groups.
- Electron locale directory.
- CloakBrowser runtime and its largest file groups.
- Unpacked application size.
- Final installer size for every built platform and format.

Run it in release CI and retain the JSON with build artifacts. Fail only on meaningful regressions, initially when an artifact grows by both more than 2% and more than 2 MiB. Webpack supports asset and entry-point performance budgets; see [Webpack performance configuration](https://docs.webpack.js.org/configuration/performance).

This measurement must land before optimizations so every later change has before/after evidence.

### P0: Clean Production Output and Exclude Diagnostics

1. Add one explicit clean step before the multi-compiler production build.
2. Keep development source maps, but exclude `dist/**/*.map` and packaged dependency source maps from production contents.
3. Assert in `verify:packaged` that production ASAR contains no renderer source map, stale hashed asset, test fixture, or declaration-only bundle.
4. Do not remove license files required by dependencies or installers.

Expected effect:

- Deterministic packages on developer workstations and CI runners.
- Up to 4.85 MiB installed from the observed stale renderer map, plus stale assets.
- Additional source-map savings in `node_modules`; this overlaps with dependency pruning.
- No runtime behavior change when verified correctly.

Keep private source maps as CI debugging artifacts if they are needed, but never place them in public installers. Do not emit precompressed `.gz` or `.br` copies beside application assets: Electron loads the normal local files and the installer/container already compresses its payload, so those copies would increase package size.

### P0: Deduplicate Runtime Assets

`assets/**/*` is currently included inside `app.asar` and the full `assets` directory is copied again through `extraResources`. Packaged code resolves icons through `process.resourcesPath`, so the ASAR copy is a measured duplicate of 611,572 bytes.

Remove the ASAR `assets/**/*` entry after packaged path tests, and filter `extraResources` to runtime files only:

- `icon.png`
- Linux desktop icon PNG sizes
- Tray state PNGs

The README screenshot and unused SVG variants should remain repository/build inputs but do not need to be runtime resources. Keep source icons available to electron-builder while installers are generated. This is a small saving, but it also makes resource ownership explicit and prevents future screenshots from silently entering every installer.

### P0: Package Only External Runtime Dependencies

Keep in the packaged dependency graph only modules resolved dynamically or externalized at runtime, currently centered on:

- `cloakbrowser`
- `playwright-core`
- CloakBrowser's required runtime dependencies such as `tar`, `mmdb-lib`, and proxy support

Renderer libraries and pure JavaScript already bundled into `main.js`, `preload.js`, or renderer assets should be build-time dependencies rather than copied runtime source. Two viable implementations are:

1. Move bundled-only packages to `devDependencies` while keeping the external runtime closure in `dependencies`.
2. Use a generated, reviewed `onNodeModuleFile` allowlist if dependency classification cannot be changed safely.

The first option is simpler for this repository. If bundled libraries move to `devDependencies`, add a full-lockfile audit in addition to `npm audit --omit=dev`; shipped bundled code still needs vulnerability coverage even though electron-builder no longer copies its source directory.

Acceptance checks:

- `app.asar` target at or below 25 MiB after cleanup and dependency pruning.
- `import('cloakbrowser')` and Playwright resolve in the packaged application.
- ChatGPT login, persistent session reuse, transcription, translation, Ollama/vLLM prettify, History, Settings, and About smoke tests pass.
- `verify:packaged` checks a positive runtime allowlist and rejects unexpected top-level package directories.

Measured installed opportunity: 29.73 MiB before source-map overlap. Installer savings will be smaller and must be measured.

### P0: Limit Electron Locale Packs

Set electron-builder `electronLanguages` to the supported Electron locale set after testing:

```json
["en-US", "en-GB", "ru", "uk"]
```

electron-builder documents that all Electron locales are retained by default and `electronLanguages` controls which ones remain. See [electron-builder configuration](https://www.electron.build/docs/configuration/).

Measured Linux effect:

- Current: 48,106,060 bytes.
- Proposed retained set: 3,407,603 bytes.
- Installed saving: 44,698,457 bytes (42.63 MiB).
- Tar+gzip comparison saving: 11,519,847 bytes (10.99 MiB).

Validate English, Russian, Ukrainian, and Belarusian application locales, native dialogs, crash/error pages, login windows, and fallback behavior on all operating systems. Do not apply the same list to CloakBrowser locale packs.

### P1: Preserve ESM in the Renderer

Create a renderer-specific TypeScript configuration with:

- `module: "ESNext"` or `"preserve"`
- `moduleResolution: "bundler"`
- A modern target supported by the pinned Electron Chromium, initially `ES2022`
- Existing strict type checking and path aliases

Keep main and preload compilation compatible with the repository's CommonJS runtime. TypeScript recommends `preserve` or `esnext` for code consumed by a bundler. See [TypeScript module configuration](https://www.typescriptlang.org/tsconfig/module.html).

Then:

1. Re-run the Webpack profile and confirm CommonJS/module-concatenation bailouts decrease.
2. Verify that unused Lucide icon modules are removed.
3. Resolve `tailwind-merge` through its ESM export when available.
4. Avoid declaring the whole application `sideEffects: false` until CSS imports and import-time registration are audited. Webpack warns that incorrect side-effect declarations can remove required CSS or initialization.

Success criterion: at least a 15% reduction from the 664,025-byte renderer baseline without increasing startup time or breaking any window.

### P1: Split Renderer Work by Window

Use four explicit renderer entries or four small bootstrap modules:

- Main window
- App Settings
- History
- About

Configure each `HtmlWebpackPlugin` instance with only its entry chunk, then use `SplitChunksPlugin` for genuinely shared React/UI code. Webpack documents entry-point splitting, shared chunks, and dynamic imports in its [code-splitting guide](https://webpack.js.org/guides/code-splitting/). React also supports deferred components through [`lazy`](https://react.dev/reference/react/lazy), but explicit entries fit separate Electron windows more directly.

Important constraints:

- Confirm the guarded `app://` protocol serves hashed JS and CSS chunks with correct MIME types.
- Keep each window's immediate loading shell so recent anti-flicker behavior does not regress.
- Do not create one giant vendor chunk containing every settings dependency; Webpack warns that broad vendor groups can enlarge initial bundles.
- Measure both per-window entry size and aggregate packaged assets. Splitting can improve startup while leaving aggregate disk size unchanged or slightly larger.

### P1: Extract and Minify Production CSS

Use `style-loader` for development and `MiniCssExtractPlugin` for production. Add `CssMinimizerWebpackPlugin` or an equivalent maintained Webpack minimizer for emitted CSS. Webpack's official [Mini CSS Extract Plugin](https://webpack.js.org/plugins/mini-css-extract-plugin/) and [CSS minimizer](https://webpack.js.org/plugins/css-minimizer-webpack-plugin/) document this production pattern.

Keep a minimal background/color style in `index.html` so BrowserWindows never flash white while external CSS loads. Extraction should be justified by lower renderer JavaScript parsing and independently measurable CSS, not by a claim that moving bytes from JS to CSS inherently shrinks the installer.

Tailwind 4 already emits utilities found in source files. Scope detection explicitly to `src/renderer` and preserve complete class names rather than dynamically constructed fragments. See [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).

### P1: Keep HTML Optimization Proportional

Continue using production HtmlWebpackPlugin minification and ensure each page injects only its matching chunks. Do not add an HTML optimizer dependency solely for these files: all four pages together are about 7.34 KiB raw. Preserve the inline initial background and startup gate because avoiding window flicker is more valuable than a sub-kilobyte reduction.

### P1 Guarded: Prune CloakBrowser Metadata, Not Runtime Locales

The current preparation script recursively copies the entire upstream cache directory. An isolated Linux experiment removed:

- 328 `*.pak.info` CSV files: 105,352,698 bytes raw, 12,532,718 bytes as tar+gzip.
- `chromedriver`: 29,125,448 bytes raw, 10,480,361 bytes with gzip.

Combined measured reduction:

- 134,478,146 bytes installed (128.25 MiB).
- About 21.95 MiB under gzip-like compression.
- Temporary runtime reduced from 695.55 MiB to 567.30 MiB.

The pruned Linux copy passed headless CloakBrowser launches for `en-US`, `ru`, `uk`, and `be`, loaded a local page, and preserved `navigator.webdriver === false`. A headed smoke was not run because `xvfb-run` is unavailable. This proves only that the tested files are unnecessary for those narrow Linux launches.

Before production use:

1. Obtain upstream confirmation that `.pak.info` and `chromedriver` are not required by the JavaScript Playwright distribution.
2. Implement pruning in `prepare-cloakbrowser.mjs` before packaging, not as a post-sign mutation.
3. Add a checked runtime manifest and fail when an upstream release changes expected files.
4. Run headed and headless launch, persistent profile, ChatGPT login, translation, GeoIP, HTTP/SOCKS proxy, crash handling, and shutdown tests.
5. Run the complete matrix on Linux x64, Windows x64, and both intended macOS architectures.
6. Compare final installer size and launch time; do not infer installer savings from raw bytes.

Do not remove `locales/*.pak` while GeoIP may choose locales dynamically. Do not remove `resources.pak`, ICU data, graphics libraries, sandbox helpers, or crashpad files without upstream support.

### P2: Audit Optional Playwright Tooling

Packaged `playwright-core` is 10.38 MiB and includes about 3.7 MiB under `lib/vite` for recorder, dashboard, and trace-viewer interfaces. GPT-Voice does not intentionally expose those tools. Excluding them may be possible, but Playwright does not document a supported minimal file allowlist. Treat this as a low-priority experiment after larger changes, with runtime import tracing and complete browser smoke tests.

### Keep Current General Compression

Keep electron-builder's root `compression: "normal"`. Its official configuration says `maximum` does not produce a noticeable size difference and increases build time. See [electron-builder compression guidance](https://www.electron.build/docs/configuration/).

For AppImage, retain the current static-runtime default unless benchmarks prove otherwise. electron-builder documents zstd as the static runtime default with fast decompression; `xz` maps back to zstd for that runtime. See [AppImage compression](https://www.electron.build/appimage/).

For macOS, default `UDZO` is the best compatibility/size balance. `UDBZ` can be smaller but mounts more slowly and should be selected only after signed DMG benchmarks. See [electron-builder DMG formats](https://www.electron.build/docs/dmg/).

## Platform-Specific Strategy

### Linux

- Keep RPM and Debian packages as the preferred downloads where users have compatible distributions; retain AppImage as the portable fallback.
- Apply deterministic output cleanup, dependency pruning, Electron locale filtering, and any approved CloakBrowser manifest consistently to all three formats.
- Keep AppImage zstd unless launch and size benchmarks justify a change.
- Install `rpmbuild` in the local/CI benchmark environment so all current formats are compared from the same commit.
- Test desktop integration, microphone access, notifications, tray behavior, browser sandboxing, and packaged CloakBrowser after every resource change.

### Windows

- The current x64 NSIS installer is 240.26 MiB. Keep it architecture-specific.
- If Windows arm64 is added, publish separate installers or evaluate `nsis-web`; do not combine large x64 and arm64 payloads into one offline installer without measuring. electron-builder identifies its web installer as an option for unusually large applications. See [NSIS targets](https://www.electron.build/nsis/).
- Keep PDB inclusion disabled, which is already electron-builder's default.
- Perform pruning before executable/installer signing and repeat Defender/SmartScreen, install, repair, uninstall, update, and first-run browser tests.
- Measure the Windows CloakBrowser tree independently; Linux file names and safe-removal results cannot be assumed to match.

### macOS

- Add a macOS release/measurement job before claiming package-size results. The current workflow does not produce the configured DMG.
- Prefer separate x64 and arm64 artifacts when download size matters. electron-builder documents universal macOS binaries as approximately twice the size of separate architecture builds. See [architecture and multi-arch builds](https://www.electron.build/docs/architecture/).
- Preserve hardened runtime, entitlements, code signing, and notarization. Prune browser resources before signing the `.app` bundle.
- Measure both DMG and the installed `.app`; DMG compression can hide a large installed footprint.
- Verify the separately bundled CloakBrowser executable is correctly signed and accepted by Gatekeeper on a clean machine.

## Architectural Options

### Option A: On-Demand CloakBrowser Runtime

Ship the Electron application without CloakBrowser and download a pinned platform/architecture runtime when ChatGPT Web or Google Translate is first used.

Potential benefit:

- Removes up to the current 695.55 MiB installed browser payload from the initial package before compression.
- Keeps OpenAI API transcription and local Ollama/vLLM prettify available while the browser runtime is absent.

Production requirements:

- Pin the browser version to the app release; do not silently follow latest.
- Verify the upstream signed checksum/signature before extraction. CloakBrowser states that its wrapper verifies binary downloads with pinned Ed25519 signatures; see the [upstream CloakBrowser repository](https://github.com/CloakHQ/cloakbrowser).
- Download to a temporary path, support resume/cancel, verify available disk space, and atomically promote only a complete runtime.
- Keep the last known-good runtime for rollback and clean obsolete versions after successful launch.
- Handle proxies, firewalls, offline mode, limited connections, and retries with human-readable errors.
- Keep browser profiles/sessions separate from executable versions and never log session paths, cookies, or tokens.
- Provide progress and an explicit first-use size disclosure.
- Verify binary redistribution/download terms before implementation. The upstream repository currently distinguishes wrapper and binary licensing and states restrictions for v146 binary redistribution; this is a release gate, not a size-only decision.

Tradeoff: the installer becomes substantially smaller, but first ChatGPT Web use becomes slower and network-dependent. This requires a dedicated security and update specification.

### Option B: Full and Lightweight Editions

Publish:

- Full: ChatGPT Web, Google Translate, OpenAI API, and local prettify providers.
- Lightweight: OpenAI API transcription and local prettify providers, with browser-backed features disabled.

This avoids a first-run download for Full users and creates the smallest possible package for API-only users. Costs include duplicate release artifacts, support complexity, feature gating, documentation burden, and user confusion. Prefer on-demand components unless analytics or user feedback shows a stable API-only audience.

### Option C: Replace Electron or Use System Chrome

Not recommended for this optimization cycle:

- A system webview framework may reduce the Electron base but does not remove CloakBrowser and requires a major IPC, security, packaging, and UI rewrite.
- Reusing system Chrome reduces package size but loses the pinned patched browser, consistent fingerprint behavior, isolated session lifecycle, and deterministic cross-platform support.
- Maintaining a custom Electron build to remove Chromium components creates a recurring security/update burden disproportionate to the application bundle size.

## Recommended Delivery Sequence

1. **Measurement PR**: reproducible size report, Webpack stats, installer metrics, and regression budgets.
2. **Deterministic packaging PR**: clean `dist`, exclude maps/diagnostics, and strengthen packaged-runtime verification.
3. **Dependency packaging PR**: remove renderer-only source from ASAR and audit the complete lockfile.
4. **Electron locale PR**: retain only validated app locales on every platform.
5. **Renderer ESM PR**: preserve ESM, profile tree shaking, and reduce Lucide/tailwind-merge bailouts.
6. **Window/CSS PR**: per-window entries, shared chunks, extracted/minified CSS, and anti-flicker regression tests.
7. **CloakBrowser pruning PR**: only after upstream confirmation and a complete cross-platform browser matrix.
8. **Architecture decision**: separately specify on-demand browser installation or product editions if further large reductions are required.

Do not combine these into one change. Separate measurements make regressions attributable and allow rollback without reverting unrelated improvements.

## Initial Budgets and Acceptance Criteria

Budgets should first prevent regression, then tighten after each accepted optimization:

| Metric                     |   Current baseline |                                                    First target |
| -------------------------- | -----------------: | --------------------------------------------------------------: |
| Renderer JS raw            |      664,025 bytes |                               At least 15% lower after ESM work |
| `app.asar`                 |          51.86 MiB |             At or below 25 MiB after cleanup/dependency pruning |
| Electron locales           |          45.88 MiB |                       At or below 4 MiB after locale validation |
| CloakBrowser Linux runtime |         695.55 MiB | No growth; about 567 MiB only after guarded pruning is approved |
| Published installers       | See baseline table |                No unexplained regression over both 2% and 2 MiB |

Every optimization must also satisfy:

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:types`
- `npm test`
- `npm run validate:dependabot`
- Full lockfile and production dependency audits
- `npm run build:prod`
- CloakBrowser smoke tests for the affected platform
- Packaged runtime and installer verification
- Manual startup, login, transcription, translation, History, Settings, About, tray, notification, microphone, clipboard, and shutdown checks
- Signed clean-machine checks for Windows and macOS release artifacts

Bundle splitting and CSS extraction also require startup timing and visual checks at minimum window sizes. A smaller bundle is not acceptable if it restores white flashes, layout shifting, delayed controls, or missing styles.

## Decisions

- Prioritize browser/runtime packaging and duplicate dependency source over HTML micro-optimization.
- Keep Electron, Webpack, electron-builder, and the current module system for main/preload.
- Preserve ESM only in the renderer build first.
- Keep general electron-builder compression at `normal`.
- Keep AppImage as a portability option, not the smallest Linux download.
- Do not prune CloakBrowser runtime locale `.pak` files while GeoIP can select arbitrary locales.
- Do not ship `.pak.info`/`chromedriver` pruning until upstream and cross-platform validation gates pass.
- Treat on-demand browser installation as a separate product/security project.

## Open Questions

1. Does CloakBrowser upstream formally guarantee that `.pak.info` and `chromedriver` can be omitted from redistributed JavaScript/Playwright runtimes on every platform?
2. What CloakBrowser binary distribution permission applies to GPT-Voice release artifacts and to an on-demand downloader?
3. Which macOS architectures are intended for release, and should users receive separate DMGs or one universal DMG?
4. Is offline ChatGPT Web availability a hard requirement, or is a first-use runtime download acceptable?
5. Should installer size, installed disk size, startup time, or update bandwidth be the primary optimization metric when tradeoffs conflict?
6. Can Playwright recorder/trace-viewer assets be excluded through a supported upstream packaging contract?

## Primary Sources

- [Electron performance recommendations](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Why Electron bundles Chromium and Node.js](https://www.electronjs.org/docs/latest/why-electron)
- [electron-builder application contents](https://www.electron.build/docs/contents/)
- [electron-builder configuration, locales, compression, and hooks](https://www.electron.build/docs/configuration/)
- [electron-builder architecture builds](https://www.electron.build/docs/architecture/)
- [electron-builder NSIS](https://www.electron.build/nsis/)
- [electron-builder AppImage](https://www.electron.build/appimage/)
- [electron-builder DMG](https://www.electron.build/docs/dmg/)
- [Webpack output management](https://webpack.js.org/guides/output-management/)
- [Webpack TypeScript integration](https://webpack.js.org/guides/typescript/)
- [Webpack tree shaking](https://webpack.js.org/guides/tree-shaking/)
- [Webpack code splitting](https://webpack.js.org/guides/code-splitting/)
- [Webpack performance budgets](https://docs.webpack.js.org/configuration/performance)
- [Webpack Mini CSS Extract Plugin](https://webpack.js.org/plugins/mini-css-extract-plugin/)
- [Webpack CSS Minimizer Plugin](https://webpack.js.org/plugins/css-minimizer-webpack-plugin/)
- [TypeScript module configuration](https://www.typescriptlang.org/tsconfig/module.html)
- [React lazy loading](https://react.dev/reference/react/lazy)
- [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Playwright browser management](https://playwright.dev/docs/browsers)
- [CloakBrowser upstream repository](https://github.com/CloakHQ/cloakbrowser)
