# Landing Page Handoff

## Completed

- Temporary demo placeholder: replaced the unavailable media player with an accessible, responsive 16:9 placeholder. It states that the 60-fps product demo is in production and uses a static voice waveform with decorative transcription, translation, and Prettify symbols. It makes no media, caption, or transcript request and does not satisfy the final-video acceptance criteria.
- Hero asset availability: `landing:sync-shell-assets` now hash-validates the approved fresh `app-main.png` capture and generates PNG, WebP, and AVIF derivatives before landing development or build. The full `landing:sync-media` command remains blocked by, and strict about, the deferred video package.
- Hero layout: the semantic prompt-first hero now has the specified mobile-first copy, CTA, shortcut, and approved screenshot order, then changes to a two-column desktop composition. The screenshot is a non-interactive modern source set with an explicit PNG fallback.
- Provider signal map: the transcription section now has a static microphone and waveform input, one clear vertical mobile arrow / full 48-pixel desktop arrow to the provider list, solid current-route treatment, a separate dashed future horizon, compact fact chips, and the qualified ChatGPT Web claim. It deliberately uses no provider-brand icons and does not animate or expose cards as controls.
- Interaction continuity: locale destinations retain the active fragment after hydration, while a native `details` navigation fallback keeps mobile section links usable without JavaScript. The fallback is removed only after the Radix sheet hydrates.
- Responsive accessibility baseline: the optional Retry status label now wraps within its mobile grid column rather than creating a 320-pixel horizontal overflow. Current English deep links clear the sticky header, and reduced-motion output remains immediately visible.
- TXT/LLM output foundation: `landing:generate-txt` can produce the complete normalized 24-file set from fully supplied locale content and approved transcript sources. It validates all inputs before writing and fails closed with an explicit missing-input list while translations and video transcripts remain unavailable.
- SEO foundation: the English generated route now derives its robots directive, Open Graph/Twitter basics, canonical, plain-text alternate, and `WebSite`/`SoftwareApplication`/`VideoObject`/twelve-item `FAQPage` JSON-LD from typed visible content. The `VideoObject` references the verified demo MP4, poster, visual transcript, and one-minute duration; social images, `hreflang`, and a sitemap remain deferred until their required inputs exist.
- `landing:verify:seo` now validates the published English page’s indexability, canonical and plain-text metadata, social URLs, Schema.org graph, visible FAQ count, and the real demo MP4/poster/transcript references. It fails closed on missing or non-HTTPS structured-data URLs.
- `landing:verify:browser-support` now validates the generated modern module entry, `nomodule` polyfill/legacy entry isolation, deferred Plyr, and the base-path-safe existence of every runtime HTML asset.
- `landing:verify:a11y` now runs axe against the generated English static page and rejects violations such as duplicate main landmarks. It intentionally disables only color-contrast in JSDOM, which has no layout engine; contrast remains a required real-browser/manual review.
- English visual demo: `assets/demo/` now contains a 60-second, 1920×1080/60-fps, fast-start H.264/AAC visual master, a 1280×720 WebP poster, and English visual-description WebVTT/TXT resources. The manifest-driven pipeline validates stream inventory, codec, geometry, frame rate, size, fast-start placement, HLS/DASH absence, and generated-file hashes before staging public media.
- Visual-media approval: the user approved the current English 60-second MP4 and poster on 2026-07-14. This approves the visual master only; the separate audio-completion requirement remains open.
- Native playback: the English static page now renders the real demo with `preload="none"`, native controls, a poster, a caption-track-compatible visual-description resource, and adjacent Accordion notes. All nine chronological notes remain in the static HTML; hydration only adds the collapsible interaction. Plyr progressively enhances the existing video only within 600 pixels of the viewport or after playback begins; an unavailable enhancement leaves the native player intact.
- Static HTML integrity: locale generation now removes Vite’s placeholder skip link and root shell before inserting the pre-rendered app, so the published output contains exactly one skip link, root, and main landmark. The optional Retry branch retains its `li` list semantics rather than overriding it with an invalid ARIA note role.
- Published-locale safety: the language selector now renders only routes with complete published content. It is absent while English is the only published route, preventing links to the ten ungenerated locale paths; it expands from the shared published-locale registry when reviewed dictionaries become available.
- English browser proof: Playwright now checks the 390px no-JavaScript player and mobile navigation fallbacks, the hydrated Sheet’s Escape/focus-return behavior, local-only enhanced-player assets, the fallback `details` navigation when hydration is unavailable, horizontal overflow from 320–1440 pixels, reduced-motion visibility, and sticky-header clearance for the Providers, How it works, and FAQ anchors. Plyr starts only after hydration succeeds, so React cannot replace an already-enhanced native video. Its icon sprite is emitted locally rather than fetched from `cdn.plyr.io`.
- Video enhancement fallback: the English E2E suite blocks the deferred Plyr JavaScript chunk and proves the hydrated route retains its original native video controls instead of losing playback.
- Browser shell integrity: the generated English document now declares the existing local GPT-Voice SVG as its favicon. A fresh browser navigation loads it successfully and no longer produces a missing `/favicon.ico` console error.
- Tasks 1–8, 10, 14, and 16: reconciled the page/media contract, isolated dependencies and commands, configured Vite/TypeScript/Electron build boundaries, added landing-owned visual foundations, installed all selected shadcn primitives, defined the content contracts, and delivered the workflow plus FAQ/CTA/footer slices.

