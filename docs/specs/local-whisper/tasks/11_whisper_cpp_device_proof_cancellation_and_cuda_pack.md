# 11 Whisper.cpp Device Proof, Cancellation, And CUDA Pack

## Outcome

The pinned `whisperCpp` worker gains fail-closed exact NVIDIA device binding,
real probe-only activation evidence, selected-device model-weight and primary
state proof, and cooperative cancellation that remains bounded by supervisor
process termination. A separate Linux x64 CUDA 12.8.1 Blackwell pack is built
with requested and effective `120a-real`, one linked CUDA backend, complete
manifest-owned dependency closure, and no CPU fallback or ambient backend
discovery. The Task-10 CPU pack is rebuilt and reverified against the same
cancellation patch. Windows CPU/CUDA profiles remain candidate/source/CI
contracts until representative Task-19 execution.

## Prerequisites

- `docs/specs/local-whisper/spec.md` is `Status: Approved`, revision 6.
- Tasks 08, 09, and 10 are complete.
- Toolchain profile `linux-x64-cuda-12.8.1-sm120a-v1` is executable-qualified
  with CUDA Toolkit 12.8.1, GCC 13.3.0, CMake 3.31.8, Ninja 1.12.1, requested
  and effective `CMAKE_CUDA_ARCHITECTURES=120a-real`, and an exact reviewed
  driver/runtime prerequisite. A candidate-only profile cannot satisfy this
  prerequisite.
- Task 08's immutable `whisper-cpp-loader-limits-v1` table and Task 10's
  verified enforcement/core patch lock, CPU worker/pack, and a local
  license-approved model fixture are available. Any additional CUDA model or
  toolchain input is separately authorized and locally present.
- This plan and Task 11 have separate explicit authorization.

## Owned Requirements

