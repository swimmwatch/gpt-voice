# 08 Deterministic Native Source Objects And Toolchain Locks

## Outcome

GPT-Voice has one reproducible, reviewable native-source and build-input
foundation before any production C++ worker decoder or engine patch is built.
Exact Git objects are converted into canonical content-addressed source
objects, licenses and patch inputs are mandatory identities, and a reviewed
immutable loader-limit table exists before loader implementation. Linux CPU,
Clang sanitizer, and Blackwell CUDA build profiles are qualified with network
denied from the first configure. The Clang profile proves the exact sanitizer
toolchain with a dependency-free activation fixture; Task 09 later consumes a
reviewed offline GoogleTest source object for its real common-code suites.
Exactly pinned Windows profiles remain explicit non-production candidates for
representative qualification in Task 20.
GitHub-generated archive bytes, ambient tools, host-native architecture
detection, dynamic backend discovery, and implicit downloads are never
authority.

## Prerequisites

- `docs/specs/local-whisper/spec.md` is `Status: Approved`, revision 7.
- Tasks 03, 04, and 06 are complete.
- This replacement plan and Task 08 have separate explicit authorization.
- The existing dirty protocol/supervisor checkpoint is left untouched; this
  packet neither consumes nor rewrites it.
- Any networked source or toolchain acquisition is separately authorized under
  the Manual Gates below. A normal configure, compile, test, or verification
  command never receives network access.

## Owned Requirements

- Primary: `SEC-009`, `PKG-006`, `AC-AUTO-050`.
- Foundation slices: `SEC-003`, `SEC-013`, `PKG-002`, `PKG-003`,
  `PKG-004`, `PKG-010`, `OPS-001`, `COMP-009`.
- Explicit support for later `RUN-009`, `RUN-011`, `RUN-012`,
  `AC-AUTO-056`, `AC-AUTO-060`, `AC-AUTO-061`, and `AC-AUTO-062`
  verification. `AC-AUTO-061` remains supporting here; the later packaging
  packet owns its final closure/relocation acceptance result.

## In Scope

- A bounded Git-object importer, candidate-manifest review flow, canonical
  materializer, immutable local content store, and lock verifier.
- Exact source locks for pinned `whisper.cpp`, the approved nlohmann/json
  subset, and GoogleTest. GoogleTest is a test-only source dependency consumed
  explicitly by Task 09; it is not used to qualify the Task 08 sanitizer
  profile.
- A versioned loader-limit schema, immutable
  `whisper-cpp-loader-limits-v1` table, derivation verifier, and reviewed
  provenance record bound to the pinned v1.9.1 layouts and release-1 model
  families before Task 10 implements a loader.
- A versioned ordered patch-lock format used by Tasks 10 and 11.
- Exact Linux x64 CPU-baseline, Clang ASan/UBSan, and CUDA-Blackwell candidate
  toolchain/profile locks, followed by executable qualification when their
  authorized inputs are locally present.
- Non-executable Windows x64 CPU/CUDA candidate locks and CI definitions whose
  representative qualification belongs only to Task 20.
- Disconnected-first configure/build-graph audits, project-owned staging
  contracts, dynamic-dependency closure, relocation, malicious-CWD/environment,
  and clean-start fixtures.

## Out Of Scope

- The production control-frame decoder, model-authority handoff, worker
  lifecycle, `whisper.cpp` behavioral patches, inference, or model files.
- Alternate inference-engine source, Python inference runtime, model
  conversion, or packaged-runtime selection.
- Vulkan, HIP/ROCm, AMD pack construction, macOS, signing, catalog publication,
  installer changes, or support-tier promotion.
- Any representative Windows build or execution. Task 20 is the only owner of
  that evidence.

## Task Contract

### Canonical upstream identities

The checked-in source locks SHALL use these complete canonical identifiers:

| Lock ID                        | Repository                                    | Commit                                     | Git tree                                   | Materialized scope          |
| ------------------------------ | --------------------------------------------- | ------------------------------------------ | ------------------------------------------ | --------------------------- |
| `whisper-cpp-v1.9.1-f049fff`   | `https://github.com/ggml-org/whisper.cpp.git` | `f049fff95a089aa9969deb009cdd4892b3e74916` | `f49541eaed447bce9b5e3598cc7a487ce5e54678` | Complete tree               |
| `nlohmann-json-v3.12.0-subset` | `https://github.com/nlohmann/json.git`        | `55f93686c01528224f448c19128836e7df245f72` | `1eb780542e829bf1615828ed0d5f407497bbce7b` | Exact two-file subset below |
| `googletest-v1.17.0-52eb810`   | `https://github.com/google/googletest.git`    | `52eb8108c5bdec04579160ae17225d66034bd723` | `ad23b2ceac4a6eef2278c48545b62ffc1f0c134a` | Complete tree               |

