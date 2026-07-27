import { AppProtocolController, type AppProtocolControllerDependencies } from '../appProtocol';
import { DesktopRuntimeController, type DesktopRuntimeControllerDependencies } from '../desktopRuntimeController';
import {
  LinuxDesktopIntegrationController,
  type LinuxDesktopIntegrationControllerDependencies,
} from '../linuxDesktopIntegration';
import { ShortcutController, type ShortcutControllerDependencies } from '../shortcuts';
import { TrayController, type TrayControllerDependencies } from '../tray';
import { WindowManager, type WindowManagerDependencies } from '../window';
import { BackgroundBrowserService, type BackgroundBrowserServiceDependencies } from '../browser';
import { VoiceProviderAudit } from '../providers/voiceProviderAudit';
import { VoiceProviderFactory, type VoiceProviderFactoryDependencies } from '../providers/voiceProviderFactory';
import { VoiceProviderRegistry } from '../providers/voiceProviderRegistry';
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
import { AppConfigStore, type AppConfigStoreDependencies } from '../config';
import { I18nService } from '../i18n';
import {
  CloakBrowserSettingsRepository,
  type CloakBrowserSettingsRepositoryDependencies,
} from '../cloakBrowserSettings';
import { PrettifySettingsStorage, type PrettifySettingsStorageDependencies } from '../services/prettifySettingsStorage';

export type MainProcessVoiceProviderEnvironment = Omit<
  VoiceProviderFactoryDependencies,
  'audit' | 'chatGPT' | 'localization'
> & {
  readonly chatGPT: Omit<ChatGPTVoiceProviderDependencies, 'audit' | 'localization' | 'sessionStore'> & {
    readonly sessionStore: FileChatGPTSessionStoreDependencies;
  };
};
import { MainProcessApplication, type MainProcessApplicationDependencies } from '../mainProcessApplication';
import {
  MainProcessRuntimeFactory,
  type MainProcessRuntimeFactoryControllers,
  type MainProcessRuntimeFactoryDependencies,
} from './mainProcessRuntimeFactory';

export interface MainProcessVoiceEnvironment {
  readonly audit: ProviderAuditDependencies;
  readonly browser: Omit<
    BackgroundBrowserServiceDependencies,
    'audit' | 'cloakBrowserSettings' | 'config' | 'localization' | 'providerRegistry'
  >;
  readonly providers: MainProcessVoiceProviderEnvironment;
}

export interface MainProcessTranslationEnvironment {
  readonly audit: ProviderAuditDependencies;
  readonly now: () => number;
  readonly providers: Omit<TranslationProviderFactoryDependencies, 'cloakBrowserSettings' | 'now'>;
  readonly selectedText: Omit<SelectedTextTranslationDependencies, 'actionGate' | 'cache' | 'localization' | 'runtime'>;
}

export interface MainProcessPrettifyEnvironment {
  readonly audit: ProviderAuditDependencies;
  readonly cliRunner: CliProcessRunnerDependencies;
  readonly codexCli: Omit<CodexCliPrettifyAdapterDependencies, 'audit' | 'runner'>;
  readonly fetch: PrettifyProviderFactoryDependencies['fetch'];
  readonly settingsStorage: Omit<PrettifySettingsStorageDependencies, 'config' | 'settingsFile'>;
  readonly selectedText: Omit<
    SelectedTextPrettifyDependencies,
    'actionGate' | 'cache' | 'localization' | 'runtime' | 'settings'
  >;
}

type RootOwnedRuntimeDependencyKeys = 'databasePath' | 'ipc' | 'localization';

export type MainProcessCompositionEnvironment = Omit<
  MainProcessRuntimeFactoryDependencies,
  RootOwnedRuntimeDependencyKeys
> & {
  readonly cloakBrowserSettings: Omit<CloakBrowserSettingsRepositoryDependencies, 'config' | 'settingsFile'>;
  readonly config: AppConfigStoreDependencies;
  readonly ipc: Omit<
    MainProcessRuntimeFactoryDependencies['ipc'],
    'cloakBrowserSettings' | 'config' | 'localization' | 'prettifySettings'
  >;
  readonly prettify: MainProcessPrettifyEnvironment;
  readonly translation: MainProcessTranslationEnvironment;
  readonly voice: MainProcessVoiceEnvironment;
};

