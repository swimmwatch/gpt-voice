# Handoff: Translation Provider Reliability Remediation

## Status

Packets 01–03 are committed as `e1fe686`, `de5ec2e`, and `02fbd227`. Packet 04 is
complete and remains uncommitted for review. The plan remains approved; no later packet
is authorized.

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
- No dependency, IPC, renderer, settings, database, workflow, generated artifact, or release file changed.

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

## Exact Next Packet

- [05 Close automated acceptance and privacy gates](05_close_automated_acceptance_and_privacy_gates.md)

## Blockers

- Packet 04 is intentionally uncommitted. A future implementation invocation must obtain
  separate commit authorization through Prompt MCP, verify this handoff, and commit only
  Packet 04 before it may open Packet 05.
- Packet 05 requires separate execution authorization.

## Remaining Manual Gates

- No browser, provider, credential, package, release, or external-system gate was
  crossed. Packet 04 deliberately leaves Google, Bing, and Yandex completion evidence as
  `unavailable`; a separately authorized non-sensitive live public-page inspection is
  required before enabling any fast-completion signal. Live canaries remain later-work
  gates; supported-platform qualification remains in Packet 06.
