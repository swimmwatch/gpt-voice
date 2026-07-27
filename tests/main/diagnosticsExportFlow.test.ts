/* eslint-disable max-classes-per-file -- the service harness owns isolated dialog, archive, window, and notification fakes. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BrowserWindow, SaveDialogOptions, SaveDialogReturnValue } from 'electron';

import type { TranslationKey } from '@main/i18n';
import { DiagnosticsExportService, type DiagnosticsExportServiceDependencies } from '@main/services/diagnosticsExport';
import { isDiagnosticsExportResult } from '@shared/diagnosticsArchive';
import type { SystemNotificationOptions } from '@shared/notifications';

const FIXED_DATE = new Date('2026-07-28T12:34:56.789Z');
const FIXED_RANDOM_BYTES = Buffer.from([0x01, 0x02, 0x03, 0x04]);
const TRANSLATED_PREFIX = 'translated:';

class TestSettingsWindow {
  public closeCount = 0;
  public destroyed = false;
  public readonly webContents;

  public constructor(id: number) {
    this.webContents = {
      getURL: () => 'app://gpt-voice/settings.html',
      id,
    };
  }

  public close(): void {
    this.closeCount += 1;
    this.destroyed = true;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }
}

interface DialogCall {
  readonly options: SaveDialogOptions;
  readonly parentWindow: BrowserWindow;
}

interface NotificationCall {
  readonly body: string;
  readonly options: SystemNotificationOptions | undefined;
  readonly title: string;
}

class DiagnosticsExportHarness {
  public readonly archivePaths: string[] = [];
  public readonly dialogCalls: DialogCall[] = [];
  public readonly dialogResults: Array<Promise<SaveDialogReturnValue> | SaveDialogReturnValue> = [];
  public readonly existingPaths = new Set<string>();
  public readonly notifications: NotificationCall[] = [];
  public readonly warnings: Array<{ readonly message: string; readonly metadata?: Readonly<Record<string, unknown>> }> =
    [];
  public archiveResults: Array<
    Promise<{ readonly status: 'failure' | 'success' }> | { readonly status: 'failure' | 'success' }
  > = [{ status: 'success' }];
  public nowValue = FIXED_DATE;
  public platform: NodeJS.Platform;
  public randomBytesValue = FIXED_RANDOM_BYTES;
  public throwNotification = false;
  public readonly service: DiagnosticsExportService;

  public constructor(platform: NodeJS.Platform = 'linux') {
    this.platform = platform;
    const dependencies: DiagnosticsExportServiceDependencies = {
      archive: this,
      dialog: this,
      fileSystem: this,
      localization: this,
      logger: this,
      notification: this,
      now: this.now,
      platform,
      randomBytes: this.randomBytes,
    };
    this.service = new DiagnosticsExportService(dependencies);
  }

  public createArchive(destinationPath: string): Promise<{ readonly status: 'failure' | 'success' }> {
    this.archivePaths.push(destinationPath);
    return Promise.resolve(this.archiveResults.shift() ?? { status: 'success' });
  }

  public readonly now = (): Date => this.nowValue;

  public pathExists(filePath: string): Promise<boolean> {
    return Promise.resolve(this.existingPaths.has(filePath));
  }

  public readonly randomBytes = (size: number): Buffer => {
    assert.equal(size, FIXED_RANDOM_BYTES.byteLength);
    return this.randomBytesValue;
  };

  public show(title: string, body: string, options?: SystemNotificationOptions): void {
    if (this.throwNotification) throw new Error('private notification failure');
    this.notifications.push({ body, options, title });
  }

  public async showSaveDialog(parentWindow: BrowserWindow, options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
    this.dialogCalls.push({ options, parentWindow });
    const result = this.dialogResults.shift();
    if (!result) throw new Error('private dialog failure');
    return result;
  }

  public translate(key: TranslationKey): string {
    return `${TRANSLATED_PREFIX}${key}`;
  }

  public warn(message: string, metadata?: Readonly<Record<string, unknown>>): void {
    this.warnings.push({ message, metadata });
  }
}

function createDeferred<Value>(): {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
} {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((_resolve) => {
    resolve = _resolve;
  });
  return { promise, resolve };
}

describe('diagnostics export flow', () => {
  for (const [platform, extension, filterExtension] of [
    ['win32', '.zip', 'zip'],
    ['linux', '.tar.gz', 'tar.gz'],
    ['darwin', '.tar.gz', 'tar.gz'],
  ] as const) {
    it(`owns the ${platform} filename, filter, successful archive, and notification without closing Settings`, async () => {
      const window = new TestSettingsWindow(1);
      const harness = new DiagnosticsExportHarness(platform);
      const destination = `/synthetic/diagnostics${extension}`;
      harness.dialogResults.push({ canceled: false, filePath: destination });

      const result = await harness.service.export(window as unknown as BrowserWindow);

      assert.deepEqual(result, { status: 'saved' });
      assert.equal(isDiagnosticsExportResult(result), true);
      assert.deepEqual(Object.keys(result), ['status']);
      assert.deepEqual(harness.archivePaths, [destination]);
      assert.equal(window.closeCount, 0);
      assert.deepEqual(harness.notifications, [
        {
          body: `${TRANSLATED_PREFIX}notification.diagnosticsExportSavedBody`,
          options: { sound: 'success' },
          title: `${TRANSLATED_PREFIX}notification.diagnosticsExportSaved`,
        },
      ]);
      assert.equal(harness.dialogCalls.length, 1);
      const dialogCall = harness.dialogCalls[0];
      assert.equal(dialogCall?.parentWindow, window as unknown as BrowserWindow);
      assert.equal(dialogCall?.options.defaultPath, `gpt-voice-diagnostics-20260728T123456Z-01020304${extension}`);
      assert.deepEqual(dialogCall?.options.filters, [
        {
          extensions: [filterExtension],
          name: platform === 'win32' ? 'ZIP archive' : 'Compressed tar archive',
        },
      ]);
      assert.deepEqual(dialogCall?.options.properties, ['createDirectory', 'showOverwriteConfirmation']);
      assert.equal(dialogCall?.options.title, `${TRANSLATED_PREFIX}auditLog.exportDialogTitle`);
    });
  }

  it('appends the full suffix once and reopens native confirmation for an existing appended destination', async () => {
    const window = new TestSettingsWindow(2);
    const harness = new DiagnosticsExportHarness();
    harness.existingPaths.add('/synthetic/support.tar.gz');
    harness.dialogResults.push(
      { canceled: false, filePath: '/synthetic/support' },
      { canceled: false, filePath: '/synthetic/support.tar.gz' },
    );

    assert.deepEqual(await harness.service.export(window as unknown as BrowserWindow), { status: 'saved' });

    assert.equal(harness.dialogCalls.length, 2);
    assert.equal(harness.dialogCalls[1]?.options.defaultPath, '/synthetic/support.tar.gz');
    assert.deepEqual(harness.archivePaths, ['/synthetic/support.tar.gz']);
  });

  it('treats cancellation from exact-path overwrite confirmation as cancellation without archive work', async () => {
    const window = new TestSettingsWindow(12);
    const harness = new DiagnosticsExportHarness();
    harness.existingPaths.add('/synthetic/existing.tar.gz');
    harness.dialogResults.push({ canceled: false, filePath: '/synthetic/existing' }, { canceled: true, filePath: '' });

    assert.deepEqual(await harness.service.export(window as unknown as BrowserWindow), { status: 'cancelled' });
    assert.deepEqual(harness.archivePaths, []);
    assert.deepEqual(harness.notifications, []);
    assert.equal(window.closeCount, 0);
  });

  it('recognizes an existing case-insensitive full suffix without double-appending', async () => {
    const window = new TestSettingsWindow(3);
    const harness = new DiagnosticsExportHarness();
    harness.dialogResults.push({ canceled: false, filePath: '/synthetic/SUPPORT.TAR.GZ' });

    assert.deepEqual(await harness.service.export(window as unknown as BrowserWindow), { status: 'saved' });
    assert.deepEqual(harness.archivePaths, ['/synthetic/SUPPORT.TAR.GZ']);
  });

  it('cancels without archive, notification, or Settings close and remains retryable', async () => {
    const window = new TestSettingsWindow(4);
    const harness = new DiagnosticsExportHarness();
    harness.dialogResults.push(
      { canceled: true, filePath: '' },
      { canceled: false, filePath: '/synthetic/retry.tar.gz' },
    );

    assert.deepEqual(await harness.service.export(window as unknown as BrowserWindow), { status: 'cancelled' });
    assert.deepEqual(harness.archivePaths, []);
    assert.deepEqual(harness.notifications, []);
    assert.equal(window.closeCount, 0);

    assert.deepEqual(await harness.service.export(window as unknown as BrowserWindow), { status: 'saved' });
    assert.deepEqual(harness.archivePaths, ['/synthetic/retry.tar.gz']);
  });

  it('keeps a failed export open and retryable with only safe failure presentation', async () => {
    const window = new TestSettingsWindow(5);
    const harness = new DiagnosticsExportHarness();
    harness.dialogResults.push(
      { canceled: false, filePath: '/private/alice/secret.tar.gz' },
      { canceled: false, filePath: '/synthetic/retry.tar.gz' },
    );
    harness.archiveResults = [{ status: 'failure' }, { status: 'success' }];

    const failed = await harness.service.export(window as unknown as BrowserWindow);

    assert.deepEqual(failed, { status: 'failed' });
    assert.equal(window.closeCount, 0);
    assert.deepEqual(harness.notifications[0], {
      body: `${TRANSLATED_PREFIX}notification.diagnosticsExportFailedBody`,
      options: { sound: 'error' },
      title: `${TRANSLATED_PREFIX}notification.diagnosticsExportFailed`,
    });
    assert.doesNotMatch(JSON.stringify([failed, harness.notifications, harness.warnings]), /alice|secret|private/u);

    assert.deepEqual(await harness.service.export(window as unknown as BrowserWindow), { status: 'saved' });
  });

  it('normalizes a rejected archive dependency to the closed failure result', async () => {
    const window = new TestSettingsWindow(13);
    const harness = new DiagnosticsExportHarness();
    harness.dialogResults.push({ canceled: false, filePath: '/private/alice/rejected.tar.gz' });
    harness.archiveResults = [Promise.reject(new Error('private archive stack /home/alice'))];

    const result = await harness.service.export(window as unknown as BrowserWindow);

    assert.deepEqual(result, { status: 'failed' });
    assert.equal(isDiagnosticsExportResult(result), true);
    assert.equal(isDiagnosticsExportResult({ path: '/home/alice', status: 'failed' }), false);
    assert.doesNotMatch(JSON.stringify([result, harness.notifications, harness.warnings]), /archive stack|home|alice/u);
    assert.equal(window.closeCount, 0);
  });

  it('returns the exact in-flight promise for the same current Settings window and rejects a different window', async () => {
    const window = new TestSettingsWindow(6);
    const otherWindow = new TestSettingsWindow(7);
    const harness = new DiagnosticsExportHarness();
    const deferredDialog = createDeferred<SaveDialogReturnValue>();
    harness.dialogResults.push(deferredDialog.promise);

    const first = harness.service.export(window as unknown as BrowserWindow);
    const second = harness.service.export(window as unknown as BrowserWindow);

    assert.equal(first, second);
    await assert.rejects(harness.service.export(otherWindow as unknown as BrowserWindow), /already active/u);
    assert.equal(harness.dialogCalls.length, 1);

    deferredDialog.resolve({ canceled: true, filePath: '' });
    assert.deepEqual(await first, { status: 'cancelled' });
  });

  it('rejects a destroyed Settings window before privileged export work', async () => {
    const window = new TestSettingsWindow(14);
    const harness = new DiagnosticsExportHarness();
    window.destroyed = true;

    await assert.rejects(harness.service.export(window as unknown as BrowserWindow), /window is unavailable/u);
    assert.deepEqual(harness.dialogCalls, []);
    assert.deepEqual(harness.archivePaths, []);
    assert.deepEqual(harness.notifications, []);
  });

  it('finishes safely without closing Settings when the parent is destroyed during archive creation', async () => {
    const window = new TestSettingsWindow(8);
    const harness = new DiagnosticsExportHarness();
    const deferredArchive = createDeferred<{ readonly status: 'success' }>();
    harness.dialogResults.push({ canceled: false, filePath: '/synthetic/pending.tar.gz' });
    harness.archiveResults = [deferredArchive.promise];

    const operation = harness.service.export(window as unknown as BrowserWindow);
    await Promise.resolve();
    window.destroyed = true;
    deferredArchive.resolve({ status: 'success' });

    assert.deepEqual(await operation, { status: 'saved' });
    assert.equal(window.closeCount, 0);
  });

  it('preserves a saved result when notification delivery throws', async () => {
    const window = new TestSettingsWindow(10);
    const harness = new DiagnosticsExportHarness();
    harness.throwNotification = true;
    harness.dialogResults.push({ canceled: false, filePath: '/synthetic/saved.tar.gz' });

    assert.deepEqual(await harness.service.export(window as unknown as BrowserWindow), { status: 'saved' });
    assert.equal(window.closeCount, 0);
    assert.deepEqual(harness.warnings, [
      {
        message: 'Diagnostics export notification failed',
        metadata: { status: 'saved' },
      },
    ]);
  });

  it('fails closed for malformed dialog output without exposing raw failures or paths', async () => {
    const window = new TestSettingsWindow(11);
    const harness = new DiagnosticsExportHarness();
    harness.dialogResults.push({ canceled: false, filePath: 'relative-private-secret.tar.gz' });

    const result = await harness.service.export(window as unknown as BrowserWindow);

    assert.deepEqual(result, { status: 'failed' });
    assert.deepEqual(harness.archivePaths, []);
    assert.doesNotMatch(JSON.stringify([result, harness.notifications, harness.warnings]), /relative|private|secret/u);
  });
});
