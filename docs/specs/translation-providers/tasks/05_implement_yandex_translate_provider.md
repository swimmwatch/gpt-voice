# 05 Implement The Yandex Translate Provider

## Outcome

An unregistered `YandexTranslateProvider` implements exact visible-chooser
target selection, essential-only consent, automatic source detection, one
full-string contenteditable update, stable target-consistent output, and
clear-or-close behavior while preserving the explicitly accepted retention
risk.

## Prerequisites

- Tasks 01 and 02 are complete and approved.
- Task 05 has separate execution authorization.
- The 118-entry Yandex metadata and common lifecycle tests pass.

## Owned Requirements

- `YNDX-001`–`YNDX-008`
- `SEC-007`
- Yandex portion of `AC-AUTO-002`
- Provider-specific application of `ARCH-003`, `RUN-006`–`RUN-013`, and
  `SEC-005`

## In Scope

- Yandex subclass and public-page hooks.
- English-route normalization, essential consent, auto-detect switch, exact
  visible target selection, source insertion, result reads, and clearing.
- Inventory-driven exact-code fixtures for all 118 targets.
- Sanitized failure tests for hidden controls, ambiguity, challenges, target
  changes, and cleanup failure.

## Out Of Scope

- Registry activation, settings, selected-text routing, UI, monitor code, live
  assertions, provider History deletion, or provider-side retention claims.
- Source-bearing runtime navigation, hidden `#textarea`, direct Playwright
  `fill()`, per-character typing, label-based target selection, target
  correction after submission, Accept all consent, or challenge bypass.
- A Yandex-specific warning, opt-in, badge, or special documentation branch.

## Task Contract

1. Add `YandexTranslateProvider extends BaseTranslateProvider` bound to shared
   `yandex` metadata.
2. Start at `https://translate.yandex.com/en/translator` and permit its
   researched normalization to the English `/en/` route. Only
   `https://translate.yandex.com` may remain top-level; any other origin,
   login, challenge, or ambiguous overlay fails closed.
3. If consent appears, require exactly one visible button with accessible name
   `Allow essential cookies` and activate it. Never choose Allow all.
4. Before target selection, enable automatic source detection through the
   exactly one visible `Auto detect` label containing
   `input[type="checkbox"][role="switch"]` when unchecked. Scope through the
   visible label because the switch itself has no useful accessible label. If
   the source chooser is opened to establish state, require one visible
   `button[aria-label^="Choose source language"]` and close it before opening
   the target chooser.
5. Require exactly one visible target opener matching
   `button[aria-label^="Choose target language"]`. Inside its visible chooser,
   select exactly one
   `[data-lang-element="true"][data-value][role="checkbox"][aria-label]:visible`
   whose `data-value` equals the requested opaque code. Never match the
   localized `aria-label`.
6. Read the selected target code back from public page state before insertion
   and again when accepting a result. Do not correct a target after source
   insertion; a changed code is terminal.
7. Resolve exactly one visible source editor through the revalidated layered
   contract. The current primary is
   `#fakeArea[role="textbox"][contenteditable="plaintext-only"]`; the earlier
   visible `[role="textbox"][aria-labelledby="srcLabel"]` semantic may be a
   documented fallback only when exactly one active editor exists. The hidden
   or disabled `textarea#textarea` is always forbidden.
8. Resolve exactly one destination editor in the single active translation
   panel through the current
   `[data-tracking-data*="box-dst"] [data-lexical-editor="true"][role="textbox"]`
   contract. The destination is present but hidden while empty and becomes
   visible when a result arrives; pre-submission code may read that uniquely
   scoped hidden-empty editor, but result acceptance requires the same editor
   to be visible and nonempty. The earlier `#translation` semantic may be a
   documented fallback only when it identifies that same single active
   destination. Hidden source or target inventory copies are excluded.
9. Clear stale source/result state and record the prior normalized destination
   before submission.
10. Insert the complete source once by running one page evaluation that:
    - dispatches one bubbling `beforeinput` with `inputType: 'insertText'`;
    - assigns the visible editor's `textContent` once;
    - dispatches one matching bubbling `input`.
      It must not call `fill`, type characters, navigate with source text, or
      dispatch a second update.
11. Read only the visible destination. Accept it only when nonblank, changed,
    identical across the base two reads 500 ms apart, and still associated with
    the exact requested target. Console, telemetry, and character counters are
    not readiness or failure signals.
