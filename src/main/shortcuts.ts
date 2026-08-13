import {
  canRunRetryTranscriptionHotkey,
  canRunTextActionHotkey,
  getConflictingHotkeyTargets,
  normalizeHotkeyForPlatform,
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
import {
  TEXT_ACTION_ACTIVITY_IPC_CHANNELS,
  type TextActionStatus,
  type TextActionStatusAction,
} from '@shared/textActionStatus';
import type { I18nService } from './i18n';
import { MainInteractionLock } from '@shared/mainInteractionLock';
import type { SelectedTextActionGate } from './services/selectedTextActionState';
import type { SelectedTextPrettifyService } from './services/selectedTextPrettify';
import type { SelectedTextTranslationRunObserver } from './services/selectedTextTranslation';
import type { PrettifyRuntime } from './services/prettifyProviders';
import { getTrayIconStateForRecordingLifecycle } from './trayIconState';
import type { TrayController } from './tray';
import type { WindowManager } from './window';
import type { AppConfigStore } from './config';
import type { ProviderHomeActionDispatcher } from './providerHomeActionDispatcher';

interface CancelShortcutActions {
  cancelPrettify: () => boolean;
  cancelRecording: () => void;
  cancelTranslation: () => boolean;
}

export interface TextActionResultForStatus {
  cancelled?: true;
  skipped?: true;
  success: boolean;
}

export interface SelectedTextTranslationShortcutService {
  cancel(): boolean;
  translateSelectedTextToClipboard(observer?: SelectedTextTranslationRunObserver): Promise<TextActionResultForStatus>;
}

export interface TextActionStatusResolution {
  failureLogMetadata?: NotificationErrorLogMetadata & { action: TextActionStatusAction };
  status: TextActionStatus;
}

export interface ShortcutSettingsSnapshot extends HotkeySettings {
  readonly prettifyEnabled: boolean;
  readonly prettifyQuickEnabled: boolean;
  readonly translateEnabled: boolean;
}

export interface ShortcutControllerDependencies {
  readonly config: Pick<AppConfigStore, 'getSnapshot'>;
  readonly globalShortcut: {
    register(accelerator: string, callback: () => void): boolean;
    unregister(accelerator: string): void;
    unregisterAll(): void;
  };
  readonly logger: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
  };
  readonly localization: Pick<I18nService, 'translate'>;
  readonly mainInteractionLock: MainInteractionLock;
  readonly notification: {
    show(title: string, body: string): void;
  };
  readonly platform: NodeJS.Platform;
  readonly prettifyRuntime: Pick<PrettifyRuntime, 'isProviderConnected'>;
  readonly providerHomeActionDispatcher: Pick<ProviderHomeActionDispatcher, 'dispatch'>;
  readonly selectedTextActionGate: Pick<SelectedTextActionGate, 'getActive' | 'subscribe'>;
  readonly selectedTextPrettifyService: Pick<
    SelectedTextPrettifyService,
    'applyDefaultProfileToSelectedText' | 'cancel' | 'chooseProfileForSelectedText' | 'focusExistingChooser'
  >;
  readonly selectedTextTranslationService: SelectedTextTranslationShortcutService;
  readonly trayController: Pick<TrayController, 'updateIcon'>;
  readonly windowManager: Pick<WindowManager, 'getMainWindow'>;
}

type ShortcutSuspensionReason = 'hotkey-capture' | 'settings-window';

/** Owns global hotkeys and the recording lifecycle state that gates them. */
export class ShortcutController {
  private conflictingHotkeyTargets = new Set<HotkeyTarget>();
  private disposed = false;
  private readonly mainInteractionLockUnsubscribe: () => void;
  private readonly selectedTextActionGateUnsubscribe: () => void;
  private recordingLifecycleState: RecordingLifecycleState = 'idle';
  private registeredRetryTranscriptionHotkey: string | null = null;
  private retryTranscriptionAvailable = false;
  private shortcutsSuspended = false;
  private readonly suspensionReasons = new Set<ShortcutSuspensionReason>();

