# 06 Native C++ Modularization

## Outcome

The Local Whisper filesystem guard is a behavior-preserving, production-quality
C++20 project with one shared protocol/application core, narrow Linux and
Windows backends, explicit RAII ownership, deterministic CMake builds, pinned
GoogleTest unit/integration coverage, clang-format/clang-tidy gates, and required
dual-platform CI. A concise native-folder README and root `AGENTS.md` rules make
the architecture and extension constraints clear to both humans and LLM agents.

## Prerequisites

- The revised Local Whisper plan is approved, and Task 06 has separate execution
  authorization.
- Task 04 is committed and remains the authoritative filesystem security and
  behavior baseline.
- Task 05 is reviewed and committed in isolation before Task 06 starts. Preserve
  its uncommitted artifact-lifecycle work and exclude unrelated user-owned
  Prettify/composition-root changes from any later commit.
- `../spec.md` remains `Status: Approved`.
- Planning decisions remain:
  - `planning.native-cpp-toolchain = cmake-googletest-pinned`;
  - `planning.native-cpp-ci-depth = dual-platform-full-gate`;
  - `planning.native-cpp-task-order = insert-before-supervisor`;
  - `planning.native-cpp-windows-gate = defer-to-qualification`.
- No AMD or Apple Silicon hardware evidence is available. This packet changes no
  support tier and makes no hardware-support claim.

## Owned Requirements

- Native maintainability and verification portions of `SEC-007`, `RUN-004`,
  `PKG-001`, and `AC-AUTO-032`.
- Filesystem-helper portions of `AC-AUTO-017`–`AC-AUTO-020`, `AC-AUTO-023`,
  `AC-AUTO-040`, and `AC-AUTO-041`.
- Delivery constraints recorded by `planning.native-cpp-toolchain`,
  `planning.native-cpp-ci-depth`, and `planning.native-cpp-task-order`.
- This packet shares those requirements with Task 04; it does not replace or
  weaken Task 04 acceptance ownership.
- Task 06 owns the implementation and verified Linux evidence. Task 19 owns the
  deferred Windows/MSVC and Windows filesystem evidence for the shared
  `SEC-007`, `RUN-004`, `PKG-001`, `AC-AUTO-032`, `AC-AUTO-040`, and
  `AC-AUTO-041` release gate.

## In Scope

- Refactor `runtime/local-whisper/fs-guard/main.cpp` and `windows_main.cpp` into
  reusable common and platform modules without changing the native protocol or
  security behavior.
- Add CMake targets and presets for Linux Clang and Windows MSVC builds.
- Add pinned GoogleTest/CTest unit and native integration tests.
- Add clang-format, clang-tidy, compiler warnings-as-errors, Linux ASan/UBSan,
  and Windows `/W4 /WX` quality gates.
- Keep the existing Node-driven filesystem suites as the outer
  TypeScript/native-process integration boundary.
- Update `scripts/local-whisper/build-fs-guard.mjs` and narrow package scripts to
  use the CMake build while preserving the existing executable path contract.
- Add required Linux and Windows native-quality jobs to
  `.github/workflows/pr-checks.yml`.
- Add `runtime/local-whisper/fs-guard/README.md` and a compact root `AGENTS.md`
  C++ section.

## Out Of Scope

- New filesystem commands, protocol version changes, changed validation limits,
  relaxed no-follow/identity/lock semantics, new persistence, or user-visible
  behavior.
- Task 07 worker-supervisor baseline, Task 09 authority/lifecycle completion,
  and Task 10 `whisper.cpp` inference runtime implementation.
- Shipping or packaging the helper in installers; Task 17 owns packaged native
  artifacts, provenance, license/SBOM review, and release placement.
- Adding a production model, runtime pack, signing key, catalog origin,
  credential, GPU dependency, or hardware probe.
- Executable macOS support, Metal inference, macOS managed storage, signing,
  notarization, or a macOS support claim. Task 18 owns only the unavailable
  skeleton; production support requires a new `/spec` first.
- Broad repository C++ migration, speculative framework code, or abstraction for
  platforms/commands that do not exist.

## Task Contract

### Compatibility freeze

