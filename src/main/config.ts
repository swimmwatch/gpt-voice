import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { createLogger } from './logger';
import {
  DEFAULT_CANCEL_HOTKEY,
  DEFAULT_PRETTIFY_HOTKEY,
  DEFAULT_RECORD_HOTKEY,
  DEFAULT_RETRY_TRANSCRIPTION_HOTKEY,
  DEFAULT_STOP_HOTKEY,
  DEFAULT_TRANSLATE_HOTKEY,
} from '@shared/hotkeys';
import {
  DEFAULT_PRETTIFY_SETTINGS,
  DEFAULT_PRETTIFY_PROMPT,
  DEFAULT_PRETTIFY_REASONING,
  normalizePrettifySettings,
  type PrettifyReasoning,
  type PrettifySettings,
  type PrettifySettingsInput,
} from '@shared/prettifySettings';
import { DEFAULT_TEXT_ACTION_SETTINGS } from '@shared/textActionSettings';
import { DEFAULT_APP_LOCALE, normalizeAppLocale, type AppLocaleId } from '@shared/appLocale';

const log = createLogger('config');
const LEGACY_RETRY_TRANSCRIPTION_HOTKEY = 'Ctrl+F9';

const LEGACY_APP_DIRS = [path.join(os.homedir(), '.gpt-voice'), path.join(os.homedir(), '.webvoice')];

function getAppDataDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

export const APP_DIR = path.join(getAppDataDir(), 'GPT-Voice');

const MIGRATED_LEGACY_ENTRIES = ['config.json', 'chatgpt-session.json', 'access-token.json', 'browser-cache'];

function migrateWholeLegacyAppDir(legacyDir: string): boolean {
  fs.mkdirSync(path.dirname(APP_DIR), { recursive: true });

  try {
    fs.renameSync(legacyDir, APP_DIR);
    log.info('Migrated app data directory:', legacyDir, '->', APP_DIR);
  } catch (renameError) {
    try {
      fs.cpSync(legacyDir, APP_DIR, { recursive: true });
      fs.rmSync(legacyDir, { recursive: true, force: true });
      log.info('Copied app data directory:', legacyDir, '->', APP_DIR);
    } catch (copyError) {
      log.warn('Failed to migrate app data directory:', renameError, copyError);
    }
  }

  return fs.existsSync(APP_DIR);
}

function copyMissingLegacyEntries(legacyDir: string): void {
  for (const entry of MIGRATED_LEGACY_ENTRIES) {
    const source = path.join(legacyDir, entry);
    const target = path.join(APP_DIR, entry);
    if (!fs.existsSync(source) || fs.existsSync(target)) continue;

    try {
      fs.cpSync(source, target, { recursive: true });
      log.info('Copied missing app data entry:', source, '->', target);
    } catch (error) {
      log.warn('Failed to copy missing app data entry:', source, error);
    }
  }
}

function migrateLegacyAppDir(): void {
  const legacyDirs = LEGACY_APP_DIRS.filter((candidate) => candidate !== APP_DIR && fs.existsSync(candidate));
  if (legacyDirs.length === 0) return;

  if (!fs.existsSync(APP_DIR) && migrateWholeLegacyAppDir(legacyDirs[0])) {
    return;
  }

  fs.mkdirSync(APP_DIR, { recursive: true });
  for (const legacyDir of legacyDirs) {
    copyMissingLegacyEntries(legacyDir);
  }
}

migrateLegacyAppDir();

if (!fs.existsSync(APP_DIR)) {
  fs.mkdirSync(APP_DIR, { recursive: true });
}

export const BROWSER_CACHE_DIR = path.join(APP_DIR, 'browser-cache');
export const CONFIG_FILE = path.join(APP_DIR, 'config.json');

