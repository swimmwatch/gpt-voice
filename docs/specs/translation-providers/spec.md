# Spec: Translation Providers and Language Inventory Monitoring

Status: Approved
Date: 2026-07-25
Global task slug: `translation-providers`
Scope owners: selected-text translation, translator browser automation, main-screen translation controls, and language-inventory automation

## Objective

Turn the current Google-only selected-text translator into an explicit
main-process provider architecture. Google, Bing, and Yandex become selectable
translation providers, each with its complete checked-in target-language
inventory. The main screen lets the user select both provider and target
language, remembers one target per provider, and preserves the existing
hotkey-to-clipboard workflow.

The integration must isolate translator state from voice-provider sessions,
prevent automatic resubmission after selected text may have reached a
provider, reject invalid or over-limit input before transmission, and retain
only safe diagnostics. A daily GitHub Actions workflow compares public
provider language controls with reviewed baselines and creates a deduplicated
issue on the first confirmed inventory difference.

DeepL is not part of this implementation or its UI. Repeated CloakBrowser
research reached a connection-security challenge before a complete executable
translation contract could be proven. A later specification may reintroduce
DeepL after a challenge-free application-equivalent canary.

## Scope

### In Scope

- A shared `BaseTranslateProvider` contract for every runtime translation
  provider.
- Concrete Google, Bing, and Yandex browser-backed providers and an exhaustive
  provider registry.
- One lazily created, nonpersistent CloakBrowser context per translation
  provider, reusable until invalidated or application exit.
- Provider-specific public-page navigation, consent handling, automatic source
  detection, target selection, source insertion, result extraction, readiness,
  clearing, and safe failure classification.
- Complete checked-in target-language inventories for Google, Bing, and Yandex.
- Main-screen provider and target-language `Select` controls.
- Per-provider target-language persistence, legacy migration, validation, and
  removed-language recovery.
- Provider-aware translation caching, localized failures, clipboard recovery,
  and late-result suppression.
- A daily and manually dispatchable GitHub Actions language-inventory monitor
  that opens or updates deduplicated issues.
- Deterministic tests, sanitized manual canaries, and updates to general
  provider, workflow, and privacy documentation.

### Out of Scope

- DeepL implementation, registry metadata, runtime selection, language
  monitoring, or UI.
- Manual source-language selection; every provider uses automatic detection.
- Provider APIs, private endpoints, credentials, login automation, paid tiers,
  document translation, glossaries, or translation-quality comparison.
- CAPTCHA, connection-security challenge, rate-limit, or provider-restriction
  bypass.
- Automatic fallback to a different provider after a failure.
- Automatic replay after source insertion begins.
- Text splitting, silent truncation, or partial translation.
- Live translation assertions in the deterministic test suite.
- New dependencies, packaging targets, signing changes, release changes, or
  generated release artifacts.
- A Yandex-specific user-facing warning, opt-in gate, or special privacy
  notice. General documentation still identifies all supported providers and
  explains that selected text is sent to the provider the user chooses;
  sanitized engineering research remains provider-specific.

## Observed Baseline

- `src/main/services/translation.ts` and
  `src/main/services/translationUtils.ts` implement Google-specific functions,
  selectors, URLs, timeouts, and four-language validation.
- `src/main/browser.ts` keeps one Google Translate page in the persistent
  background context also used by browser-session voice providers.
- `src/renderer/components/TranslateSection.tsx` exposes English, Russian,
  Ukrainian, and Belarusian through the existing Radix-backed `Select`.
- `config.json` stores one legacy `targetLang`; typed main/preload/renderer IPC
  gets and sets only that string.
- The selected-text service already serializes translate/prettify actions,
  restores the clipboard on failure, caches successful translation results,
  and copies and notifies on success.
- Sanitized CloakBrowser research dated 2026-07-21 and 2026-07-25 is recorded
  in `docs/researches/translation-providers/`.

## Public Contracts

### Provider Identity and Metadata

The runtime provider union is closed and exhaustive:

```ts
type TranslationProviderId = 'google' | 'bing' | 'yandex';

interface TranslationLanguage {
  readonly code: string;
  readonly providerLabel: string;
}

interface TranslationProviderInfo {
  readonly id: TranslationProviderId;
  readonly name: 'Google' | 'Bing' | 'Yandex';
  readonly contractVersion: string;
  readonly defaultTargetLanguage: string;
  readonly maxInputCharacters: number;
  readonly targetLanguages: readonly TranslationLanguage[];
}
```

