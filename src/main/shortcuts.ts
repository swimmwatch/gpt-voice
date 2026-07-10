import { globalShortcut } from 'electron';
import {
  currentCancelHotkey,
  currentHotkey,
  currentPrettifyEnabled,
  currentPrettifyHotkey,
  currentRetryTranscriptionHotkey,
  currentStopHotkey,
  currentTranslateEnabled,
  currentTranslateHotkey,
} from './config';
import { updateTrayIcon } from './tray';
import { getTrayIconStateForRecordingLifecycle } from './trayIconState';
import { getMainWindow } from './window';
import { createLogger } from './logger';
import { t } from './i18n';
import { getActiveSelectedTextAction } from './services/selectedTextActionState';
import { cancelSelectedTextPrettify, prettifySelectedText } from './services/selectedTextPrettify';
import { translateSelectedTextToClipboard } from './services/selectedTextTranslation';
import { canRunRetryTranscriptionHotkey, canRunTextActionHotkey } from '@shared/hotkeys';
import {
  canCancelRecording,
  canPauseRecording,
  canResumeRecording,
  canStartRecording,
  canStopRecording,
  isRecordingLifecycleBusy,
  type RecordingLifecycleState,
} from '@shared/recordingLifecycle';

const log = createLogger('shortcuts');

let isRecording = false;
let isPaused = false;
let recordingLifecycleState: RecordingLifecycleState = 'idle';
let retryTranscriptionAvailable = false;
let registeredRetryTranscriptionHotkey: string | null = null;

interface CancelShortcutActions {
  cancelPrettify: () => { status: string } | null;
  cancelRecording: () => void;
  sendTextStatus: (status: string) => void;
}

export function getRecordingState() {
  return { isRecording, isPaused, lifecycleState: recordingLifecycleState };
}

function shouldShowRecordingStatusIndicator(state: RecordingLifecycleState): boolean {
  return state === 'starting' || state === 'recording' || state === 'paused' || state === 'stopping';
}

export function setRecordingLifecycleState(state: RecordingLifecycleState): void {
  recordingLifecycleState = state;
  isRecording = shouldShowRecordingStatusIndicator(state);
  isPaused = state === 'paused';
  updateTrayIconForRecordingLifecycle();
  syncRetryTranscriptionShortcut();
}

export function resetRecordingState(): void {
  setRecordingLifecycleState('idle');
}

function normalizeHotkeyForPlatform(hotkey: string): string {
  if (process.platform === 'darwin') {
    return hotkey.replace(/\bSuper\b/g, 'Command');
  }
  return hotkey.replace(/\bCommand\b/g, 'Super');
}

export function handleCancelShortcut(isCurrentlyRecording: boolean, actions: CancelShortcutActions): boolean {
  if (isCurrentlyRecording) {
    actions.cancelRecording();
    return true;
  }

  const prettifyCancelResult = actions.cancelPrettify();
  if (prettifyCancelResult) {
    actions.sendTextStatus(prettifyCancelResult.status);
    return true;
  }

  return false;
}

function isRecordingBusy(state: RecordingLifecycleState | boolean): boolean {
  return typeof state === 'boolean' ? state : isRecordingLifecycleBusy(state);
}

function updateTrayIconForRecordingLifecycle(): void {
  updateTrayIcon(getTrayIconStateForRecordingLifecycle(recordingLifecycleState));
}

export function canRunTranslateShortcut(
  recordingState: RecordingLifecycleState | boolean,
  translateEnabled: boolean,
  selectedTextBusy = false,
): boolean {
  return translateEnabled && canRunTextActionHotkey(isRecordingBusy(recordingState)) && !selectedTextBusy;
}

export function canRunPrettifyShortcut(
  recordingState: RecordingLifecycleState | boolean,
  prettifyEnabled: boolean,
  selectedTextBusy = false,
): boolean {
  return prettifyEnabled && canRunTextActionHotkey(isRecordingBusy(recordingState)) && !selectedTextBusy;
}

export function canRunRetryTranscriptionShortcut(
  recordingState: RecordingLifecycleState | boolean,
  retryAvailable: boolean,
): boolean {
  return canRunRetryTranscriptionHotkey(isRecordingBusy(recordingState), retryAvailable);
}

export function setRetryTranscriptionAvailable(available: boolean): void {
  retryTranscriptionAvailable = available;
  syncRetryTranscriptionShortcut();
}

function unregisterRetryTranscriptionShortcut(): void {
  if (!registeredRetryTranscriptionHotkey) {
    return;
  }

  globalShortcut.unregister(registeredRetryTranscriptionHotkey);
  log.info(`${registeredRetryTranscriptionHotkey} resend transcription shortcut unregistered`);
  registeredRetryTranscriptionHotkey = null;
}

function syncRetryTranscriptionShortcut(): void {
  const retryTranscriptionHotkey = normalizeHotkeyForPlatform(currentRetryTranscriptionHotkey);
  if (!canRunRetryTranscriptionShortcut(recordingLifecycleState, retryTranscriptionAvailable)) {
    unregisterRetryTranscriptionShortcut();
    return;
  }

  if (registeredRetryTranscriptionHotkey === retryTranscriptionHotkey) {
    return;
  }

  unregisterRetryTranscriptionShortcut();
  const retryRegistered = globalShortcut.register(retryTranscriptionHotkey, () => {
    if (!canRunRetryTranscriptionShortcut(recordingLifecycleState, retryTranscriptionAvailable)) {
      log.info(`${retryTranscriptionHotkey} pressed while resend transcription is unavailable`);
      return;
    }

    const win = getMainWindow();
    if (!win) {
      log.info(`${retryTranscriptionHotkey} pressed without an available main window`);
      return;
    }

    log.info(`${retryTranscriptionHotkey} pressed, resending transcription audio`);
    retryTranscriptionAvailable = false;
    setRecordingLifecycleState('retrying');
    unregisterRetryTranscriptionShortcut();
    win.webContents.send('retry-transcription');
  });
  registeredRetryTranscriptionHotkey = retryRegistered ? retryTranscriptionHotkey : null;
  log.info(`${retryTranscriptionHotkey} resend transcription shortcut registered:`, retryRegistered);
}

