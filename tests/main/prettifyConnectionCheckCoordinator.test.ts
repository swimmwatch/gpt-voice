/* eslint-disable max-classes-per-file -- Owner and runtime fakes retain independent lifecycle state. */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { PrettifyConnectionCheckCoordinator } from '@main/services/prettifyConnectionCheckCoordinator';
import type { PrettifyCliConnectionResult, PrettifyCliProviderId } from '@shared/prettifySettings';

class ConnectionOwner extends EventEmitter {
  public destroy(): void {
    this.emit('destroyed');
  }
}

class RecordingConnectionRuntime {
  public readonly signals: AbortSignal[] = [];

  public checkCliConnection(
    providerId: unknown,
    _draftSettings = {},
    signal = new AbortController().signal,
  ): Promise<PrettifyCliConnectionResult> {
    this.signals.push(signal);
    const typedProviderId = providerId as PrettifyCliProviderId;
    return new Promise((resolve) => {
      const finish = (): void => {
        resolve({
          errorCode: 'cancelled',
          providerId: typedProviderId,
          status: 'unavailable',
        });
      };
      if (signal.aborted) finish();
      else signal.addEventListener('abort', finish, { once: true });
    });
  }
}

describe('PrettifyConnectionCheckCoordinator', () => {
  it('cancels the previous check owned by the same renderer', async () => {
    const runtime = new RecordingConnectionRuntime();
    const coordinator = new PrettifyConnectionCheckCoordinator<ConnectionOwner>(runtime);
    const owner = new ConnectionOwner();

    const first = coordinator.check(owner, 'claude-cli', {});
    const second = coordinator.check(owner, 'codex-cli', {});

    assert.equal(runtime.signals[0]?.aborted, true);
    owner.destroy();
    assert.equal(runtime.signals[1]?.aborted, true);
    await Promise.all([first, second]);
  });

  it('isolates owner and disposal state between composition graphs', async () => {
    const firstRuntime = new RecordingConnectionRuntime();
    const secondRuntime = new RecordingConnectionRuntime();
    const first = new PrettifyConnectionCheckCoordinator<ConnectionOwner>(firstRuntime);
    const second = new PrettifyConnectionCheckCoordinator<ConnectionOwner>(secondRuntime);

    const firstCheck = first.check(new ConnectionOwner(), 'claude-cli', {});
    const secondOwner = new ConnectionOwner();
    const secondCheck = second.check(secondOwner, 'codex-cli', {});
    first.dispose();

    assert.equal(firstRuntime.signals[0]?.aborted, true);
    assert.equal(secondRuntime.signals[0]?.aborted, false);
    secondOwner.destroy();
    await Promise.all([firstCheck, secondCheck]);
  });
});
