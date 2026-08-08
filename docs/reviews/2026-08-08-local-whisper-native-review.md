# Local Whisper Voice Provider Native (C++) Review

Date: 2026-08-08
Branch: `feat/local-whisper-provider`
Reviewed range: `main...HEAD`
Focus: native C++ implementation — security, resource leaks, fault tolerance
Verdict: **Request changes** (one critical defect: `std::terminate` on untrusted input)

## Scope

The branch contains 893 changed files and ~153k insertions. This review covers the
~14.5k lines of project-owned C++ under `runtime/local-whisper/`:

- `common/` — frame codec, bounded JSON, SHA-256, canonical WAV, device proof, model
  authority records, process identity
- `whisper-cpp/` — worker application, whisper.cpp adapter, device registry, exact model
  reader, PCM audio, cancellation, worker protocol
- `fs-guard/` — managed filesystem guard, Linux/Windows backends, model launch application,
  model authority server
- `launcher/` — launch request parsing, Linux/Windows launchers, model authority client

Vendored upstream sources under `.cache/local-whisper/` are excluded.

## Trust Model

- **Protected assets:** managed model and runtime artifacts, model launch authority, GPU
  device selection proof, worker executable integrity, application availability.
- **Trusted:** the Electron main process, which is the sole writer of the fs-guard and
  launcher control channels.
- **Untrusted:** the filesystem (concurrent racing processes), the GPU/driver stack, model
  artifact bytes, and the worker's own protocol peer once inference is in flight.
- **Required properties:** no path traversal or symlink escape, no unchecked capability
  transfer, bounded parsing, deterministic non-throwing cleanup, exact model authentication,
  and no unbounded resource growth in the long-lived guard.

## Overall Assessment

The native layer is well above average for security-sensitive C++. Notably sound:

- `openat2` with `RESOLVE_BENEATH | NO_SYMLINKS | NO_MAGICLINKS | NO_XDEV` for every managed
  component, `renameat2(RENAME_NOREPLACE)` for promotion and quarantine, and held-vs-named
  inode identity comparison before every mutation.
- Verify-then-exec chain in the launcher: `openat2` without symlinks, `fstat` identity, full
  digest, re-`fstat` for change detection, then `fexecve` on the **held** descriptor. No
  pathname reopen anywhere in the window.
- `SCM_CREDENTIALS` plus `/proc/<pid>/stat` start-identity binding on both ends of the model
  authority handshake.
- Double-snapshot TOCTOU guard on GPU enumeration, including `native_token` comparison.
- An exact-read model loader that refuses to advance past the authenticated size and verifies
  the digest over exactly the bytes the loader consumed.
- `-Wall -Wextra -Wpedantic -Werror` plus optional ASan/UBSan across all four CMake projects.
- Lock stealing requires the recorded owner's start-identity to no longer match, which
  correctly handles PID reuse.

The problems concentrate in two areas: **exception safety around manually-managed resources**
and **redundant work on the hot path**.

---

## Critical

### C1. `std::terminate` on any throw between thread start and join

`runtime/local-whisper/whisper-cpp/core/worker_application.cpp:497-528`

```cpp
std::thread inference([&, transcription_request_id] { ... });   // 497

auto next = channel_.read_control();                            // 512  <- throws
const bool is_cancel = next.value("type", "") == "cancel";
if (is_cancel) {
  require_exact_keys(next, {"type","protocolVersion","requestId","targetRequestId"}); // 516 <- throws
  require_protocol(next, "cancel");                             // 517  <- throws
  if (require_string(next, "targetRequestId", 128U) != transcription_request_id) { // 518 <- throws
    cancellation_.request();
    static_cast<void>(terminal.cancel());
    inference.join();          // <- the author remembered it *here*
    throw CoreError(...);
  }
```

`inference` is a raw `std::thread` declared last in the scope, so it is destroyed **first**
during unwinding. A joinable `std::thread` destructor calls `std::terminate()`. Four throw
sites sit between construction and `join()`:

- **512** — `read_control()` throws `CoreError` on EOF, short read, frame-limit violation,
  bounded-JSON rejection, or non-object payload. The realistic trigger is the supervisor
  closing the worker's stdin while inference is running (app shutdown, supervisor crash,
  pipe error).
- **516 / 517 / 518** — any malformed `cancel` frame: an extra field, a missing
  `targetRequestId`, a wrong `protocolVersion`.

