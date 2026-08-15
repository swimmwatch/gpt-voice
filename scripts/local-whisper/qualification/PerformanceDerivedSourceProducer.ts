import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';

import {
  LocalWhisperPerformanceDocumentProducer,
  type PerformanceDerivedSourceReceipt,
  type PerformanceSide,
} from './PerformanceQualification';
import type { LocalWhisperQualificationValidator } from './QualificationContracts';

const execFileAsync = promisify(execFile);
const MAXIMUM_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAXIMUM_ENTRY_BYTES = 64 * 1024 * 1024;
const MAXIMUM_ENTRY_COUNT = 32_768;
const MAXIMUM_TREE_BYTES = 512 * 1024 * 1024;
const MAXIMUM_EXECUTABLE_BYTES = 256 * 1024 * 1024;
const TAR_BLOCK_BYTES = 512;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const DESTINATION_NAME_PATTERN = /^\w[\w.-]{0,127}$/u;

export class PerformanceSourceDerivationError extends Error {
  public constructor(
    public readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'PerformanceSourceDerivationError';
  }
}

export interface PerformanceSourceParentIdentity {
  readonly headCommit: string;
  readonly clean: boolean;
}

export interface PerformanceDerivedSourceGitPort {
  inspect(parentRoot: string): Promise<PerformanceSourceParentIdentity>;
  exportTrackedArchive(parentRoot: string, commit: string): Promise<Buffer>;
}

export type PerformanceArchiveEntryType = 'file' | 'directory' | 'symbolicLink' | 'hardLink' | 'unsupported';

export interface PerformanceArchiveEntry {
  readonly relativePath: string;
  readonly type: PerformanceArchiveEntryType;
  readonly mode: number;
  readonly bytes: Buffer;
}

export interface PerformanceSourceArchivePort {
  parse(archive: Buffer): readonly PerformanceArchiveEntry[];
}

export interface PerformanceDerivedSourceFilesystemPort {
  authenticatePrivateRoot(privateRoot: string): Promise<string>;
  createTreeExclusive(treeRoot: string): Promise<void>;
  writeDirectory(treeRoot: string, relativePath: string, mode: number): Promise<void>;
  writeFile(treeRoot: string, relativePath: string, bytes: Buffer, mode: number, replace: boolean): Promise<void>;
  readRegularFile(treeRoot: string, relativePath: string, maximumBytes: number): Promise<Buffer>;
  removeCreatedTree(treeRoot: string): Promise<void>;
}

export interface PerformanceDigestPort {
  sha256(value: Buffer | string): string;
}

export interface PerformanceDerivedSourceAuthority {
  readonly rootPath: string;
  readonly side: PerformanceSide;
  readonly parentCommit: string;
  readonly sourceProofDigest: string;
  readonly instrumentationOverlaySha256: string;
  readonly derivedTreeManifestSha256: string;
}

interface OwnedAuthorityState {
  readonly authority: PerformanceDerivedSourceAuthority;
  readonly parentRoot: string;
  status: 'ready' | 'binding' | 'finalized' | 'invalid';
}

interface NormalizedEntry {
  readonly relativePath: string;
  readonly type: 'file' | 'directory';
  readonly mode: number;
  readonly bytes: Buffer;
  readonly sha256: string;
}

function derivationFailure(code: string, cause?: unknown): never {
  throw new PerformanceSourceDerivationError(code, cause === undefined ? undefined : { cause });
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) derivationFailure('SOURCE_DERIVATION_CANCELLED');
}

function containedRelativePath(value: string): string {
  if (
    value.length === 0 ||
    value.length > 512 ||
    value.includes('\\') ||
    value.includes('\0') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value)
  ) {
    derivationFailure('SOURCE_ARCHIVE_ENTRY_INVALID');
  }
  const segments = value.split('/');
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..' ||
        segment.includes(':') ||
        segment.normalize('NFC') !== segment,
    )
  ) {
    derivationFailure('SOURCE_ARCHIVE_ENTRY_INVALID');
  }
  return segments.join('/');
}

function assertContained(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative.length === 0 || relative.startsWith('..') || path.isAbsolute(relative)) {
    derivationFailure('SOURCE_DERIVATION_PATH_INVALID');
  }
}

