import { createRequire } from 'node:module';
import {
  getNotificationSoundKind,
  type SystemNotificationOptions,
  type SystemNotificationSound,
} from '@shared/notifications';
import { createLogger } from './logger';

export type ClipboardType = 'clipboard' | 'selection';

const log = createLogger('electron-runtime');
const MACOS_NOTIFICATION_SOUNDS: Record<SystemNotificationSound, string> = {
  success: 'Glass',
  error: 'Basso',
};
const ERROR_BEEP_DELAY_MS = 160;

interface ClipboardRuntime {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  sound?: string;
}

interface NotificationRuntime {
  new (options: NotificationOptions): {
    show(): void;
  };
}

interface ShellRuntime {
  beep(): void;
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
  shell?: ShellRuntime;
}

type SoundScheduler = (callback: () => void, delayMs: number) => unknown;

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

function scheduleSound(callback: () => void, delayMs: number): void {
  setTimeout(callback, delayMs);
}

function playSystemBeep(runtime: ElectronRuntimeModule): void {
  try {
    runtime.shell?.beep();
  } catch (error: unknown) {
    log.warn('Could not play notification sound:', error instanceof Error ? error.message : error);
  }
}

function playFallbackNotificationSound(
  runtime: ElectronRuntimeModule,
  sound: SystemNotificationSound,
  schedule: SoundScheduler,
): void {
  if (!runtime.shell) {
    return;
  }

  playSystemBeep(runtime);
  if (sound === 'error') {
    schedule(() => playSystemBeep(runtime), ERROR_BEEP_DELAY_MS);
  }
}

export function showSystemNotificationWithRuntime(
  runtime: ElectronRuntimeModule,
  platform: NodeJS.Platform,
  title: string,
  body: string,
  options: SystemNotificationOptions = {},
  schedule: SoundScheduler = scheduleSound,
): void {
  const { Notification } = runtime;
  if (!Notification) {
    throw new Error('Electron notification API is unavailable');
  }
  const sound = getNotificationSoundKind(options);
  const notificationOptions: NotificationOptions = { title, body, silent: false };
  if (platform === 'darwin' && sound) {
    notificationOptions.sound = MACOS_NOTIFICATION_SOUNDS[sound];
  }

  new Notification(notificationOptions).show();
  if (platform !== 'darwin' && sound) {
    playFallbackNotificationSound(runtime, sound, schedule);
  }
}

export function showSystemNotification(title: string, body: string, options?: SystemNotificationOptions): void {
  showSystemNotificationWithRuntime(loadElectronRuntime(), process.platform, title, body, options);
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
