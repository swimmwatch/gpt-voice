import {
  canRunRetryTranscriptionHotkey,
  canRunTextActionHotkey,
  getConflictingHotkeyTargets,
  type HotkeySettings,
  type HotkeyTarget,
} from '@shared/hotkeys';
import {
  canCancelRecording,
  canPauseRecording,
  canResumeRecording,
  canStartRecording,
  canStopRecording,
  isRecordingLifecycleBusy,
  type RecordingLifecycleState,
} from '@shared/recordingLifecycle';
import { presentNotificationError, type NotificationErrorLogMetadata } from '@shared/notifications';
import type { TextActionStatus, TextActionStatusAction } from '@shared/textActionStatus';
import { getTrayIconStateForRecordingLifecycle } from './trayIconState';
import type { TrayController } from './tray';
import type { WindowManager } from './window';

interface CancelShortcutActions {
  cancelPrettify: () => boolean;
  cancelRecording: () => void;
}

export interface TextActionResultForStatus {
  cancelled?: true;
  skipped?: true;
  success: boolean;
}

export interface SelectedTextTranslationShortcutService {
  translateSelectedTextToClipboard(): Promise<TextActionResultForStatus>;
}

export interface TextActionStatusResolution {
  failureLogMetadata?: NotificationErrorLogMetadata & { action: TextActionStatusAction };
  status: TextActionStatus;
}

export interface ShortcutSettingsSnapshot extends HotkeySettings {
  readonly prettifyEnabled: boolean;
  readonly translateEnabled: boolean;
}

export interface ShortcutControllerDependencies {
  readonly cancelSelectedTextPrettify: () => unknown;
  readonly getActiveSelectedTextAction: () => unknown;
  readonly getSettings: () => ShortcutSettingsSnapshot;
  readonly globalShortcut: {
    register(accelerator: string, callback: () => void): boolean;
    unregister(accelerator: string): void;
    unregisterAll(): void;
  };
  readonly logger: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
  };
  readonly platform: NodeJS.Platform;
  readonly prettifySelectedText: () => Promise<TextActionResultForStatus>;
  readonly selectedTextTranslationService: SelectedTextTranslationShortcutService;
  readonly trayController: Pick<TrayController, 'updateIcon'>;
  readonly windowManager: Pick<WindowManager, 'getMainWindow'>;
}

/** Owns global hotkeys and the recording lifecycle state that gates them. */
export class ShortcutController {
  private conflictingHotkeyTargets = new Set<HotkeyTarget>();
  private disposed = false;
  private recordingLifecycleState: RecordingLifecycleState = 'idle';
  private registeredRetryTranscriptionHotkey: string | null = null;
  private retryTranscriptionAvailable = false;
  private shortcutsSuspended = false;

  public constructor(private readonly dependencies: ShortcutControllerDependencies) {}

  public getRecordingState(): {
    readonly isPaused: boolean;
    readonly isRecording: boolean;
    readonly lifecycleState: RecordingLifecycleState;
  } {
    return {
      isRecording: shouldShowRecordingStatusIndicator(this.recordingLifecycleState),
      isPaused: this.recordingLifecycleState === 'paused',
      lifecycleState: this.recordingLifecycleState,
    };
  }

  public setRecordingLifecycleState(state: RecordingLifecycleState): void {
    this.recordingLifecycleState = state;
    this.updateTrayIconForRecordingLifecycle();
    this.syncRetryTranscriptionShortcut();
  }

  public resetRecordingState(): void {
    this.setRecordingLifecycleState('idle');
  }

  public setRetryTranscriptionAvailable(available: boolean): void {
    this.retryTranscriptionAvailable = available;
    this.syncRetryTranscriptionShortcut();
  }

  public setSuspended(suspended: boolean): void {
    if (this.shortcutsSuspended === suspended || this.disposed) return;
    this.shortcutsSuspended = suspended;
    if (suspended) {
      this.dependencies.globalShortcut.unregisterAll();
      this.registeredRetryTranscriptionHotkey = null;
      this.dependencies.logger.info('Global shortcuts suspended for hotkey capture');
      return;
    }

    this.dependencies.logger.info('Global shortcuts resumed after hotkey capture');
    this.register();
  }

