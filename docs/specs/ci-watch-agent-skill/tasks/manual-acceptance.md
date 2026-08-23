# Watch Process Manual Acceptance Index

Status: pending. No real target, credential, CI run, Docker daemon, hook-trust
setting, remote delivery, or repository ruleset has been changed by this task.

This is a bounded evidence index, not a process log. Before each logical target,
obtain a separate explicit `$watch-process` scenario invocation and ask the user
for a new finite timeout in their language. Explain that the timeout prevents
indefinite waiting and recommend the expected duration plus a practical margin.
For a process that normally takes 30 minutes, recommend approximately 40
minutes (2,400 seconds).

That one invocation authorizes the reviewed scenario's declared normal
start/retry/dispatch and optional normal current-upstream push throughout its
bounded repair loop. Do not request approval again before every declared retry,
dispatch, or normal push. Repository/ruleset settings, remote target
cancellation, release, publish, deploy, and canonically forbidden operations
remain separate gates or forbidden.

## Record format

For every completed row, record only these sanitized values:

```text
watch ID
scenario ID/version/digest
generated script digest and library digest
logical target, attempt, and member IDs
exact source SHA when source-backed
approved timeout and deadline
operation, verification, delivery, and dispatch receipt IDs
final provider/local query timestamp and normalized conclusion
cleanup result and next recovery action, if any
```

Do not record raw logs, complete commands, prompts, credentials, tokens,
cookies, absolute paths, or provider response bodies.

## Pending acceptance gates

| Gate                                        | Explicit invocation or separate gate                                                       | Required bounded evidence                                                                                                | Status  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------- |
| Trust the project Stop hook                 | Authorize `/hooks` review; no watch starts from this action                                | Hook was reviewed as project-local and synchronous; no global setting changed                                            | Pending |
| First compatibility workflow run            | Explicitly invoke the declared safe CI scenario and choose a timeout sized to its duration | Exact commit, run ID, all six matrix member IDs, and `Watch Process Compatibility` aggregate conclusion                  | Pending |
| Required-check configuration                | Authorize repository ruleset/branch-protection change after the successful first run       | Exact aggregate check name and ruleset evidence; no unrelated required check changed                                     | Pending |
| Safe GitHub Actions run                     | Authorize one declared GitHub target and choose a timeout                                  | Repository, workflow/run/attempt, exact SHA, final fresh query, and cleanup                                              | Pending |
| Composite GitHub PR required-check contract | Authorize one PR contract and choose a timeout                                             | PR number, head SHA, required-contract digest, all required members, and final fresh query                               | Pending |
| Disposable generic CI target                | If available, authorize the declared provider-neutral CLI target and choose a timeout      | Closed generic result identity, operation key, target/attempt, status map, and final query; otherwise record unavailable | Pending |
| Broken-then-repaired Docker build           | Authorize a disposable local Docker scenario and choose a timeout                          | Input/command digest, owned process token, forward-only repair ownership, image verification, and cleanup                | Pending |
| Broken-then-repaired local command          | Authorize a disposable local command scenario and choose a timeout                         | Command/input digest, owned process token, forward-only repair ownership, declared exit/output verification, and cleanup | Pending |
| Thirty-minute-class wait                    | Authorize one safe long scenario with approximately 2,400-second timeout                   | Expected duration, selected timeout/deadline, hook ceiling, wait result, and recovery if interrupted                     | Pending |
| IDE restart/recovery                        | Authorize a safe restart experiment and choose a timeout before the watch                  | Watcher/hook liveness, `resume` preflight with a newly selected timeout, target revalidation, and final outcome          | Pending |
| Authentication expiry                       | Authorize a disposable expired-auth scenario and choose a timeout                          | `authentication_failed`, absence of credential collection, and recovery or blocker                                       | Pending |
| Cancel during Repairing                     | Authorize a safe repair-stage scenario and choose a timeout                                | `user_cancelled`, preserved patch/receipts, and no remote cancellation inference                                         | Pending |
| Cancel during Verifying                     | Authorize a safe verification-stage scenario and choose a timeout                          | `user_cancelled`, preserved patch/receipts, and no rollback                                                              | Pending |
| Cancel during Restarting                    | Authorize a safe restart-stage scenario and choose a timeout                               | `user_cancelled`, preserved patch/ambiguous receipt, and no repeated dispatch                                            | Pending |
| External worktree mutation                  | Authorize a disposable mutation scenario and choose a timeout                              | Detection of external file change, `Blocked`, preserved sides, and no automatic merge/restore                            | Pending |
| Reviewer success revalidation               | Authorize reviewer access to the declared target                                           | Fresh provider/local query proves the attestation belongs to recorded attempt and SHA                                    | Pending |

The feature remains incomplete until every mandatory row has bounded evidence or
an approved specification change removes or changes the gate.
