import type { ProviderSettings } from '@renderer/types';

export type ProviderSettingsViewState =
  | {
      canClearAuth: boolean;
      isBusy: boolean;
      kind: 'apiKey';
      primaryActionLabelKey: 'providerSettings.save';
    }
  | {
      canClearAuth: boolean;
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
    isBusy,
    kind: 'browserSession',
    primaryActionLabelKey: settings.hasSession ? 'providerSettings.relogin' : 'providerSettings.login',
    sessionStateLabelKey: settings.hasSession ? 'providerSettings.sessionSaved' : 'providerSettings.sessionMissing',
  };
}
