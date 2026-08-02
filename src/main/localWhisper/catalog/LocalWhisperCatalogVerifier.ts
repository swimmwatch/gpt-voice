import { createPublicKey, verify } from 'node:crypto';
import { TextDecoder } from 'node:util';

import {
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
  type LocalWhisperArtifactId,
} from '@shared/localWhisper';

import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
  type LocalWhisperCatalogPublicKey,
} from './LocalWhisperCatalogTypes';

const ENVELOPE_KEYS = ['schemaVersion', 'algorithm', 'keyId', 'payloadBase64', 'signatureBase64'] as const;
const MAX_CATALOG_DOCUMENT_BYTES = 12 * 1024 * 1024;
const MAX_CATALOG_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_CATALOG_SIGNATURE_BYTES = 128;

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

function hasUniqueTopLevelKeys(documentText: string): boolean {
  const keys = new Set<string>();
  let depth = 0;
  let expectingKey = false;
  let inString = false;
  let escaped = false;
  let stringStart = -1;

  for (let index = 0; index < documentText.length; index += 1) {
    const character = documentText[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character !== '"') continue;
      inString = false;
      if (depth !== 1 || !expectingKey) continue;
      try {
        const key = JSON.parse(documentText.slice(stringStart, index + 1)) as unknown;
        if (typeof key !== 'string' || keys.has(key)) return false;
        keys.add(key);
        expectingKey = false;
      } catch {
        return false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      stringStart = index;
    } else if (character === '{') {
      depth += 1;
      if (depth === 1) expectingKey = true;
    } else if (character === '}') {
      depth -= 1;
      if (depth < 0) return false;
    } else if (character === ',' && depth === 1) {
      expectingKey = true;
    }
  }
  return depth === 0 && !inString;
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
    if (documentBytes.byteLength === 0 || documentBytes.byteLength > MAX_CATALOG_DOCUMENT_BYTES) {
      return { success: false, code: 'CATALOG_INVALID' };
    }
    let envelope: unknown;
    try {
      const documentText = this.decoder.decode(documentBytes);
      if (!hasUniqueTopLevelKeys(documentText)) return { success: false, code: 'CATALOG_INVALID' };
      envelope = JSON.parse(documentText) as unknown;
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
      payloadBytes.byteLength > MAX_CATALOG_PAYLOAD_BYTES ||
      !signature ||
      signature.byteLength > MAX_CATALOG_SIGNATURE_BYTES
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
