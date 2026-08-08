const U64_MAX = 0xffff_ffff_ffff_ffffn;

export function requireLocalWhisperAuthorityBytes(value: Uint8Array, length: number, label: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength !== length) throw new Error(`Invalid ${label}`);
  return value;
}

export function requireLocalWhisperAuthorityU64(value: bigint, label: string, allowZero = true): bigint {
  if (value < 0n || value > U64_MAX || (!allowZero && value === 0n)) throw new Error(`Invalid ${label}`);
  return value;
}
