import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MainInteractionLock } from '@shared/mainInteractionLock';

describe('MainInteractionLock', () => {
  it('publishes only real lease transitions and releases idempotently', () => {
    const lock = new MainInteractionLock(() => false);
    const states: boolean[] = [];
    const unsubscribe = lock.subscribe((locked) => states.push(locked));

    const acquisition = lock.acquire();
    assert.equal(acquisition.result, 'acquired');
    assert.equal(lock.locked, true);
    assert.ok(acquisition.lease);

    acquisition.lease?.release();
    acquisition.lease?.release();
    unsubscribe();

    assert.equal(lock.locked, false);
    assert.deepEqual(states, [true, false]);
  });

  it('rejects configuration locking while recording is busy', () => {
    const lock = new MainInteractionLock(() => false);
    lock.setRecordingLifecycleState('recording');

    const acquisition = lock.acquire();

    assert.equal(acquisition.result, 'recording-active');
    assert.equal(acquisition.lease, null);
    assert.equal(lock.locked, false);
  });

  it('keeps active provider work separate from the settings-window lease', () => {
    let operationActive = true;
    const lock = new MainInteractionLock(() => operationActive);

    const blocked = lock.acquire();

    assert.equal(lock.locked, false);
    assert.equal(lock.operationActive, true);
    assert.equal(blocked.result, 'operation-active');
    assert.equal(blocked.lease, null);

    operationActive = false;
    assert.equal(lock.acquire().result, 'acquired');
  });
});
