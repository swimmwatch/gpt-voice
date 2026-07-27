import { AboutWindowController } from '../aboutWindowController';
import { AppProtocolController, type AppProtocolControllerDependencies } from '../appProtocol';
import { AssetPathResolver, type AssetPathResolverDependencies } from '../assets';
import { DesktopRuntimeController, type DesktopRuntimeControllerDependencies } from '../desktopRuntimeController';
import {
  LinuxDesktopIntegrationController,
  type LinuxDesktopIntegrationControllerDependencies,
} from '../linuxDesktopIntegration';
import { ShortcutController, type ShortcutControllerDependencies } from '../shortcuts';
import { TrayController, type TrayControllerDependencies } from '../tray';
import { WindowManager, type WindowManagerDependencies } from '../window';
import { ProviderSettingsWindowController } from '../providerSettingsWindowController';
import { BackgroundBrowserService, type BackgroundBrowserServiceDependencies } from '../browser';
import { VoiceProviderAudit } from '../providers/voiceProviderAudit';
import { VoiceProviderFactory, type VoiceProviderFactoryDependencies } from '../providers/voiceProviderFactory';
import { VoiceProviderRegistry } from '../providers/voiceProviderRegistry';
import { ClaudeWebNavigationService } from '../providers/claudeWebNavigationService';
import type { ProviderAuditDependencies } from '../providerAudit';
import { FileChatGPTSessionStore, type FileChatGPTSessionStoreDependencies } from '../providers/chatgptSessionStore';
import type { ChatGPTVoiceProviderDependencies } from '../providers/ChatGPTVoiceProvider';
import {
  TranslationProviderFactory,
  TranslationProviderRegistry,
  type TranslationProviderFactoryDependencies,
} from '../translateProviders';
import { TranslationProviderAudit } from '../translateProviders/translationProviderAudit';
import { TranslationRuntime } from '../services/translation';
import { DiagnosticCaptureService } from '../services/diagnosticCapture';
import { DiagnosticCaptureSettingsService } from '../services/diagnosticCaptureSettings';
import { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import { DiagnosticTextRedactor } from '../services/diagnosticTextRedactor';
import {
  SelectedTextTranslationService,
  SELECTED_TEXT_TRANSLATION_CACHE_MAX_ENTRIES,
  type SelectedTextTranslationDependencies,
} from '../services/selectedTextTranslation';
import { createTextActionResultCache } from '../services/textActionCache';
import { SelectedTextActionGate } from '../services/selectedTextActionState';
import {
  SelectedTextPrettifyService,
  SELECTED_TEXT_PRETTIFY_CACHE_MAX_AGE_MS,
  SELECTED_TEXT_PRETTIFY_CACHE_MAX_ENTRIES,
  type SelectedTextPrettifyDependencies,
} from '../services/selectedTextPrettify';
import { PrettifyProviderAudit } from '../services/prettifyProviderAudit';
import {
  PrettifyProviderFactory,
  PrettifyProviderRegistry,
  PrettifyRuntime,
  type PrettifyProviderFactoryDependencies,
} from '../services/prettifyProviders';
import { ClaudeCliPrettifyAdapter } from '../services/prettifyClaudeCli';
import { CodexCliPrettifyAdapter, type CodexCliPrettifyAdapterDependencies } from '../services/prettifyCodexCli';
import { CliProcessRunner, type CliProcessRunnerDependencies } from '../services/prettifyCliRunner';
import { TextAutomationService, type TextAutomationServiceDependencies } from '../services/textAutomation';
import { AppConfigStore, type AppConfigStoreDependencies } from '../config';
import { I18nService } from '../i18n';
import {
  CloakBrowserSettingsRepository,
  type CloakBrowserSettingsRepositoryDependencies,
} from '../cloakBrowserSettings';
import { PrettifySettingsStorage, type PrettifySettingsStorageDependencies } from '../services/prettifySettingsStorage';
import { LoggerFactory, type LoggerFactoryDependencies } from '../logger';
import { ElectronRuntimeLoader, type ElectronRuntimeLoaderDependencies } from '../electronRuntime';
import { CloakBrowserRuntimeLoader, type CloakBrowserRuntimeLoaderDependencies } from '../cloakbrowser';
import {
  OpenAIApiSettingsRepository,
  type OpenAIApiSettingsRepositoryDependencies,
} from '../providers/openaiApiSettings';
import {
  ClaudeWebSettingsRepository,
  FileClaudeWebPrivateJsonRepository,
  type FileClaudeWebPrivateJsonRepositoryDependencies,
} from '../providers/claudeWebSettings';
import {
  ClaudeWebSessionRepository,
  getPlaywrightStorageState,
  resolveClaudeWebOrganization,
} from '../providers/claudeWebSession';
import {
  createCloakBrowserLoginContextOptions,
  createCloakBrowserPersistentContextOptions,
} from '../cloakBrowserLaunchOptions';
import { AppDatabaseCoordinator } from '../repositories/sqlite/appDatabase';
import { SqliteDiagnosticCaptureRepository } from '../repositories/sqlite/sqliteDiagnosticCaptureRepository';
import { SqliteTranscriptionHistoryRepository } from '../repositories/sqlite/sqliteTranscriptionHistoryRepository';

export type MainProcessVoiceProviderEnvironment = Omit<
  VoiceProviderFactoryDependencies,
  'audit' | 'chatGPT' | 'claudeWeb' | 'localization' | 'openAIApi'
> & {
  readonly chatGPT: Omit<
    ChatGPTVoiceProviderDependencies,
    'audit' | 'localization' | 'logger' | 'sessionStore' | 'writeClipboardText'
  > & {
    readonly sessionStore: Omit<FileChatGPTSessionStoreDependencies, 'logger' | 'sessionFile' | 'tokenFile'>;
  };
  readonly claudeWeb: Omit<
    VoiceProviderFactoryDependencies['claudeWeb'],
    | 'clearSession'
    | 'getSettings'
    | 'getStorageState'
    | 'navigationService'
    | 'readSession'
    | 'resolveOrganization'
    | 'saveSession'
    | 'writeClipboardText'
  >;
  readonly openAIApi: Omit<VoiceProviderFactoryDependencies['openAIApi'], 'getSettings' | 'writeClipboardText'>;
};
import { MainProcessApplication, type MainProcessApplicationDependencies } from '../mainProcessApplication';
import {
  MainProcessRuntimeFactory,
  type MainProcessRuntimeFactoryControllers,
  type MainProcessRuntimeFactoryDependencies,
} from './mainProcessRuntimeFactory';

export interface MainProcessVoiceEnvironment {
  readonly audit: Omit<ProviderAuditDependencies, 'getSink'>;
  readonly browser: Omit<
    BackgroundBrowserServiceDependencies,
    | 'audit'
    | 'cloakBrowserSettings'
    | 'config'
    | 'createBackgroundContext'
    | 'createLoginContext'
    | 'localization'
    | 'logger'
    | 'providerRegistry'
  >;
  readonly providers: MainProcessVoiceProviderEnvironment;
}

export interface MainProcessTranslationEnvironment {
  readonly audit: Omit<ProviderAuditDependencies, 'getSink'>;
  readonly now: () => number;
  readonly providers: Omit<TranslationProviderFactoryDependencies, 'cloakBrowserSettings' | 'createContext' | 'now'>;
  readonly selectedText: Omit<
    SelectedTextTranslationDependencies,
    | 'actionGate'
    | 'cache'
    | 'clipboard'
    | 'diagnosticCapture'
    | 'localization'
    | 'logger'
    | 'notify'
    | 'runtime'
    | 'textAutomation'
  >;
}

export interface MainProcessPrettifyEnvironment {
  readonly audit: Omit<ProviderAuditDependencies, 'getSink'>;
  readonly cliRunner: CliProcessRunnerDependencies;
  readonly codexCli: Omit<CodexCliPrettifyAdapterDependencies, 'audit' | 'runner'>;
  readonly fetch: PrettifyProviderFactoryDependencies['fetch'];
  readonly settingsStorage: Omit<
    PrettifySettingsStorageDependencies,
    'config' | 'logger' | 'secureStorage' | 'settingsFile'
  >;
  readonly selectedText: Omit<
    SelectedTextPrettifyDependencies,
    | 'actionGate'
    | 'cache'
    | 'clipboard'
    | 'diagnosticCapture'
    | 'localization'
    | 'logger'
    | 'notify'
    | 'runtime'
    | 'settings'
    | 'textAutomation'
  >;
}

type RootOwnedRuntimeDependencyKeys =
  | 'databasePath'
  | 'diagnosticLogger'
  | 'historyLogger'
  | 'ipc'
  | 'localization'
  | 'transcriptionLogger'
  | 'writeClipboardText';

export type MainProcessCompositionEnvironment = Omit<
  MainProcessRuntimeFactoryDependencies,
  RootOwnedRuntimeDependencyKeys
> & {
  readonly assetPaths: AssetPathResolverDependencies;
  readonly cloakBrowserRuntime: Omit<CloakBrowserRuntimeLoaderDependencies, 'logger'>;
  readonly cloakBrowserSettings: Omit<
    CloakBrowserSettingsRepositoryDependencies,
    'config' | 'logger' | 'secureStorage' | 'settingsFile'
  >;
  readonly config: Omit<AppConfigStoreDependencies, 'logger'> & {
    readonly fileSystem: AppConfigStoreDependencies['fileSystem'] &
      FileClaudeWebPrivateJsonRepositoryDependencies['fileSystem'] &
      OpenAIApiSettingsRepositoryDependencies['fileSystem'];
  };
  readonly electronRuntime: Omit<ElectronRuntimeLoaderDependencies, 'logger'>;
  readonly ipc: Omit<
    MainProcessRuntimeFactoryDependencies['ipc'],
    | 'cloakBrowserSettings'
    | 'config'
    | 'localization'
    | 'logger'
    | 'notification'
    | 'prettifySettings'
    | 'voiceSettings'
  >;
  readonly logger: LoggerFactoryDependencies;
  readonly prettify: MainProcessPrettifyEnvironment;
  readonly textAutomation: TextAutomationServiceDependencies;
  readonly translation: MainProcessTranslationEnvironment;
  readonly voice: MainProcessVoiceEnvironment;
};

export interface MainProcessDesktopControllerEnvironment {
  readonly appProtocol: Omit<AppProtocolControllerDependencies, 'appIconPath' | 'appRoot' | 'logger'>;
  readonly desktopRuntime: Omit<
    DesktopRuntimeControllerDependencies,
    'getAppIconPath' | 'openExternal' | 'windowManager'
  >;
  readonly linuxDesktopIntegration: Omit<
    LinuxDesktopIntegrationControllerDependencies,
    'getAppIconPath' | 'getAssetPath' | 'logger'
  >;
  readonly shortcuts: Omit<
    ShortcutControllerDependencies,
    | 'selectedTextActionGate'
    | 'selectedTextPrettifyService'
    | 'selectedTextTranslationService'
    | 'trayController'
    | 'windowManager'
    | 'config'
    | 'logger'
  >;
  readonly tray: Omit<TrayControllerDependencies, 'getAssetPath' | 'localization' | 'windowManager'>;
  readonly window: Omit<
    WindowManagerDependencies,
    | 'createAboutWindowController'
    | 'getAppIcon'
    | 'getAppIconPath'
    | 'logger'
    | 'openExternal'
    | 'providerSettingsWindowController'
  >;
}

type ConstructedDesktopDependencyKeys =
  | 'appProtocolController'
  | 'backgroundBrowserService'
  | 'desktopRuntimeController'
  | 'linuxDesktopIntegrationController'
  | 'runtimeFactory'
  | 'shortcutController'
  | 'prettifyRuntime'
  | 'translationRuntime'
  | 'trayController'
  | 'windowManager';

type RootOwnedApplicationDependencyKeys =
  'config' | 'configureCloakBrowserRuntime' | 'localization' | 'logger' | 'notify';

export type MainProcessApplicationEnvironment = Omit<
  MainProcessApplicationDependencies,
  ConstructedDesktopDependencyKeys | RootOwnedApplicationDependencyKeys
> & {
  readonly desktopControllers: MainProcessDesktopControllerEnvironment;
};

interface ConstructedControllers extends MainProcessRuntimeFactoryControllers {
  readonly appProtocolController: AppProtocolController;
  readonly linuxDesktopIntegrationController: LinuxDesktopIntegrationController;
  readonly trayController: TrayController;
}

/**
 * Constructs one private main-process dependency graph and returns its owning
 * application. It intentionally exposes no token lookup or resolved service.
 */
export class MainProcessCompositionRoot {
  public constructor(private readonly environment: MainProcessCompositionEnvironment) {}

  /** Constructs one isolated application graph from the injected process environment. */
  public createApplication(environment: MainProcessApplicationEnvironment): MainProcessApplication {
    const { desktopControllers: desktopEnvironment, ...applicationEnvironment } = environment;
    const assetPaths = new AssetPathResolver(this.environment.assetPaths);
    const loggerFactory = new LoggerFactory(this.environment.logger);
    const electronRuntime = new ElectronRuntimeLoader({
      ...this.environment.electronRuntime,
      logger: loggerFactory.getLogger('electron-runtime'),
    });
    const cloakBrowserRuntime = new CloakBrowserRuntimeLoader({
      ...this.environment.cloakBrowserRuntime,
      logger: loggerFactory.getLogger('cloakbrowser'),
    });
    const secureStorage = {
      decrypt: electronRuntime.decryptSafeStorageString,
      encrypt: electronRuntime.encryptSafeStorageString,
      isEncryptionAvailable: electronRuntime.isSafeStorageEncryptionAvailable,
    };
    const configStore = new AppConfigStore({
      ...this.environment.config,
      logger: loggerFactory.getLogger('config'),
    });
    const database = new AppDatabaseCoordinator(configStore.paths.databaseFile, this.environment.databaseDependencies);
    const historyRepository = new SqliteTranscriptionHistoryRepository(database);
    const diagnosticRepository = new SqliteDiagnosticCaptureRepository(database);
    const diagnosticStorage = new DiagnosticCaptureStorage(diagnosticRepository, {
      logger: loggerFactory.getLogger('diagnostic-capture'),
      now: this.environment.now,
      randomUUID: this.environment.randomUUID,
      redactor: new DiagnosticTextRedactor(),
    });
    const diagnosticCaptureSettings = new DiagnosticCaptureSettingsService(configStore, diagnosticStorage);
    const diagnosticCapture = new DiagnosticCaptureService({
      logger: loggerFactory.getLogger('diagnostic-capture'),
      settings: diagnosticCaptureSettings,
      storage: diagnosticStorage,
    });
    const localization = new I18nService();
    const privateJsonRepository = new FileClaudeWebPrivateJsonRepository({
      fileSystem: this.environment.config.fileSystem,
    });
    const claudeWebSettings = new ClaudeWebSettingsRepository({
      privateJson: privateJsonRepository,
      settingsFile: configStore.paths.claudeWebSettingsFile,
    });
    const claudeWebSession = new ClaudeWebSessionRepository({
      privateJson: privateJsonRepository,
      sessionFile: configStore.paths.claudeWebSessionFile,
    });
    const openAIApiSettings = new OpenAIApiSettingsRepository({
      fileSystem: this.environment.config.fileSystem,
      logger: loggerFactory.getLogger('openai-api-settings'),
      secureStorage,
      settingsFile: configStore.paths.openAIApiSettingsFile,
    });
    const cloakBrowserSettings = new CloakBrowserSettingsRepository({
      ...this.environment.cloakBrowserSettings,
      config: configStore,
      logger: loggerFactory.getLogger('cloakbrowser-settings'),
      secureStorage,
      settingsFile: configStore.paths.cloakBrowserSettingsFile,
    });
    const prettifySettingsStorage = new PrettifySettingsStorage({
      ...this.environment.prettify.settingsStorage,
      config: configStore,
      logger: loggerFactory.getLogger('prettify-settings'),
      secureStorage,
      settingsFile: configStore.paths.prettifySettingsFile,
    });
    const voiceProviderAudit = new VoiceProviderAudit({
      ...this.environment.voice.audit,
      getSink: () => loggerFactory.getLogger('provider-audit'),
    });
    const claudeWebNavigationService = new ClaudeWebNavigationService(loggerFactory.getLogger('claude-web-provider'));
    const { chatGPT, claudeWeb, openAIApi, ...otherVoiceProviders } = this.environment.voice.providers;
    const voiceProviderFactory = new VoiceProviderFactory({
      ...otherVoiceProviders,
      audit: voiceProviderAudit,
      chatGPT: {
        ...chatGPT,
        logger: loggerFactory.getLogger('chatgpt-provider'),
        sessionStore: new FileChatGPTSessionStore({
          ...chatGPT.sessionStore,
          logger: loggerFactory.getLogger('chatgpt-provider'),
          sessionFile: configStore.paths.chatGPTSessionFile,
          tokenFile: configStore.paths.chatGPTTokenFile,
        }),
        writeClipboardText: electronRuntime.writeClipboardText,
      },
      claudeWeb: {
        ...claudeWeb,
        clearSession: claudeWebSession.clearSession,
        getSettings: claudeWebSettings.getSettings,
        getStorageState: getPlaywrightStorageState,
        navigationService: claudeWebNavigationService,
        readSession: claudeWebSession.readSession,
        resolveOrganization: resolveClaudeWebOrganization,
        saveSession: claudeWebSession.saveSession,
        writeClipboardText: electronRuntime.writeClipboardText,
      },
      localization,
      openAIApi: {
        ...openAIApi,
        getSettings: openAIApiSettings.getSettingsWithSecret,
        writeClipboardText: electronRuntime.writeClipboardText,
      },
    });
    const voiceProviderRegistry = new VoiceProviderRegistry(voiceProviderFactory, voiceProviderAudit);
    const backgroundBrowserService = new BackgroundBrowserService({
      ...this.environment.voice.browser,
      audit: voiceProviderAudit,
      cloakBrowserSettings,
      config: configStore,
      createBackgroundContext: (settings) =>
        cloakBrowserRuntime.launchPersistentContext(
          createCloakBrowserPersistentContextOptions(settings, configStore.paths.browserCacheDirectory),
        ),
      createLoginContext: (settings) =>
        cloakBrowserRuntime.launchContext(createCloakBrowserLoginContextOptions(settings)),
      localization,
      logger: loggerFactory.getLogger('browser'),
      providerRegistry: voiceProviderRegistry,
    });
    const translationProviderAudit = new TranslationProviderAudit({
      ...this.environment.translation.audit,
      getSink: () => loggerFactory.getLogger('provider-audit'),
    });
    const selectedTextActionGate = new SelectedTextActionGate();
    const textAutomation = new TextAutomationService(this.environment.textAutomation);
    const translationProviderFactory = new TranslationProviderFactory({
      ...this.environment.translation.providers,
      cloakBrowserSettings,
      createContext: cloakBrowserRuntime.launchContext,
      now: this.environment.translation.now,
    });
    const translationProviderRegistry = new TranslationProviderRegistry(
      translationProviderFactory,
      translationProviderAudit,
      this.environment.translation.now,
    );
    const translationRuntime = new TranslationRuntime({
      audit: translationProviderAudit,
      config: configStore,
      diagnosticCapture,
      localization,
      now: this.environment.translation.now,
      registry: translationProviderRegistry,
    });
    const selectedTextTranslationService = new SelectedTextTranslationService({
      ...this.environment.translation.selectedText,
      actionGate: selectedTextActionGate,
      cache: createTextActionResultCache(SELECTED_TEXT_TRANSLATION_CACHE_MAX_ENTRIES, {
        now: this.environment.cacheNow,
      }),
      clipboard: {
        readText: electronRuntime.readClipboardText,
        writeText: electronRuntime.writeTypedClipboardText,
      },
      diagnosticCapture,
      logger: loggerFactory.getLogger('selection-translate'),
      localization,
      notify: electronRuntime.showSystemNotification,
      runtime: translationRuntime,
      textAutomation,
    });
    const prettifyProviderAudit = new PrettifyProviderAudit({
      ...this.environment.prettify.audit,
      getSink: () => loggerFactory.getLogger('provider-audit'),
    });
    const cliProcessRunner = new CliProcessRunner(this.environment.prettify.cliRunner);
    const claudeCliAdapter = new ClaudeCliPrettifyAdapter({
      audit: prettifyProviderAudit,
      runner: cliProcessRunner,
    });
    const codexCliAdapter = new CodexCliPrettifyAdapter({
      ...this.environment.prettify.codexCli,
      audit: prettifyProviderAudit,
      runner: cliProcessRunner,
    });
    const prettifyProviderFactory = new PrettifyProviderFactory({
      audit: prettifyProviderAudit,
      claudeCliAdapter,
      codexCliAdapter,
      diagnosticCapture,
      fetch: this.environment.prettify.fetch,
      localization,
      settings: prettifySettingsStorage,
    });
    const prettifyProviderRegistry = new PrettifyProviderRegistry(prettifyProviderFactory);
    const prettifyRuntime = new PrettifyRuntime({
      audit: prettifyProviderAudit,
      localization,
      registry: prettifyProviderRegistry,
      settings: prettifySettingsStorage,
    });
    const selectedTextPrettifyService = new SelectedTextPrettifyService({
      ...this.environment.prettify.selectedText,
      actionGate: selectedTextActionGate,
      cache: createTextActionResultCache(SELECTED_TEXT_PRETTIFY_CACHE_MAX_ENTRIES, {
        maxAgeMs: SELECTED_TEXT_PRETTIFY_CACHE_MAX_AGE_MS,
        now: this.environment.cacheNow,
      }),
      clipboard: {
        readText: electronRuntime.readClipboardText,
        writeText: electronRuntime.writeTypedClipboardText,
      },
      diagnosticCapture,
      logger: loggerFactory.getLogger('selection-prettify'),
      localization,
      notify: electronRuntime.showSystemNotification,
      runtime: prettifyRuntime,
      settings: prettifySettingsStorage,
      textAutomation,
    });
    const windowManager = new WindowManager({
      ...desktopEnvironment.window,
      createAboutWindowController: (createWindow) => new AboutWindowController(createWindow),
      getAppIcon: () => desktopEnvironment.tray.createNativeImage(assetPaths.getAppIconPath()),
      getAppIconPath: assetPaths.getAppIconPath,
      logger: loggerFactory.getLogger('window'),
      openExternal: electronRuntime.openExternal,
      providerSettingsWindowController: new ProviderSettingsWindowController(),
    });
    const trayController = new TrayController({
      ...desktopEnvironment.tray,
      getAssetPath: assetPaths.getAssetPath,
      localization,
      windowManager,
    });
    const shortcutController = new ShortcutController({
      ...desktopEnvironment.shortcuts,
      config: configStore,
      selectedTextActionGate,
      selectedTextPrettifyService,
      selectedTextTranslationService,
      trayController,
      windowManager,
      logger: loggerFactory.getLogger('shortcuts'),
    });
    const controllers: ConstructedControllers = {
      appProtocolController: new AppProtocolController({
        ...desktopEnvironment.appProtocol,
        appIconPath: assetPaths.getAppIconPath(),
        appRoot: assetPaths.getApplicationRoot(),
        logger: loggerFactory.getLogger('app-protocol'),
      }),
      backgroundBrowserService,
      database,
      desktopRuntimeController: new DesktopRuntimeController({
        ...desktopEnvironment.desktopRuntime,
        getAppIconPath: assetPaths.getAppIconPath,
        openExternal: electronRuntime.openExternal,
        windowManager,
      }),
      linuxDesktopIntegrationController: new LinuxDesktopIntegrationController({
        ...desktopEnvironment.linuxDesktopIntegration,
        getAppIconPath: assetPaths.getAppIconPath,
        getAssetPath: assetPaths.getAssetPath,
        logger: loggerFactory.getLogger('desktop-integration'),
      }),
      diagnosticCaptureSettings,
      diagnosticStorage,
      historyRepository,
      prettifyRuntime,
      shortcutController,
      translationRuntime,
      trayController,
      voiceProviderAudit,
      voiceProviderRegistry,
      windowManager,
    };

    return new MainProcessApplication({
      ...applicationEnvironment,
      ...controllers,
      config: configStore,
      configureCloakBrowserRuntime: cloakBrowserRuntime.configure,
      localization,
      logger: loggerFactory.getRootLogger(),
      notify: electronRuntime.showSystemNotification,
      runtimeFactory: new MainProcessRuntimeFactory(
        {
          ...this.environment,
          databasePath: configStore.paths.databaseFile,
          diagnosticLogger: loggerFactory.getLogger('diagnostic-capture'),
          historyLogger: loggerFactory.getLogger('ipc'),
          ipc: {
            ...this.environment.ipc,
            cloakBrowserSettings,
            config: configStore,
            localization,
            logger: loggerFactory.getLogger('ipc'),
            notification: {
              show: electronRuntime.showSystemNotification,
            },
            prettifySettings: prettifySettingsStorage,
            voiceSettings: {
              clearOpenAIApiKey: openAIApiSettings.clearApiKey,
              getClaudeWebSettings: claudeWebSettings.getSettings,
              getOpenAIApiSettingsView: openAIApiSettings.getView,
              saveClaudeWebSettings: claudeWebSettings.save,
              saveOpenAIApiSettings: openAIApiSettings.save,
            },
          },
          localization,
          transcriptionLogger: loggerFactory.getLogger('transcribe'),
          writeClipboardText: electronRuntime.writeClipboardText,
        },
        controllers,
      ),
    });
  }
}
