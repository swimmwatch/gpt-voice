# Local Whisper Native Review Comments to Address

Date: 2026-08-08  
Source review: `docs/reviews/2026-08-08-local-whisper-native-review.md`  
Assessment basis: current `feat/local-whisper-provider` source, directly related tests,
the Local Whisper specification, and the neighboring native/platform implementations.

## Address Before Merge

### 1. C1 — Make the inference thread exception-safe

**Location:** `runtime/local-whisper/whisper-cpp/core/worker_application.cpp:493`

The review is correct that `read_control()` and cancel validation can throw while
`inference` is a joinable `std::thread`. Stack unwinding then destroys the thread and
calls `std::terminate`, bypassing the worker's typed failure and cleanup paths.

Replace the raw thread with scoped ownership and guarantee that cancellation is
requested before the thread owner joins during unwinding. The declaration order in
the review's sample needs correcting: a cancellation/terminal scope guard must be
declared **after** the `std::jthread`, so the guard is destroyed first and wakes a
blocking inference before `jthread` joins. Disarm it only after a successful explicit
join on normal paths.

Add regression tests for malformed cancel messages and control-channel EOF during a
blocking inference. They should prove bounded join/cleanup, no process abort, and the
applicable `failure` frame/exit code when the output channel remains writable.

### 2. H1 — Use RAII for every transient Linux fs-guard descriptor and bound leases

**Location:** `runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp`

The raw descriptors in `acquire_lock`, `list_directory`, `create_file`, `promote`, and
`quarantine` leak when `checked_stat`, `identity_string`, `hash_file`,
`read_lock_metadata`, `open_namespace`, or an explicit `fsync` failure throws. This is
material because `GuardApplication` is long-lived and continues after each
`GuardError`, allowing failures to accumulate into `EMFILE`.

Own every transient descriptor with `UniqueFd`, transfer ownership into `Lease` only
at the successful handoff point, and own `DIR*` with a `closedir` deleter. Add a
documented maximum live-lease count so a trusted-but-buggy caller cannot exhaust the
process with unreleased leases.

Add failure-injection integration coverage that repeats each relevant failure and
asserts a stable descriptor count, plus boundary tests for the lease cap.

### 3. H3 — Enforce the fs-guard line limit while reading

**Location:** `runtime/local-whisper/fs-guard/src/common/guard_application.cpp:62`

`std::getline` allocates the complete line before checking `kMaxLineBytes`, so the
advertised 256 KiB bound does not protect the guard from a very large or newline-free
input. Replace it with a bounded reader that detects overflow before growing beyond
the limit and safely consumes or terminates the rejected request according to the
transport contract.

Test an exact-limit line, a limit-plus-one line, and a newline-free stream without
constructing an unbounded string.

### 4. M1 — Report inference failure without waiting for another control frame

**Location:** `runtime/local-whisper/whisper-cpp/core/worker_application.cpp:497`

When `engine_.transcribe` fails, the inference thread stores the exception while the
control owner remains blocked in `read_control()`. The supervisor receives neither a
transcript nor the specific failure until it sends another frame or reaches its
timeout.

Give the control owner a cross-platform way to wait for either control input or
inference completion/failure, then rethrow the stored exception promptly on the owner
thread so the existing typed `failure` path runs. Cover an immediate engine failure
and a delayed failure with no subsequent client frame.

### 5. M2 — Define and implement the cancel-lost race as a nonfatal outcome

**Location:** `runtime/local-whisper/whisper-cpp/core/worker_application.cpp:524`

A valid cancel can be sent while transcription is in flight but lose the arbiter race
to a transcript that commits concurrently. The worker currently throws
`INVALID_SETTINGS`, leaves `current_request_id_` referring to the transcription, and
exits, turning normal user timing into a worker/protocol failure.

Resolve the wire behavior in the Local Whisper protocol first because protocol v1
currently defines only `cancel`/`cancelled`, not the review's proposed
`cancelIgnored`/`cancelTooLate` frame. Then update the C++ worker, TypeScript
supervisor, validators, golden fixtures, and race tests together. The losing cancel
must receive one deterministic terminal result without invalidating an already
committed transcript or killing an otherwise healthy resident worker.

### 6. M3 — Stop polling descriptors after permanent HUP/closure

**Locations:**

- `runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp:270`
- `runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp:224`

`proxy_owned_group` reconstructs poll entries for the control descriptor and
`STDIN_FILENO` even after the associated direction is closed, and
`wait_for_launcher` continues polling a permanently hung-up owner descriptor during
the termination budget. Level-triggered `POLLHUP` therefore makes the loops spin
until the kill deadline.

Persist the poll state and set completed descriptors to `-1` (or otherwise remove
them) once they are no longer useful. Add process-level tests that close each control
direction and assert bounded CPU use while the graceful-termination timer runs.

### 7. M5 (expected-entry half) — Enforce Linux `LIST` expectations

**Location:** `runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp:751`

