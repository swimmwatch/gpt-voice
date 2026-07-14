import assert from 'node:assert/strict';
import test from 'node:test';
import { getRetryViewState } from '../data/retryState.ts';
import { getVideoUiState } from '../data/uiFixtures.ts';

test('retry follows failure, same-audio resend, and matching result without recording again', () => {
  const cueFrames = [12, 100, 162, 209, 210, 299, 300, 460];
  const states = cueFrames.map(getRetryViewState);

  assert.equal(states[0].fixtureId, 'recognitionFailed');
  assert.equal(states[2].showHotkey, true);
  assert.equal(states[4].fixtureId, 'retryingStoredAudio');
  assert.equal(states[6].fixtureId, 'transcriptionCopied');
  assert.equal(states[6].showRecoveredPrompt, true);

  for (const state of states) assert.notEqual(getVideoUiState(state.fixtureId).lifecycle, 'recording');
});

test('failure, resend, and successful retry share the approved stored audio identity', () => {
  const fixtureIds = ['recognitionFailed', 'retryingStoredAudio', 'transcriptionCopied'] as const;
  const audioIds = fixtureIds.map((fixtureId) => getVideoUiState(fixtureId).audio.id);
  const requestAudioIds = fixtureIds.map((fixtureId) => getVideoUiState(fixtureId).audio.requestAudioId);

  assert.deepEqual(new Set(audioIds), new Set(['spoken-prompt-01']));
  assert.deepEqual(new Set(requestAudioIds), new Set(['spoken-prompt-01']));
});
