# 09 Native Execution, Analysis, And Reporting

## Outcome

Native quality jobs use explicit per-host source manifests, run path-sensitive Linux analysis, execute real ordinary and analyzed MSVC suites, and emit platform-truthful coverage summaries before this packet completes.

## Prerequisites

- Packets 07 and 08 are complete so production, sanitizer, and Windows profile shapes are stable.
- This packet has separate execution authorization and no other packet is in progress.
- Current native quality drivers, locked toolchain profiles, and workflow tests are available.

## Owned Requirements

- Primary: WIN-001, ANA-001, ANA-002.
- Cross-cutting: CMP-005, CMP-006, SEC-003, SEC-004, TST-003, TST-006, TST-007.
- Acceptance: AC-AUT-018, AC-AUT-019, AC-AUT-025.

## In Scope

- Canonical source manifests for common, filesystem guard, launcher, and project-owned worker targets on Linux and Windows.
- Complete Linux `clang-analyzer-*` execution and checked-in staged analyzer configuration.
- Ordinary Windows MSVC test execution and MSVC `/analyze` wiring for every Windows-owned translation unit.
- Dedicated negative analyzer fixtures and a normalized native-quality coverage report.

## Out Of Scope

- Blanket noisy check-family enablement, unreviewed baselines, Windows clang-tidy, CodeQL substitution, `clang-cl`, qualification, or supported-host manual Windows smoke in this packet.

## Task Contract

1. Introduce one checked-in manifest contract that names every project-owned translation unit and owned header by project and host. Fail if an expected source is missing, duplicated, silently excluded, or compiled for the wrong host.
2. Enable the complete `clang-analyzer-*` family over every Linux-owned translation unit. Keep additional `bugprone`, `cert`, concurrency, const, conversion, and shadow checks staged check by check after findings are classified.
3. Wire ordinary MSVC 19.39 build-and-test execution for common, filesystem guard, launcher, and worker suites, clearly separating executed suites from CPU/CUDA/AMD contract-only checks.
4. Wire MSVC `/analyze` over every Windows-owned translation unit compiled by the real build. Do not label a clean Linux analyzer result as Windows evidence.
5. Add one supported bad fixture per analysis driver and prove the driver fails with warnings as errors. Only narrow documented tool-false-positive suppressions are allowed.
6. Generate a bounded coverage summary containing host, locked compiler profile, source set, and evidence kinds: contract inspection, compile, execute, analyze, sanitize, fuzz, TSan, and binary inspection. Reject over-claims and missing evidence.

## Contracts And Boundaries

- The manifest is the canonical source-coverage owner shared by drivers and reporting.
- Reports contain relative project/source identifiers and bounded classifications only; no absolute paths or unrestricted environment data.
- A tool crash, malformed report, missing source, unsupported path, or bad-fixture false success fails closed.

## Expected Files Or Components

- `scripts/local-whisper/native-quality-tools.mjs` and the three native quality drivers.
- A focused manifest/reporting module under `scripts/local-whisper/native-build/`.
- The four native `.clang-tidy` files and focused analyzer fixtures/tests.
- `runtime/local-whisper/toolchains/profiles/windows-x64-cpu-msvc-19.39-v1.json` plus Packet 08's ASan profile contract.
- `package.json`, `.github/workflows/pr-checks.yml`, and `tests/runtime/localWhisper/nativeCiWorkflow.test.ts`.

## Acceptance Criteria

- Linux path-sensitive analysis passes for every Linux manifest source and its bad fixture is detected.
- Workflow/profile tests prove every ordinary and analyzed Windows manifest source will be compiled by MSVC and no contract-only step is reported as execution.
- The coverage summary rejects absent sources, unsupported evidence claims, and Linux-to-Windows overstatement.
- Packet-local Windows jobs execute AC-AUT-018 and the Windows half of AC-AUT-019; the packet emits a truthful interim AC-AUT-025 summary, with final workstream aggregation retained by Packet 15.

## Verification

Run on Linux x64:

```text
npm run lint:local-whisper:worker-common
npm run lint:local-whisper:fs-guard
npm run lint:local-whisper:launcher
npm run test:local-whisper:native-analysis
npm run test:local-whisper:native-build-audits
npm run test:local-whisper:native-ci-workflow
```

If canonical command names differ during implementation, update `package.json`, Packets 14–15, and the workflow tests together. Do not manually dispatch Windows CI; the required non-force push must launch it through the pull request.

## Remote Completion Gate

1. After local verification passes, leave Packet 09 unchecked, update `handoff.md` with candidate state and pending remote evidence, stage only packet-owned paths, and create a conventional Packet 09 candidate commit.
2. Push the candidate commit without force to the verified head of pull request 58 (or its verified successor) and record the exact SHA. Confirm that the push launches CI for that SHA.
3. Require all checks selected for that SHA to finish successfully. At minimum inspect **Local Whisper Native Quality (Linux)**, **Local Whisper Native Quality (Windows)**, **Quality Gates**, **Package Smoke (Fedora Linux)**, **Package Smoke (Windows)**, **Actionlint**, every selected `Local Whisper Fixture Packaging` job, and every analyzer/reporting job introduced by this packet.
4. Linux path-sensitive analysis and all ordinary-MSVC, MSVC-analysis, and dedicated-MSVC-ASan jobs must execute their complete manifests and proof fixtures. Every required Windows job must run and conclude `success`; a skipped Windows job is never acceptable.
5. Fix packet-caused in-scope failures, add focused regressions where applicable, commit and push the fix, and repeat the exact-SHA gate. Record an unrelated or out-of-scope failure as a blocker and leave the packet unchecked.
6. After the candidate SHA passes, check Packet 09, record the remote run/job evidence in `handoff.md`, create and push a separate completion-record commit, and require all workflows for that final SHA to pass again. That final external check result closes the gate without another self-referential documentation commit.

## Failure And Rollback

- Classify and fix analyzer findings before enabling each blocking check; do not add a blanket suppression or advisory baseline.
- If a Windows-owned source cannot be represented by the supported MSVC graph, stop and return the source-coverage conflict to planning.
- Roll back manifests, analyzers, reports, drivers, package commands, and workflow wiring as one unit.

## Manual Gates

- No supported-host manual Windows smoke is performed here; Packet 15 retains that final manual gate. Ordinary MSVC, MSVC-analysis, and MSVC-ASan jobs are mandatory here.
- The packet's non-force PR-head pushes are required; manual workflow dispatch, artifact publication, and qualification remain unauthorized.

## References

- Specification Sections 4, 10.2, and 12; AC-AUT-018, AC-AUT-019, AC-AUT-025.
- CI review selections for real Windows execution and path-sensitive analysis.

## Completion And Handoff

- Record manifests, enabled checks, local Linux analyzer results, exact candidate/completion commits, and successful ordinary/analyzed/ASan Windows jobs in `handoff.md`.
- Check Packet 09 only after local verification and both exact-SHA remote phases pass with no skipped Windows job. Packet 15 remains mandatory for supported-host manual Windows evidence and the final aggregate report.
- Set the exact next packet to Packet 10 and stop.
