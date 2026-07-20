export const LIVE_PCM_SAMPLE_RATE_HZ = 16_000;
export const LIVE_PCM_CHANNELS = 1;
export const PCM16_BITS_PER_SAMPLE = 16;
export const PCM16_BYTES_PER_SAMPLE = PCM16_BITS_PER_SAMPLE / 8;
export const LIVE_PCM_FRAME_BYTES = MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES;
export const PCM16_WAV_HEADER_BYTES = 44;

const WAV_FORMAT_PCM = 1;
const MAX_WAV_DATA_BYTES = 0xffff_ffff - 36;

export function mixChannelsToMono(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 0) {
    throw new Error('PCM mixing requires at least one channel');
  }

  const sampleCount = channels[0]?.length ?? 0;
  if (channels.some((channel) => channel.length !== sampleCount)) {
    throw new Error('PCM channel lengths must match');
  }

  const mono = new Float32Array(sampleCount);
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let normalizedSum = 0;
    for (const channel of channels) {
      const sample = channel[sampleIndex];
      normalizedSum += (Number.isFinite(sample) ? sample : 0) / channels.length;
    }
    mono[sampleIndex] = normalizedSum;
  }
  return mono;
}

export function getPcm16SampleValue(sample: number): number {
  const finiteSample = Number.isFinite(sample) ? sample : 0;
  const clampedSample = Math.max(-1, Math.min(1, finiteSample));
  return Math.round(clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff);
}

export function encodePcm16Samples(samples: Float32Array): Uint8Array {
  const pcm = new Uint8Array(samples.length * PCM16_BYTES_PER_SAMPLE);
  const view = new DataView(pcm.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(index * PCM16_BYTES_PER_SAMPLE, getPcm16SampleValue(samples[index]), true);
  }
  return pcm;
}

export function concatenatePcmChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  if (!Number.isSafeInteger(byteLength)) {
    throw new Error('PCM byte length exceeds the supported range');
  }

  const pcm = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return pcm;
}

export function encodePcm16WavBytes(pcm: Uint8Array, sampleRate: number, channelCount: number): ArrayBuffer {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || sampleRate > 0xffff_ffff) {
    throw new Error(`Invalid WAV sample rate: ${sampleRate}`);
  }
  if (!Number.isInteger(channelCount) || channelCount <= 0 || channelCount > 0xffff) {
    throw new Error(`Invalid WAV channel count: ${channelCount}`);
  }

  const blockAlign = channelCount * PCM16_BYTES_PER_SAMPLE;
  const byteRate = sampleRate * blockAlign;
  if (blockAlign > 0xffff || byteRate > 0xffff_ffff) {
    throw new Error('WAV format values exceed the supported range');
  }
  if (pcm.byteLength % blockAlign !== 0) {
    throw new Error('PCM data must contain complete channel-aligned samples');
  }
  if (pcm.byteLength > MAX_WAV_DATA_BYTES) {
    throw new Error('PCM data is too large for a canonical WAV container');
  }

  const wav = new ArrayBuffer(PCM16_WAV_HEADER_BYTES + pcm.byteLength);
  const view = new DataView(wav);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, WAV_FORMAT_PCM, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, PCM16_BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  new Uint8Array(wav, PCM16_WAV_HEADER_BYTES).set(pcm);
  return wav;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
import { MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES } from '@shared/streamingTranscription';
