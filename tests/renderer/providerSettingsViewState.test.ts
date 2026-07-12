import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getProviderSettingsViewState } from '@renderer/providerSettingsViewState';
import type { ProviderSettings } from '@renderer/types';

const browserSettings: ProviderSettings = {
  authType: 'browserSession',
  hasSession: false,
  providerId: 'chatgpt',
};

const apiSettings: ProviderSettings = {
  authType: 'apiKey',
  hasApiKey: false,
  language: 'auto',
  model: 'whisper-1',
  prompt: '',
  providerId: 'openai-api',
  temperature: 0,
};

describe('providerSettingsViewState', () => {
  it('maps a missing browser session to login with clearing disabled', () => {
    assert.deepEqual(getProviderSettingsViewState(browserSettings, false), {
      canClearAuth: false,
      isBusy: false,
      kind: 'browserSession',
      primaryActionLabelKey: 'providerSettings.login',
      sessionStateLabelKey: 'providerSettings.sessionMissing',
    });
  });

  it('maps a saved browser session to re-login with clearing enabled', () => {
    assert.deepEqual(getProviderSettingsViewState({ ...browserSettings, hasSession: true }, false), {
      canClearAuth: true,
      isBusy: false,
      kind: 'browserSession',
      primaryActionLabelKey: 'providerSettings.relogin',
      sessionStateLabelKey: 'providerSettings.sessionSaved',
    });
  });

  it('maps API-key settings to a save form and enables clear only for a stored key', () => {
    assert.deepEqual(getProviderSettingsViewState(apiSettings, false), {
      canClearAuth: false,
      isBusy: false,
      kind: 'apiKey',
      primaryActionLabelKey: 'providerSettings.save',
    });
    assert.deepEqual(getProviderSettingsViewState({ ...apiSettings, hasApiKey: true }, true), {
      canClearAuth: true,
      isBusy: true,
      kind: 'apiKey',
      primaryActionLabelKey: 'providerSettings.save',
    });
  });
});
