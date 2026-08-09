import assert from 'node:assert/strict';
import type { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { ManagedFilesystemAdapterError } from '@main/localWhisper/filesystem/ManagedFilesystemPlatformAdapter';
import { NativeManagedFilesystemGuardTransport } from '@main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport';

const MAX_GUARD_LINE_BYTES = 256 * 1024;

class FakeGuardChild extends EventEmitter {
  public readonly stdin = new PassThrough();
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public exitCode: number | null = null;
  public killed = false;

  public constructor() {
    super();
    this.stdin.once('finish', () => {
      if (this.exitCode !== null) return;
      this.exitCode = 0;
      this.emit('exit', 0, null);
    });
  }

  public kill(): boolean {
    if (this.killed) return false;
    this.killed = true;
    this.exitCode = 1;
    this.emit('exit', 1, null);
    return true;
  }
}

test('accepts a CRLF-terminated guard response', async () => {
  const child = new FakeGuardChild();
  const transport = new NativeManagedFilesystemGuardTransport({
    executablePath: 'ignored-by-test',
    spawnProcess: (() => child) as unknown as typeof spawn,
  });

  const request = transport.request('RELEASE', ['lease-1']);
  child.stdout.write('1\t1\tOK\tcmVsZWFzZQ\r\n');

  assert.deepEqual(await request, ['release']);
  assert.equal(child.killed, false);
  await transport.dispose();
});

test('rejects an overlong guard response once and starts a fresh guard for the next request', async () => {
  const first = new FakeGuardChild();
  const second = new FakeGuardChild();
  const children = [first, second];
  const transport = new NativeManagedFilesystemGuardTransport({
    executablePath: 'ignored-by-test',
    spawnProcess: (() => {
      const child = children.shift();
      if (!child) throw new Error('Unexpected guard restart');
      return child as unknown as ChildProcessWithoutNullStreams;
    }) as unknown as typeof spawn,
  });

  const firstRequest = transport.request('RELEASE', ['lease-1']);
  first.stdout.write(Buffer.alloc(MAX_GUARD_LINE_BYTES + 1, 0x61));
  await assert.rejects(
    firstRequest,
    (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'IO_FAILED',
  );
  assert.equal(first.killed, true);

  const secondRequest = transport.request('RELEASE', ['lease-2']);
  second.stdout.write('2\t1\tOK\tcmVsZWFzZQ\n');
  assert.deepEqual(await secondRequest, ['release']);
  await transport.dispose();
});