Provider language codes are opaque provider contracts. They are not rewritten
from ISO assumptions. `providerLabel` is non-sensitive public metadata and is
the display fallback for codes that `Intl.DisplayNames` cannot interpret.

`contractVersion` changes whenever provider behavior or code mapping can change
translation results. It participates in the translation cache key.

### Translation Settings

```ts
interface TranslationSettings {
  readonly providerId: TranslationProviderId;
  readonly targetLanguageByProvider: Record<TranslationProviderId, string>;
}
```

The main process owns normalization and validation. Renderer callers receive an
authoritative settings snapshot after every get or set operation; they never
construct a trusted provider or language value locally.

### Safe Failure Contract

Internal provider failures use a closed, typed classification that covers at
least:

- unsupported provider;
- unsupported target language;
- input too long;
- navigation or connection failure;
- consent or challenge blocking;
- missing, ambiguous, or changed page contract;
- result timeout or empty result;
- cancelled or stale operation;
- cleanup failure.

Only localized, user-safe messages cross to notifications or renderer status.
Raw Playwright errors, page content, source-bearing URLs, and provider
responses never cross IPC or enter logs.

## Architecture Requirements

### Shared Provider Lifecycle

- **ARCH-001:** `BaseTranslateProvider` is an abstract main-process class.
  Google, Bing, and Yandex must extend it; provider behavior must not remain as
  parallel top-level translation functions.
- **ARCH-002:** The base class owns the common page-level lifecycle: metadata
  validation, context/page ownership, pre-submission readiness recovery,
  previous-result isolation, one submission boundary, result stabilization,
  cleanup, context invalidation, safe diagnostics, and shutdown.
- **ARCH-003:** Provider subclasses own only public-page differences:
  allowlisted navigation and consent, readiness markers, target selection,
  source/result controls, one full-string insertion strategy, target/result
  verification, clearing, and provider-specific page-state classification.
- **ARCH-004:** An exhaustive registry maps every
  `TranslationProviderId` to metadata and a factory. Unknown IDs fail closed;
  there is no default/fallthrough factory and no automatic provider fallback.
- **ARCH-005:** Main owns CloakBrowser, pages, clipboard access, provider
  execution, settings validation, cache identity, notifications, and
  lifecycle cleanup. Renderer accesses these capabilities only through typed
  `window.electronAPI`.
- **ARCH-006:** Every provider lazily owns at most one nonpersistent
  CloakBrowser context and page. Contexts may coexist and are reused for later
  operations of the same provider until invalidated or application exit.
- **ARCH-007:** Translation contexts never share the persistent
  voice-provider profile, session files, pages, cookies, local storage, or
  browser history. They use the user's validated CloakBrowser proxy, locale,
  timezone, fingerprint, background-mode, and humanization settings without a
  persistent user-data directory.
- **ARCH-008:** Application exit, main-process shutdown, and a relevant
  CloakBrowser-settings change close all translation contexts. A terminal
  provider contract failure invalidates and closes only that provider's
  context. The next manual operation may recreate it lazily.

### Settings, Migration, and IPC

- **SET-001:** Google is the default provider for fresh and upgraded
  installations. Every provider default target is English when supported.
- **SET-002:** Legacy `targetLang` migrates to Google's per-provider value.
  Bing and Yandex are seeded with that value when their checked-in inventory
  supports it; otherwise they are seeded with English.
- **SET-003:** Settings persist one selected provider and one target code per
  runtime provider. Switching providers restores that provider's remembered
  target and never changes another provider's target.
- **SET-004:** Persisted-load normalization repairs an unknown selected provider
  to Google and repairs blank or unavailable stored target codes under
  `SET-005`, with one nonblocking notice. IPC writes containing an unknown
  provider, blank code, or code absent from the corresponding checked-in
  inventory are rejected without mutation. Corrupt unrelated configuration
  fields remain isolated as in the current configuration loader.
- **SET-005:** If an application update removes a stored language, main replaces
  it with that provider's checked-in default, persists the repair, and emits
  one localized nonblocking notice. It does not submit text during repair.
