# 09 Build The Translation Language Inventory Probe

## Outcome

A deterministic, testable no-text monitor probes the public Google, Bing, and
Yandex target-language controls in fresh nonpersistent CloakBrowser contexts,
requires complete stable hydration, normalizes reviewed code-to-label maps,
and emits sanitized added/removed/relabeled diffs with deterministic
fingerprints. It does not write GitHub issues yet.

## Prerequisites

- Task 01 is complete and approved.
- Task 09 has separate execution authorization.
- The three reviewed YAML baselines remain valid and unchanged.

## Owned Requirements

- `OPS-002`–`OPS-007`
- Probe/report portions of `OPS-009`
- Probe lifecycle portion of `OPS-012`
- Probe, extraction, hydration, diff, redaction, and baseline-immutability
  portions of `AC-AUTO-008`

## In Scope

- Baseline parser and invariant validation.
- Fixed allowlisted provider probe adapters.
- Fresh no-text CloakBrowser context lifecycle.
- Stable hydration, visibility, normalization, and ambiguity rules.
- Diff and fingerprint generation.
- Sanitized report schema and deterministic tests.
- A package script for local/manual probe execution.

## Out Of Scope

- GitHub API calls, issue creation/reopening, workflow permissions/schedule,
  baseline mutation, pull requests, live translation, source controls, source
  insertion, cookies/storage inspection, screenshots, or provider APIs.
- DeepL, authenticated state, challenge solving, or live assertions in normal
  CI/unit tests.

## Task Contract

1. Implement testable TypeScript monitor modules under `scripts/` and run the
   CLI through the existing `tsx` dev dependency. Add no package or lockfile
   dependency. Include script TypeScript in `test:types` when needed.
2. Parse baseline schema version 1 and validate provider ID, evidence date,
   declared count, unique nonblank codes, nonblank labels, and source-only
   metadata. Tolerate reviewed provider-specific optional metadata such as
   Yandex `source_behavior` without treating arbitrary fields as selectors.
3. Define a closed probe provider union exactly `google | bing | yandex`.
   DeepL and unknown IDs fail before browser launch.
4. Give each provider a fixed code adapter built from the reviewed public
   evidence:
   - Google: open `button[aria-label="More target languages"]`, require one
     visible `input[aria-label="Search languages"]`, `[role="listbox"]`, and
     `[role="group"]`, then read visible
     `[role="option"][data-language-code]` codes plus accessible names;
   - Bing: read direct
     `#tta_tgtsl > optgroup#t_tgtAllLang > option` values/trimmed labels and
     exclude sibling session-dependent Recently used groups;
   - Yandex: open the one visible
     `button[aria-label^="Choose target language"]`, require one visible
     `input[placeholder="Search languages"]`, and read visible
     `[data-lang-element="true"][data-value][role="checkbox"][aria-label]`
     code/label pairs.
5. A probe adapter exposes no source selector, insertion, typing, clipboard,
   request-body, cookie, storage, response, or account method. The live path
   must have no API capable of submitting translation text.
6. For each provider, launch a fresh nonpersistent context with:
   - headless mode;
   - fixed `en-US` locale and UTC timezone;
   - careful humanization and a fixed non-secret numeric fingerprint;
   - `CLOAKBROWSER_AUTO_UPDATE=false`;
   - no user-data directory or authenticated profile.
     Close the page/context in `finally` on success, drift, challenge, timeout,
     or exception.
7. Navigate only to the reviewed public translator origins and handle only
   reviewed public consent:
   - Google translator/consent `.com` or `.ru`, Reject all;
   - Bing `https://www.bing.com/translator`, no consent assumed;
   - Yandex `https://translate.yandex.com`, Allow essential cookies.
     Unexpected origin, login, CAPTCHA, challenge, or ambiguous consent fails the
     probe.
8. A successful extraction requires:
   - exactly one active target chooser, or Bing's one visible/enabled native
     target select and canonical all-language group;
   - no active loading/challenge state;
   - unambiguous required public attributes;
   - a nonempty normalized map;
   - two identical order-independent normalized reads one second apart;
   - completion within a 30-second hydration deadline and a 60-second total
     provider timeout.
9. Prove count-independent completion with the provider's researched public
   structure before baseline comparison:
   - Google requires exactly one visible search input, listbox, and option
     group using the selectors in item 4; nonblank unique option codes/labels;
     keyboard `End` traversal from the first option to the current terminal
     option and `Home` back to the first without selection; terminal
     visibility; `document.readyState` complete; no visible
     busy/progress/challenge state; and no relevant option-tree mutation across
     the two reads.
   - Bing requires one visible/enabled target select, one direct
     `optgroup#t_tgtAllLang`, and a nonempty direct-option sequence with
     enabled, nonblank, unique values and labels. The ordered code/label
     signature must remain identical across the two reads. Recently used
     sibling groups and total select option count are ignored.
   - Yandex requires exactly one visible target opener and search input using
     the selectors in item 4, one nonempty visible option set with nonblank
     unique codes/labels, no visible busy/progress/challenge state, and an
     identical canonical signature across the two reads. Do not wait on
     `aria-expanded`, which the public opener does not expose.
10. Do not require equality with the baseline, a hardcoded count, a minimum
    count, or named language anchors to establish completeness; a real
    addition/removal must reach normal drift comparison. Empty, structurally
    incomplete, actively loading, unstable, or ambiguous controls are probe
    failures, not drift. Independently enforce defensive public-metadata
    ceilings of 2,000 active options, 128 Unicode code points per code, and 256
    Unicode code points per label; overflow or control/newline characters are
    a page-contract probe failure rather than issue content.
