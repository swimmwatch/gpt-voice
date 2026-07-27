import { AppProtocolController, type AppProtocolControllerDependencies } from '../appProtocol';
import { DesktopRuntimeController, type DesktopRuntimeControllerDependencies } from '../desktopRuntimeController';
import {
  LinuxDesktopIntegrationController,
  type LinuxDesktopIntegrationControllerDependencies,
} from '../linuxDesktopIntegration';
import { ShortcutController, type ShortcutControllerDependencies } from '../shortcuts';
import { TrayController, type TrayControllerDependencies } from '../tray';
import { WindowManager, type WindowManagerDependencies } from '../window';
import { MainProcessApplication, type MainProcessApplicationDependencies } from '../mainProcessApplication';
import {
  MainProcessRuntimeFactory,
  type MainProcessRuntimeFactoryControllers,
  type MainProcessRuntimeFactoryDependencies,
} from './mainProcessRuntimeFactory';

export type MainProcessCompositionEnvironment = MainProcessRuntimeFactoryDependencies;

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

interface ConstructedDesktopControllers extends MainProcessRuntimeFactoryControllers {
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
    const controllers: ConstructedDesktopControllers = {
      appProtocolController: new AppProtocolController(desktopEnvironment.appProtocol),
      desktopRuntimeController: new DesktopRuntimeController({
        ...desktopEnvironment.desktopRuntime,
        windowManager,
      }),
      linuxDesktopIntegrationController: new LinuxDesktopIntegrationController(
        desktopEnvironment.linuxDesktopIntegration,
      ),
      shortcutController,
      trayController,
      windowManager,
    };

    return new MainProcessApplication({
      ...applicationEnvironment,
      ...controllers,
      runtimeFactory: new MainProcessRuntimeFactory(this.environment, controllers),
    });
  }
}
