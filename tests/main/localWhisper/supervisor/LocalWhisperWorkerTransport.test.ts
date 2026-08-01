import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import {
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
    protocolVersion: 1,
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
  await transport.sendControl({ type: 'hello', protocolVersion: 1 });
  assert.deepEqual(messages, [helloAck()]);
  assert.equal(written.length, 1);
  assert.deepEqual(written[0], Buffer.from(encodeLocalWhisperControlFrame({ type: 'hello', protocolVersion: 1 })));
  assert.deepEqual(terminal, []);
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
