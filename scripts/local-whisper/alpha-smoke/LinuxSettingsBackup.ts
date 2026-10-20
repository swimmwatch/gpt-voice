import { createHash, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { userInfo } from 'node:os';
import path from 'node:path';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';

export const LINUX_SETTINGS_BACKUP_FILES = Object.freeze([
  'claude-web-settings.json',
  'cloakbrowser-settings.json',
  'config.json',
  'local-whisper/settings.json',
  'openai-api-settings.json',
  'prettify-provider-settings.json',
] as const);

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const READ_BUFFER_BYTES = 64 * 1024;
const RECEIPT_FILE_NAME = 'settings-backup-receipt.json';
const RECEIPT_SCHEMA_VERSION = 1;
const SAFE_ATTEMPT_ID_PATTERN = /^[a-z\d][a-z\d-]{0,63}$/u;
const SHA256_PATTERN = /^[a-f\d]{64}$/u;

interface FileIdentity {
  readonly device: number;
  readonly inode: number;
  readonly mode: number;
  readonly modifiedMilliseconds: number;
  readonly size: number;
  readonly userId: number;
}

interface LinuxSettingsBackupEntry {
  readonly backupMode: number | null;
  readonly backupModifiedMilliseconds: number | null;
  readonly length: number | null;
  readonly relativePath: (typeof LINUX_SETTINGS_BACKUP_FILES)[number];
  readonly sha256: string | null;
  readonly sourceMode: number | null;
  readonly sourceModifiedMilliseconds: number | null;
  readonly status: 'backed-up' | 'missing';
}

interface LinuxSettingsBackupReceipt {
  readonly attemptId: string;
  readonly createdAtEpochMilliseconds: number;
  readonly entries: readonly LinuxSettingsBackupEntry[];
  readonly schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  readonly status: 'retained-private';
}

function fail(code: string): never {
  throw new Error(`ALPHA_SMOKE_LINUX_SETTINGS_BACKUP_${code}`);
}

function identityOf(
  metadata: Readonly<{ dev: number; ino: number; mode: number; mtimeMs: number; size: number; uid: number }>,
): FileIdentity {
  return Object.freeze({
    device: metadata.dev,
    inode: metadata.ino,
    mode: metadata.mode,
    modifiedMilliseconds: metadata.mtimeMs,
    size: metadata.size,
    userId: metadata.uid,
  });
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.mode === right.mode &&
    left.modifiedMilliseconds === right.modifiedMilliseconds &&
    left.size === right.size &&
    left.userId === right.userId
  );
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function parseReceipt(value: unknown): LinuxSettingsBackupReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('RECEIPT_INVALID');
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'attemptId,createdAtEpochMilliseconds,entries,schemaVersion,status' ||
    typeof record.attemptId !== 'string' ||
    !SAFE_ATTEMPT_ID_PATTERN.test(record.attemptId) ||
    typeof record.createdAtEpochMilliseconds !== 'number' ||
    !Number.isSafeInteger(record.createdAtEpochMilliseconds) ||
    record.createdAtEpochMilliseconds <= 0 ||
    record.schemaVersion !== RECEIPT_SCHEMA_VERSION ||
    record.status !== 'retained-private' ||
    !Array.isArray(record.entries) ||
    record.entries.length !== LINUX_SETTINGS_BACKUP_FILES.length
  ) {
    fail('RECEIPT_INVALID');
  }
  const entries = record.entries.map((entry): LinuxSettingsBackupEntry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('RECEIPT_INVALID');
    const item = entry as Record<string, unknown>;
    if (
      Object.keys(item).sort().join(',') !==
        'backupMode,backupModifiedMilliseconds,length,relativePath,sha256,sourceMode,sourceModifiedMilliseconds,status' ||
      !LINUX_SETTINGS_BACKUP_FILES.includes(item.relativePath as (typeof LINUX_SETTINGS_BACKUP_FILES)[number]) ||
      (item.status !== 'backed-up' && item.status !== 'missing')
    ) {
      fail('RECEIPT_INVALID');
    }
    if (item.status === 'missing') {
      if (
        item.backupMode !== null ||
        item.backupModifiedMilliseconds !== null ||
        item.length !== null ||
        item.sha256 !== null ||
        item.sourceMode !== null ||
        item.sourceModifiedMilliseconds !== null
      ) {
        fail('RECEIPT_INVALID');
      }
    } else if (
      item.backupMode !== 0o600 ||
      typeof item.backupModifiedMilliseconds !== 'number' ||
      !Number.isFinite(item.backupModifiedMilliseconds) ||
      item.backupModifiedMilliseconds < 0 ||
      typeof item.length !== 'number' ||
      !Number.isSafeInteger(item.length) ||
      item.length < 0 ||
      item.length > MAX_FILE_BYTES ||
      typeof item.sha256 !== 'string' ||
      !SHA256_PATTERN.test(item.sha256) ||
      typeof item.sourceMode !== 'number' ||
      !Number.isSafeInteger(item.sourceMode) ||
      item.sourceMode < 0 ||
      item.sourceMode > 0o7777 ||
      typeof item.sourceModifiedMilliseconds !== 'number' ||
      !Number.isFinite(item.sourceModifiedMilliseconds) ||
      item.sourceModifiedMilliseconds < 0
    ) {
      fail('RECEIPT_INVALID');
    }
    return Object.freeze({
      backupMode: item.backupMode,
      backupModifiedMilliseconds: item.backupModifiedMilliseconds,
      length: item.length,
      relativePath: item.relativePath as LinuxSettingsBackupEntry['relativePath'],
      sha256: item.sha256,
      sourceMode: item.sourceMode,
      sourceModifiedMilliseconds: item.sourceModifiedMilliseconds,
      status: item.status,
    });
  });
  const sorted = [...entries].sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en'));
  if (sorted.some((entry, index) => entry.relativePath !== LINUX_SETTINGS_BACKUP_FILES[index])) {
    fail('RECEIPT_INVALID');
  }
  const total = sorted.reduce((sum, entry) => sum + (entry.length ?? 0), 0);
  if (total > MAX_TOTAL_BYTES) fail('RECEIPT_INVALID');
  return Object.freeze({
    attemptId: record.attemptId,
    createdAtEpochMilliseconds: record.createdAtEpochMilliseconds,
    entries: Object.freeze(sorted),
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    status: 'retained-private',
  });
}

