/* eslint-disable max-classes-per-file -- the trusted registrar and main controller form one IPC ownership boundary. */
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import type { BrowserContext } from 'playwright-core';
import type { BackgroundBrowserService } from './browser';
import type { VoiceProviderAudit } from './providers/voiceProviderAudit';
import type { VoiceProviderRegistry } from './providers/voiceProviderRegistry';
import { type WindowManager } from './window';
import type { DesktopRuntimeController } from './desktopRuntimeController';
import type { ShortcutController } from './shortcuts';
import type { TranscriptionService } from './services/transcription';
import type { TranslationRuntime } from './services/translation';
import {
  assertValidOpenAIApiSettingsInput,
  OPENAI_API_PROVIDER_ID,
  type OpenAIApiSettingsInput,
} from './providers/openaiApiSettingsUtils';
import { assertValidCloakBrowserSettingsInput } from './cloakBrowserSettingsUtils';
import type { CloakBrowserSettingsInput } from '@shared/cloakBrowserSettings';
import { assertValidClaudeWebSettingsUpdateInput, CLAUDE_WEB_PROVIDER_ID } from '@shared/claudeWebSettings';
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
import type { PrettifyRuntime } from './services/prettifyProviders';
import { PrettifyConnectionCheckCoordinator } from './services/prettifyConnectionCheckCoordinator';
import { shouldRefreshProviderAfterMutation } from './providerSettingsMutation';
import {
  StreamingTranscriptionIpcController,
  type StreamingTranscriptionIpcHandler,
} from './streamingTranscriptionIpcController';
import type { MainStreamingTranscriptionService } from './services/streamingTranscription';
import { isAppSettingsSectionId } from '@shared/appSettings';
import { isAppLocaleId } from '@shared/appLocale';
import { TranslationSettingsValidationError } from './translationSettings';

export interface MainIpcTransport {
  handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
}

export interface MainIpcConfigRepository {
  readonly getCurrentProvider: () => string;
  readonly getHotkeySettings: () => HotkeySettings;
  readonly getTextActionSettings: () => {
    readonly prettifyEnabled: boolean;
    readonly translateEnabled: boolean;
  };
  readonly getTranslationSettings: typeof import('./config').getTranslationSettingsSnapshot;
  readonly save: typeof import('./config').saveConfig;
  readonly saveTranslationSettings: typeof import('./config').saveTranslationSettings;
  readonly setCurrentLocale: typeof import('./config').setCurrentLocale;
  readonly setHotkeys: typeof import('./config').setHotkeys;
  readonly setTextActionSettings: typeof import('./config').setTextActionSettings;
}

export interface MainIpcLocalization {
  readonly getAllTranslations: typeof import('./i18n').getAllTranslations;
  readonly getLocale: typeof import('./i18n').getLocale;
  readonly getSupportedLocales: typeof import('./i18n').getSupportedLocales;
  readonly setLocale: typeof import('./i18n').setLocale;
  readonly translate: typeof import('./i18n').t;
}

export interface MainIpcCloakBrowserSettingsRepository {
  readonly getView: typeof import('./cloakBrowserSettings').getCloakBrowserSettingsView;
  readonly prepare: typeof import('./cloakBrowserSettings').prepareCloakBrowserSettings;
}

export interface MainIpcPrettifySettingsRepository {
  readonly getView: typeof import('./services/prettifySettingsStorage').getPrettifySettingsView;
  readonly save: typeof import('./services/prettifySettingsStorage').savePrettifySettings;
}

export interface MainIpcVoiceSettingsRepository {
  readonly clearOpenAIApiKey: typeof import('./providers/openaiApiSettings').clearOpenAIApiKey;
  readonly getClaudeWebSettings: typeof import('./providers/claudeWebSettings').getClaudeWebSettings;
  readonly getOpenAIApiSettingsView: typeof import('./providers/openaiApiSettings').getOpenAIApiSettingsView;
  readonly saveClaudeWebSettings: typeof import('./providers/claudeWebSettings').saveClaudeWebSettings;
  readonly saveOpenAIApiSettings: typeof import('./providers/openaiApiSettings').saveOpenAIApiSettings;
}

