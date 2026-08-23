import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  WatchRuntimeStorage,
  normalizeWatchScenario,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';
import { digestNormalizedValue } from '../../../.agents/skills/watch-process/scripts/lib/runtime-core-support.mjs';

const SESSION_ID = 'session-operator-001';
const SOURCE_SHA = 'a'.repeat(40);
const START_TOKEN = 'b'.repeat(32);
const WATCH_ID = 'local-long-test-deadbeefcafe';
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

describe('process-watch operator entrypoint', () => {
  it('routes every declared CLI action through closed validated arguments', async () => {
    const operator = new RecordingOperator();
    const commands = [
      ['start', '--scenario', 'local-long-test', '--target', 'start', '--timeout-seconds', '240'],
      ['status', '--watch-id', WATCH_ID],
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
      [['write-begin', '--watch-id', WATCH_ID], 'repair-candidate-paths-required'],
      [['status', '--watch-id', WATCH_ID, '--watch-id', WATCH_ID], 'duplicate-process-watch-option'],
    ]) {
      await assert.rejects(() => runProcessWatchCommand(arguments_, { operatorOptions: { environment: {} } }), {
        code,
      });
    }
  });

  it('creates one digest-bound start invocation after clean-worktree preflight', async () => {
    await withWorkspace(async (workspaceRoot) => {
      await copyLocalScenario(workspaceRoot);
      const snapshots = [];
      const worktreeInspector = {
        async assertClean(request) {
          snapshots.push(request);
          return Object.freeze({ headSha: SOURCE_SHA });
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

      const operator = new ProcessWatchOperator({
        environment: { CODEX_SESSION_ID: SESSION_ID, PATH: process.env.PATH },
        randomBytesFactory: (length) => Buffer.alloc(length, 0x0f),
        workspaceRoot,
      });
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
    });
  });
});
