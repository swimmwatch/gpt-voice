# 05 Common Crypto And Frame Contracts

## Outcome

Every native Local Whisper consumer uses one hardened common SHA-256 implementation with platform streaming adapters, and every audio-frame bound derives from one canonical 136-byte overhead constant on Linux and Windows.

## Prerequisites

- Packets 02 and 04 are complete, including Packet 04's packet-local Linux/Windows remote gate, so filesystem/launcher resource and capability ownership is stable.
- This packet has separate execution authorization and no other packet is in progress.
- Verified common-native test inputs are available on Linux and Windows.

## Owned Requirements

- Primary: CRY-001, FRM-001.
- Cross-cutting: CMP-004, ARC-002, ARC-003, SEC-001, SEC-002, TST-001, TST-002, OPS-001.
- Acceptance: AC-AUT-011, AC-AUT-015.

## In Scope

- Common SHA-256 lifecycle and standard-vector hardening.
- Linux descriptor and Windows handle streaming adapters in guard/launcher consumers.
- Removal of the two duplicate hand-rolled compression implementations: the launcher's private `Sha256` and the Linux guard's embedded nested `Impl::Sha256`.
- A cross-platform digest-agreement test covering the common implementation and every retained operating-system crypto provider.
- Shared common-library CMake linkage/tests on Linux and Windows.
- Canonical audio overhead and exact maximum-frame boundary tests.

## Out Of Scope

- Digest caching, removal of required model hash passes, switching algorithms, adding a crypto dependency, changing digest encoding, or changing maximum audio chunk bytes.
- Worker protocol version changes beyond use of the already approved protocol-v1 constant.

## Task Contract

1. Harden `local_whisper::common::Sha256` as the only compression implementation.
   - Reject update after finish and a second finish deterministically.
   - Reject an update that would make the SHA-256 bit length overflow; the maximum accumulated byte count is `UINT64_MAX / 8`, not `UINT64_MAX`.
   - Preserve standard SHA-256 output and lowercase 64-character hex encoding.
   - Keep state private, movable/copy policy explicit, and failure text safe.
2. Add standard vectors for empty, `abc`, one million `a` bytes, 55/56/63/64/65-byte boundaries, multi-block inputs, and varied streaming chunk splits. Add deterministic lifecycle and overflow tests without allocating near the theoretical limit; use a narrow test seam or checked length helper rather than huge memory.
3. Replace the launcher's private `Sha256` class/source with the common implementation. Platform code may own a descriptor/handle reader loop that feeds bounded chunks into common `Sha256`; it may not own round constants or compression state.
4. Replace the Linux filesystem guard's embedded nested `Impl::Sha256` with the common hasher plus a Linux read/seek adapter.
   - Preserve file offset restoration/seek policy, identity revalidation, safe `IO_FAILED` mapping, and lowercase digest bytes.
   - Read bounded chunks rather than byte-at-a-time input.
   - **Do not remove the Windows CNG (`BCRYPT_SHA256_ALGORITHM`) provider in `windows_backend.cpp`.** It is an operating-system crypto provider, not a hand-rolled implementation, and CRY-001 explicitly permits retaining it. It is hardware-accelerated, and replacing it with the portable scalar hasher would measurably slow the Windows `LIST` directory digest that runs on every model load and every startup artifact probe. Introducing that regression is prohibited by CRY-001 and by SCP-001.
   - Keep the Windows provider confined to digesting bytes. Offset policy, identity revalidation, error mapping to `IO_FAILED`, and lowercase hex encoding SHALL come from the shared contract, so the provider is a byte-digest backend only.
   - Add a cross-platform digest-agreement test: run one shared vector set (empty, `abc`, 55/56/63/64/65-byte boundaries, multi-block, and at least two different chunk-split streamings) through the common implementation **and** through the Windows CNG provider, and assert identical lowercase 64-hex output. This closes a current gap in which two independent implementations produce the same `LIST` digest field with nothing asserting they agree, while shared TypeScript compares that field byte-for-byte against catalog digests.
