# 05 Close Automated Acceptance And Privacy Gates

## Outcome

The completed reliability and performance behavior passes one exhaustive,
deterministic automated feature gate covering deadlines, races, resource ownership,
provider quality, selected-text effects, audit/privacy, localization, versioning,
composition, baseline-versus-candidate performance, and the full repository quality
set without live network access.

## Prerequisites

- Tasks 01–04 are complete and approved.
- Task 05 has separate execution authorization.
- Baseline and candidate evidence exists for all six provider/path cells.
- Any Task 04 completion-signal verification gap is recorded and uses the approved
  fallback rather than an invented fast path.

## Owned Requirements

- `OUT-001`–`OUT-004`
- `SCOPE-001`–`SCOPE-003`
- Integration coverage for `TIME-001`–`TIME-009`
- Integration coverage for `PERF-001`–`PERF-007`, `QUAL-001`–`QUAL-002`
- Integration coverage for `ARCH-001`–`ARCH-009`
- Integration coverage for `CONC-001`–`CONC-007`
- Integration coverage for `LIFE-001`–`LIFE-008`
- Integration coverage for `FAIL-001`–`FAIL-008`
- Integration coverage for `SEC-001`–`SEC-009`
- Integration coverage for `OBS-001`–`OBS-007`
- Integration coverage for `COMP-001`–`COMP-006`, `CONF-001`–`CONF-003`
- `ACC-001`–`ACC-012`, `ACC-017`–`ACC-020`

## In Scope

- Cross-cutting deterministic acceptance tests and missing failure-injection cases.
- Strict controlled performance comparison against Task 01 baseline.
- Audit, diagnostics, localization, connection, composition, and privacy matrices.
- Full repository format, lint, type, unit, and production-build verification.
- Corrective implementation changes only when needed to satisfy the approved
  contract without changing behavior or scope.

## Out Of Scope

- Live providers, credentials, packaged-platform interaction, real suspend/resume,
  new requirements, selector/origin changes not approved in Task 04, UI/IPC/settings,
  dependencies, workflows, release artifacts, publication, or lowering checks.

## Task Contract

1. Audit every active requirement against production code and focused tests. Add
   only missing deterministic coverage or in-scope corrective code; do not create a
   parallel lifecycle, provider abstraction, or benchmark path.
2. Complete an operation-phase matrix that expires before registry lookup, while
   queued, during context creation, navigation, readiness, source detection, target
   selection, stale clearing, submission completion, result observation, fallback
   delay, target verification, and visible cleanup. At exact deadline equality,
   timeout must win.
3. Complete a cleanup matrix for success, ordinary failure, result timeout, overall
   timeout, cancellation, supersession, reset, shutdown, clear failure, page close,
   context close, 4,999/5,000 ms, late close, quarantine block/release, and repeated
   close calls.
4. Permute simultaneous provider completion, operation/result timeout, caller abort,
   reset, shutdown, supersession, and cleanup callbacks. Assert one returned outcome,
   one audit terminal, no post-terminal event, no double close, no dangling listener
   or timer, and no mutation of newer ownership.
5. Complete provider quality fixtures for every `ACC-017` case and prove coherent
   snapshot invalidation plus non-overlapping result/clear reads for `ACC-020`.
   Unsupported public completion evidence must take the full 500 ms fallback.
6. Make the controlled benchmark a hard gate: immutable baseline versus candidate,
   Google/Bing/Yandex cold and warm, identical virtual provider timeline, all totals
   strictly lower, every named application-controlled phase non-regressing, browser
   evaluations/timers non-increasing, and no weaker result evidence.
7. Prove selected-text timeout behavior end to end: previous clipboard restored,
   result never copied, no cache write, no success notification, no success
   diagnostic capture, one localized error notification, and later manual action
   recovery after cleanup/quarantine permits it. Preserve silent stale cancellation
   and the single-flight gate.
8. Prove audit normalization and privacy for `timed-out`, result timeout,
   `cleanupFailure`, cancellation, and late success. Outcome/log/audit/diagnostic/
   benchmark serialization must exclude source, result, URL, provider raw message,
   stack, DOM, cookies, session, screenshot, and account canaries.
9. Prove all eleven locale catalogs contain `error.translationTimedOut` with key and
   placeholder parity, audit schema remains version 1, provider versions remain
   `2026-08-09`, cache identity changes with version, and every closed switch/test
   double is exhaustive.
10. Prove production composition owns complete lifecycle dependencies and resources,
    creates no mutable module singleton or pass-through wrapper, and keeps
    renderer/preload/IPC/settings/database/dependency/package shapes unchanged.
