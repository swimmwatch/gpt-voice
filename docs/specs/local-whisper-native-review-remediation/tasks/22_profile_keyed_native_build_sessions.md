# 22 Profile-Keyed Native Build Sessions

## Outcome

One process-owned native build-session registry configures each exact project/profile graph once, builds the union of required targets once, and runs multiple labels or verifiers without deleting and recreating the same graph.

## Prerequisites

- Packet 21 is checked complete and its aggregate inventories and phase telemetry pass.
- The packet has separate execution authorization.

## Owned Requirements

- GAT-004, RUN-003, SEC-004, SEC-006, TST-003, TST-007, TST-010.
- AC-AUT-018 through AC-AUT-025 and AC-AUT-040 where they govern truthful native execution and non-duplication.

## In Scope

- A high-cohesion `NativeBuildSession` and process-owned registry constructed by the native CI composition root.
- Canonical session roots under the existing repository task cache.
- Configure-once, union-target build, multi-label CTest execution for filesystem guard, launcher, worker, Whisper.cpp, sanitizer, fuzzer, and TSan orchestration where profile identity is exact.
- Combining test and production targets only when every key field and CMake option is identical or one combined configuration can truthfully enable both target sets.
- Deterministic profile-key and stale-session rejection tests.

## Out Of Scope

- A universal CMake superbuild, cross-OS or cross-compiler binaries, cross-process persistence, GitHub cache use, artifact fan-out, C++ runtime changes, altered instrumentation, or reuse across CodeQL/non-CodeQL boundaries.

## Task Contract

1. Introduce a class-based build-session owner. The composition root constructs it and transfers lifecycle ownership; no module-level mutable registry or pass-through wrapper is allowed.
2. Key every session from canonical values: project ID; OS and x64 architecture; compiler and linker identities; toolchain/profile ID; exact native-source lock digests; project/source digest; CMake generator and cache; build type; complete compile/link flags; target backend; tests/engine/direct-engine options; sanitizer, TSan, fuzz, MSVC `/analyze`, and CodeQL tracing state.
3. Serialize the key canonically and hash it. Logs may emit only the project/profile IDs and bounded hash, never tool paths, source paths, environment values, or raw flags.
4. The session validates that its root is inside the task-owned cache before cleanup. It configures once, accumulates the union of requested targets, invokes one parallel build for that union, and permits multiple CTest labels only after successful build completion.
5. Duplicate target requests are idempotent; conflicting configuration requests fail before cleanup or compilation. A source, compiler, flag, cache, build-type, sanitizer, analyzer, or tracing mutation must create a different key.
6. Refactor the aggregate runners from Packet 21 to use the session owner directly. Do not add free functions that merely call through to a session instance.
7. A combined test/engine graph may replace separate Whisper.cpp test and production builds only when one CMake configuration enables the exact existing targets with the same optimization and hardening flags. If any flag or produced-binary contract differs, keep separate session keys.
8. CodeQL sessions are always distinct and compile under active CodeQL tracing. They cannot restore object files or consume binaries from an untraced session. MSVC `/analyze`, ASan/UBSan, TSan, fuzz, GCC, ordinary MSVC, and CUDA remain separately keyed.
9. Emit configure/build/test timings and target/test counts through Packet 21 telemetry so the removed duplicate work is measurable.

## Contracts And Boundaries

- `os.availableParallelism()` plus the existing free-memory limits remain the only default parallelism calculation.
- CTest label selection and every existing timeout, sanitizer environment, fuzzer budget, test fixture, and failure classification are unchanged.
- Build roots are ephemeral task-owned data and are never committed or uploaded by this packet.
- The session registry owns state and cleanup; stateless canonical serialization/digest helpers may remain pure functions.

## Expected Files Or Components

- New build-session owner and focused helpers under `scripts/local-whisper/native-build/`
- `scripts/local-whisper/whisper-cpp-build-core.mjs`
- `scripts/local-whisper/native-quality-tools.mjs`
- `scripts/local-whisper/native-worker-quality.mjs`
- `scripts/local-whisper/native-fs-guard-quality.mjs`
- `scripts/local-whisper/native-launcher-quality.mjs`
- Packet 21 fuzzer and TSan runners
- Focused build-session tests under `tests/runtime/localWhisper/nativeSources/`
- `package.json` and `.github/workflows/pr-checks.yml` only where orchestration entrypoints change

## Acceptance Criteria

- Same-key requests configure once and build each requested target once; repeated labels run without rebuilding.
- Every key mutation listed in the task contract prevents reuse.
- An attempted CodeQL/non-CodeQL, sanitizer/non-sanitizer, compiler, analyzer, or OS collision fails closed.
- All existing native inventories, hardening checks, source manifests, coverage claims, and platform applicability remain identical.
- No universal superbuild or process-global mutable container is introduced.

## Verification

- `npm run format:check`
- `npm run lint`
- `npm run test:types`
- `npm run test:local-whisper:native-sources`
- `npm run test:local-whisper:native-build-audits`
- `npm run test:local-whisper:native-ci-workflow`
- Focused key-canonicalization, mutation-invalidation, union-target, collision, cleanup-boundary, and CodeQL-isolation tests.
- Prepared Linux aggregate ordinary, sanitizer, fuzzer, and TSan runs; prepared Windows ordinary and ASan runs.

## Failure And Rollback

- Any uncertain identity or conflicting request is a hard failure, never a fallback reuse.
- Rollback returns aggregate runners to their Packet 21 configure/build ownership; no persistent cache migration is required.

## Manual Gates

- Real Windows MSVC `/analyze`, ASan, ordinary, and CodeQL execution requires an authorized Windows Server 2025 CI run.
- Commits, pushes, workflow dispatch, and external cache publication are not authorized by this packet alone.

## References

- `../spec.md` sections 10.12 and 12: RUN-003, TST-003, TST-007, TST-010, AC-AUT-018–AC-AUT-025, AC-AUT-040.
- `../decisions.yaml`: `planning.cpp-ci-contract-owner` and `planning.cpp-ci-optimization-objective` revision 1.

## Completion And Handoff

- Check Packet 22 in `todo.md`, update `handoff.md` with exact graph reductions and measurements, and set Packet 23 as next.
- Stop before Packet 23.
