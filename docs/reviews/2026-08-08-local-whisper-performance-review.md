# Local Whisper Performance Review — Model Load and Installation

Date: 2026-08-08
Branch: `feat/local-whisper-provider`
Companion to: [`2026-08-08-local-whisper-native-review.md`](2026-08-08-local-whisper-native-review.md),
[`2026-08-08-local-whisper-native-ci-security-checks.md`](2026-08-08-local-whisper-native-ci-security-checks.md)

Review goals:

1. Reduce the long load of model weights into video memory.
2. Reduce the long program load and installation.
3. Keep every optimization safe — no memory or descriptor leaks, no weakened security
   invariants.

## Method and Honesty Notes

Numbers below are labelled:

- **MEASURED** — benchmarked locally on this machine (x86-64, AVX2 + `sha_ni`, warm page cache,
  `-O2`). Benchmarks reproduce the repository's exact algorithm shapes.
- **DERIVED** — measured throughput multiplied by an artifact size. Not an end-to-end timing.
- **UNVERIFIED** — could not be measured here (no GPU, no installed model on the review
  machine). Flagged so nobody treats it as fact.

Model sizes used as inputs are the standard upstream ggml sizes (`large-v3` full ≈ 3100 MB,
`large-v3-turbo` ≈ 1600 MB, `medium` ≈ 1500 MB, `small` ≈ 488 MB, `q5_0` variants substantially
smaller). They were **not** read from the project catalog — no declared `sizeBytes` values were
found there. Re-derive with the catalog's real figures before planning work.

**Two initial hypotheses were disproved by measurement and are documented as
non-recommendations in section 8.** Please read that section before implementing anything.

**Section 6 covers the CPU and CUDA backend build configuration** — the ggml/whisper flag matrix across all four production profiles, the three project-owned whisper.cpp patches, and two corrections to section 5. It was added after the first version of this review covered the engine adapter but not the backend build options.

**Section 5 covers multiprocessing and multithreading** — which parallelism opportunities are real,
which are blocked by the algorithm or by a security model that must not change, and the thread-safety
and memory-bound conditions each one carries. The single recommended parallelism change (5.2) needs
no new threads and no protocol change, but it is unsafe without the two bounds stated there.

### Platform scope of these measurements

All benchmarks were run on **Linux x86-64**. Windows was analysed by reading
`fs-guard/src/platform/windows/**`, `launcher/src/platform/windows/**`, and
`whisper-cpp/platform/windows/**`, not by measurement. macOS is out of scope: the managed
filesystem is unimplemented there (`MacOSManagedFilesystemAdapter` rejects every operation with
`UNSUPPORTED`), so no model load or install path exists to optimize.

**This matters more than usual here, because the two platforms do not share the hot-path
implementations.** Section 2.7 documents the divergences found; several of them invert a
recommendation depending on platform. Read 2.7 before applying anything from sections 2-4, and
treat every derived figure as Linux-only until re-measured on Windows.

## 1. Measured Baseline

| Component | Rate |
| --- | --- |
| fs-guard nested SHA-256 (byte-at-a-time `update`) | **322.6 MB/s** |
| `common/src/sha256.cpp` SHA-256 (block copy) | **422.9 MB/s** |
| OpenSSL EVP SHA-256 (SHA-NI hardware path), 16 KiB blocks | **4613 MB/s** |
| Node `Buffer.toString('base64url')`, 64 KiB chunk | **7112 MB/s** |
| fs-guard `base64url_decode` as written (per-call table + canonical re-encode) | **293.1 MB/s** |
| fs-guard `base64url_decode` (static table, inline canonical check) | **615.9 MB/s** (2.10x) |
| `pread(4 bytes)` x 103,730, warm cache | **20.8 ms total** (0.20 us/call) |

The headline ratio: **the project's hand-rolled scalar SHA-256 is roughly 11x slower than the
hardware-accelerated SHA-256 available on every x86-64 CPU since ~2016 and every ARMv8 CPU with
crypto extensions.** Every finding in section 2 is a multiple of that ratio.

**Windows already avoids this ratio on one of the two hot paths.**
`fs-guard/src/platform/windows/windows_backend.cpp:526` hashes directory entries with the CNG
platform API (`BCryptOpenAlgorithmProvider(BCRYPT_SHA256_ALGORITHM, ...)`), which is
hardware-accelerated, while the Linux backend hand-rolls the slowest of the four in-tree
SHA-256 copies. The 322.6 MB/s row above therefore describes **Linux only**. See 2.7.1.

## 2. Goal 1 — Model Weights Into Video Memory

### 2.1 The bottleneck is not the PCIe transfer (reframing the goal)

UNVERIFIED but bounded by arithmetic: a 3100 MB host-to-device copy over PCIe 4.0 x16 at a
realistic 6-12 GB/s effective rate is **0.25-0.5 s**. Even pageable (non-pinned) memory at
~3 GB/s is ~1 s.

The perceived "slow VRAM load" is therefore almost entirely **not** the GPU upload. It is
SHA-256 in front of it. Optimizing the CUDA path first would spend effort on under 1 s of a
~50 s operation.

**Action:** before any CUDA-side work, instrument the load with phase timings (lease + LIST,
guard digest, authority transfer, worker preflight, worker load pass, `warm_up`, H2D upload).
The existing `LocalWhisperMetrics`/qualification harness is the natural place. Confirm the split
on real hardware, then optimize what the data shows.

### 2.2 P1 — Six full SHA-256 passes over the model file per load (highest impact)

Tracing one `fullLoad` of a model. **The pass count differs by platform — Linux has six, Windows
has five.**

| # | Pass | Where | Linux impl / rate | Windows impl / rate |
| --- | --- | --- | --- | --- |
| 1 | `LIST` inside `leaseInstalledArtifact` | guard `list_directory` | `hash_file`, byte-at-a-time, 322.6 MB/s | `sha256_file`, BCrypt CNG, hardware |
| 2 | `LIST` inside `leaseInstalledModelForLaunch` | same, called again | byte-at-a-time, 322.6 MB/s | BCrypt CNG, hardware |
| 3 | model digest before launch | Linux `model_launch_application.cpp:293`; Windows `windows_model_launch_application.cpp:423` | block copy, 422.9 MB/s | block copy, 422.9 MB/s |
| 4 | `validate_regular_file_evidence` | Linux `model_authority_server.cpp:148` | block copy, 422.9 MB/s | **does not exist** |
| 5 | Preflight `verify_complete()` | worker `ExactModelReader` | block copy, 422.9 MB/s | block copy, 422.9 MB/s |
| 6 | Load pass `verify_complete()` after `rewind_after_verified_pass()` | worker | block copy, 422.9 MB/s | block copy, 422.9 MB/s |

`WindowsModelAuthorityServer` (`windows_model_authority_server.cpp`, 36 lines) only validates the
handle type and calls `DuplicateHandle`; it performs no digest. So **pass 4 is a Linux-only
extra**, which is useful evidence: Windows ships without it and the authority contract still
holds, confirming that pass 4 is genuinely redundant rather than load-bearing (see 2.7.2).

Call sites:

- `src/main/localWhisper/filesystem/ManagedArtifactStore.ts:543` (in `leaseInstalledArtifact`)
- `src/main/localWhisper/filesystem/ManagedArtifactStore.ts:642` (in
  `leaseInstalledModelForLaunch`, which already called `leaseInstalledArtifact` above it)
