import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLAUDE_WEB_PCM_CHUNK_BYTES,
  ClaudeWebAudioError,
  extractClaudeWebPcm,
  splitClaudeWebPcm,
  type ClaudeWebAudioErrorCode,
} from '@main/providers/claudeWebAudio';

interface PcmFormatOverrides {
  audioFormat?: number;
  channels?: number;
  sampleRate?: number;
  byteRate?: number;
  blockAlign?: number;
  bitsPerSample?: number;
}

function makePcmFormat(overrides: PcmFormatOverrides = {}): Buffer {
  const audioFormat = overrides.audioFormat ?? 1;
  const channels = overrides.channels ?? 1;
  const sampleRate = overrides.sampleRate ?? 16_000;
  const bitsPerSample = overrides.bitsPerSample ?? 16;
  const blockAlign = overrides.blockAlign ?? (channels * bitsPerSample) / 8;
  const byteRate = overrides.byteRate ?? sampleRate * blockAlign;
  const format = Buffer.alloc(16);
  format.writeUInt16LE(audioFormat, 0);
  format.writeUInt16LE(channels, 2);
  format.writeUInt32LE(sampleRate, 4);
  format.writeUInt32LE(byteRate, 8);
  format.writeUInt16LE(blockAlign, 12);
  format.writeUInt16LE(bitsPerSample, 14);
  return format;
}

function makeChunk(id: string, data: Uint8Array, includePadding = true): Buffer {
  assert.equal(id.length, 4);
  const padding = includePadding && data.byteLength % 2 === 1 ? 1 : 0;
  const chunk = Buffer.alloc(8 + data.byteLength + padding);
  chunk.write(id, 0, 4, 'ascii');
  chunk.writeUInt32LE(data.byteLength, 4);
  Buffer.from(data).copy(chunk, 8);
  return chunk;
}

function makeContainer(chunks: readonly Uint8Array[]): Buffer {
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), ...chunks.map((chunk) => Buffer.from(chunk))]);
  const container = Buffer.alloc(8 + body.byteLength);
  container.write('RIFF', 0, 4, 'ascii');
  container.writeUInt32LE(body.byteLength, 4);
  body.copy(container, 8);
  return container;
}

function makeWave(format: PcmFormatOverrides = {}, data: Uint8Array = Uint8Array.of(0, 0, 1, 0)): Buffer {
  return makeContainer([makeChunk('fmt ', makePcmFormat(format)), makeChunk('data', data)]);
}

function assertAudioError(action: () => unknown, code: ClaudeWebAudioErrorCode): void {
  assert.throws(action, (error: unknown) => error instanceof ClaudeWebAudioError && error.code === code);
}

