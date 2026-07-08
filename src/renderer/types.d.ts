import type { TRANSCRIPTION_MODEL_WHISPER_1 } from '@shared/transcriptionConstants';
import type { CloakBrowserSettingsInput, CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';
import type { HotkeySettings, HotkeyTarget } from '@shared/hotkeys';
import type { SystemNotificationOptions } from '@shared/notifications';
import type {
  PrettifyModelListResult,
  PrettifyProviderId,
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

export type ProviderAuthType = 'browserSession' | 'apiKey';

export interface BackgroundBrowserStatus {
  ready: boolean;
  error?: string;
  authExpired?: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  authType: ProviderAuthType;
}

export interface OpenAIApiProviderSettings {
  providerId: 'openai-api';
  authType: 'apiKey';
  hasApiKey: boolean;
  model: typeof TRANSCRIPTION_MODEL_WHISPER_1;
  language: 'auto' | 'en' | 'ru' | 'uk' | 'be';
  prompt: string;
  temperature: number;
}

export interface BrowserSessionProviderSettings {
  providerId: string;
  authType: 'browserSession';
  hasSession: boolean;
}

export type ProviderSettings = OpenAIApiProviderSettings | BrowserSessionProviderSettings;

export interface ElectronAPI {
  onToggleRecording: (callback: (isRecording: boolean) => void) => () => void;
  onCancelRecording: (callback: () => void) => () => void;
  onPauseRecording: (callback: () => void) => () => void;
  onResumeRecording: (callback: () => void) => () => void;
  onStopRecording: (callback: () => void) => () => void;
  onRetryTranscription: (callback: () => void) => () => void;
  onTranslationStatus: (callback: (status: string) => void) => () => void;
  recordingStartFailed: () => Promise<{ success: boolean }>;
  setRecordingLifecycleState: (state: RecordingLifecycleState) => Promise<{ success: boolean }>;
  setRetryTranscriptionAvailable: (available: boolean) => Promise<{ success: boolean }>;
  getRecordingStatus: () => Promise<boolean>;
  providerLogin: () => Promise<{ success: boolean; error?: string }>;
  getProviders: () => Promise<ProviderInfo[]>;
  getProviderSettings: (providerId: string) => Promise<ProviderSettings>;
  closeAppSettings: () => Promise<{ success: boolean }>;
  getCloakBrowserSettings: () => Promise<CloakBrowserSettingsView>;
  saveCloakBrowserSettings: (settings: CloakBrowserSettingsInput) => Promise<{
    success: boolean;
    settings?: CloakBrowserSettingsView;
    backgroundStatus?: BackgroundBrowserStatus;
    error?: string;
  }>;
  saveProviderSettings: (
    providerId: string,
    settings: Partial<OpenAIApiProviderSettings> & { apiKey?: string },
  ) => Promise<{ success: boolean; settings?: ProviderSettings; error?: string }>;
  clearProviderAuth: (providerId: string) => Promise<{ success: boolean; settings?: ProviderSettings; error?: string }>;
  getActiveProvider: () => Promise<string>;
  setActiveProvider: (providerId: string) => Promise<{ success: boolean; error?: string }>;
  checkSession: () => Promise<boolean>;
  transcribeAudio: (
    buffer: ArrayBuffer,
    mimeType: string,
  ) => Promise<{ success: boolean; text?: string; error?: string }>;
  translateText: (text: string, targetLang: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  getTranscriptionHistory: (query?: TranscriptionHistoryQuery) => Promise<TranscriptionHistoryPage>;
  copyTranscriptionHistoryText: (id: number) => Promise<TranscriptionHistoryCopyResult>;
  clearTranscriptionHistory: () => Promise<TranscriptionHistoryClearResult>;
  showNotification: (title: string, body: string, options?: SystemNotificationOptions) => Promise<void>;
  isBgReady: () => Promise<boolean>;
  getBgBrowserStatus: () => Promise<BackgroundBrowserStatus>;
  onBgBrowserReady: (callback: () => void) => () => void;
  onBgBrowserError: (callback: (error: string, authExpired: boolean) => void) => () => void;
  onHotkeySettingsChanged: (callback: (settings: HotkeySettings) => void) => () => void;
  getHotkey: () => Promise<HotkeySettings>;
  setHotkey: (key: HotkeyTarget, hotkey: string) => Promise<{ success: boolean } & HotkeySettings>;
  getTranslateSettings: () => Promise<{ targetLang: string }>;
  getTextActionSettings: () => Promise<TextActionSettings>;
  setTextActionSettings: (
    settings: TextActionSettingsInput,
  ) => Promise<{ success: boolean; settings: TextActionSettings }>;
  setTranslateSettings: (targetLang: string) => Promise<{ success: boolean }>;
  getPrettifySettings: () => Promise<PrettifySettings>;
  setPrettifySettings: (settings: PrettifySettingsInput) => Promise<{ success: boolean; settings: PrettifySettings }>;
  listPrettifyModels: (
    providerId: PrettifyProviderId,
    settings: PrettifySettingsInput,
  ) => Promise<PrettifyModelListResult>;
  getTranslations: () => Promise<Record<string, string>>;
  getLocale: () => Promise<string>;
  getSupportedLocales: () => Promise<string[]>;
  setLocale: (locale: string) => Promise<{ success: boolean }>;
  getPlatform: () => Promise<NodeJS.Platform>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
