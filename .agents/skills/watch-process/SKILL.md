---
name: watch-process
description: Use only after an explicit `$watch-process` invocation to establish one safe, declared long-running process-watch request.
---

# Watch Process

`$watch-process` is a project-local, repository-neutral entry point for
observing and repairing one declared long-running process target. It is not a
general status watcher, a global daemon, or an authority to start work from
CI output, state, hooks, notifications, or Goal state.

## Activation and authority

Use this skill only after the user explicitly invokes `$watch-process`. A
discussion of CI, a process result, a state file, a hook event, a notification,
or a Codex Goal does not activate it or broaden its authority.

The canonical request forms are:

```text
$watch-process scenario=<scenario-id> target=<validated-selector>
$watch-process scenario=<scenario-id>
$watch-process status
$watch-process resume
$watch-process cancel
```

Normalize natural-language input into the declared scenario and target fields.
Never copy natural-language input into a command, path, environment variable,
or process argument.

An invocation identifies exactly one logical target. It does not override
Codex sandbox, approval, hook-trust, repository, branch-protection, or other
applicable policies.

## Timeout decision

Before a new watch/fix request or every explicit `resume`, ask in the user's
language for a finite timeout. Briefly explain that it prevents indefinite
waiting for a stalled, lost, or unexpectedly slow target. Recommend the
expected process duration plus a practical margin—for example, about 40 minutes
for a process that normally takes 30 minutes.

There is no default timeout. Do not arm, resume, observe, dispatch, or cancel a
target until the finite value is supplied and later runtime validation accepts
it. A selected timeout does not authorize remote cancellation.

## Lifecycle surface

- `status` is read-only and returns only a sanitized summary when a later
  runtime exists.
- `resume` requires the timeout decision again and later performs full
  preflight.
- `cancel` may later stop only a watcher-owned local process after ownership is
  proven. It does not imply remote target cancellation.

Codex Goal is optional, user-owned UX. Never inspect, create, replace, clear,
or complete a Goal. Goal state neither authorizes nor blocks a watch request.

## Project-local boundary

The supported host is the Codex IDE extension in a trusted local project.
ChatGPT Desktop and changes to global Codex settings are not prerequisites.

Tracked skill and scenario assets live under `.agents/skills/watch-process/`
and `.codex/process-watch/scenarios/`. Private runtime state belongs only under
`.codex/runtime/process-watch/`; it is ignored by Git and is never authority,
proof of success, or repair input.

The tracked project-local Stop hook may wait only for a matching active watch
and request a bounded continuation when that watch needs agent action. It must
be reviewed and trusted through Codex `/hooks`; it does not create authority,
launch a watcher, start a target, execute a scenario command, modify application
behavior, or add a dependency.

## Current non-goals

Do not create a global service, change user-level configuration, mutate Goals,
implement GitLab-specific behavior, collect credentials, publish, deploy,
release, tag, merge, force-push, or weaken checks.