- **SET-006:** Typed get/set IPC accepts a settings-shaped input, validates it
  in main, saves atomically, and returns the authoritative normalized snapshot
  with a safe optional error. Main, preload, and renderer declarations change
  together and preserve trusted-sender validation.
- **SET-007:** A rejected or failed save leaves the previous durable settings
  unchanged. The renderer rolls back optimistic state to the returned or
  previously confirmed snapshot and presents a localized nonblocking error.

## Main-Screen Selection Requirements

- **UI-001:** The main translation band contains controlled provider and
  target-language `Select` controls using the existing shared Select
  primitives.
- **UI-002:** The provider control exposes Google, Bing, and Yandex. DeepL is
  absent rather than disabled or represented by placeholder metadata.
- **UI-003:** The language control exposes every target in the selected
  provider's reviewed inventory: initially 249 Google, 179 Bing, and 118
  Yandex targets.
- **UI-004:** Display names use `Intl.DisplayNames` in the current app locale
  when a provider code can be represented. The checked-in provider label is
  the fallback. Locale-aware display-name sorting uses the provider code as a
  stable tie-breaker.
- **UI-005:** The expanded language control is text-first and does not require
  country flags, because languages and regional/script variants do not map
  one-to-one to countries.
- **UI-006:** Each control has an explicit accessible label, visible current
  value, keyboard navigation and typeahead, bounded scrollable content, and a
  usable narrow-window layout.
- **UI-007:** Selecting a provider or language persists settings only. It does
  not navigate, launch, probe, authenticate, clear, or submit a translator
  page.
- **UI-008:** An in-flight operation keeps the provider and target snapshot
  taken at its start. A later selection applies to the next operation and does
  not cancel, redirect, or alter the current request.
- **UI-009:** No provider-specific Yandex warning, acknowledgement, badge, or
  special user-documentation link is added.

## Translation Operation Requirements

- **RUN-001:** Preserve the existing single-flight selected-text action gate,
  copy automation, Linux selection fallback, previous-clipboard restoration,
  success copy, notifications, and silent suppression of duplicate concurrent
  hotkey presses.
- **RUN-002:** At operation start, snapshot the selected provider and its
  remembered target. Validate both against the exhaustive registry before
  launching or touching a browser.
- **RUN-003:** Reject empty selected text and text longer than the provider's
  checked-in maximum before browser creation or submission. Over-limit
  failures send nothing, restore the previous clipboard, and identify the
  provider limit and selected-text length in localized UI without logging the
  text.
- **RUN-004:** Successful translation cache identity includes provider ID,
  provider contract version, target code, and selected text. A result from one
  provider, contract, or target never satisfies another. Failed, empty,
  cancelled, or cleanup-failed results are not cached.
- **RUN-005:** Reuse the existing bounded transient `page.goto` retry policy.
  A provider may perform at most one additional clean readiness recovery before
  source insertion when its researched contract requires it.
- **RUN-006:** Source insertion begins the submission boundary. After that
  boundary, GPT-Voice never automatically reloads, recreates a context, or
  submits the source again. Ambiguous timeouts and page failures require a
  later manual hotkey invocation.
- **RUN-007:** Before submission, the provider enables automatic source
  detection, selects and verifies the requested target, removes stale source
  and result state, and records a normalized previous-result marker.
- **RUN-008:** Each provider inserts the entire selected text once through its
  validated visible source control. Per-character typing and source-bearing
  navigation are not runtime submission strategies.
- **RUN-009:** A result is ready only when it is nonempty, differs from the
  prior result, remains identical across two normalized reads 500 ms apart,
  and the page still confirms the requested target where an executable signal
  exists. DOM availability, a clean console, or a character counter alone is
  not readiness.
- **RUN-010:** Every operation has a generation token. A result or failure from
  an invalidated, cancelled, superseded, or closed page cannot update the
  clipboard, cache, notification, or another operation.
- **RUN-011:** After obtaining a valid result, the provider clears visible
  source and result state. If clear cannot be confirmed, it invalidates and
  closes that provider context. Success is returned only after clear or
  confirmed context close.
- **RUN-012:** If both clearing and context close fail, the operation fails
  with a cleanup classification, restores the previous clipboard, does not
  cache or copy the result, and retains cleanup ownership for shutdown.
