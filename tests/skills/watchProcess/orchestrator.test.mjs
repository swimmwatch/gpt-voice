import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';
import { setTimeout } from 'node:timers';

import {
  AtomicStateStore,
  AuditJournal,
  DeadlineAwarePoller,
  ManagedProcessRunner,
  OperationReceiptStore,
  ProcessAdapter,
  ProcessWatchAdapterRegistry,
  ProcessWatchCompositionRoot,
  ProcessWatchOrchestrator,
  ProcessWatchTransitionTable,
  REPAIR_CANCELLATION_FILE_NAME,
  REPAIR_CONTROL_SCHEMA_VERSION,
  RuntimeCoreError,
  SuccessAttestation,
  WATCH_TRANSITION_PHASES,
  WatchRuntimeStorage,
  normalizeWatchScenario,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';
import { LocalCommandProcessAdapter } from '../../../.agents/skills/watch-process/scripts/lib/adapters/local-command-process-adapter.mjs';

const WATCH_ID = 'watch-001';
const SESSION_ID = 'session-001';
const WORKSPACE_ID = 'workspace-001';
const START_TOKEN = 'a'.repeat(32);
const DIGESTS = Object.freeze({
  input: '1'.repeat(64),
  library: '2'.repeat(64),
  scenario: '3'.repeat(64),
  script: '4'.repeat(64),
  target: '5'.repeat(64),
});

function scenario({ adapter = 'fixture-adapter', requireSource = false } = {}) {
  return {
    adapter,
    id: 'watch-scenario-001',
    schemaVersion: '1.0.0',
    target: { requireExactSourceRevision: requireSource, selectorKinds: ['start'] },
    timing: {
      maxTimeoutSeconds: 5,
      minTimeoutSeconds: 1,
      poll: { initialSeconds: 1, maxSeconds: 1, multiplier: 1 },
    },
  };
}

function target({ sourceSha = null } = {}) {
  return {
    attempt: 1,
    identityDigest: DIGESTS.target,
    sourceSha,
    targetId: 'target-001',
  };
}

function invocation({
  deadlineEpochMilliseconds = 100_000,
  sourceSha = null,
  target: targetValue = null,
  timeoutSeconds = 1,
} = {}) {
  return {
    deadlineEpochMilliseconds,
    inputDigest: DIGESTS.input,
    sourceSha,
    target: targetValue,
    targetSelector: 'start',
    timeoutSeconds,
  };
}

function state({
  blocker = null,
  generation = 0,
  outcome = null,
  phase = 'Armed',
  scenarioDigest = DIGESTS.scenario,
  startToken = START_TOKEN,
  target: targetValue = null,
  timeoutSeconds = 1,
  deadlineEpochMilliseconds = 100_000,
} = {}) {
  return {
    blocker,
    deadlineEpochMilliseconds,
    failureFingerprints: [],
    generation,
    heartbeat: { atEpochMilliseconds: 10 + generation, startToken },
    libraryDigest: DIGESTS.library,
    outcome,
    phase,
    receiptIds: [],
    scenarioDigest,
    scenarioId: 'watch-scenario-001',
    schemaVersion: 1,
    scriptDigest: DIGESTS.script,
    sessionId: SESSION_ID,
    target: targetValue,
    timeoutSeconds,
    watchId: WATCH_ID,
    workspaceId: WORKSPACE_ID,
  };
}

/** Deterministic adapter double that never invokes a provider or child process. */
class ScriptedAdapter extends ProcessAdapter {
  #observations;
  #preflight;

  calls = [];

  constructor({ observations = [{ status: 'succeeded', target: target() }], preflight } = {}) {
    super();
    this.#observations = [...observations];
    this.#preflight = preflight;
  }

  async preflight(context) {
    this.calls.push({ kind: 'preflight', context });
    if (this.#preflight instanceof Error) throw this.#preflight;
    return this.#preflight ?? { status: 'ready' };
  }

  async start(context) {
    this.calls.push({ kind: 'start', context });
    return { receiptId: 'receipt-001', status: 'started', target: target({ sourceSha: context.sourceSha }) };
  }

  async attach(context) {
    this.calls.push({ kind: 'attach', context });
    return { receiptId: 'receipt-001', status: 'attached', target: context.target };
  }

  async observe(context) {
    this.calls.push({ kind: 'observe', context });
    return this.#observations.shift() ?? { status: 'succeeded', target: context.target };
  }

  async collectEvidence(context) {
    this.calls.push({ kind: 'evidence', context });
    return { status: 'collected', summaryCode: 'target-failed' };
  }

  async cancel(context) {
    this.calls.push({ kind: 'cancel', context });
    return { status: 'cancelled', target: context.target };
  }
}

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'watch-orchestrator-'));
  try {
    return await run(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

function createHarness(workspaceRoot, adapter, scenarioValue = scenario()) {
  let now = 100;
  const clock = () => now++;
  const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
  const stateStore = new AtomicStateStore({
    clock,
    processId: 1234,
    sessionId: SESSION_ID,
    storage,
    workspaceId: WORKSPACE_ID,
  });
  const auditJournal = new AuditJournal({ clock, stateStore, storage });
  const poller = new DeadlineAwarePoller({ sleep: async () => undefined });
  const orchestrator = new ProcessWatchOrchestrator({
    adapter,
    auditJournal,
    clock,
    libraryDigest: DIGESTS.library,
    poller,
    processStartToken: START_TOKEN,
    scenario: scenarioValue,
    scenarioDigest: DIGESTS.scenario,
    scriptDigest: DIGESTS.script,
    sessionId: SESSION_ID,
    stateStore,
    storage,
    successAttestation: new SuccessAttestation(),
    workspaceId: WORKSPACE_ID,
  });
  return { auditJournal, orchestrator, stateStore, storage };
}

function transitionOutcome(fromPhase, toPhase) {
  if (toPhase === 'Armed') return null;
  if (toPhase === 'Success') return 'succeeded';
  if (toPhase === 'Cancelled') return 'user_cancelled';
  if (toPhase === 'Blocked') return 'integrity_failed';
  if (toPhase === 'Repairing' && fromPhase === 'Verifying') return 'verification_failed';
  if (toPhase === 'NeedsAgent' || toPhase === 'Repairing' || toPhase === 'Verifying' || toPhase === 'Restarting') {
    return 'target_failed';
  }
  return 'running';
}

describe('ProcessWatchOrchestrator', () => {
  it('composes each declared adapter through an injected registry without provider discovery', async () => {
    await withWorkspace(async (workspaceRoot) => {
      for (const adapterName of ['local-command', 'docker-build', 'generic-ci-cli', 'github-actions']) {
        const registry = new ProcessWatchAdapterRegistry({
          factories: { [adapterName]: () => new ScriptedAdapter() },
        });
        const root = new ProcessWatchCompositionRoot({
          adapterRegistry: registry,
          libraryDigest: DIGESTS.library,
          scenario: scenario({ adapter: adapterName }),
          scenarioDigest: DIGESTS.scenario,
          scriptDigest: DIGESTS.script,
          sessionId: SESSION_ID,
          watchId: WATCH_ID,
          workspaceId: WORKSPACE_ID,
          workspaceRoot,
        });
        assert.equal(root.create({ processStartToken: START_TOKEN }).adapter instanceof ScriptedAdapter, true);
      }
    });
  });

  it('allows every declared state edge and rejects illegal outcome or phase changes', () => {
    const table = new ProcessWatchTransitionTable();
    for (const [fromPhase, nextPhases] of Object.entries(WATCH_TRANSITION_PHASES)) {
      for (const toPhase of nextPhases) {
        const outcome = transitionOutcome(fromPhase, toPhase);
        const blocker = toPhase === 'Blocked' ? 'integrity-failed' : null;
        assert.equal(table.assert({ blocker, fromPhase, outcome, toPhase }).toPhase, toPhase);
      }
    }
    assert.throws(() => table.assert({ fromPhase: 'Armed', outcome: 'succeeded', toPhase: 'Success' }), {
      code: 'watch-transition-not-allowed',
    });
    assert.throws(() => table.assert({ fromPhase: 'Watching', outcome: 'target_failed', toPhase: 'Blocked' }), {
      code: 'transition-blocker-outcome-mismatch',
    });
    assert.equal(
      table.assert({ fromPhase: 'NeedsAgent', outcome: 'delivery_failed', toPhase: 'Repairing' }).outcome,
      'delivery_failed',
    );
    assert.equal(
      table.assert({ fromPhase: 'NeedsAgent', outcome: 'dispatch_failed', toPhase: 'Repairing' }).outcome,
      'dispatch_failed',
    );
    assert.equal(
      table.assert({ fromPhase: 'Verifying', outcome: 'verification_failed', toPhase: 'Repairing' }).outcome,
      'verification_failed',
    );
    for (const outcome of ['target_failed', 'verification_failed', 'delivery_failed', 'dispatch_failed']) {
      assert.equal(table.assert({ fromPhase: 'Verifying', outcome, toPhase: 'Restarting' }).outcome, outcome);
    }
    for (const phase of ['Repairing', 'Verifying', 'Restarting']) {
      assert.equal(
        table.assert({ fromPhase: phase, outcome: 'user_cancelled', toPhase: 'Cancelled' }).toPhase,
        'Cancelled',
      );
    }
  });

  it('reaches Success only after a fresh exact-target observation and writes bounded proof', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const adapter = new ScriptedAdapter({
        observations: [
          { status: 'succeeded', target: target() },
          { status: 'succeeded', target: target() },
        ],
      });
      const { auditJournal, orchestrator, stateStore, storage } = createHarness(workspaceRoot, adapter);
      const result = await orchestrator.run(invocation());
      assert.equal(result.phase, 'Success', JSON.stringify(result));
      assert.equal(result.outcome, 'succeeded');
      assert.equal(adapter.calls.filter((call) => call.kind === 'observe').length, 2);
      const attestation = await storage.readJson('attestation.json');
      assert.equal(attestation.target.targetId, 'target-001');
      assert.equal(attestation.requiredContract.results[0].conclusion, 'success');
      const events = await auditJournal.readActive();
      assert.equal(events.at(-1).phase, 'Success');
      assert.equal((await stateStore.readState()).phase, 'Success');
    });
  });

  it('hands a failed target to the agent without arbitrary retries and preserves a fingerprint', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const adapter = new ScriptedAdapter({ observations: [{ status: 'failed', target: target() }] });
      const { orchestrator, stateStore } = createHarness(workspaceRoot, adapter);
      const result = await orchestrator.run(invocation());
      assert.equal(result.phase, 'NeedsAgent');
      assert.equal(result.outcome, 'target_failed');
      const persisted = await stateStore.readState();
      assert.equal(persisted.failureFingerprints.length, 1);
      assert.equal(adapter.calls.filter((call) => call.kind === 'start').length, 1);
      assert.equal(adapter.calls.filter((call) => call.kind === 'evidence').length, 1);
    });
  });

  it('fails closed for target loss, authentication failure, and final verification failure', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const targetLost = createHarness(
        workspaceRoot,
        new ScriptedAdapter({ observations: [{ blocker: 'target-lost', status: 'blocked' }] }),
      );
      assert.equal((await targetLost.orchestrator.run(invocation())).outcome, 'target_lost');
      assert.equal((await targetLost.stateStore.readState()).phase, 'Blocked');
    });
    await withWorkspace(async (workspaceRoot) => {
      const authentication = createHarness(
        workspaceRoot,
        new ScriptedAdapter({ preflight: new RuntimeCoreError('github-authentication-failed') }),
      );
      assert.equal((await authentication.orchestrator.run(invocation())).outcome, 'authentication_failed');
      assert.equal((await authentication.stateStore.readState()).blocker, 'authentication-failed');
    });
    await withWorkspace(async (workspaceRoot) => {
      const verification = createHarness(
        workspaceRoot,
        new ScriptedAdapter({
          observations: [
            { status: 'succeeded', target: target() },
            { status: 'failed', target: target() },
          ],
        }),
      );
      assert.equal((await verification.orchestrator.run(invocation())).outcome, 'verification_failed');
      assert.equal((await verification.stateStore.readState()).blocker, 'verification-failed');
    });
  });

  it('records timeout, dispatch, delivery, and scenario-change outcomes without continuing work', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const timeout = createHarness(workspaceRoot, new ScriptedAdapter());
      const result = await timeout.orchestrator.run(invocation({ deadlineEpochMilliseconds: 0 }));
      assert.equal(result.outcome, 'timed_out');
      assert.equal((await timeout.stateStore.readState()).blocker, 'atomicity-uncertain');
    });
    for (const [errorCode, outcome, blocker] of [
      ['provider-dispatch-failed', 'dispatch_failed', 'dispatch-failed'],
      ['provider-delivery-failed', 'delivery_failed', 'delivery-failed'],
    ]) {
      await withWorkspace(async (workspaceRoot) => {
        const harness = createHarness(
          workspaceRoot,
          new ScriptedAdapter({ preflight: new RuntimeCoreError(errorCode) }),
        );
        const result = await harness.orchestrator.run(invocation());
        assert.equal(result.outcome, outcome);
        assert.equal((await harness.stateStore.readState()).blocker, blocker);
      });
    }
    await withWorkspace(async (workspaceRoot) => {
      const originalStorage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      const originalStore = new AtomicStateStore({
        sessionId: SESSION_ID,
        storage: originalStorage,
        workspaceId: WORKSPACE_ID,
      });
      await originalStore.acquireLock({ processStartToken: START_TOKEN });
      await originalStore.writeInitialState(state({ scenarioDigest: '9'.repeat(64) }));
      await originalStore.releaseLock();
      const changed = createHarness(workspaceRoot, new ScriptedAdapter());
      const result = await changed.orchestrator.run(invocation());
      assert.equal(result.outcome, 'scenario_changed');
      assert.equal((await changed.stateStore.readState()).blocker, 'scenario-changed');
    });
    await withWorkspace(async (workspaceRoot) => {
      const repair = createHarness(workspaceRoot, new ScriptedAdapter());
      await repair.stateStore.acquireLock({ processStartToken: START_TOKEN });
      await repair.stateStore.writeInitialState(
        state({ outcome: 'target_failed', phase: 'Repairing', scenarioDigest: '9'.repeat(64) }),
      );
      const result = await repair.orchestrator.advance({
        outcome: 'target_failed',
        summaryCode: 'verifying',
        toPhase: 'Verifying',
      });
      assert.equal(result.phase, 'Blocked');
      assert.equal(result.outcome, 'scenario_changed');
      await repair.stateStore.releaseLock();
    });
  });

  it('fails closed when a resumed watcher cannot prove its previous process-owned operation', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const firstStorage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      const firstStore = new AtomicStateStore({
        processId: 1234,
        sessionId: SESSION_ID,
        storage: firstStorage,
        workspaceId: WORKSPACE_ID,
      });
      await firstStore.acquireLock({ processStartToken: START_TOKEN });
      await firstStore.writeInitialState(
        state({ generation: 0, outcome: 'running', phase: 'Watching', target: target() }),
      );
      await firstStore.releaseLock();
      const resumed = createHarness(workspaceRoot, new ScriptedAdapter());
      const result = await resumed.orchestrator.run(invocation());
      assert.equal(result.phase, 'Blocked');
      assert.equal(result.outcome, 'watcher_lost');
    });
  });

  it('refreshes an explicit resume deadline, rearms a blocked watch, and preserves target identity', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const originalStore = new AtomicStateStore({
        processId: 1234,
        sessionId: SESSION_ID,
        storage: new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot }),
        workspaceId: WORKSPACE_ID,
      });
      await originalStore.acquireLock({ processStartToken: START_TOKEN });
      await originalStore.writeInitialState(
        state({
          blocker: 'watcher-lost',
          outcome: 'watcher_lost',
          phase: 'Blocked',
        }),
      );
      await originalStore.releaseLock();

      const adapter = new ScriptedAdapter({
        observations: [
          { status: 'succeeded', target: target() },
          { status: 'succeeded', target: target() },
        ],
      });
      const harness = createHarness(workspaceRoot, adapter);
      const result = await harness.orchestrator.resume(
        invocation({ deadlineEpochMilliseconds: 200_000, timeoutSeconds: 2 }),
      );
      assert.equal(result.phase, 'Success', JSON.stringify(result));
      const persisted = await harness.stateStore.readState();
      assert.equal(persisted.deadlineEpochMilliseconds, 200_000);
      assert.equal(persisted.timeoutSeconds, 2);
      assert.equal(adapter.calls.filter((call) => call.kind === 'start').length, 1);
      assert.equal(
        (await harness.auditJournal.readActive()).some((event) => event.summaryCode === 'explicit-resume-rearmed'),
        true,
      );
    });

    await withWorkspace(async (workspaceRoot) => {
      const existingTarget = target();
      const originalStore = new AtomicStateStore({
        processId: 1234,
        sessionId: SESSION_ID,
        storage: new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot }),
        workspaceId: WORKSPACE_ID,
      });
      await originalStore.acquireLock({ processStartToken: START_TOKEN });
      await originalStore.writeInitialState(
        state({ outcome: 'target_failed', phase: 'NeedsAgent', target: existingTarget }),
      );
      await originalStore.releaseLock();

      const harness = createHarness(workspaceRoot, new ScriptedAdapter());
      const refreshed = await harness.orchestrator.resume(
        invocation({ deadlineEpochMilliseconds: 300_000, target: existingTarget, timeoutSeconds: 3 }),
      );
      assert.equal(refreshed.phase, 'NeedsAgent');
      assert.equal((await harness.stateStore.readState()).deadlineEpochMilliseconds, 300_000);
      await assert.rejects(
        () =>
          harness.orchestrator.resume(
            invocation({
              deadlineEpochMilliseconds: 400_000,
              target: { ...existingTarget, identityDigest: '9'.repeat(64) },
              timeoutSeconds: 4,
            }),
          ),
        { code: 'watch-state-integrity-mismatch' },
      );
    });
  });

  it('cancels an active owned local process but only stops monitoring a remote target', async () => {
    for (const [adapterName, expectedCancelCalls] of [
      ['local-command', 1],
      ['fixture-adapter', 0],
    ]) {
      await withWorkspace(async (workspaceRoot) => {
        const adapter = new ScriptedAdapter({ observations: [{ status: 'running', target: target() }] });
        const harness = createHarness(workspaceRoot, adapter, scenario({ adapter: adapterName }));
        await harness.storage.initialize();
        await harness.storage.writeJson(REPAIR_CANCELLATION_FILE_NAME, {
          requestedAtEpochMilliseconds: 100,
          schemaVersion: REPAIR_CONTROL_SCHEMA_VERSION,
          sessionId: SESSION_ID,
          watchId: WATCH_ID,
        });
        const result = await harness.orchestrator.run(invocation());
        assert.equal(result.phase, 'Cancelled');
        assert.equal(result.outcome, 'user_cancelled');
        assert.equal(adapter.calls.filter((call) => call.kind === 'cancel').length, expectedCancelCalls);
        assert.equal(await harness.storage.readJson(REPAIR_CANCELLATION_FILE_NAME), null);
      });
    }
  });

  it('detects a stale transition generation rather than overwriting state', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const { orchestrator, stateStore } = createHarness(workspaceRoot, new ScriptedAdapter());
      await stateStore.acquireLock({ processStartToken: START_TOKEN });
      await stateStore.writeInitialState(state());
      const transitions = await Promise.allSettled([
        orchestrator.advance({ outcome: 'running', summaryCode: 'preparing', toPhase: 'Preparing' }),
        orchestrator.advance({ outcome: 'running', summaryCode: 'preparing', toPhase: 'Preparing' }),
      ]);
      assert.equal(transitions.filter((entry) => entry.status === 'fulfilled').length, 1);
      assert.equal(transitions.filter((entry) => entry.status === 'rejected').length, 1);
      await stateStore.releaseLock();
    });
  });

  it('composes a real disposable local process without shell execution', async () => {
    await withWorkspace(async (workspaceRoot) => {
      await writeFile(path.join(workspaceRoot, 'exit-zero.mjs'), 'process.exitCode = 0;\n');
      const normalized = normalizeWatchScenario({
        $schema: 'urn:gpt-voice:watch-process:scenario:1',
        adapter: 'local-command',
        adapterConfig: {
          startCommand: { args: ['exit-zero.mjs'], cwd: '.', env: [], executable: process.execPath },
          successExitCodes: [0],
        },
        delivery: { pushCurrentUpstream: false, strategy: 'local-restart' },
        description: 'Run a disposable child.',
        evidence: { maxBytesPerAttempt: 1_024, maxFailures: 2, ttlSeconds: 60 },
        forbiddenActions: ['deploy', 'publish', 'release'],
        id: 'real-local-watch',
        repair: {
          allowCreate: false,
          allowDelete: false,
          excludeGlobs: [],
          includeGlobs: ['*.mjs'],
          maxBytesChanged: 1_024,
          maxFiles: 1,
        },
        schemaVersion: '1.0.0',
        success: { allowedSkippedChecks: [], requiredChecks: [], requiredChecksMode: 'none', requiredOutputs: [] },
        target: {
          identityFields: ['commandDigest', 'inputDigest', 'attempt', 'processStartToken'],
          requireExactSourceRevision: false,
          selectorKinds: ['start'],
        },
        timing: {
          expectedDurationSeconds: 1,
          maxTimeoutSeconds: 5,
          minTimeoutSeconds: 1,
          poll: { initialSeconds: 1, maxSeconds: 1, multiplier: 1 },
        },
        verification: [{ args: ['--version'], cwd: '.', env: [], executable: process.execPath }],
      });
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      const stateStore = new AtomicStateStore({ sessionId: SESSION_ID, storage, workspaceId: WORKSPACE_ID });
      const receiptStore = new OperationReceiptStore({ stateStore, storage });
      const runner = new ManagedProcessRunner({ environmentAllowlist: [], workspaceRoot });
      const adapter = new LocalCommandProcessAdapter({
        environmentAllowlist: [],
        receiptStore,
        runner,
        scenario: normalized.scenario,
        scenarioDigest: normalized.canonicalDigest,
        watchId: WATCH_ID,
        workspaceRoot,
      });
      const orchestrator = new ProcessWatchOrchestrator({
        adapter,
        auditJournal: new AuditJournal({ stateStore, storage }),
        libraryDigest: DIGESTS.library,
        poller: new DeadlineAwarePoller({ sleep: () => new Promise((resolve) => setTimeout(resolve, 5)) }),
        processStartToken: START_TOKEN,
        scenario: normalized.scenario,
        scenarioDigest: normalized.canonicalDigest,
        scriptDigest: DIGESTS.script,
        sessionId: SESSION_ID,
        stateStore,
        storage,
        workspaceId: WORKSPACE_ID,
      });
      const result = await orchestrator.run({ ...invocation(), deadlineEpochMilliseconds: Date.now() + 5_000 });
      assert.equal(result.phase, 'Success', JSON.stringify(result));
      const receipts = await readFile(path.join(storage.rootPath, 'receipts.json'), 'utf8');
      assert.equal(receipts.includes('exit-zero.mjs'), false);
    });
  });
});
