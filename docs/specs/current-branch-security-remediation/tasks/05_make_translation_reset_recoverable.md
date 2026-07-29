# 05 Make Translation Reset Recoverable

## Outcome

Saving CloakBrowser settings uses a reusable Translation reset that preserves connection listeners, owns and cleans
candidate browser state, persists only after cleanup/restart succeeds, restores authoritative prior settings after
persistence failure, and leaves final application disposal as the only listener-clearing lifecycle.

## Prerequisites

- Packet 04 is complete, reviewed, and committed because this packet reuses its bounded Translation initialization
  and background-browser recovery behavior.
- Approved specification requirement `READY-004`.
- Preserve the single composition-root Translation connection subscription and every unrelated worktree change.

## Owned Requirements

- `READY-004`
- Applicable parts of `FAIL-003`, `FAIL-004`
- Applicable part of `COMP-005`
- `DEP-003`
- `AC-AUTO-013`

## In Scope

- A reusable Translation reset distinct from final runtime shutdown/disposal.
- Ordered CloakBrowser settings cleanup, candidate restart, persistence, selected-provider warmup, and failure
  restoration.
- Generation/cancellation ownership and stale-state suppression.
- Authoritative settings retention/reload and persistence-failure recovery.
- Deterministic runtime, real IPC-handler lifecycle, settings repository, composition-root, and compatibility tests.

## Out Of Scope

- Voice/Translation initial-readiness implementation; Packet 04 owns it.
- Prettify HTTP readiness; Packet 03 owns it.
- Status localization, accessibility, tooltips, or renderer layout; Packet 06 owns them.
- CloakBrowser settings fields, validators, IPC channels, renderer/preload payloads, browser provider selectors,
  navigation targets, polling intervals, retry limits, or provider result changes.
- Database schema, diagnostic capture, cache, clipboard, history, notification, or user-data migration changes.
- Live browsers/providers, credentials, accounts, sessions, private text, dependencies, packaging, commits, pushes,
  pull requests, or releases.

## Task Contract

### Reusable reset ownership

1. Add a reusable `TranslationRuntime` reset/restart lifecycle distinct from final `shutdown()`/application
   disposal. The reset is state-owning, constructor-injected where new dependencies are required, and does not use a
   free pass-through wrapper.
2. At reset start:
   - increment the existing generation before asynchronous work can publish;
   - cancel active initialization and provider requests;
   - close Translation provider contexts through the existing registry ownership boundary;
   - publish the existing `checking` connection state;
   - preserve every registered connection listener.
3. Final application disposal remains the only lifecycle that clears connection listeners. The existing single
   composition-root subscription remains active for the application lifetime; reset/save/recovery must not
   resubscribe or create a second listener.
4. Work from an older generation cannot publish state, audit phases/terminals, retain browser/provider ownership, or
   interfere with the reset generation.

### Candidate cleanup, restart, and persistence

5. Validate the CloakBrowser settings request through the existing strict shared contract before reset. Retain the
   authoritative prior persisted settings separately from the candidate values for the complete transaction.
6. If provider/context cleanup fails:
   - publish not connected with existing detail `cleanup-failed`;
   - do not restart a browser;
   - do not persist candidate settings;
   - preserve listeners and the authoritative prior settings;
   - return the existing closed settings failure shape.
7. After successful cleanup, restart the browser with the validated candidate settings through the existing
   settings/browser ownership flow. At most one candidate browser owner may exist.
8. If candidate browser restart fails:
   - publish not connected with existing detail `unexpected-failure`;
   - do not persist candidate settings;
   - close any partially created candidate browser/context/page;
   - preserve listeners and authoritative prior settings;
   - return the existing closed settings failure shape.
9. Persist candidate settings only after provider cleanup and candidate browser restart both succeed. The
   repository must not update its in-memory authoritative snapshot until durable persistence succeeds.
10. Preserve safe cross-platform settings persistence. If the current direct writer cannot keep the prior file
    authoritative on failure, inject/reuse the existing atomic text-write abstraction at the repository boundary;
    do not add a public API, dependency, shell command, or platform-specific path assumption.

### Persistence-failure restoration

11. If candidate persistence fails:
    - return the existing settings-save failure result;
    - preserve all connection listeners;
    - close the candidate browser and every candidate provider context/page;
    - reload the authoritative prior persisted settings rather than using candidate or mutated in-memory values;
    - perform exactly one browser/provider restoration using the authoritative prior settings;
    - give restoration its own absolute 60-second main-owned deadline from Packet 04;
    - never warm a provider against unpersisted candidate values.