- **RUN-013:** Visible clearing is defense in depth only. It must not be
  described as erasing browser history, provider telemetry, or provider-side
  retention.

## Provider Contracts

### Google

- **GOOG-001:** Provider ID is `google`, display name is `Google`, default target
  is `en`, and the checked-in public target inventory contains exactly 249
  unique code-to-label entries from the 2026-07-25 baseline.
- **GOOG-002:** The source uses automatic detection. Its source-only automatic
  entry is excluded from the target inventory.
- **GOOG-003:** The provider enforces the researched 5,000-character maximum
  before submission.
- **GOOG-004:** Runtime navigation uses the public translator route with
  `sl=auto`, the exact target code, and translate mode. Only the allowlisted
  Google translator and matching consent origins recorded by research may be
  top-level pages.
- **GOOG-005:** If optional cookie consent appears, automation chooses the
  visible Reject all control. It never chooses Accept all merely to unblock
  translation.
- **GOOG-006:** Source and result controls use a layered, ambiguity-rejecting
  locator contract backed by the current accessible textarea/result semantics
  and revalidated runtime selectors. Missing or multiple active controls fail
  as a contract change.
- **GOOG-007:** Clearing removes current visible source and result state, but
  URL/Back retention remains within the reusable isolated Google context until
  it is closed.

### Bing

- **BING-001:** Provider ID is `bing`, display name is `Bing`, default target is
  `en`, and the checked-in public target inventory contains exactly 179 unique
  code-to-label entries from the 2026-07-25 baseline.
- **BING-002:** Runtime uses only `https://www.bing.com/translator`. Source and
  target languages use the native public selects, source uses `auto-detect`,
  source text is replaced in one Playwright fill of the visible contenteditable
  input, and result text uses the public output control.
- **BING-003:** Language selection uses exact provider values, never labels.
  Dynamic Recently used duplicates and source-only auto detection are excluded
  from inventory and runtime target validation.
- **BING-004:** The provider enforces the researched 1,000-character maximum
  before submission.
- **BING-005:** Result readiness requires a changed nonempty stable result,
  requested target value, and output-language agreement when the page exposes
  it. The visible counter and diagnostic-script node are not readiness or
  failure signals.
- **BING-006:** A loaded but inert page may trigger one clean pre-submission
  page/context recovery. It never permits post-submission replay.
- **BING-007:** The public clear control must remove source and result state and
  reset result readiness before the context is reused.

### Yandex

- **YNDX-001:** Provider ID is `yandex`, display name is `Yandex`, default target
  is `en`, and the checked-in public target inventory contains exactly 118
  unique code-to-label entries from the 2026-07-25 baseline.
- **YNDX-002:** The requested English translator route may normalize to the
  English root route. Only the allowlisted Yandex translator origin may be the
  top-level page.
- **YNDX-003:** If cookie consent appears, automation chooses Allow essential
  cookies. It never chooses Allow all merely to unblock translation.
- **YNDX-004:** Automatic source detection is a separate switch and must be
  enabled before target selection and source insertion. The provider selects
  the requested target through the uniquely visible chooser by exact
  `data-value` provider code, never by localized label, and verifies the same
  selected code before submission.
- **YNDX-005:** The provider enforces the researched 10,000-character maximum
  before submission.
- **YNDX-006:** Runtime source insertion uses one full-string update of the
  visible contenteditable source control: one bubbling `beforeinput` event with
  `inputType: 'insertText'`, one `textContent` assignment, and one matching
  bubbling `input` event. It does not use the hidden legacy textarea,
  per-character typing, a source-bearing URL, or a post-submission target
  correction.
- **YNDX-007:** Result readiness uses the visible destination editor's changed,
  nonempty, stable normalized text plus requested-target page state. Console,
  telemetry, and counter state are not readiness.
- **YNDX-008:** Clearing must remove current visible source/result state or
  force context close under `RUN-011`. The accepted product decision permits
  Yandex despite observed plaintext URL/history, telemetry, and local
  provider-history surfaces and unknown provider-side retention.

## Language Inventory Requirements

- **LANG-001:** Reviewed provider baselines are stored as normalized,
  non-sensitive code-to-label maps under
  `docs/researches/translation-providers/baselines/`.
