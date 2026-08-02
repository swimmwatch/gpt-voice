import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperVoiceProvider } from '@main/providers/LocalWhisperVoiceProvider';
import {
  RecordingLocalWhisperCoordinator,
  createCanonicalLocalWhisperWav,
} from '../../providers/localWhisperTestUtils';

describe('Local Whisper offline inference boundary', () => {
  it('runs an installed buffered fixture without inference network, browser, download, or argv authority', async (context) => {
    let networkCalls = 0;
    context.mock.method(globalThis, 'fetch', () => {
      networkCalls += 1;
      return Promise.reject(new Error('network is forbidden'));
    });
    const coordinator = new RecordingLocalWhisperCoordinator();
    coordinator.cacheContext = Object.freeze(['whisperCpp', 'cpu', 'model-base-v1', 'prompt-digest-only']);
    const provider = new LocalWhisperVoiceProvider(coordinator);

    const result = await provider.transcribe(createCanonicalLocalWhisperWav(), 'audio/wav');

    assert.deepEqual(result, { success: true, text: 'local transcript' });
    assert.equal(networkCalls, 0);
    assert.deepEqual(coordinator.calls, ['capture', 'transcribe']);
    assert.equal(
      coordinator.cacheContext.some((value) => value.includes('private prompt')),
      false,
    );
    assert.equal(
      coordinator.cacheContext.some((value) => value.includes('local transcript')),
      false,
    );
    assert.equal('argv' in (coordinator.lastTranscriptionRequest ?? {}), false);
    assert.equal('environment' in (coordinator.lastTranscriptionRequest ?? {}), false);
    assert.equal('download' in (coordinator.lastTranscriptionRequest ?? {}), false);
  });
});
