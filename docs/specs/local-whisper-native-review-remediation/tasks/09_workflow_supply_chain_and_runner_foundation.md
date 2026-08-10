# 09 Workflow Supply Chain And Runner Foundation

## Outcome

Every required workflow uses immutable external inputs, least-privilege execution, consolidated reusable configuration, and exactly the tested Ubuntu 24.04 and Windows Server 2025 x64 runner lanes.

## Prerequisites

- Packets 01–08 are complete and retain their historical evidence.
- The approved specification revision `APPROVAL-005`, `compatibility.runner-version-matrix` revision 2, `operations.workflow-parameterization` revision 1, and planning decision `plan.amendment-packet-sequencing` revision 1 are current.
- This packet has separate execution authorization and no other packet is in progress.

## Owned Requirements

- Primary: OUT-004, GAT-004, CMP-009, CMP-010, CMP-011, CMP-012, SUP-001, SUP-002, WF-001, RUN-001, RUN-002, RUN-003, RUN-004, RUN-005, RUN-006.
- Cross-cutting: SEC-004, SEC-006, TST-001–TST-002, TST-008, TST-010.
- Acceptance: AC-AUT-028–AC-AUT-029, AC-AUT-039–AC-AUT-040, AC-AUT-042.

## In Scope

- All required workflows and repository-local actions owned by this specification.
- Full-SHA external Action references with reviewed-version comments and `tag@sha256` container identities.
- Immutable actionlint distribution, blocking high-severity zizmor analysis, least-privilege permissions, safe checkout credentials, interpolation policy, and narrowly scoped suppressions.
- Fixed Ubuntu 24.04 and Windows Server 2025 runner labels, deterministic path ownership, pinned toolchain provisioning, source-manifest coverage, and runner-evidence records.
- Consolidation of equivalent jobs, steps, setup, caches, and reusable runner/tool/architecture/image/timeout/retention configuration without merging genuinely distinct Fedora and Windows build mechanisms.

## Out Of Scope

- Dependency Review, npm signature verification, repository secret detection, CodeQL, Dockerfile lint/image scanning, whole-application SBOMs, application vulnerability scans, attestations, Scorecard, supported-desktop testing, or a release.
- `*-latest`, Ubuntu 22.04, Windows Server 2022, preview, ARM, macOS, self-hosted, ambient compiler, another hosted Linux generation, or another hosted Windows generation.

## Task Contract

1. Replace every non-local `uses:` reference in required workflows with a reviewed full 40-character commit SHA and a trailing upstream-version comment. Keep repository-local actions relative. Remove unverified download execution, including the current mutable actionlint installer.
2. Pin every affected workflow or builder container as a readable `tag@sha256:<digest>` identity. Pin the Fedora 44 builder without turning it into another hosted-runner lane. Fail before secrets, caches, source imports, or packaging inputs are consumed when identity validation fails.
3. Add one policy owner that parses real workflow/action/Docker inputs and fails on mutable Action tags/branches, unverified executable downloads, tag-only images, wrong digests, excessive permissions, persisted checkout credentials, unsafe privileged interpolation, or broad analyzer suppression.
4. Run actionlint from the immutable reviewed distribution and zizmor with high-severity findings blocking. Add deterministic safe and failing fixtures for every WF-001 class.
5. Replace every owned mutable hosted label with exactly `ubuntu-24.04` or `windows-2025`. A runner-policy validator must reject latest aliases, unsupported/preview/ARM labels, missing Linux/Windows legs, and repository-variable values outside the approved pair.
6. Consolidate equivalent operating-system workflows, jobs, setup, caches, and checks through platform matrices, explicit conditions, or repository-local actions. Define runner labels, Node/npm and compiler versions, architecture, image identities, cache roots, timeouts, retention periods, fixture dates, and equivalent reusable values once at the narrowest appropriate matrix, environment, repository-variable, policy-manifest, or local-action owner. Preserve separate Fedora/Linux and Windows packaging jobs only where their build mechanisms, shells, or artifact formats genuinely differ.
7. Make native path filters deterministic and test their positive and negative owners. Native sources, CMake/native scripts, pinned compilers/sources, OS-facing code, Electron/runtime dependencies, packaging inputs, and their workflows must select the applicable Linux/Windows lanes. Documentation-only and unrelated-provider changes must not.
8. Emit bounded runner evidence containing the explicit label, reported OS/image version, x64 architecture, pinned toolchain, source commit, native source manifest, and tested digests. Wrong image metadata, ambient or mismatched compiler, source divergence, cancelled/missing jobs, or deprecated-label substitution is missing evidence.
9. Preserve current package-format responsibilities for later packets: Fedora 44 stays on Ubuntu 24.04; Linux package/unpacked smoke remains in the owning Ubuntu 24.04/Fedora path; Windows NSIS/unpacked smoke remains on Windows Server 2025. Bind later evidence to primary-produced artifact digests.

