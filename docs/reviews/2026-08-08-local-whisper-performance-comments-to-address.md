# Local Whisper Performance Review Comments to Address

Date: 2026-08-08  
Source review: [`2026-08-08-local-whisper-performance-review.md`](2026-08-08-local-whisper-performance-review.md)  
Assessment basis: current `feat/local-whisper-provider` source at `0776fd9e`, directly related
tests and qualification code, the approved Local Whisper specification, and the approved but
not-yet-started native review remediation packets.

## Verdict

Address the review's central findings, but do not implement its recommended order or derived
timings as written. Source inspection found two material omissions in the review's model:

- a successful full model load currently hashes the model more often than the review counts; and
- each installation chunk is base64url-encoded twice, so the stated pipe expansion, decoder cost,
  and 192 KiB chunk limit do not describe the live protocol.

The first work should therefore establish a corrected end-to-end baseline. The low-risk duplicate
directory inspection, installation codec, and bounded transport improvements can then be addressed
against that baseline. Native SHA acceleration should follow the already-approved resource-ownership
and common-SHA remediation instead of being coupled to it.

## Address Before Performance Changes

### 1. Add privacy-safe phase measurements using the release-1 artifacts

**Review sections:** 1, 2.1, 4, 6.6, and 9  
**Locations:**

