import { contextBridge, ipcRenderer } from 'electron';
import { createElectronApi } from './preloadApi';

contextBridge.exposeInMainWorld('electronAPI', createElectronApi(ipcRenderer));
