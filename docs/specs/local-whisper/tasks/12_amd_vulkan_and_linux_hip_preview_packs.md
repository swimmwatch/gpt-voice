# 12 AMD Vulkan And Linux HIP Preview Packs

## Outcome

GPT-Voice owns deterministic `whisperCpp` AMD pack definitions for Windows x64
Vulkan Preview, Linux x64 Vulkan Preview, and Linux x64 HIP Preview. The packs
reuse the authenticated worker and exact device-proof contract from Tasks 08–10,
never fall back between HIP, Vulkan, or CPU, and never turn source, build, mock,
or non-AMD evidence into a hardware-success claim. No physical HIP pack or
catalog row exists until one complete immutable pre-signing manifest/catalog-row
intersection is reviewed and approved.

## Prerequisites

- Local Whisper specification revision 7 and plan revision 12 are approved.
- Tasks 08, 09, 10, and 11 are complete. Task 08 owns canonical sources and
  disconnected toolchains; Task 09 owns authority transfer and process lifecycle;
  Task 10 owns the hardened `whisperCpp` core/CPU pack; Task 11 owns its generic
  device-proof, cancellation, and CUDA seams reused by AMD backends.
- Task 12 has separate execution authorization.
- Every build input is already present under Task 08's verified local locks.
  Networked source/toolchain acquisition is a separately authorized manual gate.
- No AMD hardware evidence is available. Representative Windows execution is
  prohibited until Task 20.

## Owned Requirements

- Primary: `AMD-001`, `AMD-002`, `AMD-003`, `AMD-004`, `AMD-006`, `CAP-009`.
- AMD backend/pack slices: `RUNTIME-001`, `RUN-001`, `RUN-002`, `RUN-003`,
  `RUN-005`, `SEC-003`, `SEC-005`, `SEC-013`, `CAP-007`, `CAP-017`, `FAIL-005`,
  `FAIL-007`, `FAIL-008`, `PKG-002`, `PKG-003`, `PKG-004`, `PKG-010`,
  `COMP-006`, `COMP-009`.
- Primary acceptance: `AC-AUTO-011`, `AC-AUTO-012`.
- Supporting acceptance: `AC-AUTO-010`, `AC-AUTO-013`, `AC-AUTO-024`,
  `AC-AUTO-028`, `AC-AUTO-050`, `AC-AUTO-051`, `AC-AUTO-052`, `AC-AUTO-056`,
  `AC-AUTO-060`, `AC-AUTO-061`, `AC-AUTO-062`.
- Manual-claim preparation only: `AC-MAN-009`, `AC-MAN-010`, `AC-MAN-012`.

## In Scope

- Separate Windows/Linux Vulkan and Linux-only HIP CMake/profile locks.
- AMD-only runtime-pack manifest schemas, negative compatibility fixtures,
  dependency-closure/staging checks, and Preview claim metadata.
- Vulkan 1.3 generated-shader/runtime contract and hardware-ICD feature policy.
- Exact Linux HIP pre-signing manifest/catalog-row schema and fail-closed
  evaluator, without approving a physical row in this packet.
- AMD backend activation, allocation/dispatch, device/model/state proof adapters
  over Tasks 10–11 shared worker seams.
- Linux source/compile/relocation checks available without AMD hardware and
  Windows source/workflow definitions whose execution belongs only to Task 20.

## Out Of Scope

- Physical AMD qualification, Production promotion, or a working-hardware claim.
- Windows HIP, DirectML, Windows ML, Metal, or macOS runtime.
- Choosing a real HIP matrix row from incomplete discovery, installing ROCm or
  drivers, changing groups/udev/device permissions, or elevating privileges.
- Coordinator policy/state, IPC/UI, signing, catalog publication, upload, release,
  or representative Windows execution.

## Task Contract

### Fixed Preview profiles

Implement exactly these `whisperCpp` profiles:

