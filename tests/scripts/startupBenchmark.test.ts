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
  normalizeRunCount: (value: string | undefined) => number;
  runStartupBenchmark: (input: {
    arch: string;
    measureRun: (runIndex: number) => Promise<number>;
    platform: string;
    runCount: number;
    toolVersions: Record<string, string | null>;
  }) => Promise<StartupBenchmarkReport>;
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
    typeof module.normalizeRunCount === 'function' &&
    typeof module.runStartupBenchmark === 'function'
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
});
