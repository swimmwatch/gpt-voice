export interface AboutWindowWebContents {
  getURL(): string;
  id: number;
}

export interface AboutWindowLike {
  close(): void;
  focus(): void;
  isMinimized(): boolean;
  on(event: 'closed', listener: () => void): void;
  restore(): void;
  show(): void;
  webContents: AboutWindowWebContents;
}

/** Owns the optional About window without coupling its lifecycle to Electron. */
export class AboutWindowController<TWindow extends AboutWindowLike> {
  private window: TWindow | null = null;

  public constructor(private readonly createWindow: () => TWindow) {}

  public close(): void {
    this.window?.close();
  }

  public dispose(): void {
    const window = this.window;
    this.window = null;
    window?.close();
  }

  public getWindow(): TWindow | null {
    return this.window;
  }

  public show(): void {
    if (this.window) {
      if (this.window.isMinimized()) {
        this.window.restore();
      }
      this.window.show();
      this.window.focus();
      return;
    }

    const createdWindow = this.createWindow();
    this.window = createdWindow;
    createdWindow.on('closed', () => {
      if (this.window === createdWindow) {
        this.window = null;
      }
    });
  }
}

export function isTrustedWindow(
  windows: readonly (AboutWindowLike | null)[],
  webContents: AboutWindowWebContents,
  senderUrl: string,
): boolean {
  return windows.some(
    (window) => window?.webContents.id === webContents.id && senderUrl === window.webContents.getURL(),
  );
}
