import type fs from 'node:fs';
import { dirname } from 'node:path';

import type { ManagedArtifactIdentitySnapshot } from '../filesystem/ManagedArtifactLease';
import { hasLocalWhisperControlCharacter } from '@shared/localWhisper';
import type {
  LocalWhisperWorkerOwnershipRecord,
  LocalWhisperWorkerOwnershipRecordStore,
} from './WorkerProcessOwnership';

const MAX_RECORD_BYTES = 16 * 1024;
const RECORD_KEYS = [
  'appInstanceNonce',
  'configurationEpoch',
  'executableIdentity',
  'pid',
  'processStartIdentity',
  'runtimeBuildDigest',
  'runtimeIdentityKey',
] as const;
const IDENTITY_KEYS = ['deviceOrVolumeId', 'fileId', 'linkCount', 'mode', 'parentFileId', 'sizeBytes', 'type'] as const;

type RecordFileSystem = Pick<
  typeof fs,
  'chmodSync' | 'existsSync' | 'mkdirSync' | 'readFileSync' | 'renameSync' | 'unlinkSync' | 'writeFileSync'
>;

export interface FileWorkerOwnershipRecordStoreDependencies {
  readonly filePath: string;
  readonly fileSystem: RecordFileSystem;
  readonly temporaryPath: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isSafeString(value: unknown, maximumLength = 512): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumLength &&
    !hasLocalWhisperControlCharacter(value)
  );
}

function isIdentity(value: unknown): value is ManagedArtifactIdentitySnapshot {
  return (
    isRecord(value) &&
    hasExactKeys(value, IDENTITY_KEYS) &&
    isSafeString(value.deviceOrVolumeId) &&
    isSafeString(value.fileId) &&
    Number.isSafeInteger(value.linkCount) &&
    (value.linkCount as number) > 0 &&
    Number.isSafeInteger(value.mode) &&
    (value.mode as number) >= 0 &&
    (value.mode as number) <= 0o777 &&
    isSafeString(value.parentFileId) &&
    Number.isSafeInteger(value.sizeBytes) &&
    (value.sizeBytes as number) >= 0 &&
    (value.type === 'directory' || value.type === 'regular')
  );
}

function parseRecord(value: unknown): LocalWhisperWorkerOwnershipRecord | null {
  if (!isRecord(value) || !hasExactKeys(value, RECORD_KEYS)) return null;
  const appInstanceNonce = value.appInstanceNonce;
  if (
    typeof appInstanceNonce !== 'string' ||
    !/^[\w-]{16,128}$/u.test(appInstanceNonce) ||
    !Number.isSafeInteger(value.configurationEpoch) ||
    (value.configurationEpoch as number) < 0 ||
    !isIdentity(value.executableIdentity) ||
    !Number.isSafeInteger(value.pid) ||
    (value.pid as number) <= 0 ||
    !isSafeString(value.processStartIdentity) ||
    typeof value.runtimeBuildDigest !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.runtimeBuildDigest) ||
    !isSafeString(value.runtimeIdentityKey, 4096)
  ) {
    return null;
  }
  return Object.freeze({
    appInstanceNonce,
    configurationEpoch: value.configurationEpoch as number,
    executableIdentity: Object.freeze({ ...value.executableIdentity }),
    pid: value.pid as number,
    processStartIdentity: value.processStartIdentity,
    runtimeBuildDigest: value.runtimeBuildDigest,
    runtimeIdentityKey: value.runtimeIdentityKey,
  });
}

/** Atomic private persistence for orphan ownership proof; never stores paths or argv. */
export class FileWorkerOwnershipRecordStore implements LocalWhisperWorkerOwnershipRecordStore {
  public constructor(private readonly dependencies: FileWorkerOwnershipRecordStoreDependencies) {}

  public read(): Promise<
    | { readonly kind: 'invalid' }
    | { readonly kind: 'missing' }
    | { readonly kind: 'valid'; readonly record: LocalWhisperWorkerOwnershipRecord }
  > {
    return Promise.resolve().then(() => {
      const { filePath, fileSystem } = this.dependencies;
      if (!fileSystem.existsSync(filePath)) return Object.freeze({ kind: 'missing' });
      try {
        const bytes = fileSystem.readFileSync(filePath);
        if (bytes.byteLength > MAX_RECORD_BYTES) return Object.freeze({ kind: 'invalid' });
        const record = parseRecord(JSON.parse(bytes.toString('utf8')) as unknown);
        return record ? Object.freeze({ kind: 'valid', record }) : Object.freeze({ kind: 'invalid' });
      } catch {
        return Object.freeze({ kind: 'invalid' });
      }
    });
  }

  public write(record: LocalWhisperWorkerOwnershipRecord): Promise<void> {
    return Promise.resolve().then(() => {
      if (!parseRecord(record)) throw new Error('Invalid Local Whisper ownership record');
      const { filePath, fileSystem } = this.dependencies;
      const temporaryPath = this.dependencies.temporaryPath();
      if (dirname(temporaryPath) !== dirname(filePath) || temporaryPath === filePath) {
        throw new Error('Invalid Local Whisper ownership temporary path');
      }
      fileSystem.mkdirSync(dirname(filePath), { mode: 0o700, recursive: true });
      try {
        fileSystem.writeFileSync(temporaryPath, `${JSON.stringify(record)}\n`, {
          encoding: 'utf8',
          flag: 'wx',
          mode: 0o600,
        });
        fileSystem.chmodSync(temporaryPath, 0o600);
        fileSystem.renameSync(temporaryPath, filePath);
        fileSystem.chmodSync(filePath, 0o600);
      } catch (error) {
        if (fileSystem.existsSync(temporaryPath)) fileSystem.unlinkSync(temporaryPath);
        throw error;
      }
    });
  }

  public async remove(record: LocalWhisperWorkerOwnershipRecord): Promise<void> {
    const stored = await this.read();
    if (stored.kind !== 'valid' || JSON.stringify(stored.record) !== JSON.stringify(record)) {
      throw new Error('Local Whisper ownership record changed');
    }
    this.dependencies.fileSystem.unlinkSync(this.dependencies.filePath);
  }
}
