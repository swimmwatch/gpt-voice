import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canCancelRecording,
  canPauseRecording,
  canResumeRecording,
  canStartRecording,
  canStopRecording,
  isRecordingLifecycleBusy,
  isRecordingLifecycleState,
} from '@shared/recordingLifecycle';

describe('recordingLifecycle', () => {
  it('recognizes recording lifecycle states', () => {
    assert.equal(isRecordingLifecycleState('idle'), true);
    assert.equal(isRecordingLifecycleState('transcribing'), true);
    assert.equal(isRecordingLifecycleState('missing'), false);
  });

  it('allows recording actions only in compatible states', () => {
    assert.equal(canStartRecording('idle'), true);
    assert.equal(canStartRecording('transcribing'), false);
    assert.equal(canStopRecording('recording'), true);
    assert.equal(canStopRecording('paused'), true);
    assert.equal(canStopRecording('stopping'), false);
    assert.equal(canPauseRecording('recording'), true);
    assert.equal(canPauseRecording('transcribing'), false);
    assert.equal(canResumeRecording('paused'), true);
    assert.equal(canResumeRecording('recording'), false);
    assert.equal(canCancelRecording('recording'), true);
    assert.equal(canCancelRecording('transcribing'), false);
  });

  it('treats every non-idle lifecycle state as busy', () => {
    assert.equal(isRecordingLifecycleBusy('idle'), false);
    assert.equal(isRecordingLifecycleBusy('starting'), true);
    assert.equal(isRecordingLifecycleBusy('transcribing'), true);
    assert.equal(isRecordingLifecycleBusy('retrying'), true);
  });
});