11. Normalize by exact code:
    - preserve code case and exact label text;
    - ignore DOM order, hidden/inactive chooser copies, source-only automatic
      detection, Bing Recently used entries, and exact identical duplicates;
    - treat one code with conflicting labels in the same stable read as an
      ambiguity failure.
12. Compare normalized maps into sorted public records:
    - `added`: code and live label;
    - `removed`: code and baseline label;
    - `relabeled`: code, baseline label, and live label.
13. Compute a SHA-256 fingerprint over canonical sorted JSON containing only
    provider ID and the three normalized diff groups. Order, run ID, URL, and
    timestamps do not affect it.
14. Write an explicitly selected report path, defaulting to a temporary
    location rather than the repository. The schema contains only provider ID,
    baseline date, `no-drift | drift | probe-failure`, public diff/fingerprint
    for drift, or a fixed safe failure code.
15. Never put raw exceptions, DOM, screenshots, full URLs, cookies, storage,
    request/response data, source/result text, or credentials into stdout,
    stderr, reports, fixtures, or filenames. Safe console output is limited to
    provider ID and fixed outcome.
16. Continue probing remaining providers after one provider fails, guarantee
    closure for each, write the sanitized aggregate report, and exit nonzero
    when any probe failed. Confirmed drift is a successful probe and does not
    itself make the probe command fail.
17. Read baselines only. Tests compare file bytes before and after probe/diff
    execution and fail on mutation.

## Contracts And Boundaries

- The live CLI is an operator tool, not production app code, and never enters
  the packaged runtime.
- Public language codes/labels are non-sensitive; page structure, navigation
  details, raw failures, and all browser/session data remain private.
- Probe failure and language drift are distinct typed outcomes. A challenge or
  selector failure never fabricates additions/removals.
- The report is the only integration contract consumed by Task 10.
- Deterministic tests use injected pages/clock/context and public language
  fixtures only; they never launch a browser.

## Expected Files Or Components

- Add, with equivalent focused naming allowed:
  - `scripts/translation-language-monitor-core.ts`;
  - `scripts/translation-language-monitor.ts`;
  - `tests/scripts/translationLanguageMonitor.test.ts`.
- Update:
  - `package.json` with a `monitor:translation-languages` command;
  - `tsconfig.test.json` if script TypeScript is not already covered.
- Read without modifying the three YAML baselines.
- Reuse the direct CloakBrowser ESM launch/preparation pattern from
  `scripts/smoke-cloakbrowser.mjs`; do not import Electron main-process state
  into the standalone monitor.

## Acceptance Criteria

- Baseline tests validate exact 249/179/118 counts and schema invariants.
- Extraction fixtures cover each provider, exact code preservation, hidden
  chooser copies, identical/conflicting duplicates, Bing recent groups,
  source-only exclusions, and order independence.
- Hydration tests cover immediate complete, delayed partial-to-complete, empty,
  partial stable with active loading, unstable, ambiguous, challenge, origin,
  and timeout states. Provider cases also cover Google terminal
  `End`/`Home` traversal and mutation quietness, Bing canonical-group
  stability with changing Recently used siblings, and Yandex's visible search
  plus stable map without relying on `aria-expanded`.
- Tests prove fixed counts, minimum counts, and named language anchors are not
  hydration gates: a stable structurally complete removal reaches drift
  comparison, while incomplete or actively loading maps remain probe failures.
- Diff tests cover no change, additions, removals, relabels, combinations, and
  deterministic fingerprints.
- Reports contain only the allowlisted schema; injected raw errors/URLs/DOM/
  secrets never appear.
- Oversized inventories/fields and control/newline-bearing public metadata
  fail the probe and never enter a drift report.
- Probe failure exits nonzero after the report; drift remains successful.
- Every context closes in every outcome and baseline bytes remain unchanged.
- No fixture or normal unit test launches CloakBrowser or accesses a provider.

## Verification

Run:

```text
node --import tsx --test tests/scripts/translationLanguageMonitor.test.ts
npm run test:types
npm run lint
npm run format:check
```

Run `npm test` if shared baseline helpers or package scripts affect broader test
discovery. Do not run the live monitor in this packet.

## Failure And Rollback

- A stable-map algorithm that can mistake loading/ambiguous state for drift, a
  report containing raw browser data, or any baseline write blocks the packet.
- Rollback removes the monitor modules/package command and restores any test
  TypeScript include. Runtime provider code remains unaffected.
- If a public selector has changed, keep deterministic code fail-closed and
  return to sanitized research; do not update the baseline from the failed
  probe.

## Manual Gates

- Live `monitor:translation-languages` execution, CloakBrowser preparation,
  and provider network access require separate authorization and are deferred
  to Task 10 or Task 11.
- No GitHub token, issue write, baseline edit, commit, push, pull request, or
  release is authorized.

## References

- Mandatory:
  - three provider baseline YAML files and their extraction metadata;
  - `docs/researches/translation-providers/main.md`, shared sanitized procedure,
    provider findings, and allowed origins;
  - `scripts/smoke-cloakbrowser.mjs`;
  - current workflow Node/CloakBrowser conventions.
- Traceability:
  - approved specification “Scheduled Language Monitor” `OPS-002`–`OPS-007`
    and `OPS-012`;
  - decisions `operations.language-monitor-scope`,
    `operations.language-monitor-evidence`,
    `operations.language-change-reporting`, and
    `operations.inventory-diff-semantics`.

## Completion And Handoff

- Mark Task 09 complete in `todo.md`.
- Update `handoff.md` with report schema, timeouts, adapter rules, fingerprint
  canonicalization, changed files, checks, and Task 10 as next.
- Present deterministic probe evidence and stop. Do not run live probes,
  reconcile issues, commit, or begin Task 10 in the same invocation.
