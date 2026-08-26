# Translation Providers Review Comments to Address

Date: 2026-08-09  
Source review: `docs/reviews/provider-review-2026-08-08-translation-providers.md`  
Assessment basis: current `feat/local-whisper-provider` source, directly related
tests, the approved Translation Providers specification and task packets, and one
nearby review-assessment precedent.

## Address in the Current Remediation

### 1. TRANSLATE-1 and TRANSLATE-7 — Enforce absolute wall-clock translation deadlines

**Locations:**

- `src/main/services/translation.ts:638`
- `src/main/translateProviders/BaseTranslateProvider.ts:343`
- `src/main/translateProviders/BaseTranslateProvider.ts:573`
- `src/main/browserNavigationRetry.ts:88`
- `src/main/translateProviders/GoogleTranslateProvider.ts:22`
- `src/main/translateProviders/BingTranslateProvider.ts:22`
- `src/main/translateProviders/YandexTranslateProvider.ts:23`

The review identifies one substantive latency problem through two related findings.
`TranslationRuntime.translateWithSnapshot()` has no absolute deadline around the
interactive provider call. Before submission, the base may run two complete
preparation passes, while each provider navigation may use four attempts with a
60-second `page.goto` timeout. The resulting worst path can keep a hotkey action
pending for several minutes.

The nominal 15-second result timeout is also not a wall-clock timeout.
`awaitStableResult()` derives an iteration count from the timeout and poll interval,
but browser reads, the 500 ms stability read, and their execution time are outside
that calculation. A slow or stuck browser read can therefore exceed the advertised
budget substantially.

Introduce an injected monotonic deadline for the complete interactive translation
and enforce a separate absolute deadline for the result phase. Deadline expiry must
abort and invalidate the active provider operation and close its page/context so an
in-flight Playwright call cannot continue with selected text after the caller has
settled. Preserve the no-replay rule after source insertion and map expiry to a
typed, phase-appropriate outcome and one terminal audit event.

Do not solve this by applying `Promise.race` alone. The existing
`InitialProviderReadinessDeadline` explicitly permits provider work to ignore its
cancellation signal until the caller performs provider cancellation; copying only
its settlement race would bound the caller while leaving browser work and the
provider queue alive in the background.

Add deterministic tests for:

- deadline expiry during a stalled navigation attempt and during the second
  preparation pass;
- result reads and the stability delay consuming the remaining result budget;
- deadline expiry after insertion closing resources without reinsertion or replay;
- a timed-out operation not wedging the serialized provider queue;
- cancellation, shutdown, typed outcome metadata, and exactly one terminal audit
  event on every deadline path.

## Address as Follow-up Lifecycle Cleanup

### 2. TRANSLATE-5 — Remove stale context ownership after `newPage()` loses its generation

**Location:** `src/main/translateProviders/BaseTranslateProvider.ts:549`

`ensurePage()` publishes the newly created context to `this.context` before awaiting
`ownedBrowser.newPage()`. If a newer translation invalidates the generation while
that await is pending, the stale branch hands the page and context to
`releaseDetachedResources()` but leaves `this.context` pointing at the context being
closed. The next queued operation observes that stale field and closes the same
context again before it can create a fresh one.

This is not a demonstrated persistent leak, but it violates the base class's
ownership invariant and creates an avoidable fire-and-forget close versus owned-close
race. Clear `this.context` when it still equals `ownedBrowser` before releasing the
detached resources. Keep the identity guard so a newer context can never be erased.

Add a deterministic regression test with a deferred `newPage()` call: invalidate the
first generation while page creation is pending, let the stale call settle, then run
the queued generation and prove that it creates and owns a fresh context without a
second owned close of the detached context.

## Review Comments Not Selected

### TRANSLATE-2 — Keep the approved Google origin unless the specification is reopened

The current `translate.google.ru` navigation target is not an accidental hardcode;
it is the canonical origin required by the approved Google provider task packet,
while both `.ru` and `.com` translator and consent origins are allowlisted. The
review proves which hostname receives the request, but it does not prove the claimed
physical routing or data jurisdiction. Changing the target is a product/privacy and
live-provider compatibility decision requiring new research and a specification
revision, not a corrective implementation edit from this review.

### TRANSLATE-3 — Do not add idle eviction against the accepted reuse contract

`ARCH-006`, `SEC-006`, and the resolved product decisions explicitly retain one
isolated, nonpersistent context per used provider until invalidation or application
exit. The implementation closes contexts on provider failure, settings changes,
reset, shutdown, and failed visible-state clearing as required. No measured memory
regression accompanies the review, so an idle timer should not replace this approved
warm-reuse tradeoff.

### TRANSLATE-4 — Measure before weakening per-poll contract validation

Bing's control snapshot and Yandex's editor snapshot are heavier than Google's
result-only read, but those snapshots also enforce each provider's ambiguity and
fail-closed DOM contract while a result is pending. The review supplies no profile,
browser round-trip count, CPU result, or user-visible regression. Do not remove those
checks based on source inspection alone. If profiling later identifies result polling
as material, optimize the complete provider-specific validation boundary with
before/after measurements and tests that preserve challenge, route, and ambiguous
control detection.

### TRANSLATE-6 — Keep conservative retry classification

The shared retry helper recognizes stable Chromium network error identifiers and
common Node timeout/network codes. An unknown or wrapped error fails immediately
rather than being retried, which is the safe behavior for consent, authentication,
and page-contract failures. The review demonstrates no platform-specific error that
is currently misclassified, so broadening the string matcher is not justified.

### TRANSLATE-8 — Keep the specified prior-result guard

`RUN-009` explicitly requires a result to differ from the prior normalized result,
and every provider confirms empty visible state before inserting new text. The edge
case is possible for different inputs that translate to identical output, but the
review provides no reproduction and classifies it as informational. Changing this
guard requires revisiting the stale-result isolation contract rather than making a
local implementation edit.

### TRANSLATE-9 — Keep the explicit diagnostic-capture boundary

Passing source and result text into `DiagnosticCaptureService` is intentional,
default-off behavior. Enabled capture routes both strings through fail-closed
redaction and validation before storage, and privacy integration tests cover
prohibited values. Provider audit and ordinary logs continue to receive lengths and
typed metadata only. No provider-family correction follows from this informational
handoff.

## Verdict and Verification Gaps

Address TRANSLATE-1 and TRANSLATE-7 together as the substantive reliability
correction. Address TRANSLATE-5 as bounded lifecycle cleanup. Do not schedule the
remaining comments without new evidence or an explicit revision of the approved
provider contract.

This assessment changed documentation only. No runtime implementation was modified,
and no provider test suite or live browser canary was run. Each selected item lists
the focused deterministic verification expected with its eventual remediation.
