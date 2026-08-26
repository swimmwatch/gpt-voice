# 01 Qualification Contract And Baseline

## Outcome

Create a privacy-safe performance qualification layer that can lock paired before/after inputs, validate phase
and resource evidence, enforce the 25 percent improvement and 3 percent regression rules, record the 8/7 source
baseline, and provide the deterministic selector used for the final installation-pipeline window.

## Prerequisites

- The refreshed execution basis is repository `1f6ce9c988a275f1ef9faa295b1bb04879943e89`. It incorporates completed
  native-remediation Packet 20, Windows worker/protocol remediation, MSVC 19.51 CPU profile migration, and the current
  parallel native CI policy.
- The GAT-004 audit at that basis confirms two acquisition-time directory inspections, two later TypeScript
  revalidations, retained native authority proofs, and both exact worker reads: eight full hashes on Linux and seven
  on Windows before Packet 02. Recheck those paths again immediately before implementation and stop if they drift.
- Preserve the existing qualification-v2 graph, canonical JSON, digest, and privacy contracts.
- Preserve the completed hosted Windows validation contract: real CPU execution and CUDA contract-only verification
  are CI evidence, while representative Windows CPU/CUDA performance remains a direct Packet 17 manual gate.

## Owned Requirements

OUT-001, SCP-003, SCP-007, BASE-001, GAT-001, GAT-002, GAT-003, GAT-004, QUAL-001, OBS-001, OBS-002,
OBS-003, PERF-001, PERF-004, RES-002, PRIV-001, AC-AUT-001, AC-AUT-002.

## In Scope

- Qualification-only schemas, validators, analyzers, deterministic fixtures, and command entry points.
- Fail-closed Linux and Windows performance CI aggregates, workflow path coverage for this specification directory,
  and runner-policy assertions that keep Windows checks on the configured Windows CI runner.
- Qualification-only separation between hosted Windows CPU/CUDA-contract fixtures and the real-host Windows CPU/CUDA
  matrix; do not turn hosted CUDA contract checks into a hardware-performance claim.
- Phase duration and peak-resource evidence for directory proofs, digests, process/authority transfer, model load,
  explicit warm-up, GPU allocation, installation encode/wait/decode/write, main/guard/worker RSS, and GPU VRAM.
- A locked paired manifest for `base/full`, `medium/full`, and `large-v3/q5_0`, minimum five successful pairs,
  explicit cold/warm cache state, order, sampling interval, statistic, and uncertainty method.
- A source-count assertion for successful model-load baselines: Linux 8 and Windows 7 full-model hashes.
- Qualification-only measurement of fixed in-flight candidates 1, 2, 4, and 8. The selector chooses the smallest
  candidate whose conservative installation wait/write improvement is at least 25 percent and whose end-to-end time
  and every peak resource remain within the 3 percent guardrail. Fixture output proves the selector only; Packet 18
  freezes a production value from Packet 16 Linux and Packet 17 Windows evidence.

## Out Of Scope

- Production telemetry, new native-log event names, diagnostics retention changes, or renderer-visible metrics.
- Any performance optimization, guard protocol change, runtime profile change, or representative-host final pass.
- Storing raw benchmark inputs, absolute paths, device identities, audio, transcripts, prompts, capabilities,
  credentials, environment dumps, or unrestricted native output.

## Task Contract

1. Extend the existing qualification graph rather than introduce a parallel evidence system. All new documents
   must be canonical, digest-linked, size-bounded, schema-validated, and immutable after validation.
2. Define phase identifiers and units centrally. Reject missing, duplicate, negative, non-finite, out-of-order,
   oversized, or unknown phase/resource values.
3. Keep failed samples in the result set with stable content-free reasons. Never replace failures until a desired
   result appears.
4. The comparison analyzer must calculate the declared central value and uncertainty, apply conservative gain as
   point estimate minus uncertainty, and reject any result below 25 percent or beyond the 3 percent guardrail.
5. Window selection is deterministic over candidates `[1, 2, 4, 8]`; ties choose the smaller value. If no
   candidate qualifies, do not select a production value and stop the workstream for plan/spec review.
6. Fixture runs record their deterministic result explicitly as non-production. Packet 18 records only the final
   selected integer and sanitized aggregate evidence needed for review. Do not commit private host measurements.
7. Add exact aggregate checks named `Local Whisper Performance (Linux)` and
   `Local Whisper Performance (Windows)` to `.github/workflows/pr-checks.yml`. Run them on
   `${{ vars.CI_LINUX_RUNNER }}` and `${{ vars.CI_WINDOWS_RUNNER }}` respectively, and make each aggregate fail
   unless every underlying task-specific lane succeeds.
