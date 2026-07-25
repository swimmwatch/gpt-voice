# 03 Migrate Google Translate To The Shared Provider

## Outcome

Google Translate public-page behavior is implemented as an unregistered
`GoogleTranslateProvider` subclass. Deterministic fixtures prove exact target
routing, optional-consent rejection, one full-string insertion, stable result
handling, ambiguity failures, and clear behavior before production routing is
changed.

## Prerequisites

- Tasks 01 and 02 are complete and approved.
- Task 03 has separate execution authorization.
- The 249-entry Google metadata and common lifecycle tests pass.

## Owned Requirements

- `GOOG-001`–`GOOG-007`
- Google portion of `AC-AUTO-002`
- Provider-specific application of `ARCH-003`, `RUN-007`–`RUN-011`, and
  `SEC-005`

## In Scope

- Google subclass and public-page hook implementation.
- Google allowlisted origins, navigation, English consent handling, source and
  result locator contract, insertion, result reads, target verification, and
  clearing.
- Deterministic Google page/consent fixtures.
- Safe provider-specific error classification.

## Out Of Scope

- Registry activation, settings migration, selected-text routing, renderer UI,
  live network assertions, or deletion of the legacy Google route.
- Accept-all consent, private endpoints, source-bearing navigation, persistent
  context use, provider fallback, or post-submission replay.
- Bing, Yandex, DeepL, and language-monitor behavior.

## Task Contract

1. Add `GoogleTranslateProvider extends BaseTranslateProvider` and bind it to
   the immutable `google` metadata from Task 01. It must not restate or mutate
   the language inventory.
2. Navigate to the public translator with:
   - canonical translator origin `https://translate.google.ru`;
   - query `sl=auto`;
   - exact opaque `tl=<target code>`;
   - `op=translate`;
   - fixed page language `hl=en`.
3. Allow only top-level `https://translate.google.ru`,
   `https://translate.google.com`, and matching
   `https://consent.google.ru`/`https://consent.google.com` routes observed by
   research. Consent must return to a translator origin. Any other top-level
   origin, login wall, challenge, or ambiguous route fails closed.
4. If optional consent appears, locate exactly one visible
   `button[jsname="tWT92d"][aria-label="Reject all"]` and click it. Never click
   Accept all. Absence of the optional dialog is not an error; multiple visible
   matches are.
5. Require exactly one visible editable source control through
   `textarea[role="combobox"][aria-label="Source text"]`. The current
   `.er8xn` class may be a diagnostic cross-check only, not a stable locator.
   Hidden or duplicate active source controls are a page-contract failure.
6. Require exactly one visible
   `getByRole('region', { name: 'Translation results', exact: true })`. The
   region is already visible while empty, so attachment/visibility is not
   result readiness. Inside it:
   - collect only visible, trimmed `.ryNqvb` fragments that have no
     `[role="listitem"]` ancestor;
   - exclude all dictionary/alternative cards under `[role="listitem"]`;
   - preserve retained fragment DOM order;
   - require every retained fragment to belong to one unambiguous primary
     non-listitem result-card branch.
     Zero fragments with nonempty source remains pending until timeout; more
     than one named region or primary branch is a page-contract failure.
     Generated IDs, classes other than the researched fragment class,
     `jsname`, placeholder text, and global `.ryNqvb` queries are never
     selection inputs.
7. Before insertion, verify the active route still contains `sl=auto`,
   `op=translate`, and the exact target code. Clear stale source/result state
   and return the previous normalized result marker to the base lifecycle.
8. Insert the complete source string once through the visible textarea using
   one native value update and one bubbling input event. Do not type
   per-character and do not put the source into a navigation URL.
9. Result reads use the base two-read 500 ms stabilization rule. Target
   verification requires the exact `tl` page state both before submission and
   when accepting a result.
10. In nonempty state, require exactly one visible enabled
    `button[aria-label="Clear source text"]` and activate it. Confirm source
    value is empty, the current URL has no `text` parameter, the exact named
    result region remains present with zero visible primary fragments, and the
    clear control becomes hidden. Do not wait for region or clear-button
    detachment. Current URL clearing does not establish browser-history or
    provider-side deletion; base close-on-clear-failure still applies.
