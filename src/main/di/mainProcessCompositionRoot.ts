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
import { TranslationRuntime, type TranslationRuntimeDependencies } from '../services/translation';
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

export type MainProcessVoiceProviderEnvironment = Omit<VoiceProviderFactoryDependencies, 'audit' | 'chatGPT'> & {
  readonly chatGPT: Omit<ChatGPTVoiceProviderDependencies, 'audit' | 'sessionStore'> & {
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
  readonly browser: Omit<BackgroundBrowserServiceDependencies, 'audit' | 'providerRegistry'>;
  readonly providers: MainProcessVoiceProviderEnvironment;
}

export interface MainProcessTranslationEnvironment {
  readonly audit: ProviderAuditDependencies;
  readonly getSettings: TranslationRuntimeDependencies['getSettings'];
  readonly now: () => number;
  readonly providers: Omit<TranslationProviderFactoryDependencies, 'now'>;
  readonly selectedText: Omit<SelectedTextTranslationDependencies, 'actionGate' | 'cache' | 'runtime'>;
}

export interface MainProcessPrettifyEnvironment {
  readonly audit: ProviderAuditDependencies;
  readonly cliRunner: CliProcessRunnerDependencies;
  readonly codexCli: Omit<CodexCliPrettifyAdapterDependencies, 'audit' | 'runner'>;
  readonly fetch: PrettifyProviderFactoryDependencies['fetch'];
  readonly getSettingsWithSecret: PrettifyProviderFactoryDependencies['getSettingsWithSecret'];
  readonly selectedText: Omit<SelectedTextPrettifyDependencies, 'actionGate' | 'cache' | 'runtime'>;
}

export type MainProcessCompositionEnvironment = MainProcessRuntimeFactoryDependencies & {
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
  >;
  readonly tray: Omit<TrayControllerDependencies, 'windowManager'>;
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

export type MainProcessApplicationEnvironment = Omit<
  MainProcessApplicationDependencies,
  ConstructedDesktopDependencyKeys
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
    const voiceProviderAudit = new VoiceProviderAudit(this.environment.voice.audit);
    const { chatGPT, ...otherVoiceProviders } = this.environment.voice.providers;
    const voiceProviderFactory = new VoiceProviderFactory({
      ...otherVoiceProviders,
      audit: voiceProviderAudit,
      chatGPT: {
        ...chatGPT,
        sessionStore: new FileChatGPTSessionStore(chatGPT.sessionStore),
      },
    });
    const voiceProviderRegistry = new VoiceProviderRegistry(voiceProviderFactory, voiceProviderAudit);
    const backgroundBrowserService = new BackgroundBrowserService({
      ...this.environment.voice.browser,
      audit: voiceProviderAudit,
      providerRegistry: voiceProviderRegistry,
    });
    const translationProviderAudit = new TranslationProviderAudit(this.environment.translation.audit);
    const selectedTextActionGate = new SelectedTextActionGate();
    const translationProviderFactory = new TranslationProviderFactory({
      ...this.environment.translation.providers,
      now: this.environment.translation.now,
    });
    const translationProviderRegistry = new TranslationProviderRegistry(
      translationProviderFactory,
      translationProviderAudit,
      this.environment.translation.now,
    );
    const translationRuntime = new TranslationRuntime({
      audit: translationProviderAudit,
      getSettings: this.environment.translation.getSettings,
      now: this.environment.translation.now,
      registry: translationProviderRegistry,
    });
    const selectedTextTranslationService = new SelectedTextTranslationService({
      ...this.environment.translation.selectedText,
      actionGate: selectedTextActionGate,
      cache: createTextActionResultCache(SELECTED_TEXT_TRANSLATION_CACHE_MAX_ENTRIES, {
        now: this.environment.cacheNow,
      }),
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
      getSettingsWithSecret: this.environment.prettify.getSettingsWithSecret,
    });
    const prettifyProviderRegistry = new PrettifyProviderRegistry(prettifyProviderFactory);
    const prettifyRuntime = new PrettifyRuntime({
      audit: prettifyProviderAudit,
      getSettingsWithSecret: this.environment.prettify.getSettingsWithSecret,
      registry: prettifyProviderRegistry,
    });
    const selectedTextPrettifyService = new SelectedTextPrettifyService({
      ...this.environment.prettify.selectedText,
      actionGate: selectedTextActionGate,
      cache: createTextActionResultCache(SELECTED_TEXT_PRETTIFY_CACHE_MAX_ENTRIES, {
        maxAgeMs: SELECTED_TEXT_PRETTIFY_CACHE_MAX_AGE_MS,
        now: this.environment.cacheNow,
      }),
      runtime: prettifyRuntime,
    });
    const windowManager = new WindowManager(desktopEnvironment.window);
    const trayController = new TrayController({
      ...desktopEnvironment.tray,
      windowManager,
    });
    const shortcutController = new ShortcutController({
      ...desktopEnvironment.shortcuts,
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
      runtimeFactory: new MainProcessRuntimeFactory(this.environment, controllers),
    });
  }
}
