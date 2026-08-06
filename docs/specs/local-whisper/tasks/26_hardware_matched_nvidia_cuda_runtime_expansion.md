# Task 26: Hardware-Matched NVIDIA CUDA Runtime Expansion

## Outcome

Implement the approved revision-17 NVIDIA CUDA delivery contract after Task 24
has completed Windows CPU and RTX 50 `sm_120a` readiness. Deliver exactly one
independently authenticated CUDA 12.8.1 runtime pack for each supported
`(platform, compute target)` cell: Linux/Windows `sm_86-real`, `sm_89-real`,
and `sm_120a-real`. Add main-owned pre-install applicability, safe settings
migration, renderer-safe runtime filtering, deterministic pack/catalog tests,
and the explicit external physical-gate handoff.

This is implementation readiness, not qualification. It creates no candidate,
platform input/profile/graph/result/evidence index, Production claim, release
asset, signing key, upload, installer execution, or aggregate root.

## Prerequisites

- Specification revision 17 and plan revision 23 are Approved.
- Tasks 19, 20, 23, and 24 are complete, reviewed, and committed. Task 24's
  Windows CPU plus `sm_120a` delivery and bounded RTX 5090 smoke are reused;
  this packet does not repeat or reinterpret them as qualification evidence.
- No `candidateInputDigest`, platform branch, qualification result, evidence
  index, predecessor result, or aggregate root exists.
- Exact local, disconnected native inputs exist for the pinned CUDA 12.8.1,
  `whisper.cpp`, MSVC, and Linux toolchain profiles. A host NVIDIA driver is
  evaluated only as a runtime prerequisite, never as a selected toolkit.
- The available Windows RTX 5090 and Linux RTX 50 host may exercise only their
  matching `sm_120a` manual readiness paths. No RTX 30 or RTX 40 physical host
  is assigned to this packet or this computer.
- Task 26 has separate incremental-implementation authorization. Network,
  hardware, application, package, and any external-host actions remain manual
  gates.

## Owned Requirements

- `CAP-018`, `COMP-013`, `DIST-003`, `PRIV-006`, `QUAL-005`–`QUAL-006`,
  `RUNTIME-005`, `UI-010`, `VAL-004`, and `OPS-004`.
- Primary automated acceptance `AC-AUTO-078` through `AC-AUTO-082`.
- Deterministic implementation support for the future Linux `AC-MAN-017` and
  Windows `AC-MAN-018` matrices. It neither runs nor completes those physical
  qualification gates.
- No candidate freeze, platform qualification, aggregate verdict, production
  collection, signing, upload, publication, support promotion, tag, or release.

## In Scope

- Add separate pinned Linux and Windows CUDA 12.8.1 profiles and runtime-pack
  identities for `sm_86-real`, `sm_89-real`, and `sm_120a-real`. Preserve the
  completed Task 24 Windows `sm_120a` identity rather than replacing it.
- Build each target in independent clean network-denied roots twice. Require
  its declared real target only, no PTX fallback or other real target, a
  reviewed CUDA 12.8.1/MSVC-or-Linux dependency closure, exact manifest,
  provenance, SBOM, notices, signature input, and deterministic strict archive.
- Generalize the authenticated catalog/runtime producers by explicit platform,
  target, driver, capacity, and applicability-policy inputs. Never infer one
  from the host, package name, archive, renderer, or ambient toolchain.
- Add private main-owned NVIDIA inventory through the reviewed shell-free
  absolute-path adapter; stable opaque IDs only cross settings/preload. Map
  compute capability 8.6 to `sm_86-real`, 8.9 to `sm_89-real`, and the approved
  RTX 50 compute-capability-12.0 intersection to `sm_120a-real`.
- Extend settings keys and migration so existing valid CPU and `sm_120a`
  selections remain preserved. New keys initialize only when one suitable
  hardware-applicable recommended runtime exists; incompatible selections stay
  selected-but-unavailable until an explicit user change.
