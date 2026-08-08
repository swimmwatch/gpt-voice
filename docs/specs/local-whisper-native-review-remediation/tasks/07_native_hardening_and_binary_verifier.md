# 07 Native Hardening And Binary Verifier

## Outcome

All Local Whisper native CMake projects apply one explicit configuration-aware hardening policy, and one dedicated host-native verifier proves the required ELF or PE properties for every production executable on Linux and Windows without weakening sanitizer builds.

## Prerequisites

- Packets 01–06 are complete, including Packet 04–06 packet-local Linux/Windows remote gates, so CMake/source composition is stable.
- This packet has separate execution authorization and no other packet is in progress.
- The locked Linux GCC/Clang and Windows MSVC build profiles and verified native sources are available.

## Owned Requirements

- Primary: BLD-001.
- Cross-cutting: CMP-004, ARC-002, ARC-003, SEC-001, SEC-002, OPS-001, TST-001, TST-002.
- Acceptance: AC-AUT-014.

## In Scope

- One shared CMake hardening module used by common, filesystem guard, launcher, and whisper-worker projects.
- Explicit Linux compiler/linker and Windows MSVC compiler/linker policies.
- A dedicated Node-based native-hardening verifier and parser tests.
- Production Release/optimized native builds on Linux and Windows.
- Native quality workflow wiring for both hosts.

## Out Of Scope

- Package signing, installer hardening, release publication, dependency changes, macOS, unsupported compilers, or support-tier/qualification claims.
- Treating compiler defaults or a successful build as sufficient binary evidence.
- Disabling ASan/UBSan, warnings-as-errors, deterministic MSVC flags, or disconnected-build enforcement.

## Task Contract

1. Add one shared CMake module under the Local Whisper native root and include it from all four CMake projects. It must expose focused target functions for compile hardening and executable-link hardening; do not duplicate flag lists in project files.
2. For non-MSVC optimized production targets, explicitly apply:
   - stack protection at least equivalent to `-fstack-protector-strong`;
   - `_FORTIFY_SOURCE=3` where the pinned libc/toolchain supports it, otherwise the strongest verified supported level without silently disabling fortification;
   - position-independent executable compilation/linking;
   - linker `RELRO` plus immediate binding (`NOW`);
   - non-executable stack policy; and
   - no text relocations.
3. For supported MSVC production targets, explicitly apply:
   - `/GS` stack-cookie protection;
   - compile and link Control Flow Guard (`/guard:cf`);
   - `/DYNAMICBASE`;
   - `/NXCOMPAT`; and
   - `/HIGHENTROPYVA` for x64.
4. Apply compile protections to common/static-library code that is linked into production executables and link protections to the final filesystem guard/model launcher, launcher, and whisper-worker executables. Preserve existing runtime paths, output names, deterministic flags, and target composition.
5. Keep Debug/ASan/UBSan configurations buildable. Gate optimization-dependent fortification appropriately, but retain compatible stack, PIE/ASLR, non-executable-stack, and warnings policy. Never strip sanitizer flags to make hardening checks pass.
6. Add dedicated `test:local-whisper:native-hardening` and `verify:local-whisper:native-hardening` package commands backed by one reusable parser/core module and one live-binary CLI.
   - Accept explicit expected executable paths or a strict generated manifest; do not recursively trust arbitrary workspace binaries.
   - Reject missing, duplicate, wrong-format, out-of-root, or unexpected executables.
   - Produce a bounded report containing platform, relative executable role/path, SHA-256, and pass/fail mitigation names only; no absolute paths or private environment data.
7. On ELF, verify at minimum PIE/ET_DYN, non-executable GNU stack, GNU RELRO, immediate binding, absence of text relocations, and build-command/binary evidence for stack protection and fortification.
8. On PE x64, parse the optional header/load configuration and verify dynamic-base, NX, high-entropy-VA, Control Flow Guard metadata, and stack-cookie evidence. Do not infer these properties only from MSVC command lines.
9. Add parser unit tests with positive and one-property-missing fixtures plus live validation of the actual optimized binaries built in the job. Checked-in fixtures must be minimal synthetic/non-executable test data, not generated production binaries.
10. Update Linux and Windows native-quality jobs so each builds the optimized filesystem guard, launcher, and CPU whisper worker from locked inputs, then invokes the dedicated verifier on those exact outputs. The Windows job must execute a real MSVC production worker build, not a source-contract-only check.

## Contracts And Boundaries

- The CMake module is the canonical hardening owner. Quality wrappers may select build profiles/paths but may not redefine mitigation flags.
- The verifier reads local build outputs only and performs no network access, signing, packaging, or publication.
- Binary reports contain hashes and relative roles, not sensitive paths or toolchain environment dumps.
- Sanitizer and production builds remain separate explicit profiles; production hardening evidence cannot be taken from a test fixture executable.

## Expected Files Or Components

