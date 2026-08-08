import { toLocalWhisperRevisionId } from '@shared/localWhisper';

import type { LocalWhisperCatalogTrustPolicy } from './LocalWhisperCatalogTypes';

/**
 * Production publication is intentionally deferred. This immutable sentinel is
 * shipped so startup fails closed until a separately reviewed production key,
 * origin allowlist, and signed catalog are authorized.
 */
export const PACKAGED_LOCAL_WHISPER_CATALOG_DOCUMENT = Buffer.from(
  '{"mode":"disabled","publicationState":"disabled-deferred-publication","schemaVersion":1}',
  'utf8',
);

export const PACKAGED_LOCAL_WHISPER_CATALOG_PUBLIC_KEYS = Object.freeze([]);
export const PACKAGED_LOCAL_WHISPER_CATALOG_ORIGINS = Object.freeze([]);

export function createPackagedLocalWhisperCatalogTrustPolicy(
  appRevision: string,
  workerProtocolVersion: number,
): LocalWhisperCatalogTrustPolicy | null {
  const revision = toLocalWhisperRevisionId(appRevision);
  if (!revision || !Number.isSafeInteger(workerProtocolVersion) || workerProtocolVersion <= 0) return null;
  return Object.freeze({
    purpose: 'production',
    publicKeys: PACKAGED_LOCAL_WHISPER_CATALOG_PUBLIC_KEYS,
    origins: PACKAGED_LOCAL_WHISPER_CATALOG_ORIGINS,
    appRevision: revision,
    workerProtocolVersion,
  });
}
