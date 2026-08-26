# Translation Provider Family Review — Google / Bing / Yandex

- **Date:** 2026-08-08
- **Branch:** feat/local-whisper-provider
- **Reviewer scope:** the browser/web-automation-backed translation providers and their shared lifecycle.

## Scope

Reviewed:

- `src/main/translateProviders/BaseTranslateProvider.ts`
- `src/main/translateProviders/GoogleTranslateProvider.ts`
- `src/main/translateProviders/BingTranslateProvider.ts`
- `src/main/translateProviders/YandexTranslateProvider.ts`
- `src/main/translateProviders/translationProviderFactory.ts`, `translationProviderContracts.ts`, `translationProviderAudit.ts`, `translationResultText.ts`, `index.ts`
- `src/main/services/translation.ts`, `src/main/services/selectedTextTranslation.ts`
- `src/main/translationSettings.ts`
- Transport touch-points: `src/main/browserNavigationRetry.ts`, `src/main/backgroundBrowserOperationQueue.ts`, `src/main/cloakBrowserLaunchOptions.ts`, `src/main/cloakbrowser.ts`, and the wiring in `src/main/di/mainProcessCompositionRoot.ts` / `src/main/main.ts` — only insofar as translation drives them.

Axes evaluated per the brief: Performance, Security (with emphasis on untrusted page content crossing into main and text-into-URL/DOM injection), Memory leaks, Cross-platform error handling.

VERIFIED = confirmed by reading the code and/or grep. INFERRED = reasoned from surrounding code but not directly proven here.

## Summary verdict

The family is **well-architected and, on the highest-risk axis (injection of user text and handling of untrusted third-party page content), sound.** The single most important security question — "can the user's text or the scraped page content be turned into executed code?" — is answered defensively:

- User source text is inserted into the page through Playwright `evaluate(fn, value)` with the text passed as a **serialized argument, never string-interpolated** into page code, and is written with a native value setter / `textContent` (no HTML parse). VERIFIED.
- User text is **never placed in the URL**; providers actively **refuse** any page whose URL carries a `text` parameter (`hasTextParameter`). VERIFIED.
- Scraped result text is treated as **plain text** end-to-end (clipboard, cache, truncated notification, IPC string) with **no `dangerouslySetInnerHTML` sink** anywhere in the renderer. VERIFIED.
- Navigation is gated by **strict origin/route allowlists** per provider. VERIFIED.

No critical or high **security** findings. The material findings are about **performance/latency bounds, an unusual Google origin choice, and idle browser-resource retention.** No source files were modified.

## Findings table

| ID          | Finding                                                                                                                                     | Implementation            | Axis                          | Severity      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------- | ------------- |
| TRANSLATE-1 | No overall wall-clock bound on a `translate` operation; navigation alone can consume ~4×60 s per attempt across 2 preparation passes        | Family (base + all three) | Performance / Reliability     | High          |
| TRANSLATE-2 | Google is hardcoded to the Russian TLD origin `translate.google.ru`; all Google source text is sent there                                   | Google                    | Security / Privacy            | Medium        |
| TRANSLATE-3 | Warm page + Chromium context retained indefinitely after a successful translation; no idle eviction                                         | Family                    | Memory / Resource             | Medium        |
| TRANSLATE-4 | High per-poll cost during result stabilization; Bing/Yandex re-read full control snapshots each poll, Google is much lighter (inconsistent) | Bing, Yandex              | Performance                   | Medium        |
| TRANSLATE-5 | `ensurePage` stale-after-`newPage` path releases the context but leaves `this.context` pointing at the closing context                      | Family (base)             | Memory                        | Low           |
| TRANSLATE-6 | Retryable-navigation detection is string-matching on Chromium net-error text; localized/rewrapped errors fall through as non-retryable      | Family                    | Cross-platform error handling | Low           |
| TRANSLATE-7 | Result "timeout" is a soft budget — counts loop iterations, not wall-clock, so effective timeout drifts past `resultTimeoutMs`              | Family (base)             | Reliability                   | Low           |
| TRANSLATE-8 | `previousResult` equality guard could reject a legitimately-identical new result (negligible in practice)                                   | Family (base)             | Correctness                   | Informational |
| TRANSLATE-9 | On success, raw source+result text is handed to `DiagnosticCaptureService` (default-off, redaction delegated)                               | Family (service)          | Security / PII                | Informational |

## Details

### TRANSLATE-1 — No wall-clock bound on a translate operation (High, Performance/Reliability, family)

