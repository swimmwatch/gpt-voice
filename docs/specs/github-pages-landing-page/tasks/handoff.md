# Landing Page Handoff

## Completed

- Temporary demo placeholder: replaced the unavailable media player with an accessible, responsive 16:9 placeholder. It states that the 60-fps product demo is in production and uses a static voice waveform with decorative transcription, translation, and Prettify symbols. It makes no media, caption, or transcript request and does not satisfy the final-video acceptance criteria.
- Hero asset availability: `landing:sync-shell-assets` now hash-validates the approved fresh `app-main.png` capture and generates PNG, WebP, and AVIF derivatives before landing development or build. The full `landing:sync-media` command remains blocked by, and strict about, the deferred video package.
- Hero layout: the semantic prompt-first hero now has the specified mobile-first copy, CTA, shortcut, and approved screenshot order, then changes to a two-column desktop composition. The screenshot is a non-interactive modern source set with an explicit PNG fallback.
- Provider signal map: the transcription section now has a static microphone and waveform input, solid current-route treatment, a separate dashed future horizon, compact fact chips, and the qualified ChatGPT Web claim. It deliberately uses no provider-brand icons and does not animate or expose cards as controls.
- Tasks 1–8, 10, 14, and 16: reconciled the page/media contract, isolated dependencies and commands, configured Vite/TypeScript/Electron build boundaries, added landing-owned visual foundations, installed all selected shadcn primitives, defined the content contracts, and delivered the workflow plus FAQ/CTA/footer slices.

## Changed Files

- Landing root, Vite/browser configs, and Electron TypeScript/Webpack exclusions.
- `LandingPage`, its content contract, and landing styles now contain the temporary demo placeholder and its dedicated static-rendering test.
- The asset sync script, landing command boundary, and media-contract test now support screenshot-only shell builds during video production.
- `LandingPage` and its focused test now assert responsive hero media sources, image dimensions, and static reveal markup.
- `LandingPage` now asserts the complete static provider signal-map structure, including 31 waveform bars and the absence of provider-brand assets.
- Landing-owned shadcn configuration, class utility, token/global styles, and token-contract test.
- CLI-generated and landing-adapted Button, Badge, and Card sources with direct Slot dependency and Vitest semantics coverage.
- Direct-Radix navigation primitives, keyboard/focus-return tests, and an Electron Tailwind source boundary that excludes landing classes.
- Direct-Radix Accordion and AspectRatio plus Alert, Kbd, and Skeleton primitives. Accordion content is present in initial server HTML; alerts remain static and skeletons decorative. Tests enforce keyboard behavior and the exact 13-file, Electron-free component inventory.
- Landing content schema, canonical English copy, the complete eleven-locale route registry, and transcript-cue contracts. Tests compare the registry, all twelve FAQ answers, prompt-first/provider qualifications, and TXT-output requirements to the approved artifacts.
- English static generation writes a no-JavaScript HTML route with localized metadata; it intentionally does not publish unreviewed English fallbacks for the ten non-English routes.
- How it works is a connected, non-interactive three-step workflow with pinned Lucide geometry, keyboard proof, and an explicitly optional Retry provider-error branch. It has desktop and mobile layout checks at 1440 and 390 pixels.
- FAQ has all twelve answers in initial HTML. Hydration adds the collapsed Accordion presentation; without JavaScript, the pre-rendered answers remain readable. The final CTA and factual footer have complete static links.
- Navigation now has semantic desktop fragment links, an eleven-language native-label selector, a no-JavaScript `details` fallback, and an accessible mobile Sheet. Task 17 remains open for locale-aware hydration, video enhancement, and full interaction coverage.
- The responsive accessibility foundation now includes non-gating one-time section reveal: static/no-JavaScript and reduced-motion output stays visible, while supported hydrated browsers reveal marked sections through the approved 480ms motion.
- The production build now uses the checked-in modern/legacy Browserslist environments, Terser, Lightning CSS, and `@vitejs/plugin-legacy` with modern polyfills disabled. Static generation preserves Vite’s legacy body scripts and minifies generated HTML conservatively.

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
- `npm ci` followed by `npx install-electron --no` (required once to repair Electron's postinstall race)
- `npm test`
- `npx tsx --tsconfig tsconfig.landing.node.json --test tests/landing-page/localeGeneration.test.ts`
- `npm run landing:test -- --run src/landing-page/components/HowItWorksSection.test.tsx src/landing-page/components/LandingPage.test.tsx`
- `npm run landing:test -- --run src/landing-page/components/FaqSection.test.tsx src/landing-page/components/PageCompletionSections.test.tsx src/landing-page/components/LandingPage.test.tsx`
- `npm run landing:test -- --run src/landing-page/components/LandingPage.test.tsx`
- `npm run landing:build`
- Local CloakBrowser smoke against `landing:dev` at 1440px and 390px; temporary captures confirmed the hero’s desktop two-column and mobile stacked compositions.
- Local CloakBrowser smoke confirmed the provider map at 1440px and 390px; temporary captures were not retained in the repository.

## Next Step

- Task 9 remains blocked by the absent approved demo MP4/poster. The visible page now has a non-media placeholder while that blocker remains. Task 11 has an English-only static route shell; it remains open until all reviewed dictionaries can be generated without fallback. Next independent implementation slice: Task 17/18 interaction and responsive accessibility work that does not require media.

## Blockers

- `docs/specs/github-pages-landing-page/assets/demo/` is absent. `npm run landing:sync-media` therefore fails on the first required input: `assets/demo/demo.mp4`. The approved 60-fps MP4, poster, eleven WebVTT files, and eleven transcript TXT files are required before Tasks 9, 12, 13, 15, 23, and 27 can complete.
- Only `src/landing-page/content/locales/en.ts` exists. The ten non-English complete dictionaries and their recorded proficient-speaker approvals are required before Tasks 11 and 19–24 can complete. English must not be copied as a production fallback.
- Tasks 17, 18, and 25 have committed foundations but remain incomplete until the media, all locale outputs, and the remaining page sections are available for the full interaction, accessibility, browser, and size gates.
- No push, GitHub Pages deployment, or production verification is authorized. Task 32 remains authorization-gated after all local acceptance gates are satisfied.
