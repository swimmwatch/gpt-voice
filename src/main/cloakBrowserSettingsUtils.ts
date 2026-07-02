import {
  CLOAK_BROWSER_BACKGROUND_MODES,
  CLOAK_BROWSER_HUMAN_PRESETS,
  type CloakBrowserBackgroundMode,
  type CloakBrowserHumanPreset,
  type CloakBrowserProxySettingsView,
  type CloakBrowserSettingsInput,
  type CloakBrowserSettingsView,
} from '@shared/cloakBrowserSettings';

export interface NormalizedCloakBrowserProxySettings {
  enabled: boolean;
  server: string;
  bypass: string;
  username: string;
  geoip: boolean;
}

export interface NormalizedCloakBrowserSettings {
  humanize: boolean;
  humanPreset: CloakBrowserHumanPreset;
  backgroundMode: CloakBrowserBackgroundMode;
  fingerprintSeed: string;
  locale: string;
  timezone: string;
  proxy: NormalizedCloakBrowserProxySettings;
}

export interface NormalizeCloakBrowserSettingsOptions {
  sanitizeInvalidFingerprintSeed?: boolean;
}

export const DEFAULT_CLOAK_BROWSER_HUMANIZE = true;
export const DEFAULT_CLOAK_BROWSER_HUMAN_PRESET: CloakBrowserHumanPreset = 'careful';
export const DEFAULT_CLOAK_BROWSER_BACKGROUND_MODE: CloakBrowserBackgroundMode = 'hidden';
export const DEFAULT_CLOAK_BROWSER_LOCALE = 'en-US';

const SUPPORTED_PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks5:']);
const FINGERPRINT_SEED_PATTERN = /^\d+$/;

export function getSystemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function generateCloakBrowserFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

export function isCloakBrowserHumanPreset(value: string): value is CloakBrowserHumanPreset {
  return CLOAK_BROWSER_HUMAN_PRESETS.includes(value as CloakBrowserHumanPreset);
}

export function isCloakBrowserBackgroundMode(value: string): value is CloakBrowserBackgroundMode {
  return CLOAK_BROWSER_BACKGROUND_MODES.includes(value as CloakBrowserBackgroundMode);
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidFingerprintSeed(value: string): boolean {
  return FINGERPRINT_SEED_PATTERN.test(value);
}

function validateFingerprintSeed(value: string): void {
  if (!isValidFingerprintSeed(value)) {
    throw new Error('Fingerprint seed must contain digits only');
  }
}

function normalizeFingerprintSeed(
  value: unknown,
  fallbackFingerprintSeed: string,
  sanitizeInvalidValue: boolean,
): string {
  const candidate = getString(value);
  if (candidate) {
    if (isValidFingerprintSeed(candidate)) return candidate;
    if (!sanitizeInvalidValue) validateFingerprintSeed(candidate);
  }

  const fallback = getString(fallbackFingerprintSeed);
  if (fallback && isValidFingerprintSeed(fallback)) return fallback;
  return generateCloakBrowserFingerprintSeed();
}

function validateLocale(value: string): void {
  if (!value) return;

  try {
    new Intl.Locale(value);
  } catch {
    throw new Error('Locale must be a valid BCP 47 locale');
  }
}

function validateTimezone(value: string): void {
  if (!value) return;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
  } catch {
    throw new Error('Timezone must be a valid IANA timezone');
  }
}

function validateProxyServer(value: string, enabled: boolean): void {
  if (!enabled) return;

  if (!value) {
    throw new Error('Proxy server is required when proxy is enabled');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Proxy server must be a valid URL');
  }

  if (!SUPPORTED_PROXY_PROTOCOLS.has(url.protocol)) {
    throw new Error('Proxy server must use http, https, or socks5');
  }

  if (url.username || url.password) {
    throw new Error('Proxy credentials must be stored in username and password fields');
  }
}

export function normalizeCloakBrowserSettingsInput(
  input: CloakBrowserSettingsInput = {},
  fallbackFingerprintSeed: string,
  options: NormalizeCloakBrowserSettingsOptions = {},
): NormalizedCloakBrowserSettings {
  const proxyInput = input.proxy ?? {};
  const humanPreset =
    typeof input.humanPreset === 'string' && isCloakBrowserHumanPreset(input.humanPreset)
      ? input.humanPreset
      : DEFAULT_CLOAK_BROWSER_HUMAN_PRESET;
  const backgroundMode =
    typeof input.backgroundMode === 'string' && isCloakBrowserBackgroundMode(input.backgroundMode)
      ? input.backgroundMode
      : DEFAULT_CLOAK_BROWSER_BACKGROUND_MODE;
  const fingerprintSeed = normalizeFingerprintSeed(
    input.fingerprintSeed,
    fallbackFingerprintSeed,
    Boolean(options.sanitizeInvalidFingerprintSeed),
  );
  const locale = getString(input.locale) || DEFAULT_CLOAK_BROWSER_LOCALE;
  const timezone = getString(input.timezone) || getSystemTimezone();
  const proxy = {
    enabled: Boolean(proxyInput.enabled),
    server: getString(proxyInput.server),
    bypass: getString(proxyInput.bypass),
    username: getString(proxyInput.username),
    geoip: Boolean(proxyInput.geoip),
  };

  validateFingerprintSeed(fingerprintSeed);
  validateLocale(locale);
  validateTimezone(timezone);
  validateProxyServer(proxy.server, proxy.enabled);

  return {
    humanize: typeof input.humanize === 'boolean' ? input.humanize : DEFAULT_CLOAK_BROWSER_HUMANIZE,
    humanPreset,
    backgroundMode,
    fingerprintSeed,
    locale,
    timezone,
    proxy,
  };
}

export function createCloakBrowserSettingsView(
  settings: NormalizedCloakBrowserSettings,
  hasProxyPassword: boolean,
): CloakBrowserSettingsView {
  const proxy: CloakBrowserProxySettingsView = {
    ...settings.proxy,
    hasPassword: hasProxyPassword,
  };

  return {
    ...settings,
    proxy,
  };
}
