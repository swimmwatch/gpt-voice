# Specification: Translation Provider Reliability Remediation

Status: Approved
Date: 2026-08-09
Scope owner: Translation runtime deadlines, successful-result latency, provider concurrency, and browser-resource lifecycle

## Objective

Bound every cache-miss Google, Bing, and Yandex translation by explicit,
cross-platform wall-clock deadlines and reduce the application-controlled time to a
successful result while preserving result quality, single-flight, no-replay,
privacy, and provider-isolation contracts. Correct the stale context ownership race
identified in the translation-provider review.

Success means:

- provider work, including shared Translation browser-resource queue wait, cannot remain applicable beyond
  a fixed 60-second operation budget;
- result stabilization uses the existing 15-second value as an absolute elapsed-time
  budget rather than an iteration count;
- cold and warm successful paths for Google, Bing, and Yandex each demonstrate an
  objective reduction in application-controlled result latency without moving delay
  into another measured phase;
- a result is accepted as soon as equivalent provider-specific completion evidence
  is available, while an absent, ambiguous, stale, or contradictory completion
  signal falls back to the existing 500-millisecond stability confirmation;
- polling and result validation avoid redundant browser-process round trips without
  weakening origin, route, challenge, control, target, normalization, or
  no-partial-result checks;
- every success, failure, cancellation, and timeout receives at most five additional
  seconds for visible-state and page/context cleanup;
- the configured existing Cancel hotkey can cancel the active selected-text translation,
  restore its captured clipboard only when caller cancellation wins, and present the
  existing localized cancelled status without an OS notification;
- an overall deadline expiry produces one explicit `timed-out` failure, a localized
  retry message, safe timeout audit metadata, and no successful clipboard, cache, or
  notification effects;
- a cleanup deadline or cleanup error produces `cleanupFailure`, leaves no uncertain
  context eligible for reuse, and cannot be overwritten by a late browser result;
- system suspend consumes the operation budget consistently on Linux and Windows;
- asynchronous deadline, cancellation, shutdown, reset, browser, and cleanup
  completions have one deterministic terminal winner;
- a context that becomes stale while `newPage()` is pending is detached with an
  identity guard and is never observed as the active context by a later generation;
- all three provider contract versions reflect the shared lifecycle change; and
- only the currently selected provider is prepared during startup and other
  providers remain on-demand; and
- Translation owns at most one live or quarantined in-memory browser context and one
  provider page; a provider switch starts a fresh page after clearing Translation-site
  session state; and
- no provider origin, language inventory, retry limit, submission strategy, renderer
  privilege, IPC payload, setting, database, dependency, package target, or release
  policy changes.

- **OUT-001:** Every selected review finding is either corrected by this contract or
  retained only as an explicit, bounded residual risk with objective acceptance
  evidence.
- **OUT-002:** A cache-miss provider translation has one predictable terminal
  outcome, never leaves applicable late work, and preserves selected-text workflow
  recovery on every timeout and cleanup path.
- **OUT-003:** Cross-platform, concurrency, security, privacy, compatibility,
  observability, and lifecycle requirements are enforced without widening the
  renderer or public configuration surface.
- **OUT-004:** Every supported provider returns a correct successful result as soon
  as sufficient completion evidence exists, with separately verified cold- and
  warm-path improvements in application-controlled latency.

## Authority and Relationship to Existing Contracts

This specification is a remediation overlay for the approved Translation Providers
specification and the Provider Audit Logging and Diagnostics Archive specification.
It owns the actionable findings selected in
`docs/reviews/provider-review-2026-08-08-translation-providers-comments-to-address.md`:

- `TRANSLATE-1`: excessive interactive translation latency without one absolute
  operation deadline;
- `TRANSLATE-7`: the result timeout counts loop iterations instead of wall-clock
  time; and
- `TRANSLATE-5`: stale context ownership after `newPage()` loses its generation.

This overlay supersedes existing translation requirements only where it defines
absolute timing, successful-result processing, timeout outcomes, terminal
arbitration, bounded cleanup, suspend behavior, and stale context detachment. The
2026-08-09 performance revision explicitly reopens result polling and acceptance
optimization that the original review assessment left out; it does not reopen any
other excluded finding. All unrelated approved provider, audit, diagnostic,
security, UI, settings, packaging, and release requirements remain authoritative.

The 2026-08-09 caller-cancellation revision adds only the requested selected-text
Cancel-hotkey behavior. It reuses the existing main-process lifecycle and renderer
status contract; direct `translate-text` IPC remains non-cancellable.

The source review and comments-to-address assessment are evidence, not
implementation authority. `decisions.yaml` owns the active user decisions. This
specification does not authorize planning, implementation, commits, pushes, pull
requests, packaging, or release activity.

## Stakeholders and Outcomes

- **Desktop user:** receives a predictable result or actionable failure instead of a
  hotkey action that appears hung for several minutes; successful results arrive
  with less application delay, and expired or incomplete results never arrive late.
- **Maintainer:** retains one shared lifecycle contract for Google, Bing, and Yandex
  without provider-specific timeout forks, while provider-specific completion
  evidence remains isolated behind each provider contract.
- **Support and diagnostics operator:** can distinguish an operation timeout from
  navigation, page-contract, result-empty, cancellation, and cleanup failures without
  seeing selected text or provider-controlled error content.
- **Security reviewer:** can verify that expired work loses authority, submitted text
  is never replayed, uncertain contexts are quarantined from reuse, and cleanup
  affects only isolated translation resources.
- **Tester:** can drive every race and boundary deterministically with injected time,
  timers, abort controllers, and browser doubles on Linux and Windows.

## Observed Baseline

- Selected-text translation uses one shared action gate. A second concurrent
  selected-text action is skipped rather than queued.
- `TranslationRuntime` snapshots the provider and target, owns active abort
  controllers, and invalidates them during reset and shutdown.
- Each translation provider serializes initialization and translation through a
  promise queue and uses generation tokens to reject stale work.
- Provider terminal failures close the owned page/context before returning; cleanup
  failure overrides the original provider failure.
- Initialization readiness already uses an absolute 60-second deadline, but the
  interactive translation dispatch does not.
