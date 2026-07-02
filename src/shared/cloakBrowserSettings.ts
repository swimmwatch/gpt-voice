export const CLOAK_BROWSER_HUMAN_PRESETS = ['default', 'careful'] as const;
export const CLOAK_BROWSER_BACKGROUND_MODES = ['hidden', 'visible'] as const;

export type CloakBrowserHumanPreset = (typeof CLOAK_BROWSER_HUMAN_PRESETS)[number];
export type CloakBrowserBackgroundMode = (typeof CLOAK_BROWSER_BACKGROUND_MODES)[number];

export interface CloakBrowserProxySettingsView {
  enabled: boolean;
  server: string;
  bypass: string;
  username: string;
  hasPassword: boolean;
  geoip: boolean;
}

export interface CloakBrowserSettingsView {
  humanize: boolean;
  humanPreset: CloakBrowserHumanPreset;
  backgroundMode: CloakBrowserBackgroundMode;
  fingerprintSeed: string;
  locale: string;
  timezone: string;
  proxy: CloakBrowserProxySettingsView;
}

export interface CloakBrowserProxySettingsInput {
  enabled?: boolean;
  server?: string;
  bypass?: string;
  username?: string;
  password?: string;
  clearPassword?: boolean;
  geoip?: boolean;
}

export interface CloakBrowserSettingsInput {
  humanize?: boolean;
  humanPreset?: string;
  backgroundMode?: string;
  fingerprintSeed?: string;
  locale?: string;
  timezone?: string;
  proxy?: CloakBrowserProxySettingsInput;
}

interface ProxyAuthWarningInput {
  enabled?: boolean;
  server?: string;
  username?: string;
  password?: string;
  hasPassword?: boolean;
  clearPassword?: boolean;
}

export function isSocks5ProxyServer(server?: string): boolean {
  try {
    return new URL((server || '').trim()).protocol === 'socks5:';
  } catch {
    return false;
  }
}

export function shouldWarnSocks5ProxyAuth(proxy: ProxyAuthWarningInput): boolean {
  if (!proxy.enabled || !isSocks5ProxyServer(proxy.server)) return false;

  return Boolean(proxy.username?.trim() || proxy.password?.trim() || (proxy.hasPassword && !proxy.clearPassword));
}
