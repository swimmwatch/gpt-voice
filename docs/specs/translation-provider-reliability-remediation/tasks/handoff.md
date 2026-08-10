# Handoff: Translation Provider Reliability Remediation

## Status

Packets 01–05, 07, and 08 are committed as `e1fe686`, `de5ec2e`, `02fbd227`,
`1ca2f81e`, `d43fcc70`, `80f801a`, and `71794a9`. Packet 09 is committed as
`fe5f583`, and Packet 10 is committed as `6a918dd`. Packet 06 remains a later
manual-gate packet and requires separate execution authorization.

Packet 10 is committed as `6a918dd`. Packet 11 is implemented and intentionally
uncommitted. It transfers Translation browser ownership to one shared coordinator,
which retains one warm context and one provider page while safely resetting the
provider site session on a provider change.

The full unit-suite gate remains incomplete: the current run produced no test output
for one minute and was stopped with exit 130. This is consistent with the previously
recorded diagnostics-archive idle condition, but the current filtered run did not
identify a specific test. Do not claim full-suite verification.

## Completed Packets

- [01 Capture the controlled performance baseline](01_capture_controlled_performance_baseline.md)
  - Added deterministic Google, Bing, and Yandex cold/warm fixtures that run the real
    provider classes without browser launch or network access.
  - Recorded six immutable application-controlled baseline cells. Google and Yandex
    retain the current 500 ms confirmation; Bing cold also retains its existing 250 ms
    catalog-stability delay.
- [02 Build the deadline and timeout contract](02_build_deadline_and_timeout_contract.md)
  - Added a dormant, class-owned main-process lifecycle with absolute 60-second
    operation, 15-second result, and five-second cleanup budgets.
  - The lifecycle uses wall and active monotonic clocks, timer/resume wake-ups,
    linked cancellation, idempotent disposal, terminal arbitration, and typed,
    privacy-safe state only. Provider dispatch is not activated until Packet 03.
  - Added the non-discarded `timed-out` provider failure, localized it in every
    checked-in catalog, mapped it to timeout audit classification and the existing
    unexpected connection state, and preserved clipboard/cache/result safety.
- [03 Integrate bounded operation and resource lifecycle](03_integrate_bounded_operation_and_resource_lifecycle.md)
  - Wired one operation-owned lifecycle from validated runtime dispatch through the
    provider request, with injected wall/monotonic clocks, timers, abort construction,
    and a removable Electron resume listener.
  - Made provider resource ownership generation-keyed; timed-out, stale, reset, and
    shutdown work cannot close newer resources. Successful cleanup closes its owned page
    before its context; unconfirmed cleanup remains quarantined until a late close confirms.
  - Added deterministic tests for a result hook that ignores abort and for cleanup
    expiry/quarantine release, while preserving one-way source submission and private
    timeout presentation.
- [04 Accelerate provider result processing](04_accelerate_provider_result_processing.md)
  - Replaced the base result-loop pair of read and later target verification with one
    provider-owned observation hook. Google, Bing, and Yandex production adapters now
    obtain result, route, and target state from one public-page evaluation per poll.
  - Retained the quality-preserving 500 ms two-identical-read fallback for every provider.
    All completion classifications are represented in the contract, but no provider fast
    signal is enabled without the separate live public-page inspection authorization.
  - Enforced the absolute injected result deadline across polls and fallback delay; exact
    deadline equality returns a timeout before a late confirmation can be accepted.
- [05 Close automated acceptance and privacy gates](05_close_automated_acceptance_and_privacy_gates.md)
  - Passed the exhaustive deterministic provider/lifecycle/runtime/selected-text/audit/
    privacy/localization/composition quality gate without live provider access.
  - Corrected only Prettier drift in Packet 04 files; no production behavior, public
    contract, dependency, IPC, settings, database, package, or workflow change was needed.
- [07 Enable selected-text translation cancellation](07_enable_selected_text_translation_cancellation.md)
  - Added one selected-text-owned caller abort operation, linked it to the shared
    translation lifecycle, and made pre-dispatch cancellation settle before provider
    lookup or source submission.
  - Routed the existing Cancel hotkey after Voice recording and Prettify. A caller-won
    cancellation restores the captured clipboard and emits the existing cancelled
    renderer status without result/cache/notification/diagnostic-success or connection
    effects; reset-first work remains silent.
- [08 Show Translation tray activity](08_show_translation_tray_activity.md)
  - Added a fail-open, main-process-only run observer that fires once after selected-text
    validation and a cache miss, immediately before Translation provider dispatch.
  - The configured Translation hotkey now changes the existing tray to `processing` for
    that provider run, then restores the recording-derived icon only after the same
    promise settles, including failure, timeout, and bounded cancellation cleanup.
