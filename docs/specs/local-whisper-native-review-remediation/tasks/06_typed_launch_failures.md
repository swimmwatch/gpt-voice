# 06 Typed Launch Failures

## Outcome

Launcher and model-launch failures carry dedicated enum identity from throw site to acknowledgment/exit mapping, so diagnostic wording cannot alter protocol classification and every native exit value has a named contract owner.

## Prerequisites

- Packets 04 and 05 are complete so capability/process cleanup and shared hashing paths no longer move underneath error classification.
- This packet has separate execution authorization and no other packet is in progress.

## Owned Requirements

- Primary: ERR-001.
- Cross-cutting: CMP-004, ARC-002, ARC-003, SEC-001, SEC-002, TST-001, TST-002, OPS-001.
- Acceptance: AC-AUT-012.

## In Scope

- Dedicated launcher and model-launch error enums/exceptions.
- Central enum-to-acknowledgment mapping at the existing Windows boundaries.
- Named invocation, bootstrap, model-launch, and child-exec exit constants.
- Linux/Windows unit and integration tests for stable classification.

## Out Of Scope

- Changing acknowledgment wire bytes, making Linux emit Windows acknowledgments, changing public Local Whisper failure codes, or redesigning process cleanup.
- Converting unrelated common validation errors that do not participate in launch acknowledgment/exit policy.

## Task Contract

1. Define one launcher error enum and exception type in launcher-owned common code. The exception stores the enum and a safe diagnostic message; callers classify only by enum.
2. Define a separate model-launch error enum and exception type in filesystem-guard/model-launch-owned code. Do not overload the ordinary guard command `ErrorCode` vocabulary.
3. Replace message equality, prefix, and substring checks in launcher and model-launch entry points with exhaustive enum-to-policy functions.
   - Preserve every current Windows acknowledgment string for the corresponding condition.
   - Preserve the current Linux behavior that does not add the Windows failure acknowledgment.
   - Map unknown `std::exception` and nonstandard exceptions to the existing generic bootstrap rejection/non-success exit, never success.
4. Assign typed errors at the narrowest stable cause: invalid path/encoding, directory/file open, identity/stream rejection, digest/seek/read rejection, worker or launcher creation, process/job ownership, handle policy, pipe I/O, resume, acknowledgment, inherited handle, model authority, and generic bootstrap.
5. Add named constants for invalid invocation (`2`), launcher bootstrap failure (`10`), model-launch failure (`20`), child exec/bootstrap failure (`126`), and any other unexplained process-level exit value in the touched paths. Preserve numeric behavior exactly.
6. Keep diagnostic messages safe and useful, but prove they are non-contractual by constructing the same enum with changed wording in tests and observing identical acknowledgment/exit policy.
7. Make enum mappings exhaustive under warnings-as-errors. A newly added enum must fail compilation or a totality test until policy is supplied.

## Contracts And Boundaries

- Entry points own final acknowledgment and process exit. Platform helpers throw typed domain errors and do not write acknowledgments opportunistically.
- No acknowledgment includes raw exception text, paths, handles, credentials, hashes, or tokens.
- Windows and Linux retain their approved asymmetry; only the type safety of classification changes.
- Cleanup exceptions must not overwrite the original typed classification unless existing cleanup policy explicitly returns a cleanup failure.

## Expected Files Or Components

- New launcher error header/source under `runtime/local-whisper/launcher/include/...` and `src/common/`.
- `runtime/local-whisper/launcher/src/main.cpp`
- Linux and Windows launcher platform implementations and their CMake target.
- New model-launch error header/source under the filesystem-guard ownership boundary.
- `runtime/local-whisper/fs-guard/src/main.cpp`
- Linux and Windows model-launch applications and filesystem-guard CMake target.
- Launcher unit/integration tests and filesystem-guard model-launch tests.

## Acceptance Criteria

- No launch acknowledgment or exit mapping branches on `error.what()`, message equality, prefix, or substring.
- Tests cover every enum member, exact existing Windows acknowledgment bytes, existing Linux no-ack behavior, exact named numeric exits, and unknown-exception fallback.
- Changing safe diagnostic text leaves acknowledgment and exit results unchanged.
- Native warnings-as-errors enforce exhaustive mappings on GCC/Clang and MSVC.
- Valid launch, model authority, worker startup, and cleanup integration paths remain byte-for-byte compatible.

## Verification

Run on Linux x64:

```text
npm run format:check:local-whisper:launcher
npm run lint:local-whisper:launcher
npm run test:local-whisper:launcher:native
npm run format:check:local-whisper:fs-guard
npm run lint:local-whisper:fs-guard
npm run test:local-whisper:fs-guard:native
npm run verify:local-whisper:launcher
```

Run on Windows x64:

```text
npm run test:local-whisper:launcher:native
npm run test:local-whisper:fs-guard:native
npm run verify:local-whisper:launcher
```

Formatting and clang-tidy are Linux-only quality gates: `resolveClangFormat` falls back to a Linux `clang-quality-18.1.3` toolchain path and the Windows job provisions no clang-format, so `format:check:local-whisper:*` SHALL NOT be run on Windows. clang-format output is platform-independent, so the Linux run is the complete formatting evidence. MSVC warnings-as-errors and the native suites are the Windows gate.

## Failure And Rollback

- If preserving an existing acknowledgment would require changing its bytes, stop and return to specification rather than silently normalizing platforms.
- If a cause lacks a stable category, map it to the generic typed bootstrap error; do not classify through message text.
- Roll back enum definitions, throw sites, entry-point mappings, CMake changes, and tests together. Do not leave mixed typed/string classification.

## Manual Gates

- **MANUAL GATE:** Execute Windows launcher and model-launch failure integration cases and retain the exact acknowledgment/exit comparison. Source review alone is insufficient.
- Do not publish or interpret these native exit values as a new public renderer/API contract.

## References

- Specification Section 8.2; AC-AUT-012.
- Review item M6.
- Existing entry-point acknowledgment functions define the compatibility baseline to freeze in tests before replacement.

## Completion And Handoff

- Record the enum inventory, frozen acknowledgment/exit fixtures, and Linux/Windows check results in `handoff.md`.
- Check Packet 06 only after both platforms pass.
- Set the exact next packet to Packet 07 when Packets 01–06 are complete, and stop without implementation, commit, or push of the next packet.
