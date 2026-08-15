import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { toLocalWhisperArtifactId, type LocalWhisperArtifactId, type LocalWhisperPlatform } from '@shared/localWhisper';

import {
  getLocalWhisperModelIdentityKey,
  getLocalWhisperRuntimeIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogModelEntry,
  type LocalWhisperCatalogModelFileIdentity,
  type LocalWhisperCatalogRuntimeEntry,
} from '../catalog/LocalWhisperCatalogTypes';
import type {
  LocalWhisperManagedArtifactEvidence,
  LocalWhisperManagedFileEvidence,
  LocalWhisperManagedStorageEvidencePort,
} from '../inventory/LocalWhisperInventoryRepository';
import { ManagedArtifactEvidenceSnapshot, type ManagedArtifactEvidenceRecord } from './ManagedArtifactEvidenceSnapshot';
import {
  ManagedArtifactLease,
  type ManagedArtifactIdentitySnapshot,
  type ManagedArtifactKind,
  type ManagedArtifactLeasePurpose,
} from './ManagedArtifactLease';
import { ManagedArtifactLockRepository, type ManagedArtifactLockLease } from './ManagedArtifactLockRepository';
import type { ManagedArtifactRootResolution } from './ManagedArtifactPathResolver';
import type { ManagedArtifactRemovalClearance } from './ManagedArtifactRemovalClearance';
import { ManagedArtifactStoreError, type ManagedArtifactStoreErrorCode } from './ManagedArtifactStoreError';
import {
  ManagedFilesystemAdapterError,
  type ManagedArtifactNamespace,
  type ManagedFilesystemDirectoryEntry,
  type ManagedFilesystemOpenResult,
  type ManagedFilesystemPlatformAdapter,
} from './ManagedFilesystemPlatformAdapter';

export { ManagedArtifactRemovalClearance } from './ManagedArtifactRemovalClearance';
export { ManagedArtifactRemovalClearanceIssuer } from './ManagedArtifactRemovalClearanceIssuer';
export { ManagedArtifactStoreError } from './ManagedArtifactStoreError';
export type { ManagedArtifactStoreErrorCode } from './ManagedArtifactStoreError';

const CANONICAL_ARTIFACT_NAME_PATTERN = /^(?:model|runtime)-[a-f0-9]{64}$/;
const CANONICAL_FILE_NAME_PATTERN = /^file-[\w-]{1,192}$/;
const LINUX_RUNTIME_LIBRARY_ROLE_PATTERN = /^runtime-(cublas-lt|cublas|cuda-runtime)-(\d+)\.\d+\.\d+$/u;
const WINDOWS_CUDA_LIBRARY_ROLE_PATTERN = /^runtime-(cublas-lt|cublas|cuda-runtime)-(\d+)\.\d+\.\d+$/u;
const WINDOWS_VC_RUNTIME_LIBRARY_ROLE_PATTERN =
  /^runtime-microsoft-vc-runtime-\d+\.\d+\.\d+\.\d+-(msvcp140|msvcp140-atomic-wait|vcruntime140|vcruntime140-1)$/u;
const OPERATION_NONCE_PATTERN = /^[\w-]{16,128}$/;
const MANAGED_MANIFEST_NAME = 'managed-manifest-v1';
const MANAGED_MANIFEST_MODE = 0o600;

export type ManagedArtifactExpectedFile =
  LocalWhisperCatalogModelFileIdentity | LocalWhisperCatalogRuntimeEntry['identity']['expectedFiles'][number];

export interface ManagedArtifactDescriptor {
  readonly artifactId: LocalWhisperArtifactId;
  readonly canonicalName: string;
  readonly catalogDigest: string;
  readonly expectedFiles: readonly ManagedArtifactExpectedFile[];
  readonly identityKey: string;
  readonly kind: ManagedArtifactKind;
  readonly namespace: ManagedArtifactNamespace;
  readonly runtimePlatform?: LocalWhisperPlatform;
}

export interface ManagedArtifactStoreDependencies {
  readonly adapter: ManagedFilesystemPlatformAdapter;
  readonly generateOperationNonce: () => string;
  readonly lockRepository: ManagedArtifactLockRepository;
  readonly rootResolution: ManagedArtifactRootResolution;
}

export interface ManagedRuntimeLaunchLease {
  readonly runtimeLease: ManagedArtifactLease;
  readonly workerExecutablePath: string;
  readonly workerFileIdentity: ManagedArtifactIdentitySnapshot;
  readonly workerFileSha256: string;
  readonly workingDirectoryPath: string;
  readonly revalidate: () => Promise<void>;
}

export interface ManagedModelLaunchLease {
  readonly modelLease: ManagedArtifactLease;
  readonly modelLeaseTokenDigest: string;
  readonly modelFilePath: string;
  readonly modelFileIdentity: ManagedArtifactIdentitySnapshot;
  readonly modelFileSha256: string;
  readonly modelFileSizeBytes: number;
  readonly revalidate: () => Promise<void>;
}

