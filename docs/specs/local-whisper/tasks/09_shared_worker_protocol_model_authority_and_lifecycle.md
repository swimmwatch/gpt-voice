# 09 Shared Worker Protocol, Model Authority, And Lifecycle

## Outcome

The unreleased worker protocol v1 becomes one bounded, cross-language security
and lifecycle contract for TypeScript and C++20 peers. It has one
canonical lexical JSON grammar and event-accounting algorithm, one versioned
device-registry/proof encoding, exact canonical WAV framing, a fresh
probe-versus-full-load process split, authenticated Linux and Windows
model-authority handoff, and deterministic terminal-race cleanup. The packet
preserves and repairs the existing dirty supervisor checkpoint without
compiling an inference engine.

Plan revision 12 preserves Task 09's completed implementation baseline and
retains the authoritative unreleased native authority-record migration from Task 10. Task
10 atomically migrates the common binding to the sizes and artifact-evidence
fields below before any engine work; old record lengths are then invalid.

## Prerequisites

- `docs/specs/local-whisper/spec.md` is `Status: Approved`, revision 7.
- Tasks 01, 03, 04, 06, 07, and 08 are complete.
- Task 08 has materialized and verified source locks
  `nlohmann-json-v3.12.0-subset` and
  `googletest-v1.17.0-52eb810`; no generated archive, system package, package
  registry, or implicit download may provide the C++ decoder or test framework.
- Task 08's `linux-x64-cpu-baseline-v1` GCC profile and
  `linux-x64-clang-18.1.3-asan-ubsan-v1` profile are executable-qualified,
  including real ASan and UBSan execution. A candidate or skipped sanitizer
  profile does not satisfy this prerequisite.
- The current dirty protocol/supervisor checkpoint is the explicit starting
  state. Its `{ kind: 'cpu' } | { kind: 'gpuIndex', index: 0..255 }` binding,
  vectors, supervisor changes, and tests SHALL be preserved and reconciled,
  not discarded or overwritten wholesale.
- This plan and Task 09 have separate explicit authorization. Earlier Task-08
  execution authorization does not apply.

## Owned Requirements

- Primary: `RUN-006`, `RUN-007`, `RUN-009`, `AUDIO-001`, `AUDIO-002`,
  `SEC-010`, `SEC-011`, `AC-AUTO-053`, `AC-AUTO-054`, `AC-AUTO-056`.
- Shared boundary slices: `ARCH-005`, `RUN-001`, `RUN-002`, `RUN-003`,
  `RUN-004`, `RUN-005`, `SEC-005`, `SEC-007`, `CAP-014`, `PRIV-001`,
  `PRIV-004`, `FAIL-005`, `FAIL-007`, `FAIL-008`.
- Supporting acceptance: `AC-AUTO-024`, `AC-AUTO-026`, `AC-AUTO-033`,
  `AC-AUTO-040`, `AC-AUTO-051`, `AC-AUTO-052`.

## In Scope

- Exact frame, JSON lexical, parser-resource, schema, device-authority, and
  proof DTO contracts shared by TypeScript and C++.
- Duplicate-aware nlohmann SAX adapter plus a separate bounded lexical numeric
  validator; no nlohmann DOM types escape the C++ codec.
- Project-owned CMake integration that requires the verified local GoogleTest
  source root and adds it with `add_subdirectory` using `BUILD_GMOCK=OFF`,
  `INSTALL_GTEST=OFF`, and `GTEST_HAS_ABSL=OFF`. Existing filesystem-guard and
  launcher test builds SHALL migrate away from Git-based `FetchContent` in the
  same atomic native-test graph; no URL or `find_package` fallback is allowed.
- Canonical protocol and proof vector generation with exact N/N+1 boundaries.
- Canonical in-memory PCM16/16-kHz WAV validation and bounded ordered audio
  accumulation.