- Navigation can use four attempts with a 60-second per-attempt `page.goto` timeout,
  and pre-submission preparation can run twice.
- Result polling nominally uses 15 seconds, a 100 ms poll interval, and a 500 ms
  stability delay. The current loop does not charge browser-read or stability-read
  duration to the 15-second value.
- A result must currently be identical across two normalized reads 500 ms apart and
  the requested target is verified afterward. Google polls only its result snapshot;
  Bing polls route, public controls, and result state; Yandex polls route plus a
  complex editor and destination snapshot. Bing and Yandex therefore perform more
  browser IPC and DOM work per polling cycle.
- Bing and Yandex successful provider completion does not return until visible
  source/result clearing is confirmed or context closure is confirmed. Google keeps
  its successful source and result visible in its reused warm page; routine clearing
  is not a quality or privacy requirement for that provider.
- Startup readiness initializes the currently selected provider. Other providers are
  initialized on demand, and provider/language selection itself does not navigate or
  prewarm a provider. Healthy pages and contexts are retained and reused.
- Existing Linux Bing canary evidence is 4,202 ms cold and 2,607 to 3,151 ms across
  four warm or target-switch requests. Comparable Google, Yandex, and Windows
  baselines do not yet exist, so the Bing measurements cannot define a uniform
  absolute service-level objective.
- Translation source text and results are sensitive. Provider audit and ordinary
  logs contain lengths and closed metadata only.
- Linux x64 and Windows x64 are the supported packaged platforms. macOS distribution
  remains paused.
- Provider contract version `2026-07-25` participates in translation cache identity
  and diagnostic metadata. The approved provider contract requires a version change
  whenever provider behavior can change translation results.
- Provider audit already recognizes the closed translation cause code `timed-out`
  and maps it to timeout severity/error classification, but provider outcomes do not
  currently expose that code.

## Scope

### Included

- **SCOPE-001:** This overlay owns only `TRANSLATE-1`, `TRANSLATE-7`, and
  `TRANSLATE-5` from the accepted comments-to-address assessment, plus the explicitly
  requested selected-text caller-cancellation behavior.
- One absolute operation deadline for cache-miss provider translation.
- One absolute result-phase deadline preserving the existing 15-second value.
- A uniform five-second cleanup deadline for every terminal path.
- A typed `timed-out` translation-provider failure and its localization, audit,
  connection-state, and selected-text workflow behavior.
- Deterministic arbitration among success, ordinary failure, result timeout, overall
  timeout, caller cancellation, supersession, reset, shutdown, and cleanup failure.
- Active cancellation and invalidation of expired Playwright work.
- Context/page ownership detachment, quarantine, late-settlement handling, and
  shutdown/reset interaction.
- The stale-after-`newPage()` identity correction.
- Cross-platform suspend/resume and clock-adjustment behavior.
- Shared provider contract-version updates for Google, Bing, and Yandex.
- Provider-specific completion evidence and fail-closed fallback result acceptance.
- Reduction of redundant result-path browser evaluations and DOM snapshots.
- Separate cold- and warm-path latency measurement for Google, Bing, and Yandex on
  Linux and Windows.
- Deterministic automated and supported-platform manual verification.
- Main-process-only cancellation of the active selected-text translation through the
  existing configured Cancel hotkey.
- Serialized Translation settings persistence and readiness settlement when the
  selected provider changes.

### Non-Goals

- **SCOPE-002:** Findings explicitly not selected by the assessment remain outside
  remediation unless later evidence or a separately approved specification reopens
  them.
- **SCOPE-003:** This artifact defines the specification only. Planning and
  implementation are deferred to later explicit user requests.
- No provider origin, route allowlist, selector, consent, challenge, target-language
  inventory, input limit, result normalization, or source insertion change.
- No retry-count, retryable-error classification, navigation backoff, readiness
  recovery-count, or post-submission replay change.
- No idle context eviction and no change to the approved reuse-until-invalidation or
  app-exit policy for healthy contexts.
- No prewarming of all providers at startup. Selecting a Translation provider may
  initialize only that selected provider and must not create a voice-provider session,
  use credentials, or prepare another Translation provider. Target-language selection
  retains its existing scoped readiness behavior.
- No user-configurable timeout setting, settings migration, database migration,
  preload method, IPC channel, renderer control, or connection-state payload field.
- No cancellation endpoint or operation token for direct `translate-text` IPC.
- No new dependency, browser binary, Electron fuse, package target, installer,
  workflow permission, or mandatory release platform.
- No live provider assertions in automated tests and no use of credentials, private
  selected text, cookies, sessions, screenshots, audio, or transcripts in fixtures.
- No first-non-empty-result acceptance, partial-result tolerance, quality downgrade,
  previous-result contract change, diagnostic capture redesign, or navigation-error
  matcher expansion.
- No macOS packaging or release qualification while distribution is paused.
- No implementation plan, task packet, estimate, commit, push, pull request, or
  release as part of specification authoring.

## Timing Model

### Normative Budgets

| Budget             |  Duration | Begins                                                                                                                    | Ends                                                                                                              |
| ------------------ | --------: | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Provider operation | 60,000 ms | A validated cache-miss translation is accepted for provider dispatch, before registry lookup or provider queue wait       | Provider work enters terminal cleanup, or the budget expires                                                      |
| Result phase       | 15,000 ms | Source insertion completes and result acquisition begins                                                                  | A stable verified result is accepted, a terminal result failure occurs, or the earlier operation deadline expires |
| Terminal cleanup   |  5,000 ms | Any success, failure, cancellation, result timeout, or operation timeout begins visible-state and/or page/context cleanup | Cleanup is confirmed, cleanup fails, or the cleanup budget expires                                                |

- **TIME-001:** The operation deadline includes registry dispatch, provider queue wait,
  context creation/reuse, all navigation retries and backoff, both possible
  preparation passes, consent handling, readiness, source detection, target
  selection, stale-state clearing, one source insertion, result reads, stability
  delay, and target verification. Copy automation and a cache hit remain outside the
  provider operation budget.