## Changed Files

- Landing root, Vite/browser configs, and Electron TypeScript/Webpack exclusions.
- `LandingPage`, its content contract, and landing styles now contain the temporary demo placeholder and its dedicated static-rendering test.
- The asset sync script, landing command boundary, and media-contract test now support screenshot-only shell builds during video production.
- `LandingPage` and its focused test now assert responsive hero media sources, image dimensions, and static reveal markup.
- The TXT generator and native Node tests now cover page/transcript resource paths, UTF-8/LF/NFC normalization, plain-text digest creation, qualification-preserving page serialization, and no-partial-output behavior.
- The locale generator now adds safe, serialized English SEO metadata and visible-content structured data; its Node test verifies every generated schema type and all twelve FAQ entries.
- The locale generator now exposes the real English demo through `VideoObject` structured data, including its public MP4 and poster URLs; its Node test verifies the ordered graph and media URLs.
- `LandingPage` now asserts the complete static provider signal-map structure, including 31 waveform bars and the absence of provider-brand assets.
- Landing-owned shadcn configuration, class utility, token/global styles, and token-contract test.
- CLI-generated and landing-adapted Button, Badge, and Card sources with direct Slot dependency and Vitest semantics coverage.
- Direct-Radix navigation primitives, keyboard/focus-return tests, and an Electron Tailwind source boundary that excludes landing classes.
- Direct-Radix Accordion and AspectRatio plus Alert, Kbd, and Skeleton primitives. Accordion content is present in initial server HTML; alerts remain static and skeletons decorative. Tests enforce keyboard behavior and the exact 13-file, Electron-free component inventory.
- Landing content schema, canonical English copy, the complete eleven-locale route registry, and transcript-cue contracts. Tests compare the registry, all twelve FAQ answers, prompt-first/provider qualifications, and TXT-output requirements to the approved artifacts.
- English static generation writes a no-JavaScript HTML route with localized metadata; it intentionally does not publish unreviewed English fallbacks for the ten non-English routes.
- How it works is a connected, non-interactive three-step workflow with pinned Lucide geometry, keyboard proof, and an explicitly optional Retry provider-error branch. It has desktop and mobile layout checks at 1440 and 390 pixels.
- FAQ has all twelve answers in initial HTML. Hydration adds the collapsed Accordion presentation; without JavaScript, the pre-rendered answers remain readable. The final CTA and factual footer have complete static links.
- Navigation now has semantic desktop fragment links, a published-locale selector when more than one route is available, a no-JavaScript `details` fallback, and an accessible mobile Sheet. Task 17 remains open for locale-aware hydration and full interaction coverage.
- The responsive accessibility foundation now includes non-gating one-time section reveal: static/no-JavaScript and reduced-motion output stays visible, while supported hydrated browsers reveal marked sections through the approved 480ms motion.
- The production build now uses the checked-in modern/legacy Browserslist environments, Terser, Lightning CSS, and `@vitejs/plugin-legacy` with modern polyfills disabled. Static generation preserves Vite’s legacy body scripts and minifies generated HTML conservatively.
- `landing:verify:sizes` now deterministically measures raw, gzip, and Brotli output for modern/legacy initial JavaScript, initial CSS, deferred Plyr, and HTML, and rejects published source maps.
- The static landing remains usable before enhancement: native video, links, transcript content, and the mobile `details` navigation work immediately. React/Radix hydration now begins after page load or first user intent, and hides the fallback only after the enhancement module loads successfully. This brings the English initial JavaScript under the enforced budgets.
- Landing Playwright configuration and English E2E coverage now build and preview the generated route, check no-JavaScript playback/navigation, mobile Sheet keyboard return, and a local-only Plyr enhancement. The player’s local SVG sprite is emitted through Vite, and initialization runs after React hydration to avoid an enhancement race.
- Task 9 is complete for the published English route. The `landing:dev` and `landing:build` commands now stage the complete verified media set rather than the screenshot-only shell.

## Checks