  /** Registers every configured shortcut while preserving lifecycle gates. */
  /** Registers the current non-conflicting global shortcut set. */
  public register(): void {
    if (this.disposed) return;
    const settings = this.dependencies.getSettings();
    this.dependencies.globalShortcut.unregisterAll();
    this.registeredRetryTranscriptionHotkey = null;
    this.conflictingHotkeyTargets = new Set(getConflictingHotkeyTargets(settings));

    if (this.shortcutsSuspended) {
      this.dependencies.logger.info('Skipped global shortcut registration while hotkey capture is active');
      return;
    }

    const recordHotkey = this.normalizeHotkeyForPlatform(settings.hotkey);
    const stopHotkey = this.normalizeHotkeyForPlatform(settings.stopHotkey);
    const cancelHotkey = this.normalizeHotkeyForPlatform(settings.cancelHotkey);
    const translateHotkey = this.normalizeHotkeyForPlatform(settings.translateHotkey);
    const prettifyHotkey = this.normalizeHotkeyForPlatform(settings.prettifyHotkey);

    const recordRegistered = this.registerConfiguredShortcut('record', recordHotkey, () => {
      const window = this.dependencies.windowManager.getMainWindow();
      if (canStartRecording(this.recordingLifecycleState)) {
        this.dependencies.logger.info(`${recordHotkey} pressed, starting recording`);
        this.setRecordingLifecycleState('starting');
        window?.webContents.send('toggle-recording', true);
      } else if (canPauseRecording(this.recordingLifecycleState)) {
        this.dependencies.logger.info(`${recordHotkey} pressed, pausing recording`);
        this.setRecordingLifecycleState('paused');
        window?.webContents.send('pause-recording');
      } else if (canResumeRecording(this.recordingLifecycleState)) {
        this.dependencies.logger.info(`${recordHotkey} pressed, resuming recording`);
        this.setRecordingLifecycleState('recording');
        window?.webContents.send('resume-recording');
      } else {
        this.dependencies.logger.info(
          `${recordHotkey} pressed while recording lifecycle is busy:`,
          this.recordingLifecycleState,
        );
      }
    });
    this.dependencies.logger.info(`${recordHotkey} shortcut registered:`, recordRegistered);

    const stopRegistered = this.registerConfiguredShortcut('stop', stopHotkey, () => {
      if (canStopRecording(this.recordingLifecycleState)) {
        this.dependencies.logger.info(`${stopHotkey} pressed, stopping recording`);
        this.setRecordingLifecycleState('stopping');
        this.dependencies.windowManager.getMainWindow()?.webContents.send('stop-recording');
      } else {
        this.dependencies.logger.info(
          `${stopHotkey} pressed while recording cannot stop:`,
          this.recordingLifecycleState,
        );
      }
    });
    this.dependencies.logger.info(`${stopHotkey} stop shortcut registered:`, stopRegistered);

    const cancelRegistered = this.registerConfiguredShortcut('cancel', cancelHotkey, () => {
      const window = this.dependencies.windowManager.getMainWindow();
      handleCancelShortcut(canCancelRecording(this.recordingLifecycleState), {
        cancelPrettify: () => {
          const result = this.dependencies.cancelSelectedTextPrettify();
          if (result) {
            this.dependencies.logger.info(`${cancelHotkey} pressed, cancelling prettify`);
            this.updateTrayIconForRecordingLifecycle();
          }
          return Boolean(result);
        },
        cancelRecording: () => {
          this.dependencies.logger.info(`${cancelHotkey} pressed, cancelling recording`);
          this.setRecordingLifecycleState('idle');
          window?.webContents.send('cancel-recording');
        },
      });
    });
    this.dependencies.logger.info(`${cancelHotkey} cancel shortcut registered:`, cancelRegistered);

    const translateRegistered = this.registerConfiguredShortcut('translate', translateHotkey, () => {
      const selectedTextBusy = Boolean(this.dependencies.getActiveSelectedTextAction());
      const currentSettings = this.dependencies.getSettings();
      if (!canRunTranslateShortcut(this.recordingLifecycleState, currentSettings.translateEnabled, selectedTextBusy)) {
        if (currentSettings.translateEnabled) {
          this.dependencies.logger.info(`${translateHotkey} pressed while translation cannot run`, {
            recordingLifecycleState: this.recordingLifecycleState,
            selectedTextBusy,
          });
        } else {
          this.dependencies.logger.info(`${translateHotkey} pressed while translation is disabled`);
        }
        return;
      }

      this.dependencies.logger.info(`${translateHotkey} pressed, translating selected text`);
      const resultPromise = this.dependencies.selectedTextTranslationService.translateSelectedTextToClipboard();
      this.sendTextActionStatus({ action: 'translation', phase: 'working' });
      void resolveTextActionStatus('translation', resultPromise).then((resolution) => {
        this.reportTextActionFailure(resolution.failureLogMetadata);
        this.sendTextActionStatus(resolution.status);
      });
    });
    this.dependencies.logger.info(`${translateHotkey} translate shortcut registered:`, translateRegistered);

    const prettifyRegistered = this.registerConfiguredShortcut('prettify', prettifyHotkey, () => {
      const selectedTextBusy = Boolean(this.dependencies.getActiveSelectedTextAction());
      const currentSettings = this.dependencies.getSettings();
      if (!canRunPrettifyShortcut(this.recordingLifecycleState, currentSettings.prettifyEnabled, selectedTextBusy)) {
        if (currentSettings.prettifyEnabled) {
          this.dependencies.logger.info(`${prettifyHotkey} pressed while prettify cannot run`, {
            recordingLifecycleState: this.recordingLifecycleState,
            selectedTextBusy,
          });
        } else {
          this.dependencies.logger.info(`${prettifyHotkey} pressed while prettify is disabled`);
        }
        return;
      }

      this.dependencies.logger.info(`${prettifyHotkey} pressed, prettifying selected text`);
      const resultPromise = this.dependencies.prettifySelectedText();
      this.dependencies.trayController.updateIcon('prettifying');
      this.sendTextActionStatus({ action: 'prettify', phase: 'working' });
      void resolveTextActionStatus('prettify', resultPromise).then((resolution) => {
        this.reportTextActionFailure(resolution.failureLogMetadata);
        this.sendTextActionStatus(resolution.status);
        this.updateTrayIconForRecordingLifecycle();
      });
    });
    this.dependencies.logger.info(`${prettifyHotkey} prettify shortcut registered:`, prettifyRegistered);

    this.syncRetryTranscriptionShortcut();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dependencies.globalShortcut.unregisterAll();
    this.registeredRetryTranscriptionHotkey = null;
    this.conflictingHotkeyTargets.clear();
  }

