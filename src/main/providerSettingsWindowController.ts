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

/** Keeps at most one settings window per provider without coupling the lifecycle to Electron in tests. */
export class ProviderSettingsWindowController<TWindow extends ProviderSettingsWindowLike> {
  private readonly windows = new Map<string, TWindow>();

  public closeForWebContents(webContents: ProviderSettingsWindowWebContents): boolean {
    const entry = [...this.windows.entries()].find(([, window]) => window.webContents.id === webContents.id);
    if (!entry) return false;
    entry[1].close();
    return true;
  }

  public getWindows(): readonly TWindow[] {
    return [...this.windows.values()];
  }

  public get(providerId: string): TWindow | null {
    return this.windows.get(providerId) ?? null;
  }

  public dispose(): void {
    const windows = [...this.windows.values()];
    this.windows.clear();
    for (const window of windows) window.close();
  }

  public show(providerId: string, createWindow: () => TWindow): void {
    const existing = this.windows.get(providerId);
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return;
    }

    const created = createWindow();
    this.windows.set(providerId, created);
    created.on('closed', () => {
      if (this.windows.get(providerId) === created) this.windows.delete(providerId);
    });
  }
}