| OS/architecture | Backend | Vendor | Tier                 | Executable evidence in this packet                                   |
| --------------- | ------- | ------ | -------------------- | -------------------------------------------------------------------- |
| Windows x64     | Vulkan  | AMD    | `Preview · Untested` | source/contract definition only                                      |
| Linux x64       | Vulkan  | AMD    | `Preview · Untested` | source/contract and available non-hardware build checks              |
| Linux x64       | HIP     | AMD    | `Preview · Untested` | schema/negative fixtures; real pack only after an approved exact row |

Every other AMD profile is absent. Each accelerator executable links exactly
one selected accelerator backend with `GGML_BACKEND_DL=OFF`; CPU support needed
internally by ggml cannot become successful CPU residency. A failed HIP request
never launches Vulkan, and a failed Vulkan request never launches HIP or CPU.

Support tier is immutable app/catalog policy. Probe, compile, mock, source review,
or successful execution on NVIDIA cannot promote a row.

### Vulkan build and runtime contract

Create separate Windows and Linux Vulkan locks derived only from Task 08's
canonical source/toolchain objects. Pin the exact Vulkan loader and headers,
SPIR-V inputs, `glslc`, generated-shader target, compiler, options, architecture,
expected files, dynamic closure, and licenses. The initial generated target is
Vulkan 1.3. The runtime floor is
`max(Vulkan 1.2, pack.generatedShaderTarget)`, therefore initially Vulkan 1.3.

The runtime pack excludes the vendor driver/ICD, full Vulkan SDK, headers,
`glslc`, shader-development tools, source/build trees, and models. The installed
vendor driver/ICD remains system-owned. Runtime validation must reject:

- a software ICD or a non-AMD physical vendor;
- Vulkan 1.1 or 1.2 under the initial 1.3 shader pack;
- a manifest/generated-target mismatch;
- absent `storageBuffer16BitAccess` or any other manifest-required feature or
  extension;
- untrusted loader/module resolution, allocation/dispatch failure, selected
  device mismatch, zero/wrong-device model-weight ownership, or a different
  primary state backend.

Only the exact selected physical AMD device may satisfy Task 11's
authority-salted backend-native proof after full load and warm-up. Deterministic
fixtures exercise this contract, but remain `Preview · Untested`.

### Linux HIP pre-signing intersection

Pinned `whisper.cpp` requiring HIP `>= 6.1` is only a compilation floor. It is
never a catalog range or permission to accept a newer release. A real Linux HIP
pack/catalog row may be materialized only when one immutable pre-signing record
contains and cross-validates all of the following:

- catalog row ID/revision and runtime build/source/patch digest;
- exact Linux distribution ID and point version, x86-64 architecture, kernel
  ABI, amdgpu driver ABI/version, and supported ROCm matrix snapshot identity;
- one exact ROCm/HIP release, compiler, hip/hipBLAS/rocBLAS package versions,
  every bundled/external SONAME and binary build identity, and complete dynamic
  dependency closure;
- exact AMD vendor and PCI device ID, explicitly compiled `AMDGPU_TARGETS` and
  `gfx` value, plus applicable CPU PCIe atomics requirement;
- required `/dev/kfd` and matching DRM render-node identities and effective
  access requirements;
- generated pack expected-file manifest, relocation policy, notices, licenses,
  SBOM, provenance, build options, and redistribution-review state;
- model/protocol/app compatibility and the exact device-proof capabilities the
  worker must expose.

The pre-signing validator rejects a missing, duplicate, range-valued, stale,
unapproved, mixed bundled/system, or cross-row field before configure or catalog
inclusion. Until a complete row is explicitly approved, checked-in data contains
only schema, negative fixtures, and an `unavailable-no-approved-row` outcome;
there is no physical HIP pack, signed row, download action, or Ready path.

When a row is eventually present, the worker must verify effective access to
`/dev/kfd` and the matching render node without modifying the system, prove
allocation and bounded HIP dispatch, then complete full model load, warm-up,
positive selected-device weight ownership, and primary state-backend proof.
Every mismatch is terminal and never selects Vulkan or CPU.

### Pack assembly and isolation

