# Landing Page Handoff

## Delivery status

The English-only static landing at `/gpt-voice/` is locally complete. It contains the approved fast-paced 60-second English demo, native video fallback, progressive Plyr enhancement, hero, workflow, provider map, FAQ, CTA, footer, responsive navigation, and typed SEO/static output.

Tasks 19–24 are intentionally deferred future localization work. No Russian or other non-English landing/video content has been added. They are not blockers for the approved English delivery.

Landing deployment is out of scope: no release-time landing validation, GitHub Pages setting change, or deployment is required.

## Completed evidence

- The approved 1920×1080, 60-fps English MP4 and 1280×720 poster are hash-validated, local-only public assets. The player has native controls, a poster, visual-description resources, and a no-JavaScript fallback; enhancement loads only after hydration/viewport intent.
- The provider signal map now reproduces the SVG reference: its 31-bar, 92×28 tapered waveform has the full-width blue gradient, glow, and decorative recording motion; the voice card connects through a solid current-route branch and dashed future route to icon-led current-provider cards and the future horizon. Reduced-motion users see the exact static waveform shape.
- The generated English page is pre-rendered, uses `/gpt-voice/`-safe assets and metadata, has no Electron/private/remote streaming artifacts, and includes canonical/robots/social basics plus `WebSite`, `SoftwareApplication`, `VideoObject`, and FAQ JSON-LD.
- The responsive page passes native fallback, Sheet focus return, keyboard FAQ, reduced-motion, forced-colors, text-spacing, anchor-clearance, overflow, local-player, accessibility, media, SEO, browser-support, and size checks.
- Chromium and Firefox each passed all 11 English Playwright scenarios. WebKit is configured in Pages CI with `--with-deps`; it cannot launch locally because `libavif16` and `libwoff1` are unavailable and elevation is unavailable.
- Local CloakBrowser production-preview checks passed at mobile and desktop: zero final console errors, no horizontal overflow, local player assets, native fallback, and Sheet focus return.
- `.github/workflows/pr-checks.yml` runs the English landing checks, including all three Playwright engines, only for pull requests targeting `main` and only after the root quality gates succeed. It contains no Pages configuration, artifact upload, deployment, or release-time landing work.
- Root test configuration now keeps landing test typechecking isolated while allowing the root runtime unit suite to resolve `@landing/*`. This makes `npm test` a truthful whole-project command rather than silently excluding the landing tests.

## Current checks

Passed after the final configuration fix:

- `npm run typecheck`
- `npm run test:types`
- `npm test` — 356 passing tests
- `npm run build:prod`

Previously completed English landing gates remain valid: landing typecheck/lint/format, 23 landing Vitest tests, 30 landing Node contract tests, all media/SEO/static-accessibility/browser-support/size verifiers, Chromium and Firefox E2E, and local CloakBrowser production-preview evidence.

Known unrelated root baseline finding, intentionally untouched:

- `npm run lint` completes with one existing unused-import warning in `src/renderer/components/ProviderSettingsModal.tsx` (`OpenAIApiProviderSettings`).

## Final commits

- `78269f7 fix(test): isolate landing test TypeScript config`
- `82ec103 test(landing): resolve aliases in root unit suite`

## Remaining boundary

No landing deployment task remains for this English delivery: validation happens at the pull request level before code reaches `main`. Future localization Tasks 19–24 require independently reviewed dictionaries and approvals before they are scheduled.