- **LANG-002:** Initial baseline invariants are exact: Google 249 targets, Bing
  179 targets, and Yandex 118 targets; every provider has unique, nonblank
  target codes and nonblank fallback labels.
- **LANG-003:** Source-only automatic detection, hidden or inactive chooser
  copies, dynamic recently-used entries, exact duplicate codes, and DOM order
  are not part of a target inventory.
- **LANG-004:** Regional, script, provider-specific, legacy, alpha, and beta
  entries remain distinct when their provider codes differ. The application
  must not normalize one provider's code into another provider's code.
- **LANG-005:** Runtime metadata and the monitoring baseline share one
  reviewable source of truth or an automated equality check. A build or test
  fails when compiled provider metadata and the reviewed baseline diverge.
- **LANG-006:** Inventory changes enter runtime only through a reviewed pull
  request that updates the baseline, provider metadata, affected defaults or
  migrations, tests, and documentation together.

## Scheduled Language Monitor

- **OPS-001:** Add a GitHub Actions workflow scheduled daily at 06:00 UTC and
  available through `workflow_dispatch`.
- **OPS-002:** Monitor Google, Bing, and Yandex only. DeepL joins only after a
  later approved specification returns it to runtime scope.
- **OPS-003:** Use the repository's pinned Node.js 24, npm, Playwright Core, and
  CloakBrowser setup with `CLOAKBROWSER_AUTO_UPDATE=false`. Do not introduce a
  second browser stack or auto-update the browser during a run.
- **OPS-004:** Each probe uses a fresh nonpersistent context, a fixed English
  page locale, an allowlisted public translator/consent origin, and public
  language controls only. It submits no translation text and inspects no
  cookies, storage values, private endpoints, request/response bodies, account
  state, or credentials.
- **OPS-005:** A probe is successful only when exactly one active target
  chooser is open, required public attributes are unambiguous, no loading or
  challenge state is active, and the complete normalized map is identical
  across two reads one second apart within a bounded hydration deadline.
  Normalize the live target controls into a deduplicated, order-independent
  code-to-label map using provider-specific public attributes and
  visible-control scoping, then compare it with the reviewed baseline. Empty,
  unstable, partially hydrating, or ambiguous controls fail the probe rather
  than becoming drift.
- **OPS-006:** Added codes, removed codes, or label changes create drift.
  Reordering, hidden duplicate choosers, source-only auto detection, and
  dynamic recent groups do not.
- **OPS-007:** The first successful probe that returns a changed normalized map
  creates an issue immediately. A challenge, navigation failure, missing
  selector, ambiguity, or unavailable provider fails the job but is not
  reported as language drift.
- **OPS-008:** Issue identity includes provider ID and a deterministic
  normalized-diff fingerprint. Repeated observations update the same matching
  open or closed issue rather than creating duplicates; a closed issue may be
  reopened while the same drift persists.
- **OPS-009:** The issue contains only provider ID, baseline date, added,
  removed, and relabeled public entries, the diff fingerprint, and a workflow
  run link. It contains no raw DOM, screenshots, full navigated URLs, cookies,
  page storage, source/result text, or response data.
- **OPS-010:** The workflow has `contents: read` and narrowly scoped
  `issues: write`; all other permissions are absent. It uses only the standard
  repository token and no provider secret.
- **OPS-011:** The workflow never changes the baseline, commits, pushes, or
  opens a pull request. A maintainer resolves drift through a separate reviewed
  pull request.
- **OPS-012:** Concurrency, bounded provider timeouts, guaranteed context
  closure, and a global job timeout prevent overlapping or unbounded probes.

## Security and Privacy Requirements

- **SEC-001:** Selected text and translation results are sensitive. They never
  appear in logs, diagnostics, issue content, filenames, persisted settings,
  browser-profile files committed to the repository, or test fixtures.
- **SEC-002:** Logs may contain provider ID, target code, contract version,
  source/result lengths, safe phase, duration, attempt count, and typed outcome
  only. Navigated URLs are never logged because Google and Yandex can place
  source text in query/history state.
- **SEC-003:** No provider session, cookie, local-storage value, browser cache,
  screenshot, account identifier, or raw response is persisted by GPT-Voice as
  translation configuration.