## Contracts And Boundaries

- Workflow policy consumes repository configuration and synthetic fixtures only. It must not execute a reference before validating its identity.
- Permissions are job-scoped. `id-token: write`, package publication, release writes, and signing authority are absent here.
- Reports use repository-relative identifiers and bounded classifications; no credentials, tokens, environment dumps, audio, transcripts, models, sessions, or user paths are retained.
- The Windows Server 2025 native and package jobs must execute and succeed when selected. A skipped, cancelled, neutral, or missing required Windows job is not evidence.

## Expected Files Or Components

- `.github/workflows/*.yml` and `.github/actions/initialize-msvc-environment/action.yml`.
- `build/fedora-release/Dockerfile` and any checked-in container-identity policy data.
- Focused workflow/runner policy classes or CLIs under `scripts/` or `scripts/local-whisper/native-build/`.
- `tests/runtime/localWhisper/nativeCiWorkflow.test.ts` plus dedicated synthetic workflow/runner fixtures and tests.
- `package.json` command wiring and, if required, Dependabot workflow-input ownership that does not yet implement Packet 10's Docker update policy.

## Acceptance Criteria

- AC-AUT-028 accepts only local actions, full-SHA external Actions, and reviewed tag-plus-digest images; every unsafe proof fails before execution.
- AC-AUT-029 passes actionlint/zizmor on real workflows and rejects each excessive-permission, interpolation, credential-persistence, cache, and suppression fixture.
- AC-AUT-039 proves the exact two-label allocation and rejects mutable, unsupported, wrong-architecture, missing-platform, and invalid repository-variable variants.
- AC-AUT-040 executes the applicable native manifests, analyzers, and sanitizers with pinned compilers on both primary runners while proving equivalent setup/configuration has one reusable owner.
- AC-AUT-042 fails wrong host/toolchain/source/job evidence without claiming supported-desktop qualification.

## Verification

Run locally before every candidate or fix commit:

```text
npm run validate:workflows
npm run test:security:workflow-policy
npm run test:local-whisper:runner-policy
npm run test:local-whisper:native-ci-workflow
npm run test:local-whisper:native-build-audits
npm run format:check
npm run lint
npm run typecheck
npm run test:types
```

Use the canonical names introduced by this packet and update this contract before execution if a name differs. Also run all other available checks selected by the changed paths; CI is not the first test run.

## Remote Completion Gate

1. After all applicable local checks pass, leave Packet 09 unchecked, record the candidate state in `handoff.md`, stage only packet-owned paths, create a conventional commit, and push it without force to the verified pull-request head.
2. Confirm CI launched for the exact candidate SHA. Require every selected check to succeed, including Quality Gates, immutable actionlint/zizmor policy, fixture packaging, Fedora and Windows package smoke, and both Linux/Windows native-quality jobs.
3. The `windows-2025` native-quality and package-smoke jobs must launch, execute their complete selected stages with MSVC 19.39 where native compilation applies, and conclude `success`. No required Windows skip is acceptable.
4. For every packet-caused failure, run all applicable local checks before committing a focused fix, push it, and repeat the complete exact-SHA gate. Record unrelated/out-of-scope failures as blockers.
5. After the candidate SHA is green, check Packet 09 and update `handoff.md`. If that completion record changes documentation only, commit and push it and confirm CI launches; the packet need not wait for that documentation-only run to finish.

## Failure And Rollback

- Do not weaken a permission, path owner, analyzer severity, identity validator, fixed label, pinned toolchain, or negative proof to obtain a pass.
- If an approved runner or exact MSVC profile is unavailable, record missing evidence and stop; do not fall back to an ambient compiler or latest alias.
- Roll back reference pins, policies, runner allocation, fixtures, and workflow wiring together.

## Manual Gates

- Read-only upstream identity research is permitted; changing the approved runner matrix or substituting another Action/container identity requires reviewed evidence and, where contract-changing, a specification revision.
- Non-force packet commits and pushes are within the standing scoped authorization. Force-pushes, manual workflow dispatch, required-check setting changes, signing, publication, qualification, and release remain unauthorized.

## References

- Specification Sections 3.1, 4, 10.8, 10.12, 11, and 12; AC-AUT-028–AC-AUT-029, AC-AUT-039–AC-AUT-040, AC-AUT-042.
- Planning decision `plan.amendment-packet-sequencing` revision 1.

## Completion And Handoff

- Record reviewed Action/image identities, permission policy, consolidated configuration owners, path owners, exact runner/toolchain/source evidence, local commands, candidate SHA, and every required Linux/Windows job result in `handoff.md`.
- Check Packet 09 only after its code-bearing exact-SHA gate passes with the required Windows Server 2025 native and package jobs executed successfully.
- Set the exact next packet to Packet 10 and stop.