Result: `SIGABRT` instead of a `failure` frame. No `engine_.unload()`, no CUDA context
teardown, no protocol error code — the supervisor only sees a signal death. The join at 521
shows the hazard was known; the other four paths were missed.

The existing test only exercises a **well-formed** cancel
(`runtime/local-whisper/whisper-cpp/tests/worker_application_test.cpp:285-310`), which is why
this survived.

**Fix.** The project is on C++20, so this is one word plus a scope guard:

```cpp
cancellation_.reset();
InferenceTerminalArbiter terminal;
std::exception_ptr inference_error;
const auto transcription_request_id = *current_request_id_;
std::jthread inference([&, transcription_request_id] { ... });   // joins on destruction
```

`std::jthread`'s destructor joins, so unwinding is safe. Ordering requirement: on the unwind
path the thread must be told to stop *before* the join, otherwise a `block_until_cancel`-style
engine hangs forever. Wrap the arbiter and cancellation signal in a guard declared before the
thread:

```cpp
struct InferenceStop {
  CancellationController& cancellation;
  InferenceTerminalArbiter& terminal;
  bool armed = true;
  ~InferenceStop() noexcept {
    if (!armed) return;
    cancellation.request();
    static_cast<void>(terminal.cancel());
  }
} stop{cancellation_, terminal};
std::jthread inference(...);
// on the normal paths: stop.armed = false; before returning or continuing
```

**Required tests:** malformed cancel during inference, and stdin EOF during inference. Both
must produce a `failure` frame and exit 10.

---

## High

### H1. Systematic file descriptor leaks in the fs-guard Linux backend

`runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp`

`UniqueFd` is available in the same file but is used **only** for `Lease` members. Every
intermediate descriptor is a raw `int`, and the helpers (`checked_stat`, `identity_string`,
`hash_file`, `read_lock_metadata`, `open_managed_directory`) all throw.

| Location | Leaked |
| --- | --- |
| `:498` `checked_stat` throws | `fd` + `locks_fd` |
| `:502` `fsync` failure — explicit throw, no close | `fd` + `locks_fd` |
| `:515-516` `checked_stat` / `read_lock_metadata` throw | `fd` + `locks_fd` |
| `:587-588` `checked_stat` / `identity_string` / `hash_file` throw | `fd` + the `fdopendir` `DIR*` |
| `:719` `checked_stat` throws | `fd` |
| `:777` `open_managed_directory` throws | `parent` |
| `:816` `identity_string` throws | `final_parent` |
| `:841` `open_namespace` throws | `source_parent` |

This matters more than it would in a short-lived process, for two reasons. The guard is a
**long-lived daemon** — `GuardApplication::run` loops on stdin and swallows every
`GuardError`, so leaked descriptors accumulate across requests. And the triggers are
**filesystem state**, which is exactly the adversary in the threat model: a process racing the
managed directory can drive repeated `UNSAFE_ENTRY` / `IDENTITY_CHANGED` and walk the guard
into `EMFILE`, after which every operation fails.

There is also no cap on `leases`. Each holds two descriptors and `release` is caller-driven,
so a buggy caller reaches the same state.

**Fix.** Use `UniqueFd` for every descriptor in this file and `release()` into the `Lease` at
the transfer point. `list_directory` should own the `DIR*` in a
`unique_ptr<DIR, closedir_deleter>`. Consider adding a `kMaxLeases` bound.

### H2. The model file is SHA-256'd four times per load, twice in the same process

1. `fs-guard/src/platform/linux/model_launch_application.cpp:293` —
   `hash_descriptor(model.file.get(), request.model_size_bytes)` compared against
   `request.model_sha256`
2. `fs-guard/src/platform/linux/model_authority_server.cpp:148` —
   `validate_regular_file_evidence`, **same process, same descriptor**, compared against
   `binding.artifact_content_sha256`, which is `parse_hex(request.model_sha256)` from step 1
3. Worker preflight pass — `ExactModelReader::verify_complete()`
4. Worker load pass after `rewind_after_verified_pass()` — `verify_complete()` again

Passes 3 and 4 are a defensible trust decision: the worker does not take the guard's word, and
the loader must be verified on the bytes it actually consumed. **Passes 1 and 2 are pure
redundancy** — same process, same descriptor, same expected digest, no state change between
them.

