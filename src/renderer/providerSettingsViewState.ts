import type { ClaudeWebProviderSettings, ProviderSettings } from '@renderer/types';
import {
  canonicalizeClaudeWebLanguage,
  getClaudeWebLanguageInputError,
  suggestClaudeWebLanguage,
  type ClaudeWebLanguage,
} from '@shared/claudeWebSettings';

export type ProviderSettingsViewState =
  | {
      canClearAuth: boolean;
      isBusy: boolean;
      kind: 'apiKey';
      primaryActionLabelKey: 'providerSettings.save';
    }
  | {
      canClearAuth: boolean;
      hasLanguageSetting: boolean;
      isBusy: boolean;
      kind: 'browserSession';
      primaryActionLabelKey: 'providerSettings.login' | 'providerSettings.relogin';
      sessionStateLabelKey: 'providerSettings.sessionMissing' | 'providerSettings.sessionSaved';
    };

export function getProviderSettingsViewState(settings: ProviderSettings, isBusy: boolean): ProviderSettingsViewState {
  if (settings.authType === 'apiKey') {
    return {
      canClearAuth: settings.hasApiKey,
      isBusy,
      kind: 'apiKey',
      primaryActionLabelKey: 'providerSettings.save',
    };
  }

  return {
    canClearAuth: settings.hasSession,
    hasLanguageSetting: settings.providerId === 'claude-web',
    isBusy,
    kind: 'browserSession',
    primaryActionLabelKey: settings.hasSession ? 'providerSettings.relogin' : 'providerSettings.login',
    sessionStateLabelKey: settings.hasSession ? 'providerSettings.sessionSaved' : 'providerSettings.sessionMissing',
  };
}

export interface ClaudeWebLanguageFormState {
  isDirty: boolean;
  isValid: boolean;
}

export function getClaudeWebLanguageFormState(
  settings: ClaudeWebProviderSettings,
  language: string,
): ClaudeWebLanguageFormState {
  if (getClaudeWebLanguageInputError(language)) {
    return { isDirty: language !== settings.language, isValid: false };
  }
  return {
    isDirty: canonicalizeClaudeWebLanguage(language) !== settings.language,
    isValid: true,
  };
}

export function getClaudeWebLocaleSuggestion(browserLocale: unknown, appLocale: unknown): ClaudeWebLanguage | null {
  return suggestClaudeWebLanguage(browserLocale) ?? suggestClaudeWebLanguage(appLocale);
}