- [09 Google Translation copy then keyboard clear](09_google_translation_overwrite_and_reuse.md)
  - Preserved Google source overwrite and immediate changed-result or mutation-proven
    identical-result acceptance, then acknowledged selected-text clipboard delivery
    before any visible cleanup begins.
  - Replaced Google Clear-button polling with focused `Control+A` and `Backspace`, made
    the provider queue wait for keyboard settlement, and retained the warm page after
    successful cleanup. Bing and Yandex keep their clear-before-success behavior.
- [10 Translation provider switch readiness](10_translation_provider_switch_readiness.md)
  - `set-translate-settings` serializes persistence plus selected-provider
    initialization and returns only after terminal readiness. Persisted provider
    selection is retained for typed readiness failure; persistence rejection does
    not initialize a provider.
  - The renderer optimistically selects the candidate, keeps its inline checking
    state and existing provider/recording locks until the authoritative connection
    query settles, and accepts only current-selection connection events or query
    state. Target-language changes retain their Translation-only save lock.
  - A post-startup Translation readiness check no longer contributes to first-launch
    presentation, so a provider switch cannot replace the main window with the
    startup loader.
- [11 Shared Translation browser context](11_shared_translation_browser_context.md)
  - Added one composition-root-owned `TranslationBrowserResourceCoordinator`, injected
    into Google, Bing, and Yandex provider instances. It owns one lazy context, one
    provider page, the shared queue, generation-safe page leases, close/quarantine
    ownership, and idempotent shutdown.
  - Same-provider requests and target-language changes reuse the warm page. A provider
    change closes its old page, clears cookies, permissions, cache, and canonical
    provider-origin storage through a temporary control page, then opens one fresh
    provider page in the retained context.
  - A cancelled context launch blocks replacement context creation until its stale
    context has returned and been closed, preventing an overlapping context race.

## Packet 09 Result

- Google atomically overwrites source text and accepts current-generation results without
  Copy-control readiness or the 500 ms fallback. Selected-text delivery now occurs before
  source focus, `Control+A`, and `Backspace`; no Google page inspection follows Backspace
  in that cleanup operation.
- A page-local epoch, current source value, route/target checks, and result-region
  mutation count distinguish changed output from renewed identical output. An
  unchanged prior result remains unavailable, and a replacement page restarts evidence
  at its own page-local epoch.
- Delivery rejection or exception starts no keyboard cleanup. A confirmed close after
  keyboard failure preserves the delivered result; unconfirmed close/quarantine remains
  a cleanup failure. Enqueueing another request no longer invalidates the operation that
  is still clearing, and the later request cannot prepare or insert until settlement.
- The deterministic controlled Google measurements are 55 ms result-ready, 5 ms
  keyboard-clear, and 60 ms total cold; 40 ms result-ready, 5 ms keyboard-clear, and
  45 ms total warm.
- A sanitized no-login Linux CloakBrowser smoke used synthetic text only on one reused
  page. Three sequential samples measured 630/28/676 ms, 338/22/377 ms, and
  448/19/482 ms for result-ready/keyboard-clear/total. A separate same-result run
  observed mutation-backed identical generation at 326 ms and final keyboard clearing
  at 26 ms. The smoke issued no page inspection after final Backspace. No text, URL,
  cookie, account data, screenshot, network payload, or page content was retained in
  workstream evidence.

## Changed Files

- Packet 01 was committed with the workstream specification/plan, baseline test, and evidence.
- Packet 02 was committed with the dormant lifecycle, typed timeout contract, locales,
  and its focused tests.
- Packet 03 updates the composition root, Electron main entry point, translation runtime,
  base provider, request contract, provider audit compatibility, provider metadata, and
  focused provider/runtime/composition/diagnostics tests.
- Packet 04 updates the shared result-observation contract, base provider timing, Google,
  Bing, and Yandex public-page adapters, deterministic provider tests, and the controlled
  performance evidence.
- Packet 05 records the durable execution decision, formats Packet 04 source and test
  files, appends the sanitized automated-acceptance evidence, and updates workstream
  completion state.
- Packet 07 updates the selected-text Translation workflow, translation runtime,
  internal failure marker, Cancel shortcut, focused deterministic tests, and workstream
  contract/plan/packet artifacts. It adds no dependency, renderer, preload, IPC,
  settings, database, provider-adapter, generated artifact, or release change.
- Packet 08 updates the selected-text Translation service and operation, Translation
  shortcut presentation, focused deterministic tests, and workstream contract, decision,
  plan, checklist, handoff, and Packet 06 manual-gate artifacts. It adds no dependency,
  renderer, preload, IPC, settings, persisted data, provider-adapter, generated asset,
  packaging, or release change.
- Packet 09 updates the internal delivery/failure contract and audit mapping, selected-
  text delivery bridge, Base Provider serialization/lifecycle, Google public-page
  adapter, focused provider/runtime/selected-text/performance/audit tests, and workstream
  artifacts. It adds no renderer, preload, public IPC, settings, persisted schema,
  dependency, package, or release change. Existing unrelated Local Whisper, review,
  headless-test, provider-status, and renderer worktree changes remain untouched and are
  not owned by this packet.
