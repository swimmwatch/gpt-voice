# 10 Schedule The Translation Language Monitor

## Outcome

A daily 06:00 UTC and manually dispatchable GitHub Actions workflow runs the
no-text probe, creates or updates one sanitized issue for the same
provider+diff fingerprint, reopens that issue if closed while drift persists,
fails safely on probe/API errors, and documents the maintainer review flow.

## Prerequisites

- Tasks 01 and 09 are complete and approved.
- Task 10 has separate execution authorization.
- The monitor report schema and fingerprint tests are stable.

## Owned Requirements

- `OPS-001`
- `OPS-007`–`OPS-012`
- `DOC-005`
- Issue reconciliation, workflow, and no-baseline-mutation portions of
  `AC-AUTO-008`
- Implementation prerequisites for `AC-MAN-005`

## In Scope

- Pure/testable GitHub issue reconciliation.
- Scheduled/manual workflow with minimal permissions and bounded concurrency.
- Probe/reconcile/final-failure step sequencing.
- Workflow source-contract and issue-client tests.
- Contributor/operator guidance and sanitized research-record updates.

## Out Of Scope

- Automatic baseline edits, commits, pushes, pull requests, issue deletion or
  auto-closing, provider secrets, artifact upload, screenshots, raw DOM, or
  translation submission.
- DeepL monitoring, third-party GitHub actions beyond existing pinned checkout/
  setup/cache actions, new npm dependencies, or release workflow changes.
- Actually dispatching the workflow or writing an issue without a separate
  repository-owner authorization.

## Task Contract

1. Add `.github/workflows/translation-language-monitor.yml` with:

   ```yaml
   on:
     schedule:
       - cron: '0 6 * * *'
     workflow_dispatch:
   ```

2. Give only the monitor job:

   ```yaml
   permissions:
     contents: read
     issues: write
   ```

   All other permissions are absent. Use the standard repository token and no
   provider secret.

3. Use existing pinned conventions:
   - Ubuntu GitHub-hosted runner;
   - `actions/checkout@v7` with `persist-credentials: false`;
   - `actions/setup-node@v7` with Node 24;
   - `actions/cache@v6` only for existing npm/CloakBrowser cache paths;
   - `CLOAKBROWSER_AUTO_UPDATE=false`;
   - `npm run ci:install`, pinned CloakBrowser preparation, and smoke.
4. Set a 20-minute job timeout and one workflow-wide concurrency group shared
   by schedule/manual runs with `cancel-in-progress: false`. Provider probe
   timeouts remain Task 09's 60 seconds each.
5. Store the sanitized report under `RUNNER_TEMP`. Do not upload it as an
   artifact and do not write it into the checkout.
6. Run the aggregate probe with `continue-on-error: true` so drift from
   successful providers can still reconcile when another provider returns a
   typed probe failure. After reconciliation, a final gate fails the job when
   the probe step failed.
7. Pass `GITHUB_TOKEN` only to the reconciliation step. The probe, install,
   prepare, smoke, and final-gate steps must not receive it through a
   step-specific environment variable.
8. Implement issue reconciliation with Node 24 built-in `fetch` and injected
   HTTP dependencies for tests. Add no GitHub SDK or action.
9. Treat the Task 09 report as untrusted at this external-write boundary.
   Revalidate the closed provider/outcome schema, baseline date, fixed-length
   64-character lowercase hexadecimal fingerprint, diff entry uniqueness, the
   Task 09
   code/label/count bounds, and absence of unknown fields. Recompute the
   canonical fingerprint and require an exact match before any GitHub read or
   write.
10. Define issue identity as provider ID plus the full Task 09 diff fingerprint.
    Include exactly one dedicated hidden body-marker line:
    `<!-- translation-language-drift:<provider>:<full fingerprint> -->`.
    Reconciliation recognizes only that complete line, not marker-like text in
    a title, label, comment, or other body content.
11. Search repository issues in `state=all`, handle pagination, and exclude
    pull requests. For one exact marker:
    - no issue: create one;
    - matching open issue: update its sanitized body/run link without adding a
      duplicate comment;
    - matching closed issue: update and reopen it;
    - different fingerprint: create a different issue.
      More than one issue with the same exact marker is an ambiguity failure:
      perform no write and fail safely rather than choosing one.
12. Use title
    `[translation-language-drift] <provider> <short fingerprint>`.
    The body contains only provider ID, baseline date, sorted added/removed/
    relabeled public pairs, full fingerprint, and the current workflow-run
    link. Render external code/labels through one inert Markdown-escaping
    helper, and fail without writing if the final UTF-8 body exceeds 50,000
    bytes.
13. No drift and probe failure produce no issue API write. A GitHub search,
    create, update, or reopen error fails the job with safe status only.
14. Do not automatically close a drift issue when the baseline later matches.
    A maintainer closes it after a separate reviewed baseline/runtime pull
    request.
15. The workflow and scripts never modify the baseline, checkout, git state,
    branches, or pull requests. No mutation command or write credential exists.
