# Local Whisper Native (C++) CI Security Check Recommendations

Date: 2026-08-08
Branch: `feat/local-whisper-provider`
Companion to: [`2026-08-08-local-whisper-native-review.md`](2026-08-08-local-whisper-native-review.md)
Scope: pull-request-level CI checks for `runtime/local-whisper/**` C++ — vulnerabilities,
memory and descriptor leaks, undefined behaviour, concurrency defects

Every recommendation below is tied to a specific finding in the companion review. Three claims
were verified locally before writing; the evidence is included, including one case where
verification **changed** the recommendation.

## 1. Existing C++ CI Inventory

### `native-quality-linux` — `.github/workflows/pr-checks.yml:24-136`

Runner `ubuntu-24.04`, `CXX: clang++-18`, gcc-13 and clang-18 both installed.

| Check | Coverage | Driver |
| --- | --- | --- |
| `clang-format --dry-run --Werror` | fs-guard, launcher, worker-common, amd-packs (`.cpp` + `.hpp`) | `native-*-quality.mjs format` |
| `clang-tidy -p <build>` | implementation `.cpp` only, **9 checks** | `native-*-quality.mjs lint` |
| `-Wall -Wextra -Wpedantic -Werror` | all four CMake projects | `local_whisper_apply_quality` |
| ASan + UBSan | `linux-test` preset (`Debug`, `*_ENABLE_SANITIZERS=ON`) then `ctest` unit + integration | CMake presets |
| Upstream source integrity | SHA-256 locks: nlohmann-json 3.12.0, googletest 52eb810, whisper.cpp f049fff | `verify:local-whisper:native-source` |
| Cross-language conformance | worker codec / device proof / model authority vectors against TS and Python references | `native-worker-quality.mjs` |
| Loader limit table | `whisper-cpp-loader-limits-v1` | `verify:local-whisper:loader-limits` |
| Pack build, verify, audit | `linux-x64-cpu-baseline-v1` | `build/verify/audit:local-whisper:whisper-cpp-cpu` |

### `native-quality-windows` — `.github/workflows/pr-checks.yml:138-197`

Runner `windows-latest`, MSVC `/W4 /WX /permissive- /EHsc`.

