import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { PassThrough } from 'node:stream';
import { setImmediate, setTimeout } from 'node:timers';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  AtomicStateStore,
  ManagedProcessRunner,
  OperationReceiptStore,
  WatchRuntimeStorage,
  normalizeProcessTerminal,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';
import { DockerBuildProcessAdapter } from '../../../.agents/skills/watch-process/scripts/lib/adapters/docker-build-process-adapter.mjs';
import { LocalCommandProcessAdapter } from '../../../.agents/skills/watch-process/scripts/lib/adapters/local-command-process-adapter.mjs';
import { normalizeWatchScenario } from '../../../.agents/skills/watch-process/scripts/lib/watch-scenario-registry.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fixturePath = path.join(repositoryRoot, 'tests/skills/watchProcess/fixtures/runtime-child.mjs');
const fixtureDirectory = 'tests/skills/watchProcess/fixtures';
const WATCH_ID = 'watch-001';
const SESSION_ID = 'session-001';
const WORKSPACE_ID = 'workspace-001';
const LOCK_START_TOKEN = 'f'.repeat(32);
const DIGESTS = Object.freeze({
  input: '1'.repeat(64),
  library: '2'.repeat(64),
  script: '3'.repeat(64),
});

/** Disposable ChildProcess-compatible fixture with explicit close and kill control. */
class FakeChild extends EventEmitter {
  constructor(pid = 4242) {
    super();
    this.pid = pid;
    this.stderr = new PassThrough();
    this.stdout = new PassThrough();
    this.kills = [];
    this.onKill = null;
  }

  kill(signal) {
    this.kills.push(signal);
    this.onKill?.(signal);
    return true;
  }

  close(exitCode, signal = null) {
    this.emit('close', exitCode, signal);
  }
}

function safeEvidence() {
  return {
    capturedBytes: 0,
    failureCodes: [],
    failureLimitReached: false,
    receivedBytes: 0,
    stderr: { capturedBytes: 0, receivedBytes: 0, truncated: false },
    stdout: { capturedBytes: 0, receivedBytes: 0, truncated: false },
    timeLimitReached: false,
    truncated: false,
  };
}

function commandResult({ aborted = false, exitCode = 0, startFailed = false, timedOut = false } = {}) {
  return {
    evidence: safeEvidence(),
    terminal: normalizeProcessTerminal({
      aborted,
      exitCode: startFailed || timedOut || aborted ? null : exitCode,
      startFailed,
      timedOut,
    }),
  };
}