/** Creates and revalidates one retained private copy of the closed settings-only allowlist. */
export class LinuxSettingsBackup {
  private readonly userId = userInfo().uid;
  private backupFilesystem: LinuxAlphaSmokeFilesystem | null = null;
  private sourceFilesystem: LinuxAlphaSmokeFilesystem | null = null;

  public constructor(
    private readonly dependencies: Readonly<{
      backupRoot: string;
      now?: () => number;
      sourceRoot: string;
    }>,
  ) {}

  public async create(attemptId: string): Promise<'retained-private'> {
    try {
      await this.assertBackupRoot(true);
      this.backupFilesystem = await LinuxAlphaSmokeFilesystem.openRoot(this.dependencies.backupRoot);
      if (await this.assertSourceRoot())
        this.sourceFilesystem = await LinuxAlphaSmokeFilesystem.openRoot(this.dependencies.sourceRoot, false);
      const result = await this.createInternal(attemptId);
      await this.backupFilesystem.revalidate();
      await this.sourceFilesystem?.revalidate();
      return result;
    } catch (error) {
      this.rethrowSanitized(error);
    } finally {
      await this.disposeFilesystems();
    }
  }

  public async verifyRetained(expectedAttemptId: string): Promise<'retained-private'> {
    try {
      await this.assertBackupRoot(false);
      this.backupFilesystem = await LinuxAlphaSmokeFilesystem.openRoot(this.dependencies.backupRoot);
      const result = await this.verifyRetainedInternal(expectedAttemptId);
      await this.backupFilesystem.revalidate();
      return result;
    } catch (error) {
      this.rethrowSanitized(error);
    } finally {
      await this.disposeFilesystems();
    }
  }

