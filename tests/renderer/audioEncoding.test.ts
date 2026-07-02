import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encodePcm16Wav, prepareTranscriptionAudio } from '../../src/renderer/audioEncoding';

function ascii(buffer: ArrayBuffer, start: number, length: number): string {
  return Buffer.from(buffer.slice(start, start + length)).toString('ascii');
}

describe('audioEncoding', () => {
  it('encodes mono float samples as a PCM16 WAV file', () => {
    const wav = encodePcm16Wav([new Float32Array([-1, 0, 1])], 16000);
    const view = new DataView(wav);

    assert.equal(ascii(wav, 0, 4), 'RIFF');
    assert.equal(ascii(wav, 8, 4), 'WAVE');
    assert.equal(ascii(wav, 12, 4), 'fmt ');
    assert.equal(view.getUint16(20, true), 1);
    assert.equal(view.getUint16(22, true), 1);
    assert.equal(view.getUint32(24, true), 16000);
    assert.equal(view.getUint16(34, true), 16);
    assert.equal(ascii(wav, 36, 4), 'data');
    assert.equal(view.getUint32(40, true), 6);
    assert.equal(view.getInt16(44, true), -32768);
    assert.equal(view.getInt16(46, true), 0);
    assert.equal(view.getInt16(48, true), 32767);
  });

  it('rejects invalid PCM input', () => {
    assert.throws(() => encodePcm16Wav([], 16000), /at least one channel/);
    assert.throws(() => encodePcm16Wav([new Float32Array()], 16000), /audio samples/);
    assert.throws(() => encodePcm16Wav([new Float32Array([0]), new Float32Array([0, 1])], 16000), /channel lengths/);
    assert.throws(() => encodePcm16Wav([new Float32Array([0])], 0), /sample rate/);
  });

  it('falls back to the original blob when Web Audio is unavailable', async () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const payload = await prepareTranscriptionAudio(new Blob([source], { type: 'audio/webm;codecs=opus' }));

    assert.equal(payload.mimeType, 'audio/webm;codecs=opus');
    assert.equal(payload.transcoded, false);
    assert.equal(payload.fallbackReason, 'Web Audio APIs are unavailable');
    assert.deepEqual(new Uint8Array(payload.buffer), source);
  });
});