11. Prove startup and selection behavior remains selected-provider-only and on
    demand. No test may silently prewarm all providers to make performance pass.
12. Append a concise safe automated-acceptance summary to
    `tasks/evidence/performance-baseline.md`: candidate controlled cells, relevant
    test counts, platform used for deterministic checks, and pass/fail only. Do not
    paste logs or sensitive fixture content.
13. Run the full quality set exactly as configured. Do not skip, weaken, quarantine,
    or make a check platform-conditional to obtain a pass. Existing unrelated
    failures must be reported with evidence and left outside this packet unless they
    prevent authoritative verification.

## Contracts And Boundaries

- Automated tests use `node:test`, injected clocks, fake browser resources, and
  synthetic content only; they never contact a provider.
- Performance evidence is test/manual evidence, not production analytics.
- Corrective code remains inside the files and contracts already authorized by
  Tasks 02–04. Any new behavior, public contract, security posture, or supported
  platform choice returns to specification work.
- No dependency, package metadata, installer, workflow, permission, generated
  artifact, or release policy changes.

## Expected Files Or Components

- Extend focused tests under:
  - `tests/main/translateProviders/`;
  - `tests/main/translationRuntime.test.ts`;
  - `tests/main/selectedTextTranslation.test.ts`;
  - `tests/main/providerAudit/` and `tests/main/providerAuditPrivacy.test.ts`;
  - `tests/main/i18n.test.ts`;
  - `tests/main/mainProcessCompositionRoot.test.ts`;
  - `tests/main/translationRuntimeLifecycle.test.ts`;
  - `tests/shared/translationProvider.test.ts`.
- Add `tests/main/translateProviders/translationProviderReliabilityAcceptance.test.ts`
  only if cross-file race matrices do not have a clear existing owner.
- Update production files from Tasks 02–04 only for defects exposed by these gates.
- Append sanitized candidate evidence to
  `tasks/evidence/performance-baseline.md`.

## Acceptance Criteria

- Every deterministic criterion `ACC-001`–`ACC-012` and `ACC-017`–`ACC-020`
  has a passing named assertion and no live network dependency.
- All six controlled performance cells are strictly faster and quality-equivalent.
- Exact-boundary, suspend-clock, late-promise, cleanup, and stale-resource matrices
  produce one deterministic terminal winner.
- Privacy canaries are absent from every serialized output and safe log capture.
- Format, lint, strict typecheck, type tests, full unit suite, and production build
  pass without weakened configuration.

## Verification

Run focused checks first:

```text
node --import tsx --test "tests/main/translateProviders/*.test.ts" tests/main/translationRuntime.test.ts tests/main/translationRuntimeLifecycle.test.ts tests/main/selectedTextTranslation.test.ts tests/main/providerAudit/providerAuditClasses.test.ts tests/main/providerAudit/providerAuditMappings.test.ts tests/main/providerAuditPrivacy.test.ts tests/main/i18n.test.ts tests/main/mainProcessCompositionRoot.test.ts tests/shared/translationProvider.test.ts
```

Then run the full gate:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run build:prod
git diff --check
```

## Failure And Rollback

- Any missing requirement owner, nondeterministic test, live-network assertion,
  weaker quality check, sensitive output, unbounded wait, or failed quality command
  blocks the packet.
- Do not “fix” a failure by extending timeouts, accepting first non-empty text,
  disabling a locale/privacy assertion, skipping a platform model, or adding
  prewarming.
- Rollback removes Task 05-only tests/evidence and reverts only corrective changes
  made in this packet. Tasks 01–04 remain intact. Settings and stored data require no
  repair.

## Manual Gates

- None. This packet is deliberately network-free and package-free.
- No commit, push, pull request, provider visit, publication, or Task 06 execution is
  authorized.

## References

- Mandatory:
  - `tasks/evidence/performance-baseline.md`;
  - all production and focused test files changed by Tasks 02–04;
  - `tests/main/providerAuditPrivacy.test.ts`;
  - `tests/main/mainProcessCompositionRoot.test.ts`;
  - `docs/agent-guides/project-conventions.md`, project commands, logging/privacy,
    DI, provider, and test sections.
- Traceability:
  - approved specification “Acceptance Criteria,” “Rejection Criteria,” and every
    normative section referenced in Owned Requirements.

## Completion And Handoff

- Mark Task 05 complete only after the focused and full gates pass.
- Update `handoff.md` with safe candidate metrics, changed files, exact commands and
  results, exact next packet 06, and all remaining platform/provider blockers.
- Present automated feature-gate evidence and stop. Do not commit, package, or begin
  Task 06.