- **TIME-002:** The result deadline is absolute. Browser reads, target verification,
  adaptive completion confirmation or fallback stability delay, poll delay, promise
  scheduling, and hook execution all consume its budget. No iteration count may
  stand in for elapsed time.
- **TIME-003:** The effective result deadline is the earlier of its own 15-second
  deadline and the remaining 60-second operation deadline. If the result deadline
  wins, the existing `resultTimeoutOrEmpty` outcome applies. If the operation
  deadline wins, `timed-out` applies.
- **TIME-004:** Every terminal path receives one five-second cleanup budget. The
  provider action therefore settles no later than 65 seconds after provider dispatch
  under normal asynchronous scheduling. Cleanup that begins earlier receives five
  seconds from its own start and does not wait for the operation deadline.
- **TIME-005:** Suspended time counts. A pending operation whose wall-clock deadline
  elapsed while the system was suspended becomes timed out immediately when the
  main process resumes or next evaluates the operation. A result produced before,
  during, or after resume is not accepted once effective elapsed time reaches the
  deadline.
- **TIME-006:** Timer delivery is a wake-up mechanism, not the authority. Every
  asynchronous completion checks the authoritative elapsed-time state before it can
  win. At exact equality (`elapsed >= budget`), expiry wins.
- **TIME-007:** System wall-clock rollback cannot extend a budget already granted.
  Forward wall-clock movement and suspend elapsed time may expire a budget early;
  active-process elapsed time remains non-decreasing. Time sources, timers, and
  resume notification are injectable for deterministic verification.
- **TIME-008:** The contract cannot preempt a synchronous main-process stall or run a
  timer while the process is suspended. After the event loop resumes, no expired
  provider result may become applicable, and settlement proceeds through the bounded
  cleanup path.
- **TIME-009:** Result polling, completion checks, target verification, and visible
  clearing begin without an artificial minimum delay and accept their first
  contract-valid terminal state. Adaptive scheduling may reduce browser work, but it
  must not busy-loop, starve Electron main, or reduce the frequency needed to meet
  the measured latency contract.

## Successful Result Performance and Quality

- **PERF-001:** Performance work applies to Google, Bing, and Yandex independently.
  Each provider must reduce application-controlled time to a correct successful
  result in both a cold path with no healthy initialized context and a warm path with
  a healthy reusable context. An improvement for one provider or path cannot
  substitute for another.
- **PERF-002:** Bing and Yandex may accept a result in less than the fixed
  500-millisecond stability window only when their current public page contract
  exposes equivalent, provider-specific completion evidence. If that signal is
  missing, unsupported, ambiguous, stale, contradictory, or changes before
  acceptance, they fall back to two identical normalized reads at least 500
  milliseconds apart. Google instead accepts its first coherent current-generation
  `changed-after-submission` or `renewed-identical` result immediately. Google's
  Copy control is neither required nor read as a completion signal, and Google never
  applies the two-read 500-millisecond fallback. All providers still require a
  non-empty normalized result, exactly one coherent result region/branch, matching
  source submission, translator origin/route, and requested target.
- **PERF-003:** Startup readiness continues to prepare only the currently selected
  provider. Other providers initialize on the first request that uses them. Provider
  or language selection does not navigate, create a provider session, or issue a
  provider request. Healthy provider contexts remain reusable under the existing
  lifecycle, invalidation, and isolation rules.
- **PERF-004:** Relative performance acceptance compares the current approved
  baseline with the candidate under the same provider, cold/warm state, target,
  sanitized synthetic input shape, clock model, browser fixture, build mode, and
  supported platform. External provider production and network time are recorded
  separately and are not a deterministic pass/fail gate. Every controlled scenario
  must be non-regressing, and each provider's cold and warm path must contain at
  least one strictly lower application-controlled success-latency measurement.
- **PERF-005:** Cold and warm results are classified, measured, and reported
  separately for every provider. Queue delay, initialization/navigation, readiness,
  source submission to first candidate, application confirmation, target
  verification, visible clearing, and browser-evaluation count remain separately
  attributable so a faster total cannot hide delay moved into another phase.
- **PERF-006:** A polling cycle obtains the result plus all route, control, target,
  and completion fields required at that point from one coherent provider snapshot
  wherever the browser contract permits. Stable state is not re-read through
  sequential cross-process calls merely to reconstruct the same snapshot. Cached or
  coalesced state is invalidated on navigation, generation change, target change,
  reset, shutdown, challenge/consent transition, or any page-contract ambiguity.
- **PERF-007:** Bing and Yandex successful visible-state cleanup returns on the first
  confirmed clear state and retains the existing clear-or-close-before-success rule.
  Google delivers a valid selected-text result to the clipboard first, then immediately
  focuses the unique editable source and sends `Control+A` followed by `Backspace`.
  Google does not wait for a Clear control or issue a post-Backspace browser query.
  Optimizing either path may not weaken current-submission, generation, route, target,
  delivery-acknowledgement, or resource-ownership checks.
- **PERF-008:** The Google warm benchmark separately records result-ready and total
  provider settlement latency plus keyboard-clear duration. Result-ready latency
  contains no focus, keyboard, Clear-control, or clear-confirmation work. Google makes
  no post-Backspace page query; Bing and Yandex benchmark baselines and clear phases
  remain unchanged.
- **QUAL-001:** Faster acceptance preserves the exact existing normalization,
  non-empty result, requested-target, origin, route, consent/challenge, public-control,
  generation, and current-submission checks. Fixtures must demonstrate that
  incremental, temporarily stable, repeated-prefix, stale previous, wrong-target,
  and post-navigation text cannot be returned as a completed translation.
- **QUAL-003:** Google creates a page-local submission epoch before it overwrites the
  source control and captures the previous normalized result. A coherent non-empty
  result different from that previous result is `changed-after-submission`; the same
  result is `renewed-identical` only after post-submission result mutation or
  invalidation proves a new generation. An unchanged result without either proof is
  unavailable. Late observations from an older epoch cannot be accepted or schedule
  effects for a newer request.