/** Hashes qualification inputs without retaining their bytes. */
export class NodePerformanceDigestAdapter implements PerformanceDigestPort {
  public sha256(value: Buffer | string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

/** Uses fixed-argument Git calls to authenticate and export one exact clean parent. */
export class GitPerformanceDerivedSourceAdapter implements PerformanceDerivedSourceGitPort {
  public constructor(private readonly gitExecutable: string) {
    if (gitExecutable.length === 0 || gitExecutable.includes('\0')) {
      derivationFailure('SOURCE_GIT_EXECUTABLE_INVALID');
    }
  }

  public async inspect(parentRoot: string): Promise<PerformanceSourceParentIdentity> {
    const options = {
      encoding: 'utf8' as const,
      env: { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH ?? '' },
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    };
    try {
      const [revision, status] = await Promise.all([
        execFileAsync(this.gitExecutable, ['-C', parentRoot, 'rev-parse', '--verify', 'HEAD^{commit}'], options),
        execFileAsync(
          this.gitExecutable,
          ['-C', parentRoot, 'status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'],
          options,
        ),
      ]);
      return Object.freeze({
        headCommit: revision.stdout.trim(),
        clean: revision.stderr === '' && status.stderr === '' && status.stdout === '',
      });
    } catch (error) {
      derivationFailure('SOURCE_PARENT_IDENTITY_INVALID', error);
    }
  }

  public async exportTrackedArchive(parentRoot: string, commit: string): Promise<Buffer> {
    try {
      const result = await execFileAsync(this.gitExecutable, ['-C', parentRoot, 'archive', '--format=tar', commit], {
        encoding: 'buffer',
        env: { LANG: 'C', LC_ALL: 'C', PATH: process.env.PATH ?? '' },
        maxBuffer: MAXIMUM_ARCHIVE_BYTES,
        windowsHide: true,
      });
      if (result.stderr.byteLength !== 0) derivationFailure('SOURCE_ARCHIVE_EXPORT_INVALID');
      return Buffer.from(result.stdout);
    } catch (error) {
      if (error instanceof PerformanceSourceDerivationError) throw error;
      derivationFailure('SOURCE_ARCHIVE_EXPORT_INVALID', error);
    }
  }
}

function tarString(block: Buffer, offset: number, length: number): string {
  const end = block.indexOf(0, offset);
  const upper = end >= offset && end < offset + length ? end : offset + length;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(block.subarray(offset, upper));
  } catch (error) {
    derivationFailure('SOURCE_ARCHIVE_ENTRY_INVALID', error);
  }
}

function tarOctal(block: Buffer, offset: number, length: number): number {
  const value = tarString(block, offset, length).trim();
  if (!/^[0-7]+$/u.test(value)) derivationFailure('SOURCE_ARCHIVE_ENTRY_INVALID');
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) derivationFailure('SOURCE_ARCHIVE_ENTRY_INVALID');
  return parsed;
}

function tarChecksum(block: Buffer): number {
  let total = 0;
  for (let index = 0; index < TAR_BLOCK_BYTES; index += 1) {
    total += index >= 148 && index < 156 ? 0x20 : (block[index] ?? 0);
  }
  return total;
}

