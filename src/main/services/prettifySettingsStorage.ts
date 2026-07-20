import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_DIR, currentPrettifySettings, saveConfig, setPrettifySettings } from '@main/config';
import {
  decryptSafeStorageString,
  encryptSafeStorageString,
  isSafeStorageEncryptionAvailable,
} from '@main/electronRuntime';
import { createLogger } from '@main/logger';
import {
  assertValidPrettifySettingsInput,
  getPrettifyBaseUrlValidationError,
  getPrettifyProviderCapabilities,
  normalizePrettifySettings,
  type PrettifySettings,
  type PrettifySettingsInput,
} from '@shared/prettifySettings';

const log = createLogger('prettify-settings');
const SETTINGS_FILE = path.join(APP_DIR, 'prettify-provider-settings.json');

interface StoredPrettifyProviderSettings {
  encryptedVllmApiKey?: string;
}

export interface PrettifySettingsWithSecret extends PrettifySettings {
  vllm: PrettifySettings['vllm'] & {
    apiKey: string;
  };
}

function readStoredSettings(): StoredPrettifyProviderSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as StoredPrettifyProviderSettings;
  } catch (error: unknown) {
    log.warn('Failed to read prettify provider settings:', error instanceof Error ? error.message : error);
    return {};
  }
}

function writeStoredSettings(settings: StoredPrettifyProviderSettings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

function encryptApiKey(apiKey: string): string {
  if (!isSafeStorageEncryptionAvailable()) {
    throw new Error('Secure storage is not available on this system');
  }
  return encryptSafeStorageString(apiKey).toString('base64');
}

function decryptApiKey(encryptedApiKey?: string): string {
  if (!encryptedApiKey) return '';
  if (!isSafeStorageEncryptionAvailable()) return '';

  try {
    return decryptSafeStorageString(Buffer.from(encryptedApiKey, 'base64'));
  } catch (error: unknown) {
    log.warn('Failed to decrypt vLLM API key:', error instanceof Error ? error.message : error);
    return '';
  }
}

export function mergePrettifySettingsForStorage(
  currentSettings: PrettifySettings,
  input: PrettifySettingsInput = {},
  hasApiKey = false,
): PrettifySettings {
  return normalizePrettifySettings({
    ...currentSettings,
    ...input,
    claudeCli: {
      ...currentSettings.claudeCli,
      ...input.claudeCli,
    },
    codexCli: {
      ...currentSettings.codexCli,
      ...input.codexCli,
    },
    ollama: {
      ...currentSettings.ollama,
      ...input.ollama,
    },
    vllm: {
      ...currentSettings.vllm,
      ...input.vllm,
      hasApiKey,
    },
  });
}

function mergePrettifySettings(input: PrettifySettingsInput = {}, hasApiKey = false): PrettifySettings {
  return mergePrettifySettingsForStorage(currentPrettifySettings, input, hasApiKey);
}

function assertValidPrettifyProviderUrls(settings: PrettifySettings): void {
  const baseUrls = [
    ['ollama', settings.ollama.baseUrl],
    ['vllm', settings.vllm.baseUrl],
  ] as const;
  for (const [providerId, baseUrl] of baseUrls) {
    if (!getPrettifyProviderCapabilities(providerId).baseUrl) continue;
    const error = getPrettifyBaseUrlValidationError(baseUrl);
    if (error) throw new Error(error);
  }
}

export function getPrettifySettingsView(): PrettifySettings {
  const stored = readStoredSettings();
  return mergePrettifySettings({}, Boolean(decryptApiKey(stored.encryptedVllmApiKey)));
}

export function getPrettifySettingsWithSecret(input: PrettifySettingsInput = {}): PrettifySettingsWithSecret {
  assertValidPrettifySettingsInput(input);
  const stored = readStoredSettings();
  const draftApiKey = typeof input.vllm?.apiKey === 'string' ? input.vllm.apiKey.trim() : '';
  const savedApiKey = input.vllm?.clearApiKey ? '' : decryptApiKey(stored.encryptedVllmApiKey);
  const apiKey = draftApiKey || savedApiKey;
  const settings = mergePrettifySettings(input, Boolean(apiKey));
  assertValidPrettifyProviderUrls(settings);

  return {
    ...settings,
    vllm: {
      ...settings.vllm,
      apiKey,
    },
  };
}

export function savePrettifySettings(input: PrettifySettingsInput = {}): PrettifySettings {
  assertValidPrettifySettingsInput(input);
  const stored = readStoredSettings();
  const draftApiKey = typeof input.vllm?.apiKey === 'string' ? input.vllm.apiKey.trim() : '';
  const nextStored: StoredPrettifyProviderSettings = { ...stored };

  if (input.vllm?.clearApiKey) {
    delete nextStored.encryptedVllmApiKey;
  }
  if (draftApiKey) {
    nextStored.encryptedVllmApiKey = encryptApiKey(draftApiKey);
  }

  const hasApiKey = Boolean(decryptApiKey(nextStored.encryptedVllmApiKey));
  const settings = mergePrettifySettings(input, hasApiKey);
  assertValidPrettifyProviderUrls(settings);
  writeStoredSettings(nextStored);
  setPrettifySettings(settings);
  saveConfig();
  return getPrettifySettingsView();
}