The `whisper.cpp` lock SHALL reproduce exactly 1,882 paths, 36,382,209
expanded regular-file bytes, 39 executable-mode files, no symlinks, no
gitlinks, and no Git LFS pointers. Forced staging of every tracked path,
including upstream-ignored paths, with Git filters and line-ending conversion
disabled SHALL reproduce tree
`f49541eaed447bce9b5e3598cc7a487ce5e54678`. Its `LICENSE` is mandatory and
is additionally bound to Git blob `e7dca554bcb802f98408383a864404e3aa4eacca`.

The nlohmann subset SHALL contain only:

| Path                               | Git blob                                   |   Bytes | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------ | ------: | ------------------------------------------------------------------ |
| `single_include/nlohmann/json.hpp` | `82d69f7c5d044c9887c96b90c97f5639083ecd14` | 953,436 | `aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63` |
| `LICENSE.MIT`                      | `a1dacc8dbbd907c4b622ff1f08e279c27465dcbc` |   1,076 | `46a65cffd1ea955132d95a8dd921640714a8d6b537d2e4e482d31145ae95b603` |

The subset lock SHALL record the excluded full-tree provenance and SHALL never
be accepted as the complete nlohmann tree.

The GoogleTest lock SHALL reproduce the complete pinned v1.17.0 tree: 250
regular paths, 4,095,045 expanded regular-file bytes, 24 executable-mode
files, no symlinks, no gitlinks, and no Git LFS pointers. Its BSD-3-Clause
`LICENSE` is mandatory and additionally bound to Git blob
`1941a11f8ce94389160b458927a29ba217542818`, 1,475 bytes, and SHA-256
`9702de7e4117a8e2b20dafab11ffda58c198aede066406496bef670d40a22138`.
Task 09 SHALL supply this verified local source root directly to CMake through
a required project-owned path and `add_subdirectory`; no Git URL,
`FetchContent`, `find_package`, package registry, or ambient system GoogleTest
may remain in the configure graph.

### Source-object lock and import protocol

Each source-object lock SHALL contain all of these fields; none is optional:

- schema ID `local-whisper-native-source-lock-v1` and lock ID from the table;
- allowlisted repository, exact commit, exact root Git tree, reviewed signature
  result, signer-key fingerprint when available, and the exact import command
  implementation digest;
- materialization kind (`completeTree` or `explicitSubset`), normalized root
  prefix, canonical bytewise-sorted manifest, manifest SHA-256, path count,
  expanded regular-byte count/ceiling, allowed entry types, and executable-mode
  count;
- for each entry: normalized relative UTF-8 path, entry type, mode, Git object
  ID, regular-file SHA-256 and size, or an explicitly allowed safe relative
  symlink target;
- transport-object schema, byte size, and SHA-256 when a canonical transport
  object is emitted; its identity is subordinate to commit/tree/manifest;
- license path, Git blob, byte size, SHA-256, provenance, and SBOM component;
- recursive gitlink/submodule/LFS identities or an explicit proven-empty set;
- importer image, Git, archive/materializer, hashing, filesystem, and host-tool
  versions; and the immutable local content-addressed destination identity.

The networked importer SHALL fetch only one allowlisted exact commit into a
fresh private temporary repository with system/global Git configuration,
credential helpers, smudge/clean filters, hooks, alternates, automatic line
ending conversion, and submodule recursion disabled. It SHALL verify the
commit/tree and every reachable object before emitting an untrusted candidate
manifest. The verifier, not the importer, authorizes a previously reviewed
checked-in lock; import output SHALL never rewrite a lock automatically.

