import type { LocalWhisperCanonicalAudioDescriptor } from '@main/providers/LocalWhisperVoiceProvider';

export const LOCAL_WHISPER_WAV_SAMPLE_RATE = 16_000 as const;
export const LOCAL_WHISPER_WAV_CHANNEL_COUNT = 1 as const;
export const LOCAL_WHISPER_WAV_BITS_PER_SAMPLE = 16 as const;
export const LOCAL_WHISPER_MAX_WAV_BYTES = 512 * 1024 * 1024;
export const LOCAL_WHISPER_MAX_RIFF_CHUNKS = 64;

export type LocalWhisperWavValidationResult =
  | { readonly valid: true; readonly audio: LocalWhisperCanonicalAudioDescriptor }
  | {
      readonly valid: false;
      readonly reason:
        | 'invalid-container'
        | 'invalid-length'
        | 'invalid-format'
        | 'invalid-chunk'
        | 'missing-format'
        | 'missing-audio';
    };

function hasAscii(bytes: Uint8Array, offset: number, expected: string): boolean {
  if (offset < 0 || offset + expected.length > bytes.byteLength) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected.charCodeAt(index)) return false;
  }
  return true;
}

/** Validates one complete canonical mono PCM16/16 kHz RIFF-WAVE buffer without copying or native I/O. */
export function validateLocalWhisperCanonicalWav(buffer: ArrayBuffer): LocalWhisperWavValidationResult {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12 || buffer.byteLength > LOCAL_WHISPER_MAX_WAV_BYTES) {
    return { valid: false, reason: 'invalid-length' };
  }

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (!hasAscii(bytes, 0, 'RIFF') || !hasAscii(bytes, 8, 'WAVE')) {
    return { valid: false, reason: 'invalid-container' };
  }
  if (view.getUint32(4, true) + 8 !== buffer.byteLength) {
    return { valid: false, reason: 'invalid-length' };
  }

  let offset = 12;
  let chunkCount = 0;
  let foundFormat = false;
  let foundAudio = false;
  let dataOffset = 0;
  let dataByteLength = 0;

  while (offset < buffer.byteLength) {
    chunkCount += 1;
    if (chunkCount > LOCAL_WHISPER_MAX_RIFF_CHUNKS || offset + 8 > buffer.byteLength) {
      return { valid: false, reason: 'invalid-chunk' };
    }
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;
    const chunkDataEnd = chunkDataOffset + chunkSize;
    const paddedChunkEnd = chunkDataEnd + (chunkSize % 2);
    if (
      !Number.isSafeInteger(chunkDataEnd) ||
      !Number.isSafeInteger(paddedChunkEnd) ||
      chunkDataEnd > buffer.byteLength ||
      paddedChunkEnd > buffer.byteLength
    ) {
      return { valid: false, reason: 'invalid-chunk' };
    }

    if (hasAscii(bytes, offset, 'fmt ')) {
      if (foundFormat || foundAudio || chunkSize !== 16) return { valid: false, reason: 'invalid-format' };
      const audioFormat = view.getUint16(chunkDataOffset, true);
      const channelCount = view.getUint16(chunkDataOffset + 2, true);
      const sampleRate = view.getUint32(chunkDataOffset + 4, true);
      const byteRate = view.getUint32(chunkDataOffset + 8, true);
      const blockAlign = view.getUint16(chunkDataOffset + 12, true);
      const bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
      if (
        audioFormat !== 1 ||
        channelCount !== LOCAL_WHISPER_WAV_CHANNEL_COUNT ||
        sampleRate !== LOCAL_WHISPER_WAV_SAMPLE_RATE ||
        byteRate !== LOCAL_WHISPER_WAV_SAMPLE_RATE * 2 ||
        blockAlign !== 2 ||
        bitsPerSample !== LOCAL_WHISPER_WAV_BITS_PER_SAMPLE
      ) {
        return { valid: false, reason: 'invalid-format' };
      }
      foundFormat = true;
    } else if (hasAscii(bytes, offset, 'data')) {
      if (!foundFormat || foundAudio || chunkSize === 0 || chunkSize % 2 !== 0) {
        return { valid: false, reason: 'invalid-chunk' };
      }
      foundAudio = true;
      dataOffset = chunkDataOffset;
      dataByteLength = chunkSize;
    }

    offset = paddedChunkEnd;
  }

  if (offset !== buffer.byteLength) return { valid: false, reason: 'invalid-length' };
  if (!foundFormat) return { valid: false, reason: 'missing-format' };
  if (!foundAudio) return { valid: false, reason: 'missing-audio' };

  return {
    valid: true,
    audio: Object.freeze({
      byteLength: buffer.byteLength,
      dataOffset,
      dataByteLength,
      sampleRate: LOCAL_WHISPER_WAV_SAMPLE_RATE,
      channelCount: LOCAL_WHISPER_WAV_CHANNEL_COUNT,
      bitsPerSample: LOCAL_WHISPER_WAV_BITS_PER_SAMPLE,
    }),
  };
}
