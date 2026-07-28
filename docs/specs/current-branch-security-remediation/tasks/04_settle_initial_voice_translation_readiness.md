# 04 Settle Initial Voice and Translation Readiness

## Outcome

The startup loader remains visible until selected Voice, Translation, and Prettify readiness have each settled
connected or not connected, while never-resolving Voice or Translation initialization is bounded by one main-owned
60-second deadline and cannot publish stale state after settlement.

## Prerequisites

- Packet 03 is complete, reviewed, and committed so selected Prettify HTTP readiness always settles.
- Approved specification requirement `READY-001`.
- Preserve existing provider retryability, browser ownership, startup event/query sequencing, and unrelated worktree
  state.

## Owned Requirements

- `READY-001`
- Applicable parts of `FAIL-003`, `FAIL-004`
- Applicable part of `COMP-005`
- `DEP-003`
- `AC-AUTO-016`

## In Scope

- One main-owned 60-second terminal deadline for initial Voice background-browser readiness.
- One main-owned 60-second terminal deadline for selected Translation-provider initialization.
- Global startup settlement across selected Voice, Translation, and Prettify providers.
- Exactly-once safe not-connected publication, timed-out auditing, cancellation, and stale-result suppression.
- Retryability after failed initialization.
- Deterministic main, provider, renderer startup-state, IPC, and privacy tests.

## Out Of Scope

- Prettify HTTP deadline/body/contract implementation; Packet 03 owns it.
- Reusable Translation reset or CloakBrowser settings-save ordering; Packet 05 owns it.
- Voice failure-tooltip semantics, localization, status accessibility, or renderer layout; Packet 06 owns them.
- Provider selectors, navigation targets, polling intervals, per-provider retry limits, operation queues, session
  persistence, result handling, cache, clipboard, notifications, or history changes.
- Renderer/preload/IPC contract changes.
- Live browsers/providers, credentials, accounts, sessions, private audio/text, dependencies, packaging, commits,
  pushes, pull requests, or releases.

## Task Contract

### Global startup gate

1. Keep the startup loader visible until the selected Voice, Translation, and Prettify providers have each reached
   exactly one terminal initial state: connected or not connected.
2. Preserve the current renderer rule that a pushed terminal provider event cannot be overwritten by an older
   initial-query result. A stale query, late promise, duplicate event, or provider retry cannot reopen the completed
   global startup gate.
3. Failure of one provider must not prevent the other providers from initializing or leave the aggregate gate
   pending. The gate releases only after all three selected provider slots have terminal state.
4. Use Packet 03's bounded Prettify result as the Prettify slot. Do not add a second Prettify deadline or duplicate
   its initialization.

### Voice deadline and settlement

5. Give initial Voice background-browser initialization one absolute 60-second deadline owned by Electron main.
   The deadline composes with existing session loading, navigation, polling, provider switching, cancellation,
   cleanup, and recovery budgets; it does not reset or extend when an internal phase changes.
6. If initialization rejects or throws before the deadline, settle through the existing sanitized failure path. If
   the deadline expires first:
   - abort only the owned initialization work;
   - emit exactly one Voice audit terminal with cause `timed-out`;
   - publish the existing safe browser-unavailable/not-connected state;
   - suppress every late readiness or audit publication from the expired generation.
7. Preserve background-browser operation-queue exclusion, context/page/session ownership, provider switch ordering,
   independent cleanup, and application shutdown ordering. The deadline owner must abort and clean the active
   generation from inside that operation or through a direct lifecycle-owned cleanup path. It must not enqueue
   public `shutdown()` or another cleanup operation behind the never-resolving initialization on the same serialized
   queue. Direct cleanup may release only the expired generation's owned resources and must settle without waiting
   for the hung operation to cooperate.
8. A failed or timed-out Voice provider remains retryable through the existing user/provider flow without
   restarting the application. Retry uses a new generation/deadline and cannot be affected by completion from the
   failed generation.

### Translation deadline and settlement

9. Give selected Translation-provider initialization one absolute 60-second deadline owned by Electron main. It
   includes settings readiness, browser acquisition, navigation, provider readiness/polling, cancellation, and
   provider-owned cleanup without replacing their existing internal limits.
