import type { BackgroundBrowserStatus, ProviderSettings } from './types';

export interface ProviderLoginState {
  isLoggedIn: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
}

export function getProviderLoginState(
  hasSession: boolean,
  backgroundStatus?: BackgroundBrowserStatus,
): ProviderLoginState {
  if (backgroundStatus?.authExpired) {
    return { isLoggedIn: false, isLoading: false, sessionExpired: true };
  }

  if (backgroundStatus?.ready) {
    return { isLoggedIn: true, isLoading: false, sessionExpired: false };
  }

  if (backgroundStatus?.error) {
    return { isLoggedIn: hasSession, isLoading: false, sessionExpired: false };
  }

  return { isLoggedIn: hasSession, isLoading: hasSession, sessionExpired: false };
}

export function expireBrowserSessionSettings(settings: ProviderSettings | null): ProviderSettings | null {
  if (!settings || settings.authType !== 'browserSession' || !settings.hasSession) {
    return settings;
  }

  return { ...settings, hasSession: false };
}
