import { randomBytes as nodeRandomBytes } from 'node:crypto';

import { LocalWhisperCanonicalDigestWriter } from './LocalWhisperCanonicalDigestWriter';

const AUTHORITY_BYTES = 16;
const CHALLENGE_BYTES = 32;
const MAX_REGISTRY_ENTRIES = 256;
const HEX_SHA256 = /^[a-f0-9]{64}$/u;
const BASE64URL_AUTHORITY = /^[\w-]{22}$/u;
const BASE64URL_CHALLENGE = /^[\w-]{43}$/u;

const REGISTRY_DOMAIN = Uint8Array.from([0x4c, 0x57, 0x52, 0x45, 0x47, 0x31, 0x00]);
const PROBE_DOMAIN = Uint8Array.from([0x4c, 0x57, 0x44, 0x45, 0x56, 0x31, 0x50, 0x00]);
const LOAD_DOMAIN = Uint8Array.from([0x4c, 0x57, 0x44, 0x45, 0x56, 0x31, 0x4c, 0x00]);

export interface LocalWhisperDeviceRegistryEntry {
  readonly backendId: string;
  readonly nativeIdentity: string;
  readonly ordinal: number;
  readonly type: 'gpu' | 'igpu';
}

export interface LocalWhisperDeviceRegistry {
  readonly backendId: string;
  readonly engineId: string;
  readonly entries: readonly LocalWhisperDeviceRegistryEntry[];
  readonly runtimeBuildDigest: string;
}

export interface LocalWhisperDeviceProofInput {
  readonly activatedOrdinal: number;
  readonly actualNativeIdentity: string;
  readonly authorityId: string;
  readonly backendId: string;
  readonly challenge: string;
  readonly configurationEpoch: bigint;
  readonly engineId: string;
  readonly primaryExecutionNativeIdentity: string;
  readonly registryFingerprint: string;
  readonly runtimeBuildDigest: string;
  readonly selectedDeviceModelWeightBytes: bigint;
  readonly selectedOrdinal: number;
  readonly topologyGeneration: bigint;
}

export type LocalWhisperDeviceProofDomain = 'load' | 'probe';

/** Encodes the fixed private authority record consumed before a GPU worker handshake. */
export function encodeLocalWhisperDeviceAuthority(
  authorityId: string,
  configurationEpoch: number,
  topologyGeneration: number,
): Uint8Array {
  const authority = decodeBase64Url(authorityId, AUTHORITY_BYTES, BASE64URL_AUTHORITY, 'authority ID');
  if (
    !Number.isSafeInteger(configurationEpoch) ||
    configurationEpoch < 0 ||
    !Number.isSafeInteger(topologyGeneration) ||
    topologyGeneration < 0
  ) {
    throw new Error('Invalid Local Whisper device authority epoch');
  }
  const record = Buffer.alloc(40);
  record.set(Uint8Array.from([0x4c, 0x57, 0x44, 0x41, 0x31, 0, 0, 0]), 0);
  record.set(authority, 8);
  record.writeBigUInt64BE(BigInt(configurationEpoch), 24);
  record.writeBigUInt64BE(BigInt(topologyGeneration), 32);
  return Uint8Array.from(record);
}

function requireDigest(value: string, label: string): Uint8Array {
  if (!HEX_SHA256.test(value)) throw new Error(`Invalid ${label}`);
  return Uint8Array.from(Buffer.from(value, 'hex'));
}

function decodeBase64Url(value: string, expectedBytes: number, pattern: RegExp, label: string): Uint8Array {
  if (!pattern.test(value)) throw new Error(`Invalid ${label}`);
  const decoded = Uint8Array.from(Buffer.from(value, 'base64url'));
  if (decoded.byteLength !== expectedBytes || Buffer.from(decoded).toString('base64url') !== value) {
    throw new Error(`Invalid ${label}`);
  }
  return decoded;
}

