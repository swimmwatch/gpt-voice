import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, test } from 'node:test';

import { WindowsManagedFilesystemAdapter } from '@main/localWhisper/filesystem/WindowsManagedFilesystemAdapter';
import type {
  ManagedFilesystemGuardRequestField,
  ManagedFilesystemGuardTransport,
} from '@main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport';

const IDENTITY = '1|2|1|448|3|0|directory';

class RecordingTransport implements ManagedFilesystemGuardTransport {
  public readonly calls: {
    readonly arguments_: readonly ManagedFilesystemGuardRequestField[];
    readonly command: string;
  }[] = [];

  public async request(
    command: string,
    arguments_: readonly ManagedFilesystemGuardRequestField[],
  ): Promise<readonly string[]> {
    this.calls.push({ arguments_, command });
    return ['lease-1', IDENTITY];
  }

  public async dispose(): Promise<void> {}
}

describe('platform adapter contract', () => {
  test('pins Windows initialization to the win32 native protocol', async () => {
    const transport = new RecordingTransport();
    const adapter = new WindowsManagedFilesystemAdapter(transport);

    const root = await adapter.initialize(String.raw`C:\Users\tester\AppData\Local\app\local-whisper`);

    assert.equal(root.token, 'lease-1');
    assert.deepEqual(transport.calls, [
      {
        arguments_: ['win32', String.raw`C:\Users\tester\AppData\Local\app\local-whisper`],
        command: 'INIT',
      },
    ]);
  });

  test('passes staged-file bytes to the transport without pre-encoding them', async () => {
    const transport = new RecordingTransport();
    const adapter = new WindowsManagedFilesystemAdapter(transport);
    const chunk = Uint8Array.of(0x00, 0x80, 0xff);

    await adapter.appendStagedFile('lease-1', chunk);

    assert.equal(transport.calls.length, 1);
    assert.equal(transport.calls[0]?.command, 'WRITE_FILE');
    assert.equal(transport.calls[0]?.arguments_[0], 'lease-1');
    assert.equal(transport.calls[0]?.arguments_[1], chunk);
  });

  test('keeps the Windows guard on handle-relative and identity-aware primitives', () => {
    const source = readFileSync(
      path.resolve('runtime', 'local-whisper', 'fs-guard', 'src', 'platform', 'windows', 'windows_backend.cpp'),
      'utf8',
    );

    for (const primitive of [
      'NtCreateFile',
      'FILE_OPEN_REPARSE_POINT',
      'FileIdInfo',
      'SetFileInformationByHandle',
      'FileStreamInfo',
      'GetProcessTimes',
      'PROTECTED_DACL_SECURITY_INFORMATION',
      'delete_staging_file',
      'remove_staging',
    ]) {
      assert.ok(source.includes(primitive), `missing Windows guard primitive: ${primitive}`);
    }
    assert.doesNotMatch(source, /system\s*\(|ShellExecute|cmd\.exe|RemoveDirectoryW\s*\(/);
  });

  test('keeps the Linux guard on openat2 and descriptor-relative mutation primitives', () => {
    const source = readFileSync(
      path.resolve('runtime', 'local-whisper', 'fs-guard', 'src', 'platform', 'linux', 'linux_backend.cpp'),
      'utf8',
    );

    for (const primitive of [
      'SYS_openat2',
      'RESOLVE_BENEATH',
      'RESOLVE_NO_SYMLINKS',
      'RESOLVE_NO_MAGICLINKS',
      'RESOLVE_NO_XDEV',
      'SYS_renameat2',
      'RENAME_NOREPLACE',
      'unlinkat',
      'AT_SYMLINK_NOFOLLOW',
    ]) {
      assert.ok(source.includes(primitive), `missing Linux guard primitive: ${primitive}`);
    }
    assert.doesNotMatch(source, /realpath\s*\(|system\s*\(|\/bin\/rm|rm -rf/);
  });
});
