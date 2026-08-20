import * as path from 'node:path';

import { APP_ID } from './appMetadata';

const CANONICAL_DESKTOP_FILE_NAME = `${APP_ID}.desktop`;
const LEGACY_DESKTOP_FILE_NAME = 'gpt-voice.desktop';
const ICON_FILE_NAME = 'gpt-voice.png';
const ICON_THEME_NAME = 'hicolor';
const ICON_CACHE_COMMAND = 'gtk-update-icon-cache';
const APP_DISPLAY_NAME = 'GPT-Voice';
const DESKTOP_ICON_NAME = 'gpt-voice';
const LINUX_ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512] as const;

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
    existsSync(path: string): boolean;
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
}

/** Owns AppImage launcher files, icon refreshes, and their injected OS adapters. */
export class LinuxDesktopIntegrationController {
  public constructor(private readonly dependencies: LinuxDesktopIntegrationControllerDependencies) {}

  public refreshIcons(): void {
    if (this.dependencies.platform !== 'linux') return;

    try {
      const dataHome = this.getXdgDataHome();
      this.syncDesktopIcons(dataHome);
      this.refreshIconCache(dataHome);
      this.log('info', 'refresh-icons', 'success');
    } catch {
      this.log('warn', 'refresh-icons', 'failed');
    }
  }

  public registerAppImage(): boolean {
    const appImagePath = this.dependencies.environment.APPIMAGE;
    if (this.dependencies.platform !== 'linux' || !this.dependencies.app.isPackaged || !appImagePath) {
      return false;
    }

    const { canonicalDesktopFile, iconFile, legacyDesktopFile } = this.getIntegrationPaths();
    try {
      this.dependencies.fileSystem.mkdirSync(path.dirname(canonicalDesktopFile), { recursive: true });
      this.dependencies.fileSystem.mkdirSync(path.dirname(iconFile), { recursive: true });
      this.dependencies.fileSystem.copyFileSync(this.dependencies.getAppIconPath(), iconFile);
      this.dependencies.fileSystem.writeFileSync(
        canonicalDesktopFile,
        [
          '[Desktop Entry]',
          `Name=${APP_DISPLAY_NAME}`,
          `Exec=${escapeDesktopExecArg(appImagePath)} --no-sandbox %U`,
          'Terminal=false',
          'Type=Application',
          `Icon=${DESKTOP_ICON_NAME}`,
          `StartupWMClass=${APP_ID}`,
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
      if (this.dependencies.fileSystem.existsSync(legacyDesktopFile)) {
        this.dependencies.fileSystem.rmSync(legacyDesktopFile, { force: true });
      }
      this.log('info', 'register', 'success');
      return true;
    } catch {
      this.log('warn', 'register', 'failed');
      return false;
    }
  }

  public removeAppImage(): void {
    if (this.dependencies.platform !== 'linux') return;

    const { canonicalDesktopFile, iconFile, legacyDesktopFile } = this.getIntegrationPaths();
    try {
      this.dependencies.fileSystem.rmSync(canonicalDesktopFile, { force: true });
      this.dependencies.fileSystem.rmSync(legacyDesktopFile, { force: true });
      this.dependencies.fileSystem.rmSync(iconFile, { force: true });
      this.log('info', 'remove', 'success');
    } catch {
      this.log('warn', 'remove', 'failed');
    }
  }

  private getXdgDataHome(): string {
    return (
      this.dependencies.environment.XDG_DATA_HOME || path.join(this.dependencies.homeDirectory(), '.local', 'share')
    );
  }

  private syncDesktopIcons(dataHome: string): void {
    for (const size of LINUX_ICON_SIZES) {
      const iconDirectory = path.join(dataHome, 'icons', ICON_THEME_NAME, `${size}x${size}`, 'apps');
      this.dependencies.fileSystem.mkdirSync(iconDirectory, { recursive: true });
      this.dependencies.fileSystem.copyFileSync(
        this.dependencies.getAssetPath(`icons/${size}x${size}.png`),
        path.join(iconDirectory, ICON_FILE_NAME),
      );
    }
  }

  private getIntegrationPaths(): {
    readonly canonicalDesktopFile: string;
    readonly iconFile: string;
    readonly legacyDesktopFile: string;
  } {
    const dataHome = this.getXdgDataHome();
    return {
      canonicalDesktopFile: path.join(dataHome, 'applications', CANONICAL_DESKTOP_FILE_NAME),
      iconFile: path.join(dataHome, 'icons', ICON_THEME_NAME, '512x512', 'apps', ICON_FILE_NAME),
      legacyDesktopFile: path.join(dataHome, 'applications', LEGACY_DESKTOP_FILE_NAME),
    };
  }

  private log(level: 'debug' | 'info' | 'warn', action: string, result: 'failed' | 'success'): void {
    this.dependencies.logger[level]('Linux desktop integration', {
      action,
      identity: APP_ID,
      platform: this.dependencies.platform,
      result,
    });
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
        this.log('debug', 'refresh-icons', 'failed');
      }
    });
    iconCache.once('close', (code) => {
      if (code !== 0) {
        this.log('debug', 'refresh-icons', 'failed');
      }
    });
    iconCache.unref();
  }
}

export function escapeDesktopExecArg(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%')}"`;
}
