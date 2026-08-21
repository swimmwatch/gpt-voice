import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ElectronGlobalShortcutAdapter } from '@main/hotkeys/ElectronGlobalShortcutAdapter';
import { GlobalShortcutAdapter } from '@main/hotkeys/GlobalShortcutAdapter';
import { LinuxHotkeyPlatformPolicy } from '@main/hotkeys/LinuxHotkeyPlatformPolicy';
import { classifyLinuxSessionType } from '@main/hotkeys/LinuxSessionTypeClassifier';
import { HotkeyPlatformPolicy } from '@main/hotkeys/HotkeyPlatformPolicy';
import { HotkeyPlatformPolicyFactory } from '@main/hotkeys/HotkeyPlatformPolicyFactory';
import { UnsupportedHotkeyPlatformPolicy } from '@main/hotkeys/UnsupportedHotkeyPlatformPolicy';
import { WindowsHotkeyPlatformPolicy } from '@main/hotkeys/WindowsHotkeyPlatformPolicy';
import {
  HOTKEY_TEST_TIMEOUT_MS,
  HotkeyRegistrationService,
  type HotkeyRegistrationClock,
  type HotkeyRegistrationConfigPort,
} from '@main/hotkeys/HotkeyRegistrationService';
import {
  DesktopPlatform,
  HotkeyBindingAuthority,
  HotkeyDispatchStatus,
  HotkeyRegistrationFailureCode,
  HotkeyRegistrationStatus,
  HotkeyTestResult,
  LinuxSessionType,
  createUnassignedHotkeySettings,
  isHotkeyRuntimeSnapshot,
  setHotkeyForTarget,
  type HotkeySettings,
  type HotkeyTarget,
} from '@shared/hotkeys';
import { MainInteractionLock } from '@shared/mainInteractionLock';

const LINUX_F12_ACCELERATOR = 'F12';

class FakeAdapter extends GlobalShortcutAdapter {
  public readonly callbacks = new Map<string, () => void>();
  public readonly registrations: string[] = [];
  public failRegister = new Set<string>();
  public failUnregister = new Set<string>();
  public failUnregisterOnce = new Set<string>();
  public hiddenFromQuery = new Set<string>();
  public unregisterAllCalls = 0;

  public isRegistered(accelerator: string): boolean {
    return this.callbacks.has(accelerator) && !this.hiddenFromQuery.has(accelerator);
  }

  public register(accelerator: string, callback: () => void): boolean {
    this.registrations.push(accelerator);
    if (this.failRegister.has(accelerator) || this.callbacks.has(accelerator)) return false;
    this.callbacks.set(accelerator, callback);
    return true;
  }

  public unregister(accelerator: string): boolean {
    if (this.failUnregister.has(accelerator)) return false;
    if (this.failUnregisterOnce.delete(accelerator)) return false;
    this.callbacks.delete(accelerator);
    return true;
  }

  public unregisterAll(): void {
    this.unregisterAllCalls += 1;
    this.callbacks.clear();
  }

  public fire(accelerator: string): void {
    this.callbacks.get(accelerator)?.();
  }
}

function createAcceptedPolicy(): HotkeyPlatformPolicy {
  return Object.freeze({
    validate(normalizedAccelerator: string) {
      return Object.freeze({
        accepted: true as const,
        bindingAuthority: HotkeyBindingAuthority.Application,
        effectiveAccelerator: normalizedAccelerator,
      });
    },
  });
}

function createDesktopManagedPolicy(): HotkeyPlatformPolicy {
  return Object.freeze({
    validate(_normalizedAccelerator: string) {
      return Object.freeze({
        accepted: true as const,
        bindingAuthority: HotkeyBindingAuthority.DesktopEnvironment,
        effectiveAccelerator: null,
      });
    },
  });
}

