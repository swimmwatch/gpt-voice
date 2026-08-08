# Task 24: Windows Runtime Delivery Readiness

## Outcome

Make the existing Local Whisper Windows x64 CPU and RTX 50 `sm_120a` NVIDIA CUDA product paths
actually buildable, installable, and testable after Task 20 Linux preparation
but before any qualification candidate is frozen. Produce deterministic Windows native helpers and
on-demand CPU/CUDA runtime packs, generalize the authenticated development
activation and catalog/runtime tooling to Windows without changing the Linux
contract, validate unpacked Windows packaging, and pass a bounded ordinary-app
CPU/CUDA smoke on an authorized Windows host.

Task 24 proves implementation and delivery readiness only. It creates no
`candidateInputDigest`, platform profile/result/evidence branch, Production
claim, protected production catalog, uploaded runtime asset, installer release,
or qualification result. Task 21 remains the immutable representative-Windows
qualification packet.

## Prerequisites

- Specification revision 17 is Approved and plan revision 23 is Approved.
- Tasks 01–19 and 23, including their follow-up fixes and `AC-MAN-015`–
  `AC-MAN-016`, are complete and committed.
- Task 20 Linux preflight is complete and committed but created no candidate,
  Linux/Windows branch, profile, graph, result, evidence index, predecessor
  result, or aggregate root. Tasks 26, 25, 21, and 22 have not started.
- The Task 17 public fixture digest remains
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- An authorized Windows x64 host can provide the pinned MSVC v143 `14.39`,
  `_MSC_VER 1939`, Windows SDK `10.0.26100.0`, CMake `3.31.8`, Ninja `1.12.1`,
  and CUDA `12.8.1` inputs. CUDA smoke additionally requires a physical NVIDIA
  device compatible with the frozen `120a-real` target and driver `>= 570.65`.
- The Windows runtime input is the separately pinned Microsoft Visual C++ v14
  x64 Redistributable `14.51.36247.0`, byte length `18,731,856`, SHA-256
  `843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c`,
  downloaded only from the versioned Microsoft URL
  `https://aka.ms/vs/18/release/14.51.36247/VC_redist.x64.exe` and accepted only
  with a valid Authenticode chain whose publisher subject is Microsoft
  Corporation. The moving `https://aka.ms/vc14/vc_redist.x64.exe` alias is
  discovery evidence only and is never a build input.
- Task 24 has separate implementation and Windows-host execution authorization.
  Network, app launch, packaging, and hardware checks remain manual gates below.

## Owned Requirements

- Windows implementation-readiness slices of `IMPL-001`, `IMPL-002`,
  `COMP-004`, `COMP-008`, `COMP-012`, `CPU-001`, `DIST-001`, `DIST-002`,
  `PKG-002`–`PKG-005`, `PKG-009`–`PKG-011`, `SEC-008`, `SEC-011`,
  `SEC-014`, `SEC-015`, `DEV-001`, `MODEL-011`, `QUAL-004`, and `OPS-003`.
- Supporting Windows-host evidence for `AC-AUTO-005`, `AC-AUTO-010`,
  `AC-AUTO-013`, `AC-AUTO-014`, `AC-AUTO-016`–`AC-AUTO-022`,
  `AC-AUTO-024`–`AC-AUTO-025`, `AC-AUTO-030`–`AC-AUTO-031`,
  `AC-AUTO-033`–`AC-AUTO-039`, `AC-AUTO-041`–`AC-AUTO-044`,
  `AC-AUTO-047`–`AC-AUTO-054`, `AC-AUTO-056`–`AC-AUTO-070`, and
  `AC-AUTO-072`–`AC-AUTO-077`. Existing primary automated owners remain
  unchanged.
- One bounded readiness smoke derived from the Windows portions of
  `AC-MAN-002`, `AC-MAN-003`, `AC-MAN-004`, `AC-MAN-006`, and `AC-MAN-008`.
  This smoke is not the all-six-model, performance, repetition, failure, or
  evidence-freeze qualification owned by Task 21.
- No Linux/Windows qualification or aggregate acceptance ownership.

## In Scope

