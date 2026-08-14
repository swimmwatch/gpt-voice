import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  WINDOWS_ASAN_RUNTIME_FILE_NAME,
  WindowsAsanRuntimeSidecar,
} from '@scripts/local-whisper/native-build/WindowsAsanRuntimeSidecar';

test('Windows ASan fixtures receive only the verified named runtime sidecar', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'gpt-voice-windows-asan-sidecar-'));
  try {
    const sourceRoot = resolve(root, 'source');
    const destinationRoot = resolve(root, 'destination');
    mkdirSync(sourceRoot, { mode: 0o700 });
    mkdirSync(destinationRoot, { mode: 0o700 });
    const sourcePath = resolve(sourceRoot, WINDOWS_ASAN_RUNTIME_FILE_NAME);
    writeFileSync(sourcePath, 'bounded-runtime-fixture', { mode: 0o500 });

    const destinationPath = new WindowsAsanRuntimeSidecar(sourcePath, 'win32').copyTo(destinationRoot);
    assert.equal(destinationPath, resolve(destinationRoot, WINDOWS_ASAN_RUNTIME_FILE_NAME));
    assert.equal(readFileSync(destinationPath, 'utf8'), 'bounded-runtime-fixture');
    assert.equal(new WindowsAsanRuntimeSidecar(undefined, 'win32').copyTo(destinationRoot), null);
    assert.throws(
      () => new WindowsAsanRuntimeSidecar(resolve(sourceRoot, 'unapproved.dll'), 'win32').copyTo(destinationRoot),
      /source is invalid/u,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
