import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import process from 'node:process';
import { setImmediate } from 'node:timers';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  BoundedEvidenceBuffer,
  DeadlineAwarePoller,
  ManagedProcessRunner,
  MonotonicDeadline,
  ProcessAdapter,
  RuntimeCoreError,
  assertSupportedNodeRuntime,
  buildAllowlistedEnvironment,
  createFailureFingerprint,
  isPathInside,
  normalizeProcessTerminal,
  validateExecutable,
  validateProcessArguments,
} from '../../../.agents/skills/watch-process/scripts/lib/process-watch-runtime-core.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fixturePath = path.join(repositoryRoot, 'tests/skills/watchProcess/fixtures/runtime-child.mjs');
const fixtureDirectory = 'tests/skills/watchProcess/fixtures';
const START_TOKEN = 'a'.repeat(32);

/** Disposable ChildProcess-compatible fixture with explicit close and kill control. */
class FakeChild extends EventEmitter {
  constructor(pid = 4321) {
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

function createFakeRunner({ child, ...options } = {}) {
  let spawned = null;
  const runner = new ManagedProcessRunner({
    environmentAllowlist: ['FIXTURE_ALLOWED'],
    inheritedEnvironment: {
      FIXTURE_ALLOWED: 'allowed',
      FIXTURE_BLOCKED: 'blocked',
    },
    platform: 'win32',
    signalProcess: () => {
      throw new Error('Windows must not signal a POSIX process group');
    },
    spawnProcess: (executable, arguments_, spawnOptions) => {
      spawned = { arguments_, executable, options: spawnOptions };
      return child;
    },
    startTokenFactory: () => START_TOKEN,
    terminationGraceMilliseconds: 100,
    workspaceRoot: repositoryRoot,
    ...options,
  });
  return { runner, spawned: () => spawned };
}

function processRequest(overrides = {}) {
  return {
    args: ['--version'],
    cwd: '.',
    env: { FIXTURE_DECLARED: 'declared' },
    executable: process.execPath,
    timeoutMilliseconds: 1_000,
    ...overrides,
  };
}

describe('watch-process portable runtime core', () => {
  it('accepts Node 22 and 24 explicitly and rejects unsupported versions', () => {
    assert.deepEqual(assertSupportedNodeRuntime('v22.17.0'), { major: 22, version: 'v22.17.0' });
    assert.deepEqual(assertSupportedNodeRuntime('24.0.0'), { major: 24, version: '24.0.0' });
    assert.throws(() => assertSupportedNodeRuntime('v23.0.0'), { code: 'unsupported-node-runtime' });
    assert.throws(() => assertSupportedNodeRuntime('v24'), { code: 'unsupported-node-runtime' });
  });

  it('validates direct executables and preserves argument order and Unicode bytes', () => {
    const arguments_ = validateProcessArguments(['', 'first value', 'юникод', '--literal=${not-expanded}']);
    assert.deepEqual(arguments_, ['', 'first value', 'юникод', '--literal=${not-expanded}']);
    assert.equal(validateExecutable(process.execPath), process.execPath);
    assert.throws(() => validateExecutable('node; rm -rf /'), { code: 'invalid-executable' });
    assert.throws(() => validateExecutable('node $(whoami)'), { code: 'invalid-executable' });
    assert.throws(() => validateProcessArguments(['safe\u0000unsafe']), { code: 'invalid-process-arguments' });
  });

  it('creates a child environment only from the explicit allowlist and declared non-secret values', () => {
    const environment = buildAllowlistedEnvironment({
      declaredEnvironment: { DECLARED: 'visible' },
      inheritedEnvironment: { ALLOWED: 'visible', BLOCKED: 'hidden' },
      names: ['ALLOWED'],
    });
    assert.deepEqual(environment, { ALLOWED: 'visible', DECLARED: 'visible' });
    assert.throws(() => buildAllowlistedEnvironment({ declaredEnvironment: { API_TOKEN: 'not-allowed' } }), {
      code: 'declared-secret-environment-not-allowed',
    });
  });

  it('runs a disposable fixture with exact arguments, cwd, a restricted environment, and bounded output', async () => {
    const runner = new ManagedProcessRunner({
      environmentAllowlist: ['FIXTURE_ALLOWED'],
      inheritedEnvironment: { FIXTURE_ALLOWED: 'allowed', FIXTURE_BLOCKED: 'blocked' },
      workspaceRoot: repositoryRoot,
    });
    const result = await runner.run({
      args: [fixturePath, 'verify-contract', 'first value', 'юникод'],
      cwd: fixtureDirectory,
      env: { FIXTURE_DECLARED: 'declared' },
      evidence: { maximumBytes: 64, maximumFailures: 2, maximumMilliseconds: 1_000 },
      executable: process.execPath,
      timeoutMilliseconds: 5_000,
    });

    assert.equal(result.terminal.classification, 'succeeded');
    assert.equal(result.terminal.succeeded, true);
    assert.equal(result.evidence.capturedBytes, 64);
    assert.equal(result.evidence.truncated, true);
    assert.equal(Object.hasOwn(result.evidence, 'raw'), false);
  });

  it('always invokes spawn with shell disabled and exact validated values', async () => {
    const child = new FakeChild();
    const { runner, spawned } = createFakeRunner({ child });
    const execution = await runner.start(processRequest({ args: ['first value', 'юникод'] }));
    const launch = spawned();

    assert.equal(launch.executable, process.execPath);
    assert.deepEqual(launch.arguments_, ['first value', 'юникод']);
    assert.equal(launch.options.cwd, repositoryRoot);
    assert.deepEqual(launch.options.env, { FIXTURE_ALLOWED: 'allowed', FIXTURE_DECLARED: 'declared' });
    assert.equal(launch.options.env.FIXTURE_BLOCKED, undefined);
    assert.equal(launch.options.shell, false);
    assert.equal(launch.options.windowsHide, true);
    child.close(0);
    assert.equal((await execution.wait()).terminal.classification, 'succeeded');
  });

  it('rejects an invalid workspace cwd before a child can be created', async () => {
    const child = new FakeChild();
    const { runner, spawned } = createFakeRunner({ child });
    await assert.rejects(() => runner.start(processRequest({ cwd: '..' })), {
      code: 'working-directory-outside-workspace',
    });
    assert.equal(spawned(), null);
  });

  it('normalizes nonzero exit and signal termination without error text', async () => {
    const nonzeroChild = new FakeChild();
    const nonzero = createFakeRunner({ child: nonzeroChild });
    const nonzeroExecution = await nonzero.runner.start(processRequest());
    nonzeroChild.stderr.write('sensitive output is private');
    nonzeroChild.close(7);
    const nonzeroResult = await nonzeroExecution.wait();
    assert.deepEqual(nonzeroResult.terminal, {
      classification: 'nonzero_exit',
      exitCode: 7,
      signal: null,
      succeeded: false,
    });

    const signalledChild = new FakeChild();
    const signalled = createFakeRunner({ child: signalledChild });
    const signalledExecution = await signalled.runner.start(processRequest());
    signalledChild.close(null, 'SIGTERM');
    assert.equal((await signalledExecution.wait()).terminal.classification, 'signalled');
  });

  it('aborts only a token-owned child and removes the ownership record after close', async () => {
    const child = new FakeChild();
    child.onKill = () => setImmediate(() => child.close(null, 'SIGTERM'));
    const { runner } = createFakeRunner({ child });
    const execution = await runner.start(processRequest());
    assert.equal(runner.owns(execution.identity.startToken), true);
    const result = await runner.abortOwned(execution.identity.startToken);
    assert.equal(result.terminal.classification, 'aborted');
    assert.deepEqual(child.kills, ['SIGTERM']);
    assert.equal(runner.owns(execution.identity.startToken), false);
    assert.equal(typeof runner.abortByPid, 'undefined');
    await assert.rejects(() => runner.abortOwned('b'.repeat(32)), { code: 'owned-process-not-found' });
  });

  it('enforces the deadline and requests owned cleanup without relying on a PID lookup', async () => {
    const child = new FakeChild();
    child.onKill = () => setImmediate(() => child.close(null, 'SIGTERM'));
    const { runner } = createFakeRunner({ child });
    const execution = await runner.start(processRequest({ timeoutMilliseconds: 20 }));
    const result = await execution.wait();
    assert.equal(result.terminal.classification, 'timed_out');
    assert.deepEqual(child.kills, ['SIGTERM']);
    assert.equal(result.cleanup.requested, true);
    assert.equal(result.cleanup.treeVerified, false);
  });

  it('bounds raw output by bytes, time, and failure-code count while exposing only safe summaries', () => {
    let now = 0;
    const evidence = new BoundedEvidenceBuffer({
      clock: () => now,
      maximumBytes: 4,
      maximumFailures: 1,
      maximumMilliseconds: 10,
    });
    evidence.append('stdout', 'abcdef');
    evidence.recordFailure('nonzero-exit');
    assert.equal(evidence.recordFailure('signal'), false);
    now = 10;
    evidence.append('stderr', 'later');
    const summary = evidence.summary();
    assert.deepEqual(summary.failureCodes, ['nonzero-exit']);
    assert.equal(summary.failureLimitReached, true);
    assert.equal(summary.capturedBytes, 4);
    assert.equal(summary.timeLimitReached, true);
    assert.equal(summary.truncated, true);
    assert.equal(JSON.stringify(summary).includes('abcdef'), false);
  });

  it('uses only identity and sanitized classifications in stable failure fingerprints', () => {
    const attemptIdentity = {
      attempt: 2,
      sourceSha: 'b'.repeat(64),
      startToken: START_TOKEN,
      targetId: 'run-123',
      watchId: 'local-test',
    };
    const terminal = normalizeProcessTerminal({ exitCode: 7 });
    const firstEvidence = new BoundedEvidenceBuffer();
    const secondEvidence = new BoundedEvidenceBuffer();
    firstEvidence.append('stderr', 'secret=A');
    secondEvidence.append('stderr', 'secret=B');
    const first = createFailureFingerprint({ attemptIdentity, evidence: firstEvidence.summary(), terminal });
    const second = createFailureFingerprint({ attemptIdentity, evidence: secondEvidence.summary(), terminal });
    assert.match(first, /^[a-f0-9]{64}$/u);
    assert.equal(first, second);
    assert.throws(
      () =>
        createFailureFingerprint({
          attemptIdentity: { ...attemptIdentity, targetId: '/tmp/not-allowed' },
          evidence: firstEvidence.summary(),
          terminal,
        }),
      { code: 'invalid-attempt-identity' },
    );
  });

  it('uses bounded exponential backoff and stops once an observation is terminal', async () => {
    let now = 0;
    const delays = [];
    const deadline = new MonotonicDeadline({ clock: () => now, timeoutMilliseconds: 2_500 });
    const poller = new DeadlineAwarePoller({
      clock: () => now,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
        now += milliseconds;
      },
    });
    const result = await poller.poll({
      deadline,
      observe: async ({ attempt }) => ({ terminal: attempt === 2 }),
      poll: { initialSeconds: 1, maxSeconds: 2, multiplier: 2 },
    });
    assert.deepEqual(delays, [1_000]);
    assert.equal(result.kind, 'terminal');
    assert.equal(result.attempts, 2);
  });

  it('handles Windows drive and UNC containment through Node path APIs', () => {
    assert.equal(isPathInside('C:\\workspace', 'C:\\workspace\\nested', path.win32), true);
    assert.equal(isPathInside('C:\\workspace', 'C:\\other', path.win32), false);
    assert.equal(isPathInside('\\\\server\\share\\workspace', '\\\\server\\share\\outside', path.win32), false);
  });

  it('keeps the adapter contract provider-neutral and its default implementation inert', async () => {
    const adapter = new ProcessAdapter();
    await assert.rejects(
      () => adapter.preflight({}),
      (error) => error instanceof RuntimeCoreError && error.code === 'adapter-method-not-implemented',
    );
  });

  it('imports only Node built-ins and relative base-library modules', async () => {
    const libraryDirectory = path.join(repositoryRoot, '.agents/skills/watch-process/scripts/lib');
    const runtimeFiles = (await readdir(libraryDirectory)).filter((name) =>
      [
        'bounded-evidence-buffer.mjs',
        'deadline-aware-poller.mjs',
        'failure-fingerprint.mjs',
        'managed-process-execution.mjs',
        'managed-process-runner.mjs',
        'managed-process-support.mjs',
        'monotonic-deadline.mjs',
        'process-watch-runtime-core.mjs',
        'runtime-contracts.mjs',
        'runtime-core-support.mjs',
        'runtime-preflight.mjs',
      ].includes(name),
    );
    for (const fileName of runtimeFiles) {
      const source = await readFile(path.join(libraryDirectory, fileName), 'utf8');
      for (const [, sourceName] of source.matchAll(/from\s+['"]([^'"]+)['"]/gu)) {
        assert.equal(sourceName.startsWith('node:') || sourceName.startsWith('./'), true, `${fileName}: ${sourceName}`);
      }
    }
  });
});