interface LeaseAuthority {
  readonly descriptor: ManagedArtifactDescriptor;
  readonly lock: ManagedArtifactLockLease | null;
}

interface InstalledArtifactAcquisition {
  readonly entries: ReadonlyMap<LocalWhisperArtifactId, ManagedFilesystemDirectoryEntry>;
  readonly lease: ManagedArtifactLease;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function descriptorCatalogDigest(identityKey: string, expectedFiles: readonly ManagedArtifactExpectedFile[]): string {
  return sha256(
    JSON.stringify({
      expectedFiles: expectedFiles.map(({ fileId, kind, mode, sha256: digest, sizeBytes }) => ({
        fileId,
        kind,
        mode,
        sha256: digest,
        sizeBytes,
      })),
      identityKey,
    }),
  );
}

function managedManifestBytes(descriptor: ManagedArtifactDescriptor): Buffer {
  return Buffer.from(
    JSON.stringify({
      canonicalName: descriptor.canonicalName,
      catalogDigest: descriptor.catalogDigest,
      expectedFiles: descriptor.expectedFiles.map(({ fileId, kind, mode, sha256: digest, sizeBytes }) => ({
        fileId,
        kind,
        mode,
        sha256: digest,
        sizeBytes,
      })),
      identityKey: descriptor.identityKey,
      kind: descriptor.kind,
      schemaVersion: 1,
    }),
    'utf8',
  );
}

function canonicalArtifactName(kind: ManagedArtifactKind, identityKey: string): string {
  const value = `${kind}-${sha256(identityKey)}`;
  if (!CANONICAL_ARTIFACT_NAME_PATTERN.test(value)) throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  return value;
}

export function getManagedArtifactFileName(fileId: LocalWhisperArtifactId): string {
  const encoded = Buffer.from(fileId, 'utf8').toString('base64url');
  const value = `file-${encoded}`;
  if (
    !CANONICAL_FILE_NAME_PATTERN.test(value) ||
    Buffer.from(encoded, 'base64url').toString('utf8') !== fileId ||
    Buffer.from(Buffer.from(encoded, 'base64url')).toString('base64url') !== encoded
  ) {
    throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  }
  return value;
}

function linuxRuntimeStorageFileName(expected: ManagedArtifactExpectedFile): string | null {
  if (expected.kind === 'executable' && expected.fileId === 'worker') return 'worker';
  if (expected.kind !== 'library') return null;
  const match = LINUX_RUNTIME_LIBRARY_ROLE_PATTERN.exec(expected.fileId);
  if (!match) return null;
  const [, family, major] = match;
  if (!family || !major) throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  const library = family === 'cublas-lt' ? 'cublasLt' : family === 'cuda-runtime' ? 'cudart' : family;
  return `lib${library}.so.${major}`;
}

function windowsRuntimeStorageFileName(expected: ManagedArtifactExpectedFile): string | null {
  if (expected.kind === 'executable' && expected.fileId === 'worker') return 'worker.exe';
  if (expected.kind !== 'library') return null;
  const vcRuntime = WINDOWS_VC_RUNTIME_LIBRARY_ROLE_PATTERN.exec(expected.fileId)?.[1];
  if (vcRuntime) {
    const library =
      vcRuntime === 'vcruntime140-1'
        ? 'vcruntime140_1'
        : vcRuntime === 'msvcp140-atomic-wait'
          ? 'msvcp140_atomic_wait'
          : vcRuntime;
    return `${library}.dll`;
  }
  const cudaRuntime = WINDOWS_CUDA_LIBRARY_ROLE_PATTERN.exec(expected.fileId);
  if (!cudaRuntime) return null;
  const [, family, major] = cudaRuntime;
  if (!family || !major) throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  const library = family === 'cublas-lt' ? 'cublasLt' : family === 'cuda-runtime' ? 'cudart' : family;
  return `${library}64_${major}.dll`;
}

function descriptorFileName(descriptor: ManagedArtifactDescriptor, expected: ManagedArtifactExpectedFile): string {
  if (descriptor.kind === 'runtime') {
    const launchFileName =
      descriptor.runtimePlatform === 'linux'
        ? linuxRuntimeStorageFileName(expected)
        : descriptor.runtimePlatform === 'win32'
          ? windowsRuntimeStorageFileName(expected)
          : null;
    if (launchFileName) return launchFileName;
  }
  return getManagedArtifactFileName(expected.fileId);
}

function artifactIdFromCanonicalName(value: string): LocalWhisperArtifactId {
  const artifactId = toLocalWhisperArtifactId(value);
  if (!artifactId) throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  return artifactId;
}

function freezeDescriptor(input: Omit<ManagedArtifactDescriptor, 'artifactId'>): ManagedArtifactDescriptor {
  return Object.freeze({ ...input, artifactId: artifactIdFromCanonicalName(input.canonicalName) });
}

export function createManagedRuntimeDescriptor(
  catalog: LocalWhisperAuthenticatedCatalog,
  entry: LocalWhisperCatalogRuntimeEntry,
): ManagedArtifactDescriptor {
  if (!catalog.payload.runtimes.includes(entry)) throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  const identityKey = getLocalWhisperRuntimeIdentityKey(entry.identity);
  const name = canonicalArtifactName('runtime', identityKey);
  const expectedFiles = Object.freeze([...entry.identity.expectedFiles]);
  return freezeDescriptor({
    canonicalName: name,
    catalogDigest: descriptorCatalogDigest(identityKey, expectedFiles),
    expectedFiles,
    identityKey,
    kind: 'runtime',
    namespace: 'runtimes',
    runtimePlatform: entry.identity.platform,
  });
}

export function createManagedModelDescriptor(
  catalog: LocalWhisperAuthenticatedCatalog,
  entry: LocalWhisperCatalogModelEntry,
): ManagedArtifactDescriptor {
  if (!catalog.payload.models.includes(entry)) throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  const identityKey = getLocalWhisperModelIdentityKey(entry.identity);
  const name = canonicalArtifactName('model', identityKey);
  const expectedFiles = Object.freeze([...entry.expectedFiles]);
  return freezeDescriptor({
    canonicalName: name,
    catalogDigest: descriptorCatalogDigest(identityKey, expectedFiles),
    expectedFiles,
    identityKey,
    kind: 'model',
    namespace: 'models',
  });
}

function assertDescriptor(descriptor: ManagedArtifactDescriptor): void {
  if (
    canonicalArtifactName(descriptor.kind, descriptor.identityKey) !== descriptor.canonicalName ||
    artifactIdFromCanonicalName(descriptor.canonicalName) !== descriptor.artifactId ||
    descriptor.namespace !== (descriptor.kind === 'model' ? 'models' : 'runtimes') ||
    !/^[a-f0-9]{64}$/.test(descriptor.catalogDigest)
  ) {
    throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  }
  if (descriptor.kind === 'runtime' && descriptor.runtimePlatform === undefined) {
    throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  }
  const fileNames = descriptor.expectedFiles.map((expected) => descriptorFileName(descriptor, expected));
  if (new Set(fileNames).size !== fileNames.length) throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
}

function findExpectedFile(
  descriptor: ManagedArtifactDescriptor,
  fileId: LocalWhisperArtifactId,
): ManagedArtifactExpectedFile {
  const expected = descriptor.expectedFiles.find((candidate) => candidate.fileId === fileId);
  if (!expected) throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
  return expected;
}

export function getManagedArtifactStorageFileName(
  descriptor: ManagedArtifactDescriptor,
  fileId: LocalWhisperArtifactId,
): string {
  return descriptorFileName(descriptor, findExpectedFile(descriptor, fileId));
}

function validateDirectoryEntries(
  descriptor: ManagedArtifactDescriptor,
  entries: readonly ManagedFilesystemDirectoryEntry[],
): ReadonlyMap<LocalWhisperArtifactId, ManagedFilesystemDirectoryEntry> {
  if (entries.length !== descriptor.expectedFiles.length + 1) {
    throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
  }
  const entriesByName = new Map(entries.map((entry) => [entry.canonicalName, entry]));
  if (entriesByName.size !== entries.length) throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
  const manifest = entriesByName.get(MANAGED_MANIFEST_NAME);
  const manifestBytes = managedManifestBytes(descriptor);
  if (
    !manifest ||
    manifest.identity.type !== 'regular' ||
    manifest.identity.linkCount !== 1 ||
    manifest.identity.mode !== MANAGED_MANIFEST_MODE ||
    manifest.identity.sizeBytes !== manifestBytes.byteLength ||
    manifest.sha256 !== sha256(manifestBytes.toString('utf8'))
  ) {
    throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
  }
  const validated = new Map<LocalWhisperArtifactId, ManagedFilesystemDirectoryEntry>();
  for (const expected of descriptor.expectedFiles) {
    const entry = entriesByName.get(descriptorFileName(descriptor, expected));
    if (
      !entry ||
      entry.identity.type !== 'regular' ||
      entry.identity.linkCount !== 1 ||
      entry.identity.mode !== expected.mode ||
      entry.identity.sizeBytes !== expected.sizeBytes ||
      entry.sha256 !== expected.sha256
    ) {
      throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
    }
    validated.set(expected.fileId, entry);
  }
  return validated;
}

function expectedDirectoryEntries(descriptor: ManagedArtifactDescriptor) {
  return [
    Object.freeze({ canonicalName: MANAGED_MANIFEST_NAME, mode: MANAGED_MANIFEST_MODE }),
    ...descriptor.expectedFiles.map((expected) =>
      Object.freeze({ canonicalName: descriptorFileName(descriptor, expected), mode: expected.mode }),
    ),
  ];
}

function toManagedFileEvidence(
  expected: ManagedArtifactExpectedFile,
  entry: ManagedFilesystemDirectoryEntry,
): LocalWhisperManagedFileEvidence {
  return Object.freeze({
    fileId: expected.fileId,
    kind: expected.kind,
    mode: entry.identity.mode,
    sizeBytes: entry.identity.sizeBytes,
    sha256: entry.sha256 ?? '',
  });
}

function mapAdapterError(error: unknown, fallback: ManagedArtifactStoreErrorCode): ManagedArtifactStoreError {
  if (error instanceof ManagedArtifactStoreError) return error;
  if (error instanceof ManagedFilesystemAdapterError && error.code === 'CONFLICT') {
    return new ManagedArtifactStoreError('OPERATION_CONFLICT');
  }
  return new ManagedArtifactStoreError(fallback);
}

function corruptEvidence(descriptor: ManagedArtifactDescriptor): LocalWhisperManagedArtifactEvidence {
  return Object.freeze({
    kind: 'installed',
    manifestIdentityKey: descriptor.identityKey,
    manifestValid: false,
    files: Object.freeze([]),
  });
}

function sameIdentity(left: ManagedArtifactIdentitySnapshot, right: ManagedArtifactIdentitySnapshot): boolean {
  return (
    left.deviceOrVolumeId === right.deviceOrVolumeId &&
    left.fileId === right.fileId &&
    left.linkCount === right.linkCount &&
    left.mode === right.mode &&
    left.parentFileId === right.parentFileId &&
    left.sizeBytes === right.sizeBytes &&
    left.type === right.type
  );
}

function isUnsafeEvidenceError(error: unknown): boolean {
  return (
    error instanceof ManagedFilesystemAdapterError &&
    (error.code === 'IDENTITY_CHANGED' || error.code === 'UNSAFE_ENTRY')
  );
}

/**
 * Main-owned managed artifact authority. All path use is delegated to the
 * held-descriptor/handle adapter; this class never reopens an absolute path.
 */
export class ManagedArtifactStore {
  private readonly authorities = new WeakMap<ManagedArtifactLease, LeaseAuthority>();
  private root: ManagedFilesystemOpenResult | null = null;
  private readonly leaseOwner = Symbol('ManagedArtifactStoreLeaseOwner');

