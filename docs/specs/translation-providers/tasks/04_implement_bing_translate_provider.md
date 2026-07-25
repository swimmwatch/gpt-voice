# 04 Implement The Bing Translate Provider

## Outcome

An unregistered `BingTranslateProvider` implements the researched public Bing
Translator contract with exact native language values, automatic source
detection, one contenteditable fill, bounded pre-submission recovery, stable
target-consistent results, and confirmed clearing.

## Prerequisites

- Tasks 01 and 02 are complete and approved.
- Task 04 has separate execution authorization.
- The 179-entry Bing metadata and common lifecycle tests pass.

## Owned Requirements

- `BING-001`–`BING-007`
- Bing portion of `AC-AUTO-002`
- Provider-specific application of `ARCH-003`, `RUN-005`–`RUN-011`, and
  `SEC-005`

## In Scope

- Bing subclass and public-page hooks.
- Exact select values, visible source/result controls, result verification,
  clear behavior, and one pre-submit inert/readiness recovery classification.
- Deterministic Bing fixtures for healthy, partial, changed, and blocking page
  states.

## Out Of Scope

- Registry activation, settings, selected-text routing, UI, live provider
  assertions, issue monitoring, or changes to Google/Yandex.
- Recently-used inventory entries, source-only auto detection as a target,
  private endpoints, script-console diagnostics, challenge bypass, or replay
  after source fill.

## Task Contract

1. Add `BingTranslateProvider extends BaseTranslateProvider` bound to shared
   `bing` metadata.
2. Navigate only to `https://www.bing.com/translator`. Any other top-level
   origin, login wall, consent/challenge overlay, or navigation ambiguity fails
   closed.
3. Require exactly one visible/enabled instance of each researched public
   control:
   - source language
     `select#tta_srcsl[aria-label="Input Language Selection Dropdown"]`;
   - target language
     `select#tta_tgtsl[aria-label="Output Language Selection Dropdown"]`;
   - source contenteditable
     `div#tta_input_ta[role="textbox"][aria-label="Input text area"][contenteditable="true"]`;
   - result control `div#tta_output_ta[data-placeholder="Translation"]`.
4. Before submission, select exact source value `auto-detect`, select the exact
   target provider code, read both native select values back, and require the
   result control's public `lang` attribute to equal that same target. The
   target select is authoritative; `lang` is corroboration and is never
   freshness evidence because it persists after clearing. Reject labels,
   indices, or approximate matching. Dynamic Recently used duplicates never
   influence runtime validation.
5. Use a positive pre-submission readiness gate: the allowlisted origin/path,
   all four visible/enabled controls in item 3, an empty editable source, and a
   stable canonical target catalog under
   `#tta_tgtsl > optgroup#t_tgtAllLang > option`. The canonical group must be
   nonempty, every direct option must be enabled with a nonblank unique value
   and trimmed label, and two normalized signatures 250 ms apart must agree
   within the bounded readiness wait. Do not use a hardcoded count, named
   language anchors, diagnostic scripts, or the session-dependent sibling
   `Recently used` group as readiness.
6. Bing exposes no dedicated trustworthy public inert/loading marker.
   Classify a bounded failure of the positive gate as the one allowed clean
   pre-submission recovery. The base may recreate/reload once while the source
   is still empty and must rerun the entire gate. A second failure, an
   unexpected origin, or a blocking dialog/challenge fails closed. Bing's
   nonmodal `div.infobubble` help surface is not a blocking dialog. If controls
   were ready and a later result times out, the operation is terminal and must
   not replay the submitted source.
7. Remove stale state before submission and capture the normalized prior
   output marker. Visible counters and diagnostic-script nodes are neither
   readiness nor failure signals.
8. Insert the complete source exactly once in one page evaluation on the
   visible contenteditable: dispatch one bubbling `beforeinput`, assign
   `textContent` once, then dispatch one bubbling `input`. Do not type
   per-character, navigate with text, or dispatch a second insertion.
