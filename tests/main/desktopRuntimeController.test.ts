/* eslint-disable max-classes-per-file -- Application and session fakes own distinct native resource state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserWindow, Menu, MenuItemConstructorOptions, Session, WebContents } from 'electron';
import { DesktopRuntimeController, type DesktopRuntimeApplication } from '@main/desktopRuntimeController';
import { I18nService } from '@main/i18n';

type PermissionCheckHandler = NonNullable<Parameters<Session['setPermissionCheckHandler']>[0]>;
type PermissionRequestHandler = NonNullable<Parameters<Session['setPermissionRequestHandler']>[0]>;

class RecordingDesktopApplication implements DesktopRuntimeApplication {
  public aboutOptions: unknown = null;
  public readonly commandLineSwitches: Array<readonly [string, string | undefined]> = [];
  public disableHardwareCount = 0;
  public dockIcon = '';
  public modelId = '';
  public name = '';
  public quitCount = 0;
  public singleInstanceLock = true;
  public showAboutCount = 0;
  public readonly isPackaged = true;
  public readonly commandLine = {
    appendSwitch: (name: string, value?: string) => {
      this.commandLineSwitches.push([name, value]);
    },
  };
  public readonly dock = {
    setIcon: (image: string) => {
      this.dockIcon = image;
    },
  };

  public disableHardwareAcceleration(): void {
    this.disableHardwareCount += 1;
  }

  public getVersion(): string {
    return '1.4.0';
  }

  public quit(): void {
    this.quitCount += 1;
  }

  public requestSingleInstanceLock(): boolean {
    return this.singleInstanceLock;
  }

  public setAboutPanelOptions(options: unknown): void {
    this.aboutOptions = options;
  }

  public setAppUserModelId(id: string): void {
    this.modelId = id;
  }

  public setName(name: string): void {
    this.name = name;
  }

  public showAboutPanel(): void {
    this.showAboutCount += 1;
  }
}

class DesktopRuntimeHarness {
  public readonly app = new RecordingDesktopApplication();
  public exitCode: number | null = null;
  public readonly environment: NodeJS.ProcessEnv = { APPIMAGE: '/app/GPT.AppImage' };
  public menuTemplate: MenuItemConstructorOptions[] = [];
  public permissionCheck: PermissionCheckHandler | null = null;
  public permissionRequest: PermissionRequestHandler | null = null;
  public output = '';
  public rendererReady = true;
  public readonly rendererScripts: string[] = [];

  public createController(
    options: {
      readonly arguments?: readonly string[];
      readonly locale?: 'en' | 'ru';
      readonly platform?: NodeJS.Platform;
    } = {},
  ): DesktopRuntimeController {
    return new DesktopRuntimeController({
      app: this.app,
      arguments: options.arguments ?? [],
      buildMenu: (template) => {
        this.menuTemplate = template;
        return { template } as unknown as Menu;
      },
      electronVersion: '40.0.0',
      environment: this.environment,
      exit: (code) => {
        this.exitCode = code;
      },
      getAppIconPath: () => '/assets/icon.png',
      localization: new I18nService(options.locale),
      openExternal: async () => undefined,
      platform: options.platform ?? 'linux',
      schedule: (callback) => {
        callback();
      },
      session: {
        defaultSession: {
          setPermissionCheckHandler: (handler) => {
            this.permissionCheck = handler;
          },
          setPermissionRequestHandler: (handler) => {
            this.permissionRequest = handler;
          },
        },
      },
      setApplicationMenu: () => undefined,
      windowManager: {
        getMainWindow: () =>
          ({
            isDestroyed: () => false,
            webContents: {
              executeJavaScript: async (script: string) => {
                this.rendererScripts.push(script);
                return this.rendererReady;
              },
            },
          }) as unknown as BrowserWindow,
      },
      writeStandardOutput: (value) => {
        this.output += value;
      },
    });
  }
}

describe('DesktopRuntimeController', () => {
  it('owns pre-ready identity, single-instance, Linux switches, and sandbox state', () => {
    const harness = new DesktopRuntimeHarness();
    const controller = harness.createController();

    controller.configureBeforeReady();
    assert.equal(controller.acquireSingleInstanceLock(), true);
    controller.configureBeforeReady();
    assert.equal(controller.acquireSingleInstanceLock(), true);

    assert.equal(harness.app.name, 'GPT-Voice');
    assert.equal(harness.app.modelId, 'com.swimmwatch.gptvoice');
    assert.equal(harness.app.disableHardwareCount, 1);
    assert.deepEqual(harness.app.commandLineSwitches, [
      ['class', 'gpt-voice'],
      ['disable-gpu', undefined],
      ['disable-dev-shm-usage', undefined],
      ['log-level', '3'],
      ['no-sandbox', undefined],
    ]);
    assert.equal(harness.environment.ELECTRON_DISABLE_SANDBOX, '1');
  });

  it('rejects a second instance without configuring later Linux switches', () => {
    const harness = new DesktopRuntimeHarness();
    harness.app.singleInstanceLock = false;
    const controller = harness.createController();

    controller.configureBeforeReady();
    assert.equal(controller.acquireSingleInstanceLock(), false);

    assert.equal(harness.app.quitCount, 1);
    assert.equal(harness.exitCode, 0);
    assert.deepEqual(harness.app.commandLineSwitches, []);
  });

  it('owns startup flags, native metadata, permissions, and safe app info', () => {
    const harness = new DesktopRuntimeHarness();
    const controller = harness.createController({
      arguments: ['--startup-benchmark'],
      platform: 'darwin',
    });

    controller.configureNativeMetadata();
    controller.configureApplicationReady();

    assert.equal(controller.isStartupBenchmark, true);
    assert.equal(controller.isRemovingLinuxDesktopIntegration, false);
    assert.equal(harness.menuTemplate[harness.menuTemplate.length - 1]?.label, 'Help');
    assert.equal((harness.app.aboutOptions as { applicationVersion?: string }).applicationVersion, '1.4.0');
    assert.equal(harness.app.dockIcon, '/assets/icon.png');
    assert.equal(
      harness.permissionCheck?.(null, 'media', 'app://gpt-voice', {} as Parameters<PermissionCheckHandler>[3]),
      true,
    );
    assert.equal(
      harness.permissionCheck?.(null, 'notifications', 'app://gpt-voice', {} as Parameters<PermissionCheckHandler>[3]),
      false,
    );
    let microphoneGranted = false;
    harness.permissionRequest?.(
      {} as WebContents,
      'media',
      (granted) => {
        microphoneGranted = granted;
      },
      {} as Parameters<PermissionRequestHandler>[3],
    );
    assert.equal(microphoneGranted, true);
    assert.equal(controller.getAppInfo().version, '1.4.0');
  });

  it('uses the selected locale for native menu and About-panel text', () => {
    const harness = new DesktopRuntimeHarness();
    const controller = harness.createController({ locale: 'ru' });

    controller.configureNativeMetadata();

    assert.equal(harness.menuTemplate[0]?.label, 'Файл');
    assert.equal(harness.menuTemplate[harness.menuTemplate.length - 1]?.label, 'Справка');
    assert.equal(
      (harness.app.aboutOptions as { credits?: string }).credits,
      'Независимое настольное приложение для голосовой транскрибации через веб-сессии GPT.',
    );
  });

  it('reports the startup benchmark marker after the renderer shell mounts', async () => {
    const harness = new DesktopRuntimeHarness();
    const controller = harness.createController({
      arguments: ['--startup-benchmark'],
    });

    controller.waitForStartupBenchmarkReady();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(harness.output, 'GPT_VOICE_STARTUP_READY\n');
    assert.equal(harness.app.quitCount, 1);
    assert.deepEqual(harness.rendererScripts, ["document.getElementById('window-startup-content') !== null"]);
  });
});