10. If initialization rejects or throws before the deadline, settle through the existing closed Translation
    failure. If the deadline expires first:
    - abort only the owned initialization work;
    - emit exactly one Translation audit terminal with cause `timed-out`;
    - publish not connected with the existing closed detail `unexpected-failure`;
    - suppress every late readiness or audit publication from the expired generation.
11. Preserve the Translation registry's retained failed-instance/retry behavior, provider context ownership,
    operation ordering, and final shutdown cleanup. Do not convert initialization timeout into application shutdown
    or clear connection listeners. Timeout cleanup must use the active generation's cancellation/provider ownership
    path directly; it must not queue a final runtime or registry shutdown behind the hung initialization. Cleanup
    settlement and late-result suppression remain independent of whether the expired provider promise ever resolves
    or rejects.
12. A failed or timed-out Translation provider remains retryable through the existing request/settings flow without
    restarting the application. Retry uses a new generation/deadline and stale work cannot affect it.

### Shared settlement, audit, and privacy

13. Model each initial operation with class-owned state and constructor-injected timer/clock/cancellation
    dependencies. Rejection, synchronous throw, caller cancellation, deadline expiry, audit failure, and cleanup
    failure must each converge on one settlement path.
14. Distinguish caller cancellation from deadline timeout before normalizing native abort exceptions. Caller
    cancellation uses the existing cancellation terminal/state semantics; the main deadline uses `timed-out`.
15. Audit remains fail-open. A missing/throwing lifecycle, sink, clock, timer, abort dependency, or late audit call
    cannot keep startup pending, alter provider state, or retain browser ownership.
16. Never expose raw exceptions, stacks, URLs, paths, browser state, session/account/organization data, credentials,
    provider payloads, transcripts, audio, selected text, or renderer-supplied identifiers in readiness state,
    audit events, logs, or tests.

## Contracts And Boundaries

- Electron main owns initialization deadlines, browser/provider state, abort composition, and terminal publication.
- Renderer remains functional React and consumes only existing preload APIs and closed provider-state contracts.
- Preload, IPC channel names, request/result payload keys/types, trusted-sender validation, and renderer declarations
  remain unchanged.
- Stateful deadline and generation ownership belongs to existing business classes or focused constructor-injected
  classes. Add no module-level runtime instance, mutable global, or free pass-through service wrapper.
- Use named constants for the shared 60-second deadline and closed failure values at the narrowest canonical owner.
- Tests use injected clocks/timers, synthetic browser/provider dependencies, and deterministic promise control. They
  must not sleep for 60 seconds or launch Electron/CloakBrowser.

## Expected Files Or Components

- `src/main/browser.ts` (`BackgroundBrowserService`)
- `src/main/services/translation.ts` (`TranslationRuntime`)
- `src/main/providers/voiceProviderAudit.ts` only if a class-owned timed-out terminal is missing
- `src/main/translateProviders/translationProviderAudit.ts` only if a class-owned timed-out terminal is missing
- `src/main/mainProcessApplication.ts`
- `src/main/di/mainProcessCompositionRoot.ts`
- `src/main/main.ts`
- `src/renderer/App.tsx` only if implementation evidence proves the existing aggregate/query-race reducer is
  insufficient
- `src/renderer/providerStartupState.ts` only if implementation evidence proves a reducer defect
- `tests/main/backgroundBrowserLifecycle.test.ts`
- `tests/main/backgroundBrowserOperationQueue.test.ts`
- `tests/main/browserSessionStartup.test.ts`
- `tests/main/translationRuntime.test.ts`
- `tests/main/translationRuntimeLifecycle.test.ts`
- `tests/main/mainProcessApplication.test.ts`
- `tests/main/mainProcessCompositionRoot.test.ts`
- `tests/main/providerAuditPrivacy.test.ts`
- `tests/main/translationConnectionIpcContract.test.ts`
- `tests/main/preloadApi.test.ts`
- `tests/shared/translationProvider.test.ts`
- `tests/renderer/providerStartupState.test.ts`
- `tests/renderer/windowStartupState.test.ts`

Provider selectors, shared renderer contracts, locale catalogs, database repositories, package manifests, and
lockfiles are not expected to change in this packet.

## Acceptance Criteria

- With controlled never-resolving Voice, Translation, and Prettify dependencies, each selected slot settles at its
  approved deadline and the global loader releases only after all three terminal states exist.
- Voice and Translation each use one absolute 60-second deadline; internal phase changes, retries, navigation, or
  cleanup cannot refresh it.