Cost: `large-v3` full is roughly 3 GB. The scalar SHA-256 here (no SHA-NI, no multi-buffer)
realistically runs 150-400 MB/s, so each pass is ~8-20 s, and each load moves ~12 GB through
the page cache. Collapsing 1 and 2 removes a quarter of that for free. Worth evaluating
whether 3 and 4 can also collapse by having the preflight consume the loader's read stream
rather than making an independent pass.

Related: `validate_regular_file_evidence` heap-allocates its 64 KB buffer per call while
`hash_descriptor` stack-allocates a zero-initialized one. Pick one.

### H3. Unbounded allocation before the line-length check

`runtime/local-whisper/fs-guard/src/common/guard_application.cpp:64-68`

```cpp
while (std::getline(input, line)) {
  ...
  if (line.size() > kMaxLineBytes) { throw GuardError(ErrorCode::kInvalidInput); }
```

`std::getline` reads the entire line into `line` **before** the check, so `kMaxLineBytes`
(256 KB) bounds nothing — a newline-free stream grows the string until OOM. Only the trusted
main process writes here, so this is robustness rather than a vulnerability, but the check
reads as if it enforces a bound and does not. Read with a bounded loop, or use
`input.getline(buffer, kMaxLineBytes + 1)` and treat a set `failbit` with a full buffer as
over-length.

---

## Medium

### M1. Inference failure is not reported until the next control frame arrives

`whisper-cpp/core/worker_application.cpp:512-541`

If `engine_.transcribe` throws, the inference thread stores the exception and exits, but the
main thread is blocked in `read_control()` at 512 while the client waits for a `transcript`.
Nothing is sent until the client sends something, probably after a timeout. A
`MODEL_LOAD_FAILED` or `ALLOCATION_FAILED` mid-inference therefore surfaces as a client-side
timeout rather than its actual code.

The arbiter already has the right shape. Have the inference thread transition to a `failed`
state and make the main thread wait on either a control frame **or** the arbiter leaving
`running` (self-pipe, or `poll` on stdin plus an eventfd).

### M2. A cancel that loses the race kills the worker

`whisper-cpp/core/worker_application.cpp:542-544`

If the transcript commits first and a `cancel` was already in flight, the worker throws
`INVALID_SETTINGS` and exits 10. That is a benign and unavoidable user-timing race — pressing
cancel as the transcript lands — being treated as a protocol violation. The arbiter already
knows who won; reply with a `cancelIgnored` / `cancelTooLate` frame and keep the session alive.

### M3. Busy-spin during shutdown

`launcher/src/platform/linux/linux_launcher.cpp:293-294` and
`fs-guard/src/platform/linux/model_launch_application.cpp:244-249` set
`termination_requested` on control `POLLHUP` but do not sleep. `POLLHUP` is level-triggered
and permanent, so `poll` returns immediately on every subsequent iteration and both loops burn
100% of a core for the full 5 s `kGracefulTerminationBudget`.

`linux_launcher.cpp:224-227` gets this right with an explicit `sleep_for(kPollInterval)`. The
other two paths, including the primary `full_load` path, are missing it.

Cleaner than adding sleeps: once a descriptor is done, set its `pollfd.fd = -1` so `poll`
ignores it. The same applies to `descriptors[1]` after `worker_input.reset()`, which keeps
polling `STDIN_FILENO` on a closed-write-end pipe.

### M4. Four SHA-256 implementations, one with an out-of-bounds write

- `common/src/sha256.cpp` — the good one (guards `finished_`, overflow-checks `total_bytes_`)
- `launcher/src/common/sha256.cpp` — byte-identical constants and `transform`, different
  interface
- `fs-guard/src/platform/linux/linux_backend.cpp:307-406` — a third copy nested inside a
  platform `Impl` class
- plus the reference codec in `common/python/`

The nested copy has two defects the canonical one does not:

```cpp
std::string finish() {
  buffer_[buffer_length_++] = 0x80;   // no finished_ guard
```

After `finish()`, `buffer_length_ == 64`. A second call writes `buffer_[64]` on a
`std::array<unsigned char, 64>` through unchecked `operator[]` — an **out-of-bounds write**.
Not reachable today because every `hash_file` constructs a fresh digest, but it is one
refactor away, and the canonical implementation was explicitly hardened against it.

