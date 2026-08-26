import { createHmac } from 'node:crypto';

import {
  hasLocalWhisperControlCharacter,
  toLocalWhisperOpaqueDeviceId,
  type LocalWhisperOpaqueDeviceId,
} from '@shared/localWhisper';

import type { LocalWhisperDeviceIdentityStore } from './FileLocalWhisperDeviceIdentityStore';

export {
  FileLocalWhisperDeviceIdentityStore,
  LOCAL_WHISPER_DEVICE_IDENTITY_DIRECTORY_MODE,
  LOCAL_WHISPER_DEVICE_IDENTITY_FILE_MODE,
  type FileLocalWhisperDeviceIdentityStoreDependencies,
  type LocalWhisperDeviceIdentityReadResult,
  type LocalWhisperDeviceIdentityStore,
} from './FileLocalWhisperDeviceIdentityStore';

export const LOCAL_WHISPER_DEVICE_IDENTITY_SCHEMA_VERSION = 1 as const;
export const LOCAL_WHISPER_DEVICE_IDENTITY_VERSION = 1 as const;
export const LOCAL_WHISPER_DEVICE_IDENTITY_SALT_BYTES = 32;

interface LocalWhisperDeviceIdentityDocument {
  readonly schemaVersion: typeof LOCAL_WHISPER_DEVICE_IDENTITY_SCHEMA_VERSION;
  readonly identityVersion: typeof LOCAL_WHISPER_DEVICE_IDENTITY_VERSION;
  readonly saltBase64Url: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeDocument(value: unknown): LocalWhisperDeviceIdentityDocument | null {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 3 ||
    value.schemaVersion !== LOCAL_WHISPER_DEVICE_IDENTITY_SCHEMA_VERSION ||
    value.identityVersion !== LOCAL_WHISPER_DEVICE_IDENTITY_VERSION ||
    typeof value.saltBase64Url !== 'string'
  ) {
    return null;
  }
  const salt = Buffer.from(value.saltBase64Url, 'base64url');
  if (
    salt.byteLength !== LOCAL_WHISPER_DEVICE_IDENTITY_SALT_BYTES ||
    salt.toString('base64url') !== value.saltBase64Url
  ) {
    return null;
  }
  return Object.freeze({
    schemaVersion: LOCAL_WHISPER_DEVICE_IDENTITY_SCHEMA_VERSION,
    identityVersion: LOCAL_WHISPER_DEVICE_IDENTITY_VERSION,
    saltBase64Url: value.saltBase64Url,
  });
}

function deriveOpaqueDigest(salt: Uint8Array, canonicalIdentity: string): string {
  return createHmac('sha256', salt)
    .update(`local-whisper-device-v${LOCAL_WHISPER_DEVICE_IDENTITY_VERSION}\0`, 'utf8')
    .update(canonicalIdentity, 'utf8')
    .digest('hex');
}

/** Derives stable per-install opaque IDs from private canonical physical identities. */
export class LocalWhisperDeviceIdentityRepository {
  private document: LocalWhisperDeviceIdentityDocument | null = null;
  private readonly projectedIdentities = new Map<string, string>();

  public constructor(
    private readonly store: LocalWhisperDeviceIdentityStore,
    private readonly randomBytes: (size: number) => Uint8Array,
    private readonly deriveDigest: (salt: Uint8Array, canonicalIdentity: string) => string = deriveOpaqueDigest,
  ) {}

  public getOpaqueId(canonicalIdentity: string): LocalWhisperOpaqueDeviceId {
    const opaqueId = this.projectOpaqueIds([canonicalIdentity])[0];
    if (!opaqueId) throw new Error('Local Whisper opaque device identity generation failed');
    return opaqueId;
  }

  public projectOpaqueIds(canonicalIdentities: readonly string[]): readonly LocalWhisperOpaqueDeviceId[] {
    const document = this.getDocument();
    const salt = Buffer.from(document.saltBase64Url, 'base64url');
    const identities = new Map(this.projectedIdentities);
    const projected = canonicalIdentities.map((canonicalIdentity) => {
      if (
        canonicalIdentity.length === 0 ||
        canonicalIdentity.length > 1_024 ||
        hasLocalWhisperControlCharacter(canonicalIdentity)
      ) {
        throw new Error('Invalid Local Whisper canonical device identity');
      }
      const digest = this.deriveDigest(salt, canonicalIdentity);
      if (!/^[a-f0-9]{64}$/u.test(digest)) throw new Error('Local Whisper opaque device identity generation failed');
      const opaqueId = toLocalWhisperOpaqueDeviceId(`device-v${LOCAL_WHISPER_DEVICE_IDENTITY_VERSION}-${digest}`);
      if (!opaqueId) throw new Error('Local Whisper opaque device identity generation failed');
      const priorIdentity = identities.get(opaqueId);
      if (priorIdentity !== undefined && priorIdentity !== canonicalIdentity) {
        throw new Error('Local Whisper opaque device identity collision');
      }
      identities.set(opaqueId, canonicalIdentity);
      return opaqueId;
    });
    for (const [opaqueId, canonicalIdentity] of identities) {
      this.projectedIdentities.set(opaqueId, canonicalIdentity);
    }
    return Object.freeze(projected);
  }

  public reset(): boolean {
    this.document = null;
    this.projectedIdentities.clear();
    return this.store.remove();
  }

  private getDocument(): LocalWhisperDeviceIdentityDocument {
    if (this.document) return this.document;
    const read = this.store.read();
    if (read.status === 'ok') {
      const existing = decodeDocument(read.value);
      if (!existing) throw new Error('Local Whisper device identity unavailable');
      this.document = existing;
      return existing;
    }
    if (read.status === 'malformed') throw new Error('Local Whisper device identity unavailable');
    const entropy = this.randomBytes(LOCAL_WHISPER_DEVICE_IDENTITY_SALT_BYTES);
    if (entropy.byteLength !== LOCAL_WHISPER_DEVICE_IDENTITY_SALT_BYTES) {
      throw new Error('Local Whisper device identity entropy unavailable');
    }
    const created = Object.freeze({
      schemaVersion: LOCAL_WHISPER_DEVICE_IDENTITY_SCHEMA_VERSION,
      identityVersion: LOCAL_WHISPER_DEVICE_IDENTITY_VERSION,
      saltBase64Url: Buffer.from(entropy).toString('base64url'),
    });
    this.store.write(created);
    this.document = created;
    return created;
  }
}
