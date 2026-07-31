import { contextBridge, ipcRenderer } from 'electron';
import { createPrettifyProfileChooserApi } from './prettifyProfileChooserPreloadApi';

contextBridge.exposeInMainWorld('electronAPI', createPrettifyProfileChooserApi(ipcRenderer));