`update` is also byte-at-a-time:

```cpp
for (std::size_t index = 0; index < length; ++index) {
  buffer_[buffer_length_++] = data[index];
  bit_length_ += 8;
```

That is roughly an order of magnitude slower than the canonical block-copy version, and it is
what hashes model files (see M5).

The launcher and fs-guard both already link code from `common/`, so there is no build reason
for three copies. Delete two.

### M5. `LIST` hashes every file in the directory on every call

`fs-guard/src/platform/linux/linux_backend.cpp:588` calls `hash_file(fd)` for each entry,
through the byte-at-a-time digest above. For a model artifact directory that means a full
SHA-256 of multi-GB weights on every directory listing. If the caller needs content identity
per entry, it should ask for it explicitly, or the guard should cache it against
`(dev, ino, size, mtime)`. `identity_string` already carries the metadata identity that most
callers actually want.

Relatedly, `linux_backend.cpp:751-761`: `list` validates `expected_entries` and then
**discards them** — `list_directory` never compares against the expectation. Either wire it up
or drop the parameter; it currently reads as an enforced check that is not one.

### M6. Error contracts encoded as exception-message string matching

`launcher/src/main.cpp:41-86` and `fs-guard/src/main.cpp:19-44` map `error.what()` to protocol
codes with `==`, `starts_with`, and `find`:

```cpp
if (message == "launcher digest changed" || message == "launcher read failed" ...)
  return "DIGEST_REJECTED";
```

Every one of those literals is duplicated at its throw site hundreds of lines away, with no
compiler or test enforcing agreement. Rewording a message silently reclassifies a failure, and
these codes drive the supervisor's retry and quarantine decisions. `AGENTS.md` asks for
"explicit safe error contracts"; this is the opposite. Carry a code enum in the exception type
— the fs-guard already has `GuardError(ErrorCode)`, so extend that pattern to the launcher and
model-launch paths.

Related asymmetry: on failure the Windows path writes `FAILED\t<code>` to the acknowledgment
channel, while the Linux path returns 20/10 with **no code at all**
(`fs-guard/src/main.cpp:62-67`, `launcher/src/main.cpp:121-126`). Linux diagnosis is strictly
worse than Windows for the same failure.

### M7. Typed commands are flattened back into positional string vectors, then re-validated

`fs-guard/src/common/command.cpp` parses and validates each request into a typed `Command`
variant. Every `LinuxBackend` method then converts it **back** into a
`std::vector<std::string>` and `Impl` re-validates positionally:

```cpp
ResponseFields LinuxBackend::lock(const LockCommand& command) {
  return impl_->lock({command.root_token, command.artifact_name, command.instance_nonce, ...});
}
// then, in Impl::acquire_lock:
if (arguments.size() != 7 || !is_artifact_name(arguments[1]) ||
    !is_safe_token(arguments[2], 16, 128) ...
```

That is ~18 pass-through wrappers discarding the type safety the variant exists to provide,
and it is precisely the "free pass-through wrapper" pattern `AGENTS.md` prohibits. It is also
already **diverging**: `command.cpp` validates the mode with `is_mode` (`<= 0777`), while
`create_file` re-parses it with `strtol` and *additionally* requires `(mode & 0077) == 0`. The
two layers disagree about what is valid, which makes the outer check misleading. Likewise
`is_positive_decimal` exists, but `acquire_lock` and `process_identity` hand-roll `strtol`.

Defense in depth would be a fair defense if the layers agreed and the inner one were expressed
on typed data. Have `Impl` take the typed structs.

### M8. Locale-dependent character classification in security validators

`fs-guard/src/common/validation.cpp` uses `std::isalnum`, `std::isdigit`, `std::isxdigit`, and
`std::isupper` in `is_safe_token`, `is_artifact_name`, and `is_runtime_launch_file_name`. These
are locale-sensitive: outside the `"C"` locale, `isalnum` accepts high-byte characters (for
example `0xE9` in Latin-1), so `is_safe_token` would admit bytes the validator is meant to
exclude and `is_artifact_name`'s hex check would loosen.

The launcher is spawned with `LC_ALL=C`, so today the behavior is correct — but that is an
environment invariant enforced three processes away, protecting a filename validator.
Everywhere else in this codebase explicit ranges are already used (`require_digest`,
`is_sha256`, `is_hex`, `decode_character`). Do the same here.