- Packet 10 updates Translation settings IPC serialization and terminal fallback,
  Translation runtime failure settlement, renderer selection/connection ownership,
  and focused IPC/renderer state tests. It does not add IPC, preload, public API,
  persistence, dependency, package, provider-adapter, or release changes.
- Packet 11 updates Translation browser ownership in the composition root, provider
  factory, and base provider; adds the coordinator and deterministic coordinator tests;
  and updates only Translation reliability workstream artifacts. It adds no renderer,
  preload, IPC, settings, persistence, dependency, provider contract, packaging, or
  release change.

## Checks

- Packet 01 checks remain in commit `e1fe686`; Packet 02 verification is in commit `de5ec2e`.
- Packet 03 focused deterministic suite — passed across lifecycle, base provider,
  registry, runtime, selected text, composition, audit/privacy, shared contracts, and
  diagnostics/manifest compatibility.
- Packet 04 focused deterministic suite — passed across base, Google, Bing, Yandex,
  controlled performance, runtime, composition, and shared contracts. Each of the six
  candidate cold/warm cells is strictly faster than its immutable baseline with no phase
  regression and no additional browser evaluation.
- `npm run typecheck`, `npm run test:types`, scoped ESLint, scoped Prettier, and
  `git diff --check` — passed for Packet 04.
- Packet 05 focused gate — 18 named deterministic test files passed across providers,
  lifecycle, runtime, selected-text effects, audit/privacy, localization, composition,
  and shared contracts.
- Packet 05 full gate — `npm run format:check`, `npm run lint`, `npm run typecheck`,
  `npm run test:types`, `npm test`, `npm run build:prod`, and `git diff --check` passed.
  Lint exited successfully with 88 existing unrelated warnings and no errors.
- Packet 07 focused deterministic suite — `node --import tsx --test
tests/main/selectedTextTranslation.test.ts tests/main/translationRuntime.test.ts
tests/main/shortcuts.test.ts tests/main/shortcutController.test.ts`, `npm run typecheck`,
  and `npm run test:types` passed. Scoped ESLint and Prettier checks plus `git diff --check`
  passed cleanly.
- Packet 07 compatibility suite — Base Provider, provider-registry, operation-lifecycle,
  provider-audit, and renderer status-presentation tests passed without live provider
  access.
- Packet 08 focused deterministic suite — `node --import tsx --test
tests/main/selectedTextTranslation.test.ts tests/main/shortcutController.test.ts
tests/main/shortcuts.test.ts` passed with 47 tests. `npm run typecheck`, `npm run
test:types`, scoped ESLint, scoped Prettier, and `git diff --check` passed cleanly.
- Packet 09 focused deterministic suite — Base, Google, Bing, and Yandex providers;
  lifecycle and registry; runtime and selected text; shortcut/tray; controlled
  performance; result text; and provider-audit mapping/privacy tests passed without
  credentials or private data.
- `npm run typecheck` and `npm run test:types` passed. Scoped ESLint passed with no
  issues; scoped Prettier, YAML parsing, and `git diff --check` passed.
- Packet 10 focused Translation settings IPC/runtime/status/state/section and
  first-launch coordinator/loader/window tests passed. `npm run typecheck`,
  `npm run test:types`, scoped ESLint, scoped Prettier, and YAML validation passed.
- Packet 11 focused coordinator, Base Provider, Google/Bing/Yandex providers, registry,
  lifecycle, controlled performance, runtime, selected-text, shortcut/tray,
  Translation settings/switching, provider-status, and composition tests passed.
  `npm run typecheck`, `npm run test:types`, scoped ESLint, scoped Prettier, and
  `git diff --check` passed.
- Packet 11 `npm test` was stopped after one minute without test output (exit 130).
  The full-suite verification gate is incomplete; no test failure is claimed.
- The required `npm test` full-unit run did not report a test failure, but remained
  idle in `tests/main/diagnosticsArchive.test.ts` for over ten minutes and was
  deliberately terminated with exit 143. It must be rerun successfully before a
  full-suite verification claim.

## Exact Next Packet

- [06 Qualify supported packaged platforms](06_qualify_supported_packaged_platforms.md)

## Blockers

- Packet 06 requires separate execution authorization and its supported-platform manual
  gates; it must not start from this packet. Rerun the full unit suite before
  beginning that qualification.

## Remaining Manual Gates

- The no-login Google smoke passed only as sanitized Linux public-page evidence. It did
  not drive Electron's selected-text hotkey, OS clipboard, tray, cancellation, or
  quarantine workflow. Packet 06 retains Linux/Windows packaged copy-before-keyboard-
  clear ordering, identical-result, cancellation-reuse, serialization, tray-indicator,
  timeout, and suspend/resume confirmation.
- Linux and Windows packaged confirmation of Translation provider switching: inline
  checking, configuration/recording lock, typed retained-selection failure, and
  target-language-only lock behavior.