describe('Claude Web WAV audio', () => {
  it('extracts only PCM data while respecting extra chunks, odd padding, and extended fmt data', () => {
    const samples = Uint8Array.of(0, 0, 1, 0, 255, 127);
    const extendedFormat = Buffer.concat([makePcmFormat(), Buffer.from([0, 0])]);
    const wave = makeContainer([
      makeChunk('JUNK', Uint8Array.of(7)),
      makeChunk('fmt ', extendedFormat),
      makeChunk('LIST', Uint8Array.of(1, 2, 3, 4)),
      makeChunk('data', samples),
    ]);

    const pcm = extractClaudeWebPcm(wave);

    assert.deepEqual(pcm, samples);
    assert.equal(pcm.byteLength, samples.byteLength);
  });

  it('rejects unsupported PCM properties with deterministic error codes', () => {
    const cases: ReadonlyArray<[PcmFormatOverrides, ClaudeWebAudioErrorCode]> = [
      [{ audioFormat: 3 }, 'unsupported-audio-format'],
      [{ channels: 2 }, 'unsupported-channel-count'],
      [{ sampleRate: 48_000 }, 'unsupported-sample-rate'],
      [{ bitsPerSample: 24 }, 'unsupported-bit-depth'],
      [{ byteRate: 1 }, 'invalid-byte-rate'],
      [{ blockAlign: 4 }, 'invalid-block-align'],
    ];

    for (const [format, code] of cases) {
      assertAudioError(() => extractClaudeWebPcm(makeWave(format)), code);
    }
  });

  it('rejects missing, duplicate, empty, and sample-unaligned chunks', () => {
    const formatChunk = makeChunk('fmt ', makePcmFormat());
    const dataChunk = makeChunk('data', Uint8Array.of(0, 0));

    assertAudioError(() => extractClaudeWebPcm(makeContainer([dataChunk])), 'missing-format-chunk');
    assertAudioError(() => extractClaudeWebPcm(makeContainer([formatChunk])), 'missing-data-chunk');
    assertAudioError(
      () => extractClaudeWebPcm(makeContainer([formatChunk, formatChunk, dataChunk])),
      'duplicate-format-chunk',
    );
    assertAudioError(
      () => extractClaudeWebPcm(makeContainer([formatChunk, dataChunk, dataChunk])),
      'duplicate-data-chunk',
    );
    assertAudioError(() => extractClaudeWebPcm(makeWave({}, new Uint8Array())), 'empty-data');
    assertAudioError(() => extractClaudeWebPcm(makeWave({}, Uint8Array.of(1))), 'unaligned-data');
  });

  it('rejects invalid containers and every structural truncation boundary', () => {
    const valid = makeWave();
    const wrongRiff = Buffer.from(valid);
    wrongRiff.write('FORM', 0, 4, 'ascii');
    const wrongWave = Buffer.from(valid);
    wrongWave.write('AVI ', 8, 4, 'ascii');
    const trailingByte = Buffer.concat([valid, Buffer.from([0])]);
    const partialChunkHeader = makeContainer([Buffer.from('JUNK', 'ascii')]);
    const oversizedChunkHeader = Buffer.alloc(8);
    oversizedChunkHeader.write('data', 0, 4, 'ascii');
    oversizedChunkHeader.writeUInt32LE(0xffffffff, 4);
    const oversizedChunk = makeContainer([oversizedChunkHeader]);
    const missingOddPadding = makeContainer([makeChunk('JUNK', Uint8Array.of(1), false)]);
    const shortFormat = makeContainer([makeChunk('fmt ', new Uint8Array(15)), makeChunk('data', Uint8Array.of(0, 0))]);

    assertAudioError(() => extractClaudeWebPcm(new Uint8Array(11)), 'truncated-container');
    assertAudioError(() => extractClaudeWebPcm(wrongRiff), 'invalid-container');
    assertAudioError(() => extractClaudeWebPcm(wrongWave), 'invalid-container');
    assertAudioError(() => extractClaudeWebPcm(valid.subarray(0, valid.byteLength - 1)), 'container-size-mismatch');
    assertAudioError(() => extractClaudeWebPcm(trailingByte), 'container-size-mismatch');
    assertAudioError(() => extractClaudeWebPcm(partialChunkHeader), 'truncated-chunk');
    assertAudioError(() => extractClaudeWebPcm(oversizedChunk), 'truncated-chunk');
    assertAudioError(() => extractClaudeWebPcm(missingOddPadding), 'truncated-chunk');
    assertAudioError(() => extractClaudeWebPcm(shortFormat), 'invalid-format-chunk');
  });
});

describe('Claude Web PCM chunking', () => {
  it('preserves every byte exactly once without splitting 16-bit samples', () => {
    const pcm = Uint8Array.from({ length: CLAUDE_WEB_PCM_CHUNK_BYTES * 2 + 4 }, (_, index) => index % 251);

    const chunks = splitClaudeWebPcm(pcm);

    assert.deepEqual(
      chunks.map((chunk) => chunk.byteLength),
      [CLAUDE_WEB_PCM_CHUNK_BYTES, CLAUDE_WEB_PCM_CHUNK_BYTES, 4],
    );
    assert.equal(
      chunks.every((chunk) => chunk.byteLength % 2 === 0),
      true,
    );
    assert.deepEqual(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))), Buffer.from(pcm));
  });

  it('rejects empty and sample-unaligned raw PCM', () => {
    assertAudioError(() => splitClaudeWebPcm(new Uint8Array()), 'empty-data');
    assertAudioError(() => splitClaudeWebPcm(Uint8Array.of(1, 2, 3)), 'unaligned-data');
  });
});
