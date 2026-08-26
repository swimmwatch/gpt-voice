# Local Whisper Native CI Review Comments to Address

Date: 2026-08-08  
Source review: [`2026-08-08-local-whisper-native-ci-security-checks.md`](2026-08-08-local-whisper-native-ci-security-checks.md)  
Assessment basis: current `feat/local-whisper-provider` source, native tests and build
wrappers, `.github/workflows/pr-checks.yml`, and the approved Local Whisper native
remediation specification and task packets.

This document selects the review comments that should be acted on. It corrects their
scope where the current implementation differs from the review. It is not an
implementation plan and does not replace the approved remediation artifacts.

## Address in the Merge/Remediation Gate

### 1. T1.1 — Enforce UBSan failure in every sanitized native suite

**Evidence:**

- All four native CMake quality functions enable `-fsanitize=address,undefined` but
  omit `-fno-sanitize-recover=undefined`.
- `scripts/local-whisper/native-worker-quality.mjs:133-134` and
  `scripts/local-whisper/whisper-cpp-build-core.mjs:480-481` already run their tests
  with `UBSAN_OPTIONS=halt_on_error=1`.
- The fs-guard and launcher drivers invoke `ctest` without sanitizer options, and the
  Linux native-quality job does not provide job-level `ASAN_OPTIONS` or
  `UBSAN_OPTIONS`. UBSan findings in those two suites can therefore leave `ctest`
  successful.

**Action:** make undefined-behavior findings non-recoverable in the shared native
quality policy and give every sanitizer test invocation one explicit, stable option
set. Extend the existing native sanitizer proof so loss of the halting behavior is a
failing regression. Do not add the review's optional pointer-pair instrumentation to
the first change; it is a separate compatibility/noise experiment.

### 2. T3.3 plus the platform-coverage finding — Add real Windows execution, MSVC analysis, and a dedicated ASan configuration

**Evidence:**

- The Windows job builds and runs fs-guard and launcher tests, but
  `.github/workflows/pr-checks.yml:185-188` performs only `--contract-only` checks for
  the Whisper.cpp worker.
- `runtime/local-whisper/*/CMakeLists.txt` applies `/W4 /WX /permissive- /EHsc` on
  MSVC, but no `/analyze` or `/fsanitize=address` configuration exists.
- Consequently, the review overstates present Windows coverage: project-owned
  Windows worker code is not executed by the PR job at all.

**Action:**

1. Run the common and project-owned Whisper.cpp core suites on a real Windows MSVC
   build, as already required by remediation packets 01 and 05.
2. Add MSVC code analysis for the fs-guard, launcher, common consumers, and
   project-owned worker sources, with a reviewed baseline rather than silently
   excluding Windows-only files.
3. Add a separate MSVC ASan preset/leg for those testable targets. Do not simply add
   `/fsanitize=address` to the existing Debug preset: MSVC ASan is incompatible with
   the `/RTC1` setting normally present in Debug builds and needs an intentional
   configuration. Use Windows-specific sanitizer options; LeakSanitizer is not
   available there.
4. Keep `/guard:cf` and the other emitted-binary protections in the production
   hardening policy described in item 5, rather than treating them as substitutes for
   static analysis or ASan.

This is more important than adding another Linux-only scanner because the current
Windows job leaves the project-owned worker implementation at source-contract
coverage only.

### 3. T1.2 — Enable the path-sensitive analyzer, then add bug-finding checks incrementally

**Evidence:** all four `.clang-tidy` files start with `-*` and omit
`clang-analyzer-*`. Targeted analyzer-only runs against the current Linux fs-guard
backend, launcher backend, and guard application completed without findings, so the
analyzer can be enabled for those surfaces without a known baseline.

The review's proposed blanket `bugprone-*`, `cert-*`, and `concurrency-*` rollout is
too broad for one warnings-as-errors change. Exploratory `bugprone-*` runs on the
same existing build databases immediately produced four diagnostics in
`linux_backend.cpp`, six in `linux_launcher.cpp`, and one in the guard application
translation unit, including low-value multiplication-width and
easily-swappable-parameter reports.

**Action:** enable `clang-analyzer-*` first under the existing errors policy. Add
individual `bugprone`, `cert`, and concurrency checks only after their current
findings are classified and burned down. Keep MSVC `/analyze` as the Windows
counterpart; the Linux clang-tidy run does not inspect Windows-only translation
units.

The review's examples are not themselves proof that each named check will find a
defect. In particular, `SpeechEngine::unload()` is declared `noexcept`, and the GPU
optional is populated by the non-CPU parse branch before the guarded dereference.

### 4. T2.1 — Add descriptor/handle balance and failure-injection tests

**Evidence:**

- The current real-backend integration suite covers happy paths and a small number of
  rejection paths, but it does not measure process descriptors/handles or inject
  failures after native resource acquisition.
- The Linux backend has confirmed exception-path descriptor leaks, and the approved
  remediation specification requires equivalent Linux and Windows ownership tests
  plus a 64-live-lease limit.

**Action:** implement the tests required by remediation packet 02. On Linux, use a
scoped `/proc/self/fd` baseline. On Windows, use a scoped process-handle baseline with
deterministic cleanup. Wrapper-instance counters may supplement those assertions but
must not replace OS-level accounting, because a raw descriptor or handle that never
enters a wrapper would otherwise remain invisible. Repeat every injected failure and
cover the 63/64/65/release boundary.

