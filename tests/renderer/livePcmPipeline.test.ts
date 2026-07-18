import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LivePcmPipeline } from '@renderer/audio/livePcmPipeline';
import { PcmFrameAccumulator } from '@renderer/audio/pcmFrameAccumulator';
import {
  LIVE_PCM_CHANNELS,
  LIVE_PCM_FRAME_BYTES,
  LIVE_PCM_SAMPLE_RATE_HZ,
  PCM16_WAV_HEADER_BYTES,
  concatenatePcmChunks,
  encodePcm16Samples,
  mixChannelsToMono,
} from '@renderer/audio/pcm16';
import { StreamingLinearResampler } from '@renderer/audio/streamingLinearResampler';

const IRREGULAR_BLOCK_SIZES = [1, 7, 128, 3, 511, 64, 2, 257] as const;

function concatenateFloat32(chunks: readonly Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function resampleInBlocks(source: Float32Array, sourceRate: number): Float32Array {
  const resampler = new StreamingLinearResampler(sourceRate, LIVE_PCM_SAMPLE_RATE_HZ);
  const output: Float32Array[] = [];
  let offset = 0;
  let blockIndex = 0;
  while (offset < source.length) {
    const blockSize = IRREGULAR_BLOCK_SIZES[blockIndex % IRREGULAR_BLOCK_SIZES.length];
    output.push(resampler.push(source.subarray(offset, Math.min(source.length, offset + blockSize))));
    offset += blockSize;
    blockIndex += 1;
  }
  output.push(resampler.flush());
  return concatenateFloat32(output);
}

function finishPipeline(pipeline: LivePcmPipeline, emittedFrames: Uint8Array[]): Uint8Array {
  const result = pipeline.finish();
  emittedFrames.push(...result.frames);
  return concatenatePcmChunks([...emittedFrames, result.finalChunk]);
}

describe('streaming PCM resampling', () => {
  it('keeps 44.1-kHz and 48-kHz output continuous across irregular blocks', () => {
    for (const sourceRate of [44_100, 48_000]) {
      const source = Float32Array.from({ length: 2_003 }, (_, index) => Math.sin(index / 31));
      const oneShot = new StreamingLinearResampler(sourceRate, LIVE_PCM_SAMPLE_RATE_HZ);
      const expected = concatenateFloat32([oneShot.push(source), oneShot.flush()]);
      const actual = resampleInBlocks(source, sourceRate);

      assert.equal(actual.length, Math.ceil((source.length * LIVE_PCM_SAMPLE_RATE_HZ) / sourceRate));
      assert.deepEqual(actual, expected);
    }
  });

  it('passes 16-kHz samples through exactly and rejects invalid lifecycle use', () => {
    const source = Float32Array.from({ length: 517 }, (_, index) => (index % 29) / 29 - 0.5);
    assert.deepEqual(resampleInBlocks(source, LIVE_PCM_SAMPLE_RATE_HZ), source);

    const resampler = new StreamingLinearResampler(48_000, LIVE_PCM_SAMPLE_RATE_HZ);
    resampler.push(new Float32Array([0, 0.5, 1]));
    resampler.flush();
    assert.throws(() => resampler.push(new Float32Array([0])), /after flush/u);
    assert.throws(() => new StreamingLinearResampler(0, LIVE_PCM_SAMPLE_RATE_HZ), /source sample rate/u);
  });

  it('interpolates 44.1-kHz source positions without boundary drift', () => {
    const sourceRate = 44_100;
    const source = Float32Array.from({ length: 101 }, (_, index) => index / 100);
    const output = resampleInBlocks(source, sourceRate);

    for (let index = 0; index < output.length; index += 1) {
      const sourcePosition = (index * sourceRate) / LIVE_PCM_SAMPLE_RATE_HZ;
      const expected = Math.min(sourcePosition, source.length - 1) / 100;
      assert.ok(Math.abs(output[index] - expected) < 1e-6);
    }
  });
});

describe('streaming PCM conversion and framing', () => {
  it('mixes every channel with normalization and finite-sample defense', () => {
    const mono = mixChannelsToMono([
      new Float32Array([1, Number.NaN, Number.POSITIVE_INFINITY, -1]),
      new Float32Array([-1, 1, -1, Number.NEGATIVE_INFINITY]),
      new Float32Array([1, 0.5, 0.5, 1]),
    ]);

    assert.ok(Math.abs(mono[0] - 1 / 3) < 1e-6);
    assert.ok(Math.abs(mono[1] - 0.5) < 1e-6);
    assert.ok(Math.abs(mono[2] + 1 / 6) < 1e-6);
    assert.equal(mono[3], 0);
    assert.throws(() => mixChannelsToMono([]), /at least one channel/u);
    assert.throws(() => mixChannelsToMono([new Float32Array([0]), new Float32Array([0, 1])]), /lengths must match/u);
  });

  it('clamps PCM16 endpoints and converts nonfinite samples to silence', () => {
    const pcm = encodePcm16Samples(
      new Float32Array([Number.NEGATIVE_INFINITY, Number.NaN, -2, -1, -0.5, 0, 0.5, 1, 2, Number.POSITIVE_INFINITY]),
    );
    const view = new DataView(pcm.buffer);
    const values = Array.from({ length: pcm.byteLength / 2 }, (_, index) => view.getInt16(index * 2, true));

    assert.deepEqual(values, [0, 0, -32_768, -32_768, -16_384, 0, 16_384, 32_767, 32_767, 0]);
    assert.equal(encodePcm16Samples(new Float32Array([0, 0.5, -0.5])).byteLength, 6);
  });

  it('emits complete 2,730-byte frames and one even final fragment', () => {
    const source = Uint8Array.from({ length: LIVE_PCM_FRAME_BYTES * 2 + 18 }, (_, index) => index % 251);
    const framer = new PcmFrameAccumulator();
    const frames: Uint8Array[] = [];
    let offset = 0;
    for (const size of [6, 100, 2_624, 8, 2_740]) {
      frames.push(...framer.push(source.subarray(offset, offset + size)));
      offset += size;
      assert.ok(framer.bufferedByteLength < LIVE_PCM_FRAME_BYTES);
    }
    const finalChunk = framer.flush();

    assert.deepEqual(
      frames.map((frame) => frame.byteLength),
      [LIVE_PCM_FRAME_BYTES, LIVE_PCM_FRAME_BYTES],
    );
    assert.equal(finalChunk.byteLength, 18);
    assert.equal(finalChunk.byteLength % 2, 0);
    assert.deepEqual(concatenatePcmChunks([...frames, finalChunk]), source);
    assert.throws(() => new PcmFrameAccumulator().push(new Uint8Array(3)), /complete 16-bit samples/u);
  });
});

describe('live PCM pipeline', () => {
  it('excludes paused samples and builds a canonical retry WAV from emitted PCM', () => {
    const beforePause = Float32Array.from({ length: 1_001 }, (_, index) => Math.sin(index / 19));
    const paused = new Float32Array(501).fill(1);
    const afterPause = Float32Array.from({ length: 1_003 }, (_, index) => Math.cos(index / 23));

    const expectedPipeline = new LivePcmPipeline(48_000);
    const expectedFrames = [
      ...expectedPipeline.pushChannels([beforePause]),
      ...expectedPipeline.pushChannels([afterPause]),
    ];
    const expectedPcm = finishPipeline(expectedPipeline, expectedFrames);

    const pipeline = new LivePcmPipeline(48_000);
    const emittedFrames = [...pipeline.pushChannels([beforePause])];
    pipeline.pause();
    assert.deepEqual(pipeline.pushChannels([paused]), []);
    pipeline.resume();
    emittedFrames.push(...pipeline.pushChannels([afterPause]));
    const result = pipeline.finish();
    emittedFrames.push(...result.frames);
    const actualPcm = concatenatePcmChunks([...emittedFrames, result.finalChunk]);
    const wavView = new DataView(result.recordingWav);

    assert.deepEqual(actualPcm, expectedPcm);
    assert.equal(wavView.getUint16(20, true), 1);
    assert.equal(wavView.getUint16(22, true), LIVE_PCM_CHANNELS);
    assert.equal(wavView.getUint32(24, true), LIVE_PCM_SAMPLE_RATE_HZ);
    assert.equal(wavView.getUint16(34, true), 16);
    assert.equal(wavView.getUint32(40, true), actualPcm.byteLength);
    assert.deepEqual(new Uint8Array(result.recordingWav, PCM16_WAV_HEADER_BYTES), actualPcm);
    assert.equal(pipeline.retainedPcmByteLength, 0);
  });

  it('clears operation audio on cancel and makes late samples inert', () => {
    const pipeline = new LivePcmPipeline(LIVE_PCM_SAMPLE_RATE_HZ);
    pipeline.pushChannels([new Float32Array(2_000).fill(0.25)]);
    assert.ok(pipeline.retainedPcmByteLength > 0);

    pipeline.cancel();

    assert.equal(pipeline.retainedPcmByteLength, 0);
    assert.deepEqual(pipeline.pushChannels([new Float32Array([1])]), []);
    assert.throws(() => pipeline.finish(), /cancelled/u);
  });
});
