# 02 Build The Base Translate Provider Lifecycle

## Outcome

An abstract main-process `BaseTranslateProvider` owns the complete common
translation lifecycle: one reusable nonpersistent context per provider,
pre-submission recovery, the one-way submission boundary, stable result
acceptance, generation-based late-result suppression, clear-or-close cleanup,
safe failures, invalidation, and shutdown.

## Prerequisites

- Task 01 is complete and approved.
- Task 02 has separate execution authorization.
- Shared provider metadata, exact target guards, and contract versions are
  available.

## Owned Requirements

- `ARCH-001`–`ARCH-003`
- `ARCH-005`–`ARCH-008`
- `RUN-005`–`RUN-013`
- `SEC-002`–`SEC-006`
- `AC-AUTO-001`

## In Scope

- Abstract provider class and provider-hook contract.
- Closed internal failure codes and sanitized failure/result types.
- Nonpersistent translation launch options and injected context creation.
- Typed Google/Bing/Yandex navigation-service identities on the existing
  bounded transient retry seam.
- Context/page reuse, invalidation, cleanup, and shutdown.
- Submission-phase tracking, result stabilization, and generation tokens.
- Deterministic fake-provider/context/page lifecycle tests.

## Out Of Scope

- Google, Bing, or Yandex DOM behavior, provider factories, settings
  persistence, IPC, selected-text clipboard flow, UI, live network tests, or
  monitor code.
- Persistent user-data directories, voice-provider pages or profiles, provider
  APIs, challenge bypass, automatic fallback, text splitting, or truncation.

## Task Contract

1. Add an abstract `BaseTranslateProvider` that receives immutable provider
   metadata plus injectable main-process dependencies. It owns protected
   context/page state; subclasses cannot replace the common `translate` or
   `shutdown` lifecycle.
2. Give the final, non-overridable `translate` method a main-only typed request
   containing provider ID, exact target code, and source text. Revalidate that
   the request provider equals the instance metadata ID and that all values
   pass the guards below. Return a discriminated success/failure outcome;
   expected page failures do not escape as raw thrown errors.
3. Define a closed failure classification covering at least:
   - unsupported provider;
   - unsupported target language;
   - empty input;
   - input too long;
   - navigation or connection failure;
   - consent or challenge blocking;
   - missing, ambiguous, or changed page contract;
   - result timeout or empty result;
   - cancelled or stale operation;
   - cleanup failure.
4. Failure values expose only a code, safe phase, provider ID, target code,
   contract version, source/result lengths when known, duration, and attempt
   count. Raw exceptions, page text, HTML, URLs, responses, cookies, or storage
   never leave the provider boundary. Provider/target fields contain only
   values already validated against public metadata; an unsupported raw input
   is represented by its fixed failure code and is never echoed.
5. Extend the existing CloakBrowser launch-option builder with a
   nonpersistent `translation` context kind:
   - use validated proxy, locale, timezone, fingerprint, background-mode, and
     humanization settings;
   - use `launchCloakContext`, never `launchCloakPersistentContext`;
   - never set `userDataDir` or use `BROWSER_CACHE_DIR`.
6. Each provider instance lazily owns at most one context and one page. The
   healthy page is reused by later operations for that provider; different
   provider instances never share a context.
7. Before browser creation, validate metadata, exact target membership, blank
   input, and maximum character count. The selected-text service repeats the
   pre-browser guard in Task 07 as defense in depth.
8. The base lifecycle calls narrowly defined subclass hooks for:
   - allowlisted navigation and consent;
   - page readiness and challenge classification;
   - automatic source detection;
   - exact target selection and verification;
   - stale source/result clearing and previous-result reading;
   - one full-string source insertion;
   - normalized result reading;
   - visible source/result clearing confirmation.
9. Permit the existing bounded transient `page.goto` retry inside provider
   navigation. Extend `BrowserNavigationService` here with explicit Bing and
   Yandex translator identities alongside the existing Google identity, and
   keep the existing attempt, backoff, retryability, safe-error, and
   no-fallthrough policy shared. In addition, permit at most one clean
   page/context readiness recovery before insertion when a subclass returns an
   explicitly recoverable pre-submission classification.
10. Mark submission immediately before invoking the one insertion hook. After
    that point, no code path may reload, recreate, navigate, retry insertion, or
    submit again. A timeout or page failure returns a typed terminal failure for
    a later manual hotkey action.
11. Before insertion, require automatic detection, exact target verification,
    empty source/result state, and a normalized previous-result marker.
12. Accept a result only when it:
    - is nonblank after normalization;
    - differs from the previous marker;
    - is identical across two normalized reads 500 ms apart;
    - still satisfies the provider's executable target check.
13. Allocate a monotonically changing generation token for every operation and
    invalidation. A stale, closed, superseded, or cancelled generation cannot
    return a success/failure that downstream code can apply.
14. After a valid result, require subclass clear confirmation. If clear fails,
    invalidate and close that provider context. Return success only after
    either clear or confirmed close.
15. If both clear and close fail, return `cleanup failure`, keep ownership of
    the failed resource for a later shutdown attempt, and expose no result as
    successful.