- **QUAL-002:** Provider-specific completion evidence is an additive fail-closed
  signal, not a replacement for target verification or any trust-boundary check.
  When equivalent completion cannot be proven for a provider state, the slower
  fallback is correct behavior and the event is measured as a fallback rather than
  silently weakening quality.

## Architecture and Ownership

- **ARCH-001:** Deadline, cancellation, provider queue, browser ownership, terminal
  arbitration, audit, clipboard applicability, and cleanup remain owned by Electron
  main. Renderer code continues to use only `window.electronAPI`.
- **ARCH-002:** One state-owning main-process deadline/lifecycle abstraction owns the
  operation deadline, result deadline, cleanup deadline, abort propagation, clock
  reads, timer handles, resume handling, and terminal arbiter. It is constructed by
  the main-process composition root with injected dependencies; no mutable
  module-level runtime instance or free pass-through wrapper is introduced.
- **ARCH-003:** The provider request continues to carry an `AbortSignal`. Deadline
  expiry actively aborts the request and invalidates the provider generation. It must
  also initiate closure of the exact page/context so a Playwright operation that
  ignores the signal cannot continue as applicable background work.
- **ARCH-004:** At most one Translation context is active. A context detached for
  cancellation or cleanup is not active, is never reused, and remains owned by a
  bounded cleanup/quarantine state until closure is confirmed or reported failed.
- **ARCH-005:** An unresolved quarantined Translation context blocks creation of
  another Translation context. This prevents repeated cleanup timeouts from accumulating
  unbounded contexts. Reset, shutdown, or a later confirmed close may clear the
  quarantine, but can never revise an already returned outcome or audit terminal.
- **ARCH-006:** The remediation may close only the shared Translation pages/context.
  It must not close, mutate, or share the persistent voice-provider browser profile,
  renderer state, or unrelated browser work.
- **ARCH-007:** Domain-significant durations, statuses, and failure codes use named,
  shared constants at their narrowest common owner. No per-provider copy of the
  operation, result, or cleanup budgets is permitted.
- **ARCH-008:** No new dependency is required. The implementation remains compatible
  with the repository's strict TypeScript, CommonJS/Webpack, Electron, Node.js 24+,
  Playwright/CloakBrowser, and class-owned main-process composition contracts.
- **ARCH-009:** Performance measurement uses injected clocks, browser doubles, and
  sanitized phase counters owned by the existing main-process provider graph. It
  does not add production telemetry, persisted timing history, a database field, a
  renderer surface, or a mutable module-level benchmark service.
- **ARCH-010:** The main IPC controller serializes a Translation settings mutation
  through persistence and selected-provider readiness. The existing typed settings
  result and connection-state contracts remain unchanged; a successful result means
  persistence and terminal readiness settlement both completed.
- **ARCH-011:** The main-process composition root constructs one class-owned
  Translation browser-resource coordinator with injected CloakBrowser settings,
  context creation, and context options. No renderer/preload/IPC ownership, global
  mutable runtime instance, dependency, or persisted setting is added.

## Concurrency and Terminal Arbitration

- **CONC-001:** Preserve the selected-text single-flight gate. Concurrent duplicate
  hotkey presses remain silently skipped and do not create additional deadline
  objects, provider requests, or cleanup work.
- **CONC-002:** Provider initialization and translation remain serialized through one
  shared Translation browser-resource queue. The 60-second translation budget includes
  time spent behind existing provider work. Expiry while queued prevents source
  insertion and invalidates only the captured page/context generation necessary to
  unblock that operation.
- **CONC-003:** Each operation has exactly one terminal arbiter. Provider success,
  provider failure, result timeout, operation timeout, caller abort, supersession,
  reset, shutdown, cleanup success, and cleanup failure may attempt settlement, but
  only the first contract-valid transition wins.
- **CONC-004:** The terminal precedence is deterministic:
  1. a reset, shutdown, or superseding cancellation already committed before expiry
     remains `cancelledOrStaleOperation` and discardable;
  2. an outcome may win only while the operation and any active result budget remain
     strictly unexpired;
  3. at a deadline boundary, timeout wins over simultaneous success or ordinary
     failure;
  4. failure to confirm required cleanup within its five-second budget replaces the
     underlying terminal outcome with `cleanupFailure`.
- **CONC-005:** Abort, timeout, resume, close, and promise callbacks are idempotent.
  Timer/listener handles are removed on settlement. A late callback may release only
  the resource identity it captured and cannot clear a newer page, context, timer,
  controller, generation, connection state, or audit lifecycle.
- **CONC-006:** No worker thread, lock, or blocking wait is introduced in this path.
  Thread safety means safe asynchronous interleaving in Electron main plus identity-
  guarded interaction with Playwright/browser callbacks.
- **CONC-007:** One provider generation has at most one result snapshot or visible-
  clear operation in flight at a time. Poll timers do not overlap browser evaluations.
  Google clipboard delivery, `Control+A`, and `Backspace` are strictly ordered, and a
  late callback is identity-checked before it can schedule another poll, accept a
  result, clear state, release the provider queue, or mutate measurement counters.
- **CONC-008:** The configured Cancel hotkey keeps its existing priority of Voice
  recording, then Prettify, then active selected-text Translation. Caller cancellation
  is idempotent, owns only that selected-text operation, and retains the action gate
  until the existing bounded provider cleanup settles.
- **CONC-009:** A provider-ID selection keeps the renderer's existing optimistic
  Translation state, inline checking indicator, provider/configuration lock, and
  recording lock active until main readiness settles and the renderer obtains the
  authoritative connection snapshot. Stale connection events cannot settle or
  overwrite the current selection; target-language-only selection does not acquire the
  cross-provider lock.
- **CONC-010:** Google, Bing, and Yandex cannot concurrently navigate, submit,
  inspect, clear, close, or create Translation browser resources. A late operation
  may release only the page/context lease and generation it captured; it cannot close
  a new provider page or cause a second Translation context to be created.

## Provider and Browser Lifecycle

- **LIFE-001:** One main-process Translation browser-resource coordinator owns one
  lazily created in-memory `BrowserContext`, at most one provider page, and one
  global browser-operation queue. Provider instances own only their adapter and
  operation generation state; they do not own independent contexts, pages, or queues.