- A never-resolving initialization cannot block timeout cleanup behind the Voice operation queue or Translation
  registry/runtime ordering; direct generation-owned cleanup settles without final shutdown or unrelated-owner
  teardown.
- Rejecting, synchronous-throwing, caller-cancelled, timed-out, and cleanup-failing initialization fixtures settle
  exactly once and never leave the startup gate pending.
- Voice timeout aborts owned work once, emits one `timed-out` terminal, and publishes the existing sanitized
  browser-unavailable not-connected state.
- Translation timeout aborts owned work once, emits one `timed-out` terminal, and publishes not connected with
  `unexpected-failure`.
- Audit lifecycle construction/emission failure cannot alter connection state or delay startup settlement.
- Late initialization, cleanup, audit, pushed event, and initial-query results cannot overwrite a terminal
  generation or reopen startup.
- A later Voice or Translation retry can connect successfully without application restart, duplicate browser
  ownership, stale events, or leaked contexts/pages/listeners.
- Background-browser operation queues, Translation registry retention, provider result values, shutdown order,
  trusted IPC, preload validation, and shared exact-key validators remain passing.
- Privacy canaries prove no raw error, endpoint, URL, path, browser/session/account state, credential, provider
  payload, text, transcript, audio, or renderer ownership value enters connection state, audit, or logs.
- No renderer/preload/IPC shape changes are required to obtain settlement.

## Verification

Run focused lifecycle and contract checks:

```bash
rtk proxy node --import tsx --test \
  tests/main/backgroundBrowserLifecycle.test.ts \
  tests/main/backgroundBrowserOperationQueue.test.ts \
  tests/main/browserSessionStartup.test.ts \
  tests/main/translationRuntime.test.ts \
  tests/main/translationRuntimeLifecycle.test.ts \
  tests/main/mainProcessApplication.test.ts \
  tests/main/mainProcessCompositionRoot.test.ts \
  tests/main/providerAuditPrivacy.test.ts \
  tests/main/translationConnectionIpcContract.test.ts \
  tests/main/preloadApi.test.ts \
  tests/shared/translationProvider.test.ts \
  tests/renderer/providerStartupState.test.ts \
  tests/renderer/windowStartupState.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

If the shared application lifecycle or renderer startup reducer changes, also run:

```bash
rtk npm test
```

Do not launch Electron/CloakBrowser, contact a provider, load a real session, or use private provider data.

## Failure And Rollback

- Any never-resolving path, refreshed deadline, duplicate terminal, stale state publication, deadlocked operation
  queue, listener loss, context/page leak, or failed provider that requires application restart blocks completion.
- If aborting a timed-out browser operation cannot preserve the established ownership/cleanup contract, leave the
  packet incomplete and record the exact race. Do not force-close unrelated browser owners or weaken queue
  exclusion.
- Rollback is a scoped revert of main-owned deadline/generation dependencies, provider lifecycle integration,
  composition wiring, and focused tests. No database/settings migration, IPC rollback, or user-data repair is
  required.

## Manual Gates

None in this packet. Packaged startup with a never-responsive HTTP Prettify endpoint is `AC-MAN-003`; desktop
CloakBrowser reset is `AC-MAN-004`. Both belong to the final integration/manual packet.

## References

- Mandatory project guidance:
  [Dependency Injection And Runtime Ownership](../../../agent-guides/project-conventions.md#dependency-injection-and-runtime-ownership),
  [Electron And Providers](../../../agent-guides/project-conventions.md#electron-and-providers), and
  [Desktop, Browser, And Packaging](../../../agent-guides/project-conventions.md#desktop-browser-and-packaging).
- Specification anchors:
  [Initial Readiness](../spec.md#initial-readiness),
  [Failure Behavior](../spec.md#failure-behavior), and
  [Compatibility, Migration, and Rollback](../spec.md#compatibility-migration-and-rollback).
- Review evidence:
  [Finding 2](../../../reviews/2026-07-28-current-branch-code-security-review.md#2-startup-can-remain-permanently-covered-by-the-loader).

## Completion And Handoff

After all automated checks pass:

1. mark only Packet 04 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with changed files, concise check results, remaining lifecycle/platform risks, and
   Packet 05 as the exact next packet;
3. leave Packet 04 unstaged and uncommitted for review;
4. stop without starting Packet 05 or a packaged/manual gate.
