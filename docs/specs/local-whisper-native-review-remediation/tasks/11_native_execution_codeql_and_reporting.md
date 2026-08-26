# 11 Native Execution, CodeQL, Analysis, And Reporting

## Outcome

Native quality jobs use explicit per-host source manifests, run path-sensitive Linux and real MSVC analysis, create distinct real-build Linux/Windows C++ CodeQL databases plus one JavaScript/TypeScript database, and emit platform-truthful coverage summaries before this packet completes.

## Prerequisites

- Packets 07–10 are complete so production/sanitizer profiles, immutable workflows, fixed runner lanes, and repository security policies are stable.
- This packet has separate execution authorization and no other packet is in progress.
- Current native quality drivers, locked toolchain profiles, and workflow tests are available.

## Owned Requirements

- Primary: WIN-001, ANA-001, ANA-002, CMP-007, SAST-001.
- Cross-cutting: CMP-005–CMP-006, SEC-003–SEC-004, SEC-006, REP-001, TST-003, TST-006–TST-008.
- Acceptance: AC-AUT-018–AC-AUT-019, AC-AUT-025, AC-AUT-032.

## In Scope

- Canonical source manifests for common, filesystem guard, launcher, and project-owned worker targets on Linux and Windows.
- Complete Linux `clang-analyzer-*` execution and checked-in staged analyzer configuration.
- Ordinary Windows MSVC test execution and MSVC `/analyze` wiring for every Windows-owned translation unit.
- Dedicated negative analyzer fixtures and a normalized native-quality coverage report.
- JavaScript/TypeScript CodeQL and distinct C++ CodeQL databases produced by the real Linux Clang and Windows MSVC builds, with explicit query/tool identities and source-manifest comparison.

## Out Of Scope

- Blanket noisy check-family enablement, unreviewed baselines, Windows clang-tidy, CodeQL substitution for any native gate, `clang-cl`, artifact security, qualification, or supported-host manual Windows smoke in this packet.

## Task Contract

1. Introduce one checked-in manifest contract that names every project-owned translation unit and owned header by project and host. Fail if an expected source is missing, duplicated, silently excluded, or compiled for the wrong host.
2. Enable the complete `clang-analyzer-*` family over every Linux-owned translation unit. Keep additional `bugprone`, `cert`, concurrency, const, conversion, and shadow checks staged check by check after findings are classified.
3. Wire ordinary MSVC 19.39 build-and-test execution for common, filesystem guard, launcher, and worker suites, clearly separating executed suites from CPU/CUDA/AMD contract-only checks.
4. Wire MSVC `/analyze` over every Windows-owned translation unit compiled by the real build. Do not label a clean Linux analyzer result as Windows evidence.
5. Add one supported bad fixture per analysis driver and prove the driver fails with warnings as errors. Only narrow documented tool-false-positive suppressions are allowed.
6. Generate a bounded coverage summary containing host, locked compiler profile, source set, and evidence kinds: contract inspection, compile, execute, analyze, sanitize, fuzz, TSan, and binary inspection. Reject over-claims and missing evidence.
7. Run JavaScript/TypeScript CodeQL once on the primary Linux runner over renderer, preload, main, scripts, workflow-adjacent JavaScript, and shared validation sources. Pin the CodeQL Action/query identities under Packet 09's immutable-reference policy.
8. Build separate C++ CodeQL databases through the real primary Linux Clang and Windows MSVC graphs. Compare each recorded source set to the canonical host manifest and fail on a missing/extra/inapplicable source, database/query failure, malformed SARIF, or unsupported build path.
9. Add supported deterministic bad-query/source-inclusion proofs for JavaScript/TypeScript, Linux C++, and Windows C++. Run on pull requests and protected-branch updates for owned paths and at least weekly without claiming that CodeQL replaces execution, analyzers, sanitizers, fuzzing, TSan, or binary inspection.

## Contracts And Boundaries

- The manifest is the canonical source-coverage owner shared by drivers and reporting.
- Reports contain relative project/source identifiers and bounded classifications only; no absolute paths or unrestricted environment data.
- A tool crash, malformed report, missing source, unsupported path, or bad-fixture false success fails closed.
- Sanitized CodeQL SARIF may be retained only in the GitHub repository boundary and must satisfy REP-001 redaction and path constraints.

## Expected Files Or Components

