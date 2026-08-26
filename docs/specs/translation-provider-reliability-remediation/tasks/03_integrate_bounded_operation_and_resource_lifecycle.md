# 03 Integrate Bounded Operation And Resource Lifecycle

## Outcome

Every validated cache-miss translation is governed from pre-registry dispatch
through provider queueing and terminal cleanup by the shared lifecycle. Expired,
cancelled, stale, reset, or shut-down work loses authority; exact browser resources
close or remain quarantined under a five-second cleanup bound; and user-visible
timeout effects are deterministic and private.

## Prerequisites

- Tasks 01–02 are complete and approved.
- Task 03 has separate execution authorization.
- The lifecycle primitive, `timed-out` contract, locale key, and controlled baseline
  are available.

## Owned Requirements

- `OUT-002`–`OUT-003`
- `TIME-001`, `TIME-003`–`TIME-008`
- `ARCH-001`–`ARCH-008`
- `CONC-001`–`CONC-006`
- `LIFE-001`–`LIFE-008`
- `FAIL-001`–`FAIL-008`
- `SEC-001`–`SEC-007`
- `OBS-001`–`OBS-006`
- `COMP-001`, `COMP-003`–`COMP-005`
- `CONF-001`–`CONF-003`
- `ACC-001`–`ACC-010`

## In Scope

- Composition-root production adapters for translation lifecycle clocks, timers,
  resume notifications, and abort construction.
- Runtime creation before registry lookup and propagation through the internal
  provider request.
- Base-provider queue, generation, timeout, cleanup, quarantine, stale `newPage()`,
  reset, and shutdown integration.
- Timeout audit, connection, clipboard/cache/notification, and privacy behavior.
- Coordinated provider contract-version update to `2026-08-09`.

## Out Of Scope

- Provider DOM selectors, coherent result snapshots, adaptive completion evidence,
  polling/clear optimization, new prewarming, IPC/renderer/settings/database changes,
  dependencies, packaging, live providers, or release work.

## Task Contract

1. Extend the main-process translation environment with complete lifecycle
   dependencies. `MainProcessCompositionRoot` constructs or injects the per-operation
   lifecycle factory; `src/main/main.ts` supplies `Date.now`, `performance.now`,
   timers, `AbortController`, and an Electron `powerMonitor` resume subscription
   whose listener is removable. Do not expose Electron or lifecycle state outside
   main.
2. In `TranslationRuntime.translateWithSnapshot`, validate input first, then create
   the operation lifecycle immediately before registry lookup. This moment is the
   60-second start. The budget includes registry dispatch, provider queue wait,
   context/navigation/readiness/preparation, insertion, result work, and target
   verification. Cache hits and copy automation remain outside it.
3. Preserve `AbortSignal` on `TranslationProviderRequest` and add the narrow internal
   lifecycle handle needed by `BaseTranslateProvider`. The provider and runtime must
   observe the same owned controller and terminal arbiter rather than constructing
   competing timeouts.
4. Race queued and in-progress provider work against authoritative operation expiry.
   Expiry before queue entry or source insertion returns `timed-out`, prevents
   insertion, and does not wedge the serialized queue. A Playwright promise that
   ignores abort cannot keep the caller pending beyond timeout plus cleanup.
5. Replace loose page/context fields with identity-guarded ownership sufficient to
   distinguish healthy active, closing, and quarantined resources. At most one
   active context and one unresolved quarantine may exist per provider.
6. Correct the stale `newPage()` path: publish the context only for the current
   provider generation; if page creation resolves stale, clear the matching context
   field only when it still references that exact context, never publish the page,
   and transfer the page/context pair to exactly one detached cleanup owner.
7. On timeout, cancellation, supersession, reset, shutdown, ordinary terminal
   failure, failed visible clear, or success cleanup, invalidate applicability before
   cleanup. An old listener or close continuation may mutate only the exact captured
   resource/generation and can never clear or close newer ownership.
