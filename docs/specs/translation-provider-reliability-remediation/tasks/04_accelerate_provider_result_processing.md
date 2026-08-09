# 04 Accelerate Provider Result Processing

## Outcome

Google, Bing, and Yandex accept each correct result at the earliest contract-valid
moment through one coherent provider observation, use verified public completion
evidence when available, fall back safely to two stable reads 500 ms apart, enforce
an absolute 15-second result deadline, and clear visible state without redundant or
overlapping browser work.

## Prerequisites

- Tasks 01–03 are complete and approved.
- Task 04 has separate execution authorization.
- The baseline, lifecycle, bounded resource cleanup, and contract version
  `2026-08-09` are active.

## Owned Requirements

- `OUT-004`
- `TIME-002`–`TIME-003`, `TIME-009`
- `PERF-001`–`PERF-007`
- `QUAL-001`–`QUAL-002`
- `ARCH-007`–`ARCH-009`
- `CONC-007`
- `LIFE-003`–`LIFE-004`
- `FAIL-004`–`FAIL-005`
- `SEC-001`, `SEC-004`, `SEC-008`–`SEC-009`
- `OBS-006`–`OBS-007`
- `COMP-004`, `COMP-006`
- `ACC-003`, `ACC-010`–`ACC-011`, `ACC-017`–`ACC-020`

## In Scope

- Shared result-observation and completion-evidence contracts.
- Absolute result-phase polling and fallback stabilization.
- Coherent Google, Bing, and Yandex result snapshots and efficient clear snapshots.
- Provider fixture matrices, cold/warm counters, and candidate comparison against
  Task 01 baseline.
- Verification that selection and startup warming behavior does not expand.

## Out Of Scope

- Provider origins, route allowlists, target inventories, input limits,
  normalization semantics, consent/challenge policy, retries, navigation backoff,
  source insertion, prewarming, private endpoints, network interception, IPC/UI,
  settings, database, dependencies, packaging, or release changes.

## Task Contract

1. Replace the base pair of `readNormalizedResult` plus later
   `verifySelectedTarget` with one narrow protected result-observation hook. Its
   successful value contains normalized text, current-target verification, and a
   closed completion classification sufficient for the base to choose fast
   acceptance or fallback. Provider failures remain typed hook failures.
2. Define completion classifications so production can represent at least:
   verified complete, incomplete, unavailable/unsupported, and ambiguous or
   contradictory. Completion evidence is additive; it never replaces origin, route,
   challenge/consent, control, generation, previous-result, normalization,
   current-submission, or target checks.
3. A provider adapter should obtain result text and every route/control/target/
   completion field required at that polling point through one coherent public-page
   snapshot wherever Playwright permits. Do not make sequential browser calls merely
   to reconstruct state available in the same evaluation. Invalidate any cached or
   coalesced state on navigation, generation, target, reset, shutdown,
   consent/challenge transition, or page ambiguity.
4. Google's observation must retain exact translator-family/route/auto-source/target
   checks and result-region/branch normalization. Bing's must retain exact public
   route, public-control, source/target/output-language, and result checks. Yandex's
   must retain exact route, auto-source/editor, selected-target, visibility, and
   normalized result checks.
5. Do not enable a provider-specific fast completion signal until a non-sensitive
   public-page inspection confirms that the signal is stable, allowlisted, and tied
   to the current submission. Record only the signal's safe semantic meaning and
   reviewed selector/state contract; never record page text, URL parameters,
   screenshot, raw DOM, cookies, sessions, or account data.
6. When verified-complete evidence accompanies a non-empty current result that
   differs from the previous marker and the target is verified, accept that
   observation before 500 ms. The first non-empty result without that evidence is
   never accepted.
7. When completion is incomplete, unavailable, unsupported, ambiguous, stale, or
   contradictory, require two identical normalized, current-target observations at
   least 500 ms apart. Any change restarts candidate confirmation without extending
   the absolute deadline. A provider with no safe completion signal must use this
   fallback.
8. Start the absolute 15-second result phase immediately after successful source
   insertion. Browser observation duration, completion classification, fallback
   delay, polling delay, scheduling, and target verification all consume it. The
   earlier remaining operation deadline wins; equality expires.
9. Keep one result observation in flight per provider generation. Schedule the next
   poll only after the prior observation settles and passes identity/elapsed checks.
   No busy loop, overlapping evaluation, or post-terminal poll is allowed.
10. Preserve the previous-result marker and exact line-ending matching. Incremental,
    temporarily stable, repeated-prefix, stale previous, hidden, wrong-target,
    post-navigation, and loading-sentinel text must not be returned.
11. Refactor clear observation only where it removes redundant reads while retaining
    exact provider-specific clear state. Begin immediately, accept the first valid
    cleared snapshot, keep one read in flight, and enforce the existing 1,500 ms
    provider clear bound nested inside the shared five-second cleanup budget.
12. Success remains clear-or-close-before-return. A failed or timed-out clear closes
    the exact resource; unconfirmed close remains `cleanupFailure` and quarantine.
13. Update the controlled performance fixture with candidate measurements. Each of
    the six provider/path cells must be strictly faster in total application-
    controlled success latency than its immutable Task 01 baseline. No named phase
    may regress and browser evaluation/timer counts may not increase.
14. Derive measurement from injected clocks, fake adapters, and sanitized audit/test
    counters. Add no production analytics, persisted timings, ordinary log output,
    renderer surface, or database field.
15. Prove that startup still prepares only the selected provider, other providers
    initialize on demand, healthy contexts reuse normally, and provider/language
    selection does not navigate, create a session, or issue a provider request.
