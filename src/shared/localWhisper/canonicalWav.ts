export const LOCAL_WHISPER_WAV_HEADER_BYTES = 44;
export const LOCAL_WHISPER_WAV_SAMPLE_RATE = 16_000 as const;
export const LOCAL_WHISPER_WAV_BYTES_PER_SAMPLE = 2;
export const LOCAL_WHISPER_WAV_MAX_SAMPLES = 28_800_000;
export const LOCAL_WHISPER_WAV_MAX_DATA_BYTES = LOCAL_WHISPER_WAV_MAX_SAMPLES * LOCAL_WHISPER_WAV_BYTES_PER_SAMPLE;
export const LOCAL_WHISPER_WAV_MIN_TOTAL_BYTES = LOCAL_WHISPER_WAV_HEADER_BYTES + LOCAL_WHISPER_WAV_BYTES_PER_SAMPLE;
export const LOCAL_WHISPER_WAV_MAX_TOTAL_BYTES = LOCAL_WHISPER_WAV_HEADER_BYTES + LOCAL_WHISPER_WAV_MAX_DATA_BYTES;
export const LOCAL_WHISPER_WAV_MAX_OWNED_BYTES = 172_800_044;

export interface LocalWhisperCanonicalWavDescriptor {
  readonly bitsPerSample: 16;
  readonly byteLength: number;
  readonly channelCount: 1;
  readonly dataByteLength: number;
  readonly dataOffset: 44;
  readonly durationMs: number;
  readonly sampleCount: number;
  readonly sampleRate: 16_000;
}

function hasAscii(bytes: Uint8Array, offset: number, expected: string): boolean {
  return [...expected].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

/** Validates the one exact WAV representation accepted by Local Whisper. */
export function parseLocalWhisperCanonicalWav(bytes: Uint8Array): LocalWhisperCanonicalWavDescriptor {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < LOCAL_WHISPER_WAV_MIN_TOTAL_BYTES ||
    bytes.byteLength > LOCAL_WHISPER_WAV_MAX_TOTAL_BYTES
  ) {
    throw new Error('Invalid Local Whisper WAV length');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataByteLength = view.getUint32(40, true);
  if (
    !hasAscii(bytes, 0, 'RIFF') ||
    !hasAscii(bytes, 8, 'WAVE') ||
    !hasAscii(bytes, 12, 'fmt ') ||
    !hasAscii(bytes, 36, 'data') ||
    view.getUint32(4, true) !== bytes.byteLength - 8 ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== LOCAL_WHISPER_WAV_SAMPLE_RATE ||
    view.getUint32(28, true) !== LOCAL_WHISPER_WAV_SAMPLE_RATE * LOCAL_WHISPER_WAV_BYTES_PER_SAMPLE ||
    view.getUint16(32, true) !== LOCAL_WHISPER_WAV_BYTES_PER_SAMPLE ||
    view.getUint16(34, true) !== 16 ||
    dataByteLength !== bytes.byteLength - LOCAL_WHISPER_WAV_HEADER_BYTES ||
    dataByteLength === 0 ||
    dataByteLength % LOCAL_WHISPER_WAV_BYTES_PER_SAMPLE !== 0 ||
    dataByteLength > LOCAL_WHISPER_WAV_MAX_DATA_BYTES
  ) {
    throw new Error('Invalid Local Whisper canonical WAV');
  }
  const sampleCount = dataByteLength / LOCAL_WHISPER_WAV_BYTES_PER_SAMPLE;
  return Object.freeze({
    bitsPerSample: 16,
    byteLength: bytes.byteLength,
    channelCount: 1,
    dataByteLength,
    dataOffset: LOCAL_WHISPER_WAV_HEADER_BYTES,
    durationMs: (sampleCount * 1000) / LOCAL_WHISPER_WAV_SAMPLE_RATE,
    sampleCount,
    sampleRate: LOCAL_WHISPER_WAV_SAMPLE_RATE,
  });
}

/** Owns one bounded in-memory WAV accumulation and releases it on every terminal path. */
export class LocalWhisperWavAccumulator {
  private readonly chunks: Uint8Array[] = [];
  private nextSequence = 0;
  private retainedBytes = 0;
  private terminal = false;

  public constructor(
    private readonly requestId: string,
    private readonly expectedByteLength: number,
  ) {
    if (
      !requestId ||
      expectedByteLength < LOCAL_WHISPER_WAV_MIN_TOTAL_BYTES ||
      expectedByteLength > LOCAL_WHISPER_WAV_MAX_TOTAL_BYTES
    ) {
      throw new Error('Invalid Local Whisper WAV declaration');
    }
  }

  public append(requestId: string, sequence: number, final: boolean, bytes: Uint8Array): Uint8Array | null {
    if (
      this.terminal ||
      requestId !== this.requestId ||
      sequence !== this.nextSequence ||
      (bytes.byteLength === 0 && !final) ||
      this.retainedBytes + bytes.byteLength > this.expectedByteLength
    ) {
      this.release();
      throw new Error('Invalid Local Whisper WAV stream');
    }
    this.chunks.push(new Uint8Array(bytes));
    this.retainedBytes += bytes.byteLength;
    this.nextSequence += 1;
    if (!final) return null;
    this.terminal = true;
    if (this.retainedBytes !== this.expectedByteLength) {
      this.release();
      throw new Error('Invalid Local Whisper WAV stream length');
    }
    const complete = new Uint8Array(this.retainedBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      complete.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.release();
    parseLocalWhisperCanonicalWav(complete);
    return complete;
  }

  public cancel(): void {
    this.terminal = true;
    this.release();
  }

  public get retainedByteLength(): number {
    return this.retainedBytes;
  }

  private release(): void {
    this.chunks.length = 0;
    this.retainedBytes = 0;
  }
}
