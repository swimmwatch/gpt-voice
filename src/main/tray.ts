import { app, Tray, Menu, nativeImage, type NativeImage } from 'electron';
import { getMainWindow, createWindow, setQuitting, showHistoryWindow, showSettingsWindow } from './window';
import { t } from './i18n';
import { getAssetPath } from './assets';
import { getTrayIconFilename, type TrayIconState } from './trayIconState';

let tray: Tray | null = null;

const TRAY_ICON_SIZE = 22;

function getTrayIconPath(state: TrayIconState): string {
  return getAssetPath(getTrayIconFilename(state));
}

function createTrayIcon(state: TrayIconState): NativeImage {
  const icon = nativeImage.createFromPath(getTrayIconPath(state)).resize({
    width: TRAY_ICON_SIZE,
    height: TRAY_ICON_SIZE,
    quality: 'best',
  });
  if (process.platform === 'darwin' && state === 'idle') {
    icon.setTemplateImage(true);
  }
  return icon;
}

export function updateTrayIcon(state: TrayIconState): void {
  if (!tray) return;
  tray.setImage(createTrayIcon(state));
}

export function createTray(): void {
  const icon = createTrayIcon('idle');
  tray = new Tray(icon);
  tray.setToolTip(t('tray.tooltip'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: t('tray.show'),
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: t('appSettings.open'),
      click: () => {
        showSettingsWindow();
      },
    },
    {
      label: t('history.open'),
      click: () => {
        showHistoryWindow();
      },
    },
    { type: 'separator' },
    {
      label: t('tray.quit'),
      click: () => {
        setQuitting(true);
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isVisible()) {
        win.focus();
      } else {
        win.show();
        win.focus();
      }
    } else {
      createWindow();
    }
  });
}