  private normalizeHotkeyForPlatform(hotkey: string): string {
    if (this.dependencies.platform === 'darwin') {
      return hotkey.replace(/\bSuper\b/g, 'Command');
    }
    return hotkey.replace(/\bCommand\b/g, 'Super');
  }

  private registerConfiguredShortcut(target: HotkeyTarget, hotkey: string, callback: () => void): boolean {
    if (this.conflictingHotkeyTargets.has(target)) {
      this.dependencies.logger.warn(
        `Skipped ${target} shortcut because its key conflicts with another configured shortcut:`,
        hotkey,
      );
      return false;
    }
    return this.dependencies.globalShortcut.register(hotkey, callback);
  }

  private unregisterRetryTranscriptionShortcut(): void {
    if (!this.registeredRetryTranscriptionHotkey) return;
    this.dependencies.globalShortcut.unregister(this.registeredRetryTranscriptionHotkey);
    this.dependencies.logger.info(
      `${this.registeredRetryTranscriptionHotkey} resend transcription shortcut unregistered`,
    );
    this.registeredRetryTranscriptionHotkey = null;
  }

  private syncRetryTranscriptionShortcut(): void {
    if (this.disposed || this.shortcutsSuspended || this.conflictingHotkeyTargets.has('retryTranscription')) {
      this.unregisterRetryTranscriptionShortcut();
      return;
    }

    const retryHotkey = this.normalizeHotkeyForPlatform(this.dependencies.getSettings().retryTranscriptionHotkey);
    if (!canRunRetryTranscriptionShortcut(this.recordingLifecycleState, this.retryTranscriptionAvailable)) {
      this.unregisterRetryTranscriptionShortcut();
      return;
    }
    if (this.registeredRetryTranscriptionHotkey === retryHotkey) return;

    this.unregisterRetryTranscriptionShortcut();
    const registered = this.registerConfiguredShortcut('retryTranscription', retryHotkey, () => {
      if (!canRunRetryTranscriptionShortcut(this.recordingLifecycleState, this.retryTranscriptionAvailable)) {
        this.dependencies.logger.info(`${retryHotkey} pressed while resend transcription is unavailable`);
        return;
      }

      const window = this.dependencies.windowManager.getMainWindow();
      if (!window) {
        this.dependencies.logger.info(`${retryHotkey} pressed without an available main window`);
        return;
      }

      this.dependencies.logger.info(`${retryHotkey} pressed, resending transcription audio`);
      this.retryTranscriptionAvailable = false;
      this.setRecordingLifecycleState('retrying');
      this.unregisterRetryTranscriptionShortcut();
      window.webContents.send('retry-transcription');
    });
    this.registeredRetryTranscriptionHotkey = registered ? retryHotkey : null;
    this.dependencies.logger.info(`${retryHotkey} resend transcription shortcut registered:`, registered);
  }

