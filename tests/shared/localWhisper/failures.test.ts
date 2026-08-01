import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createLocalWhisperActionFailure,
  createLocalWhisperActionSuccess,
  getLocalWhisperFailureDescriptor,
  INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT,
  LOCAL_WHISPER_FAILURE_CODES,
  LOCAL_WHISPER_FAILURE_DESCRIPTORS,
  LOCAL_WHISPER_FAILURE_STAGES,
  LOCAL_WHISPER_RECOVERY_ACTION_IDS,
  LOCAL_WHISPER_STATE_IMPACTS,
  toLocalWhisperArtifactId,
  toLocalWhisperOpaqueDeviceId,
} from '@shared/localWhisper';

describe('Local Whisper failure contracts', () => {
  it('maps every failure code to one complete deterministic recovery tuple', () => {
    assert.deepEqual(Object.keys(LOCAL_WHISPER_FAILURE_DESCRIPTORS), [...LOCAL_WHISPER_FAILURE_CODES]);
    for (const code of LOCAL_WHISPER_FAILURE_CODES) {
      const descriptor = getLocalWhisperFailureDescriptor(code);
      assert.ok(descriptor);
      assert.equal(LOCAL_WHISPER_FAILURE_STAGES.includes(descriptor.stage), true);
      assert.equal(typeof descriptor.retryable, 'boolean');
      assert.equal(LOCAL_WHISPER_RECOVERY_ACTION_IDS.includes(descriptor.recoveryAction), true);
      assert.equal(LOCAL_WHISPER_STATE_IMPACTS.includes(descriptor.stateImpact), true);
      assert.equal(Object.isFrozen(descriptor), true);
    }
    assert.equal(getLocalWhisperFailureDescriptor('LOGIN_REQUIRED'), undefined);
  });

  it('uses exact required recovery behavior for representative settings, resource, artifact, and cleanup failures', () => {
    assert.deepEqual(LOCAL_WHISPER_FAILURE_DESCRIPTORS.INVALID_SETTINGS, {
      stage: 'validation',
      retryable: false,
      recoveryAction: 'edit-settings',
      stateImpact: 'settingsInvalid',
    });
    assert.equal(LOCAL_WHISPER_FAILURE_DESCRIPTORS.INSUFFICIENT_VRAM.recoveryAction, 'free-resources');
    assert.equal(LOCAL_WHISPER_FAILURE_DESCRIPTORS.MODEL_MISSING.recoveryAction, 'download-selected-artifact');
    assert.equal(LOCAL_WHISPER_FAILURE_DESCRIPTORS.MODEL_BLOCKED.retryable, false);
    assert.equal(LOCAL_WHISPER_FAILURE_DESCRIPTORS.CLEANUP_FAILED.recoveryAction, 'restart-application');
    assert.equal(LOCAL_WHISPER_FAILURE_DESCRIPTORS.CLEANUP_FAILED.stateImpact, 'cleanupUncertain');
  });

  it('creates renderer-safe typed action results without raw exception or auth fields', () => {
    const artifactId = toLocalWhisperArtifactId('model-base-v1');
    const deviceId = toLocalWhisperOpaqueDeviceId('gpu:nvidia:0');
    assert.ok(artifactId);
    assert.ok(deviceId);
    const failure = createLocalWhisperActionFailure(
      'load',
      'MODEL_LOAD_FAILED',
      INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT,
      { artifactId, deviceId },
    );
    assert.deepEqual(failure.error, {
      code: 'MODEL_LOAD_FAILED',
      stage: 'modelLoad',
      retryable: true,
      recoveryAction: 'retry-load-or-change-settings',
      stateImpact: 'residencyFailed',
      artifactId: 'model-base-v1',
      deviceId: 'gpu:nvidia:0',
    });
    assert.doesNotMatch(JSON.stringify(failure), /stderr|stack|path|prompt|audio|transcript|login|token|api.?key/i);

    const success = createLocalWhisperActionSuccess('unload', INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT, undefined);
    assert.deepEqual(success, {
      success: true,
      action: 'unload',
      snapshot: INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT,
      value: undefined,
    });
  });
});
