# 02 Migrate Translation Audit Lifecycle

## Outcome

Move Google, Bing, and Yandex provider diagnostics onto the shared schema-v1
`provider-audit` lifecycle delivered by Packet 01. Translation settings
readiness, validation, provider dispatch, bounded recovery, semantic browser
phases, cancellation/stale disposal, cleanup, and provider shutdown must be
correlated without changing translation results or renderer behavior.

## Prerequisites

- Packet 01 (the shared provider-audit contracts, canonical sink, operation
  state, severity rules, safe error normalization, and exhaustive mapping
  support) is completed, verified, and approved.
- The specification remains `Status: Approved`.
- Read the Translation family and Provider Audit Event Contract sections named
  under References; do not infer additional fields or causes.
- Preserve the existing injected, deterministic provider harnesses and the
  serialized provider queue.

## Owned Requirements

- `SCOPE-002` for Translation provider-owned operations.
- `TRANS-001`, `TRANS-002`, `TRANS-003`, and `TRANS-004`.
- Translation portions of `COMP-001` and `COMP-002`.
- Translation portions of `AC-AUTO-001`, including lifecycle, severity,
  bounded polling, provider coverage, registry exhaustiveness, and privacy
  canaries.
- Packet 01 remains the primary owner of `ARCH-001` through `ARCH-003`,
  `AUD-001` through `AUD-007`, `FAIL-001`, and the shared event schema. This
  packet consumes and proves those contracts for Translation.

## In Scope

- Emit schema-v1 operations for Translation `settings-readiness`, `translate`,
  and `shutdown`.
- Audit pre-provider validation, including an unsupported provider without
  retaining the untrusted identifier.
- Carry one valid `translate` operation through the shared provider lifecycle:
  validation, context, navigation, consent/challenge handling, readiness,
  source detection, target selection, stale-state clearing, submission,
  result stabilization, recovery, visible-state cleanup, and context cleanup.
- Convert the existing terminal-only `TranslationProviderDiagnostic` path into
  the shared lifecycle without losing its safe metadata.
- Audit one clean pre-submission recovery as retry/recovery semantics without
  changing its two-attempt bound.
- Audit shutdown for every instantiated provider while preserving retry
  ownership for providers whose cleanup fails.
- Consolidate free-form Translation provider-operation logs that overlap the
  audit lifecycle. Keep distinct clipboard, notification, cache, settings, and
  application logs.
- Add focused lifecycle, registry, severity, bounded-volume, compatibility,
  and privacy tests for Google, Bing, and Yandex.

## Out Of Scope

- Translation source/result persistence, redaction, SQLite migration, cache-hit
  capture, retention, purge, and archive export.
- Translation provider selectors, routes, language catalogs, timeouts, polling
  delays, retry counts, submission behavior, or cleanup policy.
- Changes to `TranslationTextResult`, `TranslationProviderOutcome`, localized
  errors, IPC outcomes, clipboard behavior, notifications, cache keys, or
  selected-text action gating.
- Per-poll, DOM-content, response-body, screenshot, cookie, session, browser
  profile, or source/result logging.
- Renderer logging handles or renderer access to the audit operation object.

## Task Contract

1. Use only the Packet 01 main-process audit API. Runtime provider code must not
   construct JSON manually or call `electron-log` directly for audit events.
2. A Translation settings snapshot/readiness check is an operation named
   `settings-readiness`. A malformed or unknown provider produces one
   `started` event and one failure `terminal`; set `providerKnown: false` and
   omit `providerId`. Never serialize the rejected candidate.
3. Each rejected Translation action before provider dispatch still receives a
   main-generated opaque operation ID and exactly one terminal event. Empty
   input, over-limit input, unsupported target, cancellation, and stale state
   retain their existing typed cause codes.
4. For a known provider dispatch, use one `translate` operation ID from the
   first action validation event through the provider terminal event. Carry
   the main-only operation handle through internal runtime/provider boundaries;
   do not add it to renderer IPC or user-facing result objects.
5. Emit semantic phase transitions only. Use the approved phase values:
   `dispatch`, `validation`, `context`, `navigation`,
   `consent-or-challenge`, `readiness`, `source-detection`,
   `target-selection`, `stale-state`, `submission`, `result`, `recovery`,
   `cleanup`, and `shutdown`. Do not emit an event for each result,
   readiness, clear-state, or stability poll.