5. Adjust CMake target composition so common SHA-256 source is compiled once per final target graph and duplicate symbols/implementations are removed. Do not introduce ambient package discovery or network access.
6. Extend common-native quality execution to Windows MSVC and add it to the Windows native quality job. Linux retains Release plus ASan/UBSan and clang-tidy. Both platforms execute common SHA/frame tests from the same source.
   - The obstacle is concrete: `scripts/local-whisper/native-worker-quality.mjs` holds a hardcoded two-element `profiles` array containing only `linux-x64-cpu-baseline-v1` (gcc-13, Release) and `linux-x64-clang-18.1.3-asan-ubsan-v1` (clang-18, Debug, sanitizers), with Linux absolute compiler paths as defaults. Add an MSVC profile and gate profile selection on `process.platform`, so a Windows run never attempts Linux compiler paths.
   - The MSVC profile SHALL NOT receive Unix-only flags, and the Linux profiles SHALL NOT receive MSVC-only flags.
   - Caveat while editing this driver: `native-fs-guard-quality.mjs:72-75` and `native-launcher-quality.mjs:74-77` exclude the other platform's sources with `` `/platform/${excludedPlatform}/` `` matched against `node:path` `resolve()` output, which is backslash-separated on Windows, so the filter silently excludes nothing there. It is currently inert because that filter only feeds the Linux-only `lint` action. If this packet reuses that filtering shape for a Windows run, make the match path-separator aware.
7. Define `kAudioFrameOverheadBytes = 136` in the common frame contract from the fixed protocol-v1 fields: 1 type byte, 1 flags byte, 4 sequence bytes, 2 request-ID-length bytes, and a maximum 128-byte request ID.
8. Derive common encoder/decoder maximum audio body, POSIX frame preallocation checks, Windows frame preallocation checks, and any generated boundary vectors from that constant. Remove independent native `136` literals.
9. Test an otherwise valid frame exactly at `kMaxAudioChunkBytes + kAudioFrameOverheadBytes` and one byte over. Reject the oversized declaration before allocating its declared body.

## Contracts And Boundaries

- Hash adapters own only OS reads and resource-safe offset behavior; the common library owns algorithm state and encoding.
- Hash failures must not reveal paths, contents, model names, or handles.
- Checked-in protocol fixtures remain deterministic and protocol version remains 1.
- The common build remains disconnected and dependency-free except for already verified test/header inputs.

## Expected Files Or Components

- `runtime/local-whisper/common/include/local_whisper/common/sha256.hpp`
- `runtime/local-whisper/common/src/sha256.cpp`
- Common SHA tests, including a dedicated test file if needed.
- `runtime/local-whisper/launcher/include/local_whisper/launcher/sha256.hpp` and `src/common/sha256.cpp` removed after callers migrate.
- Linux and Windows launcher hashing paths and launcher CMake/tests.
- Linux and Windows filesystem-guard hashing paths and filesystem-guard CMake/tests.
- `runtime/local-whisper/common/include/local_whisper/common/frame_codec.hpp`
- `runtime/local-whisper/common/src/frame_codec.cpp`
- POSIX and Windows worker protocol readers and frame codec tests.
- `scripts/local-whisper/native-worker-quality.mjs`, `package.json`, and `.github/workflows/pr-checks.yml` for Windows common-native execution.

## Acceptance Criteria

- One source search finds exactly one hand-rolled native SHA-256 compression implementation and no duplicated round-constant table. The Windows CNG provider is present and is not counted as a hand-rolled implementation.
- Whole-buffer, varied-stream, descriptor, and handle hashing produce identical standard digests on Linux and Windows.
- The digest-agreement test passes: the common implementation and the retained Windows CNG provider produce identical lowercase 64-hex output for every shared vector, including chunk-split streamings.
- The Windows `LIST` digest path still uses the CNG provider; no benchmark or timing regression is introduced on the Windows directory-digest path by this packet.
- Finish-twice, update-after-finish, and byte-to-bit-length overflow fail safely before digest production.
- Launcher and guard success/failure classifications and digest strings remain unchanged; no digest cache is introduced.
- Every native audio-frame bound references `kAudioFrameOverheadBytes`; the constant equals 136 and no protocol-path native literal duplicates it.
- Exact maximum audio body is accepted; maximum plus one is rejected before declared-body allocation on both worker channels.

