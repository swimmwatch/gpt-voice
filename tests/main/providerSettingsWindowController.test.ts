import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProviderSettingsWindowController,
  type ProviderSettingsWindowLike,
} from '@main/providerSettingsWindowController';

class TestProviderSettingsWindow implements ProviderSettingsWindowLike {
  closeCalls = 0;
  focusCalls = 0;
  minimized = false;
  restoreCalls = 0;
  showCalls = 0;
  readonly webContents: { id: number };
  private closedListener: (() => void) | null = null;

  constructor(id: number) {
    this.webContents = { id };
  }

  close(): void {
    this.closeCalls += 1;
    this.closedListener?.();
  }

  focus(): void {
    this.focusCalls += 1;
  }

  isMinimized(): boolean {
    return this.minimized;
  }

  on(_event: 'closed', listener: () => void): void {
    this.closedListener = listener;
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
    const controller = createProviderSettingsWindowController<TestProviderSettingsWindow>();
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
    const controller = createProviderSettingsWindowController<TestProviderSettingsWindow>();
    const claude = new TestProviderSettingsWindow(1);
    const openai = new TestProviderSettingsWindow(2);
    controller.show('claude-web', () => claude);
    controller.show('openai-api', () => openai);

    assert.equal(controller.closeForWebContents({ id: 99 }), false);
    assert.equal(controller.closeForWebContents(claude.webContents), true);
    assert.equal(claude.closeCalls, 1);
    assert.deepEqual(controller.getWindows(), [openai]);
  });
});
