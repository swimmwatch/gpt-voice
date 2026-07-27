import * as path from 'node:path';

const DESKTOP_FILE_NAME = 'gpt-voice.desktop';
const ICON_FILE_NAME = 'gpt-voice.png';
const ICON_THEME_NAME = 'hicolor';
const ICON_CACHE_COMMAND = 'gtk-update-icon-cache';
const APP_DISPLAY_NAME = 'GPT-Voice';
const DESKTOP_ICON_NAME = 'gpt-voice';

interface SpawnedProcess {
  once(event: 'error', listener: (error: NodeJS.ErrnoException) => void): void;
  once(event: 'close', listener: (code: number | null) => void): void;
  unref(): void;
}

export interface LinuxDesktopIntegrationControllerDependencies {
  readonly app: {
    readonly isPackaged: boolean;
    getVersion(): string;
  };
  readonly environment: NodeJS.ProcessEnv;
  readonly fileSystem: {
    copyFileSync(source: string, destination: string): void;
    mkdirSync(path: string, options: { recursive: true }): unknown;
    rmSync(path: string, options: { force: true }): void;
    writeFileSync(path: string, data: string, encoding: BufferEncoding): void;
  };
  readonly getAppIconPath: () => string;
  readonly getAssetPath: (filename: string) => string;
  readonly homeDirectory: () => string;
  readonly logger: {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
  };
  readonly platform: NodeJS.Platform;
  readonly spawn: (command: string, args: readonly string[], options: { readonly stdio: 'ignore' }) => SpawnedProcess;
  readonly syncDesktopIcons: (dataHome: string, getAssetPath: (filename: string) => string) => void;
}

/** Owns AppImage launcher files, icon refreshes, and their injected OS adapters. */
export class LinuxDesktopIntegrationController {
  public constructor(private readonly dependencies: LinuxDesktopIntegrationControllerDependencies) {}

  public refreshIcons(): void {
    if (this.dependencies.platform !== 'linux') return;

    try {
      const dataHome = this.getXdgDataHome();
      this.dependencies.syncDesktopIcons(dataHome, this.dependencies.getAssetPath);
      this.refreshIconCache(dataHome);
      this.dependencies.logger.info('Updated Linux desktop icon theme');
    } catch (error: unknown) {
      this.dependencies.logger.warn('Failed to update Linux desktop icon theme:', error);
    }
  }

  public registerAppImage(): void {
    const appImagePath = this.dependencies.environment.APPIMAGE;
    if (this.dependencies.platform !== 'linux' || !this.dependencies.app.isPackaged || !appImagePath) {
      return;
    }

    const { desktopFile, iconFile } = this.getIntegrationPaths();
    try {
      this.dependencies.fileSystem.mkdirSync(path.dirname(desktopFile), { recursive: true });
      this.dependencies.fileSystem.mkdirSync(path.dirname(iconFile), { recursive: true });
      this.dependencies.fileSystem.copyFileSync(this.dependencies.getAppIconPath(), iconFile);
      this.dependencies.fileSystem.writeFileSync(
        desktopFile,
        [
          '[Desktop Entry]',
          `Name=${APP_DISPLAY_NAME}`,
          `Exec=${escapeDesktopExecArg(appImagePath)} --no-sandbox %U`,
          'Terminal=false',
          'Type=Application',
          `Icon=${DESKTOP_ICON_NAME}`,
          `StartupWMClass=${DESKTOP_ICON_NAME}`,
          'StartupNotify=true',
          `X-AppImage-Version=${this.dependencies.app.getVersion()}`,
          'Comment=Transcribe speech through GPT web sessions or OpenAI API',
          'Categories=Utility;',
          'Actions=RemoveIntegration;',
          '',
          '[Desktop Action RemoveIntegration]',
          `Name=Remove ${APP_DISPLAY_NAME} launcher`,
          `Exec=${escapeDesktopExecArg(appImagePath)} --no-sandbox --remove-linux-appimage-desktop-integration`,
          '',
        ].join('\n'),
        'utf8',
      );
      this.dependencies.logger.info('Registered AppImage desktop integration:', desktopFile);
    } catch (error: unknown) {
      this.dependencies.logger.warn('Failed to register AppImage desktop integration:', error);
    }
  }

  public removeAppImage(): void {
    if (this.dependencies.platform !== 'linux') return;

    const { desktopFile, iconFile } = this.getIntegrationPaths();
    try {
      this.dependencies.fileSystem.rmSync(desktopFile, { force: true });
      this.dependencies.fileSystem.rmSync(iconFile, { force: true });
      this.dependencies.logger.info('Removed AppImage desktop integration');
    } catch (error: unknown) {
      this.dependencies.logger.warn('Failed to remove AppImage desktop integration:', error);
    }
  }

  private getXdgDataHome(): string {
    return (
      this.dependencies.environment.XDG_DATA_HOME || path.join(this.dependencies.homeDirectory(), '.local', 'share')
    );
  }

  private getIntegrationPaths(): { readonly desktopFile: string; readonly iconFile: string } {
    const dataHome = this.getXdgDataHome();
    return {
      desktopFile: path.join(dataHome, 'applications', DESKTOP_FILE_NAME),
      iconFile: path.join(dataHome, 'icons', ICON_THEME_NAME, '512x512', 'apps', ICON_FILE_NAME),
    };
  }

  private refreshIconCache(dataHome: string): void {
    const iconThemeDirectory = path.join(dataHome, 'icons', ICON_THEME_NAME);
    const iconCache = this.dependencies.spawn(
      ICON_CACHE_COMMAND,
      ['--force', '--ignore-theme-index', iconThemeDirectory],
      { stdio: 'ignore' },
    );
    iconCache.once('error', (error) => {
      if (error.code !== 'ENOENT') {
        this.dependencies.logger.debug('Failed to refresh Linux desktop icon cache:', error.message);
      }
    });
    iconCache.once('close', (code) => {
      if (code !== 0) {
        this.dependencies.logger.debug('Linux desktop icon cache refresh exited:', code);
      }
    });
    iconCache.unref();
  }
}

export function escapeDesktopExecArg(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%')}"`;
}
