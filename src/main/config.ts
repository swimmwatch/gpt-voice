import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { createLogger } from './logger';
import {
  DEFAULT_CANCEL_HOTKEY,
  DEFAULT_RECORD_HOTKEY,
  DEFAULT_STOP_HOTKEY,
  DEFAULT_TRANSLATE_HOTKEY,
} from '@shared/hotkeys';

const log = createLogger('config');

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
export let currentTargetLang = 'en';
export let currentProvider = 'chatgpt';
export let currentLocale = '';
export let currentFingerprintSeed = '';

const FINGERPRINT_SEED_PATTERN = /^\d+$/;

function generateFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

function isValidFingerprintSeed(value: string): boolean {
  return FINGERPRINT_SEED_PATTERN.test(value);
}

export function setHotkeys(
  hotkey?: string,
  cancelHotkey?: string,
  stopHotkey?: string,
  translateHotkey?: string,
): void {
  if (hotkey !== undefined) currentHotkey = hotkey;
  if (cancelHotkey !== undefined) currentCancelHotkey = cancelHotkey;
  if (stopHotkey !== undefined) currentStopHotkey = stopHotkey;
  if (translateHotkey !== undefined) currentTranslateHotkey = translateHotkey;
}

export function setTranslateSettings(targetLang?: string): void {
  if (targetLang !== undefined) currentTargetLang = targetLang;
}

export function setProvider(providerId: string): void {
  currentProvider = providerId;
}

export function setCurrentLocale(locale: string): void {
  currentLocale = locale;
}

export function getFingerprintSeed(): string {
  if (!isValidFingerprintSeed(currentFingerprintSeed)) {
    currentFingerprintSeed = generateFingerprintSeed();
    saveConfig();
  }
  return currentFingerprintSeed;
}

export function getCurrentLocale(): string {
  return currentLocale;
}

export function loadConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (config.hotkey) currentHotkey = config.hotkey;
      if (config.cancelHotkey) currentCancelHotkey = config.cancelHotkey;
      if (config.stopHotkey) currentStopHotkey = config.stopHotkey;
      if (config.translateHotkey) currentTranslateHotkey = config.translateHotkey;
      if (config.targetLang) currentTargetLang = config.targetLang;
      if (config.provider) currentProvider = config.provider;
      if (config.locale) currentLocale = config.locale;
      if (config.fingerprintSeed) currentFingerprintSeed = String(config.fingerprintSeed);
    }
    if (!isValidFingerprintSeed(currentFingerprintSeed)) {
      currentFingerprintSeed = generateFingerprintSeed();
      saveConfig();
    }
  } catch {
    log.error('Failed to load config');
  }
}

export function saveConfig(): void {
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(
      {
        hotkey: currentHotkey,
        cancelHotkey: currentCancelHotkey,
        stopHotkey: currentStopHotkey,
        translateHotkey: currentTranslateHotkey,
        targetLang: currentTargetLang,
        provider: currentProvider,
        locale: currentLocale,
        fingerprintSeed: currentFingerprintSeed,
      },
      null,
      2,
    ),
  );
}
