import {
  MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES,
  STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS,
} from '@shared/streamingTranscription';

export const CLAUDE_WEB_PCM_SAMPLE_RATE_HZ = 16_000;
export const CLAUDE_WEB_PCM_CHANNELS = 1;
export const CLAUDE_WEB_PCM_BITS_PER_SAMPLE = 16;
export const CLAUDE_WEB_PCM_BYTES_PER_SAMPLE = 2;
export const CLAUDE_WEB_PCM_CHUNK_BYTES = MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES;
export const CLAUDE_WEB_PCM_CHUNK_CADENCE_MS = STREAMING_TRANSCRIPTION_FRAME_CADENCE_MS;

export type ClaudeWebAudioErrorCode =
  | 'truncated-container'
  | 'invalid-container'
  | 'container-size-mismatch'
  | 'truncated-chunk'
  | 'duplicate-format-chunk'
  | 'duplicate-data-chunk'
  | 'invalid-format-chunk'
  | 'missing-format-chunk'
  | 'missing-data-chunk'
  | 'unsupported-audio-format'
  | 'unsupported-channel-count'
  | 'unsupported-sample-rate'
  | 'unsupported-bit-depth'
  | 'invalid-block-align'
  | 'invalid-byte-rate'
  | 'empty-data'
  | 'unaligned-data';

const AUDIO_ERROR_MESSAGES: Readonly<Record<ClaudeWebAudioErrorCode, string>> = {
  'truncated-container': 'The WAV container is truncated',
  'invalid-container': 'The audio is not a RIFF/WAVE container',
  'container-size-mismatch': 'The WAV container size is invalid',
  'truncated-chunk': 'A WAV chunk is truncated or oversized',
  'duplicate-format-chunk': 'The WAV container has multiple format chunks',
  'duplicate-data-chunk': 'The WAV container has multiple data chunks',
  'invalid-format-chunk': 'The WAV format chunk is invalid',
  'missing-format-chunk': 'The WAV format chunk is missing',
  'missing-data-chunk': 'The WAV data chunk is missing',
  'unsupported-audio-format': 'Claude Web requires little-endian PCM audio',
  'unsupported-channel-count': 'Claude Web requires mono audio',
  'unsupported-sample-rate': 'Claude Web requires 16 kHz audio',
  'unsupported-bit-depth': 'Claude Web requires 16-bit audio',
  'invalid-block-align': 'The WAV block alignment is inconsistent',
  'invalid-byte-rate': 'The WAV byte rate is inconsistent',
  'empty-data': 'The WAV data is empty',
  'unaligned-data': 'The PCM data does not contain complete samples',
};

/** Identifies a WAV or PCM validation failure without retaining audio details. */
export class ClaudeWebAudioError extends Error {
  readonly code: ClaudeWebAudioErrorCode;

  constructor(code: ClaudeWebAudioErrorCode) {
    super(AUDIO_ERROR_MESSAGES[code]);
    this.name = 'ClaudeWebAudioError';
    this.code = code;
  }
}

interface ClaudeWebPcmFormat {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
}

interface ByteRange {
  start: number;
  end: number;
}

function hasFourCc(bytes: Uint8Array, offset: number, value: string): boolean {
  return (
    bytes[offset] === value.charCodeAt(0) &&
    bytes[offset + 1] === value.charCodeAt(1) &&
    bytes[offset + 2] === value.charCodeAt(2) &&
    bytes[offset + 3] === value.charCodeAt(3)
  );
}

function readPcmFormat(view: DataView, start: number, size: number): ClaudeWebPcmFormat {
  if (size < 16) throw new ClaudeWebAudioError('invalid-format-chunk');
  return {
    audioFormat: view.getUint16(start, true),
    channels: view.getUint16(start + 2, true),
    sampleRate: view.getUint32(start + 4, true),
    byteRate: view.getUint32(start + 8, true),
    blockAlign: view.getUint16(start + 12, true),
    bitsPerSample: view.getUint16(start + 14, true),
  };
}

