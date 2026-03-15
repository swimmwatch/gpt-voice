import { globalShortcut } from 'electron';
import { currentHotkey, currentCancelHotkey, currentStopHotkey } from './config';
import { updateTrayIcon } from './tray';
import { getMainWindow } from './window';
import { createLogger } from './logger';

const log = createLogger('shortcuts');

let isRecording = false;
let isPaused = false;

export function getRecordingState() {
  return { isRecording, isPaused };
}

export function resetRecordingState(): void {
  isRecording = false;
  isPaused = false;
}

export function registerShortcuts(): void {
  globalShortcut.unregisterAll();

  const registered = globalShortcut.register(currentHotkey, () => {
    const win = getMainWindow();
    if (!isRecording) {
      log.info(`${currentHotkey} pressed, starting recording`);
      isRecording = true;
      isPaused = false;
      updateTrayIcon(true);
      win?.webContents.send('toggle-recording', true);
    } else if (!isPaused) {
      log.info(`${currentHotkey} pressed, pausing recording`);
      isPaused = true;
      win?.webContents.send('pause-recording');
    } else {
      log.info(`${currentHotkey} pressed, resuming recording`);
      isPaused = false;
      win?.webContents.send('resume-recording');
    }
  });
  log.info(`${currentHotkey} shortcut registered:`, registered);

  const stopRegistered = globalShortcut.register(currentStopHotkey, () => {
    if (isRecording) {
      log.info(`${currentStopHotkey} pressed, stopping recording`);
      isRecording = false;
      isPaused = false;
      updateTrayIcon(false);
      getMainWindow()?.webContents.send('stop-recording');
    }
  });
  log.info(`${currentStopHotkey} stop shortcut registered:`, stopRegistered);

  const cancelRegistered = globalShortcut.register(currentCancelHotkey, () => {
    if (isRecording) {
      log.info(`${currentCancelHotkey} pressed, cancelling recording`);
      isRecording = false;
      isPaused = false;
      updateTrayIcon(false);
      getMainWindow()?.webContents.send('cancel-recording');
    }
  });
  log.info(`${currentCancelHotkey} cancel shortcut registered:`, cancelRegistered);
}
