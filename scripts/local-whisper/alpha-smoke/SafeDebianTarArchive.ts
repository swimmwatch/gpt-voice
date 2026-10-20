import { createHash, type Hash } from 'node:crypto';
import path from 'node:path';

import type { LinuxPackageFileIdentity } from './LinuxAlphaPackageVerifier';

const TAR_BLOCK_BYTES = 512;
const TAR_NAME_OFFSET = 0;
const TAR_NAME_LENGTH = 100;
const TAR_MODE_OFFSET = 100;
const TAR_MODE_LENGTH = 8;
const TAR_SIZE_OFFSET = 124;
const TAR_SIZE_LENGTH = 12;
const TAR_CHECKSUM_OFFSET = 148;
const TAR_CHECKSUM_LENGTH = 8;
const TAR_TYPE_OFFSET = 156;
const TAR_LINK_OFFSET = 157;
const TAR_LINK_LENGTH = 100;
const TAR_PREFIX_OFFSET = 345;
const TAR_PREFIX_LENGTH = 155;
const MAX_STREAMING_TAR_BYTES = 8 * 1024 * 1024 * 1024;

interface SafeTarEntry {
  readonly bytes: Buffer | null;
  readonly kind: 'directory' | 'file' | 'symlink';
  readonly mode: number;
  readonly path: string;
  readonly linkTarget: string | null;
}

interface StreamingTarEntry {
  readonly hash: Hash | null;
  readonly kind: SafeTarEntry['kind'];
  readonly linkTarget: string | null;
  readonly mode: number;
  readonly path: string;
  paddingBytesRemaining: number;
  payloadBytesRemaining: number;
}

function fail(code: string): never {
  throw new Error(`ALPHA_SMOKE_LINUX_ARCHIVE_${code}`);
}

function isZeroBlock(bytes: Buffer): boolean {
  return bytes.every((value) => value === 0);
}

function readField(bytes: Buffer, offset: number, length: number): string {
  const value = bytes.subarray(offset, offset + length);
  const nullIndex = value.indexOf(0);
  return value.subarray(0, nullIndex === -1 ? value.length : nullIndex).toString('utf8');
}

function parseOctal(bytes: Buffer, offset: number, length: number): number {
  const text = readField(bytes, offset, length).trim();
  if (!/^[0-7]+$/u.test(text)) fail('HEADER_INVALID');
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) fail('HEADER_INVALID');
  return value;
}

function assertHeaderChecksum(header: Buffer): void {
  const expected = parseOctal(header, TAR_CHECKSUM_OFFSET, TAR_CHECKSUM_LENGTH);
  let actual = 0;
  for (let index = 0; index < TAR_BLOCK_BYTES; index += 1) {
    actual +=
      index >= TAR_CHECKSUM_OFFSET && index < TAR_CHECKSUM_OFFSET + TAR_CHECKSUM_LENGTH
        ? ' '.charCodeAt(0)
        : header[index];
  }
  if (actual !== expected) fail('CHECKSUM_INVALID');
}

function normalizeEntryPath(value: string, isDirectory: boolean): string {
  const withoutPrefix = value.startsWith('./') ? value.slice(2) : value;
  const withoutTrailingDirectorySeparator =
    isDirectory && withoutPrefix.endsWith('/') ? withoutPrefix.slice(0, -1) : withoutPrefix;
  if (withoutTrailingDirectorySeparator.length === 0 && (value === '.' || value === './')) return '.';
  if (
    withoutTrailingDirectorySeparator.length === 0 ||
    withoutTrailingDirectorySeparator.includes('\0') ||
    path.posix.isAbsolute(withoutTrailingDirectorySeparator) ||
    withoutTrailingDirectorySeparator
      .split('/')
      .some((segment) => segment === '' || segment === '.' || segment === '..') ||
    path.posix.normalize(withoutTrailingDirectorySeparator) !== withoutTrailingDirectorySeparator
  ) {
    fail('PATH_INVALID');
  }
  return withoutTrailingDirectorySeparator;
}

function assertRelativeSymlink(entryPath: string, target: string): void {
  if (
    target.length === 0 ||
    target.includes('\0') ||
    path.posix.isAbsolute(target) ||
    target.split('/').some((segment) => segment.length === 0)
  ) {
    fail('LINK_INVALID');
  }
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(entryPath), target));
  if (resolved === '..' || resolved.startsWith('../')) fail('LINK_INVALID');
}

function readSafeTarEntry(header: Buffer, entryPath: string, mode: number, payload: Buffer): SafeTarEntry {
  const type = header[TAR_TYPE_OFFSET];
  if (type === 0 || type === '0'.charCodeAt(0)) {
    if (entryPath === '.') fail('PATH_INVALID');
    return Object.freeze({ bytes: Buffer.from(payload), kind: 'file', linkTarget: null, mode, path: entryPath });
  }
  if (type === '5'.charCodeAt(0)) {
    if (payload.length !== 0) fail('DIRECTORY_INVALID');
    return Object.freeze({ bytes: null, kind: 'directory', linkTarget: null, mode, path: entryPath });
  }
  if (type === '2'.charCodeAt(0)) {
    if (entryPath === '.' || payload.length !== 0) fail('LINK_INVALID');
    const linkTarget = readField(header, TAR_LINK_OFFSET, TAR_LINK_LENGTH);
    assertRelativeSymlink(entryPath, linkTarget);
    return Object.freeze({ bytes: null, kind: 'symlink', linkTarget, mode, path: entryPath });
  }
  return fail('ENTRY_TYPE_INVALID');
}

