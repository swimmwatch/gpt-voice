import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { TranscriptionAudioPayload } from '@renderer/audioEncoding';
import {
  beginRetryTranscription,
  clearRetryableTranscriptionAudio,
  createRecordingRetryState,
  finishRetryTranscription,
  isRetryTranscriptionAvailable,
  storeRetryableTranscriptionAudio,
} from '@renderer/recordingRetryState';

function createAudio(byteLength = 4): TranscriptionAudioPayload {
  return {
    buffer: new ArrayBuffer(byteLength),
    mimeType: 'audio/webm',
    transcoded: false,
  };
}

describe('recordingRetryState', () => {
  it('keeps valid completed audio available for resend while idle', () => {
    const state = storeRetryableTranscriptionAudio(createRecordingRetryState(), createAudio());

    assert.equal(isRetryTranscriptionAvailable(state, 'idle'), true);
    assert.equal(state.audio?.mimeType, 'audio/webm');
  });

  it('temporarily disables resend while the stored audio is being resent', () => {
    const state = storeRetryableTranscriptionAudio(createRecordingRetryState(), createAudio());
    const retry = beginRetryTranscription(state, 'idle');

    assert.ok(retry);
    assert.equal(retry.audio, state.audio);
    assert.equal(isRetryTranscriptionAvailable(retry.state, 'idle'), false);

    const finished = finishRetryTranscription(retry.state);

    assert.equal(isRetryTranscriptionAvailable(finished, 'idle'), true);
    assert.ok(beginRetryTranscription(finished, 'idle'));
  });

  it('does not start resend without audio or while recording is busy', () => {
    assert.equal(beginRetryTranscription(createRecordingRetryState(), 'idle'), null);

    const state = storeRetryableTranscriptionAudio(createRecordingRetryState(), createAudio());

    assert.equal(beginRetryTranscription(state, 'recording'), null);
    assert.equal(beginRetryTranscription(state, 'transcribing'), null);
    assert.equal(beginRetryTranscription(state, 'retrying'), null);
  });

  it('clears retryable audio for empty payloads and explicit new recording starts', () => {
    const state = storeRetryableTranscriptionAudio(createRecordingRetryState(), createAudio());
    const emptyState = storeRetryableTranscriptionAudio(state, createAudio(0));

    assert.equal(isRetryTranscriptionAvailable(emptyState, 'idle'), false);
    assert.equal(emptyState.audio, null);

    const restoredState = storeRetryableTranscriptionAudio(emptyState, createAudio());
    const clearedState = clearRetryableTranscriptionAudio(restoredState);

    assert.equal(isRetryTranscriptionAvailable(clearedState, 'idle'), false);
    assert.equal(clearedState.audio, null);
    assert.equal(clearedState.isResending, false);
  });
});
