# Handoff: Translation Providers Task 04 Complete

Status: Tasks 01–03 are committed through `e60cd0b`. Task 04 is implemented,
verified, and authorized for a scoped commit. Task 05 is authorized after that
commit. Tasks 06–11 are not authorized.

## Completed Packets

- [01 Shared contracts and inventories](01_define_translation_contracts_and_inventories.md)
  - Added the closed Google/Bing/Yandex provider contracts and fail-closed
    provider/language lookup helpers.
  - Added exact checked-in runtime inventories matching the reviewed
    2026-07-25 baselines: Google 249, Bing 179, and Yandex 118.
  - Added deterministic schema, invariant, source-only exclusion, DeepL
    absence, opaque-code, and TypeScript/YAML parity tests.
- [02 Base provider lifecycle](02_build_base_translate_provider_lifecycle.md)
  - Added the abstract, main-only translation lifecycle and closed safe
    request/outcome, phase, failure, diagnostic, and hook contracts.
  - Added lazy isolated context/page ownership, serialized generation
    suppression, one pre-submit recovery, single insertion, stable-result
    acceptance, clear-or-close cleanup, retained cleanup ownership, and
    shutdown.
  - Added nonpersistent translation launch options and explicit
    Google/Bing/Yandex navigation-service identities.
- [03 Google provider](03_migrate_google_translate_provider.md)
  - Added an unregistered `GoogleTranslateProvider` bound to shared Google
    metadata and the target-aware base lifecycle.
  - Added source-free `.ru` navigation, matching `.ru`/`.com` translator and
    consent allowlists, exact Reject-all handling, route-state verification,
    one native textarea insertion, and shared pre/post clear confirmation.
  - Added sanitized public-control fixtures and pure readiness/result
    classifiers for ambiguity, branch, alternative, timeout, target, and
    cleanup behavior.
- [04 Bing provider](04_implement_bing_translate_provider.md)
  - Added an unregistered `BingTranslateProvider` bound to shared Bing
    metadata and the base lifecycle.
  - Added exact public-route, native-select, contenteditable fill, output
    language, stable-catalog, and clear-state contracts.
  - Added deterministic fixtures for bounded readiness recovery, single fill,
    stable results, target agreement, and cleanup.

## Bing Public Controls And Recovery

- Source/target selects:
  `select#tta_srcsl[aria-label="Input Language Selection Dropdown"]` and
  `select#tta_tgtsl[aria-label="Output Language Selection Dropdown"]`.
- Source/output:
  `div#tta_input_ta[role="textbox"][aria-label="Input text area"][contenteditable="true"]`
  and `div#tta_output_ta[data-placeholder="Translation"]`.
- Canonical targets are enabled direct options under
  `optgroup#t_tgtAllLang` inside the unique visible target select; Recently
  used siblings are excluded.
- Readiness requires two equal order-independent signatures 250 ms apart
  within 5 seconds. Only the first pre-fill failure may recover.
- Clear uses `#tta_clear[role="button"][aria-label="Click to Clear"]` and
  confirms empty source/output, `auto-detect`, preserved target, hidden
  `#tta_clear_cnt`, and source focus.

## Changed Files

- Added `src/main/translateProviders/BingTranslateProvider.ts`.
- Added `tests/main/translateProviders/BingTranslateProvider.test.ts`.
- Updated `tasks/todo.md` and this handoff.
- Preserved the unrelated uncommitted
  `.agents/references/specification-interview.md` edit.

## Checks

- `node --import tsx --test tests/main/translateProviders/BingTranslateProvider.test.ts tests/main/translateProviders/BaseTranslateProvider.test.ts`
  passed.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npx eslint src/main/translateProviders/BingTranslateProvider.ts tests/main/translateProviders/BingTranslateProvider.test.ts`
  passed.
- `npx prettier --check "src/main/translateProviders/BingTranslateProvider.ts" "tests/main/translateProviders/BingTranslateProvider.test.ts"`
  passed.
- Static inspection found no registry import of the new class.
- Fixtures cover metadata and limits, exact routes and values, blocking,
  missing/duplicate/disabled controls, catalog validity and stability,
  Recently used exclusion, one recovery, second failure, value/target drift,
  one fill, empty timeout, stale output, exact clearing, and context closure
  after clear failure.

## Exact Next Packet

- Commit the verified Task 04 checkpoint as
  `feat(translation): add bing translate provider`, then execute
  [05 Yandex provider](05_implement_yandex_translate_provider.md).

## Blockers

- None.

## Remaining Risks

- The new Bing subclass remains intentionally unregistered until Task 06.
- No live Bing page was opened; the deterministic implementation relies on the
  reviewed 2026-07-25 public-page contract.
