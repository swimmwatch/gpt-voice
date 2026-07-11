import { app } from 'electron';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getAppIconPath, getAssetPath } from './assets';
import { createLogger } from './logger';
import { syncLinuxDesktopIcons } from './linuxDesktopIcons';

const log = createLogger('desktop-integration');
const DESKTOP_FILE_NAME = 'gpt-voice.desktop';
const ICON_FILE_NAME = 'gpt-voice.png';
const ICON_THEME_NAME = 'hicolor';
const ICON_CACHE_COMMAND = 'gtk-update-icon-cache';

function getXdgDataHome(): string {
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

function refreshLinuxIconCache(dataHome: string): void {
  const iconThemeDirectory = path.join(dataHome, 'icons', ICON_THEME_NAME);
  const iconCache = spawn(ICON_CACHE_COMMAND, ['--force', '--ignore-theme-index', iconThemeDirectory], {
    stdio: 'ignore',
  });

  iconCache.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      log.debug('Failed to refresh Linux desktop icon cache:', error.message);
    }
  });
  iconCache.once('close', (code) => {
    if (code !== 0) {
      log.debug('Linux desktop icon cache refresh exited:', code);
    }
  });
  iconCache.unref();
}

export function refreshLinuxDesktopIcons(): void {
  if (process.platform !== 'linux') {
    return;
  }

  try {
    const dataHome = getXdgDataHome();
    syncLinuxDesktopIcons(dataHome, getAssetPath);
    refreshLinuxIconCache(dataHome);
    log.info('Updated Linux desktop icon theme');
  } catch (error) {
    log.warn('Failed to update Linux desktop icon theme:', error);
  }
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
