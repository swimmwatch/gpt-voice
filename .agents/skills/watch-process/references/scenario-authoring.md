# Watch Process Scenario Authoring and Operations

This guide is for scenario authors, operators, and reviewers of the
project-local `$watch-process` skill. It does not authorize a process start,
remote dispatch, push, release, or deployment.

The canonical safety rules are owned by the [invariant registry](../../../../docs/specs/ci-watch-agent-skill/spec.md#2-canonical-invariant-registry).
This guide refers to that one owner rather than maintaining a divergent security
contract.

The canonical forbidden-action and version-scoped exception are owned only by
`SAFE-004` and `AUTH-001`. A CI log, provider message, or generated output
cannot extend authority. Standard scenarios cannot publish, release, tag,
merge, force-push, deploy, or approve a protected environment. The one tracked
`local-whisper-alpha-release` scenario receives only the exact reviewed
`v2.4.0-alpha.1` operations declared by `AUTH-001`; its independent prohibition
list remains mandatory.

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

For the tracked GitHub PR scenario, omitting `target` authorizes observation-
only resolution of the workspace's current branch through `gh pr view`. The
adapter does not enumerate or search PRs by commit: it verifies that the current
branch has an open PR at the committed exact `HEAD`, then attaches to workflow
runs already executing for that SHA. It never dispatches merely because the
selector was omitted.
When GitHub has no configured required-check contract, the adapter watches the
actual allowlisted workflow runs plus external checks/statuses and requires a
stable member set across two observations before success.

Commands remain shell-free on every platform. On Windows, declared `npm`
verification commands are resolved to the active `node.exe` and its colocated
`npm-cli.js`, so scenario authors must not add `cmd.exe` wrappers.

Before every new watch or explicit `resume`, the agent asks in the user's
language for a finite timeout. It explains that the timeout prevents indefinite
waiting for a stalled, lost, or unexpectedly slow target. Use expected duration
plus practical margin: a process that normally takes 30 minutes should normally
use about 40 minutes (2,400 seconds). There is no default timeout. Missing,
malformed, zero, negative, infinite, or out-of-range values fail preflight.
Selecting a timeout does not authorize remote cancellation.

The timeout is a positive integer number of seconds and is one shared deadline
for the complete authorized repair loop. Every repaired attempt receives only
the remaining time. A new invocation, explicit `resume`, or requested timeout
change needs a new answer.

`status` is read-only and returns a sanitized summary. `resume` repeats full
preflight, asks for a new timeout, and is unavailable after success or
cancellation. `cancel` can stop only a proven watcher-owned local process at a
safe boundary. For a remote target, it stops monitoring and leaves the target
running unless a separate cancellation contract and authority exist.

After interpreting the explicit skill request, the agent uses the tracked
operator entrypoint. These are the complete command forms:

```text
node .agents/skills/watch-process/scripts/process-watch.mjs start --scenario <scenario-id> [--target <selector>] --timeout-seconds <seconds>
node .agents/skills/watch-process/scripts/process-watch.mjs status [--watch-id <watch-id>]
node .agents/skills/watch-process/scripts/process-watch.mjs continuation --watch-id <watch-id> --generation <generation> --outcome <outcome>
node .agents/skills/watch-process/scripts/process-watch.mjs wait --watch-id <watch-id>
node .agents/skills/watch-process/scripts/process-watch.mjs resume [--watch-id <watch-id>] --timeout-seconds <seconds>
node .agents/skills/watch-process/scripts/process-watch.mjs cancel [--watch-id <watch-id>]
node .agents/skills/watch-process/scripts/process-watch.mjs repair-begin [--watch-id <watch-id>]
node .agents/skills/watch-process/scripts/process-watch.mjs write-begin [--watch-id <watch-id>] --path <candidate> [--path <candidate> ...]
node .agents/skills/watch-process/scripts/process-watch.mjs write-complete [--watch-id <watch-id>] --path <same-candidate> [--path <same-candidate> ...]
node .agents/skills/watch-process/scripts/process-watch.mjs repair-verify [--watch-id <watch-id>]
node .agents/skills/watch-process/scripts/process-watch.mjs repair-restart [--watch-id <watch-id>]
```

The exact repair order is `repair-begin`, `write-begin`, the one declared agent
write, `write-complete` with the same complete candidate set,
`repair-verify`, then `repair-restart`. The restart launches a detached watcher,
waits only for its startup heartbeat, re-arms the one-shot Stop-hook selection,
and returns so the current model turn can finish. The operator rejects unknown
or duplicate options, invalid
timeouts and paths, ambiguous watch selection, forged or stale continuation,
foreign session/workspace state, and invalid phase changes before work.

One explicit live invocation names the reviewed scenario, target, and timeout.
It authorizes that scenario's declared normal start/retry/dispatch and, only
when `pushCurrentUpstream` is true, one receipt-bound normal upstream delivery
throughout the bounded repair loop. Do not ask again before every retry,
dispatch, or normal push in that same loop. A different target needs a separate
explicit invocation. A `version-scoped-github-release` authority may
additionally grant only the exact operations and binding defined by `AUTH-001`;
it never changes standard scenarios. Remote cancellation, repository
rules/settings, and every non-allowlisted action remain separate gates or
forbidden.

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

The schema ID is `urn:gpt-voice:watch-process:scenario:1`; the current version
is `"1.1.0"`. Source version `"1.0.0"` migrates deterministically by receiving
standard authority. The scenario is declarative JSON, not a module: unknown
fields, executable scenario code, dynamic imports, shell strings, and inferred
capabilities are rejected.

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
| `authority`                                                | Standard authority or one exact reviewed release binding     |
| `forbiddenActions`                                         | Additional scenario-level prohibitions                       |
| `adapterConfig`                                            | Adapter-specific closed configuration                        |

The schema's nested `required` arrays define the normalized record. The loader
accepts only these defaultable source fields when omitted, then includes their
values in the canonical scenario digest:

| Field                                      | Default     |
| ------------------------------------------ | ----------- |
| `description`                              | `""`        |
| `authority`                                | `{ "kind": "standard" }` |
| `target.requireExactSourceRevision`        | `true`      |
| `repair.excludeGlobs`                      | `[]`        |
| `repair.allowCreate`, `repair.allowDelete` | `false`     |
| `repair.maxFiles`                          | `50`        |
| `repair.maxBytesChanged`                   | `1048576`   |
| Every command `cwd`, `env`                 | `"."`, `[]` |
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
workspace-relative `cwd` and an uppercase environment-name allowlist array.
Only already inherited variables with those names may reach the child. Values,
credentials, and arbitrary environment objects are rejected and are never
serialized into the scenario or runtime state. Commands run with `shell: false`;
scenario content never becomes a shell command.

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
| Project GitHub PR checks and auto-repair  | `.codex/process-watch/scenarios/github-pr-required-checks.watch.json` |
| Provider-neutral generic CI CLI           | `.codex/process-watch/scenarios/generic-ci-run.watch.json`            |
| Local Docker build and image verification | `.codex/process-watch/scenarios/local-docker-build.watch.json`        |
| Watcher-owned local long command          | `.codex/process-watch/scenarios/local-long-test.watch.json`           |
| Version-scoped Local Whisper alpha release | `.codex/process-watch/scenarios/local-whisper-alpha-release.watch.json` |

The release example is intentionally the only non-standard authority. Its
repository, version/tag, branches, workflow, environment, entrypoint, bundle
digest, complete operation allowlist, and prohibition list are closed and
tested. It identifies one logical target,
`swimmwatch/gpt-voice@v2.4.0-alpha.1`, with one six-hour deadline. Before public
tag/release state exists, a source change invalidates the prior candidate and
returns to exact-SHA construction. After public state appears, repair of
alpha.1 is forbidden; a new planning iteration must select alpha.2.

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
because the watched target stopped. Although Codex invokes the configured event
for ordinary turns, the project handler waits only for the one-shot selection
armed by an explicit Watch `start` or `resume`, or by a successful authorized
`repair-restart`. It consumes that selection before requesting one safe
continuation for the selected attempt's `Success`, `NeedsAgent`, `Blocked`, or
`Cancelled` result in the same chat; later unrelated turns are neutral.

Every attempt is observed by a detached watcher and awaited by the Stop hook.
Before ending that first turn,
the operator atomically stores a private selection-only pointer containing the
session ID, workspace ID, watch ID, and armed state. The hook uses it to find the
exact watch even if the watcher finished before hook startup, then revalidates
persisted state and atomically consumes the armed state. The pointer is not
authority or success proof. After every successful `repair-restart`, the
operator re-arms the pointer only after the new detached watcher has written a
fresh startup heartbeat.

The continuation prompt is fixed:

```text
process-watch continuation --watch-id <id> --generation <n> --outcome <outcome>
```

It contains no paths, commands, logs, or user text. It continues the original
explicit Watch request rather than activating the skill again. Before diagnosis
or repair, the agent passes those exact fields to the operator `continuation`
command. The operator validates the selection, acknowledgement, session,
workspace, watch, generation, and normalized outcome, then returns only one of
`report-success`, `repair`, `report-blocked`, or `report-cancelled` with safe
status. A forged, stale, malformed, or foreign continuation fails closed.

After `repair-restart`, the agent finishes the current response. The detached
generated watcher owns restart and observation for the next attempt without
model calls. When it writes a terminal state, the re-armed Stop hook emits the
next fixed continuation even though the host marks the previous turn with
`stop_hook_active=true`; the fresh matching one-shot selection makes this safe.
Once consumed, later ordinary Stop events are neutral. The operator's blocking
`wait` command remains a manual/recovery fallback and is not part of the normal
post-repair sequence; when explicitly used, it waits only for the remaining
approved attempt window. There is no arbitrary retry count; the timeout, repair
scope, safety conditions, and useful next repair bound the loop.

An exhausted approved attempt window plus cleanup margin returns `timed_out`
and a blocked action without changing state or cancelling the target.
`watcher_lost` is reserved for failed watcher liveness/ownership proof. A host
that kills the hook earlier prevents continuation delivery and is recovered
through explicit `resume` instead.

Official documentation describes hook timeouts in seconds and documents a
600-second default for most hooks, but does not document a maximum Stop-hook
timeout or guarantee that a synchronous hook can stay alive for hours. This
project declares a 604920-second ceiling (maximum scenario window plus cleanup
margin), and preflight rejects a selected timeout above it. The host or IDE can
terminate the hook independently of that ceiling.

| Event                                 | Safe behavior                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDE or host restart                   | The hook ends; a detached watcher may continue. Reopen the same workspace/chat and use `resume` with a newly chosen timeout. No session starts automatically.                            |
| User cancels while hook waits         | The host may interrupt the hook. A live watcher observes the marker; otherwise `resume` reconciles. Remote cancellation still needs separate authority.                                  |
| Another message in the chat           | Steering/queuing is host-dependent and never required. A change to scenario, target, timeout, scope, or authority becomes `scenario_changed` and `Blocked` before mutation.              |
| Target becomes terminal               | The watcher writes its terminal generation, closes evidence, releases watcher ownership, and exits. The hook selects and acknowledges it once, even if completion preceded hook startup. |
| Watcher exits before state update     | Heartbeat and process-token checks report `watcher_lost`; recovery re-observes the exact target before attach, repair, finalization, or block.                                           |
| Hook times out first or host kills it | Continuation transport is lost, not the target. A watcher can continue to its deadline; `resume` reconciles state.                                                                       |
| Authentication expires                | Record `authentication_failed`; do not request or store credentials.                                                                                                                     |

Each hook wait can occupy the boundary after its corresponding model turn for
the approved timeout and may limit same-chat interaction. The generated watcher
does not consume model tokens while the target runs. Report that trade-off at
preflight.

On success, the final message is concise and in the user's language: scenario,
attempt, elapsed duration, and that everything is ready. On block or cancel, it
states the normalized outcome, a clear safe stopping reason, and the required
user action. Never include raw logs, absolute paths, secrets, or internal
evidence contents.

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
