import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  BackgroundBrowserStatus,
  OpenAIApiProviderSettings,
  ProviderInfo,
  ProviderSettings,
} from '../renderer/types';
import type { CloakBrowserSettingsInput, CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';
import type { HotkeySettings, HotkeyTarget } from '@shared/hotkeys';
import type { PrettifySettings, PrettifySettingsInput } from '@shared/prettifySettings';

type Unsubscribe = () => void;

function onMainEvent<Args extends unknown[]>(channel: string, callback: (...args: Args) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, ...args: Args): void => {
    callback(...args);
  };

  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
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
  onTranslationStatus: (callback: (status: string) => void) => {
    return onMainEvent<[string]>('translation-status', (status) => callback(String(status)));
  },
  recordingStartFailed: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('recording-start-failed');
  },
  getRecordingStatus: (): Promise<boolean> => {
    return ipcRenderer.invoke('get-recording-status');
  },
  providerLogin: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('provider-login');
  },
  getProviders: (): Promise<ProviderInfo[]> => {
    return ipcRenderer.invoke('get-providers');
  },
  getProviderSettings: (providerId: string): Promise<ProviderSettings> => {
    return ipcRenderer.invoke('get-provider-settings', providerId);
  },
  closeAppSettings: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('close-app-settings');
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
    settings: Partial<OpenAIApiProviderSettings> & { apiKey?: string },
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
  setActiveProvider: (providerId: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('set-active-provider', providerId);
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
  translateText: (text: string, targetLang: string): Promise<{ success: boolean; text?: string; error?: string }> => {
    return ipcRenderer.invoke('translate-text', text, targetLang);
  },
  showNotification: (title: string, body: string): Promise<void> => {
    return ipcRenderer.invoke('show-notification', title, body);
  },
  isBgReady: (): Promise<boolean> => {
    return ipcRenderer.invoke('is-bg-ready');
  },
  getBgBrowserStatus: (): Promise<BackgroundBrowserStatus> => {
    return ipcRenderer.invoke('get-bg-browser-status');
  },
  onBgBrowserReady: (callback: () => void) => {
    return onMainEvent('bg-browser-ready', callback);
  },
  onBgBrowserError: (callback: (error: string, authExpired: boolean) => void) => {
    return onMainEvent<[string, boolean]>('bg-browser-error', (error, authExpired) =>
      callback(String(error), Boolean(authExpired)),
    );
  },
  onHotkeySettingsChanged: (callback: (settings: HotkeySettings) => void) => {
    return onMainEvent<[HotkeySettings]>('hotkey-settings-changed', callback);
  },
  getHotkey: (): Promise<HotkeySettings> => {
    return ipcRenderer.invoke('get-hotkey');
  },
  setHotkey: (
    key: HotkeyTarget,
    hotkey: string,
  ): Promise<
    {
      success: boolean;
    } & HotkeySettings
  > => {
    return ipcRenderer.invoke('set-hotkey', key, hotkey);
  },
  getTranslateSettings: (): Promise<{ targetLang: string }> => {
    return ipcRenderer.invoke('get-translate-settings');
  },
  setTranslateSettings: (targetLang: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('set-translate-settings', targetLang);
  },
  getPrettifySettings: (): Promise<PrettifySettings> => {
    return ipcRenderer.invoke('get-prettify-settings');
  },
  setPrettifySettings: (settings: PrettifySettingsInput): Promise<{ success: boolean; settings: PrettifySettings }> => {
    return ipcRenderer.invoke('set-prettify-settings', settings);
  },
  getTranslations: (): Promise<Record<string, string>> => {
    return ipcRenderer.invoke('get-translations');
  },
  getLocale: (): Promise<string> => {
    return ipcRenderer.invoke('get-locale');
  },
  getSupportedLocales: (): Promise<string[]> => {
    return ipcRenderer.invoke('get-supported-locales');
  },
  setLocale: (locale: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('set-locale', locale);
  },
  getPlatform: (): Promise<NodeJS.Platform> => {
    return ipcRenderer.invoke('get-platform');
  },
});
