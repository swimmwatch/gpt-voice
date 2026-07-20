import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  registerBeforeBackgroundBrowserShutdownHook,
  runBeforeBackgroundBrowserShutdownHooks,
} from '@main/backgroundBrowserLifecycle';

describe('background browser lifecycle hooks', () => {
  it('runs registered hooks before teardown and removes them idempotently', async () => {
    const calls: string[] = [];
    const removeFirst = registerBeforeBackgroundBrowserShutdownHook(() => {
      calls.push('first');
    });
    const removeSecond = registerBeforeBackgroundBrowserShutdownHook(async () => {
      calls.push('second');
    });

    await runBeforeBackgroundBrowserShutdownHooks();
    removeFirst();
    removeFirst();
    await runBeforeBackgroundBrowserShutdownHooks();
    removeSecond();

    assert.deepEqual(calls, ['first', 'second', 'second']);
  });

  it('continues through hook failures so browser teardown cannot be blocked', async () => {
    const calls: string[] = [];
    const removeFailure = registerBeforeBackgroundBrowserShutdownHook(() => {
      calls.push('failure');
      throw new Error('expected');
    });
    const removeSuccess = registerBeforeBackgroundBrowserShutdownHook(() => {
      calls.push('success');
    });

    await runBeforeBackgroundBrowserShutdownHooks();
    removeFailure();
    removeSuccess();

    assert.deepEqual(calls, ['failure', 'success']);
  });
});
