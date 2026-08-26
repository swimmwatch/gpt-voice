# 01 Capture The Controlled Performance Baseline

## Outcome

A deterministic, privacy-safe test harness records the current Google, Bing, and
Yandex cold and warm application-controlled latency, phase timing, sleep schedule,
and browser-evaluation counts before production translation behavior changes.

## Prerequisites

- The approved specification and this approved plan are present.
- Task 01 has separate execution authorization.
- No later packet has changed `src/main/translateProviders/` or
  `src/main/services/translation.ts` in the current workstream.

## Owned Requirements

- `OUT-004`
- `PERF-001`, `PERF-004`, `PERF-005`
- `SEC-009`
- `OBS-007`
- Baseline portions of `ACC-019` and `ACC-021`

## In Scope

- Test-only virtual clock, context/page, provider adapter, and counter fixtures.
- One cold and one warm controlled scenario for each provider.
- Safe baseline evidence under `tasks/evidence/`.
- Focused assertions that make accidental baseline drift visible.

## Out Of Scope

- Production source changes, provider selectors, result-acceptance changes,
  deadline activation, contract-version changes, live network access, packaging,
  or user-visible behavior.
- Absolute end-to-end service-level objectives or claims about provider/network
  performance.

## Task Contract

1. Add a dedicated deterministic performance test harness under
   `tests/main/translateProviders/`. Keep state in explicit test-owned classes;
   do not add a production benchmark service, mutable module runtime instance,
   dependency, or package script.
2. Run the real `GoogleTranslateProvider`, `BingTranslateProvider`, and
   `YandexTranslateProvider` classes against injected fake contexts/pages and
   provider-specific adapters. Reuse an existing test fixture only when it can be
   extracted without weakening or coupling its existing assertions.
3. Use the production 100 ms poll interval and 500 ms stability window. The virtual
   clock must advance for injected sleeps and for a fixed test-owned cost per
   browser evaluation so the current number and sequencing of cross-process reads
   are measurable without real-time sleeps.
4. Define a cold scenario as a translation on a fresh provider instance with no
   healthy initialized context. Define a warm scenario as the next translation on
   that same instance after successful clear confirmation and healthy-context reuse.
   Do not count a stale, closed, failed, or quarantined resource as warm.
5. Hold provider production and network time constant in all six scenarios. Use one
   non-sensitive synthetic source shape, exact target, deterministic provider
   response progression, and identical virtual browser costs.
6. Record at least these safe fields per provider/path cell: provider ID,
   `cold`/`warm`, total application-controlled duration, queue duration,
   initialization/navigation duration, readiness duration, submission-to-first-
   candidate duration, confirmation duration, target-verification duration,
   visible-clear duration, sleep durations, and browser-evaluation counts.
7. The harness and evidence must never contain source text, result text, URLs, DOM
   content, selectors copied from a live page, raw errors, cookies, sessions,
   screenshots, account data, or provider-controlled messages. Synthetic fixture
   values stay generic and are represented in evidence by lengths only.
8. Write the sanitized baseline to
   `tasks/evidence/performance-baseline.md`. Include the repository revision or
   explicit dirty-worktree note, the deterministic fixture version, platform, Node
   version, six cells, and measurement definitions. Do not paste test logs or raw
   page snapshots.
9. Make the baseline test assert that the recorded controlled values still match
   current behavior. Task 04 will replace baseline-only assertions with
   baseline-versus-candidate gates; Task 01 must pass on the unoptimized code.
10. If a named phase cannot be observed from the current injected seams, improve the
    test fixture or derive it from existing audit lifecycle events. Do not add
    production telemetry merely to complete this packet.

## Contracts And Boundaries

- Tests may instantiate providers and fake Playwright types; they never launch
  CloakBrowser or contact Google, Bing, or Yandex.
- All measurements are application-controlled test evidence. External provider and
  network latency remain explicitly absent.
- The baseline is immutable evidence for Tasks 04–06. Later updates must preserve
  the original values and add candidate values rather than rewriting history.

## Expected Files Or Components

- Add `tests/main/translateProviders/translationProviderPerformance.test.ts`.
- Add a focused test utility beside it only if provider-specific fixture classes
  would otherwise make the test unreadable.
- Add `tasks/evidence/performance-baseline.md` during execution.
- Existing provider test fixtures may be extracted into a shared test-only module
  only with behavior-preserving updates to their original tests.

## Acceptance Criteria

- Exactly six baseline cells exist: Google/Bing/Yandex multiplied by cold/warm.
- Cold scenarios create a context; warm scenarios prove the same confirmed healthy
  context is reused.
- Current 500 ms stability and provider-specific browser-read overhead are visible
  in the recorded controlled phases.
- Reordering, omitting, or adding a browser evaluation causes a focused baseline
  assertion to fail.
- Evidence contains only the allowlisted safe fields and generic fixture metadata.
- No production file changes in this packet.

## Verification

Run:

```text
node --import tsx --test tests/main/translateProviders/translationProviderPerformance.test.ts tests/main/translateProviders/GoogleTranslateProvider.test.ts tests/main/translateProviders/BingTranslateProvider.test.ts tests/main/translateProviders/YandexTranslateProvider.test.ts
npm run typecheck
npm run test:types
npx eslint tests/main/translateProviders
npx prettier --check "tests/main/translateProviders/**/*.ts" "docs/specs/translation-provider-reliability-remediation/tasks/evidence/**/*.md"
git diff --check
```

## Failure And Rollback

- A baseline that depends on real time, live network behavior, or sensitive content
  blocks the packet.
- If extracting existing fixtures changes provider-test behavior, revert the
  extraction and keep a dedicated performance fixture.
- Rollback removes only the new test-only harness and baseline evidence. No runtime
  migration or stored-data repair is involved.

## Manual Gates

- None. Do not launch CloakBrowser, visit a provider, package the application, or use
  credentials in this packet.
- No commit, push, pull request, publication, or packet 02 execution is authorized.

## References

- Mandatory:
  - `src/main/translateProviders/BaseTranslateProvider.ts`;
  - `src/main/translateProviders/GoogleTranslateProvider.ts`;
  - `src/main/translateProviders/BingTranslateProvider.ts`;
  - `src/main/translateProviders/YandexTranslateProvider.ts`;
  - the four corresponding provider test files;
  - `docs/agent-guides/project-conventions.md`, “Code And Logging,” “Electron And
    Providers,” and “Tests And Documentation.”
- Traceability:
  - approved specification sections “Observed Baseline,” “Successful Result
    Performance and Quality,” and acceptance criteria `ACC-019`, `ACC-021`.

## Completion And Handoff

- Mark Task 01 complete in `todo.md` only after the baseline and checks pass.
- Update `handoff.md` with the six safe baseline cells, changed files, checks, exact
  next packet 02, and blockers.
- Present the baseline evidence and stop. Do not commit or begin Task 02.