- **LIFE-002:** Context and page ownership is published only under the current shared
  provider/page generation. If `newPage()` resolves after that generation becomes
  stale, it is never published as active and is detached through the idempotent
  cleanup path without affecting a newer page or context.
- **LIFE-003:** Bing and Yandex normal successful translation clears visible source
  and result state before success. Google selected-text success synchronously
  acknowledges clipboard delivery before it starts clearing, then focuses the unique
  editable source, sends `Control+A` and `Backspace`, and releases its provider queue
  only after Backspace completes. A direct internal translation with no delivery
  callback clears after result acceptance and returns only after cleanup. The
  five-second cleanup deadline still applies to every terminal path that closes,
  clears, or quarantines resources.
- **LIFE-004:** Timeout, cancellation, stale work, ordinary terminal failure, failed
  visible clearing, reset, and shutdown invalidate active ownership before late page
  work can become applicable. Post-submission timeout never reloads, recreates, or
  reinserts text.
- **LIFE-005:** If page/context closure succeeds within the cleanup budget, audit
  metadata reports confirmed closure and the provider may create or reuse resources
  according to the existing healthy-context contract.
- **LIFE-006:** If cleanup throws or cannot be confirmed within five seconds, the
  outcome is `cleanupFailure`, connection detail is `cleanup-failed`, and the
  uncertain resource is never reused. A late successful close may release quarantine
  for future work but cannot retroactively change clipboard effects, notification,
  cache, returned outcome, or terminal audit.
- **LIFE-007:** At most one close operation is in flight for the same resource
  identity. Page-before-context ordering is preserved where required, and repeated
  cancellation/reset/shutdown calls coalesce with or safely observe that close.
- **LIFE-008:** A provider whose unresolved quarantined cleanup blocks new work
  returns a bounded cleanup failure rather than waiting indefinitely or constructing
  another context.
- **LIFE-009:** On a Google request-level failure, caller cancellation, or timeout,
  invalidate the page-local submission epoch and discard late effects. A delivery
  rejection or exception never starts keyboard clearing. Once keyboard clearing has
  started, a later terminal path cannot start a competing clear or reuse the page until
  that work settles or ownership moves to the existing page-before-context
  close/quarantine path. Provider/settings reset and application shutdown always close
  Google resources so changed proxy, fingerprint, locale, and runtime settings apply.
- **LIFE-010:** A provider-ID change waits for prior shared resource work to settle,
  closes the old provider page, clears all Translation-context cookies, permissions,
  HTTP cache, and storage for the canonical Google, Bing, and Yandex origins through a
  temporary blank control page, then creates and initializes one fresh page for the
  selected provider. Repeated requests and target-language changes for the same
  provider retain the healthy warm page. A failed page close or session clear closes
  the full context page-before-context, quarantines unresolved cleanup, and blocks new
  work until that exact context settles; only then may a replacement context be made.

## Failure and User-Visible Behavior

- **FAIL-001:** Add `timed-out` to the closed translation provider failure contract.
  It is a non-discarded user-visible failure distinct from
  `resultTimeoutOrEmpty`, `navigationFailure`, `pageContractFailure`,
  `cancelledOrStaleOperation`, and `cleanupFailure`.
- **FAIL-002:** A `timed-out` selected-text action restores the prior clipboard,
  writes no translation, creates no cache entry, emits no success notification, and
  presents a localized message equivalent to “Translation timed out. Try again.”
  The message contains no provider error, URL, selected text, result text, or timing
  internals.
- **FAIL-003:** An operation timeout closes/invalidate its provider context, so the
  connection state becomes `not-connected` with the existing
  `unexpected-failure` detail. No new renderer/preload/IPC connection-state value or
  payload field is introduced.
- **FAIL-004:** `resultTimeoutOrEmpty` retains its current localized result-unavailable
  behavior, but is emitted only after the absolute result deadline wins. It never
  triggers source replay.
- **FAIL-011:** If selected-provider initialization fails after settings persistence,
  the selected provider remains persisted and the existing typed connection state
  presents the safe failure. Only validation or persistence failure rolls the renderer
  back to its prior confirmed settings.
- **FAIL-012:** Session clearing or provider-page replacement failure is a private
  cleanup failure. The newly selected provider remains persisted and receives the
  existing typed failure state; no stale provider result, cache, clipboard write,
  success notification, diagnostic success, or connection success may escape.
- **FAIL-005:** `cleanupFailure` continues to override success or the original
  failure whenever required cleanup throws, reports failure, or misses the cleanup
  deadline. Existing cleanup-failure localization and connection detail remain
  authoritative.
- **FAIL-006:** Reset, shutdown, settings invalidation, or supersession that wins
  before the operation deadline remains discardable cancellation/staleness: no
  clipboard restoration from stale ownership, notification, cache mutation, or
  connection-state overwrite occurs.
- **FAIL-007:** Invalid input, unsupported provider/target, consent/challenge,
  navigation, and page-contract behavior remain unchanged unless the overall
  deadline wins first.
- **FAIL-008:** The provider action gate is released after the accepted terminal
  outcome and bounded cleanup settle. A later manual hotkey invocation is the only
  way to retry source text after submission ambiguity.
- **FAIL-009:** If caller cancellation wins, the selected-text workflow restores only
  its captured prior clipboard, returns the existing cancelled action status, and
  performs no cache write, result copy, success notification, success diagnostic
  capture, or connection-state update. Reset, shutdown, supersession, or staleness
  that wins first remains silently discarded and cannot restore clipboard data.
- **FAIL-010:** `resultDeliveryFailure` is an internal, non-connection failure used
  when the selected-text result-ready callback rejects delivery or throws before
  Google cleanup begins. It emits no keyboard clearing, cache entry, success
  notification, successful diagnostic capture, connection-state update, or success
  audit. The selected-text workflow restores its captured clipboard and presents the
  existing generic Translation failure message.

## Translation Activity Presentation

