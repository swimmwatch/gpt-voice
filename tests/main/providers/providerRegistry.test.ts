import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProvider, getAvailableProviders } from '@main/providers';

describe('provider registry', () => {
  it('exposes ChatGPT Web and OpenAI API provider metadata', () => {
    const providers = getAvailableProviders();

    assert.deepEqual(providers.map((provider) => provider.id).sort(), ['chatgpt', 'openai-api']);
    assert.equal(providers.find((provider) => provider.id === 'chatgpt')?.authType, 'browserSession');
    assert.equal(providers.find((provider) => provider.id === 'openai-api')?.authType, 'apiKey');
  });

  it('creates providers with matching readiness semantics', () => {
    const chatgpt = createProvider('chatgpt');
    const openaiApi = createProvider('openai-api');

    assert.equal(chatgpt.requiresBrowserSession(), true);
    assert.equal(openaiApi.requiresBrowserSession(), false);
  });

  it('rejects unknown providers explicitly', () => {
    assert.throws(() => createProvider('missing-provider'), /Unknown voice provider/);
  });
});
