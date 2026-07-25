# Handoff: Translation Providers Task 03 Complete

Status: Task 01 is committed at `e0d13bfa`, and Task 02 is committed at
`1be624c6`. Task 03 is implemented, verified, and authorized for a scoped
commit. Task 04 is authorized but has not started; Tasks 05–11 are not
authorized.

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

## Google Public Controls

- Source: `textarea[role="combobox"][aria-label="Source text"]`, exactly one
  visible editable control.
- Result: exactly one visible `Translation results` region; visible `.ryNqvb`
  fragments outside `[role="listitem"]` must share one top-level branch.
- Consent:
  `button[jsname="tWT92d"][aria-label="Reject all"]`, exactly one visible
  control on matching `consent.google.ru` or `consent.google.com`.
- Clear: `button[aria-label="Clear source text"]`, exactly one visible enabled
  control in nonempty state and hidden after confirmed clearing.
- Allowed translator origins are `translate.google.ru` and
  `translate.google.com`; login, challenge, unexpected, and cross-family
  routes fail closed.

## Changed Files

- Added `src/main/translateProviders/GoogleTranslateProvider.ts`.
- Added `tests/main/translateProviders/GoogleTranslateProvider.test.ts`.
- Updated `tasks/todo.md` and this handoff.
- Preserved the unrelated uncommitted
  `.agents/references/specification-interview.md` edit.

## Checks

- `node --import tsx --test tests/main/translateProviders/GoogleTranslateProvider.test.ts tests/main/translationUtils.test.ts tests/main/translateProviders/BaseTranslateProvider.test.ts`
  passed.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npx eslint src/main/translateProviders/GoogleTranslateProvider.ts tests/main/translateProviders/GoogleTranslateProvider.test.ts`
  passed.
- `npx prettier --check "src/main/translateProviders/GoogleTranslateProvider.ts" "tests/main/translateProviders/GoogleTranslateProvider.test.ts"`
  passed.
- Static inspection found no registry or legacy-path import of the new class.
- Fixtures cover `.ru`/`.com` no-consent and reject-consent flows, missing,
  ambiguous, cross-family, unexpected, login/challenge, source/region
  ambiguity, listitem exclusion, ordered fragments, branch ambiguity, wrong
  target, empty timeout, stale clearing, retained-region cleanup, and context
  closure after clear failure.

## Exact Next Packet

- Review Task 03. The next ordered packet is
  [04 Bing provider](04_implement_bing_translate_provider.md), and its
  execution is authorized after the Task 03 commit.

## Blockers

- None for Task 04. Tasks 05–11 have no execution authorization.

## Remaining Risks

- The new Google subclass remains intentionally unregistered; production uses
  the legacy Google path until Task 07.
- No live Google page was opened, so the 2026-07-25 researched controls still
  require their later manual canary before activation.