export interface MainIpcLogger {
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export interface MainIpcControllerDependencies {
  readonly backgroundBrowserService: BackgroundBrowserService;
  readonly cloakBrowserSettings: MainIpcCloakBrowserSettingsRepository;
  readonly config: MainIpcConfigRepository;
  readonly desktopRuntimeController: DesktopRuntimeController;
  readonly historyController: TranscriptionHistoryIpcController;
  readonly ipc: MainIpcTransport;
  readonly localization: MainIpcLocalization;
  readonly logger: MainIpcLogger;
  readonly notification: {
    show(title: string, body: string, options?: SystemNotificationOptions): void;
  };
  readonly platform: NodeJS.Platform;
  readonly prettifyRuntime: PrettifyRuntime;
  readonly prettifySettings: MainIpcPrettifySettingsRepository;
  readonly shortcutController: ShortcutController;
  readonly streamingTranscriptionService: MainStreamingTranscriptionService;
  readonly transcriptionService: Pick<TranscriptionService, 'transcribe'>;
  readonly translationRuntime: Pick<TranslationRuntime, 'shutdown' | 'translateText'>;
  readonly voiceAudit: VoiceProviderAudit;
  readonly voiceProviderRegistry: VoiceProviderRegistry;
  readonly voiceSettings: MainIpcVoiceSettingsRepository;
  readonly windowManager: WindowManager;
}

type TrustedIpcListener<Args extends unknown[]> = (event: IpcMainInvokeEvent, ...args: Args) => unknown;

/** Owns trusted-sender validation and the channels registered directly by one controller. */
class TrustedIpcRegistrar {
  private readonly channels = new Set<string>();
  private disposed = false;

  public constructor(
    private readonly ipc: MainIpcTransport,
    private readonly logger: MainIpcLogger,
    private readonly windowManager: WindowManager,
  ) {}

  public handle<Args extends unknown[]>(channel: string, listener: TrustedIpcListener<Args>): void {
    if (this.disposed) throw new Error('Main IPC registrar is disposed');
    this.ipc.handle(channel, (event, ...args) => {
      this.assertTrustedSender(event);
      return listener(event, ...(args as Args));
    });
    this.channels.add(channel);
  }

  public handleStreaming(channel: string, listener: StreamingTranscriptionIpcHandler<WebContents>): void {
    if (this.disposed) throw new Error('Main IPC registrar is disposed');
    this.ipc.handle(channel, (event, ...args) => {
      this.assertTrustedSender(event);
      return listener(event.sender, ...args);
    });
  }

  public removeStreamingHandler(channel: string): void {
    this.ipc.removeHandler(channel);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const channel of this.channels) this.ipc.removeHandler(channel);
    this.channels.clear();
  }

