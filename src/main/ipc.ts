import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { BrowserContext } from 'playwright-core';
import {
  currentHotkey,
  currentCancelHotkey,
  currentStopHotkey,
  currentTranslateHotkey,
  currentPrettifyHotkey,
  currentTranslateEnabled,
  currentPrettifyEnabled,
  currentTargetLang,
  currentProvider,
  currentPrettifyPrompt,
  currentPrettifyReasoning,
  setHotkeys,
  setTranslateSettings,
  setTextActionSettings,
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
import { normalizeTextActionSettings, type TextActionSettingsInput } from '@shared/textActionSettings';

const log = createLogger('ipc');

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarizeBackgroundStatus(status: { ready: boolean; error?: string; authExpired?: boolean }) {
  return {
    ready: status.ready,
    hasError: Boolean(status.error),
    error: status.error,
    authExpired: Boolean(status.authExpired),
  };
}

function summarizeCloakBrowserSettingsInput(settings: CloakBrowserSettingsInput = {}) {
  const proxy = settings.proxy ?? {};
  return {
    hasHumanize: typeof settings.humanize === 'boolean',
    humanize: settings.humanize,
    humanPreset: settings.humanPreset,
    backgroundMode: settings.backgroundMode,
    fingerprintSeedLength: typeof settings.fingerprintSeed === 'string' ? settings.fingerprintSeed.trim().length : 0,
    hasLocale: typeof settings.locale === 'string' && settings.locale.trim().length > 0,
    hasTimezone: typeof settings.timezone === 'string' && settings.timezone.trim().length > 0,
    proxyEnabled: Boolean(proxy.enabled),
    proxyGeoip: Boolean(proxy.geoip),
    hasProxyServer: typeof proxy.server === 'string' && proxy.server.trim().length > 0,
    hasProxyBypass: typeof proxy.bypass === 'string' && proxy.bypass.trim().length > 0,
    hasProxyUsername: typeof proxy.username === 'string' && proxy.username.trim().length > 0,
    hasProxyPasswordUpdate: typeof proxy.password === 'string' && proxy.password.trim().length > 0,
    clearProxyPassword: Boolean(proxy.clearPassword),
  };
}

function summarizeOpenAIApiSettingsInput(settings: OpenAIApiSettingsInput = {}) {
  return {
    apiKeyUpdated: typeof settings.apiKey === 'string' && settings.apiKey.trim().length > 0,
    model: settings.model,
    prettifyModel: settings.prettifyModel,
    language: settings.language,
    promptLength: typeof settings.prompt === 'string' ? settings.prompt.length : 0,
    temperature: settings.temperature,
  };
}

function getTextActionSettingsSnapshot() {
  return {
    translateEnabled: currentTranslateEnabled,
    prettifyEnabled: currentPrettifyEnabled,
  };
}

function getPrettifySettingsSnapshot() {
  return {
    prompt: currentPrettifyPrompt,
    reasoning: currentPrettifyReasoning,
  };
}

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
      log.info('Saving CloakBrowser settings:', summarizeCloakBrowserSettingsInput(settings || {}));
      const preparedSettings = prepareCloakBrowserSettings(settings || {});
      await shutdownBackgroundBrowser();
      const backgroundStatus = await initBackgroundBrowser({
        cloakBrowserSettings: preparedSettings.settingsWithSecret,
      });
      sendBackgroundStatus(backgroundStatus);
      log.info('CloakBrowser settings restart result:', summarizeBackgroundStatus(backgroundStatus));
      if (backgroundStatus.error) {
        log.warn('CloakBrowser settings save failed during restart:', summarizeBackgroundStatus(backgroundStatus));
        return {
          success: false,
          settings: preparedSettings.settings,
          backgroundStatus,
          error: backgroundStatus.error,
        };
      }
      // Persist only after restart succeeds so a rejected save cannot poison the next launch.
      const savedSettings = preparedSettings.persist();
      log.info('CloakBrowser settings saved');
      return { success: true, settings: savedSettings, backgroundStatus };
    } catch (error: unknown) {
      log.error('CloakBrowser settings save error:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  });

  handle('save-provider-settings', async (_event, providerId: string, settings: OpenAIApiSettingsInput) => {
    try {
      log.info('Saving provider settings:', {
        providerId,
        ...(providerId === OPENAI_API_PROVIDER_ID ? summarizeOpenAIApiSettingsInput(settings || {}) : {}),
      });
      if (providerId !== OPENAI_API_PROVIDER_ID) {
        log.warn('Provider settings save skipped for provider without editable settings:', { providerId });
        return { success: true, settings: getProviderSettingsSnapshot(providerId) };
      }

      const savedSettings = saveOpenAIApiSettings(settings || {});
      await refreshActiveProvider(providerId);
      log.info('Provider settings saved:', {
        providerId,
        hasApiKey: savedSettings.hasApiKey,
        model: savedSettings.model,
        prettifyModel: savedSettings.prettifyModel,
        language: savedSettings.language,
        promptLength: savedSettings.prompt.length,
        temperature: savedSettings.temperature,
      });
      return {
        success: true,
        settings: {
          providerId,
          authType: 'apiKey',
          ...savedSettings,
        },
      };
    } catch (error: unknown) {
      log.error('Provider settings save error:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  });

  handle('clear-provider-auth', async (_event, providerId: string) => {
    try {
      log.info('Clearing provider auth:', { providerId });
      if (providerId === OPENAI_API_PROVIDER_ID) {
        clearOpenAIApiKey();
      } else {
        createProvider(providerId).clearSession();
      }
      await refreshActiveProvider(providerId);
      log.info('Provider auth cleared:', { providerId });
      return { success: true, settings: getProviderSettingsSnapshot(providerId) };
    } catch (error: unknown) {
      log.error('Provider auth clear error:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  });

  handle('get-active-provider', () => {
    return currentProvider;
  });

  handle('set-active-provider', async (_event, providerId: string) => {
    try {
      const previousProvider = currentProvider;
      log.info('Changing active provider:', { from: previousProvider, to: providerId });
      const status = await switchProvider(providerId);
      saveConfig();
      sendBackgroundStatus(status);
      if (status.error) {
        log.warn('Active provider change failed:', {
          from: previousProvider,
          to: providerId,
          status: summarizeBackgroundStatus(status),
        });
      } else {
        log.info('Active provider changed:', {
          from: previousProvider,
          to: providerId,
          status: summarizeBackgroundStatus(status),
        });
      }
      return { success: !status.error, error: status.error };
    } catch (error: unknown) {
      log.error('Active provider change error:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
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

  handle('get-text-action-settings', () => {
    return getTextActionSettingsSnapshot();
  });

  handle('set-text-action-settings', (_event, settings: TextActionSettingsInput) => {
    try {
      const normalized = normalizeTextActionSettings(settings || {});
      log.info('Saving text action settings:', {
        from: {
          translateEnabled: currentTranslateEnabled,
          prettifyEnabled: currentPrettifyEnabled,
        },
        to: normalized,
      });
      setTextActionSettings(normalized.translateEnabled, normalized.prettifyEnabled);
      saveConfig();
      log.info('Text action settings saved:', normalized);
      return { success: true, settings: normalized };
    } catch (error: unknown) {
      log.error('Text action settings save error:', getErrorMessage(error));
      return { success: false, settings: getTextActionSettingsSnapshot(), error: getErrorMessage(error) };
    }
  });

  handle('set-translate-settings', (_event, targetLang: string) => {
    try {
      log.info('Saving translate settings:', { from: currentTargetLang, to: targetLang });
      setTranslateSettings(targetLang);
      saveConfig();
      log.info('Translate settings saved:', { targetLang: currentTargetLang });
      return { success: true };
    } catch (error: unknown) {
      log.error('Translate settings save error:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  });

  handle('get-prettify-settings', () => {
    return getPrettifySettingsSnapshot();
  });

  handle('set-prettify-settings', (_event, settings: PrettifySettingsInput) => {
    try {
      const normalized = normalizePrettifySettings(settings || {});
      log.info('Saving Prettify settings:', {
        promptChanged: normalized.prompt !== currentPrettifyPrompt,
        fromPromptLength: currentPrettifyPrompt.length,
        toPromptLength: normalized.prompt.length,
        fromReasoning: currentPrettifyReasoning,
        toReasoning: normalized.reasoning,
      });
      setPrettifySettings(normalized.prompt, normalized.reasoning);
      saveConfig();
      log.info('Prettify settings saved:', {
        promptLength: currentPrettifyPrompt.length,
        reasoning: currentPrettifyReasoning,
      });
      return { success: true, settings: normalized };
    } catch (error: unknown) {
      log.error('Prettify settings save error:', getErrorMessage(error));
      return { success: false, settings: getPrettifySettingsSnapshot(), error: getErrorMessage(error) };
    }
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
    try {
      log.info('Saving locale:', { from: getLocale(), to: locale });
      setLocale(locale);
      setCurrentLocale(locale);
      saveConfig();
      log.info('Locale saved:', { locale: getLocale() });
      return { success: true };
    } catch (error: unknown) {
      log.error('Locale save error:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  });

  handle('get-platform', () => {
    return process.platform;
  });
}