Materialization SHALL reject branches/tags as authority, missing objects,
unpinned gitlinks or LFS, absolute/drive/UNC/traversal paths, duplicate or
case-fold-colliding names, NUL/control characters, special files, hard links,
escaping links, unexpected modes, overwrites, and path-count/expanded-size
overflow. Promotion to the local content store is atomic and occurs only after
the reviewed lock matches. Two clean imports SHALL reproduce the same manifest
and content-addressed identity. Generated GitHub zip/tar bytes may be tested as
untrusted transport but SHALL never authorize or change a lock.

### Reviewed loader-limit authority

Create schema `local-whisper-loader-limit-table-schema-v1` and one immutable
table with ID `whisper-cpp-loader-limits-v1`. The table SHALL bind source lock
`whisper-cpp-v1.9.1-f049fff`, its original manifest digest and Git tree, every
reviewed loader-layout source path and blob/SHA-256 identity, the derivation
tool digest, the exact curated family set (`tiny`, `base`, `small`, `medium`,
`large-v3`, and `large-v3-turbo`), the reviewed catalog variants/tensor types,
and a canonical table SHA-256. It is a parser safety ceiling, not a RAM/VRAM
fit estimate or authorization for an arbitrary third-party model.

The authoritative numeric table is:

| Field/resource                 | Accepted range or ceiling                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Authenticated model object     | `1..17,179,869,184` bytes (16 GiB), with exact catalog size lower bound/ceiling               |
| Vocabulary count / `n_vocab`   | `1..131,072`; serialized vocabulary count must agree with validated header semantics          |
| Audio context/state/head/layer | context `1..4,096`; state `1..4,096`; heads `1..64`; layers `1..128`                          |
| Text context/state/head/layer  | context `1..2,048`; state `1..4,096`; heads `1..64`; layers `1..128`                          |
| Mel/filter dimensions          | each `1..4,096`; product at most `1,048,576` float elements; at most `4,194,304` filter bytes |
| Vocabulary token bytes         | each `0..4,096`; aggregate token bytes at most `67,108,864` (64 MiB)                          |
| Tensor rank/count              | rank `1..4`; at most `16,384` tensors                                                         |
| Tensor name                    | `1..256` UTF-8 bytes; duplicate decoded names are invalid                                     |
| Tensor dimension               | each `1..1,048,576`; checked element product at most `2,147,483,648`                          |
| One tensor payload             | at most `8,589,934,592` bytes (8 GiB) and never beyond remaining authenticated bytes          |
| Aggregate tensor payload       | at most authenticated object size and at most 16 GiB                                          |
| Aggregate parsed metadata      | at most `134,217,728` bytes (128 MiB), including dimensions, names, token tables, and maps    |
| Alignment padding              | `0..31` bytes at each pinned-format alignment boundary, all bytes within authenticated size   |

The checked-in provenance/review record SHALL identify the pinned layout
symbols and cross-field invariants inspected, the curated model manifests used
to prove legitimate maxima remain accepted, the derivation inputs and output
digest, reviewer disposition, and unresolved exclusions. The verifier SHALL
rederive the candidate from only those pinned inputs and reject any schema,
source/layout identity, family/variant allowlist, numeric value, canonical
digest, provenance, or review-status mutation. Derivation output never rewrites
the authoritative table. Changing any ceiling, family, layout, or tensor-type
allowlist requires a new table ID and an explicitly reviewed planning change;
Tasks 10 and 11 may only consume this verified table.

### Ordered patch-lock contract

Create schema `local-whisper-native-patch-lock-v1`. A lock SHALL bind source
lock ID and original manifest digest, ordered patch IDs, each patch byte size
and SHA-256, allowed touched paths, exact strip level and application command,
expected reject count zero, and final canonical patched-tree manifest digest.
It SHALL preserve original and patched identities in provenance and SBOM.
Task 08 verifies the mechanism with synthetic repositories only. Tasks 10 and
11 add reviewed `whisper.cpp` patches and may build only after their complete
patch lock matches. No fuzzy, three-way, offset-changing, networked, or
working-tree-dependent application is allowed.

### Toolchain and profile locks

Use schema `local-whisper-native-toolchain-lock-v1`. Every executable profile
SHALL pin target OS/architecture, compiler executable and complete version,
C/C++ runtime, CMake, Ninja/generator, SDK/toolkit, linker, architecture code
targets, environment allowlist, profile-applicable source/patch lock IDs or an
immutable project qualification-fixture identity, complete CMake cache,
expected build graph, output files, dynamic dependencies, license identities,
SBOM components, and a `qualificationState` enum of `candidate-unqualified`,
`pendingWindowsFinalTask`, or `qualified` with its evidence digest. No value
may be inherited from an ambient registry, package cache, `PATH`,
`LD_LIBRARY_PATH`, `DYLD_*`, `CUDA_PATH`,
`GGML_BACKEND_PATH`, Python environment, user profile, or current directory.