- Expose only the exact suitable CUDA runtime setup action. Reject zero,
  duplicate, cross-platform, cross-target, stale, unavailable, insufficient,
  unsigned, tampered, or driver-incompatible choices before transfer or process
  creation. Preserve explicit download and no CPU/backend/device/runtime/model
  fallback.
- Add deterministic tests and reusable/manual-gated workflows for inventory,
  catalog applicability, migration, pack contents, package boundaries, and
  six-cell qualification schema validation. CI may test deterministic work but
  must state that physical hardware gates are Pending.

## Out Of Scope

- Reimplementing Task 24 Windows helper, CPU, authenticated development
  activation, unpacked package, or RTX 5090 `sm_120a` smoke work.
- Running physical RTX 30 `sm_86` or RTX 40 `sm_89` checks on this computer;
  executing a qualified installer matrix; all-six-model qualification; or
  treating an RTX 50, mocked, emulated, cross-target, or CI result as a
  substitute.
- New CUDA versions, fat binaries, PTX/JIT fallback, CUDA 13 as a build
  toolkit, ambient CUDA/MSVC selection, Windows arm64, AMD promotion, macOS
  execution, another inference engine, or a parallel provider/transport.
- Candidate freeze, Task 25 Linux qualification, Task 21 Windows qualification,
  Task 22 aggregation, production assets/trust, external uploads, publication,
  commits, pushes, PRs, tags, or releases.

## Task Contract

### 1. Closed pack matrix

The closed CUDA matrix is below. Every row uses CUDA Toolkit `12.8.1`; Windows
uses MSVC `14.39`/`_MSC_VER 1939`, Windows SDK `10.0.26100.0`, CMake `3.31.8`,
and Ninja `1.12.1`. Every Windows row requires driver `>= 570.65`; every Linux
row requires driver `>= 570.26`.

| Platform | Compute target | Representative family | Runtime identity rule |
| --- | --- | --- | --- |
| `linux/x64` | `sm_86-real` | RTX 30 desktop/laptop | independent Linux pack only |
| `linux/x64` | `sm_89-real` | RTX 40 desktop/laptop | independent Linux pack only |
| `linux/x64` | `sm_120a-real` | RTX 50 desktop/laptop | independent Linux pack only |
| `win32/x64` | `sm_86-real` | RTX 30 desktop/laptop | independent Windows pack only |
| `win32/x64` | `sm_89-real` | RTX 40 desktop/laptop | independent Windows pack only |
| `win32/x64` | `sm_120a-real` | RTX 50 desktop/laptop | Task 24 identity, independently revalidated |

Each profile names exactly one `CMAKE_CUDA_ARCHITECTURES=<target>` value and
only `GGML_CUDA=ON`; all other accelerators, `GGML_NATIVE`, dynamic backend
loading, and network fetching remain disabled. Cross-target substitution,
mixed platform artifacts, unexpected imports, missing declared dependency, or
any PTX/other-real-target code fails closed.

### 2. Private applicability and migration

Only main owns physical-device discovery. Inventory is bounded, shell-free,
absolute-path controlled, versioned, and retained privately. It emits no raw
PCI address, UUID, serial, command output, driver string, topology, or hardware
identifier through renderer, settings, diagnostics, logs, errors, or argv.

The resolver authenticates `platform`, `architecture`, `computeTarget`, driver
floor, capacity floor when present, applicability-policy revision, archive and
signature identity, qualification state, and exact selected opaque device. It
returns exactly one suitable CUDA runtime or a safe unavailable state. It never
offers an inapplicable row, downloads automatically, hides a saved selection,
or chooses a replacement target.

The migration key is `(engine, target, backend, compute target)`. Preserve a
valid existing CPU or `sm_120a` selection under the expanded key. An
unprovable/incompatible saved selection remains selected-but-unavailable and
requires explicit user action; it is never rewritten to `sm_86`, `sm_89`,
`sm_120a`, CPU, another backend, runtime, device, or model.

