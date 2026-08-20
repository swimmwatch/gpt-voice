import type { AboutPanelOptionsOptions, Menu, MenuItemConstructorOptions, Session } from 'electron';
import { APP_COPYRIGHT, APP_ID, APP_NAME, APP_WEBSITE, createAppInfo } from './appMetadata';
import type { I18nService } from './i18n';
import type { WindowManager } from './window';
import type { AppInfo } from '@shared/appInfo';

const CHROMIUM_FATAL_LOG_LEVEL = '3';
const STARTUP_BENCHMARK_READY_MARKER = 'GPT_VOICE_STARTUP_READY';
const STARTUP_BENCHMARK_POLL_INTERVAL_MS = 25;
const STARTUP_BENCHMARK_ARGUMENT = '--startup-benchmark';
const STARTUP_BENCHMARK_RENDERER_MOUNT_QUERY = "document.getElementById('window-startup-content') !== null";
const REMOVE_LINUX_DESKTOP_INTEGRATION_ARGUMENT = '--remove-linux-appimage-desktop-integration';
const ELECTRON_DISABLE_SANDBOX_ENVIRONMENT_KEY = 'ELECTRON_DISABLE_SANDBOX';
const GLOBAL_SHORTCUTS_PORTAL_FEATURE = 'GlobalShortcutsPortal';

export interface DesktopRuntimeApplication {
  readonly commandLine: {
    appendSwitch(name: string, value?: string): void;
    getSwitchValue(name: string): string;
  };
  readonly dock?: {
    setIcon(image: string): void;
  };
  readonly isPackaged: boolean;
  disableHardwareAcceleration(): void;
  getVersion(): string;
  quit(): void;
  requestSingleInstanceLock(): boolean;
  setAboutPanelOptions(options: AboutPanelOptionsOptions): void;
  setAppUserModelId(id: string): void;
  setDesktopName(name: string): void;
  setName(name: string): void;
  showAboutPanel(): void;
}

export interface DesktopRuntimeControllerDependencies {
  readonly app: DesktopRuntimeApplication;
  readonly arguments: readonly string[];
  readonly buildMenu: (template: MenuItemConstructorOptions[]) => Menu;
  readonly electronVersion: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly exit: (code: number) => void;
  readonly getAppIconPath: () => string;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly openExternal: (url: string) => Promise<void>;
  readonly platform: NodeJS.Platform;
  readonly preReadyConfigurationComplete?: boolean;
  readonly schedule: (callback: () => void, delayMs: number) => unknown;
  readonly session: {
    readonly defaultSession: Pick<Session, 'setPermissionCheckHandler' | 'setPermissionRequestHandler'>;
  };
  readonly setApplicationMenu: (menu: Menu) => void;
  readonly windowManager: Pick<WindowManager, 'getMainWindow'>;
  readonly writeStandardOutput: (value: string) => void;
}

/** Performs Electron operations that must run synchronously before the ready event. */
export function configureDesktopApplicationBeforeReady(
  app: DesktopRuntimeApplication,
  platform: NodeJS.Platform,
): void {
  app.setName(APP_NAME);
  app.setAppUserModelId(APP_ID);
  app.disableHardwareAcceleration();
  if (platform !== 'linux') return;

  app.commandLine.appendSwitch('class', APP_ID);
  app.setDesktopName(APP_ID);
  const enabledFeatures = app.commandLine
    .getSwitchValue('enable-features')
    .split(',')
    .map((feature) => feature.trim())
    .filter((feature) => feature.length > 0 && feature !== GLOBAL_SHORTCUTS_PORTAL_FEATURE);
  const configuredFeatures = [...enabledFeatures, GLOBAL_SHORTCUTS_PORTAL_FEATURE].join(',');
  if (configuredFeatures !== app.commandLine.getSwitchValue('enable-features')) {
    app.commandLine.appendSwitch('enable-features', configuredFeatures);
  }
}

/**
 * Owns pre-ready Electron configuration, startup modes, and native desktop
 * metadata for one application graph.
 */
export class DesktopRuntimeController {
  public readonly isRemovingLinuxDesktopIntegration: boolean;
  public readonly isStartupBenchmark: boolean;
  private beforeReadyConfigured = false;
  private singleInstanceAttempted = false;
  private singleInstanceAccepted = false;

  public constructor(private readonly dependencies: DesktopRuntimeControllerDependencies) {
    this.beforeReadyConfigured = dependencies.preReadyConfigurationComplete ?? false;
    this.isStartupBenchmark = dependencies.arguments.includes(STARTUP_BENCHMARK_ARGUMENT);
    this.isRemovingLinuxDesktopIntegration =
      dependencies.platform === 'linux' && dependencies.arguments.includes(REMOVE_LINUX_DESKTOP_INTEGRATION_ARGUMENT);
  }

