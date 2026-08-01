# 18 Future Native Hardening And macOS Readiness

## Outcome

After the Windows/Linux critical path is qualified, the modular native code gains
bounded parser fuzzing, measured coverage and leak/performance regression gates,
and a compile-only macOS backend skeleton that always reports unavailable. The
work improves future maintainability without creating a macOS executable path or
changing any current platform/support claim.

## Prerequisites

- Tasks 06 and 17 are complete and committed through their packet boundaries.
- The Local Whisper specification remains approved with macOS M1+ classified
  Planned/unavailable and AMD classified according to the existing matrix.
- Task 18 has separate execution authorization.
- A new `/spec` revision is mandatory before any macOS runtime/model download,
  managed executable storage, Metal/CPU execution, Ready state, packaging,
  signing/notarization, or support-tier promotion is implemented.

## Owned Requirements

- Follow-up hardening portions of `SEC-007`, `RUN-004`, `AC-AUTO-032`,
  `AC-AUTO-040`, and `AC-AUTO-041`.
- Planned-only macOS portions of `MAC-001`–`MAC-003`, `NONGOAL-001`,
  `AC-AUTO-028`, and `AC-MAN-011`.
- This is a future, non-release-blocking packet; Task 17 remains the release-1
  qualification authority.

## In Scope

- Add compiler-native fuzz targets for untrusted native protocol/base64url/
  command-parser input using the Task 06 common layer.
- Establish an evidence-based native line/branch coverage baseline, then add a
  reviewed regression floor without inventing an arbitrary target beforehand.
- Add deterministic descriptor/handle leak and bounded performance regression
  tests for repeated temporary-root guard operations.
- Review and advance recorded Clang/CMake/MSVC/GoogleTest versions through
  pinned, reproducible changes and rerun all Task 06 gates.
- Add a compile-only `src/platform/macos/` backend skeleton behind an explicit
  test/build option. Every operation returns the canonical unavailable/
  unsupported result and no managed root is created.
- Add a future-facing README section/checklist and CI smoke coverage appropriate
  to these hardening targets.

## Out Of Scope

- A production macOS helper, `__APPLE__` production factory selection, model or
  runtime catalog entry, download, storage initialization, worker spawn, Metal,
  Core ML, CPU fallback, load, transcription, Ready state, installer, signing,
  notarization, release artifact, or support claim.
- AMD support-tier changes or AMD hardware qualification.
- Changing the filesystem guard protocol, command semantics, security boundary,
  or Task 06 module ownership to make fuzzing easier.
- Arbitrary coverage percentages, micro-optimizations without measurement,
  benchmark claims, or new third-party fuzz/benchmark frameworks without a
  separately recorded dependency decision.

## Task Contract

### Fuzzing

1. Use Clang/libFuzzer and sanitizer instrumentation already available in the
   native toolchain; add no third-party fuzz dependency by default.
2. Fuzz only pure/bounded common entry points: base64url decode, line parsing,
   typed command parsing/validation, and response serialization. Seed the corpus
   with Task 06 golden protocol vectors and malformed boundary cases.
3. Enforce the same 256 KiB line/input bound before allocation. Findings become
   deterministic GoogleTest regressions before a fix is considered complete.
4. CI runs a short deterministic smoke budget. Longer campaigns are scheduled or
   manually gated and publish only sanitized crash artifacts containing no real
   user paths/data.

### Coverage and regression evidence

1. Measure line and branch coverage for common modules and current-platform
   backends with `llvm-profdata`/`llvm-cov`. Exclude generated GoogleTest code,
   platform-unreachable sources, and defensive fatal paths only through explicit
   reviewed filters.
2. Record the first trustworthy baseline and uncovered security-relevant paths.
   Add focused tests before selecting a regression floor. The floor may preserve
   or improve the measured baseline; it must not be guessed or lowered silently.
3. Add repeated operation tests for lease acquire/release, staging/promotion,
   open/revalidate, quarantine/deletion, malformed protocol sessions, and clean
   application shutdown. Check descriptor/handle counts return to the documented
   baseline after a bounded settling interval.
4. Record wall-clock baselines only to detect material regressions in the native
   guard. Do not claim inference performance and do not fail CI on noisy values
   until stable runner evidence establishes a tolerance.

### macOS compile-only skeleton

1. Implement a narrow backend class conforming to the Task 06 interface under
   `src/platform/macos/`, compiled only by an explicit
   `LOCAL_WHISPER_ENABLE_MACOS_SKELETON_TESTS` option.
2. Every storage/process command fails closed with the existing canonical
   unavailable/`UNSUPPORTED` contract. Construction and calls must not create a
   Local Whisper root, change permissions, download data, spawn a process, or
   enumerate hardware.
3. The production target and package catalogs do not select or include this
   backend. A normal Windows/Linux build remains unchanged.
4. Add compile and unit fixtures proving type completeness and fail-closed
   behavior. On a future macOS arm64 fixture, `AC-MAN-011` may prove only
   Planned/unavailable behavior; it is explicitly not production evidence.