  private async disposeFilesystems(): Promise<void> {
    await Promise.all([this.backupFilesystem?.dispose(), this.sourceFilesystem?.dispose()]);
    this.backupFilesystem = null;
    this.sourceFilesystem = null;
  }

  private filesystem(kind: 'backup' | 'source'): LinuxAlphaSmokeFilesystem {
    const filesystem = kind === 'backup' ? this.backupFilesystem : this.sourceFilesystem;
    if (!filesystem) fail('ROOT_UNAVAILABLE');
    return filesystem;
  }

  private async createInternal(attemptId: string): Promise<'retained-private'> {
    if (!SAFE_ATTEMPT_ID_PATTERN.test(attemptId)) fail('ATTEMPT_ID_INVALID');
    await this.assertBackupRoot(true);
    const sourceAvailable = await this.assertSourceRoot();
    const entries: LinuxSettingsBackupEntry[] = [];
    let total = 0;
    for (const relativePath of LINUX_SETTINGS_BACKUP_FILES) {
      const entry = sourceAvailable ? await this.copySourceEntry(relativePath, total) : this.missingEntry(relativePath);
      entries.push(entry);
      total += entry.length ?? 0;
      if (total > MAX_TOTAL_BYTES) fail('TOTAL_TOO_LARGE');
    }
    const receipt: LinuxSettingsBackupReceipt = Object.freeze({
      attemptId,
      createdAtEpochMilliseconds: (this.dependencies.now ?? Date.now)(),
      entries: Object.freeze(entries),
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      status: 'retained-private',
    });
    await this.writeReceipt(receipt);
    await this.verifyRetainedInternal(attemptId);
    return 'retained-private';
  }

  private async verifyRetainedInternal(expectedAttemptId: string): Promise<'retained-private'> {
    if (!SAFE_ATTEMPT_ID_PATTERN.test(expectedAttemptId)) fail('ATTEMPT_ID_INVALID');
    await this.assertBackupRoot(false);
    const receipt = await this.readReceipt();
    if (receipt.attemptId !== expectedAttemptId) fail('RECEIPT_ATTEMPT_MISMATCH');
    const expectedFiles = new Set<string>([RECEIPT_FILE_NAME]);
    for (const entry of receipt.entries) {
      if (entry.status === 'missing') continue;
      expectedFiles.add(entry.relativePath);
      await this.verifyBackupEntry(entry);
    }
    const expectedDirectories = new Set(
      [...expectedFiles].map((file) => path.dirname(file)).filter((directory) => directory !== '.'),
    );
    await this.assertClosedInventory(this.filesystem('backup').directoryPath(), '', expectedFiles, expectedDirectories);
    return 'retained-private';
  }

  private rethrowSanitized(error: unknown): never {
    if (error instanceof Error && /^ALPHA_SMOKE_LINUX_SETTINGS_BACKUP_[A-Z_]+$/u.test(error.message)) throw error;
    fail('OPERATION_FAILED');
  }

