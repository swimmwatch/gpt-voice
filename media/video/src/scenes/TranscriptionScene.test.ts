import assert from 'node:assert/strict';
import test from 'node:test';
import { getTranscriptionViewState } from '../data/transcriptionState.ts';

test('transcription follows the canonical recording lifecycle at its named cue frames', () => {
  assert.deepEqual(getTranscriptionViewState(0), {
    fixtureId: 'bridgeReady',
    hotkey: null,
    showPastedPrompt: false,
    stage: 'waiting',
  });
  assert.equal(getTranscriptionViewState(30).fixtureId, 'recordingPrompt');
  assert.equal(getTranscriptionViewState(30).hotkey, 'F9');
  assert.equal(getTranscriptionViewState(287).fixtureId, 'recordingPrompt');
  assert.equal(getTranscriptionViewState(288).fixtureId, 'stoppingPrompt');
  assert.equal(getTranscriptionViewState(288).hotkey, 'F10');
  assert.equal(getTranscriptionViewState(389).fixtureId, 'stoppingPrompt');
  assert.equal(getTranscriptionViewState(390).fixtureId, 'transcribingPrompt');
  assert.equal(getTranscriptionViewState(479).fixtureId, 'transcribingPrompt');
  assert.equal(getTranscriptionViewState(480).fixtureId, 'transcriptionCopied');
});

test('the approved spoken prompt is only eligible for visual paste after the paste cue', () => {
  assert.equal(getTranscriptionViewState(551).showPastedPrompt, false);
  assert.equal(getTranscriptionViewState(552).showPastedPrompt, true);
});