function createFakeConfig(settings: HotkeySettings) {
  let currentSettings = settings;
  let persistenceCalls = 0;
  return {
    failPersistence: false as boolean,
    failPersistenceOnCall: new Set<number>(),
    getSnapshot(): HotkeySettings {
      return currentSettings;
    },
    persistHotkey(target: HotkeyTarget, accelerator: string | null): void {
      persistenceCalls += 1;
      if (this.failPersistence || this.failPersistenceOnCall.has(persistenceCalls)) {
        throw new Error('persistence failed');
      }
      currentSettings = setHotkeyForTarget(currentSettings, target, accelerator);
    },
  } satisfies HotkeyRegistrationConfigPort & {
    failPersistence: boolean;
    failPersistenceOnCall: Set<number>;
  };
}

function createManualClock() {
  const timers = new Map<number, () => void>();
  let next = 1;
  return {
    timers,
    clearTimeout(handle: unknown): void {
      timers.delete(handle as number);
    },
    now(): number {
      return 0;
    },
    setTimeout(callback: () => void, delayMs: number): unknown {
      assert.equal(delayMs, HOTKEY_TEST_TIMEOUT_MS);
      const handle = next++;
      timers.set(handle, callback);
      return handle;
    },
    fireOne(): void {
      const entry = timers.entries().next();
      if (entry.done) throw new Error('Missing timer');
      const [handle, callback] = entry.value;
      timers.delete(handle);
      callback();
    },
  } satisfies HotkeyRegistrationClock & { readonly timers: Map<number, () => void>; fireOne(): void };
}

function createService(
  settings = createUnassignedHotkeySettings(),
  policy: HotkeyPlatformPolicy = createAcceptedPolicy(),
  platform: NodeJS.Platform = 'linux',
) {
  const adapter = new FakeAdapter();
  const config = createFakeConfig(settings);
  const clock = createManualClock();
  const calls: HotkeyTarget[] = [];
  const callbacks: Readonly<Record<HotkeyTarget, () => void>> = Object.freeze({
    cancel: () => {
      calls.push('cancel');
    },
    prettify: () => {
      calls.push('prettify');
    },
    prettifyQuick: () => {
      calls.push('prettifyQuick');
    },
    record: () => {
      calls.push('record');
    },
    retryTranscription: () => {
      calls.push('retryTranscription');
    },
    stop: () => {
      calls.push('stop');
    },
    translate: () => {
      calls.push('translate');
    },
  });
  const service = new HotkeyRegistrationService({
    adapter,
    callbacks,
    clock,
    config,
    logger: { info: () => undefined, warn: () => undefined },
    platform,
    policy,
  });
  return { adapter, calls, clock, config, service };
}

describe('Hotkey platform policy factory', () => {
  it('fails closed unless an exact supported-host creator is injected', () => {
    const factory = new HotkeyPlatformPolicyFactory({});
    assert.ok(
      factory.create(DesktopPlatform.Windows, LinuxSessionType.NotApplicable) instanceof
        UnsupportedHotkeyPlatformPolicy,
    );
    assert.ok(factory.create(DesktopPlatform.Linux, LinuxSessionType.X11) instanceof UnsupportedHotkeyPlatformPolicy);
    assert.ok(
      factory.create(DesktopPlatform.Macos, LinuxSessionType.NotApplicable) instanceof UnsupportedHotkeyPlatformPolicy,
    );

    const windows = new WindowsHotkeyPlatformPolicy();
    const x11 = new LinuxHotkeyPlatformPolicy(LinuxSessionType.X11);
    const wayland = new LinuxHotkeyPlatformPolicy(LinuxSessionType.Wayland);
    const selected = new HotkeyPlatformPolicyFactory({
      createLinuxPolicy: (session) => (session === LinuxSessionType.X11 ? x11 : wayland),
      createWindowsPolicy: () => windows,
    });
    assert.equal(selected.create(DesktopPlatform.Windows, LinuxSessionType.NotApplicable), windows);
    assert.equal(selected.create(DesktopPlatform.Linux, LinuxSessionType.X11), x11);
    assert.equal(selected.create(DesktopPlatform.Linux, LinuxSessionType.Wayland), wayland);
    assert.ok(
      selected.create(DesktopPlatform.Linux, LinuxSessionType.Unknown) instanceof UnsupportedHotkeyPlatformPolicy,
    );
    assert.ok(
      new HotkeyPlatformPolicyFactory({
        createWindowsPolicy: () => {
          throw new Error('not qualified');
        },
      }).create(DesktopPlatform.Windows, LinuxSessionType.NotApplicable) instanceof UnsupportedHotkeyPlatformPolicy,
    );
  });
});

