import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import type { BrowserContext } from 'playwright-core';
import {
  currentHotkey,
  currentCancelHotkey,
  currentStopHotkey,
  currentTranslateHotkey,
  currentPrettifyHotkey,
  currentRetryTranscriptionHotkey,
  currentTranslateEnabled,
  currentPrettifyEnabled,
  currentProvider,
  setHotkeys,
  setTextActionSettings,
  setCurrentLocale,
  getTranslationSettingsSnapshot,
  saveTranslationSettings,
  saveConfig,
} from './config';
import type { BackgroundBrowserService } from './browser';
import type { VoiceProviderAudit } from './providers/voiceProviderAudit';
import type { VoiceProviderRegistry } from './providers/voiceProviderRegistry';
import { type WindowManager } from './window';
import type { DesktopRuntimeController } from './desktopRuntimeController';
import type { ShortcutController } from './shortcuts';
import type { TranscriptionService } from './services/transcription';
import type { TranslationRuntime } from './services/translation';
import { getAllTranslations, getLocale, setLocale, getSupportedLocales, t } from './i18n';
import { createLogger } from './logger';
import { getClaudeWebSettings, saveClaudeWebSettings } from './providers/claudeWebSettings';
import { clearOpenAIApiKey, getOpenAIApiSettingsView, saveOpenAIApiSettings } from './providers/openaiApiSettings';
import {
  assertValidOpenAIApiSettingsInput,
  OPENAI_API_PROVIDER_ID,
  type OpenAIApiSettingsInput,
} from './providers/openaiApiSettingsUtils';
import { getCloakBrowserSettingsView, prepareCloakBrowserSettings } from './cloakBrowserSettings';
import { assertValidCloakBrowserSettingsInput } from './cloakBrowserSettingsUtils';
import type { CloakBrowserSettingsInput } from '@shared/cloakBrowserSettings';
import { assertValidClaudeWebSettingsUpdateInput, CLAUDE_WEB_PROVIDER_ID } from '@shared/claudeWebSettings';
import { showSystemNotification } from './electronRuntime';
import {
  getHotkeyConflict,
  isHotkeyTarget,
  normalizeHotkey,
  type HotkeySettings,
  type HotkeyTarget,
} from '@shared/hotkeys';
import type { SystemNotificationOptions } from '@shared/notifications';
import {
  assertValidKnownPrettifySettingsInput,
  getPrettifyProviderCapabilities,
  isPrettifyCliProviderId,
  isKnownPrettifyProviderId,
  type KnownPrettifyProviderId,
  type PrettifyCliConnectionResult,
  type PrettifyModelListResult,
  type PrettifyModelLoadResult,
  type PrettifyModelUnloadResult,
  type PrettifySettingsInput,
  assertValidPrettifySettingsInput,
} from '@shared/prettifySettings';
import { isRecordingLifecycleState } from '@shared/recordingLifecycle';
import type { TranscriptionHistoryQuery } from '@shared/transcriptionHistory';
import { assertValidTextActionSettingsInput, normalizeTextActionSettings } from '@shared/textActionSettings';
import { TranscriptionHistoryIpcController } from './services/transcriptionHistoryIpcController';
import { getPrettifySettingsView, savePrettifySettings } from './services/prettifySettingsStorage';
import type { PrettifyRuntime } from './services/prettifyProviders';
import type { PrettifyConnectionCheckCoordinator } from './services/prettifyConnectionCheckCoordinator';
import { shouldRefreshProviderAfterMutation } from './providerSettingsMutation';
import { StreamingTranscriptionIpcController } from './streamingTranscriptionIpcController';
import type { MainStreamingTranscriptionService } from './services/streamingTranscription';
import { isAppSettingsSectionId } from '@shared/appSettings';
import { isAppLocaleId } from '@shared/appLocale';
import { TranslationSettingsValidationError } from './translationSettings';

const log = createLogger('ipc');
export interface MainIpcDependencies {
  readonly backgroundBrowserService: BackgroundBrowserService;
  readonly desktopRuntimeController: DesktopRuntimeController;
  readonly historyController: TranscriptionHistoryIpcController;
  readonly prettifyConnectionCoordinator: PrettifyConnectionCheckCoordinator<WebContents>;
  readonly prettifyRuntime: PrettifyRuntime;
  readonly shortcutController: ShortcutController;
  readonly streamingTranscriptionService: MainStreamingTranscriptionService;
  readonly transcriptionService: Pick<TranscriptionService, 'transcribe'>;
  readonly translationRuntime: Pick<TranslationRuntime, 'shutdown' | 'translateText'>;
  readonly voiceAudit: VoiceProviderAudit;
  readonly voiceProviderRegistry: VoiceProviderRegistry;
  readonly windowManager: WindowManager;
}

