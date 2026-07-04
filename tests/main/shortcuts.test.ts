import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canRunPrettifyShortcut, canRunTranslateShortcut, handleCancelShortcut } from '@main/shortcuts';

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
  });

  it('runs Prettify only when enabled and not recording', () => {
    assert.equal(canRunPrettifyShortcut(false, true), true);
    assert.equal(canRunPrettifyShortcut(false, false), false);
    assert.equal(canRunPrettifyShortcut(true, true), false);
  });
});
