import type { IpcRendererEvent } from 'electron';
import { isAppLocaleId } from '@shared/appLocale';
import { PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS, type PrettifyProfileChooserAPI } from '@shared/prettifyProfileChooser';

type ChooserIpcListener = (event: IpcRendererEvent, ...args: unknown[]) => void;

export interface PrettifyProfileChooserIpcRenderer {
  invoke<Result = unknown>(channel: string, ...args: unknown[]): Promise<Result>;
  on(channel: string, listener: ChooserIpcListener): void;
  removeListener(channel: string, listener: ChooserIpcListener): void;
}

/** Builds the capability-minimal chooser preload API without Electron globals. */
export function createPrettifyProfileChooserApi(
  ipcRenderer: PrettifyProfileChooserIpcRenderer,
): PrettifyProfileChooserAPI {
  return {
    apply: (token, profileId) => ipcRenderer.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.apply, token, profileId),
    cancel: (token) => ipcRenderer.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.cancel, token),
    getLocale: () => ipcRenderer.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getLocale),
    getTranslations: () => ipcRenderer.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getTranslations),
    loadPayload: () => ipcRenderer.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.load),
    manageProfiles: (token) => ipcRenderer.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.manageProfiles, token),
    onLocaleChanged: (callback) => {
      const listener: ChooserIpcListener = (_event, locale) => {
        if (isAppLocaleId(locale)) callback(locale);
      };
      ipcRenderer.on(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged, listener);
      return () => ipcRenderer.removeListener(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged, listener);
    },
    ready: (token) => ipcRenderer.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.ready, token),
  };
}
