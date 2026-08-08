# 02 Filesystem-Guard Resource Ownership

## Outcome

The Linux and Windows filesystem-guard backends release every transient native resource on success, typed failure, injected failure, and exception paths, and each backend enforces one shared maximum of 64 live leases with safe `IO_FAILED` rejection.

## Prerequisites

- The plan is approved and this packet has separate execution authorization.
- No other packet is in progress. Packet 01 is independent and need not be complete.
- Verified GoogleTest/native inputs are available.

## Owned Requirements

- Primary: FSG-001, FSG-005, FSG-006.
- Cross-cutting: CMP-004, ARC-002, ARC-003, SEC-001, SEC-002, TST-001, TST-002.
- Acceptance: AC-AUT-005, AC-AUT-006.

## In Scope

- Linux descriptor, directory-stream, and lease ownership.
- Windows handle, enumeration, and lease ownership.
- Deterministic acquisition/failure injection and process resource-count tests.
- Preflight and rollback behavior for the 64-live-lease budget.

## Out Of Scope

- Guard line reading, command-type refactoring, `LIST` expected-entry semantics, launcher capability transfer, SHA-256 consolidation, or public main-process behavior.
- Raising OS limits, inducing real system-wide exhaustion, changing guard error vocabulary, or adding platform-specific lease budgets.

## Task Contract

1. Audit every operating-system acquisition in both backend implementations. Immediately wrap successful descriptors, `DIR*` streams, Windows handles, enumeration handles, parent directories, locks, and temporary files in move-only RAII owners.
2. Replace raw transient ownership in acquisition, metadata validation, identity construction, hashing, lock-metadata reads, namespace opening, listing, staging-file creation, promotion, quarantine, and their platform equivalents.
   - Release ownership only when inserting a fully validated retained lease or completing an explicit transfer.
   - Cleanup destructors and reset operations are `noexcept` and close exactly once.
   - Preserve intentional delete/unlink-on-release behavior and identity revalidation before destructive cleanup.
3. Keep retained leases in the backend-owned lease map. Define one named constant `64` at the narrowest shared owner and use it on both platforms.
4. Before any operation that would publish another lease token, check capacity before irreversible filesystem mutation or provide complete scoped rollback for any mutation already performed.
   - Lease 64 may be created.
   - Attempt 65 throws/returns guard `IO_FAILED` without incrementing the token sequence, exposing a token, retaining a transient resource, or leaving partial artifact state.
   - Releasing one lease permits the next operation.
5. Apply the shared count across root, directory, file, lock, staging, runtime, model, and any other retained lease kind; do not create per-kind sub-budgets.
6. Add narrow deterministic failure injection at OS adapter boundaries where existing code cannot force each post-acquisition error. Do not add mutable globals, environment-controlled production failpoints, or broad mock filesystems.
7. Test stable process resource counts using `/proc/self/fd` or an equivalent scoped Linux counter and `GetProcessHandleCount` on Windows. Compare against a captured test baseline after cleanup; do not assume a process-wide absolute count.

## Contracts And Boundaries

- Platform RAII types stay within their platform backend; common interfaces expose no raw descriptor or handle.
- Tests use validated temporary roots and clean only their exact roots.
- Do not log resource values, paths, lease tokens, or error text containing sensitive context.
- Capacity exhaustion is nonterminal for the guard; existing leases remain releasable and later capacity is reusable.

## Expected Files Or Components

- `runtime/local-whisper/fs-guard/src/platform/linux/unique_fd.hpp`
- `runtime/local-whisper/fs-guard/src/platform/windows/unique_handle.hpp`
- `runtime/local-whisper/fs-guard/src/platform/linux/linux_backend.cpp`
- `runtime/local-whisper/fs-guard/src/platform/windows/windows_backend.cpp`
- Platform backend headers if test injection requires constructor dependencies.
- `runtime/local-whisper/fs-guard/tests/unit/raii_test.cpp`
- `runtime/local-whisper/fs-guard/tests/integration/backend_integration_test.cpp`
- Focused new test support under the filesystem-guard test tree.

## Acceptance Criteria

- Failure injection after every enumerated acquisition returns descriptor/handle counts to baseline on both platforms across repeated runs.
- No test observes double-close, invalid reuse, `EMFILE`, `ERROR_TOO_MANY_OPEN_FILES`, or monotonic resource growth.
- The shared boundary sequence 63 → 64 → rejected 65 → release → accepted 64 passes for every lease-producing command family.
- Capacity rejection is exactly `IO_FAILED`; it emits no token, causes no partial filesystem mutation, and leaves the guard usable.
- Existing identity, link, mode, ACL, and delete-on-release behavior remains unchanged.

## Verification

Run on Linux x64:

```text
npm run format:check:local-whisper:fs-guard
npm run lint:local-whisper:fs-guard
npm run test:local-whisper:fs-guard:unit
npm run test:local-whisper:fs-guard:integration
npm run test:local-whisper:fs-guard:native
```

Run on Windows x64:

```text
npm run test:local-whisper:fs-guard:unit
npm run test:local-whisper:fs-guard:integration
npm run test:local-whisper:fs-guard:native
```

Formatting and clang-tidy are Linux-only quality gates: `resolveClangFormat` falls back to a Linux `clang-quality-18.1.3` toolchain path and the Windows job provisions no clang-format, so `format:check:local-whisper:*` SHALL NOT be run on Windows. clang-format output is platform-independent, so the Linux run is the complete formatting evidence. MSVC warnings-as-errors and the native suites are the Windows gate.

## Failure And Rollback

- If an operation cannot capacity-check before mutation, its scoped rollback must be proven by an injected rejection test; otherwise stop and redesign that operation before continuing.
- If Windows and Linux require different public lease counts or error codes, stop and return to specification.
- Rollback may restore the previous backend implementation and tests together. Do not retain partial RAII conversions that create two owners for one resource.

## Manual Gates

- **MANUAL GATE:** Execute the Windows x64 completion set and retain the handle-baseline result. Without that evidence, leave Packet 02 unchecked and record the blocker.
- No destructive test may target a user directory; inspect the resolved temporary root before any integration run.

## References

- Specification Sections 4 and 6.1–6.2; AC-AUT-005–AC-AUT-006.
- `docs/reviews/2026-08-08-local-whisper-native-comments-to-address.md`, H1.
- `AGENTS.md`, C++ and destructive-action boundaries.

## Completion And Handoff

- Record changed files, leak-injection coverage, lease-boundary results, and Linux/Windows checks in `handoff.md`.
- Check Packet 02 in `todo.md` only after both platforms pass.
- Set the exact next packet to the first unchecked packet permitted by dependencies, normally Packet 03, and stop without starting it or committing/pushing.