  private assertTrustedSender(event: IpcMainInvokeEvent): void {
    const senderUrl = event.senderFrame?.url || event.sender.getURL();
    if (this.windowManager.isTrustedAppWindow(event.sender, senderUrl)) return;

    this.logger.warn('Rejected IPC from untrusted sender:', senderUrl || '<unknown>');
    throw new Error('Rejected IPC from untrusted sender');
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

/** Owns every privileged renderer-to-main IPC handler and per-sender lifecycle for one application graph. */
export class MainIpcController {
  private disposalPromise: Promise<void> | null = null;
  private disposed = false;
  private prettifyConnectionCoordinator: PrettifyConnectionCheckCoordinator<WebContents> | null = null;
  private registered = false;
  private streamingTranscriptionController: StreamingTranscriptionIpcController<WebContents> | null = null;
  private readonly trustedIpc: TrustedIpcRegistrar;

  public constructor(private readonly dependencies: MainIpcControllerDependencies) {
    this.trustedIpc = new TrustedIpcRegistrar(dependencies.ipc, dependencies.logger, dependencies.windowManager);
  }

  /** Registers every main-process handler once for this controller. */
  public register(): void {
    if (this.disposed) throw new Error('Main IPC controller is disposed');
    if (this.registered) return;
    this.registered = true;

    const dependencies = this.dependencies;
    const historyController = dependencies.historyController;
    const log = dependencies.logger;
    const prettifyConnectionCoordinator = new PrettifyConnectionCheckCoordinator<WebContents>(
      dependencies.prettifyRuntime,
    );
    this.prettifyConnectionCoordinator = prettifyConnectionCoordinator;
    this.streamingTranscriptionController = new StreamingTranscriptionIpcController<WebContents>({
      addSenderDestroyedListener: (sender, listener) => sender.once('destroyed', listener),
      getMainWindowSender: () => {
        const mainWindow = dependencies.windowManager.getMainWindow();
        return mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
      },
      isSenderDestroyed: (sender) => sender.isDestroyed(),
      registerBeforeBrowserShutdownHook: (hook) =>
        dependencies.backgroundBrowserService.registerBeforeShutdownHook(hook),
      registerHandler: (channel, listener) => this.trustedIpc.handleStreaming(channel, listener),
      removeHandler: (channel) => this.trustedIpc.removeStreamingHandler(channel),
      removeSenderDestroyedListener: (sender, listener) => sender.removeListener('destroyed', listener),
      service: dependencies.streamingTranscriptionService,
    });

    this.trustedIpc.handle('transcribe-audio', async (_event, buffer: ArrayBuffer, mimeType: string) => {
      return dependencies.transcriptionService.transcribe(buffer, mimeType);
    });

    this.trustedIpc.handle('translate-text', async (_event, text: string, targetLang: string) => {
      return dependencies.translationRuntime.translateText(text, targetLang);
    });

    this.trustedIpc.handle('get-transcription-history', (_event, query: TranscriptionHistoryQuery) => {
      return historyController.list(query || {});
    });

    this.trustedIpc.handle('copy-transcription-history-text', (_event, id: number) => {
      return historyController.copyText(id);
    });

    this.trustedIpc.handle('clear-transcription-history', () => {
      return historyController.clear();
    });

    this.trustedIpc.handle('get-recording-status', () => {
      return dependencies.shortcutController.getRecordingState().isRecording;
    });

    this.trustedIpc.handle('recording-start-failed', () => {
      dependencies.shortcutController.resetRecordingState();
      return { success: true };
    });

    this.trustedIpc.handle('set-recording-lifecycle-state', (_event, state: unknown) => {
      if (!isRecordingLifecycleState(state)) {
        return { success: false };
      }
      dependencies.shortcutController.setRecordingLifecycleState(state);
      return { success: true };
    });

    this.trustedIpc.handle('set-retry-transcription-available', (_event, available: boolean) => {
      dependencies.shortcutController.setRetryTranscriptionAvailable(Boolean(available));
      return { success: true };
    });

    this.trustedIpc.handle('provider-login', async (event, providerId: unknown) => {
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

        const status = await this.refreshActiveProvider(provider.info.id);
        const settings = this.getProviderSettingsSnapshot(provider.info.id);
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

    this.trustedIpc.handle('check-session', () => {
      try {
        const provider =
          dependencies.backgroundBrowserService.getActiveProvider() ??
          dependencies.voiceProviderRegistry.createProvider(dependencies.config.getCurrentProvider());
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

    this.trustedIpc.handle('is-bg-ready', () => {
      return dependencies.backgroundBrowserService.isReady();
    });

    this.trustedIpc.handle('get-bg-browser-status', () => {
      return dependencies.backgroundBrowserService.getStatus();
    });

    this.trustedIpc.handle('get-providers', () => {
      return dependencies.voiceProviderRegistry.getAvailableProviders();
    });

    this.trustedIpc.handle('get-provider-settings', (_event, providerId: string) => {
      return this.getProviderSettingsSnapshot(providerId);
    });

    this.trustedIpc.handle('open-provider-settings', (_event, providerId: unknown) => {
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
        dependencies.localization.translate('providerSettings.title', { provider: provider.name }),
      );
      return { success: true };
    });

    this.trustedIpc.handle('close-provider-settings', (event) => {
      return { success: dependencies.windowManager.closeProviderSettingsWindow(event.sender) };
    });

    this.trustedIpc.handle('close-app-settings', () => {
      dependencies.windowManager.closeSettingsWindow();
      return { success: true };
    });

    this.trustedIpc.handle('open-app-settings', (_event, section: unknown) => {
      if (section !== undefined && !isAppSettingsSectionId(section)) {
        return { success: false, error: 'Unsupported settings section' };
      }
      dependencies.windowManager.showSettingsWindow(section);
      return { success: true };
    });

    this.trustedIpc.handle('open-transcription-history', () => {
      dependencies.windowManager.showHistoryWindow();
      return { success: true };
    });

    this.trustedIpc.handle('open-about', () => {
      dependencies.windowManager.showAboutWindow();
      return { success: true };
    });

    this.trustedIpc.handle('close-about', () => {
      dependencies.windowManager.closeAboutWindow();
      return { success: true };
    });

    this.trustedIpc.handle('get-app-info', () => {
      return dependencies.desktopRuntimeController.getAppInfo();
    });

    this.trustedIpc.handle('get-cloakbrowser-settings', () => {
      return dependencies.cloakBrowserSettings.getView();
    });

    this.trustedIpc.handle('save-cloakbrowser-settings', async (_event, settings: unknown) => {
      try {
        assertValidCloakBrowserSettingsInput(settings);
        log.info('Saving CloakBrowser settings:', summarizeCloakBrowserSettingsInput(settings));
        const preparedSettings = dependencies.cloakBrowserSettings.prepare(settings);
        const translationShutdown = await dependencies.translationRuntime.shutdown();
        if (!translationShutdown.success) {
          log.warn('CloakBrowser settings save blocked by translation cleanup:', {
            failedProviderIds: translationShutdown.failedProviderIds,
          });
          return {
            success: false,
            settings: dependencies.cloakBrowserSettings.getView(),
            error: dependencies.localization.translate('error.translationCleanupFailed'),
          };
        }
        const backgroundStatus = await dependencies.backgroundBrowserService.restart({
          cloakBrowserSettings: preparedSettings.settingsWithSecret,
        });
        dependencies.windowManager.publishBackgroundStatus(backgroundStatus, dependencies.config.getCurrentProvider());
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

    this.trustedIpc.handle('save-provider-settings', async (event, providerId: unknown, settings: unknown) => {
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
            return { success: false, error: dependencies.localization.translate('error.claudeWeb.invalid-settings') };
          }

          audit.lifecycle.phaseCompleted('validation');
          audit.lifecycle.phaseEntered('configuration');
          log.info('Saving provider settings:', { providerId });
          let savedSettings: ReturnType<MainIpcVoiceSettingsRepository['saveClaudeWebSettings']>;
          try {
            savedSettings = dependencies.voiceSettings.saveClaudeWebSettings(settings);
            await this.refreshActiveProvider(providerId);
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
          const nextSettings = this.getProviderSettingsSnapshot(providerId);
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
        let savedSettings: ReturnType<MainIpcVoiceSettingsRepository['saveOpenAIApiSettings']>;
        try {
          savedSettings = dependencies.voiceSettings.saveOpenAIApiSettings(settings);
          await this.refreshActiveProvider(providerId);
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

    this.trustedIpc.handle('clear-provider-auth', async (event, providerId: string) => {
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
          dependencies.voiceSettings.clearOpenAIApiKey();
        } else {
          dependencies.voiceProviderRegistry.createProvider(providerId).clearSession();
        }
        audit.lifecycle.phaseCompleted('session');
        audit.lifecycle.terminal('session', 'success');
        await this.refreshActiveProvider(providerId);
        const settings = this.getProviderSettingsSnapshot(providerId);
        dependencies.windowManager.publishProviderSettingsChanged(settings, event.sender);
        return { success: true, settings };
      } catch (error: unknown) {
        dependencies.voiceAudit.terminalException(audit, 'session', error, {
          causeCode: 'cleanup-failed',
        });
        return { success: false, error: getErrorMessage(error) };
      }
    });

    this.trustedIpc.handle('get-active-provider', () => {
      return dependencies.config.getCurrentProvider();
    });

    this.trustedIpc.handle('set-active-provider', async (_event, providerId: string) => {
      try {
        const status = await dependencies.backgroundBrowserService.switchProvider(providerId);
        dependencies.config.save();
        dependencies.windowManager.publishBackgroundStatus(status, dependencies.config.getCurrentProvider());
        return { success: !status.error, error: status.error };
      } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
      }
    });

    this.trustedIpc.handle('get-hotkey', (): HotkeySettings => {
      return dependencies.config.getHotkeySettings();
    });

    this.trustedIpc.handle('set-hotkey-capture-active', (_event, active: unknown) => {
      if (typeof active !== 'boolean') {
        return { success: false };
      }

      dependencies.shortcutController.setSuspended(active);
      return { success: true };
    });

    this.trustedIpc.handle('set-hotkey', (_event, key: unknown, hotkey: unknown) => {
      if (typeof key !== 'string' || !isHotkeyTarget(key)) {
        return {
          success: false,
          error: 'Unsupported hotkey target',
          ...dependencies.config.getHotkeySettings(),
        };
      }
      const target: HotkeyTarget = key;
      if (typeof hotkey !== 'string') {
        return {
          success: false,
          error: 'Hotkey must be a string',
          ...dependencies.config.getHotkeySettings(),
        };
      }
      const normalizedHotkey = normalizeHotkey(hotkey);
      if (!normalizedHotkey) {
        return {
          success: false,
          error: 'Choose a key or key combination',
          ...dependencies.config.getHotkeySettings(),
        };
      }

      const conflict = getHotkeyConflict(target, normalizedHotkey, dependencies.config.getHotkeySettings());
      if (conflict) {
        return {
          success: false,
          error: `This hotkey conflicts with the ${conflict} shortcut`,
          ...dependencies.config.getHotkeySettings(),
        };
      }

      if (key === 'cancel') {
        log.info(
          'Changing cancel hotkey from',
          dependencies.config.getHotkeySettings().cancelHotkey,
          'to',
          normalizedHotkey,
        );
        dependencies.config.setHotkeys(undefined, normalizedHotkey, undefined, undefined, undefined);
      } else if (key === 'stop') {
        log.info(
          'Changing stop hotkey from',
          dependencies.config.getHotkeySettings().stopHotkey,
          'to',
          normalizedHotkey,
        );
        dependencies.config.setHotkeys(undefined, undefined, normalizedHotkey, undefined, undefined);
      } else if (target === 'translate') {
        log.info(
          'Changing translate hotkey from',
          dependencies.config.getHotkeySettings().translateHotkey,
          'to',
          normalizedHotkey,
        );
        dependencies.config.setHotkeys(undefined, undefined, undefined, normalizedHotkey, undefined);
      } else if (target === 'prettify') {
        log.info(
          'Changing prettify hotkey from',
          dependencies.config.getHotkeySettings().prettifyHotkey,
          'to',
          normalizedHotkey,
        );
        dependencies.config.setHotkeys(undefined, undefined, undefined, undefined, normalizedHotkey, undefined);
      } else if (target === 'retryTranscription') {
        log.info(
          'Changing retry transcription hotkey from',
          dependencies.config.getHotkeySettings().retryTranscriptionHotkey,
          'to',
          normalizedHotkey,
        );
        dependencies.config.setHotkeys(undefined, undefined, undefined, undefined, undefined, normalizedHotkey);
      } else {
        log.info('Changing hotkey from', dependencies.config.getHotkeySettings().hotkey, 'to', normalizedHotkey);
        dependencies.config.setHotkeys(normalizedHotkey, undefined, undefined, undefined, undefined, undefined);
      }
      dependencies.config.save();
      dependencies.shortcutController.register();
      const hotkeySettings = dependencies.config.getHotkeySettings();
      dependencies.windowManager.getMainWindow()?.webContents.send('hotkey-settings-changed', hotkeySettings);
      return { success: true, ...hotkeySettings };
    });

    this.trustedIpc.handle('get-translate-settings', () => {
      return dependencies.config.getTranslationSettings();
    });

    this.trustedIpc.handle('get-text-action-settings', () => {
      return dependencies.config.getTextActionSettings();
    });

    this.trustedIpc.handle('set-text-action-settings', (_event, settings: unknown) => {
      try {
        assertValidTextActionSettingsInput(settings);
        const normalized = normalizeTextActionSettings(settings);
        log.info('Saving text action settings:', {
          from: {
            translateEnabled: dependencies.config.getTextActionSettings().translateEnabled,
            prettifyEnabled: dependencies.config.getTextActionSettings().prettifyEnabled,
          },
          to: normalized,
        });
        dependencies.config.setTextActionSettings(normalized.translateEnabled, normalized.prettifyEnabled);
        dependencies.config.save();
        log.info('Text action settings saved:', normalized);
        return { success: true, settings: normalized };
      } catch (error: unknown) {
        log.error('Text action settings save error:', getErrorMessage(error));
        return { success: false, settings: dependencies.config.getTextActionSettings(), error: getErrorMessage(error) };
      }
    });

    this.trustedIpc.handle('set-translate-settings', (_event, candidate: unknown) => {
      try {
        const settings = dependencies.config.saveTranslationSettings(candidate);
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
          settings: dependencies.config.getTranslationSettings(),
          error: dependencies.localization.translate(
            validationFailure ? 'error.translationSettingsInvalid' : 'error.translationSettingsSaveFailed',
          ),
        };
      }
    });

    this.trustedIpc.handle('get-prettify-settings', () => {
      return dependencies.prettifySettings.getView();
    });

    this.trustedIpc.handle(
      'check-prettify-cli-connection',
      async (event, providerId: unknown): Promise<PrettifyCliConnectionResult> => {
        if (!isPrettifyCliProviderId(providerId)) {
          return dependencies.prettifyRuntime.checkCliConnection(providerId);
        }
        return prettifyConnectionCoordinator.check(event.sender, providerId, dependencies.prettifySettings.getView());
      },
    );

    this.trustedIpc.handle('set-prettify-settings', (_event, settings: unknown = {}) => {
      try {
        assertValidPrettifySettingsInput(settings);
        const previous = dependencies.prettifySettings.getView();
        log.info('Saving Prettify settings:', summarizePrettifySettingsInput(settings));
        const savedSettings = dependencies.prettifySettings.save(settings);
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
        return { success: false, settings: dependencies.prettifySettings.getView(), error: getErrorMessage(error) };
      }
    });

    this.trustedIpc.handle(
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
            error: dependencies.localization.translate('status.prettifyFailed'),
          };
        }
      },
    );

    this.trustedIpc.handle(
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
          return { success: false, providerId, error: dependencies.localization.translate('status.prettifyFailed') };
        }
      },
    );

    this.trustedIpc.handle(
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
          return { success: false, providerId, error: dependencies.localization.translate('status.prettifyFailed') };
        }
      },
    );

    this.trustedIpc.handle(
      'show-notification',
      (_event, title: string, body: string, options?: SystemNotificationOptions) => {
        dependencies.notification.show(title, body, options);
      },
    );

    this.trustedIpc.handle('get-translations', () => {
      return dependencies.localization.getAllTranslations();
    });

    this.trustedIpc.handle('get-locale', () => {
      return dependencies.localization.getLocale();
    });

    this.trustedIpc.handle('get-supported-locales', () => {
      return dependencies.localization.getSupportedLocales();
    });

    this.trustedIpc.handle('set-locale', (_event, locale: unknown) => {
      try {
        if (!isAppLocaleId(locale)) {
          return { success: false, error: 'Select a supported locale' };
        }
        log.info('Saving locale:', { from: dependencies.localization.getLocale(), to: locale });
        dependencies.localization.setLocale(locale);
        dependencies.config.setCurrentLocale(locale);
        dependencies.config.save();
        dependencies.windowManager.broadcastLocaleChanged(locale);
        log.info('Locale saved:', { locale: dependencies.localization.getLocale() });
        return { success: true };
      } catch (error: unknown) {
        log.error('Locale save error:', getErrorMessage(error));
        return { success: false, error: getErrorMessage(error) };
      }
    });

    this.trustedIpc.handle('get-platform', () => {
      return dependencies.platform;
    });
  }

  public dispose(): Promise<void> {
    if (this.disposalPromise) return this.disposalPromise;
    this.disposed = true;
    this.trustedIpc.dispose();
    this.prettifyConnectionCoordinator?.dispose();
    this.disposalPromise = this.streamingTranscriptionController?.dispose() ?? Promise.resolve();
    return this.disposalPromise;
  }

  private getProviderSettingsSnapshot(providerId: string) {
    const providerRegistry = this.dependencies.voiceProviderRegistry;
    const auditProvider = this.dependencies.voiceAudit;
    if (!providerRegistry.isKnownProviderId(providerId)) {
      providerRegistry.createProvider(providerId);
    }
    const audit = auditProvider.startOperation(providerId, 'settings-readiness', 'configuration');

    try {
      if (providerId === OPENAI_API_PROVIDER_ID) {
        const settings = {
          providerId,
          authType: 'apiKey' as const,
          ...this.dependencies.voiceSettings.getOpenAIApiSettingsView(),
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
          authType: 'browserSession' as const,
          hasSession: provider.hasSession(),
          ...this.dependencies.voiceSettings.getClaudeWebSettings(),
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

  private async refreshActiveProvider(providerId: string) {
    const currentProvider = this.dependencies.config.getCurrentProvider();
    if (!shouldRefreshProviderAfterMutation(providerId, currentProvider)) return null;
    const status = await this.dependencies.backgroundBrowserService.restart();
    this.dependencies.windowManager.publishBackgroundStatus(status, currentProvider);
    return status;
  }
}