## Verification

Run on Linux x64:

```text
npm run format:check:local-whisper:worker-common
npm run lint:local-whisper:worker-common
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core
npm run format:check:local-whisper:fs-guard
npm run lint:local-whisper:fs-guard
npm run test:local-whisper:fs-guard:native
npm run format:check:local-whisper:launcher
npm run lint:local-whisper:launcher
npm run test:local-whisper:launcher:native
npm run verify:local-whisper:worker-vectors -- --check-clean
```

Author the Windows common-native codec/SHA, retained-CNG digest-agreement, guard, launcher, and worker-core cases in this packet. The remote Windows native job must execute them and all resulting fixes before Packet 05 completes; TypeScript-only vectors are not Windows evidence.

## Remote Completion Gate

1. After local verification passes, leave Packet 05 unchecked, update `handoff.md` with candidate state and pending remote evidence, stage only packet-owned paths, and create a conventional Packet 05 candidate commit.
2. Push the candidate commit without force to the verified head of pull request 58 (or its verified successor) and record the exact SHA. Confirm that the push launches CI for that SHA.
3. Require all checks selected for that SHA to finish successfully. At minimum inspect **Local Whisper Native Quality (Linux)**, **Local Whisper Native Quality (Windows)**, **Quality Gates**, **Package Smoke (Fedora Linux)**, **Package Smoke (Windows)**, **Actionlint**, every selected `Local Whisper Fixture Packaging` job, and every new or split native job introduced by this packet.
4. The Linux and Windows native jobs must execute the packet's applicable C++ builds, warnings-as-errors, formatting, lint/static analysis, sanitizer configuration, native tests, SHA/digest agreement, and frame-boundary cases. Every required Windows job must run and conclude `success`; a skipped Windows job is never acceptable.
5. Fix packet-caused in-scope failures, add focused regressions where applicable, commit and push the fix, and repeat the exact-SHA gate. Record an unrelated or out-of-scope failure as a blocker and leave the packet unchecked.
6. After the candidate SHA passes, check Packet 05, record the remote run/job evidence in `handoff.md`, create and push a separate completion-record commit, and require all workflows for that final SHA to pass again. That final external check result closes the gate without another self-referential documentation commit.

## Failure And Rollback

- If Windows platform hashing cannot preserve existing offset or error behavior through the common hasher, add a focused handle reader adapter; do not retain a second digest implementation.
- If theoretical overflow is not constructible in a unit test, test the checked length transition through a narrow pure helper; do not allocate attacker-scale buffers.
- Roll back consumers, CMake linkage, deleted duplicate sources, tests, and CI wiring as one unit to avoid missing symbols or divergent hashing.

## Manual Gates

- No supported-host manual Windows smoke is performed in this packet; Packet 15 retains that final manual gate. Automated common/SHA/CNG, guard, launcher, and worker-core MSVC execution is mandatory here.
- Do not update model/runtime catalog digests, generate packages, or remove a measured hash pass.

## References

- Specification Sections 8.1 and 8.4; AC-AUT-011 and AC-AUT-015.
- CRY-001's operating-system-crypto-provider clause is binding: the Windows CNG provider is retained, and the digest-agreement test is mandatory.
- Review items M4 and canonical audio-frame overhead.
- Existing common SHA implementation is the consolidation target.

## Completion And Handoff

- Record removed duplicate implementations, common adapters, local Linux results, exact candidate/completion commits, and successful Linux/Windows CI jobs in `handoff.md`.
- Check Packet 05 only after local verification and both exact-SHA remote phases pass with no skipped Windows job. Packet 15 remains mandatory for supported-host manual Windows evidence.
- Set the exact next packet to Packet 06 and stop without beginning it. The Packet 05 candidate and completion-record commits must already be pushed and green.