12. Use exactly one visible public `button[aria-label="Clear"]` when present
    and confirm the source is empty, the destination is empty and hidden, and
    the top-level URL no longer has a `text` parameter while preserving the
    source/target language state. This confirmation is local cleanup only. If
    it cannot be confirmed, rely on base context close before success.
13. The 10,000-character limit comes from shared metadata and is enforced
    before context creation.
14. Keep the provider unregistered until Task 06. Do not add a special Yandex
    notice anywhere.

## Contracts And Boundaries

- The approved product accepts that Yandex may place plaintext in URL/history,
  telemetry, local provider History, and unknown provider-side retention after
  the one allowed insertion. This is not permission to log, persist, replay,
  or disclose that text.
- Current URL, raw page errors, DOM, source/result text, cookies, storage,
  telemetry, and provider History never cross the safe boundary.
- Visible clearing and context closure remove only GPT-Voice's local access;
  tests and messages must not claim provider-side deletion.
- All target matching is exact `data-value` equality. Provider labels are
  inventory/display metadata only.
- No fixture or deterministic test contacts Yandex.

## Expected Files Or Components

- Add `src/main/translateProviders/YandexTranslateProvider.ts`.
- Add private Yandex locator/evaluation helpers only when needed.
- Add `tests/main/translateProviders/YandexTranslateProvider.test.ts` with
  sanitized in-memory fixtures or fakes and an inventory-driven table for all
  118 target codes.
- Reuse Task 01 metadata and Task 02 lifecycle; do not add registry metadata or
  UI warnings.

## Acceptance Criteria

- The class extends the shared base and uses only shared `yandex` metadata.
- Fixtures cover route normalization, no-consent and essential-consent states,
  wrong origin/challenge, auto-detect enablement, exact target selection and
  verification, hidden duplicate chooser exclusion, one uniquely scoped
  hidden-empty destination becoming visible, source/result ambiguity,
  forbidden hidden textarea, one exact event sequence, stable changed output,
  target mutation, empty/timeout result, URL-safe clear confirmation, and close
  fallback.
- Every one of the 118 target codes resolves by exact `data-value`, including
  `pt-BR`, `sr-Latn`, `kazlat`, and `uzbcyr`; no test selects by label.
- The provider performs one source update and zero source-bearing navigation or
  post-submit target changes.
- The 10,000-character guard happens before context creation.
- No Yandex-specific warning or runtime registration is added.

## Verification

Run:

```text
node --import tsx --test tests/main/translateProviders/YandexTranslateProvider.test.ts tests/main/translateProviders/BaseTranslateProvider.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/translateProviders/YandexTranslateProvider.ts tests/main/translateProviders/YandexTranslateProvider.test.ts
npx prettier --check "src/main/translateProviders/YandexTranslateProvider.ts" "tests/main/translateProviders/YandexTranslateProvider.test.ts"
```

Inspect fixture and captured log values for source/result text, full URLs, DOM,
cookies, storage, or telemetry identifiers.

## Failure And Rollback

- If a requested code cannot be selected and verified before insertion through
  public exact values, stop; do not navigate with text or correct the target
  afterward.
- Rollback removes the unregistered Yandex class and fixtures only.
- Any clear-or-close failure remains terminal and cannot be downgraded to
  best-effort success.

## Manual Gates

- No live Yandex access, provider-History manipulation, or issue creation is
  authorized in this packet.
- No dependency, baseline, warning/opt-in, commit, push, pull request, or
  release change is authorized.

## References

- Mandatory:
  - `docs/researches/translation-providers/main.md`, “Yandex Translate” and
    “Allowed Top-Level Origins And Redirects”;
  - Yandex baseline extraction metadata;
  - Task 02 lifecycle, submission, and cleanup contracts.
- Traceability:
  - approved specification “Yandex” provider contract;
  - decisions `research.yandex-live-2026-07-25`,
    `research.yandex-language-inventory`,
    `rollout.yandex`, and `security.yandex-disclosure`.

## Completion And Handoff

- Mark Task 05 complete in `todo.md`.
- Update `handoff.md` with exact selectors/event sequence, all-code fixture
  coverage, changed files, checks, and Task 06 as the next packet after all
  providers pass.
- Present deterministic evidence and stop. Do not register Yandex, commit, or
  begin Task 06 in the same invocation.
