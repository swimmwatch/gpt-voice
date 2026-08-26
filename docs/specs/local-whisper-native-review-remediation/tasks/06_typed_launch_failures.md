# 06 Typed Launch Failures

## Outcome

Launcher and model-launch failures carry dedicated enum identity from throw site to acknowledgment/exit mapping, so diagnostic wording cannot alter protocol classification and every native exit value has a named contract owner.

## Prerequisites

- Packets 04 and 05 are complete, including their packet-local Linux/Windows remote gates, so capability/process cleanup and shared hashing paths no longer move underneath error classification.
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

Author the Windows launcher/model-launch failure cases and exact acknowledgment/exit fixtures in this packet. The remote Windows native job must execute them and all resulting fixes before Packet 06 completes. Formatting and clang-tidy remain Linux-only quality gates and do not substitute for MSVC execution.

## Remote Completion Gate

1. After local verification passes, leave Packet 06 unchecked, update `handoff.md` with candidate state and pending remote evidence, stage only packet-owned paths, and create a conventional Packet 06 candidate commit.
2. Push the candidate commit without force to the verified head of pull request 58 (or its verified successor) and record the exact SHA. Confirm that the push launches CI for that SHA.
3. Require all checks selected for that SHA to finish successfully. At minimum inspect **Local Whisper Native Quality (Linux)**, **Local Whisper Native Quality (Windows)**, **Quality Gates**, **Package Smoke (Fedora Linux)**, **Package Smoke (Windows)**, **Actionlint**, every selected `Local Whisper Fixture Packaging` job, and every new or split native job introduced by this packet.
4. The Linux and Windows native jobs must execute the packet's applicable C++ builds, warnings-as-errors, formatting, lint/static analysis, sanitizer configuration, native tests, and typed launch-failure cases. Every required Windows job must run and conclude `success`; a skipped Windows job is never acceptable.
5. Fix packet-caused in-scope failures, add focused regressions where applicable, commit and push the fix, and repeat the exact-SHA gate. Record an unrelated or out-of-scope failure as a blocker and leave the packet unchecked.
6. After the candidate SHA passes, check Packet 06, record the remote run/job evidence in `handoff.md`, create and push a separate completion-record commit, and require all workflows for that final SHA to pass again. That final external check result closes the gate without another self-referential documentation commit.

## Failure And Rollback

- If preserving an existing acknowledgment would require changing its bytes, stop and return to specification rather than silently normalizing platforms.
- If a cause lacks a stable category, map it to the generic typed bootstrap error; do not classify through message text.
- Roll back enum definitions, throw sites, entry-point mappings, CMake changes, and tests together. Do not leave mixed typed/string classification.

## Manual Gates

- No supported-host manual Windows smoke is performed in this packet; Packet 15 retains that final manual gate. Automated Windows acknowledgment/exit execution is mandatory here.
- Do not publish or interpret these native exit values as a new public renderer/API contract.

## References

- Specification Section 8.2; AC-AUT-012.
- Review item M6.
- Existing entry-point acknowledgment functions define the compatibility baseline to freeze in tests before replacement.

## Completion And Handoff

- Record the enum inventory, frozen acknowledgment/exit fixtures, local Linux results, exact candidate/completion commits, and successful Linux/Windows CI jobs in `handoff.md`.
- Check Packet 06 only after local verification and both exact-SHA remote phases pass with no skipped Windows job. Packet 15 remains mandatory for supported-host manual Windows evidence.
- Set the exact next packet to Packet 07 and stop without implementing it. The Packet 06 candidate and completion-record commits must already be pushed and green.