6. The existing first-attempt recoverable pre-submission branch emits bounded
   retry/recovery events on the same operation ID, increments safe
   `attemptCount`, closes the old owned context, and then follows the existing
   second-attempt behavior. It must not add a retry or replay submitted source.
7. Preserve the Translation cause-code set exactly:
   `unsupportedProvider`, `unsupportedTargetLanguage`, `emptyInput`,
   `inputTooLong`, `navigationFailure`, `consentOrChallenge`,
   `pageContractFailure`, `resultTimeoutOrEmpty`,
   `cancelledOrStaleOperation`, and `cleanupFailure`.
8. Preserve safe terminal metadata when available: registered `providerId`,
   `contractVersion`, approved `targetLanguage`, `sourceLength`,
   `resultLength`, `durationMs`, `attemptCount`, and semantic phase. Do not
   broaden Packet 01's optional-field allowlist.
9. Successful operations terminate at `cleanup` only after the existing
   visible-state/context cleanup condition permits success. Cleanup ownership
   uncertainty maps to `cleanupFailure` at error severity.
10. Cancellation and stale/discarded outcomes are `info` terminals and remain
    discardable. Typed validation/provider failures are `warn`; unexpected
    contract exceptions and cleanup failures are `error`.
11. `TranslationProviderRegistry.shutdown()` emits one `shutdown` operation
    for each instantiated provider. It must still attempt every provider,
    delete only successfully shut-down instances, and retain failed instances
    for the existing retry path.
12. Audit emission is best effort. A missing or throwing sink, rejected
    metadata, clock/ID failure, or serialization failure must preserve the
    exact existing provider outcome, cleanup attempt, and throw/return
    behavior. Rejection must never fall back to raw logging.
13. Remove or narrow terminal provider-operation logs from
    `BaseTranslateProvider`, `TranslationRuntime`, and
    `selectedTextTranslation` when the audit event supersedes them. Cache-hit
    logging remains an application/cache concern and must not create a
    provider-audit operation.

## Contracts And Boundaries

- Main owns the operation object, provider registry, browser context, clocks,
  and audit sink. Nothing new crosses preload or renderer boundaries.
- Keep `TranslationProviderRequest` and audit correlation main-only. If an
  internal request/context type carries the operation handle, its source text
  and signal must never be copied into event metadata.
- `BaseTranslateProvider` remains the semantic lifecycle owner; Google, Bing,
  and Yandex subclasses continue to implement only their page hooks.
- Preserve the provider queue and generation invalidation. Late results may
  produce only the operation's stale terminal if it is not already terminal;
  no event may follow a terminal event.
- Event metadata must never contain source/result text, source-bearing URLs,
  page content, locator values, response data, cookies/storage, browser
  identity, screenshots, account data, exception messages, names controlled by
  a provider, or stacks.
- Unknown metadata keys must be rejected by Packet 01. Runtime code must pass
  closed typed values, not arbitrary provider hook objects or `Error`
  instances.
- Provider behavior, target authority, retries, context reuse, clipboard,
  notifications, cache, and localization remain compatible.

## Expected Files Or Components

- `src/main/translateProviders/translationProviderContracts.ts`
- `src/main/translateProviders/BaseTranslateProvider.ts`
- `src/main/translateProviders/index.ts`
- `src/main/services/translation.ts`
- `src/main/services/selectedTextTranslation.ts` only for consolidation of
  overlapping operation logs; do not add text capture here in this packet.
- `src/main/translateProviders/GoogleTranslateProvider.ts`,
  `BingTranslateProvider.ts`, and `YandexTranslateProvider.ts` only if a
  provider-specific semantic hook needs a closed audit signal; do not change
  page behavior.
- The shared Packet 01 audit API and Translation audit mapping.
- `tests/main/translateProviders/BaseTranslateProvider.test.ts`
- `tests/main/translateProviders/translationProviderRegistry.test.ts`
- `tests/main/translateProviders/GoogleTranslateProvider.test.ts`
- `tests/main/translateProviders/BingTranslateProvider.test.ts`
- `tests/main/translateProviders/YandexTranslateProvider.test.ts`
- `tests/main/translationRuntime.test.ts`
- `tests/main/translationRuntimeLifecycle.test.ts`
- `tests/main/selectedTextTranslation.test.ts`

## Acceptance Criteria