- `runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp:293`
- `runtime/local-whisper/fs-guard/src/platform/linux/model_authority_server.cpp:148`
- `runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp:323` and `:350`

DERIVED cost for `large-v3` full (3100 MB), **Linux**:

```
passes 1-2 (byte-at-a-time) : 2 x 3100/322.6 = 19.2 s
passes 3-6 (block copy)     : 4 x 3100/422.9 = 29.3 s
                              -----------------------
                              total          ~ 48.5 s   and ~18.6 GB of reads
```

For `medium` (1500 MB) this is ~23 s; for `small` (488 MB) ~7.6 s.

DERIVED for **Windows**, same model: passes 1-2 run on BCrypt (call it ~4000 MB/s pending
measurement, so ~1.6 s combined) and pass 4 does not exist, leaving three block-copy passes:

```
passes 1-2 (BCrypt CNG)     : ~1.6 s   (UNVERIFIED rate)
passes 3, 5, 6 (block copy) : 3 x 3100/422.9 = 22.0 s
                              -----------------------
                              total          ~23.6 s   and ~15.5 GB of reads
```

So Windows is already roughly **2x faster than Linux on this path** without any of the work
below. The gap is entirely attributable to the two divergences in 2.7.

**Which passes are safe to remove.** This is the critical distinction for goal 3:

- **Passes 3 and 4 are provably redundant — Linux only.** Same process, same descriptor, same
  expected digest (`binding.artifact_content_sha256` is `parse_hex(request.model_sha256)` from
  pass 3), no state change in between. Collapsing them removes no security property, and Windows
  already ships without pass 4. **Saves ~7.3 s on Linux; no-op on Windows.**
- **Passes 1 and 2 are provably redundant — both platforms.**
  `leaseInstalledModelForLaunch` calls `leaseInstalledArtifact` (which issues `LIST`) and then
  issues `LIST` again on the same lease, with no mutation between. Reuse the first result. The
  fix is in shared TypeScript (`ManagedArtifactStore`), so it lands on both platforms at once.
  **Saves ~9.6 s on Linux, ~0.8 s on Windows.**
- **Passes 5 and 6 must both stay — both platforms.** Pass 5 authenticates the bytes the
  preflight parsed; pass 6 authenticates the bytes whisper.cpp's loader actually consumed. They
  cover different byte streams and removing either weakens the exact-load contract. Accelerate
  them instead (2.3), do not delete them. Both run through the shared
  `common/src/sha256.cpp`, so accelerating that one file fixes both platforms.

Net after 2.2 alone: Linux 48.5 s -> ~31.6 s; Windows 23.6 s -> ~22.8 s. No security change on
either platform.

### 2.3 P2 — Hardware-accelerated SHA-256

MEASURED: 422.9 MB/s scalar vs 4613 MB/s SHA-NI = **10.9x**.

Combined with 2.2 (four remaining passes, or two if the LIST hashing is made lazy per 2.4):

```
current                        ~48.5 s
after 2.2 (dedupe)             ~31.6 s
after 2.2 + SHA-NI             ~ 2.9 s
after 2.2 + SHA-NI + 2.4       ~ 1.4 s
```

**Implementation constraint.** `AGENTS.md` forbids adding dependencies without explicit scope,
so do **not** pull in OpenSSL for the native workers. Add an accelerated code path to the
existing `common/src/sha256.cpp`:

- x86-64: `sha_ni` intrinsics (`_mm_sha256rnds2_epu32`, `_mm_sha256msg1_epu32`,
  `_mm_sha256msg2_epu32`) behind a runtime CPU-feature check
- ARM64: `vsha256hq_u32` / `vsha256h2q_u32` / `vsha256su0q_u32` / `vsha256su1q_u32`
- Keep the current scalar implementation as the fallback for CPUs without the extensions

Runtime dispatch (not compile-time `-march`) is required, because the packs are built once and
shipped to unknown CPUs.

**Cross-platform implementation differences — these are not interchangeable:**

| Concern | GCC / Clang (Linux) | MSVC (Windows) |
| --- | --- | --- |
| Feature detection | `__builtin_cpu_supports("sha")`, or `<cpuid.h>` `__get_cpuid_count(7, 0, ...)` EBX bit 29 | `__cpuidex(regs, 7, 0)`, EBX bit 29. No `__builtin_cpu_supports`. |
| Enabling the intrinsics | Requires `__attribute__((target("sha,sse4.1,ssse3")))` on the accelerated function, or a separate TU built with `-msha -msse4.1` | No per-function attribute needed; MSVC permits intrinsics unconditionally |
| Header | `<immintrin.h>` (or `<shaintrin.h>`) | `<immintrin.h>` |
| ARM64 | `<arm_neon.h>` with `+crypto` | `<arm64_neon.h>`; feature check via `IsProcessorFeaturePresent(PF_ARM_V8_CRYPTO_INSTRUCTIONS_AVAILABLE)` |

If a per-function `target` attribute is used on GCC/Clang, that function must not be inlined into
the dispatcher, or the compiler may hoist SHA instructions into code reached on non-SHA CPUs.
Keep the accelerated block transform in its own translation unit on both platforms — it is the
one arrangement that behaves identically under all three compilers.

**Precedent already in the tree, and the asymmetry that motivates this:** the Windows guard
already uses the platform crypto API (BCrypt CNG) for exactly this purpose
(`windows_backend.cpp:526`). The project has therefore already accepted hardware-accelerated
hashing — it just never did the Linux half. An alternative to intrinsics on Linux is
`libcrypto`, but that adds a link dependency to a binary that is currently self-contained;
`AGENTS.md` requires explicit scope for new dependencies. Intrinsics with runtime dispatch keep
the guard and worker self-contained on both platforms, so that is the recommendation.

**Correctness safety net already exists:** the cross-language conformance vectors
(`native-worker-quality.mjs proof` / `authority`, plus `common/python/reference_codec.py`) give
you a ready oracle. Run both the scalar and accelerated paths against the same vectors, and add
a differential test asserting the two implementations agree on random inputs of every length
0..256 plus block-boundary sizes (55, 56, 63, 64, 65, 119, 120).

**Also delete the duplicate implementations while here.** The companion review's M4 documents
four SHA-256 copies, one with a latent out-of-bounds write. Accelerating one copy and leaving
three scalar copies on hot paths would be the worst outcome. The fs-guard's nested copy is the
slowest one *and* sits on passes 1-2.

### 2.4 P3 — `LIST` hashes every file in the directory on every call

`linux_backend.cpp:588` calls `hash_file(fd)` for **every** entry it lists, using the
byte-at-a-time digest. This is what makes passes 1-2 the most expensive in the table despite
being "just a directory listing."

Windows does the same thing structurally (`windows_backend.cpp:628` appends `sha256_file(file)`
to every entry) but pays far less for it because BCrypt is hardware-accelerated. The **shape** of
the fix below applies to both platforms; the **urgency** is Linux-first.

`ManagedArtifactStore` uses `LIST` for two different needs:

- **metadata identity** (`identity_string`: dev, ino, nlink, mode, parent ino, size, type) —
  cheap, `fstat` only