### 5. T2.4 — Add explicit production hardening and verify the emitted binaries

**Evidence:** the four native CMake projects currently define warnings and optional
sanitizers but no canonical exploit-mitigation policy. Existing pack audits inspect
dependency resolution and hostile working-directory behavior, not the complete ELF
or PE mitigation set.

**Action:** carry out remediation packet 07: one shared, configuration-aware CMake
policy and one exact-output verifier for every production fs-guard/model launcher,
launcher, and CPU worker executable on Linux and Windows. Verify the live optimized
ELF/PE outputs rather than inferring protections from flags. Preserve sanitizer and
deterministic-build configurations.

This review comment is already represented by specification requirement `BLD-001`
and acceptance criterion `AC-AUT-014`; it should remain in the merge gate.

### 6. T1.3 — Harden standard-library bounds checks in Linux test configurations

**Evidence:** sanitizer builds do not define `_GLIBCXX_ASSERTIONS`, while the native
code contains many `operator[]` accesses on arrays, spans, and vectors. ASan does not
guarantee detection when an invalid access remains inside allocated capacity, so the
standard-library checks provide distinct value.

**Action:** enable `_GLIBCXX_ASSERTIONS` consistently for project-owned Linux test
targets and their project-owned static libraries, then run the full sanitized native
suite. Do not copy the review's Windows macro example verbatim. The existing Windows
tests are Debug builds, where MSVC already defaults to `_ITERATOR_DEBUG_LEVEL=2`, and
changing `_ITERATOR_DEBUG_LEVEL` or `_CONTAINER_DEBUG_LEVEL` is ABI-sensitive across
GoogleTest and every linked translation unit. Add a Windows-specific STL-hardening
definition only after proving the supported MSVC 19.39 setting and applying it to the
complete test graph.

## Address as Follow-up CI Hardening

### 7. T2.2 — Add bounded fuzzing for shared untrusted parsers

The frame codec, bounded JSON, canonical WAV, authority record, launch request, guard
protocol, and device-identity parsers are good fuzz targets because they are shared
by Linux and Windows and accept attacker-influenced bytes. Add targets incrementally,
seed them from existing conformance fixtures, retain minimized regressions, and keep
per-PR time and memory budgets explicit.

Do this after the deterministic remediation tests are in place. A pure
`parse_request` fuzz target does **not** cover H3: that defect is the unbounded
`std::getline` acquisition that occurs before `parse_request`. The bounded-reader
tests in remediation packet 03 remain the required fix and regression coverage.

### 8. T2.3 — Add a Linux TSan leg after the worker concurrency redesign

The worker's cancellation, terminal arbitration, completion notification, and
inference thread are appropriate TSan scope once remediation packet 01 establishes
their final design. Add a separate Linux preset and exercise deterministic
cancel-first, transcript-first, malformed-control, EOF, and inference-failure paths.

TSan is defense in depth, not coverage for review finding C1. Destroying a joinable
`std::thread` during exception unwinding is a lifetime/termination defect, not a data
race, so only the explicit malformed-control and EOF regression tests prove that fix.

### 9. T1.6 — Add GCC coverage only where the second-compiler gap remains

The review's blanket statement that GCC is installed but unused is stale. Worker
common already runs GCC Release plus Clang ASan/UBSan profiles, and the Whisper.cpp
core verifier also runs both profiles. The remaining Linux second-compiler gap is the
fs-guard and launcher projects.

Add focused GCC build/test coverage for those two projects after the current
remediation settles. Do not duplicate the already dual-compiler common and worker
suites or matrix the entire native job unnecessarily.

### 10. T3.5 — Add scheduled advisory monitoring for locked upstream sources

The SHA-256 locks prove source identity, not vulnerability status. Add a scheduled,
advisory-only check for the exact Whisper.cpp, nlohmann-json, and GoogleTest revisions,
with a human-reviewable mapping from an advisory to the locked commit/version. Keep
this outside the PR gate so an unavailable or noisy advisory service cannot block an
otherwise reproducible native build.

## Review Comments Not Carried Forward as Independent Actions

- Do not add a blanket warning list or an arbitrary 16 KiB stack-frame ceiling in one
  step (T1.4/T1.5). Burn down selected diagnostics first and choose a stack policy
  only after the existing 64 KiB buffers are deliberately moved, bounded, or
  justified.
- Do not treat diff coverage as proof of the C1 behavior (T3.2). Line execution does
  not prove exception-safe thread ownership; the named regression tests do.
- Do not add single-platform CodeQL (T3.1) or PR-gating Valgrind (T3.4). Reconsider
  dual-platform CodeQL only after the direct Windows execution and analysis gaps
  above are closed.
- The path-separator defect in the fs-guard and launcher lint filters should be fixed
  if clang-tidy is deliberately enabled on Windows. The approved remediation keeps
  clang-tidy as a Linux gate and uses MSVC checks on Windows, so it is not a current
  blocker.

## Verification Gaps

This assessment used source, workflow, build-wrapper, test, and approved-remediation
inspection. Three analyzer-only clang-tidy probes passed, and three exploratory
`bugprone-*` probes demonstrated the expected baseline. No provider implementation or
CI configuration was changed, and no full native suite, Windows build, sanitizer run,
fuzzer, TSan job, or binary-hardening verifier was executed.

## Verdict

Items 1-6 should be retained in the merge/remediation gate. Items 7-10 are valuable
follow-up CI hardening after the known native defects and accepted cross-platform
remediation are complete.