12. Successful restoration publishes the connected/not-connected readiness derived from the authoritative prior
    provider while the settings save remains failed. Restoration success must not rewrite the failed save result.
13. Failed or timed-out restoration publishes not connected with existing detail `unexpected-failure`, settles once,
    and leaves no candidate/prior duplicate browser, context, page, pending initialization, or retained
    subscription.
14. If candidate cleanup after save failure itself fails, keep the save result failed, publish only closed safe
    state, suppress raw errors, and do not start restoration in a way that could create two live browser owners.

### Success and selected-provider warmup

15. After durable persistence succeeds, the candidate settings become authoritative. Only then initialize/warm the
    selected Translation provider through the bounded initialization path from Packet 04.
16. Successful warmup publishes connected. Provider-derived warmup failure or timeout publishes the existing
    sanitized not-connected detail but does not roll back persisted settings or convert an otherwise successful
    CloakBrowser settings save into failure.
17. The successful settings result is fixed at persistence success. Later readiness publication, audit failure, or
    provider cleanup cannot rewrite that result.

### Audit, failures, and privacy

18. Preserve existing provider-audit schema, closed causes, exactly-one terminal rule, generation ordering, and
    fail-open behavior. Timeout uses `timed-out`; provider/context cleanup uses the existing safe cleanup cause;
    unexpected browser/repository failures are normalized without raw details.
19. Every reset branch must settle checking to exactly one connected or not-connected state. Throwing/rejecting
    cancellation, cleanup, restart, persistence, restoration, warmup, audit, and logger dependencies cannot leave
    readiness pending.
20. Never log or expose candidate/prior settings values, executable paths, endpoints, URLs, filesystem paths, raw
    errors/stacks, browser/session/account/organization state, credentials, provider payloads, selected text, or
    result text. Logs may contain only existing closed booleans/categories/causes where already approved.

## Contracts And Boundaries

- Electron main owns settings validation, runtime reset, browser/provider lifecycle, persistence ordering, recovery,
  and connection publication.
- `TranslationRuntime` owns connection listeners and generations. The provider registry owns provider instances and
  contexts. The CloakBrowser settings repository owns durable settings and its authoritative in-memory snapshot.
- IPC, preload, renderer declarations, trusted Settings-window sender validation, channel names, request/result
  payload keys/types, and shared validators remain unchanged.
- Use constructor injection for filesystem writer, browser factory, timer/clock, cancellation, settings repository,
  provider registry, and audit seams used in deterministic tests. Add no mutable global/container or free service
  pass-through.
- Preserve platform-neutral Node/Electron filesystem semantics. Do not assume POSIX rename/permission behavior on
  Windows or introduce hardcoded separators.
- Tests use temporary synthetic settings roots and fake browser/provider dependencies only. They must not read,
  rewrite, or delete real user settings or launch CloakBrowser.

## Expected Files Or Components

- `src/main/services/translation.ts`
- `src/main/ipc.ts`
- `src/main/mainProcessApplication.ts`
- `src/main/di/mainProcessCompositionRoot.ts`
- `src/main/cloakBrowserSettings.ts`
- `src/main/main.ts` only if a constructor-injected persistence/timer dependency changes root wiring
- `tests/main/translationRuntime.test.ts`
- `tests/main/translationRuntimeLifecycle.test.ts`
- `tests/main/translationConnectionIpcContract.test.ts`
- `tests/main/cloakBrowserSettingsRepository.test.ts`
- A focused real-handler lifecycle test such as `tests/main/cloakBrowserSettingsIpcLifecycle.test.ts`
- `tests/main/mainProcessApplication.test.ts`
- `tests/main/mainProcessCompositionRoot.test.ts`
- `tests/main/preloadApi.test.ts`
- `tests/shared/translationProvider.test.ts`
- Translation provider registry/provider lifecycle tests only where needed for failed-instance retention and stale
  generation suppression

Renderer production code, locale catalogs, shared IPC contracts, database repositories, package manifests, and
lockfiles are not expected to change in this packet.

## Acceptance Criteria

- Runtime reset preserves the exact listener instances and the single composition-root subscription across success,
  cleanup failure, restart failure, persistence failure/restoration, warmup failure, timeout, and cancellation.
- Active initialization/requests are cancelled, the generation increments before asynchronous publication, and
  stale work cannot publish after reset.
