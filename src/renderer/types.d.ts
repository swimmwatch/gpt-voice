export interface ElectronAPI {
  onToggleRecording: (callback: (isRecording: boolean) => void) => void;
  onCancelRecording: (callback: () => void) => void;
  onPauseRecording: (callback: () => void) => void;
  onResumeRecording: (callback: () => void) => void;
  onStopRecording: (callback: () => void) => void;
  getRecordingStatus: () => Promise<boolean>;
  providerLogin: () => Promise<{ success: boolean; error?: string }>;
  getProviders: () => Promise<{ id: string; name: string }[]>;
  getActiveProvider: () => Promise<string>;
  setActiveProvider: (providerId: string) => Promise<{ success: boolean }>;
  checkSession: () => Promise<boolean>;
  transcribeAudio: (buffer: ArrayBuffer) => Promise<{ success: boolean; text?: string; error?: string }>;
  translateText: (text: string, targetLang: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  showNotification: (title: string, body: string) => Promise<void>;
  isBgReady: () => Promise<boolean>;
  onBgBrowserReady: (callback: () => void) => void;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