- `scripts/local-whisper/native-quality-tools.mjs` and the three native quality drivers.
- A focused manifest/reporting module under `scripts/local-whisper/native-build/`.
- The four native `.clang-tidy` files and focused analyzer fixtures/tests.
- `runtime/local-whisper/toolchains/profiles/windows-x64-cpu-msvc-19.39-v1.json` plus Packet 08's ASan profile contract.
- `package.json`, `.github/workflows/pr-checks.yml`, and `tests/runtime/localWhisper/nativeCiWorkflow.test.ts`.
- A focused CodeQL workflow/configuration, source-inventory policy, supported bad-query fixtures, and security workflow tests.

## Acceptance Criteria

- Linux path-sensitive analysis passes for every Linux manifest source and its bad fixture is detected.
- Workflow/profile tests prove every ordinary and analyzed Windows manifest source will be compiled by MSVC and no contract-only step is reported as execution.
- The coverage summary rejects absent sources, unsupported evidence claims, and Linux-to-Windows overstatement.
- Packet-local Windows jobs execute AC-AUT-018 and the Windows half of AC-AUT-019; the packet emits a truthful interim AC-AUT-025 summary, with final workstream aggregation retained by Packet 19.
- AC-AUT-032 creates all three databases, detects every supported bad fixture, and proves Linux and Windows C++ manifests were compiled by their real primary-host builds.

## Verification

Run on Linux x64:

```text
npm run lint:local-whisper:worker-common
npm run lint:local-whisper:fs-guard
npm run lint:local-whisper:launcher
npm run test:local-whisper:native-analysis
npm run test:local-whisper:native-build-audits
npm run test:local-whisper:native-ci-workflow
npm run test:security:codeql-policy
npm run validate:workflows
npm run format:check
npm run lint
npm run typecheck
npm run test:types
```

If canonical command names differ during implementation, update `package.json`, Packets 14–15, and the workflow tests together. Do not manually dispatch Windows CI; the required non-force push must launch it through the pull request.

## Remote Completion Gate

1. Before the candidate or any fix commit, run every applicable local check. Leave Packet 11 unchecked, record pending remote evidence in `handoff.md`, stage only packet-owned paths, commit conventionally, and push without force.
2. Confirm CI launched for the exact candidate SHA. Require all selected checks to succeed, including Quality Gates, immutable workflow policy, fixture/package jobs, the Ubuntu 24.04 and Windows Server 2025 native runner jobs, Linux/MSVC analyzers, all three CodeQL databases/query proofs, and coverage reporting.
3. Linux analysis/CodeQL and ordinary-MSVC, MSVC-analysis, dedicated-MSVC-ASan, and Windows C++ CodeQL must execute their complete manifests on the owning primary runner. The required Windows Server 2025 jobs must run and conclude `success`; no required Windows skip is acceptable.
4. Fix packet-caused in-scope failures with focused regressions, rerun all applicable local checks before committing, push, and repeat the exact-SHA gate. Record unrelated/out-of-scope failures as blockers.
5. After the candidate SHA passes, check Packet 11 and update `handoff.md`. Push a documentation-only completion commit and confirm CI launch; do not wait for that documentation-only run to finish.

## Failure And Rollback

- Classify and fix analyzer findings before enabling each blocking check; do not add a blanket suppression or advisory baseline.
- If a Windows-owned source cannot be represented by the supported MSVC or C++ CodeQL graph, stop and return the source-coverage conflict to planning.
- Never suppress a configured CodeQL security result, accept an unreviewed baseline, or normalize missing/malformed SARIF as clean.
- Roll back manifests, analyzers, CodeQL/query configuration, reports, drivers, package commands, and workflow wiring as one unit.

## Manual Gates

- No supported-host manual Windows smoke is performed here; Packet 19 retains that final manual gate. Ordinary MSVC, MSVC-analysis, MSVC-ASan, and Windows C++ CodeQL jobs are mandatory here.
- The packet's non-force PR-head pushes are required; manual workflow dispatch, artifact publication, and qualification remain unauthorized.

## References

- Specification Sections 4, 10.2, 10.10, 11, and 12; AC-AUT-018, AC-AUT-019, AC-AUT-025, AC-AUT-032.
- CI review selections for real Windows execution and path-sensitive analysis.

## Completion And Handoff

- Record manifests, enabled checks, CodeQL tool/query/database identities, local analyzer results, candidate SHA, and every successful Linux/Windows analysis job in `handoff.md`.
- Check Packet 11 only after local verification and the code-bearing exact-SHA remote gate passes with no required Windows skip. Packet 19 remains mandatory for supported-host manual Windows evidence and the final aggregate report.
- Set the exact next packet to Packet 12 and stop.
