import type { LocalWhisperArtifactId, LocalWhisperFailureCode } from '@shared/localWhisper';

import {
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogModelEntry,
  type LocalWhisperCatalogRuntimeEntry,
} from '../catalog/LocalWhisperCatalogTypes';
import {
  createManagedModelDescriptor,
  createManagedRuntimeDescriptor,
  type ManagedArtifactDescriptor,
} from '../filesystem/ManagedArtifactStore';
import { LocalWhisperArtifactLifecycleError, type LocalWhisperArtifactDownloadSpec } from './ArtifactLifecycleTypes';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function checkedOrigin(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.pathname !== '/' ||
    parsed.origin !== value
  ) {
    throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
  }
  return parsed;
}

function safeExpandedSize(files: readonly { readonly sizeBytes: number }[]): number {
  const total = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (!Number.isSafeInteger(total) || total <= 0) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  return total;
}

function requestUrl(origin: URL, artifactId: LocalWhisperArtifactId): string {
  return new URL(`artifacts/${encodeURIComponent(artifactId)}`, `${origin.origin}/`).toString();
}

function validateTransferIdentity(sizeBytes: number, sha256: string): void {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || !SHA256_PATTERN.test(sha256)) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
}

export interface ArtifactCatalogResolverDependencies {
  readonly getCatalog: () => LocalWhisperAuthenticatedCatalog;
}

/** Resolves renderer-safe artifact IDs into authenticated, main-owned transfer authority. */
export class ArtifactCatalogResolver {
  public constructor(private readonly dependencies: ArtifactCatalogResolverDependencies) {}

  public getCatalog(): LocalWhisperAuthenticatedCatalog {
    return this.dependencies.getCatalog();
  }

  public resolve(artifactId: LocalWhisperArtifactId): LocalWhisperArtifactDownloadSpec {
    const catalog = this.dependencies.getCatalog();
    for (const entry of catalog.payload.runtimes) {
      const descriptor = createManagedRuntimeDescriptor(catalog, entry);
      if (descriptor.artifactId === artifactId) return this.resolveRuntime(catalog, descriptor, entry);
    }
    for (const entry of catalog.payload.models) {
      const descriptor = createManagedModelDescriptor(catalog, entry);
      if (descriptor.artifactId === artifactId) return this.resolveModel(catalog, descriptor, entry);
    }
    throw new LocalWhisperArtifactLifecycleError('INVALID_SETTINGS');
  }

  private origin(catalog: LocalWhisperAuthenticatedCatalog, originId: LocalWhisperArtifactId): URL {
    const value = catalog.payload.origins.find((candidate) => candidate.id === originId)?.origin;
    if (!value) throw new LocalWhisperArtifactLifecycleError('UNSAFE_REDIRECT');
    return checkedOrigin(value);
  }

  private resolveRuntime(
    catalog: LocalWhisperAuthenticatedCatalog,
    descriptor: ManagedArtifactDescriptor,
    entry: LocalWhisperCatalogRuntimeEntry,
  ): LocalWhisperArtifactDownloadSpec {
    const identity = entry.identity;
    this.assertAvailable(
      catalog.isRuntimeDenylisted(descriptor.identityKey),
      entry.qualificationStatus,
      'RUNTIME_BLOCKED',
      'RUNTIME_INCOMPATIBLE',
    );
    validateTransferIdentity(identity.archiveSizeBytes, identity.archiveSha256);
    const origin = this.origin(catalog, identity.originId);
    return Object.freeze({
      artifactId: descriptor.artifactId,
      catalogRevision: catalog.payload.catalogRevision,
      descriptor,
      expandedSizeBytes: safeExpandedSize(identity.expectedFiles),
      expectedFiles: Object.freeze([...identity.expectedFiles]),
      expectedTransferSha256: identity.archiveSha256,
      expectedTransferSizeBytes: identity.archiveSizeBytes,
      originId: identity.originId,
      origin: origin.origin,
      requestUrl: requestUrl(origin, descriptor.artifactId),
      artifactSignature: Object.freeze({
        keyId: identity.signingKeyId,
        signatureBase64: identity.archiveSignature,
      }),
    });
  }

  private resolveModel(
    catalog: LocalWhisperAuthenticatedCatalog,
    descriptor: ManagedArtifactDescriptor,
    entry: LocalWhisperCatalogModelEntry,
  ): LocalWhisperArtifactDownloadSpec {
    this.assertAvailable(
      catalog.isModelDenylisted(descriptor.identityKey),
      entry.qualificationStatus,
      'MODEL_BLOCKED',
      'MODEL_INCOMPATIBLE',
    );
    validateTransferIdentity(entry.transferSizeBytes, entry.transferSha256);
    const origin = this.origin(catalog, entry.originId);
    return Object.freeze({
      artifactId: descriptor.artifactId,
      catalogRevision: catalog.payload.catalogRevision,
      descriptor,
      expandedSizeBytes: safeExpandedSize(entry.expectedFiles),
      expectedFiles: Object.freeze([...entry.expectedFiles]),
      expectedTransferSha256: entry.transferSha256,
      expectedTransferSizeBytes: entry.transferSizeBytes,
      originId: entry.originId,
      origin: origin.origin,
      requestUrl: requestUrl(origin, descriptor.artifactId),
      artifactSignature: Object.freeze({
        keyId: entry.signingKeyId,
        signatureBase64: entry.transferSignature,
      }),
    });
  }

  private assertAvailable(
    blocked: boolean,
    qualificationStatus: 'qualified' | 'estimateOnly' | 'planned',
    blockedCode: LocalWhisperFailureCode,
    incompatibleCode: LocalWhisperFailureCode,
  ): void {
    if (blocked) throw new LocalWhisperArtifactLifecycleError(blockedCode);
    if (qualificationStatus === 'planned') throw new LocalWhisperArtifactLifecycleError(incompatibleCode);
  }
}
