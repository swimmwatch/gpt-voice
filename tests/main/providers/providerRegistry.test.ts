import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BatchVoiceProvider,
  ClaudeWebVoiceProvider,
  StreamingVoiceProvider,
  copyStreamingTranscriptionChunk,
  createProvider,
  getAvailableProviders,
  isBatchVoiceProvider,
  isStreamingVoiceProvider,
} from '@main/providers';
import { CLAUDE_WEB_PROVIDER_ID, DEFAULT_CLAUDE_WEB_LANGUAGE } from '@shared/claudeWebSettings';
import {
  isRendererSafeVoiceProviderInfo,
  isStreamingVoiceProviderInfo,
  isVoiceTranscriptionMode,
} from '@shared/voiceProvider';

describe('provider registry', () => {
  it('exposes every provider once with stable metadata', () => {
    const providers = getAvailableProviders();

    assert.deepEqual(providers, [
      {
        id: 'chatgpt',
        name: 'ChatGPT Web',
        authType: 'browserSession',
        category: 'web',
        hasSettings: true,
        transcriptionMode: 'batch',
      },
      {
        id: 'openai-api',
        name: 'OpenAI API',
        authType: 'apiKey',
        category: 'api',
        hasSettings: true,
        transcriptionMode: 'batch',
      },
      {
        id: CLAUDE_WEB_PROVIDER_ID,
        name: 'Claude Web',
        authType: 'browserSession',
        category: 'web',
        hasSettings: true,
        transcriptionMode: 'streaming',
      },
    ]);
    assert.equal(providers.filter((provider) => provider.id === CLAUDE_WEB_PROVIDER_ID).length, 1);
  });

  it('creates providers with matching readiness semantics', () => {
    const chatgpt = createProvider('chatgpt');
    const openaiApi = createProvider('openai-api');
    const claudeWeb = createProvider(CLAUDE_WEB_PROVIDER_ID);

    assert.equal(chatgpt.requiresBrowserSession(), true);
    assert.equal(openaiApi.requiresBrowserSession(), false);
    assert.equal(claudeWeb.requiresBrowserSession(), true);
    assert.equal(chatgpt instanceof BatchVoiceProvider, true);
    assert.equal(openaiApi instanceof BatchVoiceProvider, true);
    assert.equal(claudeWeb instanceof StreamingVoiceProvider, true);
    assert.equal(isBatchVoiceProvider(chatgpt), true);
    assert.equal(isBatchVoiceProvider(openaiApi), true);
    assert.equal(isBatchVoiceProvider(claudeWeb), false);
    assert.equal(isStreamingVoiceProvider(chatgpt), false);
    assert.equal(isStreamingVoiceProvider(openaiApi), false);
    assert.equal(isStreamingVoiceProvider(claudeWeb), true);
    assert.equal(claudeWeb.isReady(), false);
    assert.equal(claudeWeb.getAccessToken(), '');
    assert.equal(claudeWeb.getLoginUrl(), 'https://claude.ai');
    assert.equal(DEFAULT_CLAUDE_WEB_LANGUAGE, 'en-US');
  });

  it('creates a fresh Claude Web provider for each lifecycle', () => {
    const first = createProvider(CLAUDE_WEB_PROVIDER_ID);
    const second = createProvider(CLAUDE_WEB_PROVIDER_ID);

    assert.equal(first instanceof ClaudeWebVoiceProvider, true);
    assert.equal(second instanceof ClaudeWebVoiceProvider, true);
    assert.notEqual(first, second);
  });

  it('rejects unknown providers explicitly', () => {
    assert.throws(() => createProvider('missing-provider'), {
      message: 'Unknown voice provider: missing-provider',
    });
  });

  it('fails closed for unknown modes and non-renderer metadata', () => {
    const streamingInfo = getAvailableProviders().find((provider) => provider.id === CLAUDE_WEB_PROVIDER_ID);
    assert.ok(streamingInfo);

    assert.equal(isVoiceTranscriptionMode('batch'), true);
    assert.equal(isVoiceTranscriptionMode('streaming'), true);
    assert.equal(isVoiceTranscriptionMode('realtime'), false);
    assert.equal(isStreamingVoiceProviderInfo(streamingInfo), true);
    assert.equal(
      isRendererSafeVoiceProviderInfo({
        ...streamingInfo,
        transcriptionMode: 'realtime',
      }),
      false,
    );
    assert.equal(
      isRendererSafeVoiceProviderInfo({
        ...streamingInfo,
        accessToken: 'must-not-cross-renderer-boundary',
      }),
      false,
    );
  });

  it('copies streaming PCM chunks before provider ownership', () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const copied = copyStreamingTranscriptionChunk(source);

    assert.notEqual(copied.buffer, source.buffer);
    source[0] = 99;
    assert.deepEqual(copied, new Uint8Array([1, 2, 3, 4]));
  });
});
