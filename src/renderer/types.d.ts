import type { AppInfo } from '@shared/appInfo';
import type { AppSettingsSectionId } from '@shared/appSettings';
import type { AppLocaleId } from '@shared/appLocale';
import type { ClaudeWebSettings, ClaudeWebSettingsUpdateInput } from '@shared/claudeWebSettings';
import type { CloakBrowserSettingsInput, CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';
import type { HotkeySettings, HotkeyTarget } from '@shared/hotkeys';
import type { SystemNotificationOptions } from '@shared/notifications';
import type { OpenAIApiTranscriptionLanguage, OpenAIApiTranscriptionModel } from '@shared/openaiApiTranscription';
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
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import type {
  TranscriptionHistoryClearResult,
  TranscriptionHistoryCopyResult,
  TranscriptionHistoryPage,
  TranscriptionHistoryQuery,
} from '@shared/transcriptionHistory';
import type { TextActionSettings, TextActionSettingsInput } from '@shared/textActionSettings';
import type { TextActionStatus } from '@shared/textActionStatus';
import type {
  TranslationProviderConnectionState,
  TranslationSettings,
  TranslationSettingsSaveResult,
} from '@shared/translationProvider';
import type {
  DiagnosticCaptureClearRequest,
  DiagnosticCaptureClearResult,
  DiagnosticCaptureSettings,
  DiagnosticCaptureSettingsMutationRequest,
  DiagnosticCaptureSettingsMutationResult,
} from '@shared/diagnosticCaptureSettings';
import type {
  CancelStreamingTranscriptionIpcResult,
  FinishStreamingTranscriptionIpcResult,
  SendStreamingTranscriptionChunkIpcResult,
  StartStreamingTranscriptionIpcResult,
  StreamingTranscriptionOperationId,
} from '@shared/streamingTranscription';
import type { DiagnosticsExportResult } from '@shared/diagnosticsArchive';
import type {
  PrettifyProfileExportRequest,
  PrettifyProfileExportResult,
  PrettifyProfileImportApplyRequest,
  PrettifyProfileImportApplyResult,
  PrettifyProfileImportRequest,
  PrettifyProfileImportResult,
} from '@shared/prettifyProfilePortability';
import type {
  PrettifyCustomProfileIdAllocationRequest,
  PrettifyCustomProfileIdAllocationResult,
  PrettifyProfileCatalogSaveResult,
  PrettifyProfileCatalogSettingsSnapshot,
} from '@shared/prettifyProfileCatalogIpc';
import type { PrettifyProfileCatalog } from '@shared/prettifyProfiles';
import type {
  RendererSafeVoiceProviderInfo,
  VoiceProviderAuthType,
  VoiceProviderCategory,
} from '@shared/voiceProvider';
import type {
  LocalWhisperMainStatusSnapshot,
  LocalWhisperMainResidencyCommand,
  LocalWhisperMainResidencyCommandResult,
  LocalWhisperIpcAcknowledgement,
  LocalWhisperProviderSelectionResult,
  LocalWhisperRendererSnapshot,
  LocalWhisperSettingsCommand,
  LocalWhisperSettingsCommandResult,
} from '@shared/localWhisper';

export type ProviderAuthType = VoiceProviderAuthType;
export type ProviderCategory = VoiceProviderCategory;

export interface BackgroundBrowserStatus {
  providerId?: string;
  ready: boolean;
  error?: string;
  authExpired?: boolean;
  unselected?: boolean;
}

export type ProviderInfo = RendererSafeVoiceProviderInfo;

export interface OpenAIApiProviderSettings {
  providerId: 'openai-api';
  authType: 'apiKey';
  hasApiKey: boolean;
  model: OpenAIApiTranscriptionModel;
  language: OpenAIApiTranscriptionLanguage;
  prompt: string;
  temperature: number;
}

export interface ChatGPTWebProviderSettings {
  providerId: 'chatgpt';
  authType: 'browserSession';
  hasSession: boolean;
}

export interface ClaudeWebProviderSettings extends ClaudeWebSettings {
  providerId: 'claude-web';
  authType: 'browserSession';
  hasSession: boolean;
}

export type BrowserSessionProviderSettings = ChatGPTWebProviderSettings | ClaudeWebProviderSettings;
export type ProviderSettings = OpenAIApiProviderSettings | BrowserSessionProviderSettings;
export type OpenAIApiProviderSettingsInput = Partial<OpenAIApiProviderSettings> & { apiKey?: string };
export type ProviderSettingsSaveInput = OpenAIApiProviderSettingsInput | ClaudeWebSettingsUpdateInput;

export interface ElectronAPI {
  onToggleRecording: (callback: (isRecording: boolean) => void) => () => void;
  onCancelRecording: (callback: () => void) => () => void;
  onPauseRecording: (callback: () => void) => () => void;
  onResumeRecording: (callback: () => void) => () => void;
  onStopRecording: (callback: () => void) => () => void;
  onRetryTranscription: (callback: () => void) => () => void;
  onTranslationStatus: (callback: (status: TextActionStatus | null) => void) => () => void;
  onTranslationProviderConnectionChanged: (callback: (state: TranslationProviderConnectionState) => void) => () => void;
  recordingStartFailed: () => Promise<{ success: boolean }>;
  setRecordingLifecycleState: (state: RecordingLifecycleState) => Promise<{ success: boolean }>;
  setRetryTranscriptionAvailable: (available: boolean) => Promise<{ success: boolean }>;
  getRecordingStatus: () => Promise<boolean>;
  providerLogin: (providerId: string) => Promise<{ success: boolean; settings?: ProviderSettings; error?: string }>;
  getProviders: () => Promise<ProviderInfo[]>;
  getProviderSettings: (providerId: string) => Promise<ProviderSettings>;
  openProviderSettings: (providerId: string) => Promise<{ success: boolean; error?: string }>;
  closeProviderSettings: () => Promise<{ success: boolean }>;
  onProviderSettingsChanged: (callback: (settings: ProviderSettings) => void) => () => void;
  closeAppSettings: () => Promise<{ success: boolean }>;
  onAppSettingsCloseRequested: (callback: () => void) => () => void;
  onAppSettingsSectionRequested: (callback: (section: AppSettingsSectionId) => void) => () => void;
  openAppSettings: (section?: AppSettingsSectionId) => Promise<{ success: boolean; error?: string }>;
  openTranscriptionHistory: () => Promise<{ success: boolean }>;
  openAbout: () => Promise<{ success: boolean }>;
  closeAbout: () => Promise<{ success: boolean }>;
  getAppInfo: () => Promise<AppInfo>;
  exportDiagnostics: () => Promise<DiagnosticsExportResult>;
  exportPrettifyProfiles: (request: PrettifyProfileExportRequest) => Promise<PrettifyProfileExportResult>;
  importPrettifyProfiles: (request: PrettifyProfileImportRequest) => Promise<PrettifyProfileImportResult>;
  applyPrettifyProfileImport: (request: PrettifyProfileImportApplyRequest) => Promise<PrettifyProfileImportApplyResult>;
  getPrettifyProfileCatalog: () => Promise<PrettifyProfileCatalogSettingsSnapshot>;
  savePrettifyProfileCatalog: (catalog: PrettifyProfileCatalog) => Promise<PrettifyProfileCatalogSaveResult>;
  allocatePrettifyCustomProfileId: (
    request: PrettifyCustomProfileIdAllocationRequest,
  ) => Promise<PrettifyCustomProfileIdAllocationResult>;
  getCloakBrowserSettings: () => Promise<CloakBrowserSettingsView>;
  saveCloakBrowserSettings: (settings: CloakBrowserSettingsInput) => Promise<{
    success: boolean;
    settings?: CloakBrowserSettingsView;
    backgroundStatus?: BackgroundBrowserStatus;
    error?: string;
  }>;
  saveProviderSettings: (
    providerId: string,
    settings: ProviderSettingsSaveInput,
  ) => Promise<{ success: boolean; settings?: ProviderSettings; error?: string }>;
  clearProviderAuth: (providerId: string) => Promise<{ success: boolean; settings?: ProviderSettings; error?: string }>;
  getActiveProvider: () => Promise<string | null>;
  setActiveProvider: (providerId: string) => Promise<LocalWhisperProviderSelectionResult>;
  getLocalWhisperSettingsSnapshot: () => Promise<LocalWhisperRendererSnapshot>;
  subscribeLocalWhisperSettings: () => Promise<LocalWhisperRendererSnapshot>;
  unsubscribeLocalWhisperSettings: () => Promise<LocalWhisperIpcAcknowledgement>;
  onLocalWhisperSettingsSnapshot: (callback: (snapshot: LocalWhisperRendererSnapshot) => void) => () => void;
  runLocalWhisperSettingsCommand: (command: LocalWhisperSettingsCommand) => Promise<LocalWhisperSettingsCommandResult>;
  getLocalWhisperMainStatus: () => Promise<LocalWhisperMainStatusSnapshot>;
  subscribeLocalWhisperMainStatus: () => Promise<LocalWhisperMainStatusSnapshot>;
  unsubscribeLocalWhisperMainStatus: () => Promise<LocalWhisperIpcAcknowledgement>;
  onLocalWhisperMainStatus: (callback: (snapshot: LocalWhisperMainStatusSnapshot) => void) => () => void;
  runLocalWhisperMainResidencyCommand: (
    command: LocalWhisperMainResidencyCommand,
  ) => Promise<LocalWhisperMainResidencyCommandResult>;
  openLocalWhisperSettings: () => Promise<LocalWhisperIpcAcknowledgement>;
  checkSession: () => Promise<boolean>;
  transcribeAudio: (
    buffer: ArrayBuffer,
    mimeType: string,
  ) => Promise<{ success: boolean; text?: string; error?: string }>;
  startStreamingTranscription: () => Promise<StartStreamingTranscriptionIpcResult>;
  sendStreamingTranscriptionChunk: (
    operationId: StreamingTranscriptionOperationId,
    sequence: number,
    chunk: Uint8Array,
  ) => Promise<SendStreamingTranscriptionChunkIpcResult>;
  finishStreamingTranscription: (
    operationId: StreamingTranscriptionOperationId,
    sequence: number,
    finalChunk: Uint8Array,
    recordingWav: ArrayBuffer,
  ) => Promise<FinishStreamingTranscriptionIpcResult>;
  cancelStreamingTranscription: (
    operationId: StreamingTranscriptionOperationId,
  ) => Promise<CancelStreamingTranscriptionIpcResult>;
  translateText: (text: string, targetLang: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  getTranscriptionHistory: (query?: TranscriptionHistoryQuery) => Promise<TranscriptionHistoryPage>;
  copyTranscriptionHistoryText: (id: number) => Promise<TranscriptionHistoryCopyResult>;
  clearTranscriptionHistory: () => Promise<TranscriptionHistoryClearResult>;
  showNotification: (title: string, body: string, options?: SystemNotificationOptions) => Promise<void>;
  isBgReady: () => Promise<boolean>;
  getBgBrowserStatus: () => Promise<BackgroundBrowserStatus>;
  onBgBrowserReady: (callback: (providerId: string) => void) => () => void;
  onBgBrowserError: (callback: (providerId: string, error: string, authExpired: boolean) => void) => () => void;
  onHotkeySettingsChanged: (callback: (settings: HotkeySettings) => void) => () => void;
  onPrettifySettingsChanged: (callback: (settings: PrettifySettings) => void) => () => void;
  onLocaleChanged: (callback: (locale: AppLocaleId) => void) => () => void;
  getHotkey: () => Promise<HotkeySettings>;
  setHotkeyCaptureActive: (active: boolean) => Promise<{ success: boolean }>;
  setHotkey: (key: HotkeyTarget, hotkey: string) => Promise<{ success: boolean; error?: string } & HotkeySettings>;
  getTranslateSettings: () => Promise<TranslationSettings>;
  getTranslationProviderConnection: () => Promise<TranslationProviderConnectionState>;
  getTextActionSettings: () => Promise<TextActionSettings>;
  getDiagnosticCaptureSettings: () => Promise<DiagnosticCaptureSettings>;
  setDiagnosticCaptureSettings: (
    request: DiagnosticCaptureSettingsMutationRequest,
  ) => Promise<DiagnosticCaptureSettingsMutationResult>;
  clearDiagnosticCapture: (request: DiagnosticCaptureClearRequest) => Promise<DiagnosticCaptureClearResult>;
  setTextActionSettings: (
    settings: TextActionSettingsInput,
  ) => Promise<{ success: boolean; settings: TextActionSettings }>;
  setTranslateSettings: (settings: TranslationSettings) => Promise<TranslationSettingsSaveResult>;
  getPrettifySettings: () => Promise<PrettifySettings>;
  checkPrettifyCliConnection: (providerId: PrettifyCliProviderId) => Promise<PrettifyCliConnectionResult>;
  setPrettifySettings: (
    settings: PrettifyProviderSettingsInput,
  ) => Promise<{ success: boolean; settings: PrettifySettings; error?: string }>;
  listPrettifyModels: (
    providerId: KnownPrettifyProviderId,
    settings: PrettifySettingsInput,
  ) => Promise<PrettifyModelListResult>;
  loadPrettifyModel: (
    providerId: KnownPrettifyProviderId,
    settings: PrettifySettingsInput,
  ) => Promise<PrettifyModelLoadResult>;
  unloadPrettifyModel: (
    providerId: KnownPrettifyProviderId,
    settings: PrettifySettingsInput,
  ) => Promise<PrettifyModelUnloadResult>;
  getTranslations: () => Promise<Record<string, string>>;
  getLocale: () => Promise<AppLocaleId>;
  getSupportedLocales: () => Promise<AppLocaleId[]>;
  setLocale: (locale: AppLocaleId) => Promise<{ success: boolean; error?: string }>;
  getPlatform: () => Promise<NodeJS.Platform>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
