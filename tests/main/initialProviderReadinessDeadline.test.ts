import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INITIAL_PROVIDER_READINESS_TIMEOUT_MS,
  InitialProviderReadinessDeadline,
} from '@main/services/initialProviderReadinessDeadline';
import { InitialProviderReadinessTestDependencies } from './initialProviderReadinessTestUtils';

describe('InitialProviderReadinessDeadline', () => {
  it('settles once at the absolute deadline when provider work ignores abort', async () => {
    const dependencies = new InitialProviderReadinessTestDependencies();
    const deadline = new InitialProviderReadinessDeadline(dependencies);
    let settled = false;
    const operation = deadline
      .run(() => new Promise<never>(() => undefined))
      .then((result) => {
        settled = true;
        return result;
      });

    dependencies.clock.advanceBy(INITIAL_PROVIDER_READINESS_TIMEOUT_MS - 1);
    await Promise.resolve();
    assert.equal(settled, false);

    dependencies.clock.advanceBy(1);
    assert.deepEqual(await operation, { cause: 'timed-out', status: 'stopped' });
    assert.equal(deadline.signal.aborted, true);
    deadline.cancel();
    assert.equal(deadline.signal.aborted, true);
  });

  it('keeps caller cancellation distinct from timeout', async () => {
    const dependencies = new InitialProviderReadinessTestDependencies();
    const caller = new AbortController();
    const deadline = new InitialProviderReadinessDeadline(dependencies, caller.signal);
    const operation = deadline.run(() => new Promise<never>(() => undefined));

    caller.abort();

    assert.deepEqual(await operation, { cause: 'cancelled', status: 'stopped' });
    dependencies.clock.advanceBy(INITIAL_PROVIDER_READINESS_TIMEOUT_MS);
    assert.equal(deadline.signal.aborted, true);
  });

  it('fails closed to an immediate timeout when injected timer and abort construction throw', async () => {
    const deadline = new InitialProviderReadinessDeadline({
      clock: {
        clearTimeout: () => {
          throw new Error('private-clear-canary');
        },
        now: () => {
          throw new Error('private-clock-canary');
        },
        setTimeout: () => {
          throw new Error('private-timer-canary');
        },
      },
      createAbortController: () => {
        throw new Error('private-abort-canary');
      },
    });

    const result = await deadline.run(() => new Promise<never>(() => undefined));

    assert.deepEqual(result, { cause: 'timed-out', status: 'stopped' });
    assert.equal(deadline.signal.aborted, true);
    assert.doesNotMatch(JSON.stringify(result), /private|canary/u);
  });
});