- Replace Linux-only assumptions in runtime-pack, qualification-catalog, and
  authenticated development-input tooling with closed platform-aware CPU/CUDA
  contracts for `linux/x64` and `win32/x64`.
- Build deterministic Windows CPU and CUDA workers/runtime packs from the
  existing pinned source and Windows toolchain profiles, including exact
  expected-file manifests, dependency closure, SBOM, notices, provenance, and
  `restricted-tar-gzip-v1` archives.
- Build and authenticate `fs-guard.exe` and `local-whisper-launcher.exe`, stage
  only those two native helpers in the base application resources, and keep
  inference workers/CUDA libraries/models on demand.
- Extend the existing qualification-purpose non-packaged development activation
  to Windows. Reuse `ProductionLocalWhisperEnvironmentFactory`, managed
  artifacts, capability probes, worker supervisor, IPC, settings, provider
  dispatch, residency, unload, and cleanup; do not create another provider path.
- Make fixture/disabled/qualification/production package modes and the reusable
  Windows workflow validate Windows artifacts without weakening trust-purpose
  isolation or enabling production collection.
- Add deterministic Windows unit/integration/package coverage plus a bounded
  ordinary-app `base/full` CPU and RTX 5090 `sm_120a` setup/load/transcribe/
  unload/restart smoke with safe sanitized evidence.
- Update Windows setup/troubleshooting documentation and the plan validator,
  acceptance registry, checklist, and handoff for plan revision 23, including
  Task 26's deferred RTX 30/40 expansion contract, 26-packet validation, and
  all 81 primary automated acceptance owners. This is structural plan support;
  Task 24 does not implement Task 26 behavior.

## Out Of Scope

- Freezing Task 25's shared candidate or any Linux/Windows platform input,
  profile, graph, measurement series, result, evidence index, predecessor
  result, or aggregate root.
- Running the all-six-model Windows accuracy, RTF, RAM/VRAM, repetition,
  cancellation, crash, suspend/resume, installer upgrade/uninstall,
  predecessor, and evidence-sealing matrix. Task 21 owns those gates.
- Changing support tiers or promoting Windows CPU/CUDA to an unconditional
  Production claim. Both remain conditional until Tasks 20, 24, 25, 21, and 22
  complete.
- AMD or Intel GPU enablement, Windows arm64, `sm_86`/`sm_89` runtime delivery
  or physical testing, macOS execution, CPU fallback from a failed GPU
  selection, or a second engine. Task 26 owns the hardware-matched RTX 30/40
  expansion; its physical gates require external representative hardware.
- Production private keys, signing, legal approval, GitHub Release runtime
  upload, final origin parity, production catalog collection, push, PR, tag,
  publication, support promotion, or release.
- Adding dependencies, accepting ambient toolchains, republishing model bytes,
  storing private audio/transcripts, or weakening filesystem/process/IPC trust.

## Task Contract

### 1. Closed Windows platform identities

Support exactly `win32/x64` with the existing engine and runtime identities for
CPU and the RTX 50 `sm_120a` path only:

| Target       | Backend | Toolchain profile                                      | Required runtime closure                                                                                                                                                 |
| ------------ | ------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CPU          | `cpu`   | `windows-x64-cpu-msvc-19.39-v1`                        | Windows worker plus the exact import-derived Microsoft VC Runtime 14.51.36247.0 x64 app-local DLL closure; no CUDA library or GPU initialization                          |
| GPU / RTX 50 | `cuda`  | `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1`         | Windows worker, the same exact VC Runtime closure, `cudart64_12.dll`, `cublas64_12.dll`, and `cublasLt64_12.dll`                                                          |

Build-tool and deployment-runtime identities are independent and fail closed.
The existing profile IDs continue to name the compiler/toolset and therefore
remain unchanged. Their ABI strings, runtime component IDs, paths, SBOM entries,
licenses, and dependency closure must distinguish MSVC v143 `14.39` from VC
Runtime `14.51.36247.0`; no identifier may continue to imply `crt-14.39`.
`cl.exe`, `link.exe`, `lib.exe`, `_MSC_VER`, the Windows SDK, CMake, Ninja, and
CUDA versions remain exactly pinned and may not be replaced by Visual Studio
2026 build tools or another compiler minor.

