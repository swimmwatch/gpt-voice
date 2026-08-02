# 10 Hardened Whisper.cpp Core And CPU Worker Pack

## Outcome

Before engine work, GPT-Voice atomically repairs the unreleased protocol-v1
native model-authority binding so the authenticated main/guard/launcher/worker
chain carries the expected artifact byte count and content digest without a
path or framed-control change. GPT-Voice then owns a modular C++20 CPU-only
`whisperCpp` worker built from the verified v1.9.1 source object. It loads one
authenticated regular model file
through logical slot 3 without a path, applies a checksummed exact-read and
bounded-format patch before any unsafe allocation, validates the complete
same-handle size/SHA-256, performs a real CPU-only probe/load/warm-up/inference,
and unloads through confirmed process exit. Its unsigned local CPU pack has no
network, listener, GPU backend, dynamic backend discovery, model, or ambient
dependency. GPU binding/proof, cooperative cancellation hardening, and the
CUDA pack belong to Task 11.

## Prerequisites

- `docs/specs/local-whisper/spec.md` is `Status: Approved`, revision 7.
- Tasks 08 and 09 are complete.
- Verified local source objects `whisper-cpp-v1.9.1-f049fff` and
  `nlohmann-json-v3.12.0-subset`, the patch-lock schema, common C++ codec, Linux
  model-authority handoff, and `linux-x64-cpu-baseline-v1` toolchain lock are
  available.
- Task 08's schema-valid, provenance-reviewed, digest-verified immutable table
  `whisper-cpp-loader-limits-v1` is available. Task 10 may enforce but may not
  derive, revise, regenerate, or replace that table.
- The Linux CPU toolchain is executable-qualified, not merely a candidate.
- A public, non-personal, license-approved CPU model fixture is explicitly
  authorized and locally present for the real integration gate. The packet
  never downloads a model.
- This plan and Task 10 have separate explicit authorization.

## Owned Requirements

- Primary: `RUNTIME-001`, `RUN-011`, `SEC-013`, `AC-AUTO-052`,
  `AC-AUTO-060`.
- CPU/core slices: `SCOPE-001`, `MODEL-004`, `ARCH-005`, `RUN-001`,
  `RUN-002`, `RUN-003`, `RUN-004`, `RUN-005`, `RUN-006`, `SEC-005`,
  `SEC-010`, `CAP-007`, `CAP-009`, `CPU-001`, `FAIL-005`,
  `FAIL-007`, `FAIL-008`, `PKG-003`, `PKG-004`, `PKG-010`.
- Supporting acceptance: `AC-AUTO-002`, `AC-AUTO-008`, `AC-AUTO-013`,
  `AC-AUTO-024`, `AC-AUTO-028`, `AC-AUTO-033`, `AC-AUTO-044`,
  `AC-AUTO-050`, `AC-AUTO-053`, `AC-AUTO-056`, `AC-AUTO-061`.

## In Scope

- Small reviewed `whisper.cpp` patches for exact sequential reads, checked
  arithmetic, finite model-format limits, typed load errors, and path-free
  loader construction.
- Descriptor/HANDLE reader, complete same-open-object digest, and RAII context,
  state, model authority, audio, and process ownership.
- CPU-only real probe, model load, non-personal warm-up, transcription mapping,
  unload/shutdown, crash, timeout, and forced-cancellation compatibility.
- Linux x64 CPU baseline worker/pack build, expected files, licenses, SBOM,
  provenance, relocation, malicious-CWD/environment, and network-denied tests.
- Windows x64 CPU source/build/CI contracts using Task 08's candidate lock;
  representative execution remains Task 20-only.
- Atomic TypeScript/C++20 authority-record migration, regenerated
  vectors, and Linux executable plus Windows source-contract coverage for the
  authenticated artifact byte-count/content-digest binding.

## Out Of Scope

- Any GPU backend, device ordinal, GPU registry/proof, model-weight GPU
  ownership, CUDA, Vulkan, HIP, Metal, or accelerator claim.
- The cooperative `whisper.cpp` abort patch or retaining a CPU worker after
  cancellation; Task 11 owns that final hardening and republishes the local CPU
  staging revision after it passes.
- Alternate inference engines, coordinator/capability policy, IPC/UI, signing, publication,
  installer changes, or support-tier promotion.
