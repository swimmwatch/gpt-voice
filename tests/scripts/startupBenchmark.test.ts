import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

interface StartupBenchmarkReport {
  arch: string;
  durationsMs: number[];
  medianMs: number;
  platform: string;
  runCount: number;
  toolVersions: Record<string, string | null>;
}

interface StartupBenchmarkModule {
  calculateMedian: (durationsMs: readonly number[]) => number;
  getPackagedStartupExecutableCandidates: (rootDir: string, platform: string, arch: string) => string[];
  getStartupBenchmarkLaunchArguments: (userDataPath: string, platform: string) => string[];
  getStartupBenchmarkSpawnOptions: (input: { cwd: string; env: NodeJS.ProcessEnv; platform: string }) => {
    cwd: string;
    detached: boolean;
    env: NodeJS.ProcessEnv;
    stdio: ['ignore', 'pipe', 'ignore'];
    windowsHide: boolean;
  };
  normalizeRunCount: (value: string | undefined) => number;
  runStartupBenchmark: (input: {
    arch: string;
    measureRun: (runIndex: number) => Promise<number>;
    platform: string;
    runCount: number;
    toolVersions: Record<string, string | null>;
  }) => Promise<StartupBenchmarkReport>;
  waitForChildExit: (child: {
    exitCode: number | null;
    signalCode: string | null;
    once: (event: 'exit', listener: () => void) => void;
  }) => Promise<void>;
  waitForChildExitWithin: (
    child: {
      exitCode: number | null;
      signalCode: string | null;
      once: (event: 'exit', listener: () => void) => void;
      off?: (event: 'exit', listener: () => void) => void;
    },
    timeoutMs: number,
  ) => Promise<boolean>;
  terminateStartupBenchmarkChild: (
    child: {
      exitCode: number | null;
      signalCode: string | null;
      pid?: number;
      kill: (signal: NodeJS.Signals) => void;
      once: (event: 'exit', listener: () => void) => void;
      off?: (event: 'exit', listener: () => void) => void;
    },
    platform: string,
    options?: {
      forceWaitMs?: number;
      graceMs?: number;
      killProcess?: (pid: number, signal: NodeJS.Signals) => void;
    },
  ) => Promise<{ exited: boolean; forced: boolean }>;
}

const projectRoot = path.resolve(__dirname, '..', '..');
const modulePath = path.join(projectRoot, 'scripts', 'startup-benchmark.mjs');

function isStartupBenchmarkModule(value: unknown): value is StartupBenchmarkModule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const module = value as Record<string, unknown>;
  return (
    typeof module.calculateMedian === 'function' &&
    typeof module.getPackagedStartupExecutableCandidates === 'function' &&
    typeof module.getStartupBenchmarkLaunchArguments === 'function' &&
    typeof module.getStartupBenchmarkSpawnOptions === 'function' &&
    typeof module.normalizeRunCount === 'function' &&
    typeof module.runStartupBenchmark === 'function' &&
    typeof module.waitForChildExit === 'function' &&
    typeof module.waitForChildExitWithin === 'function' &&
    typeof module.terminateStartupBenchmarkChild === 'function'
  );
}

