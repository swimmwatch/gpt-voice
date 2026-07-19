/* eslint-disable max-classes-per-file -- Process and stream fakes are deliberately isolated in this boundary test. */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import {
  CLI_PROCESS_GRACE_PERIOD_MS,
  CliProcessFailureCode,
  CliProcessPhase,
  CliProcessRunner,
  createCliProcessEnvironment,
  type CliExecutableResolution,
  type CliProcessClock,
  type CliProcessFileSystem,
  type CliProcessRunInput,
} from '@main/services/prettifyCliRunner';

class FakeClock implements CliProcessClock {
  public nowMs = 100;
  private nextId = 1;
  private readonly timers = new Map<number, { callback: () => void; dueAt: number }>();

  public clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  public now(): number {
    return this.nowMs;
  }

  public setTimeout(callback: () => void, delayMs: number): unknown {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { callback, dueAt: this.nowMs + delayMs });
    return id;
  }

  public advance(delayMs: number): void {
    this.nowMs += delayMs;
    for (;;) {
      const timer = [...this.timers.entries()]
        .filter(([, value]) => value.dueAt <= this.nowMs)
        .sort(([, left], [, right]) => left.dueAt - right.dueAt)[0];
      if (!timer) return;
      this.timers.delete(timer[0]);
      timer[1].callback();
    }
  }

  public get timerCount(): number {
    return this.timers.size;
  }
}

class FakeOutput extends EventEmitter {
  public send(value: Uint8Array | string): void {
    this.emit('data', value);
  }
}

class FakeInput extends EventEmitter {
  public endedWith: string | Uint8Array | undefined;
  public throwOnEnd: Error | null = null;

  public end(value: string | Uint8Array): void {
    if (this.throwOnEnd) throw this.throwOnEnd;
    this.endedWith = value;
  }
}

class FakeChild extends EventEmitter {
  public readonly stderr = new FakeOutput();
  public readonly stdin = new FakeInput();
  public readonly stdout = new FakeOutput();
  public pid = 42;

  public close(exitCode: number | null, signal: NodeJS.Signals | null = null): void {
    this.emit('close', exitCode, signal);
  }

  public failToSpawn(): void {
    this.emit('error', new Error('synthetic'));
  }
}

interface FakeFileState {
  executable?: boolean;
  missing?: boolean;
}

class FakeFileSystem implements CliProcessFileSystem {
  public readonly accessCalls: string[] = [];
  public readonly directories: string[] = [];
  public readonly removeCalls: string[] = [];
  public readonly statCalls: string[] = [];
  public failRemove = false;

  constructor(private readonly files = new Map<string, FakeFileState>()) {}

  public async access(filePath: string): Promise<void> {
    this.accessCalls.push(filePath);
    if (!this.files.get(filePath)?.executable) {
      const error = Object.assign(new Error('synthetic'), { code: 'EACCES' });
      throw error;
    }
  }

  public async mkdtemp(prefix: string): Promise<string> {
    const directory = `${prefix}${this.directories.length + 1}`;
    this.directories.push(directory);
    return directory;
  }

  public async removeDirectory(directory: string): Promise<void> {
    this.removeCalls.push(directory);
    if (this.failRemove) throw new Error('synthetic');
  }

  public async stat(filePath: string): Promise<{ isFile(): boolean }> {
    this.statCalls.push(filePath);
    const state = this.files.get(filePath);
    if (!state || state.missing) {
      const error = Object.assign(new Error('synthetic'), { code: 'ENOENT' });
      throw error;
    }
    return { isFile: () => true };
  }
}

interface Harness {
  abortController: AbortController;
  child: FakeChild;
  clock: FakeClock;
  fileSystem: FakeFileSystem;
  forceCalls: number;
  gracefulCalls: number;
  spawnCalls: Array<{ args: string[]; executable: string; options: SpawnOptions }>;
  runner: CliProcessRunner;
}