  public configureBeforeReady(): void {
    if (this.beforeReadyConfigured) return;
    this.beforeReadyConfigured = true;

    configureDesktopApplicationBeforeReady(this.dependencies.app, this.dependencies.platform);
  }

  public acquireSingleInstanceLock(): boolean {
    if (this.singleInstanceAttempted) return this.singleInstanceAccepted;
    this.singleInstanceAttempted = true;
    const { app } = this.dependencies;
    if (!this.isRemovingLinuxDesktopIntegration && !app.requestSingleInstanceLock()) {
      app.quit();
      this.dependencies.exit(0);
      return false;
    }

    this.configureLinuxRuntime();
    this.singleInstanceAccepted = true;
    return true;
  }

  /** Configures the OS-native About panel and application menu. */
  public configureNativeMetadata(): void {
    const { app, localization } = this.dependencies;
    app.setAboutPanelOptions({
      applicationName: APP_NAME,
      applicationVersion: app.getVersion(),
      version: `Electron ${this.dependencies.electronVersion}`,
      copyright: APP_COPYRIGHT,
      credits: localization.translate('about.panelCredits'),
      authors: ['Dmitry Vasiliev'],
      website: APP_WEBSITE,
      iconPath: this.dependencies.getAppIconPath(),
    });

    const helpSubmenu: MenuItemConstructorOptions[] = [
      {
        label: localization.translate('nativeMenu.projectOnGitHub'),
        click: () => {
          void this.dependencies.openExternal(APP_WEBSITE);
        },
      },
    ];
    if (this.dependencies.platform !== 'darwin') {
      helpSubmenu.push(
        { type: 'separator' },
        {
          label: localization.translate('nativeMenu.aboutApp', { app: APP_NAME }),
          click: () => app.showAboutPanel(),
        },
      );
    }

    const appMenu: MenuItemConstructorOptions[] =
      this.dependencies.platform === 'darwin'
        ? [
            {
              label: APP_NAME,
              submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
              ],
            },
          ]
        : [
            {
              label: localization.translate('nativeMenu.file'),
              submenu: [{ role: 'quit' }],
            },
          ];

    this.dependencies.setApplicationMenu(
      this.dependencies.buildMenu([
        ...appMenu,
        {
          label: localization.translate('nativeMenu.edit'),
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
          ],
        },
        {
          label: localization.translate('nativeMenu.view'),
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
          ],
        },
        { role: 'windowMenu' },
        {
          label: localization.translate('nativeMenu.help'),
          submenu: helpSubmenu,
        },
      ]),
    );
  }

  public configureApplicationReady(): void {
    if (this.dependencies.platform === 'darwin') {
      this.dependencies.app.dock?.setIcon(this.dependencies.getAppIconPath());
    }
    const session = this.dependencies.session.defaultSession;
    session.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === 'media');
    });
    session.setPermissionCheckHandler((_webContents, permission) => {
      return permission === 'media';
    });
  }

  public getAppInfo(): AppInfo {
    return createAppInfo(this.dependencies.app.getVersion());
  }

  public waitForStartupBenchmarkReady(): void {
    const mainWindow = this.dependencies.windowManager.getMainWindow();
    if (!mainWindow) return;

    const checkWindowStartupState = async (): Promise<void> => {
      if (mainWindow.isDestroyed()) return;

      try {
        // Benchmark mode skips provider startup, so measure the mounted shell rather than the normal provider-ready gate.
        const isReady: unknown = await mainWindow.webContents.executeJavaScript(
          STARTUP_BENCHMARK_RENDERER_MOUNT_QUERY,
          true,
        );
        if (isReady === true) {
          this.dependencies.writeStandardOutput(`${STARTUP_BENCHMARK_READY_MARKER}\n`);
          this.dependencies.app.quit();
          return;
        }
      } catch {
        // The renderer can briefly be unavailable while its document is replaced.
      }

      this.dependencies.schedule(() => {
        void checkWindowStartupState();
      }, STARTUP_BENCHMARK_POLL_INTERVAL_MS);
    };

    void checkWindowStartupState();
  }

  private configureLinuxRuntime(): void {
    if (this.dependencies.platform !== 'linux') return;

    const { app } = this.dependencies;
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-dev-shm-usage');
    app.commandLine.appendSwitch('log-level', CHROMIUM_FATAL_LOG_LEVEL);

    if (app.isPackaged && this.dependencies.environment.APPIMAGE) {
      this.dependencies.environment[ELECTRON_DISABLE_SANDBOX_ENVIRONMENT_KEY] = '1';
      app.commandLine.appendSwitch('no-sandbox');
    }
  }
}
