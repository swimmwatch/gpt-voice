# 11 Cross-Platform Compatibility CI

## Outcome

Add a dedicated fail-closed compatibility workflow proving the standalone runtime on Node.js 22 and 24 across GitHub-hosted Linux, Windows, and macOS, while keeping the existing `Quality Gates` workflow unchanged.

## Prerequisites

- Tasks 01–10 completed and committed.
- Planning decision `ci.compatibility_matrix_placement` selects a separate required workflow.
- All standalone tests must already avoid project/runtime dependencies.

## Owned Requirements

`COMP-002`, `NODE-002`, `PLAT-001`, `DEP-001`, `PROV-002`, `SAFE-006`

## In Scope

- A single cross-platform suite entry file importing every standalone watch-process `.test.mjs` module.
- A new GitHub Actions workflow with six matrix cells and one stable aggregate check.
- Workflow-policy tests for triggers, scope classification, pins, permissions, matrix completeness, aggregate fail-closed behavior, and unchanged existing aggregate.
- Optional `npm run test:watch-process` local convenience script; the Node 22 workflow must run the suite directly without `npm install`.

## Out Of Scope

- C++, native/package/release/security workflows, existing `pr-checks.yml` jobs/check names, dependencies, packaging, application code, self-hosted runners, publication, or branch-protection mutation through automation.

## Task Contract

- Create `.github/workflows/watch-process-compatibility.yml` with read-only contents permission, concurrency cancellation scoped to workflow/ref, bounded timeouts, pinned official checkout/setup-node action SHAs reused from repository precedents, and GitHub-hosted labels `ubuntu-latest`, `windows-latest`, `macos-latest` crossed with Node `22` and `24`.
- The workflow must always produce the stable aggregate job name `Watch Process Compatibility` for pull requests; a top-level `paths` filter is forbidden because a required skipped workflow can leave branch protection pending.
- A cheap Linux scope job classifies whether watch-process skill/library/hook/scenarios/tests/workflow or relevant package script changed. The six-cell matrix runs only when relevant (and always for explicit workflow dispatch); the aggregate accepts an intentional irrelevant skip only when the trusted classifier says irrelevant. If relevant, every matrix cell must be `success`; failure/cancel/skip is fail-closed.
- Path classification uses repository-owned code or fixed Git arguments with validated event SHAs and no third-party path-filter action. It handles pull-request base/head, push, and workflow dispatch deterministically.
- Matrix jobs check out the repository, install only the requested Node runtime, then run `node --test tests/skills/watchProcess/suite.test.mjs`. Do not run `npm ci`: root package currently requires Node 24 and the base-library contract must prove zero runtime dependencies under Node 22.
- The suite covers every base module, four adapters, schema examples, generated watcher, hook, state/outcomes, repair ownership, and policy tests that can run dependency-free. Root TypeScript policy tests continue in existing Quality Gates under Node 24.
- Add a policy assertion that dedicated GitLab/glab artifacts remain absent and every child-process path is shell-free.
- Do not change `.github/workflows/pr-checks.yml` or its `Quality Gates` check. The new aggregate becomes required only through the manual gate below.

## Contracts And Boundaries

- Hosted OS labels are explicit because the user selected GitHub-provided runners.
- Workflow permissions remain least privilege; tests perform no network/provider/Docker dispatch and need no secrets.
- Matrix total must be exactly six unique OS/Node combinations and aggregate must depend on all through the matrix job result.

## Expected Files Or Components

- `.github/workflows/watch-process-compatibility.yml`
- `tests/skills/watchProcess/suite.test.mjs`
- A TypeScript workflow-policy test under `tests/scripts/` or `tests/skills/`
- `package.json` only if adding the local convenience script

## Acceptance Criteria

- Local suite passes on current Node and policy test proves all six cells, hosted runners, direct no-install execution, stable aggregate, fail-closed relevant behavior, safe irrelevant skip, workflow pins/permissions/timeouts, and unchanged existing Quality Gates.
- CI evidence from a later real run shows Node 22/24 success on Linux/Windows/macOS.
- No dependency, lockfile, C++ workflow, packaging, release, or application change.

## Verification

- `node --test tests/skills/watchProcess/suite.test.mjs`
- `node --import tsx --test <workflow-policy-test>`
- `npx prettier --check .github/workflows/watch-process-compatibility.yml tests/skills/watchProcess/suite.test.mjs <workflow-policy-test> package.json`
- `npm run test:types`
- `git diff --exit-code -- .github/workflows/pr-checks.yml` relative to the packet starting commit.

## Failure And Rollback

Fix matrix or policy code; never skip a relevant cell or weaken aggregation to obtain green. If hosted Node/OS behavior reveals a base-library defect, repair the owning prior module through this packet with a regression test and record the cross-packet file in handoff. Removing the new workflow is a reversible explicit patch before it becomes required.

## Manual Gates

- After the workflow has one successful real run, a repository administrator must add the stable `Watch Process Compatibility` aggregate check to branch protection/rulesets. This external setting change requires separate explicit authorization and is not performed by implementation.
- Do not mark this manual gate satisfied from local tests or a different check name/commit SHA.

## References

- Mandatory: planning decision ledger entry `ci.compatibility_matrix_placement`.
- Mandatory workflow precedents: pinned checkout/setup-node versions and fail-closed aggregate style in `.github/workflows/pr-checks.yml` and `.github/actions/setup-ci-project/action.yml`.

## Completion And Handoff

After local verification, update `todo.md`/`handoff.md`, record the unsatisfied external required-check gate and exact next Task 12, then stop.