5. Document the `/spec` gate and future investigation areas—Apple Silicon
   hardware qualification, whisper.cpp Metal/Core ML choices, sandbox/paths,
   code signing/notarization, packaging, privacy, resource measurement—without
   choosing or promising them in this packet.

## Contracts And Boundaries

- Task 06 common interfaces and protocol golden tests remain authoritative.
- Task 17 release evidence cannot be retroactively changed by this future work;
  any release-impacting regression returns to the owning packet/plan.
- Fuzz, coverage, leak, and benchmark data use synthetic inputs and temporary
  roots only. No user storage, model, runtime, audio, transcript, prompt, or
  credential is collected.
- The macOS skeleton is a compile-time seam, not a support path.

## Expected Files Or Components

- `runtime/local-whisper/fs-guard/tests/fuzz/` targets and seed corpus.
- Coverage/leak/performance test additions under the Task 06 native test tree.
- CMake opt-in targets/presets for fuzzing, coverage, and macOS skeleton tests.
- `runtime/local-whisper/fs-guard/src/platform/macos/` unavailable backend
  skeleton and focused tests.
- Native README/toolchain notes and scoped CI additions; no installer/catalog
  production entries.

## Acceptance Criteria

- Bounded fuzz smoke passes under ASan/UBSan, and every discovered defect has a
  deterministic regression test.
- A reviewed line/branch baseline and non-arbitrary regression floor are checked
  in with exact tool versions and filters.
- Repeated native integration cycles show no growing owned descriptor/handle
  count and no material regression against an evidence-backed tolerance.
- Windows/Linux Task 06 format, tidy, warnings, sanitizer, native tests, and Node
  integration remain green after toolchain maintenance.
- The macOS skeleton compiles only when explicitly requested, fails every
  operation safely, creates no root, and is absent from production builds and
  catalogs.
- Documentation makes clear that macOS M1+ remains Planned/unavailable and that
  a new specification plus physical Apple Silicon qualification is required.

## Verification

Use checked-in Task 18 presets/commands, followed by the complete Task 06 native
quality set and Task 17 regression gate. At minimum record:

```text
rtk npm run fuzz:local-whisper:fs-guard -- --smoke
rtk npm run coverage:local-whisper:fs-guard
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:filesystem
rtk npm run format:check:local-whisper:fs-guard
rtk npm run lint:local-whisper:fs-guard
rtk git diff --check
```

If a macOS arm64 runner/host is unavailable, keep `AC-MAN-011` open and record
only cross-compilation/unit evidence; do not substitute Linux/Windows evidence.

## Failure And Rollback

- A sanitizer crash, parser timeout/unbounded allocation, coverage regression,
  handle leak, or Task 06 behavior change blocks completion.
- If stable CI timing cannot be established, keep performance evidence
  informational; do not add a flaky required threshold.
- If the macOS skeleton can create storage or reach an execution path, remove or
  disable it and leave the task incomplete. Do not relax the Planned boundary.
- Rollback removes only Task 18 fuzz/coverage/regression/skeleton/docs/CI
  additions. It must not delete user data, alter support tiers, or revert Task 06
  and Task 17 evidence.

## Manual Gates

- `MANUAL GATE — coverage floor`: review the measured baseline, exclusions, and
  chosen regression floor before making it required.
- `MANUAL GATE — long fuzz/soak`: extended campaigns must use synthetic data,
  bounded resources, and sanitized artifact handling.
- `MANUAL GATE — Apple Silicon unavailable fixture`: a physical future M1+ host
  may verify only compile/fail-closed/no-storage behavior under `AC-MAN-011`.
- `MANUAL GATE — executable macOS support`: stop and return to `/spec` before any
  production backend, runtime/model distribution, execution, Metal/Core ML,
  packaging, signing/notarization, or support claim.
- No commit, push, PR, release, publication, or hardware support change is
  authorized by Task 18 execution.

## References

- `../spec.md` Sections 6, 7.3, 11.6, 12.2, 18, 19.3, 20, and 21.
- `06_native_cpp_modularization.md` and
  `17_integration_and_qualification_gates.md`.
- Requirement anchors: `SEC-007`, `RUN-004`, `MAC-001`–`MAC-003`,
  `NONGOAL-001`, `AC-AUTO-028`, `AC-AUTO-032`, `AC-AUTO-040`–`AC-AUTO-041`,
  `AC-MAN-011`.

## Completion And Handoff

- Mark only Task 18 complete after the measured gates and all available
  fail-closed evidence pass; leave unavailable manual gates explicit.
- Update `handoff.md` with fuzz budgets/corpus, coverage baseline/floor,
  leak/performance evidence, exact toolchain versions, macOS skeleton build
  isolation, open `/spec` gate, changed files, and rollback state.
- Present Task 18 for review and stop. Do not commit, publish, or begin macOS
  executable support in the same invocation.
