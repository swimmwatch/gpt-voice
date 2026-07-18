import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldRefreshProviderAfterMutation } from '@main/providerSettingsMutation';

describe('provider settings mutation', () => {
  it('refreshes only when the changed provider is currently active', () => {
    assert.equal(shouldRefreshProviderAfterMutation('claude-web', 'claude-web'), true);
    assert.equal(shouldRefreshProviderAfterMutation('claude-web', 'chatgpt'), false);
    assert.equal(shouldRefreshProviderAfterMutation('openai-api', 'chatgpt'), false);
  });
});
