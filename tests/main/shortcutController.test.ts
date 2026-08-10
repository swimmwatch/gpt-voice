/* eslint-disable max-classes-per-file -- shortcut and harness fakes own separate mutable test state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow } from 'electron';
import { ShortcutController, type ShortcutSettingsSnapshot } from '@main/shortcuts';
import type { SelectedTextPrettifyResult, SelectedTextPrettifyRunObserver } from '@main/services/selectedTextPrettify';
import type { SelectedTextTranslationRunObserver } from '@main/services/selectedTextTranslation';
import type { SelectedTextAction } from '@main/services/selectedTextActionState';
import { MainInteractionLock } from '@shared/mainInteractionLock';
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
  readonly prettifyConnected?: boolean;
  readonly settings?: Partial<ShortcutSettingsSnapshot>;
}

class ShortcutControllerHarness {
  public actionGateActive: SelectedTextAction | null = null;
  private readonly actionGateListeners = new Set<(action: SelectedTextAction | null) => void>();
  public cancelCalls = 0;
  public chooserCalls = 0;
  public chooserFocusCalls = 0;
  public chooserFocusResult = false;
  public chooserResult: Promise<SelectedTextPrettifyResult> = Promise.resolve(SUCCESSFUL_PRETTIFY_RESULT);
  public readonly config = new TestAppConfigStore();
  public readonly controller: ShortcutController;
  public generationObserver: SelectedTextPrettifyRunObserver | null = null;
  public readonly globalShortcuts = new RecordingGlobalShortcuts();
  public readonly mainInteractionLock = new MainInteractionLock(() => false);
  public quickCalls = 0;
  public quickResult: Promise<SelectedTextPrettifyResult> = Promise.resolve(SUCCESSFUL_PRETTIFY_RESULT);
  public readonly connectionChecks: unknown[] = [];
  public readonly notifications: Array<readonly [string, string]> = [];
  public readonly sent: Array<readonly unknown[]> = [];
  public readonly trayStates: string[] = [];
  public translationCalls = 0;
  public translationCancelCalls = 0;
  public translationCancelResult = false;
  public translationObserver: SelectedTextTranslationRunObserver | null = null;
  public translationResult: Promise<{ cancelled?: true; success: boolean }> = Promise.resolve({ success: true });

  public constructor(options: ShortcutControllerHarnessOptions = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...options.settings };
    this.config.setHotkeys(settings);
    this.config.setTextActionSettings(settings);
    this.controller = new ShortcutController({
      config: this.config,
      globalShortcut: this.globalShortcuts,
      logger: { info: () => undefined, warn: () => undefined },
      localization: {
        translate: (key) => key,
      },
      mainInteractionLock: this.mainInteractionLock,
      notification: {
        show: (title, body) => this.notifications.push([title, body]),
      },
      platform: options.platform ?? 'linux',
      prettifyRuntime: {
        isProviderConnected: (providerId) => {
          this.connectionChecks.push(providerId);
          return options.prettifyConnected ?? true;
        },
      },
      selectedTextActionGate: {
        getActive: () => this.actionGateActive,
        subscribe: (listener) => {
          this.actionGateListeners.add(listener);
          return (): void => {
            this.actionGateListeners.delete(listener);
          };
        },
      },
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
        cancel: () => {
          this.translationCancelCalls += 1;
          return this.translationCancelResult;
        },
        translateSelectedTextToClipboard: async (observer) => {
          this.translationCalls += 1;
          this.translationObserver = observer ?? null;
          return this.translationResult;
        },
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

  public startTranslation(): void {
    assert.ok(this.translationObserver);
    this.translationObserver.onTranslationStarted();
  }

  public setActionGateActive(action: SelectedTextAction | null): void {
    this.actionGateActive = action;
    for (const listener of [...this.actionGateListeners]) listener(action);
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

  it('does not start recording while a selected-text provider operation is active', () => {
    const harness = new ShortcutControllerHarness();
    harness.actionGateActive = 'translate';
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('F9')?.();

    assert.equal(harness.controller.getRecordingState().lifecycleState, 'idle');
    assert.deepEqual(harness.sent, []);
  });

  it('forwards Prettify and Translation gate activity to the main window without changing presentation timing', () => {
    const harness = new ShortcutControllerHarness();

    harness.setActionGateActive('prettify');
    harness.setActionGateActive(null);
    harness.setActionGateActive('translate');
    harness.setActionGateActive(null);

    assert.deepEqual(harness.sent, [
      ['text-action-activity-changed', true],
      ['text-action-activity-changed', false],
      ['text-action-activity-changed', true],
      ['text-action-activity-changed', false],
    ]);
    assert.deepEqual(harness.trayStates, []);
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

  it('notifies and blocks both Prettify shortcuts while the active provider is disconnected', () => {
    const harness = new ShortcutControllerHarness({ prettifyConnected: false });
    harness.chooserFocusResult = true;
    harness.actionGateActive = 'prettify';
    harness.controller.setRecordingLifecycleState('recording');
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('F12')?.();
    harness.globalShortcuts.callbacks.get('Ctrl+F12')?.();

    assert.equal(harness.chooserCalls, 0);
    assert.equal(harness.quickCalls, 0);
    assert.equal(harness.chooserFocusCalls, 0);
    assert.equal(harness.connectionChecks.length, 2);
    assert.deepEqual(harness.sent, [
      ['translation-status', { action: 'prettify', phase: 'failed' }],
      ['translation-status', { action: 'prettify', phase: 'failed' }],
    ]);
    assert.deepEqual(harness.notifications, [
      ['GPT-Voice', 'status.prettifyFailed: provider.notConnected'],
      ['GPT-Voice', 'status.prettifyFailed: provider.notConnected'],
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

  it('cancels an active translation through the configured Cancel hotkey', async () => {
    let finishTranslation!: (result: { cancelled?: true; success: boolean }) => void;
    const harness = new ShortcutControllerHarness();
    harness.translationCancelResult = true;
    harness.translationResult = new Promise((resolve) => {
      finishTranslation = resolve;
    });
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('Shift+Super+T')?.();
    assert.equal(harness.translationCalls, 1);
    assert.deepEqual(harness.sent, [['translation-status', { action: 'translation', phase: 'working' }]]);
    harness.startTranslation();
    assert.deepEqual(harness.trayStates, ['processing']);

    harness.globalShortcuts.callbacks.get('Escape')?.();
    assert.deepEqual(harness.trayStates, ['processing']);
    finishTranslation({ cancelled: true, success: false });
    await settleAsyncDispatch();

    assert.equal(harness.translationCancelCalls, 1);
    assert.deepEqual(harness.sent, [
      ['translation-status', { action: 'translation', phase: 'working' }],
      ['translation-status', { action: 'translation', phase: 'cancelled' }],
    ]);
    assert.deepEqual(harness.trayStates, ['processing', 'idle']);
  });

  it('shows Translation processing only from provider dispatch through terminal settlement', async () => {
    let finishTranslation!: (result: { success: boolean }) => void;
    const harness = new ShortcutControllerHarness();
    harness.translationResult = new Promise((resolve) => {
      finishTranslation = resolve;
    });
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('Shift+Super+T')?.();
    assert.deepEqual(harness.trayStates, []);
    harness.startTranslation();
    harness.startTranslation();
    assert.deepEqual(harness.trayStates, ['processing']);

    finishTranslation({ success: true });
    await settleAsyncDispatch();

    assert.deepEqual(harness.trayStates, ['processing', 'idle']);
    assert.deepEqual(harness.sent, [
      ['translation-status', { action: 'translation', phase: 'working' }],
      ['translation-status', { action: 'translation', phase: 'completed' }],
    ]);
  });

  it('restores the tray after a failed Translation provider operation', async () => {
    const harness = new ShortcutControllerHarness();
    harness.translationResult = Promise.resolve({ success: false });
    harness.controller.register();

    harness.globalShortcuts.callbacks.get('Shift+Super+T')?.();
    harness.startTranslation();
    await settleAsyncDispatch();

    assert.deepEqual(harness.trayStates, ['processing', 'idle']);
    assert.deepEqual(harness.sent, [
      ['translation-status', { action: 'translation', phase: 'working' }],
      ['translation-status', { action: 'translation', phase: 'failed' }],
    ]);
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
    assert.equal(harness.globalShortcuts.callbacks.has('Shift+Super+F12'), true);
  });

  it('skips shortcuts that become identical on the current platform', () => {
    const mac = new ShortcutControllerHarness({
      platform: 'darwin',
      settings: {
        hotkey: 'CommandOrControl+K',
        translateHotkey: 'Super+K',
      },
    });
    mac.controller.register();
    assert.equal(mac.globalShortcuts.callbacks.has('Command+K'), false);

    const linux = new ShortcutControllerHarness({
      platform: 'linux',
      settings: {
        hotkey: 'CommandOrControl+K',
        translateHotkey: 'Ctrl+K',
      },
    });
    linux.controller.register();
    assert.equal(linux.globalShortcuts.callbacks.has('Ctrl+K'), false);
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
    harness.setActionGateActive('translate');
    const unregisterCount = harness.globalShortcuts.unregisterAllCount;
    harness.controller.register();
    assert.equal(harness.globalShortcuts.unregisterAllCount, unregisterCount);
    assert.deepEqual(harness.sent, []);
  });

  it('keeps hotkey capture suspended after the settings lock is released', () => {
    const harness = new ShortcutControllerHarness();
    harness.controller.register();
    harness.controller.setSuspended(true);
    const acquisition = harness.mainInteractionLock.acquire();
    assert.ok(acquisition.lease);

    acquisition.lease.release();
    assert.equal(harness.globalShortcuts.callbacks.size, 0);

    harness.controller.setSuspended(false);
    assert.equal(harness.globalShortcuts.callbacks.has('F9'), true);
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
