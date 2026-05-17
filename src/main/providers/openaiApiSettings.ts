import * as fs from 'fs';
import * as path from 'path';
import { safeStorage } from 'electron';
import { APP_DIR } from '../config';
import { createLogger } from '../logger';
import {
  normalizeOpenAIApiSettings,
  sanitizeOpenAIApiSettings,
  shouldUpdateApiKey,
  type OpenAIApiSettingsInput,
  type OpenAIApiSettingsView,
  type OpenAIApiSettingsWithSecret,
} from './openaiApiSettingsUtils';

const log = createLogger('openai-api-settings');
const SETTINGS_FILE = path.join(APP_DIR, 'openai-api-settings.json');

interface StoredOpenAIApiSettings extends OpenAIApiSettingsInput {
  encryptedApiKey?: string;
}

function readStoredSettings(): StoredOpenAIApiSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  } catch (error) {
    log.warn('Failed to read OpenAI API settings:', error);
    return {};
  }
}

function writeStoredSettings(settings: StoredOpenAIApiSettings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

function encryptApiKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is not available on this system');
  }
  return safeStorage.encryptString(apiKey).toString('base64');
}

function decryptApiKey(encryptedApiKey?: string): string {
  if (!encryptedApiKey) return '';
  if (!safeStorage.isEncryptionAvailable()) return '';

  try {
    return safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64'));
  } catch (error) {
    log.warn('Failed to decrypt OpenAI API key:', error);
    return '';
  }
}

export function getOpenAIApiSettingsView(): OpenAIApiSettingsView {
  const stored = readStoredSettings();
  return sanitizeOpenAIApiSettings(stored, Boolean(decryptApiKey(stored.encryptedApiKey)));
}

export function getOpenAIApiSettingsWithSecret(): OpenAIApiSettingsWithSecret {
  const stored = readStoredSettings();
  return {
    ...normalizeOpenAIApiSettings(stored),
    apiKey: decryptApiKey(stored.encryptedApiKey),
  };
}

export function saveOpenAIApiSettings(input: OpenAIApiSettingsInput): OpenAIApiSettingsView {
  const stored = readStoredSettings();
  const normalized = normalizeOpenAIApiSettings({ ...stored, ...input });
  const next: StoredOpenAIApiSettings = {
    ...normalized,
    encryptedApiKey: stored.encryptedApiKey,
  };

  if (shouldUpdateApiKey(input.apiKey)) {
    next.encryptedApiKey = encryptApiKey(input.apiKey.trim());
  }

  writeStoredSettings(next);
  return sanitizeOpenAIApiSettings(next, Boolean(decryptApiKey(next.encryptedApiKey)));
}

export function clearOpenAIApiKey(): OpenAIApiSettingsView {
  const stored = readStoredSettings();
  const next: StoredOpenAIApiSettings = normalizeOpenAIApiSettings(stored);
  writeStoredSettings(next);
  return sanitizeOpenAIApiSettings(next, false);
}