- Representative Windows execution before Task 20.
- Any path, argv/environment field, framed JSON `load` field, or second
  metadata channel for expected model size/digest.

## Task Contract

### Repaired authenticated artifact metadata binding

The unreleased `LWAR1`/`LWAT1`/`LWAA1` layout is migrated atomically before
Whisper.cpp is configured. The 8-byte domain is followed by a 226-byte common
binding in this exact order:

| Bytes | Field                                                  |
| ----: | ------------------------------------------------------ |
|    16 | operation nonce                                        |
|    16 | app-ownership nonce                                    |
|     8 | configuration epoch `u64`                              |
|    32 | lease-token SHA-256                                    |
|    32 | model-identity SHA-256                                 |
|     8 | expected artifact byte count `u64`                     |
|    32 | artifact-content SHA-256                               |
|     1 | artifact kind: `1` regular file or `2` directory       |
|     1 | logical model slot, exactly `3`                        |
|     8 | expected launcher PID `u64`                            |
|     8 | expected guard PID `u64`                               |
|    32 | SHA-256 of expected launcher OS process-start identity |
|    32 | SHA-256 of expected guard OS process-start identity    |

`LWAR1` is exactly 234 bytes, `LWAT1` exactly 244 bytes, and `LWAA1`
exactly 284 bytes. The expected artifact byte count is positive. For artifact
kind `regular file`, artifact-content SHA-256 is the exact expected file
digest. For artifact kind `directory`, it is the canonical child-manifest
digest whose entries own individual child sizes and SHA-256 values. The old
226/236/276-byte records, a zero byte count, an all-zero or malformed digest,
field reordering, and size/digest substitution are terminal authority errors.

Main constructs these fields only from the already verified managed artifact
and active lease before launch. The filesystem guard authenticates them against
the held lease before releasing authority. Every launcher hop and worker
acknowledgement copies the common binding byte-for-byte. No peer may derive the
expected values from worker-observed bytes, trust an echo without the active
lease, or send them through a model path, argv, environment, cwd, framed
control, renderer/preload IPC, logging, audit, or diagnostics.

Task 10 updates `LocalWhisperModelAuthorityRecord`, the C++ common authority
codec/bootstrap, guard/launcher fixtures, generator,
manifest, and golden records together. Existing control-message schema and
device proof domains do not change. Linux executes the migrated handoff;
Windows retains compile/source/contract coverage on its Windows job and final
representative execution in Task 20.

### Modular worker boundary

Keep every upstream type inside
`runtime/local-whisper/whisper-cpp/adapter/`. Project modules separately own the
Task-09 frame/codec port, model authority reader, bounded loader result,
CPU backend evidence, PCM conversion, inference mapping, worker state machine,
and pack projection. One composition root injects authority, clock,
cancellation flag, protocol writer, and engine adapter. RAII owns every native
descriptor/HANDLE, `whisper_context`, state/backend reference, buffer, and
temporary allocation. Cleanup is idempotent and non-throwing; no raw resource
owner, mutable global runtime, singleton, listener, or pass-through wrapper is
allowed.

### Exact same-handle reader

The worker accepts only the already inherited logical slot 3 regular-file
authority. Before parser entry it verifies read-only access, regular-file type,
expected lease/file identity, offset zero, and the binding's exact positive
authenticated size. It
never accepts, reconstructs, logs, or opens a path. Linux uses checked
offset-based reads against the inherited fd; Windows code uses the inherited
arbitrary HANDLE and checked 64-bit offsets. A read may return fewer bytes than
requested and is retried; zero is EOF.

`readExact(n)` succeeds only after exactly `n` bytes, updates one SHA-256 and a
checked `uint64` offset once per consumed byte, and rejects zero/error before
completion. `readOptionalRecordPrefix(n)` returns clean EOF only when zero bytes
were consumed at a defined next-record boundary; a partial prefix is corrupt.
No read may exceed authenticated size. When the engine loader reports success,
the reader SHALL require offset exactly equal to authenticated size, require
EOF at that boundary, finalize SHA-256 over exactly those bytes, and compare it
with the binding's artifact-content SHA-256 before `loaded`. Unconsumed tails,
appended
bytes, changed size/hash, partial reads, or content changes are `MODEL_CORRUPT`.
Close is idempotent/non-throwing and the OS authority closes exactly once even
through exception, cancel, timeout, or process exit.

