import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { describe, test } from 'node:test';

import {
  LOCAL_WHISPER_CONTROL_FRAME_KIND,
  LOCAL_WHISPER_FRAME_HEADER_BYTES,
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  encodeLocalWhisperControlFrame,
  toLocalWhisperRevisionId,
} from '@shared/localWhisper';
import {
  QualificationWorkerProtocolObserver,
  type QualificationWorkerProtocolObservation,
} from '@scripts/local-whisper/qualification/QualificationWorkerProtocolObserver';

function rawControlFrame(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  const frame = Buffer.alloc(LOCAL_WHISPER_FRAME_HEADER_BYTES + body.byteLength);
  frame.writeUInt32BE(body.byteLength, 0);
  frame.writeUInt8(LOCAL_WHISPER_CONTROL_FRAME_KIND, 4);
  body.copy(frame, LOCAL_WHISPER_FRAME_HEADER_BYTES);
  return frame;
}

function revision(value: string) {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid fixture revision');
  return parsed;
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('QualificationWorkerProtocolObserver', () => {
  test('reports only the decoded server message type and field names', async () => {
    const output = new PassThrough();
    const observations: QualificationWorkerProtocolObservation[] = [];
    new QualificationWorkerProtocolObserver((observation) => observations.push(observation)).observe(output);
    output.end(
      encodeLocalWhisperControlFrame({
        type: 'helloAck',
        protocolVersion: 1,
        engine: 'whisperCpp',
        runtimeRevision: revision('runtime-v1'),
        runtimeBuildDigest: 'a'.repeat(64),
        backend: 'cpu',
        capabilities: ['cpu-baseline'],
        maxControlFrameBytes: LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
        maxAudioChunkBytes: LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
      }),
    );
    await settle();

    assert.deepEqual(observations, [
      {
        fieldNames: [
          'backend',
          'capabilities',
          'engine',
          'maxAudioChunkBytes',
          'maxControlFrameBytes',
          'protocolVersion',
          'runtimeBuildDigest',
          'runtimeRevision',
          'type',
        ],
        messageType: 'helloAck',
        stage: 'decoded',
      },
    ]);
  });

  test('collapses invalid or truncated framing to value-free observations', async () => {
    for (const [bytes, stage] of [
      [Buffer.from([0, 0, 0, 1, 9, 0]), 'unexpectedFrame'],
      [Buffer.from([0, 0, 0, 4, 1]), 'transport'],
    ] as const) {
      const output = new PassThrough();
      const observations: QualificationWorkerProtocolObservation[] = [];
      new QualificationWorkerProtocolObserver((observation) => observations.push(observation)).observe(output);
      output.end(bytes);
      await settle();
      assert.deepEqual(observations[observations.length - 1], {
        fieldNames: [],
        messageType: 'unavailable',
        stage,
      });
    }
  });

  test('reports rejected message structure without retaining field values', async () => {
    const output = new PassThrough();
    const observations: QualificationWorkerProtocolObservation[] = [];
    new QualificationWorkerProtocolObserver((observation) => observations.push(observation)).observe(output);
    output.end(
      rawControlFrame({
        type: 'loaded',
        protocolVersion: 1,
        requestId: 'fixture-request',
        unexpectedField: 'private-fixture-value',
      }),
    );
    await settle();

    assert.deepEqual(observations, [
      {
        fieldNames: ['protocolVersion', 'requestId', 'type', 'unexpectedField'],
        messageType: 'loaded',
        stage: 'schema',
      },
    ]);
    assert.equal(JSON.stringify(observations).includes('private-fixture-value'), false);
  });
});
