import {
  requireLocalWhisperAuthorityBytes,
  requireLocalWhisperAuthorityU64,
} from './LocalWhisperAuthorityBinaryValidation';

/** Writes one fixed-width authority record with checked bounds and completion. */
export class LocalWhisperAuthorityBinaryWriter {
  private readonly output: Uint8Array;
  private offset = 0;

  public constructor(length: number) {
    this.output = new Uint8Array(length);
  }

  public bytes(value: Uint8Array, expectedLength: number, label: string): this {
    this.output.set(requireLocalWhisperAuthorityBytes(value, expectedLength, label), this.offset);
    this.offset += expectedLength;
    return this;
  }

  public u8(value: number, label: string): this {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new Error(`Invalid ${label}`);
    this.output[this.offset] = value;
    this.offset += 1;
    return this;
  }

  public u64(value: bigint, label: string, allowZero = true): this {
    new DataView(this.output.buffer).setBigUint64(
      this.offset,
      requireLocalWhisperAuthorityU64(value, label, allowZero),
      false,
    );
    this.offset += 8;
    return this;
  }

  public finish(): Uint8Array {
    if (this.offset !== this.output.byteLength) throw new Error('Incomplete authority record');
    return this.output;
  }
}
