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

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCloakBrowserSettingsInput(value: unknown): value is CloakBrowserSettingsInput {
  return isSettingsObject(value);
}

function getBooleanInputError(value: unknown, label: string): string | null {
  return value !== undefined && typeof value !== 'boolean' ? `${label} must be a boolean` : null;
}

function getStringInputError(value: unknown, label: string): string | null {
  return value !== undefined && typeof value !== 'string' ? `${label} must be a string` : null;
}

function getFingerprintSeedInputError(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !value.trim()) return 'Fingerprint seed is required';
  return isValidFingerprintSeed(value.trim()) ? null : 'Fingerprint seed must contain digits only';
}

function getLocaleInputError(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !value.trim()) return 'Locale is required';
  try {
    validateLocale(value.trim());
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function getTimezoneInputError(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !value.trim()) return 'Timezone is required';
  try {
    validateTimezone(value.trim());
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function getProxySettingsInputError(input: unknown): string | null {
  if (!isSettingsObject(input)) {
    return 'Proxy settings must be an object';
  }

  for (const [value, label] of [
    [input.enabled, 'Proxy enabled'],
    [input.geoip, 'Proxy GeoIP'],
    [input.clearPassword, 'Proxy password clear flag'],
  ] as const) {
    const error = getBooleanInputError(value, label);
    if (error) return error;
  }
  for (const [value, label] of [
    [input.server, 'Proxy server'],
    [input.bypass, 'Proxy bypass'],
    [input.username, 'Proxy username'],
    [input.password, 'Proxy password'],
  ] as const) {
    const error = getStringInputError(value, label);
    if (error) return error;
  }

  return null;
}

function getCloakBrowserGeneralInputError(input: CloakBrowserSettingsInput): string | null {
  const humanizeError = getBooleanInputError(input.humanize, 'Humanize');
  if (humanizeError) return humanizeError;
  if (input.humanPreset !== undefined && !isCloakBrowserHumanPreset(input.humanPreset)) {
    return 'Select a supported human preset';
  }
  if (input.backgroundMode !== undefined && !isCloakBrowserBackgroundMode(input.backgroundMode)) {
    return 'Select a supported background mode';
  }

  return (
    getFingerprintSeedInputError(input.fingerprintSeed) ??
    getLocaleInputError(input.locale) ??
    getTimezoneInputError(input.timezone)
  );
}

export function getCloakBrowserSettingsInputError(input: unknown = {}): string | null {
  if (!isCloakBrowserSettingsInput(input)) {
    return 'CloakBrowser settings must be an object';
  }

  return (
    getCloakBrowserGeneralInputError(input) ??
    (input.proxy === undefined ? null : getProxySettingsInputError(input.proxy))
  );
}

export function assertValidCloakBrowserSettingsInput(input: unknown = {}): asserts input is CloakBrowserSettingsInput {
  const error = getCloakBrowserSettingsInputError(input);
  if (error) throw new Error(error);
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
