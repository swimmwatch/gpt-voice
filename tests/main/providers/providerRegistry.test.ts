import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeWebVoiceProvider, createProvider, getAvailableProviders } from '@main/providers';
import { CLAUDE_WEB_PROVIDER_ID, DEFAULT_CLAUDE_WEB_LANGUAGE } from '@shared/claudeWebSettings';

describe('provider registry', () => {
  it('exposes every provider once with stable metadata', () => {
    const providers = getAvailableProviders();

    assert.deepEqual(providers, [
      { id: 'chatgpt', name: 'ChatGPT Web', authType: 'browserSession', category: 'web', hasSettings: true },
      { id: 'openai-api', name: 'OpenAI API', authType: 'apiKey', category: 'api', hasSettings: true },
      {
        id: CLAUDE_WEB_PROVIDER_ID,
        name: 'Claude Web',
        authType: 'browserSession',
        category: 'web',
        hasSettings: true,
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
});
