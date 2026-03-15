import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onToggleRecording: (callback: (isRecording: boolean) => void) => {
    ipcRenderer.on('toggle-recording', (_event, isRecording: boolean) => {
      callback(isRecording);
    });
  },
  getRecordingStatus: (): Promise<boolean> => {
    return ipcRenderer.invoke('get-recording-status');
  },
  chatgptLogin: (): Promise<{ success: boolean; path?: string; error?: string }> => {
    return ipcRenderer.invoke('chatgpt-login');
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
});