### Exact model-format limits

The checked patch SHALL load and verify Task 08's exact immutable
`whisper-cpp-loader-limits-v1` table, then apply every range, ceiling,
family/variant allowlist, tensor-type allowlist, and cross-field invariant
before resize, allocation, loop bound, offset change, multiplication,
conversion, or copy. Task 10 SHALL NOT infer a limit from observed models,
duplicate the numeric table as a second authority, change the checked-in
table/schema/provenance, or accept a different table ID or digest. A catalog
artifact may impose a smaller exact limit; it may never increase one.

Header scalars SHALL additionally satisfy every pinned v1.9.1 divisibility and
cross-field invariant named by the table and required by tensor construction,
including positive dimensions, state divisible by head count, catalog
model-family compatibility, and recognized model/tensor type. An unknown enum
or incompatible quantization is `MODEL_LOAD_FAILED`. All sums, products,
signed-to-unsigned conversions, align-up operations, and allocation sizes use
checked operations. Limit validation itself must not allocate in proportion to
an untrusted declared count.

Patch every pinned loader read site: magic/header scalars, filters, vocabulary
lengths/data, tokenizer extras, tensor prefix, rank/type/name/dimensions,
padding, and body. EOF is valid only before a new tensor prefix. A custom
callback returning a short count is not sufficient while upstream ignores it;
the patched parser must consume and validate the count.

### Typed failure precedence

- Missing, writable, replayed, wrong-slot, wrong-type, wrong-peer, or
  identity-mismatched authority fails before parser entry as
  `MODEL_AUTHORITY_INVALID`.
- Missing, zero, malformed, lease-mismatched, or substituted expected artifact
  byte-count/content-digest binding fails before parser entry as
  `MODEL_AUTHORITY_INVALID`.
- Same-authority size/hash change, partial scalar/header/name/body, extra tail,
  out-of-object read, or authenticated-byte mismatch is `MODEL_CORRUPT` and
  marks the installed model corrupt.
- Hash-matching but structurally invalid bounded format, unknown tensor type,
  duplicate tensor, or catalog-family mismatch is `MODEL_LOAD_FAILED`; do not
  delete the bytes automatically.
- A valid checked allocation failure is `ALLOCATION_FAILED`, never protocol or
  corruption.
- Protocol/audio/device failure precedence remains Task 09/`FAIL-008`; raw
  upstream exceptions or logs never cross the adapter.

Complete patch lock `local-whisper-whisper-cpp-core-v1` with original source
manifest, ordered patch SHA-256 values, touched paths, strict application, and
patched-tree manifest digest before configuring the worker.

### CPU-only probe and load

The CPU executable is compiled with every accelerator OFF and never calls
`ggml_backend_load_all` or any dynamic backend loader. `probe` starts without a
model authority, confirms runtime/build digest, selected CPU pack and ISA,
positive logical processor count, resolved thread range, and one bounded
allocation/compute fixture. It proves `use_gpu=false`, zero initialized GPU
backends, and no GPU authority/proof fields, returns `probed`, then exits.
Missing CPU ISA or failed allocation/dispatch is a typed Not-ready result and
never selects another pack.

Full load starts as a new Task-09 full-load process with file slot 3. It repeats
CPU-only activation, performs exact model load and a fixed non-personal warm-up,
and reports `loaded` only after model identity, exact size/hash, effective CPU
backend/variant, model/state CPU ownership, and zero GPU backend initialization
are proven. Load failure terminates the worker. `Unload` requests bounded
engine free then always exits; confirmed process/handle closure is the RAM
release boundary.

Until Task 11 installs and qualifies cooperative abort, a cancellation or
inference timeout makes the supervisor terminate the worker and leaves
residency Unloaded. Task 10 SHALL NOT claim that a cancelled worker remains
healthy/resident.

### Audio and inference mapping

Independently validate Task 09's complete WAV, convert PCM16 to one checked
float buffer without a temporary file, and keep project-owned WAV plus float
storage within 172,800,044 bytes. Map only the six multilingual families,
selected engine-native artifact variant, common language IDs/`auto`, initial
prompt, integer temperature grid, greedy/beam/best-of strategy and candidate
count, and validated CPU thread count. Disable translation, timestamps,
segments, diarization, VAD, English-only/Distil models, fallback temperature
lists, and every unreviewed upstream flag. Emit final text only. Prompt, audio,
transcript, model path, raw native error, and proof data never reach routine
logs, stderr, argv, environment, audit, or renderer state.

