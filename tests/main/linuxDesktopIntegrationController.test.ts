import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LinuxDesktopIntegrationController, escapeDesktopExecArg } from '@main/linuxDesktopIntegration';

const LINUX_ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512] as const;

class LinuxDesktopIntegrationHarness {
  public readonly copied: Array<readonly [string, string]> = [];
  public readonly directories: string[] = [];
  public readonly removed: string[] = [];
  public readonly spawned: Array<{
    readonly args: readonly string[];
    readonly command: string;
  }> = [];
  public readonly written: Array<{
    readonly data: string;
    readonly path: string;
  }> = [];
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
      mkdirSync: (directory) => {
        this.directories.push(directory);
      },
      rmSync: (filePath) => {
        this.removed.push(filePath);
      },
      writeFileSync: (filePath, data) => {
        this.written.push({ data, path: filePath });
      },
    },
    getAppIconPath: () => '/assets/icon.png',
    getAssetPath: (filename) => `/assets/${filename}`,
    homeDirectory: () => '/home/test',
    logger: { debug: () => undefined, info: () => undefined, warn: () => undefined },
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
  it('registers and removes the AppImage launcher through injected adapters', () => {
    const harness = new LinuxDesktopIntegrationHarness();

    harness.controller.registerAppImage();
    assert.equal(harness.written.length, 1);
    assert.match(harness.written[0]?.data ?? '', /Exec="\/opt\/GPT Voice\.AppImage" --no-sandbox %U/u);
    assert.match(harness.written[0]?.data ?? '', /X-AppImage-Version=1\.4\.0/u);
    assert.deepEqual(harness.copied, [
      ['/assets/icon.png', '/home/test/.data/icons/hicolor/512x512/apps/gpt-voice.png'],
    ]);

    harness.controller.removeAppImage();
    assert.deepEqual(harness.removed, [
      '/home/test/.data/applications/gpt-voice.desktop',
      '/home/test/.data/icons/hicolor/512x512/apps/gpt-voice.png',
    ]);
  });

  it('refreshes the icon theme without executing a real process', () => {
    const harness = new LinuxDesktopIntegrationHarness();
    harness.controller.refreshIcons();

    assert.deepEqual(
      harness.directories,
      LINUX_ICON_SIZES.map((size) => `/home/test/.data/icons/hicolor/${size}x${size}/apps`),
    );
    assert.deepEqual(
      harness.copied,
      LINUX_ICON_SIZES.map(
        (size) =>
          [
            `/assets/icons/${size}x${size}.png`,
            `/home/test/.data/icons/hicolor/${size}x${size}/apps/gpt-voice.png`,
          ] as const,
      ),
    );
    assert.deepEqual(harness.spawned, [
      {
        args: ['--force', '--ignore-theme-index', '/home/test/.data/icons/hicolor'],
        command: 'gtk-update-icon-cache',
      },
    ]);
  });

  it('escapes desktop Exec values deterministically', () => {
    assert.equal(escapeDesktopExecArg('C:\\Apps\\100% "Voice"'), '"C:\\\\Apps\\\\100%% \\"Voice\\""');
  });
});