- New shared module, expected at `runtime/local-whisper/cmake/LocalWhisperHardening.cmake` or the equivalent single native-root owner.
- All four Local Whisper native `CMakeLists.txt` files.
- New `scripts/local-whisper/native-build/native-hardening-core.mjs` and CLI such as `verify-native-hardening.mjs`.
- Focused tests under `tests/runtime/localWhisper/` or `tests/scripts/localWhisper/`.
- Existing ELF/PE dependency parser helpers only where reuse preserves their narrow ownership.
- `package.json` and `.github/workflows/pr-checks.yml`.
- Native build wrappers only as required to return exact production output paths to the verifier.

## Acceptance Criteria

- One source audit finds one canonical hardening flag policy and no per-project copied mitigation lists.
- Linux optimized fs-guard/model-launch, launcher, and CPU worker outputs pass every required ELF property; a negative fixture fails for each independently missing property.
- Windows optimized fs-guard/model-launch, launcher, and CPU worker outputs pass every required PE property; negative fixtures fail for missing CFG, stack cookie, ASLR, NX, or high-entropy VA.
- The dedicated report identifies exact relative roles and SHA-256 values and rejects unexpected/out-of-root inputs.
- Linux ASan/UBSan native suites still build and pass, Windows MSVC warnings-as-errors suites pass, and disconnected builds remain enforced.
- Neither quality workflow relies on source-contract-only evidence for AC-AUT-014.

## Verification

Run on Linux x64 after producing optimized outputs:

```text
npm run test:local-whisper:native-sanitizer-proof
npm run test:local-whisper:native-hardening
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:launcher:native
npm run build:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
npm run verify:local-whisper:native-hardening -- --platform=linux
npm run test:local-whisper:native-build-audits
npm run format:check
npm run lint
```

Author the PE parser fixtures, MSVC hardening configuration, exact-output manifest, and Windows workflow wiring in this packet. The remote Windows native job must run the optimized MSVC build, live PE inspection, and all resulting fixes before Packet 07 completes. If canonical command names change, update `package.json`, the later packets, `todo.md`/`handoff.md`, and CI together.

## Remote Completion Gate

1. After local verification passes, leave Packet 07 unchecked, update `handoff.md` with candidate state and pending remote evidence, stage only packet-owned paths, and create a conventional Packet 07 candidate commit.
2. Push the candidate commit without force to the verified head of pull request 58 (or its verified successor) and record the exact SHA. Confirm that the push launches CI for that SHA.
3. Require all checks selected for that SHA to finish successfully. At minimum inspect **Local Whisper Native Quality (Linux)**, **Local Whisper Native Quality (Windows)**, **Quality Gates**, **Package Smoke (Fedora Linux)**, **Package Smoke (Windows)**, **Actionlint**, every selected `Local Whisper Fixture Packaging` job, and every new or split native job introduced by this packet.
4. The Linux and Windows native jobs must execute the packet's applicable C++ builds, warnings-as-errors, formatting, lint/static analysis, sanitizer configuration, native tests, and live ELF/PE hardening checks. Every required Windows job must run and conclude `success`; a skipped Windows job is never acceptable.
5. Fix packet-caused in-scope failures, add focused regressions where applicable, commit and push the fix, and repeat the exact-SHA gate. Record an unrelated or out-of-scope failure as a blocker and leave the packet unchecked.
6. After the candidate SHA passes, check Packet 07, record the remote run/job evidence in `handoff.md`, create and push a separate completion-record commit, and require all workflows for that final SHA to pass again. That final external check result closes the gate without another self-referential documentation commit.

## Failure And Rollback

- A mitigation unavailable in a pinned supported toolchain is a specification blocker; do not silently omit it or mark it unsupported in the report.
- If a mitigation breaks sanitizer execution, repair the configuration-aware policy rather than disabling the sanitizer or the production mitigation.
- Roll back the shared module, all four includes, verifier, package command, tests, and workflow steps together. Never leave workflows claiming hardening without live binary inspection.

## Manual Gates

- No supported-host manual Windows smoke is performed in this packet; Packet 15 retains that final manual gate. Automated optimized MSVC build and live PE verification are mandatory here.
- Building locked native inputs and the packet's non-force PR-head pushes are authorized by the completion gate; signing, artifact upload, packaging, publishing, and manual workflow dispatch remain unauthorized.

## References

- Specification Section 9; AC-AUT-014.
- Review item “Add explicit native exploit-mitigation flags.”
- Existing disconnected native build and ELF/PE dependency helpers are local precedent; they do not currently satisfy hardening inspection.

## Completion And Handoff

- Record Linux optimized binary roles/hashes, mitigation report paths, sanitizer results, exact candidate/completion commits, and successful Linux/Windows live-binary CI jobs in `handoff.md` without committing generated binaries/reports.
- Check Packet 07 only after local verification and both exact-SHA remote phases pass with no skipped Windows job. Packet 15 remains mandatory for supported-host manual Windows evidence.
- Set the exact next packet to Packet 08 and stop without starting it, packaging, or publishing. The Packet 07 candidate and completion-record commits must already be pushed and green.