  private async assertSourceRoot(): Promise<boolean> {
    const metadata = await lstat(this.dependencies.sourceRoot).catch((error: unknown) => {
      if (isNotFound(error)) return null;
      throw error;
    });
    if (metadata === null) return false;
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.uid !== this.userId)
      fail('SOURCE_ROOT_INVALID');
    return true;
  }

  private async copySourceEntry(
    relativePath: LinuxSettingsBackupEntry['relativePath'],
    currentTotal: number,
  ): Promise<LinuxSettingsBackupEntry> {
    if (!(await this.assertSourceParents(relativePath))) {
      return this.missingEntry(relativePath);
    }
    const sourcePath = await this.filesystem('source').resolve(relativePath);
    const linkMetadata = await lstat(sourcePath).catch((error: unknown) => {
      if (isNotFound(error)) return null;
      throw error;
    });
    if (linkMetadata === null) {
      return this.missingEntry(relativePath);
    }
    if (
      !linkMetadata.isFile() ||
      linkMetadata.isSymbolicLink() ||
      linkMetadata.uid !== this.userId ||
      linkMetadata.size > MAX_FILE_BYTES ||
      currentTotal + linkMetadata.size > MAX_TOTAL_BYTES
    ) {
      fail('SOURCE_FILE_INVALID');
    }

    await this.createDestinationParent(relativePath);
    const destination = await this.filesystem('backup').resolve(relativePath);
    const sourceHandle = await open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let destinationHandle;
    try {
      destinationHandle = await open(
        destination,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
    } catch (error) {
      await sourceHandle.close();
      throw error;
    }
    try {
      const openedBefore = await sourceHandle.stat();
      const beforeIdentity = identityOf(linkMetadata);
      if (!openedBefore.isFile() || !sameIdentity(beforeIdentity, identityOf(openedBefore)))
        fail('SOURCE_IDENTITY_CHANGED');

      const hash = createHash('sha256');
      const buffer = Buffer.allocUnsafe(READ_BUFFER_BYTES);
      let length = 0;
      for (;;) {
        const { bytesRead } = await sourceHandle.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) break;
        length += bytesRead;
        if (length > MAX_FILE_BYTES || currentTotal + length > MAX_TOTAL_BYTES) fail('SOURCE_FILE_TOO_LARGE');
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        await destinationHandle.writeFile(chunk);
      }
      const openedAfter = await sourceHandle.stat();
      const linkedAfter = await lstat(sourcePath);
      if (
        length !== linkMetadata.size ||
        !sameIdentity(beforeIdentity, identityOf(openedAfter)) ||
        !sameIdentity(beforeIdentity, identityOf(linkedAfter))
      ) {
        fail('SOURCE_IDENTITY_CHANGED');
      }
      await destinationHandle.chmod(0o600);
      await destinationHandle.sync();
      const destinationMetadata = await destinationHandle.stat();
      if (
        !destinationMetadata.isFile() ||
        destinationMetadata.uid !== this.userId ||
        (destinationMetadata.mode & 0o777) !== 0o600 ||
        destinationMetadata.size !== length
      ) {
        fail('BACKUP_FILE_INVALID');
      }
      return Object.freeze({
        backupMode: destinationMetadata.mode & 0o777,
        backupModifiedMilliseconds: destinationMetadata.mtimeMs,
        length,
        relativePath,
        sha256: hash.digest('hex'),
        sourceMode: linkMetadata.mode & 0o7777,
        sourceModifiedMilliseconds: linkMetadata.mtimeMs,
        status: 'backed-up',
      });
    } finally {
      await Promise.allSettled([sourceHandle.close(), destinationHandle.close()]);
    }
  }

  private missingEntry(relativePath: LinuxSettingsBackupEntry['relativePath']): LinuxSettingsBackupEntry {
    return Object.freeze({
      backupMode: null,
      backupModifiedMilliseconds: null,
      length: null,
      relativePath,
      sha256: null,
      sourceMode: null,
      sourceModifiedMilliseconds: null,
      status: 'missing',
    });
  }

  private async assertSourceParents(relativePath: string): Promise<boolean> {
    const parent = path.dirname(relativePath);
    if (parent === '.') return true;
    try {
      await this.filesystem('source').openChildDirectory(parent);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  private async createDestinationParent(relativePath: string): Promise<void> {
    const parent = path.dirname(relativePath);
    if (parent === '.') return;
    await this.filesystem('backup').openChildDirectory(parent, true);
  }

  private async writeReceipt(receipt: LinuxSettingsBackupReceipt): Promise<void> {
    await this.filesystem('backup').writeExclusive(RECEIPT_FILE_NAME, `${JSON.stringify(receipt, null, 2)}\n`);
  }

  private async readReceipt(): Promise<LinuxSettingsBackupReceipt> {
    const receiptPath = await this.filesystem('backup').resolve(RECEIPT_FILE_NAME);
    const metadata = await lstat(receiptPath).catch(() => null);
    if (
      !metadata ||
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.uid !== this.userId ||
      (metadata.mode & 0o777) !== 0o600 ||
      metadata.size <= 0 ||
      metadata.size > 64 * 1024
    ) {
      fail('RECEIPT_INVALID');
    }
    const handle = await open(receiptPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || !sameIdentity(identityOf(metadata), identityOf(opened))) fail('RECEIPT_INVALID');
      return parseReceipt(JSON.parse(await handle.readFile('utf8')) as unknown);
    } catch (error) {
      if (error instanceof SyntaxError) fail('RECEIPT_INVALID');
      throw error;
    } finally {
      await handle.close();
    }
  }

  private async verifyBackupEntry(entry: LinuxSettingsBackupEntry): Promise<void> {
    const destination = await this.filesystem('backup').resolve(entry.relativePath);
    const metadata = await lstat(destination).catch(() => null);
    if (
      !metadata ||
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.uid !== this.userId ||
      (metadata.mode & 0o777) !== 0o600 ||
      metadata.size !== entry.length ||
      (metadata.mode & 0o777) !== entry.backupMode ||
      metadata.mtimeMs !== entry.backupModifiedMilliseconds
    ) {
      fail('BACKUP_FILE_INVALID');
    }
    const handle = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const openedBefore = await handle.stat();
      const expectedIdentity = identityOf(metadata);
      if (!openedBefore.isFile() || !sameIdentity(expectedIdentity, identityOf(openedBefore))) {
        fail('BACKUP_FILE_INVALID');
      }
      const hash = createHash('sha256');
      const buffer = Buffer.allocUnsafe(READ_BUFFER_BYTES);
      let length = 0;
      for (;;) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) break;
        length += bytesRead;
        if (length > MAX_FILE_BYTES) fail('BACKUP_FILE_INVALID');
        hash.update(buffer.subarray(0, bytesRead));
      }
      const openedAfter = await handle.stat();
      const digest = hash.digest();
      if (entry.sha256 === null) fail('BACKUP_FILE_INVALID');
      const expectedDigest = Buffer.from(entry.sha256, 'hex');
      if (
        length !== entry.length ||
        !sameIdentity(expectedIdentity, identityOf(openedAfter)) ||
        digest.length !== expectedDigest.length ||
        !timingSafeEqual(digest, expectedDigest)
      ) {
        fail('BACKUP_FILE_INVALID');
      }
    } finally {
      await handle.close();
    }
  }

  private async assertBackupRoot(expectEmpty: boolean): Promise<void> {
    const root = this.dependencies.backupRoot;
    const metadata = await lstat(root).catch(() => null);
    if (
      !metadata ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.uid !== this.userId ||
      (metadata.mode & 0o777) !== 0o700 ||
      root === path.parse(root).root ||
      (await realpath(root).catch(() => null)) !== path.resolve(root) ||
      (expectEmpty && (await readdir(root)).length !== 0)
    ) {
      fail('ROOT_INVALID');
    }
  }

  private async assertClosedInventory(
    directory: string,
    relativeDirectory: string,
    expectedFiles: ReadonlySet<string>,
    expectedDirectories: ReadonlySet<string>,
  ): Promise<void> {
    for (const name of await readdir(directory)) {
      const relativePath = relativeDirectory.length === 0 ? name : path.join(relativeDirectory, name);
      const absolutePath = await this.filesystem('backup').resolve(relativePath);
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink() || metadata.uid !== this.userId) fail('INVENTORY_INVALID');
      if (metadata.isDirectory()) {
        if ((metadata.mode & 0o777) !== 0o700 || !expectedDirectories.has(relativePath)) fail('INVENTORY_INVALID');
        const heldDirectory = await this.filesystem('backup').openChildDirectory(relativePath);
        await this.assertClosedInventory(heldDirectory, relativePath, expectedFiles, expectedDirectories);
      } else if (!metadata.isFile() || !expectedFiles.has(relativePath)) {
        fail('INVENTORY_INVALID');
      }
    }
    if (relativeDirectory.length === 0) {
      for (const expected of expectedFiles) {
        if (!(await lstat(await this.filesystem('backup').resolve(expected)).catch(() => null))) {
          fail('INVENTORY_INVALID');
        }
      }
    }
  }
}
