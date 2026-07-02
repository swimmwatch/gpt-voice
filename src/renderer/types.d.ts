import type { TRANSCRIPTION_MODEL_WHISPER_1 } from '@shared/transcriptionConstants';

export type ProviderAuthType = 'browserSession' | 'apiKey';

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
  recordingStartFailed: () => Promise<{ success: boolean }>;
  getRecordingStatus: () => Promise<boolean>;
  providerLogin: () => Promise<{ success: boolean; error?: string }>;
  getProviders: () => Promise<ProviderInfo[]>;
  getProviderSettings: (providerId: string) => Promise<ProviderSettings>;
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
  showNotification: (title: string, body: string) => Promise<void>;
  isBgReady: () => Promise<boolean>;
  getBgBrowserStatus: () => Promise<{ ready: boolean; error?: string; authExpired?: boolean }>;
  onBgBrowserReady: (callback: () => void) => () => void;
  onBgBrowserError: (callback: (error: string, authExpired: boolean) => void) => () => void;
  getHotkey: () => Promise<{ hotkey: string; cancelHotkey: string; stopHotkey: string }>;
  setHotkey: (
    key: string,
    hotkey: string,
  ) => Promise<{ success: boolean; hotkey: string; cancelHotkey: string; stopHotkey: string }>;
  getTranslateSettings: () => Promise<{ translate: boolean; targetLang: string }>;
  setTranslateSettings: (translate: boolean, targetLang: string) => Promise<{ success: boolean }>;
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