- **SEC-004:** Translation uses public page controls only. Production and the
  scheduled monitor do not derive, call, or depend on private translator APIs.
- **SEC-005:** Any unexpected top-level origin, consent route, challenge,
  login wall, CAPTCHA, or ambiguous active control fails closed. Automation
  never suppresses or solves a provider security challenge.
- **SEC-006:** Context reuse intentionally retains provider browser state until
  clear, invalidation, or app exit. It does not establish provider-side
  deletion. This accepted tradeoff must not weaken `RUN-011` or permit sharing
  with voice providers.
- **SEC-007:** No special Yandex disclosure is added. This is an explicit
  product decision, not evidence that Yandex retention matches other
  providers.
- **SEC-008:** No dependency, browser binary, external action, or issue-writing
  permission is added beyond the minimum explicitly required by this
  specification.

## Compatibility and Failure Behavior

- **COMP-001:** Existing Google users continue with Google and their prior
  target after upgrade. Existing record, translate, prettify, retry, tray,
  notification, and clipboard behavior remains unchanged outside the
  translation-provider additions.
- **COMP-002:** Provider selection, target selection, inventory repair, and
  provider failure never silently send text to a different provider or target.
- **COMP-003:** A provider failure is isolated to that provider context.
  Another provider may still work when selected by the user on a later
  operation.
- **COMP-004:** DeepL-like legacy or experimental stored IDs normalize to
  Google without launching a page; the repair follows the same one-time
  nonblocking settings notice policy.
- **COMP-005:** Live page volatility cannot make deterministic tests fail.
  Runtime contract changes produce a localized safe error and require
  sanitized manual revalidation.

## Documentation Requirements

- **DOC-001:** Update README feature copy and architecture flow from
  Google-only translation to user-selected Google, Bing, or Yandex.
- **DOC-002:** Update general privacy/session guidance to state that selected
  text is sent through the chosen public translator and that isolated
  nonpersistent contexts may retain provider browser state until clear or
  application exit.
- **DOC-003:** Do not add a Yandex-specific warning or special provider privacy
  section to user-facing documentation. Preserve the sanitized
  provider-specific engineering research record.
- **DOC-004:** Keep the sanitized research record, extraction rules, evidence
  dates, limitations, and normalized public language baselines current.
- **DOC-005:** Document the language-monitor schedule, manual dispatch,
  issue-deduplication behavior, baseline-review workflow, and probe-failure
  distinction.

## Acceptance Criteria

### Deterministic Automated Checks

- **AC-AUTO-001:** Base-provider tests cover valid translation, unsupported
  provider/language, over-limit rejection before browser creation,
  pre-submission recovery, no post-submission replay, stale-result rejection,
  stability, late-result suppression, clear-or-close success, cleanup failure,
  and shutdown.
- **AC-AUTO-002:** Provider fixture tests cover each provider's public
  navigation/consent states, exact target selection, auto detection, visible
  source/result controls, one full-string insertion, result verification,
  clear behavior, challenges, ambiguity, and contract changes without live
  network access. Yandex inventory-driven tests exercise every exact
  `data-value` code, including provider-specific and script/region variants,
  without selecting by label.
- **AC-AUTO-003:** Registry/type tests prove the runtime union is exactly
  Google, Bing, and Yandex; every provider extends the shared base; unknown
  IDs fail; DeepL is absent; and exhaustive switches have no fallthrough.
- **AC-AUTO-004:** Inventory tests validate exact counts, unique codes,
  nonblank labels, source-only exclusion, provider metadata equality, opaque
  variants, and deterministic display-name fallback.
- **AC-AUTO-005:** Settings tests cover fresh defaults, legacy `targetLang`
  migration, per-provider memory, compatible seeding, corrupt input,
  unsupported IDs/codes, removed-language fallback and one-time notice,
  authoritative IPC snapshots, save rollback, and trusted sender rejection.
- **AC-AUTO-006:** Selected-text tests prove provider and contract version are
  cache dimensions; failures are not cached; clipboard recovery and current
  concurrency semantics remain intact.
- **AC-AUTO-007:** Renderer tests cover both Select controls, all provider
  inventory sizes, provider-specific remembered targets, `Intl.DisplayNames`
  fallback, keyboard accessibility, persistence-only changes, in-flight
  snapshot behavior, and save rollback.