- Every registered provider produces a schema-v1 correlated lifecycle for
  success, typed failure, exception normalization, bounded recovery,
  cancellation/stale disposal, cleanup failure, and shutdown.
- Existing provider ID, contract version, target, phase, attempt, duration,
  source/result length, outcome, and failure-code diagnostics remain
  represented using only approved fields.
- An unsupported provider emits a family audit failure with
  `providerKnown: false`, no `providerId`, and no rejected identifier in the
  captured logger arguments.
- One clean pre-submission recovery emits bounded retry/recovery events; a
  submitted source is never replayed.
- Increasing Translation poll counts does not increase audit event count.
- Exactly one terminal event exists per operation, and no late poll, abort, or
  cleanup completion emits after terminal.
- Cancellation/stale terminal severity is `info`; cleanup failure severity is
  `error`; typed expected failures use `warn`.
- Throwing audit sinks and rejected audit metadata do not change any
  Translation result or cleanup behavior.
- Privacy canaries placed in source/result text, URLs, page content,
  credentials/session/account fixtures, exception messages, and stacks are
  absent from all captured audit logger arguments.
- Registry tests fail when a Translation provider lacks the Packet 01 audit
  mapping.
- Existing Translation runtime, provider, clipboard, cache, notification, and
  lifecycle tests remain green without expectation changes unrelated to audit
  output.

## Verification

Run the smallest focused checks first:

```bash
rtk node --import tsx --test tests/main/translateProviders/BaseTranslateProvider.test.ts tests/main/translateProviders/translationProviderRegistry.test.ts tests/main/translateProviders/GoogleTranslateProvider.test.ts tests/main/translateProviders/BingTranslateProvider.test.ts tests/main/translateProviders/YandexTranslateProvider.test.ts tests/main/translationRuntime.test.ts tests/main/translationRuntimeLifecycle.test.ts tests/main/selectedTextTranslation.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
```

If the packet changes a shared audit type or helper, also run Packet 01's
focused audit test command and the full unit suite:

```bash
rtk node --import tsx --test tests/main/providerAudit/providerAudit.test.ts tests/main/providerAudit/providerAuditMappings.test.ts
rtk npm run test:unit
```

## Failure And Rollback

- If audit instrumentation changes a provider outcome, target selection,
  retry, polling, cleanup, cache, clipboard, notification, or IPC result, stop
  and restore the previous Translation behavior before proceeding.
- Roll back only this packet's Translation audit integration and focused tests.
  Existing audit lines require no migration and rotate under normal
  `electron-log` policy.
- Do not weaken the metadata allowlist, terminal invariant, trusted process
  boundary, or privacy canaries to make a test pass.
- A throwing audit sink must be fixed as a fail-open observer; do not catch and
  transform provider failures differently.

## Manual Gates

- No credentials, live accounts, external navigation, destructive data
  operations, commits, pushes, or releases are authorized by this packet.
- `MANUAL GATE`: any desktop exercise against public Translation pages requires
  separate execution authorization and synthetic, non-private text. Confirm
  semantic phase correlation, one terminal, expected severity, and absence of
  source/result/page content in the normal log.
- Platform archive export and diagnostic text capture are verified by later
  packets, not here.

## References

- Mandatory: `docs/specs/provider-audit-logging/spec.md`, sections
  **Provider Audit Event Contract**, **Audit Metadata and Error
  Normalization**, **Family Requirements / Translation**, **Failure
  Behavior**, **Compatibility**, and **Acceptance Criteria / Provider Audit**.
- Mandatory: Packet 01's shared audit API task packet.
- Mandatory: `docs/agent-guides/project-conventions.md`, sections **Code And
  Logging**, **Electron And Providers**, and **Tests And Documentation**.
- Local implementation references:
  `src/main/translateProviders/BaseTranslateProvider.ts`,
  `src/main/translateProviders/translationProviderContracts.ts`,
  `src/main/translateProviders/index.ts`, and
  `src/main/services/translation.ts`.

## Completion And Handoff

- Mark only Packet 02 complete in `tasks/todo.md`.
- Update `tasks/handoff.md` with changed files, concise behavior delivered,
  exact checks run, results, and any remaining blocker.
- State that the next packet is the next unchecked packet selected by the
  approved plan; do not start it.
- Stop for review. Do not commit, push, open a pull request, or begin another
  packet without a separate authorized incremental-implementation invocation.
