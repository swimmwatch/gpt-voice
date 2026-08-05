# 01 Startup preparation foundation

## Outcome

Provide an injected, generation-aware main-process coordinator that can prepare the CloakBrowser runtime and expose a renderer-safe immutable startup snapshot. This packet establishes the shared contract and test seams without changing the visible application startup flow.

## Prerequisites

- Approved `first-launch-startup-readiness` specification.
- No prior packet is required.
- Preserve the existing uncommitted `ProgressSpinner` work; this packet must not edit it.

## Owned Requirements

- FLR-005, FLR-006, FLR-008 (preparation contract and retry mechanics)
- FLR-009, FLR-012, FLR-013, FLR-014 (snapshot, truthful progress, and generation ordering)
- FLR-017 (safe status/failure vocabulary)

## In Scope

- Define a shared startup contract, for example `src/shared/firstLaunchStartup.ts`, with:
  - fixed startup job identifiers, lifecycle values, and renderer-safe status codes;
  - a frozen snapshot with generation, terminal/retryable state, jobs, and an optional aggregate percentage;
  - strict runtime guards that reject unknown fields, raw messages, paths, URLs, and out-of-range values;
  - pure aggregate-progress and deterministic active-job summary helpers. Completed known work units are the only percentage source. A running unmeasurable job retains its unit until it completes.
- Add an injected `FirstLaunchStartupCoordinator` under `src/main/` that owns mutable attempt state. It must:
  - start once per generation, publish an immutable snapshot after every accepted transition, and make repeated completion idempotent;
  - expose `getSnapshot()`, `subscribe()`, `start()`, and `retry()` or equivalent narrow methods;
  - ignore completion, failure, cancellation, and subscription notifications from older generations;
  - retain successful jobs across Retry and rerun only failed or incomplete jobs;
  - return safe status codes only, never a caught error message.
- Extend `CloakBrowserRuntimeLoader` with an explicit injected preparation operation. It must prefer the configured packaged executable, then an existing verified vendor cache, then CloakBrowser's supported `ensureBinary()` installation path. It must retain `CLOAKBROWSER_AUTO_UPDATE=false` in packaged mode.
- Treat verification failure as a terminal retryable preparation failure. Never replace it with a custom URL, unverified executable, alternate binary, or raw error text.
- Add focused unit tests for the shared contract, coordinator ordering/retry rules, and runtime loader path selection. Tests use injected fakes only; they must not download a browser.

## Out Of Scope

- Creating the main window, registering IPC, publishing Electron events, or rendering the loader.
- Provider selection/configuration changes.
- Model, engine, runtime-backend, provider-session, or third-party application downloads.

## Task Contract

- A snapshot starts with every owned job pending and a generation that is monotonically increasing per attempt.
- A percentage is present only when all included work units have known finite completion semantics. It is based on completed units plus explicitly supplied byte totals; elapsed time and installer logs are forbidden inputs.
- A safe failure distinguishes verification failure from ordinary unavailable/installation failure without disclosing the underlying exception.
- Preparation uses the installed CloakBrowser module's supported installer so its signature/checksum verification remains authoritative. No dependency or package-target change is permitted.
- The coordinator is constructed in a composition root in a later packet; this packet exports no constructed singleton or module-owned mutable service.

## Contracts And Boundaries

- Shared contract: `src/shared/firstLaunchStartup.ts` is renderer-safe and must not import Electron, Node filesystem APIs, or main localization types.
- Main boundary: only `CloakBrowserRuntimeLoader` and the coordinator can reach the installer. The renderer receives safe snapshot data only.
- Dependency injection: use interfaces for preparation, subscription publication, and test clock/runner seams where required. Do not intercept global `console` or parse CloakBrowser's non-contractual log output.
- Packaging: preserve the build-time `prepare:cloakbrowser` behavior and normal bundled-resource path.

## Expected Files Or Components

- `src/shared/firstLaunchStartup.ts` (new)
- `src/main/firstLaunchStartupCoordinator.ts` (new)
- `src/main/cloakbrowser.ts`
- `tests/shared/firstLaunchStartup.test.ts` (new)
- `tests/main/firstLaunchStartupCoordinator.test.ts` (new)
- `tests/main/cloakBrowserRuntime.test.ts`

Adjust composition types only if needed to expose an injectable loader operation; defer app wiring to packet 03.

## Acceptance Criteria

- Bundled executable preparation does not call installation.
- Missing bundled executable invokes the supported installer exactly once per current generation and reports success only after it resolves.
- Verification failure never reports success or chooses another executable.
- In a concurrent test, duplicate and stale-generation terminal events leave the current snapshot unchanged; Retry retains completed work and invokes only incomplete/failed jobs.
- Aggregate percentages never advance during an unmeasurable running job and never use elapsed time or parsed log output.
- Contract decoders reject a raw error, extra properties, invalid lifecycle transition values, and invalid percentage.

## Verification

- `npm run typecheck`
- `node --import tsx --test tests/shared/firstLaunchStartup.test.ts tests/main/firstLaunchStartupCoordinator.test.ts tests/main/cloakBrowserRuntime.test.ts`
- `npm run lint -- --quiet src/shared/firstLaunchStartup.ts src/main/firstLaunchStartupCoordinator.ts src/main/cloakbrowser.ts tests/shared/firstLaunchStartup.test.ts tests/main/firstLaunchStartupCoordinator.test.ts tests/main/cloakBrowserRuntime.test.ts`

## Failure And Rollback

- If runtime preparation is unavailable, preserve the current packaged loader behavior and leave the coordinator unused; do not alter package resources or user cache paths.
- Revert only this packet's files if its contract causes test or integration failure. Do not remove `.cache/cloakbrowser`, user data, or any unrelated dirty worktree changes.

## Manual Gates

- No real CloakBrowser download is authorized in automated checks.
- A later package smoke test on each supported platform is required after packet 03; it is not part of this packet.
- No commit, push, release, or dependency update is authorized.

## References

- Specification: `spec.md` requirements FLR-005–FLR-006, FLR-008–FLR-009, FLR-012–FLR-014, FLR-017.
- Existing runtime loader: `src/main/cloakbrowser.ts`.
- Build-time package preparation: `scripts/prepare-cloakbrowser.mjs`.
- Dependency behavior: `node_modules/cloakbrowser/dist/download.d.ts`.

## Completion And Handoff

- Mark packet 01 complete in `todo.md` only after all scoped checks pass.
- Update `handoff.md` with changed files, command results, and packet 02 as the exact next task.
- Stop after reporting packet completion; do not begin packet 02 or commit without separate authorization.

