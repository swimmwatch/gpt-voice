export interface ProviderSettingsWindowWebContents {
  id: number;
}

export interface ProviderSettingsWindowLike {
  close(): void;
  focus(): void;
  isMinimized(): boolean;
  on(event: 'closed', listener: () => void): void;
  restore(): void;
  show(): void;
  webContents: ProviderSettingsWindowWebContents;
}

export interface ProviderSettingsWindowController<TWindow extends ProviderSettingsWindowLike> {
  closeForWebContents(webContents: ProviderSettingsWindowWebContents): boolean;
  getWindows(): readonly TWindow[];
  show(providerId: string, createWindow: () => TWindow): void;
}

/** Keeps at most one settings window per provider without coupling the lifecycle to Electron in tests. */
export function createProviderSettingsWindowController<
  TWindow extends ProviderSettingsWindowLike,
>(): ProviderSettingsWindowController<TWindow> {
  const windows = new Map<string, TWindow>();

  return {
    closeForWebContents(webContents): boolean {
      const entry = [...windows.entries()].find(([, window]) => window.webContents.id === webContents.id);
      if (!entry) return false;
      entry[1].close();
      return true;
    },
    getWindows(): readonly TWindow[] {
      return [...windows.values()];
    },
    show(providerId, createWindow): void {
      const existing = windows.get(providerId);
      if (existing) {
        if (existing.isMinimized()) existing.restore();
        existing.show();
        existing.focus();
        return;
      }

      const created = createWindow();
      windows.set(providerId, created);
      created.on('closed', () => {
        if (windows.get(providerId) === created) windows.delete(providerId);
      });
    },
  };
}
