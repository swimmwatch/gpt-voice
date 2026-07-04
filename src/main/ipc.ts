import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { BrowserContext } from 'playwright-core';
import {
  currentHotkey,
  currentCancelHotkey,
  currentStopHotkey,
  currentTranslateHotkey,
  currentPrettifyHotkey,
  currentTargetLang,
  currentProvider,
  currentPrettifyPrompt,
  currentPrettifyReasoning,
  setHotkeys,
  setTranslateSettings,
  setPrettifySettings,
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
import { closeSettingsWindow, getMainWindow, isTrustedAppWindow } from './window';
import { registerShortcuts, getRecordingState, resetRecordingState } from './shortcuts';
import { transcribeAudio } from './services/transcription';
import { translateText } from './services/translation';
import { getAllTranslations, getLocale, setLocale, getSupportedLocales } from './i18n';
import { createLogger } from './logger';
import { createProvider } from './providers';
import { clearOpenAIApiKey, getOpenAIApiSettingsView, saveOpenAIApiSettings } from './providers/openaiApiSettings';
import { OPENAI_API_PROVIDER_ID, type OpenAIApiSettingsInput } from './providers/openaiApiSettingsUtils';
import { getCloakBrowserSettingsView, prepareCloakBrowserSettings } from './cloakBrowserSettings';
import type { CloakBrowserSettingsInput } from '@shared/cloakBrowserSettings';
import { showSystemNotification } from './electronRuntime';
import { isHotkeyTarget, type HotkeySettings, type HotkeyTarget } from '@shared/hotkeys';
import { normalizePrettifySettings, type PrettifySettingsInput } from '@shared/prettifySettings';

const log = createLogger('ipc');

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url || event.sender.getURL();

  if (!isTrustedAppWindow(event.sender, senderUrl)) {
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

function sendBackgroundStatus(status: { ready: boolean; error?: string; authExpired?: boolean }): void {
  if (status.ready) {
    getMainWindow()?.webContents.send('bg-browser-ready');
  } else if (status.error) {
    getMainWindow()?.webContents.send('bg-browser-error', status.error, Boolean(status.authExpired));
  }
}

function getHotkeySettingsSnapshot(): HotkeySettings {
  return {
    hotkey: currentHotkey,
    cancelHotkey: currentCancelHotkey,
    stopHotkey: currentStopHotkey,
    translateHotkey: currentTranslateHotkey,
    prettifyHotkey: currentPrettifyHotkey,
  };
}

function getProviderSettingsSnapshot(providerId: string) {
  if (providerId === OPENAI_API_PROVIDER_ID) {
    return {
      providerId,
      authType: 'apiKey',
      ...getOpenAIApiSettingsView(),
    };
  }

  const provider = createProvider(providerId);
  return {
    providerId,
    authType: provider.info.authType,
    hasSession: provider.hasSession(),
  };
}

async function refreshActiveProvider(providerId: string): Promise<void> {
  if (providerId !== currentProvider) return;
  await shutdownBackgroundBrowser();
  const status = await initBackgroundBrowser();
  sendBackgroundStatus(status);
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
    let provider;
    try {
      provider = getActiveProvider() ?? createProvider(currentProvider);
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
    if (!provider.requiresBrowserSession()) {
      return { success: false, error: 'Provider does not support browser login' };
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
      sendBackgroundStatus(status);
      if (status.error) {
        return { success: false, error: status.error };
      }
      if (!status.ready) {
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
    try {
      const provider = getActiveProvider() ?? createProvider(currentProvider);
      return provider.hasSession();
    } catch (error: unknown) {
      log.warn('Failed to check provider session:', error instanceof Error ? error.message : error);
      return false;
    }
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

  handle('get-provider-settings', (_event, providerId: string) => {
    return getProviderSettingsSnapshot(providerId);
  });

  handle('close-app-settings', () => {
    closeSettingsWindow();
    return { success: true };
  });

  handle('get-cloakbrowser-settings', () => {
    return getCloakBrowserSettingsView();
  });

  handle('save-cloakbrowser-settings', async (_event, settings: CloakBrowserSettingsInput) => {
    try {
      const preparedSettings = prepareCloakBrowserSettings(settings || {});
      await shutdownBackgroundBrowser();
      const backgroundStatus = await initBackgroundBrowser({
        cloakBrowserSettings: preparedSettings.settingsWithSecret,
      });
      sendBackgroundStatus(backgroundStatus);
      if (backgroundStatus.error) {
        return {
          success: false,
          settings: preparedSettings.settings,
          backgroundStatus,
          error: backgroundStatus.error,
        };
      }
      // Persist only after restart succeeds so a rejected save cannot poison the next launch.
      const savedSettings = preparedSettings.persist();
      return { success: true, settings: savedSettings, backgroundStatus };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  handle('save-provider-settings', async (_event, providerId: string, settings: OpenAIApiSettingsInput) => {
    try {
      if (providerId !== OPENAI_API_PROVIDER_ID) {
        return { success: true, settings: getProviderSettingsSnapshot(providerId) };
      }

      const savedSettings = saveOpenAIApiSettings(settings || {});
      await refreshActiveProvider(providerId);
      return {
        success: true,
        settings: {
          providerId,
          authType: 'apiKey',
          ...savedSettings,
        },
      };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  handle('clear-provider-auth', async (_event, providerId: string) => {
    try {
      if (providerId === OPENAI_API_PROVIDER_ID) {
        clearOpenAIApiKey();
      } else {
        createProvider(providerId).clearSession();
      }
      await refreshActiveProvider(providerId);
      return { success: true, settings: getProviderSettingsSnapshot(providerId) };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  handle('get-active-provider', () => {
    return currentProvider;
  });

  handle('set-active-provider', async (_event, providerId: string) => {
    try {
      const status = await switchProvider(providerId);
      saveConfig();
      sendBackgroundStatus(status);
      return { success: !status.error, error: status.error };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  handle('get-hotkey', (): HotkeySettings => {
    return getHotkeySettingsSnapshot();
  });

  handle('set-hotkey', (_event, key: string, hotkey: string) => {
    if (!isHotkeyTarget(key)) {
      return {
        success: false,
        ...getHotkeySettingsSnapshot(),
      };
    }
    const target: HotkeyTarget = key;
    if (key === 'cancel') {
      log.info('Changing cancel hotkey from', currentCancelHotkey, 'to', hotkey);
      setHotkeys(undefined, hotkey, undefined, undefined, undefined);
    } else if (key === 'stop') {
      log.info('Changing stop hotkey from', currentStopHotkey, 'to', hotkey);
      setHotkeys(undefined, undefined, hotkey, undefined, undefined);
    } else if (target === 'translate') {
      log.info('Changing translate hotkey from', currentTranslateHotkey, 'to', hotkey);
      setHotkeys(undefined, undefined, undefined, hotkey, undefined);
    } else if (target === 'prettify') {
      log.info('Changing prettify hotkey from', currentPrettifyHotkey, 'to', hotkey);
      setHotkeys(undefined, undefined, undefined, undefined, hotkey);
    } else {
      log.info('Changing hotkey from', currentHotkey, 'to', hotkey);
      setHotkeys(hotkey, undefined, undefined, undefined, undefined);
    }
    saveConfig();
    registerShortcuts();
    const hotkeySettings = getHotkeySettingsSnapshot();
    getMainWindow()?.webContents.send('hotkey-settings-changed', hotkeySettings);
    return { success: true, ...hotkeySettings };
  });

  handle('get-translate-settings', () => {
    return { targetLang: currentTargetLang };
  });

  handle('set-translate-settings', (_event, targetLang: string) => {
    setTranslateSettings(targetLang);
    saveConfig();
    return { success: true };
  });

  handle('get-prettify-settings', () => {
    return {
      prompt: currentPrettifyPrompt,
      reasoning: currentPrettifyReasoning,
    };
  });

  handle('set-prettify-settings', (_event, settings: PrettifySettingsInput) => {
    const normalized = normalizePrettifySettings(settings || {});
    setPrettifySettings(normalized.prompt, normalized.reasoning);
    saveConfig();
    return { success: true, settings: normalized };
  });

  handle('show-notification', (_event, title: string, body: string) => {
    showSystemNotification(title, body);
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
