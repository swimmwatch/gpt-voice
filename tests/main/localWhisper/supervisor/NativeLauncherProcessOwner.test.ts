import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getLocalWhisperLauncherAcknowledgmentTimeoutMs } from '@main/localWhisper/supervisor/NativeLauncherProcessOwner';
import { LOCAL_WHISPER_LOAD_TIMEOUT_MS } from '@main/localWhisper/supervisor/LocalWhisperSupervisorConstants';

describe('NativeLauncherProcessOwner acknowledgment policy', () => {
  it('preserves the narrow timeout for ordinary launcher startup', () => {
    assert.equal(getLocalWhisperLauncherAcknowledgmentTimeoutMs(false), 10_000);
  });

  it('allows the bounded model-load budget for pre-launch model hashing', () => {
    assert.equal(getLocalWhisperLauncherAcknowledgmentTimeoutMs(true), LOCAL_WHISPER_LOAD_TIMEOUT_MS);
  });
});
