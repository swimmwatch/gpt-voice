import { DEFAULT_TRANSCRIPTION_MIME_TYPE, WAV_TRANSCRIPTION_MIME_TYPE } from '../shared/transcriptionConstants';

const TARGET_TRANSCRIPTION_SAMPLE_RATE = 16000;
const WAV_HEADER_BYTES = 44;
const PCM_BYTES_PER_SAMPLE = 2;
const WAV_FORMAT_PCM = 1;
const WAV_BITS_PER_SAMPLE = 16;

export interface TranscriptionAudioPayload {
  buffer: ArrayBuffer;
  mimeType: string;
  transcoded: boolean;
  fallbackReason?: string;
}

export function encodePcm16Wav(channelData: Float32Array[], sampleRate: number): ArrayBuffer {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`Invalid WAV sample rate: ${sampleRate}`);
  }
  if (channelData.length === 0) {
    throw new Error('WAV encoding requires at least one channel');
  }

  const frameCount = channelData[0]?.length ?? 0;
  if (frameCount === 0) {
    throw new Error('WAV encoding requires audio samples');
  }
  for (const channel of channelData) {
    if (channel.length !== frameCount) {
      throw new Error('WAV channel lengths must match');
    }
  }

  const channelCount = channelData.length;
  const blockAlign = channelCount * PCM_BYTES_PER_SAMPLE;
  const byteRate = sampleRate * blockAlign;
  const dataBytes = frameCount * blockAlign;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, WAV_FORMAT_PCM, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, WAV_BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = WAV_HEADER_BYTES;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += PCM_BYTES_PER_SAMPLE;
    }
  }

  return buffer;
}

export async function prepareTranscriptionAudio(blob: Blob): Promise<TranscriptionAudioPayload> {
  const originalBuffer = await blob.arrayBuffer();
  if (originalBuffer.byteLength === 0) {
    return fallbackToOriginalAudio(originalBuffer, blob.type, 'Recorded audio is empty');
  }
  if (!canTranscodeWithWebAudio()) {
    return fallbackToOriginalAudio(originalBuffer, blob.type, 'Web Audio APIs are unavailable');
  }

  try {
    const decoded = await decodeAudioData(originalBuffer);
    const monoBuffer = await renderMonoAudio(decoded, TARGET_TRANSCRIPTION_SAMPLE_RATE);
    return {
      buffer: encodePcm16Wav([monoBuffer.getChannelData(0)], monoBuffer.sampleRate),
      mimeType: WAV_TRANSCRIPTION_MIME_TYPE,
      transcoded: true,
    };
  } catch (error: unknown) {
    return fallbackToOriginalAudio(originalBuffer, blob.type, getTranscodeFailureReason(error));
  }
}

function fallbackToOriginalAudio(
  buffer: ArrayBuffer,
  mimeType: string,
  fallbackReason: string,
): TranscriptionAudioPayload {
  return {
    buffer,
    mimeType: mimeType || DEFAULT_TRANSCRIPTION_MIME_TYPE,
    transcoded: false,
    fallbackReason,
  };
}

function getTranscodeFailureReason(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `Web Audio transcoding failed: ${error.message}`;
  }
  if (typeof error === 'string' && error) {
    return `Web Audio transcoding failed: ${error}`;
  }
  return 'Web Audio transcoding failed';
}

function canTranscodeWithWebAudio(): boolean {
  return typeof AudioContext !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
}

async function decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
  const audioContext = new AudioContext();
  try {
    return await audioContext.decodeAudioData(buffer.slice(0));
  } finally {
    await audioContext.close().catch(() => {});
  }
}

async function renderMonoAudio(audioBuffer: AudioBuffer, sampleRate: number): Promise<AudioBuffer> {
  const frameCount = Math.max(1, Math.ceil(audioBuffer.duration * sampleRate));
  const offlineContext = new OfflineAudioContext(1, frameCount, sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);
  return offlineContext.startRendering();
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
