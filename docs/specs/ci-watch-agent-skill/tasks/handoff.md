# `$watch-process` Handoff

## Completed Work

- Tasks 01–11 remain complete. Task 12 automated implementation now includes a
  separate same-chat continuation for every armed attempt result, including
  success.
- The operator stores an atomic private one-shot selection bound to session,
  workspace, and watch. The Stop hook revalidates persisted state, consumes the
  selection before continuation, and stays neutral on unrelated later turns.
- Specification Revision 9, `AUTH-001`, and decision
  `hook.automatic_same_chat_continuation` Revision 3 own the per-attempt
  continuation contract plus the sole version-scoped alpha.1 exception.
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
- Specification Revision 9, Plan Revision 3, operator/author guidance, Task 09,
  Task 12, traceability, and manual acceptance now describe the same per-attempt
  loop and final-message contract. No application code, dependency, global
  setting, commit, or push was changed.
- Scenario schema `1.1.0` adds `authority`; legacy `1.0.0` receives standard
  authority deterministically. All ordinary scenarios remain nonpublishing.
- The unlaunched `local-whisper-alpha-release` scenario is bound to one exact
  repository/version/tag/branch/workflow/environment and immutable Node.js
  bundle. It owns the Task 32/33 alpha.1 sequence under one six-hour deadline,
  rejects external source changes, and blocks after public release state.
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
- Version-scoped source binding, separate class-based Local Whisper release
  orchestrator, operation-reconciliation tests, and protected promotion/public
  verification policy.
- New `process-watch-selection-store.mjs` and
  `process-watch-terminal-waiter.mjs`, plus Stop-hook repository/contracts,
  operator/CLI, runtime exports, and integrity manifest.
- Owned-process adapter context, terminal operation receipts with v1-to-v2
  migration, restart recovery, and orchestrator retry-generation binding.
- Stop-hook, operator, skill-surface, documentation-policy, and hook-policy
  regression tests, plus a fail-closed three-attempt local retry test using
  fresh state-store, receipt-store, adapter, and runner instances.

## Checks

- Node.js 22 and 24 standalone Watch suite: 135 passed, 0 failed on each
  runtime. Node.js 22 ran in the official full image with the workspace mounted
  read-only and process networking disabled.
- Full Node.js 24 Watch regression glob, skill/documentation/Stop-hook policy,
  schema equality, source binding, release orchestration, and remote-operation
  reconciliation tests: passing.
- Full Node.js unit suite: 2,524 tests, 2,522 passed, 2 skipped, 0 failed.
- `npm run test:types` and the test TypeScript configuration: passing.
- `npm run lint`: 0 errors; the repository warning baseline remains nonfatal.
- Prettier, workflow validation, Local Whisper implementation readiness,
  release policy/delivery/lifecycle, task-plan validation, production build,
  post-build renderer verification, and `git diff --check`: passing.
- The immutable alpha-release implementation bundle digest is
  `d5d8929eb7476a2ef0604332ac5923ea439963f9685daa862336f0f45c8be560`.
- No Watch, GitHub operation, release, commit, or push was executed.

## Next Action

1. Keep Task 12 unchecked.
2. Obtain a fresh finite timeout before each separately invoked manual Watch
   scenario.
3. Run the disposable automatic-success scenario and record only safe
   watch/generation/outcome plus the final scenario/attempt/duration report.
4. Continue with the remaining separately authorized manual gates listed in
   [manual-acceptance.md](manual-acceptance.md); the three-attempt repaired local
   continuation loop is complete.
5. Do not launch `local-whisper-alpha-release` until the user separately invokes
   `$watch-process scenario=local-whisper-alpha-release timeout=6h`.

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
  handoff. The release authority begins only with the exact explicit Watch
  invocation above.
