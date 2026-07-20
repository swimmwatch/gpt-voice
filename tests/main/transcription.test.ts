import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TranscriptionResult, VoiceProviderInfo } from '@main/providers/BaseVoiceProvider';
import { BatchVoiceProvider } from '@main/providers/BatchVoiceProvider';
import { createTranscriptionService } from '@main/services/transcription';
import {
  createTranscriptionResultCache,
  createTranscriptionResultCacheKey,
} from '@main/services/transcriptionResultCache';
import type { TextActionResultCache } from '@main/services/textActionCache';

class TestVoiceProvider extends BatchVoiceProvider {
  readonly info = {
    id: 'test-provider',
    name: 'Test Provider',
    authType: 'apiKey',
    category: 'api',
    hasSettings: true,
    transcriptionMode: 'batch',
  } satisfies VoiceProviderInfo;

  transcribeCalls = 0;
  cacheContext: readonly string[] = [];

  constructor(
    private readonly result: TranscriptionResult | Error = { success: true, text: 'transcribed text' },
    private readonly ready = true,
  ) {
    super();
  }

  clearSession(): void {}

  getTranscriptionCacheContext(): readonly string[] {
    return this.cacheContext;
  }

  hasSession(): boolean {
    return this.ready;
  }

  isReady(): boolean {
    return this.ready;
  }

  async transcribe(): Promise<TranscriptionResult> {
    this.transcribeCalls += 1;
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}

interface TestServiceOptions {
  backgroundReady?: boolean;
  cache?: TextActionResultCache;
  provider?: TestVoiceProvider | null;
  providerAfterEnsure?: TestVoiceProvider | null;
}

function createTestService(options: TestServiceOptions = {}) {
  const defaultProvider = new TestVoiceProvider();
  let activeProvider = options.provider === undefined ? defaultProvider : options.provider;
  let backgroundReady = options.backgroundReady ?? true;
  const cache = options.cache || createTranscriptionResultCache();
  const clipboard: string[] = [];
  const history: Array<{ requestedAt: string; providerId: string; providerName: string; text: string }> = [];
  let ensureCalls = 0;

  const service = createTranscriptionService({
    addHistoryEntry: (entry) => {
      history.push(entry);
    },
    cache,
    ensureBackgroundBrowser: async () => {
      ensureCalls += 1;
      activeProvider = options.providerAfterEnsure ?? activeProvider;
      backgroundReady = true;
    },
    getActiveProvider: () => activeProvider,
    getRequestedAt: () => '2026-07-12T00:00:00.000Z',
    isBackgroundReady: () => backgroundReady,
    writeClipboardText: (text) => {
      clipboard.push(text);
    },
  });

  return { cache, clipboard, ensureCalls: () => ensureCalls, history, provider: defaultProvider, service };
}

function createAudioBuffer(): ArrayBuffer {
  const audio = new Uint8Array([1, 2, 3]);
  return audio.buffer;
}

describe('transcription service', () => {
  it('returns a completed result from cache without another provider call', async () => {
    const testService = createTestService();
    const audio = createAudioBuffer();

    const first = await testService.service(audio, 'audio/webm');
    const second = await testService.service(createAudioBuffer(), 'audio/webm');

    assert.deepEqual(first, { success: true, text: 'transcribed text' });
    assert.deepEqual(second, { success: true, text: 'transcribed text' });
    assert.equal(testService.provider.transcribeCalls, 1);
    assert.deepEqual(testService.clipboard, ['transcribed text']);
    assert.equal(testService.history.length, 2);
  });

  it('does not cache failed, thrown, or empty transcription results', async () => {
    const failedProvider = new TestVoiceProvider({ success: false, error: 'failed' });
    const thrownProvider = new TestVoiceProvider(new Error('failed'));
    const emptyProvider = new TestVoiceProvider({ success: true, text: '   ' });
    const failed = createTestService({ provider: failedProvider });
    const thrown = createTestService({ provider: thrownProvider });
    const empty = createTestService({ provider: emptyProvider });

    await failed.service(createAudioBuffer(), 'audio/webm');
    await failed.service(createAudioBuffer(), 'audio/webm');
    await thrown.service(createAudioBuffer(), 'audio/webm');
    await thrown.service(createAudioBuffer(), 'audio/webm');
    await empty.service(createAudioBuffer(), 'audio/webm');
    await empty.service(createAudioBuffer(), 'audio/webm');

    assert.equal(failedProvider.transcribeCalls, 2);
    assert.equal(thrownProvider.transcribeCalls, 2);
    assert.equal(emptyProvider.transcribeCalls, 2);
  });

  it('does not reuse a result after provider context changes', async () => {
    const provider = new TestVoiceProvider();
    provider.cacheContext = ['language', 'auto'];
    const testService = createTestService({ provider });

    await testService.service(createAudioBuffer(), 'audio/webm');
    provider.cacheContext = ['language', 'uk'];
    await testService.service(createAudioBuffer(), 'audio/webm');

    assert.equal(provider.transcribeCalls, 2);
  });

  it('uses a matching cache hit before background readiness is restored', async () => {
    const provider = new TestVoiceProvider({ success: true, text: 'provider text' }, false);
    const cache = createTranscriptionResultCache();
    const audio = createAudioBuffer();
    cache.set(
      createTranscriptionResultCacheKey({
        audio,
        mimeType: 'audio/webm',
        providerContext: provider.getTranscriptionCacheContext(),
        providerId: provider.info.id,
      }),
      'cached text',
    );
    const testService = createTestService({ backgroundReady: false, cache, provider });

    const result = await testService.service(createAudioBuffer(), 'audio/webm');

    assert.deepEqual(result, { success: true, text: 'cached text' });
    assert.equal(testService.ensureCalls(), 0);
    assert.equal(provider.transcribeCalls, 0);
    assert.deepEqual(testService.clipboard, ['cached text']);
    assert.equal(testService.history.length, 1);
  });

  it('falls back to the provider when cache operations fail', async () => {
    const failingCache: TextActionResultCache = {
      clear: () => {},
      get: () => {
        throw new Error('cache unavailable');
      },
      set: () => {
        throw new Error('cache unavailable');
      },
      size: () => 0,
    };
    const testService = createTestService({ cache: failingCache });

    const result = await testService.service(createAudioBuffer(), 'audio/webm');

    assert.deepEqual(result, { success: true, text: 'transcribed text' });
    assert.equal(testService.provider.transcribeCalls, 1);
  });

  it('uses a provider initialized by the normal background path', async () => {
    const provider = new TestVoiceProvider();
    const testService = createTestService({ provider: null, providerAfterEnsure: provider });

    const result = await testService.service(createAudioBuffer(), 'audio/webm');

    assert.deepEqual(result, { success: true, text: 'transcribed text' });
    assert.equal(testService.ensureCalls(), 1);
    assert.equal(provider.transcribeCalls, 1);
  });
});
