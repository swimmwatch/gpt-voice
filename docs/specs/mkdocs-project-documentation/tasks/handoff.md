# Handoff: MkDocs Project Documentation And GitHub Pages Integration

## Completed Work

- Task 1 reconciled the documentation and landing-page specifications.
- Task 2 added the isolated, strict MkDocs foundation and its initial user-guide overview.
- Task 3 added deterministic source-boundary and built-output checks.
- Task 4 added atomic, hash-pinned staging for the approved icon, fonts, and main screenshot derivatives.
- Task 5 applied the original local graphite/blue Material theme, responsive screenshot, and static public navigation
  links.
- Checkpoint C is complete: the user authorized continuation after the visual review.
- Task 6 added verified Windows/Linux installation, update, uninstall, retained-data, provider setup, microphone,
  first-recording, and clipboard-result guidance.
- Task 6a added the pinned suffix-based `mkdocs-static-i18n` configuration for the eleven landing locales, localized
  navigation/search, no-fallback behavior, and tested lowercase `pt-br`/`zh-cn` route adapters.
- Task 6a stages all local Noto Sans SC, Noto Sans JP, and Noto Sans Devanagari Unicode subsets with hash validation.
- A non-public translation manifest blocks every non-English locale until every page has current source/local hashes
  and a non-personal proficient-speaker review record. The production docs build therefore remains English-only.
- Task 7 added source-derived English guides for the recording lifecycle, temporary retry behavior, clipboard/history
  output, user-facing failures, ChatGPT Web sessions, OpenAI API keys/settings, provider switching, and authentication
  clearing.
- Task 8 added source-derived English guides for selected-text Translation and Prettify, including action enablement,
  target language, clipboard/error behavior, user-operated Ollama/vLLM dependencies, local transcription history, and
  the hidden-window/tray lifecycle.
- Task 9 added source-derived English settings guides for the Settings lifecycle, ChatGPT Web and OpenAI API controls,
  and all six global shortcuts, including defaults, capture, conflicts, and selected-text action enablement.
- Task 10 added the source-derived English Prettify settings reference, including Ollama/vLLM connection and model
  controls, encrypted vLLM-key handling, remote-endpoint privacy, Ollama memory state, prompt requirements, and every
  generation default and validation range.
- Task 11 added source-derived English Browser and Network settings references, including browser behavior and
  identity defaults, proxy validation and encrypted-password handling, SOCKS5 credential limits, and the shared
  proxy-GeoIP locale/timezone dependency.
- Task 12 added source-derived English privacy/data, safe troubleshooting, and FAQ references, with all eleven locale
  navigation labels and built-output/locale-fixture contracts for the new pages.
- Task 13 added public-guide structure, terminology, navigation, screenshots, qualification, descriptive-link, and
  automatic-insertion contracts, plus a machine-readable map of 58 released settings and reviewed-release markers.
- Task 14 added one prominent, canonical README link to the full GPT-Voice user and settings guide, with contracts
  rejecting a missing or duplicate destination.
- Task 14b restored Material for MkDocs as the native documentation UI: `extra.css` now contains only the approved
  landing palette and required local font/glyph declarations, while a negative CSS contract rejects component styling.
- Task 14c applied the user-authorized CloakBrowser reference visual treatment while preserving GPT-Voice branding and
  the landing palette: a self-contained PNG header/fav icon, local hero wordmark, useful Material icons/features,
  icon-led overview cards, and a tested content-style selector allowlist.

## In Progress

- Task 14a has staged a complete Russian source set: overview, installation, first use, transcription, providers,
  text actions, history and tray, all five settings pages, privacy, troubleshooting, and FAQ. The locale remains
  blocked in the translation manifest until a proficient-speaker review is recorded; the remaining nine locale source
  sets are not yet staged.
- Task 14a has staged the complete Belarusian source set: overview, installation, first use, recording, providers,
  text actions, history, tray, all five settings pages, privacy, troubleshooting, and FAQ. Belarusian remains blocked
  in the translation manifest until a proficient-speaker review is recorded.