/** Parses the bounded ustar subset emitted by `git archive`; link and extension entries remain explicit failures. */
export class UstarPerformanceSourceArchiveAdapter implements PerformanceSourceArchivePort {
  public parse(archive: Buffer): readonly PerformanceArchiveEntry[] {
    if (
      archive.byteLength === 0 ||
      archive.byteLength > MAXIMUM_ARCHIVE_BYTES ||
      archive.byteLength % TAR_BLOCK_BYTES !== 0
    ) {
      derivationFailure('SOURCE_ARCHIVE_INVALID');
    }
    const entries: PerformanceArchiveEntry[] = [];
    let offset = 0;
    while (offset + TAR_BLOCK_BYTES <= archive.byteLength) {
      const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES);
      if (header.every((byte) => byte === 0)) {
        if (!archive.subarray(offset).every((byte) => byte === 0)) {
          derivationFailure('SOURCE_ARCHIVE_TRAILING_DATA');
        }
        break;
      }
      if (tarOctal(header, 148, 8) !== tarChecksum(header)) derivationFailure('SOURCE_ARCHIVE_CHECKSUM_INVALID');
      const name = tarString(header, 0, 100);
      const prefix = tarString(header, 345, 155);
      const relativePath = prefix.length === 0 ? name : `${prefix}/${name}`;
      const mode = tarOctal(header, 100, 8) & 0o777;
      const size = tarOctal(header, 124, 12);
      const typeFlag = header[156] ?? 0;
      const type: PerformanceArchiveEntryType =
        typeFlag === 0 || typeFlag === 0x30
          ? 'file'
          : typeFlag === 0x35
            ? 'directory'
            : typeFlag === 0x32
              ? 'symbolicLink'
              : typeFlag === 0x31
                ? 'hardLink'
                : 'unsupported';
      if (size > MAXIMUM_ENTRY_BYTES || offset + TAR_BLOCK_BYTES + size > archive.byteLength) {
        derivationFailure('SOURCE_ARCHIVE_LIMIT_EXCEEDED');
      }
      const bytes = Buffer.from(archive.subarray(offset + TAR_BLOCK_BYTES, offset + TAR_BLOCK_BYTES + size));
      const nextOffset = offset + TAR_BLOCK_BYTES + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
      if (typeFlag === 0x67) {
        const paxRecord = bytes.toString('utf8');
        if (relativePath !== 'pax_global_header' || !/^\d+ comment=[a-f0-9]{40}\n$/u.test(paxRecord)) {
          derivationFailure('SOURCE_ARCHIVE_EXTENSION_INVALID');
        }
        offset = nextOffset;
        continue;
      }
      entries.push(Object.freeze({ relativePath, type, mode, bytes }));
      if (entries.length > MAXIMUM_ENTRY_COUNT) derivationFailure('SOURCE_ARCHIVE_LIMIT_EXCEEDED');
      offset = nextOffset;
    }
    if (entries.length === 0) derivationFailure('SOURCE_ARCHIVE_INVALID');
    return Object.freeze(entries);
  }
}

/** Writes only beneath one authenticated private root and cleans only trees it created exclusively. */
export class NodePerformanceDerivedSourceFilesystemAdapter implements PerformanceDerivedSourceFilesystemPort {
  public async authenticatePrivateRoot(privateRoot: string): Promise<string> {
    if (!path.isAbsolute(privateRoot)) derivationFailure('SOURCE_PRIVATE_ROOT_INVALID');
    const resolved = path.resolve(privateRoot);
    if (resolved === path.parse(resolved).root) derivationFailure('SOURCE_PRIVATE_ROOT_INVALID');
    try {
      const metadata = await lstat(resolved);
      const canonical = await realpath(resolved);
      if (!metadata.isDirectory() || metadata.isSymbolicLink() || canonical === path.parse(canonical).root) {
        derivationFailure('SOURCE_PRIVATE_ROOT_INVALID');
      }
      return canonical;
    } catch (error) {
      if (error instanceof PerformanceSourceDerivationError) throw error;
      derivationFailure('SOURCE_PRIVATE_ROOT_INVALID', error);
    }
  }

  public async createTreeExclusive(treeRoot: string): Promise<void> {
    await mkdir(treeRoot, { mode: 0o700, recursive: false }).catch((error: unknown) =>
      derivationFailure('SOURCE_DERIVED_TREE_EXISTS', error),
    );
  }

  public async writeDirectory(treeRoot: string, relativePath: string, mode: number): Promise<void> {
    const destination = path.join(treeRoot, ...relativePath.split('/'));
    assertContained(treeRoot, destination);
    await mkdir(destination, { mode, recursive: true }).catch((error: unknown) =>
      derivationFailure('SOURCE_DERIVED_TREE_WRITE_FAILED', error),
    );
  }

  public async writeFile(
    treeRoot: string,
    relativePath: string,
    bytes: Buffer,
    mode: number,
    replace: boolean,
  ): Promise<void> {
    const destination = path.join(treeRoot, ...relativePath.split('/'));
    assertContained(treeRoot, destination);
    await mkdir(path.dirname(destination), { mode: 0o700, recursive: true });
    if (replace) {
      const metadata = await lstat(destination).catch((error: unknown) =>
        derivationFailure('SOURCE_OVERLAY_TARGET_INVALID', error),
      );
      if (!metadata.isFile() || metadata.isSymbolicLink()) derivationFailure('SOURCE_OVERLAY_TARGET_INVALID');
    }
    await writeFile(destination, bytes, { flag: replace ? 'w' : 'wx', mode }).catch((error: unknown) =>
      derivationFailure('SOURCE_DERIVED_TREE_WRITE_FAILED', error),
    );
    if (process.platform !== 'win32') {
      await chmod(destination, mode).catch((error: unknown) =>
        derivationFailure('SOURCE_DERIVED_TREE_WRITE_FAILED', error),
      );
    }
  }

