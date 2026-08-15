import assert from 'node:assert/strict';
import type { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { ManagedFilesystemAdapterError } from '@main/localWhisper/filesystem/ManagedFilesystemPlatformAdapter';
import { NativeManagedFilesystemGuardTransport } from '@main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport';
import {
  NativeRuntimeLogForwarder,
  NativeRuntimeLogRelay,
} from '@main/localWhisper/supervisor/NativeRuntimeLogStreamDecoder';
import { serializeCanonicalNativeRuntimeLogRecord } from '@shared/localWhisper';

const MAX_GUARD_LINE_BYTES = 256 * 1024;
const PROCESS_INSTANCE_ID = '11111111-1111-1111-8111-111111111111';

class FakeGuardChild extends EventEmitter {
  public readonly stdin = new PassThrough();
  public readonly stdout = new PassThrough();
  public readonly stderr = new PassThrough();
  public exitCode: number | null = null;
  public killed = false;
  public readonly killSignals: NodeJS.Signals[] = [];
  public readonly pid = 42;
  public signalCode: NodeJS.Signals | null = null;

  public constructor(
    exitOnInputEnd = true,
    private readonly exitOnSignal: 'always' | 'never' | 'sigkill' = 'always',
  ) {
    super();
    this.stdin.once('finish', () => {
      if (!exitOnInputEnd || this.exitCode !== null) return;
      this.exitCode = 0;
      this.emit('exit', 0, null);
    });
  }

  public kill(signal: NodeJS.Signals | number = 'SIGTERM'): boolean {
    const normalizedSignal = typeof signal === 'number' ? 'SIGTERM' : signal;
    this.killSignals.push(normalizedSignal);
    this.killed = true;
    if (this.exitOnSignal === 'never' || (this.exitOnSignal === 'sigkill' && normalizedSignal !== 'SIGKILL')) {
      return true;
    }
    this.exitCode = 1;
    this.signalCode = normalizedSignal;
    this.emit('exit', null, normalizedSignal);
    return true;
  }
}

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
  child.stdout.write('1\t1\tOK\tcmVsZWFzZQ\n');

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

test('bounds graceful guard disposal and terminates only its exact unresponsive child', async () => {
  const child = new FakeGuardChild(false);
  const transport = new NativeManagedFilesystemGuardTransport({
    disposeTimeoutMs: 0,
    environment: {},
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    platform: 'win32',
    spawnProcess: (() => child) as unknown as typeof spawn,
  });
  const request = transport.request('RELEASE', ['lease-1']);
  child.stdout.write('1\t1\tOK\tcmVsZWFzZQ\n');
  await request;

  await transport.dispose();

  assert.equal(child.killed, true);
  assert.equal(child.exitCode, 1);
});

test('does not replace a failed guard until its exact process has confirmed exit', async () => {
  const child = new FakeGuardChild(false, 'sigkill');
  let spawns = 0;
  const transport = new NativeManagedFilesystemGuardTransport({
    disposeTimeoutMs: 0,
    environment: {},
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    platform: 'linux',
    spawnProcess: (() => {
      spawns += 1;
      return child;
    }) as unknown as typeof spawn,
  });
  const firstRequest = transport.request('RELEASE', ['lease-1']);
  child.stdout.write(Buffer.alloc(MAX_GUARD_LINE_BYTES + 1, 0x61));
  await assert.rejects(
    firstRequest,
    (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'IO_FAILED',
  );

  await assert.rejects(
    () => transport.request('RELEASE', ['lease-2']),
    (error) => error instanceof ManagedFilesystemAdapterError && error.code === 'IO_FAILED',
  );
  assert.equal(spawns, 1);
  assert.equal(child.exitCode, null);

  await transport.dispose();
  assert.deepEqual(child.killSignals, ['SIGTERM', 'SIGKILL']);
  assert.equal(child.signalCode, 'SIGKILL');
});

test('retains unconfirmed guard ownership so failed disposal can be retried deterministically', async () => {
  const child = new FakeGuardChild(false, 'never');
  const transport = new NativeManagedFilesystemGuardTransport({
    disposeTimeoutMs: 0,
    environment: {},
    executablePath: 'ignored-by-test',
    generateProcessInstanceId: () => PROCESS_INSTANCE_ID,
    platform: 'linux',
    spawnProcess: (() => child) as unknown as typeof spawn,
  });
  const request = transport.request('RELEASE', ['lease-1']);
  child.stdout.write('1\t1\tOK\tcmVsZWFzZQ\n');
  await request;

  await assert.rejects(() => transport.dispose(), /cleanup failed/u);
  await assert.rejects(() => transport.dispose(), /cleanup failed/u);
  assert.deepEqual(child.killSignals, ['SIGKILL', 'SIGKILL']);
});
