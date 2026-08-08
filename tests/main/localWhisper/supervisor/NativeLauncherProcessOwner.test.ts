import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';

import { getLocalWhisperLauncherAcknowledgmentTimeoutMs } from '@main/localWhisper/supervisor/NativeLauncherProcessOwner';
import { NativeOwnedWorkerProcess } from '@main/localWhisper/supervisor/NativeOwnedWorkerProcess';
import { LOCAL_WHISPER_LOAD_TIMEOUT_MS } from '@main/localWhisper/supervisor/LocalWhisperSupervisorConstants';

describe('NativeLauncherProcessOwner acknowledgment policy', () => {
  it('preserves the narrow timeout for ordinary launcher startup', () => {
    assert.equal(getLocalWhisperLauncherAcknowledgmentTimeoutMs(false), 10_000);
  });

  it('allows the bounded model-load budget for pre-launch model hashing', () => {
    assert.equal(getLocalWhisperLauncherAcknowledgmentTimeoutMs(true), LOCAL_WHISPER_LOAD_TIMEOUT_MS);
  });
});

describe('NativeOwnedWorkerProcess exit confirmation', () => {
  it('waits for closed stdio after process exit before confirming cleanup', async () => {
    const child = new EventEmitter() as ChildProcess;
    const control = new PassThrough();
    const input = new PassThrough();
    const output = new PassThrough();
    const stderr = new PassThrough();
    const owned = new NativeOwnedWorkerProcess({
      child,
      control,
      input,
      output,
      platform: 'win32',
      processStartIdentity: 'fixture-process-start',
      stderr,
      workerProcessGroupId: 4242,
    });
    let settled = false;
    const waiting = owned.waitForExit(1_000).then((value) => {
      settled = true;
      return value;
    });

    child.emit('exit', 0, null);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    child.emit('close', 0, null);
    assert.equal(await waiting, true);
    assert.equal(await owned.waitForExit(0), true);
  });
});