/** Owns the stateful IPC controllers created by one main-process registration. */
export class MainIpcRegistration {
  private readonly channels = new Set<string>();
  private disposalPromise: Promise<void> | null = null;
  private disposed = false;

  public constructor(
    private readonly prettifyConnectionCoordinator: PrettifyConnectionCheckCoordinator<WebContents>,
    private readonly streamingTranscriptionController: StreamingTranscriptionIpcController<WebContents>,
    private readonly windowManager: WindowManager,
  ) {}

  public handle<Args extends unknown[]>(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: Args) => unknown,
  ): void {
    if (this.disposed) throw new Error('Main IPC registration is disposed');
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedSender(event, this.windowManager);
      return listener(event, ...(args as Args));
    });
    this.channels.add(channel);
  }

  public dispose(): Promise<void> {
    if (this.disposalPromise) return this.disposalPromise;
    this.disposed = true;
    for (const channel of this.channels) ipcMain.removeHandler(channel);
    this.channels.clear();
    this.prettifyConnectionCoordinator.dispose();
    this.disposalPromise = this.streamingTranscriptionController.dispose();
    return this.disposalPromise;
  }
}

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
    language: settings.language,
    promptLength: typeof settings.prompt === 'string' ? settings.prompt.length : 0,
    temperature: settings.temperature,
  };
}

function summarizePrettifySettingsInput(settings: PrettifySettingsInput = {}) {
  return {
    providerId: settings.providerId,
    promptLength: typeof settings.prompt === 'string' ? settings.prompt.length : undefined,
    temperature: settings.temperature,
    claudeCli: {
      hasExecutablePath: Boolean(settings.claudeCli?.executablePath?.trim()),
      modelLength: settings.claudeCli?.model?.length,
      fallbackModelLength: settings.claudeCli?.fallbackModel?.length,
      effort: settings.claudeCli?.effort,
      timeoutSeconds: settings.claudeCli?.timeoutSeconds,
    },
    codexCli: {
      hasExecutablePath: Boolean(settings.codexCli?.executablePath?.trim()),
      modelLength: settings.codexCli?.model?.length,
      reasoningEffort: settings.codexCli?.reasoningEffort,
      timeoutSeconds: settings.codexCli?.timeoutSeconds,
      verbosity: settings.codexCli?.verbosity,
    },
    ollama: {
      baseUrlLength: typeof settings.ollama?.baseUrl === 'string' ? settings.ollama.baseUrl.length : undefined,
      modelLength: settings.ollama?.model?.length,
    },
    vllm: {
      baseUrlLength: typeof settings.vllm?.baseUrl === 'string' ? settings.vllm.baseUrl.length : undefined,
      modelLength: settings.vllm?.model?.length,
      apiKeyUpdated: typeof settings.vllm?.apiKey === 'string' && settings.vllm.apiKey.trim().length > 0,
      clearApiKey: Boolean(settings.vllm?.clearApiKey),
    },
  };
}

function getTextActionSettingsSnapshot() {
  return {
    translateEnabled: currentTranslateEnabled,
    prettifyEnabled: currentPrettifyEnabled,
  };
}

function getPrettifySettingsSnapshot() {
  return getPrettifySettingsView();
}

function assertTrustedSender(event: IpcMainInvokeEvent, windowManager: WindowManager): void {
  const senderUrl = event.senderFrame?.url || event.sender.getURL();

  if (!windowManager.isTrustedAppWindow(event.sender, senderUrl)) {
    log.warn('Rejected IPC from untrusted sender:', senderUrl || '<unknown>');
    throw new Error('Rejected IPC from untrusted sender');
  }
}

