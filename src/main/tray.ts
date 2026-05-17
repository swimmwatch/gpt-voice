import { app, Tray, Menu, nativeImage } from 'electron';
import { getMainWindow, createWindow, setQuitting } from './window';
import { t } from './i18n';
import { getAssetPath } from './assets';

let tray: Tray | null = null;

function getTrayIconPath(recording: boolean): string {
  const filename = recording ? 'tray-icon-recording-solid-even-larger-dot.png' : 'tray-icon-white-transparent.png';
  return getAssetPath(filename);
}

export function updateTrayIcon(recording: boolean): void {
  if (!tray) return;
  const icon = nativeImage.createFromPath(getTrayIconPath(recording));
  tray.setImage(icon);
}

export function createTray(): void {
  const icon = nativeImage.createFromPath(getTrayIconPath(false));
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
