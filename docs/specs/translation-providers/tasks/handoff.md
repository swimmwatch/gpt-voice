# Handoff: Translation Providers Task 05 Complete

Status: Tasks 01–04 are committed through `0d933c7`. Task 05 is implemented,
verified, and authorized for a scoped commit. Task 06 is authorized after that
commit. Tasks 07–11 are not authorized.

## Completed Packets

- [01 Shared contracts and inventories](01_define_translation_contracts_and_inventories.md)
  - Added closed Google, Bing, and Yandex contracts with exact checked-in
    target inventories: Google 249, Bing 179, and Yandex 118.
- [02 Base provider lifecycle](02_build_base_translate_provider_lifecycle.md)
  - Added the isolated reusable provider lifecycle, one pre-submit recovery,
    single insertion, stable-result acceptance, clear-or-close cleanup, and
    sanitized outcomes.
- [03 Google provider](03_migrate_google_translate_provider.md)
  - Added the unregistered Google subclass and deterministic public-control
    fixtures.
- [04 Bing provider](04_implement_bing_translate_provider.md)
  - Added the unregistered Bing subclass, stable canonical-catalog readiness,
    exact native selection, one fill, and deterministic fixtures.
- [05 Yandex provider](05_implement_yandex_translate_provider.md)
  - Added the unregistered Yandex subclass with source-free English-route
    navigation, essential-only consent, automatic source detection, exact
    visible-option selection, one full-string editor update, target-consistent
    stable output, and clear-or-close cleanup.
  - Added deterministic fixtures covering every shared target code and the
    accepted local retention boundary without contacting Yandex.

## Yandex Public Controls And Submission

- Navigation starts at `https://translate.yandex.com/en/translator` and accepts
  only the researched `/en/translator` to `/en/` normalization on
  `https://translate.yandex.com`.
- Consent uses exactly one visible `Allow essential cookies` button.
- Automatic detection uses the visible `Auto detect` label containing
  `input[type="checkbox"][role="switch"]`.
- Target selection uses the unique visible
  `button[aria-label^="Choose target language"]` and exact `data-value` on
  visible `[data-lang-element="true"][role="checkbox"]` options.
- The primary source is
  `#fakeArea[role="textbox"][contenteditable="plaintext-only"]`; the scoped
  semantic textbox is the single allowed fallback. `textarea#textarea` is
  never used.
- The destination is scoped to the single visible
  `[data-tracking-data*="box-dst"]` panel and its lexical textbox, with
  `#translation` allowed only as that panel's single fallback.
- Submission dispatches one bubbling `beforeinput`, assigns `textContent`
  once, then dispatches one bubbling `input`, both with
  `inputType: insertText`.
- Clear uses exactly one visible `button[aria-label="Clear"]` when required and
  confirms empty source, hidden empty destination, preserved automatic/target
  state, and no current `text` URL parameter.

## Changed Files

- Added `src/main/translateProviders/YandexTranslateProvider.ts`.
- Added `tests/main/translateProviders/YandexTranslateProvider.test.ts`.
- Updated `tasks/todo.md` and this handoff.
- Preserved the unrelated uncommitted
  `.agents/references/specification-interview.md` edit.

## Checks

- `node --import tsx --test tests/main/translateProviders/YandexTranslateProvider.test.ts tests/main/translateProviders/BaseTranslateProvider.test.ts`
  passed.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npx eslint src/main/translateProviders/YandexTranslateProvider.ts tests/main/translateProviders/YandexTranslateProvider.test.ts`
  passed.
- `npx prettier --check "src/main/translateProviders/YandexTranslateProvider.ts" "tests/main/translateProviders/YandexTranslateProvider.test.ts"`
  passed.
- `git diff --check` passed.
- Static inspection found no registry import, runtime logging, `fill()`,
  per-character typing, source-bearing navigation, post-submit selection, or
  nonessential-consent action.
- Fixtures cover route normalization, consent and blocking states,
  automatic-detection ambiguity, editor fallbacks and ambiguity, hidden
  duplicates, all 118 exact target codes, one event sequence, stable/empty/
  stale results, target mutation, exact local clearing, and context closure.

## Exact Next Packet

- Commit the verified Task 05 checkpoint as
  `feat(translation): add yandex translate provider`, then execute
  [06 Registry, settings, and IPC](06_add_translation_registry_settings_and_ipc.md).

## Blockers

- None.

## Remaining Risks

- Yandex remains intentionally unregistered until Task 06.
- No live Yandex page was opened; the deterministic implementation relies on
  the reviewed 2026-07-25 public-page contract.
- Yandex may retain submitted plaintext in URL history, provider telemetry,
  local provider History, and unknown provider-side storage. Visible clearing
  and context closure establish only local cleanup.
