import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  listNativeSourceFiles,
  listPlatformNativeImplementationFiles,
} from '../../../scripts/local-whisper/native-quality-tools.mjs';

describe('native quality source discovery', () => {
  let root;

  before(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-native-quality-'));
    await Promise.all([
      mkdir(path.join(root, 'include'), { recursive: true }),
      mkdir(path.join(root, 'platform', 'linux'), { recursive: true }),
      mkdir(path.join(root, 'platform', 'windows'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(root, 'include', 'shared.hpp'), ''),
      writeFile(path.join(root, 'platform', 'linux', 'backend.cpp'), ''),
      writeFile(path.join(root, 'platform', 'windows', 'backend.cpp'), ''),
      writeFile(path.join(root, 'shared.cpp'), ''),
      writeFile(path.join(root, 'ignored.txt'), ''),
    ]);
  });

  after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it('recursively lists only C++ implementations and headers', () => {
    const relativeFiles = listNativeSourceFiles(root).map((filePath) => path.relative(root, filePath)).sort();

    assert.deepEqual(relativeFiles, [
      path.join('include', 'shared.hpp'),
      path.join('platform', 'linux', 'backend.cpp'),
      path.join('platform', 'windows', 'backend.cpp'),
      'shared.cpp',
    ]);
  });

  it('selects implementations for the requested platform', () => {
    const sourceFiles = listNativeSourceFiles(root);
    const linuxFiles = listPlatformNativeImplementationFiles(root, 'linux');
    const windowsFiles = listPlatformNativeImplementationFiles(root, 'win32');

    assert.deepEqual(
      linuxFiles,
      sourceFiles.filter((filePath) => filePath.endsWith('.cpp') && !filePath.includes('/platform/windows/')),
    );
    assert.deepEqual(
      windowsFiles,
      sourceFiles.filter((filePath) => filePath.endsWith('.cpp') && !filePath.includes('/platform/linux/')),
    );
  });
});
