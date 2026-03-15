export interface ElectronAPI {
  onToggleRecording: (callback: (isRecording: boolean) => void) => void;
  getRecordingStatus: () => Promise<boolean>;
  chatgptLogin: () => Promise<{ success: boolean; path?: string; error?: string }>;
  checkSession: () => Promise<boolean>;
  transcribeAudio: (buffer: ArrayBuffer) => Promise<{ success: boolean; text?: string; error?: string }>;
  translateText: (text: string, targetLang: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  showNotification: (title: string, body: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
