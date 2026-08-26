# Local Whisper Native (C++) — Library Adoption Review

Date: 2026-08-08
Branch: `feat/local-whisper-provider`
Companion to: [`2026-08-08-local-whisper-native-review.md`](2026-08-08-local-whisper-native-review.md),
[`2026-08-08-local-whisper-native-ci-security-checks.md`](2026-08-08-local-whisper-native-ci-security-checks.md),
[`2026-08-08-local-whisper-performance-review.md`](2026-08-08-local-whisper-performance-review.md)

Goal: replace hand-rolled functionality in `runtime/local-whisper/**` with time-tested,
community-supported, cross-platform libraries, to improve robustness.

Verdict: **adopt two libraries (libsodium, simdutf), reject seven candidates, and fix four items
with zero new dependencies.** The single highest-robustness change in this document requires no
library at all (section 6.1).

## 1. Constraints That Govern Every Choice Here

These are not preferences — they eliminate most candidates before evaluation.

1. **Project license is PolyForm Noncommercial 1.0.0** (`LICENSE`, `package.json:181`). This is
   source-available, not OSI open source. Consequence: **GPL and LGPL libraries are out.** LGPL
   static linking requires granting relink rights the project's own license does not contemplate.
   Permissive (MIT, BSD, Apache-2.0, ISC, BSL-1.0, public domain) is required.
2. **Every dependency must pass through the native source-lock system.**
   `runtime/local-whisper/sources/schema/native-source-lock.schema.json` requires `schemaId`,
   `lockId`, `repository`, `commit`, `gitTree`, `signature`, `importer`, `materialization`,
   `manifest`, `transportObject`, `license`, `recursiveInputs`, `provenance`, `contentStore`.
   Only three locks exist today (nlohmann-json **subset**, googletest, whisper.cpp). `recursiveInputs`
   means transitive dependencies must be locked too, so **any library with a dependency tree is
   effectively disqualified.** This is a good design and it should stay; it just makes each
   adoption expensive.
3. **The shipped binaries are self-contained and statically linked** into runtime packs, under a
   reproducibility contract (`RuntimePackReproducibilityContract`,
   `DeterministicRuntimePackProducer`). A library must build deterministically and must not
   require a shared library at run time.
4. **Toolchains are pinned:** MSVC 19.39 on Windows, clang-18 / gcc-13 on Linux. No `clang-cl`.
   A library must build under MSVC without a POSIX shim layer.
5. **`AGENTS.md`: "Do not add dependencies ... without explicit scope."** Everything below is a
   proposal requiring that scope decision, not something to action unilaterally.
