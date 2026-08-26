# 01 Optimize Node.js And TypeScript CI Tests

## Outcome

The Node.js and TypeScript quality surface runs less redundant work, exposes bounded concurrency telemetry, and retains only optimizations that satisfy the approved evidence gates.

## Prerequisites

- The worktree was clean at revision `eb06376` before this packet began.
- The user approved the contract, plan, and Packet 01 execution on 2026-08-21.
- Baseline: 2,472 tests; 87-second CI Node test phase; 8-second source-only typecheck; 14-second comprehensive typecheck; 44-second production build.

## Owned Requirements

- OUT-001
- CI-001, CI-002, CI-003
- PERF-001, PERF-002
- COMP-001, COMP-002, COMP-003
- QUAL-001, QUAL-002, QUAL-003, QUAL-004

## In Scope

- Add an explicit Node CI test runner with concurrency and shard argument validation and bounded telemetry.
- Route the quality test job through the runner and remove its duplicate webpack compilation from the unit phase.
- Keep one comprehensive TypeScript CI invocation.
- Verify the existing production build output after it completes.
- Benchmark concurrency two versus four and `NODE_COMPILE_CACHE` according to the approved criteria.
- Retain four-way CI sharding only if qualifying repeated CI measurements exist.
- Strengthen focused runner, verifier, and workflow-policy tests.

## Out Of Scope

- C++, native workflow jobs, native tests, dependencies, packaging, installers, releases, security policy, application runtime behavior, and unrelated CI lanes.
- Commits, pushes, pull requests, workflow dispatch, or publication.
- Reducing archive limits, qualification attempts, test assertions, or required check coverage.

## Task Contract

- Add `test:unit:ci` with validated `--concurrency=N` and `--shard=N/M` options. An explicit concurrency is authoritative; when omitted, the runner uses the full value reported by `os.availableParallelism()`.
- The runner invokes Node directly without a shell, preserves the complete test glob, emits only approved telemetry fields, never retries, and propagates failures and terminating signals.
- Compare concurrency two and four in three paired runs, then verify the automatic maximum on the current host. Preserve the explicit override for constrained or diagnostic runs.
- Remove only the redundant source-only CI typecheck; retain both npm typecheck commands.
- Refactor the renderer production-output assertions into a reusable verifier that reads `dist` after `build:prod`; retain fast configuration assertions in the unit suite.
- Benchmark compile caching in three alternating pairs after a warm-up. Retain it only with two pair wins, a lower median, and changed-source invalidation proof.
- Do not change workflow topology for sharding unless repeated candidate CI measurements satisfy both the 10% critical-path and 50% runner-minute gates. Runner support for future native sharding remains required.

## Contracts And Boundaries

- The stable `Quality / Tests and Production Build` and `Quality Gates` check names remain unchanged.
- The comprehensive typecheck remains fail-closed and covers `src`, `tests`, and TypeScript scripts through `tsconfig.test.json`.
- Renderer verification reads only caller-selected build output and reports no source, environment, or user paths.
- No test failure may be converted into a success by fallback, retry, or aggregate behavior.

## Expected Files Or Components

- `package.json` and a focused Node runner under `scripts/`.
- Renderer bundle verifier and `tests/scripts/rendererBundle.test.ts`.
- `.github/workflows/pr-checks.yml` and its existing workflow-policy test.
- Focused runner tests plus this specification task bundle.

## Acceptance Criteria

- Invalid runner arguments are rejected before a child starts; valid concurrency and shard options produce the exact Node flags.
- Telemetry reports only the approved bounded fields, and child failures/signals remain failures.
- All baseline tests are retained and any new tests raise the expected inventory.
- CI performs one comprehensive TypeScript typecheck and no redundant source-only typecheck.
- The unit suite no longer invokes webpack compilation; the post-build verifier proves all existing renderer-output invariants against the real production output.
- Compile caching and workflow sharding are retained or rejected exactly according to their evidence gates.
- Required quality aggregates remain fail-closed with stable names.

## Verification

- Focused runner, renderer verifier, and workflow-policy tests.
- Three paired complete Node suite runs at concurrency two and four.
- Three alternating uncached/warm-cache pairs plus changed-source invalidation proof.
- `npm run format:check`
- `npm run lint`
- `npm run test:types`
- `npm run test:unit:ci -- --concurrency=2`
- `npm run test:unit:ci -- --concurrency=4`
- `npm run build:prod`
- `npm run verify:renderer-bundle`
- If sharding is retained, all four shards and an unsharded count comparison.
- `git diff --check`

## Failure And Rollback

- Use an explicit lower concurrency if the automatic host maximum is reproducibly unstable or slower on that runner; never retry or silently fall back inside one CI run.
- Do not retain compile caching when its paired benchmark or invalidation proof fails.
- Do not retain sharding without both repeated CI thresholds; keep the single required quality job and runner shard interface.
- Revert the renderer refactor if any previous production-output assertion cannot be represented against the real build output.

## Manual Gates

- Commit, push, pull request, and workflow dispatch are not authorized.
- Candidate CI measurement requires separately authorized source transport and execution; local timing is not a substitute.

## References

- Required: `.agents/references/task-packets.md` for packet completion and handoff structure.
- Required: `docs/agent-guides/project-conventions.md` sections “Project And Commands”, “Tests And Documentation”, and “Git And Releases”.
- Source contract: specification requirements OUT-001 through QUAL-004.

## Completion And Handoff

- Check Packet 01 only after retained changes pass verification.
- Update `handoff.md` with changed files, measured results, retained/rejected conditional optimizations, remaining uncertainty, and no next packet.
- Leave the completed packet uncommitted and stop for user review.
