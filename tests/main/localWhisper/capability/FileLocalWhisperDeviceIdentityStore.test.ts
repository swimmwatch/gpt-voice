import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  FileLocalWhisperDeviceIdentityStore,
  LOCAL_WHISPER_DEVICE_IDENTITY_DIRECTORY_MODE,
  LOCAL_WHISPER_DEVICE_IDENTITY_FILE_MODE,
} from '@main/localWhisper/deviceIdentity/FileLocalWhisperDeviceIdentityStore';
import { LocalWhisperDeviceIdentityRepository } from '@main/localWhisper/deviceIdentity/LocalWhisperDeviceIdentityRepository';

function withTemporaryRoot(run: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'gpt-voice-local-whisper-identity-'));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

describe('FileLocalWhisperDeviceIdentityStore', () => {
  it('persists only an owner-private salt and keeps opaque IDs stable across repository instances', () => {
    withTemporaryRoot((root) => {
      const filePath = path.join(root, 'private', 'device-identity.json');
      const store = new FileLocalWhisperDeviceIdentityStore({
        filePath,
        platform: process.platform,
        createTemporaryPath: (target) => `${target}.exclusive.tmp`,
        fileSystem: fs,
      });
      const first = new LocalWhisperDeviceIdentityRepository(store, () => Uint8Array.from({ length: 32 }, () => 9));
      const opaqueId = first.getOpaqueId('pci:0000:01:00.0|uuid:private-fixture');
      const persisted = fs.readFileSync(filePath, 'utf8');
      assert.doesNotMatch(persisted, /pci|uuid|private-fixture|0000:/u);
      assert.equal(
        new LocalWhisperDeviceIdentityRepository(store, () => Uint8Array.from({ length: 32 }, () => 10)).getOpaqueId(
          'pci:0000:01:00.0|uuid:private-fixture',
        ),
        opaqueId,
      );
      if (process.platform !== 'win32') {
        assert.equal(fs.statSync(path.dirname(filePath)).mode & 0o777, LOCAL_WHISPER_DEVICE_IDENTITY_DIRECTORY_MODE);
        assert.equal(fs.statSync(filePath).mode & 0o777, LOCAL_WHISPER_DEVICE_IDENTITY_FILE_MODE);
      }
    });
  });

  it('rejects a temporary path outside the exact owner directory without leaving a file', () => {
    withTemporaryRoot((root) => {
      const filePath = path.join(root, 'private', 'device-identity.json');
      const store = new FileLocalWhisperDeviceIdentityStore({
        filePath,
        platform: process.platform,
        createTemporaryPath: () => path.join(root, 'outside.tmp'),
        fileSystem: fs,
      });
      assert.throws(() => store.write({ private: true }), /persistence failed/u);
      assert.equal(fs.existsSync(filePath), false);
    });
  });
});
