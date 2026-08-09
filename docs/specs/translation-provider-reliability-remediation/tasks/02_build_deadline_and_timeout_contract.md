# 02 Build The Deadline And Timeout Contract

## Outcome

A state-owning main-process translation lifecycle primitive provides authoritative
60-second operation, 15-second result, and five-second cleanup clocks; deterministic
terminal arbitration; linked cancellation; suspend/resume handling; and a closed,
localized, privacy-safe `timed-out` contract without yet activating provider
behavior.

## Prerequisites

- Task 01 is complete and approved.
- Task 02 has separate execution authorization.
- The recorded performance baseline remains unchanged.

## Owned Requirements

- `TIME-005`–`TIME-008`
- `ARCH-002`, `ARCH-007`–`ARCH-009`
- `CONC-003`–`CONC-006`
- Contract portions of `FAIL-001`–`FAIL-003`
- `SEC-002`–`SEC-003`, `SEC-009`
- `OBS-001`–`OBS-005`
- `COMP-001`–`COMP-003`, `COMP-005`
- `CONF-001`–`CONF-002`
- Primitive portions of `ACC-001`, `ACC-008`–`ACC-010`

## In Scope

- One new translation-operation lifecycle/deadline class and deterministic tests.
- Canonical timing constants and injected wall/active clocks, timers, abort
  construction, and resume subscription.
- Additive `timed-out` failure, audit, localization, connection-state, and test-double
  exhaustiveness.
- Composition dependency types needed for later activation.

## Out Of Scope

- Wiring the lifecycle around live translation dispatch, closing provider resources,
  changing result polling, changing provider adapters/selectors, prewarming,
  contract-version bump, live network checks, or packaging.

## Task Contract

1. Add a class-owned lifecycle module at
   `src/main/translateProviders/translationOperationLifecycle.ts`. It owns one
   operation's clock samples, timer handles, caller-abort listener, resume listener,
   child `AbortController`, operation/result/cleanup phase starts, terminal arbiter,
   and disposal. Do not introduce a module-level constructed instance or free
   pass-through wrapper.
2. Define canonical named constants exactly once:
   - operation: `60_000` ms;
   - result: `15_000` ms;
   - terminal cleanup: `5_000` ms.
     Provider-specific copies or environment/user overrides are prohibited.
3. Inject a wall clock, an active monotonic clock, `setTimeout`, `clearTimeout`,
   `createAbortController`, and a resume subscription returning an unsubscribe
   callback. Tests own fake dependencies; Task 03 will connect production adapters
   in the composition root.
4. Compute authoritative elapsed time as a non-decreasing maximum of prior observed
   elapsed time, wall-clock delta, and active-clock delta. Wall rollback cannot
   extend a budget; forward wall movement and suspend time can expire it. Invalid or
   throwing injected values fail closed without exposing raw errors.
5. Treat timers and resume callbacks only as wake-ups. Every completion-facing API
   rechecks authoritative elapsed time, and expiry wins at exact equality.
6. Keep operation, result, and cleanup deadlines absolute from their documented
   phase starts. The effective result deadline is the earlier of its own 15 seconds
   and the remaining operation budget. Cleanup receives five seconds from cleanup
   start on every terminal path.
7. Encode deterministic terminal precedence: already committed reset/shutdown/
   supersession cancellation; then an unexpired valid outcome; then timeout at the
   boundary; then `cleanupFailure` overriding an underlying outcome when required
   cleanup is unconfirmed. Only one transition is returned and only one terminal
   notification can be observed.
8. Link caller abort to the owned controller. Repeated abort, timeout, resume,
   dispose, and completion calls are idempotent. Remove every timer and listener on
   settlement. Late callbacks can observe closed state only.
9. Lifecycle state contains timing, safe phase, provider ID, contract version,
   target code, attempt count, lengths, and opaque generation/resource identities
   only when required. It must never capture source/result text, URL, DOM content,
   raw error, cookie, session, screenshot, or account data.
10. Add `timed-out` to `TRANSLATION_PROVIDER_FAILURE_CODES` and update every
    exhaustive main-process switch, audit mapping, provider/test double, and type
    assertion. It remains non-discarded and maps to timeout audit classification and
    existing `not-connected`/`unexpected-failure` connection presentation.
11. Add the key `error.translationTimedOut` to English and all ten non-English
    checked-in locale catalogs. English meaning: “Translation timed out. Try again.”
    Preserve locale-key parity and never interpolate provider content.
12. Extend runtime and selected-text unit tests with a synthetic `timed-out` outcome
    proving message selection, clipboard restoration, no cache write, no success
    notification, and no result text. The lifecycle is not yet emitted by production
    translation until Task 03.

## Contracts And Boundaries

- Main owns the lifecycle; renderer/preload/IPC/settings/database shapes do not
  change.
