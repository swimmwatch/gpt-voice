# 21 Native CI Telemetry And Command Aggregation

## Outcome

The Linux and Windows native lanes report bounded configure/build/test timings and test counts, and the Linux core lane stops rebuilding the same Whisper.cpp, worker, fuzzer, and TSan graphs for adjacent suites.

## Prerequisites

- Packets 01–20 remain checked complete.
- The plan revision containing this packet is approved and this packet has separate execution authorization.
- Preserve the named `eb06376b51e05b75e79f6c48c3e3208663d58b8b` / run `32473799030` baseline and the three-run variability evidence in `plan.md`.

## Owned Requirements

- GAT-004, RUN-003, SEC-004, TST-004, TST-005, TST-010.
- AC-AUT-021, AC-AUT-022, AC-AUT-040.

## In Scope

- Privacy-safe timing and count telemetry for native configure, build, and CTest/fuzzer/proof phases.
- One Whisper.cpp aggregate invocation using the existing `--suite=all` behavior.
- One worker TypeScript test process plus one native `all` invocation per applicable profile.
- One fuzzer mode that configures/builds once and runs corpus regression, bounded mutation, and the deterministic failure proof.
- One TSan mode that configures/builds once and runs the synthetic race proof and complete worker suite.
- Workflow and policy tests proving the aggregate invocations replace, rather than supplement, the repeated commands.

## Out Of Scope

- Cross-process build reuse, persistent compiler caching, cross-job artifacts, new CMake targets, test removal, changed fuzz budgets, changed sanitizer behavior, CodeQL changes, package/release changes, or C++ product behavior.

## Task Contract

1. Add a small state-owning telemetry component for native command phases. It records only phase name, enumerated project/profile, elapsed milliseconds, CTest or target count when available, and exit status. It never emits commands, arguments, paths, environment values, source text, or process output.
2. Preserve `resolveNativeBuildJobs()` as the single dynamic build/test parallelism policy. Explicit existing overrides remain valid; no second CPU-count policy is introduced.
3. Add `test:local-whisper:whisper-cpp:all` and replace the four Linux core commands for `core`, `loader`, `device-proof`, and `cancellation` with that one aggregate command. The targeted commands remain available for local development.
4. Replace the three worker workflow invocations with one Node test process covering the same codec, device-proof, and model-authority TypeScript files, followed by one `native-worker-quality.mjs all` invocation. Targeted npm commands remain available and retain their behavior.
5. Add a combined fuzzer mode that configures each of the three fuzz projects once, builds the union of all seven fuzz targets plus the synthetic proof target once, then runs corpus regression, the existing 60-second mutation phase, and the deterministic failure proof. Existing `corpora`, `all`, and `proof` modes remain available.
6. Add a combined TSan mode that creates the TSan graph once, builds the union of proof and suite targets once, then requires the synthetic race to fail as expected and the complete worker concurrency suite to pass. Existing proof-only and suite-only modes remain available.
7. Fail immediately on an invalid mode, aggregate target omission, duplicate test label, test-count mismatch, phase failure, signal, or timeout. No retry may hide a flaky or genuine failure.
8. Compare aggregate and legacy inventories in deterministic tests. The aggregate inventory must equal the union of the prior invocations, with identical skips and no duplicate execution.

## Contracts And Boundaries

- Linux Clang ordinary, ASan/UBSan, TSan, and fuzz graphs remain distinct.
- Windows ordinary, MSVC `/analyze`, and MSVC ASan graphs remain distinct.
- Native stdout/stderr behavior of tested binaries is unchanged; telemetry belongs to the Node orchestration layer.
- All fuzz inputs and retained failure classifications remain synthetic and bounded.

## Expected Files Or Components

- `package.json`
- `.github/workflows/pr-checks.yml`
- `scripts/local-whisper/verify-whisper-cpp-core.mjs`
- `scripts/local-whisper/native-worker-quality.mjs`
- `scripts/local-whisper/native-build/native-fuzz-runner.mjs`
- `scripts/local-whisper/native-build/native-worker-tsan.mjs`
- A focused telemetry module under `scripts/local-whisper/native-build/`
- Focused runner tests under `tests/runtime/localWhisper/nativeSources/`
- `tests/runtime/localWhisper/nativeCiWorkflow.test.ts`

## Acceptance Criteria

- Each aggregate command configures/builds its owned graph once and reports every prior test/proof as executed exactly once.
- The four Whisper.cpp commands become one; three worker native invocations become one; fuzzer `all` plus `proof` become one; TSan `proof` plus `suite` become one.
- Every targeted local command still works and no required test, analyzer, sanitizer, fuzzer, proof, count, skip, or failure propagation changes.
- Telemetry contains no absolute path, environment value, source content, model data, user data, credential, audio, or transcript.

## Verification

- `npm run format:check`
- `npm run lint`
- `npm run test:types`
- `npm run test:local-whisper:native-ci-workflow`
- Focused telemetry, worker-runner, fuzzer-runner, TSan-runner, and Whisper.cpp runner tests.
- On prepared Linux: legacy inventory comparison, aggregate Whisper.cpp, worker, fuzzer, and TSan commands.
- On prepared Windows: worker and Whisper.cpp aggregate commands in ordinary and applicable ASan modes.

## Failure And Rollback

- If any inventory differs, retain the legacy command allocation and fix the aggregate runner before proceeding.
- Rollback removes the aggregate workflow calls and telemetry component; targeted commands remain the known-safe path.

## Manual Gates

- Real Ubuntu 24.04 and Windows Server 2025 CI execution, commits, pushes, and workflow dispatch require separate authorization.
- Platform commands unavailable on the current host remain explicit blockers; Linux evidence cannot substitute for Windows.

## References

- `../spec.md` sections 10.12 and 12, especially RUN-003, TST-004, TST-005, TST-010, AC-AUT-021, AC-AUT-022, and AC-AUT-040.
- `../decisions.yaml`: `planning.cpp-ci-optimization-objective` revision 1.

## Completion And Handoff

- Check Packet 21 in `todo.md`, update `handoff.md` with changed files, checks, measured phase deltas, and set Packet 22 as the exact next packet.
- Stop before Packet 22.
