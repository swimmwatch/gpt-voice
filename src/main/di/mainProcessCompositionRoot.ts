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
import { ProviderHomeActionDispatcher } from '../providerHomeActionDispatcher';
import { BackgroundBrowserService, type BackgroundBrowserServiceDependencies } from '../browser';
import { VoiceProviderAudit } from '../providers/voiceProviderAudit';
import { VoiceProviderFactory, type VoiceProviderFactoryDependencies } from '../providers/voiceProviderFactory';
import { VoiceProviderRegistry } from '../providers/voiceProviderRegistry';
import { LocalWhisperCoordinator } from '../localWhisper/coordinator/LocalWhisperCoordinator';
import type { LocalWhisperCoordinatorDependencies } from '../localWhisper/coordinator/LocalWhisperCoordinatorTypes';
import { LocalWhisperCommandAudit } from '../localWhisper/audit/LocalWhisperCommandAudit';
import { LocalWhisperDiagnosticsSnapshotProvider } from '../localWhisper/diagnostics/LocalWhisperDiagnosticsSnapshotProvider';
import {
  LocalWhisperSnapshotService,
  type LocalWhisperSnapshotFactsPort,
} from '../localWhisper/ipc/LocalWhisperSnapshotService';
import {
  LocalWhisperIpcController,
  type LocalWhisperArtifactCommandPort,
  type LocalWhisperArtifactReferencePort,
  type LocalWhisperManagedFolderPort,
} from '../localWhisper/ipc/LocalWhisperIpcController';
import { LocalWhisperModelLoadFailureNotifier } from '../localWhisper/ipc/LocalWhisperModelLoadFailureNotifier';
import { ElectronLocalWhisperSenderAuthority } from '../localWhisper/ipc/ElectronLocalWhisperSenderAuthority';
import { ClaudeWebNavigationService } from '../providers/claudeWebNavigationService';
import { PROVIDER_AUDIT_SCHEMA_VERSION, type ProviderAuditDependencies } from '../providerAudit';
import { FileChatGPTSessionStore, type FileChatGPTSessionStoreDependencies } from '../providers/chatgptSessionStore';
import type { ChatGPTVoiceProviderDependencies } from '../providers/ChatGPTVoiceProvider';
import {
  TranslationProviderFactory,
  TranslationProviderRegistry,
  type TranslationProviderFactoryDependencies,
} from '../translateProviders';
import { TranslationBrowserResourceCoordinator } from '../translateProviders/TranslationBrowserResourceCoordinator';
import {
  TranslationOperationLifecycleFactory,
  type TranslationOperationLifecycleDependencies,
} from '../translateProviders/translationOperationLifecycle';
import { TranslationProviderAudit } from '../translateProviders/translationProviderAudit';
import { TranslationRuntime } from '../services/translation';
import { CloakBrowserSettingsResetService } from '../services/cloakBrowserSettingsReset';
import { DiagnosticCaptureService } from '../services/diagnosticCapture';
import { DiagnosticCaptureSettingsService } from '../services/diagnosticCaptureSettings';
import { DiagnosticCaptureStorage } from '../services/diagnosticCaptureStorage';
import { DIAGNOSTIC_REDACTOR_VERSION, DiagnosticTextRedactor } from '../services/diagnosticTextRedactor';
import {
  DiagnosticsArchiveJsonlSerializer,
  DiagnosticsArchiveService,
  ProviderAuditLogExtractor,
  type DiagnosticsArchiveFileSystem,
} from '../services/diagnosticsArchive';
import { NativeRuntimeLogArchiveExtractor } from '../services/nativeRuntimeLogArchive';
import {
  ArchiverDiagnosticsArchiveWriterFactory,
  DiagnosticsArchiveFormatAdapter,
  type DiagnosticsArchiveFormatFileSystem,
} from '../services/diagnosticsArchiveFormat';
import {
  DiagnosticsEnvironmentSnapshotProvider,
  DiagnosticsManifestBuilder,
  type DiagnosticsRuntimeVersions,
} from '../services/diagnosticsManifest';
import { DiagnosticsExportService, type DiagnosticsExportServiceDependencies } from '../services/diagnosticsExport';
import {
  PrettifyProfilePortabilityService,
  type PrettifyProfilePortabilityServiceDependencies,
} from '../services/prettifyProfilePortability';
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
import type { InitialProviderReadinessDeadlineDependencies } from '../services/initialProviderReadinessDeadline';
import { PrettifyHttpReadiness, type PrettifyHttpReadinessDependencies } from '../services/prettifyHttpReadiness';
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
import { MainInteractionLock } from '@shared/mainInteractionLock';
import {
  CloakBrowserSettingsRepository,
  type CloakBrowserSettingsRepositoryDependencies,
} from '../cloakBrowserSettings';
import { PrettifySettingsStorage, type PrettifySettingsStorageDependencies } from '../services/prettifySettingsStorage';
import { LoggerFactory, type LoggerFactoryDependencies } from '../logger';
import { NativeRuntimeLogForwarder } from '../localWhisper/supervisor/NativeRuntimeLogStreamDecoder';
import { ElectronRuntimeLoader, type ElectronRuntimeLoaderDependencies } from '../electronRuntime';
import { CloakBrowserRuntimeLoader, type CloakBrowserRuntimeLoaderDependencies } from '../cloakbrowser';
import { FirstLaunchStartupCoordinator } from '../firstLaunchStartupCoordinator';
import { FIRST_LAUNCH_STARTUP_JOB_IDS } from '@shared/firstLaunchStartup';
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
import { APP_DATABASE_SCHEMA_VERSION, AppDatabaseCoordinator } from '../repositories/sqlite/appDatabase';
import { SqliteDiagnosticCaptureRepository } from '../repositories/sqlite/sqliteDiagnosticCaptureRepository';
import { SqliteTranscriptionHistoryRepository } from '../repositories/sqlite/sqliteTranscriptionHistoryRepository';
import { DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION } from '@shared/diagnosticsArchive';
import {
  PrettifyProfileChooserWindowController,
  type PrettifyProfileChooserWindowControllerDependencies,
} from '../prettifyProfileChooserWindowController';

