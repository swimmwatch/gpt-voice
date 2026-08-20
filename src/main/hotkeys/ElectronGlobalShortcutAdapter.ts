import type { GlobalShortcut } from 'electron';

import { GlobalShortcutAdapter } from './GlobalShortcutAdapter';

/** Maps Electron's void unregister surface to a bounded cleanup result. */
export class ElectronGlobalShortcutAdapter extends GlobalShortcutAdapter {
  public constructor(
    private readonly globalShortcut: Pick<GlobalShortcut, 'isRegistered' | 'register' | 'unregister' | 'unregisterAll'>,
  ) {
    super();
  }

  public isRegistered(accelerator: string): boolean {
    try {
      return this.globalShortcut.isRegistered(accelerator);
    } catch {
      return false;
    }
  }

  public register(accelerator: string, callback: () => void): boolean {
    try {
      return this.globalShortcut.register(accelerator, callback);
    } catch {
      return false;
    }
  }

  public unregister(accelerator: string): boolean {
    try {
      this.globalShortcut.unregister(accelerator);
      return true;
    } catch {
      return false;
    }
  }

  public unregisterAll(): void {
    try {
      this.globalShortcut.unregisterAll();
    } catch {
      // Disposal remains idempotent when Electron is already shutting down.
    }
  }
}