16. A terminal page-contract failure invalidates only the affected provider.
    `shutdown()` invalidates current generations, closes owned pages/contexts
    once, tolerates already-closed resources, and leaves no dangling reference.
17. Dependency injection must make timing, context creation, page behavior,
    normalization reads, and close failures deterministic without live
    Playwright or Electron.

## Contracts And Boundaries

- Main owns browser resources and safe diagnostics. No base type is imported
  by the renderer or exposed through preload.
- The base may log only the allowlisted metadata in Task Contract item 4.
  Navigated URLs are prohibited even when they appear source-free at the time.
- Visible clearing is defense in depth and must not be named or tested as
  provider-side deletion.
- One provider's contract failure or shutdown cannot close a different
  provider's context.
- The class remains unregistered in this packet; production Google behavior
  remains on the legacy path until Task 07.

## Expected Files Or Components

- Add `src/main/translateProviders/BaseTranslateProvider.ts`.
- Add focused internal failure/request/result contracts beside the base, for
  example `translationProviderErrors.ts`.
- Update `src/main/cloakBrowserLaunchOptions.ts` with a nonpersistent
  translation option constructor.
- Reuse `src/main/cloakbrowser.ts` and
  update `src/main/browserNavigationRetry.ts`; do not duplicate browser launch
  or transient-navigation policy in subclasses.
- Add:
  - `tests/main/translateProviders/BaseTranslateProvider.test.ts`;
  - focused launch-option tests if no existing file cleanly owns them;
  - extend `tests/main/browserNavigationRetry.test.ts` for all three
    translation service identities without changing retry semantics.

## Acceptance Criteria

- A fake valid provider proves lazy creation, same-provider reuse, and separate
  instances' context isolation.
- Tests cover every `AC-AUTO-001` case: valid result, unsupported provider and
  language, over-limit rejection before context creation, one pre-submit
  recovery, no post-submit replay, stale previous-result rejection, two-read
  stability, late-result suppression, clear success, close-after-clear-failure,
  cleanup failure, and shutdown.
- Context options contain no persistent user-data directory and preserve the
  validated CloakBrowser settings named above.
- Navigation tests expose explicit Google/Bing/Yandex translation identities
  and prove they retain the existing bounded retryability and safe-error
  policy.
- Source insertion hook is called at most once per operation.
- Cleanup failure never returns the result payload as a success.
- Raw injected errors, URLs, and unsupported provider/target sentinels do not
  appear in returned failures or captured safe log metadata.
- The base cannot import provider-specific selectors, labels, or origins.

## Verification

Run:

```text
node --import tsx --test tests/main/translateProviders/BaseTranslateProvider.test.ts tests/main/cloakBrowserLaunchOptions.test.ts tests/main/browserNavigationRetry.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/translateProviders src/main/cloakBrowserLaunchOptions.ts src/main/browserNavigationRetry.ts tests/main/translateProviders tests/main/cloakBrowserLaunchOptions.test.ts tests/main/browserNavigationRetry.test.ts
npx prettier --check "src/main/translateProviders/**/*.ts" "src/main/cloakBrowserLaunchOptions.ts" "src/main/browserNavigationRetry.ts" "tests/main/translateProviders/**/*.ts" "tests/main/cloakBrowserLaunchOptions.test.ts" "tests/main/browserNavigationRetry.test.ts"
```

If the launch-option tests use a different existing filename, run that exact
focused file and record it in the handoff.

## Failure And Rollback

- Any inability to prove the one-way submission boundary, cleanup gate,
  generation suppression, or nonpersistent context options blocks the packet.
- Rollback removes the unregistered base/lifecycle files, reverts the
  translation launch-option addition, and removes the new Bing/Yandex
  navigation identities plus their retry-test cases. No production provider is
  active yet.
- A test that needs a live page indicates an insufficient dependency seam;
  improve the seam rather than adding network assertions.

## Manual Gates

- None. Do not launch CloakBrowser or visit a provider in this packet.
- No dependency, packaging, commit, push, pull request, or release action is
  authorized.

## References

- Mandatory:
  - `src/main/cloakBrowserLaunchOptions.ts`;
  - `src/main/cloakbrowser.ts`;
  - `src/main/browserNavigationRetry.ts`;
  - `tests/main/browserNavigationRetry.test.ts`;
  - existing base-provider dependency-injection tests under
    `tests/main/providers/`;
  - `docs/agent-guides/project-conventions.md`, “Electron And Providers” and
    “Desktop, Browser, And Packaging”.
- Traceability:
  - approved specification sections “Shared Provider Lifecycle”, “Safe Failure
    Contract”, “Translation Operation Requirements”, and “Security and Privacy
    Requirements”;
  - decisions `security.context-lifecycle`,
    `failure.submission-replay`, and
    `security.post-operation-cleanup`.

## Completion And Handoff

- Mark Task 02 complete in `todo.md`.
- Update `handoff.md` with the lifecycle state machine, changed files, exact
  checks, and Tasks 03–05 as the next independently executable packets.
- Present lifecycle evidence and stop. Do not commit or begin a provider packet
  in the same invocation.