- Task 14a has staged the Ukrainian overview and installation guide. Ukrainian remains blocked in the translation
  manifest until its remaining public pages are complete and a proficient-speaker review is recorded.
- The specification and plan define Material for MkDocs as the structural documentation UI and permit only the
  user-authorized reference-derived content treatment in addition to the landing palette and local font/glyph rules.

## Changed Files

- `mkdocs.yml`
- `README.md`
- `docs/requirements.txt`
- `docs/user-guide/index.md`
- `docs/user-guide/guides/transcription.md`
- `docs/user-guide/guides/providers.md`
- `docs/user-guide/guides/text-actions.md`
- `docs/user-guide/guides/history-and-tray.md`
- `docs/user-guide/settings/index.md`
- `docs/user-guide/settings/providers.md`
- `docs/user-guide/settings/shortcuts.md`
- `docs/user-guide/settings/prettify.md`
- `docs/user-guide/settings/browser.md`
- `docs/user-guide/settings/network.md`
- `docs/user-guide/index.md`
- `docs/user-guide/privacy.md`
- `docs/user-guide/troubleshooting.md`
- `docs/user-guide/faq.md`
- `docs/user-guide/install.md`
- `docs/user-guide/getting-started.md`
- `docs/user-guide/index.ru.md`
- `docs/user-guide/install.ru.md`
- `docs/user-guide/getting-started.ru.md`
- `docs/user-guide/guides/transcription.ru.md`
- `docs/user-guide/guides/providers.ru.md`
- `docs/user-guide/guides/text-actions.ru.md`
- `docs/user-guide/guides/history-and-tray.ru.md`
- `docs/user-guide/settings/index.ru.md`
- `docs/user-guide/settings/providers.ru.md`
- `docs/user-guide/settings/shortcuts.ru.md`
- `docs/user-guide/settings/prettify.ru.md`
- `docs/user-guide/settings/browser.ru.md`
- `docs/user-guide/settings/network.ru.md`
- `docs/user-guide/privacy.ru.md`
- `docs/user-guide/troubleshooting.ru.md`
- `docs/user-guide/faq.ru.md`
- `docs/user-guide/index.be.md`
- `docs/user-guide/install.be.md`
- `docs/user-guide/getting-started.be.md`
- `docs/user-guide/guides/transcription.be.md`
- `docs/user-guide/guides/providers.be.md`
- `docs/user-guide/guides/text-actions.be.md`
- `docs/user-guide/guides/history-and-tray.be.md`
- `docs/user-guide/settings/index.be.md`
- `docs/user-guide/settings/providers.be.md`
- `docs/user-guide/settings/shortcuts.be.md`
- `docs/user-guide/settings/prettify.be.md`
- `docs/user-guide/settings/browser.be.md`
- `docs/user-guide/settings/network.be.md`
- `docs/user-guide/index.uk.md`
- `docs/user-guide/install.uk.md`
- `assets/gpt-voice-wordmark.svg`
- `docs/user-guide/assets/stylesheets/extra.css`
- `docs/user-guide/data/locales.json`
- `docs/user-guide/data/translation-manifest.json`
- `docs/mkdocs-overrides/partials/languages/zh-CN.html`
- `tests/documentation/mkdocsOutput.test.ts`
- `scripts/sync-docs-assets.mjs`
- `scripts/mkdocs-configuration.mjs`
- `scripts/normalize-docs-locale-routes.mjs`
- `scripts/validate-doc-translations.mjs`
- `tests/documentation/docsAssets.test.ts`
- `tests/documentation/localeBuild.test.ts`
- `tests/documentation/localeContract.test.ts`
- `tests/documentation/normalizeDocsLocaleRoutes.test.ts`
- `tests/documentation/translationManifest.test.ts`
- `tests/documentation/localeSourceContract.test.ts`
- `tests/documentation/contentContract.test.ts`
- `tests/documentation/settingsCoverage.test.ts`
- `tests/documentation/fixtures/settings-coverage.json`
- `package.json`
- `.gitignore`
- `docs/specs/mkdocs-project-documentation/spec.md`
- `docs/specs/github-pages-landing-page/spec.md` (MkDocs locale-route cross-reference only)
- This task plan, checklist, and handoff

