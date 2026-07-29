# Translation Provider Browser Research

Status: Google, Bing, and Yandex have executable public-page evidence. The
2026-07-25 specification interview explicitly accepted enabling Yandex despite
its source-bearing URL, telemetry, and provider-history surfaces. DeepL remains
blocked by its connection-security challenge and is deferred from the current
implementation, UI, and monitor.

Evidence dates: 2026-07-21 and 2026-07-25

Research environment:

- CloakBrowser MCP bridges `1.8.0` and `1.9.0`
- CloakBrowser `146.0.7680.177.5`
- Linux
- anonymous public translator pages

## Scope And Data Handling

This research establishes browser-page behavior needed to specify Google, Bing,
Yandex, and DeepL translation providers. It uses synthetic inert text only.

The record retains public control names, language codes, character limits,
booleans, counts, result-length metadata, and safe failure classifications. It
does not retain source text, translated text, response bodies, raw browser
events, screenshots, source-bearing URLs, cookies, identifiers, credentials,
sessions, or browser profiles.

No authentication was used. No attempt was made to defeat a challenge, trigger
a rate limit, inspect private endpoints, or derive an undocumented API.

## Shared Sanitized Procedure

For each provider:

1. Open the public translator in CloakBrowser.
2. Reject optional consent where a visible control permits it.
3. Confirm automatic source detection and the proven target-language set.
4. Use a short synthetic sample and retain only source/result lengths,
   completion/stability booleans, target-match booleans, and timing ranges.
5. Attempt best-effort DOM clearing and record whether stale output disappears.
   Never treat visible clearing as authoritative privacy cleanup.
6. Record whether the page places source text in the current URL or restores it
   through browser history.
7. Stop on a security challenge and do not bypass it or issue repeated content
   requests to that challenged provider. Classify other incompatible page
   states before any bounded diagnostic revalidation.
8. Close every research tab after inspection.

The first Google, Bing, and Yandex samples were 24 characters and each produced
one nonempty result of 23 characters. A second Bing/Yandex check used a
15-character public reference. Later Yandex revalidation used five
24-character inert samples: three rejected a direct URL route, and two proved
visible-editor input after pre-submission language selection. The record
retains no source or result value.

## 2026-07-25 Revalidation

Fresh CloakBrowser MCP checks used new synthetic samples and retained only
sanitized behavior and metadata.

- Bing completed two anonymous translations. Its native source and target
  selectors still exposed `en`, `ru`, `uk`, and `be`; automatic detection used
  `auto-detect`; replacement produced a different stable result; and its clear
  control removed source and result state. No source-bearing top-level URL or
  Back entry was observed. Cookies, local storage, telemetry, and the earlier
  inert-first-load observation still require an isolated context and bounded
  readiness checks.
- Yandex completed anonymous translations with automatic detection. A
  full-string Playwright fill succeeded in this run, which differs from the
  earlier failed-fill observation. This establishes page volatility, not a
  permanent locator or event contract. The run reconfirmed plaintext source in
  the top-level URL and browser history and also observed translation data
  entering provider telemetry and local history/settings surfaces after
  essential-cookie consent. No source or result value is retained here.
- DeepL again presented a connection-security overlay backed by
  `clearance.deepl.com`; it persisted through one bounded wait and intercepted
  translator interaction. Candidate controls could be inspected structurally,
  but no successful source insertion, translation, executable language
  mapping, result extraction, clear flow, or input limit was established.
  Diagnostic DOM-only inspection after locally suppressing the overlay is not
  accepted as executable provider evidence.

These checks established Bing's bounded readiness contract. Yandex rollout is
governed by the later explicit acceptance recorded in the specification
decision ledger. DeepL remains fail-closed.

## Public Target-Language Baselines

A second 2026-07-25 CloakBrowser pass submitted no text and retained only
public target-language codes, labels, counts, and extraction rules:

- [Google baseline](baselines/google-2026-07-25.yaml): 249 unique targets; the
  source chooser adds only `auto` / `Detect language`.
- [Bing baseline](baselines/bing-2026-07-25.yaml): 179 unique targets; the
  source chooser adds only `auto-detect` / `Auto-detect`. A session-dependent
  Recently used group duplicated English and is excluded from the normalized
  target inventory.
