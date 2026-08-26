import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, test } from 'node:test';

import { MacOSManagedFilesystemAdapter } from '@main/localWhisper/filesystem/MacOSManagedFilesystemAdapter';
import {
  LOCAL_WHISPER_CANONICAL_APP_ID,
  ManagedArtifactPathResolutionError,
  ManagedArtifactPathResolver,
} from '@main/localWhisper/filesystem/ManagedArtifactPathResolver';
import { ManagedFilesystemAdapterError } from '@main/localWhisper/filesystem/ManagedFilesystemPlatformAdapter';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('ManagedArtifactPathResolver', () => {
  test('resolves the fixed Linux XDG non-roaming root', () => {
    const resolution = new ManagedArtifactPathResolver({
      environment: { XDG_DATA_HOME: '/srv/user-data' },
      homeDirectory: () => '/home/tester',
      platform: 'linux',
    }).resolve();

    assert.deepEqual(resolution, {
      availability: 'available',
      baseDirectory: '/srv/user-data',
      managedRoot: `/srv/user-data/${LOCAL_WHISPER_CANONICAL_APP_ID}/local-whisper`,
      platform: 'linux',
      sanitizedLabel: 'Local Whisper managed storage',
    });
  });

  test('preserves ordinary spaces in an absolute Linux storage base', () => {
    const resolution = new ManagedArtifactPathResolver({
      environment: { XDG_DATA_HOME: '/srv/user data' },
      homeDirectory: () => {
        throw new Error('configured XDG base must not read home');
      },
      platform: 'linux',
    }).resolve();

    assert.equal(resolution.availability, 'available');
    if (resolution.availability !== 'available') return;
    assert.equal(resolution.managedRoot, '/srv/user data/com.swimmwatch.gptvoice/local-whisper');
  });

  test('resolves LOCALAPPDATA with Windows path semantics', () => {
    const resolution = new ManagedArtifactPathResolver({
      environment: { LOCALAPPDATA: String.raw`D:\Users\tester\AppData\Local` },
      homeDirectory: () => String.raw`D:\Users\tester`,
      platform: 'win32',
    }).resolve();

    assert.equal(resolution.availability, 'available');
    if (resolution.availability !== 'available') return;
    assert.equal(
      resolution.managedRoot,
      String.raw`D:\Users\tester\AppData\Local\com.swimmwatch.gptvoice\local-whisper`,
    );
  });

  test('rejects relative and root-level environment bases', () => {
    for (const dataHome of ['relative/data', '/']) {
      assert.throws(
        () =>
          new ManagedArtifactPathResolver({
            environment: { XDG_DATA_HOME: dataHome },
            homeDirectory: () => '/home/tester',
            platform: 'linux',
          }).resolve(),
        (error) => error instanceof ManagedArtifactPathResolutionError && error.code === 'INVALID_STORAGE_BASE',
      );
    }
  });

  test('keeps macOS planned and creates no storage', async () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-macos-'));
    temporaryRoots.push(temporaryRoot);
    const resolution = new ManagedArtifactPathResolver({
      environment: {},
      homeDirectory: () => temporaryRoot,
      platform: 'darwin',
    }).resolve();

    assert.deepEqual(resolution, {
      availability: 'planned',
      code: 'PLANNED_UNAVAILABLE',
      platform: 'darwin',
      sanitizedLabel: 'Local Whisper managed storage',
    });
    await assert.rejects(
      new MacOSManagedFilesystemAdapter().initialize(),
      (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'UNSUPPORTED',
    );
    assert.deepEqual(path.resolve(temporaryRoot), temporaryRoot);
  });
});