- **content digest** — expensive, full file read

Most call sites only need the former. Make the content digest **opt-in** per request
(`LIST` vs a `LIST_DIGEST` command, or a per-entry flag), and have callers that genuinely need
content proof ask for it explicitly. For repeat calls, cache the digest keyed on
`(st_dev, st_ino, st_size, st_mtim)` and invalidate on mismatch — the guard already holds the
directory descriptor, so the cache cannot be fooled by a swap it did not observe.

This is also the fix for the startup cost in 3.4.

### 2.5 P4 — `warm_up` runs a full inference on every load

`whisper_engine.cpp:365-379` runs `whisper_full` over 16,000 samples (1 s) of silence at every
load, plus `AbortInstallation` setup. UNVERIFIED cost — it covers graph allocation and first-run
kernel selection, and is likely worth keeping, but it belongs in the phase instrumentation from
2.1 so its real share is known rather than assumed.

### 2.6 P5 — Transient host memory during transcription

Not load latency, but relevant to goal 3. In the transcribe path, `wav`
(up to `kCanonicalWavMaxTotalBytes` ≈ 57 MB) stays alive for the entire inference even though
`PcmAudio` has already converted everything to floats (up to ~115 MB). Peak ≈ 173 MB of host
memory that could be ~115 MB:

```cpp
const auto audio = PcmAudio::from_canonical_wav(wav);
wav.clear();
wav.shrink_to_fit();          // release before inference starts
```

### 2.7 Cross-Platform Divergences on the Hot Path

These were found while checking whether sections 2.2-2.6 apply to Windows. Two of them are
performance divergences; one is a behavioural divergence with security relevance and belongs in
the companion code review as well.

#### 2.7.1 The same protocol field is produced by two different SHA-256 implementations

`LIST` returns `name~identity~sha256` for each entry. That `sha256` field is computed by:

- Linux: `Impl::Sha256`, hand-rolled, nested inside `LinuxBackend::Impl`
  (`linux_backend.cpp:307-406`), byte-at-a-time, **322.6 MB/s** MEASURED
- Windows: BCrypt CNG (`windows_backend.cpp:526`), hardware-accelerated

Consequences, in order of importance:

1. **Performance.** Linux is ~11x slower than it needs to be on a path that runs at every model
   load *and* every startup probe (3.4). This is the single largest platform-specific cost in the
   review.
2. **Correctness risk with no test.** Two independent implementations produce a value that the
   shared TypeScript compares byte-for-byte against catalog digests
   (`validateDirectoryEntries` -> `modelEntry.sha256 !== modelFile.sha256`). Nothing in CI
   asserts that the Linux and Windows guards agree on the same input. The existing
   cross-language vectors validate `common/src/sha256.cpp`, which **neither** of these two paths
   uses.
3. **Maintenance.** Combined with `launcher/src/common/sha256.cpp` and
   `common/src/sha256.cpp`, this is the fourth SHA-256 in the tree (companion review M4).

**Recommendation:** delete the nested Linux implementation, route the Linux guard through the
accelerated `common/src/sha256.cpp` from 2.3, and add a shared-vector test that both platform
backends must satisfy. Keeping BCrypt on Windows is defensible — it is already fast and it is the
platform-blessed API — but then the digest agreement needs an explicit test rather than an
assumption.

#### 2.7.2 Guard-side digest pass count differs (Linux has one extra)

Documented in the 2.2 table. Linux runs `validate_regular_file_evidence`
(`model_authority_server.cpp:148`) in the `LinuxModelAuthorityServer` constructor, immediately
after `run_linux_model_launch` already hashed the same descriptor at line 293. Windows has no
equivalent. Treat the Linux extra as an accidental regression rather than a deliberate
defence-in-depth measure; Windows shipping without it is the strongest available evidence that it
is not required.

#### 2.7.3 `LIST` enforces a different contract on each platform (security-relevant)

This is a behavioural divergence, not a performance one, and it strengthens finding **M5** in the
companion code review.

- **Linux** (`linux_backend.cpp:751-761`): `Impl::list` validates the `expected_entries` argument
  and then **discards it**. `list_directory` accepts any entry passing `is_file_name`, so an
  unexpected-but-well-named file inside a managed artifact directory is silently listed. Modes are
  not checked against expectations.
- **Windows** (`windows_backend.cpp:609-633`): every entry must be present in `expected_modes` or
  the command fails with `UNSAFE_ENTRY`, and the expected mode is passed into `identity_string`.

So an attacker-planted extra file in a managed model directory is **rejected on Windows and
accepted on Linux**. The Linux guard is the weaker of the two, on the platform that is currently
the primary qualification target. Fix by making Linux enforce the Windows contract — the argument
is already parsed and validated there, it just needs to be used.

#### 2.7.4 Verified as consistent across platforms

- **CUDA architecture.** Both `linux-x64-cuda-12.8.1-sm120a-v1.json:166` and
  `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1.json:112,120` declare `120a-real`, enforced by
  `native-toolchain-core.mjs:90-94`. The no-PTX-JIT conclusion in 3.5 holds on both platforms.
- **The install-path fixes in section 3 are platform-neutral.**
  `NativeManagedFilesystemAdapter` is shared TypeScript and
  `fs-guard/src/common/protocol.cpp` is shared C++, so 3.2 and 3.3 land on both platforms from a
  single change. Only the measured *magnitudes* are Linux-specific.
- **Both worker `read_at` implementations are unbuffered.** Linux uses `pread`
  (`model_authority_linux.cpp:67-80`), Windows uses `ReadFile` with an `OVERLAPPED` offset
  (`model_authority_windows.cpp:103-115`). See 8.1 for why this still should not be changed, and
  for the Windows-specific caveat.

## 3. Goal 2 — Program Load and Installation

### 3.1 P6 — Every artifact byte crosses a text protocol in 64 KiB request/response round-trips

`src/main/localWhisper/filesystem/NativeManagedFilesystemAdapter.ts:121-123`:

```ts
public async appendStagedFile(fileToken: string, chunk: Uint8Array): Promise<void> {
  await this.transport.request('WRITE_FILE', [fileToken, Buffer.from(chunk).toString('base64url')]);
}
```

Driven from `StreamingArtifactExtractor.ts:102-112` with
`STREAM_CHUNK_BYTES = 64 * 1024` (`FileBackedArtifactStreamingWorker.ts:20`), and **awaited per
chunk**.

MEASURED and DERIVED for a 3100 MB model:

```
sequential WRITE_FILE round-trips : 49,600
base64 text over the pipe         : 4.33 GB  (vs 3.10 GB raw, +33%)
Node-side encode CPU              : 0.5 s     (7112 MB/s - not a problem)
guard-side decode CPU             : 11.1 s    (293.1 MB/s - the problem)
```

Each round-trip is a full Node write -> guard `std::getline` -> decode -> write -> response ->
Node parse handshake. At even 100 us of round-trip latency that adds ~5 s on top of the CPU
cost; the real figure needs measuring on the target platform.