- Cleanup failure publishes `cleanup-failed`, starts no browser, persists nothing, and leaves no new provider owner.
- Candidate restart failure publishes `unexpected-failure`, persists nothing, and cleans every partial candidate
  browser/context/page.
- Tests prove persistence is never invoked before cleanup and candidate restart succeed.
- Persistence failure keeps the existing save-failed result, closes the candidate, reloads authoritative prior
  persisted settings, and performs exactly one bounded restoration without warming candidate values.
- Successful restoration republishes prior authoritative readiness while the save remains failed. Failed/timed-out
  restoration settles `unexpected-failure` and leaks no resource or listener.
- Persistence safety tests inject write/open/rename/fsync-equivalent adapter failures as supported by the existing
  abstraction and prove the durable prior settings and in-memory authoritative snapshot remain unchanged.
- Successful persistence becomes authoritative before selected-provider warmup. Warmup failure changes readiness
  only and cannot roll back settings or fail the save.
- Concurrent/duplicate reset or save attempts follow existing serialization/ownership rules and cannot create two
  live browser owners, duplicate provider contexts, or duplicate connection subscriptions.
- Final application disposal clears listeners once; reset and save never clear them.
- Audit/logger failures remain fail-open, all branches settle once, and privacy canaries are absent from connection
  state, results, audit events, logs, and test snapshots.
- Trusted Settings-window IPC, preload validation, shared exact-key settings validators, provider results, and all
  renderer-facing contracts remain unchanged.

## Verification

Run focused reset, persistence, and boundary tests:

```bash
rtk proxy node --import tsx --test \
  tests/main/translationRuntime.test.ts \
  tests/main/translationRuntimeLifecycle.test.ts \
  tests/main/translationConnectionIpcContract.test.ts \
  tests/main/cloakBrowserSettingsRepository.test.ts \
  tests/main/cloakBrowserSettingsIpcLifecycle.test.ts \
  tests/main/mainProcessApplication.test.ts \
  tests/main/mainProcessCompositionRoot.test.ts \
  tests/main/preloadApi.test.ts \
  tests/shared/translationProvider.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm test
rtk git diff --check
```

If the focused IPC lifecycle test is merged into an existing test file rather than created, run that owning file
under the same command and record the substitution in the handoff.

Do not launch Electron/CloakBrowser, contact a provider, inspect real settings, or use a real user-data directory.

## Failure And Rollback

- Listener loss, a second subscription, persistence before restart, warming unpersisted values, candidate browser
  leakage, duplicate contexts, stale generation publication, unbounded restoration, or a save result rewritten by
  warmup blocks completion.
- If candidate cleanup cannot prove exclusive browser ownership after persistence failure, do not start restoration
  and do not weaken cleanup. Leave the packet incomplete with the exact ownership blocker.
- If cross-platform persistence cannot preserve the authoritative prior file through the existing injected
  abstraction, leave the packet incomplete. Do not add a dependency or claim POSIX-only behavior as Windows-safe.
- Rollback the reset lifecycle, IPC ordering, repository persistence seam, composition wiring, and focused tests as
  one boundary. No database migration or user-data deletion is required; rollback must not touch actual settings.

## Manual Gates

None in this packet. The synthetic desktop CloakBrowser save/readiness walkthrough is `AC-MAN-004` and belongs to
the final integration/manual packet.

## References

- Mandatory project guidance:
  [Dependency Injection And Runtime Ownership](../../../agent-guides/project-conventions.md#dependency-injection-and-runtime-ownership),
  [Electron And Providers](../../../agent-guides/project-conventions.md#electron-and-providers), and
  [Desktop, Browser, And Packaging](../../../agent-guides/project-conventions.md#desktop-browser-and-packaging).
- Specification anchors:
  [Translation Browser Reset](../spec.md#translation-browser-reset),
  [Failure Behavior](../spec.md#failure-behavior), and
  [Compatibility, Migration, and Rollback](../spec.md#compatibility-migration-and-rollback).
- Review evidence:
  [Finding 4](../../../reviews/2026-07-28-current-branch-code-security-review.md#4-saving-cloakbrowser-settings-permanently-removes-translation-status-updates).

## Completion And Handoff

After all automated checks pass:

1. mark only Packet 05 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with changed files, concise check results, residual browser/persistence risks, and
   Packet 06 as the exact next packet;
3. leave Packet 05 unstaged and uncommitted for review;
4. stop without starting Packet 06 or a desktop/manual gate.
