import { createHash } from 'node:crypto';

import type { LocalWhisperArtifactId } from '@shared/localWhisper';

import type { ManagedArtifactLease } from '../filesystem/ManagedArtifactLease';
import {
  ARTIFACT_MAX_BUFFER_BYTES,
  LocalWhisperArtifactLifecycleError,
  type ArtifactManagedStorePort,
  type LocalWhisperArtifactDownloadSpec,
  type StreamingArtifactEntry,
} from './ArtifactLifecycleTypes';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function isUnsafeName(value: string): boolean {
  return (
    value.length === 0 ||
    value.length > 128 ||
    value.startsWith('/') ||
    /^[A-Za-z]:/u.test(value) ||
    value.includes('\\') ||
    value.includes('/') ||
    value.includes('\0') ||
    value === '.' ||
    value === '..' ||
    value.split('/').some((segment) => segment === '..')
  );
}

function validateEntries(
  spec: LocalWhisperArtifactDownloadSpec,
  entries: readonly StreamingArtifactEntry[],
): ReadonlyMap<LocalWhisperArtifactId, StreamingArtifactEntry> {
  if (entries.length !== spec.expectedFiles.length) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  const byName = new Map<string, StreamingArtifactEntry>();
  const caseFolded = new Set<string>();
  for (const entry of entries) {
    const folded = entry.name.toLocaleLowerCase('en-US');
    if (
      isUnsafeName(entry.name) ||
      entry.type !== 'regular' ||
      byName.has(entry.name) ||
      caseFolded.has(folded) ||
      !Number.isSafeInteger(entry.sizeBytes) ||
      entry.sizeBytes < 0 ||
      !Number.isSafeInteger(entry.mode) ||
      entry.mode < 0 ||
      entry.mode > 0o777 ||
      !SHA256_PATTERN.test(entry.sha256)
    ) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
    byName.set(entry.name, entry);
    caseFolded.add(folded);
  }
  const mapped = new Map<LocalWhisperArtifactId, StreamingArtifactEntry>();
  let expandedBytes = 0;
  for (const expected of spec.expectedFiles) {
    const entry = byName.get(expected.fileId);
    if (
      !entry ||
      entry.mode !== expected.mode ||
      entry.sizeBytes !== expected.sizeBytes ||
      entry.sha256 !== expected.sha256
    ) {
      throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    }
    expandedBytes += entry.sizeBytes;
    if (!Number.isSafeInteger(expandedBytes)) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
    mapped.set(expected.fileId, entry);
  }
  if (byName.size !== mapped.size || expandedBytes !== spec.expandedSizeBytes) {
    throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
  }
  return mapped;
}

/** Materializes only authenticated manifest entries through Task 04 leases. */
export class StreamingArtifactExtractor {
  public constructor(private readonly store: ArtifactManagedStorePort) {}

  public async install(
    spec: LocalWhisperArtifactDownloadSpec,
    entries: readonly StreamingArtifactEntry[],
    signal: AbortSignal,
  ): Promise<void> {
    const validated = validateEntries(spec, entries);
    let staging: ManagedArtifactLease | null = null;
    let promoted = false;
    try {
      if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
      staging = await this.store.createStaging(spec.descriptor);
      for (const expected of spec.expectedFiles) {
        if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
        const entry = validated.get(expected.fileId);
        if (!entry) throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
        const fileLease = await this.store.createStagedFile(staging, expected.fileId);
        let written = 0;
        const hash = createHash('sha256');
        try {
          for await (const chunk of entry.chunks) {
            if (signal.aborted) throw new LocalWhisperArtifactLifecycleError('DOWNLOAD_CANCELLED');
            if (!(chunk instanceof Uint8Array) || chunk.byteLength > ARTIFACT_MAX_BUFFER_BYTES) {
              throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
            }
            written += chunk.byteLength;
            if (!Number.isSafeInteger(written) || written > expected.sizeBytes) {
              throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
            }
            hash.update(chunk);
            await this.store.appendStagedFile(fileLease, chunk);
          }
          if (written !== expected.sizeBytes || hash.digest('hex') !== expected.sha256) {
            throw new LocalWhisperArtifactLifecycleError('ARCHIVE_INVALID');
          }
          await this.store.sealStagedFile(fileLease);
        } catch (error) {
          await fileLease.release().catch(() => undefined);
          throw error;
        }
      }
      await this.store.promote(spec.descriptor, staging);
      promoted = true;
    } catch (error) {
      if (staging && !promoted) {
        try {
          await this.store.discardStaging(staging);
        } catch {
          throw new LocalWhisperArtifactLifecycleError('CLEANUP_FAILED');
        }
      }
      if (error instanceof LocalWhisperArtifactLifecycleError) throw error;
      throw new LocalWhisperArtifactLifecycleError('INSTALL_FAILED');
    }
  }
}
