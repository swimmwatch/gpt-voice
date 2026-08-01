import { createPublicKey, verify } from 'node:crypto';
import { TextDecoder } from 'node:util';

import { toLocalWhisperArtifactId, type LocalWhisperArtifactId } from '@shared/localWhisper';

import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
  type LocalWhisperCatalogPublicKey,
} from './LocalWhisperCatalogTypes';

const ENVELOPE_KEYS = ['schemaVersion', 'algorithm', 'keyId', 'payloadBase64', 'signatureBase64'] as const;

export type LocalWhisperCatalogVerificationResult =
  | { readonly success: true; readonly keyId: LocalWhisperArtifactId; readonly payload: unknown }
  | { readonly success: false; readonly code: 'SIGNATURE_INVALID' | 'CATALOG_INVALID' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function decodeBase64(value: unknown): Buffer | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.toString('base64') === value ? decoded : null;
}

function hasValidUnicodeScalars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Produces the one deterministic JSON representation accepted for signed payload bytes. */
export function serializeCanonicalLocalWhisperCatalogJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (!hasValidUnicodeScalars(value)) throw new TypeError('Invalid catalog value');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError('Invalid catalog value');
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeCanonicalLocalWhisperCatalogJson(entry)).join(',')}]`;
  }
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map(
        (key) =>
          `${serializeCanonicalLocalWhisperCatalogJson(key)}:${serializeCanonicalLocalWhisperCatalogJson(value[key])}`,
      );
    return `{${entries.join(',')}}`;
  }
  throw new TypeError('Invalid catalog value');
}

/** Authenticates exact canonical payload bytes before parsing any catalog field. */
export class LocalWhisperCatalogVerifier {
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private readonly publicKeyById: ReadonlyMap<LocalWhisperArtifactId, string>;
  private readonly keyRingValid: boolean;

  public constructor(publicKeys: readonly LocalWhisperCatalogPublicKey[]) {
    const publicKeyById = new Map<LocalWhisperArtifactId, string>();
    let keyRingValid = true;
    for (const entry of publicKeys) {
      const keyId = toLocalWhisperArtifactId(entry.keyId);
      if (!keyId || typeof entry.publicKeyPem !== 'string' || publicKeyById.has(keyId)) {
        keyRingValid = false;
        continue;
      }
      try {
        const key = createPublicKey(entry.publicKeyPem);
        if (key.asymmetricKeyType !== 'ed25519') {
          keyRingValid = false;
          continue;
        }
      } catch {
        keyRingValid = false;
        continue;
      }
      publicKeyById.set(keyId, entry.publicKeyPem);
    }
    this.publicKeyById = publicKeyById;
    this.keyRingValid = keyRingValid;
  }

  public verify(documentBytes: Uint8Array): LocalWhisperCatalogVerificationResult {
    if (!this.keyRingValid) return { success: false, code: 'CATALOG_INVALID' };
    let envelope: unknown;
    try {
      envelope = JSON.parse(this.decoder.decode(documentBytes)) as unknown;
    } catch {
      return { success: false, code: 'CATALOG_INVALID' };
    }
    if (!isRecord(envelope) || !hasExactKeys(envelope, ENVELOPE_KEYS)) {
      return { success: false, code: 'CATALOG_INVALID' };
    }
    const keyId = toLocalWhisperArtifactId(envelope.keyId);
    const payloadBytes = decodeBase64(envelope.payloadBase64);
    const signature = decodeBase64(envelope.signatureBase64);
    if (
      envelope.schemaVersion !== LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION ||
      envelope.algorithm !== LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM ||
      !keyId ||
      !payloadBytes ||
      !signature
    ) {
      return { success: false, code: 'CATALOG_INVALID' };
    }
    const publicKeyPem = this.publicKeyById.get(keyId);
    if (!publicKeyPem) return { success: false, code: 'SIGNATURE_INVALID' };

    try {
      if (!verify(null, payloadBytes, createPublicKey(publicKeyPem), signature)) {
        return { success: false, code: 'SIGNATURE_INVALID' };
      }
    } catch {
      return { success: false, code: 'SIGNATURE_INVALID' };
    }

    try {
      const payloadText = this.decoder.decode(payloadBytes);
      const payload = JSON.parse(payloadText) as unknown;
      if (serializeCanonicalLocalWhisperCatalogJson(payload) !== payloadText) {
        return { success: false, code: 'CATALOG_INVALID' };
      }
      return { success: true, keyId, payload };
    } catch {
      return { success: false, code: 'CATALOG_INVALID' };
    }
  }
}