## Checks

- `npm run docs:install`
- `npm run docs:build`
- `npm run docs:test`
- Responsive Chromium inspection at 320, 390, 768, and 1440 CSS pixels
- HAR inspection confirming no external runtime requests after removing Material repository-source metadata fetching
- `npm run docs:sync-assets` twice with matching generated-file hashes
- `node --import tsx --test tests/documentation/docsAssets.test.ts`
- `rg` verification that no reference-only capture appears in staged or built assets
- A temporary `docs_dir: docs` mutation failed the source-boundary test and was restored.
- `npx eslint scripts/sync-docs-assets.mjs tests/documentation/*.test.ts`
- `npx prettier --check scripts/sync-docs-assets.mjs tests/documentation/*.test.ts package.json`
- `npm run test:types`
- Canonical URL inspection of `build/github-pages/docs/index.html`
- Built-route inspection for `/docs/install/` and `/docs/getting-started/`, including canonical URLs and internal links
- `git diff --check`
- `git status --short` and ignore-rule inspection
- `node --import tsx --test tests/documentation/localeBuild.test.ts`
- `npm run docs:test`
- `npx eslint scripts/normalize-docs-locale-routes.mjs scripts/sync-docs-assets.mjs scripts/validate-doc-translations.mjs tests/documentation/*.test.ts`
- `npx prettier --check` for the touched supported documentation/configuration/script/test files
- Task 8: `npm run docs:build`, `npm run docs:test`, focused locale/output contracts, Prettier, and `git diff --check`
  all passed.
- Task 9: `npm run docs:build`, `npm run docs:test`, focused locale/output contracts, Prettier, and `git diff --check`
  all passed.
- Task 10: `npm run docs:build`, `npm run docs:test`, Prettier, and `git diff --check` passed after the
  connection/model and generation/prompt slices.
- Task 11: `npm run docs:build`, `npm run docs:test`, Prettier, and `git diff --check` passed after the Browser and
  Network slices.
- Task 12: `npm run docs:build`, `npm run docs:test` (12 passing), focused output/locale fixture contracts, and
  Prettier passed after the Privacy, Troubleshooting, and FAQ slices. `git diff --check` passed as the final handoff
  gate.
- Task 13: `npm run docs:build` and `npm run docs:test` (16 passing) passed after the content/navigation and
  settings-coverage slices; Prettier and `git diff --check` passed as the final handoff gate.
- Task 14: `npm run docs:test` (17 passing), rendered-link/source review, Prettier, and `git diff --check` passed.
- Task 14a Russian core batch: `npm run docs:build` and focused locale, manifest, and fixture tests (6 passing)
  passed; Prettier and `git diff --check` passed as the handoff gate.
- Task 14a Russian workflow batch: `npm run docs:build` and focused locale, manifest, and fixture tests (6 passing)
  passed; Prettier and `git diff --check` passed as the handoff gate. The source contract preserves workflow
  shortcuts, provider/authentication, selected-text/privacy, local-history, and tray command tokens.
- Task 14a Russian core-settings batch: `npm run docs:build` and focused locale, manifest, and fixture tests (6
  passing) passed; Prettier and `git diff --check` passed as the handoff gate. The source contract preserves settings
  lifecycle, provider authentication/model/storage, all shortcut defaults, capture/conflict behavior, and
  selected-text action controls.
- Task 14a Russian advanced-settings batch: `npm run docs:build` and focused locale, manifest, and fixture tests (6
  passing) passed; Prettier and `git diff --check` passed as the handoff gate. The source contract preserves
  Prettify endpoint/privacy, key/model/generation/prompt constraints, CloakBrowser behavior/identity, proxy
  validation, SOCKS5 restrictions, and the shared GeoIP locale/timezone rule.
- Task 14a Russian support batch: the complete Russian staging contract now derives all public guide paths from
  `mkdocs.yml`; it preserves privacy/data-flow and reset controls, safe diagnostic paths, and FAQ qualifications.
  Focused locale-contract checks and strict English-only builds passed for each support-page increment; the final
  documentation suite (20 passing), Prettier, and `git diff --check` passed as the handoff gate.
