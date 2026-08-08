export interface ProviderSettingsWindowWebContents {
  id: number;
}

export interface ProviderSettingsWindowCloseEvent {
  preventDefault(): void;
}

export interface ProviderSettingsWindowLike {
  close(): void;
  focus(): void;
  isMinimized(): boolean;
  on(event: 'close', listener: (event: ProviderSettingsWindowCloseEvent) => void): void;
  on(event: 'closed', listener: () => void): void;
  restore(): void;
  show(): void;
  webContents: ProviderSettingsWindowWebContents;
}

export interface ProviderSettingsWindowOptions<TWindow extends ProviderSettingsWindowLike> {
  readonly guardedClose?: boolean;
  readonly onCloseRequested?: (window: TWindow) => void;
  readonly onClosed?: (window: TWindow) => void;
}

export interface ProviderSettingsWindowShowResult<TWindow extends ProviderSettingsWindowLike> {
  readonly created: boolean;
  readonly window: TWindow;
}

/** Keeps at most one settings window per provider without coupling the lifecycle to Electron in tests. */
export class ProviderSettingsWindowController<TWindow extends ProviderSettingsWindowLike> {
  private readonly confirmedCloseProviderIds = new Set<string>();
  private disposing = false;
  private readonly windows = new Map<string, TWindow>();

  public closeForWebContents(webContents: ProviderSettingsWindowWebContents): boolean {
    const entry = [...this.windows.entries()].find(([, window]) => window.webContents.id === webContents.id);
    if (!entry) return false;
    this.confirmedCloseProviderIds.add(entry[0]);
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
    this.disposing = true;
    const windows = [...this.windows.values()];
    this.windows.clear();
    this.confirmedCloseProviderIds.clear();
    for (const window of windows) window.close();
  }

  public show(
    providerId: string,
    createWindow: () => TWindow,
    options: ProviderSettingsWindowOptions<TWindow> = {},
  ): ProviderSettingsWindowShowResult<TWindow> {
    const existing = this.windows.get(providerId);
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return Object.freeze({ created: false, window: existing });
    }

    const created = createWindow();
    this.windows.set(providerId, created);
    if (options.guardedClose) {
      created.on('close', (event) => {
        if (this.disposing || this.confirmedCloseProviderIds.has(providerId)) return;
        event.preventDefault();
        options.onCloseRequested?.(created);
      });
    }
    created.on('closed', () => {
      if (this.windows.get(providerId) === created) {
        this.windows.delete(providerId);
        this.confirmedCloseProviderIds.delete(providerId);
      }
      options.onClosed?.(created);
    });

    return Object.freeze({ created: true, window: created });
  }
}
