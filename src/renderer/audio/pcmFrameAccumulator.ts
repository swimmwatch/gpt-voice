import { LIVE_PCM_FRAME_BYTES } from './pcm16';

/** Emits fixed PCM frames while retaining no more than one partial frame. */
export class PcmFrameAccumulator {
  private partial = new Uint8Array();
  private finished = false;

  push(pcm: Uint8Array): Uint8Array[] {
    if (this.finished) {
      throw new Error('Cannot frame PCM after flush');
    }
    if (pcm.byteLength % 2 !== 0) {
      throw new Error('PCM chunks must contain complete 16-bit samples');
    }
    if (pcm.byteLength === 0) return [];

    const available = new Uint8Array(this.partial.byteLength + pcm.byteLength);
    available.set(this.partial);
    available.set(pcm, this.partial.byteLength);

    const frames: Uint8Array[] = [];
    let offset = 0;
    while (available.byteLength - offset >= LIVE_PCM_FRAME_BYTES) {
      frames.push(available.slice(offset, offset + LIVE_PCM_FRAME_BYTES));
      offset += LIVE_PCM_FRAME_BYTES;
    }
    this.partial = available.slice(offset);
    return frames;
  }

  flush(): Uint8Array {
    if (this.finished) return new Uint8Array();
    this.finished = true;
    const finalChunk = this.partial.slice();
    this.partial = new Uint8Array();
    return finalChunk;
  }

  cancel(): void {
    this.finished = true;
    this.partial = new Uint8Array();
  }

  get bufferedByteLength(): number {
    return this.partial.byteLength;
  }
}