  public async readRegularFile(treeRoot: string, relativePath: string, maximumBytes: number): Promise<Buffer> {
    const destination = path.join(treeRoot, ...containedRelativePath(relativePath).split('/'));
    assertContained(treeRoot, destination);
    try {
      const before = await lstat(destination);
      if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > maximumBytes) {
        derivationFailure('SOURCE_DERIVED_FILE_INVALID');
      }
      const bytes = await readFile(destination);
      const after = await lstat(destination);
      if (
        !after.isFile() ||
        after.isSymbolicLink() ||
        bytes.byteLength !== before.size ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs
      ) {
        derivationFailure('SOURCE_DERIVED_FILE_CHANGED');
      }
      return bytes;
    } catch (error) {
      if (error instanceof PerformanceSourceDerivationError) throw error;
      derivationFailure('SOURCE_DERIVED_FILE_INVALID', error);
    }
  }

  public async removeCreatedTree(treeRoot: string): Promise<void> {
    await rm(treeRoot, { force: true, recursive: true }).catch((error: unknown) =>
      derivationFailure('SOURCE_DERIVATION_CLEANUP_FAILED', error),
    );
  }
}

/** Owns authenticated parent export, identical reviewed overlay application, and one-shot receipt finalization. */
export class PerformanceDerivedSourceProducer {
  private readonly overlayBytes: Buffer;
  private readonly overlaySha256: string;
  private readonly authorities = new WeakMap<PerformanceDerivedSourceAuthority, OwnedAuthorityState>();
  private deriving = false;

  public constructor(
    private readonly validator: LocalWhisperQualificationValidator,
    private readonly ports: Readonly<{
      readonly git: PerformanceDerivedSourceGitPort;
      readonly filesystem: PerformanceDerivedSourceFilesystemPort;
      readonly archive: PerformanceSourceArchivePort;
      readonly digest: PerformanceDigestPort;
    }>,
    reviewedOverlay: Readonly<{ readonly bytes: Buffer; readonly sha256: string }>,
  ) {
    if (
      !SHA256_PATTERN.test(reviewedOverlay.sha256) ||
      ports.digest.sha256(reviewedOverlay.bytes) !== reviewedOverlay.sha256
    ) {
      derivationFailure('SOURCE_OVERLAY_IDENTITY_INVALID');
    }
    this.overlayBytes = Buffer.from(reviewedOverlay.bytes);
    this.overlaySha256 = reviewedOverlay.sha256;
  }