- `ctest` unit + integration for fs-guard and launcher
- Source contract verification (CPU, CUDA, model authority) in `--contract-only` mode
- **No clang-tidy** — the driver refuses explicitly
  (`scripts/local-whisper/native-fs-guard-quality.mjs:93-95`: "clang-tidy is enforced by the
  Linux native-quality job")
- **No sanitizers** — the `windows-test` preset sets no sanitizer cache variable

### Assessment

The source-integrity locking and the cross-language conformance vectors are unusually strong
and should be preserved as-is. The gaps are in **analysis depth**, not in build discipline.

### 1.1 Platform coverage of the current C++ CI

macOS is out of scope for native code — the managed filesystem is unimplemented there
(`MacOSManagedFilesystemAdapter` rejects every operation with `UNSUPPORTED`) and no native
targets are built. Everything below concerns Linux and Windows.

**2,856 lines of Windows-only native code** live under `*/platform/windows/**`
(`windows_backend.cpp` 1167, `windows_launcher.cpp` 656,
`windows_model_launch_application.cpp` 505, plus the Windows worker protocol, device authority,
model authority, and `unique_handle.hpp`). Today that code has:

| Check | Linux code | Windows-only code |
| --- | --- | --- |
| Compiler warnings as errors | yes (`-Werror`) | yes (`/WX`) |
| `clang-format` | yes | yes (all `.cpp`/`.hpp`, both platforms' files) |
| `clang-tidy` | yes | **no** — driver refuses on non-Linux |
| AddressSanitizer | yes | **no** |
| UndefinedBehaviorSanitizer | yes, but non-enforcing (2.1) | **no**, and MSVC has no UBSan at all |
| Unit + integration tests | yes | yes |

So the largest single file in the tree (`windows_backend.cpp`) has compiler warnings and tests,
and nothing else. Any recommendation below that is Linux-only leaves that gap open, which is why
section 6 gives an explicit per-platform applicability matrix.

**A latent portability defect in the quality drivers.**
`scripts/local-whisper/native-fs-guard-quality.mjs:72-75` and
`native-launcher-quality.mjs:74-77` exclude the other platform's sources with:

```js
const excludedPlatform = process.platform === 'win32' ? 'linux' : 'windows';
(path) => path.endsWith('.cpp') && !path.includes(`/platform/${excludedPlatform}/`),
```

The paths come from `node:path` `resolve()`, which produces **backslashes** on Windows, so
`/platform/linux/` can never match there. The filter silently degrades to "exclude nothing" on
Windows. It is inert today because `nativeImplementationFiles` is only used by the `lint` action,
which refuses to run off Linux — but any move of `clang-tidy` to Windows (T3.3) trips over it
immediately. Use `sep`-aware matching or compare path segments.

## 2. Verified Findings About the Current Setup

### 2.1 UBSan reports but does not fail CI

Compiled with the repository's exact sanitizer flags:

```
$ g++ -fsanitize=address,undefined -fno-omit-frame-pointer -o ub ub.cpp && ./ub
ub.cpp:2:36: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'
survived -2147483648
EXIT CODE: 0
```

Nothing in the four `CMakeLists.txt` files passes `-fno-sanitize-recover`, and no workflow step
sets `UBSAN_OPTIONS`. UBSan therefore runs in **recovering mode**: a finding prints to the log
and `ctest` still passes. Half of the existing sanitizer investment is currently advisory.

### 2.2 The static analyzer is switched off entirely

All four `.clang-tidy` files begin with `-*` and enable nine checks:

```yaml
Checks: >
  -*, bugprone-sizeof-expression, bugprone-use-after-move,
  performance-for-range-copy, performance-unnecessary-copy-initialization,
  readability-container-size-empty, readability-redundant-string-init,
  modernize-use-nullptr, modernize-use-override
WarningsAsErrors: '*'
```

`-*` disables `clang-analyzer-*`, which is the path-sensitive analyzer — the part that finds
defects rather than style issues. Of the nine enabled checks, seven are formatting or
micro-performance.

### 2.3 Static analysis cannot find the descriptor leaks (recommendation changed)

The initial plan was `gcc-13 -fanalyzer -Wanalyzer-fd-leak` for review finding **H1**
(eight descriptor leaks in `fs-guard/src/platform/linux/linux_backend.cpp`), since gcc-13 is
already installed in the Linux job. It does work on simple control flow:

```
fd.cpp:3:86: warning: leak of file descriptor 'fd' [CWE-775] [-Wanalyzer-fd-leak]
  'int leak()': events 1-5
    (1) opened here ... (5) 'fd' leaks here; was opened at (1)
```

But against the real file it finds nothing:

```
$ g++-13 -std=c++20 -fanalyzer -Iinclude -Isrc -c src/platform/linux/linux_backend.cpp -o /dev/null
(compiled clean, zero warnings)
```

Reduced to the exact H1 shape — open a descriptor, call a function that throws, then `close`:

| Tool | Warnings on the H1 exception-path pattern |
| --- | --- |
| `g++-13 -std=c++20 -fanalyzer` | 0 |
| `clang++-18 -std=c++20 --analyze` | 0 |

Neither analyzer models C++ `throw`/unwind for descriptor tracking, and **every** H1 leak occurs
on an unwind path. Do not budget effort expecting a scanner to catch this class. It needs
runtime detection — see recommendation **T2.1**.

### 2.4 Runtime descriptor accounting is trivial and works

```
$ ./fdcount
before=4 after=5 leaked=1
```

A `std::filesystem::directory_iterator("/proc/self/fd")` count is sufficient, needs no external
tooling, and runs at full speed.

## 3. Tier 1 — Enforce the Existing Investment

Near-zero added CI time. All edits are in the Linux job and the CMake quality function.

### T1.1 Make UBSan fail the build

Highest value per unit of effort in this document. Addresses finding 2.1.

```cmake
# in local_whisper_apply_quality, the non-MSVC sanitizer branch
target_compile_options(${target} PRIVATE -fsanitize=address,undefined
                       -fno-sanitize-recover=undefined -fno-omit-frame-pointer)
target_link_options(${target} PRIVATE -fsanitize=address,undefined
                    -fno-omit-frame-pointer)
```

```yaml
# native-quality-linux job env
env:
  ASAN_OPTIONS: detect_leaks=1:strict_string_checks=1:detect_stack_use_after_return=1:check_initialization_order=1:abort_on_error=1
  UBSAN_OPTIONS: print_stacktrace=1:halt_on_error=1:abort_on_error=1
```

`detect_invalid_pointer_pairs=2` is also worth trying, given how much of this code does
iterator and span arithmetic (`bytes.begin() + static_cast<std::ptrdiff_t>(offset)`). It
requires `-fsanitize=pointer-compare,pointer-subtract` at compile time and can be noisy;
introduce it separately.

**Windows applicability.** This item is Linux-only, and the reasons are structural rather than
effort-based:

- **MSVC has no UndefinedBehaviorSanitizer.** There is no `/fsanitize=undefined`. The closest
  substitutes are `/RTC1` (runtime checks, Debug only), `/sdl`, and `/analyze` — see T3.3. So the
  UB half of this recommendation has no Windows counterpart at all, and Windows-only code paths
  get no UB coverage from any tool.
- **MSVC ASan exists** (`/fsanitize=address`, VS 16.9+) and honours `ASAN_OPTIONS`, but
  **LeakSanitizer does not exist on Windows** — `detect_leaks=1` is silently unsupported. Use the
  Windows-specific options set (`ASAN_OPTIONS=abort_on_error=1:windows_hook_rtl_allocators=1`) and
  do not copy the Linux string across, or the job will look configured while checking less than
  intended.

Net effect: after this fix Linux enforces both ASan and UBSan; Windows can enforce ASan only, and
UB in `windows_backend.cpp` remains undetectable by sanitizers. That asymmetry is worth recording
explicitly rather than discovering later.

### T1.2 Re-enable the static analyzer and bug-finding checks

Addresses finding 2.2. Add to each of the four `.clang-tidy` files:

```yaml
  clang-analyzer-*,
  bugprone-*,
  cert-*,
  concurrency-*,
  misc-const-correctness,
```

Review findings this reaches directly:

- `bugprone-exception-escape` — `WorkerApplication::run()` is declared `noexcept` and calls
  `engine_.unload()` inside a catch handler
  (`whisper-cpp/core/worker_application.cpp:330-348`)
- `bugprone-unchecked-optional-access` — `load.device_authority->selected_ordinal`
  (`whisper-cpp/core/worker_application.cpp:432`)
- `concurrency-mt-unsafe` — the `strtol` / `getenv`-class calls in the guard backend
- `cppcoreguidelines-pro-type-const-cast` — the `const_cast<CancellationToken*>` pattern used
  to feed the whisper.cpp C callback API

**Caveat, stated plainly:** enabling `bugprone-*` and `cert-*` across 14.5k lines will produce a
backlog on first run. Keep `WarningsAsErrors` scoped to the checks that have been burned down
rather than leaving `WarningsAsErrors: '*'` and blocking every PR on day one.

**Cross-platform note.** The `.clang-tidy` files are shared, but the Linux job only ever analyses
files that compile on Linux, so `windows_backend.cpp` and its siblings are never checked. Two
options, in preference order:

1. Run `clang-tidy` on the Windows leg too (T3.3). It needs a `compile_commands.json` from a
   Windows configure, `--extra-arg=-D_WIN32`, and the `HeaderFilterRegex` values already present.
   This also requires fixing the path-separator filter noted in 1.1.
2. If Windows `clang-tidy` is not adopted, add `clang-tidy --extra-arg=--target=x86_64-pc-windows-msvc`
   cross-analysis on the Linux runner for the Windows sources. Cheaper to wire up, but it needs
   the Windows SDK headers to be reachable, so in practice option 1 is the realistic one.

Whichever is chosen, note that some enabled checks behave differently across platform headers
(`concurrency-mt-unsafe` flags a different function set; `cert-env33-c` and the `bugprone-*`
signal-handling checks key off POSIX declarations), so expect the two platforms' baselines to
differ and burn them down separately.

### T1.3 Standard-library hardening in the test presets

The code uses unchecked `operator[]` on `std::array`, `std::span`, and `std::vector` throughout:
`buffer_[buffer_length_++]` in the nested SHA-256, `bytes[offset]` in `pcm_audio.cpp`,
`words[index]` in every `transform`. Addresses review finding **M4** (a latent out-of-bounds
write at `buffer_[64]` on a 64-byte array).

```cmake
# sanitizer branch only, so Release performance is unaffected
target_compile_definitions(${target} PRIVATE _GLIBCXX_ASSERTIONS)
# libc++ equivalent:
# _LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_EXTENSIVE
```

This converts the M4 class of defect into a hard abort the moment a test reaches it.

**Windows equivalent, with an ABI hazard.** The MSVC STL counterpart is `_ITERATOR_DEBUG_LEVEL`
(`1` = checked iterators, `2` = full debug, implied by `/MDd`) and `_CONTAINER_DEBUG_LEVEL=1`.
Add it in the MSVC branch of `local_whisper_apply_quality`, for the test configuration only:

```cmake
if(MSVC)
  target_compile_definitions(${target} PRIVATE _ITERATOR_DEBUG_LEVEL=1 _CONTAINER_DEBUG_LEVEL=1)
endif()
```

**`_ITERATOR_DEBUG_LEVEL` is an ABI-affecting macro and must be identical across every
translation unit and every static library linked into the binary — including GoogleTest.** A
mismatch is a link-time or run-time failure, not a silent degradation. Because the project builds
GoogleTest from locked sources inside the same CMake project this is achievable, but the
definition has to be applied to the GoogleTest targets too, not only to
`local_whisper_apply_quality` targets. Verify with a clean Windows configure before relying on it.

`_GLIBCXX_ASSERTIONS` has no such constraint — it is not ABI-affecting — so the two platforms need
different rollout care even though the intent is the same.

### T1.4 Additional warning flags

This tree is dense with narrowing conversions (`static_cast<std::uint16_t>`,
`static_cast<int>(samples.size())`, `st_dev` to `uint64_t`) and none are currently checked.

```cmake
if(MSVC)
  # /W4 /WX are already set; these conversion and shadow warnings are off by default at /W4
  target_compile_options(${target} PRIVATE /w14242 /w14244 /w14254 /w14263 /w14265 /w14287
                                          /w14296 /w14311 /w14456 /w14457 /w14458 /w14459)
else()
  target_compile_options(${target} PRIVATE -Wconversion -Wsign-conversion -Wshadow -Wcast-qual)
endif()
```

The MSVC list is the rough equivalent set: C4242/C4244/C4254/C4267 (narrowing), C4263/C4265/C4287
(signed/unsigned and virtual mismatches), C4311 (pointer truncation), C4456-C4459 (shadowing).
Expect the two platforms to surface **different** findings on the same shared files, because the
platform typedefs differ (`DWORD`/`HANDLE` vs `dev_t`/`ino_t`), so budget for two burn-downs.

### T1.5 Stack usage ceiling

Addresses the 64 KB zero-initialized stack buffers in `ExactModelReader::skip_exact`,
`Impl::hash_file`, and `proxy_owned_group`.

**Correction to an earlier draft of this document, which recommended an unconditional
`-Wstack-usage=16384`. That flag is GCC-specific.** The Linux quality job compiles with
`CXX: clang++-18`, and clang treats an unrecognised `-W` option as `-Wunknown-warning-option`,
which under the existing `-Werror` becomes a **build failure**. Adding it unconditionally would
have broken the job. Guard it by compiler:

```cmake
if(MSVC)
  # no direct equivalent; /analyze reports stack usage - see T3.3
elseif(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
  target_compile_options(${target} PRIVATE -Wstack-usage=16384)
else() # Clang
  target_compile_options(${target} PRIVATE -Wframe-larger-than=16384)
endif()
```

VERIFIED locally: `g++-13 -Werror -Wstack-usage=16384` correctly errors on a 100 KB frame.
clang was not installed on the review machine, so the `-Wframe-larger-than=` branch is
**UNVERIFIED** — confirm it on the CI image before merging, and keep the per-compiler guard
regardless.

### T1.6 Second-compiler leg

gcc-13 is already installed in the Linux job but unused for the quality build. GCC and clang
diagnose different things; a `compiler: [clang++-18, g++-13]` matrix dimension costs one build.

**Windows has no equivalent second compiler.** MSVC is the only toolchain in the Windows job and
the toolchain locks pin `msvc-19.39`, so this item is Linux-only. If a second Windows front-end is
ever wanted, `clang-cl` is the candidate — it would also unlock `clang-tidy` and libFuzzer on
Windows (T2.2) — but that is a toolchain-lock change and needs explicit scope under `AGENTS.md`.

## 4. Tier 2 — New Checks, High Value on This Codebase

### T2.1 Descriptor and handle balance fixture — the fix for H1

Since no scanner can see these leaks (finding 2.3), encode the invariant in the tests instead.
Verified working (finding 2.4).

```cpp
#if defined(_WIN32)
static std::size_t live_kernel_object_count() {
  DWORD count = 0;
  return GetProcessHandleCount(GetCurrentProcess(), &count) ? count : 0;
}
#else
static std::size_t live_kernel_object_count() {
  std::size_t count = 0;
  for (const auto& entry : std::filesystem::directory_iterator("/proc/self/fd")) {
    static_cast<void>(entry);
    ++count;
  }
  return count;
}
#endif
```

Snapshot in `SetUp`, assert in `TearDown`, and add negative-path cases that drive each guard
command into `UNSAFE_ENTRY`, `IDENTITY_CHANGED`, and `IO_FAILED`. All eight H1 sites become red
tests.

This runs at full speed and needs no external tooling, which is why it beats a scanner here. But
the two platforms are **not** symmetric and the assertion has to be written differently:

- **Linux** counts only file descriptors. The count is stable and quiet, so a strict
  `EXPECT_EQ(before, after)` works.
- **Windows** `GetProcessHandleCount` counts **every** kernel handle — threads, events, registry
  keys, handles the CRT or a lazily-loaded DLL may open — so it is noisy and a strict equality
  assertion will flake. Either assert non-increase with a small documented tolerance, or count
  live `unique_handle` instances instead. **The wrapper-counting variant is the better long-term
  choice on both platforms**: instrument `unique_fd.hpp` and `unique_handle.hpp` with a
  test-only live-instance counter, and the assertion becomes exact, portable, and independent of
  OS bookkeeping.
- The Windows backend leaks **HANDLEs**, not descriptors, so its negative-path tests must be
  written against `windows_backend.cpp`'s own error paths. That file was **not** audited to H1
  depth in the companion review — it is the largest in the tree with no static-analysis or
  sanitizer coverage — so assume the same exception-path pattern exists there until checked.

### T2.2 libFuzzer targets for the parsers

The single highest-value **new** check, because parsing untrusted bytes is what this component
does. clang-18 is already provisioned. Every target is pure byte-in / parse-out with a bounded
contract:

| Target | Entry point |
| --- | --- |
| frame codec | `common::decode_frame` |
| bounded JSON | `common::validate_bounded_json` |
| canonical WAV | `common::validate_canonical_wav` + `WavAccumulator::append` |
| authority records | `common::decode_authority_record` |
| launch request | `launcher::LaunchRequestParser::parse` |
| guard protocol | `fs_guard::parse_request` then `parse_command` |
| device identity | `whisper_cpp::canonical_pci_identity` |

```cmake
target_compile_options(fuzz_frame_codec PRIVATE -fsanitize=fuzzer,address,undefined)
target_link_options(fuzz_frame_codec PRIVATE -fsanitize=fuzzer,address,undefined)
```

On PR: `-max_total_time=60 -rss_limit_mb=2048` per target, roughly 7 minutes total. Seed the
corpus from the conformance vectors already generated for the cross-language checks — a real
advantage here, since valid inputs are already on hand. Commit the corpus so PR runs are
regression runs. [ClusterFuzzLite](https://google.github.io/clusterfuzzlite/) is designed for
this PR-level model if longer continuous runs are wanted later.

**Platform scope — this one is genuinely fine as Linux-only.** libFuzzer requires clang
(`-fsanitize=fuzzer`); MSVC has no equivalent, so a Windows fuzzing leg would need `clang-cl`
(see T1.6). That is acceptable here because **all seven targets sit in platform-neutral code**:
five in `runtime/local-whisper/common/`, one in `fs-guard/src/common/protocol.cpp` +
`command.cpp`, one in `whisper-cpp/device/device_registry.cpp`. None of them `#ifdef` on the
platform, so fuzzing them on Linux exercises exactly the same logic Windows runs.

The corollary is what to watch: the **platform backends** are not reachable this way. The parsers
that guard the Windows trust boundary are the shared ones listed above, but
`windows_backend.cpp`'s own input handling (wide-character conversion in `wide_to_utf8`,
`FILE_ID_INFO`/`StableIdentity` parsing, ACL verification) is not covered by any fuzz target and
has no static analysis either. If Windows-side input handling is to be covered, `wide_to_utf8`
and the identity parsers are the candidates, and they need `clang-cl` or a portability shim.

### T2.3 ThreadSanitizer leg for the worker suite

The inference thread plus `InferenceTerminalArbiter` and `CancellationController` is the only
real concurrency in the tree, and it is where critical finding **C1** lives. TSan and ASan are
mutually exclusive, so this needs its own preset (`linux-test-tsan`) and its own `ctest`
invocation. Scope it to the whisper-cpp suites; the guard and launcher are single-threaded.

**Platform scope.** TSan is clang/GCC on Linux and macOS only — **MSVC has no ThreadSanitizer**, so
there is no Windows counterpart. This is lower-risk than it sounds: the concurrent code is
`worker_application.cpp` and `cancellation.cpp`, both platform-neutral, and only the channel
implementation underneath differs (`worker_protocol_posix.cpp` vs `worker_protocol_windows.cpp`).
Both use separate read/write endpoints with no shared mutable state, so a Linux TSan run covers the
interesting races. Record that Windows relies on the Linux TSan result rather than having its own,
so a future Windows-specific threading change is known to be uncovered.

### T2.4 Binary hardening assertion on Release artifacts

The review found no exploit-mitigation flags set anywhere. Add the flags, then assert them so
they cannot regress. Extend the existing `audit:local-whisper:whisper-cpp-pack` step, which
already inspects pack contents.

```
ELF: RELRO=full, BIND_NOW, NX, PIE, stack protector, FORTIFY_SOURCE
PE:  /DYNAMICBASE /NXCOMPAT /GS /guard:cf /HIGHENTROPYVA
```

`readelf -dlW` plus `dumpbin /headers` is sufficient; `checksec --file` if an off-the-shelf tool
is preferred. **Must run against the Release presets**, not the Debug sanitizer builds.

## 5. Tier 3 — Broader Coverage, Higher Cost

### T3.1 CodeQL `cpp` with `security-extended`

Free for public repositories, requires `security-events: write`, builds through the existing
presets, adds roughly 10-20 minutes. Strong on CWE-022 path traversal, CWE-190 integer
overflow, CWE-401, CWE-457, CWE-676.

Note: CodeQL shares the exception-path blind spot documented in 2.3, so it is **not** an H1
substitute. Its value here is taint and integer-overflow queries across the whole tree.

**This is the recommendation where a Linux-only run is most misleading.** CodeQL's C++ extractor
only sees code that is actually compiled during the tracked build. A Linux-only CodeQL job would
therefore analyse **zero** of the 2,856 Windows-only lines while reporting a clean C++ result — the
worst possible combination, because the uncovered file is the largest in the tree and already has no
`clang-tidy` and no sanitizers.

If CodeQL is adopted, run **two** legs — `runs-on: ubuntu-24.04` and `runs-on: windows-latest`,
both with `language: c-cpp` and a manual build step invoking the existing CMake presets. Both
upload to the same code-scanning target and the results merge. If only one leg is affordable,
prefer... neither: a single-platform C++ CodeQL result on this codebase creates false assurance.
Do T3.3 first instead, which at least brings Windows up to static-analysis parity for less time.

### T3.2 Diff-coverage gate on native code

Critical finding C1 survived both review and CI because the malformed-cancel path has no test.
`llvm-cov` with a threshold on **changed lines only** (not total coverage) is the check that
structurally prevents that class of miss. If only one Tier 3 item is adopted, this is the one.

**Tooling differs per platform.** Linux/clang uses `-fprofile-instr-generate -fcoverage-mapping`
plus `llvm-cov export --format=lcov`. MSVC has no `llvm-cov`; the practical options are
OpenCppCoverage (external tool, needs allowlisting under `AGENTS.md` dependency rules) or
`clang-cl` with the same instrumentation as Linux. Given that constraint, gate the diff-coverage
threshold on the Linux leg and treat the platform-specific backends as a known blind spot — or
accept that a change touching only `windows_backend.cpp` will show zero measured diff coverage and
must be reviewed on test evidence instead of a number.

### T3.3 MSVC static analysis and ASan on the Windows leg

`fs-guard/src/platform/windows/windows_backend.cpp` is 1167 lines — the largest single file in
the tree — with zero static analysis and zero sanitizer coverage today.

- Add `/analyze /sdl /guard:cf` to the MSVC branch of `local_whisper_apply_quality`
- Add `/fsanitize=address` to the `windows-test` preset (supported since Visual Studio 16.9)

### T3.4 Valgrind `--track-fds=all`

A heavier complement to T2.1 on a non-sanitized guard build. **Not verified locally** — valgrind
was not installed on the review machine. At 20-50x slowdown this belongs in a nightly leg, not
a PR gate. T2.1 is the better PR-level choice.

**Linux only** — valgrind has no Windows port. The Windows equivalent for handle leaks is
Application Verifier (`appverif` with the Handles check), which is heavyweight and awkward in CI;
T2.1's wrapper-counting variant is the realistic cross-platform answer.

### T3.5 Advisory polling for pinned upstream revisions

The SHA-256 source locks are excellent for integrity but say nothing about known
vulnerabilities in whisper.cpp `f049fff`, nlohmann-json 3.12.0, or googletest 52eb810. A
scheduled (not PR) advisory check closes that gap.

## 6. Per-Platform Applicability

`L` = applies to Linux, `W` = applies to Windows, `—` = no counterpart on that platform.

| # | Check | L | W | Windows constraint |
| --- | --- | --- | --- | --- |
| T1.1 | UBSan enforcing (`-fno-sanitize-recover`) | yes | **—** | MSVC has no UBSan at all |
| T1.1 | ASan enforcing + pinned options | yes | partial | ASan yes; **no LeakSanitizer**, so `detect_leaks` is inert |
| T1.2 | `clang-analyzer-*` / `bugprone-*` / `cert-*` | yes | **—** today | driver refuses off Linux; needs T3.3 |
| T1.3 | Standard-library hardening | yes | yes | `_ITERATOR_DEBUG_LEVEL` is ABI-affecting; must match GoogleTest |
| T1.4 | Conversion / shadow warnings | yes | yes | different flag names, different findings per platform typedefs |
| T1.5 | Stack usage ceiling | yes | partial | GCC `-Wstack-usage`, Clang `-Wframe-larger-than`, MSVC only via `/analyze` |
| T1.6 | Second-compiler leg | yes | **—** | MSVC is the only pinned Windows toolchain |
| T2.1 | Descriptor / handle balance fixture | yes | yes | handle count is noisy; prefer wrapper-instance counting |
| T2.2 | libFuzzer targets | yes | **—** | needs `clang-cl`; acceptable, all 7 targets are platform-neutral |
| T2.3 | ThreadSanitizer | yes | **—** | no MSVC TSan; concurrent code is platform-neutral so Linux covers it |
| T2.4 | Binary hardening assertion | yes | yes | ELF `readelf` vs PE `dumpbin`; different flag set to add and assert |
| T3.1 | CodeQL `cpp` | yes | yes | **must run both legs** or 2,856 Windows lines are silently unanalysed |
| T3.2 | Diff-coverage gate | yes | partial | no `llvm-cov` on MSVC; OpenCppCoverage or `clang-cl` |
| T3.3 | MSVC `/analyze` `/sdl` `/guard:cf` + ASan | **—** | yes | this *is* the Windows-parity item |
| T3.4 | Valgrind `--track-fds` | yes | **—** | no Windows port; Application Verifier is the rough analogue |
| T3.5 | Upstream advisory polling | yes | yes | platform-neutral |

Reading the table: **Linux can be brought to a high standard with Tier 1 + Tier 2 alone, but
Windows cannot.** Five of the sixteen rows have no Windows counterpart, and three more are only
partial. The one item that closes most of the gap is **T3.3**, which is currently filed under
Tier 3. Given that `windows_backend.cpp` is the largest file in the tree with the least coverage,
T3.3 deserves promotion above several Tier 2 items if Windows is a shipping target.

Two structural consequences worth deciding explicitly rather than by default:

1. **UB in Windows-only code is undetectable by any tool in this plan.** No MSVC UBSan, no
   `clang-tidy`, and CodeQL only if the Windows leg is run. Accept it knowingly, or adopt
   `clang-cl` (T1.6) which would unlock `clang-tidy`, UBSan, libFuzzer, and `llvm-cov` on Windows
   in one move — at the cost of a toolchain-lock change requiring explicit scope.
2. **Shared code gets double coverage; platform code gets single or none.** The seven fuzz targets,
   the digest, the codec, and the protocol parsers are all shared, which is fortunate — they are
   also the highest-risk parsing surface. The trust-boundary code that is *not* shared
   (`windows_backend.cpp`, `windows_launcher.cpp`, `windows_model_launch_application.cpp`) is
   precisely what stays uncovered.

## 7. Suggested Minimal PR-Blocking Set

Shortest path to real coverage, in order:

1. **T1.1** — `-fno-sanitize-recover=undefined` plus pinned `ASAN_OPTIONS` / `UBSAN_OPTIONS`.
   Makes an existing check actually enforce.
2. **T1.2** — `clang-analyzer-*` and `bugprone-*` in `.clang-tidy`, with `WarningsAsErrors`
   scoped to burned-down checks.
3. **T1.3** — `_GLIBCXX_ASSERTIONS` in the sanitizer presets.
4. **T2.1** — descriptor-balance fixture plus negative-path guard tests.
5. **T2.2** — seven libFuzzer targets at 60 s each with a committed corpus.

Estimated cost: roughly 8-10 minutes added to a job whose current timeout is 60 minutes.

**Items 1, 2, and 5 are Linux-only; items 3 and 4 apply to both platforms with the caveats in
section 6.** If Windows is a shipping target — and the packaging workflows say it is — add a sixth:

6. **T3.3** — MSVC `/analyze /sdl /guard:cf` plus `/fsanitize=address` on the `windows-test`
   preset.

It is the only entry in this document that raises the Windows floor. Without it, the plan improves
the platform that was already best covered and leaves 2,856 lines of trust-boundary code exactly
where they are.

Coverage against the companion review's findings:

| Finding | Covered by | Platform reach |
| --- | --- | --- |
| C1 — `std::terminate` on untrusted input | T2.3 (TSan), T3.2 (diff coverage) | Linux run covers both (shared code) |
| H1 — eight descriptor leaks | T2.1 | Linux; Windows analogue unaudited |
| H3 — unbounded `getline` | T2.2 (guard protocol fuzz target) | both (shared parser) |
| M4 — latent out-of-bounds write | T1.3 | both |
| M8 — locale-dependent validators | T2.2 (guard protocol fuzz target) | both (shared parser) |
| M9 — `SCM_RIGHTS` descriptor leaks | T2.1 | Linux only (POSIX-specific defect) |
| Missing exploit mitigations | T2.4 | both, different flags per platform |
| Untrusted parsing surface generally | T2.2 | both (all targets platform-neutral) |
| Windows-only trust boundary (2,856 lines) | **T3.3, and CodeQL only if its Windows leg runs** | Windows |

## 8. Explicitly Not Recommended

- **`gcc -fanalyzer` / `clang --analyze` for the descriptor leaks.** Measured zero detection on
  the real pattern (2.3). Both are still worth having via T1.2 for other defect classes, but
  not for H1.
- **Valgrind as a PR gate.** Too slow; see T3.4.
- **Blanket `WarningsAsErrors: '*'` with the expanded check set.** Would block every PR until
  the backlog is burned down; scope it incrementally instead.
- **An unconditional `-Wstack-usage=16384`.** GCC-only. The Linux job compiles with `clang++-18`,
  where an unknown `-W` option under the existing `-Werror` is a build failure. Guard by compiler
  (T1.5). This corrects an earlier draft of this document.
- **A single-platform CodeQL C++ job.** Its extractor only sees compiled code, so a Linux-only run
  reports a clean C++ result while analysing none of the Windows platform code. Run both legs or
  prefer T3.3 (T3.1).
- **Copying the Linux `ASAN_OPTIONS` string to the Windows leg.** `detect_leaks` does not exist on
  Windows ASan; the job would look configured while checking less than intended (T1.1).