  public constructor(private readonly dependencies: ManagedArtifactStoreDependencies) {}

  public async initialize(): Promise<void> {
    if (this.root) return;
    if (this.dependencies.rootResolution.availability !== 'available') {
      throw new ManagedArtifactStoreError(
        this.dependencies.rootResolution.availability === 'planned' ? 'PLANNED_UNAVAILABLE' : 'UNSUPPORTED_PLATFORM',
      );
    }
    try {
      this.root = await this.dependencies.adapter.initialize(this.dependencies.rootResolution.managedRoot);
    } catch (error) {
      throw mapAdapterError(error, 'STORAGE_UNAVAILABLE');
    }
  }

  public async createStaging(descriptor: ManagedArtifactDescriptor): Promise<ManagedArtifactLease> {
    assertDescriptor(descriptor);
    const root = this.requireRoot();
    const lock = await this.acquireLock(descriptor, 'staging', 'INSTALL_FAILED');
    let native: ManagedFilesystemOpenResult | null = null;
    try {
      const nonce = this.generateNonce();
      native = await this.dependencies.adapter.createStagingDirectory(
        root.token,
        descriptor.kind,
        descriptor.canonicalName,
        nonce,
      );
      await this.writeManagedManifest(native.token, descriptor);
      return this.createLease(descriptor, native, 'staging', lock);
    } catch (error) {
      if (native) await this.dependencies.adapter.release(native.token).catch(() => undefined);
      await lock.release();
      throw mapAdapterError(error, 'INSTALL_FAILED');
    }
  }

