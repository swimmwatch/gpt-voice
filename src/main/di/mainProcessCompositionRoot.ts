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

export type MainProcessCompositionEnvironment = MainProcessRuntimeFactoryDependencies & {
  readonly voice: MainProcessVoiceEnvironment;
};

export interface MainProcessDesktopControllerEnvironment {
  readonly appProtocol: AppProtocolControllerDependencies;
  readonly desktopRuntime: Omit<DesktopRuntimeControllerDependencies, 'windowManager'>;
  readonly linuxDesktopIntegration: LinuxDesktopIntegrationControllerDependencies;
  readonly shortcuts: Omit<ShortcutControllerDependencies, 'trayController' | 'windowManager'>;
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
    const windowManager = new WindowManager(desktopEnvironment.window);
    const trayController = new TrayController({
      ...desktopEnvironment.tray,
      windowManager,
    });
    const shortcutController = new ShortcutController({
      ...desktopEnvironment.shortcuts,
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
      shortcutController,
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
