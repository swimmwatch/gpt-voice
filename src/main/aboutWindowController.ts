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

export interface AboutWindowController<TWindow extends AboutWindowLike> {
  close(): void;
  getWindow(): TWindow | null;
  show(): void;
}

export function createAboutWindowController<TWindow extends AboutWindowLike>(
  createWindow: () => TWindow,
): AboutWindowController<TWindow> {
  let aboutWindow: TWindow | null = null;

  return {
    close(): void {
      aboutWindow?.close();
    },
    getWindow(): TWindow | null {
      return aboutWindow;
    },
    show(): void {
      if (aboutWindow) {
        if (aboutWindow.isMinimized()) {
          aboutWindow.restore();
        }
        aboutWindow.show();
        aboutWindow.focus();
        return;
      }

      const createdWindow = createWindow();
      aboutWindow = createdWindow;
      createdWindow.on('closed', () => {
        if (aboutWindow === createdWindow) {
          aboutWindow = null;
        }
      });
    },
  };
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
