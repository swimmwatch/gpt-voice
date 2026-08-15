import assert from 'node:assert/strict';
import type { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { ManagedFilesystemAdapterError } from '@main/localWhisper/filesystem/ManagedFilesystemPlatformAdapter';
import {
  GUARD_PROTOCOL_FUTURE_HEADROOM_BYTES,
  GUARD_PROTOCOL_VERSION,
  MAX_GUARD_REQUEST_PAYLOAD_BYTES,
  MAX_GUARD_WRITE_FILE_CHUNK_BYTES,
  NativeManagedFilesystemGuardTransport,
} from '@main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport';
import {
  NativeRuntimeLogForwarder,
  NativeRuntimeLogRelay,
} from '@main/localWhisper/supervisor/NativeRuntimeLogStreamDecoder';
import { serializeCanonicalNativeRuntimeLogRecord } from '@shared/localWhisper';

const PROCESS_INSTANCE_ID = '11111111-1111-1111-8111-111111111111';

class FakeGuardChild extends EventEmitter {
  public readonly stdin = new PassThrough();
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public exitCode: number | null = null;
  public killed = false;
  private readonly inputChunks: Buffer[] = [];

  public constructor() {
    super();
    this.stdin.on('data', (chunk: Buffer) => this.inputChunks.push(Buffer.from(chunk)));
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

  public takeInput(): Buffer {
    const input = Buffer.concat(this.inputChunks);
    this.inputChunks.length = 0;
    return input;
  }
}

test('pins the TypeScript mirrors to the canonical native protocol-v2 constants', () => {
  const header = readFileSync(
    resolve('runtime', 'local-whisper', 'fs-guard', 'include', 'local_whisper', 'fs_guard', 'protocol.hpp'),
    'utf8',
  );

  assert.equal(GUARD_PROTOCOL_VERSION, '2');
  assert.equal(MAX_GUARD_REQUEST_PAYLOAD_BYTES, 262_144);
  assert.equal(GUARD_PROTOCOL_FUTURE_HEADROOM_BYTES, 4_096);
  assert.equal(MAX_GUARD_WRITE_FILE_CHUNK_BYTES, 193_483);
  assert.match(header, /kProtocolVersion = "2"/u);
  assert.match(header, /kMaxRequestPayloadBytes = 256U \* 1024U/u);
  assert.match(header, /kProtocolFutureHeadroomBytes = 4U \* 1024U/u);
  assert.match(header, /kMaxWriteFileChunkBytes = kMaxEncodedWriteFileChunkBytes \* 3U \/ 4U/u);
});

test('accepts a CRLF-terminated guard response', async () => {
  const child = new FakeGuardChild();
  const transport = new NativeManagedFilesystemGuardTransport({
    environment: {},
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    platform: 'linux',
    spawnProcess: (() => child) as unknown as typeof spawn,
  });

  const request = transport.request('RELEASE', ['lease-1']);
  child.stdout.write('1\t2\tOK\tcmVsZWFzZQ\r\n');

  assert.deepEqual(await request, ['release']);
  assert.equal(child.killed, false);
  await transport.dispose();
});

test('rejects every pending request on an overlong response and starts a fresh guard', async () => {
  const first = new FakeGuardChild();
  const second = new FakeGuardChild();
  const children = [first, second];
  const transport = new NativeManagedFilesystemGuardTransport({
    environment: {},
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    platform: 'linux',
    spawnProcess: (() => {
      const child = children.shift();
      if (!child) throw new Error('Unexpected guard restart');
      return child as unknown as ChildProcessWithoutNullStreams;
    }) as unknown as typeof spawn,
  });

  const firstRequest = transport.request('RELEASE', ['lease-1']);
  const secondPendingRequest = transport.request('RELEASE', ['lease-2']);
  first.stdout.write(Buffer.alloc(MAX_GUARD_REQUEST_PAYLOAD_BYTES + 1, 0x61));
  const rejected = await Promise.allSettled([firstRequest, secondPendingRequest]);
  assert.ok(
    rejected.every(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof ManagedFilesystemAdapterError &&
        result.reason.code === 'IO_FAILED',
    ),
  );
  assert.equal(first.killed, true);

  const nextRequest = transport.request('RELEASE', ['lease-3']);
  second.stdout.write('3\t2\tOK\tcmVsZWFzZQ\n');
  assert.deepEqual(await nextRequest, ['release']);
  await transport.dispose();
});

test('encodes raw WRITE_FILE bytes exactly once with shared canonical vectors', async () => {
  const child = new FakeGuardChild();
  const transport = new NativeManagedFilesystemGuardTransport({
    environment: {},
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    platform: 'linux',
    spawnProcess: (() => child) as unknown as typeof spawn,
  });
  const vectors = [
    { bytes: Uint8Array.of(0x66), encoded: 'Zg' },
    { bytes: Uint8Array.of(0x66, 0x6f), encoded: 'Zm8' },
    { bytes: Uint8Array.of(0x66, 0x6f, 0x6f), encoded: 'Zm9v' },
    { bytes: Uint8Array.of(0x00, 0x80, 0xff), encoded: 'AID_' },
  ] as const;

  for (const [index, vector] of vectors.entries()) {
    const requestId = index + 1;
    const request = transport.request('WRITE_FILE', ['lease-1', vector.bytes]);
    assert.equal(child.takeInput().toString('utf8'), `${requestId}\t2\tWRITE_FILE\tbGVhc2UtMQ\t${vector.encoded}\n`);
    child.stdout.write(`${requestId}\t2\tOK\n`);
    assert.deepEqual(await request, []);
  }
  await transport.dispose();
});

test('accepts the derived maximum raw chunk and rejects one byte over before writing', async () => {
  const child = new FakeGuardChild();
  let spawnCount = 0;
  const transport = new NativeManagedFilesystemGuardTransport({
    environment: {},
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    platform: 'linux',
    spawnProcess: (() => {
      spawnCount += 1;
      return child;
    }) as unknown as typeof spawn,
  });
  const maximum = Buffer.alloc(MAX_GUARD_WRITE_FILE_CHUNK_BYTES, 0xa5);
  const accepted = transport.request('WRITE_FILE', ['lease-18446744073709551615', maximum]);
  const line = child.takeInput();
  assert.ok(line.byteLength - 1 <= MAX_GUARD_REQUEST_PAYLOAD_BYTES - GUARD_PROTOCOL_FUTURE_HEADROOM_BYTES);
  child.stdout.write('1\t2\tOK\n');
  await accepted;

  await assert.rejects(
    transport.request('WRITE_FILE', ['lease-1', Buffer.alloc(MAX_GUARD_WRITE_FILE_CHUNK_BYTES + 1)]),
    (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'INVALID_INPUT',
  );
  assert.equal(child.takeInput().byteLength, 0);
  assert.equal(spawnCount, 1);
  await transport.dispose();
});

test('fail-stops when a protocol-v1 peer responds to a protocol-v2 request', async () => {
  const child = new FakeGuardChild();
  const transport = new NativeManagedFilesystemGuardTransport({
    environment: {},
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    platform: 'linux',
    spawnProcess: (() => child) as unknown as typeof spawn,
  });

  const request = transport.request('RELEASE', ['lease-1']);
  child.stdout.write('1\t1\tOK\n');

  await assert.rejects(
    request,
    (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'IO_FAILED',
  );
  assert.equal(child.killed, true);
  await transport.dispose();
});

test('propagates one private process identity and forwards only matching canonical guard diagnostics', async () => {
  const child = new FakeGuardChild();
  let environment: NodeJS.ProcessEnv | undefined;
  const messages: string[] = [];
  const relay = new NativeRuntimeLogRelay();
  relay.attach(
    new NativeRuntimeLogForwarder({
      logger: {
        debug: () => undefined,
        error: () => undefined,
        info: (message: unknown) => messages.push(String(message)),
        warn: () => undefined,
      },
      now: () => new Date('2026-08-12T00:00:00.000Z'),
    }),
  );
  const transport = new NativeManagedFilesystemGuardTransport({
    environment: { NODE_ENV: 'production', PRIVATE_CANARY: 'must-not-propagate' },
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    nativeRuntimeLogRelay: relay,
    platform: 'linux',
    spawnProcess: ((
      _executable: string,
      _arguments: readonly string[],
      options: { readonly env?: NodeJS.ProcessEnv },
    ) => {
      environment = options.env;
      return child;
    }) as unknown as typeof spawn,
  });
  const request = transport.request('RELEASE', ['lease-1']);
  const valid = serializeCanonicalNativeRuntimeLogRecord({
    component: 'filesystemGuard',
    event: 'processStarted',
    level: 'info',
    processInstanceId: PROCESS_INSTANCE_ID,
    schemaVersion: 1,
    sequence: 1,
  });
  const mismatched = serializeCanonicalNativeRuntimeLogRecord({
    component: 'filesystemGuard',
    event: 'processStarted',
    level: 'info',
    processInstanceId: '22222222-2222-2222-8222-222222222222',
    schemaVersion: 1,
    sequence: 2,
  });
  assert.ok(valid);
  assert.ok(mismatched);
  child.stderr.write(`${valid}\n${mismatched}\n`);
  child.stdout.write('1\t2\tOK\tcmVsZWFzZQ\n');

  assert.deepEqual(await request, ['release']);
  assert.deepEqual(environment, {
    LANG: 'C',
    LC_ALL: 'C',
    LOCAL_WHISPER_NATIVE_LOG_LEVEL: 'info',
    LOCAL_WHISPER_NATIVE_PROCESS_INSTANCE_ID: PROCESS_INSTANCE_ID,
  });
  assert.equal(messages.length, 1);
  assert.match(messages[0] ?? '', /\[native-runtime\]/u);
  assert.doesNotMatch(messages[0] ?? '', /PRIVATE_CANARY|must-not-propagate/u);
  await transport.dispose();
});
