import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { LinuxDesktopIntegrationController, escapeDesktopExecArg } from '@main/linuxDesktopIntegration';

const LINUX_ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512] as const;

class LinuxDesktopIntegrationHarness {
  public readonly copied: Array<readonly [string, string]> = [];
  public readonly directories: string[] = [];
  public legacyDesktopExists = true;
  public readonly logs: Array<readonly [string, readonly unknown[]]> = [];
  public readonly removed: string[] = [];
  public readonly spawned: Array<{
    readonly args: readonly string[];
    readonly command: string;
  }> = [];
  public readonly written: Array<{
    readonly data: string;
    readonly path: string;
  }> = [];
  public writeFails = false;
  public readonly controller = new LinuxDesktopIntegrationController({
    app: {
      getVersion: () => '1.4.0',
      isPackaged: true,
    },
    environment: {
      APPIMAGE: '/opt/GPT Voice.AppImage',
      XDG_DATA_HOME: '/home/test/.data',
    },
    fileSystem: {
      copyFileSync: (source, destination) => {
        this.copied.push([source, destination]);
      },
      existsSync: (filePath) => this.legacyDesktopExists && filePath.endsWith('gpt-voice.desktop'),
      mkdirSync: (directory) => {
        this.directories.push(directory);
      },
      rmSync: (filePath) => {
        this.removed.push(filePath);
      },
      writeFileSync: (filePath, data) => {
        if (this.writeFails) throw new Error('private path failure');
        this.written.push({ data, path: filePath });
      },
    },
    getAppIconPath: () => '/assets/icon.png',
    getAssetPath: (filename) => `/assets/${filename}`,
    homeDirectory: () => '/home/test',
    logger: {
      debug: (...values: unknown[]) => this.logs.push(['debug', values]),
      info: (...values: unknown[]) => this.logs.push(['info', values]),
      warn: (...values: unknown[]) => this.logs.push(['warn', values]),
    },
    platform: 'linux',
    spawn: (command, args) => {
      this.spawned.push({ args, command });
      return {
        once: () => undefined,
        unref: () => undefined,
      };
    },
  });
}

describe('LinuxDesktopIntegrationController', () => {
  it('creates the canonical AppImage launcher, then migrates and removes only exact owned entries', () => {
    const harness = new LinuxDesktopIntegrationHarness();

    assert.equal(harness.controller.registerAppImage(), true);
    assert.equal(harness.written.length, 1);
    assert.equal(
      harness.written[0]?.path,
      path.join('/home/test/.data', 'applications', 'com.swimmwatch.gptvoice.desktop'),
    );
    assert.match(harness.written[0]?.data ?? '', /Exec="\/opt\/GPT Voice\.AppImage" --no-sandbox %U/u);
    assert.match(harness.written[0]?.data ?? '', /X-AppImage-Version=1\.4\.0/u);
    assert.match(harness.written[0]?.data ?? '', /StartupWMClass=com\.swimmwatch\.gptvoice/u);
    assert.deepEqual(harness.copied, [
      ['/assets/icon.png', path.join('/home/test/.data', 'icons', 'hicolor', '512x512', 'apps', 'gpt-voice.png')],
    ]);

    assert.deepEqual(harness.removed, [path.join('/home/test/.data', 'applications', 'gpt-voice.desktop')]);
    harness.removed.length = 0;

    harness.controller.removeAppImage();
    assert.deepEqual(harness.removed, [
      path.join('/home/test/.data', 'applications', 'com.swimmwatch.gptvoice.desktop'),
      path.join('/home/test/.data', 'applications', 'gpt-voice.desktop'),
      path.join('/home/test/.data', 'icons', 'hicolor', '512x512', 'apps', 'gpt-voice.png'),
    ]);
  });

  it('preserves the legacy launcher if canonical creation fails and logs no path or raw error', () => {
    const harness = new LinuxDesktopIntegrationHarness();
    harness.writeFails = true;

    assert.equal(harness.controller.registerAppImage(), false);
    assert.deepEqual(harness.removed, []);
    assert.deepEqual(harness.logs, [
      [
        'warn',
        [
          'Linux desktop integration',
          {
            action: 'register',
            identity: 'com.swimmwatch.gptvoice',
            platform: 'linux',
            result: 'failed',
          },
        ],
      ],
    ]);
  });

  it('refreshes the icon theme without executing a real process', () => {
    const harness = new LinuxDesktopIntegrationHarness();
    harness.controller.refreshIcons();

    assert.deepEqual(
      harness.directories,
      LINUX_ICON_SIZES.map((size) => path.join('/home/test/.data', 'icons', 'hicolor', `${size}x${size}`, 'apps')),
    );
    assert.deepEqual(
      harness.copied,
      LINUX_ICON_SIZES.map(
        (size) =>
          [
            `/assets/icons/${size}x${size}.png`,
            path.join('/home/test/.data', 'icons', 'hicolor', `${size}x${size}`, 'apps', 'gpt-voice.png'),
          ] as const,
      ),
    );
    assert.deepEqual(harness.spawned, [
      {
        args: ['--force', '--ignore-theme-index', path.join('/home/test/.data', 'icons', 'hicolor')],
        command: 'gtk-update-icon-cache',
      },
    ]);
  });

  it('escapes desktop Exec values deterministically', () => {
    assert.equal(escapeDesktopExecArg('C:\\Apps\\100% "Voice"'), '"C:\\\\Apps\\\\100%% \\"Voice\\""');
  });
});
