import {
  getNotificationSoundKind,
  type SystemNotificationOptions,
  type SystemNotificationSound,
} from '@shared/notifications';
import type { ScopedLogger } from './logger';

export type ClipboardType = 'clipboard' | 'selection';

const MACOS_NOTIFICATION_SOUNDS: Readonly<Record<SystemNotificationSound, string>> = Object.freeze({
  success: 'Glass',
  error: 'Basso',
});
const ERROR_BEEP_DELAY_MS = 160;

export interface ClipboardRuntime {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

export interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  sound?: string;
}

export interface NotificationRuntime {
  new (options: NotificationOptions): {
    show(): void;
  };
}

export interface ShellRuntime {
  beep(): void;
  openExternal(url: string): Promise<void>;
}

export interface SafeStorageRuntime {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface ElectronRuntimeModule {
  readonly clipboard?: ClipboardRuntime;
  readonly Notification?: NotificationRuntime;
  readonly safeStorage?: SafeStorageRuntime;
  readonly shell?: ShellRuntime;
}

export type SoundScheduler = (callback: () => void, delayMs: number) => unknown;

export interface ElectronRuntimeLoaderDependencies {
  readonly loadModule: () => ElectronRuntimeModule;
  readonly logger: Pick<ScopedLogger, 'warn'>;
  readonly platform: NodeJS.Platform;
  readonly schedule: SoundScheduler;
}

/** Owns one isolated lazy Electron runtime module and its privileged adapters. */
export class ElectronRuntimeLoader {
  private electronRuntime: ElectronRuntimeModule | null = null;

  public constructor(private readonly dependencies: ElectronRuntimeLoaderDependencies) {}

  public readonly writeClipboardText = (text: string): void => {
    this.getClipboard().writeText(text);
  };

  public readonly readClipboardText = (type?: ClipboardType): string => {
    return this.getClipboard().readText(type);
  };

  public readonly writeTypedClipboardText = (text: string, type?: ClipboardType): void => {
    this.getClipboard().writeText(text, type);
  };

  public readonly showSystemNotification = (
    title: string,
    body: string,
    options: SystemNotificationOptions = {},
  ): void => {
    const runtime = this.loadElectronRuntime();
    const { Notification } = runtime;
    if (!Notification) {
      throw new Error('Electron notification API is unavailable');
    }

    const sound = getNotificationSoundKind(options);
    const notificationOptions: NotificationOptions = { title, body, silent: false };
    if (this.dependencies.platform === 'darwin' && sound) {
      notificationOptions.sound = MACOS_NOTIFICATION_SOUNDS[sound];
    }

    new Notification(notificationOptions).show();
    if (this.dependencies.platform !== 'darwin' && sound) {
      this.playFallbackNotificationSound(runtime, sound);
    }
  };

  public readonly isSafeStorageEncryptionAvailable = (): boolean => {
    return this.getSafeStorage().isEncryptionAvailable();
  };

  public readonly encryptSafeStorageString = (plainText: string): Buffer => {
    return this.getSafeStorage().encryptString(plainText);
  };

  public readonly decryptSafeStorageString = (encrypted: Buffer): string => {
    return this.getSafeStorage().decryptString(encrypted);
  };

  public readonly openExternal = (url: string): Promise<void> => {
    const { shell } = this.loadElectronRuntime();
    if (!shell) {
      throw new Error('Electron shell API is unavailable');
    }
    return shell.openExternal(url);
  };

  private loadElectronRuntime(): ElectronRuntimeModule {
    this.electronRuntime ??= this.dependencies.loadModule();
    return this.electronRuntime;
  }

  private getClipboard(): ClipboardRuntime {
    const { clipboard } = this.loadElectronRuntime();
    if (!clipboard) {
      throw new Error('Electron clipboard API is unavailable');
    }
    return clipboard;
  }

  private getSafeStorage(): SafeStorageRuntime {
    const { safeStorage } = this.loadElectronRuntime();
    if (!safeStorage) {
      throw new Error('Electron safeStorage API is unavailable');
    }
    return safeStorage;
  }

  private playSystemBeep(runtime: ElectronRuntimeModule): void {
    try {
      runtime.shell?.beep();
    } catch (error: unknown) {
      this.dependencies.logger.warn(
        'Could not play notification sound:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  private playFallbackNotificationSound(runtime: ElectronRuntimeModule, sound: SystemNotificationSound): void {
    if (!runtime.shell) return;

    this.playSystemBeep(runtime);
    if (sound === 'error') {
      this.dependencies.schedule(() => this.playSystemBeep(runtime), ERROR_BEEP_DELAY_MS);
    }
  }
}