- **UX-001:** For a configured selected-text Translation hotkey, show the existing
  cross-platform `processing` tray icon exactly once after selection/input validation
  and cache lookup have accepted a cache-miss provider run. Retain it through the
  operation's accepted terminal outcome and bounded cleanup, then restore the
  recording-derived tray state. Invalid selection, cache hit, skipped or pre-dispatch
  cancelled work, and direct `translate-text` IPC do not change the tray. Presentation
  failure is fail-open and cannot expose selected text, result text, or raw errors.

## Security and Privacy

- **SEC-001:** Selected text, translation results, provider pages, URLs, cookies,
  sessions, browser storage, and raw Playwright errors remain sensitive. Deadline,
  cleanup, audit, localization, logging, tests, and manual evidence never persist or
  expose those values.
- **SEC-002:** Deadline state contains only timing, provider ID, contract version,
  target code, safe phase, attempt count, lengths, generation/resource identities,
  and closed outcome metadata. It does not copy source/result text into timer labels,
  error messages, logs, filenames, diagnostics metadata, or test descriptions.
- **SEC-003:** Provider audit remains fail-open for the translation result but
  privacy-closed for metadata. `timed-out` maps to timeout error class and warning
  severity, uses one terminal event, and contains no raw exception message or URL.
- **SEC-004:** Deadline and cleanup behavior never adds a retry, source replay,
  fallback provider, source-bearing URL, challenge suppression, consent acceptance,
  private endpoint, or new external request.
- **SEC-005:** Expiry revokes applicability before cleanup begins. Late provider
  content is untrusted and cannot reach clipboard, cache, notification, diagnostic
  capture, connection success, or another operation even if Playwright resolves
  after abort.
- **SEC-006:** Cleanup touches only the exact shared Translation page/context lease
  captured by the terminal operation. Identity guards prevent an old timeout from
  closing a newer page, a replacement context, or a different provider's lease.
- **SEC-007:** A cleanup timeout is not represented as confirmed deletion. Provider-
  side retention and an unconfirmed local context remain residual risks disclosed by
  `cleanupFailure`; the context is quarantined from reuse and retried only through
  owned lifecycle cleanup.
- **SEC-008:** Latency optimization adds no provider prewarming beyond existing
  selected-provider startup readiness, no provider fallback, private endpoint,
  network interception, hidden API, challenge suppression, consent acceptance, or
  source-bearing URL. Completion evidence comes only from the already allowed public
  provider page and is validated under the same origin and route contract.
- **SEC-009:** Baselines, counters, test names, benchmark output, manual evidence,
  logs, and audits contain only provider ID, contract version, supported platform,
  cold/warm classification, safe phase, elapsed duration, evaluation counts, target
  code, and source/result lengths. They never contain source text, result text, URLs,
  DOM content, cookies, sessions, screenshots, raw errors, or account data.
- **SEC-010:** Caller cancellation introduces no renderer privilege, IPC surface,
  operation identifier, source-bearing log entry, or provider request. The abort
  signal remains owned by the main-process selected-text operation and is linked only
  to its existing lifecycle.
- **SEC-011:** Browser-session clearing is main-process-only and never exposes or
  records cookie values, site storage, page content, URLs, CDP traffic, or provider
  account state. The temporary control page is closed before a provider page is opened.

## Audit, Diagnostics, and Localization

- **OBS-001:** Overall expiry uses cause code `timed-out`, error class `timeout`, warn
  severity, operation `translate`, and the last safely entered provider phase. It
  records elapsed duration, attempt count, provider ID, contract version, target
  language, source length, whether submission occurred, and confirmed page-closed
  state only.
- **OBS-002:** Result timeout remains `resultTimeoutOrEmpty`. Cleanup deadline or
  close failure becomes `cleanupFailure` with error class `cleanup`. Cancellation and
  stale outcomes remain distinguishable and discardable.
- **OBS-003:** Every operation emits exactly one audit terminal event. No phase,
  retry, recovery, cleanup, or late browser event follows that terminal event.
  Timeout does not add audit events per timer tick or result poll.
- **OBS-004:** The provider-audit archive schema remains version 1. `timed-out` is
  already an allowed translation audit cause, so no audit field/type/semantic change
  or diagnostics database migration is required.
- **OBS-005:** Add one translation-timeout localization key to every checked-in
  locale and preserve locale-key parity/type checks. Provider-controlled content is
  never interpolated into the message.
- **OBS-006:** Diagnostic capture remains default-off and occurs only for accepted
  success/cache outcomes. A late success suppressed by timeout is never handed to
  diagnostic capture.
- **OBS-007:** Performance acceptance evidence is test or manually recorded
  verification evidence, not a new production analytics stream. Fallback use and
  provider phase duration may be asserted through sanitized injected test counters;
  ordinary runtime logging remains unchanged.

## Compatibility, Versioning, and Configuration

- **COMP-001:** Linux x64 and Windows x64 receive identical budgets, boundary
  comparisons, suspend policy, failure codes, cleanup behavior, and terminal
  precedence. No OS-localized browser error text or platform signal is part of the
  deadline contract.
- **COMP-002:** macOS TypeScript compilation may remain compatible, but this work
  does not resume macOS packaging, signing, notarization, smoke testing, or release
  support.
- **COMP-003:** Deadlines are fixed internal policy. No user setting, environment
  override, persisted value, IPC channel, preload method, renderer type/control, or
  migration is introduced. Tests override time only through injected dependencies.
- **COMP-004:** Google, Bing, and Yandex contract versions all advance from
  `2026-07-25` to `2026-08-09`. This invalidates version-keyed in-memory translation
  cache entries and makes diagnostic evidence distinguish the new deadline,
  lifecycle, and result-acceptance contract. Provider IDs, target codes, settings,
  and target inventories do not change.
- **COMP-005:** Additive `timed-out` provider failure handling updates every exhaustive
  main-process switch and test double. It does not cross renderer IPC and does not
  change the shape of `TranslationProviderConnectionState`.
- **COMP-006:** Linux and Windows preserve identical selected-provider-only startup
  readiness, on-demand initialization, cold/warm classification, quality fallback,
  and performance gates. A provider-ID selection may perform the explicitly selected
  page replacement and session reset; target-language selection remains free of that
  browser-resource side effect on both platforms.
