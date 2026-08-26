# Local Whisper Native Library Adoption Review Comments to Address

Date: 2026-08-08  
Source review: [`2026-08-08-local-whisper-native-library-adoption-review.md`](2026-08-08-local-whisper-native-library-adoption-review.md)  
Assessment basis: current `feat/local-whisper-provider` source, directly related native tests and
protocol fixtures, the native source-lock contract, and the approved Local Whisper native review
remediation specification and task packets.

## Verdict

Address three underlying comments from the library-adoption review. Two are already owned by the
approved native remediation work. The third should be a separately scoped, dependency-free
follow-up. The review does not establish enough benefit to approve either libsodium or simdutf for
the current work.

## Address Before Merge

### 1. Make committed transcript text safe for JSON serialization

**Review section:** 6.1, with the transcript-related part of 3.2  
**Locations:**

- `runtime/local-whisper/whisper-cpp/adapter/whisper_engine.cpp:424`
- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp:499`
- `runtime/local-whisper/whisper-cpp/core/worker_protocol_posix.cpp:128`
- `runtime/local-whisper/whisper-cpp/platform/windows/worker_protocol_windows.cpp:112`

The review is correct that model-produced segment bytes are concatenated without UTF-8 validation
and both transports serialize with a throwing `nlohmann::json::dump()`. The inference path commits
success with `terminal.try_succeed()` before serialization. An ill-formed sequence can therefore
turn a committed transcript into an exception, discard the result, and terminate the resident
worker through its failure path.

Make transcript serialization deterministic and non-throwing for ill-formed model output. Replace
or truncate invalid sequences at a character boundary before success is committed, or serialize a
prepared transcript with nlohmann's replacement error handler. Apply the same policy on POSIX and
Windows without weakening strict UTF-8 validation for inbound control messages.

Add a regression test whose engine result ends with a truncated multibyte sequence. It must deliver
one successful transcript with the documented replacement/truncation policy and leave the warmed
worker able to process another request.

This finding is already owned by `INF-002`, `AC-AUT-016`, and Packet 01 of
`docs/specs/local-whisper-native-review-remediation/`.

## Address Before Native Qualification

### 2. Remove the duplicate hand-rolled SHA-256 implementations

**Review sections:** inventory, 3.1, and 7 (the consolidation part of option B)  
**Locations:**

- `runtime/local-whisper/common/src/sha256.cpp:1`
- `runtime/local-whisper/launcher/src/common/sha256.cpp:1`
- `runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp:307`
- `runtime/local-whisper/fs-guard/src/platform/windows/windows_backend.cpp:535`

The launcher and Linux filesystem guard duplicate the common compression implementation even though
their target graphs already compile common SHA-256 code. The Linux guard copy also has no finished
state; a second `finish()` call can append past its 64-byte buffer. This is not currently reachable,
but keeping multiple compression implementations increases defect and verification surface.

Use `local_whisper::common::Sha256` as the only in-tree compression implementation, with narrow
descriptor/handle streaming adapters. Remove the launcher's private class and the Linux guard's
nested class. Retain Windows BCrypt CNG: it is a platform crypto provider, not another hand-rolled
copy, and replacing it with the scalar common implementation would regress the directory-digest
path.

While consolidating, harden the common implementation's byte-to-bit length overflow check and add
shared standard, chunk-boundary, lifecycle, overflow, and Windows-CNG agreement tests. Hardware
SHA-NI/ARMv8 dispatch is performance work and should not be coupled to this correction without its
own measured contract.

This finding is already owned by `CRY-001`, `AC-AUT-011`, and Packet 05 of
`docs/specs/local-whisper-native-review-remediation/`.

## Address as a Separately Scoped Follow-up

### 3. Centralize base64url-no-padding and hexadecimal codecs without adding libsodium

**Review sections:** inventory and 3.1  
**Representative locations:**

- `runtime/local-whisper/fs-guard/src/common/protocol.cpp:13`
- `runtime/local-whisper/launcher/src/common/launch_request.cpp:39`
- `runtime/local-whisper/common/src/device_proof.cpp:21`
- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp:78`
- `runtime/local-whisper/whisper-cpp/device/device_authority.cpp:14`
- both platform model-launch applications' `parse_hex` helpers

The review correctly identifies repeated implementations of the same URL-safe, unpadded base64 and
lowercase hexadecimal contracts. The current copies have different size, canonical-form, and error
policies, so future fixes can diverge even where the wire encoding is meant to be identical.

Move the byte-level codecs into the existing native common library, preserving strict canonical
decoding. Keep domain-specific size/control-character validation and typed error mapping in each
consumer. Use shared golden vectors for empty and boundary lengths, invalid alphabet characters,
impossible lengths, non-zero trailing bits, padding rejection, uppercase-hex rejection where the
protocol requires lowercase, and Linux/MSVC agreement.

Do not add libsodium solely for these codecs. The project already has a verified common native
library, while libsodium would require a new source lock, importer/source-set changes, CMake and
dual-platform packaging work, reproducibility evidence, and an explicit dependency approval. The
review's other proposed libsodium uses do not justify that cost: Windows CNG should remain for its
hash path, and the compared digests/nonces do not establish a material timing attack in the current
private local channels.

## Review Comments Not Carried Forward

- **Do not adopt simdutf for the current fixes.** The live transcript defect has a small
  dependency-free correction. Inbound prompts already pass strict nlohmann UTF-8 JSON validation
  before `utf8_code_points`, and Windows `wide_to_utf8` already uses
  `WideCharToMultiByte(..., WC_ERR_INVALID_CHARS, ...)` with explicit failure. The review's claim
  that this conversion is best-effort is incorrect for the current implementation.
- **Do not delete `validate_number_lexemes` as proposed in section 6.2.** The checked-in protocol
  fixture explicitly rejects negative zero, while nlohmann's `number_integer` SAX callback receives
  only the parsed numeric value and cannot distinguish `-0` from `0`. Moving only range checks into
  the SAX callbacks would silently widen the accepted protocol grammar. Any later simplification
  must first preserve every lexical fixture, including negative-zero rejection.
- **Do not replace all native resource owners with one generic `unique_resource`.** The review's
  inventory is incomplete, and the approved remediation contract intentionally keeps descriptor,
  handle, `DIR*`, whisper context, GGML backend, context, and buffer ownership within their platform
  or library boundaries. Address the verified descriptor/handle leaks with the focused existing
  owners and tests rather than introducing a cross-boundary abstraction.
- **Do not add constant-time comparisons or memory wiping as a dependency justification.** The
  cited comparisons include public artifact digests, process identities, registry fingerprints,
  and nonces on private local channels. The review itself rates the issue low, and wiping freely
  copied digest/nonce records would not provide a complete secret-lifetime guarantee.
- **Do not prioritize the `std::format` migration.** It is optional presentation cleanup, does not
  fix a demonstrated correctness or security problem, and much of the hexadecimal formatting will
  disappear if the shared codec follow-up is completed.
- Preserve the review's explicit rejections of general WAV parsers, portable filesystem/process
  abstractions, a JSON parser swap, and oversized arithmetic/RAII/formatting dependencies; no
  implementation action is needed for those comments.

## Verification Gaps

This assessment is based on source, fixture, specification, build, and test inspection. No native
implementation was changed, and no Linux sanitizer suite or Windows MSVC suite was run. The
platform-specific and regression checks described above remain required when each selected comment
is implemented.