- The class follows the state-owning dependency-injection precedent of
  `InitialProviderReadinessDeadline` but does not alter readiness behavior.
- No worker thread, lock, blocking wait, external request, retry, or fallback
  provider is introduced.
- `timed-out` is safe typed metadata, never a wrapper around raw Playwright errors.

## Expected Files Or Components

- Add `src/main/translateProviders/translationOperationLifecycle.ts`.
- Add `tests/main/translateProviders/translationOperationLifecycle.test.ts`.
- Update:
  - `src/main/translateProviders/translationProviderContracts.ts`;
  - `src/main/translateProviders/translationProviderAudit.ts` and closed provider
    audit mappings if required;
  - `src/main/services/translation.ts` failure/connection mappings only;
  - `src/main/services/selectedTextTranslation.ts` only if the existing generic
    failure flow cannot satisfy the typed timeout behavior;
  - `src/main/i18n/en.ts`, `ru.ts`, `be.ts`, `uk.ts`, `es.ts`, `pt-BR.ts`, `zh.ts`,
    `ja.ts`, `de.ts`, `fr.ts`, and `hi.ts`;
  - focused runtime, selected-text, i18n, audit, privacy, and contract tests.

## Acceptance Criteria

- Fake clocks cover 59,999/60,000 ms, 14,999/15,000 ms, and 4,999/5,000 ms.
- Tests cover wall rollback, wall forward movement, Linux-like suspended monotonic
  time, Windows-like advancing monotonic time, resume wake-up, delayed timer delivery,
  simultaneous completion/timeout, repeated abort/disposal, and throwing adapters.
- Every race produces one settlement and removes owned timers/listeners.
- `timed-out` is exhaustive, localized in every catalog, non-discarded, audit-classed
  as timeout, connection-mapped to unexpected failure, and privacy-safe.
- Existing initial-provider readiness behavior and IPC/renderer types remain
  unchanged.

## Verification

Run:

```text
node --import tsx --test tests/main/translateProviders/translationOperationLifecycle.test.ts tests/main/translationRuntime.test.ts tests/main/selectedTextTranslation.test.ts tests/main/i18n.test.ts tests/main/providerAudit/providerAuditMappings.test.ts tests/main/providerAuditPrivacy.test.ts tests/shared/translationProvider.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/translateProviders src/main/services/translation.ts src/main/services/selectedTextTranslation.ts src/main/i18n tests/main/translateProviders tests/main/translationRuntime.test.ts tests/main/selectedTextTranslation.test.ts tests/main/i18n.test.ts tests/main/providerAudit tests/main/providerAuditPrivacy.test.ts tests/shared/translationProvider.test.ts
npx prettier --check "src/main/translateProviders/**/*.ts" "src/main/services/translation.ts" "src/main/services/selectedTextTranslation.ts" "src/main/i18n/**/*.ts" "tests/main/translateProviders/**/*.ts" "tests/main/translationRuntime.test.ts" "tests/main/selectedTextTranslation.test.ts" "tests/main/i18n.test.ts" "tests/main/providerAudit/**/*.ts" "tests/main/providerAuditPrivacy.test.ts" "tests/shared/translationProvider.test.ts"
git diff --check
```

## Failure And Rollback

- Any ambiguous terminal winner, deadline extension after clock rollback, missing
  listener disposal, locale mismatch, raw sensitive metadata, or renderer/IPC
  expansion blocks the packet.
- Rollback removes the new dormant lifecycle primitive and reverts the additive
  timeout mappings/locales/tests. No provider behavior, settings, or stored data has
  migrated yet.

## Manual Gates

- None. Do not launch providers, use system suspend, package the app, or change
  dependencies/workflows in this packet.
- No commit, push, pull request, publication, or Task 03 execution is authorized.

## References

- Mandatory:
  - `src/main/services/initialProviderReadinessDeadline.ts` and its test utility;
  - `src/main/translateProviders/translationProviderContracts.ts`;
  - `src/main/translateProviders/translationProviderAudit.ts`;
  - `src/main/services/translation.ts` failure and connection mappings;
  - `src/main/i18n/index.ts` and `tests/main/i18n.test.ts`;
  - `docs/agent-guides/project-conventions.md`, “Code And Logging,” “Dependency
    Injection And Runtime Ownership,” and “Tests And Documentation.”
- Traceability:
  - approved specification sections “Timing Model,” “Architecture and Ownership,”
    “Concurrency and Terminal Arbitration,” “Failure and User-Visible Behavior,”
    and “Audit, Diagnostics, and Localization.”

## Completion And Handoff

- Mark Task 02 complete in `todo.md` after focused checks pass.
- Update `handoff.md` with the lifecycle API/invariants, changed files, checks, exact
  next packet 03, and blockers.
- Present the contract evidence and stop. Do not commit or activate Task 03.