The initial candidate matrix is:

| Profile ID                                           | Candidate inputs                                                                                                                                                                                                                     | Qualification state in this packet                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linux-x64-cpu-baseline-v1`                          | Ubuntu 24.04 x64 build ABI; GCC 13.3.0; CMake 3.31.8; Ninja 1.12.1; x86-64 ABI/SSE2 baseline; OpenMP off                                                                                                                             | Must pass the executable disconnected smoke before Task 10                                                                                              |
| `linux-x64-clang-18.1.3-asan-ubsan-v1`               | Ubuntu 24.04 x64 build ABI; Clang/clang++ 18.1.3; LLVM lld, ASan, and UBSan runtimes 18.1.3; GNU libstdc++/libgcc 13.3.0; CMake 3.31.8; Ninja 1.12.1                                                                                 | Must pass the dependency-free clean/ASan/UBSan activation fixture before Task 09                                                                        |
| `linux-x64-cuda-12.8.1-sm120a-v1`                    | Ubuntu 24.04 x64 build ABI; GCC 13.3.0; CUDA Toolkit 12.8.1; CMake 3.31.8; Ninja 1.12.1; requested and effective `CMAKE_CUDA_ARCHITECTURES=120a-real`; shared CUDA runtime closure                                                   | Must pass the executable disconnected smoke before Task 11                                                                                              |
| `windows-x64-cpu-candidate-task19-v1`                | Windows x64; MSVC v143 compiler and CRT toolset 14.39 with `_MSC_VER=1939`; Windows SDK `10.0.26100.0`; CMake 3.31.8; Ninja 1.12.1                                                                                                   | Exact lock inputs; `qualificationState=pendingWindowsFinalTask`; schema/source/CI contract only and never executable or catalog-eligible before Task 20 |
| `windows-x64-cuda-12.8.1-sm120a-candidate-task19-v1` | Windows x64; MSVC v143 compiler and CRT toolset 14.39 with `_MSC_VER=1939`; Windows SDK `10.0.26100.0`; CMake 3.31.8; Ninja 1.12.1; CUDA Toolkit/shared runtime 12.8.1; requested and effective `CMAKE_CUDA_ARCHITECTURES=120a-real` | Exact lock inputs; `qualificationState=pendingWindowsFinalTask`; schema/source/CI contract only and never executable or catalog-eligible before Task 20 |

An executable Linux lock SHALL record the actual compiler/tool hashes; the
CUDA lock additionally records the reviewed minimum NVIDIA driver/runtime
prerequisite from the pinned CUDA compatibility source. If an authorized
candidate input is unavailable, its profile remains `candidate-unqualified`
and its dependent packet cannot start; it SHALL NOT be resolved with an
ambient substitute. Windows candidate locks
SHALL contain the exact versions above and state
`qualificationState=pendingWindowsFinalTask`; they are intentionally
incomplete execution evidence and do not block Linux source-foundation
completion. Task 20 validates these versions and may qualify the profile; it
does not select or silently replace them. The representative host's installed
NVIDIA driver is qualification evidence, not an unpinned build input.

The Clang profile SHALL hash and qualify Clang, clang++, lld, ASan, UBSan,
libstdc++, and libgcc as one executable set. Its disconnected qualification
SHALL compile one dependency-free C++20 sanitizer fixture with warnings as
errors and produce three explicit targets: a clean control, an intentional
ASan heap-use-after-free trigger, and an intentional UBSan signed-overflow
trigger. The clean control must exit zero without sanitizer diagnostics; each
trigger must exit nonzero with the expected sanitizer family and defect marker.
The audit SHALL reject a missing, skipped, incompatible, non-executed, or
unexpectedly successful trigger. These fixtures prove toolchain activation
only and contain no worker protocol, model authority, inference, or GoogleTest
code. Task 09 owns the real common protocol/authority GoogleTest suites and
runs them under this exact qualified profile.

The Clang profile SHALL not list nlohmann, GoogleTest, or another upstream
source lock as a qualification input. Its `sourceLockIds` and `patchLockIds`
are empty and it instead binds one immutable project fixture ID and canonical
manifest digest. The toolchain schema SHALL require source locks for the CPU
and CUDA Whisper.cpp profiles and the exact fixture identity for this Clang
profile. Its `expectedBuildGraph` is exactly the clean, ASan-trigger, and
UBSan-trigger targets above; naming future Task-09 common suites here is
invalid.

### Explicit disconnected build policy

Every `whisper.cpp` profile SHALL set and audit at least:

- `WHISPER_CURL=OFF`, `WHISPER_BUILD_EXAMPLES=OFF`,
  `WHISPER_BUILD_TESTS=OFF`, `GGML_BUILD_EXAMPLES=OFF`,
  `GGML_BUILD_TESTS=OFF`, `GGML_NATIVE=OFF`, `GGML_BACKEND_DL=OFF`,
  `GGML_CPU_KLEIDIAI=OFF`, `GGML_CUDA_CUB_3DOT2=OFF`,
  `GGML_CUDA_NCCL=OFF`, `GGML_OPENMP=OFF`, `GGML_RPC=OFF`, and
  `FETCHCONTENT_FULLY_DISCONNECTED=ON`;
- an explicit `BUILD_SHARED_LIBS`, `GGML_STATIC`, compiler-runtime, and linker
  decision recorded by the profile;
- CPU profile: every optional accelerator and external BLAS/backend OFF, every
  optional x86 ISA above the x64 SSE2 ABI baseline OFF;
- CUDA profile: `GGML_CUDA=ON`, requested/effective
  `CMAKE_CUDA_ARCHITECTURES=120a-real`, and every non-CUDA accelerator/backend
  OFF; `CMAKE_CUDA_RUNTIME_LIBRARY=Shared` unless a later license-reviewed lock
  explicitly replaces it.

The cache audit SHALL use a deny-by-default backend option inventory: any
new/unknown enabled `GGML_*` backend or host-native value fails. From the first
configure, the network-deny harness SHALL fail any Git, URL, `FetchContent`,
`ExternalProject`, package-manager, model-hub, or download attempt. Production
workers SHALL have `GGML_BACKEND_DL=OFF`; build and relocation tests SHALL prove
that the CWD and `GGML_BACKEND_PATH` cannot add a backend. Project-owned
staging, not upstream `cmake --install`, owns Windows `RUNTIME` artifacts.

### Truthful qualification and relocation evidence

Create a strict versioned qualification-evidence schema; profile qualification
SHALL never accept booleans without the executed evidence they summarize. A
qualified Linux profile SHALL have non-null hashes for every compiler, linker,
build tool, inspected runtime, license, and qualification output. Evidence
SHALL bind the candidate profile digest, source/fixture identities, configured
and effective cache digests, generated graph digest, executed target names,
exit statuses, sanitizer markers where applicable, staged file identities,
observed dependency closure, relocation root identity, clean-start result, and
the exact sanitized environment/CWD policy. Any missing, duplicate, skipped,
or mismatched record fails qualification.

Linux closure inspection SHALL use exact hashed profile tools such as
`readelf`, never execute `ldd` against untrusted output, and resolve every
`DT_NEEDED` entry through an explicit allowlist of staged or reviewed system
runtime identities. Unknown, duplicate, ambient, unresolved, or
working-directory dependencies fail. A project-owned synthetic shared-library
fixture SHALL prove that removing a required staged library fails, adding a
same-name malicious CWD library cannot satisfy resolution, and changing
`LD_LIBRARY_PATH` or `GGML_BACKEND_PATH` cannot alter the accepted closure.

Relocation SHALL copy only manifest-declared outputs/licenses/runtime files
into a fresh owned root, preserve their identities and executable modes, and
run the relocated clean smoke with network denied, an empty inherited
environment plus the profile allowlist, no loader/backend path variables, and
a malicious unrelated CWD. The executable must resolve only manifest-owned or
reviewed system libraries and exit zero with its fixed public marker. The CPU
and CUDA build smokes perform no model loading or inference; Tasks 10 and 11
own worker/pack closure and real engine behavior. Windows defines the same
evidence shape as contract-only candidate data, while Task 20 owns its
representative execution.

## Contracts And Boundaries

- Task 08 owns source, loader-limit-table, patch-lock, toolchain-lock,
  disconnected-build, and staging schemas. It does not implement protocol,
  loader, or engine behavior.
- The local content store is private build input, not a managed user model
  store, app installer payload, published artifact, or renderer-visible path.
- The GitHub connector is required for commit-pinned source review; an
  explicitly authorized Git import is the only networked acquisition path.
- Task 09 consumes the verified nlohmann subset, GoogleTest tree, and qualified
  GCC/Clang profiles. Tasks 10 and 11 consume the verified `whisper.cpp` tree
  and immutable loader-limit table, then complete the patch lock without
  changing that table.
- Task 13 removes the obsolete alternate-engine source definitions and locks
  from the active tree while Git history preserves their prior evidence.
- Task 20 alone may change a Windows lock's `qualificationState` from
  `pendingWindowsFinalTask` to `qualified` after representative execution;
  Linux evidence cannot do so or select substitute versions.

## Expected Files Or Components

- `runtime/local-whisper/sources/schema/native-source-lock.schema.json`
- `runtime/local-whisper/sources/schema/native-patch-lock.schema.json`
- `runtime/local-whisper/sources/schema/loader-limit-table.schema.json`
- `runtime/local-whisper/sources/limits/whisper-cpp-loader-limits-v1.json` and
  its pinned-layout derivation/review provenance record.
- `runtime/local-whisper/toolchains/schema/native-toolchain-lock.schema.json`
- `runtime/local-whisper/sources/locks/` with the three active source locks and license
  identities.
- `runtime/local-whisper/toolchains/profiles/` with the three Linux locks and two
  explicit Windows Task-20 candidates.
- `runtime/local-whisper/toolchains/schema/native-toolchain-evidence.schema.json`
  plus qualification records only after the exact executable gates pass.
- `runtime/local-whisper/toolchains/fixtures/sanitizer-proof/` with the
  dependency-free clean, ASan-trigger, and UBSan-trigger C++20 targets and no
  production protocol/model-authority code.
- Synthetic staged-library/relocation fixtures that prove closure inspection,
  missing-dependency rejection, malicious-CWD/environment resistance, and
  network-denied clean startup without a model or engine behavior.
- `scripts/local-whisper/source-import/` importer, candidate generator,
  materializer, and verifier.
- `scripts/local-whisper/native-build/` disconnected configure, cache/graph
  audit, staging, dependency-closure, relocation, and clean-start tools.
- `scripts/local-whisper/native-build/derive-whisper-cpp-loader-limits.mjs`
  and `verify-whisper-cpp-loader-limits.mjs` with mutation fixtures.
- Synthetic adversarial Git repositories and tests under
  `tests/runtime/localWhisper/nativeSources/`.
- Package scripts named exactly as used by Verification below.
- A concise `runtime/local-whisper/sources/README.md` for humans and LLM agents.

## Acceptance Criteria

- Every canonical source ID, tree, manifest, license, count, mode, and hash
  mutation fails before configure.
- Two authorized clean imports reproduce byte-identical canonical manifests
  and content-store identities without trusting generated archive bytes.
- The nlohmann subset and complete GoogleTest source object are locally
  available and verified before Task 09 starts; Task 09 CMake has no
  network/system-package fallback for either input.
- The loader-limit verifier reproduces the reviewed
  `whisper-cpp-loader-limits-v1` digest from the pinned v1.9.1 layouts and
  curated family manifests; any limit, layout, family, tensor-type,
  provenance, or review-state mutation fails before Task 10 starts.
- Linux CPU, Clang sanitizer, and CUDA profiles have complete explicit caches;
  the Clang clean/ASan/UBSan fixtures prove both sanitizer runtimes execute and
  fail closed on skipped or unexpectedly successful triggers, while `native`,
  an unknown enabled backend, `GGML_BACKEND_DL`, CCCL/KleidiAI/NCCL fetching,
  and every network attempt fail.
- The CUDA lock records both requested and effective `120a-real`; bare `120`,
  `native`, `120-virtual`, or a silently rewritten cache is rejected.
- Malicious CWD/backend environment inputs cannot alter the backend set or
  dynamic dependency closure.
- Windows profiles remain visibly `candidate-task19` and no Windows execution,
  production pack, or support evidence is claimed.

## Verification

Task 08 SHALL add the named package scripts before running these exact commands:

```text
rtk npm run test:local-whisper:native-sources
rtk npm run test:local-whisper:native-build-audits
rtk npm run verify:local-whisper:native-source -- --lock=whisper-cpp-v1.9.1-f049fff
rtk npm run verify:local-whisper:native-source -- --lock=nlohmann-json-v3.12.0-subset
rtk npm run verify:local-whisper:native-source -- --lock=googletest-v1.17.0-52eb810
rtk npm run verify:local-whisper:loader-limits -- --table=whisper-cpp-loader-limits-v1
rtk npm run test:local-whisper:native-sanitizer-proof -- --profile=linux-x64-clang-18.1.3-asan-ubsan-v1
rtk npm run verify:local-whisper:native-toolchain -- --profile=linux-x64-cpu-baseline-v1
rtk npm run verify:local-whisper:native-toolchain -- --profile=linux-x64-clang-18.1.3-asan-ubsan-v1
rtk npm run verify:local-whisper:native-toolchain -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
rtk npm run audit:local-whisper:disconnected-build -- --profile=linux-x64-cpu-baseline-v1
rtk npm run audit:local-whisper:disconnected-build -- --profile=linux-x64-clang-18.1.3-asan-ubsan-v1
rtk npm run audit:local-whisper:disconnected-build -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
rtk npm run verify:local-whisper:native-toolchain -- --profile=windows-x64-cpu-candidate-task19-v1 --contract-only
rtk npm run verify:local-whisper:native-toolchain -- --profile=windows-x64-cuda-12.8.1-sm120a-candidate-task19-v1 --contract-only
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check -- runtime/local-whisper/sources runtime/local-whisper/toolchains scripts/local-whisper tests/runtime/localWhisper package.json
```

Network denial is mandatory for all three `audit:local-whisper:disconnected-build`
commands. A skipped executable Linux qualification is a blocker, not a pass.
The two Windows commands validate schemas/contracts only and SHALL NOT invoke a
Windows compiler, VM, remote runner, or representative host.

## Failure And Rollback

- Never refresh a lock from observed archive bytes, accept a partial import,
  weaken a source manifest, or use an ambient tool to obtain a passing result.
- If a Linux candidate input is unavailable, retain the reviewed source locks
  and mark only that profile `candidate-unqualified`; do not start its dependent
  packet.
- Rollback removes only task-owned temporary import/build roots after exact
  ownership validation. Verified immutable source objects and reviewed lock
  evidence are preserved unless their exact removal is separately authorized.
- No rollback command may recursively target the repository root, home
  directory, shared cache root, or a path derived from an unresolved variable.

## Manual Gates

- `MANUAL GATE — networked Git import`: authorize each exact repository,
  commit, private temporary root, and content-store destination before import.
- `MANUAL GATE — toolchain acquisition`: authorize exact CMake/Ninja/CUDA or
  other compiler/runtime downloads and accept their licenses before use.
- `MANUAL GATE — source-lock review`: a human reviews candidate manifests,
  licenses, signature evidence, and checked-in locks before they become build
  authority.
- `MANUAL GATE — loader-limit review`: a human reviews the pinned v1.9.1
  layout derivation, curated-family coverage, numeric table, exclusions, and
  provenance record before `whisper-cpp-loader-limits-v1` becomes Task-10
  authority.
- No commit, push, publication, signing, upload, installer, or release action
  is authorized.
- Representative Windows execution is prohibited until Task 20.

## References

- `../spec.md`: Sections 7.3, 18.1, and acceptance rows `AC-AUTO-050`,
  `AC-AUTO-060`, and `AC-AUTO-061`.
- `../decisions.yaml`: commit-pinned source, nlohmann SAX, CUDA/CMake/MSVC,
  backend-discovery, GitHub-archive findings, and
  `planning.task-08-sanitizer-googletest-repair`.
- GitHub generated-archive stability documentation:
  `https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives#stability-of-source-code-archives`.
- `.agents/references/task-packets.md` and the native/runtime section of
  `docs/agent-guides/project-conventions.md`.

## Completion And Handoff

After every mandatory Linux check passes, update `todo.md` and `handoff.md`
with exact source/manifest/license/toolchain identities, the reviewed
loader-limit-table identity, authorized manual inputs, verification results,
and Windows Task-20 gates. Name Task 09 as next. Stop before Task 09,
production code, commit, push, packaging, publication, or release.
