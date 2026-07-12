import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createTranscriptionResultCache,
  createTranscriptionResultCacheKey,
  TRANSCRIPTION_RESULT_CACHE_MAX_ENTRIES,
  TRANSCRIPTION_RESULT_CACHE_TTL_MS,
} from '@main/services/transcriptionResultCache';

function createAudioBuffer(bytes: readonly number[]): ArrayBuffer {
  const audio = new Uint8Array(bytes.length);
  audio.set(bytes);
  return audio.buffer;
}

function createCacheKey(audio: ArrayBuffer, providerContext: readonly string[] = []): string {
  return createTranscriptionResultCacheKey({
    audio,
    mimeType: 'audio/webm',
    providerContext,
    providerId: 'openai-api',
  });
}

describe('transcriptionResultCache', () => {
  it('creates opaque, stable keys from exact audio bytes and transcription context', () => {
    const prompt = 'never expose this prompt';
    const audio = createAudioBuffer([1, 2, 3]);
    const key = createCacheKey(audio, ['model', 'gpt-4o-transcribe', prompt]);

    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(key.includes(prompt), false);
    assert.equal(key, createCacheKey(createAudioBuffer([1, 2, 3]), ['model', 'gpt-4o-transcribe', prompt]));
    assert.notEqual(key, createCacheKey(createAudioBuffer([1, 2, 4]), ['model', 'gpt-4o-transcribe', prompt]));
    assert.notEqual(
      key,
      createTranscriptionResultCacheKey({
        audio,
        mimeType: 'audio/mp4',
        providerContext: ['model', 'gpt-4o-transcribe', prompt],
        providerId: 'openai-api',
      }),
    );
    assert.notEqual(key, createCacheKey(audio, ['model', 'whisper-1', prompt]));
    assert.notEqual(
      key,
      createTranscriptionResultCacheKey({
        audio,
        mimeType: 'audio/webm',
        providerContext: ['model', 'gpt-4o-transcribe', prompt],
        providerId: 'chatgpt-web',
      }),
    );
  });

  it('stores only non-empty values', () => {
    const cache = createTranscriptionResultCache();
    const key = createCacheKey(createAudioBuffer([1]));

    cache.set(key, '   ');

    assert.equal(cache.get(key), null);
    assert.equal(cache.size(), 0);
  });

  it('expires entries after the fixed retention period', () => {
    let now = 1_000;
    const cache = createTranscriptionResultCache({ now: () => now });
    const key = createCacheKey(createAudioBuffer([1]));

    cache.set(key, 'transcript');
    now += TRANSCRIPTION_RESULT_CACHE_TTL_MS;

    assert.equal(cache.get(key), null);
    assert.equal(cache.size(), 0);
  });

  it('evicts the least recently used result when it reaches capacity', () => {
    const cache = createTranscriptionResultCache();
    const keys = Array.from({ length: TRANSCRIPTION_RESULT_CACHE_MAX_ENTRIES + 1 }, (_, index) =>
      createCacheKey(createAudioBuffer([index])),
    );

    for (const [index, key] of keys.slice(0, TRANSCRIPTION_RESULT_CACHE_MAX_ENTRIES).entries()) {
      cache.set(key, `transcript ${index}`);
    }
    assert.equal(cache.get(keys[0]), 'transcript 0');
    cache.set(keys[TRANSCRIPTION_RESULT_CACHE_MAX_ENTRIES], 'latest transcript');

    assert.equal(cache.get(keys[1]), null);
    assert.equal(cache.get(keys[0]), 'transcript 0');
    assert.equal(cache.get(keys[TRANSCRIPTION_RESULT_CACHE_MAX_ENTRIES]), 'latest transcript');
  });
});