- [Yandex baseline](baselines/yandex-2026-07-25.yaml): 118 unique targets; the
  source and target maps are identical, while automatic detection is a
  separate switch.

The baselines preserve provider codes and English public labels as fallback
metadata. They exclude source-only automatic detection, hidden or inactive
chooser copies, duplicate recent entries, and DOM order. Provider-specific and
legacy identifiers remain opaque runtime values; callers must not rewrite them
from ISO assumptions.

## 2026-07-25 Count-Independent Contract Revalidation

A final planning pass rechecked public controls and completion rules without
using the reviewed baseline counts as readiness assertions. All tabs were
closed, no private endpoint or browser storage was inspected, and no source or
result value was retained.

- Google target inventory:
  - opener `button[aria-label="More target languages"]`;
  - exactly one visible `input[aria-label="Search languages"]`,
    `[role="listbox"]`, and `[role="group"]`;
  - visible `[role="option"][data-language-code]` entries with accessible
    labels;
  - keyboard `End` moved from the first option to the current terminal option
    and made it fully visible without selecting it; `Home` returned to the
    first;
  - two normalized reads 1.2 seconds apart were identical with no relevant
    option-tree mutations, busy/progress state, or challenge.
    Google exposes no explicit loaded sentinel or `aria-setsize`, so
    traversal, structural validity, mutation quietness, and stable reads form
    the completion contract.
- Bing runtime and target inventory:
  - source/target selects
    `#tta_srcsl[aria-label="Input Language Selection Dropdown"]` and
    `#tta_tgtsl[aria-label="Output Language Selection Dropdown"]`;
  - contenteditable source `#tta_input_ta[aria-label="Input text area"]` and
    public result `#tta_output_ta[data-placeholder="Translation"]`;
  - canonical targets are only direct options under
    `#tta_tgtsl > optgroup#t_tgtAllLang`; session-dependent Recently used
    sibling groups are excluded;
  - the target select value is authoritative and the result control's `lang`
    attribute corroborates it, but `lang` persists after clear and is not
    freshness evidence;
  - `#tta_clear[aria-label="Click to Clear"]` emptied source/result, restored
    source auto-detection, preserved the target, hid `#tta_clear_cnt`, and
    returned focus to the source;
  - the canonical option signature stabilized across bounded reads. Bing has
    no trustworthy public inert/loading marker, so failure of the complete
    positive pre-input gate permits only one clean pre-submission recovery.
- Yandex runtime and target inventory:
  - current source editor
    `#fakeArea[role="textbox"][contenteditable="plaintext-only"]`; hidden
    `textarea#textarea` remains forbidden;
  - current destination
    `[data-tracking-data*="box-dst"] [data-lexical-editor="true"][role="textbox"]`
    is attached but hidden while empty and becomes visible with a result;
  - automatic detection is the exactly one visible `Auto detect` label's
    `input[type="checkbox"][role="switch"]`;
  - the target chooser exposes one visible
    `input[placeholder="Search languages"]` and exact
    `[data-lang-element="true"][data-value][role="checkbox"][aria-label]`
    options; the opener has no useful `aria-expanded`;
  - two one-second normalized option reads were identical with no active
    busy/progress/challenge state;
  - `button[aria-label="Clear"]` emptied and hid the editors and removed the
    current `text` parameter while retaining language state. This does not
    establish history or provider-side deletion.

The observed maps still happened to contain 249, 179, and 118 targets, but
those values are comparison baselines only. A stable structurally complete
addition or removal must become drift; incomplete, unstable, ambiguous, or
actively loading controls must become probe failure.

## Google Translate Baseline

Google is the current application provider and was rechecked as a comparison
baseline.

### Observed

- The anonymous page was available after optional consent was rejected.
- Automatic source detection was selected.
- The current application targets `en`, `ru`, `uk`, and `be` remain available.
- The unique visible source control was
  `textarea[role="combobox"][aria-label="Source text"]`; its current
  `.er8xn` class is diagnostic rather than a stable primary locator.
- Exactly one visible region had accessible name `Translation results`. It was
  already present while empty. After the inert probe, all visible `.ryNqvb`
  fragments were inside it, but dictionary/alternative results were separate
  `[role="listitem"]` cards. The primary result was the visible non-listitem
  fragment branch; global or merely region-scoped `.ryNqvb` concatenation
  would have mixed one primary result with 15 alternatives.