- Probe-only and fresh full-load launch modes.
- One-use Linux credentialed descriptor handoff and Windows arbitrary-HANDLE
  logical-slot bootstrap using the existing filesystem-guard and launcher
  roles.
- Supervisor response/revalidation/cancellation races, one writer, one
  inference owner, deadlines, bounded stderr, and complete process cleanup.
- Linux executable integration plus Windows compile/source/contract CI
  definitions. Representative Windows execution remains Task 19-only.

## Out Of Scope

- `whisper.cpp` engine adaptation, model parsing, physical GPU
  enumeration, stable renderer-facing device IDs, capability state, IPC/UI,
  artifact publication, or support-tier promotion.
- A model path in argv, protocol, bootstrap, environment, or cwd.
- A third authority daemon, listener, persistent named pipe/socket, or any
  inference network surface.
- Representative Windows, AMD, or Apple Silicon execution.

## Task Contract

### Canonical framed transport

Protocol version remains integer `1`. A frame consists of a 4-byte unsigned
big-endian body length, one kind byte, and exactly that many body bytes. Kind
`0x01` is UTF-8 JSON control; kind `0x02` is binary audio. The length excludes
the five-byte header. Unknown kinds, truncated/overlong frames, trailing bytes,
and control bodies above 1,048,576 bytes are terminal protocol violations.
Audio payload chunks are at most 1,048,576 bytes. Request IDs are non-empty,
control-character-free UTF-8 strings of at most 128 bytes.

One framed-I/O owner serializes all writes. One inference owner exclusively
owns engine state. No decoder or cancellation path may call an engine API
concurrently with that owner. Stdout is protocol-only; stderr is a sanitized
64-KiB ring. Queue length, outstanding requests, audio bytes, and pending
revalidation callbacks are bounded and covered by deterministic clocks.

### Canonical JSON lexical and event grammar

Every peer SHALL first reject a body above 1,048,576 raw bytes and invalid
UTF-8. It SHALL then run a bounded non-allocating lexical scan before or
alongside SAX/schema mapping. JSON whitespace outside strings is limited to
ASCII space, tab, carriage return, and line feed. Strings accept only valid
JSON escapes and paired Unicode surrogates; decoded key/string limits are
measured as UTF-8 bytes after unescaping.

Numbers use exactly this token grammar:

```text
0 | -?[1-9][0-9]*
```

`-0`, leading zeroes, `+`, decimal points, exponents, NaN, Infinity, and a
token outside `[-9007199254740991, 9007199254740991]` are invalid before field
validation. Integer SAX callbacks alone are never accepted as lexical proof.

Resource accounting is identical in all peers:

- `eventCount` starts at zero and increments once for every SAX callback:
  object start, object key, object end, array start, array end, and each null,
  Boolean, integer, or string primitive. The event that would make the count
  4,097 is rejected; 4,096 is valid when all other limits hold.
- `containerDepth` starts at zero. Object/array start first checks
  `containerDepth + 1 <= 16`, then increments; the matching end decrements
  after its event is counted. A primitive root has depth zero. The seventeenth
  simultaneously open container is rejected.
- Each object owns its own `memberCount`, incremented once when its key event is
  accepted. The 129th member is rejected. Duplicate decoded keys in that same
  object are rejected independently at every nesting depth.
- Each array owns its own `elementCount`, incremented immediately before each
  primitive or container value. The 257th element is rejected.
- A decoded key may contain at most 128 UTF-8 bytes; any decoded string value
  may contain at most 262,144 UTF-8 bytes. Stricter schema fields win.

Parsing must consume exactly one JSON value followed only by permitted
whitespace. The vector generator SHALL emit valid-limit and one-property-invalid
N/N+1 vectors for raw bytes, events, depth, members, elements, key bytes,
decoded-string bytes, duplicate keys at multiple depths, safe integer bounds,
`-0`, leading zero, decimals, exponents, invalid UTF-8/escapes/surrogates, and
trailing values. TypeScript and C++/nlohmann SAX SHALL consume the same
checked-in binary vectors byte for byte.