  public async derive(
    input: Readonly<{
      readonly privateRoot: string;
      readonly parentRoot: string;
      readonly parentCommit: string;
      readonly destinationName: string;
      readonly sourceProofDigest: string;
      readonly side: PerformanceSide;
      readonly signal?: AbortSignal;
    }>,
  ): Promise<PerformanceDerivedSourceAuthority> {
    if (this.deriving) derivationFailure('SOURCE_DERIVATION_ALREADY_ACTIVE');
    this.deriving = true;
    let treeRoot: string | null = null;
    let created = false;
    try {
      this.validateInput(input);
      throwIfCancelled(input.signal);
      const privateRoot = await this.ports.filesystem.authenticatePrivateRoot(input.privateRoot);
      treeRoot = path.resolve(privateRoot, input.destinationName);
      assertContained(privateRoot, treeRoot);
      await this.verifyParent(input.parentRoot, input.parentCommit);
      const sourceArchive = await this.ports.git.exportTrackedArchive(input.parentRoot, input.parentCommit);
      throwIfCancelled(input.signal);
      const baseEntries = this.normalizeEntries(this.ports.archive.parse(sourceArchive), false);
      const overlayEntries = this.normalizeEntries(this.ports.archive.parse(this.overlayBytes), true);
      const finalEntries = this.mergeEntries(baseEntries, overlayEntries);
      await this.ports.filesystem.createTreeExclusive(treeRoot);
      created = true;
      await this.writeEntries(treeRoot, baseEntries, new Set());
      await this.writeEntries(
        treeRoot,
        overlayEntries,
        new Set(baseEntries.filter(({ type }) => type === 'file').map(({ relativePath }) => relativePath)),
      );
      throwIfCancelled(input.signal);
      const verifiedEntries = await this.verifyWrittenTree(treeRoot, finalEntries);
      await this.verifyParent(input.parentRoot, input.parentCommit);
      const manifest = verifiedEntries.map(({ relativePath, type, mode, bytes, sha256 }) => ({
        relativePath,
        type,
        mode,
        sizeBytes: bytes.byteLength,
        sha256,
      }));
      const authority = Object.freeze({
        rootPath: treeRoot,
        side: input.side,
        parentCommit: input.parentCommit,
        sourceProofDigest: input.sourceProofDigest,
        instrumentationOverlaySha256: this.overlaySha256,
        derivedTreeManifestSha256: this.ports.digest.sha256(JSON.stringify(manifest)),
      });
      this.authorities.set(authority, { authority, parentRoot: input.parentRoot, status: 'ready' });
      return authority;
    } catch (error) {
      if (created && treeRoot) {
        try {
          await this.ports.filesystem.removeCreatedTree(treeRoot);
        } catch (cleanupError) {
          derivationFailure('SOURCE_DERIVATION_CLEANUP_FAILED', cleanupError);
        }
      }
      if (error instanceof PerformanceSourceDerivationError) throw error;
      derivationFailure('SOURCE_DERIVATION_FAILED', error);
    } finally {
      this.deriving = false;
    }
  }

  public async bindExecutable(
    authority: PerformanceDerivedSourceAuthority,
    executableRelativePath: string,
  ): Promise<PerformanceDerivedSourceReceipt> {
    const state = this.authorities.get(authority);
    if (!state || state.authority !== authority || state.status !== 'ready') {
      derivationFailure('SOURCE_DERIVATION_AUTHORITY_INVALID');
    }
    state.status = 'binding';
    try {
      const relativePath = containedRelativePath(executableRelativePath);
      await this.verifyParent(state.parentRoot, authority.parentCommit);
      const bytes = await this.ports.filesystem.readRegularFile(
        authority.rootPath,
        relativePath,
        MAXIMUM_EXECUTABLE_BYTES,
      );
      const receipt = new LocalWhisperPerformanceDocumentProducer(this.validator).produceDerivedSourceReceipt({
        side: authority.side,
        parentCommit: authority.parentCommit,
        sourceProofDigest: authority.sourceProofDigest,
        instrumentationOverlaySha256: authority.instrumentationOverlaySha256,
        derivedTreeManifestSha256: authority.derivedTreeManifestSha256,
        executableArtifactIdentity: Object.freeze({
          sizeBytes: bytes.byteLength,
          sha256: this.ports.digest.sha256(bytes),
        }),
      });
      state.status = 'finalized';
      return receipt;
    } catch (error) {
      state.status = 'invalid';
      this.authorities.delete(authority);
      try {
        await this.ports.filesystem.removeCreatedTree(authority.rootPath);
      } catch (cleanupError) {
        derivationFailure('SOURCE_DERIVATION_CLEANUP_FAILED', cleanupError);
      }
      if (error instanceof PerformanceSourceDerivationError) throw error;
      derivationFailure('SOURCE_EXECUTABLE_BINDING_FAILED', error);
    }
  }

  private validateInput(
    input: Readonly<{
      readonly parentCommit: string;
      readonly destinationName: string;
      readonly sourceProofDigest: string;
      readonly side: PerformanceSide;
    }>,
  ): void {
    if (
      !COMMIT_PATTERN.test(input.parentCommit) ||
      !SHA256_PATTERN.test(input.sourceProofDigest) ||
      !DESTINATION_NAME_PATTERN.test(input.destinationName) ||
      !['before', 'after'].includes(input.side)
    ) {
      derivationFailure('SOURCE_DERIVATION_INPUT_INVALID');
    }
  }

  private async verifyParent(parentRoot: string, expectedCommit: string): Promise<void> {
    const identity = await this.ports.git.inspect(parentRoot);
    if (!identity.clean || identity.headCommit !== expectedCommit) derivationFailure('SOURCE_PARENT_IDENTITY_INVALID');
  }

