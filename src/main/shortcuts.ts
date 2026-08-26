import {
  canRunRetryTranscriptionHotkey,
  canRunTextActionHotkey,
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
  type VoiceRecordingStartResult,
  type VoiceRecordingStartRejectionReason,
  VOICE_RECORDING_IPC_CHANNELS,
} from '@shared/recordingLifecycle';
import { presentNotificationError, type NotificationErrorLogMetadata } from '@shared/notifications';
import {
  TEXT_ACTION_ACTIVITY_IPC_CHANNELS,
  type TextActionStatus,
  type TextActionStatusAction,
} from '@shared/textActionStatus';
import type { I18nService } from './i18n';
import type { HotkeyRegistrationService } from './hotkeys/HotkeyRegistrationService';
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

export interface VoiceRecordingProviderReadiness {
  isReady(): boolean;
}

const RECORDING_START_ACCEPTED = Object.freeze({ accepted: true }) satisfies VoiceRecordingStartResult;
const RECORDING_START_REJECTED = Object.freeze({ accepted: false }) satisfies VoiceRecordingStartResult;
const PROVIDER_NOT_CONNECTED_REJECTION = Object.freeze({
  accepted: false,
  reason: 'provider-not-connected',
}) satisfies VoiceRecordingStartResult;

export interface ShortcutControllerDependencies {
  readonly config: Pick<AppConfigStore, 'getSnapshot'>;
  readonly hotkeyRegistrationService: Pick<HotkeyRegistrationService, 'dispose' | 'start'>;
  readonly logger: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
  };
  readonly localization: Pick<I18nService, 'translate'>;
  readonly mainInteractionLock: MainInteractionLock;
  readonly notification: {
    show(title: string, body: string): void;
  };
  readonly prettifyRuntime: Pick<PrettifyRuntime, 'isProviderConnected'>;
  readonly providerHomeActionDispatcher: Pick<ProviderHomeActionDispatcher, 'dispatch'>;
  readonly selectedTextActionGate: Pick<SelectedTextActionGate, 'getActive' | 'subscribe'>;
  readonly selectedTextPrettifyService: Pick<
    SelectedTextPrettifyService,
    'applyDefaultProfileToSelectedText' | 'cancel' | 'chooseProfileForSelectedText' | 'focusExistingChooser'
  >;
  readonly selectedTextTranslationService: SelectedTextTranslationShortcutService;
  readonly trayController: Pick<TrayController, 'updateIcon'>;
  readonly voiceRecordingProviderReadiness: VoiceRecordingProviderReadiness;
  readonly windowManager: Pick<WindowManager, 'getMainWindow'>;
}

/** Owns product hotkey callbacks and the recording lifecycle state that gates them. */
export class ShortcutController {
  private disposed = false;
  private readonly selectedTextActionGateUnsubscribe: () => void;
  private recordingLifecycleState: RecordingLifecycleState = 'idle';
  private retryTranscriptionAvailable = false;

  public constructor(private readonly dependencies: ShortcutControllerDependencies) {
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
  }

  public resetRecordingState(): void {
    this.setRecordingLifecycleState('idle');
  }

  public setRetryTranscriptionAvailable(available: boolean): void {
    this.retryTranscriptionAvailable = available;
  }

  /** Retained until Packet 04 removes the legacy capture API; capture no longer controls OS bindings. */
  public setSuspended(suspended: boolean): void {
    void suspended;
  }

  /** Authoritatively starts recording only when the active Voice Provider can transcribe. */
  public requestRecordingStart(): VoiceRecordingStartResult {
    if (
      this.dependencies.mainInteractionLock.locked ||
      !canStartRecording(this.recordingLifecycleState) ||
      this.dependencies.selectedTextActionGate.getActive()
    ) {
      return RECORDING_START_REJECTED;
    }
    if (!this.dependencies.voiceRecordingProviderReadiness.isReady()) {
      this.dependencies.logger.info('Recording start rejected because Voice Provider is not connected');
      this.sendRecordingStartRejected('provider-not-connected');
      this.showVoiceProviderNotReadyNotification();
      return PROVIDER_NOT_CONNECTED_REJECTION;
    }

    this.setRecordingLifecycleState('starting');
    this.dependencies.windowManager.getMainWindow()?.webContents.send('toggle-recording', true);
    return RECORDING_START_ACCEPTED;
  }