1. Capture golden tests before moving behavior. Preserve protocol version `1`,
   the 256 KiB maximum line size, tab-delimited newline-terminated transport,
   base64url field encoding, request IDs, and `OK`/`ERR` response shape byte for
   byte.
2. Preserve the exact command surface:
   `PROCESS_IDENTITY`, `INIT`, `LOCK`, `CREATE_STAGING`, `CREATE_FILE`,
   `WRITE_FILE`, `SEAL_FILE`, `LIST`, `LIST_NAMESPACE`, `OPEN_ARTIFACT`,
   `PROMOTE`, `QUARANTINE`, `DELETE_FILE`, `DELETE_STAGING_FILE`,
   `REMOVE_QUARANTINE`, `REMOVE_STAGING`, `REVALIDATE`, and `RELEASE`.
3. Preserve the safe native error vocabulary: `CONFLICT`, `IDENTITY_CHANGED`,
   `INVALID_INPUT`, `IO_FAILED`, `UNSAFE_ENTRY`, and `UNSUPPORTED`. Raw OS
   errors, paths, user names, file IDs, volume/device identifiers, and exception
   strings must not cross stdout.
4. Preserve all Task 04 semantics: private roots/modes/ACL intent, anchored
   relative traversal, symlink/reparse/mount/volume rejection, stable identity,
   cross-process locks, manifest-only list/delete, same-filesystem promotion and
   quarantine, and failure without recursive cleanup.
5. Stdout remains protocol-only. Tests and diagnostics must not emit private
   filesystem data or add routine native logging.

### Modular architecture

1. Use namespace `local_whisper::fs_guard` and a thin `src/main.cpp` composition
   entry point. CMake selects exactly one platform backend; common source must
   not include Windows/POSIX headers.
2. The common layer owns:
   - canonical error/result serialization;
   - base64url and request/response protocol codec;
   - shared lexical/value validation;
   - a typed command model/parser using a closed variant or equivalent;
   - command dispatch and the `GuardApplication` stdin/stdout lifecycle;
   - platform-neutral lease-registry policy where it reduces real duplication.
3. The platform layer owns OS calls and identities only:
   - Linux: `openat2`/descriptor-relative operations, `stat` identity, hashing,
     process-start identity, and `UniqueFd` RAII;
   - Windows: handle-relative/reparse-aware operations, ACL/file/volume identity,
     BCrypt hashing, process-start identity, and `UniqueHandle` RAII.
4. `GuardApplication` is state-owning and constructor-injected with a narrow
   backend interface. Parsing/serialization/validation remain pure where no
   state ownership exists. Platform backends own their lease registries and
   native resources; no mutable module-level registry or constructed singleton
   is allowed.
5. Use deterministic RAII for every descriptor, handle, directory stream,
   algorithm provider/hash object, and lease. Destructors are non-throwing;
   ownership transfer is explicit; raw handles never escape the backend.
6. Avoid platform `#ifdef` branches in common business logic, pass-through
   wrappers, command-string dispatch chains, inheritance without substitutable
   behavior, and helpers created only to reduce line count. Apply SOLID, DRY,
   and YAGNI through narrow stable responsibilities, not speculative layers.
7. The Linux and Windows implementations may differ where OS security primitives
   differ. Deduplicate protocol, validation, command semantics, application
   lifecycle, response generation, constants, and test vectors only when their
   contracts are truly identical.

### Expected source layout

Use this ownership layout; minor filename adjustments are allowed only if the
same boundaries remain explicit and the README maps the final names:

```text
runtime/local-whisper/fs-guard/
  CMakeLists.txt
  CMakePresets.json
  .clang-format
  .clang-tidy
  README.md
  include/local_whisper/fs_guard/
    backend.hpp
    command.hpp
    error.hpp
    guard_application.hpp
    protocol.hpp
    validation.hpp
  src/
    main.cpp
    common/
      command.cpp
      error.cpp
      guard_application.cpp
      protocol.cpp
      validation.cpp
    platform/linux/
      linux_backend.cpp
      linux_backend.hpp
      unique_fd.hpp
    platform/windows/
      unique_handle.hpp
      windows_backend.cpp
      windows_backend.hpp
  tests/
    unit/
    integration/
```