### Device authority and proof encoding

Private GPU authority fields never cross preload/renderer IPC, persistence,
cache keys, routine logs, audits, diagnostics, argv, or environment. Use these
wire representations:

- `authorityId`: 16 bytes from the OS CSPRNG encoded base64url without padding,
  exactly 22 ASCII characters;
- `probeChallenge` and `loadChallenge`: separate 32-byte values from the OS
  CSPRNG encoded base64url without padding, each exactly 43 ASCII characters;
- `registryFingerprint`, `probeProof`, and `loadProof`: lowercase 64-character
  SHA-256 hex strings;
- GPU binding: zero-based registry ordinal integer `0..255`; CPU binding has no
  ordinal, challenge, registry fingerprint, or GPU proof result.

Canonical digest fields use unsigned big-endian integers and `u16 length ||
UTF-8 bytes` strings. No Unicode normalization is performed; engine/backend
adapters must supply their already canonical ASCII identity. The registry
digest preimage begins with the seven raw bytes `LWREG1\0`, then contains engine
ID, 32 raw runtime-build-digest bytes, backend ID, ordered entry count as `u16`
in range `0..256`, then for each engine-registry GPU/IGPU entry:
ordinal `u16`, type byte (`1` GPU, `2` IGPU), backend ID, and 1..256 bytes of
canonical durable native physical identity. Enumeration order is preserved;
sorting, description/memory substitution, duplicate ordinal, or duplicate
native identity is invalid. `registryFingerprint` is SHA-256 of that exact
preimage encoded as lowercase 64-character hexadecimal.

The `LWDEV1` family has two non-interchangeable proof domains. `probeProof` is
SHA-256, with no HMAC key, of the exact preimage beginning with the eight raw
bytes `LWDEV1P\0`; `loadProof` is SHA-256, with no HMAC key, of the exact
preimage beginning with the eight raw bytes `LWDEV1L\0`. After that domain,
each preimage contains, in order: decoded 16 raw authority-ID bytes; its own
decoded 32 raw `probeChallenge` or `loadChallenge`; configuration epoch `u64`;
topology generation `u64`; engine ID; 32 raw runtime-build-digest bytes;
backend ID; 32 raw registry-fingerprint bytes; selected ordinal `u16`; actual
activated ordinal `u16`; canonical actual native identity; primary execution
native identity; and selected-device model-weight bytes `u64`. Integers are
unsigned big-endian; each variable identity/string uses `u16 byte length ||
bytes`. Probe fixes weight bytes to zero and proves bounded
allocation/dispatch; load requires positive bytes. The digest is encoded as
lowercase 64-character hexadecimal. No expected proof or digest key is sent to
the worker. Main recomputes the operation-specific digest from independently
held request/evidence fields under the same live authority; a changed or
cross-operation field is `DEVICE_PROOF_FAILED`.

Main generates `probeChallenge` only after authority, worker generation,
configuration epoch, topology generation, registry fingerprint, and selected
ordinal are fixed for that probe. It generates a distinct `loadChallenge`
only for the fresh full-load process after the model lease/bootstrap binding is
fixed. A challenge is one-use and live only until the first terminal outcome
of its operation. Success, rejection, parse/proof failure, cancellation,
timeout, process crash/exit, bootstrap failure, or any authority, generation,
configuration, topology, registry, or binding invalidation consumes it
permanently. Retry always creates a fresh challenge; probe and load challenges
must never be equal or substituted, even while the same authority remains
otherwise live. Late responses cannot revive a consumed challenge.

Task 09 SHALL check in versioned golden vectors for empty/single/multiple
registries, ordinal 0/255, GPU/IGPU, changed order, duplicate identity, every
single-field proof mutation, probe/load field swaps, `LWDEV1P\0`/`LWDEV1L\0`
domain swaps, challenge swaps/reuse/expiry, and `u64` boundary encoding. Each
TypeScript/C++ peers must reproduce both proof digests and reject every
cross-domain vector. Task 10 supplies CPU absence-of-GPU evidence. Task 11
supplies real CUDA registry and proof values. Later backends must define their
canonical native-identity normalization without changing `LWREG1` or either
`LWDEV1` domain.