16. Keep all provider versions at `2026-08-09` and update contract tests if provider
    observation types change. Do not perform a second version bump inside this
    workstream.

## Contracts And Boundaries

- Provider-specific public-page details stay inside their provider/adapter classes;
  the base owns only generic timing, evidence state, fallback, and lifecycle.
- No hidden API, private endpoint, source-bearing URL, response interception,
  challenge suppression, consent acceptance, provider fallback, or replay is
  permitted.
- Unsupported completion evidence is normal fallback, not a page-contract failure.
- Live inspection is evidence only; automated acceptance remains deterministic and
  network-free.

## Expected Files Or Components

- Update:
  - `src/main/translateProviders/translationProviderContracts.ts`;
  - `src/main/translateProviders/translationOperationLifecycle.ts`;
  - `src/main/translateProviders/BaseTranslateProvider.ts`;
  - `src/main/translateProviders/GoogleTranslateProvider.ts`;
  - `src/main/translateProviders/BingTranslateProvider.ts`;
  - `src/main/translateProviders/YandexTranslateProvider.ts`;
  - `src/main/translateProviders/translationProviderFactory.ts` only for canonical
    shared timing dependencies;
  - the base and three provider test files;
  - `tests/main/translateProviders/translationProviderPerformance.test.ts` and its
    test-only utilities;
  - composition/shared contract tests that guard warming and version behavior;
  - `tasks/evidence/performance-baseline.md` by appending candidate comparison, never
    rewriting baseline values.

## Acceptance Criteria

- Each provider fixture covers incremental, temporarily stable, repeated-prefix,
  stale previous, wrong-target, route transition, contradictory completion,
  verified completion, and absent completion states.
- Verified completion accepts strictly before 500 ms; every ambiguous or unsupported
  state uses the full fallback and still verifies target/current submission.
- Result deadline tests charge browser reads and sleeps, cover 14,999/15,000 ms,
  operation-deadline precedence, late observations, and no post-terminal scheduling.
- Browser doubles prove one coherent required observation per cycle, no overlapping
  result/clear evaluation, required invalidation, and no baseline count regression.
- All six controlled cold/warm cells are strictly faster with no phase regression or
  quality weakening.
- Selection/startup tests prove no new prewarming, network, or browser-session side
  effect.

## Verification

Run:

```text
node --import tsx --test tests/main/translateProviders/BaseTranslateProvider.test.ts tests/main/translateProviders/GoogleTranslateProvider.test.ts tests/main/translateProviders/BingTranslateProvider.test.ts tests/main/translateProviders/YandexTranslateProvider.test.ts tests/main/translateProviders/translationProviderPerformance.test.ts tests/main/translationRuntime.test.ts tests/main/mainProcessCompositionRoot.test.ts tests/shared/translationProvider.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/translateProviders tests/main/translateProviders tests/main/translationRuntime.test.ts tests/main/mainProcessCompositionRoot.test.ts src/shared/translationProvider.ts tests/shared/translationProvider.test.ts
npx prettier --check "src/main/translateProviders/**/*.ts" "tests/main/translateProviders/**/*.ts" "tests/main/translationRuntime.test.ts" "tests/main/mainProcessCompositionRoot.test.ts" "src/shared/translationProvider.ts" "tests/shared/translationProvider.test.ts" "docs/specs/translation-provider-reliability-remediation/tasks/evidence/**/*.md"
git diff --check
```

## Failure And Rollback

- Missing improvement in any provider/path cell, weaker target/page checks, partial
  result acceptance, first-non-empty acceptance, overlapping polling, increased
  evaluation count, prewarming, or sensitive evidence blocks the packet.
- If no safe completion signal exists for a provider, keep that provider on the
  500 ms fallback and obtain its strict controlled improvement from coherent
  snapshots/target verification. Never invent a selector to force a fast path.
- Rollback restores the previous provider observation hooks and baseline-only
  fixture while keeping Task 03 reliability behavior. Revert all three provider
  adapters coherently if the shared observation contract is rolled back.

## Manual Gates

- Before enabling a provider-specific completion signal, obtain explicit
  execution-time authorization for a non-sensitive live public-page inspection.
  Use no login, credentials, private text, challenge bypass, screenshot retention,
  or provider-side mutation beyond one ordinary synthetic translation.
- If live inspection is unavailable, retain `unsupported` completion and fallback;
  record the verification gap in `handoff.md`.
- No packaging, commit, push, pull request, publication, or Task 05 execution is
  authorized.

## References

- Mandatory:
  - `src/main/translateProviders/BaseTranslateProvider.ts`;
  - each provider source and corresponding fixture test;
  - `tests/main/translateProviders/translationProviderPerformance.test.ts` and Task
    01 baseline evidence;
  - `src/shared/translationProvider.ts`;
  - `docs/agent-guides/project-conventions.md`, provider, browser, logging, privacy,
    and test sections.
- Traceability:
  - approved specification sections “Timing Model,” “Successful Result Performance
    and Quality,” “Provider and Browser Lifecycle,” “Security and Privacy,” and
    acceptance criteria `ACC-003`, `ACC-017`–`ACC-020`.

## Completion And Handoff

- Mark Task 04 complete only after provider fixtures and controlled comparison pass.
- Update `handoff.md` with completion-signal support/fallback per provider, safe
  candidate metrics, changed files, checks, exact next packet 05, and blockers.
- Present performance and quality evidence and stop. Do not commit or begin Task 05.
