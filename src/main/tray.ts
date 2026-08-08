import type { Menu, MenuItemConstructorOptions, NativeImage, Tray } from 'electron';
import type { TrayIconState } from './trayIconState';
import { getTrayIconFilename } from './trayIconState';
import type { WindowManager } from './window';
import type { I18nService } from './i18n';
import { MainInteractionLock } from '@shared/mainInteractionLock';

const TRAY_ICON_SIZE = 22;

export interface TrayControllerDependencies {
  readonly application: {
    quit(): void;
  };
  readonly buildMenu: (template: MenuItemConstructorOptions[]) => Menu;
  readonly createNativeImage: (path: string) => NativeImage;
  readonly createTray: (icon: NativeImage) => Tray;
  readonly getAssetPath: (filename: string) => string;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly mainInteractionLock: MainInteractionLock;
  readonly platform: NodeJS.Platform;
  readonly windowManager: WindowManager;
}

/** Owns the native tray resource, its menu, and current icon state. */
export class TrayController {
  private mainInteractionLockUnsubscribe: (() => void) | null = null;
  private tray: Tray | null = null;

  public constructor(private readonly dependencies: TrayControllerDependencies) {}

  public create(): void {
    if (this.tray && !this.tray.isDestroyed()) return;

    const tray = this.dependencies.createTray(this.createIcon('idle'));
    this.tray = tray;
    tray.setToolTip(this.dependencies.localization.translate('tray.tooltip'));
    this.mainInteractionLockUnsubscribe = this.dependencies.mainInteractionLock.subscribe(() => {
      this.updateContextMenu();
    });
    this.updateContextMenu();
    tray.on('click', () => this.handleTrayClick());
  }

  public updateIcon(state: TrayIconState): void {
    const tray = this.tray;
    if (!tray || tray.isDestroyed()) return;
    tray.setImage(this.createIcon(state));
  }

  public dispose(): void {
    this.mainInteractionLockUnsubscribe?.();
    this.mainInteractionLockUnsubscribe = null;
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
    if (this.dependencies.mainInteractionLock.locked) return;
    const window = this.dependencies.windowManager.getMainWindow();
    if (!window) {
      this.dependencies.windowManager.createMainWindow();
      return;
    }
    window.show();
    window.focus();
  }

  private handleTrayClick(): void {
    if (this.dependencies.mainInteractionLock.locked) return;
    const window = this.dependencies.windowManager.getMainWindow();
    if (!window) {
      this.dependencies.windowManager.createMainWindow();
      return;
    }
    if (!window.isVisible()) window.show();
    window.focus();
  }

  private updateContextMenu(): void {
    const tray = this.tray;
    if (!tray || tray.isDestroyed()) return;
    const enabled = !this.dependencies.mainInteractionLock.locked;
    tray.setContextMenu(
      this.dependencies.buildMenu([
        {
          label: this.dependencies.localization.translate('tray.show'),
          click: () => this.showFromMenu(),
          enabled,
        },
        {
          label: this.dependencies.localization.translate('appSettings.open'),
          click: () => this.dependencies.windowManager.showSettingsWindow(),
          enabled,
        },
        {
          label: this.dependencies.localization.translate('history.open'),
          click: () => this.dependencies.windowManager.showHistoryWindow(),
          enabled,
        },
        {
          label: this.dependencies.localization.translate('about.open'),
          click: () => this.dependencies.windowManager.showAboutWindow(),
          enabled,
        },
        { type: 'separator' },
        {
          label: this.dependencies.localization.translate('tray.quit'),
          enabled: true,
          click: () => {
            this.dependencies.windowManager.setQuitting(true);
            this.dependencies.application.quit();
          },
        },
      ]),
    );
  }
}
