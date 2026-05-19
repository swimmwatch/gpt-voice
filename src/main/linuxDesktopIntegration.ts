import { app } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getAppIconPath } from './assets';
import { createLogger } from './logger';

const log = createLogger('desktop-integration');
const DESKTOP_FILE_NAME = 'gpt-voice.desktop';
const ICON_FILE_NAME = 'gpt-voice.png';

function getXdgDataHome(): string {
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

function escapeDesktopExecArg(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%')}"`;
}

export function registerLinuxAppImageDesktopIntegration(): void {
  if (process.platform !== 'linux' || !app.isPackaged || !process.env.APPIMAGE) {
    return;
  }

  const appImagePath = process.env.APPIMAGE;
  const dataHome = getXdgDataHome();
  const desktopFile = path.join(dataHome, 'applications', DESKTOP_FILE_NAME);
  const iconFile = path.join(dataHome, 'icons', 'hicolor', '512x512', 'apps', ICON_FILE_NAME);

  try {
    fs.mkdirSync(path.dirname(desktopFile), { recursive: true });
    fs.mkdirSync(path.dirname(iconFile), { recursive: true });
    fs.copyFileSync(getAppIconPath(), iconFile);

    fs.writeFileSync(
      desktopFile,
      [
        '[Desktop Entry]',
        'Name=GPT-Voice',
        `Exec=${escapeDesktopExecArg(appImagePath)} --no-sandbox %U`,
        'Terminal=false',
        'Type=Application',
        'Icon=gpt-voice',
        'StartupWMClass=gpt-voice',
        'StartupNotify=true',
        `X-AppImage-Version=${app.getVersion()}`,
        'Comment=Transcribe speech through GPT web sessions or OpenAI API',
        'Categories=Utility;',
        'Actions=RemoveIntegration;',
        '',
        '[Desktop Action RemoveIntegration]',
        'Name=Remove GPT-Voice launcher',
        `Exec=${escapeDesktopExecArg(appImagePath)} --no-sandbox --remove-linux-appimage-desktop-integration`,
        '',
      ].join('\n'),
      'utf8',
    );

    log.info('Registered AppImage desktop integration:', desktopFile);
  } catch (error) {
    log.warn('Failed to register AppImage desktop integration:', error);
  }
}

export function removeLinuxAppImageDesktopIntegration(): void {
  if (process.platform !== 'linux') {
    return;
  }

  const dataHome = getXdgDataHome();
  const desktopFile = path.join(dataHome, 'applications', DESKTOP_FILE_NAME);
  const iconFile = path.join(dataHome, 'icons', 'hicolor', '512x512', 'apps', ICON_FILE_NAME);

  try {
    fs.rmSync(desktopFile, { force: true });
    fs.rmSync(iconFile, { force: true });
    log.info('Removed AppImage desktop integration');
  } catch (error) {
    log.warn('Failed to remove AppImage desktop integration:', error);
  }
}