  /** Starts the process-owned registration service after Electron becomes ready. */
  public register(): void {
    if (this.disposed) return;
    this.dependencies.hotkeyRegistrationService.start();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.selectedTextActionGateUnsubscribe();
    this.dependencies.hotkeyRegistrationService.dispose();
  }

  /** Receives a validated, registered target from the process-owned registration service. */
  public dispatchHotkey(target: HotkeyTarget): void {
    if (this.disposed) return;
    switch (target) {
      case 'record':
        this.runRecordShortcut();
        return;
      case 'stop':
        this.runStopShortcut();
        return;
      case 'cancel':
        this.runCancelShortcut();
        return;
      case 'translate':
        this.runTranslateShortcut();
        return;
      case 'prettify':
        this.runPrettifyShortcut('prettify', this.dependencies.config.getSnapshot().prettifyHotkey);
        return;
      case 'prettifyQuick':
        this.runPrettifyShortcut('prettifyQuick', this.dependencies.config.getSnapshot().prettifyQuickHotkey);
        return;
      case 'retryTranscription':
        this.runRetryTranscriptionShortcut();
        return;
    }
  }

  private runRecordShortcut(): void {
    const recordHotkey = this.dependencies.config.getSnapshot().hotkey;
    const window = this.dependencies.windowManager.getMainWindow();
    if (canStartRecording(this.recordingLifecycleState) && !this.dependencies.selectedTextActionGate.getActive()) {
      const result = this.requestRecordingStart();
      if (result.accepted) this.dependencies.logger.info(`${recordHotkey} pressed, starting recording`);
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
  }

  private runStopShortcut(): void {
    const stopHotkey = this.dependencies.config.getSnapshot().stopHotkey;
    if (canStopRecording(this.recordingLifecycleState)) {
      this.dependencies.logger.info(`${stopHotkey} pressed, stopping recording`);
      this.setRecordingLifecycleState('stopping');
      this.dependencies.windowManager.getMainWindow()?.webContents.send('stop-recording');
      return;
    }
    this.dependencies.logger.info(`${stopHotkey} pressed while recording cannot stop:`, this.recordingLifecycleState);
  }

  private runCancelShortcut(): void {
    const cancelHotkey = this.dependencies.config.getSnapshot().cancelHotkey;
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
  }

  private runTranslateShortcut(): void {
    const translateHotkey = this.dependencies.config.getSnapshot().translateHotkey;
    const result = this.dependencies.providerHomeActionDispatcher.dispatch(
      { action: 'start', provider: 'translation' },
      'global-shortcut',
    );
    if (!result.accepted) this.dependencies.logger.info(`${translateHotkey} pressed while translation cannot run`);
  }

  private runPrettifyShortcut(target: 'prettify' | 'prettifyQuick', hotkey: string | null): void {
    if (this.dependencies.mainInteractionLock.locked) {
      this.dependencies.logger.info(`${hotkey} pressed while settings lock is active`, { target });
      return;
    }

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

  private runRetryTranscriptionShortcut(): void {
    const retryHotkey = this.dependencies.config.getSnapshot().retryTranscriptionHotkey;
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
    window.webContents.send('retry-transcription');
  }

  private sendTextActionStatus(status: TextActionStatus): void {
    this.dependencies.windowManager.getMainWindow()?.webContents.send('translation-status', status);
  }

  private sendRecordingStartRejected(reason: VoiceRecordingStartRejectionReason): void {
    this.dependencies.windowManager
      .getMainWindow()
      ?.webContents.send(VOICE_RECORDING_IPC_CHANNELS.startRejected, reason);
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

  private showVoiceProviderNotReadyNotification(): void {
    try {
      this.dependencies.notification.show(
        'GPT-Voice',
        this.dependencies.localization.translate('error.selectedProviderNotReady'),
      );
    } catch {
      this.dependencies.logger.warn('Failed to show Voice Provider readiness notification');
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