describe('Windows hotkey policy', () => {
  it('reserves every F12 form and Super-modifier accelerator while allowing the other function keys', () => {
    const policy = new WindowsHotkeyPlatformPolicy();

    for (const accelerator of ['F12', 'Alt+F12', 'Ctrl+Shift+F12', 'Super+F9']) {
      assert.deepEqual(policy.validate(accelerator), {
        accepted: false,
        failureCode: HotkeyRegistrationFailureCode.OsReserved,
      });
    }
    for (const accelerator of ['F1', 'Ctrl+F11', 'F13', 'Ctrl+Alt+F24', 'Ctrl+Shift+K']) {
      assert.deepEqual(policy.validate(accelerator), {
        accepted: true,
        bindingAuthority: HotkeyBindingAuthority.Application,
        effectiveAccelerator: accelerator,
      });
    }
  });

  it('preserves reserved startup preferences as failed without calling the Electron adapter', () => {
    let settings = setHotkeyForTarget(createUnassignedHotkeySettings(), 'record', 'Ctrl+F12');
    settings = setHotkeyForTarget(settings, 'stop', 'Super+F9');
    const { adapter, service } = createService(settings, new WindowsHotkeyPlatformPolicy(), 'win32');

    const snapshot = service.start();

    assert.deepEqual(adapter.registrations, []);
    for (const [target, configuredAccelerator] of [
      ['record', 'Ctrl+F12'],
      ['stop', 'Super+F9'],
    ] as const) {
      assert.deepEqual(
        snapshot.entries.find((entry) => entry.target === target),
        {
          bindingAuthority: HotkeyBindingAuthority.None,
          configuredAccelerator,
          dispatchStatus: HotkeyDispatchStatus.Enabled,
          effectiveAccelerator: null,
          failureCode: HotkeyRegistrationFailureCode.OsReserved,
          registrationStatus: HotkeyRegistrationStatus.Failed,
          target,
        },
      );
    }
  });

  it('rejects a reserved candidate before adapter registration', () => {
    const { adapter, service } = createService(
      createUnassignedHotkeySettings(),
      new WindowsHotkeyPlatformPolicy(),
      'win32',
    );

    const result = service.set('record', 'Super+F9');

    assert.equal(result.success, false);
    assert.equal(result.failureCode, HotkeyRegistrationFailureCode.OsReserved);
    assert.deepEqual(adapter.registrations, []);
  });

  it('prioritizes the reserved policy over a legacy internal F12 conflict', () => {
    let settings = setHotkeyForTarget(createUnassignedHotkeySettings(), 'prettify', 'F12');
    settings = setHotkeyForTarget(settings, 'prettifyQuick', 'Ctrl+F12');
    const { adapter, service } = createService(settings, new WindowsHotkeyPlatformPolicy(), 'win32');

    const startup = service.start();
    const replacement = service.set('record', 'F12');

    assert.deepEqual(adapter.registrations, []);
    assert.equal(
      startup.entries.find((entry) => entry.target === 'prettify')?.failureCode,
      HotkeyRegistrationFailureCode.OsReserved,
    );
    assert.equal(
      startup.entries.find((entry) => entry.target === 'prettifyQuick')?.failureCode,
      HotkeyRegistrationFailureCode.OsReserved,
    );
    assert.equal(replacement.success, false);
    assert.equal(replacement.failureCode, HotkeyRegistrationFailureCode.OsReserved);
  });
});

