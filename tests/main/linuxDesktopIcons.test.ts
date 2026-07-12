import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { LINUX_ICON_SIZES, syncLinuxDesktopIcons } from '@main/linuxDesktopIcons';

describe('syncLinuxDesktopIcons', () => {
  it('updates every standard icon-theme size from the current app assets', () => {
    const tempDirectory = mkdtempSync(path.join(tmpdir(), 'gpt-voice-icons-'));

    try {
      mkdirSync(path.join(tempDirectory, 'source'));
      const sourceAssets = new Map<number, string>();
      for (const size of LINUX_ICON_SIZES) {
        const sourcePath = path.join(tempDirectory, 'source', `${size}x${size}.png`);
        writeFileSync(sourcePath, `icon-${size}`);
        sourceAssets.set(size, sourcePath);
      }

      const dataHome = path.join(tempDirectory, 'data');
      syncLinuxDesktopIcons(dataHome, (filename) => {
        const size = Number.parseInt(path.basename(filename), 10);
        const sourcePath = sourceAssets.get(size);
        assert.ok(sourcePath, `Missing source icon for ${filename}`);
        return sourcePath;
      });

      for (const size of LINUX_ICON_SIZES) {
        const destinationPath = path.join(dataHome, 'icons', 'hicolor', `${size}x${size}`, 'apps', 'gpt-voice.png');
        assert.ok(existsSync(destinationPath));
        assert.equal(readFileSync(destinationPath, 'utf8'), `icon-${size}`);
      }
    } finally {
      rmSync(tempDirectory, { force: true, recursive: true });
    }
  });
});