/** Computes the canonical ordered LWREG1 registry fingerprint. */
export function createLocalWhisperRegistryFingerprint(registry: LocalWhisperDeviceRegistry): string {
  if (registry.entries.length > MAX_REGISTRY_ENTRIES) throw new Error('Invalid registry entry count');
  const ordinals = new Set<number>();
  const identities = new Set<string>();
  const writer = new LocalWhisperCanonicalDigestWriter()
    .raw(REGISTRY_DOMAIN)
    .string(registry.engineId, 'engine ID')
    .raw(requireDigest(registry.runtimeBuildDigest, 'runtime build digest'))
    .string(registry.backendId, 'backend ID')
    .u16(registry.entries.length, 'registry entry count');
  for (const entry of registry.entries) {
    if (ordinals.has(entry.ordinal) || identities.has(entry.nativeIdentity)) {
      throw new Error('Duplicate Local Whisper registry authority');
    }
    ordinals.add(entry.ordinal);
    identities.add(entry.nativeIdentity);
    writer
      .u16(entry.ordinal, 'registry ordinal')
      .raw(Uint8Array.of(entry.type === 'gpu' ? 1 : 2))
      .string(entry.backendId, 'entry backend ID')
      .string(entry.nativeIdentity, 'native identity');
  }
  return writer.digest();
}

/** Computes one operation-specific LWDEV1 proof without accepting echoed expected values. */
export function createLocalWhisperDeviceProof(
  domain: LocalWhisperDeviceProofDomain,
  input: LocalWhisperDeviceProofInput,
): string {
  if (domain === 'probe' && input.selectedDeviceModelWeightBytes !== 0n) {
    throw new Error('Probe weight must be zero');
  }
  if (domain === 'load' && input.selectedDeviceModelWeightBytes <= 0n) {
    throw new Error('Load weight must be positive');
  }
  return new LocalWhisperCanonicalDigestWriter()
    .raw(domain === 'probe' ? PROBE_DOMAIN : LOAD_DOMAIN)
    .raw(decodeBase64Url(input.authorityId, AUTHORITY_BYTES, BASE64URL_AUTHORITY, 'authority ID'))
    .raw(decodeBase64Url(input.challenge, CHALLENGE_BYTES, BASE64URL_CHALLENGE, 'challenge'))
    .u64(input.configurationEpoch, 'configuration epoch')
    .u64(input.topologyGeneration, 'topology generation')
    .string(input.engineId, 'engine ID')
    .raw(requireDigest(input.runtimeBuildDigest, 'runtime build digest'))
    .string(input.backendId, 'backend ID')
    .raw(requireDigest(input.registryFingerprint, 'registry fingerprint'))
    .u16(input.selectedOrdinal, 'selected ordinal')
    .u16(input.activatedOrdinal, 'activated ordinal')
    .string(input.actualNativeIdentity, 'actual native identity')
    .string(input.primaryExecutionNativeIdentity, 'primary execution identity')
    .u64(input.selectedDeviceModelWeightBytes, 'selected model weight bytes')
    .digest();
}

/** Owns one private authority ID and one-use operation challenges. */
export class LocalWhisperDeviceChallengeAuthority {
  private readonly liveChallenges = new Map<string, LocalWhisperDeviceProofDomain>();
  public readonly authorityId: string;

  public constructor(private readonly randomBytes: (size: number) => Uint8Array = nodeRandomBytes) {
    const authority = randomBytes(AUTHORITY_BYTES);
    if (authority.byteLength !== AUTHORITY_BYTES) throw new Error('Invalid authority entropy');
    this.authorityId = Buffer.from(authority).toString('base64url');
  }

  public issue(domain: LocalWhisperDeviceProofDomain): string {
    const entropy = this.randomBytes(CHALLENGE_BYTES);
    if (entropy.byteLength !== CHALLENGE_BYTES) throw new Error('Invalid challenge entropy');
    const challenge = Buffer.from(entropy).toString('base64url');
    if (this.liveChallenges.has(challenge)) throw new Error('Reused Local Whisper challenge');
    this.liveChallenges.set(challenge, domain);
    return challenge;
  }

  public consume(domain: LocalWhisperDeviceProofDomain, challenge: string): boolean {
    const liveDomain = this.liveChallenges.get(challenge);
    this.liveChallenges.delete(challenge);
    return liveDomain === domain;
  }

  public invalidate(): void {
    this.liveChallenges.clear();
  }
}
