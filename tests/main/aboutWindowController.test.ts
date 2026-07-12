import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAboutWindowController, isTrustedWindow, type AboutWindowLike } from '@main/aboutWindowController';

class TestAboutWindow implements AboutWindowLike {
  readonly webContents;
  closeCount = 0;
  focusCount = 0;
  restoreCount = 0;
  showCount = 0;
  private closedListener: (() => void) | undefined;

  constructor(
    id: number,
    private readonly url: string,
    private minimized = false,
  ) {
    this.webContents = {
      getURL: () => this.url,
      id,
    };
  }

  close(): void {
    this.closeCount += 1;
  }

  focus(): void {
    this.focusCount += 1;
  }

  isMinimized(): boolean {
    return this.minimized;
  }

  on(event: 'closed', listener: () => void): void {
    assert.equal(event, 'closed');
    this.closedListener = listener;
  }

  restore(): void {
    this.restoreCount += 1;
    this.minimized = false;
  }

  show(): void {
    this.showCount += 1;
  }

  triggerClosed(): void {
    this.closedListener?.();
  }
}

describe('aboutWindowController', () => {
  it('reuses and focuses the existing About window', () => {
    const windows: TestAboutWindow[] = [];
    const controller = createAboutWindowController(() => {
      const window = new TestAboutWindow(1, 'app://gpt-voice/about.html', true);
      windows.push(window);
      return window;
    });

    controller.show();
    controller.show();

    assert.equal(windows.length, 1);
    assert.equal(windows[0]?.restoreCount, 1);
    assert.equal(windows[0]?.showCount, 1);
    assert.equal(windows[0]?.focusCount, 1);
  });

  it('creates a replacement after the About window closes', () => {
    const windows: TestAboutWindow[] = [];
    const controller = createAboutWindowController(() => {
      const window = new TestAboutWindow(windows.length + 1, 'app://gpt-voice/about.html');
      windows.push(window);
      return window;
    });

    controller.show();
    windows[0]?.triggerClosed();
    controller.show();

    assert.equal(windows.length, 2);
    assert.equal(controller.getWindow(), windows[1]);
  });

  it('closes the current About window when requested', () => {
    const window = new TestAboutWindow(1, 'app://gpt-voice/about.html');
    const controller = createAboutWindowController(() => window);

    controller.show();
    controller.close();

    assert.equal(window.closeCount, 1);
  });

  it('accepts only a window with the matching sender URL', () => {
    const aboutWindow = new TestAboutWindow(7, 'app://gpt-voice/about.html');

    assert.equal(isTrustedWindow([aboutWindow], aboutWindow.webContents, 'app://gpt-voice/about.html'), true);
    assert.equal(isTrustedWindow([aboutWindow], aboutWindow.webContents, 'app://gpt-voice/index.html'), false);
    assert.equal(
      isTrustedWindow([aboutWindow], { ...aboutWindow.webContents, id: 8 }, 'app://gpt-voice/about.html'),
      false,
    );
  });
});