### Canonical control lifecycle

Repair protocol v1 atomically; no production peer has shipped. Remove
`modelPath` and every path validator/vector. `probe` and `load` requests carry
the private authority ID/binding. A GPU `probe` carries only its
`probeChallenge` and expected registry fingerprint; a GPU `load` carries only
its distinct `loadChallenge` and expected registry fingerprint. `probed`
reports actual binding, authority ID, registry fingerprint, activated ordinal,
and `probeProof` only after real backend allocation/dispatch. `loaded`
additionally reports exact model identity/digest, positive selected-device
model-weight bytes for GPU, effective backend, primary state
ownership, and `loadProof`. The wrong operation's challenge/proof field is a
schema violation. CPU probe/load requests and responses contain neither GPU
ordinal/fingerprint nor either challenge/proof field, and later workers must
prove no GPU initialized.

A probe process receives no model authority, performs one bounded probe, sends
one terminal result, and exits. `Load now` and lazy load acquire the exact
model lease first and always launch a new full-load process that inherits
logical model slot `3`; a probe process is never upgraded. A full-load process
completes private bootstrap before ordinary handshake or parsing, repeats
backend activation/proof in that same process, then accepts `load`.

Exactly one terminal outcome wins. A response is provisional until request ID,
worker generation, authority ID, binding, proof, and asynchronous post-response
revalidation all match. A frame received during that pending revalidation,
duplicate response, changed generation, cancellation that won first, or any
post-terminal frame is `WORKER_PROTOCOL_VIOLATION`; terminate and ignore every
late success. Bounds remain handshake 10 seconds, probe 30 seconds, load 5
minutes, warm-up 2 minutes, unload 15 seconds, followed by two 5-second
terminate/kill-confirmation stages. Inference timeout remains
`min(30 minutes, max(120 seconds, 10 * validated audio duration))`.

### Canonical WAV and audio accumulation

The complete input is exactly a 44-byte little-endian RIFF/WAVE header followed
by non-empty mono signed PCM16 data at 16,000 Hz: PCM format 1, one channel,
byte rate 32,000, block align 2, 16 bits/sample, one terminal `data` chunk, even
data length, and no extra/trailing chunks or bytes. Accept 1..28,800,000 samples
and 46..57,600,044 total bytes. Derive duration from samples; never trust a
caller duration.

Audio frames use protocol version byte 1, final flag 0/1, unsigned big-endian
sequence `0..0xffffffff`, unsigned big-endian request-ID byte length `1..128`,
then request ID and bytes. Sequence starts at zero and increments by one; only
the final frame may be empty. Checked arithmetic rejects a declaration outside
the complete-WAV bound before full reservation, duplicate/out-of-order/missing
terminal frames, length mismatch, and cancellation. Project-owned accumulated
WAV plus converted float storage never exceeds 172,800,044 bytes; this packet
tests accounting but performs no float conversion. Every terminal path releases
all audio without a temporary file.

### One-use model-authority handoff

Use three fixed-width canonical binary records; all integers are unsigned
big-endian, every SHA-256 is exactly 32 raw bytes, no record contains a string,
and any wrong length, zero PID, reserved value, unknown value, trailing byte,
replay, or second request is invalid. All records begin with their exact 8-byte
ASCII domain (`LWAR1\0\0\0`, `LWAT1\0\0\0`, or `LWAA1\0\0\0`) followed by this
226-byte common binding in exact order:

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