Do not keep the old monoliths as compiled duplicate implementations or introduce
a third generic filesystem layer that merely forwards to a backend.

### Build and dependency contract

1. Use CMake `>=3.25`, C++20, `CXX_EXTENSIONS OFF`, and out-of-source builds.
   Production target names and final executable location are deterministic.
2. With `BUILD_TESTING=ON`, use GoogleTest v1.17.0 through `FetchContent` pinned
   to immutable commit `52eb8108c5bdec04579160ae17225d66034bd723`.
   GoogleTest remains test-only, is not linked into the production helper, and
   its BSD-3-Clause license/provenance is recorded in the native README or
   existing dependency notice mechanism.
3. `scripts/local-whisper/build-fs-guard.mjs` invokes CMake with `shell: false`,
   selects the current-platform preset, and prints the same final path:
   `.cache/local-whisper/fs-guard/fs-guard` on Linux and
   `.cache/local-whisper/fs-guard/fs-guard.exe` on Windows.
4. Normal product builds set `BUILD_TESTING=OFF`. Generated build trees and
   binaries stay under ignored `.cache/local-whisper/`; no generated CMake,
   compiler, test, or coverage artifact is committed.
5. Linux builds use Clang 18 or a newer explicitly recorded compatible version,
   `-Wall -Wextra -Wpedantic -Werror`, and CI sanitizer instrumentation
   `-fsanitize=address,undefined -fno-omit-frame-pointer`.
6. Windows builds use the Visual Studio 2022 generator and MSVC C++20 with
   `/W4 /WX /permissive- /EHsc`. No warning suppression is added merely to make
   CI pass; narrowly justified platform warnings require documented review.

### Native tests and static quality

1. Add GoogleTest unit coverage for:
   - base64url valid/invalid/boundary vectors;
   - protocol parsing, maximum line size, request IDs, response serialization;
   - every typed command's argument count/value validation;
   - safe error normalization and unknown-command rejection;
   - dispatch against an injected fake backend;
   - lease creation/lookup/release and RAII move/cleanup invariants.
2. Add native integration tests using freshly created temporary roots and the
   real current-platform backend for initialization, staging/write/seal/list,
   promotion/open/revalidation, lock conflict/release, quarantine/exact delete,
   unsafe-entry rejection, and cleanup. They must never use the real Local
   Whisper data root.
3. Drive `GuardApplication` through streams with the real backend in native
   integration tests. Retain existing Node tests to spawn the built executable
   and cover TypeScript/native protocol compatibility and OS race fixtures.
4. Register CTest labels `unit` and `integration`; each label must be runnable
   independently. Tests are deterministic, use no network, credentials, private
   audio/transcripts, production models/runtimes, or elevated privileges.
5. `clang-format --dry-run --Werror` covers every checked-in native source/header.
   clang-tidy uses the generated compile database and includes at least bugprone,
   performance, portability, readability, and modernize checks, with explicit
   narrow exclusions documented in `.clang-tidy`.
6. Linux unit and integration suites run under ASan/UBSan in this packet.
   Windows unit and integration suites are configured for `/W4 /WX` and execute
   only in Task 19. Existing Node filesystem integration/race tests remain
   required on both OS runners, with representative Windows execution likewise
   deferred to Task 19.

### README and agent rules

1. Add a concise `runtime/local-whisper/fs-guard/README.md` containing:
   purpose/trust boundary; architecture/module map; protocol behavior and
   compatibility rule; Linux/Windows build, format, lint, unit, and integration
   commands; generated-output location; platform constraints; test-data safety;
   extension checklist; and explicit macOS Planned/unavailable status.
2. Make the README useful to LLM agents: identify the state-owning class,
   common-vs-platform edit locations, invariants that must not change, required
   tests after each class of edit, and the ban on generated artifact commits.
