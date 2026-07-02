import { globalShortcut } from 'electron';
import { currentHotkey, currentCancelHotkey, currentStopHotkey, currentTranslateHotkey } from './config';
import { updateTrayIcon } from './tray';
import { getMainWindow } from './window';
import { createLogger } from './logger';
import { t } from './i18n';
import { translateSelectedTextToClipboard } from './services/selectedTextTranslation';

const log = createLogger('shortcuts');

let isRecording = false;
let isPaused = false;

export function getRecordingState() {
  return { isRecording, isPaused };
}

export function resetRecordingState(): void {
  isRecording = false;
  isPaused = false;
  updateTrayIcon(false);
}

function normalizeHotkeyForPlatform(hotkey: string): string {
  if (process.platform === 'darwin') {
    return hotkey.replace(/\bSuper\b/g, 'Command');
  }
  return hotkey.replace(/\bCommand\b/g, 'Super');
}

export function registerShortcuts(): void {
  globalShortcut.unregisterAll();

  const recordHotkey = normalizeHotkeyForPlatform(currentHotkey);
  const stopHotkey = normalizeHotkeyForPlatform(currentStopHotkey);
  const cancelHotkey = normalizeHotkeyForPlatform(currentCancelHotkey);
  const translateHotkey = normalizeHotkeyForPlatform(currentTranslateHotkey);

  const registered = globalShortcut.register(recordHotkey, () => {
    const win = getMainWindow();
    if (!isRecording) {
      log.info(`${recordHotkey} pressed, starting recording`);
      isRecording = true;
      isPaused = false;
      updateTrayIcon(true);
      win?.webContents.send('toggle-recording', true);
    } else if (!isPaused) {
      log.info(`${recordHotkey} pressed, pausing recording`);
      isPaused = true;
      win?.webContents.send('pause-recording');
    } else {
      log.info(`${recordHotkey} pressed, resuming recording`);
      isPaused = false;
      win?.webContents.send('resume-recording');
    }
  });
  log.info(`${recordHotkey} shortcut registered:`, registered);

  const stopRegistered = globalShortcut.register(stopHotkey, () => {
    if (isRecording) {
      log.info(`${stopHotkey} pressed, stopping recording`);
      isRecording = false;
      isPaused = false;
      updateTrayIcon(false);
      getMainWindow()?.webContents.send('stop-recording');
    }
  });
  log.info(`${stopHotkey} stop shortcut registered:`, stopRegistered);

  const cancelRegistered = globalShortcut.register(cancelHotkey, () => {
    if (isRecording) {
      log.info(`${cancelHotkey} pressed, cancelling recording`);
      isRecording = false;
      isPaused = false;
      updateTrayIcon(false);
      getMainWindow()?.webContents.send('cancel-recording');
    }
  });
  log.info(`${cancelHotkey} cancel shortcut registered:`, cancelRegistered);

  const translateRegistered = globalShortcut.register(translateHotkey, () => {
    if (isRecording) {
      log.info(`${translateHotkey} pressed while recording, ignoring translation`);
      return;
    }

    log.info(`${translateHotkey} pressed, translating selected text`);
    getMainWindow()?.webContents.send('translation-status', t('status.translatingSelection'));
    void translateSelectedTextToClipboard().then((result) => {
      getMainWindow()?.webContents.send('translation-status', result.status);
    });
  });
  log.info(`${translateHotkey} translate shortcut registered:`, translateRegistered);
}