VERIFIED. A user-triggered translate (hotkey → `SelectedTextTranslationService.translateSelectedTextToClipboard`) has no upper time bound other than internal per-step timeouts and manual cancellation:

- Navigation retries up to `BROWSER_NAVIGATION_MAX_ATTEMPTS = 4` (`browserNavigationRetry.ts:7`) with per-attempt `goto` timeout of 60 s (`GOOGLE_TRANSLATE_NAVIGATION_TIMEOUT_MS`, `BING_NAVIGATION_TIMEOUT_MS`, `YANDEX_NAVIGATION_TIMEOUT_MS` = `60_000`).
- `preparePage` runs the whole navigate→readiness→sourceDetection→targetSelection sequence up to twice (`BaseTranslateProvider.ts:348`), and each pass can re-navigate.
- Worst case ≈ 8 navigations × 60 s (~480 s) plus exponential backoff sleeps, then result polling (15 s) and clear (1.5 s).
- `translateWithSnapshot` runs with **no readiness deadline** (`translation.ts:638`), unlike `initializeSelectedProvider`, which wraps the provider in `InitialProviderReadinessDeadline` (`translation.ts:279`, `translation.ts:298`).

Impact: a stalled/slow network can leave a hotkey action apparently hung for minutes with only manual cancellation. Consider a bounded overall deadline for the interactive translate path, mirroring the initialization deadline. Consistent across all three providers (shared helper + shared base).

### TRANSLATE-2 — Google hardcoded to the Russian TLD (Medium, Security/Privacy, Google)

VERIFIED. `GOOGLE_TRANSLATE_ORIGIN = 'https://translate.google.ru'` (`GoogleTranslateProvider.ts:21`) is the navigation target built in `buildGoogleTranslateProviderUrl` (`GoogleTranslateProvider.ts:162`). Consequently **all** Google-provider source text is submitted to google.ru infrastructure. The origin allowlist does also accept `translate.google.com` / `consent.google.*` (`GoogleTranslateProvider.ts:109`), but the default and only dialed origin is `.ru`.

