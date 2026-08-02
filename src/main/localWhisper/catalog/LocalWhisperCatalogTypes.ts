import type {
  LocalWhisperArtifactId,
  LocalWhisperLanguageCatalogEntry,
  LocalWhisperMemoryEstimateRecord,
  LocalWhisperModelIdentity,
  LocalWhisperModelFamily,
  LocalWhisperQualifiedMemoryPeak,
  LocalWhisperRevisionId,
  LocalWhisperRuntimeIdentity,
} from '@shared/localWhisper';

export const LOCAL_WHISPER_CATALOG_SCHEMA_VERSION = 1 as const;
export const LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION = 1 as const;
export const LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM = 'Ed25519' as const;
export const LOCAL_WHISPER_CATALOG_PURPOSES = ['fixture', 'production'] as const;

export type LocalWhisperCatalogPurpose = (typeof LOCAL_WHISPER_CATALOG_PURPOSES)[number];

export interface LocalWhisperCatalogOrigin {
  readonly id: LocalWhisperArtifactId;
  readonly origin: string;
}

export interface LocalWhisperCatalogDisplayMetadata {
  readonly title: string;
  readonly summary: string;
}

export interface LocalWhisperCatalogModelFileIdentity {
  readonly fileId: LocalWhisperArtifactId;
  readonly kind: 'data' | 'config' | 'tokenizer' | 'notice';
  readonly mode: number;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface LocalWhisperCatalogRuntimeEntry {
  readonly identity: LocalWhisperRuntimeIdentity;
  readonly recommended: boolean;
  readonly qualificationStatus: 'qualified' | 'estimateOnly' | 'planned';
  readonly licenseIds: readonly LocalWhisperArtifactId[];
}

export interface LocalWhisperCatalogModelEntry {
  readonly identity: LocalWhisperModelIdentity;
  readonly originId: LocalWhisperArtifactId;
  readonly expectedFiles: readonly LocalWhisperCatalogModelFileIdentity[];
  readonly transferSizeBytes: number;
  readonly transferSha256: string;
  readonly transferSignature: string;
  readonly signingKeyId: LocalWhisperArtifactId;
  readonly installedSizeBytes: number;
  readonly compatibleRuntimePackRevisions: readonly LocalWhisperRevisionId[];
  readonly recommended: boolean;
  readonly qualificationStatus: 'qualified' | 'estimateOnly' | 'planned';
  readonly provenanceId: LocalWhisperArtifactId;
  readonly licenseIds: readonly LocalWhisperArtifactId[];
  readonly noticeIds: readonly LocalWhisperArtifactId[];
}

export interface LocalWhisperCatalogDenylist {
  readonly runtimes: readonly LocalWhisperRuntimeIdentity[];
  readonly models: readonly LocalWhisperModelIdentity[];
}

export interface LocalWhisperCatalogPayload {
  readonly schemaVersion: typeof LOCAL_WHISPER_CATALOG_SCHEMA_VERSION;
  readonly purpose: LocalWhisperCatalogPurpose;
  readonly catalogRevision: LocalWhisperRevisionId;
  readonly displayMetadata: LocalWhisperCatalogDisplayMetadata;
  readonly compatibleAppRevisions: readonly LocalWhisperRevisionId[];
  readonly workerProtocolVersion: number;
  readonly languageCatalogRevision: string;
  readonly languages: readonly LocalWhisperLanguageCatalogEntry[];
  readonly modelFamilies: readonly LocalWhisperModelFamily[];
  readonly origins: readonly LocalWhisperCatalogOrigin[];
  readonly runtimes: readonly LocalWhisperCatalogRuntimeEntry[];
  readonly models: readonly LocalWhisperCatalogModelEntry[];
  readonly memoryEstimates: readonly LocalWhisperMemoryEstimateRecord[];
  readonly qualifiedMemoryPeaks: readonly LocalWhisperQualifiedMemoryPeak[];
  readonly denylist: LocalWhisperCatalogDenylist;
}

export interface LocalWhisperSignedCatalogEnvelope {
  readonly schemaVersion: typeof LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION;
  readonly algorithm: typeof LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM;
  readonly keyId: LocalWhisperArtifactId;
  readonly payloadBase64: string;
  readonly signatureBase64: string;
}

export interface LocalWhisperCatalogPublicKey {
  readonly keyId: LocalWhisperArtifactId;
  readonly publicKeyPem: string;
}

export interface LocalWhisperCatalogAllowlistedOrigin {
  readonly id: LocalWhisperArtifactId;
  readonly origin: string;
}

export interface LocalWhisperCatalogTrustPolicy {
  readonly purpose: LocalWhisperCatalogPurpose;
  readonly publicKeys: readonly LocalWhisperCatalogPublicKey[];
  readonly origins: readonly LocalWhisperCatalogAllowlistedOrigin[];
  readonly appRevision: LocalWhisperRevisionId;
  readonly workerProtocolVersion: number;
}

export interface LocalWhisperAuthenticatedCatalog {
  readonly signingKeyId: LocalWhisperArtifactId;
  readonly payload: LocalWhisperCatalogPayload;
  readonly isRuntimeDenylisted: (identityKey: string) => boolean;
  readonly isModelDenylisted: (identityKey: string) => boolean;
}

export type LocalWhisperCatalogLoadResult =
  | { readonly success: true; readonly catalog: LocalWhisperAuthenticatedCatalog }
  | { readonly success: false; readonly code: 'SIGNATURE_INVALID' | 'CATALOG_INVALID' | 'CATALOG_UNAVAILABLE' };

export function getLocalWhisperRuntimeIdentityKey(identity: LocalWhisperRuntimeIdentity): string {
  return [
    identity.engine,
    identity.platform,
    identity.architecture,
    identity.target,
    identity.backend,
    identity.dependencyFamily,
    identity.upstreamRevision,
    identity.buildRevision,
    identity.computeTargets.join(','),
    identity.protocolVersion,
    identity.packRevision,
    identity.catalogRevision,
    identity.appRevision,
    identity.signingKeyId,
    identity.archiveSizeBytes,
    identity.archiveSha256,
    identity.archiveSignature,
    identity.originId,
    identity.expectedFiles
      .map((file) => `${file.fileId}:${file.kind}:${file.mode}:${file.sizeBytes}:${file.sha256}`)
      .join(','),
    identity.prerequisites.join(','),
    identity.provenanceId,
    identity.sbomRevision,
    identity.noticeIds.join(','),
  ].join('|');
}

export function getLocalWhisperModelIdentityKey(identity: LocalWhisperModelIdentity): string {
  return [
    identity.engine,
    identity.logicalModel,
    identity.sourceCheckpointRevision,
    identity.artifactRevision,
    identity.nativeFormat,
    identity.variant,
  ].join('|');
}
