# 24 Conditional Native Cache And CI Fan-Out

## Outcome

The authorized pinned compiler-cache experiment and any exact-profile CI fan-out are either retained with proved invalidation and measured benefit or completely removed, and the final native CI series meets the approved 15% critical-path / 25% runner-cost contract without losing coverage.

## Prerequisites

- Packets 21–23 are checked complete with phase telemetry and controlled measurements.
- The packet has separate execution authorization, including authority to add one pinned CI-only compiler-cache tool.
- No other packet is in progress.

## Owned Requirements

- GAT-004, RUN-002 through RUN-005, SEC-004, SEC-006, TST-003, TST-007 through TST-010.
- AC-AUT-018 through AC-AUT-025, AC-AUT-027, AC-AUT-039, AC-AUT-040.

## In Scope

- Evaluation of one exact pinned `sccache` toolchain with repository-owned version, source/provenance, license, SHA-256, supported-host, and invocation policy.
- Exact-key object-cache experiments for eligible non-CodeQL native profiles.
- Conditional same-profile producer/consumer fan-out or CodeQL separation only when measurement and runner-cost gates pass.
- Final workflow-policy, failure-propagation, coverage, cache-invalidation, and three-sample performance verification.

## Out Of Scope

- More than one compiler-cache tool, remote third-party cache service, mutable downloads, untrusted forks writing shared caches, caching final binaries or CodeQL databases, cache use during CodeQL extraction, package/release changes, test sharding that removes platform coverage, or profile-crossing reuse.

## Task Contract

1. Select one exact `sccache` version and acquisition mechanism. Record its immutable source/provenance, license, version, SHA-256, and supported Linux/Windows identity in repository-owned policy. Verify all fields before execution. If no candidate satisfies the supply-chain contract, record the experiment as not retained and continue without compiler caching.
2. The cache key must include OS, x64 architecture, compiler executable identity and version, linker identity, project/source digest, native-source lock digests, generator, complete CMake cache and compile/link flags, build type, profile ID, sanitizer/fuzz/TSan/analyzer state, and cache schema. Do not use partial restore keys.
3. Never enable the compiler cache for CodeQL-traced builds or MSVC `/analyze`. Pilot ordinary, GCC, or sanitizer profiles one at a time; a profile is eligible only when cold and warm executions preserve identical tests, instrumentation, hardening, manifests, and failure behavior.
4. Add deterministic invalidation fixtures proving a source edit, header edit, compiler identity change, flag change, build-type change, CMake cache change, and sanitizer/profile change cannot return stale output. A changed source fixture must alter executable behavior so a stale hit is observable.
5. Caches may contain only compiler-cache entries and bounded metadata. They must not contain final executables, CodeQL databases, source archives, logs with commands/paths, environment dumps, models, user data, credentials, audio, or transcripts. Pull requests from untrusted contexts cannot save to a shared trusted cache.
6. For each eligible profile, run at least three alternating cold/warm pairs. Retain the cache only when warm execution wins at least two pairs, has a lower median compile phase, causes no critical-path or runner-minute regression, and passes every correctness/invalidation proof.
7. Inventory the workflow after Packets 21–23 for exact same-profile producer/consumer pairs. A producer may fan out only to consumers with byte-identical session keys. Artifacts require canonical manifests and consumer-side digest verification. If no exact pair exists, do not add fan-out.
8. A trial that splits CodeQL from a core test job must keep CodeQL's own real traced compile and all source coverage. Retain it only when the final median six-job native critical path improves by at least 15%, total native runner-minutes including producers, consumers, and CodeQL increase by no more than 25%, and all aggregate gates remain fail-closed.
9. Use at least three controlled successful before and after samples on the same workflow inputs. Report per-job medians, variability, critical path, total native runner-minutes, configure/build/test times, test/proof counts, cache hit/miss totals, and retained/rejected experiments. Do not compare one unusually fast run with one slow run.
10. Preserve the aggregate check names `Local Whisper Native Quality (Linux)` and `Local Whisper Native Quality (Windows)`. They must depend on every required producer, profile lane, analyzer, sanitizer, CodeQL job, and consumer and fail on failure, cancellation, skip, or missing result.