function validatePcmFormat(format: ClaudeWebPcmFormat): void {
  if (format.audioFormat !== 1) throw new ClaudeWebAudioError('unsupported-audio-format');
  if (format.channels !== CLAUDE_WEB_PCM_CHANNELS) {
    throw new ClaudeWebAudioError('unsupported-channel-count');
  }
  if (format.sampleRate !== CLAUDE_WEB_PCM_SAMPLE_RATE_HZ) {
    throw new ClaudeWebAudioError('unsupported-sample-rate');
  }
  if (format.bitsPerSample !== CLAUDE_WEB_PCM_BITS_PER_SAMPLE) {
    throw new ClaudeWebAudioError('unsupported-bit-depth');
  }
  if (format.blockAlign !== CLAUDE_WEB_PCM_BYTES_PER_SAMPLE) {
    throw new ClaudeWebAudioError('invalid-block-align');
  }
  if (format.byteRate !== CLAUDE_WEB_PCM_SAMPLE_RATE_HZ * CLAUDE_WEB_PCM_BYTES_PER_SAMPLE) {
    throw new ClaudeWebAudioError('invalid-byte-rate');
  }
}

export function extractClaudeWebPcm(wave: Uint8Array): Uint8Array {
  if (wave.byteLength < 12) throw new ClaudeWebAudioError('truncated-container');
  if (!hasFourCc(wave, 0, 'RIFF') || !hasFourCc(wave, 8, 'WAVE')) {
    throw new ClaudeWebAudioError('invalid-container');
  }

  const view = new DataView(wave.buffer, wave.byteOffset, wave.byteLength);
  const containerEnd = view.getUint32(4, true) + 8;
  if (containerEnd !== wave.byteLength || containerEnd < 12) {
    throw new ClaudeWebAudioError('container-size-mismatch');
  }

  let format: ClaudeWebPcmFormat | null = null;
  let dataRange: ByteRange | null = null;
  let offset = 12;
  while (offset < containerEnd) {
    if (containerEnd - offset < 8) throw new ClaudeWebAudioError('truncated-chunk');
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    const nextOffset = chunkEnd + (chunkSize % 2);
    if (chunkEnd > containerEnd || nextOffset > containerEnd) {
      throw new ClaudeWebAudioError('truncated-chunk');
    }

    if (hasFourCc(wave, offset, 'fmt ')) {
      if (format) throw new ClaudeWebAudioError('duplicate-format-chunk');
      format = readPcmFormat(view, chunkStart, chunkSize);
    } else if (hasFourCc(wave, offset, 'data')) {
      if (dataRange) throw new ClaudeWebAudioError('duplicate-data-chunk');
      dataRange = { start: chunkStart, end: chunkEnd };
    }
    offset = nextOffset;
  }

  if (!format) throw new ClaudeWebAudioError('missing-format-chunk');
  if (!dataRange) throw new ClaudeWebAudioError('missing-data-chunk');
  validatePcmFormat(format);

  const dataLength = dataRange.end - dataRange.start;
  if (dataLength === 0) throw new ClaudeWebAudioError('empty-data');
  if (dataLength % CLAUDE_WEB_PCM_BYTES_PER_SAMPLE !== 0) {
    throw new ClaudeWebAudioError('unaligned-data');
  }
  return Uint8Array.from(wave.subarray(dataRange.start, dataRange.end));
}

export function splitClaudeWebPcm(pcm: Uint8Array): Uint8Array[] {
  if (pcm.byteLength === 0) throw new ClaudeWebAudioError('empty-data');
  if (pcm.byteLength % CLAUDE_WEB_PCM_BYTES_PER_SAMPLE !== 0) {
    throw new ClaudeWebAudioError('unaligned-data');
  }

  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < pcm.byteLength; offset += CLAUDE_WEB_PCM_CHUNK_BYTES) {
    chunks.push(Uint8Array.from(pcm.subarray(offset, offset + CLAUDE_WEB_PCM_CHUNK_BYTES)));
  }
  return chunks;
}
