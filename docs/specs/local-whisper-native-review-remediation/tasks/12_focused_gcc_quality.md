# 12 Focused GCC Quality

## Outcome

The Linux pull-request workflow builds and tests the filesystem guard and launcher with pinned GCC 13 in addition to their Clang sanitizer/analysis gates, without redundantly duplicating common or worker suites.

## Prerequisites

- Packets 02–06, 08, and 09 are complete so guard/launcher behavior and native manifests are stable.
- This packet has separate execution authorization and no other packet is in progress.
- The pinned GCC 13 profile and verified native inputs are available.

## Owned Requirements

- Primary: GCC-001.
- Cross-cutting: SEC-003, TST-003, TST-007.
- Acceptance: AC-AUT-023.

## In Scope

- GCC 13 Release/debug build-and-test profiles for filesystem guard and launcher.
- Warnings-as-errors execution, source-manifest reporting, and affected PR workflow wiring.

## Out Of Scope

- Duplicating common/worker GCC suites that already exist, adding another compiler, changing supported profiles, or weakening Clang gates.

## Task Contract

1. Add focused pinned-GCC execution for the filesystem guard and launcher using the canonical manifests from Packet 09.
2. Run applicable unit/integration suites with warnings as errors and disconnected verified inputs.
3. Keep common and project-owned worker suites out of this new slice unless a concrete uncovered dependency requires them.
4. Report compile and execution evidence separately from Clang sanitizer/analysis evidence; fail on missing sources, tool crashes, or test failures.

## Contracts And Boundaries

- Existing Linux toolchain profiles remain canonical; the packet adds no ambient compiler discovery.
- Tests use validated temporary roots and synthetic inputs only.

## Expected Files Or Components

- `scripts/local-whisper/native-fs-guard-quality.mjs`, `scripts/local-whisper/native-launcher-quality.mjs`, and shared quality helpers.
- Linux GCC toolchain/profile selection, `package.json`, `.github/workflows/pr-checks.yml`, and workflow tests.

## Acceptance Criteria

- AC-AUT-023 builds and executes guard and launcher suites under pinned GCC 13 with warnings as errors.
- Reports identify the exact GCC source manifests and do not count existing common/worker runs twice.
- Existing Clang sanitizer/analysis checks remain unchanged and required.

## Verification

Run on Linux x64:

```text
npm run test:local-whisper:fs-guard:gcc
npm run test:local-whisper:launcher:gcc
npm run test:local-whisper:native-ci-workflow
```

## Failure And Rollback

- Fix GCC-specific portability defects without weakening warnings or changing public behavior.
- If a proposed fix changes platform behavior, stop and return to the specification owner.
- Roll back profile selection, driver actions, package commands, and workflow wiring together.

## Manual Gates

- No external or Windows manual gate applies.
- No push, workflow dispatch, packaging, or publication is authorized.

## References

- Specification Sections 10.6 and 12; AC-AUT-023.

## Completion And Handoff

- Record GCC profile, source manifests, commands, and results in `handoff.md`.
- Check Packet 12 after both focused GCC suites pass.
- Set the exact next packet to Packet 13 and stop.