export let currentHotkey = DEFAULT_RECORD_HOTKEY;
export let currentCancelHotkey = DEFAULT_CANCEL_HOTKEY;
export let currentStopHotkey = DEFAULT_STOP_HOTKEY;
export let currentTranslateHotkey = DEFAULT_TRANSLATE_HOTKEY;
export let currentPrettifyHotkey = DEFAULT_PRETTIFY_HOTKEY;
export let currentRetryTranscriptionHotkey = DEFAULT_RETRY_TRANSCRIPTION_HOTKEY;
export let currentTranslateEnabled = DEFAULT_TEXT_ACTION_SETTINGS.translateEnabled;
export let currentPrettifyEnabled = DEFAULT_TEXT_ACTION_SETTINGS.prettifyEnabled;
export let currentTargetLang = 'en';
export let currentProvider = 'chatgpt';
export let currentLocale: AppLocaleId = DEFAULT_APP_LOCALE;
let currentLocaleWasExplicitlySelected = false;
export let currentFingerprintSeed = '';
export let currentPrettifyPrompt = DEFAULT_PRETTIFY_PROMPT;
export let currentPrettifyReasoning: PrettifyReasoning = DEFAULT_PRETTIFY_REASONING;
export let currentPrettifySettings: PrettifySettings = DEFAULT_PRETTIFY_SETTINGS;

const FINGERPRINT_SEED_PATTERN = /^\d+$/;

function generateFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