- Nonempty state exposed exactly one visible
  `button[aria-label="Clear source text"]`. Clearing emptied the source,
  removed current primary fragments and the current `text` parameter, hid the
  control, and left the empty named result region visible.
- The page displayed a 5,000-character input limit.
- One synthetic translation completed and clearing the source cleared the
  result.
- Adding the fixed `hl=en` page-language parameter made the matching Google
  consent origin expose exactly one visible
  `button[jsname="tWT92d"][aria-label="Reject all"]`, including when the
  translator used the `.ru` origin. One click returned to the matching
  translator origin. A separate Russian-locale observation used the exact
  accessible name `Отклонить все`, but runtime matching does not depend on that
  locale. Accepting all cookies was not used.

### Privacy finding

Entering source text added a `text` query parameter to the page URL. Clearing
the source removed it from the current URL, but browser Back restored the prior
source-bearing URL. A cleared reusable page is therefore not sufficient to
prevent browser-history retention.

## Bing Translator

The public page identifies itself as Microsoft Translator. The product-facing
short label proposed for GPT-Voice is `Bing`.

### Observed

- The anonymous translator loaded without authentication or blocking consent.
- Source language control: `#tta_srcsl`.
- Target language control: `#tta_tgtsl`.
- Source input: contenteditable `#tta_input_ta`.
- Translation result: `#tta_output_ta`.
- Automatic source detection was available.
- `en`, `ru`, `uk`, and `be` were present in both native language selectors.
- The selected Russian target value was `ru`.
- The page displayed a 1,000-character input limit.
- One synthetic translation completed after a clean reload.
- A second check mapped target values exactly as `en`, `ru`, `uk`, and `be`;
  automatic source detection used `auto-detect`.
- Playwright `fill()` against the contenteditable source produced a result.
- The second result matched the fixed target reference exactly, was unchanged
  across two reads 500 ms apart, and completed in the 10–11 second range.
- Clearing the source cleared the result.
- The current URL did not contain the source sample. After clearing, browser
  Back returned to the pre-provider blank page rather than a source-bearing
  translator entry.

### Volatility finding

The first loaded page accepted target and input changes but produced no result
or observed translation request. It exposed three internal script failures. A
clean reload of the same public page then translated successfully. This proves
the researched controls but also establishes a stale or partially initialized
page state that the runtime must detect and fail safely. It does not justify an
unbounded reload or automatic content replay.

## Yandex Translate

### Observed

- The requested English translator route redirected to the English root page.
- On the English route, the essential-cookie consent choice was the exact
  accessible button `Allow essential cookies`. One click remained on the
  translator origin and did not require authentication.
- Automatic source detection was available.
- `en`, `ru`, `uk`, and `be` were available as target-language URL codes.
- The visible source input was the contenteditable
  `[role="textbox"][aria-labelledby="srcLabel"]`.
- A `#textarea` element was also present, but it was hidden and disabled and
  must not be used.
- The result was available through `#translation`.
- The page displayed a 10,000-character input limit.
- One synthetic Belarusian-target translation completed.
- Target-language values `en`, `ru`, `uk`, and `be` were observed in the public
  selector/URL state.
- A clean direct `fill()` of the visible contenteditable produced no result and
  multiple page-script failures. It is not an approved submission strategy.
- On the content-free English page, automatic source detection is the switch
  `#srcLangSelect input[role="switch"]`. The runtime sequence enables it before
  source insertion when it is unchecked.
- Exactly one visible source button matched the accessible-name prefix
  `Choose source language `. After the source menu was opened and automatic
  detection was confirmed, Escape closed that menu before target selection.
- Exactly one visible target button matched the accessible-name prefix
  `Choose target language `.
- Before source insertion, each requested target resolved exactly one checkbox
  with the exact English accessible name `English`, `Russian`, `Ukrainian`, or
  `Belarusian`. Those names mapped to `en`, `ru`, `uk`, and `be` respectively.
- The exact route candidate was
  `/en/?source_lang=auto&target_lang=<target>&text=<encodeURIComponent(source)>`,
  with query keys in that order. Before client initialization, the URL retained
  `auto`, the requested target code, and the encoded source.
- Route revalidation requested Belarusian. After client initialization, the
  page normalized the source to detected English but rewrote the target to
  Russian. The nonempty result therefore did not prove the requested target.