The signed Redistributable installer is a verified acquisition object, never a
runtime-pack member and never executed by the application. A task-owned
materialization step may run only under the manual gate below. It must verify
the installer size, SHA-256, file/product version, x64 architecture, and valid
Microsoft Authenticode publisher before any install effect. The trusted
installer may then install exactly that development prerequisite under UAC. A
repository-owned materializer must verify the registered x64 runtime version is
exactly `14.51.36247.0`, read only a closed named allowlist of Microsoft-signed
runtime DLLs from the absolute native Windows system directory, reject a
pre-existing different runtime version, and copy the permitted files into a
fresh isolated toolchain root. From that point onward System32 is not a build or
pack input. The materializer records every copied DLL's SHA-256 and file version;
the final worker/helper PE import graphs select the exact staged subset and
reject missing, additional, wrong-version, wrong-architecture, unsigned, or
ambient `PATH` inputs. Windows-owned system DLLs remain declared prerequisites
and are not copied. Production redistribution approval remains a Task 22
external gate.

The CUDA profile keeps `CMAKE_CUDA_ARCHITECTURES=120a-real`, CUDA toolkit
`12.8.1`, minimum driver `570.65`, and exactly one CUDA backend. The CPU profile
keeps explicit baseline ISA/thread checks and initializes no GPU. Reject x86,
arm64, other CUDA targets, driver/toolchain substitution, missing DLLs,
unexpected dynamic dependencies, or mixed Linux/Windows identities. Do not
silently choose another backend, device, runtime, model, or target.
`sm_86-real` and `sm_89-real` are deliberately unavailable in this packet;
their deterministic delivery, applicability, and external physical-gate
handoff belong to Task 26.

### 2. Deterministic native builds and runtime packs

Use the existing pinned `whisper.cpp` source/tree, reviewed patch order, C++20
contracts, and toolchain-lock schema. All configure/build/test/pack phases take
explicit verified local roots and run without network access. No CMake fetch,
package-manager resolution, ambient `PATH` discovery, user profile input, or
moving dependency may enter the build.

Build CPU and CUDA workers in separate fresh roots. Treat warnings as errors;
run MSVC native unit/integration tests; prove the requested CUDA architecture is
present in generated code; inspect PE imports and dependency closure; and test
startup from a clean malicious working directory with the launcher's sanitized
environment. A successful compile or link alone is not readiness.

Before the network-denied build begins, materialize the Microsoft VC Runtime
once into a fresh task-owned root from the exact verified acquisition object.
Normal configure/build/test/pack commands accept only that explicit local root;
they do not download, install, repair, upgrade, or discover a system VC Runtime.
The final PE-import audit and clean relocated startup determine the exact staged
DLL subset, and the profile/runtime manifest must bind every staged DLL hash.

Produce each runtime pack twice from independent clean roots and require equal
source/patched-tree identities, installed-file manifests, archive size,
archive SHA-256, and signature-input digest. Each archive is deterministic
strict gzip/ustar under `restricted-tar-gzip-v1`; paths are relative,
case-collision-free, bounded, and declared by an exact expected-file manifest.
The archive contains no model, helper daemon, SDK/compiler, private key,
certificate key, debug database, build path, user data, or undeclared DLL.

### 3. Platform-aware catalog and development inputs

Generalize the current Linux-hardcoded qualification catalog/runtime input
producers through explicit platform-owned runtime identity data. The producer
must not infer platform, ABI, dependency family, compute target, prerequisites,
archive name, or expected files from the host. It accepts only the two closed
CPU/CUDA rows for one requested platform and rejects mixed platforms,
architectures, revisions, or duplicate backends.

Preserve byte-for-byte Linux behavior where the input is unchanged. Windows
catalog rows use `platform=win32`, `architecture=x64`, CPU target/backend
`cpu/cpu`, and CUDA target/backend `gpu/cuda`, with their exact Windows pack
revisions, prerequisites, expected files, memory estimates, model compatibility
links, source identity, and qualification-only trust purpose.