**Platform applicability.** The code involved is entirely shared —
`NativeManagedFilesystemAdapter` (TypeScript) and `fs-guard/src/common/protocol.cpp` (C++) — so
both platforms pay the same 49,600 round-trips and the same +33% expansion, and both benefit from
3.2 and 3.3 from one change. The **latency** component is expected to be worse on Windows: the
transport is a Node `stdio` pipe in both cases, but Windows named-pipe round-trips are typically
several times more expensive than a Linux `pipe(2)` pair. Since 3.3 attacks the round-trip count
directly, it is likely to pay off *more* on Windows than the Linux-derived figures suggest.
Measure on Windows before sizing the work.

### 3.2 P7 — `base64url_decode` rebuilds its table per call and re-encodes to verify

`fs-guard/src/common/protocol.cpp:34-63`:

```cpp
std::string base64url_decode(const std::string_view input) {
  std::array<int, 256> inverse{};      // rebuilt on EVERY call - 49,600 times per model
  inverse.fill(-1);
  for (std::size_t index = 0; index < table.size(); ++index) { ... }
  ...
  if (base64url_encode(result) != input) {   // full re-encode of the whole payload
    throw GuardError(ErrorCode::kInvalidInput);
  }
```

MEASURED: 293.1 MB/s as written vs 615.9 MB/s with a `static` table and the canonical check
folded into the decode loop — **2.10x, saving ~5.8 s per model install**. Both changes are
behaviour-preserving:

- The table is a pure constant; make it `static constexpr` at namespace scope.
- Canonical form can be validated inline: reject any trailing bits that are non-zero (already
  done) and reject `input.size() % 4 == 1`. The re-encode-and-compare is a correct but redundant
  way to check the same property, and it also allocates a second full copy of every chunk.

### 3.3 P8 — Chunk size is 3x smaller than the protocol already allows

`kMaxLineBytes = 256 * 1024` (`fs-guard/include/local_whisper/fs_guard/protocol.hpp:13`). A
64 KiB chunk base64-encodes to 87,382 bytes — barely a third of the line budget. The largest
raw chunk that still fits is **192 KiB** (encodes to 262,144 bytes).

Raising `STREAM_CHUNK_BYTES` to 192 KiB cuts round-trips from 49,600 to ~16,533 with **zero
protocol change**, no new commands, and no security impact. Combined with 3.2 this is the
cheapest meaningful install win available.

Beyond that, a `WRITE_FILE` variant that carries raw bytes on a dedicated binary channel (the
framed codec in `common/frame_codec.hpp` already exists and is used for the worker) would remove
the +33% and the encode/decode entirely. That is a larger protocol change; do 3.2 and 3.3 first
and re-measure before deciding it is needed.

### 3.4 P9 — Startup hashes every installed artifact

`ManagedArtifactStore.ts:805` calls `inspectDirectory` on the installed-artifact evidence probe.
Via 2.4 that means the byte-at-a-time SHA-256 of every installed model runs **on every
launch**.

DERIVED: with `large-v3` full installed, ~9.6 s added to startup, every time. With several
models installed, it is additive.

The fix is 2.4 (make the content digest opt-in and cached). A startup probe needs to know *what
is installed and structurally intact*, which `identity_string` already proves from `fstat` alone.
Full content re-proof belongs at load time, where passes 5-6 already do it under the exact-read
contract.

### 3.5 Verified non-findings on the startup path

- **Startup job scheduling is already correct.** `FirstLaunchStartupCoordinator.runPendingJobs`
  (`src/main/firstLaunchStartupCoordinator.ts:127-136`) collects all jobs whose `dependsOn` is
  satisfied and runs them with `Promise.all`, looping until no job is runnable. That is proper
  dependency-ordered parallelism, not sequential execution. No change needed.
- **The install pipeline's own hashing is already fast.** `StreamingArtifactExtractor` and
  `FileBackedArtifactStreamingWorker` use Node `createHash('sha256')`, which is OpenSSL-backed
  and therefore already on the 4613 MB/s hardware path. MEASURED Node encode throughput is
  7112 MB/s. The TS side of installation is not a bottleneck; the guard side is.
- **No CUDA PTX JIT cost, on either platform.** `CMAKE_CUDA_ARCHITECTURES` is `120a-real` in both
  the Linux profile (`linux-x64-cuda-12.8.1-sm120a-v1.json:166`) and the Windows profile
  (`windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1.json:112,120`), enforced by
  `native-toolchain-core.mjs:90-94`. `-real` emits cubin without PTX, so there is nothing to JIT
  at load time. I had suspected the sanitized worker environment (Linux `{LANG=C, LC_ALL=C}` with
  no `HOME`; Windows `{SystemRoot, WINDIR}` only, so no `LOCALAPPDATA` and therefore no
  `%LOCALAPPDATA%\NVIDIA\ComputeCache`) would disable the CUDA compute cache and force a JIT on
  every launch. With `120a-real` that cannot happen on either platform. **Not a bottleneck.**
  (Corollary, not a performance matter: no PTX also means no forward compatibility to
  non-`sm_120a` GPUs, which appears intentional for hardware-matched packs.)

## 4. Consolidated Impact Estimate

DERIVED, `large-v3` full (3100 MB), warm page cache. Linux figures are from measured throughput;
Windows figures additionally assume a BCrypt rate of ~4000 MB/s, which is UNVERIFIED.

### Model load — Linux

| Stage | Current | After dedupe (2.2) | + SHA-NI (2.3) | + lazy LIST digest (2.4) |
| --- | --- | --- | --- | --- |
| SHA-256 total | ~48.5 s | ~31.6 s | ~2.9 s | ~1.4 s |
| Bytes read | 18.6 GB | 12.4 GB | 12.4 GB | 6.2 GB |
| H2D upload (UNVERIFIED) | ~0.25-0.5 s | unchanged | unchanged | unchanged |

### Model load — Windows

| Stage | Current | After dedupe (2.2) | + SHA-NI (2.3) | + lazy LIST digest (2.4) |
| --- | --- | --- | --- | --- |
| SHA-256 total | ~23.6 s | ~22.8 s | ~2.1 s | ~1.4 s |
| Bytes read | 15.5 GB | 12.4 GB | 12.4 GB | 6.2 GB |

Windows starts ~2x better and ends at the same place, because the endpoint is dominated by the
shared `common/src/sha256.cpp` passes that 2.3 accelerates on both platforms. Note that on Windows
the dedupe step (2.2) buys little — its value there is consistency, not speed.

### Installation — both platforms

| Stage | Current | After 3.2 | + 3.3 (192 KiB) | + 5.2 (window of 8) |
| --- | --- | --- | --- | --- |
| Guard base64 decode CPU | ~11.1 s | ~5.3 s | ~5.3 s | ~5.3 s (serial in the guard) |
| `WRITE_FILE` round-trips | 49,600 | 49,600 | ~16,533 | ~16,533 issued, ~2,067 latency-serialized |
| Pipe traffic | 4.33 GB | 4.33 GB | 4.33 GB | 4.33 GB |

Round-trip latency is not in this table because it was not measured; 5.2 attacks that term
specifically, while 3.2 attacks the guard CPU term. They are complementary.

Shared code, so both platforms move together. Round-trip latency is not in this table and is
expected to be the larger Windows term — see 3.1.

### Startup, per launch with one large model installed

| Stage | Linux current | Windows current | After 2.4 |
| --- | --- | --- | --- |
| Installed-artifact evidence probe | ~9.6 s | ~0.8 s | ~0 s (metadata only) |