11. Use the existing bounded `BrowserNavigationService.GoogleTranslate`
    transient navigation retry. No Google hook may recover or navigate after
    insertion begins.
12. Keep the subclass unregistered. If pure helpers are extracted from
    `translation.ts` or `translationUtils.ts`, the legacy production path must
    remain behaviorally intact until Task 07 removes it.

## Contracts And Boundaries

- The provider receives only validated text and an exact target from main.
- Raw page errors and the current URL are sensitive because Google can add a
  `text` query parameter after insertion. They never enter logs, returned safe
  errors, notifications, or fixtures.
- The provider owns no persistent context or voice-provider state; the base
  owns context creation and cleanup.
- Consent handling is optional-rejection only. Challenge, login, changed
  consent, missing controls, and ambiguous active controls are typed failures.
- Fixture strings contain public labels and inert synthetic placeholders only,
  never real selected text or results.

## Expected Files Or Components

- Add `src/main/translateProviders/GoogleTranslateProvider.ts`.
- Add focused Google locator/page helpers only when they remain private to this
  provider.
- Reuse metadata from `src/shared/translationProvider.ts` and common lifecycle
  code from Task 02.
- Add `tests/main/translateProviders/GoogleTranslateProvider.test.ts` and
  sanitized in-memory fixtures or fakes beside it.
- Read the legacy files without activating the new class:
  - `src/main/services/translation.ts`;
  - `src/main/services/translationUtils.ts`;
  - `src/main/browser.ts`;
  - `tests/main/translationUtils.test.ts`.

## Acceptance Criteria

- The class extends the shared base and exposes only `google` metadata.
- Fixtures cover no-consent and reject-consent routes, matching `.com` and
  `.ru` return origins, unexpected origin, login/challenge, exact target URL
  state, exact named-region ambiguity, exclusion of listitem alternatives,
  multiple ordered primary fragments, multiple primary-branch rejection, one
  insertion, changed stable result, wrong target, empty result, clear success
  with the region retained, and clear failure.
- The 5,000-character limit and 249 targets come from shared metadata rather
  than provider-local duplication.
- Auto detection is source-only and no `auto` target can execute.
- Optional consent never accepts all.
- Source text is never placed into `goto` arguments or fixture URLs.
- No live page is opened and the production registry remains unchanged.

## Verification

Run:

```text
node --import tsx --test tests/main/translateProviders/GoogleTranslateProvider.test.ts tests/main/translationUtils.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/translateProviders/GoogleTranslateProvider.ts tests/main/translateProviders/GoogleTranslateProvider.test.ts
npx prettier --check "src/main/translateProviders/GoogleTranslateProvider.ts" "tests/main/translateProviders/GoogleTranslateProvider.test.ts"
```

Also run the Task 02 base lifecycle test to ensure the subclass did not bypass
the shared submission or cleanup gate.

## Failure And Rollback

- Missing or contradictory public control evidence blocks activation. Do not
  add a private endpoint or broad text/DOM fallback.
- Rollback removes the unregistered Google subclass and its fixtures. The
  legacy Google production flow remains available until Task 07.
- A fixture that reveals two active source/result regions must fail as a
  contract change rather than choose the first match.

## Manual Gates

- No live Google access is authorized in this packet.
- No baseline edit, dependency change, commit, push, pull request, or release
  is authorized.

## References

- Mandatory:
  - `docs/researches/translation-providers/main.md`, “Google Translate
    Baseline” and “Allowed Top-Level Origins And Redirects”;
  - Google baseline YAML extraction metadata;
  - Task 02 base hook and failure contracts;
  - current Google implementation files listed above.
- Traceability:
  - approved specification “Google” provider contract;
  - decisions `research.google-language-inventory`,
    `failure.submission-replay`, and
    `security.post-operation-cleanup`.

## Completion And Handoff

- Mark Task 03 complete in `todo.md`.
- Update `handoff.md` with exact selectors, origins, fixture cases, changed
  files, checks, and the next unchecked provider packet.
- Present deterministic evidence and stop. Do not register Google, commit, or
  begin another packet in the same invocation.
