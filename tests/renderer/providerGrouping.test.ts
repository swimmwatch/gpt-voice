import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupProvidersByCategory } from '@renderer/providerGrouping';
import type { ProviderInfo } from '@renderer/types';

describe('provider grouping', () => {
  it('sorts Web, API, and Local groups and omits empty categories', () => {
    const providers: ProviderInfo[] = [
      { id: 'whisper', name: 'Whisper', authType: 'apiKey', category: 'local', hasSettings: true },
      { id: 'openai-api', name: 'OpenAI API', authType: 'apiKey', category: 'api', hasSettings: true },
      { id: 'claude-web', name: 'Claude Web', authType: 'browserSession', category: 'web', hasSettings: true },
      { id: 'chatgpt', name: 'ChatGPT Web', authType: 'browserSession', category: 'web', hasSettings: true },
    ];

    assert.deepEqual(
      groupProvidersByCategory(providers).map((group) => ({
        category: group.category,
        providers: group.providers.map((provider) => provider.id),
      })),
      [
        { category: 'web', providers: ['chatgpt', 'claude-web'] },
        { category: 'api', providers: ['openai-api'] },
        { category: 'local', providers: ['whisper'] },
      ],
    );

    assert.deepEqual(groupProvidersByCategory(providers.filter((provider) => provider.category === 'api')), [
      { category: 'api', providers: [providers[1]] },
    ]);
  });
});
