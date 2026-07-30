/* eslint-disable max-classes-per-file -- shortcut and harness fakes own separate mutable test state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow } from 'electron';
import { ShortcutController, type ShortcutSettingsSnapshot } from '@main/shortcuts';
import type { SelectedTextPrettifyResult, SelectedTextPrettifyRunObserver } from '@main/services/selectedTextPrettify';
import type { SelectedTextAction } from '@main/services/selectedTextActionState';
import { TestAppConfigStore } from './appConfigTestUtils';

const DEFAULT_SETTINGS: ShortcutSettingsSnapshot = {
  cancelHotkey: 'Escape',
  hotkey: 'F9',
  prettifyEnabled: true,
  prettifyHotkey: 'F12',
  prettifyQuickEnabled: true,
  prettifyQuickHotkey: 'Ctrl+F12',
  retryTranscriptionHotkey: 'F8',
  stopHotkey: 'F10',
  translateEnabled: true,
  translateHotkey: 'Command+Shift+T',
};

const SUCCESSFUL_PRETTIFY_RESULT: SelectedTextPrettifyResult = { success: true, status: '' };

async function settleAsyncDispatch(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

class RecordingGlobalShortcuts {
  public readonly callbacks = new Map<string, () => void>();
  public readonly failedRegistrations = new Set<string>();
  public unregisterAllCount = 0;
  public readonly unregistered: string[] = [];

  public register(accelerator: string, callback: () => void): boolean {
    if (this.failedRegistrations.has(accelerator)) return false;
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

interface ShortcutControllerHarnessOptions {
  readonly platform?: NodeJS.Platform;
  readonly settings?: Partial<ShortcutSettingsSnapshot>;
}

class ShortcutControllerHarness {
  public actionGateActive: SelectedTextAction | null = null;
  public cancelCalls = 0;
  public chooserCalls = 0;
  public chooserFocusCalls = 0;
  public chooserFocusResult = false;
  public chooserResult: Promise<SelectedTextPrettifyResult> = Promise.resolve(SUCCESSFUL_PRETTIFY_RESULT);
  public readonly config = new TestAppConfigStore();
  public readonly controller: ShortcutController;
  public generationObserver: SelectedTextPrettifyRunObserver | null = null;
  public readonly globalShortcuts = new RecordingGlobalShortcuts();
  public quickCalls = 0;
  public quickResult: Promise<SelectedTextPrettifyResult> = Promise.resolve(SUCCESSFUL_PRETTIFY_RESULT);
  public readonly sent: Array<readonly unknown[]> = [];
  public readonly trayStates: string[] = [];

  public constructor(options: ShortcutControllerHarnessOptions = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...options.settings };
    this.config.setHotkeys(settings);
    this.config.setTextActionSettings(settings);
    this.controller = new ShortcutController({
      config: this.config,
      globalShortcut: this.globalShortcuts,
      logger: { info: () => undefined, warn: () => undefined },
      platform: options.platform ?? 'linux',
      selectedTextActionGate: { getActive: () => this.actionGateActive },
      selectedTextPrettifyService: {
        cancel: () => {
          this.cancelCalls += 1;
          return null;
        },
        applyDefaultProfileToSelectedText: (observer) => {
          this.quickCalls += 1;
          this.generationObserver = observer ?? null;
          return this.quickResult;
        },
        chooseProfileForSelectedText: (observer) => {
          this.chooserCalls += 1;
          this.generationObserver = observer ?? null;
          return this.chooserResult;
        },
        focusExistingChooser: () => {
          this.chooserFocusCalls += 1;
          return this.chooserFocusResult;
        },
      },
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

  public startGeneration(): void {
    assert.ok(this.generationObserver);
    this.generationObserver.onGenerationStarted();
  }
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

  it('registers F12 chooser and Ctrl+F12 quick apply together', () => {
    const harness = new ShortcutControllerHarness();

    harness.controller.register();

    assert.equal(harness.globalShortcuts.callbacks.has('F12'), true);
    assert.equal(harness.globalShortcuts.callbacks.has('Ctrl+F12'), true);
  });

  it('routes F12 to the chooser and starts presentation only after Apply begins generation', async () => {
    const harness = new ShortcutControllerHarness();
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('F12')?.();

    assert.equal(harness.chooserCalls, 1);
    assert.equal(harness.quickCalls, 0);
    assert.deepEqual(harness.trayStates, []);
    assert.deepEqual(harness.sent, []);

    harness.startGeneration();
    harness.startGeneration();
    assert.deepEqual(harness.trayStates, ['prettifying']);
    assert.deepEqual(harness.sent, [['translation-status', { action: 'prettify', phase: 'working' }]]);

    await settleAsyncDispatch();
    assert.deepEqual(harness.sent[harness.sent.length - 1], [
      'translation-status',
      { action: 'prettify', phase: 'completed' },
    ]);
    assert.deepEqual(harness.trayStates, ['prettifying', 'idle']);
  });

  it('routes Ctrl+F12 to windowless default execution', async () => {
    const harness = new ShortcutControllerHarness();
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('Ctrl+F12')?.();

    assert.equal(harness.chooserCalls, 0);
    assert.equal(harness.quickCalls, 1);
    assert.deepEqual(harness.trayStates, []);
    harness.startGeneration();
    await settleAsyncDispatch();

    assert.deepEqual(harness.sent, [
      ['translation-status', { action: 'prettify', phase: 'working' }],
      ['translation-status', { action: 'prettify', phase: 'completed' }],
    ]);
  });

  it('focuses an existing chooser before any gate or second selected-text operation', () => {
    const harness = new ShortcutControllerHarness({
      settings: { prettifyEnabled: false },
    });
    harness.chooserFocusResult = true;
    harness.actionGateActive = 'prettify';
    harness.controller.setRecordingLifecycleState('recording');
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('F12')?.();
    harness.globalShortcuts.callbacks.get('Ctrl+F12')?.();

    assert.equal(harness.chooserFocusCalls, 2);
    assert.equal(harness.chooserCalls, 0);
    assert.equal(harness.quickCalls, 0);
    assert.deepEqual(harness.trayStates, ['recording']);
    assert.deepEqual(harness.sent, []);
  });

  it('suppresses both Prettify targets while another selected-text action is active', () => {
    const harness = new ShortcutControllerHarness();
    harness.actionGateActive = 'translate';
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('F12')?.();
    harness.globalShortcuts.callbacks.get('Ctrl+F12')?.();

    assert.equal(harness.chooserCalls, 0);
    assert.equal(harness.quickCalls, 0);
    assert.deepEqual(harness.sent, []);
    assert.deepEqual(harness.trayStates, []);
  });

  it('suppresses duplicate chooser and quick dispatch while Prettify generation is active', () => {
    const harness = new ShortcutControllerHarness();
    harness.actionGateActive = 'prettify';
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('F12')?.();
    harness.globalShortcuts.callbacks.get('Ctrl+F12')?.();

    assert.equal(harness.chooserFocusCalls, 2);
    assert.equal(harness.chooserCalls, 0);
    assert.equal(harness.quickCalls, 0);
    assert.deepEqual(harness.sent, []);
    assert.deepEqual(harness.trayStates, []);
  });

  it('gates the Prettify targets with independent enabled settings', () => {
    const chooserDisabled = new ShortcutControllerHarness({ settings: { prettifyEnabled: false } });
    chooserDisabled.controller.register();
    chooserDisabled.globalShortcuts.callbacks.get('F12')?.();
    chooserDisabled.globalShortcuts.callbacks.get('Ctrl+F12')?.();
    assert.equal(chooserDisabled.chooserCalls, 0);
    assert.equal(chooserDisabled.quickCalls, 1);

    const quickDisabled = new ShortcutControllerHarness({ settings: { prettifyQuickEnabled: false } });
    quickDisabled.controller.register();
    quickDisabled.globalShortcuts.callbacks.get('F12')?.();
    quickDisabled.globalShortcuts.callbacks.get('Ctrl+F12')?.();
    assert.equal(quickDisabled.chooserCalls, 1);
    assert.equal(quickDisabled.quickCalls, 0);
    assert.equal(quickDisabled.chooserFocusCalls, 1);

    const recording = new ShortcutControllerHarness();
    recording.controller.setRecordingLifecycleState('recording');
    recording.controller.register();
    recording.globalShortcuts.callbacks.get('F12')?.();
    recording.globalShortcuts.callbacks.get('Ctrl+F12')?.();
    assert.equal(recording.chooserCalls, 0);
    assert.equal(recording.quickCalls, 0);
  });

  it('keeps chooser cancellation terminal without claiming provider generation', async () => {
    const harness = new ShortcutControllerHarness();
    harness.chooserResult = Promise.resolve({ cancelled: true, success: false, status: '' });
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('F12')?.();
    await settleAsyncDispatch();

    assert.deepEqual(harness.trayStates, []);
    assert.deepEqual(harness.sent, [['translation-status', { action: 'prettify', phase: 'cancelled' }]]);
  });

  it('normalizes both Prettify targets for the current platform', () => {
    const harness = new ShortcutControllerHarness({
      platform: 'linux',
      settings: {
        prettifyHotkey: 'Command+F12',
        prettifyQuickHotkey: 'Command+Shift+F12',
      },
    });

    harness.controller.register();

    assert.equal(harness.globalShortcuts.callbacks.has('Super+F12'), true);
    assert.equal(harness.globalShortcuts.callbacks.has('Super+Shift+F12'), true);
  });

  it('keeps independently failed registrations unregistered', () => {
    const harness = new ShortcutControllerHarness();
    harness.globalShortcuts.failedRegistrations.add('F12');

    harness.controller.register();

    assert.equal(harness.globalShortcuts.callbacks.has('F12'), false);
    assert.equal(harness.globalShortcuts.callbacks.has('Ctrl+F12'), true);
  });

  it('suspends, resumes, and disposes global shortcuts idempotently', () => {
    const harness = new ShortcutControllerHarness();
    harness.controller.register();
    harness.controller.setSuspended(true);
    assert.equal(harness.globalShortcuts.callbacks.size, 0);

    harness.controller.setSuspended(false);
    assert.equal(harness.globalShortcuts.callbacks.has('F9'), true);
    assert.equal(harness.globalShortcuts.callbacks.has('F12'), true);
    assert.equal(harness.globalShortcuts.callbacks.has('Ctrl+F12'), true);

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