## 5. Concurrency — Multiprocessing and Multithreading

Added after a dedicated review pass on parallelism. The short version: **exactly one high-value
parallelism opportunity exists, it is on the install path, and it needs no new threads and no
protocol change.** Most of the other candidates are either blocked by the algorithm, blocked by a
security model that must not change, or would parallelize work that should be deleted instead.

### 5.1 Process and thread topology today

| Process | Threading | Notes |
| --- | --- | --- |
| Electron main | Node event loop + libuv threadpool (default 4) | owns guard transport, artifact pipeline, supervisor |
| Renderer | one per window | no Local Whisper compute |
| fs-guard | **strictly single-threaded** | reads request lines with `getline`, dispatches in order |
| launcher | single thread + `poll` loop | proxies stdio, supervises the process group |
| model-launch guard | single thread | forks the launcher |
| whisper worker | main thread + **one** `std::thread` for inference; ggml uses `n_threads` internally | the only real in-process concurrency |

### 5.2 PAR-1 (recommended) — Pipeline `WRITE_FILE` with a bounded window

**The transport already supports this. The serialization is a caller-side choice.**

`NativeManagedFilesystemGuardTransport.request()`
(`src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.ts:46-63`) assigns a
monotonic `requestId`, registers the promise in a `pending` Map keyed by that ID, writes the line,
and returns. It does **not** await a prior request. Responses are correlated by ID at
`handleLine` (lines 107-113). So concurrent in-flight requests are already legal and already
correctly demultiplexed.

The serialization comes from one line in the caller —
`StreamingArtifactExtractor.ts:112`:

```ts
for await (const chunk of entry.chunks) {
  hash.update(chunk);
  await this.store.appendStagedFile(fileLease, chunk);   // <- one full round-trip per 64 KiB
}
```

That is **49,600 sequential round-trips** for a 3100 MB model.

**Why ordering is safe without locks.** `child.stdin.write()` appends to the stream buffer in call
order and flushes in order; the guard reads lines sequentially with `std::getline` and dispatches
each fully before reading the next. So N pipelined `WRITE_FILE` requests are applied in the order
`request()` was called. File append order is preserved. This is a property of the guard being
single-threaded — which is another reason not to thread it (5.6).

**Two mandatory safety conditions**, both currently absent:

1. **The window must be bounded.** `pending` is an unbounded `Map` (verified: no size cap anywhere
   in the file). Pipelining without a cap would hold every outstanding chunk plus its base64
   expansion in memory — for a 3 GB artifact that is a guaranteed out-of-memory, i.e. exactly the
   memory-leak class this must avoid. Use a fixed window (8-16 outstanding writes) and only issue
   the next chunk when one completes.
2. **`write()` backpressure must be honored.** Line 58 ignores the boolean return of
   `child.stdin.write()` and only handles the error callback. Under pipelining, ignoring a `false`
   return means Node buffers unboundedly in the stream's internal write queue even if the window
   caps outstanding *requests*. Wait for `drain` when `write()` returns `false`.

**What this does and does not buy.** It removes the *latency* term — 49,600 round-trips become
~49,600/window. It does **not** reduce the guard's ~11.1 s of decode CPU, because that work is
serial inside a single-threaded process. Pipelining and the base64 fix (3.2, measured 2.10x) are
complementary, not alternatives. Combined with 192 KiB chunks (3.3) the round-trip count drops to
~16,533 and then divides again by the window.

**Error handling.** With a window open, a failure on write *k* means writes *k+1..k+window* were
already sent. That is acceptable here because a failed staging directory is discarded wholesale
(`StreamingArtifactExtractor` calls `discardStaging` on any error), but the implementation must
drain and ignore the late responses rather than mis-attributing them.

### 5.3 PAR-2 (not recommended as a priority) — Parallel hashing of independent files

SHA-256 is Merkle-Damgard: a single stream's digest is inherently sequential and cannot be
parallelized without changing the output. What *can* run in parallel is **independent files**, which
is what `list_directory` hashes.

Reality check on the actual shapes: a model artifact directory is one multi-GB file plus a small
manifest, so per-file parallelism gains essentially nothing there — the one big file dominates
regardless of how many threads exist. Runtime packs have more files (worker plus CUDA libraries)
but they are far smaller.