export type MainProcessVoiceProviderEnvironment = Omit<
  VoiceProviderFactoryDependencies,
  'audit' | 'chatGPT' | 'claudeWeb' | 'localWhisper' | 'localization' | 'openAIApi'
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
    | 'readinessDeadline'
  >;
  readonly providers: MainProcessVoiceProviderEnvironment;
}

export interface MainProcessLocalWhisperEnvironment {
  readonly coordinator: LocalWhisperCoordinatorDependencies;
  readonly facts: LocalWhisperSnapshotFactsPort;
  readonly artifacts: LocalWhisperArtifactCommandPort;
  readonly managedFolder: LocalWhisperManagedFolderPort;
  readonly nativeRuntimeLogRelay?: import('../localWhisper/supervisor/NativeRuntimeLogStreamDecoder').NativeRuntimeLogRelay;
  readonly references: LocalWhisperArtifactReferencePort;
  readonly refreshDevices: (configurationEpoch: number) => Promise<void>;
  readonly dispose: () => Promise<void>;
}

export interface MainProcessTranslationEnvironment {
  readonly audit: Omit<ProviderAuditDependencies, 'getSink'>;
  readonly lifecycle: TranslationOperationLifecycleDependencies;
  readonly now: () => number;
  readonly providers: Omit<
    TranslationProviderFactoryDependencies,
    'browserResources' | 'cloakBrowserSettings' | 'createContext' | 'now'
  >;
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
  readonly httpReadiness: Omit<PrettifyHttpReadinessDependencies, 'audit' | 'fetch'>;
  readonly settingsStorage: Omit<
    PrettifySettingsStorageDependencies,
    'config' | 'logger' | 'secureStorage' | 'settingsFile'
  >;
  readonly selectedText: Omit<
    SelectedTextPrettifyDependencies,
    | 'actionGate'
    | 'cache'
    | 'chooser'
    | 'clipboard'
    | 'diagnosticCapture'
    | 'localization'
    | 'logger'
    | 'notify'
    | 'openProfileManagement'
    | 'profileCatalog'
    | 'runtime'
    | 'textAutomation'
  >;
}

export interface MainProcessDiagnosticsArchiveEnvironment {
  readonly architecture: string;
  readonly fileSystem: DiagnosticsArchiveFileSystem & DiagnosticsArchiveFormatFileSystem;
  readonly getAppVersion: () => string;
  readonly hash: (payload: Buffer) => string;
  readonly platform: NodeJS.Platform;
  readonly runtimeVersions: DiagnosticsRuntimeVersions;
}