### CPU pack contract

Build `whisper-cpp-linux-x64-cpu-baseline-v1` from Task 08's exact profile:
`GGML_BACKEND_DL=OFF`, all accelerators/external BLAS/RPC OFF, OpenMP OFF,
host-native OFF, x86 ISA above the x64 SSE2 ABI baseline OFF, and no upstream
examples/tests/curl/fetch. The Windows counterpart remains
`windows-x64-cpu-candidate-task19-v1` source/CI contract only.

The unsigned local staging tree contains only worker executable,
manifest-owned runtime libraries if any, runtime manifest, expected-files
manifest with exact mode/size/SHA-256, source/patch/toolchain provenance,
SPDX SBOM, third-party notices, and licenses. It contains no model, driver,
toolchain, SDK, build tree, installer, secret, signature, or production origin.
Project-owned staging and dependency inspection prove relocation and clean
network-denied startup. CWD, `GGML_BACKEND_PATH`, `LD_LIBRARY_PATH`, and
unexpected `PATH` entries cannot alter loaded code.

## Contracts And Boundaries

- Task 08 owns the immutable loader-limit table and its derivation/review
  authority. Task 10 owns the shared hardened loader enforcement patch, CPU
  peer, and CPU staging pack. Task 11 may extend the same locked patch series
  for device proof and cancellation but may not change, weaken, or fork the
  Task-08 table.
- Task 09 remains the owner of framing, codec, authority handoff, proof bytes,
  deadlines, and supervisor terminal arbitration. Task 10 owns only the atomic
  unreleased authority-layout migration required to make Task 09's handoff
  satisfy the already-approved size/digest contract; later packets consume the
  migrated layout without forking it.
- Task 10 consumes a model lease/handle only; it never sees a managed path or
  renderer data and never downloads a model/runtime.
- Main process remains the future owner of settings, capability policy,
  residency, and support claims. A worker success is evidence, not UI state.
- This CPU staging pack is not catalog/signing/release eligible until Task 11
  reruns CPU cancellation/closure checks and later packaging tasks approve it.
