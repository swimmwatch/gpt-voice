# Handoff: Local Whisper Task 06 Complete

## Status

Task 06 was authorized through `execution.task-06` revision 1 and implemented.
Approved plan revision 4 is committed as `9e65fea`; this handoff is part of the
separately authorized Task 06 implementation commit recorded by
`commit.task-06` revision 1. The user selected and approved
`planning.native-cpp-windows-gate` revision 1 to defer unavailable Windows
10/11 x64 MSVC/native filesystem evidence to mandatory Task 17 qualification
without weakening the gate or making a Windows support claim. Plan revision 4
is approved through `approval.plan` revision 4, and Task 06 is complete. Task 07
execution, push, pull request, packaging, publication, macOS execution, and
release are not authorized.

## Completed Packets

- [01 Shared domain contracts](01_shared_domain_contracts.md), `d0083259`
- [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md), `d516d034`
- [03 Trusted catalog, settings, and inventory](03_trusted_catalog_settings_and_inventory.md), `14749e88`
- [04 Managed filesystem safety](04_managed_filesystem_safety.md), `649ec3b9`
- [05 Streaming artifact lifecycle](05_streaming_artifact_lifecycle.md), `32440674`
- [06 Native C++ modularization](06_native_cpp_modularization.md), included in
  its authorized isolated implementation commit from this transition

## Task 06 Implementation

- Replaced duplicated Linux/Windows protocol monoliths with a common C++20
  typed command model, validation, canonical base64url/version-1 protocol,
  safe-error normalization, closed dispatch, and injected `GuardApplication`.
- Added instance-owned Linux and Windows backends. Lease registries are no
  longer mutable globals; `UniqueFd`/`UniqueHandle` provide move-only RAII, and
  `src/main.cpp` is the thin platform composition root.
- Preserved all 18 commands, the 256 KiB line limit, request/response framing,
  the six native safe errors, and Task 04 anchored filesystem semantics. The
  final executable path remains `.cache/local-whisper/fs-guard/fs-guard[.exe]`.
- Added CMake 3.25+ presets, pinned test-only GoogleTest v1.17.0 commit
  `52eb8108c5bdec04579160ae17225d66034bd723`, CTest `unit`/`integration`
  labels, warnings-as-errors, Linux ASan/UBSan, Windows `/W4 /WX`, clang-format,
  and clang-tidy.
- Added 11 native unit tests and 4 real temporary-root integration tests, while
  retaining the existing Node/native filesystem security and race boundary.
- Added independent Linux/Windows native-quality CI jobs, CMake build and native
  quality runners, package commands, the native README, and root C++ agent rules.
- Renamed the platform sources to
  `src/platform/linux/linux_backend.cpp` and
  `src/platform/windows/windows_backend.cpp`; the Node source-contract test now
  follows those module boundaries.

## Toolchain And Checks

- CMake 3.31.6; Ninja 1.11.1; local compiler GCC 13.3.0; C++20 production and
  sanitized test builds passed with `-Wall -Wextra -Wpedantic -Werror`.
- Isolated Ubuntu 24.04 with a read-only repository mount passed the Clang 18
  sanitized configure/build, CTest `unit` and `integration` labels,
  clang-format 18 dry-run, and clang-tidy 18 over all common, composition-root,
  and Linux backend sources. The run completed with exit code 0 and did not
  modify the worktree.
- clang-format 18.1.8 dry-run: passed for all checked-in C++ sources/headers.
- clang-tidy 18.1.8 with generated compile database: passed for the active Linux
  source graph; Windows source is intentionally handled by the Windows CI job.
- CTest `unit`: 11 passed; `integration`: 4 passed; ASan/UBSan instrumentation
  present on all native compilation commands with no reported finding.
- `test:local-whisper:filesystem`: 23 passed; real Windows suite unavailable on
  Linux. `verify:local-whisper:filesystem -- --fixture`: passed on Linux x64,
  kernel `7.0.0-28-generic`, filesystem type `61267`.
- `test:local-whisper:artifacts`: 24 passed. `typecheck`, `test:types`, scoped
  ESLint, scoped Prettier, native format, native lint, and `git diff --check`:
  passed. Full `test:unit`: 1,447 passed, 0 failed.
- Packaged-runtime verification passed; the helper and GoogleTest remain outside
  package inputs. Release binary linkage contains no GoogleTest library.
- GoogleTest checkout HEAD matches the pinned commit. Its checked-out license is
  BSD-3-Clause and CMake links it only into test executables; dependency/license
  review gate is satisfied for Task 06 scope.

## Open Gates And Exact Continuation

- Task 06 commit authority is recorded by `commit.task-06` revision 1. Preserve
  the committed revision 4 plan/decision changes and exclude the three unrelated
  user-owned Prettify/composition-root files from every commit.
- [07 Framed worker supervisor](07_framed_worker_supervisor.md) is the exact
  next packet and needs separate execution authorization after Task 06 is
  committed. Do not begin Task 07 or commit in this planning invocation.
- Task 17 retains the mandatory representative Windows 10/11 x64 Visual Studio
  2022/MSVC `/W4 /WX` native and Windows filesystem evidence gate before
  release; Linux evidence cannot substitute.

## Rollback State

Rollback restores the two prior guard monoliths and direct build script, then
removes only Task 06 CMake/common/platform/test/lint/docs/CI additions. Generated
`.cache/local-whisper/fs-guard/` output is ignored and disposable. Do not remove
Task 05 work, real Local Whisper roots, artifacts, settings, or user data.
