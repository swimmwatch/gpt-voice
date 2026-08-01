import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createLocalWhisperAudioChunk,
  decodeLocalWhisperAudioFrame,
  decodeLocalWhisperControlFrame,
  encodeLocalWhisperAudioFrame,
  encodeLocalWhisperControlFrame,
  isLocalWhisperWorkerClientMessage,
  isLocalWhisperWorkerServerMessage,
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  type LocalWhisperWorkerClientMessage,
  type LocalWhisperWorkerServerMessage,
} from '@shared/localWhisper';

describe('Local Whisper worker protocol', () => {
  it('round-trips every client control shape through a bounded length frame', () => {
    const messages: LocalWhisperWorkerClientMessage[] = [
      { type: 'hello', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION },
      {
        type: 'load',
        protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
        requestId: 'load-1',
        residencyKey: 'runtime|cuda|base',
      },
      { type: 'unload', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'unload-1' },
      {
        type: 'transcribe',
        protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
        requestId: 'transcribe-1',
        settingsEpoch: 4,
        audioByteLength: 640,
        options: {
          language: 'ru',
          initialPrompt: 'private prompt',
          temperatureHundredths: 25,
          strategy: 'bestOfSampling',
          candidateCount: 5,
        },
      },
      { type: 'cancel', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'cancel-1' },
      { type: 'shutdown', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'shutdown-1' },
    ];
    for (const message of messages) {
      assert.equal(isLocalWhisperWorkerClientMessage(message), true);
      assert.deepEqual(decodeLocalWhisperControlFrame(encodeLocalWhisperControlFrame(message)), message);
    }
  });

  it('round-trips every server control shape without raw native detail fields', () => {
    const messages: LocalWhisperWorkerServerMessage[] = [
      { type: 'helloAck', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION },
      {
        type: 'loaded',
        protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
        requestId: 'load-1',
        residencyKey: 'runtime|cuda|base',
      },
      { type: 'unloaded', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'unload-1' },
      {
        type: 'transcript',
        protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
        requestId: 'transcribe-1',
        text: 'final text',
      },
      { type: 'cancelled', protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION, requestId: 'cancel-1' },
      {
        type: 'failure',
        protocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
        requestId: null,
        code: 'WORKER_START_FAILED',
      },
    ];
    for (const message of messages) {
      assert.equal(isLocalWhisperWorkerServerMessage(message), true);
      assert.deepEqual(decodeLocalWhisperControlFrame(encodeLocalWhisperControlFrame(message)), message);
    }
  });

  it('fails closed for protocol mismatches, extra fields, malformed unions, and invalid decoding', () => {
    const valid = {
      type: 'transcribe',
      protocolVersion: 1,
      requestId: 'request-1',
      settingsEpoch: 1,
      audioByteLength: 100,
      options: {
        language: null,
        initialPrompt: '',
        temperatureHundredths: 0,
        strategy: 'greedy',
        candidateCount: null,
      },
    };
    const invalid = [
      { ...valid, protocolVersion: 2 },
      { ...valid, argv: ['private-path'] },
      { ...valid, requestId: '' },
      { ...valid, settingsEpoch: 1.5 },
      { ...valid, options: { ...valid.options, temperatureHundredths: 5 } },
      { ...valid, options: { ...valid.options, rawAudio: 'private' } },
      { type: 'failure', protocolVersion: 1, requestId: null, code: 'LOGIN_REQUIRED' },
      { type: 'failure', protocolVersion: 1, requestId: null, code: 'WORKER_CRASHED', stderr: 'private' },
    ];
    for (const message of invalid) {
      assert.equal(isLocalWhisperWorkerClientMessage(message), false);
      assert.equal(isLocalWhisperWorkerServerMessage(message), false);
    }
  });

  it('rejects malformed or oversized control frames', () => {
    const valid = encodeLocalWhisperControlFrame({ type: 'hello', protocolVersion: 1 });
    const wrongLength = new Uint8Array(valid);
    new DataView(wrongLength.buffer).setUint32(0, valid.byteLength, false);
    assert.throws(() => decodeLocalWhisperControlFrame(wrongLength), /length/);
    assert.throws(() => decodeLocalWhisperControlFrame(new Uint8Array([0, 0, 0])), /Malformed/);
    assert.throws(
      () =>
        encodeLocalWhisperControlFrame({
          type: 'transcript',
          protocolVersion: 1,
          requestId: 'request-1',
          text: 'x'.repeat(LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES),
        }),
      /maximum size/,
    );
  });

  it('round-trips copied, bounded binary audio chunks and rejects invalid bounds', () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const chunk = createLocalWhisperAudioChunk('request-1', 3, true, source);
    source[0] = 9;
    assert.deepEqual([...chunk.bytes], [1, 2, 3, 4]);
    const decoded = decodeLocalWhisperAudioFrame(encodeLocalWhisperAudioFrame(chunk));
    assert.equal(decoded.requestId, 'request-1');
    assert.equal(decoded.sequence, 3);
    assert.equal(decoded.final, true);
    assert.deepEqual([...decoded.bytes], [1, 2, 3, 4]);
    assert.throws(
      () =>
        createLocalWhisperAudioChunk('request-1', 0, false, new Uint8Array(LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES + 1)),
      /Invalid/,
    );
    assert.throws(() => createLocalWhisperAudioChunk('', 0, false, new Uint8Array()), /Invalid/);
  });
});