function registerStreamingTranscriptionIpcHandlers(
  service: MainStreamingTranscriptionService,
  windowManager: WindowManager,
  backgroundBrowserService: BackgroundBrowserService,
): StreamingTranscriptionIpcController<WebContents> {
  return new StreamingTranscriptionIpcController<WebContents>({
    addSenderDestroyedListener: (sender, listener) => sender.once('destroyed', listener),
    getMainWindowSender: () => {
      const mainWindow = windowManager.getMainWindow();
      return mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
    },
    isSenderDestroyed: (sender) => sender.isDestroyed(),
    registerBeforeBrowserShutdownHook: (hook) => backgroundBrowserService.registerBeforeShutdownHook(hook),
    registerHandler: (channel, listener) => {
      ipcMain.handle(channel, (event, ...args) => {
        assertTrustedSender(event, windowManager);
        return listener(event.sender, ...(args as unknown[]));
      });
    },
    removeHandler: (channel) => ipcMain.removeHandler(channel),
    removeSenderDestroyedListener: (sender, listener) => sender.removeListener('destroyed', listener),
    service,
  });
}

function getHotkeySettingsSnapshot(): HotkeySettings {
  return {
    hotkey: currentHotkey,
    cancelHotkey: currentCancelHotkey,
    stopHotkey: currentStopHotkey,
    translateHotkey: currentTranslateHotkey,
    prettifyHotkey: currentPrettifyHotkey,
    retryTranscriptionHotkey: currentRetryTranscriptionHotkey,
  };
}

function getProviderSettingsSnapshot(
  providerId: string,
  providerRegistry: VoiceProviderRegistry,
  auditProvider: VoiceProviderAudit,
) {
  if (!providerRegistry.isKnownProviderId(providerId)) {
    providerRegistry.createProvider(providerId);
  }
  const audit = auditProvider.startOperation(providerId, 'settings-readiness', 'configuration');

  try {
    if (providerId === OPENAI_API_PROVIDER_ID) {
      const settings = {
        providerId,
        authType: 'apiKey',
        ...getOpenAIApiSettingsView(),
      };
      audit.lifecycle.phaseCompleted('configuration');
      audit.lifecycle.terminal(
        'configuration',
        settings.hasApiKey ? 'success' : 'failure',
        settings.hasApiKey ? undefined : auditProvider.createMetadata({ causeCode: 'not-configured' }),
      );
      return settings;
    }

    const provider = providerRegistry.createProvider(providerId);
    if (providerId === CLAUDE_WEB_PROVIDER_ID) {
      const settings = {
        providerId,
        authType: 'browserSession',
        hasSession: provider.hasSession(),
        ...getClaudeWebSettings(),
      };
      audit.lifecycle.phaseCompleted('configuration');
      audit.lifecycle.terminal(
        'configuration',
        settings.hasSession ? 'success' : 'failure',
        settings.hasSession ? undefined : auditProvider.createMetadata({ causeCode: 'not-authenticated' }),
      );
      return settings;
    }
    const settings = {
      providerId,
      authType: provider.info.authType,
      hasSession: provider.hasSession(),
    };
    audit.lifecycle.phaseCompleted('configuration');
    audit.lifecycle.terminal(
      'configuration',
      settings.hasSession ? 'success' : 'failure',
      settings.hasSession ? undefined : auditProvider.createMetadata({ causeCode: 'not-authenticated' }),
    );
    return settings;
  } catch (error: unknown) {
    auditProvider.terminalException(audit, 'configuration', error);
    throw error;
  }
}

async function refreshActiveProvider(
  providerId: string,
  windowManager: WindowManager,
  backgroundBrowserService: BackgroundBrowserService,
) {
  if (!shouldRefreshProviderAfterMutation(providerId, currentProvider)) return null;
  const status = await backgroundBrowserService.restart();
  windowManager.publishBackgroundStatus(status, currentProvider);
  return status;
}

