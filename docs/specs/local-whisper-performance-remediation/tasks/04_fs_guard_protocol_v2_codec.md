# 04 Filesystem-Guard Protocol-V2 Codec

## Outcome

Advance the private app/guard protocol to version 2 so installation bytes are encoded once, decoded once into the
existing typed `WriteFileCommand`, and bounded by the exact 262,144-byte request-payload contract.

## Prerequisites

- Packet 01 is complete.
- Planning decision `planning.protocol-payload-safety-margin` fixes the future-headroom margin at 4,096 bytes.
- The app and bundled guard can be changed and tested as one compatibility set.

## Owned Requirements

CMP-004, IPC-001, CODEC-001, CODEC-002, ARC-004, IPC-003, INST-001, IPC-004, SEC-005, AC-AUT-005,
AC-AUT-006.

## In Scope

- TypeScript request-field encoding, guard request parsing, canonical base64url decoding, protocol constants,
  cross-language vectors, fuzz seeds, and mixed-version rejection.
- `WRITE_FILE` only: accept bounded raw bytes at the adapter/transport boundary and deliver decoded owned bytes to
  the already typed command.
- Exact request-payload/newline and overflow behavior on Linux and Windows.

## Out Of Scope

- Changing Linux/Windows backend raw-byte write implementations.
- A raw binary channel, threaded guard, concurrent installation transfers, or the pipelined/backpressure behavior
  owned by Packet 05.
- Worker protocol changes, public IPC changes, model-layout changes, or a compatibility fallback to protocol v1.

## Task Contract

1. Set both private peers to protocol version 2. A v1/v2 mismatch must be rejected before any `WRITE_FILE` field is
   interpreted or written; there is no silent fallback.
2. Replace the adapter's inner `Buffer.toString('base64url')` layer with a typed raw-byte request field. Text fields
   retain canonical UTF-8/base64url behavior where required.
3. Decode the raw field once with a bounded inverse lookup and allocation-free canonical check. Reject padding,
   invalid alphabet, length modulo four equal to one, non-zero unused tail bits, integer overflow, and output above
   the derived bound before backend dispatch.
4. Derive the maximum raw chunk from the worst-case valid request ID, version, command, file token, separators,
   base64url expansion, and the fixed 4,096-byte margin. Do not use 192 KiB or another unexplained caller constant.
5. Treat 262,144 bytes as payload before newline. An exactly valid 262,144-byte payload plus newline is accepted;
   the first later non-newline byte causes fail-stop guard exit before parse/allocation/write and rejects all pending
   requests. Do not drain or retain an attacker-sized line.
6. Preserve the distinction between bounded `ERR` for invalid in-budget requests and process failure for overflow.
7. Stable failures must not echo bytes, tokens, paths, native messages, or decoded content.

## Contracts And Boundaries

- `NativeManagedFilesystemAdapter` accepts `Uint8Array`; `NativeManagedFilesystemGuardTransport` owns wire
  encoding; guard protocol/command layers own validation and typed construction; platform backends remain unchanged.
- Cross-language constants must have one documented owner and parity tests; no unexplained duplicate limit is allowed.
- All parser/fuzz allocation is bounded before trust-sensitive backend access.

## Expected Files Or Components

- `src/main/localWhisper/filesystem/NativeManagedFilesystemAdapter.ts`
- `src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.ts`
- `runtime/local-whisper/fs-guard/include/local_whisper/fs_guard/protocol.hpp`
- `runtime/local-whisper/fs-guard/include/local_whisper/fs_guard/command.hpp`
- `runtime/local-whisper/fs-guard/src/common/protocol.cpp`
- `runtime/local-whisper/fs-guard/src/common/command.cpp`
- Guard unit/integration/fuzz tests and `tests/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.test.ts`

## Acceptance Criteria

- AC-AUT-005 proves TypeScript/native vector agreement, exactly one decode, unchanged backend bytes, and no write
  for invalid data.
- AC-AUT-006 proves exact-limit acceptance, newline exclusion, and one-byte-over fail-stop behavior on both platforms.
- Mixed v1/v2 peers fail before interpretation and leave no staging publication.

## Verification

- `npm run test:local-whisper:filesystem`
- `npm run test:local-whisper:fs-guard:native`
- `npm run test:local-whisper:fs-guard:gcc`
- `npm run test:local-whisper:native-fuzz`
- `npm run typecheck`
- `npm run format:check`

## CI Gate And Commit Discipline

- Task-specific CI commands are the complete Verification list above. Linux native quality owns GCC/fuzz/sanitizer
  coverage; Windows native quality must run `npm run test:local-whisper:fs-guard:msvc-asan` plus protocol-v2 exact
  boundary, canonical codec, and mixed-peer fixtures on `${{ vars.CI_WINDOWS_RUNNER }}`.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`, and
  `Local Whisper Native Quality (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI failure only in a later explicitly authorized invocation and a separate fix commit. Never
  amend or squash the implementation commit; push and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 05 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any non-canonical acceptance, second decode, boundary mismatch, partial write, or mixed-peer fallback rejects the
  packet.
- App and guard protocol changes must be rolled back together. Never leave a mixed private-peer set in production.

## Manual Gates

- Representative real-app Windows protocol behavior is repeated in Packet 14; deterministic non-canonical,
  mixed-peer, MSVC, and ASan cases are mandatory hosted Windows CI checks here.
- Do not install or publish a package as part of this packet.

## References

- Specification Sections 4, 7.1, 7.2, 12, and 13; AC-AUT-005 and AC-AUT-006.
- `docs/agent-guides/project-conventions.md` Sections “Code And Logging” and “Desktop, Browser, And Packaging.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with the derived raw chunk value, cross-platform checks, and
Packet 05 as the next ordered packet, then stop for review.
