import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { access, mkdtemp, mkdir, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';

import {
  DeadlineAwarePoller,
  MonotonicDeadline,
  PROCESS_WATCH_SELECTION_FILE_NAME,
  PROCESS_WATCH_SELECTION_STORAGE_ID,
  ProcessWatchSelectionStore,
  ProcessWatchStopHook,
  ProcessWatchStopHookRepository,
  ProcessWatchTerminalWaiter,
  assertStopHookBudget,
  stopHookTimingSummary,
  WatchRuntimeStorage,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';
import { runProcessWatchStopHook } from '../../../.agents/skills/watch-process/scripts/process-watch-stop-hook.mjs';

const SESSION_ID = 'session-001';
const WATCH_ID = 'watch-001';
const WORKSPACE_ID = 'workspace-001';
const DIGESTS = Object.freeze({
  library: 'a'.repeat(64),
  scenario: 'b'.repeat(64),
  script: 'c'.repeat(64),
  target: 'd'.repeat(64),
});
const START_TOKEN = 'e'.repeat(32);

function continuationReason({ generation = 3, outcome, watchId = WATCH_ID }) {
  return `process-watch continuation --watch-id ${watchId} --generation ${generation} --outcome ${outcome}`;
}

function hookInput({
  cwd = '/workspace',
  lastAssistantMessage = null,
  sessionId = SESSION_ID,
  stopHookActive = false,
  turnId = 'turn-001',
} = {}) {
  return {
    cwd,
    hook_event_name: 'Stop',
    last_assistant_message: lastAssistantMessage,
    session_id: sessionId,
    stop_hook_active: stopHookActive,
    turn_id: turnId,
  };
}

function watchState({
  blocker = null,
  deadlineEpochMilliseconds = 5_000,
  generation = 3,
  outcome = 'running',
  phase = 'Watching',
  sessionId = SESSION_ID,
  watchId = WATCH_ID,
  workspaceId = WORKSPACE_ID,
} = {}) {
  return Object.freeze({
    blocker,
    deadlineEpochMilliseconds,
    failureFingerprints: [],
    generation,
    heartbeat: Object.freeze({ atEpochMilliseconds: 1_000, startToken: START_TOKEN }),
    libraryDigest: DIGESTS.library,
    outcome,
    phase,
    receiptIds: [],
    scenarioDigest: DIGESTS.scenario,
    scenarioId: 'scenario-001',
    schemaVersion: 1,
    scriptDigest: DIGESTS.script,
    sessionId,
    target: Object.freeze({
      attempt: 1,
      identityDigest: DIGESTS.target,
      sourceSha: 'f'.repeat(40),
      targetId: 'fixture-target',
    }),
    timeoutSeconds: 30,
    watchId,
    workspaceId,
  });
}

const TERMINAL_PHASES = new Set(['Blocked', 'Cancelled', 'NeedsAgent', 'Success']);

function lockForState(state) {
  return Object.freeze({
    ...(TERMINAL_PHASES.has(state.phase) ? {} : { generation: state.generation }),
    kind: TERMINAL_PHASES.has(state.phase) ? 'missing' : 'unknown',
  });
}

/** Provides deterministic persisted state without touching an actual watcher process. */
class FakeWatch {
  acknowledgement = null;
  lock = Object.freeze({ generation: 3, kind: 'unknown' });
  onWriteAcknowledgement = null;
  state;

  constructor(state) {
    this.state = state;
    this.lock = lockForState(state);
  }

  async inspectWatcher() {
    return this.lock;
  }

  async readAcknowledgement() {
    return this.acknowledgement;
  }

  async readState() {
    return this.state;
  }

  setState(state) {
    this.state = state;
    this.lock = lockForState(state);
  }

  async writeAcknowledgement(acknowledgement) {
    this.acknowledgement = Object.freeze({ ...acknowledgement });
    this.onWriteAcknowledgement?.();
  }
}

function fakeRepository(watch) {
  let armed = true;
  return Object.freeze({
    async consume() {
      if (!armed) return false;
      armed = false;
      return true;
    },
    async find() {
      return armed ? Object.freeze({ kind: 'matched', watch }) : Object.freeze({ kind: 'inactive' });
    },
  });
}

function createHook(watch, { afterSleep, now = 1_000 } = {}) {
  let currentTime = now;
  const poller = new DeadlineAwarePoller({
    sleep: async (milliseconds) => {
      currentTime += milliseconds;
      await afterSleep?.();
    },
  });
  return new ProcessWatchStopHook({
    clock: () => currentTime,
    deadlineFactory: ({ timeoutMilliseconds }) =>
      new MonotonicDeadline({ clock: () => currentTime, timeoutMilliseconds }),
    poller,
    repository: fakeRepository(watch),
  });
}

async function withWorkspace(action) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-stop-hook-'));
  try {
    await action(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

describe('process-watch Stop hook', () => {
  it('keeps the selected duration, attempt deadline, and configured hook ceiling distinct', () => {
    const state = watchState({ deadlineEpochMilliseconds: 9_000 });

    assert.deepEqual(stopHookTimingSummary(state), {
      approvedTimeoutSeconds: 30,
      effectiveAttemptDeadlineEpochMilliseconds: 9_000,
      hookCeilingSeconds: 604_920,
    });
    assert.deepEqual(assertStopHookBudget({ timeoutSeconds: 604_800 }), {
      approvedTimeoutSeconds: 604_800,
      cleanupMarginSeconds: 120,
      hookCeilingSeconds: 604_920,
    });
    assert.throws(
      () => assertStopHookBudget({ hookTimeoutSeconds: 604_919, timeoutSeconds: 604_800 }),
      /stop-hook-timeout-ceiling-too-low/u,
    );
    assert.throws(() => assertStopHookBudget({ timeoutSeconds: 604_801 }), /invalid-stop-hook-timeout/u);
  });

  it('waits with bounded polling and continues exactly once after a terminal handoff', async () => {
    const watch = new FakeWatch(watchState());
    const hook = createHook(watch, {
      afterSleep: () => watch.setState(watchState({ generation: 4, outcome: 'target_failed', phase: 'NeedsAgent' })),
    });

    const first = await hook.handle(hookInput());
    const second = await hook.handle(hookInput({ turnId: 'turn-002' }));

    assert.deepEqual(first, {
      decision: 'block',
      reason: continuationReason({ generation: 4, outcome: 'target_failed' }),
    });
    assert.deepEqual(second, {});
    assert.deepEqual(watch.acknowledgement, {
      generation: 4,
      outcome: 'target_failed',
      schemaVersion: 1,
      sessionId: SESSION_ID,
      turnId: 'turn-001',
      watchId: WATCH_ID,
    });
  });

  it('continues exactly once when a running watch succeeds', async () => {
    const watch = new FakeWatch(watchState());
    const hook = createHook(watch, {
      afterSleep: () => watch.setState(watchState({ generation: 4, outcome: 'succeeded', phase: 'Success' })),
    });

    const first = await hook.handle(hookInput());
    const second = await hook.handle(hookInput({ turnId: 'turn-002' }));

    assert.deepEqual(first, {
      decision: 'block',
      reason: continuationReason({ generation: 4, outcome: 'succeeded' }),
    });
    assert.deepEqual(second, {});
  });

  it('waits for a terminal watcher to release its lock before consuming the selection', async () => {
    const watch = new FakeWatch(watchState());
    let observation = 0;
    const hook = createHook(watch, {
      afterSleep: () => {
        observation += 1;
        if (observation === 1) {
          watch.state = watchState({ generation: 4, outcome: 'target_failed', phase: 'NeedsAgent' });
          watch.lock = Object.freeze({ generation: 4, kind: 'unknown' });
          return;
        }
        watch.lock = Object.freeze({ kind: 'missing' });
      },
    });

    assert.deepEqual(await hook.handle(hookInput()), {
      decision: 'block',
      reason: continuationReason({ generation: 4, outcome: 'target_failed' }),
    });
    assert.equal(observation, 2);
  });

  it('ignores later terminal generations after consuming the explicitly armed selection', async () => {
    const watch = new FakeWatch(watchState({ outcome: 'target_failed', phase: 'NeedsAgent' }));
    const hook = createHook(watch);

    assert.deepEqual(await hook.handle(hookInput()), {
      decision: 'block',
      reason: continuationReason({ outcome: 'target_failed' }),
    });
    watch.setState(
      watchState({
        blocker: 'integrity-failed',
        generation: 4,
        outcome: 'integrity_failed',
        phase: 'Blocked',
      }),
    );

    assert.deepEqual(await hook.handle(hookInput({ turnId: 'turn-002' })), {});
    assert.equal(watch.acknowledgement.generation, 3);
    assert.equal(watch.acknowledgement.outcome, 'target_failed');
  });

  it('continues exactly once when the watch succeeded before the hook started', async () => {
    const watch = new FakeWatch(watchState({ outcome: 'succeeded', phase: 'Success' }));
    const hook = createHook(watch);

    assert.deepEqual(await hook.handle(hookInput()), {
      decision: 'block',
      reason: continuationReason({ outcome: 'succeeded' }),
    });
    assert.deepEqual(await hook.handle(hookInput({ turnId: 'turn-002' })), {});
  });

  it('returns neutral output for inactive, stale, malformed, and host-cancelled invocations', async () => {
    const watch = new FakeWatch(watchState({ outcome: 'target_failed', phase: 'NeedsAgent' }));
    const hook = createHook(watch);
    const cancelled = new globalThis.AbortController();
    cancelled.abort();

    assert.deepEqual(await hook.handle(hookInput({ sessionId: 'session-002' })), {});
    assert.deepEqual(await hook.handle({ ...hookInput(), hook_event_name: 'PostToolUse' }), {});
    assert.deepEqual(await hook.handle({ ...hookInput(), last_assistant_message: 1 }), {});
    assert.deepEqual(await hook.handle(hookInput(), { signal: cancelled.signal }), {});
    assert.equal(watch.acknowledgement, null);
  });

  it('reports a validated matched-hook failure instead of silently losing the Watch', async () => {
    const watch = new FakeWatch(watchState());
    const hook = new ProcessWatchStopHook({
      repository: fakeRepository(watch),
      waiter: {
        async wait() {
          throw new Error('simulated-hook-failure');
        },
      },
    });

    assert.deepEqual(await hook.handle(hookInput()), {
      decision: 'block',
      reason: continuationReason({ outcome: 'monitoring_failed' }),
    });
    assert.equal(watch.acknowledgement.outcome, 'monitoring_failed');
  });

  it('allows one fresh re-armed Watch continuation when the previous turn came from the Stop hook', async () => {
    const watch = new FakeWatch(watchState({ outcome: 'target_failed', phase: 'NeedsAgent' }));
    const hook = createHook(watch);

    assert.deepEqual(await hook.handle(hookInput({ stopHookActive: true })), {
      decision: 'block',
      reason: continuationReason({ outcome: 'target_failed' }),
    });
    assert.deepEqual(await hook.handle(hookInput({ stopHookActive: true, turnId: 'turn-002' })), {});
  });

  it('reconciles a state-write race before emitting a continuation', async () => {
    const watch = new FakeWatch(watchState({ outcome: 'target_failed', phase: 'NeedsAgent' }));
    let raced = false;
    watch.onWriteAcknowledgement = () => {
      if (!raced) {
        raced = true;
        watch.setState(
          watchState({
            blocker: 'scenario-changed',
            generation: 4,
            outcome: 'scenario_changed',
            phase: 'Blocked',
          }),
        );
      }
    };

    const result = await createHook(watch).handle(hookInput());

    assert.deepEqual(result, {
      decision: 'block',
      reason: continuationReason({ generation: 4, outcome: 'scenario_changed' }),
    });
    assert.equal(watch.acknowledgement.generation, 4);
    assert.equal(watch.acknowledgement.outcome, 'scenario_changed');
  });

  it('keeps watcher loss distinct from an exhausted approved wait without mutating watch state', async () => {
    const crashed = new FakeWatch(watchState());
    crashed.lock = Object.freeze({ generation: 3, kind: 'not-running' });
    const missing = new FakeWatch(watchState());
    missing.lock = Object.freeze({ kind: 'missing' });
    const expired = new FakeWatch(watchState({ deadlineEpochMilliseconds: 1_000 }));

    assert.deepEqual(await createHook(crashed).handle(hookInput()), {
      decision: 'block',
      reason: continuationReason({ outcome: 'watcher_lost' }),
    });
    assert.deepEqual(await createHook(missing).handle(hookInput()), {
      decision: 'block',
      reason: continuationReason({ outcome: 'watcher_lost' }),
    });
    assert.deepEqual(await createHook(expired).handle(hookInput()), {
      decision: 'block',
      reason: continuationReason({ outcome: 'timed_out' }),
    });
    assert.equal(expired.state.phase, 'Watching');
  });

  it('aborts a shared terminal wait without converting cancellation into target status', async () => {
    const controller = new globalThis.AbortController();
    controller.abort();
    const waiter = new ProcessWatchTerminalWaiter({ clock: () => 1_000 });

    await assert.rejects(
      () => waiter.wait({ sessionId: SESSION_ID, signal: controller.signal, watch: new FakeWatch(watchState()) }),
      { code: 'poll-aborted' },
    );
  });

  it('preserves every terminal repair outcome as a fixed, sanitized continuation', async () => {
    const outcomes = [
      'verification_failed',
      'delivery_failed',
      'dispatch_failed',
      'authentication_failed',
      'watcher_lost',
      'target_lost',
      'user_cancelled',
      'target_cancelled',
      'scenario_changed',
    ];

    for (const outcome of outcomes) {
      const phase = ['user_cancelled', 'target_cancelled'].includes(outcome) ? 'Cancelled' : 'Blocked';
      const watch = new FakeWatch(
        watchState({
          blocker: phase === 'Blocked' ? 'watcher-lost' : null,
          outcome,
          phase,
        }),
      );
      const result = await createHook(watch).handle(
        hookInput({ lastAssistantMessage: '/private/path and untrusted <instruction>' }),
      );

      assert.deepEqual(result, {
        decision: 'block',
        reason: continuationReason({ outcome }),
      });
      assert.doesNotMatch(JSON.stringify(result), /private|instruction|workspace|fixture-target/u);
    }
  });

  it('matches the exact project-local workspace and session before reading a persisted generation', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const childDirectory = path.join(workspaceRoot, 'child');
      await mkdir(childDirectory);
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      await storage.initialize();
      await storage.writeJson('state.json', watchState({ outcome: 'target_failed', phase: 'NeedsAgent' }));
      await new ProcessWatchSelectionStore({ workspaceRoot }).write({
        sessionId: SESSION_ID,
        watchId: WATCH_ID,
        workspaceId: WORKSPACE_ID,
      });

      const repository = new ProcessWatchStopHookRepository({ workspaceRoot });
      const matched = await repository.find({ cwd: childDirectory, sessionId: SESSION_ID });
      const outside = await repository.find({ cwd: os.tmpdir(), sessionId: SESSION_ID });
      const staleSession = await repository.find({ cwd: childDirectory, sessionId: 'session-002' });

      assert.equal(matched.kind, 'matched');
      assert.equal(matched.state.generation, 3);
      assert.equal(await repository.consume(matched.state), true);
      assert.deepEqual(await repository.find({ cwd: childDirectory, sessionId: SESSION_ID }), {
        kind: 'inactive',
      });

      await new ProcessWatchSelectionStore({ workspaceRoot }).write({
        sessionId: SESSION_ID,
        watchId: WATCH_ID,
        workspaceId: 'workspace-foreign-001',
      });
      const foreignWorkspace = await repository.find({ cwd: childDirectory, sessionId: SESSION_ID });

      assert.deepEqual(outside, { kind: 'inactive' });
      assert.deepEqual(staleSession, { kind: 'inactive' });
      assert.deepEqual(foreignWorkspace, { kind: 'inactive' });
    });
  });

  it('does not create private runtime storage for an inactive workspace', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const repository = new ProcessWatchStopHookRepository({ workspaceRoot });

      assert.deepEqual(await repository.find({ cwd: workspaceRoot, sessionId: SESSION_ID }), { kind: 'inactive' });
      await assert.rejects(() => access(path.join(workspaceRoot, '.codex', 'runtime', 'process-watch')), {
        code: 'ENOENT',
      });
    });
  });

  it('migrates a legacy selection as consumed so an old Watch cannot affect ordinary turns', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const storage = new WatchRuntimeStorage({
        watchId: PROCESS_WATCH_SELECTION_STORAGE_ID,
        workspaceRoot,
      });
      await storage.writeJson(PROCESS_WATCH_SELECTION_FILE_NAME, {
        schemaVersion: 1,
        sessionId: SESSION_ID,
        watchId: WATCH_ID,
        workspaceId: WORKSPACE_ID,
      });
      const selection = await new ProcessWatchSelectionStore({ workspaceRoot }).read();

      assert.deepEqual(selection, {
        armed: false,
        schemaVersion: 2,
        sessionId: SESSION_ID,
        watchId: WATCH_ID,
        workspaceId: WORKSPACE_ID,
      });
      assert.deepEqual(
        await new ProcessWatchStopHookRepository({ workspaceRoot }).find({
          cwd: workspaceRoot,
          sessionId: SESSION_ID,
        }),
        { kind: 'inactive' },
      );
    });
  });

  it('keeps the executable hook entrypoint bounded and neutral without an active watch', async () => {
    const output = [];
    const result = await runProcessWatchStopHook({
      arguments_: [],
      input: Readable.from([JSON.stringify(hookInput({ cwd: process.cwd() }))]),
      output: { write: (value) => output.push(value) },
    });

    assert.deepEqual(result, {});
    assert.deepEqual(output, ['{}\n']);
  });
});
