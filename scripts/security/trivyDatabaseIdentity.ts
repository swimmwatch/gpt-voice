import { createHash } from 'node:crypto';

export const MAXIMUM_TRIVY_DATABASE_PAYLOAD_BYTES = 2 * 1024 * 1024 * 1024;

interface TrivyDatabaseFileIdentity {
  readonly sha256: string;
  readonly size: number;
}

function verifiedFileIdentity(value: TrivyDatabaseFileIdentity): TrivyDatabaseFileIdentity {
  if (!/^[a-f\d]{64}$/u.test(value.sha256) || !Number.isSafeInteger(value.size) || value.size < 1) {
    throw new Error('Trivy database identity is malformed');
  }
  return value;
}

/** Binds evidence to both Trivy metadata and the database payload consumed by the scanner. */
export function trivyDatabaseIdentity(metadata: TrivyDatabaseFileIdentity, payload: TrivyDatabaseFileIdentity): string {
  const verifiedMetadata = verifiedFileIdentity(metadata);
  const verifiedPayload = verifiedFileIdentity(payload);
  const manifest = [
    { path: 'db/metadata.json', sha256: verifiedMetadata.sha256, size: verifiedMetadata.size },
    { path: 'db/trivy.db', sha256: verifiedPayload.sha256, size: verifiedPayload.size },
  ];
  return createHash('sha256').update(JSON.stringify(manifest), 'utf8').digest('hex');
}