The development runtime loader and resource stager select an explicit
`--platform=win32`; `platform=current` resolves once and is then frozen. A
host/platform mismatch fails before staging or process creation. Runtime bytes
are served only by the existing task-owned `127.0.0.1` HTTPS origin, while the
six canonical models retain their immutable anonymous Hugging Face identities.

### 4. Windows authenticated development activation

Extend the existing canonical development activation descriptor rather than
adding a new transport or persisted setting. It remains non-packaged,
qualification-purpose, explicitly selected by one absolute descriptor path,
and main-owned. It binds the Windows app revision, protocol, authenticated
catalog envelope, public keyring, exact origins, loopback CA, resources root,
and display label. It contains no private key, credential, cookie, session,
model path, runtime path exposed to renderer, hardware identity, transcript, or
audio.

The Windows launcher starts the ordinary Electron app with exactly one
activation argument. The existing production composition root consumes the
authenticated inputs. Missing, duplicated, malformed, forged, wrong-purpose,
wrong-platform, incompatible, persisted, renderer-selected, or packaged
activation fails closed as `CATALOG_UNAVAILABLE`/the existing safe typed state
before download or process creation.

Shutdown and failed startup stop the loopback server and remove only validated
task-owned ephemeral trust/server files. Installed managed runtimes/models
remain user-owned application data and are never recursively deleted by task
cleanup.

### 5. Native helper and package boundaries

Build `fs-guard.exe` and `local-whisper-launcher.exe` for Windows x64 with the
same pinned source/toolchain rules. Stage them outside ASAR under
`local-whisper/native` with canonical `helpers.manifest.json`, exact byte sizes,
SHA-256 values, Windows mode `0`, and `LICENSE.txt`. Main rehashes the helpers
immediately before use.

Exercise real Windows reparse/junction/hard-link/case-fold/rename/volume and
held-handle defenses in validated temporary roots. Exercise suspended worker
creation, restricted inherited handles, Job Object assignment before resume,
one-use model authority, acknowledgement, kill-on-close, parent-exit cleanup,
and fail-closed nested-Job behavior. No shell command, broad process kill, raw
path, or ambient executable lookup may replace the native boundary.

The base installer/unpacked package includes shared catalog state plus exactly
the two helpers. CPU/CUDA workers, CUDA DLLs, and models remain on demand. Task
24 may build an unpacked Windows directory for inspection; ordinary release
workflows continue using `mode=disabled` and the release-collection guard must
reject fixture/qualification/production staging until Task 22 supplies separate
protected authority.

### 6. CPU and CUDA capability/lifecycle behavior

CPU readiness requires the exact Windows runtime installed and authenticated,
supported ISA, valid bounded thread count, sufficient RAM when measurable,
successful worker probe/load/warm-up, and actual CPU execution. CPU validation
must not load CUDA DLLs, enumerate a CUDA execution device, allocate VRAM, or
fall back to a GPU.

CUDA readiness requires the exact runtime installed and authenticated, a
physical selected NVIDIA device, compatible driver, compiled `120a-real`
target, complete DLL closure, sufficient resources when measurable, successful
allocation/dispatch/load/warm-up, and post-load proof of the same selected
device. Any mismatch remains Not ready with the existing safe failure code and
does not fall back to CPU, another GPU, Vulkan, another runtime, or another
model.

The Voice Provider may report Connected only after its existing derived
readiness contract is satisfied. A runtime/model download is an explicit setup
action and never starts merely because Local Whisper is selected. After a
successful install, app restart must reuse authenticated installed artifacts
without redownloading; Load/Free and provider switching preserve the Task 23
command and conflict contracts.

### 7. Windows automation and workflow policy

Add a focused Windows-readiness test command and one aggregate verification
command. The aggregate command runs only on Windows x64 and proves toolchain
identity, native quality, CPU/CUDA build and pack reproducibility, catalog and
development activation, filesystem/launcher/supervisor behavior, artifact and
composition tests, packaging policy, type/lint/format gates, and unpacked app
verification.