### 3. Deterministic catalog, pack, and UI contracts

The catalog producer takes explicit rows for one requested platform and rejects
mixed platform/architecture/revision/backend/target inputs. A CUDA row contains
only its exact platform, target, dependency closure, model compatibility,
minimum driver, policy revision, expected-file manifest, provenance, notices,
SBOM, archive identity, signature, and qualification-pending state. Linux bytes
remain byte-identical for unchanged input.

Renderer receives only sanitized current-device applicability and setup actions;
it cannot select an arbitrary pack, path, URL, target, hardware record, or
trust purpose. Missing/incompatible data stays Not ready before download,
staging, worker launch, allocation, or fallback.

### 4. Physical-gate handoff

Deterministic build/catalog/filtering coverage is required for every matrix row.
Physical evidence remains non-substitutable:

- The available RTX 50 hosts may supply only the matching `sm_120a` readiness
  work already bounded by Task 24; it is not Task 21/25 qualification evidence.
- Linux and Windows `sm_86`/`sm_89` physical checks are **Pending — external
  representative hardware required**. Task 25 and Task 21 own their later
  qualified execution, not Task 26.
- One target, operating system, form factor, mock, compilation result, or CI
  result never passes another cell or produces a family-wide Production claim.

## Contracts And Boundaries

- Reuse the existing provider, artifact, capability, coordinator, worker,
  residency, IPC, settings, packaging, and development-activation graph. Do
  not create a parallel Local Whisper provider, worker protocol, or transport.
- Renderer uses only `window.electronAPI`; main retains filesystem, process,
  network, trust, inventory, and lifecycle authority. Trusted IPC sender
  validation and sanitized error contracts remain closed.
- Build and pack phases use only profile-admitted local roots and are network
  denied. A user-installed toolkit, PATH executable, package manager, CMake
  fetch, user profile, compiler cache, or another operating system cannot enter
  a build.
- Package base resources remain only the shared state and two native helpers;
  workers, CUDA DLLs, and models remain authenticated on-demand artifacts.
- No task output claims Qualification or Production; absent RTX 30/40 hardware
  is a Pending external gate, never a waiver or an invented failure.

## Expected Files Or Components

- The six CUDA toolchain profiles and their reviewed source/dependency/lock
  metadata under `runtime/local-whisper/toolchains/profiles/`, including new
  Linux/Windows `sm_86` and `sm_89` profiles and the existing Task 24 Windows
  `sm_120a` profile.
- Existing native build, pack, audit, catalog, provenance/SBOM/notice, and
  package-policy components under `scripts/local-whisper/` and
  `runtime/local-whisper/`, generalized through explicit platform/target data.
- The existing main-owned NVIDIA inventory, capability, settings migration,
  renderer projection, IPC types, and focused tests; no renderer hardware
  authority or raw identity exposure.
- `docs/specs/local-whisper/tasks/acceptance-owners.json`, its schema, the
  task-plan validator, implementation-readiness verifier, reusable workflows,
  `package.json` commands, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-078` proves private, bounded, fail-closed inventory on Linux and
  Windows for valid and malformed/stale/ambiguous device records.
- `AC-AUTO-079` proves exact-one authenticated runtime resolution across CPU,
  all six CUDA catalog cells, and every platform/target/driver/capacity/trust
  failure edge.
- `AC-AUTO-080` proves every per-platform CUDA target pack is deterministic,
  target-pure, closure-complete, and rejects substitution.
- `AC-AUTO-081` proves fresh/current/saved/multi-GPU migration and renderer
  filtering preserve explicit user selection with no fallback or auto-download.
- `AC-AUTO-082` proves every later platform qualification cell binds only its
  exact runtime and representative physical evidence.
- Task 24's CPU/RTX 5090 `sm_120a` delivery contract remains intact. RTX 30/40
  physical gates are recorded Pending for external representative hosts, and no
  candidate or Production evidence is created.

## Verification

Run focused checks after each related change:

```bash
rtk npm run test:local-whisper:hardware-matched-cuda
rtk npm run test:local-whisper:capability
rtk npm run test:local-whisper:catalog
rtk npm run test:local-whisper:packaging
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