- **CONF-001:** Operation, result, and cleanup durations are named constants with
  complete injected clock/timer/abort dependencies. Production construction remains
  in the main-process composition root.
- **CONF-002:** No dependency, lockfile, package metadata, installer, workflow,
  permission, browser binary, or generated artifact changes.
- **CONF-003:** Rollback consists of reverting the coordinated runtime, provider
  contract version, localization, and tests. Settings and stored data require no
  rollback or repair.

## Acceptance Criteria

### Deterministic Automated Acceptance

- **ACC-001:** A fake clock proves the operation is live at 59,999 ms and that expiry
  wins at exactly 60,000 ms before registry/queue, navigation, readiness, submission,
  result, and target-verification completions can be accepted.
- **ACC-002:** Queue tests prove waiting behind provider initialization or earlier
  provider work consumes the operation budget, expiry prevents insertion, the timed-
  out generation does not wedge the queue, and a later operation can proceed only
  after cleanup/quarantine permits it.
- **ACC-003:** Result tests prove browser-read duration, adaptive completion
  confirmation or fallback 500 ms stabilization, verification, and poll delay
  consume the absolute 15-second budget. They cover the result deadline winning, the
  operation deadline winning first, exact equality, an empty result, a changing
  result, ambiguous completion evidence, fallback, and a late stable result.
- **ACC-004:** Post-submission timeout tests prove one insertion, zero automatic
  navigation/recreation/reinsertion, closure/invalidation of the captured resource,
  suppression of late result text, previous-clipboard restoration, no cache write,
  no success notification, and the localized timeout failure.
- **ACC-005:** Cleanup tests cover success, ordinary failure, result timeout, overall
  timeout, cancellation, reset, shutdown, visible-clear failure, page-close failure,
  context-close failure, completion at 4,999 ms, expiry at 5,000 ms, and late cleanup
  settlement. Cleanup expiry yields `cleanupFailure` and never permits resource reuse.
- **ACC-006:** Concurrency tests permute simultaneous completion, timeout, abort,
  supersession, reset, shutdown, and cleanup callbacks. Every permutation produces
  one returned outcome, one audit terminal, no post-terminal event, no double close,
  and no mutation of newer ownership.
- **ACC-007:** A deferred `newPage()` test invalidates the first generation while page
  creation is pending, resolves the stale page, and proves identity-guarded context
  detachment, one detached cleanup owner, a fresh later context, and no stale field or
  double owned close.
- **ACC-008:** Clock tests simulate active elapsed time, wall-clock rollback, forward
  movement, Linux-like suspend where monotonic time pauses, and Windows-like suspend
  where it advances. Both supported-platform models time out immediately after 60
  seconds of wall-clock elapsed time and reject late results.
- **ACC-009:** Audit/privacy tests prove `timed-out` normalization, timeout severity,
  safe metadata allowlists, exact terminal count, cleanup override, and absence of
  source text, result text, URL, provider error message, stack, cookie, or session
  canaries from outcomes, logs, audit rows, and diagnostics.
- **ACC-010:** Contract tests prove all provider versions are `2026-08-09`, cache
  identity changes with the version, all failure/connection/audit switches are
  exhaustive, every locale contains the timeout key, and IPC/renderer connection
  payload shape is unchanged.
- **ACC-011:** Google, Bing, Yandex, base lifecycle, translation runtime,
  selected-text translation, provider audit, localization, shared contract, reset,
  shutdown, performance fixtures, and composition-root focused tests pass without
  live network access or real-time sleeps.
- **ACC-012:** Repository format, lint, strict typecheck, type tests, full automated
  tests, and production build pass. No check is weakened, skipped, or made
  platform-conditional to obtain a pass.
- **ACC-017:** Provider contract fixtures drive, for Google, Bing, and Yandex, an
  incremental partial result, a temporarily unchanged partial result, a repeated
  prefix, a stale previous result, a wrong-target result, a route transition,
  contradictory completion state, supported completion evidence, and absent
  completion evidence. Only the completed current-submission result is accepted. A
  supported fast path accepts strictly before the 500-millisecond fallback boundary;
  every ambiguous case uses the full fallback and still verifies the target.
- **ACC-018:** Lifecycle tests classify cold and warm requests independently for
  every provider, retain startup readiness only for the selected provider, reuse one
  healthy shared context and same-provider warm page, and prove target-language
  selection creates no navigation, session reset, provider request, or prewarm work.
  A provider-ID selection creates only its selected fresh page after the required
  session reset. Invalidated, stale, and quarantined resources can never be
  misclassified as warm.
- **ACC-019:** A repeatable controlled benchmark records baseline and candidate
  application-controlled duration for Google, Bing, and Yandex cold and warm paths
  under the same virtual provider timeline. All six provider/path totals are
  strictly lower in the candidate; no named application-controlled phase regresses,
  and no result is accepted with weaker quality evidence. Provider production and
  network delay are held constant in the benchmark and reported separately in live
  evidence.
- **ACC-020:** Browser doubles prove each polling cycle uses one coherent required
  snapshot wherever the page contract permits, snapshot evaluations never overlap,
  route/control/target state is invalidated at every required boundary, clear
  confirmation returns on the first valid cleared snapshot, and evaluation/timer
  counts do not increase relative to baseline. Fast-path, fallback, timeout,
  cancellation, reset, and shutdown cases all preserve these bounds.
- **ACC-024:** Deterministic Google tests prove sequential requests atomically replace
  rather than append source text, acknowledge clipboard delivery before source focus,
  send exactly `Control+A` then `Backspace`, make no post-Backspace page query, and
  reuse one page/context. A deferred Backspace blocks later source submission. Tests
  retain immediate changed output, identical output after generation evidence,
  unchanged output without that evidence, empty/intermediate text, wrong route or
  target, stale previous output, and late older-generation coverage. They also cover
  delivery rejection/exception, keyboard failure, successful close fallback,
  cancellation, timeout, reset, shutdown, hung browser work, quarantine, and absence
  of late clipboard/cache/notification/diagnostic/connection effects.