8. Start the five-second cleanup budget on every terminal path. Validation with no
   browser resource may confirm immediately. Otherwise, coalesce repeated close
   requests, preserve page-before-context ordering where required, and return only
   after clear/close confirmation, failure, or exact cleanup expiry.
9. If required cleanup throws, reports failure, or is not confirmed by 5,000 ms,
   return `cleanupFailure`, set `cleanup-failed`, and keep the resource quarantined.
   A late confirmed close may release quarantine for future operations but cannot
   revise the outcome, audit terminal, clipboard, cache, notification, or connection
   state already returned.
10. While unresolved quarantine exists, do not create another context for that
    provider. A later translation returns bounded `cleanupFailure`; reset/shutdown or
    a confirmed late close may clear the quarantine. Another provider remains
    isolated and usable.
11. Preserve the one-way submission boundary. After insertion, timeout or ambiguity
    never navigates, recreates, retries, or reinserts source text. A later manual
    hotkey action is the only retry.
12. Enforce terminal precedence through the shared arbiter. Reset/shutdown/
    supersession already committed before deadline remains discardable stale work;
    expiry wins at equality; unconfirmed cleanup overrides the underlying outcome.
    Audit lifecycle forwarding emits exactly one terminal event and suppresses every
    late phase/retry/recovery/terminal callback.
13. A non-discarded `timed-out` selected-text action restores the previous clipboard,
    writes no result, adds no cache entry, emits no success notification or
    diagnostic capture, and shows only `error.translationTimedOut`. Stale/cancelled
    work retains existing silent-discard behavior.
14. Timeout connection state is `not-connected` with existing
    `unexpected-failure`; cleanup failure remains `cleanup-failed`. No renderer,
    preload, IPC, or persisted state shape changes.
15. Bump Google, Bing, and Yandex `contractVersion` together from `2026-07-25` to
    `2026-08-09`. Update cache-identity, audit, manifest, and shared contract tests;
    provider IDs, targets, limits, and settings remain byte-for-byte compatible.
16. Keep audit/log/test data allowlisted: safe provider ID, contract version, target,
    phase, durations, counts, lengths, generation/resource identity, post-submission,
    and confirmed page-closed state only. Never expose source/result text, URL, raw
    error, stack, DOM, cookies, or sessions.

## Contracts And Boundaries

- `TranslationRuntime`, `BaseTranslateProvider`, and the lifecycle class remain
  state-owning main-process classes constructed from complete dependencies.
- Provider initialization stays serialized and selected-provider-only. Translation
  selection still has no network or prewarm side effect.
- Cleanup touches only isolated translation contexts; voice-provider browser state
  and other providers are outside ownership.
- No worker, lock, synchronous blocking wait, automatic provider fallback, retry
  expansion, or new external request is permitted.

## Expected Files Or Components

- Update:
  - `src/main/translateProviders/translationOperationLifecycle.ts`;
  - `src/main/translateProviders/translationProviderContracts.ts`;
  - `src/main/translateProviders/BaseTranslateProvider.ts`;
  - `src/main/translateProviders/translationProviderFactory.ts` and registry
    contracts only as required by complete dependencies;
  - `src/main/services/translation.ts`;
  - `src/main/services/selectedTextTranslation.ts` only for behavior not already
    satisfied by its typed failure path;
  - `src/main/di/mainProcessCompositionRoot.ts` and `src/main/main.ts`;
  - `src/shared/translationProvider.ts`;
  - focused runtime, base-provider, selected-text, composition, audit, privacy,
    registry, and shared contract tests.
- Add a focused resource-ownership test utility only if it reduces duplication
  without becoming production state.

## Acceptance Criteria

- Fake-clock tests prove expiry at every runtime/provider phase, including queue
  wait, and exact 60,000 ms precedence.
- A timed-out Playwright hook that never resolves still yields a bounded outcome and
  begins exact-resource cleanup; late resolution has no side effect.
- Cleanup tests cover every terminal path, 4,999/5,000 ms, throw/failure/hang,
  coalesced close, late close, quarantine block/release, and provider isolation.