- Windows code and CI definitions are required, but only Task 20 executes a
  representative Windows binary.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/core/` reader, loader adapter, checked
  arithmetic, CPU evidence, PCM/inference, state machine, and RAII modules.
- `runtime/local-whisper/whisper-cpp/patches/core/` and completed Task-08 patch
  lock.
- Migrated authority-record modules and vectors under
  `src/main/localWhisper/supervisor/`, `runtime/local-whisper/common/`,
  `scripts/local-whisper/`, and `tests/fixtures/local-whisper/protocol/v1/`.
- `runtime/local-whisper/whisper-cpp/CMakeLists.txt`, CPU presets, tests,
  `.clang-format`, `.clang-tidy`, and concise README.
- `scripts/local-whisper/build-whisper-cpp-core.mjs`
- `scripts/local-whisper/verify-whisper-cpp-core.mjs`
- `scripts/local-whisper/stage-whisper-cpp-cpu.mjs`
- GoogleTest fixtures under
  `tests/runtime/localWhisper/whisperCpp/` and supervisor conformance tests.
- Package scripts named exactly as used below.

## Acceptance Criteria

- Every byte boundary of every loader field has complete, one-byte-short, and
  error fixtures; every table limit has below/equal/above and overflow-product
  fixtures. No invalid case reaches unsafe allocation/copy.
- Every peer accepts only 234/244/284-byte authority records with the exact
  positive byte count and content digest, rejects the old layout and every
  size/digest mutation, and preserves the common binding byte-for-byte across
  both handoff hops and the acknowledgement.
- Valid short underlying reads are accumulated exactly; partial EOF and extra
  tail fail. Successful load proves offset=size and the finalized same-handle
  digest before `loaded`. Every OS authority closes exactly once.
- Missing/writable/replayed/wrong file authorities fail before parser entry and
  no code path accepts a path.
- Real CPU probe performs bounded compute with no model authority and exits.
  Real CPU load/warm-up/transcription proves no GPU backend initialized.
- Malformed audio/settings fail before inference; success returns one final
  text and no private logging.
- Relocated CPU staging starts network-denied and ignores malicious CWD/backend
  environment. Its expected-file/dependency/license/SBOM closure is exact.
- Windows source/build contracts compile only in Task-20 jobs; no current
  Windows execution evidence is claimed.

## Verification

Task 10 SHALL add the named package scripts before running these exact commands:

```text
rtk npm run generate:local-whisper:worker-vectors
rtk npm run verify:local-whisper:worker-vectors -- --check-clean
rtk npm run test:local-whisper:worker-authority
rtk npm run verify:local-whisper:worker-authority -- --platform=linux
rtk npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
rtk npm run verify:local-whisper:loader-limits -- --table=whisper-cpp-loader-limits-v1
rtk npm run test:local-whisper:whisper-cpp-core
rtk npm run test:local-whisper:whisper-cpp-loader
rtk npm run build:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
rtk npm run verify:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
rtk npm run test:local-whisper:whisper-cpp-cpu-integration -- --profile=linux-x64-cpu-baseline-v1
rtk npm run audit:local-whisper:whisper-cpp-pack -- --profile=linux-x64-cpu-baseline-v1
rtk npm run verify:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-candidate-task19-v1 --contract-only
rtk npm run test:local-whisper:worker-codec
rtk npm run test:local-whisper:worker-authority
rtk npm run test:local-whisper:supervisor
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check -- runtime/local-whisper/whisper-cpp scripts/local-whisper tests/runtime/localWhisper/whisperCpp tests/main/localWhisper package.json
```

The core/loader suites SHALL execute GCC and Clang warnings-as-errors,
clang-format, clang-tidy, GoogleTest, ASan, and UBSan through the named scripts.
The CPU integration command uses only the explicitly authorized local public
fixture and records its exact hash/license. The pack audit runs relocated with
network denied and malicious CWD/environment. The Windows command is
contract-only and SHALL NOT invoke a Windows host, VM, remote runner, Wine, or
cross-platform substitute.

## Failure And Rollback

- Never increase a loader limit, accept a partial digest, use a model path,
  enable a backend, or collapse typed failures merely to pass a fixture.
- Never retain the obsolete authority-record sizes, reinterpret
  model-identity SHA-256 as file content SHA-256, or introduce an
  unauthenticated metadata side channel merely to unblock the loader.
- Missing CPU toolchain/model authorization leaves Task 10 open. Do not
  download implicitly or substitute a different model/profile.
- A failed core patch does not modify the verified original source object.
  Remove only task-owned patched/build/staging roots after exact validation.
- Preserve Task 08 locks, Task 09 protocol/authority work, the dirty checkpoint,
  and unrelated user changes.

## Manual Gates

- `MANUAL GATE — CPU model fixture`: approve exact origin, model identity,
  size, SHA-256, license, and local use before real load/transcription.
- `MANUAL GATE — native toolchain`: authorize any missing compiler/CMake/Ninja
  installation and license.
- `MANUAL GATE — licenses/SBOM`: local staging is not redistribution approval.
- No commit, push, signing, packaging, upload, publication, or release is
  authorized. Representative Windows execution is prohibited until Task 20.

## References

- `../spec.md`: Sections 6, 7.2-7.4, 8, 15, 18.1 and acceptance rows
  `AC-AUTO-002`, `AC-AUTO-008`, `AC-AUTO-013`, `AC-AUTO-024`,
  `AC-AUTO-033`, `AC-AUTO-044`, `AC-AUTO-050`, `AC-AUTO-052`,
  `AC-AUTO-053`, `AC-AUTO-056`, `AC-AUTO-060`, `AC-AUTO-061`.
- `08_deterministic_native_source_and_toolchain_locks.md` and
  `09_shared_worker_protocol_model_authority_and_lifecycle.md`.
- Commit-pinned loader/read evidence recorded in `../decisions.yaml`.

## Completion And Handoff

After all mandatory Linux checks pass, update `todo.md` and `handoff.md` with
patch/manifest/profile/model-fixture identities, exact verification, private
manual gates, and the Windows Task-20 deferral. Name Task 11 as next. Stop
before Task 11, commit, push, signing, packaging, publication, or release.
