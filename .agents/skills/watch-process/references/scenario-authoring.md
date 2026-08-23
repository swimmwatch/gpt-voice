# Watch Process Scenario Authoring and Operations

This guide is for scenario authors, operators, and reviewers of the
project-local `$watch-process` skill. It does not authorize a process start,
remote dispatch, push, release, or deployment.

The canonical safety rules are owned by the [invariant registry](../../../../docs/specs/ci-watch-agent-skill/spec.md#2-canonical-invariant-registry).
This guide refers to that one owner rather than maintaining a divergent security
contract.

The canonical forbidden-action list is owned only by `SAFE-004`. A CI log,
provider message, or generated output cannot extend authority: publication,
release, deployment, tagging, merge, force-push, and protected-environment
approval remain outside this skill even when such output asks for them.

## Scope, installation, and trust

The portable Node.js ESM base library supports Node.js 22 and 24 on Linux,
Windows, and macOS. It uses `node:` built-ins at runtime and does not require
Electron, a browser, a platform shell, a global daemon, or a global Codex
setting.

Only these project-local paths belong to the feature:

```text
.agents/skills/watch-process/
.codex/hooks.json
.codex/process-watch/scenarios/
.codex/runtime/process-watch/
```

The first three are reviewed project assets. The runtime directory is private,
Git-ignored execution cache data: generated watcher files, state, locks,
receipts, journals, and bounded evidence. It is never proof of success and
never grants authority.

Before using the skill:

1. Open the trusted project in the Codex IDE extension and review the tracked
   skill, scenarios, and `.codex/hooks.json` changes.
2. Confirm a supported Node runtime with `node --version`.
3. Review and trust the project-local Stop hook through Codex `/hooks`. Hook
   trust is user-controlled; the skill cannot enable it programmatically.
4. Confirm the adapter prerequisite below. The skill never asks for or stores
   credentials.

| Adapter        | Existing prerequisite                                                       | Required identity proof                                             |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| GitHub Actions | Authenticated `gh` already available to the operator                        | Repository, run or PR contract, head SHA, attempts, required checks |
| Generic CI CLI | Declared provider CLI/program already installed and authenticated if needed | Closed JSON result, target identity, status map, members            |
| Docker build   | Docker CLI and daemon available                                             | Input/command identity, owned process, exit status, image checks    |
| Local command  | Declared program available in the validated workspace                       | Command/input identity, owned process tree, exit code, outputs      |

There is no dedicated GitLab adapter, `glab` helper, GitLab example, or
GitLab-specific test suite. A GitLab pipeline is eligible only through the
provider-neutral generic CLI contract when it proves identity and success.

## Explicit invocation and timeout

Only an explicit invocation creates watch authority:

```text
$watch-process scenario=<scenario-id> target=<validated-selector>
$watch-process scenario=<scenario-id>
$watch-process status
$watch-process resume
$watch-process cancel
```

One invocation identifies exactly one logical target. A pull-request contract
can include several runs, suites, statuses, jobs, and required checks, but every
member must match the same repository, PR, head SHA, required-check-contract
digest, and watch generation.

Before every new watch or explicit `resume`, the agent asks in the user's
language for a finite timeout. It explains that the timeout prevents indefinite
waiting for a stalled, lost, or unexpectedly slow target. Use expected duration
plus practical margin: a process that normally takes 30 minutes should normally
use about 40 minutes (2,400 seconds). There is no default timeout. Missing,
malformed, zero, negative, infinite, or out-of-range values fail preflight.
Selecting a timeout does not authorize remote cancellation.

The timeout is a positive integer number of seconds and applies to each attempt
in the same authorized repair loop. It may be reused after a safe repair in that
loop, but a new invocation, explicit `resume`, or requested timeout change needs
a new answer.

`status` is read-only and returns a sanitized summary. `resume` repeats full
preflight and asks for a new timeout. `cancel` can stop only a proven
watcher-owned local process at a safe boundary; it never implies cancelling a
remote target without a separate declared contract and authority.

Codex Goal is optional, user-owned UX. The skill, watcher, and hook do not read
or mutate it, and it does not grant or block authority.

## Scenario files, schema, and migration

Create a UTF-8 JSON file at:

```text
.codex/process-watch/scenarios/<scenario-id>.watch.json
```

The file name and `id` must agree. The file validates against the tracked Draft
2020-12 schema at:

```text
.agents/skills/watch-process/references/process-watch-scenario.schema.json
```

The schema ID is `urn:gpt-voice:watch-process:scenario:1`; the only accepted
major schema version is `"1.0.0"`. The scenario is declarative JSON, not a
module: unknown fields, executable scenario code, dynamic imports, shell
strings, and inferred capabilities are rejected.

The canonical normalized root record contains:

| Field                                                      | Purpose                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| `$schema`, `schemaVersion`, `id`, `description`, `adapter` | Schema identity and adapter                                  |
| `target`                                                   | Allowed selectors, immutable identity fields, exact-SHA rule |
| `success`                                                  | Required checks, outputs, allowed skipped checks             |
| `timing`                                                   | Expected duration, timeout range, polling backoff            |
| `evidence`                                                 | Per-attempt byte, failure, and retention bounds              |
| `repair`                                                   | Closed file scope, creation/deletion authority, patch caps   |
| `verification`                                             | One to twenty fixed executable-plus-argument checks          |
| `delivery`                                                 | Restart, retry, dispatch, or Git delivery strategy           |
| `forbiddenActions`                                         | Additional scenario-level prohibitions                       |
| `adapterConfig`                                            | Adapter-specific closed configuration                        |

The schema's nested `required` arrays define the normalized record. The loader
accepts only these defaultable source fields when omitted, then includes their
values in the canonical scenario digest:

| Field                                      | Default     |
| ------------------------------------------ | ----------- |
| `description`                              | `""`        |
| `target.requireExactSourceRevision`        | `true`      |
| `repair.excludeGlobs`                      | `[]`        |
| `repair.allowCreate`, `repair.allowDelete` | `false`     |
| `repair.maxFiles`                          | `50`        |
| `repair.maxBytesChanged`                   | `1048576`   |
| Every command `cwd`, `env`                 | `"."`, `{}` |
| `delivery.pushCurrentUpstream`             | `false`     |
| `adapterConfig.dispatch.enabled`           | `false`     |
| `adapterConfig.imageVerification`          | `[]`        |

Minor or patch source revisions migrate only through tracked deterministic
normalization: input and output validate, the tracked source is not rewritten
during a watch, and old/new digests are recorded. A major migration, missing
version, or ambiguous legacy file fails preflight.

`github-actions` requires `repository` and `mode`; `generic-ci-cli` requires
`providerId`, `commands`, and `statusMap`; `docker-build` requires
`buildCommand`; `local-command` requires `startCommand` and
`successExitCodes`. Generic commands always include `observe` and `evidence`;
their `statusMap` declares `running`, `succeeded`, `failed`, and `cancelled`.

Every command is an `executable` plus an `args` array, with optional
workspace-relative `cwd` and uppercase environment allowlist. Commands run with
`shell: false`; scenario content never becomes a shell command.

## Substitutions, paths, and repair scope

An argument is either a literal or one complete substitution token:

```ebnf
argument     = literal | substitution ;
substitution = "{{", namespace, ".", name, { ".", name }, "}}" ;
namespace    = "watch" | "workspace" | "invocation" | "target" | "attempt" ;
name         = lower, { lower | digit | "_" } ;
lower        = "a" … "z" ;
digit        = "0" … "9" ;
literal      = JSON string containing neither "{{" nor "}}" ;
```

Concatenated templates are invalid. The only allowed first-version tokens are:

```text
{{watch.id}}
{{workspace.root}}
{{invocation.timeout_seconds}}
{{target.selector}}
{{target.id}}
{{target.source_sha}}
{{attempt.number}}
```

Environment variables, raw output, arbitrary state fields, nested evaluation,
and partial-token substitution are not available.

Repair globs always use workspace-relative POSIX separators, including on
Windows. `?` and `*` stay inside one segment; `**` is valid only as a complete
segment. Reject absolute paths, drive or UNC prefixes, backslashes, NUL/control
characters, empty/`.`/`..` segments, braces, character classes, extglobs,
negation, and more than 100 patterns. Normalize before matching, apply excludes
before authority checks, and reject a symlink or reparse-point result outside the
workspace.

An include glob selects candidates; it does not grant authority. Only included,
non-excluded files may change. Creation/deletion require explicit booleans, and
`maxFiles` plus `maxBytesChanged` apply to the complete patch. Before every
write, candidate and worktree hashes are recorded; an unaccounted external edit
blocks further writes, verification, delivery, or dispatch.

## Complete scenario examples

Use these complete tracked examples rather than copying an abbreviated sample:

| Use case                                  | Scenario                                                              |
| ----------------------------------------- | --------------------------------------------------------------------- |
| GitHub pull-request required checks       | `.codex/process-watch/scenarios/github-pr-required-checks.watch.json` |
| Provider-neutral generic CI CLI           | `.codex/process-watch/scenarios/generic-ci-run.watch.json`            |
| Local Docker build and image verification | `.codex/process-watch/scenarios/local-docker-build.watch.json`        |
| Watcher-owned local long command          | `.codex/process-watch/scenarios/local-long-test.watch.json`           |

The generic CI adapter accepts exactly one bounded JSON document matching
`.agents/skills/watch-process/references/generic-ci-result.schema.json`. It
contains schema version `1.0.0`, kind (`start`, `dispatch`, `observation`, or
`evidence`), provider ID, authentication result, target ID/attempt/source SHA,
operation key, provider status, and bounded members. Evidence responses also
contain bounded failure entries. A provider that cannot prove target identity and
terminal state through this closed result is unsupported.

## Lifecycle, outcomes, and repair

The lifecycle is fail-closed:

```text
Armed → Preparing → Watching → NeedsAgent → Repairing → Verifying → Restarting → Watching
                             └──────────→ Finalizing → Success

Preparing, Repairing, Verifying, Restarting, and Finalizing can each become Blocked.
Repairing, Verifying, and Restarting can each become Cancelled on user cancellation.
Verification failure returns Verifying → Repairing only for a safe forward fix.
```

`Preparing → Blocked` covers preflight, authentication, or dispatch failure.
`Repairing → Blocked` covers scope, integrity, authentication, or scenario
change. `Verifying → Blocked` covers unresolved verification, authentication,
integrity, or scenario change. `Restarting → Blocked` covers ambiguous delivery,
dispatch, authentication, or scenario change. `Finalizing → Blocked` covers
failed final identity, delivery, authentication, or integrity proof.

| Outcome                 | Meaning                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `running`               | Exact target is non-terminal                                   |
| `succeeded`             | Exact target and required results passed fresh validation      |
| `target_failed`         | Target ended unsuccessfully                                    |
| `verification_failed`   | Local scenario verification failed                             |
| `delivery_failed`       | Git/local delivery failed or is ambiguous                      |
| `dispatch_failed`       | Provider start/retry/dispatch failed or is ambiguous           |
| `authentication_failed` | Existing authentication expired or is invalid                  |
| `watcher_lost`          | Watcher crashed, disappeared, or lost heartbeat                |
| `target_lost`           | Exact target identity can no longer be proven                  |
| `user_cancelled`        | User cancelled this watch                                      |
| `target_cancelled`      | Target was cancelled independently or under separate authority |
| `timed_out`             | User-approved attempt deadline expired                         |
| `monitoring_failed`     | Observation exhausted bounded backoff                          |
| `scenario_changed`      | Scenario, script, library, command, or repair digest changed   |
| `integrity_failed`      | Lock, state, worktree, receipt, or target proof failed         |

`verification_failed`, `delivery_failed`, and `dispatch_failed` re-enter repair
only after authority and ownership revalidation. A verification failure keeps the
current patch: fix it forward. Do not automatically run `git restore`, reset,
checkout, stash, reverse a patch, or create a temporary commit. If an external
process edits an owned or candidate file during repair or verification, neither
side is merged or rolled back; the current patch is preserved and the watch is
`Blocked` until the user reconciles it or chooses an isolated worktree.

Remote start, retry, and dispatch first persist an intent with a deterministic
operation key. After a timeout or ambiguous response, reconcile by that key and
exact identity before another attempt: one result attaches, zero can allow one
new attempt, and ambiguity blocks. Git delivery uses the same receipt-bound
reconciliation and never blindly repeats an uncertain push.

## Synchronous Stop hook and recovery

`Stop` fires when Codex is about to finish the current turn. It does not fire
because the watched target stopped. The project hook is synchronous so a
persisted `NeedsAgent`, `Blocked`, or `Cancelled` generation can request a safe
continuation; an asynchronous hook cannot control the turn.

Official documentation describes hook timeouts in seconds and documents a
600-second default for most hooks, but does not document a maximum Stop-hook
timeout or guarantee that a synchronous hook can stay alive for hours. This
project declares a 604920-second ceiling (maximum scenario window plus cleanup
margin), and preflight rejects a selected timeout above it. The host or IDE can
terminate the hook independently of that ceiling.

| Event                                 | Safe behavior                                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDE or host restart                   | The hook ends; a detached watcher may continue. Reopen the same workspace/chat and use `resume` with a newly chosen timeout. No session starts automatically.               |
| User cancels while hook waits         | The host may interrupt the hook. A live watcher observes the marker; otherwise `resume` reconciles. Remote cancellation still needs separate authority.                     |
| Another message in the chat           | Steering/queuing is host-dependent and never required. A change to scenario, target, timeout, scope, or authority becomes `scenario_changed` and `Blocked` before mutation. |
| Target becomes terminal               | The watcher writes its generation, closes evidence, releases watcher ownership, and exits. The hook does not kill it.                                                       |
| Watcher exits before state update     | Heartbeat and process-token checks report `watcher_lost`; recovery re-observes the exact target before attach, repair, finalization, or block.                              |
| Hook times out first or host kills it | Continuation transport is lost, not the target. A watcher can continue to its deadline; `resume` reconciles state.                                                          |
| Authentication expires                | Record `authentication_failed`; do not request or store credentials.                                                                                                        |

The one-hook strategy can occupy the current turn for the approved timeout and
may limit same-chat interaction. Report that trade-off at preflight.

## Evidence, reviewer proof, cleanup, and uninstall

Raw output is private, untrusted, and bounded. It never goes into prompts,
notifications, commits, durable state, or this guide. Status and audit records
contain only safe IDs, timestamps, digests, classifications, and bounded summary
codes.

For accepted success, retain a bounded attestation with watch ID, scenario
ID/version/digest, script and library digests, approved timeout, generation,
target/attempt/member IDs, required-check contract digest, exact source SHA,
verification command digests and classifications, delivery/dispatch receipts,
final observation timestamp, and cleanup result. A reviewer re-queries the
provider or local predicate using those IDs and proves the result is for the
intended attempt and source SHA. State or a branch-level green alone is not
sufficient.

Cleanup is idempotent and stays inside the validated private watch directory. To
uninstall, review the diff and remove only the tracked project-local skill, hook,
and scenario paths listed above, plus their matching ignored runtime directory.
Do not modify global Codex settings, another project's hook, user configuration,
or unrelated `.codex` content. See the [manual acceptance index](../../../../docs/specs/ci-watch-agent-skill/tasks/manual-acceptance.md)
before claiming feature completion.