- `scripts/local-whisper/qualification/DirectEngineQualificationRunner.ts:136`
- `scripts/local-whisper/qualification/ProductionApplicationQualificationRunner.ts:513`
- `src/main/localWhisper/composition/LocalWhisperProductionWorkerPort.ts:353`
- `src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts:367`
- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp:413`

The review is right that phase instrumentation is a prerequisite. The current qualification code
records whole direct-engine or transcription durations and resource samples; it does not expose
lease/directory proof, guarded launch, authority transfer, model preflight, model load, warm-up, or
host-to-device phases. The `LocalWhisperMetrics` owner named by the review does not exist in the
current tree.

Measure the production full-load and installation paths at the named revision on representative
Linux and Windows hosts. Record warm- and cold-cache cases separately and use the exact release-1
catalog artifacts. In particular, the approved specification selects `large-v3/q5_0` at
1,081,140,203 bytes and `large-v3-turbo/q5_0` at 574,041,195 bytes, not the 3.1 GB and 1.6 GB full
variants used for the review's estimates. `medium/full` at 1,533,763,059 bytes is the largest
release-1 file.

The measurement should establish, with units and variance:

- every directory proof and native/worker digest phase;
- guarded process creation and authority transfer;
- preflight, whisper.cpp load, warm-up, and GPU upload/allocation proof;
- installation encode, pipe wait, native decode, and native write time; and
- peak main, guard, worker RAM, and GPU VRAM.

Keep these measurements qualification-owned and privacy-safe. Do not emit model paths, model
contents, audio, transcripts, device identities, or new routine production telemetry.

### 2. Complete the existing safety prerequisites first

**Review section:** 7  
**Existing owners:**

- `docs/specs/local-whisper-native-review-remediation/tasks/02_fs_guard_resource_ownership.md`
- `docs/specs/local-whisper-native-review-remediation/tasks/03_fs_guard_input_and_typed_commands.md`
- `docs/specs/local-whisper-native-review-remediation/tasks/05_common_crypto_and_frame_contracts.md`
- `docs/specs/local-whisper-native-review-remediation/tasks/08_cross_platform_remediation_gate.md`

The review is correct that filesystem-guard resource ownership, descriptor/handle balance tests,
Linux/Windows `LIST` agreement, and common SHA-256 consolidation must precede performance changes
in those areas. None of those approved packets has started.

Do not create duplicate performance tasks for the same corrections. Treat Packet 02's RAII and
failure-injection work, Packet 03's exact Linux `LIST` contract, Packet 05's common SHA-256 and
cross-provider vectors, and Packet 08's platform resource checks as dependencies. The performance
work must preserve their acceptance criteria and must not weaken a check to obtain a faster result.

## Address After the Corrected Baseline

### 3. Reuse the first validated directory result inside the launch-lease methods

**Review sections:** 2.2, passes 1-2, and 9 item 3  
**Locations:**

- `src/main/localWhisper/filesystem/ManagedArtifactStore.ts:527`
- `src/main/localWhisper/filesystem/ManagedArtifactStore.ts:554`
- `src/main/localWhisper/filesystem/ManagedArtifactStore.ts:625`

The immediate duplication identified by the review is present. `leaseInstalledArtifact` performs
and discards a validated `inspectDirectory` result; both `leaseInstalledRuntimeForLaunch` and
`leaseInstalledModelForLaunch` immediately inspect and validate the same held directory again to
recover a particular entry.

Return or retain the first validated entry map within the same acquisition operation and reuse it
when constructing the runtime/model launch lease. Apply the correction to both runtime and model
launches. Keep the later pre-spawn and pre-load revalidations until their distinct proof points have
been measured and reviewed.

Add focused tests that count native inspections and prove that a mutation at each retained
revalidation point still fails closed. Do not describe the two current calls as universally
"provably redundant": another same-user process can mutate a managed file between asynchronous
checks, so safety comes from retaining the later proof points, not merely from holding a read-only
descriptor.

### 4. Review the Linux-only native digest duplication as a security-contract decision

**Review sections:** 2.2, passes 3-4; 2.7.2; and 9 item 2  
**Locations:**

- `runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp:293`
- `runtime/local-whisper/fs-guard/src/platform/linux/model_authority_server.cpp:113`
- `runtime/local-whisper/fs-guard/src/platform/windows/windows_model_authority_server.cpp:10`

Linux hashes the held model in `run_linux_model_launch` and hashes it again while constructing
`LinuxModelAuthorityServer`; Windows performs the first hash but has no second authority-server
hash. This divergence should be addressed, but Windows parity alone does not prove that the second
Linux pass has no security value: an external writer can change the open file between the two
reads.

First define which point must establish the guard's fresh content proof under `SEC-011`. If the
first guarded hash plus the later exact worker reads satisfies that contract, pass typed validated
evidence into the authority server and remove the second read. Preserve the two worker passes:
preflight and whisper.cpp consumption authenticate different reads and must remain.

The current full-load count also needs correcting before savings are estimated. In addition to the
two acquisition-time `LIST` calls, the live path invokes model `revalidate()` once in
`NativeLauncherProcessOwner.launch` and again in `LocalWhisperWorkerSupervisor.load`. Including the
native and worker reads, a successful load currently performs eight full model hashes on Linux and
seven on Windows, not six and five. Instrumentation should verify that count rather than relying on
the review's derived totals.

### 5. Remove the installation path's double base64url encoding and optimize the decoder

**Review sections:** 3.1, 3.2, and 9 item 4  
**Locations:**

- `src/main/localWhisper/filesystem/NativeManagedFilesystemAdapter.ts:121`
- `src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.ts:24`
- `runtime/local-whisper/fs-guard/src/common/protocol.cpp:34`
- `runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp:730`
- `runtime/local-whisper/fs-guard/src/platform/windows/windows_backend.cpp:827`

The review correctly identifies the text codec as installation work, but it misses one encoding
layer. `appendStagedFile` first converts raw bytes to base64url text. The generic transport then
base64url-encodes that text again. Native `parse_request` decodes the outer field, and both backend
`write_file` implementations decode the inner field.

For a 64 KiB raw chunk, the nested chunk field is 116,510 characters, approximately 1.778 times the
raw bytes before line overhead. It is not the single-layer 1.333 expansion used by the review.
Consequently, the review's pipe-traffic and decoder-time estimates must be discarded and measured
again on the actual path.

Give the transport a byte-field operation so `WRITE_FILE` carries one canonical base64url layer.
After the outer protocol decode, the command should own the raw bytes and the platform backends
should write them directly. Then apply the measured decoder improvements: one compile-time inverse
table and an allocation-free canonical-form check that explicitly rejects impossible length modulo
four and non-zero tail bits.

Preserve the exact canonical grammar with boundary and invalid-alphabet/tail-bit vectors. Benchmark
the complete TypeScript-to-real-guard path on both platforms, not only the standalone C++ decoder.

### 6. Increase chunks only within the real line budget, then pipeline with transport-owned bounds

**Review sections:** 3.3, 5.2, 5.10, and 9 items 5-5b  
**Locations:**

- `src/main/localWhisper/artifacts/FileBackedArtifactStreamingWorker.ts:20`
- `src/main/localWhisper/artifacts/StreamingArtifactExtractor.ts:102`
- `src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.ts:46`
- `runtime/local-whisper/fs-guard/include/local_whisper/fs_guard/protocol.hpp:13`

The proposed 192 KiB chunk is not valid. With one base64url layer, 192 KiB produces exactly
262,144 encoded characters, leaving no room for request ID, version, command, file token, or tabs.
With the current double encoding, the chunk field alone is 349,526 characters. Either shape exceeds
the 262,144-byte line contract once the complete request is considered.

After removing the second encoding layer, derive the maximum raw payload from the complete
worst-case line and retain an explicit safety margin; do not duplicate `kMaxLineBytes` arithmetic as
an unexplained chunk constant. Add exact-limit and one-byte-over tests across the TypeScript
transport and native guard.

If measured round-trip latency remains material, pipeline writes through a bounded transport-owned
window and honor Node stream backpressure when `stdin.write()` returns `false`. The transport owns
the `pending` map and stream, so it should own the in-flight and buffered-byte invariants rather than
relying on every caller to choose a safe window. The extractor must preserve hash/write order,
await or settle all issued writes after failure, and only then discard staging. Test slow guards,
`drain`, mid-window failure, cancellation, late responses, and deterministic cleanup. Choose the
window from measurement rather than adopting 8 or 16 as an unverified production value.

### 7. Add x64 runtime-dispatched SHA-256 acceleration after common-SHA consolidation

**Review sections:** 2.3, 2.7.1, 7.3-7.4, and 9 item 8  
**Locations:**

- `runtime/local-whisper/common/src/sha256.cpp`
- `runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp:307`
- `runtime/local-whisper/fs-guard/src/platform/windows/windows_backend.cpp:526`
- `docs/specs/local-whisper-native-review-remediation/tasks/05_common_crypto_and_frame_contracts.md`

The measured scalar-versus-hardware direction is compelling and the common digest is on the model
hot path. Address it as a separate performance change after Packet 05 has removed the duplicate
hand-written implementations and established lifecycle, overflow, streaming, and Windows CNG
agreement tests.

For the current production scope, implement and measure x64 runtime dispatch for GCC/Clang and
MSVC, with the hardened scalar code retained as the fallback. Do not use a build-wide `-msha` or a
host-native build. Keep Windows CNG on its existing filesystem-list path unless direct evidence
shows a better safe alternative. ARM acceleration is not required by the current x64-only
production profiles and should not expand this task without a platform-scope decision.

Use the proposed implementation's own scalar/accelerated benchmarks and end-to-end load phases as
the acceptance evidence; OpenSSL throughput is not evidence that a new intrinsic implementation
will achieve the same rate. Test forced scalar and forced accelerated paths, unsupported CPUs,
standard and boundary vectors, multi-gigabyte length handling, chunk splits, and Linux/Windows
agreement.

## Address as Measured Follow-ups

### 8. Shorten the WAV buffer lifetime if worker peak RAM confirms the derived pressure

**Review section:** 2.6  
**Locations:**

- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp:479`
- `runtime/local-whisper/whisper-cpp/core/pcm_audio.cpp:16`