  public async createStagedFile(
    stagingLease: ManagedArtifactLease,
    fileId: LocalWhisperArtifactId,
  ): Promise<ManagedArtifactLease> {
    const authority = this.requireAuthority(stagingLease, 'staging');
    const expected = findExpectedFile(authority.descriptor, fileId);
    try {
      const native = await this.dependencies.adapter.createStagedFile(
        this.token(stagingLease),
        descriptorFileName(authority.descriptor, expected),
        expected.mode,
      );
      return this.createLease(authority.descriptor, native, 'staging', null);
    } catch (error) {
      throw mapAdapterError(error, 'INSTALL_FAILED');
    }
  }

  public async appendStagedFile(
    fileLease: ManagedArtifactLease,
    chunk: Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    this.requireAuthority(fileLease, 'staging');
    if (chunk.byteLength === 0) return;
    try {
      await this.dependencies.adapter.appendStagedFile(this.token(fileLease), chunk, signal);
    } catch (error) {
      throw mapAdapterError(error, 'INSTALL_FAILED');
    }
  }

  public async sealStagedFile(fileLease: ManagedArtifactLease): Promise<ManagedArtifactIdentitySnapshot> {
    this.requireAuthority(fileLease, 'staging');
    try {
      return await this.dependencies.adapter.sealStagedFile(this.token(fileLease));
    } catch (error) {
      throw mapAdapterError(error, 'INSTALL_FAILED');
    } finally {
      await fileLease.release();
    }
  }

