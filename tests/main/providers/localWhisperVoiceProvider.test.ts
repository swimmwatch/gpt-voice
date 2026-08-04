import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LocalWhisperVoiceProvider } from '@main/providers/LocalWhisperVoiceProvider';
import { RecordingLocalWhisperCoordinator, createCanonicalLocalWhisperWav } from './localWhisperTestUtils';

describe('LocalWhisperVoiceProvider', () => {
  it('exposes stable metadata and adapts generic configuration queries without browser-session state', () => {
    const coordinator = new RecordingLocalWhisperCoordinator();
    const provider = new LocalWhisperVoiceProvider(coordinator);

    assert.deepEqual(provider.info, {
      id: 'local-whisper',
      name: 'Local Whisper',
      authType: 'localRuntime',
      category: 'local',
      hasSettings: true,
      transcriptionMode: 'batch',
    });
    assert.equal(provider.requiresBrowserSession(), false);
    assert.deepEqual(coordinator.calls, []);
    assert.equal(provider.hasSession(), true);
    assert.throws(() => provider.clearSession(), /does not support session state/);
    assert.deepEqual(coordinator.calls, []);
  });

  it('delegates operations while leaving coordinator shutdown to the process graph', async () => {
    const coordinator = new RecordingLocalWhisperCoordinator();
    const provider = new LocalWhisperVoiceProvider(coordinator);
    const audio = createCanonicalLocalWhisperWav();

    assert.equal(provider.isReady(), true);
    const dispatch = provider.captureDispatchSnapshot();
    assert.deepEqual(provider.getTranscriptionCacheContext(), coordinator.cacheContext);
    assert.deepEqual(await provider.transcribe(audio, 'audio/wav'), {
      success: true,
      text: 'local transcript',
    });
    await provider.cancel();
    assert.equal((await provider.prepareProviderSwitch('chatgpt')).success, true);
    await provider.shutdown();

    assert.deepEqual(coordinator.calls, [
      'readiness',
      'capture',
      'capture',
      'capture',
      'transcribe',
      'cancel',
      'switch',
    ]);
    assert.deepEqual(coordinator.lastTranscriptionRequest?.dispatch.epochs, dispatch.epochs);
  });
});
