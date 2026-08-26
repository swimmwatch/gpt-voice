/** Reads one fixed-width authority record with checked bounds and completion. */
export class LocalWhisperAuthorityBinaryReader {
  private offset = 0;

  public constructor(private readonly input: Uint8Array) {}

  public bytes(length: number): Uint8Array {
    if (this.offset + length > this.input.byteLength) throw new Error('Truncated authority record');
    const value = this.input.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  public u8(): number {
    return this.bytes(1)[0] ?? 0;
  }

  public u64(): bigint {
    if (this.offset + 8 > this.input.byteLength) throw new Error('Truncated authority record');
    const value = new DataView(this.input.buffer, this.input.byteOffset, this.input.byteLength).getBigUint64(
      this.offset,
      false,
    );
    this.offset += 8;
    return value;
  }

  public finish(): void {
    if (this.offset !== this.input.byteLength) throw new Error('Trailing authority record bytes');
  }
}
