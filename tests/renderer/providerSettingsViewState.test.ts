import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getClaudeWebLanguageFormState,
  getClaudeWebLocaleSuggestion,
  getProviderSettingsViewState,
} from '@renderer/providerSettingsViewState';
import type { ClaudeWebProviderSettings, ProviderSettings } from '@renderer/types';

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

const claudeSettings: ClaudeWebProviderSettings = {
  authType: 'browserSession',
  hasSession: true,
  language: 'en-US',
  providerId: 'claude-web',
};

describe('providerSettingsViewState', () => {
  it('maps a missing browser session to login with clearing disabled', () => {
    assert.deepEqual(getProviderSettingsViewState(browserSettings, false), {
      canClearAuth: false,
      hasLanguageSetting: false,
      isBusy: false,
      kind: 'browserSession',
      primaryActionLabelKey: 'providerSettings.login',
      sessionStateLabelKey: 'providerSettings.sessionMissing',
    });
  });

  it('maps a saved browser session to re-login with clearing enabled', () => {
    assert.deepEqual(getProviderSettingsViewState({ ...browserSettings, hasSession: true }, false), {
      canClearAuth: true,
      hasLanguageSetting: false,
      isBusy: false,
      kind: 'browserSession',
      primaryActionLabelKey: 'providerSettings.relogin',
      sessionStateLabelKey: 'providerSettings.sessionSaved',
    });
  });

  it('keeps Claude session actions generic while exposing its language setting', () => {
    assert.deepEqual(getProviderSettingsViewState(claudeSettings, false), {
      canClearAuth: true,
      hasLanguageSetting: true,
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

  it('derives canonical Claude language validity and dirty state without mutating settings', () => {
    assert.deepEqual(getClaudeWebLanguageFormState(claudeSettings, 'en-US'), {
      isDirty: false,
      isValid: true,
    });
    assert.deepEqual(getClaudeWebLanguageFormState(claudeSettings, '  EN-us  '), {
      isDirty: false,
      isValid: true,
    });
    assert.deepEqual(getClaudeWebLanguageFormState(claudeSettings, 'fr-fr'), {
      isDirty: true,
      isValid: true,
    });
    assert.deepEqual(getClaudeWebLanguageFormState(claudeSettings, 'en_US'), {
      isDirty: true,
      isValid: false,
    });
    assert.deepEqual(claudeSettings, {
      authType: 'browserSession',
      hasSession: true,
      language: 'en-US',
      providerId: 'claude-web',
    });
  });

  it('offers the browser locale first and falls back to the app locale without changing the field', () => {
    const currentLanguage = claudeSettings.language;

    assert.equal(getClaudeWebLocaleSuggestion('fr-fr', 'uk'), 'fr-FR');
    assert.equal(getClaudeWebLocaleSuggestion(undefined, 'uk'), 'uk');
    assert.equal(getClaudeWebLocaleSuggestion(undefined, undefined), null);
    assert.equal(claudeSettings.language, currentLanguage);
  });
});