function createHarness(
  options: {
    environment?: NodeJS.ProcessEnv;
    fileSystem?: FakeFileSystem;
    platform?: NodeJS.Platform;
    resolution?: CliExecutableResolution;
    useDefaultResolver?: boolean;
  } = {},
): Harness {
  const child = new FakeChild();
  const clock = new FakeClock();
  const fileSystem = options.fileSystem ?? new FakeFileSystem();
  const abortController = new AbortController();
  const spawnCalls: Array<{ args: string[]; executable: string; options: SpawnOptions }> = [];
  const state = { forceCalls: 0, gracefulCalls: 0 };
  const runner = new CliProcessRunner({
    clock,
    environment: options.environment ?? { LANG: 'en_US.UTF-8', PATH: '/gui-bin' },
    ...(options.useDefaultResolver
      ? {}
      : {
          executableResolver: async () => options.resolution ?? { executable: 'resolved-cli', status: 'resolved' },
        }),
    fileSystem,
    getTemporaryDirectory: () => path.join(path.sep, 'isolated'),
    platform: options.platform ?? 'linux',
    spawn: (executable, args, spawnOptions) => {
      spawnCalls.push({ args, executable, options: spawnOptions });
      return child as unknown as ChildProcess;
    },
    treeTerminator: {
      force: async () => {
        state.forceCalls += 1;
      },
      graceful: async () => {
        state.gracefulCalls += 1;
      },
    },
  });
  return {
    abortController,
    child,
    clock,
    fileSystem,
    get forceCalls() {
      return state.forceCalls;
    },
    get gracefulCalls() {
      return state.gracefulCalls;
    },
    spawnCalls,
    runner,
  };
}

function createInput(harness: Harness, overrides: Partial<CliProcessRunInput> = {}): CliProcessRunInput {
  return {
    args: ['--print', '--fixed-option'],
    executableName: 'claude',
    operationLabel: 'claude-cli-prettify',
    signal: harness.abortController.signal,
    stderrLimitBytes: 16,
    stdin: new Uint8Array([1, 2, 3]),
    stdoutLimitBytes: 16,
    timeoutMs: 500,
    ...overrides,
  };
}

