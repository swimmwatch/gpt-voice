import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BackgroundBrowserOperationQueue } from '@main/backgroundBrowserOperationQueue';

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let complete!: () => void;
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
}

describe('BackgroundBrowserOperationQueue', () => {
  it('does not let a switch run until an earlier startup operation finishes', async () => {
    const queue = new BackgroundBrowserOperationQueue();
    const startup = createDeferred();
    const calls: string[] = [];

    const initializing = queue.run(async () => {
      calls.push('startup');
      await startup.promise;
      calls.push('startup-finished');
    });
    const switching = queue.run(() => {
      calls.push('switch');
    });

    await Promise.resolve();
    assert.deepEqual(calls, ['startup']);

    startup.resolve();
    await Promise.all([initializing, switching]);
    assert.deepEqual(calls, ['startup', 'startup-finished', 'switch']);
  });

  it('continues with a later switch after an earlier lifecycle operation fails', async () => {
    const queue = new BackgroundBrowserOperationQueue();
    const calls: string[] = [];

    const failedStartup = queue.run(() => {
      calls.push('startup');
      throw new Error('expected startup failure');
    });
    const switching = queue.run(() => {
      calls.push('switch');
    });

    await assert.rejects(failedStartup, /expected startup failure/u);
    await switching;
    assert.deepEqual(calls, ['startup', 'switch']);
  });
});
