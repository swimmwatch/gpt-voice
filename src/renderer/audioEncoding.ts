import { DEFAULT_TRANSCRIPTION_MIME_TYPE, WAV_TRANSCRIPTION_MIME_TYPE } from '@shared/transcriptionConstants';
import { PCM16_BYTES_PER_SAMPLE, encodePcm16WavBytes, getPcm16SampleValue } from './audio/pcm16';

const TARGET_TRANSCRIPTION_SAMPLE_RATE = 16000;

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
  const pcm = new Uint8Array(frameCount * channelCount * PCM16_BYTES_PER_SAMPLE);
  const view = new DataView(pcm.buffer);
  let offset = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      view.setInt16(offset, getPcm16SampleValue(channelData[channel][frame]), true);
      offset += PCM16_BYTES_PER_SAMPLE;
    }
  }

  return encodePcm16WavBytes(pcm, sampleRate, channelCount);
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