export function registerShortcuts(): void {
  globalShortcut.unregisterAll();
  registeredRetryTranscriptionHotkey = null;

  const recordHotkey = normalizeHotkeyForPlatform(currentHotkey);
  const stopHotkey = normalizeHotkeyForPlatform(currentStopHotkey);
  const cancelHotkey = normalizeHotkeyForPlatform(currentCancelHotkey);
  const translateHotkey = normalizeHotkeyForPlatform(currentTranslateHotkey);
  const prettifyHotkey = normalizeHotkeyForPlatform(currentPrettifyHotkey);

  const registered = globalShortcut.register(recordHotkey, () => {
    const win = getMainWindow();
    if (canStartRecording(recordingLifecycleState)) {
      log.info(`${recordHotkey} pressed, starting recording`);
      setRecordingLifecycleState('starting');
      win?.webContents.send('toggle-recording', true);
    } else if (canPauseRecording(recordingLifecycleState)) {
      log.info(`${recordHotkey} pressed, pausing recording`);
      setRecordingLifecycleState('paused');
      win?.webContents.send('pause-recording');
    } else if (canResumeRecording(recordingLifecycleState)) {
      log.info(`${recordHotkey} pressed, resuming recording`);
      setRecordingLifecycleState('recording');
      win?.webContents.send('resume-recording');
    } else {
      log.info(`${recordHotkey} pressed while recording lifecycle is busy:`, recordingLifecycleState);
    }
  });
  log.info(`${recordHotkey} shortcut registered:`, registered);

  const stopRegistered = globalShortcut.register(stopHotkey, () => {
    if (canStopRecording(recordingLifecycleState)) {
      log.info(`${stopHotkey} pressed, stopping recording`);
      setRecordingLifecycleState('stopping');
      getMainWindow()?.webContents.send('stop-recording');
    } else {
      log.info(`${stopHotkey} pressed while recording cannot stop:`, recordingLifecycleState);
    }
  });
  log.info(`${stopHotkey} stop shortcut registered:`, stopRegistered);

  const cancelRegistered = globalShortcut.register(cancelHotkey, () => {
    const win = getMainWindow();
    handleCancelShortcut(canCancelRecording(recordingLifecycleState), {
      cancelPrettify: () => {
        const result = cancelSelectedTextPrettify();
        if (result) {
          log.info(`${cancelHotkey} pressed, cancelling prettify`);
          updateTrayIconForRecordingLifecycle();
        }
        return result;
      },
      cancelRecording: () => {
        log.info(`${cancelHotkey} pressed, cancelling recording`);
        setRecordingLifecycleState('idle');
        win?.webContents.send('cancel-recording');
      },
      sendTextStatus: (status) => win?.webContents.send('translation-status', status),
    });
  });
  log.info(`${cancelHotkey} cancel shortcut registered:`, cancelRegistered);

  const translateRegistered = globalShortcut.register(translateHotkey, () => {
    const selectedTextBusy = Boolean(getActiveSelectedTextAction());
    if (!canRunTranslateShortcut(recordingLifecycleState, currentTranslateEnabled, selectedTextBusy)) {
      if (currentTranslateEnabled) {
        log.info(`${translateHotkey} pressed while translation cannot run`, {
          recordingLifecycleState,
          selectedTextBusy,
        });
        return;
      }
      log.info(`${translateHotkey} pressed while translation is disabled`);
      return;
    }

    log.info(`${translateHotkey} pressed, translating selected text`);
    const resultPromise = translateSelectedTextToClipboard();
    const win = getMainWindow();
    win?.webContents.send('translation-status', t('status.translatingSelection'));
    void resultPromise.then((result) => {
      if (!result.skipped) {
        getMainWindow()?.webContents.send('translation-status', result.status);
      }
    });
  });
  log.info(`${translateHotkey} translate shortcut registered:`, translateRegistered);

  const prettifyRegistered = globalShortcut.register(prettifyHotkey, () => {
    const selectedTextBusy = Boolean(getActiveSelectedTextAction());
    if (!canRunPrettifyShortcut(recordingLifecycleState, currentPrettifyEnabled, selectedTextBusy)) {
      if (currentPrettifyEnabled) {
        log.info(`${prettifyHotkey} pressed while prettify cannot run`, {
          recordingLifecycleState,
          selectedTextBusy,
        });
        return;
      }
      log.info(`${prettifyHotkey} pressed while prettify is disabled`);
      return;
    }

    log.info(`${prettifyHotkey} pressed, prettifying selected text`);
    const resultPromise = prettifySelectedText();
    updateTrayIcon('prettifying');
    const win = getMainWindow();
    win?.webContents.send('translation-status', t('status.prettifyingSelection'));
    void resultPromise
      .then((result) => {
        if (!result.skipped) {
          getMainWindow()?.webContents.send('translation-status', result.status);
        }
      })
      .catch((error: unknown) => {
        log.warn(`${prettifyHotkey} prettify shortcut failed:`, error instanceof Error ? error.message : String(error));
      })
      .finally(updateTrayIconForRecordingLifecycle);
  });
  log.info(`${prettifyHotkey} prettify shortcut registered:`, prettifyRegistered);

  syncRetryTranscriptionShortcut();
}
