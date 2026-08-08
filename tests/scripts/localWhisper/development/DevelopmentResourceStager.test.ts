import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LocalWhisperPackagedResourceResolver } from '@main/localWhisper/packaging/LocalWhisperPackagedResourceResolver';
import { DevelopmentResourceStager } from '@scripts/local-whisper/development/DevelopmentResourceStager';

describe('DevelopmentResourceStager', () => {
  it('stages exact helper bytes in the packaged-resource layout', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-resources-'));
    try {
      const guardPath = path.join(root, '.cache', 'local-whisper', 'fs-guard', 'fs-guard');
      const launcherPath = path.join(root, '.cache', 'local-whisper', 'launcher', 'local-whisper-launcher');
      await Promise.all([
        mkdir(path.dirname(guardPath), { recursive: true }),
        mkdir(path.dirname(launcherPath), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(guardPath, 'guard', { encoding: 'utf8', mode: 0o700 }),
        writeFile(launcherPath, 'launcher', { encoding: 'utf8', mode: 0o700 }),
      ]);
      const resourcesPath = path.join(root, 'resources');
      await new DevelopmentResourceStager().stage(root, resourcesPath, 'linux');
      const resolved = await new LocalWhisperPackagedResourceResolver({
        platform: 'linux',
        resourcesPath,
        readFile,
      }).resolve();
      assert.equal(resolved.availability, 'available');
      if (resolved.availability !== 'available') return;
      assert.equal(path.basename(resolved.filesystemGuardExecutable), 'fs-guard');
      assert.equal(path.basename(resolved.launcherExecutable), 'local-whisper-launcher');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('stages Windows helper names and zero manifest modes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-resources-'));
    try {
      const guardPath = path.join(root, '.cache', 'local-whisper', 'fs-guard', 'fs-guard.exe');
      const launcherPath = path.join(root, '.cache', 'local-whisper', 'launcher', 'local-whisper-launcher.exe');
      await Promise.all([
        mkdir(path.dirname(guardPath), { recursive: true }),
        mkdir(path.dirname(launcherPath), { recursive: true }),
      ]);
      await Promise.all([writeFile(guardPath, 'guard'), writeFile(launcherPath, 'launcher')]);
      const resourcesPath = path.join(root, 'resources');
      await new DevelopmentResourceStager().stage(root, resourcesPath, 'win32');
      const resolved = await new LocalWhisperPackagedResourceResolver({
        platform: 'win32',
        resourcesPath,
        readFile,
      }).resolve();
      assert.equal(resolved.availability, 'available');
      if (resolved.availability !== 'available') return;
      assert.equal(path.basename(resolved.filesystemGuardExecutable), 'fs-guard.exe');
      assert.equal(path.basename(resolved.launcherExecutable), 'local-whisper-launcher.exe');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