Use Task 08's disconnected build/stager only. Production-profile configuration
sets the complete explicit upstream option matrix, including disabled curl,
examples, upstream tests, native architecture detection, dynamic backend
loading, network fetch paths, and every nonselected accelerator. HIP uses the
required non-static shared-library closure; Vulkan/HIP modules resolve only from
the manifest-owned runtime directory under controlled platform loader policy.

Each unsigned local staging tree contains only the worker, required reviewed
runtime libraries, strict runtime manifest, expected-file manifest, provenance,
SBOM, notices, and licenses. It contains no model, SDK/toolkit, driver, compiler,
installer, system-permission helper, source tree, test binary, or credential.
Relocation, clean-start, malicious-CWD/environment, and network-denied checks
must account for every loaded module.

### Typed AMD failures

Return the most specific shared failure without raw driver/native text:

- absent/unapproved HIP row or mismatched PCI/`gfx` intersection:
  `DEVICE_NOT_ALLOWLISTED`;
- excluded Windows HIP, non-AMD Vulkan, or unsupported pairing:
  `BACKEND_UNSUPPORTED` or `TARGET_UNSUPPORTED`;
- incompatible driver/runtime family: `DRIVER_INCOMPATIBLE`;
- missing SONAME/system component: `RUNTIME_PREREQUISITE_MISSING`;
- unusable `/dev/kfd`/render node: `GPU_PERMISSION_DENIED`;
- API/feature/durable identity missing: `DEVICE_FEATURE_MISSING`;
- activation failure: `BACKEND_INIT_FAILED`;
- allocation/dispatch failure: `ALLOCATION_FAILED`;
- activated device, weight owner, or primary state proof mismatch:
  `DEVICE_PROOF_FAILED`;
- cleanup without proved process/allocation release: `CLEANUP_FAILED`.

All failures end Unloaded and preserve persisted settings/artifacts. No error
causes transparent retry, fallback, system mutation, or tier promotion.

## Contracts And Boundaries

- Task 09 exclusively owns launcher, logical slot `3`, descriptor/HANDLE
  authority, protocol framing, deadlines, and process-tree cleanup.
- Task 08 exclusively owns canonical source/toolchain locks, offline configure,
  patch-lock format, staging, and dependency-closure machinery.
- Tasks 10 and 11 exclusively own the common hardened model reader/parser,
  `whisperCpp` lifecycle, cancellation, and generic backend-native proof seams.
  Task 12 adds AMD backend/profile behavior only and does not fork that worker.
- Task 14 consumes immutable AMD facts and evaluates capability/state; it cannot
  build packs, invent HIP rows, or promote Preview.
- Task 17's later signed-envelope packaging work may sign only a complete,
  approved pre-signing row. Task 12 never signs or publishes it.
- Task 20 alone may execute representative Windows checks or record physical
  AMD promotion evidence. Linux source/build fixtures here are not hardware
  qualification.