- Task 14a Belarusian core batch: overview, installation, and first-use content preserves package names, commands,
  UI labels, `whisper-1`, shortcuts, clipboard outcomes, and safe-storage qualification. The blocked-locale contract
  and a strict English-only build passed; the final documentation suite (21 passing), Prettier, and `git diff --check`
  passed as the handoff gate.
- Task 14a Belarusian workflow batch: recording lifecycle and temporary retry behavior, provider authentication and
  `whisper-1`, selected-text privacy and cancellation, and local-history/tray actions are now staged. The
  blocked-locale contract rejects a missing workflow source; the strict English-only build and final documentation
  suite (22 passing), Prettier, and `git diff --check` passed as the handoff gate.
- Task 14a Belarusian core-settings batch: settings lifecycle, provider session/API-key storage, every shortcut
  default, capture and conflict behavior, and selected-text action controls are now staged. The blocked-locale
  contract rejects a missing staged source; the strict English-only build and final documentation suite (22 passing),
  Prettier, and `git diff --check` passed as the handoff gate.
- Task 14a Belarusian advanced-settings batch: Prettify endpoint, key, model, generation, and prompt constraints;
  CloakBrowser behavior and identity; proxy validation, SOCKS5 limits, and GeoIP ownership are now staged. The
  blocked-locale contract rejects a missing staged source; the strict English-only build and final documentation suite
  (22 passing), Prettier, and `git diff --check` passed as the handoff gate.
- Task 14a Belarusian support batch: privacy/data handling and reset controls, safe diagnostic paths, and FAQ
  qualifications are now staged. The complete source contract derives all public Belarusian guide paths from
  `mkdocs.yml` while the translation manifest keeps the locale blocked until proficient-speaker review. The strict
  English-only build, complete documentation suite (22 passing), Prettier, and `git diff --check` passed as the
  handoff gate.
- Task 14a Ukrainian overview: the public overview now covers the application workflow, provider options,
  selected-text actions, local result history, release scope, and guide routes. The blocked-locale contract rejects a
  missing overview source and keeps production builds English-only. The strict English-only build, complete
  documentation suite (24 passing), Prettier, and `git diff --check` passed as the handoff gate.
- Task 14a Ukrainian installation: the platform package choices, verification, install/update/remove paths, and
  retained-data behavior are now staged. The blocked-locale source contract preserves package names, commands, and
  local data paths while production builds remain English-only. The strict English-only build, complete documentation
  suite (24 passing), Prettier, and `git diff --check` passed as the handoff gate.
- Material-native planning revision: updated the documentation specification, landing cross-reference, detailed
  plan, and task checklist. The revision adds Task 14b with a palette/font CSS allowlist and a negative
  component-selector contract; no MkDocs configuration or stylesheet implementation changed in this slice.
- Task 14b: `npm run docs:build` and `npm run docs:test` (20 passing) passed. The source contract confirms Material's
  dark `slate` palette, the exact landing color variables, approved local fonts, and rejection of a representative
  `.md-header` geometry override; Prettier and `git diff --check` passed.
- Task 14c: the local asset pipeline stages a self-contained PNG logo plus the GPT-Voice wordmark, while the theme
  contract allows only reference-derived content selectors and rejects a `.md-header` mutation. Strict build and
  focused asset/theme/content/locale tests passed. Local Playwright checks at 390 and 1440 pixels found the wordmark,
  icon cards, and desktop tabs with no horizontal overflow or console errors; requests remained on `127.0.0.1`.
  The final documentation suite (21 passing), Prettier, and `git diff --check` passed. ESLint has no errors; its two
  remaining warnings predate this task (a dynamic-regexp test and an existing oversized output-contract test).

## Next Step

Arrange the required proficient-speaker review for the complete Russian and Belarusian source sets, then continue
Task 14a with the Ukrainian first-use page (or another user-directed locale). Task 15 waits for complete reviewed
translations in all ten non-English locales.

## Blockers

Deployment, release publication, and GitHub Pages settings remain out of scope until separately authorized. Every
non-English locale requires a recorded proficient-speaker approval before Task 14a can enable it for publication.
