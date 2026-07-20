import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canRunPrettifyShortcut,
  canRunRetryTranscriptionShortcut,
  canRunTranslateShortcut,
  getTextActionStatus,
  handleCancelShortcut,
  resolveTextActionStatus,
} from '@main/shortcuts';

describe('shortcuts', () => {
  it('uses Escape to cancel recording before prettify', () => {
    const events: string[] = [];

    const handled = handleCancelShortcut(true, {
      cancelPrettify: () => {
        events.push('cancel-prettify');
        return true;
      },
      cancelRecording: () => {
        events.push('cancel-recording');
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
        return true;
      },
      cancelRecording: () => {
        events.push('cancel-recording');
      },
    });

    assert.equal(handled, true);
    assert.deepEqual(events, ['cancel-prettify']);
  });

  it('does nothing for Escape when recording and prettify are idle', () => {
    const events: string[] = [];

    const handled = handleCancelShortcut(false, {
      cancelPrettify: () => false,
      cancelRecording: () => {
        events.push('cancel-recording');
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

  it('runs retry transcription only when retryable audio is available and not recording', () => {
    assert.equal(canRunRetryTranscriptionShortcut(false, true), true);
    assert.equal(canRunRetryTranscriptionShortcut(false, false), false);
    assert.equal(canRunRetryTranscriptionShortcut(true, true), false);
    assert.equal(canRunRetryTranscriptionShortcut('idle', true), true);
    assert.equal(canRunRetryTranscriptionShortcut('transcribing', true), false);
    assert.equal(canRunRetryTranscriptionShortcut('retrying', true), false);
  });

  it('maps text-action results to finite safe status events', () => {
    assert.deepEqual(getTextActionStatus('translation', { success: true }), {
      action: 'translation',
      phase: 'completed',
    });
    assert.deepEqual(getTextActionStatus('prettify', { success: false }), {
      action: 'prettify',
      phase: 'failed',
    });
    assert.deepEqual(getTextActionStatus('prettify', { cancelled: true, success: false }), {
      action: 'prettify',
      phase: 'cancelled',
    });
    assert.deepEqual(getTextActionStatus('translation', { skipped: true, success: false }), {
      action: 'translation',
      phase: 'skipped',
    });
  });

  it('settles each terminal action outcome and retains only safe rejection metadata', async () => {
    for (const [action, result, phase] of [
      ['translation', { success: true }, 'completed'],
      ['translation', { success: false }, 'failed'],
      ['prettify', { cancelled: true, success: false }, 'cancelled'],
      ['prettify', { skipped: true, success: false }, 'skipped'],
    ] as const) {
      const resolution = await resolveTextActionStatus(action, Promise.resolve(result));
      assert.deepEqual(resolution, { status: { action, phase } });
    }

    const unsafeError = new Error('https://provider.example/v1 HTTP 500 /tmp/private-output\n at privateHandler');
    const rejected = await resolveTextActionStatus('prettify', Promise.reject(unsafeError));

    assert.deepEqual(rejected.status, { action: 'prettify', phase: 'failed' });
    assert.equal(rejected.failureLogMetadata?.action, 'prettify');
    assert.equal(rejected.failureLogMetadata?.hasStackTrace, true);
    assert.equal(rejected.failureLogMetadata?.hasUrl, true);
    assert.equal(rejected.failureLogMetadata?.hasFilePath, true);
    assert.doesNotMatch(JSON.stringify(rejected.failureLogMetadata), /Traceback|https?:\/\/|\/tmp\/private-output/u);
  });
});