3. Add a compact root `AGENTS.md` C++ section requiring:
   - modular C++20, high cohesion, low coupling, and cognitive clarity;
   - OOP for state/lifecycle/resource ownership and pure functions for stateless
     transformations;
   - constructor injection and narrow testable interfaces;
   - all SOLID principles, DRY without premature abstraction, and YAGNI;
   - RAII/no raw resource ownership, deterministic cleanup, explicit error
     contracts, and no mutable globals;
   - platform isolation, shared contract tests, temporary-root integration
     tests, warnings-as-errors, clang-format, clang-tidy, and sanitizers;
   - security/privacy preservation and no broad recursive filesystem actions.

### Package scripts and CI

1. Preserve `build:local-whisper:fs-guard` and
   `test:local-whisper:filesystem`. Add narrow developer commands for native
   format check, clang-tidy, unit tests, integration tests, and their aggregate;
   document the exact final names in the README and handoff.
2. Add independent required pull-request jobs in
   `.github/workflows/pr-checks.yml`:
   - Linux native quality: Node 24/npm install, CMake/Ninja, recorded LLVM
     version, format check, clang-tidy, sanitized build, CTest unit/integration,
     and existing Node filesystem suite;
   - Windows native quality: Node 24/npm install, Visual Studio 2022/MSVC
     warnings-as-errors build, CTest unit/integration, and existing Windows Node
     filesystem suite.
3. Jobs run on pull requests and `main`, fail closed on missing tools/tests, and
   do not silently skip the current platform. Keep them separate from packaging
   smoke jobs so native failures are attributable.
4. CI may fetch only the pinned GoogleTest source required by this packet. It
   must not download a Local Whisper runtime/model, contact a production origin,
   or change package/release artifacts.
5. Task 06 owns the Windows job definition and deterministic configuration
   assertions only. Required representative execution of that job and its
   equivalent local commands is a Task 19 completion gate.

## Contracts And Boundaries

- `NativeManagedFilesystemGuardTransport` retains its request/response and
  executable-path contract; renderer and preload boundaries do not change.
- Task 04 remains authoritative for filesystem security and Task 05 remains
  authoritative for artifact lifecycle. Refactoring cannot reinterpret their
  behavior from tests alone.
- The backend interface is a test seam, not renderer/IPC/public API. Native
  handles and absolute paths remain process-private.
- Task 07 may reuse Task 06 build/quality conventions for new launchers, but it
  owns its own process-tree and framed-worker protocol.
- Task 15 alone decides installer placement, runtime integrity metadata,
  provenance, signing, redistribution, and release inclusion.

## Expected Files Or Components

- `runtime/local-whisper/fs-guard/` modular source, headers, tests, CMake files,
  lint configuration, and README described above.
- `scripts/local-whisper/build-fs-guard.mjs` and any one narrow native-quality
  runner needed to keep package scripts cross-platform.
- `package.json` native build/lint/test commands; no production dependency.
- `.github/workflows/pr-checks.yml` Linux and Windows native-quality jobs.
- Root `AGENTS.md` compact C++ conventions.
- Existing `tests/main/localWhisper/filesystem/*.test.ts` remain outer integration
  coverage; modify only when necessary to preserve deterministic CMake output.

## Acceptance Criteria

- Common protocol, validation, command dispatch, constants, error handling, and
  application-loop logic exist once; Linux/Windows files contain only actual
  platform differences.
- `main.cpp` is a thin composition root, every native resource has RAII
  ownership, and no mutable global lease/application state remains.
- Golden and existing Node tests prove byte-compatible protocol behavior and no
  regression in Task 04 filesystem security, race, lock, promotion, or deletion
  behavior.
- GoogleTest unit and real temporary-root integration suites pass on Linux
  under ASan/UBSan. Equivalent Windows `/W4 /WX` and real-backend suites remain
  mandatory in Task 19 before release; their current absence is recorded and
  cannot be represented as passing evidence.
- clang-format and clang-tidy run in CI and fail on violations.
- The CMake production build still emits the exact executable path consumed by
  the TypeScript transport and adds no production/test dependency to installers.
- The native README and root C++ agent rules cover architecture, purpose,
  behavior, OOP/modularity/testability, SOLID, DRY, YAGNI, low coupling, high
  cohesion, cognitive clarity, and future macOS boundaries.
- No macOS executable, runtime/model catalog entry, storage root, Ready state, or
  support claim is introduced.

