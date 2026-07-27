import type { Menu, MenuItemConstructorOptions, NativeImage, Tray } from 'electron';
import type { TrayIconState } from './trayIconState';
import { getTrayIconFilename } from './trayIconState';
import type { WindowManager } from './window';
import type { TranslationKey } from './i18n';

const TRAY_ICON_SIZE = 22;

export interface TrayControllerDependencies {
  readonly application: {
    quit(): void;
  };
  readonly buildMenu: (template: MenuItemConstructorOptions[]) => Menu;
  readonly createNativeImage: (path: string) => NativeImage;
  readonly createTray: (icon: NativeImage) => Tray;
  readonly getAssetPath: (filename: string) => string;
  readonly platform: NodeJS.Platform;
  readonly translate: (key: TranslationKey) => string;
  readonly windowManager: WindowManager;
}

/** Owns the native tray resource, its menu, and current icon state. */
export class TrayController {
  private tray: Tray | null = null;

  public constructor(private readonly dependencies: TrayControllerDependencies) {}

  public create(): void {
    if (this.tray && !this.tray.isDestroyed()) return;

    const tray = this.dependencies.createTray(this.createIcon('idle'));
    this.tray = tray;
    tray.setToolTip(this.dependencies.translate('tray.tooltip'));
    tray.setContextMenu(
      this.dependencies.buildMenu([
        {
          label: this.dependencies.translate('tray.show'),
          click: () => this.showFromMenu(),
        },
        {
          label: this.dependencies.translate('appSettings.open'),
          click: () => this.dependencies.windowManager.showSettingsWindow(),
        },
        {
          label: this.dependencies.translate('history.open'),
          click: () => this.dependencies.windowManager.showHistoryWindow(),
        },
        {
          label: this.dependencies.translate('about.open'),
          click: () => this.dependencies.windowManager.showAboutWindow(),
        },
        { type: 'separator' },
        {
          label: this.dependencies.translate('tray.quit'),
          click: () => {
            this.dependencies.windowManager.setQuitting(true);
            this.dependencies.application.quit();
          },
        },
      ]),
    );
    tray.on('click', () => this.handleTrayClick());
  }

  public updateIcon(state: TrayIconState): void {
    const tray = this.tray;
    if (!tray || tray.isDestroyed()) return;
    tray.setImage(this.createIcon(state));
  }

  public dispose(): void {
    const tray = this.tray;
    this.tray = null;
    if (tray && !tray.isDestroyed()) tray.destroy();
  }

  private createIcon(state: TrayIconState): NativeImage {
    const icon = this.dependencies
      .createNativeImage(this.dependencies.getAssetPath(getTrayIconFilename(state)))
      .resize({
        width: TRAY_ICON_SIZE,
        height: TRAY_ICON_SIZE,
        quality: 'best',
      });
    if (this.dependencies.platform === 'darwin' && state === 'idle') {
      icon.setTemplateImage(true);
    }
    return icon;
  }

  private showFromMenu(): void {
    const window = this.dependencies.windowManager.getMainWindow();
    if (!window) {
      this.dependencies.windowManager.createMainWindow();
      return;
    }
    window.show();
    window.focus();
  }

  private handleTrayClick(): void {
    const window = this.dependencies.windowManager.getMainWindow();
    if (!window) {
      this.dependencies.windowManager.createMainWindow();
      return;
    }
    if (!window.isVisible()) window.show();
    window.focus();
  }
}
