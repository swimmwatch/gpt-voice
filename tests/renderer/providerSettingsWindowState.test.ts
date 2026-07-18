import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findSettingsProvider,
  getProviderSettingsWindowProviderId,
  isMatchingProviderSettings,
} from '@renderer/providerSettingsWindowState';
import type { ProviderInfo, ProviderSettings } from '@renderer/types';

const providers: ProviderInfo[] = [
  {
    authType: 'browserSession',
    category: 'web',
    hasSettings: true,
    id: 'claude-web',
    name: 'Claude Web',
    transcriptionMode: 'streaming',
  },
  {
    authType: 'browserSession',
    category: 'web',
    hasSettings: false,
    id: 'future',
    name: 'Future',
    transcriptionMode: 'batch',
  },
];

describe('provider settings window state', () => {
  it('accepts exactly one non-empty provider ID from the window query', () => {
    assert.equal(getProviderSettingsWindowProviderId('?providerId=claude-web'), 'claude-web');
    assert.equal(getProviderSettingsWindowProviderId('?providerId='), null);
    assert.equal(getProviderSettingsWindowProviderId('?providerId=claude-web&providerId=future'), null);
    assert.equal(getProviderSettingsWindowProviderId('?providerId=%20claude-web'), null);
  });

  it('resolves only a matching provider that declares settings', () => {
    assert.equal(findSettingsProvider(providers, 'claude-web'), providers[0]);
    assert.equal(findSettingsProvider(providers, 'future'), null);
    assert.equal(findSettingsProvider(providers, 'missing'), null);
  });

  it('rejects a settings snapshot from another provider', () => {
    const settings: ProviderSettings = {
      authType: 'browserSession',
      hasSession: true,
      providerId: 'chatgpt',
    };

    assert.equal(isMatchingProviderSettings(settings, 'chatgpt'), true);
    assert.equal(isMatchingProviderSettings(settings, 'claude-web'), false);
  });
});