8. Include `docs/specs/local-whisper-performance-remediation/**` in the workflow path policy so later
   qualification-evidence packets trigger CI. Hosted lanes use deterministic fixtures and authenticated test-source
   provisioning only; they must not download production models or claim representative CPU/CUDA performance.
9. Extend the current runner/workflow policy tests while preserving the completed parallel native lanes, MSVC 19.51
   CPU validation, CUDA contract-only hosted check, fail-closed native aggregates, and runner evidence contracts.
10. The Windows qualification entry point must accept the specification's CPU/CUDA real-host matrix without changing
    the existing CPU-only executable hosted-validation catalog. Use an explicit qualification mode or input contract;
    never silently add CUDA execution to hosted CI.

## Contracts And Boundaries

- Qualification remains a script-owned adapter boundary and may consume validated native lifecycle records
  without turning the native schema-v1 log or diagnostics archive into a telemetry database.
- All filesystem roots used by tests are validated temporary roots. No broad recursive cleanup is permitted.
- This packet does not authorize execution of Packet 02 or any production change.

## Expected Files Or Components

- `scripts/local-whisper/qualification/QualificationContracts.ts`
- `scripts/local-whisper/qualification/QualificationMetrics.ts`
- `scripts/local-whisper/qualification/QualificationResultProducer.ts`
- `scripts/local-whisper/qualification/QualificationCatalogProducer.ts`
- Qualification schemas under `docs/specs/local-whisper/qualification/schemas/`
- Focused tests under `tests/scripts/localWhisper/qualification/`
- `tests/scripts/localWhisper/qualification/QualificationCatalogProducer.test.ts`
- A qualification-only benchmark/selection entry point under `scripts/local-whisper/qualification/`
- Cross-platform qualification entry points exposed as `run:local-whisper:qualification:windows` and
  `verify:local-whisper:qualification:windows`, with fixture-mode coverage in hosted Windows CI and real-host mode
  reserved for Packet 17; Packet 18 invokes the selector over combined representative-host evidence
- `.github/workflows/pr-checks.yml`
- `scripts/local-whisper/ci/RunnerPolicyVerifier.ts`
- `tests/scripts/localWhisper/ci/RunnerPolicy.test.ts`
- `package.json` only if named cross-platform CI entry points are required

## Acceptance Criteria

- AC-AUT-001 passes for valid, missing, malformed, oversized, and sensitive fixtures.
- AC-AUT-002 passes for qualifying, sub-threshold, uncertainty-overlap, and resource-regression fixtures.
- Source-count fixtures reject any unexplained deviation from the refreshed 8/7 baseline at
  `1f6ce9c988a275f1ef9faa295b1bb04879943e89`.
- Candidate selection is reproducible, emits exactly one of 1, 2, 4, or 8 only when all gates pass, and otherwise
  fails closed.

## Verification

- `npm run test:local-whisper:qualification`
- `npm run test:local-whisper:native-ci-workflow`
- `npm run test:local-whisper:acceptance-ownership`
- `npm run typecheck`
- `npm run test:types`
- `npm run format:check`
- Run the new benchmark-selection verifier on deterministic Linux and Windows fixtures.

## CI Gate And Commit Discipline

- The task-specific qualification, workflow-policy, runner-policy, source-count, and candidate-selection assertions
  above must execute in the new Linux and Windows performance lanes. The implementation commit must prove the lanes'
  exact names, runner variables, path triggers, and fail-closed aggregate behavior.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`, and
  `Local Whisper Native Quality (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- An actionable CI failure must be fixed only in a later explicitly authorized invocation and a separate fix commit.
  Do not amend or squash the implementation commit. Push the fix and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 02 remains blocked until the green result is reviewed.

## Failure And Rollback

- A schema, privacy, source-basis, or statistical inconsistency blocks qualification and window selection.
- Rollback removes only the new qualification documents, schemas, tests, and entry point; existing qualification-v2
  evidence and production logging remain untouched.

## Manual Gates

- `MANUAL GATE`: run the fixed-candidate selector on supported Linux and Windows hosts or equivalent controlled
  platform runners before accepting the selected value. Hosted evidence does not replace Packets 14 and 15
  representative-host matrices.
- Do not download models, use private audio, or contact external services without separate authorization.

## References

- Specification Sections 2, 4, 5, 12, and 14.1.
- `docs/agent-guides/project-conventions.md` Sections “Project And Commands,” “Code And Logging,” and “Tests And Documentation.”

## Completion And Handoff

After verification, mark only Packet 01 complete in `todo.md`. Record fixture candidate results as non-production,
the changed files, checks, and exact next packet in `handoff.md`, then stop for review. Production selection remains
Packet 18 work.
