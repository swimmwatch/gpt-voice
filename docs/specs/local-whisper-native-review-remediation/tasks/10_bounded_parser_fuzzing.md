# 10 Bounded Parser Fuzzing

## Outcome

Exactly seven shared attacker-influenced parsers run deterministic corpus checks and bounded pull-request libFuzzer mutation under non-recovering ASan/UBSan, with synthetic privacy-safe fixtures and a proven failing-target gate.

## Prerequisites

- Packets 03, 05, 08, and 09 are complete so parser boundaries, frame contracts, sanitizer policy, and source reporting are stable.
- This packet has separate execution authorization and no other packet is in progress.
- The pinned Linux Clang profile and verified native inputs are available.

## Owned Requirements

- Primary: FUZ-001, FUZ-002, FUZ-003.
- Cross-cutting: SEC-001, SEC-003, SEC-004, TST-003, TST-004, TST-007.
- Acceptance: AC-AUT-021, AC-AUT-027 (fuzzing portion).

## In Scope

- Frame decoding, bounded JSON, canonical WAV, model-authority record, launcher request, filesystem-guard request/command, and canonical device-identity fuzz targets.
- Synthetic corpora, exact/one-over boundaries, minimized regression reproducers, and bounded PR orchestration.
- One synthetic failing target proving crashes/sanitizer findings propagate.

## Out Of Scope

- Platform backend claims, Windows ACL/wide-character/handle fuzzing, overlong pre-parser coverage, private corpus inputs, scheduled unbounded fuzzing, or new dependencies.

## Task Contract

1. Add exactly the seven FUZ-001 targets, each calling the production parser through a narrow test harness and deriving maximum input length from the owning contract.
2. Build every target with libFuzzer plus Packet 08's non-recovering ASan/UBSan policy.
3. Run committed corpus regression first, then a maximum 60-second mutation phase with a 2 GiB RSS ceiling per target. Crash, sanitizer result, timeout, OOM, budget breach, malformed report, or missing target fails.
4. Seed only from checked-in synthetic conformance fixtures and explicit boundary cases. Retain a minimized synthetic reproducer for every discovered defect before returning the gate to passing.
5. Add a deterministic failing target/proof so workflow wiring cannot report false success.
6. Keep reports bounded and scrub absolute paths, inputs, models, transcripts, credentials, capabilities, tokens, and environment dumps.
7. State explicitly that parser fuzzing does not cover Windows-only backends or the filesystem-guard overlong-line reader.

## Contracts And Boundaries

- Fuzz targets are test-only and never linked into production executables.
- Corpus paths stay under validated repository fixture roots; generated scratch data stays under a validated temporary root.
- The production parser owns limits and semantics; harnesses must not reimplement parsing.

## Expected Files Or Components

- Focused fuzz targets under the owning native project test trees.
- Shared fuzz CMake configuration and runner under `runtime/local-whisper/cmake/` and `scripts/local-whisper/native-build/`.
- Synthetic corpora under `tests/fixtures/local-whisper/` or project-owned test fixture roots.
- `package.json`, `.github/workflows/pr-checks.yml`, and native CI workflow tests.

## Acceptance Criteria

- AC-AUT-021 runs all seven targets from valid, exact-limit, one-over, malformed, and bounded mutation inputs within specified budgets.
- The synthetic failing target is detected and causes the owning command to fail.
- AC-AUT-027 confirms committed corpora and retained reports contain only bounded synthetic data.
- Reports make no Windows-backend or overlong-reader coverage claim.

## Verification

Run on Linux x64:

```text
npm run test:local-whisper:native-fuzz-corpora
npm run test:local-whisper:native-fuzz-proof
npm run test:local-whisper:native-fuzz
npm run test:local-whisper:native-ci-workflow
```

Run the full 60-second mutation budget only as this packet's completion gate, not on every edit iteration.

## Failure And Rollback

- Fix a discovered production defect and retain its minimized synthetic reproducer; never delete the input or suppress the sanitizer.
- If a parser has no stable narrow entry point, add a testable production boundary rather than duplicating its implementation in the harness.
- Roll back targets, corpora, runner, package commands, and workflow wiring together.

## Manual Gates

- Inspect corpus/report additions for sensitive data before completion. No private input collection or artifact publication is authorized.
- No Windows-host gate applies because this packet's instrumentation claim is intentionally Linux/shared only.

## References

- Specification Sections 10.4, 11, and 12; AC-AUT-021 and AC-AUT-027.
- Packet 03 remains the independent owner of the overlong-line defect.

## Completion And Handoff

- Record target inventory, limits, budgets, corpus changes, proof result, and discovered reproducers in `handoff.md`.
- Check Packet 10 only after the bounded Linux fuzz gate passes.
- Set the exact next packet to Packet 11 and stop.
