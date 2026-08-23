# 12 Documentation And Acceptance

## Outcome

Finish operator and scenario-author documentation, audit the complete implementation against every specification requirement, run all safe automated checks, and collect attempt-bound manual evidence for real long-running scenarios before declaring the feature complete.

## Prerequisites

- Tasks 01–11 completed and committed.
- Automated documentation, operator completion, traceability, and local checks
  proceed without a hosted compatibility run. The first real compatibility run
  and required-check repository setting remain manual acceptance gates until
  separately authorized and verified.

## Owned Requirements

`SCOPE-003`, `COMP-003`, `COMP-004`, `OPS-003`, `OUT-001`, `ACCEPT-001`

## In Scope

- Complete `scenario-authoring.md` and skill/operator guidance for installation/trust, prerequisites, explicit invocation, timeout, one logical target, exact runtime commands, status/resume/cancel, Goal independence, privacy, recovery, repair/delivery boundaries, audit proof, cleanup, and uninstall.
- Explicit support table for GitHub Actions, generic CI CLI, Docker, and local command, plus explicit exclusion of dedicated GitLab support.
- Automated traceability/coverage audit and the full dependency-free suite, root policy tests, formatting, lint, and type checks relevant to changed files.
- Manual acceptance checklist/evidence index using bounded sanitized IDs/digests only.

## Out Of Scope

- New adapters, application behavior, global daemon/service, new chat/session
  startup, dependencies, C++, packaging, release, publish, deploy, force-push,
  merge, tags, or weakening any check.

## Task Contract

- Documentation explains that the skill is project-local, Node 22/24, Linux/Windows/macOS, built-in-only by default, explicit-only, one logical target per invocation, and uses one synchronous Stop hook that can be killed by host/IDE regardless of configured timeout.
- Document that a valid fixed Stop-hook continuation resumes the original
  explicit Watch authority in the same chat and is not a new activation. The
  hook consumes a one-shot selection and continues once for each armed terminal
  attempt, including success. Later ordinary turns are neutral. A successful
  `repair-restart` re-arms only after watcher startup proof; with
  `stop_hook_active=true`, no matching fresh arm means neutral output.
- Document the multi-turn loop: every attempt runs in a detached watcher and is
  awaited by the synchronous Stop hook. Each repair response ends after
  `repair-restart` proves startup and re-arms the next attempt. No model calls
  occur while targets run; `wait` remains only a manual/recovery fallback.
- Document the exact continuation grammar and operator validation, the four
  normalized actions, stale/forged/foreign rejection, and final-message rules.
  Success reports scenario, attempt, duration, and that everything is ready in
  the user's language. Block/cancel reports normalized outcome, safe reason, and
  required user action without raw logs, paths, secrets, or evidence contents.
- Every live invocation/resume asks the user in their language for a finite timeout, explains why, and recommends expected process duration plus margin. Manual examples use approximately 40 minutes for a normal 30-minute process. Do not reuse a prior timeout for a new invocation/resume without asking.
- Document exact scenario paths/schema/defaults/migration/substitution/glob/repair-scope rules; four complete examples; generic CI result schema; prerequisites (`gh`, Docker, declared CLI/program); environment-name allowlists; and no credential value collection/storage.
- Document state diagram/outcomes, watcher/hook ownership, IDE restart, hook timeout/host kill, watcher crash/state race, authentication expiry, cancellation, same-chat limitations, scenario change during repair, verification/delivery/dispatch failures, forward-only patch preservation, external edits, and explicit resume recovery.
- Document canonical forbidden actions once by reference and explain that real publish/release/deploy remains outside this skill even when a CI log asks for it.
- Stakeholder status/audit examples show what watcher did using watch/generation, target/attempt/member IDs, scenario/script/library digests, receipts, verification classifications, source SHA, and timestamps without raw logs/secrets. Reviewer steps re-query the provider/local predicate and prove attestation belongs to the intended attempt/SHA.
- Run a requirement traceability audit proving all 71 IDs have implementation and tests/docs as applicable. Duplicate invariant text must reference the canonical owner rather than diverge.
- Manual acceptance uses a separate explicit scenario invocation and newly asked
  timeout for each logical target. Once invoked, the reviewed scenario's
  declared normal start/retry/dispatch and optional normal upstream push remain
  authorized through that bounded repair loop without per-attempt prompts. It
  covers: safe GitHub run; composite PR required-check contract; disposable
  generic CI target if available; broken-then-repaired Docker build;
  broken-then-repaired local command; a 30-minute-class wait with about
  40-minute timeout; IDE restart/recovery; auth expiry; user cancel during
  Repairing/Verifying/Restarting; external worktree mutation; and reviewer
  revalidation of final attestation.