  public async promote(descriptor: ManagedArtifactDescriptor, stagingLease: ManagedArtifactLease): Promise<void> {
    assertDescriptor(descriptor);
    const authority = this.requireAuthority(stagingLease, 'staging');
    if (authority.descriptor.artifactId !== descriptor.artifactId || !authority.lock) {
      throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
    }
    try {
      const entries = await this.dependencies.adapter.inspectDirectory(
        this.token(stagingLease),
        expectedDirectoryEntries(descriptor),
      );
      validateDirectoryEntries(descriptor, entries);
      await this.dependencies.adapter.revalidate(this.token(stagingLease), stagingLease.metadata.identity);
      await this.dependencies.adapter.promoteStagingDirectory(
        this.requireRoot().token,
        this.token(stagingLease),
        descriptor.namespace,
        descriptor.canonicalName,
      );
    } catch (error) {
      throw mapAdapterError(error, 'INSTALL_FAILED');
    } finally {
      await stagingLease.release();
    }
  }

  public async discardStaging(stagingLease: ManagedArtifactLease): Promise<void> {
    const authority = this.requireAuthority(stagingLease, 'staging');
    if (!authority.lock) throw new ManagedArtifactStoreError('INVALID_LEASE');
    try {
      const entries = await this.dependencies.adapter.inspectDirectory(this.token(stagingLease));
      const expectedByName = new Map<string, ManagedArtifactExpectedFile | null>([
        [MANAGED_MANIFEST_NAME, null],
        ...authority.descriptor.expectedFiles.map(
          (expected) => [descriptorFileName(authority.descriptor, expected), expected] as const,
        ),
      ]);
      for (const entry of entries) {
        const expected = expectedByName.get(entry.canonicalName);
        const expectedMode = expected === null ? MANAGED_MANIFEST_MODE : expected?.mode;
        const maximumSize =
          expected === null ? managedManifestBytes(authority.descriptor).byteLength : expected?.sizeBytes;
        if (
          expectedMode === undefined ||
          maximumSize === undefined ||
          entry.identity.type !== 'regular' ||
          entry.identity.linkCount !== 1 ||
          entry.identity.mode !== expectedMode ||
          entry.identity.sizeBytes > maximumSize
        ) {
          throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
        }
      }
      await this.dependencies.adapter.revalidate(this.token(stagingLease), stagingLease.metadata.identity);
      for (const entry of entries) {
        await this.dependencies.adapter.deleteStagingFile(
          this.token(stagingLease),
          entry.canonicalName,
          entry.identity,
        );
      }
      if ((await this.dependencies.adapter.inspectDirectory(this.token(stagingLease))).length !== 0) {
        throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
      }
      await this.dependencies.adapter.removeEmptyStagingDirectory(this.requireRoot().token, this.token(stagingLease));
    } catch (error) {
      throw mapAdapterError(error, 'INSTALL_FAILED');
    } finally {
      await stagingLease.release().catch(() => undefined);
    }
  }

  public async leaseInstalledArtifact(
    descriptor: ManagedArtifactDescriptor,
    purpose: Extract<ManagedArtifactLeasePurpose, 'integrity' | 'load' | 'verify'>,
  ): Promise<ManagedArtifactLease> {
    return (await this.acquireInstalledArtifact(descriptor, purpose)).lease;
  }