- **AC-AUTO-008:** Monitor tests use deterministic public-control fixtures to
  cover extraction, visibility, deduplication, order independence,
  complete stable hydration, delayed partial hydration, added/removed/relabeled
  entries, diff fingerprinting, first-diff issue payloads, repeated issue
  reuse, probe failure, redaction, and no baseline mutation. A partial,
  unstable, or ambiguous map never produces a drift issue.
- **AC-AUTO-009:** Workflow lint, formatting, application and test type checks,
  lint, unit tests, production audit, production build, and the applicable
  CloakBrowser smoke check pass.
- **AC-AUTO-010:** A repository scan of runtime logs, fixtures, research
  artifacts, and generated issue fixtures finds no selected text, result text,
  source-bearing URL, cookies, storage values, private response body, or
  credential.

### Sanitized Manual Verification

- **AC-MAN-001:** In an isolated development environment, one short synthetic
  translation succeeds through each of Google, Bing, and Yandex; a second
  operation proves same-provider context reuse; switching providers proves
  context separation and per-provider target memory.
- **AC-MAN-002:** Over-limit input for each provider is rejected before the
  page receives text. A simulated post-submission timeout produces no
  automatic replay and preserves the previous clipboard.
- **AC-MAN-003:** Clear succeeds on the normal path. Forced clear failure closes
  the affected provider context before success; forced close failure prevents
  caching and clipboard replacement.
- **AC-MAN-004:** Provider and language Select controls remain usable by mouse
  and keyboard with the full 249/179/118-entry inventories at the narrowest
  supported main-window size.
- **AC-MAN-005:** A dry-run/manual-dispatch language probe submits no text and
  produces a sanitized normalized diff. Issue creation is exercised only in an
  authorized repository context and reuses the same provider+diff issue on a
  repeat.
- **AC-MAN-006:** Logs, app configuration, browser lifecycle, and issue content
  retain no source/result text, cookies, storage values, account state, raw
  page content, or source-bearing URL.

## Revalidation and Rollback

- Revalidate a provider when its origin, consent, controls, target codes,
  visible limit, submission semantics, result semantics, or challenge behavior
  changes; when the daily probe reports inventory drift; or when a
  CloakBrowser major runtime change affects public pages.
- Use a new inert synthetic sample for manual translation checks, retain only
  sanitized metadata, and never repair a provider by calling a private
  endpoint.
- A broken provider fails independently and never falls back automatically.
  Users can select another provider manually.
- A reviewed rollback may remove a broken new provider from the runtime
  registry. The removed provider and its target are no longer part of the
  active `TranslationSettings` contract; an invalid selected provider repairs
  to Google under `SET-004`. No dormant-provider preservation promise is made
  without a separate migration contract.
- DeepL re-entry requires a focused specification revision and a
  challenge-free CloakBrowser canary proving consent, complete target
  inventory, source insertion, result readiness, clearing, URL/history
  behavior, limits, and failure handling without challenge suppression.

## Resolved Product Decisions

1. Translation contexts are nonpersistent and isolated by provider, but reused
   until invalidated or application exit rather than closed after every
   operation.
2. Yandex is enabled immediately despite observed plaintext URL/history,
   telemetry, local provider-history behavior, and uncertain provider-side
   retention.
3. DeepL is deferred entirely from the implementation, UI, and scheduled
   monitor.
4. Every provider exposes its complete reviewed target inventory and remembers
   one target language independently.
5. Language names use `Intl.DisplayNames` with checked-in provider-label
   fallback.
6. Navigation/readiness recovery is allowed only before source insertion; no
   automatic post-submission replay is allowed.
7. Over-limit text is rejected before transmission and is never truncated.
8. Provider/language selection only persists settings for the next operation.
9. Cleanup must clear visible state or confirm context close before success.
10. Google remains the default and receives the legacy `targetLang` value.
11. The daily language monitor uses no-text public-UI CloakBrowser probes,
    compares normalized code-to-label maps, creates one deduplicated issue on
    the first confirmed difference, and changes baselines only through a
    separate reviewed pull request.
12. GPT-Voice adds no Yandex-specific warning, opt-in, or special
    documentation disclosure.