- Each manual success records exact watch ID, scenario/script/library digests, target/attempt/member identities, exact source SHA when source-backed, timeout/deadline, operation/verification receipts, final provider/local query, and cleanup. Raw evidence remains private/bounded and is not committed.

## Contracts And Boundaries

- Incremental implementation does not itself authorize a live scenario. Obtain
  one explicit `$watch-process` invocation for each manual logical target and
  ask the required timeout for every new watch/resume. That invocation covers
  the scenario-declared normal delivery/dispatch loop; do not ask again before
  every declared push or dispatch. Repository/ruleset settings, remote target
  cancellation, release, publish, deploy, and other canonically forbidden
  actions remain separate gates or forbidden.
- If a disposable generic CI target is unavailable, record that specific gate as pending; do not substitute GitLab-specific implementation.
- Success cannot be inferred from local state, a branch-level green, a different SHA, or a workflow run unrelated to the recorded attempt.

## Expected Files Or Components

- `.agents/skills/watch-process/scripts/process-watch.mjs`
- `.agents/skills/watch-process/scripts/lib/process-watch-operator.mjs`
- `.agents/skills/watch-process/scripts/lib/process-watch-selection-store.mjs`
- `.agents/skills/watch-process/scripts/lib/process-watch-terminal-waiter.mjs`
- `.agents/skills/watch-process/references/scenario-authoring.md`
- Final updates to `.agents/skills/watch-process/SKILL.md` and focused policy tests
- Standalone operator, resume, cancellation, and abandoned-lock regression tests
- A bounded manual acceptance checklist/evidence index under the specification tasks directory, containing no raw/private output
- `todo.md` and `handoff.md`

## Acceptance Criteria

- All automated checks relevant to watch-process pass, including standalone suite, skill/workflow policy tests, formatting, lint, and TypeScript contracts.
- Unit coverage proves success before/after hook wait, terminal action mapping,
  deduplication, stale/forged/foreign continuation rejection, re-armed
  continuation under `stop_hook_active`, neutral unrelated turns, background
  repair restart, and model-free fallback `wait` handling.
- Manual local acceptance proves both `success → same-chat final report` and
  `failure continuation → repair → response ends → background attempt → failure
  continuation → repair → response ends → background attempt → success
  continuation` without model polling.
- Traceability audit maps all 71 active requirements with no orphan implementation/test and no dedicated GitLab artifact, and proves the executable operator plus production repair-controller wiring.
- Manual gates are either completed with exact attempt-bound evidence or clearly listed as pending blockers; feature is not declared complete while a mandatory gate is pending.
- Installation/uninstall affects only project-local tracked/ignored paths and preserves user/global settings and unrelated hooks.

## Verification

- `node --test tests/skills/watchProcess/suite.test.mjs`
- `node --import tsx --test <all-watch-process-TypeScript-policy-tests>`
- `npm run format:check`
- `npm run lint`
- `npm run test:types`
- `npm run test:unit:ci` only if focused/root policy checks cannot prove integration; record elapsed/count without rerunning unnecessarily.
- Verify the exact compatibility workflow run/commit and required aggregate setting when separately authorized.

## Failure And Rollback

Repair implementation defects in their owning module with regression coverage and rerun the smallest affected check before the full acceptance set. Preserve forward-only user/agent patches and private evidence. Uninstall/rollback removes only project-local skill/hook/scenario/runtime assets after explicit review and never changes global Codex settings or unrelated hooks.

## Manual Gates

- Trust project hook via `/hooks`.
- Authorize and run each real GitHub/generic/Docker/local scenario with a freshly selected timeout.
- Explicitly invoke each live scenario once; its declared normal push/dispatch
  remains authorized for that bounded loop without repeated approval prompts.
- Add and verify the `Watch Process Compatibility` required check in repository rulesets.
- Do not publish, release, deploy, merge, force-push, tag, or approve protected environments.

## References

- Mandatory: complete approved specification Revision 8 for the final traceability audit only.
- Mandatory official sources: [OpenAI Hooks](https://learn.chatgpt.com/docs/hooks) and [Long-running work](https://learn.chatgpt.com/docs/long-running-work).
- Mandatory: all completed packet handoffs and generated automated evidence summaries.

## Completion And Handoff

Mark Task 12 and the workstream complete only after every mandatory automated/manual gate is satisfied. Otherwise leave Task 12 unchecked and list the exact next manual or repair action in `handoff.md`. Stop without publishing or deployment.
