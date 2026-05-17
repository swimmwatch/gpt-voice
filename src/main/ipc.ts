import { ipcMain, Notification, type IpcMainInvokeEvent } from 'electron';
import type { BrowserContext } from 'playwright-core';
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
  initBackgroundBrowser,
  shutdownBackgroundBrowser,
  isBgReady,
  getBackgroundBrowserStatus,
  getActiveProvider,
  launchLoginContext,
  switchProvider,
} from './browser';
import { getAvailableProviders } from './providers';
import { getMainWindow } from './window';
import { registerShortcuts, getRecordingState, resetRecordingState } from './shortcuts';
import { transcribeAudio } from './services/transcription';
import { translateText } from './services/translation';
import { getAllTranslations, getLocale, setLocale, getSupportedLocales } from './i18n';
import { createLogger } from './logger';
import { createProvider } from './providers';

const log = createLogger('ipc');

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const win = getMainWindow();
  const senderUrl = event.senderFrame?.url || event.sender.getURL();

  if (!win || event.sender.id !== win.webContents.id || senderUrl !== win.webContents.getURL()) {
    log.warn('Rejected IPC from untrusted sender:', senderUrl || '<unknown>');
    throw new Error('Rejected IPC from untrusted sender');
  }
}

function handle<Args extends unknown[]>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event);
    return listener(event, ...(args as Args));
  });
}

export function registerIpcHandlers(): void {
  handle('transcribe-audio', async (_event, buffer: ArrayBuffer, mimeType: string) => {
    return transcribeAudio(buffer, mimeType);
  });

  handle('translate-text', async (_event, text: string, targetLang: string) => {
    return translateText(text, targetLang);
  });

  handle('get-recording-status', () => {
    return getRecordingState().isRecording;
  });

  handle('recording-start-failed', () => {
    resetRecordingState();
    return { success: true };
  });

  handle('provider-login', async () => {
    const provider = getActiveProvider();
    if (!provider) {
      return { success: false, error: 'No active provider' };
    }

    let context: BrowserContext | null = null;
    let sessionSaved = false;
    try {
      context = await launchLoginContext();
      const page = await context.newPage();
      await page.goto(provider.getLoginUrl());

      await new Promise<void>((resolve) => {
        let done = false;
        const finish = async (saveSession: boolean) => {
          if (done) return;
          done = true;
          try {
            if (saveSession) {
              await provider.saveSession(context!);
              sessionSaved = true;
            }
          } finally {
            await context?.close().catch(() => {});
            resolve();
          }
        };

        context!.on('close', () => {
          void finish(false);
        });
        page.on('close', () => {
          void finish(true);
        });
      });

      if (!sessionSaved) {
        return { success: false, error: 'Login window closed before session was saved' };
      }

      await shutdownBackgroundBrowser();
      const status = await initBackgroundBrowser();
      if (status.ready) {
        getMainWindow()?.webContents.send('bg-browser-ready');
      } else if (status.error) {
        getMainWindow()?.webContents.send('bg-browser-error', status.error, Boolean(status.authExpired));
        return { success: false, error: status.error };
      } else {
        return { success: false, error: 'Login did not produce a valid provider session' };
      }

      return { success: true };
    } catch (err: unknown) {
      if (context) {
        try {
          await context.close();
        } catch {
          /* ignore */
        }
      }
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  handle('check-session', () => {
    const provider = getActiveProvider() ?? createProvider(currentProvider);
    return provider.hasSession();
  });

  handle('is-bg-ready', () => {
    return isBgReady();
  });

  handle('get-bg-browser-status', () => {
    return getBackgroundBrowserStatus();
  });

  handle('get-providers', () => {
    return getAvailableProviders();
  });

  handle('get-active-provider', () => {
    return currentProvider;
  });

  handle('set-active-provider', async (_event, providerId: string) => {
    const status = await switchProvider(providerId);
    saveConfig();
    if (status.ready) {
      getMainWindow()?.webContents.send('bg-browser-ready');
    } else if (status.error) {
      getMainWindow()?.webContents.send('bg-browser-error', status.error, Boolean(status.authExpired));
    }
    return { success: !status.error, error: status.error };
  });

  handle('get-hotkey', () => {
    return { hotkey: currentHotkey, cancelHotkey: currentCancelHotkey, stopHotkey: currentStopHotkey };
  });

  handle('set-hotkey', (_event, key: string, hotkey: string) => {
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

  handle('get-translate-settings', () => {
    return { translate: currentTranslate, targetLang: currentTargetLang };
  });

  handle('set-translate-settings', (_event, translate: boolean, targetLang: string) => {
    setTranslateSettings(translate, targetLang);
    saveConfig();
    return { success: true };
  });

  handle('show-notification', (_event, title: string, body: string) => {
    const notification = new Notification({ title, body });
    notification.show();
  });

  handle('get-translations', () => {
    return getAllTranslations();
  });

  handle('get-locale', () => {
    return getLocale();
  });

  handle('get-supported-locales', () => {
    return getSupportedLocales();
  });

  handle('set-locale', (_event, locale: string) => {
    setLocale(locale);
    setCurrentLocale(locale);
    saveConfig();
    return { success: true };
  });

  handle('get-platform', () => {
    return process.platform;
  });
}
