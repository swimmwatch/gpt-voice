import type { AppInfo } from '@shared/appInfo';
import type { ClaudeWebSettings, ClaudeWebSettingsUpdateInput } from '@shared/claudeWebSettings';
import type { CloakBrowserSettingsInput, CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';
import type { HotkeySettings, HotkeyTarget } from '@shared/hotkeys';
import type { SystemNotificationOptions } from '@shared/notifications';
import type { OpenAIApiTranscriptionLanguage, OpenAIApiTranscriptionModel } from '@shared/openaiApiTranscription';
import type {
  PrettifyModelListResult,
  PrettifyModelLoadResult,
  PrettifyModelUnloadResult,
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
export type ProviderCategory = 'web' | 'api' | 'local';

export interface BackgroundBrowserStatus {
  ready: boolean;
  error?: string;
  authExpired?: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  authType: ProviderAuthType;
  category: ProviderCategory;
  hasSettings: boolean;
}

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
  onTranslationStatus: (callback: (status: string) => void) => () => void;
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
  openAppSettings: () => Promise<{ success: boolean }>;
  openTranscriptionHistory: () => Promise<{ success: boolean }>;
  openAbout: () => Promise<{ success: boolean }>;
  closeAbout: () => Promise<{ success: boolean }>;
  getAppInfo: () => Promise<AppInfo>;
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
  onPrettifySettingsChanged: (callback: (settings: PrettifySettings) => void) => () => void;
  getHotkey: () => Promise<HotkeySettings>;
  setHotkeyCaptureActive: (active: boolean) => Promise<{ success: boolean }>;
  setHotkey: (key: HotkeyTarget, hotkey: string) => Promise<{ success: boolean; error?: string } & HotkeySettings>;
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
  loadPrettifyModel: (
    providerId: PrettifyProviderId,
    settings: PrettifySettingsInput,
  ) => Promise<PrettifyModelLoadResult>;
  unloadPrettifyModel: (
    providerId: PrettifyProviderId,
    settings: PrettifySettingsInput,
  ) => Promise<PrettifyModelUnloadResult>;
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