/** Parses bounded Debian tar records without extracting them to the host filesystem. */
export function parseSafeDebianTarArchive(bytes: Buffer): readonly SafeTarEntry[] {
  if (bytes.length === 0 || bytes.length % TAR_BLOCK_BYTES !== 0) fail('STREAM_INVALID');
  const entries: SafeTarEntry[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let terminated = false;
  while (offset < bytes.length) {
    const header = bytes.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (isZeroBlock(header)) {
      if (
        offset + TAR_BLOCK_BYTES >= bytes.length ||
        !isZeroBlock(bytes.subarray(offset + TAR_BLOCK_BYTES, offset + 2 * TAR_BLOCK_BYTES))
      ) {
        fail('TERMINATOR_INVALID');
      }
      if (!isZeroBlock(bytes.subarray(offset))) fail('TRAILING_BYTES_INVALID');
      terminated = true;
      break;
    }
    assertHeaderChecksum(header);
    const name = readField(header, TAR_NAME_OFFSET, TAR_NAME_LENGTH);
    const prefix = readField(header, TAR_PREFIX_OFFSET, TAR_PREFIX_LENGTH);
    const type = header[TAR_TYPE_OFFSET];
    const entryPath = normalizeEntryPath(prefix.length === 0 ? name : `${prefix}/${name}`, type === '5'.charCodeAt(0));
    if (entryPath !== '.') {
      if (seen.has(entryPath)) fail('DUPLICATE_PATH');
      seen.add(entryPath);
    }
    const mode = parseOctal(header, TAR_MODE_OFFSET, TAR_MODE_LENGTH);
    if ((mode & 0o6000) !== 0) fail('MODE_INVALID');
    const payloadLength = parseOctal(header, TAR_SIZE_OFFSET, TAR_SIZE_LENGTH);
    const payloadStart = offset + TAR_BLOCK_BYTES;
    const payloadEnd = payloadStart + payloadLength;
    if (payloadEnd > bytes.length) fail('PAYLOAD_INVALID');
    const payload = bytes.subarray(payloadStart, payloadEnd);
    entries.push(readSafeTarEntry(header, entryPath, mode, payload));
    const nextOffset = Math.ceil(payloadEnd / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    if (!isZeroBlock(bytes.subarray(payloadEnd, nextOffset))) fail('PADDING_INVALID');
    offset = nextOffset;
  }
  if (!terminated || entries.length === 0) fail('TERMINATOR_INVALID');
  return Object.freeze(entries);
}

/** Builds the Debian data archive inventory without retaining multi-gigabyte file payloads. */
export class DebianDataTarInventoryCollector {
  private readonly entries: LinuxPackageFileIdentity[] = [];
  private readonly seen = new Set<string>();
  private activeEntry: StreamingTarEntry | null = null;
  private entryCount = 0;
  private pending = Buffer.alloc(0);
  private terminated = false;
  private totalBytes = 0;
  private zeroBlockCount = 0;

  public write(chunk: Buffer): void {
    if (chunk.length === 0) return;
    this.totalBytes += chunk.length;
    if (this.totalBytes > MAX_STREAMING_TAR_BYTES) fail('STREAM_TOO_LARGE');
    const bytes = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    this.pending = Buffer.alloc(0);
    let offset = 0;

    while (offset < bytes.length) {
      if (this.terminated) {
        if (!isZeroBlock(bytes.subarray(offset))) fail('TRAILING_BYTES_INVALID');
        offset = bytes.length;
        continue;
      }
      if (this.activeEntry !== null) {
        offset = this.consumeActiveEntry(bytes, offset);
        continue;
      }
      if (bytes.length - offset < TAR_BLOCK_BYTES) break;
      const header = bytes.subarray(offset, offset + TAR_BLOCK_BYTES);
      offset += TAR_BLOCK_BYTES;
      if (isZeroBlock(header)) {
        this.zeroBlockCount += 1;
        if (this.zeroBlockCount === 2) this.terminated = true;
        continue;
      }
      if (this.zeroBlockCount !== 0) fail('TERMINATOR_INVALID');
      this.activeEntry = this.parseHeader(header);
      if (this.activeEntry.payloadBytesRemaining === 0 && this.activeEntry.paddingBytesRemaining === 0) {
        this.finishActiveEntry();
      }
    }
    if (offset < bytes.length) this.pending = Buffer.from(bytes.subarray(offset));
  }

  public finish(): readonly LinuxPackageFileIdentity[] {
    if (
      this.pending.length !== 0 ||
      this.activeEntry !== null ||
      !this.terminated ||
      this.entryCount === 0 ||
      this.totalBytes % TAR_BLOCK_BYTES !== 0
    ) {
      fail('TERMINATOR_INVALID');
    }
    return Object.freeze([...this.entries].sort((left, right) => left.path.localeCompare(right.path, 'en')));
  }

  private consumeActiveEntry(bytes: Buffer, offset: number): number {
    const entry = this.activeEntry!;
    if (entry.payloadBytesRemaining > 0) {
      const length = Math.min(entry.payloadBytesRemaining, bytes.length - offset);
      if (length === 0) return offset;
      entry.hash!.update(bytes.subarray(offset, offset + length));
      entry.payloadBytesRemaining -= length;
      offset += length;
    }
    if (entry.payloadBytesRemaining === 0 && entry.paddingBytesRemaining > 0 && offset < bytes.length) {
      const length = Math.min(entry.paddingBytesRemaining, bytes.length - offset);
      if (!isZeroBlock(bytes.subarray(offset, offset + length))) fail('PADDING_INVALID');
      entry.paddingBytesRemaining -= length;
      offset += length;
    }
    if (entry.payloadBytesRemaining === 0 && entry.paddingBytesRemaining === 0) this.finishActiveEntry();
    return offset;
  }

  private finishActiveEntry(): void {
    const entry = this.activeEntry!;
    if (entry.path !== '.' && entry.kind !== 'directory') {
      this.entries.push(
        Object.freeze({
          kind: entry.kind,
          mode: entry.mode,
          path: `/${entry.path}`,
          value: entry.kind === 'file' ? entry.hash!.digest('hex') : entry.linkTarget!,
        }),
      );
    }
    this.activeEntry = null;
  }

  private parseHeader(header: Buffer): StreamingTarEntry {
    assertHeaderChecksum(header);
    const type = header[TAR_TYPE_OFFSET];
    const kind =
      type === 0 || type === '0'.charCodeAt(0)
        ? 'file'
        : type === '5'.charCodeAt(0)
          ? 'directory'
          : type === '2'.charCodeAt(0)
            ? 'symlink'
            : null;
    if (kind === null) fail('ENTRY_TYPE_INVALID');
    const name = readField(header, TAR_NAME_OFFSET, TAR_NAME_LENGTH);
    const prefix = readField(header, TAR_PREFIX_OFFSET, TAR_PREFIX_LENGTH);
    const entryPath = normalizeEntryPath(prefix.length === 0 ? name : `${prefix}/${name}`, kind === 'directory');
    if (entryPath === '.' && kind !== 'directory') fail('PATH_INVALID');
    if (entryPath !== '.') {
      if (this.seen.has(entryPath)) fail('DUPLICATE_PATH');
      this.seen.add(entryPath);
      this.entryCount += 1;
    }
    const mode = parseOctal(header, TAR_MODE_OFFSET, TAR_MODE_LENGTH);
    if ((mode & 0o6000) !== 0) fail('MODE_INVALID');
    const payloadLength = parseOctal(header, TAR_SIZE_OFFSET, TAR_SIZE_LENGTH);
    if (kind !== 'file' && payloadLength !== 0) {
      fail(kind === 'directory' ? 'DIRECTORY_INVALID' : 'LINK_INVALID');
    }
    const linkTarget = kind === 'symlink' ? readField(header, TAR_LINK_OFFSET, TAR_LINK_LENGTH) : null;
    if (kind === 'symlink') assertRelativeSymlink(entryPath, linkTarget!);
    return {
      hash: kind === 'file' ? createHash('sha256') : null,
      kind,
      linkTarget,
      mode,
      path: entryPath,
      paddingBytesRemaining: (TAR_BLOCK_BYTES - (payloadLength % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES,
      payloadBytesRemaining: payloadLength,
    };
  }
}

export function packageFilesFromDebianDataTar(bytes: Buffer): readonly LinuxPackageFileIdentity[] {
  return Object.freeze(
    parseSafeDebianTarArchive(bytes)
      .flatMap((entry): readonly LinuxPackageFileIdentity[] => {
        if (entry.kind === 'directory') return [];
        return [
          Object.freeze({
            kind: entry.kind,
            mode: entry.mode,
            path: `/${entry.path}`,
            value: entry.kind === 'file' ? createHash('sha256').update(entry.bytes!).digest('hex') : entry.linkTarget!,
          }),
        ];
      })
      .sort((left, right) => left.path.localeCompare(right.path, 'en')),
  );
}

export function conffilesFromDebianControlTar(bytes: Buffer): readonly string[] {
  const entry = parseSafeDebianTarArchive(bytes).find(
    (candidate) => candidate.kind === 'file' && candidate.path === 'conffiles',
  );
  if (!entry) return Object.freeze([]);
  const values = entry
    .bytes!.toString('utf8')
    .split('\n')
    .filter((value) => value.length > 0);
  if (values.some((value) => !value.startsWith('/') || value.includes('\0'))) fail('CONFFILES_INVALID');
  if (new Set(values).size !== values.length) fail('CONFFILES_INVALID');
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right, 'en')));
}
