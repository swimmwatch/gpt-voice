import { app, Tray, Menu, nativeImage, type NativeImage } from 'electron';
import { getMainWindow, createWindow, setQuitting, showSettingsWindow } from './window';
import { t } from './i18n';
import { getAssetPath } from './assets';

let tray: Tray | null = null;

function getTrayIconPath(recording: boolean): string {
  const filename = recording ? 'tray-icon-recording-solid-even-larger-dot.png' : 'tray-icon-white-transparent.png';
  return getAssetPath(filename);
}

function createTrayIcon(recording: boolean): NativeImage {
  const icon = nativeImage.createFromPath(getTrayIconPath(recording));
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}

export function updateTrayIcon(recording: boolean): void {
  if (!tray) return;
  tray.setImage(createTrayIcon(recording));
}

export function createTray(): void {
  const icon = createTrayIcon(false);
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
      label: t('tray.settings'),
      click: () => {
        showSettingsWindow();
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