describe('startup benchmark helpers', () => {
  it('uses a deterministic median and rejects invalid duration input', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isStartupBenchmarkModule(importedModule));

    assert.equal(importedModule.calculateMedian([30, 10, 20]), 20);
    assert.equal(importedModule.calculateMedian([10, 20, 30, 40]), 25);
    assert.throws(() => importedModule.calculateMedian([]), /at least one duration/i);
    assert.throws(() => importedModule.calculateMedian([10, -1]), /non-negative/i);
  });

  it('normalizes run counts and records every isolated measurement', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isStartupBenchmarkModule(importedModule));
    const measuredRuns: number[] = [];

    const report = await importedModule.runStartupBenchmark({
      arch: 'x64',
      measureRun: async (runIndex) => {
        measuredRuns.push(runIndex);
        return [300, 100, 200][runIndex] ?? 0;
      },
      platform: 'linux',
      runCount: importedModule.normalizeRunCount('3'),
      toolVersions: { electron: '43.0.0', node: 'v24.14.0' },
    });

    assert.deepEqual(measuredRuns, [0, 1, 2]);
    assert.deepEqual(report, {
      arch: 'x64',
      durationsMs: [300, 100, 200],
      medianMs: 200,
      platform: 'linux',
      runCount: 3,
      toolVersions: { electron: '43.0.0', node: 'v24.14.0' },
    });
    assert.equal(importedModule.normalizeRunCount(undefined), 10);
    assert.throws(() => importedModule.normalizeRunCount('0'), /between 1 and 50/i);
    assert.throws(() => importedModule.normalizeRunCount('invalid'), /between 1 and 50/i);
  });

  it('resolves packaged executable candidates for the active platform layouts', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isStartupBenchmarkModule(importedModule));

    assert.deepEqual(importedModule.getPackagedStartupExecutableCandidates('/project', 'linux', 'x64'), [
      '/project/release/linux-unpacked/gpt-voice',
    ]);
    assert.deepEqual(importedModule.getPackagedStartupExecutableCandidates('/project', 'win32', 'x64'), [
      '/project/release/win-unpacked/gpt-voice.exe',
      '/project/release/win-unpacked/GPT-Voice.exe',
    ]);
    assert.deepEqual(importedModule.getPackagedStartupExecutableCandidates('/project', 'darwin', 'arm64'), [
      '/project/release/mac-arm64/GPT-Voice.app/Contents/MacOS/GPT-Voice',
      '/project/release/mac-universal/GPT-Voice.app/Contents/MacOS/GPT-Voice',
    ]);
    assert.throws(
      () => importedModule.getPackagedStartupExecutableCandidates('/project', 'freebsd', 'x64'),
      /unsupported startup benchmark platform/i,
    );
  });

  it('disables the sandbox only for Linux startup benchmarks', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isStartupBenchmarkModule(importedModule));

    assert.deepEqual(importedModule.getStartupBenchmarkLaunchArguments('/tmp/gpt-voice', 'linux'), [
      '--user-data-dir=/tmp/gpt-voice',
      '--startup-benchmark',
      '--no-sandbox',
    ]);
    assert.deepEqual(importedModule.getStartupBenchmarkLaunchArguments('C:\\temp\\gpt-voice', 'win32'), [
      '--user-data-dir=C:\\temp\\gpt-voice',
      '--startup-benchmark',
    ]);
    assert.deepEqual(importedModule.getStartupBenchmarkLaunchArguments('/tmp/gpt-voice', 'darwin'), [
      '--user-data-dir=/tmp/gpt-voice',
      '--startup-benchmark',
    ]);
  });

  it('discards Electron stderr and detaches only Unix startup benchmark process groups', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isStartupBenchmarkModule(importedModule));
    const environment = { PATH: '/bin' };

    assert.deepEqual(
      importedModule.getStartupBenchmarkSpawnOptions({
        cwd: '/project',
        env: environment,
        platform: 'linux',
      }),
      {
        cwd: '/project',
        detached: true,
        env: environment,
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    );
    assert.equal(
      importedModule.getStartupBenchmarkSpawnOptions({
        cwd: 'C:\\project',
        env: environment,
        platform: 'win32',
      }).detached,
      false,
    );
  });

  it('does not wait for an exit event that has already occurred', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isStartupBenchmarkModule(importedModule));
    const exitedChild = {
      exitCode: 0,
      signalCode: null,
      once: () => {
        throw new Error('already-exited children must not register an exit listener');
      },
    };

    await importedModule.waitForChildExit(exitedChild);

    let exitListener: (() => void) | undefined;
    const runningChild = {
      exitCode: null,
      signalCode: null,
      once: (event: 'exit', listener: () => void) => {
        assert.equal(event, 'exit');
        exitListener = listener;
      },
    };
    const waitForExit = importedModule.waitForChildExit(runningChild);
    assert.ok(exitListener);
    exitListener();

    await waitForExit;
  });

  it('bounds exit waits and removes timeout listeners', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isStartupBenchmarkModule(importedModule));
    let registeredListener: (() => void) | undefined;
    let removedListener: (() => void) | undefined;
    const child: {
      exitCode: number | null;
      signalCode: string | null;
      once: (event: 'exit', listener: () => void) => void;
      off: (event: 'exit', listener: () => void) => void;
    } = {
      exitCode: null,
      signalCode: null,
      once: (_event: 'exit', listener: () => void) => {
        registeredListener = listener;
      },
      off: (_event: 'exit', listener: () => void) => {
        removedListener = listener;
      },
    };

    assert.equal(await importedModule.waitForChildExitWithin(child, 1), false);
    assert.ok(registeredListener);
    assert.equal(removedListener, registeredListener);
    assert.throws(() => importedModule.waitForChildExitWithin(child, -1), /non-negative integer/i);
  });

  it('escalates Unix benchmark cleanup from the process group to SIGKILL', async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    assert.ok(isStartupBenchmarkModule(importedModule));
    let exitListener: (() => void) | undefined;
    const signals: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    const child: {
      exitCode: number | null;
      signalCode: string | null;
      pid: number;
      kill: (signal: NodeJS.Signals) => void;
      once: (event: 'exit', listener: () => void) => void;
      off: (event: 'exit', listener: () => void) => void;
    } = {
      exitCode: null,
      signalCode: null,
      pid: 42,
      kill: () => {
        throw new Error('Unix cleanup must target the detached process group');
      },
      once: (_event: 'exit', listener: () => void) => {
        exitListener = listener;
      },
      off: () => undefined,
    };

    const result = await importedModule.terminateStartupBenchmarkChild(child, 'linux', {
      forceWaitMs: 20,
      graceMs: 1,
      killProcess: (pid, signal) => {
        signals.push({ pid, signal });
        if (signal === 'SIGKILL') {
          child.signalCode = 'SIGKILL';
          exitListener?.();
        }
      },
    });

    assert.deepEqual(signals, [
      { pid: -42, signal: 'SIGTERM' },
      { pid: -42, signal: 'SIGKILL' },
    ]);
    assert.deepEqual(result, { exited: true, forced: true });
  });
});
