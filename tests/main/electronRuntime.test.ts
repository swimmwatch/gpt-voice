import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { showSystemNotificationWithRuntime } from '@main/electronRuntime';

interface TestNotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  sound?: string;
}

function createNotificationRuntime(notifications: TestNotificationOptions[]) {
  return class TestNotification {
    constructor(options: TestNotificationOptions) {
      notifications.push(options);
    }

    show(): void {}
  };
}

describe('electronRuntime notifications', () => {
  it('shows non-silent native notifications without sound by default', () => {
    const notifications: TestNotificationOptions[] = [];

    showSystemNotificationWithRuntime(
      { Notification: createNotificationRuntime(notifications) },
      'linux',
      'Title',
      'Body',
    );

    assert.deepEqual(notifications, [{ title: 'Title', body: 'Body', silent: false }]);
  });

  it('uses a single system beep for success sounds on non-macOS platforms', () => {
    const notifications: TestNotificationOptions[] = [];
    let beepCount = 0;
    const scheduled: Array<{ callback: () => void; delayMs: number }> = [];

    showSystemNotificationWithRuntime(
      {
        Notification: createNotificationRuntime(notifications),
        shell: {
          beep: () => {
            beepCount += 1;
          },
        },
      },
      'win32',
      'Done',
      'Copied',
      { sound: 'success' },
      (callback, delayMs) => scheduled.push({ callback, delayMs }),
    );

    assert.deepEqual(notifications, [{ title: 'Done', body: 'Copied', silent: false }]);
    assert.equal(beepCount, 1);
    assert.deepEqual(scheduled, []);
  });

  it('uses a double system beep for error sounds on non-macOS platforms', () => {
    const notifications: TestNotificationOptions[] = [];
    let beepCount = 0;
    const scheduled: Array<{ callback: () => void; delayMs: number }> = [];

    showSystemNotificationWithRuntime(
      {
        Notification: createNotificationRuntime(notifications),
        shell: {
          beep: () => {
            beepCount += 1;
          },
        },
      },
      'linux',
      'Failed',
      'Provider unavailable',
      { sound: 'error' },
      (callback, delayMs) => scheduled.push({ callback, delayMs }),
    );

    assert.deepEqual(notifications, [{ title: 'Failed', body: 'Provider unavailable', silent: false }]);
    assert.equal(beepCount, 1);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0]?.delayMs, 160);

    scheduled[0]?.callback();

    assert.equal(beepCount, 2);
  });

  it('uses named macOS notification sounds without fallback beeps', () => {
    const notifications: TestNotificationOptions[] = [];
    let beepCount = 0;

    showSystemNotificationWithRuntime(
      {
        Notification: createNotificationRuntime(notifications),
        shell: {
          beep: () => {
            beepCount += 1;
          },
        },
      },
      'darwin',
      'Failed',
      'Provider unavailable',
      { sound: 'error' },
    );

    assert.deepEqual(notifications, [{ title: 'Failed', body: 'Provider unavailable', silent: false, sound: 'Basso' }]);
    assert.equal(beepCount, 0);
  });

  it('does not block notifications when fallback sound is unavailable or fails', () => {
    const notifications: TestNotificationOptions[] = [];

    assert.doesNotThrow(() => {
      showSystemNotificationWithRuntime(
        {
          Notification: createNotificationRuntime(notifications),
          shell: {
            beep: () => {
              throw new Error('beep unavailable');
            },
          },
        },
        'linux',
        'Done',
        'Copied',
        { sound: 'success' },
      );
    });

    assert.deepEqual(notifications, [{ title: 'Done', body: 'Copied', silent: false }]);
  });
});