  public constructor(private readonly dependencies: ShortcutControllerDependencies) {
    this.mainInteractionLockUnsubscribe = dependencies.mainInteractionLock.subscribe((locked) => {
      this.setSuspension('settings-window', locked);
    });
    this.selectedTextActionGateUnsubscribe = dependencies.selectedTextActionGate.subscribe((action) => {
      this.sendTextActionActivity(action !== null);
    });
  }

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
    this.dependencies.mainInteractionLock.setRecordingLifecycleState(state);
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
    this.setSuspension('hotkey-capture', suspended);
  }

  private setSuspension(reason: ShortcutSuspensionReason, suspended: boolean): void {
    if (this.disposed) return;
    const wasSuspended = this.shortcutsSuspended;
    if (suspended) {
      this.suspensionReasons.add(reason);
    } else {
      this.suspensionReasons.delete(reason);
    }
    this.shortcutsSuspended = this.suspensionReasons.size > 0;
    if (wasSuspended === this.shortcutsSuspended) return;
    if (this.shortcutsSuspended) {
      this.dependencies.globalShortcut.unregisterAll();
      this.registeredRetryTranscriptionHotkey = null;
      this.dependencies.logger.info('Global shortcuts suspended');
      return;
    }

    this.dependencies.logger.info('Global shortcuts resumed');
    this.register();
  }

  /** Registers every configured shortcut while preserving lifecycle gates. */
  /** Registers the current non-conflicting global shortcut set. */
  public register(): void {
    if (this.disposed) return;
    const settings = this.dependencies.config.getSnapshot();
    this.dependencies.globalShortcut.unregisterAll();
    this.registeredRetryTranscriptionHotkey = null;
    this.conflictingHotkeyTargets = new Set(getConflictingHotkeyTargets(settings, this.dependencies.platform));

    if (this.shortcutsSuspended) {
      this.dependencies.logger.info('Skipped global shortcut registration while hotkey capture is active');
      return;
    }

    const recordHotkey = this.normalizeHotkeyForPlatform(settings.hotkey);
    const stopHotkey = this.normalizeHotkeyForPlatform(settings.stopHotkey);
    const cancelHotkey = this.normalizeHotkeyForPlatform(settings.cancelHotkey);
    const translateHotkey = this.normalizeHotkeyForPlatform(settings.translateHotkey);
    const prettifyHotkey = this.normalizeHotkeyForPlatform(settings.prettifyHotkey);
    const prettifyQuickHotkey = this.normalizeHotkeyForPlatform(settings.prettifyQuickHotkey);

    const recordRegistered = this.registerConfiguredShortcut('record', recordHotkey, () => {
      const window = this.dependencies.windowManager.getMainWindow();
      if (canStartRecording(this.recordingLifecycleState) && !this.dependencies.selectedTextActionGate.getActive()) {
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
          const result = this.dependencies.providerHomeActionDispatcher.dispatch(
            { action: 'cancel', provider: 'prettify' },
            'escape',
          ).accepted;
          if (result) {
            this.dependencies.logger.info(`${cancelHotkey} pressed, cancelling prettify`);
            this.updateTrayIconForRecordingLifecycle();
          }
          return result;
        },
        cancelRecording: () => {
          this.dependencies.logger.info(`${cancelHotkey} pressed, cancelling recording`);
          this.setRecordingLifecycleState('idle');
          window?.webContents.send('cancel-recording');
        },
        cancelTranslation: () => {
          const result = this.dependencies.providerHomeActionDispatcher.dispatch(
            { action: 'cancel', provider: 'translation' },
            'escape',
          ).accepted;
          if (result) this.dependencies.logger.info(`${cancelHotkey} pressed, cancelling translation`);
          return result;
        },
      });
    });
    this.dependencies.logger.info(`${cancelHotkey} cancel shortcut registered:`, cancelRegistered);

    const translateRegistered = this.registerConfiguredShortcut('translate', translateHotkey, () => {
      const result = this.dependencies.providerHomeActionDispatcher.dispatch(
        { action: 'start', provider: 'translation' },
        'global-shortcut',
      );
      if (!result.accepted) this.dependencies.logger.info(`${translateHotkey} pressed while translation cannot run`);
    });
    this.dependencies.logger.info(`${translateHotkey} translate shortcut registered:`, translateRegistered);

    const prettifyRegistered = this.registerConfiguredShortcut('prettify', prettifyHotkey, () => {
      this.runPrettifyShortcut('prettify', prettifyHotkey);
    });
    this.dependencies.logger.info(`${prettifyHotkey} prettify shortcut registered:`, prettifyRegistered);

    const prettifyQuickRegistered = this.registerConfiguredShortcut('prettifyQuick', prettifyQuickHotkey, () => {
      this.runPrettifyShortcut('prettifyQuick', prettifyQuickHotkey);
    });
    this.dependencies.logger.info(
      `${prettifyQuickHotkey} quick prettify shortcut registered:`,
      prettifyQuickRegistered,
    );

    this.syncRetryTranscriptionShortcut();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mainInteractionLockUnsubscribe();
    this.selectedTextActionGateUnsubscribe();
    this.dependencies.globalShortcut.unregisterAll();
    this.registeredRetryTranscriptionHotkey = null;
    this.conflictingHotkeyTargets.clear();
  }

  private normalizeHotkeyForPlatform(hotkey: string): string {
    return normalizeHotkeyForPlatform(hotkey, this.dependencies.platform) ?? hotkey;
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

  private runPrettifyShortcut(target: 'prettify' | 'prettifyQuick', hotkey: string): void {
    if (target === 'prettify') {
      const result = this.dependencies.providerHomeActionDispatcher.dispatch(
        { action: 'start', provider: 'prettify' },
        'global-shortcut',
      );
      if (!result.accepted) this.dependencies.logger.info(`${hotkey} pressed while Prettify cannot run`);
      return;
    }

    const currentSettings = this.dependencies.config.getSnapshot();
    const targetEnabled = currentSettings.prettifyQuickEnabled;
    if (!targetEnabled) {
      this.dependencies.logger.info(`${hotkey} pressed while prettify is disabled`, { target });
      return;
    }

    const providerId = currentSettings.prettifySettings.providerId;
    if (!this.dependencies.prettifyRuntime.isProviderConnected(providerId)) {
      this.dependencies.logger.info(`${hotkey} pressed while Prettify provider is not connected`, {
        providerId,
        target,
      });
      this.sendTextActionStatus({ action: 'prettify', phase: 'failed' });
      this.showPrettifyDisconnectedNotification();
      return;
    }

    if (this.dependencies.selectedTextPrettifyService.focusExistingChooser()) {
      this.dependencies.logger.info(`${hotkey} pressed, focusing active Prettify chooser`, { target });
      return;
    }

    const selectedTextBusy = Boolean(this.dependencies.selectedTextActionGate.getActive());
    if (!canRunPrettifyShortcut(this.recordingLifecycleState, targetEnabled, selectedTextBusy)) {
      if (targetEnabled) {
        this.dependencies.logger.info(`${hotkey} pressed while prettify cannot run`, {
          recordingLifecycleState: this.recordingLifecycleState,
          selectedTextBusy,
          target,
        });
      } else {
        this.dependencies.logger.info(`${hotkey} pressed while prettify is disabled`, { target });
      }
      return;
    }

    this.dependencies.logger.info(`${hotkey} pressed, starting quick Prettify action`);
    let generationPresentationStarted = false;
    const observer = {
      onGenerationStarted: (): void => {
        if (generationPresentationStarted) return;
        generationPresentationStarted = true;
        this.dependencies.trayController.updateIcon('prettifying');
        this.sendTextActionStatus({ action: 'prettify', phase: 'working' });
      },
    };
    const resultPromise = this.dependencies.selectedTextPrettifyService.applyDefaultProfileToSelectedText(observer);
    void resolveTextActionStatus('prettify', resultPromise).then((resolution) => {
      this.reportTextActionFailure(resolution.failureLogMetadata);
      this.sendTextActionStatus(resolution.status);
      if (generationPresentationStarted) this.updateTrayIconForRecordingLifecycle();
    });
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

    const retryHotkey = this.normalizeHotkeyForPlatform(
      this.dependencies.config.getSnapshot().retryTranscriptionHotkey,
    );
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

  private sendTextActionActivity(active: boolean): void {
    this.dependencies.windowManager
      .getMainWindow()
      ?.webContents.send(TEXT_ACTION_ACTIVITY_IPC_CHANNELS.changed, active);
  }

  private reportTextActionFailure(failureLogMetadata: TextActionStatusResolution['failureLogMetadata']): void {
    if (failureLogMetadata) {
      this.dependencies.logger.warn('Selected-text action shortcut failed:', failureLogMetadata);
    }
  }

  private showPrettifyDisconnectedNotification(): void {
    try {
      const failure = this.dependencies.localization.translate('status.prettifyFailed');
      const disconnected = this.dependencies.localization.translate('provider.notConnected');
      this.dependencies.notification.show('GPT-Voice', `${failure}: ${disconnected}`);
    } catch {
      this.dependencies.logger.warn('Failed to show disconnected Prettify provider notification');
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
  return actions.cancelPrettify() || actions.cancelTranslation();
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