- Deferred `newPage()` tests prove identity-guarded detachment, no double ownership,
  no double close, and safe later generation behavior.
- Concurrency permutations yield one outcome, one audit terminal, no post-terminal
  event, no newer-state mutation, and no dangling timer/listener.
- Selected-text tests prove timeout clipboard restoration and absence of cache,
  success notification, diagnostic capture, and result text.
- All providers report contract version `2026-08-09`; IPC/renderer/settings shapes
  remain unchanged.

## Verification

Run:

```text
node --import tsx --test tests/main/translateProviders/translationOperationLifecycle.test.ts tests/main/translateProviders/BaseTranslateProvider.test.ts tests/main/translateProviders/translationProviderRegistry.test.ts tests/main/translationRuntime.test.ts tests/main/selectedTextTranslation.test.ts tests/main/mainProcessCompositionRoot.test.ts tests/main/providerAudit/providerAuditMappings.test.ts tests/main/providerAuditPrivacy.test.ts tests/shared/translationProvider.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/translateProviders src/main/services/translation.ts src/main/services/selectedTextTranslation.ts src/main/di/mainProcessCompositionRoot.ts src/main/main.ts src/shared/translationProvider.ts tests/main/translateProviders tests/main/translationRuntime.test.ts tests/main/selectedTextTranslation.test.ts tests/main/mainProcessCompositionRoot.test.ts tests/main/providerAudit tests/main/providerAuditPrivacy.test.ts tests/shared/translationProvider.test.ts
npx prettier --check "src/main/translateProviders/**/*.ts" "src/main/services/translation.ts" "src/main/services/selectedTextTranslation.ts" "src/main/di/mainProcessCompositionRoot.ts" "src/main/main.ts" "src/shared/translationProvider.ts" "tests/main/translateProviders/**/*.ts" "tests/main/translationRuntime.test.ts" "tests/main/selectedTextTranslation.test.ts" "tests/main/mainProcessCompositionRoot.test.ts" "tests/main/providerAudit/**/*.ts" "tests/main/providerAuditPrivacy.test.ts" "tests/shared/translationProvider.test.ts"
git diff --check
```

## Failure And Rollback

- Any late applicable work, unbounded caller wait, double close, stale-field clear,
  second unresolved context, post-submission replay, duplicate audit terminal, or
  sensitive metadata blocks the packet.
- Rollback reverts the runtime/provider lifecycle wiring, contract-version bump,
  production resume adapter, and focused tests together. Settings and stored data
  need no repair; restarting recreates the prior in-memory provider/cache graph.

## Manual Gates

- None. Simulate suspend, provider hangs, and browser failures with deterministic
  doubles only. Do not launch providers or package the app.
- No dependency, workflow, commit, push, pull request, publication, or Task 04
  execution is authorized.

## References

- Mandatory:
  - `src/main/translateProviders/BaseTranslateProvider.ts` and its test;
  - `src/main/services/translation.ts` and `translationRuntime.test.ts`;
  - `src/main/services/selectedTextTranslation.ts` and its test;
  - `src/main/translateProviders/translationProviderFactory.ts` and `index.ts`;
  - `src/main/di/mainProcessCompositionRoot.ts`, `src/main/main.ts`, and composition
    tests;
  - `src/shared/translationProvider.ts` and its test;
  - `docs/agent-guides/project-conventions.md`, provider, DI, privacy, and test
    sections.
- Traceability:
  - approved specification sections “Timing Model,” “Architecture and Ownership,”
    “Concurrency and Terminal Arbitration,” “Provider and Browser Lifecycle,”
    “Failure and User-Visible Behavior,” and “Security and Privacy.”

## Completion And Handoff

- Mark Task 03 complete only after all focused checks pass.
- Update `handoff.md` with lifecycle/resource invariants, changed files, checks,
  exact next packet 04, and blockers.
- Present bounded timeout and ownership evidence and stop. Do not commit or begin
  Task 04.