function isValidFingerprintSeed(value: string): boolean {
  return FINGERPRINT_SEED_PATTERN.test(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getConfigString(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key];
  return typeof value === 'string' && value ? value : undefined;
}

function getConfigBoolean(config: Record<string, unknown>, key: string): boolean | undefined {
  const value = config[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function setHotkeys(
  hotkey?: string,
  cancelHotkey?: string,
  stopHotkey?: string,
  translateHotkey?: string,
  prettifyHotkey?: string,
  retryTranscriptionHotkey?: string,
): void {
  if (hotkey !== undefined) currentHotkey = hotkey;
  if (cancelHotkey !== undefined) currentCancelHotkey = cancelHotkey;
  if (stopHotkey !== undefined) currentStopHotkey = stopHotkey;
  if (translateHotkey !== undefined) currentTranslateHotkey = translateHotkey;
  if (prettifyHotkey !== undefined) currentPrettifyHotkey = prettifyHotkey;
  if (retryTranscriptionHotkey !== undefined) currentRetryTranscriptionHotkey = retryTranscriptionHotkey;
}

export function setTranslateSettings(targetLang?: string): void {
  if (targetLang !== undefined) currentTargetLang = targetLang;
}

export function setTextActionSettings(translateEnabled?: boolean, prettifyEnabled?: boolean): void {
  if (translateEnabled !== undefined) currentTranslateEnabled = translateEnabled;
  if (prettifyEnabled !== undefined) currentPrettifyEnabled = prettifyEnabled;
}

function updateLegacyPrettifyMirrors(): void {
  currentPrettifyPrompt = currentPrettifySettings.prompt;
  currentPrettifyReasoning = DEFAULT_PRETTIFY_REASONING;
}

export function setPrettifySettings(settings: PrettifySettingsInput = {}): void {
  currentPrettifySettings = normalizePrettifySettings({
    ...currentPrettifySettings,
    ...settings,
    claudeCli: {
      ...currentPrettifySettings.claudeCli,
      ...settings.claudeCli,
    },
    codexCli: {
      ...currentPrettifySettings.codexCli,
      ...settings.codexCli,
    },
    ollama: {
      ...currentPrettifySettings.ollama,
      ...settings.ollama,
    },
    vllm: {
      ...currentPrettifySettings.vllm,
      ...settings.vllm,
    },
  });
  updateLegacyPrettifyMirrors();
}

export function setProvider(providerId: string): void {
  currentProvider = providerId;
}

export function setCurrentLocale(locale: AppLocaleId): void {
  currentLocale = locale;
  currentLocaleWasExplicitlySelected = true;
}

export function getFingerprintSeed(): string {
  if (!isValidFingerprintSeed(currentFingerprintSeed)) {
    currentFingerprintSeed = generateFingerprintSeed();
    saveConfig();
  }
  return currentFingerprintSeed;
}

export function getCurrentLocale(): AppLocaleId {
  return currentLocale;
}

export function hasExplicitLocalePreference(): boolean {
  return currentLocaleWasExplicitlySelected;
}

// Configuration loading validates each persisted field independently to isolate corrupt legacy values.
export function loadConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsedConfig: unknown = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      const config = isRecord(parsedConfig) ? parsedConfig : {};
      const hotkey = getConfigString(config, 'hotkey');
      const cancelHotkey = getConfigString(config, 'cancelHotkey');
      const stopHotkey = getConfigString(config, 'stopHotkey');
      const translateHotkey = getConfigString(config, 'translateHotkey');
      const prettifyHotkey = getConfigString(config, 'prettifyHotkey');
      const retryTranscriptionHotkey = getConfigString(config, 'retryTranscriptionHotkey');
      const translateEnabled = getConfigBoolean(config, 'translateEnabled');
      const prettifyEnabled = getConfigBoolean(config, 'prettifyEnabled');
      const targetLang = getConfigString(config, 'targetLang');
      const provider = getConfigString(config, 'provider');
      const locale = getConfigString(config, 'locale');
      const localeExplicit = getConfigBoolean(config, 'localeExplicit');
      const fingerprintSeed = getConfigString(config, 'fingerprintSeed');
      const prettifySettings = config.prettifySettings;
      const prettifyPrompt = getConfigString(config, 'prettifyPrompt');

      if (hotkey) currentHotkey = hotkey;
      if (cancelHotkey) currentCancelHotkey = cancelHotkey;
      if (stopHotkey) currentStopHotkey = stopHotkey;
      if (translateHotkey) currentTranslateHotkey = translateHotkey;
      if (prettifyHotkey) currentPrettifyHotkey = prettifyHotkey;
      if (retryTranscriptionHotkey) currentRetryTranscriptionHotkey = retryTranscriptionHotkey;
      if (translateEnabled !== undefined) currentTranslateEnabled = translateEnabled;
      if (prettifyEnabled !== undefined) currentPrettifyEnabled = prettifyEnabled;
      if (targetLang) currentTargetLang = targetLang;
      if (provider) currentProvider = provider;
      if (locale && localeExplicit === true) {
        currentLocale = normalizeAppLocale(locale) ?? DEFAULT_APP_LOCALE;
        currentLocaleWasExplicitlySelected = true;
      }
      if (fingerprintSeed) currentFingerprintSeed = fingerprintSeed;
      currentPrettifySettings = normalizePrettifySettings(
        isRecord(prettifySettings) ? prettifySettings : { prompt: prettifyPrompt },
      );
      updateLegacyPrettifyMirrors();

      if (
        currentHotkey === DEFAULT_RECORD_HOTKEY &&
        currentRetryTranscriptionHotkey === LEGACY_RETRY_TRANSCRIPTION_HOTKEY
      ) {
        currentRetryTranscriptionHotkey = DEFAULT_RETRY_TRANSCRIPTION_HOTKEY;
        log.info('Migrated conflicting retry transcription hotkey to:', DEFAULT_RETRY_TRANSCRIPTION_HOTKEY);
        saveConfig();
      }
    }
    if (!isValidFingerprintSeed(currentFingerprintSeed)) {
      currentFingerprintSeed = generateFingerprintSeed();
      saveConfig();
    }
  } catch (error) {
    log.error('Failed to load config:', getErrorMessage(error));
  }
}

export function saveConfig(): void {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(
        {
          hotkey: currentHotkey,
          cancelHotkey: currentCancelHotkey,
          stopHotkey: currentStopHotkey,
          translateHotkey: currentTranslateHotkey,
          prettifyHotkey: currentPrettifyHotkey,
          retryTranscriptionHotkey: currentRetryTranscriptionHotkey,
          translateEnabled: currentTranslateEnabled,
          prettifyEnabled: currentPrettifyEnabled,
          targetLang: currentTargetLang,
          provider: currentProvider,
          locale: currentLocale,
          localeExplicit: currentLocaleWasExplicitlySelected,
          fingerprintSeed: currentFingerprintSeed,
          prettifySettings: currentPrettifySettings,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    log.error('Failed to save config:', getErrorMessage(error));
    throw error;
  }
}
