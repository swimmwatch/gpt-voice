import type { BackgroundBrowserStatus, ProviderAuthType, ProviderSettings } from './types';

export interface ProviderLoginState {
  isLoggedIn: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
}

export function getProviderLoginState(
  authType: ProviderAuthType,
  hasSession: boolean,
  backgroundStatus?: BackgroundBrowserStatus,
): ProviderLoginState {
  if (authType === 'apiKey') {
    return { isLoggedIn: hasSession, isLoading: false, sessionExpired: false };
  }

  if (backgroundStatus?.authExpired) {
    return { isLoggedIn: false, isLoading: false, sessionExpired: true };
  }

  if (backgroundStatus?.ready) {
    return { isLoggedIn: true, isLoading: false, sessionExpired: false };
  }

  if (backgroundStatus?.error) {
    return { isLoggedIn: false, isLoading: false, sessionExpired: false };
  }

  return { isLoggedIn: false, isLoading: hasSession, sessionExpired: false };
}

export function isProviderConfigured(settings: ProviderSettings): boolean {
  return settings.authType === 'apiKey' ? settings.hasApiKey : settings.hasSession;
}

export function isActiveProviderSettingsChange(settings: ProviderSettings, activeProviderId: string): boolean {
  return settings.providerId === activeProviderId;
}

export function expireBrowserSessionSettings(settings: ProviderSettings | null): ProviderSettings | null {
  if (!settings || settings.authType !== 'browserSession' || !settings.hasSession) {
    return settings;
  }

  return { ...settings, hasSession: false };
}