## Verification

Run on Linux with the checked-in preset and temporary roots only:

```text
rtk npm run format:check:local-whisper:fs-guard
rtk npm run lint:local-whisper:fs-guard
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:filesystem
rtk npm run verify:local-whisper:filesystem -- --fixture
rtk npm run typecheck
rtk npm run test:types
rtk npm run test:unit
rtk git diff --check
```

The equivalent checked-in Windows preset/commands and existing Windows
Node/native filesystem suite are deferred to Task 19 by
`planning.native-cpp-windows-gate` revision 2. Record the missing evidence in
`handoff.md`; Task 19 must later record Windows version, MSVC, CMake,
GoogleTest commit, CTest labels, and exact pass/skip counts without private
paths or logs.

## Failure And Rollback

- Any protocol/output mismatch, security-semantic regression, sanitizer finding,
  unhandled resource leak, or available-platform test failure blocks
  completion. A later Windows failure blocks Task 19/release and requires an
  authorized Task 06 repair; do not weaken a check or restore duplicated
  platform logic to obtain a pass.
- If the proposed common interface cannot express a real Windows/Linux security
  difference safely, keep that behavior platform-local and document it. Do not
  force unsafe unification.
- Rollback restores the prior Task 04 helper sources/build script and removes
  only Task 06 CMake/test/lint/docs/CI additions. Do not remove Task 05 work,
  generated user data, real Local Whisper roots, artifacts, or settings.
- Generated `.cache/local-whisper/` content is disposable and ignored; rollback
  must not use broad deletion against a workspace or user directory.

## Manual Gates

- `DEFERRED MANUAL GATE — Windows native evidence`: Task 19, not Task 06
  completion, must obtain required CI/representative Windows x64 results for
  native unit/integration and existing junction/reparse, ADS, file-ID, volume,
  lock, promotion, and deletion fixtures. Linux cannot substitute, no Windows
  result may be claimed now, and release remains blocked until this passes.
- `MANUAL GATE — dependency/license review`: confirm pinned GoogleTest
  provenance/license and that it is test-only before Task 06 completion.
- `MANUAL GATE — packaging`: Task 15 must separately authorize and verify helper
  packaging, provenance, integrity, redistribution, and release placement.
- No destructive test may use a real Local Whisper root. No commit, push, PR,
  release, production download, Task 07 execution, or macOS support work is
  authorized by Task 06 execution.

## References

- Mandatory task-local specification sections: `../spec.md` Sections 7.3, 12.2,
  16, 17.2, 18, 19.1, and 21; requirements `SEC-007`, `RUN-004`, `PKG-001`,
  `AC-AUTO-032`, `AC-AUTO-040`, `AC-AUTO-041`.
- Mandatory decisions: `../decisions.yaml`
  `planning.native-cpp-toolchain`, `planning.native-cpp-ci-depth`, and
  `planning.native-cpp-task-order`, plus
  `planning.native-cpp-windows-gate` revision 2.
- Mandatory dependency packet: `04_managed_filesystem_safety.md`; current
  continuation state: `handoff.md` and `todo.md`.
- Current implementation surfaces:
  `runtime/local-whisper/fs-guard/main.cpp`,
  `runtime/local-whisper/fs-guard/windows_main.cpp`,
  `scripts/local-whisper/build-fs-guard.mjs`,
  `src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.ts`,
  `tests/main/localWhisper/filesystem/`, `package.json`, and
  `.github/workflows/pr-checks.yml`.

## Completion And Handoff

- Mark only Task 06 complete in `todo.md` after every available Linux automated
  check, dependency/license review, and checked-in dual-platform CI contract is
  recorded. Record the deferred Windows gate explicitly; it does not block
  Task 06 completion under `planning.native-cpp-windows-gate` revision 2 but
  remains a mandatory Task 19/release gate.
- Update `handoff.md` with final module map, public internal interfaces, toolchain
  versions, GoogleTest commit, changed files, native/Node checks, platform
  evidence, generated output paths, limitations, and rollback state.
- Name Task 07 as the exact next packet. Present Task 06 for review and stop.
  Do not commit or begin Task 07 in the same invocation.