export type MainProcessDiagnosticsExportEnvironment = Omit<
  DiagnosticsExportServiceDependencies,
  'archive' | 'localization' | 'logger' | 'notification' | 'now'
>;

export type MainProcessPrettifyProfilePortabilityEnvironment = Pick<
  PrettifyProfilePortabilityServiceDependencies,
  'dialog' | 'fileSystem'
>;

type RootOwnedRuntimeDependencyKeys =
  | 'databasePath'
  | 'diagnosticLogger'
  | 'historyLogger'
  | 'ipc'
  | 'mainInteractionLock'
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
    'config' | 'logger' | 'secureStorage' | 'settingsFile' | 'writeFileAtomically'
  >;
  readonly config: Omit<AppConfigStoreDependencies, 'generatePrettifyProfileUuid' | 'logger'> & {
    readonly fileSystem: AppConfigStoreDependencies['fileSystem'] &
      FileClaudeWebPrivateJsonRepositoryDependencies['fileSystem'] &
      OpenAIApiSettingsRepositoryDependencies['fileSystem'];
  };
  readonly diagnosticsArchive: MainProcessDiagnosticsArchiveEnvironment;
  readonly diagnosticsExport: MainProcessDiagnosticsExportEnvironment;
  readonly prettifyProfilePortability: MainProcessPrettifyProfilePortabilityEnvironment;
  readonly electronRuntime: Omit<ElectronRuntimeLoaderDependencies, 'logger'>;
  readonly ipc: Omit<
    MainProcessRuntimeFactoryDependencies['ipc'],
    | 'cloakBrowserSettings'
    | 'config'
    | 'localization'
    | 'logger'
    | 'mainInteractionLock'
    | 'notification'
    | 'prettifySettings'
    | 'voiceSettings'
  >;
  readonly initialProviderReadiness: InitialProviderReadinessDeadlineDependencies;
  readonly logger: LoggerFactoryDependencies;
  readonly localWhisper: MainProcessLocalWhisperEnvironment;
  readonly prettify: MainProcessPrettifyEnvironment;
  readonly textAutomation: TextAutomationServiceDependencies;
  readonly translation: MainProcessTranslationEnvironment;
  readonly voice: MainProcessVoiceEnvironment;
};

export interface MainProcessDesktopControllerEnvironment {
  readonly appProtocol: Omit<AppProtocolControllerDependencies, 'appIconPath' | 'appRoot' | 'logger'>;
  readonly desktopRuntime: Omit<
    DesktopRuntimeControllerDependencies,
    'getAppIconPath' | 'localization' | 'openExternal' | 'windowManager'
  >;
  readonly linuxDesktopIntegration: Omit<
    LinuxDesktopIntegrationControllerDependencies,
    'getAppIconPath' | 'getAssetPath' | 'logger'
  >;
  readonly prettifyProfileChooser: Pick<PrettifyProfileChooserWindowControllerDependencies, 'preloadPath' | 'screen'>;
  readonly shortcuts: Omit<
    ShortcutControllerDependencies,
    | 'selectedTextActionGate'
    | 'selectedTextPrettifyService'
    | 'selectedTextTranslationService'
    | 'trayController'
    | 'voiceRecordingProviderReadiness'
    | 'windowManager'
    | 'config'
    | 'localization'
    | 'logger'
    | 'mainInteractionLock'
    | 'notification'
    | 'providerHomeActionDispatcher'
    | 'prettifyRuntime'
  >;
  readonly tray: Omit<
    TrayControllerDependencies,
    'getAssetPath' | 'localization' | 'mainInteractionLock' | 'windowManager'
  >;
  readonly window: Omit<
    WindowManagerDependencies,
    | 'createAboutWindowController'
    | 'getAppIcon'
    | 'getAppIconPath'
    | 'localization'
    | 'logger'
    | 'mainInteractionLock'
    | 'openExternal'
    | 'providerSettingsWindowController'
  >;
}