Linux validates the syntax of `ListCommand::expected_entries` and then discards it,
whereas the Windows backend rejects unexpected names and checks the expected mode.
As a result, Linux can accept an extra otherwise-valid file or a mode mismatch in an
artifact directory that the caller asked to validate exactly.

Pass the typed expected-entry set into `list_directory` and enforce the same exact
name/mode contract on both platforms. Add shared contract cases for missing, extra,
duplicate, and wrong-mode entries. This item does **not** adopt the review's separate
suggestion to cache file digests by mutable metadata.

### 8. M9 (launcher receiver) — Close every received `SCM_RIGHTS` descriptor on rejection

**Location:** `runtime/local-whisper/launcher/src/platform/linux/model_authority_client.cpp:57`

The launcher receiver only owns an `SCM_RIGHTS` message whose payload is exactly one
`int`. Multiple descriptors in one control message, multiple rights records, or some
truncated/unexpected layouts can install descriptors before validation and then throw
without closing all of them. That violates the handoff contract's requirement to
reject and close duplicate or extra capabilities.

Parse all installed descriptors into RAII owners immediately, retain exactly one only
after the complete credential/binding validation succeeds, and close all others on
every exit. Add hostile ancillary-data tests for zero, one, and multiple descriptors,
including truncation and repeated control records.

The review's related statement that the current fs-guard receiver omits
`MSG_CMSG_CLOEXEC` is stale/incorrect; `model_authority_server.cpp` already passes that
flag. Do not carry that subclaim into remediation.

## Address as Follow-up Cleanup and Hardening

### 9. M4 — Consolidate native SHA-256 on the hardened common implementation

**Locations:**

- `runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp:307`
- `runtime/local-whisper/launcher/src/common/sha256.cpp:1`
- `runtime/local-whisper/common/src/sha256.cpp:1`

Both fs-guard and launcher already compile the common SHA-256 source, yet also carry
private implementations. The fs-guard copy is byte-at-a-time and a second `finish()`
would write past its 64-byte buffer. That second call is not currently reachable, so
this is consolidation/hardening rather than a present exploitable write.

Use `local_whisper::common::Sha256` everywhere and keep descriptor/handle streaming as
small platform adapters. Retain shared standard-vector, chunking, overflow, and
single-finish tests.

### 10. M6 — Replace exception-message classification with typed launch errors

**Locations:**

- `runtime/local-whisper/launcher/src/main.cpp:41`
- `runtime/local-whisper/fs-guard/src/main.cpp:19`

Windows acknowledgment codes are selected by comparing `error.what()` with duplicated
message text. Rewording a throw site can silently change the protocol classification.
Introduce typed launcher/model-launch error enums carried by dedicated exception
types, and map those enums to acknowledgment/exit policy in one place.

Preserve the existing platform acknowledgment contract while doing this; the review's
Linux-versus-Windows acknowledgment asymmetry should not be changed without a matching
specification decision. Name the native exit codes as part of the same explicit
contract cleanup.

### 11. M7 — Keep typed fs-guard commands typed inside platform backends

**Location:** `runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp:990`

The public backend receives validated command structs, flattens them into positional
string vectors, and has `Impl` parse and validate them again. The Windows backend uses
the same pattern. This discards type safety, duplicates numeric parsing and domain
rules, and conflicts with the project's prohibition on free pass-through wrappers.

Have platform implementations consume the typed command structures directly, parse
numeric fields once at the command boundary, and express platform invariants on typed
values. Preserve integration tests for both backends while removing the duplicate
positional validation.

### 12. Low/Hardening — Add explicit native exploit-mitigation flags

**Locations:** the four `runtime/local-whisper/*/CMakeLists.txt` files

The native projects enable warnings-as-errors and optional ASan/UBSan but do not
explicitly request stack protection, fortified libc checks, RELRO/NOW, non-executable
stack, or PIE on Linux. Add a shared, configuration-aware hardening policy for
production executables and verify the emitted ELF properties. Keep sanitizer builds
compatible, and define the equivalent supported MSVC linker protections rather than
blindly applying Unix flags on Windows.

### 13. Low/Hardening — Canonicalize the audio-frame overhead constant

**Locations:**

- `runtime/local-whisper/common/src/frame_codec.cpp:11`
- `runtime/local-whisper/whisper-cpp/core/worker_protocol_posix.cpp:66`

The encoder derives the maximum audio-frame overhead as `1 + 1 + 4 + 2 + 128`, while
the POSIX reader hardcodes the equivalent `136`. Define one public
`kAudioFrameOverheadBytes`/maximum-audio-body constant in the common frame contract and
use it in both directions, with a boundary test proving the encoder and decoder share
the same maximum.

## Verification Gaps

This assessment is based on source, test, specification, and build-configuration
inspection. No implementation was changed and no native test suite, sanitizer run,
Windows build, or process-level CPU/descriptor probe was executed. Each item above
therefore includes the verification that should accompany its remediation.