### M9. Descriptor leaks on hostile `SCM_RIGHTS` layouts

`launcher/src/platform/linux/model_authority_client.cpp:78-93` — the cmsg loop only recognizes
`SCM_RIGHTS` with `cmsg_len == CMSG_LEN(sizeof(int))`. A peer sending **two** descriptors in
one `SCM_RIGHTS` cmsg falls into the `else` branch, but the kernel has already installed both
descriptors in this process and the branch closes only `received_descriptor`, still `-1`. Both
leak. Two separate `SCM_RIGHTS` cmsgs leak the first one, because the second `memcpy`
overwrites the variable before `rights_count != 1` rejects.

`fs-guard/src/platform/linux/model_authority_server.cpp:58-66` has the same shape and
additionally omits `MSG_CMSG_CLOEXEC` (the client passes it), so a descriptor smuggled to the
guard leaks across any subsequent `exec`.

The peer is a child process in both directions, so exploitability is near zero. But this is
the one place whose entire job is validating a capability transfer, and it does not account for
the kernel having already granted the capability before validation runs. Iterate all
descriptors in each `SCM_RIGHTS` cmsg (`(cmsg_len - CMSG_LEN(0)) / sizeof(int)`) and close
every one that was not requested.

---

## Low / Hardening

- **No exploit-mitigation flags.** All four `CMakeLists.txt` set
  `-Wall -Wextra -Wpedantic -Werror` plus optional ASan/UBSan, but none set
  `-fstack-protector-strong`, `-D_FORTIFY_SOURCE=2`, `-Wl,-z,relro,-z,now`,
  `-Wl,-z,noexecstack`, or PIE. For binaries that parse untrusted filesystem and driver data
  these are table stakes. `-Wconversion -Wshadow` would also catch a number of the narrowing
  casts.
- **No ThreadSanitizer**, despite the worker having the only real concurrency in the tree (the
  inference thread plus `InferenceTerminalArbiter` and `CancellationController`). The channel
  itself is sound — POSIX uses separate `STDIN_FILENO` / `STDOUT_FILENO` and Windows separate
  `HANDLE`s with no shared mutable state, so the concurrent send-while-read is safe — but that
  property deserves a TSan run to defend it.
- **Duplicated magic frame constant.** `common/src/frame_codec.cpp:11` computes the
  audio-frame ceiling as `kMaxAudioChunkBytes + 1U + 1U + 4U + 2U + 128U`, while
  `whisper-cpp/core/worker_protocol_posix.cpp:71` hardcodes `kMaxAudioChunkBytes + 136U`. Same
  number, two spellings, no link between them: change the audio header layout and one silently
  diverges. Name it (`kAudioFrameOverheadBytes`) in the header.
- **Unchecked ggml returns** in `whisper-cpp/adapter/whisper_engine.cpp:255-267`.
  `ggml_new_tensor_1d`, `ggml_add`, and `ggml_new_graph_custom` are used without null checks,
  while `ggml_init` and the buffer allocation immediately adjacent **are** checked. A null
  tensor into `ggml_add` crashes inside ggml instead of producing `ALLOCATION_FAILED`.
- **Manual cleanup where RAII was available.** `whisper_engine.cpp:339-361` calls
  `whisper_free(loaded)` at three separate sites. `ContextOwner` exists ten lines above. Add a
  `release()` to it and wrap `loaded` immediately.
- **Environment and descriptor hygiene differ between the two spawning components.** The
  model-launch guard passes an explicit `{LANG=C, LC_ALL=C}` and calls
  `close_range(7, UINT_MAX)` before `fexecve`
  (`fs-guard/src/platform/linux/model_launch_application.cpp:321-327`). The launcher passes
  `environ` wholesale and closes only descriptors 3 and 4
  (`launcher/src/platform/linux/linux_launcher.cpp:438-459`). Today that is safe: the TS side
  spawns with `{LANG:'C', LC_ALL:'C'}`
  (`src/main/localWhisper/supervisor/NativeLauncherProcessOwner.ts:119-120`) and the
  intermediate descriptors are all `O_CLOEXEC`. But the worker's `LD_PRELOAD` /
  `LD_LIBRARY_PATH` immunity currently rests on an invariant established three processes
  upstream, guarding a binary whose SHA-256 is verified at considerable cost. Have the launcher
  build its environment explicitly and `close_range` like its sibling does.
