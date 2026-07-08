import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRunPrettifyShortcut,
  canRunRetryTranscriptionShortcut,
  canRunTranslateShortcut,
  handleCancelShortcut,
} from '@main/shortcuts';

describe('shortcuts', () => {
  it('uses Escape to cancel recording before prettify', () => {
    const events: string[] = [];

    const handled = handleCancelShortcut(true, {
      cancelPrettify: () => {
        events.push('cancel-prettify');
        return { status: 'Prettify cancelled' };
      },
      cancelRecording: () => {
        events.push('cancel-recording');
      },
      sendTextStatus: (status) => {
        events.push(`status:${status}`);
      },
    });

    assert.equal(handled, true);
    assert.deepEqual(events, ['cancel-recording']);
  });

  it('uses Escape to cancel active prettify when not recording', () => {
    const events: string[] = [];

    const handled = handleCancelShortcut(false, {
      cancelPrettify: () => {
        events.push('cancel-prettify');
        return { status: 'Prettify cancelled' };
      },
      cancelRecording: () => {
        events.push('cancel-recording');
      },
      sendTextStatus: (status) => {
        events.push(`status:${status}`);
      },
    });

    assert.equal(handled, true);
    assert.deepEqual(events, ['cancel-prettify', 'status:Prettify cancelled']);
  });

  it('does nothing for Escape when recording and prettify are idle', () => {
    const events: string[] = [];

    const handled = handleCancelShortcut(false, {
      cancelPrettify: () => null,
      cancelRecording: () => {
        events.push('cancel-recording');
      },
      sendTextStatus: (status) => {
        events.push(`status:${status}`);
      },
    });

    assert.equal(handled, false);
    assert.deepEqual(events, []);
  });

  it('runs Translate only when enabled and not recording', () => {
    assert.equal(canRunTranslateShortcut(false, true), true);
    assert.equal(canRunTranslateShortcut(false, false), false);
    assert.equal(canRunTranslateShortcut(true, true), false);
    assert.equal(canRunTranslateShortcut('idle', true), true);
    assert.equal(canRunTranslateShortcut('transcribing', true), false);
    assert.equal(canRunTranslateShortcut('idle', true, true), false);
  });

  it('runs Prettify only when enabled and not recording', () => {
    assert.equal(canRunPrettifyShortcut(false, true), true);
    assert.equal(canRunPrettifyShortcut(false, false), false);
    assert.equal(canRunPrettifyShortcut(true, true), false);
    assert.equal(canRunPrettifyShortcut('idle', true), true);
    assert.equal(canRunPrettifyShortcut('retrying', true), false);
    assert.equal(canRunPrettifyShortcut('idle', true, true), false);
  });

  it('runs retry transcription only when failed audio is available and not recording', () => {
    assert.equal(canRunRetryTranscriptionShortcut(false, true), true);
    assert.equal(canRunRetryTranscriptionShortcut(false, false), false);
    assert.equal(canRunRetryTranscriptionShortcut(true, true), false);
    assert.equal(canRunRetryTranscriptionShortcut('idle', true), true);
    assert.equal(canRunRetryTranscriptionShortcut('transcribing', true), false);
    assert.equal(canRunRetryTranscriptionShortcut('retrying', true), false);
  });
});
