# 03 Filesystem-Guard Input And Typed Commands

## Outcome

The guard rejects an oversized request line without unbounded buffering or draining, Linux and Windows enforce identical exact `LIST` expectations, and both platform backends receive fully parsed typed commands rather than positional string vectors.

## Prerequisites

- Packet 02 is complete, including its cross-platform RAII and lease-capacity evidence.
- This packet has separate execution authorization and no other packet is in progress.

## Owned Requirements

- Primary: FSG-002, FSG-003, FSG-004, ARC-001.
- Cross-cutting: CMP-004, ARC-002, ARC-003, SEC-001, SEC-002, TST-001, TST-002.
- Acceptance: AC-AUT-007, AC-AUT-008, AC-AUT-013.

## In Scope

- A bounded request-line reader with a 262,144-byte payload limit.
- Fail-stop guard/transport behavior for overlong and newline-free input.
- Typed command-domain values at the shared parse boundary.
- Exact expected-entry name/mode validation for `LIST` on Linux and Windows.
- Shared command, dispatch, backend, native integration, and main-process transport tests.

## Out Of Scope

- Changing the wire grammar, response format, guard safe error vocabulary, lease count, artifact schema, public IPC, or guard restart ownership.
- Digest caching, following links, accepting undeclared files, draining oversized lines, or adding a compatibility parser in platform backends.

## Task Contract

1. Replace `std::getline` request ownership with a focused bounded line-reader component.
   - Retain at most 262,144 payload bytes before newline.
   - An exact-limit line is returned to ordinary parse/validation.
   - Detect the first limit-plus-one byte, return a terminal-overflow result, and stop reading immediately without draining to newline.
   - EOF with a nonempty line at or under the limit follows the existing final-line behavior; EOF after crossing the limit is terminal overflow.
2. On terminal overflow, return a non-success process exit without serializing an `OK` or `ERR` response for the prefix and without dispatching a command. Do not keep the guard alive.
3. Confirm `NativeManagedFilesystemGuardTransport` treats closure as sanitized guard termination, rejects all pending operations once, disposes stale lease state, and permits its owner to start a fresh guard later. Do not expose the raw line or child stderr.
4. Make `parse_command` the sole wire-to-domain conversion boundary.
   - Replace platform/name/artifact-kind/namespace/operation string alternatives with narrow enum or value types where they represent closed domains.
   - Parse positive process IDs and file modes once into checked integer types.
   - Decode `WRITE_FILE` payload bytes once.
   - Parse each `LIST` expected entry into a typed `{name, mode}` value and reject invalid mode, duplicate name, wrong field count, or invalid name at this boundary.
   - Keep lease tokens, opaque identities, nonces, and validated names as strings where no stronger stable domain type is warranted.
5. Change every Linux and Windows backend implementation method to consume its typed command directly. Remove positional-vector reconstruction, duplicate argument-count checks, duplicate base64 decoding, and duplicate numeric/domain parsing from backend `Impl` methods.
6. Enforce exact `LIST` equality on both platforms.
   - Reject missing, extra, duplicate, wrong-mode, unsafe-link, and identity-changed entries through the existing safe typed validation behavior.
   - Return listing fields in the existing deterministic format/order when the set is exact.
   - Do not weaken Windows ACL/stream checks or Linux descriptor-relative/link checks.
7. Preserve dispatch variant exhaustiveness and response serialization byte-for-byte for all commands not intentionally rejected earlier by the strengthened parser.

## Contracts And Boundaries

- The common parser owns untrusted wire syntax. Backends own OS invariants only.
- The reader holds no backend reference and cannot dispatch partial input.
- The main process owns guard restart. The native guard does not recursively relaunch itself.
- Tests use bounded synthetic streams and validated temporary roots; no user-managed directory is read or removed.

## Expected Files Or Components

- `runtime/local-whisper/fs-guard/include/local_whisper/fs_guard/guard_application.hpp`
- `runtime/local-whisper/fs-guard/src/common/guard_application.cpp`
- A focused common bounded-line-reader source/header if separation improves ownership.
- `runtime/local-whisper/fs-guard/include/local_whisper/fs_guard/command.hpp`
- `runtime/local-whisper/fs-guard/src/common/command.cpp`
- `runtime/local-whisper/fs-guard/include/local_whisper/fs_guard/backend.hpp`
- Linux and Windows backend headers/implementations.
- Guard protocol, command, dispatch, and backend integration tests.
- `src/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.ts` and its direct tests.

## Acceptance Criteria

- Reader unit tests cover payload sizes 262,143, 262,144, 262,145, newline at each boundary, EOF at each boundary, and a newline-free source that attempts to continue indefinitely.
- The 262,145-byte and newline-free overflow cases retain no more than 262,144 payload bytes, dispatch nothing, emit no response, and terminate the guard non-successfully.
- Main transport tests prove every pending request rejects once, stale state is not reused, raw input is not surfaced, and a later fresh guard starts.
- The shared `LIST` matrix accepts only exact names and modes on both real backends and rejects missing, extra, duplicate, wrong-mode, link, and identity-change cases.
- Command-parser tests prove all numeric, mode, base64, enum, and expected-entry validation occurs before backend dispatch.
- Backend source and tests no longer reconstruct positional vectors or reparse validated command domains; all existing command integration behavior remains stable.

## Verification

Run on Linux x64:

```text
npm run format:check:local-whisper:fs-guard
npm run lint:local-whisper:fs-guard
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:filesystem
npm run typecheck
npm run test:types
```

Run on Windows x64:

```text
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:filesystem
npm run typecheck
npm run test:types
```

The native integration suite must use real Linux and Windows backends, not only `FakeBackend`.

Formatting and clang-tidy are Linux-only quality gates: `resolveClangFormat` falls back to a Linux `clang-quality-18.1.3` toolchain path and the Windows job provisions no clang-format, so `format:check:local-whisper:*` SHALL NOT be run on Windows. clang-format output is platform-independent, so the Linux run is the complete formatting evidence. MSVC warnings-as-errors and the native suites are the Windows gate.

## Failure And Rollback

- If preserving a wire field requires a new domain type, add it at the command boundary; do not retain a backend-only parser as a shortcut.
- If the transport cannot distinguish overlong-line guard death from a successful response, preserve its existing generic child-termination failure rather than adding a public code.
- Rollback the typed command structures and both backends together. Do not leave mixed signatures, duplicated parsers, or a reader that drains oversized input.

## Manual Gates

- **MANUAL GATE:** Run the Windows native guard and Node/native filesystem completion commands. The packet remains incomplete without the exact `LIST`, typed-command, and overlong-input Windows results.
- Validate every integration-test temporary root before executing removal or quarantine cases.

## References

- Specification Sections 6.3–6.4 and 8.3; AC-AUT-007, AC-AUT-008, AC-AUT-013.
- Review items H3, M5, and M7.
- Packet 02 resource owners are mandatory local precedent and must not be bypassed.

## Completion And Handoff

- Record command type changes, boundary tests, guard/transport recovery, and Linux/Windows results in `handoff.md`.
- Check Packet 03 in `todo.md` only after both platforms pass.
- Set the exact next packet to Packet 04 and stop without implementation of that packet, commits, pushes, or external actions.
