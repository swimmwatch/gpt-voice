import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import {
  MainIpcController,
  TrustedIpcRegistrar,
  type MainIpcControllerDependencies,
  type MainIpcTransport,
} from '@main/ipc';
import { HOTKEY_IPC_CHANNELS, type HotkeyRuntimeState } from '@shared/hotkeyIpc';
import {
  HOTKEY_TARGETS,
  HotkeyBindingAuthority,
  HotkeyDispatchStatus,
  HotkeyRegistrationStatus,
  HotkeyTestResult,
  createUnassignedHotkeySettings,
  getHotkeyForTarget,
  setHotkeyForTarget,
  type HotkeyRuntimeSnapshot,
  type HotkeySettings,
  type HotkeyTarget,
} from '@shared/hotkeys';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

interface MainIpcControllerTestHook {
  registerHotkeyIpc(): void;
}

class RecordingTransport implements MainIpcTransport {
  public readonly handlers = new Map<string, IpcHandler>();

  public handle(channel: string, listener: IpcHandler): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

class WindowContentsDouble extends EventEmitter {
  public readonly sent: unknown[][] = [];
  public destroyed = false;

  public getURL(): string {
    return 'app://gpt-voice/index.html';
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public send(...args: unknown[]): void {
    this.sent.push(args);
  }
}

class WindowDouble extends EventEmitter {
  public destroyed = false;

  public constructor(public readonly webContents: WindowContentsDouble) {
    super();
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }
}

class WindowManagerDouble {
  public constructor(
    private readonly mainWindow: WindowDouble,
    private readonly settingsWindow: WindowDouble,
  ) {}

  public getMainWindow(): WindowDouble {
    return this.mainWindow;
  }

  public getSettingsWindow(): WindowDouble {
    return this.settingsWindow;
  }

  public getTrustedSettingsWindow(sender: WebContents, _url: string): WindowDouble | null {
    return sender === (this.settingsWindow.webContents as unknown as WebContents) ? this.settingsWindow : null;
  }

  public isTrustedAppWindow(sender: WebContents, url: string): boolean {
    return (
      sender === (this.settingsWindow.webContents as unknown as WebContents) &&
      url === this.settingsWindow.webContents.getURL()
    );
  }
}

class ConfigDouble {
  public settings: HotkeySettings = createUnassignedHotkeySettings();

  public getHotkeySettings(): HotkeySettings {
    return this.settings;
  }
}

class HotkeyRegistrationServiceDouble {
  public cancelTestCalls = 0;
  public clearCalls = 0;
  public setCalls = 0;
  public testCalls = 0;
  public snapshot: HotkeyRuntimeSnapshot;
  private listener: ((snapshot: HotkeyRuntimeSnapshot) => void) | null = null;
  private testResolve: ((result: HotkeyTestResult) => void) | null = null;

  public constructor(private readonly config: ConfigDouble) {
    this.snapshot = this.createSnapshot();
  }

  public subscribe(listener: (snapshot: HotkeyRuntimeSnapshot) => void): () => void {
    this.listener = listener;
    listener(this.snapshot);
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }

  public set(target: HotkeyTarget, accelerator: string) {
    this.setCalls += 1;
    this.config.settings = setHotkeyForTarget(this.config.settings, target, accelerator);
    this.publish();
    return { snapshot: this.snapshot, success: true };
  }

  public clear(target: HotkeyTarget) {
    this.clearCalls += 1;
    this.config.settings = setHotkeyForTarget(this.config.settings, target, null);
    this.publish();
    return { snapshot: this.snapshot, success: true };
  }

  public test(_target: HotkeyTarget): Promise<HotkeyTestResult> {
    this.testCalls += 1;
    return new Promise<HotkeyTestResult>((resolve) => {
      this.testResolve = resolve;
    });
  }

  public cancelTest(): void {
    this.cancelTestCalls += 1;
    this.testResolve?.(HotkeyTestResult.Unavailable);
    this.testResolve = null;
  }

  private createSnapshot(): HotkeyRuntimeSnapshot {
    return Object.freeze({
      entries: Object.freeze(
        HOTKEY_TARGETS.map((target) => {
          const configuredAccelerator = getHotkeyForTarget(this.config.settings, target);
          if (configuredAccelerator === null) {
            return Object.freeze({
              bindingAuthority: HotkeyBindingAuthority.None,
              configuredAccelerator: null,
              dispatchStatus: HotkeyDispatchStatus.Enabled,
              effectiveAccelerator: null,
              registrationStatus: HotkeyRegistrationStatus.Unassigned,
              target,
            });
          }
          return Object.freeze({
            bindingAuthority: HotkeyBindingAuthority.Application,
            configuredAccelerator,
            dispatchStatus: HotkeyDispatchStatus.Enabled,
            effectiveAccelerator: configuredAccelerator,
            registrationStatus: HotkeyRegistrationStatus.Registered,
            target,
          });
        }),
      ),
    });
  }