  /** Resolves the one catalog-declared runtime executable while retaining its anchored directory lease. */
  public async leaseInstalledRuntimeForLaunch(
    descriptor: ManagedArtifactDescriptor,
  ): Promise<ManagedRuntimeLaunchLease> {
    if (descriptor.kind !== 'runtime') throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
    const executable = descriptor.expectedFiles.filter(({ kind }) => kind === 'executable');
    if (executable.length !== 1) throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
    const executableFile = executable[0];
    if (!executableFile) throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
    const rootResolution = this.dependencies.rootResolution;
    if (rootResolution.availability !== 'available') {
      throw new ManagedArtifactStoreError(
        rootResolution.availability === 'planned' ? 'PLANNED_UNAVAILABLE' : 'UNSUPPORTED_PLATFORM',
      );
    }
    const runtimeLease = await this.leaseInstalledArtifact(descriptor, 'load');
    try {
      const authority = this.requireAuthority(runtimeLease, 'load');
      const entries = validateDirectoryEntries(
        descriptor,
        await this.dependencies.adapter.inspectDirectory(
          this.token(runtimeLease),
          expectedDirectoryEntries(descriptor),
        ),
      );
      const worker = entries.get(executableFile.fileId);
      if (!worker || worker.identity.type !== 'regular' || worker.sha256 !== executableFile.sha256) {
        throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
      }
      await this.dependencies.adapter.revalidate(this.token(runtimeLease), runtimeLease.metadata.identity);
      const workingDirectoryPath = join(
        rootResolution.managedRoot,
        authority.descriptor.namespace,
        authority.descriptor.canonicalName,
      );
      return Object.freeze({
        runtimeLease,
        workerExecutablePath: join(workingDirectoryPath, descriptorFileName(descriptor, executableFile)),
        workerFileIdentity: worker.identity,
        workerFileSha256: worker.sha256,
        workingDirectoryPath,
        revalidate: async () => {
          try {
            runtimeLease.assertActive();
            const currentEntries = validateDirectoryEntries(
              descriptor,
              await this.dependencies.adapter.inspectDirectory(
                this.token(runtimeLease),
                expectedDirectoryEntries(descriptor),
              ),
            );
            const currentWorker = currentEntries.get(executableFile.fileId);
            if (
              !currentWorker ||
              currentWorker.sha256 !== worker.sha256 ||
              !sameIdentity(currentWorker.identity, worker.identity)
            ) {
              throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
            }
            await this.dependencies.adapter.revalidate(this.token(runtimeLease), runtimeLease.metadata.identity);
          } catch (error) {
            throw mapAdapterError(error, 'ARTIFACT_UNPROVABLE');
          }
        },
      });
    } catch (error) {
      await runtimeLease.release().catch(() => undefined);
      throw mapAdapterError(error, 'ARTIFACT_UNPROVABLE');
    }
  }

  /** Resolves the one catalog-declared ggml data file while retaining its anchored directory lease. */
  public async leaseInstalledModelForLaunch(descriptor: ManagedArtifactDescriptor): Promise<ManagedModelLaunchLease> {
    if (descriptor.kind !== 'model') throw new ManagedArtifactStoreError('INVALID_ARTIFACT');
    const modelFiles = descriptor.expectedFiles.filter(({ kind }) => kind === 'data');
    if (modelFiles.length !== 1) throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
    const modelFile = modelFiles[0];
    if (!modelFile) throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
    const rootResolution = this.dependencies.rootResolution;
    if (rootResolution.availability !== 'available') {
      throw new ManagedArtifactStoreError(
        rootResolution.availability === 'planned' ? 'PLANNED_UNAVAILABLE' : 'UNSUPPORTED_PLATFORM',
      );
    }
    const acquisition = await this.acquireInstalledArtifact(descriptor, 'load');
    const modelLease = acquisition.lease;
    try {
      const authority = this.requireAuthority(modelLease, 'load');
      const modelEntry = acquisition.entries.get(modelFile.fileId);
      if (!modelEntry || modelEntry.identity.type !== 'regular' || modelEntry.sha256 !== modelFile.sha256) {
        throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
      }
      await this.dependencies.adapter.revalidate(this.token(modelLease), modelLease.metadata.identity);
      const modelFilePath = join(
        rootResolution.managedRoot,
        authority.descriptor.namespace,
        authority.descriptor.canonicalName,
        descriptorFileName(descriptor, modelFile),
      );
      return Object.freeze({
        modelLease,
        modelLeaseTokenDigest: sha256(this.token(modelLease)),
        modelFilePath,
        modelFileIdentity: modelEntry.identity,
        modelFileSha256: modelEntry.sha256,
        modelFileSizeBytes: modelFile.sizeBytes,
        revalidate: async () => {
          try {
            modelLease.assertActive();
            const currentEntries = validateDirectoryEntries(
              descriptor,
              await this.dependencies.adapter.inspectDirectory(
                this.token(modelLease),
                expectedDirectoryEntries(descriptor),
              ),
            );
            const currentModel = currentEntries.get(modelFile.fileId);
            if (
              !currentModel ||
              currentModel.sha256 !== modelEntry.sha256 ||
              !sameIdentity(currentModel.identity, modelEntry.identity)
            ) {
              throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
            }
            await this.dependencies.adapter.revalidate(this.token(modelLease), modelLease.metadata.identity);
          } catch (error) {
            await modelLease.release().catch(() => undefined);
            throw mapAdapterError(error, 'ARTIFACT_UNPROVABLE');
          }
        },
      });
    } catch (error) {
      await modelLease.release().catch(() => undefined);
      throw mapAdapterError(error, 'ARTIFACT_UNPROVABLE');
    }
  }

