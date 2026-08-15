import type { ManagedArtifactIdentitySnapshot, ManagedArtifactKind } from './ManagedArtifactLease';
import type { ManagedFilesystemGuardTransport } from './NativeManagedFilesystemGuardTransport';
import {
  ManagedFilesystemAdapterError,
  type ManagedArtifactNamespace,
  type ManagedFilesystemDirectoryEntry,
  type ManagedFilesystemExpectedEntry,
  type ManagedFilesystemLockMetadata,
  type ManagedFilesystemOpenResult,
  type ManagedFilesystemPlatformAdapter,
} from './ManagedFilesystemPlatformAdapter';

const IDENTITY_FIELD_COUNT = 7;

function parseNonNegativeSafeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new ManagedFilesystemAdapterError('IO_FAILED');
  return parsed;
}

function parseIdentity(value: string): ManagedArtifactIdentitySnapshot {
  const fields = value.split('|');
  if (fields.length !== IDENTITY_FIELD_COUNT || (fields[6] !== 'directory' && fields[6] !== 'regular')) {
    throw new ManagedFilesystemAdapterError('IO_FAILED');
  }
  return Object.freeze({
    deviceOrVolumeId: fields[0],
    fileId: fields[1],
    linkCount: parseNonNegativeSafeInteger(fields[2]),
    mode: parseNonNegativeSafeInteger(fields[3]),
    parentFileId: fields[4],
    sizeBytes: parseNonNegativeSafeInteger(fields[5]),
    type: fields[6],
  });
}

function serializeIdentity(identity: ManagedArtifactIdentitySnapshot): string {
  return [
    identity.deviceOrVolumeId,
    identity.fileId,
    identity.linkCount,
    identity.mode,
    identity.parentFileId,
    identity.sizeBytes,
    identity.type,
  ].join('|');
}

function parseOpenResult(fields: readonly string[]): ManagedFilesystemOpenResult {
  if (fields.length !== 2 || !fields[0]) throw new ManagedFilesystemAdapterError('IO_FAILED');
  return Object.freeze({ token: fields[0], identity: parseIdentity(fields[1]) });
}

function parseDirectoryEntry(value: string): ManagedFilesystemDirectoryEntry {
  const fields = value.split('~');
  if (fields.length !== 3 || !fields[0]) throw new ManagedFilesystemAdapterError('IO_FAILED');
  return Object.freeze({
    canonicalName: fields[0],
    identity: parseIdentity(fields[1]),
    sha256: fields[2] || null,
  });
}

/** Common protocol adapter; platform subclasses pin the expected native implementation. */
export abstract class NativeManagedFilesystemAdapter implements ManagedFilesystemPlatformAdapter {
  protected constructor(
    private readonly transport: ManagedFilesystemGuardTransport,
    private readonly expectedPlatform: 'linux' | 'win32',
  ) {}

  public async getProcessStartIdentity(pid: number): Promise<string> {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new ManagedFilesystemAdapterError('INVALID_INPUT');
    const fields = await this.transport.request('PROCESS_IDENTITY', [String(pid)]);
    if (fields.length !== 1 || !fields[0]) throw new ManagedFilesystemAdapterError('IO_FAILED');
    return fields[0];
  }

  public async initialize(managedRoot: string): Promise<ManagedFilesystemOpenResult> {
    return parseOpenResult(await this.transport.request('INIT', [this.expectedPlatform, managedRoot]));
  }

  public async acquireArtifactLock(
    rootToken: string,
    canonicalArtifactName: string,
    metadata: ManagedFilesystemLockMetadata,
  ): Promise<ManagedFilesystemOpenResult> {
    return parseOpenResult(
      await this.transport.request('LOCK', [
        rootToken,
        canonicalArtifactName,
        metadata.appInstanceNonce,
        String(metadata.pid),
        metadata.osProcessStartIdentity,
        metadata.operation,
        metadata.artifactId,
      ]),
    );
  }

  public async createStagingDirectory(
    rootToken: string,
    artifactKind: ManagedArtifactKind,
    canonicalArtifactName: string,
    nonce: string,
  ): Promise<ManagedFilesystemOpenResult> {
    return parseOpenResult(
      await this.transport.request('CREATE_STAGING', [rootToken, artifactKind, canonicalArtifactName, nonce]),
    );
  }

