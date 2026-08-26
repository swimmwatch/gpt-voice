import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import {
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  encodeLocalWhisperAudioFrame,
  encodeLocalWhisperControlFrame,
  toLocalWhisperRevisionId,
  type LocalWhisperWorkerServerMessage,
} from '@shared/localWhisper';
import {
  LocalWhisperWorkerTransport,
  type LocalWhisperTransportTerminalCause,
} from '@main/localWhisper/supervisor/LocalWhisperWorkerTransport';

function helloAck(): LocalWhisperWorkerServerMessage {
  const runtimeRevision = toLocalWhisperRevisionId('runtime-v1');
  if (!runtimeRevision) throw new Error('Invalid fixture revision');
  return {
    type: 'helloAck',
    protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
    engine: 'whisperCpp',
    runtimeRevision,
    runtimeBuildDigest: 'a'.repeat(64),
    backend: 'cuda',
    capabilities: ['cuda-sm-86'],
    maxControlFrameBytes: 1024 * 1024,
    maxAudioChunkBytes: 1024 * 1024,
  };
}

test('transport parses server frames and serializes client writes', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const written: Buffer[] = [];
  input.on('data', (chunk: Buffer) => written.push(Buffer.from(chunk)));
  const messages: LocalWhisperWorkerServerMessage[] = [];
  const terminal: LocalWhisperTransportTerminalCause[] = [];
  const transport = new LocalWhisperWorkerTransport(
    { input, output },
    {
      onMessage: (message) => messages.push(message),
      onTerminal: (cause) => terminal.push(cause),
    },
  );
  output.write(encodeLocalWhisperControlFrame(helloAck()));
  await transport.sendControl({ type: 'hello', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION });
  assert.deepEqual(messages, [helloAck()]);
  assert.equal(written.length, 1);
  assert.deepEqual(
    written[0],
    Buffer.from(
      encodeLocalWhisperControlFrame({ type: 'hello', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION }),
    ),
  );
  assert.deepEqual(terminal, []);
  transport.dispose();
});

test('transport accepts the private cancel-too-late server frame', () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const messages: LocalWhisperWorkerServerMessage[] = [];
  const transport = new LocalWhisperWorkerTransport(
    { input, output },
    { onMessage: (message) => messages.push(message), onTerminal: () => assert.fail('unexpected terminal event') },
  );
  const message = {
    type: 'cancelTooLate' as const,
    protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
    requestId: 'cancel-1',
    targetRequestId: 'tx-1',
  };

  output.write(encodeLocalWhisperControlFrame(message));

  assert.deepEqual(messages, [message]);
  transport.dispose();
});

test('transport terminates once on worker audio or malformed stdout', () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const terminal: LocalWhisperTransportTerminalCause[] = [];
  const transport = new LocalWhisperWorkerTransport(
    { input, output },
    { onMessage: () => undefined, onTerminal: (cause) => terminal.push(cause) },
  );
  output.write(
    encodeLocalWhisperAudioFrame({ requestId: 'tx-1', sequence: 0, final: true, bytes: new Uint8Array([1]) }),
  );
  output.write(Buffer.from('ignored-after-terminal'));
  assert.deepEqual(terminal, ['protocolViolation']);
  transport.dispose();
});

test('transport consumes a late Windows pipe error after disposal', () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const terminal: LocalWhisperTransportTerminalCause[] = [];
  const transport = new LocalWhisperWorkerTransport(
    { input, output },
    { onMessage: () => undefined, onTerminal: (cause) => terminal.push(cause) },
  );

  transport.dispose();

  assert.doesNotThrow(() => input.emit('error', new Error('late worker input EOF')));
  assert.doesNotThrow(() => output.emit('error', new Error('late worker output EOF')));
  assert.deepEqual(terminal, []);
});