type ConstructedDesktopDependencyKeys =
  | 'appProtocolController'
  | 'backgroundBrowserService'
  | 'desktopRuntimeController'
  | 'firstLaunchStartupCoordinator'
  | 'linuxDesktopIntegrationController'
  | 'prettifyProfileChooserWindow'
  | 'providerHomeActionDispatcher'
  | 'runtimeFactory'
  | 'selectedTextPrettifyService'
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
  readonly selectedTextPrettifyService: SelectedTextPrettifyService;
  readonly providerHomeActionDispatcher: ProviderHomeActionDispatcher;
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
    this.environment.localWhisper.nativeRuntimeLogRelay?.attach(
      new NativeRuntimeLogForwarder({
        logger: loggerFactory.getLogger('local-whisper-native-runtime'),
        now: this.environment.now,
      }),
    );
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
      generatePrettifyProfileUuid: this.environment.randomUUID,
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
      writeFileAtomically: this.environment.config.writeFileAtomically,
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
    const localWhisperCoordinator = new LocalWhisperCoordinator(this.environment.localWhisper.coordinator);
    const localWhisperSnapshots = new LocalWhisperSnapshotService(
      localWhisperCoordinator,
      this.environment.localWhisper.facts,
    );
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
      localWhisper: {
        coordinator: localWhisperCoordinator,
      },
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
      readinessDeadline: this.environment.initialProviderReadiness,
    });
    const diagnosticsArchive = new DiagnosticsArchiveService({
      environment: new DiagnosticsEnvironmentSnapshotProvider({
        architecture: this.environment.diagnosticsArchive.architecture,
        backgroundBrowser: backgroundBrowserService,
        config: configStore,
        getAppVersion: this.environment.diagnosticsArchive.getAppVersion,
        platform: this.environment.diagnosticsArchive.platform,
        runtimeVersions: this.environment.diagnosticsArchive.runtimeVersions,
      }),
      fileSystem: this.environment.diagnosticsArchive.fileSystem,
      formatAdapter: new DiagnosticsArchiveFormatAdapter({
        fileSystem: this.environment.diagnosticsArchive.fileSystem,
        platform: this.environment.diagnosticsArchive.platform,
        writerFactory: new ArchiverDiagnosticsArchiveWriterFactory(),
      }),
      jsonl: new DiagnosticsArchiveJsonlSerializer(),
      logs: new ProviderAuditLogExtractor(loggerFactory.getMainLogFileAccessor()),
      nativeLogs: new NativeRuntimeLogArchiveExtractor(loggerFactory.getMainLogFileAccessor()),
      localWhisperSnapshot: new LocalWhisperDiagnosticsSnapshotProvider({
        now: this.environment.now,
        snapshots: localWhisperSnapshots,
      }),
      manifest: new DiagnosticsManifestBuilder({
        databaseSchemaVersion: APP_DATABASE_SCHEMA_VERSION,
        diagnosticRowSchemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
        hash: this.environment.diagnosticsArchive.hash,
        providerAuditSchemaVersion: PROVIDER_AUDIT_SCHEMA_VERSION,
        redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
      }),
      now: this.environment.now,
      platform: this.environment.diagnosticsArchive.platform,
      randomUUID: this.environment.randomUUID,
      settings: diagnosticCaptureSettings,
      storage: diagnosticStorage,
    });
    const translationProviderAudit = new TranslationProviderAudit({
      ...this.environment.translation.audit,
      getSink: () => loggerFactory.getLogger('provider-audit'),
    });
    const translationOperationLifecycleFactory = new TranslationOperationLifecycleFactory(
      this.environment.translation.lifecycle,
    );
    const selectedTextActionGate = new SelectedTextActionGate();
    const textAutomation = new TextAutomationService(this.environment.textAutomation);
    const translationBrowserResources = new TranslationBrowserResourceCoordinator({
      cloakBrowserSettings,
      createContext: cloakBrowserRuntime.launchContext,
      createContextOptions: this.environment.translation.providers.createContextOptions,
    });
    const translationProviderFactory = new TranslationProviderFactory({
      ...this.environment.translation.providers,
      browserResources: translationBrowserResources,
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
      operationLifecycleFactory: translationOperationLifecycleFactory,
      readinessDeadline: this.environment.initialProviderReadiness,
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
    const prettifyHttpReadiness = new PrettifyHttpReadiness({
      ...this.environment.prettify.httpReadiness,
      audit: prettifyProviderAudit,
      fetch: this.environment.prettify.fetch,
    });
    const prettifyProviderFactory = new PrettifyProviderFactory({
      audit: prettifyProviderAudit,
      claudeCliAdapter,
      codexCliAdapter,
      diagnosticCapture,
      fetch: this.environment.prettify.fetch,
      localization,
      readiness: prettifyHttpReadiness,
      settings: prettifySettingsStorage,
    });
    const prettifyProviderRegistry = new PrettifyProviderRegistry(prettifyProviderFactory);
    const prettifyRuntime = new PrettifyRuntime({
      audit: prettifyProviderAudit,
      localization,
      registry: prettifyProviderRegistry,
      settings: prettifySettingsStorage,
    });
    const mainInteractionLock = new MainInteractionLock(() => selectedTextActionGate.getActive() !== null);
    const windowManager = new WindowManager({
      ...desktopEnvironment.window,
      createAboutWindowController: (createWindow) => new AboutWindowController(createWindow),
      getAppIcon: () => desktopEnvironment.tray.createNativeImage(assetPaths.getAppIconPath()),
      getAppIconPath: assetPaths.getAppIconPath,
      localization,
      logger: loggerFactory.getLogger('window'),
      mainInteractionLock,
      openExternal: electronRuntime.openExternal,
      providerSettingsWindowController: new ProviderSettingsWindowController(),
    });
    const localWhisperIpcController = new LocalWhisperIpcController({
      audit: new LocalWhisperCommandAudit(voiceProviderAudit),
      transport: this.environment.ipc.ipc,
      authority: new ElectronLocalWhisperSenderAuthority(windowManager),
      coordinator: localWhisperCoordinator,
      artifacts: this.environment.localWhisper.artifacts,
      mainInteractionLock,
      modelLoadFailureNotifier: new LocalWhisperModelLoadFailureNotifier({
        localization,
        logger: loggerFactory.getLogger('local-whisper-notification'),
        notification: { show: electronRuntime.showSystemNotification },
      }),
      managedFolder: this.environment.localWhisper.managedFolder,
      references: this.environment.localWhisper.references,
      refreshSettingsFacts: this.environment.localWhisper.refreshDevices,
      snapshots: localWhisperSnapshots,
      getActiveProviderId: () => configStore.getSnapshot().provider,
      openSettings: () =>
        windowManager.showProviderSettingsWindow(
          'local-whisper',
          localization.translate('providerSettings.title', { provider: 'Local Whisper' }),
        ),
    });
    const prettifyProfileChooserWindow = new PrettifyProfileChooserWindowController({
      ...desktopEnvironment.prettifyProfileChooser,
      createBrowserWindow: desktopEnvironment.window.createBrowserWindow,
      getAppIconPath: assetPaths.getAppIconPath,
      getAppUrl: desktopEnvironment.window.getAppUrl,
      localization,
      logger: loggerFactory.getLogger('prettify-profile-chooser'),
      openExternal: electronRuntime.openExternal,
      randomUUID: this.environment.randomUUID,
    });
    const selectedTextPrettifyService = new SelectedTextPrettifyService({
      ...this.environment.prettify.selectedText,
      actionGate: selectedTextActionGate,
      cache: createTextActionResultCache(SELECTED_TEXT_PRETTIFY_CACHE_MAX_ENTRIES, {
        maxAgeMs: SELECTED_TEXT_PRETTIFY_CACHE_MAX_AGE_MS,
        now: this.environment.cacheNow,
      }),
      chooser: prettifyProfileChooserWindow,
      clipboard: {
        readText: electronRuntime.readClipboardText,
        writeText: electronRuntime.writeTypedClipboardText,
      },
      diagnosticCapture,
      logger: loggerFactory.getLogger('selection-prettify'),
      localization,
      notify: electronRuntime.showSystemNotification,
      openProfileManagement: () => windowManager.showSettingsWindow('prettify'),
      profileCatalog: configStore,
      runtime: prettifyRuntime,
      textAutomation,
    });
    translationRuntime.subscribeConnectionState(windowManager.publishTranslationProviderConnectionState);
    const cloakBrowserSettingsReset = new CloakBrowserSettingsResetService({
      backgroundBrowser: backgroundBrowserService,
      getVoiceProviderId: () => configStore.getSnapshot().provider,
      localization,
      logger: loggerFactory.getLogger('cloakbrowser-settings'),
      publishBackgroundStatus: (status, fallbackProviderId) =>
        windowManager.publishBackgroundStatus(status, fallbackProviderId),
      readinessDeadline: this.environment.initialProviderReadiness,
      settings: cloakBrowserSettings,
      translation: translationRuntime,
    });
    const diagnosticsExport = new DiagnosticsExportService({
      ...this.environment.diagnosticsExport,
      archive: diagnosticsArchive,
      localization,
      logger: loggerFactory.getLogger('diagnostics-export'),
      notification: {
        show: electronRuntime.showSystemNotification,
      },
      now: this.environment.now,
    });
    const prettifyProfilePortability = new PrettifyProfilePortabilityService({
      ...this.environment.prettifyProfilePortability,
      allocateCustomProfileId: (additionalForbiddenIds) =>
        configStore.allocatePrettifyCustomProfileId(additionalForbiddenIds),
      localization,
      logger: loggerFactory.getLogger('prettify-profile-portability'),
      notification: {
        show: electronRuntime.showSystemNotification,
      },
    });
    const trayController = new TrayController({
      ...desktopEnvironment.tray,
      getAssetPath: assetPaths.getAssetPath,
      localization,
      mainInteractionLock,
      windowManager,
    });
    const shortcutControllerReference: { current: ShortcutController | null } = { current: null };
    const providerHomeActionDispatcher = new ProviderHomeActionDispatcher({
      config: configStore,
      getRecordingLifecycleState: () =>
        shortcutControllerReference.current?.getRecordingState().lifecycleState ?? 'idle',
      localization,
      logger: loggerFactory.getLogger('provider-home-actions'),
      mainInteractionLock,
      notification: {
        show: electronRuntime.showSystemNotification,
      },
      prettifyRuntime,
      selectedTextActionGate,
      selectedTextPrettifyService,
      selectedTextTranslationService,
      trayController,
      windowManager,
    });
    const shortcutController = new ShortcutController({
      ...desktopEnvironment.shortcuts,
      config: configStore,
      localization,
      notification: {
        show: electronRuntime.showSystemNotification,
      },
      prettifyRuntime,
      providerHomeActionDispatcher,
      selectedTextActionGate,
      selectedTextPrettifyService,
      selectedTextTranslationService,
      trayController,
      voiceRecordingProviderReadiness: backgroundBrowserService,
      windowManager,
      logger: loggerFactory.getLogger('shortcuts'),
      mainInteractionLock,
    });
    shortcutControllerReference.current = shortcutController;
    const firstLaunchStartupCoordinator = new FirstLaunchStartupCoordinator({
      jobRunners: [
        {
          id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
          run: cloakBrowserRuntime.prepare,
        },
        {
          dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
          id: FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider,
          isRequired: () => configStore.getSnapshot().provider !== null,
          run: async () => {
            const providerId = configStore.getSnapshot().provider;
            if (providerId === null) return { failureCode: null, success: true };
            const status = await backgroundBrowserService.initialize();
            windowManager.publishBackgroundStatus(status, providerId);
            return { failureCode: null, success: true };
          },
        },
        {
          dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
          id: FIRST_LAUNCH_STARTUP_JOB_IDS.Translation,
          run: async () => {
            await translationRuntime.initializeSelectedProvider();
            return { failureCode: null, success: true };
          },
        },
      ],
    });
    const controllers: ConstructedControllers = {
      appProtocolController: new AppProtocolController({
        ...desktopEnvironment.appProtocol,
        appIconPath: assetPaths.getAppIconPath(),
        appRoot: assetPaths.getApplicationRoot(),
        logger: loggerFactory.getLogger('app-protocol'),
      }),
      backgroundBrowserService,
      cloakBrowserSettingsReset,
      database,
      desktopRuntimeController: new DesktopRuntimeController({
        ...desktopEnvironment.desktopRuntime,
        getAppIconPath: assetPaths.getAppIconPath,
        localization,
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
      diagnosticsArchive,
      diagnosticsExport,
      firstLaunchStartupCoordinator,
      historyRepository,
      localWhisperCoordinator,
      localWhisperEnvironmentDispose: this.environment.localWhisper.dispose,
      localWhisperIpcController,
      localWhisperSnapshots,
      mainInteractionLock,
      prettifyProfileChooserWindow,
      prettifyProfilePortability,
      prettifyRuntime,
      providerHomeActionDispatcher,
      selectedTextPrettifyService,
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