The GitHub Windows workflow remains reusable/manual-gated; do not add an
ordinary `pull_request` or `push` trigger that could imply representative
hardware execution or production publication. Separate readiness and Task 21
qualification authorization inputs. Fixture production remains single-owner,
downloaded by digest, and never regenerated by the Windows consumer. CI without
representative NVIDIA hardware may prove compilation, package, and deterministic
contracts only; it must report hardware smoke/qualification as Pending.

### 8. Bounded ordinary-app Windows smoke

On the authorized Windows host, use a fresh task-owned development activation
and a dedicated test application-data root. Through the normal UI/IPC/main
graph:

1. start with no Local Whisper runtime/model installed in that dedicated root;
2. install the authenticated Windows CPU runtime and exact `base/full` model
   through normal progress-reporting actions;
3. select CPU, check compatibility, Load, transcribe one pinned public FLEURS
   WAV, verify a non-empty result, Free, and prove no GPU initialization;
4. install the authenticated Windows `sm_120a` CUDA runtime, select the exact
   RTX 5090 NVIDIA device, check compatibility, Load, transcribe the same WAV, verify a
   non-empty result, Free, and prove the worker/allocation is removed;
5. restart offline, reuse the installed CPU and `sm_120a` CUDA runtimes/model without a
   transfer, repeat one Load/Free path, and confirm no inference network egress;
6. verify keyboard access, status/failure text, progress, Connected gating, and
   the main-window Load/Free control at the existing compact dimensions.

Record only pass/fail, canonical revision/profile IDs, hashes, and safe failure
codes. Do not retain screenshots, raw hardware IDs, paths, audio, transcript,
environment data, private certificates/keys, or complete logs in repository
evidence. This bounded smoke does not run or claim Task 21 qualification.

## Contracts And Boundaries

- Renderer continues to use only typed `window.electronAPI`; main owns trust,
  network, filesystem, native processes, devices, artifacts, and lifecycle.
- Reuse existing stateful classes and process-owned composition. Do not add a
  parallel provider, global mutable container, pass-through service, or second
  startup/runtime transport.
- Preserve trusted IPC sender validation and sanitized errors. No path, URL,
  argv, catalog key material, native stderr, physical-device identity, audio,
  or transcript crosses preload or routine diagnostics.
- Linux runtime/catalog/development/package behavior and its completed evidence
  remain unchanged. A platform discriminator must be explicit and fail closed.
- Windows Vulkan stays `Preview · Untested`; HIP remains Linux-only Preview;
  Metal/macOS remains Planned and unavailable.
- Task 24 readiness cannot authorize Task 26, Task 25, Task 21, production
  collection, support promotion, upload, publication, or release.

## Expected Files Or Components

- `runtime/local-whisper/toolchains/profiles/windows-x64-cpu-msvc-19.39-v1.json`
  and `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1.json`, plus only the
  reviewed Windows evidence/lock metadata required to remove placeholders. Do
  not add `sm_86` or `sm_89` profiles in this packet.
- A repository-owned exact acquisition lock at
  `runtime/local-whisper/toolchains/locks/microsoft-vc-runtime-14.51.36247.0-x64-v1.json`
  plus the narrow schema/verifier/materializer support needed to authenticate
  the signed installer and populate an isolated app-local DLL root. Installer
  bytes, extracted DLLs, certificates, and installer logs remain outside Git.
- Existing native build/stage/audit scripts under `scripts/local-whisper/` and
  Windows C++ sources under `runtime/local-whisper/`, extended without
  regressing Linux contracts.
- `scripts/local-whisper/development/DevelopmentRuntimeInputs.ts`, the
  development resource stager/orchestrator/CLI, and their focused tests.
- `scripts/local-whisper/qualification/QualificationCatalogProducer.ts` and
  runtime-pack producer components, generalized for explicit platform input;
  no Windows qualification result producer is added here.
- `scripts/local-whisper/packaging/`,
  `.github/workflows/local-whisper-packaging-windows.yml`, package scripts, and
  electron-builder resource policy for Windows helper/package validation.
- Focused shared/main composition, capability, filesystem, supervisor,
  development, packaging, native, workflow, and Windows-readiness tests.