Impact: data-jurisdiction / privacy concern (user's selected text routed via a Russian TLD) and an availability risk in regions where google.ru is blocked or redirected. Bing (`www.bing.com/translator`, `BingTranslateProvider.ts:21`) and Yandex (`translate.yandex.com`, `YandexTranslateProvider.ts:22`) do not have this asymmetry. Recommend defaulting Google to `translate.google.com`.

### TRANSLATE-3 — Warm page/context retained with no idle eviction (Medium, Memory/Resource, family)

VERIFIED. This is a deliberate reuse strategy, flagged for its resource cost. On a successful translation the page is intentionally **not** closed — `clearVisibleState` clears the input and the success path keeps `this.page`/`this.context` alive (`BaseTranslateProvider.ts:316`–`341`, `createSuccess` with `pageClosed=false`). `ensurePage` reuses the open page on the next call (`BaseTranslateProvider.ts:513`). Providers are cached per ID in `TranslationProviderRegistry` (`index.ts:37`) and only torn down by `registry.shutdown()` via `TranslationRuntime.reset()`/`shutdown()` (`translation.ts:831`, `translation.ts:865`), which is triggered on settings/provider change.

Impact: after a single translation, a (typically headless) Chromium context idles indefinitely until the user changes settings or exits. There is no idle timer to evict a long-unused context. Acceptable as a warm-start tradeoff, but worth an idle-eviction timer for memory-sensitive environments.

### TRANSLATE-4 — Expensive, inconsistent per-poll result reads (Medium, Performance, Bing/Yandex)

VERIFIED. `awaitStableResult` polls up to `ceil(15000/100) = 150` times (`BaseTranslateProvider.ts:578`), each calling the provider's `readNormalizedResult`:

- **Google** reads only the result region (`GoogleTranslateProvider.ts:483` → `readResultSnapshot`, `GoogleTranslateProvider.ts:298`). Light.
- **Bing** re-reads the route **and the full public-controls snapshot** (five `getVisibleLocators` sweeps) **plus** the result each poll (`BingTranslateProvider.ts:594`–`602`, `readPublicControlsSnapshot` at `:260`).
- **Yandex** `readEditorSnapshot` runs several parallel locator/`innerText` reads and resolves destination panels each poll (`YandexTranslateProvider.ts:378`–`413`), and `readNormalizedResult` re-reads the route first (`YandexTranslateProvider.ts:705`).

`getVisibleLocators` additionally issues sequential `isVisible`/`isEditable`/`isEnabled` round-trips per candidate (`GoogleTranslateProvider.ts:220`; shared shape in each provider). Under a 100 ms poll this is many browser IPC round-trips per second. Bing/Yandex do materially more work per poll than Google — an inconsistency across the family. Consider reading only what stabilization needs (result text + a cheap route check) during the poll loop, and validating full controls once.

### TRANSLATE-5 — Stale-after-newPage leaves a dangling context reference (Low, Memory, base)

VERIFIED. In `ensurePage`, `this.context` is set to the new context **before** `newPage()` (`BaseTranslateProvider.ts:549`). If the operation goes stale between those calls, the code calls `releaseDetachedResources(page, ownedBrowser)` (fire-and-forget close) but returns **without nulling `this.context`** (`BaseTranslateProvider.ts:551`–`557`) — the field still points at the now-closing context. Contrast `cancelInitializationNow`, which nulls both `this.page` and `this.context` (`BaseTranslateProvider.ts:897`–`901`). It self-heals on the next `ensurePage`/`closeOwnedResources` (which calls `context.close()` again — Playwright close is idempotent), so this is not a hard leak, but it leaves a stale closed-context reference and a possible double-close race. Low.

### TRANSLATE-6 — Retryability keyed on Chromium error strings (Low, Cross-platform error handling, family)

VERIFIED. `isRetryableBrowserNavigationError` matches lowercased substrings such as `err_internet_disconnected`, `err_name_not_resolved`, `err_timed_out`, `econnreset`, `timeouterror` (`browserNavigationRetry.ts:52`–`71`). These Chromium net-error names are stable across Windows/Linux/macOS, so the common offline/timeout cases classify consistently for all three providers (shared helper, shared `BrowserNavigationService` enum at `:12`). The residual gap: any error whose message is localized, wrapped, or non-Chromium is treated as **non-retryable** and surfaces as `navigationFailure` (from `ensurePage`/`retryBrowserNavigation`) or `pageContractFailure` (if it throws inside a later hook via `invokeHook`, `BaseTranslateProvider.ts:641`). Mostly sound; noted for completeness.

### TRANSLATE-7 — Soft result timeout (Low, Reliability, base)

VERIFIED. `readAttempts` is computed from `resultTimeoutMs / resultPollIntervalMs` and counts **loop iterations only** (`BaseTranslateProvider.ts:578`). Actual wall-clock per iteration also includes read latency and, on any candidate change, a 500 ms stability sleep (`resultStabilityDelayMs`, `BaseTranslateProvider.ts:596`). So the effective time-to-`resultTimeoutOrEmpty` drifts beyond the nominal 15 s, especially for a slowly-streaming result. Low.

### TRANSLATE-8 — previousResult equality guard edge (Informational, Correctness, base)

VERIFIED (edge). `awaitStableResult` only accepts a candidate when `candidate !== previousResult` (`BaseTranslateProvider.ts:595`), where `previousResult` is the result read **before** clearing in `clearStaleState`. If a warm, reused page ever presented a non-empty prior translation equal to the new one, the new result would be rejected and the op would fall to `resultTimeoutOrEmpty`. In practice `clearStaleState` confirms an empty result before proceeding (Google `isCleared` requires `result.value.length === 0`, `GoogleTranslateProvider.ts:510`; analogous Bing/Yandex), so `previousResult` is normally `''`, and the selected-text cache dedups identical inputs upstream (`selectedTextTranslation.ts:109`). Negligible impact.

### TRANSLATE-9 — Raw text handed to diagnostic capture (Informational, Security/PII, service)

VERIFIED hand-off / INFERRED redaction. On success the runtime passes raw `sourceText` and `resultText` to `DiagnosticCaptureService.captureTranslationProviderSuccess` (`translation.ts:706`), and cache hits pass them to `captureTranslationCacheHit` (`selectedTextTranslation.ts:161`). Capture is **default-off** (`isEnabled` gate, `diagnosticCapture.ts:83`) and redaction is delegated to a separate redactor (`DIAGNOSTIC_REDACTOR_VERSION` wiring in `mainProcessCompositionRoot.ts:545`). The **provider family itself logs only lengths**, never text (see `selectedTextTranslation.ts:122`–`128`, `:207`–`209`; base metadata carries `sourceLength`/`resultLength` only, `BaseTranslateProvider.ts:740`). The redactor/storage security is out of family scope (see Not Covered).

## Per-implementation notes

### Google (`GoogleTranslateProvider.ts`)

- **URL/encoding (VERIFIED, sound):** `buildGoogleTranslateProviderUrl` sets only `sl=auto`, `tl=<validated target>`, `op=translate`, `hl=en` via `URLSearchParams.set` (auto percent-encoded) — no text (`:162`–`169`). `navigateAndHandleConsent` rejects any page with `hasTextParameter` (`:379`).
- **Origin trust (VERIFIED):** `getOriginClassification` allowlists only `translate.google.{com,ru}` and `consent.google.{com,ru}`; everything else is `unexpected` → `consentOrChallenge` (`:105`–`120`). Consent handled by clicking a specific "Reject all" control and waiting for a translator-origin URL (`:255`–`269`).
- **Injection (VERIFIED, sound):** source insertion uses the native `HTMLTextAreaElement` value setter with `value` passed as an `evaluate` argument (`:287`–`295`); result scraping evaluates with the static selector `.ryNqvb` passed as an argument and returns `innerText`/`textContent` strings (`:306`–`323`).
- **Finding:** TRANSLATE-2 (`.ru` origin). Result polling is the lightest of the three (favorable for TRANSLATE-4).

### Bing (`BingTranslateProvider.ts`)

- **URL/origin (VERIFIED):** navigates to the fixed `https://www.bing.com/translator` (`:21`, `:249`); route accepted only when origin is `www.bing.com`, path is `/translator[/]`, and **search and hash are empty** (`:166`–`172`) — a tight allowlist. `loginOrChallenge` path substrings force `consentOrChallenge` (`:158`–`165`).
- **Injection (VERIFIED, sound):** `fillSourceText` dispatches a cancelable `beforeinput`, then assigns `editor.textContent = value` and dispatches `input`, with `value` passed as an `evaluate` argument (`:334`–`354`) — `textContent` does not parse HTML. Target selection matches `value` against real `<option>`s and sets `select.value` (`:405`–`422`); `value` is the validated language code.
- **Catalog handling (VERIFIED):** the target catalog is scraped, normalized, de-duplicated and serialized (`classifyBingCanonicalCatalog`, `:206`–`234`) and cached in a `WeakMap<Page, ReadonlySet<string>>` (`:440`); page-provided option values are used only as an **allowlist gate** in `selectAndVerifyTarget` (`:555`), never executed.
- **Blocking-surface detection (VERIFIED):** dialogs/challenge/captcha iframes counted via `BING_BLOCKING_SURFACE_SELECTOR` (`:36`) and mapped to `consentOrChallenge`.
- **Finding:** TRANSLATE-4 (heaviest per-poll snapshot cost).

### Yandex (`YandexTranslateProvider.ts`)

- **URL/origin (VERIFIED):** fixed `https://translate.yandex.com/en/translator` (`:21`, `:248`); route accepted only for `translate.yandex.com` with pathname in a fixed `/en[...]` set and empty hash (`:183`–`194`), and every readiness/result/verify/clear check re-asserts `route.route === 'translator'` and `!hasTextParameter` (`:570`, `:608`, `:717`, `:748`).
- **Injection (VERIFIED, sound):** `insertSourceText` dispatches `beforeinput`, assigns `textContent = value`, dispatches `input`, with `value` passed as an `evaluate` argument (`:431`–`449`). `selectTargetLanguage` compares each option's `data-value` to the target passed as `expectedValue` (`:366`–`375`) — no interpolation.
- **Most complex DOM contract:** primary/fallback source and destination editor resolution (`:378`–`413`, `:489`–`526`), an explicit forbidden-textarea guard (`YANDEX_FORBIDDEN_TEXTAREA_SELECTOR`, `:36`), and a checkbox/switch "Auto detect" chooser flow (`:302`–`340`, `:622`–`648`). More moving parts → more `pageContractFailure` surface if Yandex markup shifts, but all bounded and closed on failure.
- **Blocking-surface detection (VERIFIED):** challenge/captcha iframes and captcha attributes via `YANDEX_BLOCKING_SURFACE_SELECTOR` (`:44`).
- **Finding:** TRANSLATE-4 (multiple parallel reads per poll).

## Verified Sound

The following were checked and found correct:

- **No text-into-code / text-into-HTML injection (VERIFIED).** Every `page.evaluate`/`evaluateAll` in the family uses the function-plus-argument form; user text and language codes are passed as **serialized arguments**, and all selectors passed into `evaluate` are static module constants (grep of `*.ts` in `translateProviders/`: Google `:287`,`:306`; Bing `:292`,`:334`,`:382`,`:399`,`:408`; Yandex `:366`,`:431`). Source text reaches the DOM via native value setter (Google) or `textContent` assignment (Bing/Yandex) — never `innerHTML`, never string concatenation into code.
- **User text never enters the URL (VERIFIED).** Only `sl`/`tl`/`op`/`hl` are set (Google `:164`–`167`), via `URLSearchParams.set` (percent-encoding). All three providers reject pages carrying a `text` query parameter (`hasTextParameter`) before submitting.
- **Untrusted result treated as plain text end-to-end (VERIFIED).** Result flows to `clipboard.writeText` (`selectedTextTranslation.ts:145`), a string cache, a notification body **truncated** to `NOTIFICATION_BODY_MAX_CHARS` (`notifications.ts:434`–`438`), and IPC as a `{ text }` string (`ipc.ts:402`). No `dangerouslySetInnerHTML` exists in `src/renderer` (grep: none).
- **Strict origin/route allowlists (VERIFIED)** for all three providers, with `challenge|login|signin|sorry|captcha|auth` path detection mapping to `consentOrChallenge`.
- **Page lifecycle closed on error/stale/cancel post-submission paths (VERIFIED).** `closeOwnedResources` is the single close path with a `closePromise` dedup and page-then-context ordering (`BaseTranslateProvider.ts:841`–`880`); it is invoked on insertion failure, result failure/timeout, cleanup failure, and every stale/abort branch (`:299`,`:302`,`:308`,`:322`,`:585`,`:598`). `isOperationActive` (generation + `signal.aborted` + `shutDown`, `:654`) is checked between every step. On success the page is intentionally kept warm (see TRANSLATE-3).
- **No page/context event-listener leaks and no raw timers (VERIFIED).** Grep for `.on(`/`.once(`/`addListener`/`removeListener` in `translateProviders/` returns nothing; grep for `setTimeout`/`setInterval` returns only numeric timeout constants — all delays go through the injected `sleep`/`waitForClearPoll`/`waitForCatalogStability` dependencies and Playwright's own `timeout` options.
- **GC-friendly per-page state (VERIFIED).** `adapters`, `expectedTargets`, `preparedPages` (Google/Yandex), `validatedCatalogTargets` (Bing), `automaticSourceDetectionPages` (Yandex) are all `WeakMap`/`WeakSet` keyed by `Page`.
- **No unbounded queue growth (VERIFIED).** `operationQueue` is a promise-chain tail with noop continuations (`BaseTranslateProvider.ts:169`–`184`); `BackgroundBrowserOperationQueue` follows the same tail pattern; `TranslationRuntime.activeControllers` are added and removed in `finally` (`translation.ts:664`,`:768`).
- **Input validation before dispatch (VERIFIED).** `targetLanguage` is validated with `getTranslationLanguage` (base `:212`,`:263`; runtime `translation.ts:561`); `sourceText` type/emptiness/`maxInputCharacters` enforced (`BaseTranslateProvider.ts:272`–`277`); settings are shape-validated and repaired in `translationSettings.ts` with exact-key checks.
- **Cross-provider error consistency (VERIFIED).** All three share `BaseTranslateProvider`, the same failure-code enum (`translationProviderContracts.ts:5`), the same audit error-class mapping (`translationProviderAudit.ts:84`), and the same navigation-retry helper — so offline/consent/contract/timeout outcomes map uniformly.

## Not Covered

- CloakBrowser/Playwright internals: fingerprint seeding, humanization, proxy credential handling (`cloakBrowserLaunchOptions.ts` reviewed only for how translation builds context options; secret storage itself not audited).
- Full background/persistent browser context lifecycle in `browser.ts` — only translation's use of `launchContext` and `createCloakBrowserTranslationContextOptions` was reviewed (the file was not read in full).
- `DiagnosticCaptureService` redaction implementation, storage encryption, and retention — only the text hand-off from the translation path was traced (TRANSLATE-9).
- `providerAudit` base-class internals (metadata/sink behavior beyond the translation-specific subclass).
- Renderer translation UI components and the depth of IPC input validation in `ipc.ts`/`preloadApi.ts` (confirmed only that no HTML sink exists).
- Live-DOM accuracy of the CSS/ARIA selectors against the current Google/Bing/Yandex markup — cannot be verified against live sites; a provider markup change surfaces as `pageContractFailure` by design.
- `matchTranslationResultLineEndings`/`normalizeTranslationResultText` correctness beyond a read (`translationResultText.ts`) — trivial and appears correct.