Source confirms that the complete 16-bit WAV vector remains alive while a separate float PCM vector
is used for inference. Measure the maximum accepted audio fixture and, if the expected peak is
observed, destroy or swap out the WAV storage before starting the inference thread. Prefer a scope
or explicit ownership transfer that guarantees release; `shrink_to_fit()` alone is non-binding.

Verify peak RSS before/after, cancellation, malformed-audio cleanup, transcript correctness, and a
second transcription in the same resident worker. This is a memory-bound follow-up, not evidence
for changing model-load latency priorities.

### 9. Pin effective backend options without silently changing performance

**Review sections:** 6.1-6.3 and 9 item 9  
**Locations:** `runtime/local-whisper/toolchains/profiles/*.json`

The CUDA performance flags named by the review are absent, and Windows and Linux do not currently
pin the same CPU option set. That should be addressed as build-contract hygiene before the next
whisper.cpp revision can change effective defaults without a profile diff.

Record the current effective values only after proving that each option exists and is consumed by
the pinned upstream revision. Make the intended Linux/Windows parity explicit and verify the
generated CMake cache and exact pack outputs. Any value change—flash attention included—requires
separate representative CPU/CUDA measurements and qualification; this item must not smuggle in an
unmeasured backend optimization.

### 10. Measure the GPU-path CPU thread ceiling instead of retaining a magic value

