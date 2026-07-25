# Handoff: Translation Providers Task 02 Complete

Status: Task 01 was committed as the green foundation at `e0d13bfa`. Task 02
is implemented and verified, and its scoped commit is authorized after the
target-aware navigation seam check. Task 03 is authorized but has not started;
Tasks 04–11 are not authorized.

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

## Lifecycle State Machine

- Validate canonical provider, exact target, nonblank source, and length before
  touching a browser.
- Lazily create or reuse one provider-owned page; prepare it in one pass or one
  explicitly recoverable clean second pass.
- Begin the irreversible submission phase immediately before the single
  full-string insertion hook; never recreate, navigate, or replay afterward.
- Accept only a nonblank new result that matches across two reads 500 ms apart
  and still passes target verification.
- Return success only after confirmed visible clearing or confirmed context
  closure. Retain failed resources for a later shutdown retry.
- Discard cancelled, superseded, shutdown, or otherwise stale generations
  without exposing source/result data.

## Changed Files

- Added `src/main/translateProviders/BaseTranslateProvider.ts` and
  `translationProviderContracts.ts`.
- Updated `src/main/cloakBrowserLaunchOptions.ts` and
  `src/main/browserNavigationRetry.ts`.
- Added `tests/main/translateProviders/BaseTranslateProvider.test.ts`.
- Updated the focused launch-option and navigation-retry tests.
- Updated `tasks/todo.md` and this handoff.
- Preserved the unrelated uncommitted
  `.agents/references/specification-interview.md` edit.

## Checks

- `node --import tsx --test tests/main/translateProviders/BaseTranslateProvider.test.ts tests/main/cloakBrowserLaunchOptions.test.ts tests/main/browserNavigationRetry.test.ts`
  passed.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npx eslint src/main/translateProviders src/main/cloakBrowserLaunchOptions.ts src/main/browserNavigationRetry.ts tests/main/translateProviders tests/main/cloakBrowserLaunchOptions.test.ts tests/main/browserNavigationRetry.test.ts`
  passed.
- `npx prettier --check "src/main/translateProviders/**/*.ts" "src/main/cloakBrowserLaunchOptions.ts" "src/main/browserNavigationRetry.ts" "tests/main/translateProviders/**/*.ts" "tests/main/cloakBrowserLaunchOptions.test.ts" "tests/main/browserNavigationRetry.test.ts"`
  passed.
- Static inspection found no provider-specific selectors or origins in the
  base and no persistent translation launch path.

## Exact Next Packet

- Pass the validated target into the base navigation hook, rerun Task 02
  checks, create the authorized Task 02 commit, then execute
  [03 Google provider](03_migrate_google_translate_provider.md).

## Blockers

- None for Task 03. Tasks 04–11 have no execution authorization.

## Remaining Risks

- No real provider subclass is implemented or registered yet; production
  Google translation remains on the legacy path.
- Live provider behavior and selectors remain intentionally untested until
  their provider packets.