6. **Build-time toolchain requirements count.** Anything needing Perl (OpenSSL) or Python
   (Botan's `configure.py`) at build time adds a hosted-toolchain acquisition lock, which the
   project already treats as a controlled surface
   (`toolchains/schema/hosted-toolchain-acquisition-lock.schema.json`).

## 2. Inventory of Hand-Rolled Functionality

| Primitive | Implementations | Locations | Assessment |
| --- | --- | --- | --- |
| SHA-256 | **4** | `common/src/sha256.cpp`, `launcher/src/common/sha256.cpp`, `linux_backend.cpp:307-406` (nested), Windows uses BCrypt CNG | replace — one copy has a latent OOB write |
| base64url | **6+** | `fs-guard/src/common/protocol.cpp`, `common/src/device_proof.cpp`, `launcher/src/common/launch_request.cpp` (x2), `worker_application.cpp`, `device_authority.cpp`, plus Windows backend and `model_launch_request.cpp` | replace |
| hex encode/decode | **4** | `common/src/sha256.cpp` (`to_lower_hex`), `device_proof.cpp` (`decode_hex_digest`), `model_launch_application.cpp` (`parse_hex<N>`), `worker_application.cpp` (`hex_digest`) | replace |
| UTF-8 handling | 1 partial + 1 gap | `worker_application.cpp:265` (`utf8_code_points`), `wide_to_utf8` in `windows_backend.cpp`; **no validation on the transcript path** | replace + fix (6.1) |
| Checked arithmetic | 1 | `whisper-cpp/include/.../checked_arithmetic.hpp` | keep (5.4) |
| RAII resource wrappers | **6** | `UniqueFd`, `UniqueDescriptor`, `UniqueModelDescriptor`, `unique_handle.hpp`, `ContextOwner`/`BackendOwner`/`GgmlContextOwner`/`BufferOwner` | consolidate in-tree, no library (6.3) |
| Canonical WAV parse | 1 | `common/src/canonical_wav.cpp` | **keep** (5.1) |
| Bounded JSON | 1 wrapper over nlohmann | `common/src/bounded_json.cpp` | keep parser, delete hand-rolled lexer (6.2) |
| Frame codec | 1 | `common/src/frame_codec.cpp` | keep (5.5) |
| Syscall hardening | n/a | `openat2`/`RESOLVE_*`, `renameat2`, `SCM_RIGHTS`, Job Objects, procfs | **keep** (5.2) |
| Process supervision | n/a | `linux_launcher.cpp`, `windows_launcher.cpp` | **keep** (5.3) |

## 3. Recommended for Adoption

### 3.1 libsodium — replaces SHA-256, base64url, hex, and adds constant-time comparison

| Attribute | Value |
| --- | --- |
| License | ISC (permissive) |
| History | libsodium since 2013; NaCl lineage from 2008 (Bernstein, Lange, Schwabe) |
| Support | Actively maintained, funded audits (Cure53 2017), stable API with a documented ABI policy |
| Adoption | Signal, WireGuard tooling, Discord, ZeroMQ/CurveZMQ, Rust `sodiumoxide`, PHP core |
| Cross-platform | Linux, Windows (MSVC project files provided), macOS, iOS, Android, WASM |
| Dependencies | none (satisfies `recursiveInputs`) |
| Build | autotools on POSIX, MSVC solution/CMake ports on Windows |

What it replaces, mapped to exact needs:

| Current code | libsodium replacement | Why it is better |
| --- | --- | --- |
| 4x hand-rolled SHA-256 | `crypto_hash_sha256_init/update/final` (streaming, matches `Sha256` shape) | one audited implementation; removes the latent `buffer_[64]` OOB write in `linux_backend.cpp` |
| 6x base64url | `sodium_bin2base64` / `sodium_base642bin` with `sodium_base64_VARIANT_URLSAFE_NO_PADDING` | **exactly** the variant in use, and `sodium_base642bin` rejects non-canonical input natively — which is precisely what `protocol.cpp`'s re-encode-and-compare hack emulates at 2x the cost |
| 4x hex | `sodium_bin2hex` / `sodium_hex2bin` | constant-time, canonical, rejects malformed input |
| `operator==` / `!=` on secrets | `sodium_memcmp`, `crypto_verify_32` | constant-time (see 4.1) |
| nothing | `sodium_memzero` | wipe lease tokens, nonces, and challenge material on scope exit |

**The URL-safe-no-padding base64 variant is the decisive argument.** Most base64 libraries offer
only standard base64 and require the caller to re-map `+/` to `-_` and strip padding — which is how
hand-rolled variants get written in the first place. libsodium implements the exact variant this
protocol uses, including canonical-form rejection.

**Honest limitation, and it is significant:** libsodium's SHA-256 is portable C with **no SHA-NI /
ARMv8-crypto acceleration**. Measured in the performance review, the project's current block-copy
implementation runs at 422.9 MB/s and OpenSSL's hardware path at 4613 MB/s. libsodium will land
near the current figure. **Adopting libsodium therefore serves the robustness goal but does
nothing for the 11x performance goal in the performance review.** Section 7 addresses that tension
directly — do not assume this one change satisfies both reviews.

### 3.2 simdutf — replaces UTF-8 counting and UTF-16 conversion, and closes a real bug

| Attribute | Value |
| --- | --- |
| License | Apache-2.0 OR MIT (dual) |
| History | Since 2021, from the simdjson team (Lemire et al.), heavily published and benchmarked |
| Support | Very active; treated as critical infrastructure by its downstreams |
| Adoption | **Node.js core** (all `Buffer` transcoding), Bun, Cloudflare Workers, ClickHouse, Oracle GraalVM |
| Cross-platform | x86-64 (SSE2..AVX-512), ARM64 (NEON), POWER, RISC-V; runtime dispatch built in |
| Dependencies | none |
| Build | CMake, single amalgamated `simdutf.cpp` + `simdutf.h` available (ideal for the lock system) |

Being in Node.js core matters here specifically: **the TypeScript side of this project already
routes every artifact byte through Node's `Buffer` transcoding, so simdutf is already executing in
this application's process today.** Adopting it in the native workers aligns the two sides on one
implementation rather than adding a new one.

Replaces:

- `utf8_code_points` (`worker_application.cpp:265`) — hand-rolled continuation-byte counting, used
  to enforce the 1000-code-point prompt limit. `simdutf::count_utf8` does this correctly and also
  lets the code *validate* rather than merely count.
- `wide_to_utf8` in `windows_backend.cpp` — UTF-16 to UTF-8 conversion on a trust boundary
  (directory entry names). `simdutf::convert_utf16_to_utf8` with the `_with_errors` variant gives
  explicit failure instead of best-effort. Hand-rolled UTF-16 conversion is a classic source of
  surrogate-pair and lone-surrogate defects.
- The missing validation on the transcript path — see 6.1, which is the highest-value item in this
  document.

## 4. Cross-Cutting Findings Surfaced While Evaluating

### 4.1 Secrets are compared with non-constant-time equality

Once libsodium is available these become one-line fixes, so they are worth recording here.

- `AuthorityBinding::operator==` is `= default`
  (`common/include/local_whisper/common/model_authority.hpp:38`), so `lease_token_sha256`,
  `operation_nonce`, and `app_ownership_nonce` are compared member-wise with early exit.
  Used in `authority_bootstrap.cpp:69` and `model_authority_server.cpp:154`.
- `digest_.finish() != expected_sha256_` (`exact_model_reader.cpp:60`)
- `*owner_identity == metadata[2]` (`linux_backend.cpp:532`)
- registry fingerprint and device proof string comparisons throughout

**Honest severity: low.** The attacker must be local, the operation nonces are single-use, and the
channels are private pipes/socketpairs. This is hygiene rather than an exploitable finding — but
`sodium_memcmp` costs nothing once the library is linked, and a defaulted `operator==` on a struct
holding a lease token is the kind of thing that becomes a real problem when the surrounding code
changes.

### 4.2 Digest and nonce material is never wiped

`AuthorityBinding` holds `lease_token_sha256`, `operation_nonce`, and `app_ownership_nonce` and is
copied freely (into `LinuxModelAuthorityServer`, `AuthorityRecord` variants, `AuthorityReplayGuard`).
Nothing zeroes it. `sodium_memzero` in the owning types' destructors would bound the lifetime of
that material in process memory and in any crash dump. Same low severity, same near-zero cost.

## 5. Explicitly Rejected Candidates

### 5.1 Do NOT replace `canonical_wav.cpp` with dr_wav / libsndfile / miniaudio

This is the most important rejection in the document, because it looks like an obvious win.

`validate_canonical_wav` is not a WAV parser — it is a **strict allowlist validator** for exactly
one format: RIFF/WAVE, `fmt ` size 16, PCM format 1, 1 channel, 16 kHz, 32000 byte rate, block
align 2, 16 bits, `data` chunk at offset 36, even length, bounded size. Anything else is rejected.

A general-purpose WAV library accepts *strictly more* input: extra chunks, `WAVE_FORMAT_EXTENSIBLE`,
other sample rates, other channel counts, 24/32-bit, float samples. Substituting one would **widen
the accepted input set on a trust boundary** — a security regression sold as a robustness
improvement. The hand-rolled strictness is the feature.

Additional disqualifiers: **libsndfile is LGPL-2.1**, which conflicts with constraint 1.1 for a
statically-linked shipped binary. miniaudio and dr_wav are permissive but are decoders, not
validators.

**Keep as-is.** If anything, add fuzz coverage (CI review T2.2 already lists it as a target).

### 5.2 Do NOT abstract the filesystem hardening behind Boost.Filesystem or `std::filesystem`

No portable library can express `openat2` with
`RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS | RESOLVE_NO_XDEV`,
`renameat2(RENAME_NOREPLACE)`, held-descriptor inode revalidation, or the Windows
`NtCreateFile`/`FILE_ID_INFO` equivalents. `std::filesystem` operates on **pathnames**, which is
precisely the TOCTOU-vulnerable model this code was written to avoid. Introducing it would
dismantle the guard's central security property. **Keep.**

### 5.3 Do NOT replace process supervision with Boost.Process

Boost.Process cannot express `prctl(PR_SET_CHILD_SUBREAPER)`, `PR_SET_PDEATHSIG`, `fexecve` on a
verified held descriptor, `close_range` before exec, process-group signalling with reap loops, or
the Windows Job Object configuration in `windows_launcher.cpp`. The launcher's entire value is
these specifics. **Keep.**

### 5.4 Do NOT adopt SafeInt or Boost.SafeNumerics for `checked_arithmetic.hpp`

SafeInt (MIT, David LeBlanc, since 2003, used in Windows and Chromium) is a fine library, but the
existing header is three functions — `checked_add`, `checked_multiply`, `checked_size` — and I
reviewed them as correct. The robustness gain is marginal and does not justify a lock entry.

If more coverage is wanted later, prefer **compiler builtins over a library**:
`__builtin_add_overflow` / `__builtin_mul_overflow` on GCC/Clang, `<intsafe.h>`
(`UInt64Add`, `UInt64Mult`) on MSVC. Zero dependency, both platforms.

### 5.5 Do NOT replace `frame_codec.cpp`

55 lines of length-prefixed framing with explicit bounds. No library is warranted. Fix the
duplicated `136` magic constant instead (code review, Low findings).

### 5.6 Do NOT adopt Boost or Microsoft GSL for RAII consolidation

The problem is that there are **six** hand-rolled RAII types, not that hand-rolling is wrong. See
6.3 — an in-tree `unique_resource` solves it in ~40 lines. Boost is a very large lock entry for one
utility; GSL's `gsl::finally` is smaller but still a dependency for something the standard library
almost provides. Adding a dependency to reduce duplication that a single internal type also fixes is
the wrong trade under constraint 1.2.

### 5.7 Do NOT adopt {fmt}

{fmt} is excellent and extremely well tested (it became `std::format`). But **MSVC 19.39 and
gcc-13's libstdc++ both ship `<format>`**, so the iostream usage in `to_lower_hex`,
`identity_string`, and `serialize_response` can move to `std::format` with no dependency. Prefer the
standard library here.

### 5.8 Do NOT switch JSON parsers

nlohmann-json is already locked as a trimmed subset and is well tested. RapidJSON, Boost.JSON, and
simdjson do not provide the combination this code needs (reject floats, reject duplicate keys,
enforce a safe-integer range, bound depth/members/elements/events), so a swap would mean rewriting
`bounded_json.cpp` against a new API for no gain. **Keep nlohmann; delete the hand-rolled lexer
instead — see 6.2.**

### 5.9 Do NOT adopt OpenSSL, BoringSSL, Botan, or Crypto++ for SHA-256

Evaluated specifically for the performance goal; see section 7 for the resulting tension.

| Candidate | License | SHA-NI | Disqualifier under section 1 |
| --- | --- | --- | --- |
| OpenSSL 3.x | Apache-2.0 | yes | needs Perl at build time (new hosted-toolchain lock); large surface; static-linking and packaging burden across two platforms |
| BoringSSL | Apache-2.0 (mixed) | yes | Google explicitly declines to support external consumers; no stable API/ABI, no releases to pin |
| Botan | BSD-2 | yes | `configure.py` needs Python at build time; large; C++ ABI sensitivity across MSVC/clang |
| Crypto++ | BSL-1.0 (library) | yes | long history (1995) and permissive, but a large surface for one primitive and a non-CMake-native build |
| mbedTLS | Apache-2.0 | **no** on x86-64 (ARMv8 crypto only) | does not serve the performance goal |
| BLAKE3 | CC0 / Apache-2.0 | n/a (very fast) | **different algorithm** — would change the digest format in the catalog, the TS side, and every lock file |

## 6. Higher-Value Fixes That Need No Library

Listed first in priority order because the top item outranks everything in section 3.

### 6.1 Invalid UTF-8 in a transcript destroys the transcription and kills the worker

**This is a live robustness bug, found while evaluating simdutf.**

`worker_application.cpp:499-505` builds the transcript by concatenating
`whisper_full_get_segment_text` output and sends it as `{"text", text}`. Both channel
implementations serialize with a bare `value.dump()`
(`worker_protocol_posix.cpp:128`, `worker_protocol_windows.cpp:112`).

VERIFIED by inspection: there is **no UTF-8 validation or sanitization anywhere** in
`whisper-cpp/` or `common/` on this path — the only UTF-8 code is `utf8_code_points`, which
counts non-continuation bytes for the *prompt* length limit and validates nothing.

nlohmann's `dump()` throws `json::type_error.316` on invalid UTF-8 unless an `error_handler_t` is
supplied, and no handler is supplied anywhere (grep for `error_handler` returns nothing).

Whisper models use byte-level BPE, so a segment boundary can split a multibyte character — a
truncated CJK glyph or emoji. Upstream is aware of this class of problem; the patched source ships
`tests/test-common-utf8.cpp`.

Failure sequence:

1. `engine_.transcribe` returns text containing a split multibyte sequence.
2. `terminal.try_succeed()` succeeds — the arbiter has now committed to "transcript delivered".
3. `channel_.send_control(...)` throws inside `dump()`.
4. The inference thread's `catch (...)` stores it in `inference_error`.
5. The main thread rethrows it, `run()` catches, and the worker sends a `failure` frame and exits 10.

**The user loses the whole transcription and the worker dies, for a valid audio input.**

Minimal fix, no dependency:

```cpp
const auto serialized = value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
```

Better fix, with simdutf: validate at the boundary where the text is produced and repair or
truncate at a character boundary, so the replacement is deliberate rather than incidental.

Either way, add a regression test feeding a deliberately truncated multibyte sequence through
`transcribe`.

### 6.2 Delete the hand-rolled JSON number lexer

`bounded_json.cpp:55-88` (`validate_number_lexemes`) is a hand-written scanner over raw bytes that
re-implements part of the JSON grammar — tracking string state and escapes — purely to reject
floats and out-of-safe-range integers before nlohmann parses. It duplicates grammar knowledge that
the parser already has, and a divergence between the two is a correctness risk.

Everything it enforces is already expressible in the existing SAX callbacks: `number_float` is
already rejected there, and `number_integer` / `number_unsigned` can range-check against
`kSafeIntegerMax` in the same place. **Deleting a hand-rolled parser is a robustness win with no
dependency** — and it is exactly the kind of code this review is meant to eliminate.

### 6.3 Consolidate six RAII wrappers into one in-tree `unique_resource`

`UniqueFd` (fs-guard), `UniqueDescriptor` (launcher), `UniqueModelDescriptor` (launcher),
`UniqueFd` again (fs-guard model launch application, a *second* definition), `unique_handle.hpp`
(Windows), plus `ContextOwner` / `BackendOwner` / `GgmlContextOwner` / `BufferOwner` in the engine
adapter. Nine types, four of them near-identical.

A single `unique_resource<Handle, Deleter, Invalid>` in `common/` covers all of them in ~40 lines
and is what `std::experimental::unique_resource` (P0052) standardizes. Note the companion review's
H1: the fs-guard leaks exist precisely because the available RAII type was not used consistently.
Fewer types makes consistent use more likely.

### 6.4 Prefer `std::format` over `std::ostringstream`

`to_lower_hex`, `identity_string`, `serialize_response`, and the guard's Sha256 hex output all use
`std::ostringstream` with `std::hex`/`setw`/`setfill`. Both pinned toolchains have `<format>`.
Faster and clearer, no dependency. (Once libsodium is adopted, `sodium_bin2hex` removes most of
these call sites anyway.)

## 7. The SHA-256 Tension Between This Review and the Performance Review

These two reviews pull in different directions on the same code, and the conflict should be
resolved deliberately rather than by whichever lands first.

- **This review** wants the four hand-rolled SHA-256 implementations replaced by an audited one
  (robustness), which points at libsodium.
- **The performance review** wants SHA-256 at hardware speed — measured 422.9 MB/s now vs
  4613 MB/s with SHA-NI, on a path that runs up to six times per model load. libsodium does not
  provide that.

Three coherent options:

| Option | Robustness | Performance | Lock cost | Verdict |
| --- | --- | --- | --- | --- |
| A. libsodium for everything | high — one audited impl | none — stays ~420 MB/s | 1 lock | good, incomplete |
| B. libsodium for base64/hex/constant-time; keep **one** in-tree SHA-256 and add SHA-NI + ARMv8 dispatch | medium-high — 3 of 4 copies deleted, remaining one is the already-vector-tested `common/` version | full — ~11x | 1 lock | **recommended** |
| C. OpenSSL or Crypto++ for SHA-256 | high | full | 1 large lock + Perl/Python toolchain lock | only if packaging cost is acceptable |

**Recommend B.** It deletes the two duplicate SHA-256 copies and the one with the latent OOB write,
keeps the single implementation that the existing cross-language conformance vectors already
validate, takes base64url/hex/constant-time comparison from a library that implements exactly the
variants needed, and leaves the hardware-acceleration work where the performance review put it —
gated by the differential tests in that document's section 5.

Note that Windows already validates this split: it uses BCrypt CNG (a platform library) for
directory-entry digests while sharing `common/src/sha256.cpp` for the authority path.

## 8. Integration Cost and Rollout

Per-library work under the lock system (constraint 1.2):

1. Author `sources/locks/<lib>-<version>-<commit>.json` with all fourteen required fields,
   including `signature`, `provenance`, and `recursiveInputs` (empty for both recommended
   libraries — neither has dependencies).
2. Extend `provision-native-test-sources.mjs` and the `verify:local-whisper:native-source` step,
   following the nlohmann-json **subset** precedent — vendor only the translation units actually
   used, which for libsodium means a small subset and for simdutf means the amalgamated pair.
3. Add to the four `CMakeLists.txt` files and the Windows/Linux presets; confirm static linkage
   and the reproducibility contract still holds
   (`RuntimePackReproducibilityContract.test.ts`).
4. Verify both platforms: the Linux sanitized suite and the MSVC suite.

Recommended order:

| # | Change | Dependency | Effort | Rationale |
| --- | --- | --- | --- | --- |
| 1 | Fix the `dump()` UTF-8 crash (6.1) | none | trivial | live bug that loses user transcriptions |
| 2 | Delete `validate_number_lexemes` (6.2) | none | small | removes a hand-rolled JSON lexer |
| 3 | Consolidate RAII types (6.3) | none | small | prerequisite for fixing H1 cleanly |
| 4 | Adopt libsodium: base64url, hex, `sodium_memcmp`, `sodium_memzero` (3.1, 4.1, 4.2) | libsodium | medium | deletes 6 base64 and 4 hex implementations |
| 5 | Delete the 3 duplicate SHA-256 copies, keep `common/` (7, option B) | libsodium not required | medium | removes the OOB-write copy |
| 6 | Adopt simdutf: `wide_to_utf8`, prompt counting, transcript validation (3.2) | simdutf | medium | hardens a trust boundary and makes 6.1's fix principled |
| 7 | SHA-NI / ARMv8 dispatch on the remaining implementation | none | large | performance review, needs its differential tests |
| 8 | `std::format` migration (6.4) | none | small | opportunistic cleanup |

Items 1-3 and 8 need no scope decision under `AGENTS.md` and can proceed immediately. Items 4 and 6
are the two dependency additions requiring explicit approval.

## 9. Summary

- **Adopt: libsodium** (ISC, 2013, NaCl lineage, audited, no dependencies, ships the exact
  `URLSAFE_NO_PADDING` base64 variant this protocol uses) and **simdutf** (Apache-2.0/MIT, in
  Node.js core, no dependencies, amalgamated source).
- **Reject: libsndfile/dr_wav/miniaudio** (would widen a validator's accepted input set; libsndfile
  is LGPL), **std::filesystem/Boost.Filesystem** and **Boost.Process** (cannot express the
  hardening that is the whole point), **SafeInt** (marginal; use compiler builtins), **Boost/GSL**
  for RAII (in-tree type is better), **{fmt}** (use `std::format`), a **JSON parser swap** (nlohmann
  is right; the lexer is the problem), and **OpenSSL/BoringSSL/Botan/Crypto++/BLAKE3** (see 5.9).
- **The highest-robustness single change in this document needs no library**: the invalid-UTF-8
  `dump()` crash in 6.1, which currently discards a completed transcription and kills the worker on
  valid audio input.