  public async deleteArtifact(
    descriptor: ManagedArtifactDescriptor,
    clearance: ManagedArtifactRemovalClearance,
  ): Promise<void> {
    assertDescriptor(descriptor);
    if (!clearance.authorizes(descriptor.artifactId)) throw new ManagedArtifactStoreError('INVALID_CLEARANCE');
    const lock = await this.acquireLock(descriptor, 'delete', 'DELETE_FAILED');
    let artifactToken: string | null = null;
    let quarantineToken: string | null = null;
    try {
      const opened = await this.dependencies.adapter.openArtifactDirectory(
        this.requireRoot().token,
        descriptor.namespace,
        descriptor.canonicalName,
      );
      if (!opened) throw new ManagedArtifactStoreError('ARTIFACT_MISSING');
      artifactToken = opened.token;
      await this.dependencies.adapter.revalidate(opened.token, opened.identity);
      const quarantined = await this.dependencies.adapter.quarantineArtifactDirectory(
        this.requireRoot().token,
        opened.token,
        descriptor.namespace,
        descriptor.canonicalName,
        this.generateNonce(),
      );
      quarantineToken = quarantined.token;
      const entries = await this.dependencies.adapter.inspectDirectory(
        quarantined.token,
        expectedDirectoryEntries(descriptor),
      );
      const proven = validateDirectoryEntries(descriptor, entries);
      for (const expected of descriptor.expectedFiles) {
        const entry = proven.get(expected.fileId);
        if (!entry) throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
        await this.dependencies.adapter.deleteQuarantinedFile(
          quarantined.token,
          descriptorFileName(descriptor, expected),
          entry.identity,
        );
      }
      const manifest = entries.find(({ canonicalName }) => canonicalName === MANAGED_MANIFEST_NAME);
      if (!manifest) throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
      await this.dependencies.adapter.deleteQuarantinedFile(
        quarantined.token,
        MANAGED_MANIFEST_NAME,
        manifest.identity,
      );
      if ((await this.dependencies.adapter.inspectDirectory(quarantined.token)).length !== 0) {
        throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
      }
      await this.dependencies.adapter.removeEmptyQuarantineDirectory(this.requireRoot().token, quarantined.token);
      await this.dependencies.adapter.release(quarantined.token);
      quarantineToken = null;
    } catch (error) {
      throw mapAdapterError(error, 'DELETE_FAILED');
    } finally {
      if (quarantineToken) await this.dependencies.adapter.release(quarantineToken).catch(() => undefined);
      if (artifactToken) await this.dependencies.adapter.release(artifactToken).catch(() => undefined);
      await lock.release().catch(() => undefined);
    }
  }

  public async buildEvidenceSnapshot(
    catalog: LocalWhisperAuthenticatedCatalog,
  ): Promise<LocalWhisperManagedStorageEvidencePort> {
    const descriptors = [
      ...catalog.payload.runtimes.map((entry) => createManagedRuntimeDescriptor(catalog, entry)),
      ...catalog.payload.models.map((entry) => createManagedModelDescriptor(catalog, entry)),
    ];
    const records: ManagedArtifactEvidenceRecord[] = [];
    for (const descriptor of descriptors) {
      records.push({ descriptor, evidence: await this.readEvidence(descriptor) });
    }
    const knownByNamespace = new Map<ManagedArtifactNamespace, ReadonlySet<string>>([
      ['models', new Set(descriptors.filter(({ kind }) => kind === 'model').map(({ canonicalName }) => canonicalName))],
      [
        'runtimes',
        new Set(descriptors.filter(({ kind }) => kind === 'runtime').map(({ canonicalName }) => canonicalName)),
      ],
    ]);
    let unmanagedCount = 0;
    for (const namespace of ['models', 'runtimes'] as const) {
      const names = await this.dependencies.adapter.listArtifactDirectoryNames(this.requireRoot().token, namespace);
      const known = knownByNamespace.get(namespace);
      unmanagedCount += names.filter((name) => !known?.has(name)).length;
    }
    return new ManagedArtifactEvidenceSnapshot(records, unmanagedCount);
  }

  public async dispose(): Promise<void> {
    const root = this.root;
    this.root = null;
    if (root) await this.dependencies.adapter.release(root.token).catch(() => undefined);
    await this.dependencies.adapter.dispose();
  }

  private async readEvidence(descriptor: ManagedArtifactDescriptor): Promise<LocalWhisperManagedArtifactEvidence> {
    const lock = await this.acquireLock(descriptor, 'integrity', 'ARTIFACT_UNPROVABLE');
    let opened: ManagedFilesystemOpenResult | null = null;
    try {
      try {
        opened = await this.dependencies.adapter.openArtifactDirectory(
          this.requireRoot().token,
          descriptor.namespace,
          descriptor.canonicalName,
        );
      } catch (error) {
        if (isUnsafeEvidenceError(error)) return corruptEvidence(descriptor);
        throw error;
      }
      if (!opened) return Object.freeze({ kind: 'missing' });
      let entries: readonly ManagedFilesystemDirectoryEntry[];
      try {
        entries = await this.dependencies.adapter.inspectDirectory(opened.token, expectedDirectoryEntries(descriptor));
      } catch (error) {
        if (isUnsafeEvidenceError(error)) return corruptEvidence(descriptor);
        throw error;
      }
      let proven: ReadonlyMap<LocalWhisperArtifactId, ManagedFilesystemDirectoryEntry>;
      try {
        proven = validateDirectoryEntries(descriptor, entries);
      } catch {
        return corruptEvidence(descriptor);
      }
      return Object.freeze({
        kind: 'installed',
        manifestIdentityKey: descriptor.identityKey,
        manifestValid: true,
        files: Object.freeze(
          descriptor.expectedFiles.map((expected) => {
            const entry = proven.get(expected.fileId);
            if (!entry) throw new ManagedArtifactStoreError('ARTIFACT_UNPROVABLE');
            return toManagedFileEvidence(expected, entry);
          }),
        ),
      });
    } finally {
      if (opened) await this.dependencies.adapter.release(opened.token).catch(() => undefined);
      await lock.release().catch(() => undefined);
    }
  }