/** Creates a deterministic, non-executing command-driver double for local and Docker checks. */
function createFakeCommandDriver(results = []) {
  const queuedResults = [...results];
  const requests = [];
  return {
    requests,
    async run(request) {
      requests.push(request);
      const result = queuedResults.shift() ?? commandResult();
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

function createRunner(children) {
  const launches = [];
  let tokenIndex = 0;
  const runner = new ManagedProcessRunner({
    inheritedEnvironment: { FIXTURE_DECLARED: 'declared' },
    platform: 'win32',
    signalProcess: () => {
      throw new Error('Windows cleanup must use the owned child directly');
    },
    spawnProcess: (executable, args, options) => {
      launches.push({ args, executable, options });
      const child = children.shift();
      if (child === undefined) throw new Error('unexpected process start');
      return child;
    },
    startTokenFactory: () => String.fromCharCode(97 + tokenIndex++).repeat(32),
    terminationGraceMilliseconds: 50,
    workspaceRoot: repositoryRoot,
  });
  return { launches, runner };
}

function defaultScenarioVerification() {
  return [{ args: [fixturePath, 'verify-contract'], cwd: fixtureDirectory, env: [], executable: process.execPath }];
}

function baseScenario({ adapter, adapterConfig, requiredOutputs = [], verification = [] }) {
  return normalizeWatchScenario({
    $schema: 'urn:gpt-voice:watch-process:scenario:1',
    adapter,
    adapterConfig,
    delivery: { pushCurrentUpstream: false, strategy: 'local-restart' },
    description: 'Disposable adapter contract fixture.',
    evidence: { maxBytesPerAttempt: 1_024, maxFailures: 2, ttlSeconds: 60 },
    forbiddenActions: ['deploy', 'publish', 'release'],
    id: adapter === 'docker-build' ? 'docker-adapter-test' : 'local-adapter-test',
    repair: {
      allowCreate: false,
      allowDelete: false,
      excludeGlobs: [],
      includeGlobs: ['tests/**'],
      maxBytesChanged: 1_024,
      maxFiles: 1,
    },
    schemaVersion: '1.0.0',
    success: { allowedSkippedChecks: [], requiredChecks: [], requiredChecksMode: 'none', requiredOutputs },
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
    verification: verification.length === 0 ? defaultScenarioVerification() : verification,
  });
}

function localScenario({ successExitCodes = [0], verification } = {}) {
  return baseScenario({
    adapter: 'local-command',
    adapterConfig: {
      startCommand: {
        args: [fixturePath, 'wait', '{{watch.id}}', '{{attempt.number}}'],
        cwd: fixtureDirectory,
        env: ['FIXTURE_DECLARED'],
        executable: process.execPath,
      },
      successExitCodes,
    },
    verification: verification ?? defaultScenarioVerification(),
  });
}

function dockerScenario({ buildArgs, imageVerification, requiredOutputs = ['local-image'] } = {}) {
  return baseScenario({
    adapter: 'docker-build',
    adapterConfig: {
      buildCommand: {
        args: buildArgs ?? ['build', '--tag', '{{watch.id}}', '{{workspace.root}}'],
        cwd: '.',
        env: [],
        executable: 'docker',
      },
      imageVerification: imageVerification ?? [
        { args: ['image', 'inspect', '{{watch.id}}'], cwd: '.', env: [], executable: 'docker' },
      ],
    },
    requiredOutputs,
  });
}

function stateForScenario(normalized) {
  return {
    blocker: null,
    deadlineEpochMilliseconds: 10_000,
    failureFingerprints: [],
    generation: 0,
    heartbeat: { atEpochMilliseconds: 1, startToken: LOCK_START_TOKEN },
    libraryDigest: DIGESTS.library,
    outcome: null,
    phase: 'Armed',
    receiptIds: [],
    scenarioDigest: normalized.canonicalDigest,
    scenarioId: normalized.scenario.id,
    schemaVersion: 1,
    scriptDigest: DIGESTS.script,
    sessionId: SESSION_ID,
    target: null,
    timeoutSeconds: 1,
    watchId: WATCH_ID,
    workspaceId: WORKSPACE_ID,
  };
}

async function withHarness({ children, normalized, run }) {
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'watch-process-adapter-'));
  const storage = new WatchRuntimeStorage({ watchId: WATCH_ID, workspaceRoot: runtimeRoot });
  const stateStore = new AtomicStateStore({
    processId: 4444,
    sessionId: SESSION_ID,
    storage,
    workspaceId: WORKSPACE_ID,
  });
  try {
    await stateStore.acquireLock({ processStartToken: LOCK_START_TOKEN });
    await stateStore.writeInitialState(stateForScenario(normalized));
    const receiptStore = new OperationReceiptStore({ stateStore, storage });
    const { launches, runner } = createRunner(children);
    return await run({ launches, receiptStore, runner, storage });
  } finally {
    await rm(runtimeRoot, { force: true, recursive: true });
  }
}

function baseContext(overrides = {}) {
  return {
    attempt: 1,
    generation: 0,
    inputDigest: DIGESTS.input,
    sourceSha: null,
    timeoutSeconds: 1,
    ...overrides,
  };
}

function createLocalAdapter({ commandDriver, normalized, receiptStore, runner }) {
  return new LocalCommandProcessAdapter({
    commandDriver,
    environmentAllowlist: [],
    receiptStore,
    runner,
    scenario: normalized.scenario,
    scenarioDigest: normalized.canonicalDigest,
    watchId: WATCH_ID,
    workspaceRoot: repositoryRoot,
  });
}

function createDockerAdapter({ commandDriver, normalized, receiptStore, runner }) {
  return new DockerBuildProcessAdapter({
    commandDriver,
    environmentAllowlist: [],
    receiptStore,
    runner,
    scenario: normalized.scenario,
    scenarioDigest: normalized.canonicalDigest,
    watchId: WATCH_ID,
    workspaceRoot: repositoryRoot,
  });
}

describe('watch-process local and Docker adapters', () => {
  it('runs a local command shell-free, records its receipt first, and verifies a successful result', async () => {
    const normalized = localScenario();
    const child = new FakeChild();
    const driver = createFakeCommandDriver([commandResult(), commandResult()]);
    await withHarness({
      children: [child],
      commandDriver: driver,
      normalized,
      run: async ({ launches, receiptStore, runner }) => {
        const adapter = createLocalAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await adapter.preflight(baseContext());
        const started = await adapter.start(baseContext());

        assert.equal(started.status, 'started');
        assert.equal(launches.length, 1);
        assert.equal(launches[0].options.shell, false);
        assert.deepEqual(launches[0].args, [fixturePath, 'wait', WATCH_ID, '1']);
        assert.equal(launches[0].options.cwd, path.join(repositoryRoot, fixtureDirectory));
        assert.deepEqual(launches[0].options.env, { FIXTURE_DECLARED: 'declared' });
        assert.equal(driver.requests[0].args[0], '--version');
        assert.equal(runner.owns(started.identity.startToken), true);

        child.stdout.write('private fixture output');
        child.stderr.write('private fixture error');
        child.close(0);
        const observation = await adapter.observe(baseContext({ target: started.target }));
        assert.equal(observation.status, 'succeeded');
        assert.equal(observation.verificationCount, 1);
        assert.equal(driver.requests.length, 2);

        const evidence = await adapter.collectEvidence(baseContext({ target: started.target }));
        assert.equal(evidence.status, 'completed');
        assert.equal(JSON.stringify(evidence).includes('private fixture'), false);
        assert.equal((await receiptStore.read()).receipts.length, 1);
      },
    });
  });

  it('distinguishes an allowed nonzero local exit from a failed declared verification', async () => {
    const normalized = localScenario({ successExitCodes: [7] });
    const child = new FakeChild();
    const driver = createFakeCommandDriver([commandResult(), commandResult({ exitCode: 2 })]);
    await withHarness({
      children: [child],
      commandDriver: driver,
      normalized,
      run: async ({ receiptStore, runner }) => {
        const adapter = createLocalAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await adapter.preflight(baseContext());
        const started = await adapter.start(baseContext());
        child.close(7);

        const observation = await adapter.observe(baseContext({ target: started.target }));
        assert.deepEqual(
          { outcome: observation.outcome, status: observation.status, summaryCode: observation.summaryCode },
          { outcome: 'verification_failed', status: 'failed', summaryCode: 'verification-command-failed' },
        );
      },
    });
  });

  it('fails local preflight without starting a process when the declared executable is unavailable', async () => {
    const normalized = localScenario();
    const driver = createFakeCommandDriver([commandResult({ startFailed: true })]);
    await withHarness({
      children: [],
      commandDriver: driver,
      normalized,
      run: async ({ launches, receiptStore, runner }) => {
        const adapter = createLocalAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await assert.rejects(() => adapter.preflight(baseContext()), { code: 'local-command-unavailable' });
        assert.equal(launches.length, 0);
      },
    });
  });

  it('reattaches only to a current watcher-owned token, not a reused PID, and cancels only that token', async () => {
    const normalized = localScenario({ verification: [] });
    const firstChild = new FakeChild(4242);
    const reusedPidChild = new FakeChild(4242);
    firstChild.onKill = () => setImmediate(() => firstChild.close(null, 'SIGTERM'));
    const driver = createFakeCommandDriver([commandResult()]);
    await withHarness({
      children: [firstChild, reusedPidChild],
      commandDriver: driver,
      normalized,
      run: async ({ receiptStore, runner }) => {
        const first = createLocalAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await first.preflight(baseContext());
        const started = await first.start(baseContext());
        const second = createLocalAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        const attached = await second.attach(baseContext({ target: started.target }));
        assert.equal(attached.status, 'attached');

        const cancelled = await second.cancel(baseContext({ target: started.target }));
        assert.equal(cancelled.status, 'cancelled');
        assert.deepEqual(firstChild.kills, ['SIGTERM']);

        const restarted = await first.restart(baseContext({ target: started.target }));
        assert.equal(restarted.target.attempt, 2);
        const stale = await second.attach(baseContext({ target: started.target }));
        assert.deepEqual(stale, { blocker: 'watcher-lost', status: 'blocked' });
        assert.deepEqual(reusedPidChild.kills, []);
      },
    });
  });

  it('normalizes a locally owned timeout without attempting a PID lookup', async () => {
    const normalized = localScenario({ verification: [] });
    const child = new FakeChild();
    child.onKill = () => setImmediate(() => child.close(null, 'SIGTERM'));
    const driver = createFakeCommandDriver([commandResult()]);
    await withHarness({
      children: [child],
      commandDriver: driver,
      normalized,
      run: async ({ receiptStore, runner }) => {
        const adapter = createLocalAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await adapter.preflight(baseContext());
        const started = await adapter.start(baseContext());
        await new Promise((resolve) => setTimeout(resolve, 1_100));
        const observation = await adapter.observe(baseContext({ target: started.target }));
        assert.deepEqual(
          { outcome: observation.outcome, status: observation.status, summaryCode: observation.summaryCode },
          { outcome: 'target_failed', status: 'failed', summaryCode: 'timed_out' },
        );
        assert.deepEqual(child.kills, ['SIGTERM']);
      },
    });
  });

  it('keeps a declared independent target cancellation distinct from a local process failure', async () => {
    const normalized = localScenario({ verification: [] });
    const child = new FakeChild();
    const driver = createFakeCommandDriver([commandResult()]);
    await withHarness({
      children: [child],
      normalized,
      run: async ({ receiptStore, runner }) => {
        const adapter = createLocalAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await adapter.preflight(baseContext());
        const started = await adapter.start(baseContext());
        child.close(null, 'SIGTERM');

        const observation = await adapter.observe(
          baseContext({ cancellationOutcome: 'target_cancelled', target: started.target }),
        );
        assert.deepEqual(
          { outcome: observation.outcome, status: observation.status },
          { outcome: 'target_cancelled', status: 'cancelled' },
        );
      },
    });
  });

  it('requires a zero Docker build exit and every image verification command before success', async () => {
    const normalized = dockerScenario({
      imageVerification: [
        { args: ['image', 'inspect', '{{watch.id}}'], cwd: '.', env: [], executable: 'docker' },
        { args: ['inspect', '{{watch.id}}'], cwd: '.', env: [], executable: 'docker' },
      ],
    });
    const child = new FakeChild();
    const driver = createFakeCommandDriver([commandResult(), commandResult(), commandResult()]);
    await withHarness({
      children: [child],
      commandDriver: driver,
      normalized,
      run: async ({ launches, receiptStore, runner }) => {
        const adapter = createDockerAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await adapter.preflight(baseContext());
        const started = await adapter.start(baseContext());
        assert.equal(launches[0].executable, 'docker');
        assert.equal(launches[0].options.shell, false);
        child.close(0);
        const observation = await adapter.observe(baseContext({ target: started.target }));
        assert.equal(observation.status, 'succeeded');
        assert.equal(observation.verificationCount, 2);
        assert.equal(driver.requests.length, 3);
      },
    });
  });

  it('does not infer Docker success from a stale image tag when inspection fails', async () => {
    const normalized = dockerScenario();
    const child = new FakeChild();
    const driver = createFakeCommandDriver([commandResult(), commandResult({ exitCode: 1 })]);
    await withHarness({
      children: [child],
      commandDriver: driver,
      normalized,
      run: async ({ receiptStore, runner }) => {
        const adapter = createDockerAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await adapter.preflight(baseContext());
        const started = await adapter.start(baseContext());
        child.close(0);
        const observation = await adapter.observe(baseContext({ target: started.target }));
        assert.deepEqual(
          { outcome: observation.outcome, status: observation.status },
          { outcome: 'verification_failed', status: 'failed' },
        );
      },
    });
  });

  it('rejects forbidden Docker registry, login, cleanup, and buildx operations before probing a daemon', async () => {
    const cases = [
      dockerScenario({ buildArgs: ['build', '--push', '.'] }),
      dockerScenario({ buildArgs: ['buildx', 'build', '.'] }),
      dockerScenario({ imageVerification: [{ args: ['login'], cwd: '.', env: [], executable: 'docker' }] }),
      dockerScenario({ imageVerification: [{ args: ['image', 'prune'], cwd: '.', env: [], executable: 'docker' }] }),
      dockerScenario({
        imageVerification: [{ args: ['container', 'rm', 'target'], cwd: '.', env: [], executable: 'docker' }],
      }),
      dockerScenario({
        imageVerification: [{ args: ['push', '{{watch.id}}'], cwd: '.', env: [], executable: 'docker' }],
      }),
    ];
    for (const normalized of cases) {
      const driver = createFakeCommandDriver([commandResult()]);
      await withHarness({
        children: [],
        commandDriver: driver,
        normalized,
        run: async ({ receiptStore, runner }) => {
          const adapter = createDockerAdapter({ commandDriver: driver, normalized, receiptStore, runner });
          await assert.rejects(() => adapter.preflight(baseContext()), {
            code: /forbidden-docker|docker-build-command-required/u,
          });
          assert.equal(driver.requests.length, 0);
        },
      });
    }
  });

  it('fails Docker preflight when the injected command driver cannot prove CLI and daemon availability', async () => {
    const normalized = dockerScenario();
    const driver = createFakeCommandDriver([commandResult({ startFailed: true })]);
    await withHarness({
      children: [],
      commandDriver: driver,
      normalized,
      run: async ({ launches, receiptStore, runner }) => {
        const adapter = createDockerAdapter({ commandDriver: driver, normalized, receiptStore, runner });
        await assert.rejects(() => adapter.preflight(baseContext()), { code: 'docker-daemon-unavailable' });
        assert.equal(launches.length, 0);
      },
    });
  });
});