  private normalizeEntries(entries: readonly PerformanceArchiveEntry[], overlay: boolean): readonly NormalizedEntry[] {
    if (entries.length === 0 || entries.length > MAXIMUM_ENTRY_COUNT)
      derivationFailure('SOURCE_ARCHIVE_LIMIT_EXCEEDED');
    const exact = new Set<string>();
    const caseFolded = new Set<string>();
    let totalBytes = 0;
    const normalized = entries.map((entry) => {
      const relativePath = containedRelativePath(entry.relativePath.replace(/\/$/u, ''));
      const folded = relativePath.toLocaleLowerCase('en-US');
      if (exact.has(relativePath) || caseFolded.has(folded)) derivationFailure('SOURCE_ARCHIVE_COLLISION');
      if (entry.type !== 'file' && entry.type !== 'directory') derivationFailure('SOURCE_ARCHIVE_LINK_REJECTED');
      if (!Number.isInteger(entry.mode) || entry.mode < 0 || entry.mode > 0o777) {
        derivationFailure('SOURCE_ARCHIVE_ENTRY_INVALID');
      }
      if (
        (entry.type === 'directory' && entry.bytes.byteLength !== 0) ||
        entry.bytes.byteLength > MAXIMUM_ENTRY_BYTES
      ) {
        derivationFailure('SOURCE_ARCHIVE_ENTRY_INVALID');
      }
      exact.add(relativePath);
      caseFolded.add(folded);
      totalBytes += entry.bytes.byteLength;
      if (totalBytes > MAXIMUM_TREE_BYTES) derivationFailure('SOURCE_ARCHIVE_LIMIT_EXCEEDED');
      return Object.freeze({
        relativePath,
        type: entry.type,
        mode: entry.mode,
        bytes: Buffer.from(entry.bytes),
        sha256: this.ports.digest.sha256(entry.bytes),
      });
    });
    if (overlay && normalized.some(({ relativePath }) => relativePath === '.git' || relativePath.startsWith('.git/'))) {
      derivationFailure('SOURCE_OVERLAY_ENTRY_INVALID');
    }
    return Object.freeze(normalized.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en')));
  }

  private mergeEntries(
    base: readonly NormalizedEntry[],
    overlay: readonly NormalizedEntry[],
  ): readonly NormalizedEntry[] {
    const merged = new Map(base.map((entry) => [entry.relativePath, entry]));
    const folded = new Map(base.map((entry) => [entry.relativePath.toLocaleLowerCase('en-US'), entry.relativePath]));
    for (const entry of overlay) {
      const collision = folded.get(entry.relativePath.toLocaleLowerCase('en-US'));
      if (collision && collision !== entry.relativePath) derivationFailure('SOURCE_ARCHIVE_COLLISION');
      const existing = merged.get(entry.relativePath);
      if (existing && existing.type !== entry.type) derivationFailure('SOURCE_OVERLAY_TARGET_INVALID');
      merged.set(entry.relativePath, entry);
      folded.set(entry.relativePath.toLocaleLowerCase('en-US'), entry.relativePath);
    }
    return Object.freeze(
      [...merged.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en')),
    );
  }

  private async writeEntries(
    treeRoot: string,
    entries: readonly NormalizedEntry[],
    replaceableFiles: ReadonlySet<string>,
  ): Promise<void> {
    for (const entry of entries) {
      if (entry.type === 'directory') {
        await this.ports.filesystem.writeDirectory(treeRoot, entry.relativePath, entry.mode);
      } else {
        await this.ports.filesystem.writeFile(
          treeRoot,
          entry.relativePath,
          entry.bytes,
          entry.mode,
          replaceableFiles.has(entry.relativePath),
        );
      }
    }
  }

  private async verifyWrittenTree(
    treeRoot: string,
    entries: readonly NormalizedEntry[],
  ): Promise<readonly NormalizedEntry[]> {
    for (const entry of entries) {
      if (entry.type !== 'file') continue;
      const bytes = await this.ports.filesystem.readRegularFile(treeRoot, entry.relativePath, MAXIMUM_ENTRY_BYTES);
      if (bytes.byteLength !== entry.bytes.byteLength || this.ports.digest.sha256(bytes) !== entry.sha256) {
        derivationFailure('SOURCE_DERIVED_TREE_IDENTITY_INVALID');
      }
    }
    return entries;
  }
}
