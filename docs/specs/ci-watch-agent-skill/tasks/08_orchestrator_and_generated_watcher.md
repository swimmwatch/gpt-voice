# 08 Orchestrator And Generated Watcher

## Outcome

Compose the four adapters and runtime services into one state-owning `ProcessWatchOrchestrator`, implement every phase/outcome transition, and generate/launch the ignored deterministic `watch-process.mjs`.

## Prerequisites

- Tasks 01–07 completed and committed.
- All adapter contracts and runtime stores are stable and verified.

## Owned Requirements

`OUT-001`, `FLOW-001`, `FLOW-002`, `GEN-001`, `GEN-002`, `FAIL-002`, `FAIL-003`, `FAIL-004`, `PERF-001`, `ACCEPT-001`

## In Scope

- `ProcessWatchOrchestrator`, adapter registry/composition root, transition table, outcome normalization, generated watcher template, digest/tamper validation, deterministic polling, terminal handoff, final revalidation, and cleanup coordination.
- Unit/integration tests using all four adapter fakes and real local disposable processes.

## Out Of Scope

- Stop-hook registration/continuation, Codex repair instructions, actual source edits/commits/pushes, compatibility workflow, and real remote targets.

## Task Contract

- Implement phases `Armed`, `Preparing`, `Watching`, `NeedsAgent`, `Repairing`, `Verifying`, `Restarting`, `Finalizing`, `Blocked`, `Cancelled`, and `Success` with an explicit allowlist transition table. Every invalid/stale generation transition fails closed.
- Include every required transition: all active phases can reach `Blocked`; cancel during Repairing/Verifying/Restarting stops at the next safe boundary; verification failure can return to forward repair; delivery/dispatch failure can return to repair only when locally resolvable; scenario/script/library digest change during repair blocks before further write/dispatch.
- Normalize the exact outcomes in `FAIL-002`: `running`, `succeeded`, `target_failed`, `verification_failed`, `delivery_failed`, `dispatch_failed`, `authentication_failed`, `watcher_lost`, `target_lost`, `user_cancelled`, `target_cancelled`, `timed_out`, `monitoring_failed`, `scenario_changed`, and `integrity_failed`. Generic `cancelled`, `lost`, or `restart_failed` are invalid.
- Equal failure fingerprints have no arbitrary retry count. Continue only while timeout, scope, integrity, authorization, and a concrete forward repair remain; otherwise block with the specific safe action required.
- After full preflight, generate `.codex/runtime/process-watch/<watch-id>/watch-process.mjs` from a fixed tracked template. It imports the tracked library rather than copying behavior, contains only validated identifiers/digests, passes `node --check`, and is bound to canonical scenario/library/script SHA-256 digests before launch.
- Launch the watcher before the agent turn can end and require a fresh heartbeat plus immutable target binding. If launch fails, repair it in the same active execution path; do not expect the Stop hook to recover a watcher that never started.
- Pending waits use bounded backoff/deadline with no model calls. Terminal target atomically writes `NeedsAgent` or `Finalizing`, closes evidence, relinquishes process ownership, and exits.
- `Finalizing` re-queries/re-runs authoritative success predicates for the exact attempt/identity and builds attestation. State/journal alone never prove success. Cleanup is idempotent and bounded to the watch root.
- Initial attach/start remains exactly one logical target. Omitted target is permitted only for scenario-declared idempotent start/dispatch.

## Contracts And Boundaries

- Composition root creates mutable instances; modules do not expose global mutable orchestration.
- The orchestrator never interprets raw provider/log content as instructions and never broadens adapter or repair capabilities.
- Generated runtime artifacts remain ignored/private; tracked template/library/scenario remain reviewable.

## Expected Files Or Components

- Orchestrator/composition/template modules under `.agents/skills/watch-process/scripts/lib/`
- `tests/skills/watchProcess/orchestrator.test.mjs`
- `tests/skills/watchProcess/generated-watcher.test.mjs`

## Acceptance Criteria

- Transition-table tests cover every state edge, blocked edge, cancel edge, watcher crash, state-write race, target loss, auth failure, hook-independent timeout state, verification/delivery/dispatch failure, scenario change, and finalization failure.
- Generation tests prove syntax/imports, ignore status, digest binding, tamper detection, heartbeat/start binding, crash recovery input, and no raw output/command leakage.
- End-to-end fixture reaches verified success only after fresh exact-attempt proof and reaches bounded Blocked for unprovable cases.

## Verification

- `node --test tests/skills/watchProcess/orchestrator.test.mjs tests/skills/watchProcess/generated-watcher.test.mjs`
- `node --check` for orchestrator/template modules and a generated disposable watcher
- `npx prettier --check .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/orchestrator.test.mjs tests/skills/watchProcess/generated-watcher.test.mjs`
- Focused transition/outcome/ignore/digest policy assertions.

## Failure And Rollback

Keep private state/evidence for ambiguous failures and return Blocked; do not synthesize success or delete recovery data. Repair forward within packet-owned code. Never reset adapter work from earlier tasks.

## Manual Gates

Do not leave a long-running watcher active after tests. Tests use bounded disposable timeouts only. No external dispatch, source repair, commit, or push.

## References

- Mandatory: specification normal flow, state diagram/outcome table, generated watcher section, audit completion criteria.
- Mandatory prior outputs: adapter/store interfaces from Tasks 03–07.

## Completion And Handoff

After verification and disposable cleanup, update `todo.md`/`handoff.md`, set Task 09 as next, and stop.