The expected artifact byte count is positive. For a regular-file authority,
artifact-content SHA-256 is the exact expected file digest. For a directory
authority, it is the exact canonical child-manifest digest whose entries own
the individual child sizes and SHA-256 values. Main derives both fields from
the verified managed artifact/lease before launch; the guard validates them
against that lease. They are never derived from worker-observed bytes or sent
through argv, environment, cwd, framed control, or renderer/preload IPC.

`LWAR1` ends after the common binding and is exactly 234 bytes. `LWAT1` appends
one hop byte, one carrier-kind byte, and one `u64` carrier value in that order,
so it is exactly 244 bytes. The only valid triples are: hop `1`, kind `1`,
value `0` for Linux guard-to-launcher `SCM_RIGHTS`; hop `1`, kind `2`, nonzero
value for a Windows launcher-process HANDLE; hop `2`, kind `3`, value `3` for
the Linux inherited worker fd; or hop `2`, kind `4`, nonzero value for the
Windows worker-process HANDLE. `LWAA1` appends the validated hop byte exactly
`2`, its carrier-kind byte (`3` or `4`), the identical `u64` hop-2 carrier
value, worker PID `u64`, and the 32-byte SHA-256 of that worker's OS
process-start identity, so it is exactly 284 bytes and acknowledges that exact
hop-2 transfer. Failed validation produces no acknowledgement. A
launcher-created hop-2 record must copy the verified common binding
byte-for-byte from hop 1 and may change only domain-owned hop/carrier fields.
No inference data or path is present. Versioned vectors cover every record,
exact length, integer boundary, hop/carrier combination, single-field mutation,
truncation/tail, replay, and cross-record/domain substitution.

On Linux, the guard and launcher use one unnamed preconnected
`AF_UNIX SOCK_SEQPACKET | SOCK_CLOEXEC` pair with no bind/listen/accept. Both
receivers enable `SO_PASSCRED` and use `recvmsg(MSG_CMSG_CLOEXEC)`. The launcher
first sends the descriptor-free `LWAR1` record with same-message kernel
`SCM_CREDENTIALS`; the guard validates PID/UID/GID/start identity and every
binding. The guard replies once with same-message guard `SCM_CREDENTIALS`,
exactly one `SCM_RIGHTS` descriptor, and hop-1/kind-1 `LWAT1` whose common
binding is copied byte-for-byte from the validated request; the launcher
validates the record, credentials, descriptor count/type, and all message
truncation flags. It reserves fd 3 before transfer or handles an authenticated
received fd already equal to 3, never calls `dup3(3,3,...)`, collision-safely
maps/clears `FD_CLOEXEC`, and closes both guard-channel ends after the transfer.

Before `exec`, the launcher creates private worker stdin/stdout control pipes,
maps only the worker ends plus model fd 3 and sanitized stderr into the child,
and closes unrelated descriptors. After `exec`, those control pipes have a
mandatory bootstrap phase before framed protocol. The launcher writes exact
hop-2/kind-3 `LWAT1` to worker stdin. The worker reads exactly 244 bytes,
validates `LWAT1` and fd 3 regular-file/directory type, read-only access,
identity, slot, and binding, writes exact `LWAA1` to stdout, then waits. The
launcher validates the copied binding, echoed hop/carrier, child PID, and
process-start identity, writes the single release byte `0x01`, and only then
may both sides enter the ordinary framed handshake on the same pipes. EOF,
another release value, bootstrap framing bytes, extra bytes, or any failure
before release terminates the worker and consumes the authority. This is a
finite inherited pipe chain, not a listener or resident service.