export interface MainProcessDesktopControllerEnvironment {
  readonly appProtocol: AppProtocolControllerDependencies;
  readonly desktopRuntime: Omit<DesktopRuntimeControllerDependencies, 'windowManager'>;
  readonly linuxDesktopIntegration: LinuxDesktopIntegrationControllerDependencies;
  readonly shortcuts: Omit<
    ShortcutControllerDependencies,
    | 'selectedTextActionGate'
    | 'selectedTextPrettifyService'
    | 'selectedTextTranslationService'
    | 'trayController'
    | 'windowManager'
    | 'config'
  >;
  readonly tray: Omit<TrayControllerDependencies, 'localization' | 'windowManager'>;
  readonly window: WindowManagerDependencies;
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

type RootOwnedApplicationDependencyKeys = 'config' | 'localization' | 'notify';

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
    const configStore = new AppConfigStore(this.environment.config);
    const localization = new I18nService();
    const cloakBrowserSettings = new CloakBrowserSettingsRepository({
      ...this.environment.cloakBrowserSettings,
      config: configStore,
      settingsFile: configStore.paths.cloakBrowserSettingsFile,
    });
    const prettifySettingsStorage = new PrettifySettingsStorage({
      ...this.environment.prettify.settingsStorage,
      config: configStore,
      settingsFile: configStore.paths.prettifySettingsFile,
    });
    const voiceProviderAudit = new VoiceProviderAudit(this.environment.voice.audit);
    const { chatGPT, ...otherVoiceProviders } = this.environment.voice.providers;
    const voiceProviderFactory = new VoiceProviderFactory({
      ...otherVoiceProviders,
      audit: voiceProviderAudit,
      chatGPT: {
        ...chatGPT,
        sessionStore: new FileChatGPTSessionStore(chatGPT.sessionStore),
      },
      localization,
    });
    const voiceProviderRegistry = new VoiceProviderRegistry(voiceProviderFactory, voiceProviderAudit);
    const backgroundBrowserService = new BackgroundBrowserService({
      ...this.environment.voice.browser,
      audit: voiceProviderAudit,
      cloakBrowserSettings,
      config: configStore,
      localization,
      providerRegistry: voiceProviderRegistry,
    });
    const translationProviderAudit = new TranslationProviderAudit(this.environment.translation.audit);
    const selectedTextActionGate = new SelectedTextActionGate();
    const translationProviderFactory = new TranslationProviderFactory({
      ...this.environment.translation.providers,
      cloakBrowserSettings,
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
      localization,
      runtime: translationRuntime,
    });
    const prettifyProviderAudit = new PrettifyProviderAudit(this.environment.prettify.audit);
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
      localization,
      runtime: prettifyRuntime,
      settings: prettifySettingsStorage,
    });
    const windowManager = new WindowManager(desktopEnvironment.window);
    const trayController = new TrayController({
      ...desktopEnvironment.tray,
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
    });
    const controllers: ConstructedControllers = {
      appProtocolController: new AppProtocolController(desktopEnvironment.appProtocol),
      backgroundBrowserService,
      desktopRuntimeController: new DesktopRuntimeController({
        ...desktopEnvironment.desktopRuntime,
        windowManager,
      }),
      linuxDesktopIntegrationController: new LinuxDesktopIntegrationController(
        desktopEnvironment.linuxDesktopIntegration,
      ),
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
      localization,
      notify: this.environment.ipc.notification.show.bind(this.environment.ipc.notification),
      runtimeFactory: new MainProcessRuntimeFactory(
        {
          ...this.environment,
          databasePath: configStore.paths.databaseFile,
          ipc: {
            ...this.environment.ipc,
            cloakBrowserSettings,
            config: configStore,
            localization,
            prettifySettings: prettifySettingsStorage,
          },
          localization,
        },
        controllers,
      ),
    });
  }
}
