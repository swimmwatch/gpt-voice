import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT,
  isLocalWhisperBackend,
  isLocalWhisperEngine,
  isLocalWhisperFailureCode,
  isLocalWhisperModelFamily,
  LOCAL_WHISPER_ACTION_IDS,
  LOCAL_WHISPER_BACKENDS,
  LOCAL_WHISPER_ENGINES,
  LOCAL_WHISPER_FAILURE_CODES,
  LOCAL_WHISPER_MODEL_FAMILIES,
  LOCAL_WHISPER_PROVIDER_ID,
  LOCAL_WHISPER_TARGETS,
  toLocalWhisperArtifactId,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
} from '@shared/localWhisper';

describe('Local Whisper domain contracts', () => {
  it('defines the exact provider, engine, target, backend, and six-model vocabularies', () => {
    assert.equal(LOCAL_WHISPER_PROVIDER_ID, 'local-whisper');
    assert.deepEqual(LOCAL_WHISPER_ENGINES, ['whisperCpp']);
    assert.deepEqual(LOCAL_WHISPER_TARGETS, ['gpu', 'cpu']);
    assert.deepEqual(LOCAL_WHISPER_BACKENDS, ['cuda', 'hip', 'vulkan', 'metal', 'cpu']);
    assert.deepEqual(LOCAL_WHISPER_MODEL_FAMILIES, ['tiny', 'base', 'small', 'medium', 'large-v3', 'large-v3-turbo']);
  });

  it('fails closed for unknown enum values and excluded model families', () => {
    for (const engine of LOCAL_WHISPER_ENGINES) assert.equal(isLocalWhisperEngine(engine), true);
    for (const backend of LOCAL_WHISPER_BACKENDS) assert.equal(isLocalWhisperBackend(backend), true);
    for (const model of LOCAL_WHISPER_MODEL_FAMILIES) assert.equal(isLocalWhisperModelFamily(model), true);

    for (const value of ['', 'auto', 'directml', 'distil-whisper', 'large-v2', null, 1]) {
      assert.equal(isLocalWhisperEngine(value), false);
      assert.equal(isLocalWhisperBackend(value), false);
      assert.equal(isLocalWhisperModelFamily(value), false);
    }
  });

  it('accepts only bounded, renderer-safe opaque identities', () => {
    assert.equal(toLocalWhisperOpaqueDeviceId('gpu:nvidia:0'), 'gpu:nvidia:0');
    assert.equal(toLocalWhisperArtifactId('model.base.v1'), 'model.base.v1');
    assert.equal(toLocalWhisperRevisionId('sha256-deadbeef'), 'sha256-deadbeef');
    for (const value of ['', 'private\nvalue', `x${'a'.repeat(256)}`, null]) {
      assert.equal(toLocalWhisperOpaqueDeviceId(value), null);
      assert.equal(toLocalWhisperArtifactId(value), null);
      assert.equal(toLocalWhisperRevisionId(value), null);
    }
  });

  it('contains every approved typed failure without authentication failures', () => {
    assert.equal(LOCAL_WHISPER_FAILURE_CODES.length, 54);
    assert.equal(LOCAL_WHISPER_FAILURE_CODES.includes('CATALOG_UNAVAILABLE'), true);
    assert.equal(LOCAL_WHISPER_FAILURE_CODES.includes('DEVICE_PROOF_FAILED'), true);
    assert.equal(LOCAL_WHISPER_FAILURE_CODES.includes('MODEL_AUTHORITY_INVALID'), true);
    assert.equal(LOCAL_WHISPER_ACTION_IDS.includes('saveSettings'), true);
    assert.equal(LOCAL_WHISPER_ACTION_IDS.includes('resetSettings'), true);
    assert.equal(LOCAL_WHISPER_ACTION_IDS.includes('providerSwitch'), true);
    for (const code of LOCAL_WHISPER_FAILURE_CODES) assert.equal(isLocalWhisperFailureCode(code), true);
    assert.equal(isLocalWhisperFailureCode('LOGIN_REQUIRED'), false);
    assert.doesNotMatch(JSON.stringify(LOCAL_WHISPER_FAILURE_CODES), /login|token|api.?key|browser.?session/i);
  });

  it('exports an immutable renderer-safe initial state with independent dimensions', () => {
    assert.equal(Object.isFrozen(INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT), true);
    assert.deepEqual(INITIAL_LOCAL_WHISPER_RUNTIME_SNAPSHOT, {
      supportTier: 'Unsupported',
      runtimeSetup: 'Missing',
      modelSetup: 'Missing',
      capability: 'Unchecked',
      residency: 'Unloaded',
      activity: 'Idle',
      operationalStatus: 'NotReady',
      canAttempt: false,
      blockingCode: null,
    });
  });
});
