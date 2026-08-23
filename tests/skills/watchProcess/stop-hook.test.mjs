import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';

import {
  DeadlineAwarePoller,
  MonotonicDeadline,
  ProcessWatchStopHook,
  ProcessWatchStopHookRepository,
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

/** Provides deterministic persisted state without touching an actual watcher process. */
class FakeWatch {
  acknowledgement = null;
  lock = Object.freeze({ generation: 3, kind: 'unknown' });
  onWriteAcknowledgement = null;
  state;

  constructor(state) {
    this.state = state;
    this.lock = Object.freeze({ generation: state.generation, kind: 'unknown' });
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
    this.lock = Object.freeze({ generation: state.generation, kind: 'unknown' });
  }

  async writeAcknowledgement(acknowledgement) {
    this.acknowledgement = Object.freeze({ ...acknowledgement });
    this.onWriteAcknowledgement?.();
  }
}

function fakeRepository(watch) {
  return Object.freeze({ find: async () => Object.freeze({ kind: 'matched', watch }) });
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

    assert.deepEqual(first, { decision: 'block', reason: 'process-watch needs-agent target_failed' });
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

  it('returns neutral output for inactive, stale, malformed, already-continued, and host-cancelled invocations', async () => {
    const watch = new FakeWatch(watchState({ outcome: 'target_failed', phase: 'NeedsAgent' }));
    const hook = createHook(watch);
    const cancelled = new globalThis.AbortController();
    cancelled.abort();

    assert.deepEqual(await hook.handle(hookInput({ sessionId: 'session-002' })), {});
    assert.deepEqual(await hook.handle({ ...hookInput(), hook_event_name: 'PostToolUse' }), {});
    assert.deepEqual(await hook.handle({ ...hookInput(), last_assistant_message: 1 }), {});
    assert.deepEqual(await hook.handle(hookInput({ stopHookActive: true })), {});
    assert.deepEqual(await hook.handle(hookInput(), { signal: cancelled.signal }), {});
    assert.equal(watch.acknowledgement, null);
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

    assert.deepEqual(result, { decision: 'block', reason: 'process-watch needs-agent scenario_changed' });
    assert.equal(watch.acknowledgement.generation, 4);
    assert.equal(watch.acknowledgement.outcome, 'scenario_changed');
  });

  it('reports watcher loss after a crash, a missing lock, or an exhausted hook wait without mutating watch state', async () => {
    const crashed = new FakeWatch(watchState());
    crashed.lock = Object.freeze({ generation: 3, kind: 'not-running' });
    const missing = new FakeWatch(watchState());
    missing.lock = Object.freeze({ kind: 'missing' });
    const expired = new FakeWatch(watchState({ deadlineEpochMilliseconds: 1_000 }));

    assert.deepEqual(await createHook(crashed).handle(hookInput()), {
      decision: 'block',
      reason: 'process-watch needs-agent watcher_lost',
    });
    assert.deepEqual(await createHook(missing).handle(hookInput()), {
      decision: 'block',
      reason: 'process-watch needs-agent watcher_lost',
    });
    assert.deepEqual(await createHook(expired).handle(hookInput()), {
      decision: 'block',
      reason: 'process-watch needs-agent watcher_lost',
    });
    assert.equal(expired.state.phase, 'Watching');
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

      assert.deepEqual(result, { decision: 'block', reason: `process-watch needs-agent ${outcome}` });
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

      const repository = new ProcessWatchStopHookRepository({ workspaceRoot });
      const matched = await repository.find({ cwd: childDirectory, sessionId: SESSION_ID });
      const outside = await repository.find({ cwd: os.tmpdir(), sessionId: SESSION_ID });
      const staleSession = await repository.find({ cwd: childDirectory, sessionId: 'session-002' });

      assert.equal(matched.kind, 'matched');
      assert.equal(matched.state.generation, 3);
      assert.deepEqual(outside, { kind: 'inactive' });
      assert.deepEqual(staleSession, { kind: 'inactive' });
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