  private sendTextActionStatus(status: TextActionStatus): void {
    this.dependencies.windowManager.getMainWindow()?.webContents.send('translation-status', status);
  }

  private reportTextActionFailure(failureLogMetadata: TextActionStatusResolution['failureLogMetadata']): void {
    if (failureLogMetadata) {
      this.dependencies.logger.warn('Selected-text action shortcut failed:', failureLogMetadata);
    }
  }

  private updateTrayIconForRecordingLifecycle(): void {
    this.dependencies.trayController.updateIcon(getTrayIconStateForRecordingLifecycle(this.recordingLifecycleState));
  }
}

function shouldShowRecordingStatusIndicator(state: RecordingLifecycleState): boolean {
  return state === 'starting' || state === 'recording' || state === 'paused' || state === 'stopping';
}

export function handleCancelShortcut(isCurrentlyRecording: boolean, actions: CancelShortcutActions): boolean {
  if (isCurrentlyRecording) {
    actions.cancelRecording();
    return true;
  }
  return actions.cancelPrettify();
}

export function getTextActionStatus(
  action: TextActionStatusAction,
  result: TextActionResultForStatus,
): TextActionStatus {
  if (result.skipped) return { action, phase: 'skipped' };
  if (result.cancelled) return { action, phase: 'cancelled' };
  return { action, phase: result.success ? 'completed' : 'failed' };
}

/** Settles an action to one renderer-safe terminal status while retaining only safe failure diagnostics. */
export async function resolveTextActionStatus(
  action: TextActionStatusAction,
  resultPromise: Promise<TextActionResultForStatus>,
): Promise<TextActionStatusResolution> {
  try {
    return { status: getTextActionStatus(action, await resultPromise) };
  } catch (error: unknown) {
    return {
      failureLogMetadata: {
        action,
        ...presentNotificationError(error, { context: action }).safeLogMetadata,
      },
      status: { action, phase: 'failed' },
    };
  }
}

function isRecordingBusy(state: RecordingLifecycleState | boolean): boolean {
  return typeof state === 'boolean' ? state : isRecordingLifecycleBusy(state);
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