  private createLease(
    descriptor: ManagedArtifactDescriptor,
    native: ManagedFilesystemOpenResult,
    purpose: ManagedArtifactLeasePurpose,
    lock: ManagedArtifactLockLease | null,
  ): ManagedArtifactLease {
    const lease = new ManagedArtifactLease(
      Object.freeze({
        artifactId: descriptor.artifactId,
        artifactKind: descriptor.kind,
        canonicalName: descriptor.canonicalName,
        catalogDigest: descriptor.catalogDigest,
        identity: native.identity,
        purpose,
      }),
      native.token,
      async (token) => {
        await this.dependencies.adapter.release(token);
        await lock?.release();
      },
    );
    this.authorities.set(lease, { descriptor, lock });
    return lease;
  }

  private async acquireInstalledArtifact(
    descriptor: ManagedArtifactDescriptor,
    purpose: Extract<ManagedArtifactLeasePurpose, 'integrity' | 'load' | 'verify'>,
  ): Promise<InstalledArtifactAcquisition> {
    assertDescriptor(descriptor);
    const lock = await this.acquireLock(descriptor, purpose, 'ARTIFACT_UNPROVABLE');
    let native: ManagedFilesystemOpenResult | null = null;
    let lease: ManagedArtifactLease | null = null;
    try {
      native = await this.dependencies.adapter.openArtifactDirectory(
        this.requireRoot().token,
        descriptor.namespace,
        descriptor.canonicalName,
      );
      if (!native) throw new ManagedArtifactStoreError('ARTIFACT_MISSING');
      lease = this.createLease(descriptor, native, purpose, lock);
      const entries = validateDirectoryEntries(
        descriptor,
        await this.dependencies.adapter.inspectDirectory(native.token, expectedDirectoryEntries(descriptor)),
      );
      await this.dependencies.adapter.revalidate(native.token, native.identity);
      return Object.freeze({ entries, lease });
    } catch (error) {
      if (lease) {
        await lease.release().catch(() => undefined);
        await lock.release().catch(() => undefined);
      } else {
        if (native) await this.dependencies.adapter.release(native.token).catch(() => undefined);
        await lock.release().catch(() => undefined);
      }
      throw mapAdapterError(error, 'ARTIFACT_UNPROVABLE');
    }
  }

  private async writeManagedManifest(stagingToken: string, descriptor: ManagedArtifactDescriptor): Promise<void> {
    const file = await this.dependencies.adapter.createStagedFile(
      stagingToken,
      MANAGED_MANIFEST_NAME,
      MANAGED_MANIFEST_MODE,
    );
    try {
      await this.dependencies.adapter.appendStagedFile(file.token, managedManifestBytes(descriptor));
      await this.dependencies.adapter.sealStagedFile(file.token);
    } finally {
      await this.dependencies.adapter.release(file.token).catch(() => undefined);
    }
  }

  private requireAuthority(lease: ManagedArtifactLease, purpose: ManagedArtifactLeasePurpose): LeaseAuthority {
    lease.assertActive();
    const authority = this.authorities.get(lease);
    if (!authority || lease.metadata.purpose !== purpose) throw new ManagedArtifactStoreError('INVALID_LEASE');
    return authority;
  }

  private token(lease: ManagedArtifactLease): string {
    return lease.nativeToken(this.leaseOwner, this.leaseOwner);
  }

  private requireRoot(): ManagedFilesystemOpenResult {
    if (!this.root) throw new ManagedArtifactStoreError('STORAGE_UNAVAILABLE');
    return this.root;
  }

  private requireLocks(): ManagedArtifactLockRepository {
    this.requireRoot();
    return this.dependencies.lockRepository;
  }

  private async acquireLock(
    descriptor: ManagedArtifactDescriptor,
    purpose: ManagedArtifactLeasePurpose,
    fallback: ManagedArtifactStoreErrorCode,
  ): Promise<ManagedArtifactLockLease> {
    try {
      return await this.requireLocks().acquire(
        this.requireRoot().token,
        descriptor.artifactId,
        descriptor.canonicalName,
        purpose,
      );
    } catch (error) {
      throw mapAdapterError(error, fallback);
    }
  }

  private generateNonce(): string {
    const value = this.dependencies.generateOperationNonce();
    if (!OPERATION_NONCE_PATTERN.test(value)) throw new ManagedArtifactStoreError('INVALID_NONCE');
    return value;
  }
}