async function settleStart(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('CliProcessRunner', () => {
  it('isolates cwd and environment, preserves argv, and streams source bytes only to stdin', async () => {
    const harness = createHarness({
      environment: {
        HOME: 'allowed-home',
        HTTP_PROXY: 'excluded',
        LANG: 'en_US.UTF-8',
        MODEL_OVERRIDE: 'excluded',
        PATH: '/gui-bin',
      },
    });
    const source = new Uint8Array([1, 2, 3]);
    const promise = harness.runner.run(createInput(harness, { stdin: source }));
    await settleStart();

    assert.deepEqual(harness.spawnCalls, [
      {
        args: ['--print', '--fixed-option'],
        executable: 'resolved-cli',
        options: {
          cwd: path.join(path.sep, 'isolated', 'gpt-voice-cli-1'),
          detached: true,
          env: { HOME: 'allowed-home', LANG: 'en_US.UTF-8', PATH: '/gui-bin' },
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        },
      },
    ]);
    assert.equal(harness.child.stdin.endedWith, source);
    harness.child.stdout.send(Uint8Array.from([8, 9]));
    harness.child.stderr.send(Uint8Array.from([7]));
    harness.child.close(0);

    const result = await promise;
    assert.deepEqual(result, {
      diagnostics: {
        cleanup: 'clean',
        durationMs: 0,
        executable: 'claude',
        exitCode: 0,
        operation: 'claude-cli-prettify',
        phase: CliProcessPhase.Completion,
        signal: null,
        stderrBytes: 1,
        stdoutBytes: 2,
      },
      stdout: Uint8Array.from([8, 9]),
      success: true,
    });
    assert.deepEqual(harness.fileSystem.removeCalls, [path.join(path.sep, 'isolated', 'gpt-voice-cli-1')]);
    assert.equal(harness.clock.timerCount, 0);
    assert.equal(harness.child.listenerCount('close'), 0);
  });

  it('copies only audited environment variables for every supported platform', () => {
    const environment = {
      APPDATA: 'app-data',
      HOME: 'home',
      LANG: 'locale',
      PATH: 'gui-path',
      TOKEN_HINT: 'excluded',
      XDG_CACHE_HOME: 'cache',
    };

    assert.deepEqual(createCliProcessEnvironment(environment, 'linux'), {
      HOME: 'home',
      LANG: 'locale',
      PATH: 'gui-path',
      XDG_CACHE_HOME: 'cache',
    });
    assert.deepEqual(createCliProcessEnvironment(environment, 'darwin'), {
      HOME: 'home',
      LANG: 'locale',
      PATH: 'gui-path',
    });
    assert.deepEqual(createCliProcessEnvironment(environment, 'win32'), {
      APPDATA: 'app-data',
      LANG: 'locale',
      PATH: 'gui-path',
    });
  });

  it('validates and invokes a configured executable path with spaces without splitting it', async () => {
    const configuredPath = path.join(path.sep, 'cli directory', 'claude');
    const fileSystem = new FakeFileSystem(new Map([[configuredPath, { executable: true }]]));
    const harness = createHarness({ fileSystem, useDefaultResolver: true });
    const promise = harness.runner.run(createInput(harness, { configuredExecutablePath: configuredPath }));
    await settleStart();

    assert.deepEqual(fileSystem.statCalls, [configuredPath]);
    assert.deepEqual(fileSystem.accessCalls, [configuredPath]);
    assert.equal(harness.spawnCalls[0]?.executable, configuredPath);
    harness.child.close(0);
    assert.equal((await promise).success, true);
  });

  it('uses GUI PATH discovery and classifies missing and non-executable paths before spawning', async () => {
    const foundPath = path.join(path.sep, 'gui-bin', 'claude');
    const fileSystem = new FakeFileSystem(new Map([[foundPath, { executable: true }]]));
    const harness = createHarness({ fileSystem, useDefaultResolver: true });
    const successful = harness.runner.run(createInput(harness));
    await settleStart();
    assert.equal(harness.spawnCalls[0]?.executable, foundPath);
    harness.child.close(0);
    assert.equal((await successful).success, true);

    const missing = createHarness({ resolution: { status: 'not-found' } });
    const missingResult = await missing.runner.run(createInput(missing));
    assert.equal(missingResult.success, false);
    if (!missingResult.success) assert.equal(missingResult.failure, CliProcessFailureCode.NotFound);
    assert.equal(missing.spawnCalls.length, 0);

    const invalid = createHarness({ resolution: { status: 'not-executable' } });
    const invalidResult = await invalid.runner.run(createInput(invalid));
    assert.equal(invalidResult.success, false);
    if (!invalidResult.success) assert.equal(invalidResult.failure, CliProcessFailureCode.NotExecutable);
    assert.equal(invalid.spawnCalls.length, 0);
  });

  it('uses PATHEXT for Windows PATH discovery and rejects a relative configured path', async () => {
    const windowsPath = path.win32.join('C:\\gui-bin', 'claude.EXE');
    const fileSystem = new FakeFileSystem(new Map([[windowsPath, { executable: true }]]));
    const harness = createHarness({
      environment: { PATH: 'C:\\gui-bin', PATHEXT: '.EXE' },
      fileSystem,
      platform: 'win32',
      useDefaultResolver: true,
    });
    const promise = harness.runner.run(createInput(harness));
    await settleStart();
    assert.equal(harness.spawnCalls[0]?.executable, windowsPath);
    assert.equal(harness.spawnCalls[0]?.options.detached, false);
    harness.child.close(0);
    assert.equal((await promise).success, true);

    const relative = createHarness({ useDefaultResolver: true });
    const result = await relative.runner.run(
      createInput(relative, { configuredExecutablePath: 'not-an-absolute-path' }),
    );
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.failure, CliProcessFailureCode.NotExecutable);
    assert.equal(relative.spawnCalls.length, 0);
  });

  it('classifies spawn, stdin, nonzero-exit, and signal-exit failures without raw process details', async () => {
    const spawnFailure = createHarness();
    const spawnPromise = spawnFailure.runner.run(createInput(spawnFailure));
    await settleStart();
    spawnFailure.child.failToSpawn();
    const spawnResult = await spawnPromise;
    assert.equal(spawnResult.success, false);
    if (!spawnResult.success) assert.equal(spawnResult.failure, CliProcessFailureCode.SpawnError);

    const stdinFailure = createHarness();
    const stdinPromise = stdinFailure.runner.run(createInput(stdinFailure));
    await settleStart();
    stdinFailure.child.stdin.emit('error', Object.assign(new Error('synthetic'), { code: 'EPIPE' }));
    stdinFailure.child.close(null, 'SIGTERM');
    const stdinResult = await stdinPromise;
    assert.equal(stdinResult.success, false);
    if (!stdinResult.success) assert.equal(stdinResult.failure, CliProcessFailureCode.StdinEpipe);

    const nonzero = createHarness();
    const nonzeroPromise = nonzero.runner.run(createInput(nonzero));
    await settleStart();
    nonzero.child.close(2);
    const nonzeroResult = await nonzeroPromise;
    assert.equal(nonzeroResult.success, false);
    if (!nonzeroResult.success) assert.equal(nonzeroResult.failure, CliProcessFailureCode.NonzeroExit);

    const signal = createHarness();
    const signalPromise = signal.runner.run(createInput(signal));
    await settleStart();
    signal.child.close(null, 'SIGTERM');
    const signalResult = await signalPromise;
    assert.equal(signalResult.success, false);
    if (!signalResult.success) assert.equal(signalResult.failure, CliProcessFailureCode.SignalExit);
  });

  it('enforces independent output limits and retains only a sanitized optional stderr excerpt', async () => {
    const stdoutLimit = createHarness();
    const stdoutPromise = stdoutLimit.runner.run(createInput(stdoutLimit, { stdoutLimitBytes: 1 }));
    await settleStart();
    stdoutLimit.child.stdout.send(Uint8Array.from([1, 2]));
    stdoutLimit.clock.advance(CLI_PROCESS_GRACE_PERIOD_MS);
    const stdoutResult = await stdoutPromise;
    assert.equal(stdoutResult.success, false);
    if (!stdoutResult.success) assert.equal(stdoutResult.failure, CliProcessFailureCode.StdoutLimit);
    assert.equal(stdoutLimit.gracefulCalls, 1);
    assert.equal(stdoutLimit.forceCalls, 1);

    const stderrLimit = createHarness();
    const stderrPromise = stderrLimit.runner.run(
      createInput(stderrLimit, { includeStderrExcerpt: true, stderrLimitBytes: 1 }),
    );
    await settleStart();
    const protectedLocation = ['/', 'masked', 'location'].join('');
    stderrLimit.child.stderr.send(`detail ${protectedLocation}`);
    stderrLimit.clock.advance(CLI_PROCESS_GRACE_PERIOD_MS);
    const stderrResult = await stderrPromise;
    assert.equal(stderrResult.success, false);
    if (!stderrResult.success) {
      assert.equal(stderrResult.failure, CliProcessFailureCode.StderrLimit);
      assert.doesNotMatch(stderrResult.stderrExcerpt ?? '', /masked/u);
      assert.ok((stderrResult.stderrExcerpt?.length ?? 0) <= 2_048);
    }
  });

  it('keeps the first terminal cause across timeout, cancellation, and forced tree cleanup', async () => {
    const timeout = createHarness();
    const timeoutPromise = timeout.runner.run(createInput(timeout, { timeoutMs: 5 }));
    await settleStart();
    timeout.clock.advance(5);
    timeout.abortController.abort();
    timeout.clock.advance(CLI_PROCESS_GRACE_PERIOD_MS);
    const timeoutResult = await timeoutPromise;
    assert.equal(timeoutResult.success, false);
    if (!timeoutResult.success) assert.equal(timeoutResult.failure, CliProcessFailureCode.TimedOut);
    assert.equal(timeout.gracefulCalls, 1);
    assert.equal(timeout.forceCalls, 1);

    const cancelled = createHarness();
    const cancelledPromise = cancelled.runner.run(createInput(cancelled));
    await settleStart();
    cancelled.abortController.abort();
    cancelled.clock.advance(CLI_PROCESS_GRACE_PERIOD_MS);
    const cancelledResult = await cancelledPromise;
    assert.equal(cancelledResult.success, false);
    if (!cancelledResult.success) assert.equal(cancelledResult.failure, CliProcessFailureCode.Cancelled);
  });

  it('reports cleanup failure only after an otherwise successful command and cleans each temporary directory once', async () => {
    const fileSystem = new FakeFileSystem();
    fileSystem.failRemove = true;
    const harness = createHarness({ fileSystem });
    const promise = harness.runner.run(createInput(harness));
    await settleStart();
    harness.child.close(0);
    const result = await promise;

    assert.deepEqual(result, {
      diagnostics: {
        cleanup: 'failed',
        durationMs: 0,
        executable: 'claude',
        exitCode: 0,
        operation: 'claude-cli-prettify',
        phase: CliProcessPhase.Cleanup,
        signal: null,
        stderrBytes: 0,
        stdoutBytes: 0,
      },
      failure: CliProcessFailureCode.CleanupFailure,
      success: false,
    });
    assert.equal(fileSystem.removeCalls.length, 1);
  });
});