describe('Linux X11 hotkey policy', () => {
  it('classifies only the bounded Linux session value', () => {
    assert.equal(classifyLinuxSessionType('linux', 'x11'), LinuxSessionType.X11);
    assert.equal(classifyLinuxSessionType('linux', 'wayland'), LinuxSessionType.Wayland);
    assert.equal(classifyLinuxSessionType('linux', 'unsupported'), LinuxSessionType.Unknown);
    assert.equal(classifyLinuxSessionType('win32', 'x11'), LinuxSessionType.NotApplicable);
  });

  it('accepts F12 without a Windows reservation and registers it through the shared adapter contract', () => {
    const { adapter, service } = createService(
      createUnassignedHotkeySettings(),
      new LinuxHotkeyPlatformPolicy(LinuxSessionType.X11),
    );

    const result = service.set('record', LINUX_F12_ACCELERATOR);

    assert.equal(result.success, true);
    assert.equal(adapter.isRegistered(LINUX_F12_ACCELERATOR), true);
    const record = result.snapshot.entries.find((entry) => entry.target === 'record');
    assert.deepEqual(record, {
      bindingAuthority: HotkeyBindingAuthority.Application,
      configuredAccelerator: LINUX_F12_ACCELERATOR,
      dispatchStatus: HotkeyDispatchStatus.Enabled,
      effectiveAccelerator: LINUX_F12_ACCELERATOR,
      registrationStatus: HotkeyRegistrationStatus.Registered,
      target: 'record',
    });
  });

  it('retains Wayland preferences without claiming an effective accelerator', () => {
    const { adapter, service } = createService(
      createUnassignedHotkeySettings(),
      new LinuxHotkeyPlatformPolicy(LinuxSessionType.Wayland),
    );

    const result = service.set('record', LINUX_F12_ACCELERATOR);

    assert.equal(result.success, true);
    assert.equal(adapter.isRegistered(LINUX_F12_ACCELERATOR), true);
    const record = result.snapshot.entries.find((entry) => entry.target === 'record');
    assert.deepEqual(record, {
      bindingAuthority: HotkeyBindingAuthority.DesktopEnvironment,
      configuredAccelerator: LINUX_F12_ACCELERATOR,
      dispatchStatus: HotkeyDispatchStatus.Enabled,
      effectiveAccelerator: null,
      registrationStatus: HotkeyRegistrationStatus.Registered,
      target: 'record',
    });
  });
});

describe('ElectronGlobalShortcutAdapter', () => {
  it('maps void cleanup and native exceptions to bounded results', () => {
    let unregisterCalls = 0;
    const adapter = new ElectronGlobalShortcutAdapter({
      isRegistered: () => true,
      register: () => true,
      unregister: () => {
        unregisterCalls += 1;
      },
      unregisterAll: () => undefined,
    });
    assert.equal(adapter.unregister('F9'), true);
    assert.equal(unregisterCalls, 1);
    assert.equal(
      adapter.register('F9', () => undefined),
      true,
    );

    const failing = new ElectronGlobalShortcutAdapter({
      isRegistered: () => {
        throw new Error('native payload');
      },
      register: () => {
        throw new Error('native payload');
      },
      unregister: () => {
        throw new Error('native payload');
      },
      unregisterAll: () => {
        throw new Error('native payload');
      },
    });
    assert.equal(failing.isRegistered('F9'), false);
    assert.equal(
      failing.register('F9', () => undefined),
      false,
    );
    assert.equal(failing.unregister('F9'), false);
    failing.unregisterAll();
  });
});

