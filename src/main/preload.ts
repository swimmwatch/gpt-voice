import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onToggleRecording: (callback: (isRecording: boolean) => void) => {
    ipcRenderer.removeAllListeners('toggle-recording');
    ipcRenderer.on('toggle-recording', (_event, isRecording: boolean) => {
      callback(isRecording);
    });
  },
  onCancelRecording: (callback: () => void) => {
    ipcRenderer.removeAllListeners('cancel-recording');
    ipcRenderer.on('cancel-recording', () => callback());
  },
  onPauseRecording: (callback: () => void) => {
    ipcRenderer.removeAllListeners('pause-recording');
    ipcRenderer.on('pause-recording', () => callback());
  },
  onResumeRecording: (callback: () => void) => {
    ipcRenderer.removeAllListeners('resume-recording');
    ipcRenderer.on('resume-recording', () => callback());
  },
  onStopRecording: (callback: () => void) => {
    ipcRenderer.removeAllListeners('stop-recording');
    ipcRenderer.on('stop-recording', () => callback());
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
  getProviders: (): Promise<{ id: string; name: string }[]> => {
    return ipcRenderer.invoke('get-providers');
  },
  getActiveProvider: (): Promise<string> => {
    return ipcRenderer.invoke('get-active-provider');
  },
  setActiveProvider: (providerId: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('set-active-provider', providerId);
  },
  checkSession: (): Promise<boolean> => {
    return ipcRenderer.invoke('check-session');
  },
  transcribeAudio: (buffer: ArrayBuffer): Promise<{ success: boolean; text?: string; error?: string }> => {
    return ipcRenderer.invoke('transcribe-audio', buffer);
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
  getBgBrowserStatus: (): Promise<{ ready: boolean; error?: string }> => {
    return ipcRenderer.invoke('get-bg-browser-status');
  },
  onBgBrowserReady: (callback: () => void) => {
    ipcRenderer.removeAllListeners('bg-browser-ready');
    ipcRenderer.on('bg-browser-ready', () => callback());
  },
  onBgBrowserError: (callback: (error: string) => void) => {
    ipcRenderer.removeAllListeners('bg-browser-error');
    ipcRenderer.on('bg-browser-error', (_event, error: string) => callback(error));
  },
  getHotkey: (): Promise<{ hotkey: string; cancelHotkey: string; stopHotkey: string }> => {
    return ipcRenderer.invoke('get-hotkey');
  },
  setHotkey: (
    key: string,
    hotkey: string,
  ): Promise<{ success: boolean; hotkey: string; cancelHotkey: string; stopHotkey: string }> => {
    return ipcRenderer.invoke('set-hotkey', key, hotkey);
  },
  getTranslateSettings: (): Promise<{ translate: boolean; targetLang: string }> => {
    return ipcRenderer.invoke('get-translate-settings');
  },
  setTranslateSettings: (translate: boolean, targetLang: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('set-translate-settings', translate, targetLang);
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
});
