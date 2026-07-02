import * as fs from 'fs';
import * as path from 'path';
import { APP_DIR, getFingerprintSeed } from '@main/config';
import {
  decryptSafeStorageString,
  encryptSafeStorageString,
  isSafeStorageEncryptionAvailable,
} from '@main/electronRuntime';
import { createLogger } from '@main/logger';
import {
  createCloakBrowserSettingsView,
  normalizeCloakBrowserSettingsInput,
  type NormalizedCloakBrowserSettings,
} from '@main/cloakBrowserSettingsUtils';
import type {
  CloakBrowserProxySettingsInput,
  CloakBrowserSettingsInput,
  CloakBrowserSettingsView,
} from '@shared/cloakBrowserSettings';

interface StoredCloakBrowserProxySettings extends Omit<CloakBrowserProxySettingsInput, 'password' | 'clearPassword'> {
  encryptedPassword?: string;
}

interface StoredCloakBrowserSettings extends Omit<CloakBrowserSettingsInput, 'proxy'> {
  proxy?: StoredCloakBrowserProxySettings;
}

export interface CloakBrowserProxySettingsWithSecret extends Omit<CloakBrowserSettingsView['proxy'], 'hasPassword'> {
  password: string;
}

export interface CloakBrowserSettingsWithSecret extends Omit<CloakBrowserSettingsView, 'proxy'> {
  proxy: CloakBrowserProxySettingsWithSecret;
}

export interface PreparedCloakBrowserSettings {
  settings: CloakBrowserSettingsView;
  settingsWithSecret: CloakBrowserSettingsWithSecret;
  persist: () => CloakBrowserSettingsView;
}

const log = createLogger('cloakbrowser-settings');
const SETTINGS_FILE = path.join(APP_DIR, 'cloakbrowser-settings.json');

function readStoredSettings(): StoredCloakBrowserSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as StoredCloakBrowserSettings;
  } catch (error) {
    log.warn('Failed to read CloakBrowser settings:', error);
    return {};
  }
}

function writeStoredSettings(settings: StoredCloakBrowserSettings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

function encryptProxyPassword(password: string): string {
  if (!isSafeStorageEncryptionAvailable()) {
    throw new Error('Secure storage is not available on this system');
  }
  return encryptSafeStorageString(password).toString('base64');
}

function decryptProxyPassword(encryptedPassword?: string): string {
  if (!encryptedPassword) return '';
  if (!isSafeStorageEncryptionAvailable()) return '';

  try {
    return decryptSafeStorageString(Buffer.from(encryptedPassword, 'base64'));
  } catch (error) {
    log.warn('Failed to decrypt CloakBrowser proxy password:', error);
    return '';
  }
}

function hasDecryptableProxyPassword(encryptedPassword?: string): boolean {
  return Boolean(decryptProxyPassword(encryptedPassword));
}

function shouldSanitizeFingerprintSeed(input: CloakBrowserSettingsInput): boolean {
  return typeof input.fingerprintSeed !== 'string' || input.fingerprintSeed.trim() === '';
}

function mergeStoredSettings(
  stored: StoredCloakBrowserSettings,
  input: CloakBrowserSettingsInput,
): CloakBrowserSettingsInput {
  return {
    humanize: input.humanize ?? stored.humanize,
    humanPreset: input.humanPreset ?? stored.humanPreset,
    backgroundMode: input.backgroundMode ?? stored.backgroundMode,
    fingerprintSeed: input.fingerprintSeed ?? stored.fingerprintSeed,
    locale: input.locale ?? stored.locale,
    timezone: input.timezone ?? stored.timezone,
    proxy: {
      enabled: input.proxy?.enabled ?? stored.proxy?.enabled,
      server: input.proxy?.server ?? stored.proxy?.server,
      bypass: input.proxy?.bypass ?? stored.proxy?.bypass,
      username: input.proxy?.username ?? stored.proxy?.username,
      geoip: input.proxy?.geoip ?? stored.proxy?.geoip,
    },
  };
}

function toStoredSettings(
  settings: NormalizedCloakBrowserSettings,
  encryptedPassword?: string,
): StoredCloakBrowserSettings {
  return {
    humanize: settings.humanize,
    humanPreset: settings.humanPreset,
    backgroundMode: settings.backgroundMode,
    fingerprintSeed: settings.fingerprintSeed,
    locale: settings.locale,
    timezone: settings.timezone,
    proxy: {
      enabled: settings.proxy.enabled,
      server: settings.proxy.server,
      bypass: settings.proxy.bypass,
      username: settings.proxy.username,
      geoip: settings.proxy.geoip,
      encryptedPassword,
    },
  };
}

export function getCloakBrowserSettingsView(): CloakBrowserSettingsView {
  const stored = readStoredSettings();
  const normalized = normalizeCloakBrowserSettingsInput(stored, getFingerprintSeed(), {
    sanitizeInvalidFingerprintSeed: true,
  });
  return createCloakBrowserSettingsView(normalized, hasDecryptableProxyPassword(stored.proxy?.encryptedPassword));
}

export function getCloakBrowserSettingsWithSecret(): CloakBrowserSettingsWithSecret {
  const stored = readStoredSettings();
  const normalized = normalizeCloakBrowserSettingsInput(stored, getFingerprintSeed(), {
    sanitizeInvalidFingerprintSeed: true,
  });
  const password = decryptProxyPassword(stored.proxy?.encryptedPassword);

  return {
    ...normalized,
    proxy: {
      ...normalized.proxy,
      password,
    },
  };
}

export function prepareCloakBrowserSettings(input: CloakBrowserSettingsInput = {}): PreparedCloakBrowserSettings {
  const stored = readStoredSettings();
  const normalized = normalizeCloakBrowserSettingsInput(mergeStoredSettings(stored, input), getFingerprintSeed(), {
    sanitizeInvalidFingerprintSeed: shouldSanitizeFingerprintSeed(input),
  });
  const storedPassword = decryptProxyPassword(stored.proxy?.encryptedPassword);
  let encryptedPassword = storedPassword ? stored.proxy?.encryptedPassword : undefined;
  let proxyPassword = storedPassword;
  const password = typeof input.proxy?.password === 'string' ? input.proxy.password.trim() : '';

  if (input.proxy?.clearPassword) {
    encryptedPassword = undefined;
    proxyPassword = '';
  }
  if (password) {
    encryptedPassword = encryptProxyPassword(password);
    proxyPassword = password;
  }

  const storedSettings = toStoredSettings(normalized, encryptedPassword);
  const view = createCloakBrowserSettingsView(normalized, Boolean(proxyPassword));
  const settingsWithSecret: CloakBrowserSettingsWithSecret = {
    ...normalized,
    proxy: {
      ...normalized.proxy,
      password: proxyPassword,
    },
  };

  return {
    settings: view,
    settingsWithSecret,
    persist: () => {
      writeStoredSettings(storedSettings);
      return view;
    },
  };
}

export function saveCloakBrowserSettings(input: CloakBrowserSettingsInput = {}): CloakBrowserSettingsView {
  return prepareCloakBrowserSettings(input).persist();
}