## Contracts And Boundaries

- Exact-profile reuse is mandatory; a miss is safe and an ambiguous hit fails.
- CodeQL, compiler, sanitizer, analyzer, TSan, fuzz, GCC, ordinary, and CUDA evidence remain truthfully distinct.
- Build/test parallelism continues to default to the existing CPU-and-memory calculation; this packet does not oversubscribe CMake or CTest independently.
- The approved performance gate is at least 15% lower median native critical path with no more than 25% additional native runner-minutes.

## Expected Files Or Components

- `.github/workflows/pr-checks.yml`
- Repository-owned compiler-cache policy/materializer under `scripts/local-whisper/native-build/` and/or `.github/actions/`
- `scripts/local-whisper/ci/runner-policy.json` only if job allocation changes
- Packet 21 telemetry and Packet 22 build-session integration points
- `tests/runtime/localWhisper/nativeCiWorkflow.test.ts`
- `tests/runtime/localWhisper/nativeSources/` cache-policy, invalidation, CodeQL-isolation, privacy, and build-audit tests
- `tests/scripts/localWhisper/ci/` workflow and aggregate-gate policy tests

## Acceptance Criteria

- Every retained cache profile passes three cold/warm pairs, all invalidation fixtures, all instrumentation and hardening checks, and privacy inspection.
- CodeQL performs a real uncached traced compile and retains the same source manifest and query result gate.
- Any retained fan-out uses an identical session key, verified artifact manifest, and fail-closed dependency; otherwise the experiment is absent from the final workflow.
- The median six-job native critical path improves by at least 15% and total native runner-minutes increase by no more than 25% across three controlled CI samples.
- Native test/proof counts, skips, source manifests, coverage classifications, required job names, and failure propagation match the pre-optimization contract.

## Verification

- `npm run format:check`
- `npm run lint`
- `npm run test:types`
- `npm run test:local-whisper:native-sources`
- `npm run test:local-whisper:native-build-audits`
- `npm run test:local-whisper:native-ci-workflow`
- `npm run test:security:workflow-policy`
- `npm run test:local-whisper:runner-policy`
- Focused cache key, source/header/compiler/flag/profile invalidation, untrusted-write, privacy, CodeQL-isolation, artifact-identity, aggregate-failure, and coverage-count tests.
- All retained Linux and Windows native lanes, analyzers, sanitizers, fuzzers, TSan, CodeQL, hardening, source verification, and aggregate jobs.

## Failure And Rollback

- Remove any experiment that misses its correctness, privacy, supply-chain, critical-path, runner-cost, or repeatability gate; do not weaken the threshold.
- Rollback disables and removes compiler-cache/fan-out integration while retaining Packets 21–23 improvements that independently passed their gates.
- Cache deletion is optional cleanup, not required for correctness because cache keys are immutable and consumers fail closed.

## Manual Gates

- Selecting and adding the exact pinned external compiler-cache binary/action requires review under the already answered CI-only tooling authorization.
- Commits, pushes, cache publication, workflow dispatch/rerun, and the three controlled Ubuntu 24.04/Windows Server 2025 samples require separate authorization.
- No release, package publication, qualification, required-check mutation, or force-push is authorized.

## References

- `../spec.md`: RUN-002–RUN-005, SEC-004, SEC-006, TST-003, TST-007–TST-010, AC-AUT-018–AC-AUT-025, AC-AUT-027, AC-AUT-039–AC-AUT-040.
- `../decisions.yaml`: `planning.cpp-ci-optimization-objective` and `planning.cpp-compiler-cache-policy` revision 1.

## Completion And Handoff

- Check Packet 24 in `todo.md` only after the final controlled measurements and all correctness gates pass.
- Update `handoff.md` with retained and rejected experiments, exact before/after medians, runner-minute delta, coverage evidence, changed files, and blockers; then stop.
