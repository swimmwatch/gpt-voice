# Handoff: Translation Provider Reliability Remediation

## Status

Packet 01 is committed as `e1fe686`. Packet 02 is complete and remains uncommitted for
review. The plan remains approved; no later packet is authorized.

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

## Changed Files

- Packet 01 was committed with the workstream specification/plan, deterministic
  performance baseline test, and evidence.
- Added `src/main/translateProviders/translationOperationLifecycle.ts` and its focused
  deterministic test.
- Updated `BaseTranslateProvider` to re-export the canonical result budget; updated
  translation failure contracts, runtime mapping, selected-text timeout presentation,
  all checked-in locale catalogs, and focused runtime/selected-text tests.
- Updated `tasks/todo.md`, this handoff, and `decisions.yaml` with Packet 02 execution
  authorization and completion state.
- No dependency, IPC, renderer, provider-dispatch, workflow, generated artifact, or
  release file was changed.

## Checks

- Packet 01 recorded checks remain in commit `e1fe686`.
- Packet 02 focused suite — 89 passing across lifecycle, runtime, selected-text, i18n,
  audit mapping/privacy, and shared translation-provider tests.
- `npm run typecheck` — passed.
- `npm run test:types` — blocked by unrelated untracked
  `scripts/local-whisper/ci/RunnerPolicyVerifier.ts:68` type error; Packet 02 did not
  change that file.
- Packet-scoped ESLint and Prettier checks — passed.
- `git diff --check` — passed.

## Exact Next Packet

- [03 Integrate bounded operation and resource lifecycle](03_integrate_bounded_operation_and_resource_lifecycle.md)

## Blockers

- Packet 02 is intentionally uncommitted. A future implementation invocation must
  obtain separate commit authorization through Prompt MCP, verify this handoff, and
  commit only Packet 02 before it may open Packet 03.
- Packet 03 also requires its own separate execution authorization.
- `npm run test:types` remains blocked by the unrelated Local Whisper CI type error
  above until its owner resolves it.

## Remaining Manual Gates

- No browser, provider, credential, package, release, or external-system gate was
  crossed. Live provider inspection and canaries remain execution-time gates for later
  work; supported-platform qualification remains in Packet 06.
