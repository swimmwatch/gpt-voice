import type { ManagedArtifactIdentitySnapshot, ManagedArtifactKind } from './ManagedArtifactLease';

export type ManagedArtifactNamespace = 'models' | 'runtimes';

export interface ManagedFilesystemLockMetadata {
  readonly appInstanceNonce: string;
  readonly artifactId: string;
  readonly operation: string;
  readonly osProcessStartIdentity: string;
  readonly pid: number;
}

export interface ManagedFilesystemDirectoryEntry {
  readonly canonicalName: string;
  readonly identity: ManagedArtifactIdentitySnapshot;
  readonly sha256: string | null;
}

export interface ManagedFilesystemExpectedEntry {
  readonly canonicalName: string;
  readonly mode: number;
}

export interface ManagedFilesystemOpenResult {
  readonly identity: ManagedArtifactIdentitySnapshot;
  readonly token: string;
}

export interface ManagedFilesystemPlatformAdapter {
  getProcessStartIdentity(pid: number): Promise<string>;
  initialize(managedRoot: string): Promise<ManagedFilesystemOpenResult>;
  acquireArtifactLock(
    rootToken: string,
    canonicalArtifactName: string,
    metadata: ManagedFilesystemLockMetadata,
  ): Promise<ManagedFilesystemOpenResult>;
  createStagingDirectory(
    rootToken: string,
    artifactKind: ManagedArtifactKind,
    canonicalArtifactName: string,
    nonce: string,
  ): Promise<ManagedFilesystemOpenResult>;
  createStagedFile(
    directoryToken: string,
    canonicalFileName: string,
    mode: number,
  ): Promise<ManagedFilesystemOpenResult>;
  appendStagedFile(fileToken: string, chunk: Uint8Array, signal?: AbortSignal): Promise<void>;
  sealStagedFile(fileToken: string): Promise<ManagedArtifactIdentitySnapshot>;
  inspectDirectory(
    directoryToken: string,
    expectedEntries?: readonly ManagedFilesystemExpectedEntry[],
  ): Promise<readonly ManagedFilesystemDirectoryEntry[]>;
  inspectDirectoryMetadataOnly(
    directoryToken: string,
    expectedEntries?: readonly ManagedFilesystemExpectedEntry[],
  ): Promise<readonly ManagedFilesystemDirectoryEntry[]>;
  listArtifactDirectoryNames(rootToken: string, namespace: ManagedArtifactNamespace): Promise<readonly string[]>;
  openArtifactDirectory(
    rootToken: string,
    namespace: ManagedArtifactNamespace,
    canonicalArtifactName: string,
  ): Promise<ManagedFilesystemOpenResult | null>;
  promoteStagingDirectory(
    rootToken: string,
    stagingToken: string,
    namespace: ManagedArtifactNamespace,
    canonicalArtifactName: string,
  ): Promise<ManagedArtifactIdentitySnapshot>;
  quarantineArtifactDirectory(
    rootToken: string,
    artifactToken: string,
    namespace: ManagedArtifactNamespace,
    canonicalArtifactName: string,
    nonce: string,
  ): Promise<ManagedFilesystemOpenResult>;
  deleteQuarantinedFile(
    quarantineToken: string,
    canonicalFileName: string,
    expectedIdentity: ManagedArtifactIdentitySnapshot,
  ): Promise<void>;
  deleteStagingFile(
    stagingToken: string,
    canonicalFileName: string,
    expectedIdentity: ManagedArtifactIdentitySnapshot,
  ): Promise<void>;
  removeEmptyQuarantineDirectory(rootToken: string, quarantineToken: string): Promise<void>;
  removeEmptyStagingDirectory(rootToken: string, stagingToken: string): Promise<void>;
  revalidate(token: string, expectedIdentity: ManagedArtifactIdentitySnapshot): Promise<void>;
  release(token: string): Promise<void>;
  dispose(): Promise<void>;
}

export type ManagedFilesystemAdapterFailureCode =
  'CONFLICT' | 'IDENTITY_CHANGED' | 'INVALID_INPUT' | 'NOT_FOUND' | 'UNSAFE_ENTRY' | 'UNSUPPORTED' | 'IO_FAILED';

/** Stable error emitted by platform adapters; native paths and OS messages stay private. */
export class ManagedFilesystemAdapterError extends Error {
  public constructor(public readonly code: ManagedFilesystemAdapterFailureCode) {
    super(code);
    this.name = 'ManagedFilesystemAdapterError';
  }
}