  public async createStagedFile(
    directoryToken: string,
    canonicalFileName: string,
    mode: number,
  ): Promise<ManagedFilesystemOpenResult> {
    return parseOpenResult(
      await this.transport.request('CREATE_FILE', [directoryToken, canonicalFileName, String(mode)]),
    );
  }

  public async appendStagedFile(fileToken: string, chunk: Uint8Array, signal?: AbortSignal): Promise<void> {
    await this.transport.request('WRITE_FILE', [fileToken, chunk], signal);
  }

  public async sealStagedFile(fileToken: string): Promise<ManagedArtifactIdentitySnapshot> {
    const fields = await this.transport.request('SEAL_FILE', [fileToken]);
    if (fields.length !== 1) throw new ManagedFilesystemAdapterError('IO_FAILED');
    return parseIdentity(fields[0]);
  }

  public async inspectDirectory(
    directoryToken: string,
    expectedEntries: readonly ManagedFilesystemExpectedEntry[] = [],
  ): Promise<readonly ManagedFilesystemDirectoryEntry[]> {
    const expectedFields = expectedEntries.map(({ canonicalName, mode }) => `${canonicalName}|${mode}`);
    return Object.freeze(
      (await this.transport.request('LIST', [directoryToken, ...expectedFields])).map(parseDirectoryEntry),
    );
  }

  public async listArtifactDirectoryNames(
    rootToken: string,
    namespace: ManagedArtifactNamespace,
  ): Promise<readonly string[]> {
    return Object.freeze([...(await this.transport.request('LIST_NAMESPACE', [rootToken, namespace]))]);
  }

  public async openArtifactDirectory(
    rootToken: string,
    namespace: ManagedArtifactNamespace,
    canonicalArtifactName: string,
  ): Promise<ManagedFilesystemOpenResult | null> {
    const fields = await this.transport.request('OPEN_ARTIFACT', [rootToken, namespace, canonicalArtifactName]);
    return fields.length === 1 && fields[0] === 'MISSING' ? null : parseOpenResult(fields);
  }

  public async promoteStagingDirectory(
    rootToken: string,
    stagingToken: string,
    namespace: ManagedArtifactNamespace,
    canonicalArtifactName: string,
  ): Promise<ManagedArtifactIdentitySnapshot> {
    const fields = await this.transport.request('PROMOTE', [rootToken, stagingToken, namespace, canonicalArtifactName]);
    if (fields.length !== 1) throw new ManagedFilesystemAdapterError('IO_FAILED');
    return parseIdentity(fields[0]);
  }

  public async quarantineArtifactDirectory(
    rootToken: string,
    artifactToken: string,
    namespace: ManagedArtifactNamespace,
    canonicalArtifactName: string,
    nonce: string,
  ): Promise<ManagedFilesystemOpenResult> {
    return parseOpenResult(
      await this.transport.request('QUARANTINE', [rootToken, artifactToken, namespace, canonicalArtifactName, nonce]),
    );
  }

  public async deleteQuarantinedFile(
    quarantineToken: string,
    canonicalFileName: string,
    expectedIdentity: ManagedArtifactIdentitySnapshot,
  ): Promise<void> {
    await this.transport.request('DELETE_FILE', [
      quarantineToken,
      canonicalFileName,
      serializeIdentity(expectedIdentity),
    ]);
  }

  public async deleteStagingFile(
    stagingToken: string,
    canonicalFileName: string,
    expectedIdentity: ManagedArtifactIdentitySnapshot,
  ): Promise<void> {
    await this.transport.request('DELETE_STAGING_FILE', [
      stagingToken,
      canonicalFileName,
      serializeIdentity(expectedIdentity),
    ]);
  }

  public async removeEmptyQuarantineDirectory(rootToken: string, quarantineToken: string): Promise<void> {
    await this.transport.request('REMOVE_QUARANTINE', [rootToken, quarantineToken]);
  }

  public async removeEmptyStagingDirectory(rootToken: string, stagingToken: string): Promise<void> {
    await this.transport.request('REMOVE_STAGING', [rootToken, stagingToken]);
  }

  public async revalidate(token: string, expectedIdentity: ManagedArtifactIdentitySnapshot): Promise<void> {
    await this.transport.request('REVALIDATE', [token, serializeIdentity(expectedIdentity)]);
  }

  public async release(token: string): Promise<void> {
    await this.transport.request('RELEASE', [token]);
  }

  public async dispose(): Promise<void> {
    await this.transport.dispose();
  }
}