- No renderer, preload, routine log, audit, or diagnostic receives PCI IDs,
  `gfx`, raw driver paths, native ordinals, UUID/LUID, registry fingerprints,
  proof material, device-node paths, or loader errors.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/amd/` profile definitions, immutable
  pre-signing schema, manifest validators, fixtures, and concise README.
- Task 08 profile/source lock additions for Windows/Linux Vulkan and Linux-only
  HIP; no generic or Windows HIP lock.
- `scripts/local-whisper/amd-packs/` disconnected configure/stage/closure/
  relocation/clean-start verifier.
- AMD Vulkan/HIP backend adapters and deterministic device/proof fixtures over
  Tasks 10–11 shared interfaces.
- Package scripts:
  `format:check:local-whisper:amd-packs`,
  `lint:local-whisper:amd-packs`,
  `test:local-whisper:amd-packs`, and
  `verify:local-whisper:amd-packs`.
- Linux CI checks and nonexecuting Task-20 Windows workflow definitions.

## Acceptance Criteria

- The matrix exposes only Windows AMD Vulkan and Linux AMD Vulkan/HIP
  `whisperCpp` Preview rows; Windows HIP and every unlisted row are absent.
- Vulkan 1.1/1.2 under the initial 1.3 pack, software/non-AMD ICDs, target or
  feature mismatch, allocation/dispatch failure, and device/model/state proof
  mismatch fail closed; an exact mocked 1.3 AMD path remains Preview.
- A HIP profile cannot configure, stage, enter a signed fixture/production
  catalog, or expose download/load until every pre-signing intersection field
  is exact and approved. `>= 6.1`, distro family, ROCm family, or `gfx` family
  ranges are rejected.
- HIP dependency mixing, missing PCIe atomics when required, permission failure,
  wrong PCI/`gfx`, missing SONAME, and fallback attempts return exact failures.
- Packs are disconnected, relocatable, manifest-closed, and free of SDKs,
  drivers, installers, models, credentials, and ambient loader discovery.
- No test or documentation string claims physical AMD success or Production.
- No representative Windows command is executed before Task 20.

## Verification

Run exactly on the available Linux environment:

```text
rtk npm run format:check:local-whisper:amd-packs
rtk npm run lint:local-whisper:amd-packs
rtk npm run test:local-whisper:amd-packs
rtk npm run verify:local-whisper:amd-packs -- --profile=vulkan-contract-linux
rtk npm run verify:local-whisper:amd-packs -- --profile=hip-no-approved-row
rtk npm run typecheck
rtk npm run test:types
rtk git diff --check
```

The verifier must use only synthetic/nonpersonal fixtures and Task 08's local
source objects. If an exact approved HIP row does not exist, the HIP command
passes only by proving fail-closed absence; it must not build a physical pack.

Define, but do not invoke before Task 20:

```text
rtk npm run verify:local-whisper:amd-packs -- --profile=vulkan-windows-x64
rtk npm run verify:local-whisper:amd-packs -- --profile=amd-physical-qualification
```

## Failure And Rollback

- A failed profile stays absent; never weaken a driver/API/feature/identity,
  dependency, permission, closure, or proof check to emit a pack.
- If no complete HIP row is approved, retain only schema/negative fixtures and
  the unavailable outcome; this is expected, not permission to invent data.
- Roll back only Task-12 profile/adapters/scripts/fixtures and task-owned local
  staging roots. Preserve Tasks 08–10 sources, patches, manifests, artifacts,
  settings, and every user-owned or managed Local Whisper root.

## Manual Gates

- Exact Vulkan/ROCm SDK and compiler acquisition plus redistribution review.
- Approval of one complete immutable HIP pre-signing manifest/catalog row.
- `AC-MAN-009` claims review: AMD remains explicitly untested Preview.
- `AC-MAN-010` physical AMD execution/promotion and every representative
  Windows execution occur only in Task 20.
- `AC-MAN-012` license/SBOM/provenance/signing approval before catalog inclusion.
- No commit, push, PR, signature, upload, publication, tag, or release authority.

## References

- Mandatory task-local contract: `../spec.md` Sections 6, 7.2–7.4, 11.1,
  11.3–11.4, 15, 18, 19, and 20; acceptance `AC-AUTO-011`, `AC-AUTO-012`,
  `AC-AUTO-051`, `AC-AUTO-061`, `AC-MAN-009`, `AC-MAN-010`, `AC-MAN-012`.
- Task dependencies: `08_deterministic_native_source_and_toolchain_locks.md`,
  `09_shared_worker_protocol_model_authority_and_lifecycle.md`,
  `10_hardened_whisper_cpp_core_and_cpu_pack.md`, and
  `11_whisper_cpp_device_proof_cancellation_and_cuda_pack.md`.
- Official current AMD ROCm compatibility matrix and AMD Windows Vulkan driver
  support pages linked from the specification evidence ledger.

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with exact profile locks,
checks, absence or identity of an approved HIP row, unavailable hardware gates,
and next eligible Task 13. Present Task 12 for review and stop. Do not implement
Task 13, commit, push, sign, publish, or execute a representative Windows check.