  private publish(): void {
    this.snapshot = this.createSnapshot();
    this.listener?.(this.snapshot);
  }
}

function createEvent(sender: WindowContentsDouble): IpcMainInvokeEvent {
  return {
    sender: sender as unknown as WebContents,
    senderFrame: { url: sender.getURL() },
  } as unknown as IpcMainInvokeEvent;
}

function createHarness() {
  const transport = new RecordingTransport();
  const mainWindow = new WindowDouble(new WindowContentsDouble());
  const settingsWindow = new WindowDouble(new WindowContentsDouble());
  const windowManager = new WindowManagerDouble(mainWindow, settingsWindow);
  const config = new ConfigDouble();
  const hotkeyRegistrationService = new HotkeyRegistrationServiceDouble(config);
  const trustedIpc = new TrustedIpcRegistrar(
    transport,
    { error: () => undefined, info: () => undefined, warn: () => undefined },
    windowManager as unknown as MainIpcControllerDependencies['windowManager'],
  );
  const controller = new MainIpcController({
    config,
    hotkeyRegistrationService,
    prettifyProfileChooserIpc: { dispose: () => undefined },
    trustedIpc,
    windowManager,
  } as unknown as MainIpcControllerDependencies);
  (controller as unknown as MainIpcControllerTestHook).registerHotkeyIpc();
  return { controller, hotkeyRegistrationService, mainWindow, settingsWindow, transport };
}

describe('trusted hotkey IPC controller', () => {
  it('publishes revisioned authoritative snapshots and never calls the service for malformed mutations', () => {
    const { hotkeyRegistrationService, mainWindow, settingsWindow, transport } = createHarness();
    const event = createEvent(settingsWindow.webContents);
    const query = transport.handlers.get(HOTKEY_IPC_CHANNELS.snapshotQuery);
    const set = transport.handlers.get(HOTKEY_IPC_CHANNELS.set);
    const clear = transport.handlers.get(HOTKEY_IPC_CHANNELS.clear);
    assert.ok(query);
    assert.ok(set);
    assert.ok(clear);

    const initialState = query(event) as HotkeyRuntimeState;
    const setResult = set(event, { accelerator: 'F10', target: 'stop' }) as Extract<
      import('@shared/hotkeyIpc').HotkeyMutationResponse,
      { status: 'success' }
    >;
    const clearResult = clear(event, { target: 'stop' }) as Extract<
      import('@shared/hotkeyIpc').HotkeyMutationResponse,
      { status: 'success' }
    >;

    assert.equal(setResult.status, 'success');
    assert.equal(setResult.state.settings.stopHotkey, 'F10');
    assert.equal(setResult.state.revision, initialState.revision + 1);
    assert.equal(clearResult.status, 'success');
    assert.equal(clearResult.state.settings.stopHotkey, null);
    assert.equal(clearResult.state.revision, setResult.state.revision + 1);
    assert.equal(hotkeyRegistrationService.setCalls, 1);
    assert.equal(hotkeyRegistrationService.clearCalls, 1);
    assert.equal(mainWindow.webContents.sent.length, 3);
    assert.equal(settingsWindow.webContents.sent.length, 3);

    const invalidResult = set(event, { target: 'stop' }) as import('@shared/hotkeyIpc').HotkeyMutationResponse;
    assert.equal(invalidResult.status, 'failure');
    assert.equal(hotkeyRegistrationService.setCalls, 1);
    assert.throws(() => query(event, 'forged'), /Unexpected IPC arguments/u);
  });

  it('settles a bounded physical test once when its Settings owner closes or the controller disposes', async () => {
    const first = createHarness();
    const firstEvent = createEvent(first.settingsWindow.webContents);
    const firstTest = first.transport.handlers.get(HOTKEY_IPC_CHANNELS.test);
    assert.ok(firstTest);
    const pendingOnClose = Promise.resolve(firstTest(firstEvent, { target: 'record' }));
    const duplicate = await Promise.resolve(firstTest(firstEvent, { target: 'record' }));
    assert.equal((duplicate as { result: HotkeyTestResult }).result, HotkeyTestResult.Unavailable);
    assert.equal(first.hotkeyRegistrationService.testCalls, 1);

    first.settingsWindow.emit('closed');
    assert.equal(((await pendingOnClose) as { result: HotkeyTestResult }).result, HotkeyTestResult.Unavailable);
    assert.equal(first.hotkeyRegistrationService.cancelTestCalls, 1);

    const second = createHarness();
    const secondTest = second.transport.handlers.get(HOTKEY_IPC_CHANNELS.test);
    assert.ok(secondTest);
    const pendingOnDispose = Promise.resolve(
      secondTest(createEvent(second.settingsWindow.webContents), { target: 'record' }),
    );
    await second.controller.dispose();
    assert.equal(((await pendingOnDispose) as { result: HotkeyTestResult }).result, HotkeyTestResult.Unavailable);
    assert.equal(second.hotkeyRegistrationService.cancelTestCalls, 1);
  });
});
