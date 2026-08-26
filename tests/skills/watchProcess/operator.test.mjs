import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { runProcessWatchCommand } from '../../../.agents/skills/watch-process/scripts/process-watch.mjs';
import {
  AtomicStateStore,
  GeneratedWatcherArtifact,
  GeneratedWatcherInvocationStore,
  ProcessWatchLibraryIntegrity,
  ProcessWatchOperator,
  ProcessWatchSelectionStore,
  ProcessWatchStopHookWatch,
  WatchRuntimeStorage,
  normalizeWatchScenario,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';
import { digestNormalizedValue } from '../../../.agents/skills/watch-process/scripts/lib/runtime-core-support.mjs';

const SESSION_ID = 'session-operator-001';
const SOURCE_SHA = 'a'.repeat(40);
const START_TOKEN = 'b'.repeat(32);
const WATCH_ID = 'local-long-test-deadbeefcafe';
const RELEASE_WATCH_ID = 'local-whisper-alpha-release-deadbeefcafe';
const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
const runFile = promisify(execFile);

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'watch-operator-'));
  try {
    return await run(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

async function copyLocalScenario(workspaceRoot) {
  const scenarioRoot = path.join(workspaceRoot, '.codex', 'process-watch', 'scenarios');
  await mkdir(scenarioRoot, { recursive: true });
  const source = await readFile(
    path.join(repositoryRoot, '.codex', 'process-watch', 'scenarios', 'local-long-test.watch.json'),
    'utf8',
  );
  const scenarioPath = path.join(scenarioRoot, 'local-long-test.watch.json');
  await writeFile(scenarioPath, source);
  return JSON.parse(source);
}

async function copyReleaseScenario(workspaceRoot) {
  const scenarioRoot = path.join(workspaceRoot, '.codex', 'process-watch', 'scenarios');
  await mkdir(scenarioRoot, { recursive: true });
  await cp(
    path.join(repositoryRoot, '.codex', 'process-watch', 'scenarios', 'local-whisper-alpha-release'),
    path.join(scenarioRoot, 'local-whisper-alpha-release'),
    { recursive: true },
  );
  const source = await readFile(
    path.join(repositoryRoot, '.codex', 'process-watch', 'scenarios', 'local-whisper-alpha-release.watch.json'),
    'utf8',
  );
  await writeFile(path.join(scenarioRoot, 'local-whisper-alpha-release.watch.json'), source);
  return JSON.parse(source);
}

async function writeNeedsAgentState({ deadlineEpochMilliseconds, watchId, workspaceRoot }) {
  const workspaceId = digestNormalizedValue('gpt-voice/watch-process/workspace/v1', workspaceRoot);
  const storage = new WatchRuntimeStorage({ watchId, workspaceRoot });
  const stateStore = new AtomicStateStore({ sessionId: SESSION_ID, storage, workspaceId });
  await stateStore.acquireLock({ processStartToken: START_TOKEN });
  await stateStore.writeInitialState({
    blocker: null,
    deadlineEpochMilliseconds,
    failureFingerprints: ['e'.repeat(64)],
    generation: 0,
    heartbeat: { atEpochMilliseconds: 1_000, startToken: START_TOKEN },
    libraryDigest: '1'.repeat(64),
    outcome: 'target_failed',
    phase: 'NeedsAgent',
    receiptIds: ['receipt-operator-expired'],
    scenarioDigest: '2'.repeat(64),
    scenarioId: 'local-long-test',
    schemaVersion: 1,
    scriptDigest: '3'.repeat(64),
    sessionId: SESSION_ID,
    target: {
      attempt: 1,
      identityDigest: '4'.repeat(64),
      sourceSha: SOURCE_SHA,
      targetId: 'target-operator-expired',
    },
    timeoutSeconds: 120,
    watchId,
    workspaceId,
  });
  await stateStore.releaseLock();
}

async function git(workspaceRoot, arguments_) {
  return runFile('git', arguments_, { cwd: workspaceRoot });
}

/** Records sanitized operator requests without touching runtime state. */
class RecordingOperator {
  calls = [];

  async start(request) {
    return this.#record('start', request);
  }

  async status(request) {
    return this.#record('status', request);
  }

  async continuation(request) {
    return this.#record('continuation', request);
  }

  async wait(request) {
    return this.#record('wait', request);
  }

  async resume(request) {
    return this.#record('resume', request);
  }

  async cancel(request) {
    return this.#record('cancel', request);
  }

  async control(action, request) {
    return this.#record(action, request);
  }

  #record(action, request) {
    const call = Object.freeze({ action, request });
    this.calls.push(call);
    return call;
  }
}

async function assertBackgroundRepairRestart({
  stateStore,
  storage,
  target,
  workspaceId,
  workspaceRoot,
  staleLock = false,
}) {
  const repairingState = await stateStore.readState();
  const verifyingState = {
    ...repairingState,
    generation: repairingState.generation + 1,
    phase: 'Verifying',
  };
  await storage.writeJson('state.json', verifyingState);
  if (staleLock) {
    await storage.writeJson('lock.json', {
      acquiredAtEpochMilliseconds: verifyingState.heartbeat.atEpochMilliseconds,
      generation: verifyingState.generation,
      heartbeatAtEpochMilliseconds: verifyingState.heartbeat.atEpochMilliseconds,
      pid: 999_999_999,
      processStartToken: verifyingState.heartbeat.startToken,
      schemaVersion: 1,
      sessionId: SESSION_ID,
      watchId: WATCH_ID,
      workspaceId,
    });
  }
  const selectionStore = new ProcessWatchSelectionStore({ workspaceRoot });
  assert.equal(await selectionStore.consume({ sessionId: SESSION_ID, watchId: WATCH_ID, workspaceId }), true);
  let backgroundLaunchRequest;
  let armedDuringLaunch;
  const backgroundOperator = new ProcessWatchOperator({
    coordinatorFactory: () => ({
      async launch(request) {
        backgroundLaunchRequest = request;
        await request.preflight();
        armedDuringLaunch = (await selectionStore.read()).armed;
        return { heartbeat: { phase: 'Restarting', target } };
      },
    }),
    environment: { CODEX_SESSION_ID: SESSION_ID, PATH: process.env.PATH },
    randomBytesFactory: (length) => Buffer.alloc(length, 0x0d),
    workspaceRoot,
  });

  const restart = await backgroundOperator.control('restart', { watchId: WATCH_ID });

  assert.equal(backgroundLaunchRequest.mode, 'repair-restart');
  assert.equal(armedDuringLaunch, false);
  assert.equal(restart.phase, 'Restarting');
  assert.deepEqual(await selectionStore.read(), {
    armed: true,
    schemaVersion: 2,
    sessionId: SESSION_ID,
    watchId: WATCH_ID,
    workspaceId,
  });
  if (staleLock) assert.equal(await storage.readJson('lock.json'), null);
}

describe('process-watch operator entrypoint', () => {
  it('routes every declared CLI action through closed validated arguments', async () => {
    const operator = new RecordingOperator();
    const commands = [
      ['start', '--scenario', 'local-long-test', '--target', 'start', '--timeout-seconds', '240'],
      ['status', '--watch-id', WATCH_ID],
      ['continuation', '--watch-id', WATCH_ID, '--generation', '7', '--outcome', 'target_failed'],
      ['wait', '--watch-id', WATCH_ID],
      ['resume', '--watch-id', WATCH_ID, '--timeout-seconds', '300'],
      ['cancel', '--watch-id', WATCH_ID],
      ['repair-begin', '--watch-id', WATCH_ID],
      ['write-begin', '--watch-id', WATCH_ID, '--path', 'src/app.ts', '--path', 'tests/app.test.ts'],
      ['write-complete', '--watch-id', WATCH_ID, '--path', 'src/app.ts'],
      ['repair-verify', '--watch-id', WATCH_ID],
      ['repair-restart', '--watch-id', WATCH_ID],
    ];
    for (const command of commands) await runProcessWatchCommand(command, { operator });

    assert.deepEqual(operator.calls, [
      {
        action: 'start',
        request: { scenarioId: 'local-long-test', targetSelector: 'start', timeoutSeconds: 240 },
      },
      { action: 'status', request: { watchId: WATCH_ID } },
      {
        action: 'continuation',
        request: { generation: 7, outcome: 'target_failed', watchId: WATCH_ID },
      },
      { action: 'wait', request: { watchId: WATCH_ID } },
      { action: 'resume', request: { timeoutSeconds: 300, watchId: WATCH_ID } },
      { action: 'cancel', request: { watchId: WATCH_ID } },
      { action: 'begin-repair', request: { candidatePaths: undefined, watchId: WATCH_ID } },
      {
        action: 'begin-write',
        request: { candidatePaths: ['src/app.ts', 'tests/app.test.ts'], watchId: WATCH_ID },
      },
      { action: 'complete-write', request: { candidatePaths: ['src/app.ts'], watchId: WATCH_ID } },
      { action: 'verify', request: { candidatePaths: undefined, watchId: WATCH_ID } },
      { action: 'restart', request: { candidatePaths: undefined, watchId: WATCH_ID } },
    ]);
  });

  it('rejects malformed actions and options before constructing the production operator', async () => {
    for (const [arguments_, code] of [
      [['unknown'], 'invalid-process-watch-action'],
      [['start', '--scenario', 'local-long-test'], 'missing-process-watch-option'],
      [['start', '--scenario', 'local-long-test', '--timeout-seconds', '0'], 'invalid-watch-timeout'],
      [['status', '--unexpected', 'value'], 'unknown-process-watch-option'],
      [
        ['continuation', '--watch-id', WATCH_ID, '--generation', '-1', '--outcome', 'target_failed'],
        'invalid-process-watch-generation',
      ],
      [
        ['continuation', '--watch-id', WATCH_ID, '--generation', '1', '--outcome', 'running'],
        'invalid-process-watch-outcome',
      ],
      [['wait'], 'missing-process-watch-option'],
      [['write-begin', '--watch-id', WATCH_ID], 'repair-candidate-paths-required'],
      [['status', '--watch-id', WATCH_ID, '--watch-id', WATCH_ID], 'duplicate-process-watch-option'],
    ]) {
      await assert.rejects(() => runProcessWatchCommand(arguments_, { operatorOptions: { environment: {} } }), {
        code,
      });
    }
  });

  it('cancels a stale repairing watch without loading its changed scenario or library', async () => {
    await withWorkspace(async (workspaceRoot) => {
      await writeNeedsAgentState({ deadlineEpochMilliseconds: 100_000, watchId: WATCH_ID, workspaceRoot });
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      const repairing = await storage.readJson('state.json');
      await storage.writeJson('state.json', {
        ...repairing,
        generation: 1,
        phase: 'Repairing',
      });
      const operator = new ProcessWatchOperator({
        clock: () => 2_000,
        environment: { CODEX_SESSION_ID: SESSION_ID },
        randomBytesFactory: (length) => Buffer.alloc(length, 0x0e),
        workspaceRoot,
      });

      const cancelled = await operator.cancel({ watchId: WATCH_ID });

      assert.equal(cancelled.phase, 'Cancelled');
      assert.equal(cancelled.outcome, 'user_cancelled');
      const persisted = await storage.readJson('state.json');
      assert.equal(persisted.phase, 'Cancelled');
      assert.equal(persisted.outcome, 'user_cancelled');
    });
  });

  it('cancels a NeedsAgent handoff so the same logical target can be recovered with updated tooling', async () => {
    await withWorkspace(async (workspaceRoot) => {
      await writeNeedsAgentState({ deadlineEpochMilliseconds: 100_000, watchId: WATCH_ID, workspaceRoot });
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      const operator = new ProcessWatchOperator({
        clock: () => 2_000,
        environment: { CODEX_SESSION_ID: SESSION_ID },
        randomBytesFactory: (length) => Buffer.alloc(length, 0x0e),
        workspaceRoot,
      });

      const cancelled = await operator.cancel({ watchId: WATCH_ID });

      assert.equal(cancelled.phase, 'Cancelled');
      assert.equal(cancelled.outcome, 'user_cancelled');
      const persisted = await storage.readJson('state.json');
      assert.equal(persisted.phase, 'Cancelled');
      assert.equal(persisted.outcome, 'user_cancelled');
    });
  });

  it('creates a local-restart invocation from a stable workspace snapshot without requiring a clean worktree', async () => {
    await withWorkspace(async (workspaceRoot) => {
      await copyLocalScenario(workspaceRoot);
      const snapshots = [];
      const worktreeInspector = {
        async snapshot(request) {
          snapshots.push(request);
          return Object.freeze({
            changedFiles: Object.freeze(['existing-local-change.txt']),
            diffDigest: 'f'.repeat(64),
            files: Object.freeze([]),
            headSha: SOURCE_SHA,
          });
        },
      };
      let launchRequest;
      let factoryDependencies;
      let randomCall = 0;
      const operator = new ProcessWatchOperator({
        clock: () => 1_000,
        coordinatorFactory: (dependencies) => {
          factoryDependencies = dependencies;
          return {
            async launch(request) {
              launchRequest = request;
              await request.preflight();
              return {
                heartbeat: { phase: 'Watching', target: null },
              };
            },
          };
        },
        environment: { CODEX_SESSION_ID: SESSION_ID },
        randomBytesFactory: (length) => Buffer.alloc(length, randomCall++ === 0 ? 0x0c : 0x0d),
        workspaceRoot,
        worktreeInspector,
      });
      const result = await operator.start({
        scenarioId: 'local-long-test',
        targetSelector: 'start',
        timeoutSeconds: 120,
      });

      assert.equal(result.phase, 'Watching');
      assert.equal(result.timeoutSeconds, 120);
      assert.match(result.watchId, /^local-long-test-[a-f0-9]{12}$/u);
      assert.equal(launchRequest.mode, 'start');
      assert.equal(launchRequest.invocation.deadlineEpochMilliseconds, 121_000);
      assert.equal(launchRequest.invocation.sourceSha, SOURCE_SHA);
      assert.equal(launchRequest.invocation.targetSelector, 'start');
      assert.equal(launchRequest.processStartToken, '0d'.repeat(16));
      assert.equal(factoryDependencies.storage.watchId, result.watchId);
      assert.equal(factoryDependencies.artifact instanceof GeneratedWatcherArtifact, true);
      assert.equal(factoryDependencies.invocationStore instanceof GeneratedWatcherInvocationStore, true);
      assert.equal(factoryDependencies.libraryIntegrity instanceof ProcessWatchLibraryIntegrity, true);
      assert.deepEqual(snapshots, [{ timeoutMilliseconds: 120_000 }, { timeoutMilliseconds: 120_000 }]);
      assert.deepEqual(await new ProcessWatchSelectionStore({ workspaceRoot }).read(), {
        armed: true,
        schemaVersion: 2,
        sessionId: SESSION_ID,
        watchId: result.watchId,
        workspaceId: digestNormalizedValue('gpt-voice/watch-process/workspace/v1', workspaceRoot),
      });
    });
  });

  it('allows a new start after an expired NeedsAgent handoff but still rejects an unexpired one', async () => {
    for (const [deadlineEpochMilliseconds, expected] of [
      [9_000, 'started'],
      [11_000, 'active-watch-exists'],
    ]) {
      await withWorkspace(async (workspaceRoot) => {
        await copyLocalScenario(workspaceRoot);
        await writeNeedsAgentState({
          deadlineEpochMilliseconds,
          watchId: `local-long-test-${expected === 'started' ? 'expired' : 'active'}`,
          workspaceRoot,
        });
        const snapshot = Object.freeze({
          changedFiles: Object.freeze([]),
          diffDigest: 'f'.repeat(64),
          files: Object.freeze([]),
          headSha: SOURCE_SHA,
        });
        const operator = new ProcessWatchOperator({
          clock: () => 10_000,
          coordinatorFactory: () => ({
            async launch(request) {
              await request.preflight();
              return { heartbeat: { phase: 'Watching', target: null } };
            },
          }),
          environment: { CODEX_SESSION_ID: SESSION_ID },
          randomBytesFactory: (length) => Buffer.alloc(length, 0x10),
          workspaceRoot,
          worktreeInspector: {
            async snapshot() {
              return snapshot;
            },
          },
        });
        const start = () =>
          operator.start({ scenarioId: 'local-long-test', targetSelector: 'start', timeoutSeconds: 120 });

        if (expected === 'started') {
          assert.equal((await start()).phase, 'Watching');
        } else {
          await assert.rejects(start, { code: expected });
        }
      });
    }
  });

  it('retains clean-worktree preflight for git delivery', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const scenario = await copyLocalScenario(workspaceRoot);
      scenario.delivery.strategy = 'git-delivery';
      await writeFile(
        path.join(workspaceRoot, '.codex', 'process-watch', 'scenarios', 'local-long-test.watch.json'),
        `${JSON.stringify(scenario)}\n`,
      );
      let cleanChecks = 0;
      const snapshot = Object.freeze({
        changedFiles: Object.freeze([]),
        diffDigest: 'f'.repeat(64),
        files: Object.freeze([]),
        headSha: SOURCE_SHA,
      });
      const operator = new ProcessWatchOperator({
        coordinatorFactory: () => ({
          async launch(request) {
            await request.preflight();
            return { heartbeat: { phase: 'Watching', target: null } };
          },
        }),
        environment: { CODEX_SESSION_ID: SESSION_ID },
        randomBytesFactory: (length) => Buffer.alloc(length, 0x0f),
        workspaceRoot,
        worktreeInspector: {
          async assertClean() {
            cleanChecks += 1;
            return snapshot;
          },
          async snapshot() {
            throw new Error('git delivery must not accept a dirty snapshot');
          },
        },
      });

      assert.equal(
        (await operator.start({ scenarioId: 'local-long-test', targetSelector: 'start', timeoutSeconds: 120 })).phase,
        'Watching',
      );
      assert.equal(cleanChecks, 2);
    });
  });

  it('loads the production composition root and enters repair through the real controller', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const scenarioSource = await copyLocalScenario(workspaceRoot);
      await mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
      await writeFile(path.join(workspaceRoot, '.gitignore'), '.codex/runtime/process-watch/\n');
      await writeFile(path.join(workspaceRoot, 'src', 'app.mjs'), 'export const value = 1;\n');
      await git(workspaceRoot, ['init']);
      await git(workspaceRoot, ['config', 'user.name', 'Watch Process Test']);
      await git(workspaceRoot, ['config', 'user.email', 'watch-process@example.invalid']);
      await git(workspaceRoot, ['add', '.']);
      await git(workspaceRoot, ['commit', '-m', 'fixture']);
      const sourceSha = (await git(workspaceRoot, ['rev-parse', 'HEAD'])).stdout.trim();

      const normalizedScenario = normalizeWatchScenario(scenarioSource);
      const libraryDigest = await new ProcessWatchLibraryIntegrity().digest();
      const workspaceId = digestNormalizedValue('gpt-voice/watch-process/workspace/v1', workspaceRoot);
      const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot });
      await storage.initialize();
      const artifact = new GeneratedWatcherArtifact();
      const binding = artifact.createBinding({
        libraryDigest,
        scenarioDigest: normalizedScenario.canonicalDigest,
        scenarioId: normalizedScenario.scenario.id,
        watchId: WATCH_ID,
      });
      await artifact.write({ binding, storage });
      const target = {
        attempt: 1,
        identityDigest: 'c'.repeat(64),
        sourceSha,
        targetId: 'target-operator-001',
      };
      const invocation = {
        deadlineEpochMilliseconds: Date.now() + 120_000,
        inputDigest: 'd'.repeat(64),
        sourceSha,
        target,
        targetSelector: 'start',
        timeoutSeconds: 120,
      };
      await new GeneratedWatcherInvocationStore({ storage }).write({
        invocation,
        scenario: normalizedScenario.scenario,
        scenarioDigest: normalizedScenario.canonicalDigest,
        sessionId: SESSION_ID,
        workspaceId,
      });
      const stateStore = new AtomicStateStore({
        processId: 4242,
        sessionId: SESSION_ID,
        storage,
        workspaceId,
      });
      await stateStore.acquireLock({ processStartToken: START_TOKEN });
      await stateStore.writeInitialState({
        blocker: null,
        deadlineEpochMilliseconds: invocation.deadlineEpochMilliseconds,
        failureFingerprints: ['e'.repeat(64)],
        generation: 0,
        heartbeat: { atEpochMilliseconds: Date.now(), startToken: START_TOKEN },
        libraryDigest,
        outcome: 'target_failed',
        phase: 'NeedsAgent',
        receiptIds: ['receipt-operator-001'],
        scenarioDigest: normalizedScenario.canonicalDigest,
        scenarioId: normalizedScenario.scenario.id,
        schemaVersion: 1,
        scriptDigest: binding.scriptDigest,
        sessionId: SESSION_ID,
        target,
        timeoutSeconds: invocation.timeoutSeconds,
        watchId: WATCH_ID,
        workspaceId,
      });
      await stateStore.releaseLock();
      await new ProcessWatchSelectionStore({ workspaceRoot }).write({
        sessionId: SESSION_ID,
        watchId: WATCH_ID,
        workspaceId,
      });
      await new ProcessWatchStopHookWatch({ storage }).writeAcknowledgement({
        generation: 0,
        outcome: 'target_failed',
        schemaVersion: 1,
        sessionId: SESSION_ID,
        turnId: 'turn-operator-001',
        watchId: WATCH_ID,
      });

      const operator = new ProcessWatchOperator({
        environment: { CODEX_SESSION_ID: SESSION_ID, PATH: process.env.PATH },
        randomBytesFactory: (length) => Buffer.alloc(length, 0x0f),
        workspaceRoot,
      });
      const continuation = await operator.continuation({
        generation: 0,
        outcome: 'target_failed',
        watchId: WATCH_ID,
      });
      assert.equal(continuation.action, 'repair');
      assert.equal(continuation.phase, 'NeedsAgent');
      assert.equal(continuation.outcome, 'target_failed');
      await assert.rejects(
        () => operator.continuation({ generation: 1, outcome: 'target_failed', watchId: WATCH_ID }),
        { code: 'invalid-process-watch-continuation' },
      );
      await assert.rejects(
        () => operator.continuation({ generation: 0, outcome: 'authentication_failed', watchId: WATCH_ID }),
        { code: 'invalid-process-watch-continuation' },
      );
      await new ProcessWatchSelectionStore({ workspaceRoot }).write({
        sessionId: SESSION_ID,
        watchId: WATCH_ID,
        workspaceId: 'workspace-foreign-001',
      });
      await assert.rejects(
        () => operator.continuation({ generation: 0, outcome: 'target_failed', watchId: WATCH_ID }),
        { code: 'process-watch-selection-mismatch' },
      );
      await new ProcessWatchSelectionStore({ workspaceRoot }).write({
        sessionId: SESSION_ID,
        watchId: WATCH_ID,
        workspaceId,
      });
      const waited = await operator.wait({ watchId: WATCH_ID });
      assert.equal(waited.action, 'repair');
      assert.equal(waited.outcome, 'target_failed');

      const needsAgentState = await stateStore.readState();
      await storage.writeJson('state.json', {
        ...needsAgentState,
        blocker: 'authentication-failed',
        generation: 1,
        outcome: 'authentication_failed',
        phase: 'Blocked',
      });
      const blocked = await operator.wait({ watchId: WATCH_ID });
      assert.equal(blocked.action, 'report-blocked');
      assert.equal(blocked.outcome, 'authentication_failed');
      await storage.writeJson('state.json', {
        ...needsAgentState,
        generation: 1,
        outcome: 'user_cancelled',
        phase: 'Cancelled',
      });
      const cancelled = await operator.wait({ watchId: WATCH_ID });
      assert.equal(cancelled.action, 'report-cancelled');
      assert.equal(cancelled.outcome, 'user_cancelled');
      await storage.writeJson('state.json', {
        ...needsAgentState,
        generation: 1,
        outcome: 'succeeded',
        phase: 'Success',
      });
      const succeeded = await operator.wait({ watchId: WATCH_ID });
      assert.equal(succeeded.action, 'report-success');
      assert.equal(succeeded.outcome, 'succeeded');

      const activeState = {
        ...needsAgentState,
        generation: 1,
        outcome: 'running',
        phase: 'Watching',
      };
      await storage.writeJson('state.json', activeState);
      const timedOutOperator = new ProcessWatchOperator({
        clock: () => Date.now(),
        environment: { CODEX_SESSION_ID: SESSION_ID },
        terminalWaiter: {
          async wait() {
            return { kind: 'continue', outcome: 'timed_out', state: activeState };
          },
        },
        workspaceRoot,
        worktreeInspector: {},
      });
      const timedOut = await timedOutOperator.wait({ watchId: WATCH_ID });
      assert.equal(timedOut.action, 'report-blocked');
      assert.equal(timedOut.outcome, 'timed_out');
      await storage.writeJson('state.json', needsAgentState);

      const result = await operator.control('begin-repair', { watchId: WATCH_ID });
      assert.equal(result.phase, 'Repairing', JSON.stringify(result));
      assert.equal((await stateStore.readState()).phase, 'Repairing');
      assert.equal((await storage.readJson('repair-ownership.json')).status, 'armed');

      let resumeRequest;
      const resumed = new ProcessWatchOperator({
        clock: () => 10_000,
        coordinatorFactory: () => ({
          async launch(request) {
            resumeRequest = request;
            await request.preflight();
            return { heartbeat: { phase: 'Repairing', target } };
          },
        }),
        environment: { CODEX_SESSION_ID: SESSION_ID, PATH: process.env.PATH },
        randomBytesFactory: (length) => Buffer.alloc(length, 0x0e),
        workspaceRoot,
      });
      const resumeResult = await resumed.resume({ timeoutSeconds: 300, watchId: WATCH_ID });
      assert.equal(resumeResult.phase, 'Repairing');
      assert.equal(resumeRequest.mode, 'resume');
      assert.equal(resumeRequest.invocation.deadlineEpochMilliseconds, 310_000);
      assert.equal(resumeRequest.invocation.inputDigest, invocation.inputDigest);
      assert.deepEqual(resumeRequest.invocation.target, target);

      await assertBackgroundRepairRestart({
        staleLock: true,
        stateStore,
        storage,
        target,
        workspaceId,
        workspaceRoot,
      });
    });
  });

  it('rebinds release repair to the failed attempt source instead of the original invocation source', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const scenarioSource = await copyReleaseScenario(workspaceRoot);
      await writeFile(path.join(workspaceRoot, '.gitignore'), '.codex/runtime/process-watch/\nremote.git/\n');
      await writeFile(path.join(workspaceRoot, 'package.json'), '{"name":"release-fixture"}\n');
      await git(workspaceRoot, ['init']);
      await git(workspaceRoot, ['config', 'user.name', 'Watch Process Test']);
      await git(workspaceRoot, ['config', 'user.email', 'watch-process@example.invalid']);
      await git(workspaceRoot, ['checkout', '-b', 'feat/local-whisper-provider']);
      await git(workspaceRoot, ['init', '--bare', 'remote.git']);
      await git(workspaceRoot, ['remote', 'add', 'origin', path.join(workspaceRoot, 'remote.git')]);
      await git(workspaceRoot, ['add', '.']);
      await git(workspaceRoot, ['commit', '-m', 'initial source']);
      await git(workspaceRoot, ['push', '--set-upstream', 'origin', 'feat/local-whisper-provider']);
      const invocationSourceSha = (await git(workspaceRoot, ['rev-parse', 'HEAD'])).stdout.trim();
      await writeFile(path.join(workspaceRoot, 'package.json'), '{"name":"release-fixture","version":"1.0.0"}\n');
      await git(workspaceRoot, ['add', 'package.json']);
      await git(workspaceRoot, ['commit', '-m', 'delivered repair']);
      await git(workspaceRoot, ['push']);
      const attemptSourceSha = (await git(workspaceRoot, ['rev-parse', 'HEAD'])).stdout.trim();

      const normalizedScenario = normalizeWatchScenario(scenarioSource);
      const libraryDigest = await new ProcessWatchLibraryIntegrity().digest();
      const workspaceId = digestNormalizedValue('gpt-voice/watch-process/workspace/v1', workspaceRoot);
      const storage = new WatchRuntimeStorage({ watchId: RELEASE_WATCH_ID, workspaceRoot });
      await storage.initialize();
      const artifact = new GeneratedWatcherArtifact();
      const binding = artifact.createBinding({
        libraryDigest,
        scenarioDigest: normalizedScenario.canonicalDigest,
        scenarioId: normalizedScenario.scenario.id,
        watchId: RELEASE_WATCH_ID,
      });
      await artifact.write({ binding, storage });
      const target = {
        attempt: 2,
        identityDigest: 'c'.repeat(64),
        sourceSha: attemptSourceSha,
        targetId: 'target-release-attempt-002',
      };
      const invocation = {
        deadlineEpochMilliseconds: Date.now() + 21_600_000,
        inputDigest: 'd'.repeat(64),
        sourceSha: invocationSourceSha,
        target,
        targetSelector: 'start',
        timeoutSeconds: 21_600,
      };
      const invocationStore = new GeneratedWatcherInvocationStore({ storage });
      await invocationStore.write({
        invocation,
        scenario: normalizedScenario.scenario,
        scenarioDigest: normalizedScenario.canonicalDigest,
        sessionId: SESSION_ID,
        workspaceId,
      });
      const stateStore = new AtomicStateStore({ sessionId: SESSION_ID, storage, workspaceId });
      await stateStore.acquireLock({ processStartToken: START_TOKEN });
      await stateStore.writeInitialState({
        blocker: null,
        deadlineEpochMilliseconds: invocation.deadlineEpochMilliseconds,
        failureFingerprints: ['e'.repeat(64)],
        generation: 0,
        heartbeat: { atEpochMilliseconds: Date.now(), startToken: START_TOKEN },
        libraryDigest,
        outcome: 'target_failed',
        phase: 'NeedsAgent',
        receiptIds: ['receipt-release-attempt-002'],
        scenarioDigest: normalizedScenario.canonicalDigest,
        scenarioId: normalizedScenario.scenario.id,
        schemaVersion: 1,
        scriptDigest: binding.scriptDigest,
        sessionId: SESSION_ID,
        target,
        timeoutSeconds: invocation.timeoutSeconds,
        watchId: RELEASE_WATCH_ID,
        workspaceId,
      });
      await stateStore.releaseLock();
      const worktreeStatus = await git(workspaceRoot, ['status', '--short']);
      assert.equal(worktreeStatus.stdout, '', worktreeStatus.stdout);

      const operator = new ProcessWatchOperator({
        environment: { CODEX_SESSION_ID: SESSION_ID, PATH: process.env.PATH },
        workspaceRoot,
      });
      const result = await operator.control('begin-repair', { watchId: RELEASE_WATCH_ID });
      const rebound = await invocationStore.read({
        scenario: normalizedScenario.scenario,
        scenarioDigest: normalizedScenario.canonicalDigest,
      });

      assert.equal(result.phase, 'Repairing', JSON.stringify(result));
      assert.equal(rebound.invocation.sourceSha, attemptSourceSha);
      assert.notEqual(rebound.invocation.inputDigest, invocation.inputDigest);
    });
  });
});