describe('HotkeyRegistrationService', () => {
  it('starts each valid configured target independently in canonical snapshot order', () => {
    const settings = { ...createUnassignedHotkeySettings(), hotkey: 'F9', stopHotkey: 'F9', translateHotkey: 'F11' };
    const { adapter, service } = createService(settings);
    const snapshot = service.start();

    assert.deepEqual(
      snapshot.entries.map((entry) => entry.target),
      ['record', 'stop', 'cancel', 'translate', 'prettify', 'prettifyQuick', 'retryTranscription'],
    );
    assert.equal(snapshot.entries[0]?.registrationStatus, HotkeyRegistrationStatus.Failed);
    assert.equal(snapshot.entries[0]?.failureCode, HotkeyRegistrationFailureCode.InternalConflict);
    assert.equal(snapshot.entries[3]?.registrationStatus, HotkeyRegistrationStatus.Registered);
    assert.equal(adapter.isRegistered('F11'), true);
    assert.equal(isHotkeyRuntimeSnapshot(snapshot), true);
  });

  it('publishes exact unassigned, failed, application, and desktop-managed snapshot invariants', () => {
    const unassigned = createService();
    assert.equal(isHotkeyRuntimeSnapshot(unassigned.service.snapshot), true);
    assert.deepEqual(unassigned.service.snapshot.entries[0], {
      bindingAuthority: HotkeyBindingAuthority.None,
      configuredAccelerator: null,
      dispatchStatus: HotkeyDispatchStatus.Enabled,
      effectiveAccelerator: null,
      registrationStatus: HotkeyRegistrationStatus.Unassigned,
      target: 'record',
    });

    const application = createService({ ...createUnassignedHotkeySettings(), hotkey: 'ctrl + f9' });
    const applicationEntry = application.service.start().entries[0];
    assert.equal(applicationEntry?.bindingAuthority, HotkeyBindingAuthority.Application);
    assert.equal(applicationEntry?.effectiveAccelerator, 'Ctrl+F9');
    assert.equal(isHotkeyRuntimeSnapshot(application.service.snapshot), true);

    const desktopManaged = createService(
      { ...createUnassignedHotkeySettings(), hotkey: 'F9' },
      createDesktopManagedPolicy(),
    );
    const desktopManagedEntry = desktopManaged.service.start().entries[0];
    assert.equal(desktopManagedEntry?.bindingAuthority, HotkeyBindingAuthority.DesktopEnvironment);
    assert.equal(desktopManagedEntry?.effectiveAccelerator, null);

    const failed = createService(
      { ...createUnassignedHotkeySettings(), hotkey: 'F9' },
      new UnsupportedHotkeyPlatformPolicy(),
    );
    const failedEntry = failed.service.start().entries[0];
    assert.deepEqual(
      {
        authority: failedEntry?.bindingAuthority,
        effective: failedEntry?.effectiveAccelerator,
        failure: failedEntry?.failureCode,
        status: failedEntry?.registrationStatus,
      },
      {
        authority: HotkeyBindingAuthority.None,
        effective: null,
        failure: HotkeyRegistrationFailureCode.UnsupportedPlatform,
        status: HotkeyRegistrationStatus.Failed,
      },
    );
    assert.equal(isHotkeyRuntimeSnapshot(failed.service.snapshot), true);
  });

  it('starts automatically for a mutation so an existing configured binding remains candidate-first', () => {
    const { adapter, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });

    const result = service.set('record', 'F8');

    assert.equal(result.success, true);
    assert.equal(adapter.isRegistered('F9'), false);
    assert.equal(adapter.isRegistered('F8'), true);
  });

  it('treats a normalized configured accelerator as a semantic no-op', () => {
    const { adapter, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'ctrl + f9' });
    service.start();

    const result = service.set('record', 'Ctrl+F9');

    assert.equal(result.success, true);
    assert.deepEqual(adapter.registrations, ['Ctrl+F9']);
    assert.equal(service.snapshot.entries[0]?.configuredAccelerator, 'ctrl + f9');
  });

  it('replaces candidate-first and preserves the previous binding when persistence fails', () => {
    const { adapter, config, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    service.start();
    config.failPersistence = true;
    const result = service.set('record', 'F8');

    assert.equal(result.success, false);
    assert.equal(result.failureCode, HotkeyRegistrationFailureCode.PersistenceFailed);
    assert.equal(adapter.isRegistered('F9'), true);
    assert.equal(adapter.isRegistered('F8'), false);
    assert.equal(service.snapshot.entries[0]?.configuredAccelerator, 'F9');
  });

  it('retains the authoritative binding after candidate rejection or partial registration', () => {
    const { adapter, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    service.start();
    adapter.failRegister.add('F8');
    assert.equal(service.set('record', 'F8').failureCode, HotkeyRegistrationFailureCode.RegistrationRejected);
    assert.equal(adapter.isRegistered('F9'), true);
    adapter.failRegister.delete('F8');
    adapter.hiddenFromQuery.add('F8');
    assert.equal(service.set('record', 'F8').failureCode, HotkeyRegistrationFailureCode.RegistrationRejected);
    assert.equal(adapter.isRegistered('F9'), true);
    assert.equal(service.snapshot.entries[0]?.configuredAccelerator, 'F9');
  });

  it('replaces a binding without allowing its stale callback to dispatch', () => {
    const { adapter, calls, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    service.start();
    const stale = adapter.callbacks.get('F9');
    assert.ok(stale);

    assert.equal(service.set('record', 'F8').success, true);
    stale();
    adapter.fire('F8');

    assert.deepEqual(calls, ['record']);
    assert.equal(service.snapshot.entries[0]?.configuredAccelerator, 'F8');
  });

  it('compensates a failed old-binding removal back to one prior configured and bound pair', () => {
    const { adapter, calls, config, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    service.start();
    adapter.failUnregisterOnce.add('F9');

    const result = service.set('record', 'F8');

    assert.equal(result.success, false);
    assert.equal(result.failureCode, HotkeyRegistrationFailureCode.ReconciliationFailed);
    assert.equal(config.getSnapshot().hotkey, 'F9');
    assert.equal(adapter.isRegistered('F8'), false);
    assert.equal(adapter.isRegistered('F9'), true);
    assert.equal(service.snapshot.entries[0]?.registrationStatus, HotkeyRegistrationStatus.Registered);
    adapter.fire('F9');
    assert.deepEqual(calls, ['record']);
  });

  it('reports a bounded reconciled failure with the actual persisted preference when recovery cannot finish', () => {
    const { adapter, config, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    service.start();
    adapter.failUnregister.add('F9');
    config.failPersistenceOnCall.add(2);

    const result = service.set('record', 'F8');
    const entry = service.snapshot.entries[0];

    assert.equal(result.failureCode, HotkeyRegistrationFailureCode.ReconciliationFailed);
    assert.equal(config.getSnapshot().hotkey, 'F8');
    assert.deepEqual(
      {
        authority: entry?.bindingAuthority,
        configured: entry?.configuredAccelerator,
        effective: entry?.effectiveAccelerator,
        failure: entry?.failureCode,
        status: entry?.registrationStatus,
      },
      {
        authority: HotkeyBindingAuthority.None,
        configured: 'F8',
        effective: null,
        failure: HotkeyRegistrationFailureCode.ReconciliationFailed,
        status: HotkeyRegistrationStatus.Failed,
      },
    );
    assert.equal(isHotkeyRuntimeSnapshot(service.snapshot), true);
  });

  it('contains subscriber failures, retains Retry permanently, and reports unsupported startup safely', () => {
    const unsupported = createService({ ...createUnassignedHotkeySettings(), retryTranscriptionHotkey: 'Ctrl+F8' });
    const service = new HotkeyRegistrationService({
      adapter: unsupported.adapter,
      callbacks: Object.freeze({
        record: () => undefined,
        stop: () => undefined,
        cancel: () => undefined,
        translate: () => undefined,
        prettify: () => undefined,
        prettifyQuick: () => undefined,
        retryTranscription: () => undefined,
      }),
      clock: unsupported.clock,
      config: unsupported.config,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      policy: new UnsupportedHotkeyPlatformPolicy(),
    });
    service.subscribe(() => {
      throw new Error('subscriber failure');
    });
    const snapshot = service.start();
    assert.equal(snapshot.entries[6]?.registrationStatus, HotkeyRegistrationStatus.Failed);
    assert.equal(snapshot.entries[6]?.failureCode, HotkeyRegistrationFailureCode.UnsupportedPlatform);

    const supported = createService({ ...createUnassignedHotkeySettings(), retryTranscriptionHotkey: 'Ctrl+F8' });
    supported.service.start();
    assert.equal(supported.adapter.isRegistered('Ctrl+F8'), true);
  });

  it('suppresses under the main interaction lock without releasing a binding and detects a physical test', async () => {
    const { adapter, calls, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    const lock = new MainInteractionLock(() => false);
    service.connectMainInteractionLock(lock);
    service.start();
    const detected = service.test('record');
    adapter.fire('F9');

    assert.equal(await detected, HotkeyTestResult.Detected);
    assert.equal(adapter.isRegistered('F9'), true);
    assert.deepEqual(calls, []);

    const acquisition = lock.acquire();
    assert.ok(acquisition.lease);
    adapter.fire('F9');
    assert.deepEqual(calls, []);
    assert.equal(service.snapshot.entries[0]?.dispatchStatus, HotkeyDispatchStatus.Suppressed);

    acquisition.lease.release();
    adapter.fire('F9');
    assert.deepEqual(calls, ['record']);

    service.dispose();
    assert.equal(adapter.unregisterAllCalls, 1);
  });

  it('settles one physical test exactly once across duplicate starts, mutation cancellation, and dispose', async () => {
    const { adapter, clock, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    service.start();

    const first = service.test('record');
    assert.equal(await service.test('record'), HotkeyTestResult.Unavailable);
    assert.equal(service.set('record', 'F8').success, true);
    assert.equal(await first, HotkeyTestResult.Unavailable);
    assert.equal(clock.timers.size, 0);

    const activeAtDispose = service.test('record');
    service.dispose();
    assert.equal(await activeAtDispose, HotkeyTestResult.Unavailable);
    assert.equal(clock.timers.size, 0);
    adapter.fire('F8');
  });

  it('times out, clears idempotently, invalidates stale callbacks, and disposes exactly once', async () => {
    const { adapter, calls, clock, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    service.start();
    const stale = adapter.callbacks.get('F9');
    assert.ok(stale);
    const timedOut = service.test('record');
    clock.fireOne();
    assert.equal(await timedOut, HotkeyTestResult.TimedOut);

    assert.equal(service.clear('record').success, true);
    stale();
    assert.deepEqual(calls, []);
    assert.equal(service.clear('record').success, true);
    service.dispose();
    service.dispose();
    assert.equal(adapter.unregisterAllCalls, 1);
  });

  it('settles cancellation and irreconcilable cleanup without allowing a stale callback to dispatch', async () => {
    const { adapter, calls, service } = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    service.start();
    const cancelled = service.test('record');
    service.cancelTest();
    assert.equal(await cancelled, HotkeyTestResult.Unavailable);

    const stale = adapter.callbacks.get('F9');
    assert.ok(stale);
    adapter.failUnregister.add('F9');
    const result = service.clear('record');
    assert.equal(result.failureCode, HotkeyRegistrationFailureCode.ReconciliationFailed);
    assert.equal(service.snapshot.entries[0]?.registrationStatus, HotkeyRegistrationStatus.Failed);
    stale();
    assert.deepEqual(calls, []);
  });

  it('compensates a clear removal failure and reports a bounded failure if its persistence repair fails', () => {
    const recovered = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    recovered.service.start();
    recovered.adapter.failUnregisterOnce.add('F9');

    const recoveredResult = recovered.service.clear('record');
    assert.equal(recoveredResult.failureCode, HotkeyRegistrationFailureCode.ReconciliationFailed);
    assert.equal(recovered.config.getSnapshot().hotkey, 'F9');
    assert.equal(recovered.adapter.isRegistered('F9'), true);
    assert.equal(recovered.service.snapshot.entries[0]?.registrationStatus, HotkeyRegistrationStatus.Registered);

    const irreconcilable = createService({ ...createUnassignedHotkeySettings(), hotkey: 'F9' });
    irreconcilable.service.start();
    irreconcilable.adapter.failUnregister.add('F9');
    irreconcilable.config.failPersistenceOnCall.add(2);

    const failedResult = irreconcilable.service.clear('record');
    const failedEntry = irreconcilable.service.snapshot.entries[0];
    assert.equal(failedResult.failureCode, HotkeyRegistrationFailureCode.ReconciliationFailed);
    assert.equal(irreconcilable.config.getSnapshot().hotkey, null);
    assert.deepEqual(
      {
        authority: failedEntry?.bindingAuthority,
        configured: failedEntry?.configuredAccelerator,
        effective: failedEntry?.effectiveAccelerator,
        failure: failedEntry?.failureCode,
        status: failedEntry?.registrationStatus,
      },
      {
        authority: HotkeyBindingAuthority.None,
        configured: null,
        effective: null,
        failure: HotkeyRegistrationFailureCode.ReconciliationFailed,
        status: HotkeyRegistrationStatus.Failed,
      },
    );
    assert.equal(isHotkeyRuntimeSnapshot(irreconcilable.service.snapshot), true);
  });
});