- **ACC-025:** Deferred Translation settings tests prove the provider-change spinner
  and all existing provider/configuration locks remain active until readiness and an
  authoritative connection query settle. They cover success, typed initialization
  failure with persisted selection, unexpected initialization exception, rejected
  persistence with no initialization, serialized repeated requests, stale connection
  events, target-language isolation, disabled Translation, and a successful later
  provider selection.
- **ACC-026:** Deterministic shared-resource tests prove Google-to-Bing-to-Yandex
  switching creates one retained context, closes the old provider page before each
  fresh selected-provider page, clears cookies, permissions, cache, and all canonical
  provider-origin storage using a temporary blank control page, and never leaves two
  Translation pages active. They cover same-provider warm reuse, global serialization,
  cancellation, timeout, stale `newPage()`, reset, shutdown, page/session/context
  close failure, five-second quarantine, late settlement, and recovery without
  clipboard, cache, notification, diagnostics, connection, or audit side effects.
- **ACC-022:** Deterministic selected-text and runtime tests prove that the existing
  Cancel hotkey cancels only an active selected-text translation; cancellation before
  dispatch prevents provider lookup, cancellation after submission discards late
  success, the prior clipboard is restored exactly once, no success side effects or
  connection-state overwrite occur, reset-first work remains silent, and one
  cancelled audit terminal and renderer status result.
- **ACC-023:** Deterministic selected-text and shortcut tests prove a cache-miss
  Translation run changes the tray from its recording-derived state to `processing`
  only when provider work begins, keeps it there until success, failure, timeout, or
  caller cancellation settles, and restores it exactly once. Cache hits, invalid,
  skipped, direct IPC, and pre-dispatch cancelled paths do not change the tray; a
  duplicate or throwing presentation observer cannot affect operation effects or leak
  private text.

### Supported-Platform Manual Acceptance

- **ACC-013:** On representative packaged Linux x64 and Windows x64 builds, a
  non-sensitive synthetic stalled translation demonstrates timeout presentation,
  prior-clipboard restoration, no late clipboard change, and action recovery within
  the 60-second operation plus five-second cleanup contract, allowing only ordinary
  scheduler tolerance documented with the evidence.
- **ACC-014:** On Linux and Windows, suspend a synthetic pending translation past its
  deadline and resume. The action times out before any provider result can be
  accepted, cleanup remains bounded, and no stale notification/cache/clipboard
  effect appears.
- **ACC-015:** On each supported platform, perform non-sensitive successful smoke
  translations through Google, Bing, and Yandex to confirm that healthy warm-context
  reuse, target selection, adaptive or fallback acceptance, clearing, clipboard copy,
  and notification behavior remain intact. Live provider behavior is manual evidence
  only and never an automated gate.
- **ACC-016:** Record any provider availability, external markup, network, proxy, or
  platform limitation as a verification gap. Never substitute credentials, private
  text, challenge suppression, or a weakened timeout/cleanup check.
- **ACC-021:** Before-and-after supported-platform evidence records at least one cold
  and four warm non-sensitive synthetic translations per provider on representative
  packaged Linux x64 and Windows x64 builds. Use the same machine, build mode, target,
  input shape, provider state, and nearby network window for each comparison; report
  safe phase durations separately from end-to-end time. External variability alone
  is not a deterministic failure, but an apparent regression must be explained by
  controlled evidence or the performance work is not accepted.

## Rejection Criteria

The remediation is not acceptable if any of the following is true:

- an operation or cleanup uses only attempt counts instead of authoritative elapsed
  time;
- a caller settles while still-applicable Playwright work continues with selected
  text;
- a late result can reach clipboard, cache, notification, diagnostic capture,
  connection success, or another operation;
- timeout is silently represented as cancellation, or cleanup uncertainty is
  represented as timeout/success;
- an exact-deadline race behaves differently according to promise/timer ordering;
- suspend time counts on one supported platform but pauses on the other;
- a stale or quarantined context can be reused, double-owned, or clear a newer
  context field;
- more than one unresolved context can accumulate for a provider;
- source text is replayed after insertion;
- any provider's cold or warm controlled success path lacks a strict
  application-controlled latency improvement, or an improvement merely moves delay
  into another named phase;
- the first non-empty snapshot, an incomplete result, stale completion evidence, or
  a wrong-target result can pass the fast path;
- result acceleration weakens origin, route, challenge/consent, public-control,
  normalization, generation, current-submission, or target verification;
- polling or clearing creates overlapping browser evaluations, a busy loop, or more
  browser evaluations/timers than the controlled baseline;
- provider or language selection causes navigation or provider-session activity, or
  providers other than the selected provider are prewarmed at startup;
- a timeout adds provider fallback, origin/selector change, retry, private endpoint,
  or challenge suppression;
- raw sensitive or provider-controlled data enters errors, logs, audits, diagnostics,
  benchmarks, fixtures, or manual evidence;
- provider contract versions, cache identity, failure mappings, localization, or
  audit contracts are left inconsistent; or
- renderer/preload/IPC/settings/database/dependency/packaging/release scope expands
  without a separately approved specification revision.

## Residual Risks and Operational Notes

- JavaScript cannot run deadline callbacks while the process is suspended or the main
  event loop is synchronously blocked. This contract prevents acceptance after
  resumption; it cannot guarantee wall-clock UI repaint during suspension.
- Playwright/browser close may fail or ignore cancellation. The five-second cleanup
  deadline bounds caller settlement and quarantines uncertain ownership, but does not
  prove provider-side deletion or operating-system process termination.
- Provider pages and networks remain external and can change independently. Existing
  fail-closed origin, challenge, selector, and contract checks remain the authority.
- Provider completion indicators may change or disappear. Such states intentionally
  return to the 500-millisecond stability fallback; this can reduce the observed
  speedup but must never reduce result quality.
- The application can reduce only its own browser round trips, scheduling,
  confirmation, and lifecycle overhead. Provider computation and network latency
  remain variable, so this contract requires relative controlled improvements rather
  than an unverified universal end-to-end latency promise.
- Manual live-provider canaries are availability evidence, not deterministic proof.
- No migration or rollout switch exists. The provider contract-version change and
  application restart provide the compatibility boundary.
