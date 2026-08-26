# 01 Skill Surface And Project-Local Layout

## Outcome

Create the explicit `$watch-process` skill entry point and its tracked, repository-local footprint without registering or launching an incomplete hook.

## Prerequisites

- Approved specification Revision 4 and decisions ledger.
- Read `AGENTS.md`, the agent-assets section of `docs/agent-guides/project-conventions.md`, and the existing `analyze-diagnostics-archive` skill metadata/test precedent.
- Worktree changes already present under this specification belong to the workstream and must be preserved.

## Owned Requirements

`SCOPE-001`, `SAFE-001`, `IFACE-001`, `TIME-001`, `TIME-002`, `IFACE-003`, `OPS-001`, `OPS-002`, `OPS-004`, `SAFE-008`, `DATA-001`, `COMP-003`, `COMP-004`

## In Scope

- `.agents/skills/watch-process/SKILL.md` and `agents/openai.yaml`.
- Tracked directory placeholders needed by later packets: `scripts/lib/` and `references/` only when represented by real tracked files.
- `.codex/process-watch/scenarios/` as the tracked scenario location.
- `.gitignore` rules for `.codex/runtime/process-watch/` and generated `watch-process.mjs` runtime artifacts.
- Policy tests for explicit invocation, timeout questioning, Goal independence, lifecycle commands, and ignored runtime state.

## Out Of Scope

- `.codex/hooks.json` and the Stop-hook script; Task 09 owns both so no broken hook is registered.
- Scenario schema/validation, adapters, watcher generation, repair, commit, push, CI workflow, or external process execution.
- Global Codex configuration, Goals, application runtime, Electron code, releases, and deployment.

## Task Contract

- The skill triggers only after an explicit `$watch-process` request. Mere CI/process discussion, state, hook events, notifications, or Goal state cannot activate it.
- Canonical forms are `scenario=<id> target=<selector>`, `scenario=<id>`, `status`, `resume`, and `cancel`; natural language is normalized into validated fields and never copied into commands.
- Before every new watch/fix invocation and every explicit `resume`, the skill asks in the user's language for a finite timeout, explains why it prevents indefinite waiting, and recommends expected duration plus margin (for example 40 minutes for a typical 30-minute process). There is no default. The selected value is not yet executed in this packet.
- `status` is read-only and sanitized. `cancel` affects only a watcher-owned local process when later proven safe and does not imply remote target cancellation.
- Goal is optional and user-owned. The skill must neither require nor inspect/create/replace/clear/complete it.
- The supported host is the Codex IDE extension on a trusted local project. ChatGPT Desktop and global setting changes are not prerequisites.
- Public names and instructions remain repository-neutral even though this first copy lives in GPT-Voice.

## Contracts And Boundaries

- `.codex/runtime/process-watch/` is ignored execution cache, never authority, proof, tracked output, or repair input.
- The skill states that explicit invocation does not override sandbox, approval, trust, branch protection, or repository policies.
- `agents/openai.yaml` follows the existing metadata schema and does not grant hidden permissions or introduce a second skill name.
- Installation must remain project-local and reversible by removing the tracked skill/config assets; no user-level `~/.codex` write is allowed.

## Expected Files Or Components

- `.agents/skills/watch-process/SKILL.md`
- `.agents/skills/watch-process/agents/openai.yaml`
- `.gitignore`
- A focused TypeScript policy test under `tests/skills/` or `tests/scripts/`

## Acceptance Criteria

- Static policy tests prove exact public name `$watch-process`, explicit-only activation, timeout question wording/absence of default, lifecycle operations, Goal non-authority, and project-local paths.
- Runtime files and generated watchers are ignored while tracked scenarios and hook configuration remain trackable.
- No hook is registered and no process is launched.
- No GitLab-specific skill surface, global settings, dependency, or implementation appears.

## Verification

- `npx prettier --check .agents/skills/watch-process/SKILL.md .agents/skills/watch-process/agents/openai.yaml .gitignore <focused-test>`
- `npm run lint -- --no-warn-ignored <focused-test>` when supported by the repository lint command; otherwise run the repository's narrow ESLint form recorded in the handoff.
- `node --import tsx --test <focused-test>`
- `git check-ignore -v .codex/runtime/process-watch/example/watch-process.mjs`
- `git check-ignore -q .codex/process-watch/scenarios/example.watch.json` must fail, proving scenarios remain trackable.

## Failure And Rollback

Repair documentation or policy assertions forward. Do not discard pre-existing specification files. Because this packet creates only tracked agent assets and ignore rules, rollback is removal of files created by this packet through an explicit patch, never a broad Git reset/restore.

## Manual Gates

None. Do not trust hooks, start a watch, commit, or push in this packet.

## References

- Mandatory: specification sections 1, 2, 4, and 5 only for source anchors.
- Mandatory local precedent: `.agents/skills/analyze-diagnostics-archive/` and `tests/skills/analyzeDiagnosticsArchive.test.ts`.

## Completion And Handoff

After focused verification, mark Task 01 complete in `todo.md`, record changed files/checks, set Task 02 as exact next packet in `handoff.md`, and stop.
