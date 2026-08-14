# 03 Runtime SHA-256 Dispatch

## Outcome

Extend the project-owned common SHA-256 implementation with x64 runtime-dispatched acceleration while keeping
the existing hardened scalar behavior as a universally safe fallback.

## Prerequisites

- Packet 01 is complete and the common SHA source/manifests still match the recorded basis.
- Production targets remain Linux x64 GCC/Clang and Windows x64 MSVC; macOS and ARM are not enabled.

## Owned Requirements

CMP-005, CRY-001, DEP-001, THR-005, SEC-007, RES-003, AC-AUT-008.

## In Scope

- Common SHA-256 block transform, CPU-feature detection, dispatch ownership, build manifests, and native tests.
- Test-binary-only scalar, accelerated, and simulated-unsupported selection hooks.
- GCC/Clang and MSVC compilation of an accelerated translation unit without raising the binary-wide ISA floor.

## Out Of Scope

- Replacing Windows CNG filesystem hashing.
- OpenSSL, another crypto dependency, build-host-native flags, ARM acceleration, micro-architecture packs, or
  production environment/CLI dispatch overrides.
- Changing the public `Sha256` lifecycle, digest format, or `ExactModelReader` contracts.

## Task Contract

1. Preserve `Sha256` construction, streaming `update`, one-shot `finish`, finished-state rejection, checked input
   length, move semantics, and digest bytes.
2. Isolate accelerated block processing in a dedicated translation unit or compiler-targeted function. Never use
   build-wide `-msha`, host-native tuning, or an MSVC option that excludes supported x64 CPUs.
3. Detect the SHA extension through local CPUID evidence. The detection result must initialize once through a
   thread-safe language/runtime primitive and remain immutable for the process lifetime.
4. Unsupported or simulated-unsupported CPUs must not reach an accelerated instruction, including under concurrent
   first use. Detection may not consult environment variables, `PATH`, a network, or an ambient library.
5. Use the existing scalar path whenever detection or accelerated compilation is unavailable. No new dependency
   or mutable native-global runtime container is allowed.
6. Update exact native source/build manifests for every new or renamed source.

## Contracts And Boundaries

- `runtime/local-whisper/common` owns SHA state and dispatch; consumers continue using the current public header.
- Windows CNG remains isolated in the filesystem guard.
- Test forcing is compiled into test binaries only and is not addressable from production messages or process
  environment.

## Expected Files Or Components

- `runtime/local-whisper/common/include/local_whisper/common/sha256.hpp`
- `runtime/local-whisper/common/src/sha256.cpp` and a focused accelerated/detection source as required
- `runtime/local-whisper/common/tests/sha256_test.cpp`
- `runtime/local-whisper/common/tests/sha256_test_vectors.hpp`
- `runtime/local-whisper/common/CMakeLists.txt`
- Native source manifests and build-audit fixtures that enumerate common sources

## Acceptance Criteria

- AC-AUT-008 passes standard, boundary, chunk-split, lifecycle, overflow, and multi-gigabyte-length vectors in
  scalar, accelerated, and simulated-unsupported modes.
- Concurrent first use under worker TSan selects one immutable target without a race.
- Digests agree with retained Windows CNG vectors and unsupported mode proves the accelerated body was not entered.

## Verification

- `npm run test:local-whisper:worker-common:native`
- `npm run test:local-whisper:worker-tsan`
- `npm run test:local-whisper:native-analysis`
- `npm run test:local-whisper:native-build-audits`
- `npm run test:local-whisper:native-sources`
- `npm run test:local-whisper:fs-guard:gcc`
- The Linux development host does not substitute for Windows. MSVC, Windows ASan, and Windows runtime-dispatch
  fixtures execute through `Local Whisper Native Quality (Windows)` in CI.

## CI Gate And Commit Discipline

- Task-specific CI commands include the complete Verification list above. Linux native quality owns Clang/GCC,
  analyzer, TSan, sanitizer, and unsupported-feature fixtures; Windows native quality owns MSVC compilation, ASan,
  concurrent first-use, and scalar-fallback fixtures.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`, and
  `Local Whisper Native Quality (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI failure only in a later explicitly authorized invocation and a separate fix commit. Never
  amend or squash the implementation commit; push and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 04 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any digest mismatch, illegal-instruction possibility, dispatch race, lifecycle regression, or manifest drift
  rejects the packet.
- Rollback removes the accelerated translation unit and restores scalar-only dispatch without changing persisted
  data or Windows CNG.

## Manual Gates

- Representative unsupported-CPU behavior that hosted CI cannot emulate remains a direct supported-host check in
  Packet 14; ordinary MSVC and Windows ASan evidence is mandatory CI evidence in this packet.
- No production package publication or host-specific binary commit is authorized.

## References

- Specification Section 6.1, Section 11, SEC-007, and AC-AUT-008.
- `docs/agent-guides/project-conventions.md` Sections “Code And Logging” and “Tests And Documentation.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with compiler coverage, dispatch evidence, and Packet 04 as
the next ordered packet, then stop for review.