- **Per-call table and container construction.** `base64url_decode` rebuilds a 256-entry
  inverse table on every argument of every request (`fs-guard/src/common/protocol.cpp:35-41`);
  `parse_load` constructs a `std::set<std::string>` of model families on every load
  (`whisper-cpp/core/worker_application.cpp:243`). Both want to be namespace-scope `constexpr`.
  `base64url_decode` also re-encodes the full payload to check canonicality, tripling peak
  memory for large `WRITE_FILE` arguments; a direct canonical-form check on the input is
  cheaper.
- **`hex_digest` duplicates an already-included function.**
  `whisper-cpp/core/worker_application.cpp:78-87` reimplements `common::to_lower_hex`, which
  the file already includes through `common/sha256.hpp`.
- **`skip_exact` zero-initializes 64 KB of stack per call**
  (`whisper-cpp/core/exact_model_reader.cpp:46`). Make it a member buffer, or at minimum drop
  the `{}`.
- **Peak audio memory.** In the transcribe path `wav` (up to 57 MB) stays alive for the whole
  inference even though `PcmAudio` has already copied everything into floats (up to 115 MB).
  `wav.clear(); wav.shrink_to_fit();` after `from_canonical_wav` saves a third of peak.
- **Magic exit codes.** `10`, `11`, `12`, `20`, `126`, and `2` appear as bare literals across
  the four `main` functions and `WorkerApplication::run`. These are a protocol with the
  supervisor; name them.
- **Asymmetric authority-socket timeouts.** The guard sets `SO_RCVTIMEO` / `SO_SNDTIMEO` to
  10 s (`fs-guard/src/platform/linux/model_launch_application.cpp:169-177`); the launcher's
  `recvmsg` has none. `PDEATHSIG` plus `kill_and_reap_launcher` bounds it in practice, but the
  launcher blocks indefinitely if the guard stalls without dying.
- **`read_bootstrap_line` requires the newline to be the final byte of a `read()`**
  (`launcher/src/common/launch_request.cpp:197-201`) and otherwise throws
  `"launcher trailing bootstrap bytes"`. Correct for the current write-once control channel,
  but it encodes an assumption about pipe write boundaries that pipes do not guarantee. Add a
  comment stating the invariant.

---

## Verified Sound

Checked in detail, no defects found:

- **SHA-256** in `common/src/sha256.cpp` — padding boundaries at `buffered_bytes_` 55/56/63,
  the compression function's `a..h` mapping, and the `finished_` and overflow guards.
- **`WavAccumulator`** — sequence monotonicity, the `expected_bytes_ - bytes_.size()`
  remaining-capacity check (invariant holds), terminal-state latching, and `cancel()` on every
  error path.
- **`PcmAudio::from_canonical_wav`** — the sample loop's maximum offset is exactly
  `bytes.size() - 1`, provably in bounds from the header validation.
- **`bounded_json`** — depth, member, element, event, and string caps; duplicate-key
  rejection; float and binary rejection; and the safe-integer lexeme pre-pass. The hand-rolled
  number scanner correctly skips string bodies and handles escapes; no valid-JSON false reject
  was constructible.
- **`/proc/<pid>/stat` parsing** — both implementations use `rfind(')')`, robust against
  parentheses in `comm`, and both land on field index 19 (`starttime`), so they agree.
- **`DeviceRegistry::resolve`** — double snapshot with `native_token` comparison plus
  fingerprint re-derivation is a correct TOCTOU guard for enumeration.
- **Launcher verify-then-exec chain** — no pathname reopen in the verification window.
- **`close_lease`** — unlinks a lock only after confirming held-vs-named inode identity.
- **Worker channel concurrency** — separate descriptors/handles for read and write, no shared
  mutable state, so the inference thread's `send_control` racing the main thread's
  `read_control` is safe on both platforms.

## Recommended Order of Work

1. **C1** — `std::jthread` plus stop guard, with the two missing tests. Blocks merge.
2. **H1** — `UniqueFd` throughout `linux_backend.cpp`, plus a lease cap.
3. **H2** — collapse the two same-process model digest passes.
4. **M3**, **M2**, **M1** — shutdown spin, cancel-race, and failure-reporting liveness.
5. **M4**–**M9** and the hardening list as follow-up cleanup.