- `npm run landing:typecheck`
- `npm run landing:lint`
- `npm run landing:format:check`
- `npm run typecheck`
- `npm run test:types`
- `node --import tsx --test tests/scripts/webpackConfig.test.ts`
- `npm run lint`
- `npm run build:prod`
- `npm run landing:build`
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/mediaContract.test.ts`
- `npm run landing:verify:media`
- `npm run landing:test -- --run src/landing-page/components/LandingPage.test.tsx`
- `npm ci` followed by `npx install-electron --no` (required once to repair Electron's postinstall race)
- `npm test`
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/localeGeneration.test.ts`
- `npm run landing:test -- --run src/landing-page/components/HowItWorksSection.test.tsx src/landing-page/components/LandingPage.test.tsx`
- `npm run landing:test -- --run src/landing-page/components/FaqSection.test.tsx src/landing-page/components/PageCompletionSections.test.tsx src/landing-page/components/LandingPage.test.tsx`
- `npm run landing:test -- --run src/landing-page/components/LandingPage.test.tsx`
- `npm run landing:build`
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/verifySizes.test.ts`
- `npm run landing:verify:sizes` (passing English baseline: 2.1 KiB gzip modern initial JS; 42.6 KiB legacy initial JS including polyfills)
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/verifySeo.test.ts`
- `npm run landing:verify:seo`
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/verifyBrowserSupport.test.ts`
- `npm run landing:verify:browser-support`
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/verifyAccessibility.test.ts`
- `npm run landing:verify:a11y`
- Local CloakBrowser smoke against `landing:dev` at 1440px and 390px; temporary captures confirmed the hero’s desktop two-column and mobile stacked compositions.
- Local CloakBrowser smoke confirmed the provider map at 1440px and 390px; temporary captures were not retained in the repository.
- Local CloakBrowser provider-connector smoke confirmed the single 40-pixel mobile arrow and 48-pixel desktop arrow; close-up captures were not retained in the repository.
- Production-preview CloakBrowser smoke confirmed no horizontal overflow at 320, 390, 768, 1024, and 1440 pixels; `#providers`, `#how-it-works`, and `#faq` clear the sticky header at 390 pixels; reduced-motion reveal targets remain visible. Temporary evidence was not retained in the repository.
- `npm run landing:test -- --run src/landing-page/components/SiteHeader.test.tsx`
- `npm run landing:typecheck`
- Local CloakBrowser interaction smoke at 390px verified the hydrated sheet, hidden native fallback, and preserved locale `#faq` fragment; the temporary capture was not retained in the repository.
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/generateTxtFiles.test.ts`
- `npm run landing:generate-txt` (expected fail-closed result until all reviewed dictionaries and approved transcript sources exist)
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/localeGeneration.test.ts`
- `npm run landing:build`
- Production-preview CloakBrowser metadata smoke confirmed the canonical, robots directive, and three-item JSON-LD graph; temporary evidence was not retained in the repository.
- Consolidated landing check: `landing:format:check`, `landing:lint`, all 23 Vitest checks, and the three native Node locale/TXT tests pass.
- `npm run landing:test:e2e` (eight English browser scenarios pass, including blocked hydration/Plyr chunks plus responsive, reduced-motion, and sticky-anchor coverage).
- Local production-preview CloakBrowser smoke at 390px confirmed the hydrated Sheet opens, closes with Escape, and returns focus; the enhanced video controls load from local assets with no console errors or horizontal overflow. At 1440px, desktop navigation and the enhanced player render without overflow. Temporary evidence was not retained in the repository.
- A fresh 1440px production-preview CloakBrowser navigation confirmed the local favicon returns `200` and produces no console errors. Temporary evidence was not retained in the repository.

## Next Step

- The English demo-media and native-player slices are complete. Task 11 remains an English-only static route shell until every reviewed locale dictionary is available. Resume with reviewed locale dictionaries and their accessibility resources; then complete localized video/SEO/TXT outputs and the remaining cross-locale quality gates.

## Blockers

- The user-approved English visual master is silent. Its visual-description resources are accurate for the current edition, but final voice-over, licensed music/SFX, and their synchronized captions remain required before it can be described as an audio-complete production master.
- Only `src/landing-page/content/locales/en.ts` exists. The ten non-English complete dictionaries and their recorded proficient-speaker approvals are required before Tasks 11 and 19–24 can complete. English must not be copied as a production fallback.
- Tasks 17, 18, and 25 have committed foundations but remain incomplete until all locale outputs and the remaining page sections are available for the full interaction, accessibility, browser, and size gates.
- The English size baseline passes, but complete locale-font isolation and transfer-budget enforcement remain blocked by the ten reviewed locale dictionaries and their generated font subsets.
- No push, GitHub Pages deployment, or production verification is authorized. Task 32 remains authorization-gated after all local acceptance gates are satisfied.