**Review sections:** 5.8 and 6.4  
**Locations:**

- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp:235`
- `runtime/local-whisper/whisper-cpp/core/cpu_probe.cpp:15`

The GPU load path passes a literal `4` into `CpuProbe`, which caps warm-up, mel-spectrogram, and
other CPU-side work at four threads. The review is correct that larger hosts may be underused.
However, the current probe resolves `min(requested_threads, hardware_concurrency())`, so the claim
that this literal necessarily oversubscribes smaller hosts is not supported by the implementation.

Add a qualification experiment over representative CPU counts and GPU models, reporting load,
warm-up, transcription, CPU use, and variance. If four is not the best stable ceiling, derive and
name the selected policy from topology evidence. Do not expose the CPU-only settings field on the
GPU contract or select all logical processors without measurements.

## Review Comments Not Carried Forward

- **Do not add a metadata-keyed `LIST` digest cache or change startup inventory to metadata-only
  proof under the current contracts.** The approved native remediation specification explicitly
  states that no metadata-keyed digest cache is authorized. The parent specification also requires
  exact model verification before first load in each app process, full rehash after identity/size/
  metadata change, inventory rehash, and runtime digest revalidation before spawn. A different
  startup contract requires a specification decision first. A digest-optional command may still be
  considered for individual callers that demonstrably do not require content proof, but it is not
  the review's proposed startup shortcut.
- **Do not use the review's 3.1 GB timing table, six/five pass counts, +33% installation traffic,
  or 192 KiB chunk as planning inputs.** They do not match the release-1 artifact matrix or live
  call/encoding paths described above.
- **Do not remove either `ExactModelReader` verification pass.** They authenticate the preflight
  and whisper.cpp-consumed byte streams separately.
- Preserve the review's rejections of a Linux buffered model reader, model `mmap`, CUDA-upload-first
  work, CUDA JIT cache variables, and a threaded filesystem guard.
- Defer Windows tiny-read buffering, read/hash overlap, concurrent installs, libuv pool tuning,
  additional worker threads, flash attention, and CPU micro-architecture pack variants until the
  corrected measurements identify them as material. CPU pack variants also require a `PKG-010`
  specification change and CPUID-based selection; they are not a source-only fix.
- Do not introduce a raw binary installation channel until the single-encoding decoder, safe chunk
  size, and bounded pipeline have been measured. Those smaller changes may remove enough cost
  without expanding the protocol surface.
- Keep the current one-second inference warm-up until phase timing shows it is a material problem.
  The native worker currently performs the real warm-up inside its load operation; the later main
  `warmup` request is only an acknowledgement state transition. Removing the native inference
  without replacement would discard first-run allocation/kernel evidence.

## Verification Gaps

This assessment validates current source paths and authoritative contracts but does not reproduce
the source review's microbenchmarks. No model, GPU, Windows, native sanitizer, or packaging run was
performed, and no implementation was changed. Every performance item above therefore requires the
same-input before/after measurement and focused correctness/resource checks when implemented.