- Choosing Belarusian in the native target control after source-bearing
  navigation produced a Belarusian result and corresponding `be` URL state.
  That sequence occurs after source submission and can cause provider-side
  retranslation, so it is not an approved runtime strategy under the
  single-submission/no-replay contract.
- Sequential keyboard input into the preconfigured visible editor also
  produced the requested target, but it emits per-character input and its
  duration scales with input length. It is not the approved runtime strategy.
- One full-string visible-editor update succeeded when it dispatched one
  bubbling `beforeinput` event with `inputType: 'insertText'`, assigned the
  contenteditable's `textContent` once, and dispatched one matching bubbling
  `input` event. Automatic source detection normalized to the detected code;
  the preselected Belarusian target remained `be`; and the nonempty result was
  unchanged across two reads 500 ms apart.
- The full-string DOM update is the approved submission strategy. The direct
  source-bearing route and post-submission target correction are explicitly
  rejected.

### Privacy finding

Yandex placed the complete source sample in a `text` query parameter. Clearing
the input removed it from the current URL but left the prior result in the DOM,
and browser Back restored the source-bearing URL. Yandex also retained the
source and result in its visible Translation History after the original tab was
closed and a new tab was opened in the same context. The visible synthetic
History entries were manually deleted before the research context was closed.

Translation must not use the persistent voice-provider profile. Reusing a
translation context across operations retains the observed provider History
risk; the later product decision explicitly accepts that risk for one isolated
nonpersistent context per provider. The approved DOM update still causes the
page to add the source to its URL and provider History. It is attempted once
and must not be retried automatically.

This research establishes technical feasibility, not approval for the page to
copy selected text into a top-level URL. Context destruction removes GPT-
Voice's local browser access, history, storage, and operation state only. The
research did not establish Yandex's provider-side retention or deletion
behavior, and transmitted content may remain provider-side after context
destruction despite the visible History deletion. Enabling Yandex required a
separate, explicit human decision accepting both the observed URL/Back/History
transport and that retention uncertainty. The `translation-providers`
specification interview made that decision on 2026-07-25 and also selected no
Yandex-specific warning, opt-in, or special user-documentation notice. These
product choices do not change or weaken the research finding.

## DeepL

### Observed

- The anonymous translator shell loaded without authentication.
- Source-language control: `[data-testid="translator-source-lang-btn"]`.
- Target-language control: `[data-testid="translator-target-lang-btn"]`.
- Source input container: `[data-testid="translator-source-input"]` with an
  accessible contenteditable `Source text` textbox.
- Result container: `[data-testid="translator-target-input"]`.
- Automatic source detection was selected by default.
- Public supported-language links included English, Russian, and Ukrainian as
  candidate product languages only.
- Belarusian was absent from the published supported-language list.
- A cookie dialog was observed, but completion of its rejection path was not
  established.

### Safe blocker

Both clean page checks presented a `Checking if the connection is secure...`
overlay backed by a challenge frame on `clearance.deepl.com`. The overlay
intercepted target-language interaction. No challenge was bypassed and no
source text was submitted.

The target selector contents, executable provider language-code mapping,
anonymous input limit, successful result extraction, result clearing,
URL/history behavior, and rate-limit presentation therefore remain unproven.
The published links are not runtime capabilities. DeepL must stay
fail-closed until one application-equivalent CloakBrowser canary passes without
challenge bypass.

## Allowed Top-Level Origins And Redirects

Only these public top-level navigation origins were observed:

| Provider | Translator origins                                            | Consent/challenge origins                                                                            | Observed redirect rule                                |
| -------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Google   | `https://translate.google.com`, `https://translate.google.ru` | `https://consent.google.com`, `https://consent.google.ru`                                            | Consent returns to the matching translator origin     |
| Bing     | `https://www.bing.com`                                        | None observed                                                                                        | No top-level redirect                                 |
| Yandex   | `https://translate.yandex.com`                                | Same translator origin during the successful check                                                   | `/en/translator` redirects to `/en/`                  |
| DeepL    | `https://www.deepl.com`                                       | Challenge frame on `https://clearance.deepl.com`; consent frame on `https://web.cmp.usercentrics.eu` | No approved top-level redirect beyond `www.deepl.com` |