Run the aggregate implementation verification only after the exact local
toolchains and all deterministic pack inputs are present:

```bash
rtk npm run verify:local-whisper:hardware-matched-cuda
rtk npm run verify:local-whisper:implementation-readiness
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run audit:local-whisper:whisper-cpp-pack
rtk npm run build:prod
rtk npm run dist:win -- --dir
rtk npm run verify:packaged
```

The registered Task 26 commands are exactly:

```bash
rtk npm run test:local-whisper:hardware-matched-cuda
rtk npm run verify:local-whisper:hardware-matched-cuda
```

Do not run Task 25 or Task 21 qualification commands, installer
install/uninstall, production collection, final-origin parity, or
`verify:local-whisper:all` in this packet.

## Failure And Rollback

- A hardware-matched delivery, migration, inventory, catalog, packaging, or
  deterministic-test defect remains Task 26 work. A changed support target,
  fallback rule, privacy boundary, trust purpose, or qualification threshold
  returns to specification/planning before implementation.
- Missing exact local toolchain/source input blocks the affected deterministic
  pack. Do not substitute a newer CUDA toolkit, CUDA 13, a different MSVC/SDK,
  an ambient executable, WSL, Wine, or cross-compilation.
- Failed/missing RTX 30/40 physical execution remains the explicit external
  Pending gate; it does not block deterministic implementation handoff and does
  not permit a fabricated result.
- Preserve user-owned installed artifacts. Clean only validated task-owned
  staging, app-data, and process roots; never broadly delete user profiles,
  model/runtime caches, build toolchains, or evidence.

## Manual Gates

- Exact trusted toolchain/source inputs and any permitted public runtime/model
  materialization. No credentials, cookies, mirrors, uploads, or moving inputs.
- RTX 50 `sm_120a` readiness may be exercised only under a separately authorized
  bounded task-owned flow. It is not qualification evidence.
- Linux/Windows RTX 30 `sm_86` and RTX 40 `sm_89` physical execution is
  **Pending — external representative hardware required**. It is not assigned
  to this computer or this packet.
- Commit, push, PR, signing, upload, publication, support promotion, tag, and
  release require separate authorization.

## References

- Specification revision 17 Sections 5–7, 8.2, 9.1, 11.2, 12, 17, 18.1–18.2,
  19.1–19.3, and 22; especially `CAP-018`, `COMP-013`, `DIST-003`,
  `RUNTIME-005`, `QUAL-005`–`QUAL-006`, and `AC-AUTO-078`–`AC-AUTO-082`.
- Task 24 Windows CPU/RTX 5090 `sm_120a` readiness handoff; Task 25 Linux and
  Task 21 Windows qualification packets as the later immutable evidence owners.
- Project main/preload/renderer, native C++20, packaging, privacy, and release
  conventions.

## Completion And Handoff

Mark Task 26 complete only after both registered commands and all required
deterministic pack/catalog/inventory/migration/package checks pass, every pack
is target-pure and authenticated, the Task 24 `sm_120a` contract remains intact,
and all RTX 30/40 physical gates are explicitly recorded Pending for external
representative hardware. No qualification, Production claim, candidate,
installer execution, upload, or release authority may exist.

Update `todo.md` and `handoff.md` with exact approved revision numbers, changed
files, sanitized profile identities, checks, safe failures, cleanup, the
external Pending gates, and the exact next packet. Stop before Task 25, Task 21,
Task 22, commit, push, PR, signing, upload, publication, tag, support promotion,
or release unless separately authorized.
