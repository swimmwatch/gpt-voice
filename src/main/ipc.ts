import { ipcMain, Notification } from 'electron';
import type { BrowserContext } from 'playwright';
import {
  currentHotkey,
  currentCancelHotkey,
  currentStopHotkey,
  currentTranslate,
  currentTargetLang,
  currentProvider,
  setHotkeys,
  setTranslateSettings,
  setCurrentLocale,
  saveConfig,
} from './config';
import {
  chromium,
  getLaunchOptions,
  initBackgroundBrowser,
  shutdownBackgroundBrowser,
  isBgReady,
  getActiveProvider,
  switchProvider,
} from './browser';
import { getAvailableProviders } from './providers';
import { getMainWindow } from './window';
import { registerShortcuts, getRecordingState } from './shortcuts';
import { transcribeAudio } from './services/transcription';
import { translateText } from './services/translation';
import { getAllTranslations, getLocale, setLocale, getSupportedLocales } from './i18n';
import { createLogger } from './logger';

const log = createLogger('ipc');

export function registerIpcHandlers(): void {
  ipcMain.handle('transcribe-audio', async (_event, buffer: ArrayBuffer) => {
    return transcribeAudio(buffer);
  });

  ipcMain.handle('translate-text', async (_event, text: string, targetLang: string) => {
    return translateText(text, targetLang);
  });

  ipcMain.handle('get-recording-status', () => {
    return getRecordingState().isRecording;
  });

  ipcMain.handle('provider-login', async () => {
    const provider = getActiveProvider();
    if (!provider) {
      return { success: false, error: 'No active provider' };
    }

    let context: BrowserContext | null = null;
    try {
      const browser = await chromium.launch({ ...getLaunchOptions(), headless: false });
      context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const page = await context.newPage();
      await page.goto(provider.getLoginUrl());

      await new Promise<void>((resolve) => {
        browser.on('disconnected', () => resolve());
        page.on('close', () => {
          provider
            .saveSession(context!)
            .then(() => {
              browser
                .close()
                .catch(() => {})
                .finally(() => resolve());
            })
            .catch(() => {
              browser
                .close()
                .catch(() => {})
                .finally(() => resolve());
            });
        });
      });

      await shutdownBackgroundBrowser();
      initBackgroundBrowser().then(() => {
        getMainWindow()?.webContents.send('bg-browser-ready');
      });

      return { success: true };
    } catch (err: unknown) {
      if (context) {
        try {
          await context.browser()?.close();
        } catch {
          /* ignore */
        }
      }
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('check-session', () => {
    const provider = getActiveProvider();
    return provider ? provider.hasSession() : false;
  });

  ipcMain.handle('is-bg-ready', () => {
    return isBgReady();
  });

  ipcMain.handle('get-providers', () => {
    return getAvailableProviders();
  });

  ipcMain.handle('get-active-provider', () => {
    return currentProvider;
  });

  ipcMain.handle('set-active-provider', async (_event, providerId: string) => {
    await switchProvider(providerId);
    saveConfig();
    getMainWindow()?.webContents.send('bg-browser-ready');
    return { success: true };
  });

  ipcMain.handle('get-hotkey', () => {
    return { hotkey: currentHotkey, cancelHotkey: currentCancelHotkey, stopHotkey: currentStopHotkey };
  });

  ipcMain.handle('set-hotkey', (_event, key: string, hotkey: string) => {
    if (key === 'cancel') {
      log.info('Changing cancel hotkey from', currentCancelHotkey, 'to', hotkey);
      setHotkeys(undefined, hotkey, undefined);
    } else if (key === 'stop') {
      log.info('Changing stop hotkey from', currentStopHotkey, 'to', hotkey);
      setHotkeys(undefined, undefined, hotkey);
    } else {
      log.info('Changing hotkey from', currentHotkey, 'to', hotkey);
      setHotkeys(hotkey, undefined, undefined);
    }
    saveConfig();
    registerShortcuts();
    return { success: true, hotkey: currentHotkey, cancelHotkey: currentCancelHotkey, stopHotkey: currentStopHotkey };
  });

  ipcMain.handle('get-translate-settings', () => {
    return { translate: currentTranslate, targetLang: currentTargetLang };
  });

  ipcMain.handle('set-translate-settings', (_event, translate: boolean, targetLang: string) => {
    setTranslateSettings(translate, targetLang);
    saveConfig();
    return { success: true };
  });

  ipcMain.handle('show-notification', (_event, title: string, body: string) => {
    const notification = new Notification({ title, body });
    notification.show();
  });

  ipcMain.handle('get-translations', () => {
    return getAllTranslations();
  });

  ipcMain.handle('get-locale', () => {
    return getLocale();
  });

  ipcMain.handle('get-supported-locales', () => {
    return getSupportedLocales();
  });

  ipcMain.handle('set-locale', (_event, locale: string) => {
    setLocale(locale);
    setCurrentLocale(locale);
    saveConfig();
    return { success: true };
  });
}