- Windows Local Whisper setup/troubleshooting documentation and plan revision
  23 artifacts: `validate-task-plan.mjs`, the implementation-readiness registry
  verifier, acceptance registry/schema, `plan.md`, `todo.md`, and `handoff.md`.
  Registry support must recognize Task 26 and `AC-AUTO-078`–`AC-AUTO-082`
  without implementing or running that packet.

## Acceptance Criteria

- Windows x64 CPU and `sm_120a` CUDA native workers/helpers build under exact
  MSVC 14.39 profiles with the separately pinned VC Runtime 14.51.36247.0
  closure, warnings as errors, deterministic manifests, proven dependency
  closure, and no network during configure/build/test/pack. Replacing the
  compiler, accepting a floating/current runtime, or retaining a `crt-14.39`
  profile identity fails validation.
- Independent CPU/`sm_120a` CUDA runtime builds reproduce identical strict archives and
  expose Windows catalog rows compatible with all six canonical model objects.
- Linux inputs produce unchanged identities and pass their existing automated
  tests; mixed platform identities fail closed.
- The non-packaged Windows development activation reaches the existing ordinary
  provider graph; absent/forged/wrong-purpose/packaged activation remains
  unavailable before privileged effects.
- The unpacked Windows package authenticates exactly two native helpers, contains
  no inference worker/runtime/model or development trust, and remains
  production-disabled and uncollectable.
- The bounded Windows CPU smoke passes without GPU initialization; the bounded
  RTX 5090 `sm_120a` CUDA smoke proves the exact selected NVIDIA device with no fallback; unload,
  restart reuse, offline inference, and cleanup pass.
- Unsupported architecture, missing runtime/model, incompatible driver/device,
  missing DLL, wrong compute target, insufficient known resource, tampered
  archive/helper/model, and stale selection all remain Not ready with safe typed
  failures and no automatic download or fallback.
- Task 24 records no qualification/Production verdict and leaves Tasks 26, 25,
  21, and 22 unchecked. Plan validation recognizes 26 packets and all 81
  primary automated acceptance owners without changing Task 26's exclusive
  ownership of `AC-AUTO-078`–`AC-AUTO-082`.

## Verification

Run platform-independent focused checks after each related change:

