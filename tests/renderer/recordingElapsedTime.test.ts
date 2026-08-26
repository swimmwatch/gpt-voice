import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCapturedAudioElapsedState,
  formatCapturedAudioDuration,
  getCapturedAudioElapsedMs,
  transitionCapturedAudioElapsedState,
} from '@renderer/recordingElapsedTime';

describe('captured audio elapsed time', () => {
  it('counts only active capture and excludes paused and processing intervals', () => {
    let state = createCapturedAudioElapsedState();
    state = transitionCapturedAudioElapsedState(state, 'recording', 1_000);
    assert.equal(getCapturedAudioElapsedMs(state, 4_500), 3_500);

    state = transitionCapturedAudioElapsedState(state, 'paused', 4_500);
    assert.equal(getCapturedAudioElapsedMs(state, 99_000), 3_500);

    state = transitionCapturedAudioElapsedState(state, 'recording', 99_000);
    state = transitionCapturedAudioElapsedState(state, 'transcribing', 102_000);
    assert.equal(getCapturedAudioElapsedMs(state, 200_000), 6_500);
  });

  it('resets on idle and always renders fixed-width HH:MM:SS without byte values', () => {
    const state = transitionCapturedAudioElapsedState(
      transitionCapturedAudioElapsedState(createCapturedAudioElapsedState(), 'recording', 0),
      'idle',
      3_661_500,
    );

    assert.equal(getCapturedAudioElapsedMs(state, 10_000), 0);
    assert.equal(formatCapturedAudioDuration(3_661_500), '01:01:01');
    assert.doesNotMatch(formatCapturedAudioDuration(3_661_500), /MB|byte/i);
  });
});
