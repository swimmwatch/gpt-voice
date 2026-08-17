import type { IpcRendererEvent } from 'electron';
import type {
  BackgroundBrowserStatus,
  ElectronAPI,
  ProviderInfo,
  ProviderSettings,
  ProviderSettingsSaveInput,
} from '../renderer/types';
import type { CloakBrowserSettingsInput, CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';
import type { AppInfo } from '@shared/appInfo';
import type { AppSettingsSectionId } from '@shared/appSettings';
import type { AppLocaleId } from '@shared/appLocale';
import type { HotkeySettings, HotkeyTarget } from '@shared/hotkeys';
import type { SystemNotificationOptions } from '@shared/notifications';
import type {
  PrettifyModelListResult,
  PrettifyModelLoadResult,
  PrettifyModelUnloadResult,
  PrettifyCliConnectionResult,
  PrettifyCliProviderId,
  KnownPrettifyProviderId,
  PrettifyProviderSettingsInput,
  PrettifySettings,
  PrettifySettingsInput,
} from '@shared/prettifySettings';
import {
  isVoiceRecordingStartRejectionReason,
  isVoiceRecordingStartResult,
  VOICE_RECORDING_IPC_CHANNELS,
  type RecordingLifecycleState,
  type VoiceRecordingStartRejectionReason,
  type VoiceRecordingStartResult,
} from '@shared/recordingLifecycle';
import type {
  TranscriptionHistoryClearResult,
  TranscriptionHistoryCopyResult,
  TranscriptionHistoryPage,
  TranscriptionHistoryQuery,
} from '@shared/transcriptionHistory';
import type { TextActionSettings, TextActionSettingsInput } from '@shared/textActionSettings';
import { sanitizeTextActionStatus, type TextActionStatus } from '@shared/textActionStatus';
import {
  TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS,
  isTranslationProviderConnectionState,
  sanitizeTranslationProviderConnectionState,
  type TranslationProviderConnectionState,
  type TranslationSettings,
  type TranslationSettingsSaveResult,
} from '@shared/translationProvider';
import {
  DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS,
  type DiagnosticCaptureClearRequest,
  type DiagnosticCaptureClearResult,
  type DiagnosticCaptureSettings,
  type DiagnosticCaptureSettingsMutationRequest,
  type DiagnosticCaptureSettingsMutationResult,
} from '@shared/diagnosticCaptureSettings';
import {
  STREAMING_TRANSCRIPTION_IPC_CHANNELS,
  type CancelStreamingTranscriptionIpcResult,
  type FinishStreamingTranscriptionIpcResult,
  type SendStreamingTranscriptionChunkIpcResult,
  type StartStreamingTranscriptionIpcResult,
  type StreamingTranscriptionOperationId,
} from '@shared/streamingTranscription';
import { DIAGNOSTICS_EXPORT_IPC_CHANNEL, type DiagnosticsExportResult } from '@shared/diagnosticsArchive';
import {
  PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS,
  type PrettifyProfileExportRequest,
  type PrettifyProfileExportResult,
  type PrettifyProfileImportApplyRequest,
  type PrettifyProfileImportApplyResult,
  type PrettifyProfileImportRequest,
  type PrettifyProfileImportResult,
} from '@shared/prettifyProfilePortability';
import {
  PRETTIFY_PROFILE_CATALOG_IPC_CHANNELS,
  type PrettifyCustomProfileIdAllocationRequest,
  type PrettifyCustomProfileIdAllocationResult,
  type PrettifyProfileCatalogSaveResult,
  type PrettifyProfileCatalogSettingsSnapshot,
} from '@shared/prettifyProfileCatalogIpc';
import type { PrettifyProfileCatalog } from '@shared/prettifyProfiles';
import {
  FIRST_LAUNCH_STARTUP_IPC_CHANNELS,
  sanitizeFirstLaunchStartupSnapshot,
  type FirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';
import { MAIN_INTERACTION_LOCK_IPC_CHANNELS, isMainInteractionLockState } from '@shared/mainInteractionLock';
import { SETTINGS_PRESENTATION_IPC_CHANNELS, isSettingsPresentationState } from '@shared/settingsPresentation';
import { TEXT_ACTION_ACTIVITY_IPC_CHANNELS, isTextActionActivityState } from '@shared/textActionStatus';
import {
  isProviderHomeActionCommand,
  isProviderHomeActionResult,
  isProviderHomeActionState,
  PROVIDER_HOME_ACTION_IPC_CHANNELS,
  type ProviderHomeActionCommand,
  type ProviderHomeActionResult,
  type ProviderHomeActionState,
} from '@shared/providerHomeAction';
import {
  LOCAL_WHISPER_IPC_CHANNELS,
  isLocalWhisperMainStatusSnapshot,
  isLocalWhisperMainResidencyCommand,
  isLocalWhisperMainResidencyCommandResult,
  isLocalWhisperIpcAcknowledgement,
  isLocalWhisperProviderSelectionResult,
  isLocalWhisperRendererSnapshot,
  isLocalWhisperSettingsCommand,
  isLocalWhisperSettingsCommandResult,
  type LocalWhisperIpcAcknowledgement,
  type LocalWhisperMainStatusSnapshot,
  type LocalWhisperMainResidencyCommand,
  type LocalWhisperMainResidencyCommandResult,
  type LocalWhisperProviderSelectionResult,
  type LocalWhisperRendererSnapshot,
  type LocalWhisperSettingsCommand,
  type LocalWhisperSettingsCommandResult,
} from '@shared/localWhisper';
import { PROVIDER_SETTINGS_IPC_CHANNELS } from '@shared/voiceProvider';

type Unsubscribe = () => void;
export interface ElectronApiIpcRenderer {
  invoke<Result = unknown>(channel: string, ...args: unknown[]): Promise<Result>;
  on(channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void;
}

/** Builds the renderer-safe preload API without reading Electron globals. */
export function createElectronApi(ipcRenderer: ElectronApiIpcRenderer): ElectronAPI {
  const onMainEvent = <Args extends unknown[]>(channel: string, callback: (...args: Args) => void): Unsubscribe => {
    const listener = (_event: IpcRendererEvent, ...args: unknown[]): void => {
      callback(...(args as Args));
    };

    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };

  const onDecodedEvent = <Value>(
    channel: string,
    decoder: (value: unknown) => value is Value,
    callback: (value: Value) => void,
  ): Unsubscribe => {
    return onMainEvent<[unknown]>(channel, (value) => {
      if (decoder(value)) callback(value);
    });
  };

  return {
    onToggleRecording: (callback: (isRecording: boolean) => void) => {
      return onMainEvent<[boolean]>('toggle-recording', (isRecording) => callback(Boolean(isRecording)));
    },
    onCancelRecording: (callback: () => void) => {
      return onMainEvent('cancel-recording', callback);
    },
    onPauseRecording: (callback: () => void) => {
      return onMainEvent('pause-recording', callback);
    },
    onResumeRecording: (callback: () => void) => {
      return onMainEvent('resume-recording', callback);
    },
    onStopRecording: (callback: () => void) => {
      return onMainEvent('stop-recording', callback);
    },
    onRetryTranscription: (callback: () => void) => {
      return onMainEvent('retry-transcription', callback);
    },
    onTranslationStatus: (callback: (status: TextActionStatus | null) => void) => {
      return onMainEvent<[unknown]>('translation-status', (status) => callback(sanitizeTextActionStatus(status)));
    },
    onTranslationProviderConnectionChanged: (callback: (state: TranslationProviderConnectionState) => void) => {
      return onMainEvent<[unknown]>(TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.changed, (state) => {
        if (isTranslationProviderConnectionState(state)) callback(state);
      });
    },
    getFirstLaunchStartupSnapshot: async (): Promise<FirstLaunchStartupSnapshot> => {
      const snapshot = await ipcRenderer.invoke<unknown>(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.snapshotQuery);
      const safeSnapshot = sanitizeFirstLaunchStartupSnapshot(snapshot);
      if (!safeSnapshot) throw new Error('Invalid first-launch startup snapshot');
      return safeSnapshot;
    },
    retryFirstLaunchStartup: async (): Promise<FirstLaunchStartupSnapshot> => {
      const snapshot = await ipcRenderer.invoke<unknown>(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.retry);
      const safeSnapshot = sanitizeFirstLaunchStartupSnapshot(snapshot);
      if (!safeSnapshot) throw new Error('Invalid first-launch startup snapshot');
      return safeSnapshot;
    },
    onFirstLaunchStartupSnapshot: (callback: (snapshot: FirstLaunchStartupSnapshot) => void): (() => void) => {
      return onMainEvent<[unknown]>(FIRST_LAUNCH_STARTUP_IPC_CHANNELS.changed, (snapshot) => {
        const safeSnapshot = sanitizeFirstLaunchStartupSnapshot(snapshot);
        if (safeSnapshot) callback(safeSnapshot);
      });
    },
    recordingStartFailed: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('recording-start-failed');
    },
    requestRecordingStart: async (): Promise<VoiceRecordingStartResult> => {
      const result = await ipcRenderer.invoke<unknown>(VOICE_RECORDING_IPC_CHANNELS.requestStart);
      if (!isVoiceRecordingStartResult(result)) throw new Error('Invalid recording start result');
      return result;
    },
    onRecordingStartRejected: (callback: (reason: VoiceRecordingStartRejectionReason) => void): (() => void) => {
      return onMainEvent<[unknown]>(VOICE_RECORDING_IPC_CHANNELS.startRejected, (reason) => {
        if (isVoiceRecordingStartRejectionReason(reason)) callback(reason);
      });
    },
    setRecordingLifecycleState: (state: RecordingLifecycleState): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('set-recording-lifecycle-state', state);
    },
    setRetryTranscriptionAvailable: (available: boolean): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('set-retry-transcription-available', available);
    },
    getRecordingStatus: (): Promise<boolean> => {
      return ipcRenderer.invoke('get-recording-status');
    },
    getMainInteractionLocked: async (): Promise<boolean> => {
      const value = await ipcRenderer.invoke<unknown>(MAIN_INTERACTION_LOCK_IPC_CHANNELS.query);
      return isMainInteractionLockState(value) ? value : false;
    },
    onMainInteractionLockChanged: (callback: (locked: boolean) => void): (() => void) => {
      return onMainEvent<[unknown]>(MAIN_INTERACTION_LOCK_IPC_CHANNELS.changed, (value) => {
        if (isMainInteractionLockState(value)) callback(value);
      });
    },
    getSettingsPresentation: async () => {
      const value = await ipcRenderer.invoke<unknown>(SETTINGS_PRESENTATION_IPC_CHANNELS.query);
      return isSettingsPresentationState(value) ? value : 'idle';
    },
    onSettingsPresentationChanged: (callback) => {
      return onMainEvent<[unknown]>(SETTINGS_PRESENTATION_IPC_CHANNELS.changed, (value) => {
        if (isSettingsPresentationState(value)) callback(value);
      });
    },
    focusSettingsWindow: async () => {
      const value = await ipcRenderer.invoke<unknown>(SETTINGS_PRESENTATION_IPC_CHANNELS.focus);
      return value === true;
    },
    getTextActionActivity: async (): Promise<boolean> => {
      const value = await ipcRenderer.invoke<unknown>(TEXT_ACTION_ACTIVITY_IPC_CHANNELS.query);
      return isTextActionActivityState(value) ? value : true;
    },
    onTextActionActivityChanged: (callback: (active: boolean) => void): (() => void) => {
      return onMainEvent<[unknown]>(TEXT_ACTION_ACTIVITY_IPC_CHANNELS.changed, (value) => {
        if (isTextActionActivityState(value)) callback(value);
      });
    },
    providerLogin: (providerId: string): Promise<{ success: boolean; settings?: ProviderSettings; error?: string }> => {
      return ipcRenderer.invoke('provider-login', providerId);
    },
    getProviders: (): Promise<ProviderInfo[]> => {
      return ipcRenderer.invoke('get-providers');
    },
    getProviderSettings: (providerId: string): Promise<ProviderSettings> => {
      return ipcRenderer.invoke('get-provider-settings', providerId);
    },
    openProviderSettings: (providerId: string): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('open-provider-settings', providerId);
    },
    closeProviderSettings: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('close-provider-settings');
    },
    onProviderSettingsCloseRequested: (callback: () => void): (() => void) => {
      return onMainEvent(PROVIDER_SETTINGS_IPC_CHANNELS.closeRequested, callback);
    },
    onProviderSettingsChanged: (callback: (settings: ProviderSettings) => void): (() => void) => {
      return onMainEvent<[ProviderSettings]>('provider-settings-changed', callback);
    },
    closeAppSettings: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('close-app-settings');
    },
    onAppSettingsCloseRequested: (callback: () => void): (() => void) => {
      const listener = (): void => callback();
      ipcRenderer.on('app-settings-close-requested', listener);
      return () => ipcRenderer.removeListener('app-settings-close-requested', listener);
    },
    onAppSettingsSectionRequested: (callback: (section: AppSettingsSectionId) => void): (() => void) => {
      return onMainEvent<[AppSettingsSectionId]>('app-settings-section-requested', callback);
    },
    openAppSettings: (section?: AppSettingsSectionId): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('open-app-settings', section);
    },
    openTranscriptionHistory: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('open-transcription-history');
    },
    openAbout: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('open-about');
    },
    closeAbout: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('close-about');
    },
    getAppInfo: (): Promise<AppInfo> => {
      return ipcRenderer.invoke('get-app-info');
    },
    exportDiagnostics: (): Promise<DiagnosticsExportResult> => {
      return ipcRenderer.invoke(DIAGNOSTICS_EXPORT_IPC_CHANNEL);
    },
    exportPrettifyProfiles: (request: PrettifyProfileExportRequest): Promise<PrettifyProfileExportResult> => {
      return ipcRenderer.invoke(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.export, request);
    },
    importPrettifyProfiles: (request: PrettifyProfileImportRequest): Promise<PrettifyProfileImportResult> => {
      return ipcRenderer.invoke(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.import, request);
    },
    applyPrettifyProfileImport: (
      request: PrettifyProfileImportApplyRequest,
    ): Promise<PrettifyProfileImportApplyResult> => {
      return ipcRenderer.invoke(PRETTIFY_PROFILE_PORTABILITY_IPC_CHANNELS.applyImport, request);
    },
    getPrettifyProfileCatalog: (): Promise<PrettifyProfileCatalogSettingsSnapshot> => {
      return ipcRenderer.invoke(PRETTIFY_PROFILE_CATALOG_IPC_CHANNELS.get);
    },
    savePrettifyProfileCatalog: (catalog: PrettifyProfileCatalog): Promise<PrettifyProfileCatalogSaveResult> => {
      return ipcRenderer.invoke(PRETTIFY_PROFILE_CATALOG_IPC_CHANNELS.save, catalog);
    },
    allocatePrettifyCustomProfileId: (
      request: PrettifyCustomProfileIdAllocationRequest,
    ): Promise<PrettifyCustomProfileIdAllocationResult> => {
      return ipcRenderer.invoke(PRETTIFY_PROFILE_CATALOG_IPC_CHANNELS.allocateCustomId, request);
    },
    getCloakBrowserSettings: (): Promise<CloakBrowserSettingsView> => {
      return ipcRenderer.invoke('get-cloakbrowser-settings');
    },
    saveCloakBrowserSettings: (
      settings: CloakBrowserSettingsInput,
    ): Promise<{
      success: boolean;
      settings?: CloakBrowserSettingsView;
      backgroundStatus?: BackgroundBrowserStatus;
      error?: string;
    }> => {
      return ipcRenderer.invoke('save-cloakbrowser-settings', settings);
    },
    saveProviderSettings: (
      providerId: string,
      settings: ProviderSettingsSaveInput,
    ): Promise<{ success: boolean; settings?: ProviderSettings; error?: string }> => {
      return ipcRenderer.invoke('save-provider-settings', providerId, settings);
    },
    clearProviderAuth: (
      providerId: string,
    ): Promise<{ success: boolean; settings?: ProviderSettings; error?: string }> => {
      return ipcRenderer.invoke('clear-provider-auth', providerId);
    },
    getActiveProvider: (): Promise<string> => {
      return ipcRenderer.invoke('get-active-provider');
    },
    setActiveProvider: async (providerId: string): Promise<LocalWhisperProviderSelectionResult> => {
      const result = await ipcRenderer.invoke<unknown>('set-active-provider', providerId);
      if (!isLocalWhisperProviderSelectionResult(result)) throw new Error('Invalid provider-selection response');
      return result;
    },
    getLocalWhisperSettingsSnapshot: async (): Promise<LocalWhisperRendererSnapshot> => {
      const snapshot = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.settingsQuery);
      if (!isLocalWhisperRendererSnapshot(snapshot)) throw new Error('Invalid Local Whisper settings snapshot');
      return snapshot;
    },
    subscribeLocalWhisperSettings: async (): Promise<LocalWhisperRendererSnapshot> => {
      const snapshot = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.settingsSubscribe);
      if (!isLocalWhisperRendererSnapshot(snapshot)) throw new Error('Invalid Local Whisper settings subscription');
      return snapshot;
    },
    unsubscribeLocalWhisperSettings: async (): Promise<LocalWhisperIpcAcknowledgement> => {
      const result = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.settingsUnsubscribe);
      if (!isLocalWhisperIpcAcknowledgement(result)) throw new Error('Invalid Local Whisper unsubscribe response');
      return result;
    },
    onLocalWhisperSettingsSnapshot: (callback: (snapshot: LocalWhisperRendererSnapshot) => void): (() => void) => {
      return onDecodedEvent(LOCAL_WHISPER_IPC_CHANNELS.settingsChanged, isLocalWhisperRendererSnapshot, callback);
    },
    runLocalWhisperSettingsCommand: async (
      command: LocalWhisperSettingsCommand,
    ): Promise<LocalWhisperSettingsCommandResult> => {
      if (!isLocalWhisperSettingsCommand(command)) throw new Error('Invalid Local Whisper settings command');
      const result = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.settingsCommand, command);
      if (!isLocalWhisperSettingsCommandResult(result)) throw new Error('Invalid Local Whisper command response');
      return result;
    },
    getLocalWhisperMainStatus: async (): Promise<LocalWhisperMainStatusSnapshot> => {
      const snapshot = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.mainStatusQuery);
      if (!isLocalWhisperMainStatusSnapshot(snapshot)) throw new Error('Invalid Local Whisper main status');
      return snapshot;
    },
    subscribeLocalWhisperMainStatus: async (): Promise<LocalWhisperMainStatusSnapshot> => {
      const snapshot = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.mainStatusSubscribe);
      if (!isLocalWhisperMainStatusSnapshot(snapshot)) throw new Error('Invalid Local Whisper main subscription');
      return snapshot;
    },
    unsubscribeLocalWhisperMainStatus: async (): Promise<LocalWhisperIpcAcknowledgement> => {
      const result = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.mainStatusUnsubscribe);
      if (!isLocalWhisperIpcAcknowledgement(result)) throw new Error('Invalid Local Whisper unsubscribe response');
      return result;
    },
    onLocalWhisperMainStatus: (callback: (snapshot: LocalWhisperMainStatusSnapshot) => void): (() => void) => {
      return onDecodedEvent(LOCAL_WHISPER_IPC_CHANNELS.mainStatusChanged, isLocalWhisperMainStatusSnapshot, callback);
    },
    runLocalWhisperMainResidencyCommand: async (
      command: LocalWhisperMainResidencyCommand,
    ): Promise<LocalWhisperMainResidencyCommandResult> => {
      if (!isLocalWhisperMainResidencyCommand(command)) throw new Error('Invalid Local Whisper main command');
      const result = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.mainResidencyCommand, command);
      if (!isLocalWhisperMainResidencyCommandResult(result)) {
        throw new Error('Invalid Local Whisper main command response');
      }
      return result;
    },
    openLocalWhisperSettings: async (): Promise<LocalWhisperIpcAcknowledgement> => {
      const result = await ipcRenderer.invoke<unknown>(LOCAL_WHISPER_IPC_CHANNELS.mainOpenSettings);
      if (!isLocalWhisperIpcAcknowledgement(result)) throw new Error('Invalid Local Whisper open-settings response');
      return result;
    },
    checkSession: (): Promise<boolean> => {
      return ipcRenderer.invoke('check-session');
    },
    transcribeAudio: (
      buffer: ArrayBuffer,
      mimeType: string,
    ): Promise<{ success: boolean; text?: string; error?: string }> => {
      return ipcRenderer.invoke('transcribe-audio', buffer, mimeType);
    },
    startStreamingTranscription: (): Promise<StartStreamingTranscriptionIpcResult> => {
      return ipcRenderer.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.start);
    },
    sendStreamingTranscriptionChunk: (
      operationId: StreamingTranscriptionOperationId,
      sequence: number,
      chunk: Uint8Array,
    ): Promise<SendStreamingTranscriptionChunkIpcResult> => {
      return ipcRenderer.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.sendChunk, operationId, sequence, chunk);
    },
    finishStreamingTranscription: (
      operationId: StreamingTranscriptionOperationId,
      sequence: number,
      finalChunk: Uint8Array,
      recordingWav: ArrayBuffer,
    ): Promise<FinishStreamingTranscriptionIpcResult> => {
      return ipcRenderer.invoke(
        STREAMING_TRANSCRIPTION_IPC_CHANNELS.finish,
        operationId,
        sequence,
        finalChunk,
        recordingWav,
      );
    },
    cancelStreamingTranscription: (
      operationId: StreamingTranscriptionOperationId,
    ): Promise<CancelStreamingTranscriptionIpcResult> => {
      return ipcRenderer.invoke(STREAMING_TRANSCRIPTION_IPC_CHANNELS.cancel, operationId);
    },
    translateText: (text: string, targetLang: string): Promise<{ success: boolean; text?: string; error?: string }> => {
      return ipcRenderer.invoke('translate-text', text, targetLang);
    },
    getTranscriptionHistory: (query: TranscriptionHistoryQuery = {}): Promise<TranscriptionHistoryPage> => {
      return ipcRenderer.invoke('get-transcription-history', query);
    },
    copyTranscriptionHistoryText: (id: number): Promise<TranscriptionHistoryCopyResult> => {
      return ipcRenderer.invoke('copy-transcription-history-text', id);
    },
    clearTranscriptionHistory: (): Promise<TranscriptionHistoryClearResult> => {
      return ipcRenderer.invoke('clear-transcription-history');
    },
    showNotification: (title: string, body: string, options?: SystemNotificationOptions): Promise<void> => {
      return ipcRenderer.invoke('show-notification', title, body, options);
    },
    isBgReady: (): Promise<boolean> => {
      return ipcRenderer.invoke('is-bg-ready');
    },
    getBgBrowserStatus: (): Promise<BackgroundBrowserStatus> => {
      return ipcRenderer.invoke('get-bg-browser-status');
    },
    onBgBrowserReady: (callback: (providerId: string) => void) => {
      return onMainEvent<[string]>('bg-browser-ready', (providerId) => callback(String(providerId)));
    },
    onBgBrowserError: (callback: (providerId: string, error: string, authExpired: boolean) => void) => {
      return onMainEvent<[string, string, boolean]>('bg-browser-error', (providerId, error, authExpired) =>
        callback(String(providerId), String(error), Boolean(authExpired)),
      );
    },
    onHotkeySettingsChanged: (callback: (settings: HotkeySettings) => void) => {
      return onMainEvent<[HotkeySettings]>('hotkey-settings-changed', callback);
    },
    onPrettifySettingsChanged: (callback: (settings: PrettifySettings) => void) => {
      return onMainEvent<[PrettifySettings]>('prettify-settings-changed', callback);
    },
    onLocaleChanged: (callback: (locale: AppLocaleId) => void): (() => void) => {
      return onMainEvent<[AppLocaleId]>('locale-changed', callback);
    },
    getHotkey: (): Promise<HotkeySettings> => {
      return ipcRenderer.invoke('get-hotkey');
    },
    setHotkeyCaptureActive: (active: boolean): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('set-hotkey-capture-active', active);
    },
    setHotkey: (
      key: HotkeyTarget,
      hotkey: string,
    ): Promise<
      {
        success: boolean;
        error?: string;
      } & HotkeySettings
    > => {
      return ipcRenderer.invoke('set-hotkey', key, hotkey);
    },
    getTranslateSettings: (): Promise<TranslationSettings> => {
      return ipcRenderer.invoke('get-translate-settings');
    },
    getTranslationProviderConnection: async (): Promise<TranslationProviderConnectionState> => {
      const state = await ipcRenderer.invoke<unknown>(TRANSLATION_PROVIDER_CONNECTION_IPC_CHANNELS.get);
      return sanitizeTranslationProviderConnectionState(state);
    },
    getTextActionSettings: (): Promise<TextActionSettings> => {
      return ipcRenderer.invoke('get-text-action-settings');
    },
    getProviderHomeActionState: async (): Promise<ProviderHomeActionState> => {
      const state = await ipcRenderer.invoke<unknown>(PROVIDER_HOME_ACTION_IPC_CHANNELS.snapshotQuery);
      if (!isProviderHomeActionState(state)) throw new Error('Invalid provider home action state');
      return state;
    },
    runProviderHomeAction: async (command: ProviderHomeActionCommand): Promise<ProviderHomeActionResult> => {
      if (!isProviderHomeActionCommand(command)) throw new Error('Invalid provider home action command');
      const result = await ipcRenderer.invoke<unknown>(PROVIDER_HOME_ACTION_IPC_CHANNELS.command, command);
      if (!isProviderHomeActionResult(result)) throw new Error('Invalid provider home action result');
      return result;
    },
    onProviderHomeActionStateChanged: (callback: (state: ProviderHomeActionState) => void): (() => void) => {
      return onDecodedEvent(PROVIDER_HOME_ACTION_IPC_CHANNELS.snapshotChanged, isProviderHomeActionState, callback);
    },
    getDiagnosticCaptureSettings: (): Promise<DiagnosticCaptureSettings> => {
      return ipcRenderer.invoke(DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS.get);
    },
    setDiagnosticCaptureSettings: (
      request: DiagnosticCaptureSettingsMutationRequest,
    ): Promise<DiagnosticCaptureSettingsMutationResult> => {
      return ipcRenderer.invoke(DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS.set, request);
    },
    clearDiagnosticCapture: (request: DiagnosticCaptureClearRequest): Promise<DiagnosticCaptureClearResult> => {
      return ipcRenderer.invoke(DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS.clear, request);
    },
    setTextActionSettings: (
      settings: TextActionSettingsInput,
    ): Promise<{ success: boolean; settings: TextActionSettings }> => {
      return ipcRenderer.invoke('set-text-action-settings', settings);
    },
    setTranslateSettings: (settings: TranslationSettings): Promise<TranslationSettingsSaveResult> => {
      return ipcRenderer.invoke('set-translate-settings', settings);
    },
    getPrettifySettings: (): Promise<PrettifySettings> => {
      return ipcRenderer.invoke('get-prettify-settings');
    },
    checkPrettifyCliConnection: (providerId: PrettifyCliProviderId): Promise<PrettifyCliConnectionResult> => {
      return ipcRenderer.invoke('check-prettify-cli-connection', providerId);
    },
    setPrettifySettings: (
      settings: PrettifyProviderSettingsInput,
    ): Promise<{ success: boolean; settings: PrettifySettings; error?: string }> => {
      return ipcRenderer.invoke('set-prettify-settings', settings);
    },
    listPrettifyModels: (
      providerId: KnownPrettifyProviderId,
      settings: PrettifySettingsInput,
    ): Promise<PrettifyModelListResult> => {
      return ipcRenderer.invoke('list-prettify-models', providerId, settings);
    },
    loadPrettifyModel: (
      providerId: KnownPrettifyProviderId,
      settings: PrettifySettingsInput,
    ): Promise<PrettifyModelLoadResult> => {
      return ipcRenderer.invoke('load-prettify-model', providerId, settings);
    },
    unloadPrettifyModel: (
      providerId: KnownPrettifyProviderId,
      settings: PrettifySettingsInput,
    ): Promise<PrettifyModelUnloadResult> => {
      return ipcRenderer.invoke('unload-prettify-model', providerId, settings);
    },
    getTranslations: (): Promise<Record<string, string>> => {
      return ipcRenderer.invoke('get-translations');
    },
    getLocale: (): Promise<AppLocaleId> => {
      return ipcRenderer.invoke('get-locale');
    },
    getSupportedLocales: (): Promise<AppLocaleId[]> => {
      return ipcRenderer.invoke('get-supported-locales');
    },
    setLocale: (locale: AppLocaleId): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('set-locale', locale);
    },
    getPlatform: (): Promise<NodeJS.Platform> => {
      return ipcRenderer.invoke('get-platform');
    },
  };
}
