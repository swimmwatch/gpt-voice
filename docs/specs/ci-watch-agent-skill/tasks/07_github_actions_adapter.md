# 07 GitHub Actions Adapter

## Outcome

Implement `GitHubActionsProcessAdapter` for one workflow run or one composite pull-request required-check contract with exact-attempt/SHA proof and idempotent dispatch.

## Prerequisites

- Tasks 01–06 completed and committed.
- Existing workflows are observation targets and must not be modified by this packet.

## Owned Requirements

`CUR-001`, `ADAPT-001`, `ADAPT-002`, `IFACE-002`, `PROV-001`, `SAFE-002`, `FLOW-005`, `GIT-001`, `GIT-002`

## In Scope

- GitHub run mode and pull-request-contract mode using the existing authenticated `gh` executable through `ManagedProcessRunner`.
- Closed parsing/normalization of bounded `gh` JSON/API responses.
- Fixture-driven tests for workflows, attempts, check suites/runs, commit statuses, required-check contracts, dispatch, reconciliation, authentication, and stale heads.

## Out Of Scope

- Workflow edits, webhooks, GitHub App/service creation, token storage, repository settings changes, merge, rerun-by-UI automation, protected-environment approval, release, publish, or deploy.

## Task Contract

- Preflight requires existing `gh`, valid authentication, repository selector matching the scenario/workspace, supported run/PR selector, allowed workflow, and exact expected source SHA. Never print or persist auth details.
- Run identity binds repository, workflow/event, run ID, run attempt, exact SHA, and watch generation. Reused run IDs with a different attempt/SHA are distinct.
- A PR invocation identifies one immutable logical aggregate: repository, PR number, exact head SHA, required-check/ruleset contract digest, and watch generation. Its members may include multiple workflow runs/attempts, check suites/runs, external commit statuses, jobs, and required checks, but all must bind the same head SHA and repository.
- Query the provider fresh for required-check membership and conclusions. Missing, pending, cancelled, neutral, stale, unexpected skipped, duplicate/ambiguous, or unknown required members fail closed. Allowed skipped checks are scenario-explicit and still identity-bound.
- Existing `pr-checks.yml`, `local-whisper-packaging.yml`, and `release-builds.yml` are consumed as-is. Monitoring-specific jobs are forbidden.
- Dispatch is allowed only when the normalized scenario enables it, names an allowlisted workflow, supplies fixed validated inputs, and does not set prohibited publish/deploy/release inputs. Persist intent and deterministic operation key before `gh workflow run`/API call.
- Ambiguous dispatch reconciles provider runs by operation key/correlation input, repository/workflow, exact SHA, and attempt. One exact match attaches; zero permits one dispatch; multiple/unprovable matches block.
- Adapter cancellation is unsupported unless a later explicit scenario/invocation contract separately authorizes it; watching never implies remote cancel.

## Contracts And Boundaries

- `gh` output is untrusted bounded JSON. Use explicit requested fields and closed validators; do not parse colored/table text or execute log content.
- Evidence collection is once per exact failed attempt unless the user explicitly requests refresh and always passes through bounded evidence.
- The adapter exposes immutable identities and fresh provider proofs to the orchestrator/attestation; it does not decide repair scope.

## Expected Files Or Components

- `.agents/skills/watch-process/scripts/lib/adapters/github-actions-process-adapter.mjs`
- `tests/skills/watchProcess/github-actions-adapter.test.mjs`
- Bounded sanitized JSON fixtures representing existing workflow/run/PR contracts

## Acceptance Criteria

- Tests cover run and composite PR success, multiple workflow runs, external statuses, required jobs/checks, exact SHA/attempt, stale head, missing/skip/neutral/cancel/pending, auth expiry, dispatch input rejection, crash-after-dispatch reconciliation, and multiple-match blocking.
- Fixtures prove existing workflow filenames are observed without workflow modification.
- No secret/token/raw-log value appears in state, journal, errors, or snapshots.

## Verification

- `node --test tests/skills/watchProcess/github-actions-adapter.test.mjs`
- `node --check .agents/skills/watch-process/scripts/lib/adapters/github-actions-process-adapter.mjs`
- `npx prettier --check .agents/skills/watch-process/scripts/lib/adapters/github-actions-process-adapter.mjs tests/skills/watchProcess/github-actions-adapter.test.mjs tests/skills/watchProcess/fixtures/*.json`
- Focused assertion that `.github/workflows/pr-checks.yml`, `local-whisper-packaging.yml`, and `release-builds.yml` are unchanged.

## Failure And Rollback

Unprovable GitHub identity, membership, conclusion, auth, or dispatch result blocks; never accept branch-level green or rerun blindly. Repair the adapter/fixture forward without weakening the observed workflows.

## Manual Gates

No live dispatch or remote cancellation. A safe real run and PR aggregate are deferred to Task 12 with user-selected timeout and explicit authority.

## References

- Mandatory: specification `IFACE-002`, `CUR-001`, `PROV-001`, section 7.1, and GitHub example.
- Mandatory repository evidence: the three existing workflow files named above.

## Completion And Handoff

After verification, update task state/handoff, set Task 08 as next, and stop.
