import { createHash } from 'node:crypto';

const MAX_IDENTITY_BYTES = 256;
const U64_MAX = 0xffff_ffff_ffff_ffffn;

function requireU16(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Error(`Invalid ${label}`);
  return value;
}

function requireU64(value: bigint, label: string): bigint {
  if (value < 0n || value > U64_MAX) throw new Error(`Invalid ${label}`);
  return value;
}

function requireString(value: string, label: string, maximumBytes = MAX_IDENTITY_BYTES): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength === 0 || encoded.byteLength > maximumBytes) throw new Error(`Invalid ${label}`);
  return encoded;
}

/** Builds a canonical SHA-256 preimage from explicitly sized protocol fields. */
export class LocalWhisperCanonicalDigestWriter {
  private readonly chunks: Uint8Array[] = [];

  public raw(value: Uint8Array): this {
    this.chunks.push(value);
    return this;
  }

  public u16(value: number, label: string): this {
    const encoded = new Uint8Array(2);
    new DataView(encoded.buffer).setUint16(0, requireU16(value, label), false);
    return this.raw(encoded);
  }

  public u64(value: bigint, label: string): this {
    const encoded = new Uint8Array(8);
    new DataView(encoded.buffer).setBigUint64(0, requireU64(value, label), false);
    return this.raw(encoded);
  }

  public string(value: string, label: string, maximumBytes = MAX_IDENTITY_BYTES): this {
    const encoded = requireString(value, label, maximumBytes);
    return this.u16(encoded.byteLength, `${label} length`).raw(encoded);
  }

  public digest(): string {
    const hash = createHash('sha256');
    for (const chunk of this.chunks) hash.update(chunk);
    return hash.digest('hex');
  }
}