On Windows, the guard opens the exact regular file or directory authority with
read/attribute access only (directory handles include
`FILE_FLAG_BACKUP_SEMANTICS`), rejects reparse/write/delete authority, owns one
ACL-restricted one-use named-pipe endpoint, authenticates launcher PID/start
identity and `LWAR1`, `DuplicateHandle`s one read-only handle into the launcher,
and sends hop-1/kind-2 `LWAT1` with the request's common binding copied
byte-for-byte and that exact launcher-process HANDLE value. The launcher
validates both record and handle, creates only one restricted worker copy, and
constructs hop-2/kind-4 `LWAT1` with that exact arbitrary worker-process
`uint64` HANDLE value. It creates the x64 worker suspended with
private stdin/stdout control pipes, `STARTUPINFOEX`, and
`PROC_THREAD_ATTRIBUTE_HANDLE_LIST`, assigns the preconfigured kill-on-close
Job Object, and fails closed without breakaway flags. Only after assignment may
it resume. The worker-control pipes run the same exact pre-handshake sequence:
launcher sends hop-2 `LWAT1`; worker validates it plus the inherited model
HANDLE/type, sends exact `LWAA1`, and waits; launcher validates the worker
PID/start identity and echoed hop/carrier, sends release byte `0x01`, closes the
guard endpoint, and only then permits framed handshake/model parsing on those
pipes. Only the model HANDLE and required control/stderr pipe handles appear in
the handle list; no ambient inheritable handle is accepted. Any bootstrap
failure terminates the Job-owned tree and consumes the authority.

Linux executable tests cover both regular-file and directory authorities,
fd-3 collisions, credentials/rights, replay, and close-once behavior. Windows
compile/source/contract fixtures cover arbitrary HANDLE values, regular-file
and directory handles, assign-before-resume, bootstrap-before-handshake, and
kill-on-failure. No representative Windows execution occurs before Task 19.

## Contracts And Boundaries

- Renderer/preload IPC sees none of the authority, registry, proof, OS handle,
  process, path, or bootstrap values defined here.
- The filesystem guard retains and revalidates the original model authority;
  launcher and worker own only their explicitly duplicated copies. Every copy
  has one RAII owner and idempotent non-throwing cleanup.
- Task 09 owns framing, codec, proof encoding, handoff, supervisor arbitration,
  native GoogleTest integration, and fakes. It does not decide whether a
  physical device is product-supported.
- Task 10 implements the CPU peer and exact file reader. Task 11 implements the
  CUDA peer and real `LWREG1`, `probeProof`, and `loadProof` evidence.
- Future directory-relative model readers consume the directory authority but
  must separately select and test their Linux/Windows child-open APIs.
- Closing a renderer/window subscription never cancels process-owned work.

## Expected Files Or Components

- `src/shared/localWhisper/protocol.ts` without `modelPath` and with exact
  authority/proof DTOs.
- Focused modules under `src/main/localWhisper/supervisor/` for authority,
  audio, terminal arbitration, and post-response revalidation.
- `runtime/local-whisper/common/` C++20 frame, lexical, nlohmann SAX, proof,
  audio, and private-bootstrap modules with RAII ownership.
- Project-owned CMake modules/arguments that bind every native test target to
  the verified `googletest-v1.17.0-52eb810` content-store root without a
  network-capable declaration or ambient package lookup.
- Authority-handoff modules under `runtime/local-whisper/fs-guard/` and
  `runtime/local-whisper/launcher/` without duplicating their composition roots.
- Generated checked-in vectors under
  `tests/fixtures/local-whisper/protocol/v1/` and proof/bootstrap subfolders.
- Focused TypeScript/GoogleTest tests and the exact package scripts used
  below.

## Acceptance Criteria

- Both peers agree on every valid and invalid JSON N/N+1 vector; duplicate
  keys and numeric spelling cannot be hidden by DOM normalization.
- All peers reproduce every `LWREG1`, `LWDEV1P\0`, and `LWDEV1L\0` digest
  vector exactly; any changed encoding/order/domain/challenge/identity/weight
  field or probe/load field swap fails.
- No model path remains in protocol types, fixtures, supervisor requests,
  argv, environment, bootstrap, or conformance workers.
- Probe receives no model authority and exits. Full load cannot handshake until
  exactly one authenticated read-only file/directory authority is bound to slot
  3; an old probe cannot be upgraded.
