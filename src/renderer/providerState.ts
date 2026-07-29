import type { BackgroundBrowserStatus, ProviderAuthType, ProviderSettings } from './types';

export const PROVIDER_CONNECTION_REASONS = {
  ApiConfigured: 'api-configured',
  ApiNotConfigured: 'api-not-configured',
  BrowserReady: 'browser-ready',
  BrowserUnavailable: 'browser-unavailable',
  Checking: 'checking',
  SessionExpired: 'session-expired',
  SessionMissing: 'session-missing',
} as const;

export type ProviderConnectionReason = (typeof PROVIDER_CONNECTION_REASONS)[keyof typeof PROVIDER_CONNECTION_REASONS];

export interface ProviderLoginState {
  isLoggedIn: boolean;
  isLoading: boolean;
  reason: ProviderConnectionReason;
  sessionExpired: boolean;
}

export function getProviderLoginState(
  authType: ProviderAuthType,
  hasSession: boolean,
  backgroundStatus?: BackgroundBrowserStatus,
): ProviderLoginState {
  if (authType === 'apiKey') {
    return {
      isLoggedIn: hasSession,
      isLoading: false,
      reason: hasSession ? PROVIDER_CONNECTION_REASONS.ApiConfigured : PROVIDER_CONNECTION_REASONS.ApiNotConfigured,
      sessionExpired: false,
    };
  }

  if (backgroundStatus?.authExpired) {
    return {
      isLoggedIn: false,
      isLoading: false,
      reason: PROVIDER_CONNECTION_REASONS.SessionExpired,
      sessionExpired: true,
    };
  }

  if (backgroundStatus?.ready) {
    return {
      isLoggedIn: true,
      isLoading: false,
      reason: PROVIDER_CONNECTION_REASONS.BrowserReady,
      sessionExpired: false,
    };
  }

  if (backgroundStatus?.error) {
    return {
      isLoggedIn: false,
      isLoading: false,
      reason: PROVIDER_CONNECTION_REASONS.BrowserUnavailable,
      sessionExpired: false,
    };
  }

  return {
    isLoggedIn: false,
    isLoading: hasSession,
    reason: hasSession ? PROVIDER_CONNECTION_REASONS.Checking : PROVIDER_CONNECTION_REASONS.SessionMissing,
    sessionExpired: false,
  };
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
