import { createRequire } from 'node:module';

export type ClipboardType = 'clipboard' | 'selection';

interface ClipboardRuntime {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

interface NotificationRuntime {
  new (options: { title: string; body: string }): {
    show(): void;
  };
}

interface SafeStorageRuntime {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

interface ElectronRuntimeModule {
  clipboard?: ClipboardRuntime;
  Notification?: NotificationRuntime;
  safeStorage?: SafeStorageRuntime;
}

let electronRuntime: ElectronRuntimeModule | null = null;
const loadRuntimeModule = createRequire(__filename);

function loadElectronRuntime(): ElectronRuntimeModule {
  if (!electronRuntime) {
    electronRuntime = loadRuntimeModule('electron') as ElectronRuntimeModule;
  }
  return electronRuntime;
}

function getClipboard(): ClipboardRuntime {
  const { clipboard } = loadElectronRuntime();
  if (!clipboard) {
    throw new Error('Electron clipboard API is unavailable');
  }
  return clipboard;
}

function getSafeStorage(): SafeStorageRuntime {
  const { safeStorage } = loadElectronRuntime();
  if (!safeStorage) {
    throw new Error('Electron safeStorage API is unavailable');
  }
  return safeStorage;
}

export function writeClipboardText(text: string): void {
  getClipboard().writeText(text);
}

export function readClipboardText(type?: ClipboardType): string {
  return getClipboard().readText(type);
}

export function writeTypedClipboardText(text: string, type?: ClipboardType): void {
  getClipboard().writeText(text, type);
}

export function showSystemNotification(title: string, body: string): void {
  const { Notification } = loadElectronRuntime();
  if (!Notification) {
    throw new Error('Electron notification API is unavailable');
  }
  new Notification({ title, body }).show();
}

export function isSafeStorageEncryptionAvailable(): boolean {
  return getSafeStorage().isEncryptionAvailable();
}

export function encryptSafeStorageString(plainText: string): Buffer {
  return getSafeStorage().encryptString(plainText);
}

export function decryptSafeStorageString(encrypted: Buffer): string {
  return getSafeStorage().decryptString(encrypted);
}
