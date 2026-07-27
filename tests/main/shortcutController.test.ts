/* eslint-disable max-classes-per-file -- shortcut and harness fakes own separate mutable test state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow } from 'electron';
import { ShortcutController, type ShortcutSettingsSnapshot } from '@main/shortcuts';

const DEFAULT_SETTINGS: ShortcutSettingsSnapshot = {
  cancelHotkey: 'Escape',
  hotkey: 'F9',
  prettifyEnabled: true,
  prettifyHotkey: 'Command+Shift+P',
  retryTranscriptionHotkey: 'F8',
  stopHotkey: 'F10',
  translateEnabled: true,
  translateHotkey: 'Command+Shift+T',
};

class RecordingGlobalShortcuts {
  public readonly callbacks = new Map<string, () => void>();
  public unregisterAllCount = 0;
  public readonly unregistered: string[] = [];

  public register(accelerator: string, callback: () => void): boolean {
    this.callbacks.set(accelerator, callback);
    return true;
  }

  public unregister(accelerator: string): void {
    this.callbacks.delete(accelerator);
    this.unregistered.push(accelerator);
  }

  public unregisterAll(): void {
    this.unregisterAllCount += 1;
    this.callbacks.clear();
  }
}

class ShortcutControllerHarness {
  public readonly globalShortcuts = new RecordingGlobalShortcuts();
  public readonly sent: Array<readonly unknown[]> = [];
  public settings: ShortcutSettingsSnapshot = DEFAULT_SETTINGS;
  public readonly trayStates: string[] = [];
  public readonly controller = new ShortcutController({
    cancelSelectedTextPrettify: () => false,
    getActiveSelectedTextAction: () => null,
    getSettings: () => this.settings,
    globalShortcut: this.globalShortcuts,
    logger: { info: () => undefined, warn: () => undefined },
    platform: 'linux',
    prettifySelectedText: async () => ({ success: true }),
    selectedTextTranslationService: {
      translateSelectedTextToClipboard: async () => ({ success: true }),
    },
    trayController: {
      updateIcon: (state: string) => this.trayStates.push(state),
    },
    windowManager: {
      getMainWindow: () =>
        ({
          webContents: {
            send: (...args: unknown[]) => this.sent.push(args),
          },
        }) as unknown as BrowserWindow,
    },
  });
}

describe('ShortcutController', () => {
  it('owns recording and retry state while preserving registered hotkey behavior', () => {
    const harness = new ShortcutControllerHarness();
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('F9')?.();
    assert.deepEqual(harness.controller.getRecordingState(), {
      isPaused: false,
      isRecording: true,
      lifecycleState: 'starting',
    });
    assert.deepEqual(harness.sent[0], ['toggle-recording', true]);

    harness.controller.setRecordingLifecycleState('idle');
    harness.controller.setRetryTranscriptionAvailable(true);
    harness.globalShortcuts.callbacks.get('F8')?.();
    assert.equal(harness.controller.getRecordingState().lifecycleState, 'retrying');
    assert.deepEqual(harness.sent[harness.sent.length - 1], ['retry-transcription']);
    assert.equal(harness.globalShortcuts.callbacks.has('F8'), false);
  });

  it('suspends, resumes, and disposes global shortcuts idempotently', () => {
    const harness = new ShortcutControllerHarness();
    harness.controller.register();
    harness.controller.setSuspended(true);
    assert.equal(harness.globalShortcuts.callbacks.size, 0);

    harness.controller.setSuspended(false);
    assert.equal(harness.globalShortcuts.callbacks.has('F9'), true);

    harness.controller.dispose();
    harness.controller.dispose();
    const unregisterCount = harness.globalShortcuts.unregisterAllCount;
    harness.controller.register();
    assert.equal(harness.globalShortcuts.unregisterAllCount, unregisterCount);
  });

  it('keeps mutable lifecycle state isolated between controller instances', () => {
    const first = new ShortcutControllerHarness();
    const second = new ShortcutControllerHarness();

    first.controller.setRecordingLifecycleState('recording');
    first.controller.setRetryTranscriptionAvailable(true);

    assert.equal(first.controller.getRecordingState().isRecording, true);
    assert.deepEqual(second.controller.getRecordingState(), {
      isPaused: false,
      isRecording: false,
      lifecycleState: 'idle',
    });
    assert.equal(second.globalShortcuts.callbacks.size, 0);
  });
});
