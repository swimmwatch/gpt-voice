# 08 Sanitizer And STL Hardening

## Outcome

Every Linux sanitized Local Whisper native graph fails on the first ASan/UBSan finding, proves that policy with dedicated fixtures, and uses consistent standard-library bounds hardening. A compatible dedicated MSVC ASan configuration and complete Windows STL-debug contract are authored for execution in Packet 15.

## Prerequisites

- Packets 01–07 are complete with Linux/shared evidence so the final native target graph is stable.
- This packet has separate execution authorization and no other packet is in progress.
- Verified native test sources and the pinned Linux Clang and Windows MSVC profiles are available.

## Owned Requirements

- Primary: SAN-001, SAN-002, STL-001, WIN-002.
- Cross-cutting: CMP-005, CMP-006, ARC-002, SEC-003, SEC-004, TST-001, TST-003, TST-007.
- Acceptance: AC-AUT-017, AC-AUT-018 (MSVC ASan portion), AC-AUT-020.

## In Scope

- One explicit sanitizer environment and compiler/link policy for common, filesystem guard, launcher, and project-owned worker targets.
- Clean, ASan-failure, and UBSan-failure proof fixtures.
- `_GLIBCXX_ASSERTIONS` across the complete Linux sanitized graph.
- A dedicated MSVC 19.39 ASan profile without `/RTC1` or unsupported Linux sanitizer claims.
- Uniform MSVC iterator/container debug settings across project-owned and GoogleTest translation units.

## Out Of Scope

- TSan, fuzz targets, broad analyzer rollout, unsupported Windows UBSan/LeakSanitizer/TSan claims, new dependencies, or disabling a finding to make CI pass.
- Real Windows-host execution; Packet 15 owns it and all resulting fixes.

## Task Contract

1. Centralize the Linux sanitizer compile/link and runtime environment so every sanitized native project receives non-recovering ASan/UBSan behavior, explicit supported options, and Linux leak detection.
2. Add a bounded sanitizer proof runner and synthetic fixture target with clean, heap-use-after-free, and signed-overflow modes. Assert clean exit zero and both injected violations exit nonzero with sanitized classifications.
3. Apply `_GLIBCXX_ASSERTIONS` to every project-owned Linux sanitized target and static library linked into it. Add a test-only bounds violation and prove the complete normal sanitized suites remain ABI-compatible.
4. Define a separate Windows MSVC ASan configuration for each supported project-owned target. Remove incompatible `/RTC1` only from that configuration, keep warnings as errors, and reject unsupported environment/options.
5. Validate one uniform MSVC iterator/container debug level across every linked project-owned and GoogleTest translation unit. Do not introduce isolated `_ITERATOR_DEBUG_LEVEL=1` or `_CONTAINER_DEBUG_LEVEL=1` definitions.
6. Make reports distinguish ordinary, sanitized, and contract-only coverage, and bound failure output without absolute paths, inputs, or environment dumps.

## Contracts And Boundaries

- Shared CMake/toolchain policy owns flags; workflow scripts select profiles and verify evidence but do not duplicate policy.
- Proof fixtures and outputs are synthetic, test-only, and never linked into production executables.
- A missing source, unsupported runtime option, tool crash, or unexpected injected-success result is a failed gate.

## Expected Files Or Components

- `runtime/local-whisper/cmake/` shared native configuration modules and the four native `CMakeLists.txt` files.
- `runtime/local-whisper/toolchains/fixtures/sanitizer-proof/`.
- `scripts/local-whisper/native-build/test-native-sanitizer-proof.mjs` and shared quality helpers.
- Native quality drivers for common, filesystem guard, launcher, and worker.
- A dedicated Windows MSVC ASan profile/selection contract, `package.json`, `.github/workflows/pr-checks.yml`, and focused workflow tests.

## Acceptance Criteria

- AC-AUT-017 passes for the proof and every Linux sanitized project suite.
- The Linux bounds fixture fails at the bounds check while all normal sanitized suites pass with `_GLIBCXX_ASSERTIONS` across the linked graph.
- Source/configuration tests prove the Windows ASan graph is distinct, contains no incompatible `/RTC1`, claims no unsupported sanitizer, and has a uniform STL debug level.
- The real Windows AC-AUT-018 and Windows half of AC-AUT-020 remain explicitly deferred to Packet 15.

## Verification

Run on Linux x64:

```text
npm run test:local-whisper:native-sanitizer-proof
npm run test:local-whisper:worker-common:native
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:launcher:native
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:native-build-audits
```

Also run the smallest workflow/profile contract tests covering Windows ASan selection and STL consistency. Packet 15 owns the real Windows ordinary/ASan execution.

## Failure And Rollback

- A sanitizer runtime incompatibility is a configuration defect; do not suppress the finding or weaken non-recovery.
- If bounds hardening creates an ABI mismatch, apply it consistently to the complete linked graph rather than exempting a target.
- Roll back shared flags, profiles, proof fixtures, scripts, tests, and workflow wiring together.

## Manual Gates

- No Windows-host manual gate is performed here. Record every deferred ordinary/ASan target and its expected source manifest for Packet 15.
- No workflow dispatch, artifact upload, packaging, or publication is authorized.

## References

- Specification Sections 4, 10.1–10.3, and 12; AC-AUT-017, AC-AUT-018, AC-AUT-020.
- CI review selections for non-recovering UBSan, real MSVC ASan, and standard-library bounds hardening.

## Completion And Handoff

- Record changed policy/profile files, Linux sanitizer and bounds results, and the deferred Windows target manifest in `handoff.md`.
- Check Packet 08 after its Linux/shared completion set passes; this does not satisfy the overall Windows evidence gate.
- Set the exact next packet to Packet 09 and stop without starting it, committing, pushing, or dispatching CI.
