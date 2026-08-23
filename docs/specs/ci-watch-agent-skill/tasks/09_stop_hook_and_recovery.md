# 09 Stop Hook And Recovery

## Outcome

Implement and register one synchronous project-local Codex `Stop` hook that waits deterministically for the active watcher, resumes the same turn only when agent action is required, and fails safely across timeouts, cancellation, crashes, restart, and delivery races.

## Prerequisites

- Tasks 01–08 completed and committed.
- Read the current official OpenAI Hooks page before implementation and verify that `Stop`, `timeout`, `commandWindows`, hook trust, stdin fields, and block output still match the packet. If the official contract changed materially, stop for specification revision.

## Owned Requirements

`FLOW-003`, `HOOK-001`, `HOOK-002`, `OPS-002`, `OPS-003`, `IFACE-003`, `PERF-001`, `FAIL-002`, `FAIL-003`, `COMP-003`

## In Scope

- `.agents/skills/watch-process/scripts/process-watch-stop-hook.mjs`.
- `.codex/hooks.json` with exactly one synchronous `Stop` handler for this feature.
- Hook input/output validation, workspace/session/generation matching, deadline-aware wait, fixed continuation templates, lifecycle recovery, and focused tests.

## Out Of Scope

- Global/user Codex settings, Goal mutation, asynchronous continuation, new daemon/service, source repair logic, remote actions, compatibility workflow, or automatically trusting the hook.

## Task Contract

- `Stop` means Codex is about to finish the current turn; it is unrelated to stopping the watched target. The hook receives bounded JSON on stdin and validates `session_id`, `cwd`, `turn_id`, `hook_event_name`, `stop_hook_active`, and `last_assistant_message` types before use.
- Register a synchronous command handler (`async` absent/false). `Stop` has no useful matcher, so the hook exits zero with `{}` when there is no exact active workspace/session/watch generation.
- When a matching watcher is in `Watching`, the hook waits with deadline-aware bounded polling and no model calls/busy loop. It emits `{"decision":"block","reason":"<fixed template>"}` only for a persisted fresh generation requiring repair/finalization/blocker handling. Reasons contain safe IDs/outcome codes only, never raw output or arbitrary state text.
- Respect `stop_hook_active` and stored acknowledgement generation so a continuation cannot loop on the same event. Multiple matching hooks are outside this feature's authority; this hook must remain independently safe.
- One hook invocation may wait for the whole user-approved observation window. `.codex/hooks.json` declares `timeout: 604920` seconds: schema maximum 604800 plus a fixed 120-second cleanup margin. Preflight rejects a scenario/user timeout above 604800 or a configured ceiling below selected timeout plus margin.
- Show approved process timeout, effective attempt deadline, and configured hook ceiling as separate values. Official documentation does not guarantee a maximum or hours-long survival; host/IDE may terminate the hook earlier regardless of configured timeout.
- Project-local command uses the official repo-root resolution pattern and a Windows `commandWindows` equivalent to invoke the tracked Node script from subdirectories. These fixed host command strings contain no scenario/user/provider substitution. Every process spawned by the Node hook/library still uses the canonical executable/args with `shell: false` boundary.
- Hook timeout or host kill does not mutate watcher state or cancel target; an independently running watcher continues to its attempt deadline. `resume` asks for a new timeout and fully reconciles state, liveness, identity, receipts, digests, auth, and external changes.
- IDE restart/close kills or disconnects the hook and may kill the watcher. Recovery never self-starts a new chat; explicit `resume` is required and must re-observe the exact target before reattach/repair/finalize/block.
- If user cancel interrupts the hook, the watcher consumes a cancellation marker at a safe boundary when alive; otherwise resume reconciles it. Remote cancellation remains separately authorized. Same-chat message delivery while blocked is not assumed; any delivered change to scenario/target/timeout/scope/authority causes `scenario_changed` and Blocked.
- On terminal target, watcher—not hook—atomically writes terminal handoff, closes evidence, releases process ownership, and exits. If watcher exits before state write, heartbeat/start-token recovery produces `watcher_lost` and re-observes target. Hook never kills the old watcher merely because target became terminal.
- Auth expiry, delivery failure, dispatch failure, verification failure, watcher/target loss, hook timeout, and host termination retain their distinct outcomes/recovery.

## Contracts And Boundaries

- Runtime state is ignored/private and not authority. Hook output is schema-valid, bounded, deterministic, and contains no last-assistant-message echo.
- Hook trust is user-controlled through Codex `/hooks`; implementation must not bypass or alter trust settings.
- Project-local hook registration must coexist with unrelated hooks and return neutral output when inactive.

## Expected Files Or Components

- `.agents/skills/watch-process/scripts/process-watch-stop-hook.mjs`
- `.codex/hooks.json`
- `tests/skills/watchProcess/stop-hook.test.mjs`
- Focused TypeScript hook-policy test under `tests/skills/` or `tests/scripts/`

## Acceptance Criteria

- Tests cover inactive `{}`, active wait, single continuation, `stop_hook_active`, stale generation/session/workspace, timeout, host termination signal, IDE-restart reconciliation, watcher crash, state-write race, cancel, same-chat scenario change, auth expiry, delivery/dispatch/verification outcomes, and sanitized output.
- Configuration has explicit timeout and both POSIX/macOS/Linux and Windows command forms, no `async: true`, and no global path/write.
- Tests prove no raw evidence/prompt/absolute path/credential can enter continuation JSON.

## Verification

- `node --test tests/skills/watchProcess/stop-hook.test.mjs`
- `node --check .agents/skills/watch-process/scripts/process-watch-stop-hook.mjs`
- `node -e "JSON.parse(require('node:fs').readFileSync('.codex/hooks.json','utf8'))"`
- `npx prettier --check .codex/hooks.json .agents/skills/watch-process/scripts/process-watch-stop-hook.mjs tests/skills/watchProcess/stop-hook.test.mjs <focused-policy-test>`
- `node --import tsx --test <focused-policy-test>`

## Failure And Rollback

If the official Codex contract no longer supports required behavior, do not invent a workaround; leave the hook unregistered and request specification revision. On runtime ambiguity, emit no continuation or a fixed Blocked continuation according to fresh state, never success. Rollback of registration is an explicit patch removing only this Stop handler, not global hook files.

## Manual Gates

- User must review and trust the project hook with `/hooks`; implementation cannot do it automatically.
- IDE close/restart and host-forced termination require later manual acceptance. No long process is launched in this packet.

## References

- Mandatory official source: [OpenAI Hooks](https://learn.chatgpt.com/docs/hooks), especially trust, config shape, common input, and `Stop` output.
- Mandatory specification: sections 4.3 and 8.3.

## Completion And Handoff

After tests, update `todo.md`/`handoff.md`, record that hook trust remains a manual gate, set Task 10 as next, and stop.