- Primary: `RUN-012`, `AC-AUTO-062`.
- CUDA/device slices: `RUNTIME-001`, `ARCH-005`, `RUN-001`, `RUN-002`,
  `RUN-003`, `RUN-004`, `RUN-005`, `RUN-006`, `SEC-005`, `SEC-010`,
  `SEC-013`, `CAP-007`, `CAP-009`, `CAP-014`, `CAP-017` (implementation slice
  supporting Task 14's primary ownership), `NVIDIA-001`, `FAIL-005`,
  `FAIL-007`, `FAIL-008`, `PKG-003`, `PKG-004`, `PKG-010`.
- Supporting acceptance: `AC-AUTO-010`, `AC-AUTO-011`, `AC-AUTO-012`,
  `AC-AUTO-013`, `AC-AUTO-024`, `AC-AUTO-033`, `AC-AUTO-044`,
  `AC-AUTO-047`, `AC-AUTO-050`, `AC-AUTO-051`, `AC-AUTO-052`,
  `AC-AUTO-053`, `AC-AUTO-056`, `AC-AUTO-060`, `AC-AUTO-061`.

## In Scope

- Small reviewed `whisper.cpp` patches for exact backend/device selection,
  no-fallback initialization, actual model-buffer/state proof, and cooperative
  abort propagation.
- Real CPU and CUDA probe-only operations without model authority.
- CUDA full load/warm-up/transcription proof on the exact selected physical
  NVIDIA device and Task-10 model authority.
- Cooperative cancellation tests before/during mel, around every scheduled
  graph stage, in decoding, during CPU compute, and against an unresponsive
  mocked CUDA backend.
- Rebuild/reverification of the Linux CPU pack against the completed patch
  series.
- Linux x64 CUDA Blackwell pack, dependency closure, relocation, malicious
  CWD/environment, offline, repeated lifecycle, and available-laptop evidence.
- Windows CPU/CUDA compile/source/CI definitions only; representative execution
  remains Task 19-only.

## Out Of Scope

- Vulkan, HIP/ROCm, AMD, Faster-Whisper, Metal/macOS, multi-GPU inference,
  dynamic backend modules, automatic architecture selection, or another CUDA
  compute target.
- Main-owned stable opaque IDs, support policy, capability persistence,
  coordinator, renderer IPC/UI, signing, packaging publication, or support-tier
  promotion.
- Any representative Windows execution before Task 19.

## Task Contract

### Canonical CUDA registry identity

Use the pinned backend registry order and include GPU/IGPU entries only.
Resolve Task 09's private ordinal `0..255` against that exact order before any
backend activation. For CUDA, `ggml_backend_dev_props.device_id` must be
non-null and must canonicalize to lowercase ASCII PCI identity matching:

```text
^(?:[0-9a-f]{4}|[0-9a-f]{8}):[0-9a-f]{2}:[0-9a-f]{2}\.[0-7]$
```

Whitespace, upper-case after normalization, descriptions, UUIDs in another
format, memory tuples, duplicate native identities, missing IDs, and an ID
that changes on a second enumeration are invalid. Missing durable identity is
`DEVICE_FEATURE_MISSING`; it is never reconstructed from ordinal/name/memory.
Raw PCI/UUID/registry values stay inside main/worker private authority handling
and never enter renderer/preload IPC, settings, cache, logs, audit,
diagnostics, argv, or environment.

Compute `LWREG1`, `probeProof`, and `loadProof` exactly as Task 09 defines. The
worker never receives an expected proof, and tests SHALL reproduce Task 09's
golden vectors before engine tests. Registry reorder, topology generation,
runtime digest, authority ID, operation challenge/domain, actual ordinal,
identity, primary state device, or weight-byte mutation is
`DEVICE_PROOF_FAILED` and terminates the worker.

### Real probe-only contract

A CUDA probe starts in a fresh worker with no model authority. It re-enumerates
the exact CUDA registry, recomputes and validates the expected fingerprint,
resolves the selected ordinal, derives the actual native identity inside that
process, initializes only that CUDA device, performs one bounded positive-size
device allocation and deterministic dispatch/readback, computes `probeProof`
in the `LWDEV1P\0` domain with model-weight bytes fixed to zero, returns one
`probed`, and exits.
It may initialize a CPU implementation participant only when the selected CUDA
device remains the proved primary execution backend; CPU-only success is
forbidden.

The CPU probe from Task 10 is rerun after the complete patch and proves
`use_gpu=false`, zero initialized GPU backends, bounded CPU compute, no GPU
authority/proof fields, and process exit. Probe failures are typed separately:
an initially absent device before an authority exists `DEVICE_NOT_FOUND`, null
durable identity `DEVICE_FEATURE_MISSING`, and a missing/reordered ordinal or
registry/identity/proof mismatch under an existing authority
`DEVICE_PROOF_FAILED`. Missing driver/library is
`RUNTIME_PREREQUISITE_MISSING`, failed activation/dispatch
`BACKEND_INIT_FAILED`, and checked allocation
failure `ALLOCATION_FAILED`. No failure selects CPU, another ordinal, backend,
engine, model, or precision.

### Exact GPU binding and no fallback

Patch initialization to resolve and retain one selected
`ggml_backend_dev_t`; do not later reselect by ordinal. A requested GPU that is
missing or fails initialization is terminal and cannot produce a CPU-only
context. CPU backends required internally by pinned `whisper.cpp` may remain
only as non-primary implementation participants.

Bind the same selected device through all of these actual objects:

- activated CUDA backend and reported effective backend/precision;
- model-buffer priority and every GPU-owned model buffer;
- positive byte sum of model-weight allocations owned by the selected device,
  excluding scratch, compute, KV/state, staging, and allocator-cache bytes;
- the only GPU identity owning model buffers—no second GPU owner;
- state creation, `state->backends[0]`, and primary execution backend;
- `loadProof` in the `LWDEV1L\0` domain after full model load and warm-up.

The worker SHALL derive evidence from buffer/backend/device objects, never from
request values or logs. Zero/wrong-device weight bytes, second GPU owner,
different activated/state device, CPU primary, changed registry, or proof
mismatch is `DEVICE_PROOF_FAILED`, marks evidence stale downstream, and
terminates. Successful CUDA `loaded` reports the authenticated model identity,
same-handle digest, actual ordinal, registry fingerprint, effective backend and
precision, positive selected-device weight bytes, primary-state confirmation,
and `loadProof`. Raw addresses/identities are absent.

### Cooperative cancellation patch

Use one state-owned atomic cancellation flag read by the inference owner. The
control thread may set that flag but SHALL NOT call an unsafe engine API.
Install the reviewed abort callback on every initialized CPU/CUDA execution
backend that supports it before scheduled work and clear it only after the
inference owner has joined. Add explicit checks:

- before PCM-to-mel preparation;
- at bounded chunks/loops during mel where project code controls iteration;
- immediately before and after every scheduled encoder/decoder graph stage;
- inside token/decoder loops and before committing final text.

An observed cooperative abort returns `CANCELLED`, never compute failure or
partial text. The inference owner joins, all temporary audio/compute buffers
release, authority/proof remain unchanged, and no late frame is possible before
a worker may be considered healthy. Only that exact proof permits a
`whisperCpp` worker to remain Loaded. Cancellation during loading, failed
acknowledgement, backend error, timeout, proof change, or an unresponsive
CPU/CUDA callback invokes Task 09's graceful/terminate/kill bounds, confirms
process exit, and leaves Unloaded. A terminal cancellation always beats a later
native success.

The patch lock becomes `local-whisper-whisper-cpp-device-cancel-v1` and SHALL
append, never rewrite, Task 10's core patch order. It records every patch hash,
touched path, original/intermediate/final manifest digest, and license/SBOM
provenance.

### CUDA and rebuilt CPU packs

Build `whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1` only from Task 08's
qualified profile. The CMake cache SHALL contain requested and effective
`CMAKE_CUDA_ARCHITECTURES=120a-real`, `GGML_CUDA=ON`,
`GGML_BACKEND_DL=OFF`, `GGML_NATIVE=OFF`, `GGML_CUDA_CUB_3DOT2=OFF`,
`GGML_CUDA_NCCL=OFF`, OpenMP/RPC/curl/upstream tests/examples OFF, and every
non-CUDA accelerator/backend OFF. Cache/fatbinary audit rejects bare `120`,
`120-virtual`, `native`, PTX/architecture drift, and an unknown enabled backend.

Link the CUDA backend into the worker; never call dynamic backend discovery.
Project libraries are statically linked where the Task-08 lock says so, while
the reviewed CUDA shared runtime closure is staged explicitly. Linux loader
resolution uses a manifest-owned relative runpath and ignores CWD,
`GGML_BACKEND_PATH`, `LD_LIBRARY_PATH`, and user `PATH` additions. Every
non-system dependency is present, hashed, licensed, and declared. No driver,
full toolkit, compiler, headers, model, installer, or admin action enters the
runtime pack.

Rebuild `whisper-cpp-linux-x64-cpu-baseline-v1` from the final patch manifest
and rerun its probe, load, cancellation, closure, and offline tests. Neither
local staging pack is catalog/signing/release eligible here. Windows profiles
remain `windows-x64-cpu-candidate-task19-v1` and
`windows-x64-cuda-12.8.1-sm120a-candidate-task19-v1`; code and CI commands are
defined, but no representative Windows binary is executed before Task 19.

## Contracts And Boundaries

- Task 11 owns the `whisper.cpp` device/no-fallback/cancellation patch and the
  CUDA staging pack. Task 08 owns the immutable loader-limit table; Task 10
  remains owner of its enforcement, same-handle digest, CPU inference mapping,
  and core typed load failures.
- Task 09 remains owner of `LWREG1`, `LWDEV1P\0`, and `LWDEV1L\0` bytes,
  challenges, worker launch, authority, deadlines, and terminal arbitration.
  Task 11 consumes those contracts without a CUDA-specific framing dialect.
- Main process and future coordinator code own product selection, stable opaque
  IDs, capability state, and lifecycle commands. Raw engine identity never
  crosses that private boundary.
- NVIDIA evidence applies only to the exact recorded Linux laptop/profile and
  does not prove Windows, another architecture, AMD, or Apple Silicon.
- `AC-AUTO-051` cross-engine/coordinator proof remains supporting here;
  downstream coordinator work owns its single primary acceptance result.
- `AC-AUTO-061` final packaging relocation/closure remains supporting here;
  downstream packaging owns its single primary acceptance result.
- Representative Windows execution and promotion are exclusive to Task 19.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/device/` registry, activation, buffer/state
  ownership, proof, and cancellation modules.
- `runtime/local-whisper/whisper-cpp/patches/device-cancel/` and completed final
  patch lock.
- CUDA and rebuilt CPU CMake presets/manifests/tests under
  `runtime/local-whisper/whisper-cpp/`.
- `scripts/local-whisper/build-whisper-cpp-cuda.mjs`
- `scripts/local-whisper/verify-whisper-cpp-device.mjs`
- `scripts/local-whisper/stage-whisper-cpp-cuda.mjs`
- Focused GoogleTest/supervisor/pack fixtures under
  `tests/runtime/localWhisper/whisperCpp/`.
- Exact package scripts used by Verification below and Windows Task-19 CI
  definitions that are not executed in this packet.

## Acceptance Criteria

- Real probe-only CPU/CUDA workers receive no model authority and perform
  bounded exact-backend compute. CUDA reports the correct `probeProof`; CPU
  proves every GPU authority/challenge/proof field is absent. Both exit.
- Missing device/ordinal/identity/driver, init/dispatch failure, registry
  reorder, echoed/mutated proof, CPU fallback, wrong/zero weight bytes, second
  GPU, and primary-state mismatch each fail with the specified safe result and
  terminate.
- A successful CUDA load proves the same selected physical device owns positive
  model-weight bytes and primary state after warm-up; no log parsing or echoed
  value contributes.
- Cancellation before/during mel, between graphs, in CPU compute/decoding, and
  against an unresponsive mocked CUDA backend follows cooperative-or-forced
  bounds, emits no partial/late success, and preserves residency only after the
  exact healthy-worker proof.
- Requested and effective architecture are both `120a-real`; generated CUDA
  code audit contains only the locked target.
- Relocated CPU/CUDA staging starts network-denied, ignores malicious CWD and
  backend/loader environment, and has exact dependency/license/SBOM closure.
- Physical Linux evidence is labeled only for the exact RTX 5070 Ti Laptop
  profile. AMD and Windows claims remain absent.

## Verification

Task 11 SHALL add the named package scripts before running these exact commands:

```text
rtk npm run verify:local-whisper:loader-limits -- --table=whisper-cpp-loader-limits-v1
rtk npm run test:local-whisper:whisper-cpp-core
rtk npm run test:local-whisper:whisper-cpp-loader
rtk npm run test:local-whisper:whisper-cpp-device-proof
rtk npm run test:local-whisper:whisper-cpp-cancellation
rtk npm run test:local-whisper:worker-proof-vectors
rtk npm run build:local-whisper:whisper-cpp-cuda -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
rtk npm run verify:local-whisper:whisper-cpp-cuda -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
rtk npm run test:local-whisper:whisper-cpp-cuda-integration -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
rtk npm run audit:local-whisper:whisper-cpp-pack -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
rtk npm run build:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
rtk npm run verify:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
rtk npm run test:local-whisper:whisper-cpp-cpu-integration -- --profile=linux-x64-cpu-baseline-v1 --include-cancellation
rtk npm run audit:local-whisper:whisper-cpp-pack -- --profile=linux-x64-cpu-baseline-v1
rtk npm run verify:local-whisper:whisper-cpp-cuda -- --profile=windows-x64-cuda-12.8.1-sm120a-candidate-task19-v1 --contract-only
rtk npm run verify:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-candidate-task19-v1 --contract-only
rtk npm run test:local-whisper:supervisor
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check -- runtime/local-whisper/whisper-cpp runtime/local-whisper/toolchains scripts/local-whisper tests/runtime/localWhisper/whisperCpp tests/main/localWhisper package.json
```

The device/cancellation suites SHALL run GCC and Clang warnings-as-errors,
clang-format, clang-tidy, GoogleTest, ASan, and UBSan. The CUDA integration
command runs only after exact toolchain/model authorization and records GPU,
driver, toolkit, compiler, runtime/model/patch hashes, effective architecture,
proof results, repetitions, and memory observations. The pack audits run
relocated with network denied and malicious environment. Both Windows commands
are contract-only and SHALL NOT execute a Windows host, VM, remote runner,
Wine, or substitute platform.

## Failure And Rollback

- Never accept context construction, backend label, ordinal, CPU presence, or
  a log line as device proof. Never enable fallback or dynamic discovery to
  pass a fixture.
- If CUDA/toolchain/model authorization or exact Linux evidence is missing,
  leave Task 11 open; do not substitute CPU success or a different architecture.
- An unresponsive cancellation always crosses the forced process boundary; do
  not retain residency on uncertainty.
- Rollback removes only Task-11 patched/build/staging outputs after exact
  validation, retaining Task-10 core patches, source locks, model artifacts,
  and unrelated user changes.

## Manual Gates

- `MANUAL GATE — CUDA toolchain`: exact CUDA 12.8.1/compiler/CMake/Ninja and
  redistributable runtime acquisition/license authorization.
- `MANUAL GATE — CUDA model and hardware`: approve exact model origin,
  identity, hash, license, and execution on the available RTX 5070 Ti Laptop.
- `MANUAL GATE — licenses/SBOM`: local pack assembly is not redistribution or
  publication approval.
- No commit, push, signing, packaging publication, upload, release, AMD test,
  or Apple Silicon test is authorized.
- Representative Windows execution is prohibited until Task 19.

## References

- `../spec.md`: Sections 6, 7.2-7.4, 11.2, 13, 15, 18.1 and acceptance rows
  `AC-AUTO-010`, `AC-AUTO-013`, `AC-AUTO-024`, `AC-AUTO-033`,
  `AC-AUTO-047`, `AC-AUTO-050`, `AC-AUTO-051`, `AC-AUTO-052`,
  `AC-AUTO-053`, `AC-AUTO-056`, `AC-AUTO-060`, `AC-AUTO-061`,
  `AC-AUTO-062`.
- `08_deterministic_native_source_and_toolchain_locks.md`,
  `09_shared_worker_protocol_model_authority_and_lifecycle.md`, and
  `10_hardened_whisper_cpp_core_and_cpu_pack.md`.
- Commit-pinned device, fallback, model-buffer, state-backend, cancellation,
  backend-discovery, and CUDA architecture evidence in `../decisions.yaml`.

## Completion And Handoff

After every mandatory Linux CPU/CUDA check passes, update `todo.md` and
`handoff.md` with final patch/source/profile/pack/model identities, exact proof
and cancellation evidence, licenses, deferred Windows Task-19 gates, and the
next approved packet from the revised plan. Stop before another packet, commit,
push, signing, packaging, publication, or release.
