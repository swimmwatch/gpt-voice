# `$watch-process` Handoff

## Completed Work

- Tasks 01–11 remain complete. Task 12 automated implementation now includes a
  separate same-chat continuation for every armed attempt result, including
  success.
- The operator stores an atomic private one-shot selection bound to session,
  workspace, and watch. The Stop hook revalidates persisted state, consumes the
  selection before continuation, and stays neutral on unrelated later turns.
- Specification Revision 8 and decision
  `hook.automatic_same_chat_continuation` Revision 3 own the per-attempt
  continuation contract.
- Continuation prompts use only the fixed watch ID, generation, and normalized
  outcome grammar. The operator validates the selected acknowledgement before
  returning `report-success`, `repair`, `report-blocked`, or
  `report-cancelled` with sanitized status.
- Every attempt runs in a detached watcher and is awaited by the synchronous
  Stop hook. After repair, `repair-restart` returns after a fresh startup
  heartbeat, re-arms the one-shot selection, and lets the repair response end.
  The next terminal result creates a separate continuation without model
  polling. Blocking `wait` remains a recovery/manual fallback only.
- Local/Docker retry now survives the fresh composition root created by every
  operator command. A bounded terminal receipt proves the prior owned attempt
  exited, while its immutable receipt supplies the original operation
  generation; the new attempt remains bound to the current state generation.
- Repair continuation preserves the generation that created the fresh target
  while later state transitions use `stateGeneration`. This prevents the first
  post-repair observation from rejecting its own attempt identity.
- Non-Git watches now use a stable scoped repair baseline and no longer require
  a clean Git worktree. Unrelated existing changes remain untouched;
  clean-worktree enforcement remains exclusive to `git-delivery`.
- Specification Revision 8, Plan Revision 3, operator/author guidance, Task 09,
  Task 12, traceability, and manual acceptance now describe the same per-attempt
  loop and final-message contract. No application code, dependency, global
  setting, commit, or push was changed.
- The `github-pr-required-checks` scenario is now bound to
  `swimmwatch/gpt-voice`, the six workflows that can contribute PR checks, a
  closed project repair scope, comprehensive local verification, and
  receipt-bound normal upstream repair delivery. It has not been launched.

## Current Packet

- [12 — Documentation and acceptance](12_documentation_and_acceptance.md) is
  still open for manual acceptance only.
- Automated implementation and documentation checks are green on Node.js 22
  and 24.
- The three-attempt local manual scenario proves separate failure/repair,
  failure/repair, and success continuations with model-free background waits.

## Current Changed Files

- Watch-process skill instructions, scenario-author guide, specification,
  decision ledger, Task 09/12 contracts, traceability, plan reference, and
  manual acceptance index.
- Project GitHub PR auto-repair scenario and its fail-closed contract test.
- New `process-watch-selection-store.mjs` and
  `process-watch-terminal-waiter.mjs`, plus Stop-hook repository/contracts,
  operator/CLI, runtime exports, and integrity manifest.
- Owned-process adapter context, terminal operation receipts with v1-to-v2
  migration, restart recovery, and orchestrator retry-generation binding.
- Stop-hook, operator, skill-surface, documentation-policy, and hook-policy
  regression tests, plus a fail-closed three-attempt local retry test using
  fresh state-store, receipt-store, adapter, and runner instances.

## Checks

- Node.js 24 watch-process suite: 123 passed, 0 failed.
- Node.js 22 watch-process suite: 122 passed, 0 failed; the additional project
  GitHub scenario contract also passes on Node.js 22.
- Node.js 22/24 skill, documentation, Stop-hook, and compatibility policy tests:
  passing.
- `npm run test:types`: passing.
- Focused Prettier checks: passing.
- `npm run lint`: 0 errors; 267 pre-existing repository warnings.
- Skill Creator `quick_validate.py`: passing.
- The regression sequence `attempt 1 failed -> attempt 2 failed -> attempt 3
succeeded` passes; retry before a terminal receipt remains blocked.
- Changed JavaScript syntax checks and `git diff --check`: passing.

## Next Action

1. Keep Task 12 unchecked.
2. Obtain a fresh finite timeout before each separately invoked manual Watch
   scenario.
3. Run the disposable automatic-success scenario and record only safe
   watch/generation/outcome plus the final scenario/attempt/duration report.
4. Continue with the remaining separately authorized manual gates listed in
   [manual-acceptance.md](manual-acceptance.md); the three-attempt repaired local
   continuation loop is complete.

## Manual Blockers

- Review and trust the project-local Stop hook through Codex `/hooks` if this
  exact project revision is not already trusted.
- The automatic-success local scenario still requires a separate explicit
  `$watch-process` invocation with a newly selected timeout.
- Hosted compatibility, repository required-check configuration, GitHub,
  generic CI, Docker, restart, auth-expiry, cancellation, mutation, and reviewer
  revalidation rows remain pending as listed in the manual acceptance index.
- No real target, credential, remote dispatch, Docker daemon, repository
  setting, publish, release, deploy, commit, or push is authorized by this
  handoff.