The consent/challenge origins are evidence, not alternate translation targets.
Any unlisted top-level origin requires revalidation and must fail closed.

## Cross-Provider Compatibility Matrix

| Provider | Anonymous sample                            | Executable target evidence                             | Observed limit | Source retention                            | Runtime state                     |
| -------- | ------------------------------------------- | ------------------------------------------------------ | -------------: | ------------------------------------------- | --------------------------------- |
| Google   | Completed                                   | 249 public target entries                              |          5,000 | URL and Back history                        | Proven baseline                   |
| Bing     | Completed after clean reload                | 179 public target entries                              |          1,000 | No source-bearing navigation entry observed | Proven with stale-page volatility |
| Yandex   | Full-string visible-editor update completed | 118 public target entries                              |         10,000 | URL, Back history, and provider History     | Proven; privacy risk accepted     |
| DeepL    | Not submitted                               | None; published candidates are not executable evidence |       Unproven | Unproven                                    | Blocked and deferred              |

The matrix applies only to the public pages and evidence date. It is not a
promise that private page contracts or limits will remain stable.

## Privacy And Retention Findings

- Google and Yandex demonstrate that clearing visible controls does not erase
  browser history.
- Yandex additionally demonstrates provider-page History retention inside a
  reused browser context.
- Per-operation context destruction is the strongest isolation supported by
  the evidence. The 2026-07-25 product decision instead uses one dedicated,
  nonpersistent context per provider and reuses it until invalidation or
  application exit. This intentionally retains provider browser state across
  operations.
- Translation must never share the persistent voice-provider profile.
- Static provider origins may be logged only as provider IDs. Navigated URLs
  must never be logged because they can contain source text.
- Source and result controls must clear before context reuse. If clear cannot
  be confirmed, the provider context must close before success. The attempt may
  still leave provider-side telemetry or retention that local cleanup cannot
  erase.
- A failed or unconfirmed clear and context close after an otherwise successful
  translation cannot be treated as success and must retain teardown ownership.

## Known Limits And Unproven Behavior

- No rate limit was deliberately triggered on any provider.
- Authentication, paid tiers, provider APIs, document translation, source
  language selection, and translation-quality comparison were not tested.
- The DeepL challenge may use the observed safe classification. No
  provider-specific rate-limit marker was established; ambiguous pages must
  map to a generic contract-changed failure until re-researched.
- Bing's initial inert state shows that a loaded DOM is not sufficient evidence
  of readiness.
- DeepL's public language list does not prove exact selector values or English
  regional mapping.
- Live provider assertions are unsuitable for deterministic CI tests.

## Specification Inputs And Subsequent Decisions

1. Expose each runtime provider's complete reviewed target inventory: Google
   249, Bing 179, and Yandex 118 entries in the 2026-07-25 baselines.
2. Store one target-language draft per provider so switching providers never
   silently changes another provider's choice.
3. Enable Google, Bing, and Yandex. Defer DeepL implementation, UI, and
   monitoring until a later challenge-free executable canary and specification
   revision.
4. Use automatic source detection only.
5. Put provider behavior behind a shared main-process base class and an
   exhaustive provider registry with no fallback.
6. Make selection persistence-only; selecting a provider or language must not
   navigate, probe, authenticate, or submit text.
7. Include provider identity and a provider-contract version in translation
   cache keys.
8. Use typed safe errors, bounded waits, cancellation, late-result suppression,
   and clear-or-close cleanup.
9. Reuse one nonpersistent context per provider until invalidation or
   application exit; never share the persistent voice-provider profile.
10. Run a daily no-text CloakBrowser inventory check and create one
    deduplicated issue on the first confirmed code-to-label difference.
11. Add no Yandex-specific warning, opt-in gate, or special user-documentation
    notice despite the accepted provider-specific retention risk.

## Revalidation Triggers

Repeat the sanitized procedure when:

- a provider changes origin, redirect, consent, selectors, language values, or
  visible input limit;
- deterministic contract tests report a missing source/result control;
- a provider begins returning empty results or challenge/rate-limit states;
- CloakBrowser changes its major browser/runtime behavior; or
- Yandex's accepted retention posture is reconsidered or DeepL is proposed for
  enablement.

Revalidation must use a new inert sample, retain metadata only, close all tabs,
and never repair a provider by extracting or calling a private endpoint.