```bash
rtk npm run test:local-whisper:windows-readiness
rtk npm run test:local-whisper:development
rtk npm run test:local-whisper:packaging
rtk npm run test:local-whisper:capability
rtk npm run test:local-whisper:filesystem
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:composition
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

Run the aggregate command only on the authorized Windows x64 host after the
exact toolchain and local inputs are available:

```bash
rtk npm run verify:local-whisper:windows-readiness
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:whisper-cpp-cpu-integration
rtk npm run test:local-whisper:whisper-cpp-cuda-integration
rtk npm run audit:local-whisper:whisper-cpp-pack
rtk npm run build:prod
rtk npm run dist:win -- --dir
rtk npm run verify:packaged
```

The registered Task 24 commands are exactly:

```bash
rtk npm run test:local-whisper:windows-readiness
rtk npm run verify:local-whisper:windows-readiness
```

Do not run `run:local-whisper:qualification:linux`,
`verify:local-whisper:qualification:linux`,
`verify:local-whisper:qualification:windows`, or
`verify:local-whisper:all` in this packet.

## Failure And Rollback

- A product/runtime/package defect found before candidate freeze remains Task 24
  work if it fits this packet. A support-contract, dependency, trust, or
  architecture change returns to specification/planning before implementation.
- Missing Windows host/toolchain/NVIDIA hardware, a failed bounded `sm_120a`
  smoke, or an unavailable exact model/runtime input keeps Task 24 incomplete
  or Pending.
  Linux results, mocks, Wine, cross-compilation, compile-only CI, another CUDA
  target, or CPU fallback cannot substitute for the missing check.
- Preserve installed user artifacts on code rollback. Remove only exact
  task-owned temporary build/staging/app-data roots after validating their
  markers and ownership; stop only proven task-owned processes/Job Objects.
- A partial authenticated transfer follows the existing resume/cancel journal.
  Never broadly delete app data, caches, models, runtimes, or user profiles.
- Keep ordinary release packaging `disabled`. If readiness staging leaks
  qualification/development material into a package, fail collection, retain
  sanitized diagnostics, and restore the closed staging boundary before retry.

## Manual Gates

- `MANUAL GATE — Windows toolchain`: provision and verify the exact pinned
  MSVC/SDK/CMake/Ninja/CUDA inputs. Installation, licenses, and any external
  downloads require explicit human authorization and remain outside routine
  automated execution.
- `MANUAL GATE — Microsoft VC Runtime materialization`: acquire only the exact
  versioned Microsoft x64 Redistributable object declared in Section 1, verify
  its size/hash/version/Authenticode publisher before effect, and materialize
  the import-derived app-local DLL closure into a fresh task-owned toolchain
  root. UAC may be used only to install that verified Microsoft development
  prerequisite. Before copying any DLL, verify the registered x64 runtime is
  exactly `14.51.36247.0`; resolve the closed DLL allowlist only from the
  absolute native Windows system directory, then sever that system dependency
  by hashing and copying the files into the isolated root. Do not use a moving
  URL, Dev Essentials credentials, a different installed runtime, PATH lookup,
  an unsigned extractor, or System32 during normal build/pack execution. Remove
  installer logs and temporary materialization roots after their exact task
  ownership is validated; retain only permitted outside-Git dependency cache
  inputs needed to finish the authorized task. Do not uninstall or downgrade a
  shared system runtime during cleanup.
- `MANUAL GATE — public model download`: permit anonymous HTTPS transfer only
  for the exact pinned `base/full` Hugging Face object and authenticated redirect
  targets used by the bounded smoke. No token, cookie, mirror, upload, or moving
  revision is authorized.
- `MANUAL GATE — loopback runtime origin`: generate ephemeral qualification
  key/certificate material outside the repository and serve only the exact CPU
  and CUDA archives on `127.0.0.1`; destroy private material after the session.
- `MANUAL GATE — application/hardware smoke`: launch the ordinary non-packaged
  app on the authorized Windows x64 CPU/NVIDIA host and execute the bounded flow
  in Section 8. Do not use private microphone audio or retain private output.
- `MANUAL GATE — unpacked package`: build and inspect `dist:win -- --dir` only;
  installer installation/removal and Task 21 qualification remain separate.
- `MANUAL GATE — RTX 30/40 physical hardware`: no such run is assigned to this
  computer or Task 24. Windows `sm_86` and `sm_89` execution remains
  **Pending — external representative hardware required** and cannot be
  substituted by the RTX 5090, compilation, mocks, emulation, or CI.
- Commit, push, PR, production signing, runtime upload, publication, support
  promotion, tag, and release require later explicit authorization.

## References

- Specification revision 17 Sections 5–7, 8.2, 9.1–9.6, 11, 12, 14–18, 19.1,
  19.3, and 22; especially `IMPL-001`, `QUAL-004`, `QUAL-006`, and `OPS-003`
  completion boundaries.
- Completed Task 19 development-activation/implementation-readiness contract
  and Task 23 main-window residency contract.
- Task 26 hardware-matched NVIDIA expansion packet and Task 21 Windows
  qualification packet as downstream immutable consumers; Task 24 must not
  absorb either packet's `sm_86`/`sm_89` or representative qualification matrix.
- Project native C++20, Electron/main ownership, packaging, privacy, and release
  conventions.

## Completion And Handoff

Mark Task 24 complete only after both registered commands pass, all required
Windows native/package checks pass, the bounded ordinary-app CPU/RTX 5090
`sm_120a` smoke is recorded with sanitized evidence, Linux regressions are
clear, Task 20 remains preflight-only, Task 26 remains unchecked, and no
qualification or production authority was created.

Update `todo.md` and `handoff.md` with changed files, exact checks, the Windows
host/profile IDs, safe pass/failure codes, temporary-root cleanup, remaining
manual gates, and the explicit external Pending state for RTX 30/40 physical
checks. Stop before Task 26, Task 25, candidate freeze, Task 21, commit, push, PR,
signing, upload, publication, tag, support promotion, or release unless each is
separately authorized.
