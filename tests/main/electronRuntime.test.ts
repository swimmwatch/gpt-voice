import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ElectronRuntimeLoader, type ElectronRuntimeModule, type NotificationOptions } from '@main/electronRuntime';

function createNotificationRuntime(notifications: NotificationOptions[]) {
  return class TestNotification {
    public constructor(options: NotificationOptions) {
      notifications.push(options);
    }

    public show(): void {}
  };
}

function createLoader(
  runtime: ElectronRuntimeModule,
  platform: NodeJS.Platform,
  scheduled: Array<{ callback: () => void; delayMs: number }> = [],
  warnings: unknown[][] = [],
): ElectronRuntimeLoader {
  return new ElectronRuntimeLoader({
    loadModule: () => runtime,
    logger: {
      warn: (...args) => warnings.push(args),
    },
    platform,
    schedule: (callback, delayMs) => scheduled.push({ callback, delayMs }),
  });
}

describe('ElectronRuntimeLoader', () => {
  it('loads and caches one runtime per loader while keeping loaders isolated', () => {
    let firstLoads = 0;
    let secondLoads = 0;
    const first = new ElectronRuntimeLoader({
      loadModule: () => {
        firstLoads += 1;
        return { clipboard: { readText: () => 'first', writeText: () => undefined } };
      },
      logger: { warn: () => undefined },
      platform: 'linux',
      schedule: () => undefined,
    });
    const second = new ElectronRuntimeLoader({
      loadModule: () => {
        secondLoads += 1;
        return { clipboard: { readText: () => 'second', writeText: () => undefined } };
      },
      logger: { warn: () => undefined },
      platform: 'linux',
      schedule: () => undefined,
    });

    assert.equal(first.readClipboardText(), 'first');
    first.writeClipboardText('value');
    assert.equal(second.readClipboardText(), 'second');
    assert.equal(firstLoads, 1);
    assert.equal(secondLoads, 1);
  });

  it('owns clipboard, safe-storage, and shell operations', async () => {
    const writes: Array<{ text: string; type?: string }> = [];
    const opened: string[] = [];
    const loader = createLoader(
      {
        clipboard: {
          readText: (type) => type ?? 'clipboard',
          writeText: (text, type) => writes.push({ text, type }),
        },
        safeStorage: {
          decryptString: (encrypted) => encrypted.toString('utf8'),
          encryptString: (plainText) => Buffer.from(plainText),
          isEncryptionAvailable: () => true,
        },
        shell: {
          beep: () => undefined,
          openExternal: async (url) => {
            opened.push(url);
          },
        },
      },
      'linux',
    );

    assert.equal(loader.readClipboardText('selection'), 'selection');
    loader.writeTypedClipboardText('selected', 'selection');
    assert.deepEqual(writes, [{ text: 'selected', type: 'selection' }]);
    assert.equal(loader.isSafeStorageEncryptionAvailable(), true);
    assert.equal(loader.decryptSafeStorageString(loader.encryptSafeStorageString('secret')), 'secret');
    await loader.openExternal('https://example.invalid');
    assert.deepEqual(opened, ['https://example.invalid']);
  });

  it('shows non-silent native notifications without sound by default', () => {
    const notifications: NotificationOptions[] = [];
    const loader = createLoader({ Notification: createNotificationRuntime(notifications) }, 'linux');

    loader.showSystemNotification('Title', 'Body');

    assert.deepEqual(notifications, [{ title: 'Title', body: 'Body', silent: false }]);
  });

  it('uses a single system beep for success sounds on non-macOS platforms', () => {
    const notifications: NotificationOptions[] = [];
    let beepCount = 0;
    const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
    const loader = createLoader(
      {
        Notification: createNotificationRuntime(notifications),
        shell: {
          beep: () => {
            beepCount += 1;
          },
          openExternal: async () => undefined,
        },
      },
      'win32',
      scheduled,
    );

    loader.showSystemNotification('Done', 'Copied', { sound: 'success' });

    assert.deepEqual(notifications, [{ title: 'Done', body: 'Copied', silent: false }]);
    assert.equal(beepCount, 1);
    assert.deepEqual(scheduled, []);
  });

  it('uses a double system beep for error sounds on non-macOS platforms', () => {
    const notifications: NotificationOptions[] = [];
    let beepCount = 0;
    const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
    const loader = createLoader(
      {
        Notification: createNotificationRuntime(notifications),
        shell: {
          beep: () => {
            beepCount += 1;
          },
          openExternal: async () => undefined,
        },
      },
      'linux',
      scheduled,
    );

    loader.showSystemNotification('Failed', 'Provider unavailable', { sound: 'error' });
    assert.equal(beepCount, 1);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0]?.delayMs, 160);

    scheduled[0]?.callback();
    assert.equal(beepCount, 2);
  });

  it('uses named macOS notification sounds without fallback beeps', () => {
    const notifications: NotificationOptions[] = [];
    let beepCount = 0;
    const loader = createLoader(
      {
        Notification: createNotificationRuntime(notifications),
        shell: {
          beep: () => {
            beepCount += 1;
          },
          openExternal: async () => undefined,
        },
      },
      'darwin',
    );

    loader.showSystemNotification('Failed', 'Provider unavailable', { sound: 'error' });

    assert.deepEqual(notifications, [{ title: 'Failed', body: 'Provider unavailable', silent: false, sound: 'Basso' }]);
    assert.equal(beepCount, 0);
  });

  it('does not block notifications when fallback sound fails', () => {
    const notifications: NotificationOptions[] = [];
    const warnings: unknown[][] = [];
    const loader = createLoader(
      {
        Notification: createNotificationRuntime(notifications),
        shell: {
          beep: () => {
            throw new Error('beep unavailable');
          },
          openExternal: async () => undefined,
        },
      },
      'linux',
      [],
      warnings,
    );

    assert.doesNotThrow(() => loader.showSystemNotification('Done', 'Copied', { sound: 'success' }));
    assert.equal(warnings.length, 1);
  });
});
