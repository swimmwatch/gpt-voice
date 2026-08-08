import { LOCAL_WHISPER_MAX_STDERR_BYTES } from './LocalWhisperSupervisorConstants';

function sanitizeStderr(value: string): string {
  let sanitized = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    const codeUnit = character.charCodeAt(0);
    const unsafe =
      (codeUnit <= 0x1f && codeUnit !== 0x09 && codeUnit !== 0x0a && codeUnit !== 0x0d) || codeUnit === 0x7f;
    sanitized += unsafe ? '\ufffd' : character;
  }
  return sanitized;
}

/** Private bounded tail; callers must never expose its contents through logs or IPC. */
export class BoundedStderrRing {
  private readonly decoder = new TextDecoder('utf-8', { fatal: false });
  private sanitizedTail = '';

  public constructor(private readonly maximumBytes = LOCAL_WHISPER_MAX_STDERR_BYTES) {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
      throw new Error('Invalid Local Whisper stderr bound');
    }
  }

  public append(chunk: Uint8Array): void {
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) return;
    const decoded = this.decoder.decode(chunk, { stream: true });
    this.sanitizedTail += sanitizeStderr(decoded);
    this.trim();
  }

  public clear(): void {
    this.sanitizedTail = '';
    this.decoder.decode();
  }

  public get byteLength(): number {
    return Buffer.byteLength(this.sanitizedTail, 'utf8');
  }

  /** Returns a copy for private in-memory diagnostics only. */
  public copySanitizedTail(): string {
    return this.sanitizedTail;
  }

  private trim(): void {
    while (Buffer.byteLength(this.sanitizedTail, 'utf8') > this.maximumBytes) {
      const codePoints = Array.from(this.sanitizedTail);
      const excess = Buffer.byteLength(this.sanitizedTail, 'utf8') - this.maximumBytes;
      let removedBytes = 0;
      let removedCodePoints = 0;
      while (removedCodePoints < codePoints.length && removedBytes < excess) {
        removedBytes += Buffer.byteLength(codePoints[removedCodePoints] ?? '', 'utf8');
        removedCodePoints += 1;
      }
      this.sanitizedTail = codePoints.slice(removedCodePoints).join('');
    }
  }
}
