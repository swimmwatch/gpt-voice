import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProviderSettingsWindowController,
  type ProviderSettingsWindowCloseEvent,
  type ProviderSettingsWindowLike,
} from '@main/providerSettingsWindowController';

class TestProviderSettingsWindow implements ProviderSettingsWindowLike {
  closeCalls = 0;
  focusCalls = 0;
  minimized = false;
  restoreCalls = 0;
  showCalls = 0;
  readonly webContents: { id: number };
  private closeListener: ((event: ProviderSettingsWindowCloseEvent) => void) | null = null;
  private closedListener: (() => void) | null = null;

  constructor(id: number) {
    this.webContents = { id };
  }

  close(): void {
    this.closeCalls += 1;
    let prevented = false;
    this.closeListener?.({ preventDefault: () => (prevented = true) });
    if (prevented) return;
    this.closedListener?.();
  }

  focus(): void {
    this.focusCalls += 1;
  }

  isMinimized(): boolean {
    return this.minimized;
  }

  on(event: 'close', listener: (event: ProviderSettingsWindowCloseEvent) => void): void;
  on(event: 'closed', listener: () => void): void;
  on(event: 'close' | 'closed', listener: ((event: ProviderSettingsWindowCloseEvent) => void) | (() => void)): void {
    if (event === 'close') {
      this.closeListener = listener;
    } else {
      this.closedListener = listener as () => void;
    }
  }

  restore(): void {
    this.restoreCalls += 1;
    this.minimized = false;
  }

  show(): void {
    this.showCalls += 1;
  }
}

describe('provider settings window controller', () => {
  it('reuses and focuses a provider window while keeping other providers independent', () => {
    const controller = new ProviderSettingsWindowController<TestProviderSettingsWindow>();
    const claude = new TestProviderSettingsWindow(1);
    const openai = new TestProviderSettingsWindow(2);

    controller.show('claude-web', () => claude);
    claude.minimized = true;
    controller.show('claude-web', () => new TestProviderSettingsWindow(3));
    controller.show('openai-api', () => openai);

    assert.equal(claude.restoreCalls, 1);
    assert.equal(claude.showCalls, 1);
    assert.equal(claude.focusCalls, 1);
    assert.deepEqual(controller.getWindows(), [claude, openai]);
  });

  it('closes by sender and removes only the matching provider window', () => {
    const controller = new ProviderSettingsWindowController<TestProviderSettingsWindow>();
    const claude = new TestProviderSettingsWindow(1);
    const openai = new TestProviderSettingsWindow(2);
    controller.show('claude-web', () => claude);
    controller.show('openai-api', () => openai);

    assert.equal(controller.closeForWebContents({ id: 99 }), false);
    assert.equal(controller.closeForWebContents(claude.webContents), true);
    assert.equal(claude.closeCalls, 1);
    assert.deepEqual(controller.getWindows(), [openai]);
  });

  it('intercepts a guarded native close until the matching renderer confirms it', () => {
    const controller = new ProviderSettingsWindowController<TestProviderSettingsWindow>();
    const localWhisper = new TestProviderSettingsWindow(1);
    let closeRequests = 0;
    controller.show('local-whisper', () => localWhisper, {
      guardedClose: true,
      onCloseRequested: () => {
        closeRequests += 1;
      },
    });

    localWhisper.close();
    assert.equal(closeRequests, 1);
    assert.deepEqual(controller.getWindows(), [localWhisper]);

    assert.equal(controller.closeForWebContents(localWhisper.webContents), true);
    assert.equal(localWhisper.closeCalls, 2);
    assert.deepEqual(controller.getWindows(), []);
  });

  it('bypasses guarded close requests during disposal', () => {
    const controller = new ProviderSettingsWindowController<TestProviderSettingsWindow>();
    const localWhisper = new TestProviderSettingsWindow(1);
    let closeRequests = 0;
    controller.show('local-whisper', () => localWhisper, {
      guardedClose: true,
      onCloseRequested: () => {
        closeRequests += 1;
      },
    });

    controller.dispose();
    assert.equal(closeRequests, 0);
    assert.equal(localWhisper.closeCalls, 1);
    assert.deepEqual(controller.getWindows(), []);
  });
});
