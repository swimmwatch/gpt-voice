import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { NodeTestRunner, nodeTestArguments, parseNodeTestRunnerArguments } from '@scripts/node-test-runner.mjs';

test('Node CI test runner validates concurrency and shard arguments', () => {
  assert.deepEqual(parseNodeTestRunnerArguments([], 12), { concurrency: 12, shard: null });
  assert.deepEqual(parseNodeTestRunnerArguments(['--concurrency=2', '--shard=3/4'], 12), {
    concurrency: 2,
    shard: { index: 3, total: 4 },
  });

  const invalidArguments = [
    ['--concurrency=0', 'INVALID_CONCURRENCY'],
    ['--concurrency=2', '--concurrency=4', 'DUPLICATE_CONCURRENCY'],
    ['--shard=0/4', 'INVALID_SHARD'],
    ['--shard=5/4', 'INVALID_SHARD'],
    ['--shard=1/4', '--shard=2/4', 'DUPLICATE_SHARD'],
    ['--unknown', 'UNKNOWN_ARGUMENT'],
  ] as const;
  for (const entry of invalidArguments) {
    const expectedCode = entry[entry.length - 1];
    const arguments_ = entry.slice(0, -1);
    assert.throws(
      () => parseNodeTestRunnerArguments(arguments_),
      (error: unknown) =>
        error instanceof Error && error.name === 'NodeTestRunnerArgumentError' && error.message === expectedCode,
    );
  }
});

test('Node CI test runner creates the exact shell-free Node test command', () => {
  assert.deepEqual(nodeTestArguments({ concurrency: 4, shard: null }), [
    '--import',
    'tsx',
    '--test',
    '--test-concurrency=4',
    'tests/**/*.test.ts',
  ]);
  assert.deepEqual(nodeTestArguments({ concurrency: 2, shard: { index: 1, total: 4 } }), [
    '--import',
    'tsx',
    '--test',
    '--test-concurrency=2',
    '--test-shard=1/4',
    'tests/**/*.test.ts',
  ]);
});

test('Node CI test runner reports bounded telemetry and preserves child failure', async () => {
  const child = new EventEmitter();
  const output: string[] = [];
  const spawnCalls: Array<{ arguments: readonly string[]; command: string; options: unknown }> = [];
  const clockValues = [100, 225];
  const runner = new NodeTestRunner({
    clock: () => clockValues.shift() ?? 225,
    nodeVersion: 'v24.0.0',
    parallelism: 4,
    spawnProcess: (command: string, arguments_: readonly string[], options: unknown) => {
      spawnCalls.push({ arguments: arguments_, command, options });
      queueMicrotask(() => child.emit('close', 7, null));
      return child;
    },
    writeOutput: (value: string) => output.push(value),
  });

  const outcome = await runner.run({ concurrency: 4, shard: null });

  assert.deepEqual(outcome, { exitCode: 7, signal: null });
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0]?.command, process.execPath);
  assert.deepEqual(spawnCalls[0]?.arguments, nodeTestArguments({ concurrency: 4, shard: null }));
  assert.deepEqual(spawnCalls[0]?.options, { stdio: 'inherit', windowsHide: true });
  assert.deepEqual(output, [
    '[node-test-ci] node=v24.0.0 availableParallelism=4 concurrency=4 shard=all\n',
    '[node-test-ci] elapsedMs=125 exitCode=7 signal=none\n',
  ]);

  const signaledChild = new EventEmitter();
  const signaledRunner = new NodeTestRunner({
    spawnProcess: () => {
      queueMicrotask(() => signaledChild.emit('close', null, 'SIGTERM'));
      return signaledChild;
    },
    writeOutput: () => undefined,
  });
  assert.deepEqual(await signaledRunner.run({ concurrency: 4, shard: null }), {
    exitCode: null,
    signal: 'SIGTERM',
  });
});