- Linux executable integration proves credential authentication in both
  guard-channel directions, same-record rights, fd-3 collision safety, exact
  hop-2 transfer/worker acknowledgement/release order, replay rejection,
  process cleanup, and exact close ownership.
- Windows source-contract tests prove arbitrary-HANDLE logical binding and the
  required suspended/job/bootstrap order without claiming execution evidence.
- Maximum canonical WAV succeeds; zero/over-limit/malformed/duplicate/trailing
  cases fail without inference, temporary files, retained buffers, or overflow.
- Cancellation/response/revalidation races settle once and never accept a late
  success or report uncertain residency released.

## Verification

Task 09 SHALL add the named package scripts before running these exact commands:

```text
rtk npm run verify:local-whisper:native-source -- --lock=nlohmann-json-v3.12.0-subset
rtk npm run verify:local-whisper:native-source -- --lock=googletest-v1.17.0-52eb810
rtk npm run generate:local-whisper:worker-vectors
rtk npm run test:local-whisper:worker-codec
rtk npm run test:local-whisper:worker-proof-vectors
rtk npm run test:local-whisper:worker-authority
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run verify:local-whisper:worker-authority -- --platform=linux
rtk npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
rtk npm run verify:local-whisper:worker-vectors -- --check-clean
rtk node --import tsx --test tests/shared/localWhisper/protocol.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check -- src/shared/localWhisper src/main/localWhisper/supervisor runtime/local-whisper tests/fixtures/local-whisper tests/shared/localWhisper tests/main/localWhisper/supervisor scripts/local-whisper package.json
```

Run the native C++ suites with GCC and Clang warnings-as-errors and ASan/UBSan
through `test:local-whisper:worker-codec` and
`test:local-whisper:worker-authority` under the two exact Task-08 Linux
profiles. Each configure receives only the two verified content-store roots;
the generated graph must contain no Git URL, `FetchContent`, `find_package`,
package-registry, or download step. Missing or skipped compiler/sanitizer
execution is a packet blocker.
The Windows command performs static schema/source-contract validation only; no
Windows compiler, VM, runner, remote host, or representative binary is
executed.

## Failure And Rollback

- Never retain `modelPath`, weaken parser/resource limits, accept an echoed
  proof, reuse an invalid authority, or turn cleanup uncertainty into success.
- If Linux authority integration fails, keep the existing dirty checkpoint
  intact, leave Task 09 open, and do not begin Task 10.
- Rollback removes only packet-owned generated vectors/build roots after exact
  validation. It preserves completed Task 08 source objects and unrelated user
  changes.
- A protocol-v1 repair is atomic: types, generator, binary vectors, all three
  codecs, supervisor, and tests must agree in one completed packet.

## Manual Gates

- Task 09 receives no source-import or toolchain-acquisition authority. Missing
  GoogleTest/nlohmann objects or a no-longer-qualified GCC/Clang profile returns
  the workstream to Task 08 instead of downloading or substituting inputs.
- Windows representative execution is prohibited until Task 19.
- No model, GPU, AMD, Apple Silicon, signing, packaging, upload, publication,
  commit, push, or release authority is included.

## References

- `../spec.md`: Sections 7.3, 8.6, 15, 16, 17 and acceptance rows
  `AC-AUTO-024`, `AC-AUTO-033`, `AC-AUTO-040`, `AC-AUTO-051`,
  `AC-AUTO-052`, `AC-AUTO-053`, `AC-AUTO-054`, `AC-AUTO-056`.
- `07_framed_worker_supervisor.md` and the existing dirty checkpoint.
- `08_deterministic_native_source_and_toolchain_locks.md`.
- Native/runtime sections of `docs/agent-guides/project-conventions.md`.

## Completion And Handoff

After all mandatory Linux checks pass, update `todo.md` and `handoff.md` with
the repaired protocol schema/vector digest, authority record version, changed
files, exact commands, deferred Windows Task-19 evidence, and next packet Task 10. Stop before Task 10, commit, push, packaging, publication, or release.
