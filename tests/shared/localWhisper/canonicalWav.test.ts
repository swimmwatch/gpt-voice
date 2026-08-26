import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LOCAL_WHISPER_WAV_MAX_DATA_BYTES,
  LOCAL_WHISPER_WAV_MAX_OWNED_BYTES,
  LocalWhisperWavAccumulator,
  parseLocalWhisperCanonicalWav,
} from '@shared/localWhisper';

function canonicalWav(dataBytes: number): Uint8Array {
  const result = new Uint8Array(44 + dataBytes);
  const view = new DataView(result.buffer);
  for (const [offset, value] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ] as const) {
    result.set(new TextEncoder().encode(value), offset);
  }
  view.setUint32(4, result.byteLength - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, dataBytes, true);
  return result;
}

test('canonical WAV accepts exact minimum and maximum and derives duration', () => {
  const minimum = parseLocalWhisperCanonicalWav(canonicalWav(2));
  assert.equal(minimum.sampleCount, 1);
  assert.equal(minimum.durationMs, 0.0625);
  const maximum = parseLocalWhisperCanonicalWav(canonicalWav(LOCAL_WHISPER_WAV_MAX_DATA_BYTES));
  assert.equal(maximum.sampleCount, 28_800_000);
  assert.equal(maximum.durationMs, 1_800_000);
  assert.equal(LOCAL_WHISPER_WAV_MAX_OWNED_BYTES, 172_800_044);
});

test('canonical WAV rejects malformed headers, odd data, trailing bytes, and zero samples', () => {
  const valid = canonicalWav(2);
  for (const mutate of [
    (bytes: Uint8Array) => {
      bytes[0] = 0;
    },
    (bytes: Uint8Array) => {
      new DataView(bytes.buffer).setUint32(24, 48_000, true);
    },
    (bytes: Uint8Array) => {
      new DataView(bytes.buffer).setUint32(40, 0, true);
    },
  ]) {
    const malformed = new Uint8Array(valid);
    mutate(malformed);
    assert.throws(() => parseLocalWhisperCanonicalWav(malformed));
  }
  assert.throws(() => parseLocalWhisperCanonicalWav(canonicalWav(1)));
  assert.throws(() => parseLocalWhisperCanonicalWav(Uint8Array.from([...valid, 0])));
});

test('WAV accumulator enforces request, sequence, terminal length, and releases storage', () => {
  const wav = canonicalWav(4);
  const accumulator = new LocalWhisperWavAccumulator('tx-1', wav.byteLength);
  assert.equal(accumulator.append('tx-1', 0, false, wav.subarray(0, 20)), null);
  const complete = accumulator.append('tx-1', 1, true, wav.subarray(20));
  assert.deepEqual(complete, wav);
  assert.equal(accumulator.retainedByteLength, 0);

  const invalid = new LocalWhisperWavAccumulator('tx-2', wav.byteLength);
  assert.throws(() => invalid.append('tx-2', 1, true, wav));
  assert.equal(invalid.retainedByteLength, 0);

  const cancelled = new LocalWhisperWavAccumulator('tx-3', wav.byteLength);
  cancelled.append('tx-3', 0, false, wav.subarray(0, 10));
  cancelled.cancel();
  assert.equal(cancelled.retainedByteLength, 0);
  assert.throws(() => cancelled.append('tx-3', 1, true, wav.subarray(10)));
});
