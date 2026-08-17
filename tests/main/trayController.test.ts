/* eslint-disable max-classes-per-file -- native image, tray, and window fakes own distinct resources. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow, Menu, MenuItemConstructorOptions, NativeImage, Tray } from 'electron';
import { TrayController } from '@main/tray';
import type { WindowManager } from '@main/window';
import type { TranslationKey } from '@main/i18n';
import { MainInteractionLock } from '@shared/mainInteractionLock';
import type { SettingsPresentationState } from '@shared/settingsPresentation';

class PrefixLocalization {
  public translate(key: TranslationKey): string {
    return `translated:${key}`;
  }
}

class RecordingTray {
  public destroyCount = 0;
  public destroyed = false;
  public imageCount = 0;
  public menu: Menu | null = null;
  public tooltip = '';
  private clickListener: (() => void) | null = null;

  public destroy(): void {
    this.destroyCount += 1;
    this.destroyed = true;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public on(_event: 'click', listener: () => void): this {
    this.clickListener = listener;
    return this;
  }

  public setContextMenu(menu: Menu): void {
    this.menu = menu;
  }

  public setImage(): void {
    this.imageCount += 1;
  }

  public setToolTip(value: string): void {
    this.tooltip = value;
  }

  public triggerClick(): void {
    this.clickListener?.();
  }
}

class RecordingWindowManager {
  public createCount = 0;
  public focusSettingsCount = 0;
  public quitting = false;
  public settingsPresentation: SettingsPresentationState = 'idle';
  private readonly settingsPresentationListeners = new Set<(state: SettingsPresentationState) => void>();
  public readonly mainWindow = {
    focusCount: 0,
    showCount: 0,
    visible: false,
  };

  public createMainWindow(): void {
    this.createCount += 1;
  }

  public focusSettingsWindow(): boolean {
    if (this.settingsPresentation === 'idle') return false;
    this.focusSettingsCount += 1;
    return true;
  }

  public getMainWindow(): BrowserWindow {
    return {
      focus: () => {
        this.mainWindow.focusCount += 1;
      },
      isVisible: () => this.mainWindow.visible,
      show: () => {
        this.mainWindow.showCount += 1;
        this.mainWindow.visible = true;
      },
    } as unknown as BrowserWindow;
  }

  public setQuitting(value: boolean): void {
    this.quitting = value;
  }

  public showMainWindow(): void {
    if (this.focusSettingsWindow()) return;
    this.mainWindow.showCount += 1;
    this.mainWindow.focusCount += 1;
    this.mainWindow.visible = true;
  }

  public setSettingsPresentation(state: SettingsPresentationState): void {
    this.settingsPresentation = state;
    for (const listener of this.settingsPresentationListeners) listener(state);
  }

  public subscribeSettingsPresentation(listener: (state: SettingsPresentationState) => void): () => void {
    this.settingsPresentationListeners.add(listener);
    return () => this.settingsPresentationListeners.delete(listener);
  }

  public showAboutWindow(): void {}
  public showHistoryWindow(): void {}
  public showSettingsWindow(): void {}
}

class TrayControllerHarness {
  public readonly menus: MenuItemConstructorOptions[][] = [];
  public quitCount = 0;
  public readonly mainInteractionLock = new MainInteractionLock(() => false);
  public readonly trays: RecordingTray[] = [];
  public readonly windowManager = new RecordingWindowManager();
  public readonly controller = new TrayController({
    application: {
      quit: () => {
        this.quitCount += 1;
      },
    },
    buildMenu: (template) => {
      this.menus.push(template);
      return { template } as unknown as Menu;
    },
    createNativeImage: () =>
      ({
        resize: () => ({
          setTemplateImage: () => undefined,
        }),
      }) as unknown as NativeImage,
    createTray: () => {
      const tray = new RecordingTray();
      this.trays.push(tray);
      return tray as unknown as Tray;
    },
    getAssetPath: (filename) => `/assets/${filename}`,
    localization: new PrefixLocalization(),
    mainInteractionLock: this.mainInteractionLock,
    platform: 'linux',
    windowManager: this.windowManager as unknown as WindowManager,
  });
}

describe('TrayController', () => {
  it('owns one localized tray and preserves menu and click behavior', () => {
    const harness = new TrayControllerHarness();
    harness.controller.create();
    harness.controller.create();

    assert.equal(harness.trays.length, 1);
    assert.equal(harness.trays[0]?.tooltip, 'translated:tray.tooltip');
    assert.equal(harness.menus[0]?.[0]?.label, 'translated:tray.show');

    harness.trays[0]?.triggerClick();
    assert.equal(harness.windowManager.mainWindow.showCount, 1);
    assert.equal(harness.windowManager.mainWindow.focusCount, 1);

    const menu = harness.menus[0];
    const quitItem = menu?.[menu.length - 1];
    assert.equal(typeof quitItem?.click, 'function');
    (quitItem?.click as (() => void) | undefined)?.();
    assert.equal(harness.windowManager.quitting, true);
    assert.equal(harness.quitCount, 1);
  });

  it('uses the active settings window as the tray primary destination', () => {
    const harness = new TrayControllerHarness();
    harness.controller.create();
    harness.windowManager.setSettingsPresentation('opening');
    const openingMenu = harness.menus[harness.menus.length - 1];
    assert.deepEqual(
      openingMenu?.slice(0, 4).map((item) => item.enabled),
      [false, false, true, true],
    );
    assert.equal(openingMenu?.[0]?.label, 'translated:settings.opening');

    harness.windowManager.setSettingsPresentation('open');
    const openMenu = harness.menus[harness.menus.length - 1];
    assert.equal(openMenu?.[0]?.label, 'translated:settings.show');
    (openMenu?.[0]?.click as (() => void) | undefined)?.();
    assert.equal(harness.windowManager.focusSettingsCount, 1);
    (openMenu?.[1]?.click as (() => void) | undefined)?.();
    assert.equal(harness.windowManager.focusSettingsCount, 2);

    harness.windowManager.setSettingsPresentation('idle');
    const idleMenu = harness.menus[harness.menus.length - 1];
    assert.equal(idleMenu?.[0]?.label, 'translated:tray.show');
  });

  it('updates icons and disposes independently and idempotently', () => {
    const first = new TrayControllerHarness();
    const second = new TrayControllerHarness();
    first.controller.create();
    second.controller.create();

    first.controller.updateIcon('recording');
    first.controller.dispose();
    first.controller.dispose();

    assert.equal(first.trays[0]?.imageCount, 1);
    assert.equal(first.trays[0]?.destroyCount, 1);
    assert.equal(second.trays[0]?.destroyCount, 0);
  });
});