/** Registers every privileged renderer-to-main IPC channel through the trusted-sender wrapper. */
export function registerIpcHandlers(dependencies: MainIpcDependencies): MainIpcRegistration {
  const registration = new MainIpcRegistration(
    dependencies.prettifyConnectionCoordinator,
    registerStreamingTranscriptionIpcHandlers(
      dependencies.streamingTranscriptionService,
      dependencies.windowManager,
      dependencies.backgroundBrowserService,
    ),
    dependencies.windowManager,
  );
  const historyController = dependencies.historyController;

  registration.handle('transcribe-audio', async (_event, buffer: ArrayBuffer, mimeType: string) => {
    return dependencies.transcriptionService.transcribe(buffer, mimeType);
  });

  registration.handle('translate-text', async (_event, text: string, targetLang: string) => {
    return dependencies.translationRuntime.translateText(text, targetLang);
  });

  registration.handle('get-transcription-history', (_event, query: TranscriptionHistoryQuery) => {
    return historyController.list(query || {});
  });

  registration.handle('copy-transcription-history-text', (_event, id: number) => {
    return historyController.copyText(id);
  });

  registration.handle('clear-transcription-history', () => {
    return historyController.clear();
  });

  registration.handle('get-recording-status', () => {
    return dependencies.shortcutController.getRecordingState().isRecording;
  });

  registration.handle('recording-start-failed', () => {
    dependencies.shortcutController.resetRecordingState();
    return { success: true };
  });

  registration.handle('set-recording-lifecycle-state', (_event, state: unknown) => {
    if (!isRecordingLifecycleState(state)) {
      return { success: false };
    }
    dependencies.shortcutController.setRecordingLifecycleState(state);
    return { success: true };
  });

  registration.handle('set-retry-transcription-available', (_event, available: boolean) => {
    dependencies.shortcutController.setRetryTranscriptionAvailable(Boolean(available));
    return { success: true };
  });

  registration.handle('provider-login', async (event, providerId: unknown) => {
    let provider;
    try {
      if (typeof providerId !== 'string') {
        return { success: false, error: 'Unsupported provider' };
      }
      provider = dependencies.voiceProviderRegistry.createProvider(providerId);
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
    if (!provider.requiresBrowserSession()) {
      return { success: false, error: 'Provider does not support browser login' };
    }

    let context: BrowserContext | null = null;
    let sessionSaved = false;
    try {
      context = await dependencies.backgroundBrowserService.launchLoginContext();
      const page = await context.newPage();
      await page.goto(provider.getLoginUrl());

      await new Promise<void>((resolve) => {
        let done = false;
        const finish = async (saveSession: boolean) => {
          if (done) return;
          done = true;
          try {
            if (saveSession) {
              const saveAudit = dependencies.voiceAudit.startOperation(provider.info.id, 'session-save', 'session');
              try {
                await provider.saveSession(context!);
                saveAudit.lifecycle.phaseCompleted('session');
                saveAudit.lifecycle.terminal('session', 'success');
              } catch (error: unknown) {
                dependencies.voiceAudit.terminalException(saveAudit, 'session', error, {
                  causeCode: 'cleanup-failed',
                });
                throw error;
              }
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

      const status = await refreshActiveProvider(
        provider.info.id,
        dependencies.windowManager,
        dependencies.backgroundBrowserService,
      );
      const settings = getProviderSettingsSnapshot(
        provider.info.id,
        dependencies.voiceProviderRegistry,
        dependencies.voiceAudit,
      );
      dependencies.windowManager.publishProviderSettingsChanged(settings, event.sender);
      if (status?.error) {
        return { success: false, error: status.error };
      }
      if (status && !status.ready) {
        return { success: false, error: 'Login did not produce a valid provider session' };
      }

      return { success: true, settings };
    } catch (error: unknown) {
      if (context) {
        try {
          await context.close();
        } catch {
          /* ignore */
        }
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registration.handle('check-session', () => {
    try {
      const provider =
        dependencies.backgroundBrowserService.getActiveProvider() ??
        dependencies.voiceProviderRegistry.createProvider(currentProvider);
      const audit = dependencies.voiceAudit.startOperation(provider.info.id, 'settings-readiness', 'configuration');
      try {
        const hasSession = provider.hasSession();
        audit.lifecycle.phaseCompleted('configuration');
        audit.lifecycle.terminal(
          'configuration',
          hasSession ? 'success' : 'failure',
          hasSession
            ? undefined
            : dependencies.voiceAudit.createMetadata({
                causeCode: provider.requiresBrowserSession() ? 'not-authenticated' : 'not-configured',
              }),
        );
        return hasSession;
      } catch (error: unknown) {
        dependencies.voiceAudit.terminalException(audit, 'configuration', error);
        throw error;
      }
    } catch {
      return false;
    }
  });

  registration.handle('is-bg-ready', () => {
    return dependencies.backgroundBrowserService.isReady();
  });

  registration.handle('get-bg-browser-status', () => {
    return dependencies.backgroundBrowserService.getStatus();
  });

  registration.handle('get-providers', () => {
    return dependencies.voiceProviderRegistry.getAvailableProviders();
  });

  registration.handle('get-provider-settings', (_event, providerId: string) => {
    return getProviderSettingsSnapshot(providerId, dependencies.voiceProviderRegistry, dependencies.voiceAudit);
  });

  registration.handle('open-provider-settings', (_event, providerId: unknown) => {
    if (typeof providerId !== 'string') {
      return { success: false, error: 'Unsupported provider' };
    }
    const provider = dependencies.voiceProviderRegistry
      .getAvailableProviders()
      .find((candidate) => candidate.id === providerId);
    if (!provider?.hasSettings) {
      return { success: false, error: 'Provider settings are not available' };
    }
    dependencies.windowManager.showProviderSettingsWindow(
      provider.id,
      t('providerSettings.title', { provider: provider.name }),
    );
    return { success: true };
  });

  registration.handle('close-provider-settings', (event) => {
    return { success: dependencies.windowManager.closeProviderSettingsWindow(event.sender) };
  });

  registration.handle('close-app-settings', () => {
    dependencies.windowManager.closeSettingsWindow();
    return { success: true };
  });

  registration.handle('open-app-settings', (_event, section: unknown) => {
    if (section !== undefined && !isAppSettingsSectionId(section)) {
      return { success: false, error: 'Unsupported settings section' };
    }
    dependencies.windowManager.showSettingsWindow(section);
    return { success: true };
  });

  registration.handle('open-transcription-history', () => {
    dependencies.windowManager.showHistoryWindow();
    return { success: true };
  });

  registration.handle('open-about', () => {
    dependencies.windowManager.showAboutWindow();
    return { success: true };
  });

  registration.handle('close-about', () => {
    dependencies.windowManager.closeAboutWindow();
    return { success: true };
  });

  registration.handle('get-app-info', () => {
    return dependencies.desktopRuntimeController.getAppInfo();
  });

  registration.handle('get-cloakbrowser-settings', () => {
    return getCloakBrowserSettingsView();
  });

  registration.handle('save-cloakbrowser-settings', async (_event, settings: unknown) => {
    try {
      assertValidCloakBrowserSettingsInput(settings);
      log.info('Saving CloakBrowser settings:', summarizeCloakBrowserSettingsInput(settings));
      const preparedSettings = prepareCloakBrowserSettings(settings);
      const translationShutdown = await dependencies.translationRuntime.shutdown();
      if (!translationShutdown.success) {
        log.warn('CloakBrowser settings save blocked by translation cleanup:', {
          failedProviderIds: translationShutdown.failedProviderIds,
        });
        return {
          success: false,
          settings: getCloakBrowserSettingsView(),
          error: t('error.translationCleanupFailed'),
        };
      }
      const backgroundStatus = await dependencies.backgroundBrowserService.restart({
        cloakBrowserSettings: preparedSettings.settingsWithSecret,
      });
      dependencies.windowManager.publishBackgroundStatus(backgroundStatus, currentProvider);
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

  registration.handle('save-provider-settings', async (event, providerId: unknown, settings: unknown) => {
    try {
      if (typeof providerId !== 'string') {
        const audit = dependencies.voiceAudit.startOperation(providerId, 'settings-readiness', 'validation');
        audit.lifecycle.terminal(
          'validation',
          'failure',
          dependencies.voiceAudit.createMetadata({ causeCode: 'not-configured' }),
        );
        return { success: false, error: 'Unsupported provider' };
      }
      if (providerId === CLAUDE_WEB_PROVIDER_ID) {
        const audit = dependencies.voiceAudit.startOperation(providerId, 'settings-readiness', 'validation');
        try {
          assertValidClaudeWebSettingsUpdateInput(settings);
        } catch {
          audit.lifecycle.terminal(
            'validation',
            'failure',
            dependencies.voiceAudit.createMetadata({ causeCode: 'invalid-settings' }),
          );
          return { success: false, error: t('error.claudeWeb.invalid-settings') };
        }

        audit.lifecycle.phaseCompleted('validation');
        audit.lifecycle.phaseEntered('configuration');
        log.info('Saving provider settings:', { providerId });
        let savedSettings: ReturnType<typeof saveClaudeWebSettings>;
        try {
          savedSettings = saveClaudeWebSettings(settings);
          await refreshActiveProvider(providerId, dependencies.windowManager, dependencies.backgroundBrowserService);
        } catch (error: unknown) {
          dependencies.voiceAudit.terminalException(audit, 'configuration', error);
          throw error;
        }
        log.info('Provider settings saved:', { providerId });
        const nextSettings = {
          providerId,
          authType: 'browserSession' as const,
          hasSession: dependencies.voiceProviderRegistry.createProvider(providerId).hasSession(),
          language: savedSettings.language,
        };
        audit.lifecycle.phaseCompleted('configuration');
        audit.lifecycle.terminal('configuration', 'success');
        dependencies.windowManager.publishProviderSettingsChanged(nextSettings, event.sender);
        return { success: true, settings: nextSettings };
      }
      if (providerId !== OPENAI_API_PROVIDER_ID) {
        log.info('Saving provider settings:', { providerId });
        log.warn('Provider settings save skipped for provider without editable settings:', { providerId });
        const nextSettings = getProviderSettingsSnapshot(
          providerId,
          dependencies.voiceProviderRegistry,
          dependencies.voiceAudit,
        );
        dependencies.windowManager.publishProviderSettingsChanged(nextSettings, event.sender);
        return { success: true, settings: nextSettings };
      }

      const audit = dependencies.voiceAudit.startOperation(providerId, 'settings-readiness', 'validation');
      try {
        assertValidOpenAIApiSettingsInput(settings);
      } catch (error: unknown) {
        audit.lifecycle.terminal(
          'validation',
          'failure',
          dependencies.voiceAudit.createMetadata({ causeCode: 'not-configured' }),
        );
        throw error;
      }
      audit.lifecycle.phaseCompleted('validation');
      audit.lifecycle.phaseEntered('configuration');
      log.info('Saving provider settings:', { providerId, ...summarizeOpenAIApiSettingsInput(settings) });
      let savedSettings: ReturnType<typeof saveOpenAIApiSettings>;
      try {
        savedSettings = saveOpenAIApiSettings(settings);
        await refreshActiveProvider(providerId, dependencies.windowManager, dependencies.backgroundBrowserService);
      } catch (error: unknown) {
        dependencies.voiceAudit.terminalException(audit, 'configuration', error);
        throw error;
      }
      log.info('Provider settings saved:', {
        providerId,
        hasApiKey: savedSettings.hasApiKey,
        model: savedSettings.model,
        language: savedSettings.language,
        promptLength: savedSettings.prompt.length,
        temperature: savedSettings.temperature,
      });
      const nextSettings = {
        providerId,
        authType: 'apiKey' as const,
        ...savedSettings,
      };
      audit.lifecycle.phaseCompleted('configuration');
      audit.lifecycle.terminal(
        'configuration',
        savedSettings.hasApiKey ? 'success' : 'failure',
        savedSettings.hasApiKey ? undefined : dependencies.voiceAudit.createMetadata({ causeCode: 'not-configured' }),
      );
      dependencies.windowManager.publishProviderSettingsChanged(nextSettings, event.sender);
      return { success: true, settings: nextSettings };
    } catch (error: unknown) {
      log.error('Provider settings save error:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  });

  registration.handle('clear-provider-auth', async (event, providerId: string) => {
    const audit = dependencies.voiceAudit.startOperation(providerId, 'session-clear', 'session');
    try {
      if (!dependencies.voiceAudit.isKnownProviderId(providerId)) {
        audit.lifecycle.terminal(
          'session',
          'failure',
          dependencies.voiceAudit.createMetadata({ causeCode: 'not-configured' }),
        );
        throw new Error(`Unknown voice provider: ${providerId}`);
      }
      if (providerId === OPENAI_API_PROVIDER_ID) {
        clearOpenAIApiKey();
      } else {
        dependencies.voiceProviderRegistry.createProvider(providerId).clearSession();
      }
      audit.lifecycle.phaseCompleted('session');
      audit.lifecycle.terminal('session', 'success');
      await refreshActiveProvider(providerId, dependencies.windowManager, dependencies.backgroundBrowserService);
      const settings = getProviderSettingsSnapshot(
        providerId,
        dependencies.voiceProviderRegistry,
        dependencies.voiceAudit,
      );
      dependencies.windowManager.publishProviderSettingsChanged(settings, event.sender);
      return { success: true, settings };
    } catch (error: unknown) {
      dependencies.voiceAudit.terminalException(audit, 'session', error, {
        causeCode: 'cleanup-failed',
      });
      return { success: false, error: getErrorMessage(error) };
    }
  });

  registration.handle('get-active-provider', () => {
    return currentProvider;
  });

  registration.handle('set-active-provider', async (_event, providerId: string) => {
    try {
      const status = await dependencies.backgroundBrowserService.switchProvider(providerId);
      saveConfig();
      dependencies.windowManager.publishBackgroundStatus(status, currentProvider);
      return { success: !status.error, error: status.error };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  registration.handle('get-hotkey', (): HotkeySettings => {
    return getHotkeySettingsSnapshot();
  });

  registration.handle('set-hotkey-capture-active', (_event, active: unknown) => {
    if (typeof active !== 'boolean') {
      return { success: false };
    }

    dependencies.shortcutController.setSuspended(active);
    return { success: true };
  });

  registration.handle('set-hotkey', (_event, key: unknown, hotkey: unknown) => {
    if (typeof key !== 'string' || !isHotkeyTarget(key)) {
      return {
        success: false,
        error: 'Unsupported hotkey target',
        ...getHotkeySettingsSnapshot(),
      };
    }
    const target: HotkeyTarget = key;
    if (typeof hotkey !== 'string') {
      return {
        success: false,
        error: 'Hotkey must be a string',
        ...getHotkeySettingsSnapshot(),
      };
    }
    const normalizedHotkey = normalizeHotkey(hotkey);
    if (!normalizedHotkey) {
      return {
        success: false,
        error: 'Choose a key or key combination',
        ...getHotkeySettingsSnapshot(),
      };
    }

    const conflict = getHotkeyConflict(target, normalizedHotkey, getHotkeySettingsSnapshot());
    if (conflict) {
      return {
        success: false,
        error: `This hotkey conflicts with the ${conflict} shortcut`,
        ...getHotkeySettingsSnapshot(),
      };
    }

    if (key === 'cancel') {
      log.info('Changing cancel hotkey from', currentCancelHotkey, 'to', normalizedHotkey);
      setHotkeys(undefined, normalizedHotkey, undefined, undefined, undefined);
    } else if (key === 'stop') {
      log.info('Changing stop hotkey from', currentStopHotkey, 'to', normalizedHotkey);
      setHotkeys(undefined, undefined, normalizedHotkey, undefined, undefined);
    } else if (target === 'translate') {
      log.info('Changing translate hotkey from', currentTranslateHotkey, 'to', normalizedHotkey);
      setHotkeys(undefined, undefined, undefined, normalizedHotkey, undefined);
    } else if (target === 'prettify') {
      log.info('Changing prettify hotkey from', currentPrettifyHotkey, 'to', normalizedHotkey);
      setHotkeys(undefined, undefined, undefined, undefined, normalizedHotkey, undefined);
    } else if (target === 'retryTranscription') {
      log.info('Changing retry transcription hotkey from', currentRetryTranscriptionHotkey, 'to', normalizedHotkey);
      setHotkeys(undefined, undefined, undefined, undefined, undefined, normalizedHotkey);
    } else {
      log.info('Changing hotkey from', currentHotkey, 'to', normalizedHotkey);
      setHotkeys(normalizedHotkey, undefined, undefined, undefined, undefined, undefined);
    }
    saveConfig();
    dependencies.shortcutController.register();
    const hotkeySettings = getHotkeySettingsSnapshot();
    dependencies.windowManager.getMainWindow()?.webContents.send('hotkey-settings-changed', hotkeySettings);
    return { success: true, ...hotkeySettings };
  });

  registration.handle('get-translate-settings', () => {
    return getTranslationSettingsSnapshot();
  });

  registration.handle('get-text-action-settings', () => {
    return getTextActionSettingsSnapshot();
  });

  registration.handle('set-text-action-settings', (_event, settings: unknown) => {
    try {
      assertValidTextActionSettingsInput(settings);
      const normalized = normalizeTextActionSettings(settings);
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

  registration.handle('set-translate-settings', (_event, candidate: unknown) => {
    try {
      const settings = saveTranslationSettings(candidate);
      log.info('Translation settings saved', { providerId: settings.providerId });
      return { success: true, settings };
    } catch (error: unknown) {
      const validationFailure = error instanceof TranslationSettingsValidationError;
      log.warn('Translation settings update rejected', {
        errorName: error instanceof Error ? error.name : 'unknown',
        validationFailure,
      });
      return {
        success: false,
        settings: getTranslationSettingsSnapshot(),
        error: t(validationFailure ? 'error.translationSettingsInvalid' : 'error.translationSettingsSaveFailed'),
      };
    }
  });

  registration.handle('get-prettify-settings', () => {
    return getPrettifySettingsSnapshot();
  });

  registration.handle(
    'check-prettify-cli-connection',
    async (event, providerId: unknown): Promise<PrettifyCliConnectionResult> => {
      if (!isPrettifyCliProviderId(providerId)) {
        return dependencies.prettifyRuntime.checkCliConnection(providerId);
      }
      return dependencies.prettifyConnectionCoordinator.check(event.sender, providerId, getPrettifySettingsSnapshot());
    },
  );

  registration.handle('set-prettify-settings', (_event, settings: unknown = {}) => {
    try {
      assertValidPrettifySettingsInput(settings);
      const previous = getPrettifySettingsSnapshot();
      log.info('Saving Prettify settings:', summarizePrettifySettingsInput(settings));
      const savedSettings = savePrettifySettings(settings);
      log.info('Prettify settings saved:', {
        providerId: savedSettings.providerId,
        providerChanged: savedSettings.providerId !== previous.providerId,
        promptLength: savedSettings.prompt.length,
        temperature: savedSettings.temperature,
        ollamaModelLength: savedSettings.ollama.model.length,
        vllmModelLength: savedSettings.vllm.model.length,
        vllmHasApiKey: savedSettings.vllm.hasApiKey,
      });
      dependencies.windowManager.publishPrettifySettingsChanged(savedSettings);
      return { success: true, settings: savedSettings };
    } catch (error: unknown) {
      log.error('Prettify settings save error:', getErrorMessage(error));
      return { success: false, settings: getPrettifySettingsSnapshot(), error: getErrorMessage(error) };
    }
  });

  registration.handle(
    'list-prettify-models',
    async (
      _event,
      providerId: KnownPrettifyProviderId,
      draftSettings: unknown = {},
    ): Promise<PrettifyModelListResult> => {
      if (!isKnownPrettifyProviderId(providerId)) {
        const rejected = await dependencies.prettifyRuntime.listModels(providerId, {});
        return {
          ...rejected,
          error: 'Unsupported prettify provider',
        };
      }

      try {
        assertValidKnownPrettifySettingsInput(draftSettings);
        return await dependencies.prettifyRuntime.listModels(providerId, draftSettings);
      } catch {
        return {
          availability: { status: 'unavailable' },
          success: false,
          providerId,
          source: getPrettifyProviderCapabilities(providerId).modelSource,
          models: [],
          error: t('status.prettifyFailed'),
        };
      }
    },
  );

  registration.handle(
    'load-prettify-model',
    async (
      _event,
      providerId: KnownPrettifyProviderId,
      draftSettings: unknown = {},
    ): Promise<PrettifyModelLoadResult> => {
      if (!isKnownPrettifyProviderId(providerId)) {
        const rejected = await dependencies.prettifyRuntime.loadModel(providerId, {});
        return { ...rejected, error: 'Unsupported prettify provider' };
      }

      try {
        assertValidKnownPrettifySettingsInput(draftSettings);
        return await dependencies.prettifyRuntime.loadModel(providerId, draftSettings);
      } catch {
        return { success: false, providerId, error: t('status.prettifyFailed') };
      }
    },
  );

  registration.handle(
    'unload-prettify-model',
    async (
      _event,
      providerId: KnownPrettifyProviderId,
      draftSettings: unknown = {},
    ): Promise<PrettifyModelUnloadResult> => {
      if (!isKnownPrettifyProviderId(providerId)) {
        const rejected = await dependencies.prettifyRuntime.unloadModel(providerId, {});
        return { ...rejected, error: 'Unsupported prettify provider' };
      }

      try {
        assertValidKnownPrettifySettingsInput(draftSettings);
        return await dependencies.prettifyRuntime.unloadModel(providerId, draftSettings);
      } catch {
        return { success: false, providerId, error: t('status.prettifyFailed') };
      }
    },
  );

  registration.handle(
    'show-notification',
    (_event, title: string, body: string, options?: SystemNotificationOptions) => {
      showSystemNotification(title, body, options);
    },
  );

  registration.handle('get-translations', () => {
    return getAllTranslations();
  });

  registration.handle('get-locale', () => {
    return getLocale();
  });

  registration.handle('get-supported-locales', () => {
    return getSupportedLocales();
  });

  registration.handle('set-locale', (_event, locale: unknown) => {
    try {
      if (!isAppLocaleId(locale)) {
        return { success: false, error: 'Select a supported locale' };
      }
      log.info('Saving locale:', { from: getLocale(), to: locale });
      setLocale(locale);
      setCurrentLocale(locale);
      saveConfig();
      dependencies.windowManager.broadcastLocaleChanged(locale);
      log.info('Locale saved:', { locale: getLocale() });
      return { success: true };
    } catch (error: unknown) {
      log.error('Locale save error:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  });

  registration.handle('get-platform', () => {
    return process.platform;
  });

  return registration;
}