9. Read only the visible public output control. A valid result is nonempty,
   differs from the prior marker, passes the base two-read 500 ms stability
   rule, retains the exact requested target-select value, and retains the
   matching output `lang` value. Exact `...` and `…` loading sentinels are
   treated as empty reads and remain under the base timeout policy.
10. Locate exactly one visible
    `#tta_clear[role="button"][aria-label="Click to Clear"]`, activate it once,
    and confirm:
    - source and result are empty;
    - source value returned to `auto-detect`;
    - wrapper `#tta_clear_cnt` is hidden;
    - the requested target select value is preserved;
    - focus returned to the source editor.
      The output `lang` attribute may remain equal to the target after clear
      and therefore is not a stale-result signal. Ambiguous or ineffective
      clearing delegates to the base close-on-clear-failure gate.
11. The 1,000-character limit is read from shared metadata and enforced by the
    base before context creation. Do not use the page counter as the guard.
12. Keep the provider unregistered until Task 06.

## Contracts And Boundaries

- Only public controls are used. Internal translation requests, script
  diagnostics, cookies, storage, and network bodies are not inspected.
- Browser console failures observed in research do not become translation
  failures unless a required public control/result contract fails.
- Raw errors, current URL, page text, source, and result never cross the safe
  failure/log boundary.
- Recovery is strictly pre-submission. The first insertion permanently
  disables automatic reload/recreation for that operation.
- Fixture values are inert and sanitized; no live network is used.

## Expected Files Or Components

- Add `src/main/translateProviders/BingTranslateProvider.ts`.
- Add private Bing locator helpers only when needed.
- Add `tests/main/translateProviders/BingTranslateProvider.test.ts` with
  deterministic page/select/contenteditable fakes or sanitized fixtures.
- Reuse Task 01 metadata and Task 02 lifecycle; do not add a Bing-specific
  registry yet.

## Acceptance Criteria

- The class extends the base, uses `bing` metadata, and has no local language
  allowlist.
- Tests cover exact `auto-detect`, exact target values including current
  `en`/`ru`/`uk`/`be`, missing and duplicate controls, a target that does not
  stick, canonical-group stability, exclusion of Recently used entries, one
  successful pre-submit recovery, a second readiness failure, one fill, stable
  changed output, mandatory target/output-language agreement, wrong target,
  result timeout with zero replay, exact clear-state confirmation, and clear
  failure.
- Source-only and Recently used values cannot execute as targets.
- The 1,000-character guard occurs before context creation.
- Script-console failures alone do not fail an otherwise valid fixture.
- No live page opens and the registry remains unchanged.

## Verification

Run:

```text
node --import tsx --test tests/main/translateProviders/BingTranslateProvider.test.ts tests/main/translateProviders/BaseTranslateProvider.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/translateProviders/BingTranslateProvider.ts tests/main/translateProviders/BingTranslateProvider.test.ts
npx prettier --check "src/main/translateProviders/BingTranslateProvider.ts" "tests/main/translateProviders/BingTranslateProvider.test.ts"
```

## Failure And Rollback

- If exact public target or output verification cannot be represented without
  private page state, stop and return to sanitized research/specification.
- Rollback removes the unregistered Bing class and fixtures only.
- A post-fill timeout must remain a terminal test case; do not make it pass by
  reloading or refilling.

## Manual Gates

- No live Bing access or issue creation is authorized in this packet.
- No dependency, baseline, commit, push, pull request, or release change is
  authorized.

## References

- Mandatory:
  - `docs/researches/translation-providers/main.md`, “Bing Translator” and
    “Allowed Top-Level Origins And Redirects”;
  - Bing baseline extraction metadata;
  - Task 02 lifecycle and recovery tests.
- Traceability:
  - approved specification “Bing” provider contract;
  - decisions `research.bing-live-2026-07-25`,
    `research.bing-language-inventory`, and
    `failure.submission-replay`.

## Completion And Handoff

- Mark Task 04 complete in `todo.md`.
- Update `handoff.md` with exact controls, recovery boundary, fixture coverage,
  changed files, checks, and the next unchecked provider packet.
- Present deterministic evidence and stop. Do not register Bing, commit, or
  begin another packet in the same invocation.