16. Add deterministic tests for issue create/update/reopen/reuse/new
    fingerprint, pagination, pull-request exclusion, no-drift/probe-failure
    no-op, duplicate-marker ambiguity, fingerprint recomputation, unknown
    fields, oversized/unsafe public metadata and body, safe payload allowlist,
    and API failure.
17. Add a workflow source-contract test for cron, dispatch, job permissions,
    concurrency, timeouts, Node 24, auto-update prohibition, token scoping,
    temporary report location, and absence of commit/push/PR/baseline-write
    steps.
18. Document in `CONTRIBUTING.md` and the sanitized provider research record:
    schedule, manual dispatch, no-text scope, drift versus probe failure,
    fingerprint reuse/reopen behavior, reviewed baseline update process, and
    the fact that automation never changes baselines.

## Contracts And Boundaries

- `issues: write` exists only in this workflow/job and is used only after
  successful normalized drift.
- The report-to-issue boundary accepts a parsed allowlisted schema, not raw
  monitor stdout or browser errors.
- Workflow run links are repository metadata; no navigated provider URL is
  included.
- Probe failures remain failed jobs, not public drift claims.
- Existing PR/release workflows and permissions remain unchanged.

## Expected Files Or Components

- Add:
  - `.github/workflows/translation-language-monitor.yml`;
  - `scripts/translation-language-issue-reconciler.ts`;
  - `tests/scripts/translationLanguageIssueReconciler.test.ts`;
  - `tests/scripts/translationLanguageMonitorWorkflow.test.ts`.
- Update:
  - `package.json` only for a reconciliation command when the workflow needs
    one;
  - `tsconfig.test.json` for typed scripts if required;
  - `CONTRIBUTING.md`;
  - `docs/researches/translation-providers/main.md`.
- Reuse Task 09 report/fingerprint types rather than duplicating them.

## Acceptance Criteria

- Workflow contract tests prove exact 06:00 UTC schedule, manual dispatch,
  minimal permissions, no overlap cancellation, bounded job/provider timeouts,
  Node 24, pinned CloakBrowser setup, and no auto-update.
- The repository token is unavailable to the probe and is the only credential
  used by reconciliation.
- Issue tests prove create, update, reopen, same-fingerprint reuse, and
  new-fingerprint separation with no duplicate comments.
- No issue write occurs for no drift, challenge, navigation failure, selector
  ambiguity, unstable map, or any probe failure.
- Issue title/body contain only the approved public fields and run link.
- API failures and probe failures make the workflow fail after safe cleanup.
- No workflow/script step changes a baseline, commit, branch, pull request, or
  existing issue state beyond exact matching update/reopen.
- Operator docs distinguish drift from probe failure and require reviewed
  baseline/runtime changes.

## Verification

Run:

```text
node --import tsx --test tests/scripts/translationLanguageMonitor.test.ts tests/scripts/translationLanguageIssueReconciler.test.ts tests/scripts/translationLanguageMonitorWorkflow.test.ts
npm run test:types
npm run lint
npm run format:check
actionlint -color .github/workflows/translation-language-monitor.yml
```

If local `actionlint` is unavailable, record that exact limitation and require
the repository Actionlint check before completion; do not download an
unreviewed binary in this packet.

## Failure And Rollback

- Overbroad permissions, token exposure to the probe, duplicate issue
  creation, issue content outside the allowlist, or checkout mutation blocks
  the packet.
- Rollback removes the new workflow/reconciler and operator guidance while
  retaining the local no-text probe from Task 09.
- Existing external issues are not automatically deleted during rollback.
  A repository owner may close a created test issue manually after reviewing
  it.

## Manual Gates

- Human review of workflow permissions and an exact sanitized issue fixture is
  required before merge.
- First `workflow_dispatch` against unchanged baselines requires explicit
  repository-owner authorization and should create no issue.
- Live create/reuse/reopen testing requires separate explicit authorization.
  If authorized, use one controlled public diff fingerprint twice, close the
  issue, rerun it, verify the same issue reopens, then remove the controlled
  condition through reviewed changes.
- Do not dispatch, create/update/reopen an issue, commit, push, or open a pull
  request in the implementation invocation.

## References

- Mandatory:
  - Task 09 report schema and tests;
  - `.github/workflows/pr-checks.yml` and `actionlint.yml`;
  - `package.json` Node/CloakBrowser commands;
  - current `CONTRIBUTING.md`;
  - research record monitoring/revalidation sections.
- Traceability:
  - approved specification `OPS-001`, `OPS-007`–`OPS-012`, and `DOC-005`;
  - decisions `operations.language-monitor-cadence`,
    `operations.language-change-reporting`, and
    `operations.language-issue-lifecycle`.

## Completion And Handoff

- Mark Task 10 complete in `todo.md`.
- Update `handoff.md` with workflow permissions/schedule, issue marker and
  payload, changed files, exact checks, actionlint status, and Task 11 as next.
- Present deterministic workflow/reconciliation evidence and stop. Do not
  dispatch, write an issue, commit, or begin Task 11 in the same invocation.
