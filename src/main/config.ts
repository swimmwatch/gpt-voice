import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { createLogger } from './logger';

const log = createLogger('config');

export const APP_DIR = path.join(os.homedir(), '.webvoice');
if (!fs.existsSync(APP_DIR)) {
  fs.mkdirSync(APP_DIR, { recursive: true });
}

export const BROWSER_CACHE_DIR = path.join(APP_DIR, 'browser-cache');
export const CONFIG_FILE = path.join(APP_DIR, 'config.json');

export let currentHotkey = 'F8';
export let currentCancelHotkey = 'Escape';
export let currentStopHotkey = 'F10';
export let currentTranslate = false;
export let currentTargetLang = 'en';
export let currentProvider = 'chatgpt';
export let currentLocale = '';

export function setHotkeys(hotkey?: string, cancelHotkey?: string, stopHotkey?: string): void {
  if (hotkey !== undefined) currentHotkey = hotkey;
  if (cancelHotkey !== undefined) currentCancelHotkey = cancelHotkey;
  if (stopHotkey !== undefined) currentStopHotkey = stopHotkey;
}

export function setTranslateSettings(translate?: boolean, targetLang?: string): void {
  if (translate !== undefined) currentTranslate = translate;
  if (targetLang !== undefined) currentTargetLang = targetLang;
}

export function setProvider(providerId: string): void {
  currentProvider = providerId;
}

export function setCurrentLocale(locale: string): void {
  currentLocale = locale;
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
      if (config.translate !== undefined) currentTranslate = config.translate;
      if (config.targetLang) currentTargetLang = config.targetLang;
      if (config.provider) currentProvider = config.provider;
      if (config.locale) currentLocale = config.locale;
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
        translate: currentTranslate,
        targetLang: currentTargetLang,
        provider: currentProvider,
        locale: currentLocale,
      },
      null,
      2,
    ),
  );
}