Multi-buffer SHA-256 (AVX2 8-way, AVX-512 16-way, as in OpenSSL's `sha256_multi_block`) has the same
constraint: it needs several independent streams to fill the lanes.

**The better answer is 2.4 — make the `LIST` content digest opt-in and cached.** Parallelizing work
that should not be performed at all is the wrong optimization. Revisit per-file parallelism only if
a caller is found that genuinely needs many large files digested at once.

### 5.4 PAR-3 (defer) — Overlapping file reads with hashing

A reader thread feeding a bounded queue to a hasher thread only pays off when I/O and CPU are
comparable. They are not, today:

- warm page cache: copy runs at many GB/s against a 422.9 MB/s hasher — hash-bound, overlap gains
  approximately nothing;
- after SHA-NI (4613 MB/s measured) and on a cold cache, NVMe read and hash become comparable, and
  overlap could approach a 2x improvement on the cold-start case.

**So the ordering matters: do the hardware-accelerated digest first (2.3), then re-measure, then
decide.** Adding a producer/consumer thread pair now would add synchronization and lifetime risk for
no measurable gain.

### 5.5 PAR-4 (constrained) — Concurrent artifact installs

Downloading artifact A while writing artifact B to the guard overlaps two different resources
(network, guard CPU) and is a genuine win. But **all** managed writes funnel through one
single-threaded guard process, so guard-side work for concurrent installs serializes regardless of
how much concurrency the TypeScript side introduces. Treat the guard as the throughput ceiling for
any concurrent-install design, and fix 3.2/3.3/5.2 before adding install concurrency.

### 5.6 PAR-5 (explicitly not recommended) — Threading the fs-guard

The guard's entire safety argument depends on being single-threaded: one command in flight, a lease
map with no locking, descriptor ownership reasoned per-command, and no shared mutable state between
requests. Introducing threads there would require re-deriving that ownership model from scratch.

Additionally, the companion code review documents **eight descriptor leaks on exception paths in
this single-threaded code** (H1). Adding concurrency on top of code that already leaks under
sequential execution would multiply the failure modes and make them nondeterministic. Fix H1 first;
do not thread the guard.

### 5.7 PAR-6 (defer until TSan exists) — More threads in the worker

The worker already has one inference thread, and that is where the critical `std::terminate` defect
lives (companion review C1). The CI review records that **no ThreadSanitizer coverage exists**
(T2.3). Any additional worker threading should land after a TSan leg is running, not before.

### 5.8 PAR-7 (measure) — GPU-path CPU thread count is hardcoded

`worker_application.cpp:235`:

```cpp
const auto threads = cpu ? residency.at("resolvedCpuThreads").get<std::uint64_t>() : 4U;
```

The accelerator path pins CPU threads to a literal `4`, ignoring the probe-resolved count. ggml
still uses `n_threads` for CPU-side work on the GPU path — mel spectrogram computation and some
layers — so this both under-uses large hosts and over-subscribes small ones. This is also an
instance of the hardcoded-domain-constant issue flagged in the code review. Measure the correct
value rather than guessing, and derive it from the probe like the CPU path does.

### 5.9 PAR-8 (cheap check) — libuv threadpool sizing

Node's default `UV_THREADPOOL_SIZE` is 4 and is shared by async zlib (gunzip during extraction) and
filesystem operations. During a large install those compete. No code in the repository sets it
(verified: no `UV_THREADPOOL_SIZE` or `worker_threads` usage anywhere). Worth measuring whether the
extraction path is threadpool-starved before adding any other concurrency.

**Node `worker_threads` are not recommended here.** The main-thread CPU cost is already small:
measured base64 encode is 0.5 s per 3100 MB and Node's `createHash` runs on the hardware SHA-256
path, so per-chunk blocking is on the order of 14 microseconds. Moving that to a worker would add
complexity and cross-thread transfer cost for no meaningful responsiveness gain, and `createHash`
objects cannot be shared across threads.

### 5.10 Concurrency safety rules for any of the above

1. **Every queue, window, and pending map must be bounded.** The unbounded `pending` Map plus
   ignored `write()` backpressure is the specific memory-leak risk introduced by PAR-1.
2. **One hasher instance per stream.** Never share a `Sha256` or a Node `createHash` object between
   concurrent streams; the streaming state is not reentrant.
3. **New C++ threads use `std::jthread` with RAII join**, consistent with the C1 remediation. No
   `detach`, no joinable thread destroyed during unwinding.
4. **Deterministic shutdown for any thread pool.** The native tree already leaks descriptors on
   exception paths; a pool without RAII teardown would add thread leaks on top.
5. **Preserve request ordering explicitly** where it is load-bearing. PAR-1 is safe only because the
   guard processes lines serially; that property must be stated in the code, not assumed.
6. **Add the descriptor/handle-balance fixture first** (CI review T2.1) so any concurrency work has a
   leak detector underneath it.

## 6. Backend Build Configuration — CPU and CUDA

Added after a dedicated pass on the engine backends. The first version of this review covered the
**adapter** (`whisper_engine.cpp`) but not the **build configuration** or the whisper.cpp patches,
and that omission hid the single largest inference-side lever in the project.

Scope note: sections 2-5 measure model *load* and *install* latency, which were the stated goals.
This section covers backend compile-time configuration, which mostly affects *inference throughput*.
It is included because it also touches load behavior (warm-up cost, VRAM allocation, silent-fallback
policy) and because the flags are a prerequisite for interpreting any future inference measurement.

### 6.1 Flag matrix across all four production profiles

Read from `runtime/local-whisper/toolchains/profiles/*.json` `cmakeCache`. `-` means the flag is
**not pinned** in that profile and therefore inherits the upstream whisper.cpp/ggml default.

| Flag | linux-cpu | linux-cuda | win-cpu | win-cuda |
| --- | --- | --- | --- | --- |
| `GGML_CUDA` | OFF | **ON** | OFF | **ON** |
| `CMAKE_CUDA_ARCHITECTURES` | - | `120a-real` | - | `120a-real` |
| `CMAKE_CUDA_RUNTIME_LIBRARY` | - | Shared | - | Shared |
| `GGML_CUDA_FA` | OFF | **OFF** | - | - |
| `GGML_SSE42` | OFF | OFF | - | - |
| `GGML_AVX` / `AVX2` / `AVX512` | OFF | OFF | - | - |
| `GGML_F16C` / `FMA` / `BMI2` | OFF | OFF | - | - |
| `GGML_AMX_BF16` / `AMX_INT8` | OFF | OFF | - | - |
| `GGML_CPU_REPACK` | OFF | OFF | - | - |
| `GGML_BLAS` / `GGML_ACCELERATE` | OFF | OFF | - | OFF |
| `GGML_OPENMP` | **OFF** | **OFF** | **OFF** | **OFF** |
| `GGML_NATIVE` | OFF | OFF | OFF | OFF |
| `GGML_BACKEND_DL` | OFF | OFF | OFF | OFF |
| `GGML_STATIC` | ON | OFF | ON | ON |

### 6.2 CPU backend — every SIMD path is disabled

`GGML_SSE42`, `GGML_AVX`, `GGML_AVX2`, `GGML_AVX512` (and VBMI/VNNI/BF16), `GGML_F16C`, `GGML_FMA`,
`GGML_BMI2`, `GGML_AMX_*`, `GGML_CPU_REPACK`, `GGML_BLAS`, and `GGML_ACCELERATE` are all `OFF`. The
CPU worker is therefore compiled to the **baseline x86-64 ISA (SSE2 only)**, and the same applies to
the CPU-side operations inside the CUDA pack, since `GGML_CPU=ON` there too.

The whisper encoder is matmul-bound, and AVX2+FMA is the single largest CPU-side lever in ggml.
Commonly cited speedups for ggml with AVX2+FMA over baseline are in the 2-4x range — **UNVERIFIED
here**: I have no measurement of this workload, and this machine has no installed model to test
with. Treat the direction as reliable and the magnitude as unproven.

**This is deliberate, not an oversight.** `PKG-010` in the parent specification
(`docs/specs/local-whisper/spec.md:1210`) mandates the reviewed option set including
`GGML_NATIVE=OFF` and `GGML_BACKEND_DL=OFF`, and `decisions.yaml:3598` records the pinned defaults.
The rationale is coherent with the whole architecture: reproducible, portable, dependency-closed
builds with content-derived digests. A `-mavx2` binary would crash on a host without AVX2, and
`GGML_NATIVE=ON` would make the build host-dependent and destroy reproducibility.

**There is no CPU feature detection anywhere in the runtime.** `cpu_probe.cpp:15-38` resolves
`min(requested_threads, hardware_concurrency())` and runs a fixed 16K-element compute fixture for
liveness. It does not query CPUID or report ISA support. So the capability layer could not select an
AVX2 pack today even if one were built.

**Constructive option, consistent with the existing architecture.** The project already solves this
problem for GPUs: hardware-matched packs (`sm_120a`) selected through the capability probe. The same
mechanism could carry CPU micro-architecture variants — `cpu-baseline`, `cpu-avx2`,
`cpu-avx512` — each independently reproducible and dependency-closed, selected by a CPUID check
added to `CpuProbe`. That preserves every property `PKG-010` protects while recovering the SIMD
gains. The alternative, `GGML_BACKEND_DL=ON` with `GGML_CPU_ALL_VARIANTS`, lets ggml select a CPU
variant at runtime, but it conflicts with `PKG-010`'s explicit `GGML_BACKEND_DL=OFF` and with the
static-linking and dependency-closure evidence requirements.

Either path is a **specification change to PKG-010**, not a code fix, and should be driven by a
measurement on real hardware rather than by this review.

### 6.3 CUDA backend

- **Architecture** is `120a-real` on both platforms — cubin only, no PTX, so no JIT at load time
  (already covered in 3.5). The corollary is no forward compatibility to non-`sm_120a` GPUs, which
  is intentional for hardware-matched packs.
- **`CMAKE_CUDA_RUNTIME_LIBRARY=Shared`** matches the packaged redistributables allowlisted in
  `is_runtime_launch_file_name` (`cudart64_12.dll`, `cublas64_12.dll`, `cublasLt64_12.dll`,
  `libcudart.so.*`, `libcublas.so.*`, `libcublasLt.so.*`).
- **Flash attention is disabled twice**: `GGML_CUDA_FA=OFF` at build time and
  `parameters.flash_attn = false` at runtime (`whisper_engine.cpp:190`). Flash attention on CUDA
  normally reduces both attention-layer time and peak VRAM. Whether it is viable for `sm_120a` with
  this whisper.cpp revision needs measurement, but the double disable means enabling it requires
  changing both the profile and the adapter.
- **`GGML_CUDA_CUB_3DOT2=OFF` and `GGML_CUDA_NCCL=OFF`** are dependency-closure decisions, correctly
  pinned by `PKG-010`.

**Finding — CUDA performance flags are unpinned.** `GGML_CUDA_FORCE_MMQ`, `GGML_CUDA_FORCE_CUBLAS`,
`GGML_CUDA_F16`, `GGML_CUDA_GRAPHS`, `GGML_CUDA_NO_VMM`, and `GGML_CUDA_PEER_MAX_BATCH_SIZE` appear
in **none** of the four profiles, so they inherit upstream ggml defaults. `PKG-010` requires an
"explicit, reviewed option set" and pins the dependency-affecting CUDA flags, but not the
performance-affecting ones. Consequence: a whisper.cpp version bump can silently change CUDA kernel
selection, graph capture behavior, and VRAM residency without any profile diff and without changing
the reviewed option set. Pin them explicitly — whatever values are chosen — so the performance
characteristics are part of the reviewed contract rather than an upstream default.

**Finding — the two platforms do not pin the same set.** The Windows CPU profile omits most `GGML_*`
CPU flags that the Linux profiles pin (the `-` column in 6.1). The effective build may be identical
because the defaults happen to match, but the *contract* differs by platform, which is the same class
of divergence documented in 2.7.

### 6.4 Multithreading corrections to section 5

Two facts from this pass correct or complete section 5.

1. **`GGML_OPENMP=OFF` in all four profiles.** ggml therefore uses its internal pthread thread pool
   rather than OpenMP for `n_threads` work. Section 5 discussed thread counts without stating which
   threading runtime realizes them. The internal pool's barrier and spin behavior differ from
   OpenMP's; which performs better for this workload is UNVERIFIED and worth measuring before any
   thread-count tuning.
2. **The mel spectrogram is genuinely multithreaded, and the project patched it.**
   `0002-exact-device-cancellation.patch` modifies `log_mel_spectrogram_worker_thread` and
   `log_mel_spectrogram` to add cancellation checks inside the worker threads. So `n_threads`
   controls real parallel work on the GPU path too, which makes the hardcoded `4U` at
   `worker_application.cpp:235` (finding 5.8) more consequential than stated: it caps mel
   spectrogram parallelism on the accelerator path regardless of host core count.

### 6.5 The three whisper.cpp patches

Not previously reviewed. All are project-owned modifications to the vendored engine.

| Patch | Added lines | What it changes |
| --- | --- | --- |
| `core/0001-exact-loader-reads` | 25 | Loader callback path in `src/whisper.cpp` — supports the `ExactModelReader` contract |
| `device-cancel/0002-exact-device-cancellation` | 207 | Abort plumbing and device selection |
| `amd-preview/0003-vulkan-1.3-generated-target` | 2 | AMD Vulkan preview only |

The device-cancellation patch is the substantial one. It touches `ggml_graph_compute_helper`,
`whisper_encode_internal`, `whisper_decode_internal`, the mel spectrogram worker threads,
`whisper_backend_init`, and `make_buft_list`.

**Two changes there are performance-relevant and both are good decisions worth crediting:**

1. **No silent CPU fallback on a GPU pack.** `whisper_backend_init` gains:

   ```c
   } else if (params.local_whisper_require_gpu) {
       return {};
   }
   ```

   Upstream would fall back to CPU if GPU backend init failed. With a `sm_120a` pack that fallback
   would be a large, silent slowdown that looks like a working transcription. Hard-failing is the
   correct choice and removes an entire class of "why is it suddenly slow" incident.

2. **Device selection by pointer, not enumeration ordinal.** `make_buft_list` is rewritten from
   upstream's "count GPU devices until index matches `gpu_device`" loop to a single
   `whisper_selected_gpu(params)` call using the pre-resolved `local_whisper_selected_device`. That
   removes a TOCTOU between enumeration and selection and makes the buffer type come from the same
   device the proof was computed against. It is consistent with the double-snapshot guard in
   `device_registry.cpp` and is the right design.

### 6.6 What this section does not cover

- **AMD HIP and Vulkan preview backends** were out of scope for this pass (the request was CPU and
  CUDA). `GGML_HIP`, `GGML_HIP_GRAPHS`, `GGML_HIP_MMQ_MFMA`, `GGML_HIP_NO_VMM`, and `GGML_VULKAN`
  are `OFF` in all four production profiles; the preview packs live under
  `runtime/local-whisper/whisper-cpp/amd/` with their own contract fixtures and are not part of the
  production runtime graph.
- **No inference measurement was performed.** Every throughput claim in 6.2 and 6.3 is directional,
  not measured. The instrumentation recommended in 2.1 should be extended to record encoder/decoder
  time separately from load time before any backend flag is changed.

## 7. Safety Requirements for These Optimizations

Goal 3 is the binding constraint. Each item below is a precondition, not a suggestion.

1. **Preserve the exact-read digest contract.** `ExactModelReader` must keep proving that the
   loader consumed exactly the authenticated bytes. Accelerating the digest changes throughput
   only; it must not change what is hashed or when `verify_complete()` is allowed to succeed.
2. **Do not remove passes 5 or 6.** They cover different byte streams. Only the same-process
   duplicates (3/4) and the same-lease duplicates (1/2) may be collapsed.
3. **Dual-path digest verification.** Ship the accelerated and scalar SHA-256 side by side and
   gate on: existing cross-language vectors, a differential test over lengths 0..256 and block
   boundaries (55, 56, 63, 64, 65, 119, 120), plus the multi-gigabyte length-field path. Run this
   test on **both** platforms — MSVC and GCC/Clang differ in how the accelerated path is enabled
   (2.3), so agreement on one compiler does not imply agreement on the other.
4. **Cross-platform digest agreement must become a test, not an assumption.** Per 2.7.1, the
   `LIST` digest field is produced by two unrelated implementations. Any change here must be
   gated by a shared-vector test that both platform backends satisfy, otherwise a Linux-only
   change can silently desynchronize the platforms on a field the shared TypeScript compares
   byte-for-byte.
5. **RAII for every new buffer or handle, in the platform-appropriate type.** If pinned host
   memory (`cudaHostAlloc`) is introduced for H2D, it must be owned by an RAII type in the same
   style as `ContextOwner` / `BufferOwner`. On Linux use `UniqueFd`
   (`fs-guard/src/platform/linux/unique_fd.hpp`); on Windows use `unique_handle.hpp`. ASan does
   **not** track CUDA pinned allocations, file descriptors, or Windows HANDLEs, so a leak there is
   invisible to the current CI on either platform.
6. **Fix the leaks before adding buffers.** The companion review's H1 documents eight descriptor
   leaks in `linux_backend.cpp`, all on exception paths. Increasing chunk sizes and adding
   caches to that file without first converting it to `UniqueFd` compounds an existing problem.
   `windows_backend.cpp` was not audited to the same depth and should be checked for the same
   pattern before it is modified — it is the largest file in the tree and has no static-analysis
   or sanitizer coverage today (CI document T3.3).
7. **A digest cache must be identity-anchored, with a per-platform key.** On Linux key on
   `(st_dev, st_ino, st_size, st_mtim)` from the held descriptor; on Windows key on the existing
   `StableIdentity` (volume serial + file id) plus size and last-write time, read from the held
   HANDLE. Never key on a pathname, and never serve a cached digest across a failed
   `revalidate`. Both backends already hold directory handles, so this is achievable without
   weakening the identity model on either platform.
8. **Add the descriptor/handle-balance fixture first, on both platforms.** From the CI document
   (T2.1) — `/proc/self/fd` on Linux, `GetProcessHandleCount` on Windows. It makes leaks
   introduced by this work fail loudly instead of silently.
9. **Re-measure after each step, per platform.** The estimates here are derived from component
   throughput measured on Linux x86-64, not end-to-end timing, and the Windows figures are partly
   UNVERIFIED. Windows needs its own baseline before work is sized.

## 8. Explicitly Not Recommended (hypotheses disproved by measurement)

### 8.1 Do not add a buffered reader in front of `ExactModelReader`

whisper.cpp's loader does many tiny reads — the vocabulary loop
(`.cache/local-whisper/whisper-cpp/patched-source/src/whisper.cpp:1624-1631`) issues two loader
reads per token, about **103,730 reads** for a 51,865-token multilingual vocabulary — and
`LinuxDescriptorSource::read_at` (`whisper-cpp/core/model_authority_linux.cpp:67-80`) performs
**one `pread` syscall per call with no buffering**. This looked like an obvious win.

MEASURED on Linux: 103,730 x `pread(4 bytes)` on a warm cache costs **20.8 ms total**
(0.20 us/call). Across both worker passes that is roughly **42 ms** — about 0.1% of the load time.

A buffered reader would require decoupling "bytes hashed" from "bytes delivered to the loader"
and maintaining two offsets, which touches the exact-read security invariant directly. **Not
worth it for 42 ms.** Reject this optimization **on Linux**.

**Windows caveat — this conclusion does not transfer.** The Windows source
(`whisper-cpp/platform/windows/model_authority_windows.cpp:103-115`) is also unbuffered but issues
`ReadFile` with an `OVERLAPPED` offset per call, and Windows I/O call overhead is typically
several times a Linux `pread`. At a plausible 1-3 us/call the same 103,730 reads would cost
~0.1-0.3 s per pass, or ~0.2-0.6 s across both worker passes — still small against ~24 s of
hashing, but 5-15x the Linux figure and no longer obviously negligible.

**Action:** re-run the equivalent measurement on Windows before closing this out. If Windows lands
above ~1 s, the right fix is still *not* to touch `ExactModelReader`'s invariant — prefer reducing
the number of loader calls (a small buffer inside `WindowsDescriptorSource::read_at` that serves
sequential requests and hashes nothing, leaving `ExactModelReader`'s offset and digest semantics
completely untouched). That keeps the security contract intact because the digest still covers
exactly the bytes `ExactModelReader` delivers, in order.

### 8.2 Do not `mmap` the model for the load pass

Mapping the file and hashing the mapping would avoid a copy, but the mapped contents can be
changed by a writer *after* the digest is computed, which defeats the TOCTOU protection that
read-and-hash-what-you-consumed provides. The current design deliberately hashes the bytes it
actually consumed. Preserve it.

### 8.3 Do not optimize the CUDA upload path first

See 2.1. A 3100 MB H2D transfer is sub-second; the load is dominated by ~48 s of SHA-256.
Pinned staging buffers, stream overlap, and similar work should wait until the phase
instrumentation shows the upload actually matters.

### 8.4 Do not set CUDA JIT cache environment variables

See 3.5. `120a-real` ships cubin without PTX, so there is no JIT to cache.

## 9. Recommended Order of Work

| # | Work | Platform | Where the change lives | Derived gain |
| --- | --- | --- | --- | --- |
| 1 | Instrument load phases (2.1) | both | shared TS + worker | prerequisite |
| 2 | Collapse the two same-process guard digest passes (2.2, passes 3-4) | **Linux only** | `model_authority_server.cpp` | ~7.3 s |
| 3 | Reuse the first `LIST` result in `leaseInstalledModelForLaunch` (2.2, passes 1-2) | both | shared TS `ManagedArtifactStore` | ~9.6 s Linux / ~0.8 s Windows |
| 4 | `static constexpr` base64url table + inline canonical check (3.2) | both | shared `fs-guard/src/common/protocol.cpp` | ~5.8 s install |
| 5 | Raise `STREAM_CHUNK_BYTES` to 192 KiB (3.3) | both | shared TS | 3x fewer round-trips |
| 5b | Pipeline `WRITE_FILE` with a bounded window + backpressure (5.2) | both | shared TS `StreamingArtifactExtractor` + guard transport | removes the round-trip latency term |
| 6 | Make the `LIST` content digest opt-in and cached (2.4) | both, separate backends | `linux_backend.cpp` + `windows_backend.cpp` | ~9.6 s Linux / ~0.8 s Windows startup |
| 7 | Make Linux `LIST` enforce the Windows entry contract (2.7.3) | **Linux only** | `linux_backend.cpp` | security parity, not speed |
| 8 | Hardware-accelerated SHA-256 + delete duplicate implementations (2.3, 2.7.1) | both, per-compiler paths | `common/src/sha256.cpp` + both backends | model load -> ~1.4 s |
| 9 | Pin the unpinned CUDA performance flags in all four profiles (6.3) | both | toolchain profiles | contract hygiene; prevents silent drift on a whisper.cpp bump |
| 10 | Extend load instrumentation to separate encoder/decoder time from load time (6.6) | both | worker + qualification harness | prerequisite for any backend flag change |
| 11 | Measure AVX2/FMA gain, then decide on CPU micro-architecture pack variants (6.2) | both | PKG-010 spec change + `CpuProbe` CPUID | largest unmeasured inference lever |

Items 2-5b are self-contained and low-risk. Together they take the derived Linux model-load digest
cost from ~48.5 s to ~31.6 s and install decode from ~11.1 s to ~5.3 s, with items 3-5b landing on
both platforms from shared code. Item 5b additionally removes the install round-trip latency term,
but only if the bounded window and `write()` backpressure from 5.2 are implemented together — without them it converts a latency problem into an out-of-memory one.

Item 6 requires touching **two** backends independently and is where cross-platform regressions
are most likely — do the Linux and Windows halves in the same change with the shared-vector test
from 6.4 in place, not as separate follow-ups.

Item 8 is the largest win and the largest review surface. It needs the verification harness of
section 7 (items 3 and 4) first, and its accelerated path must be written and tested separately
for MSVC and GCC/Clang per the table in 2.3.

Item 7 is not a performance change; it is included because 2.7.3 was found while checking platform
parity for this review and should not be lost.

Items 9-11 come from the backend pass in section 6. Item 11 is the largest potential win in the
whole document but is also the only one requiring a specification change (`PKG-010`), and it must
be driven by measurement rather than by the directional argument in 6.2.
