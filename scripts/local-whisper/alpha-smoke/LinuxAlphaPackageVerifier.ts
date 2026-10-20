import { createHash, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';

import type {
  AlphaSmokeAssetIdentity,
  AlphaSmokePackageDisposition,
  AlphaSmokePackageStatus,
} from './AlphaSmokeProtocol';

export const LINUX_GPT_VOICE_PACKAGE = Object.freeze({
  alphaDebianVersion: '2.4.0~alpha.1',
  architecture: 'amd64',
  fileName: 'gpt-voice_2.4.0-alpha.1_amd64.deb',
  name: 'gpt-voice',
});

const SHA256_PATTERN = /^[a-f\d]{64}$/u;

export type LinuxPackageFileKind = 'file' | 'symlink';

export interface LinuxPackageFileIdentity {
  readonly kind: LinuxPackageFileKind;
  readonly mode: number;
  readonly path: string;
  readonly value: string;
}

export interface LinuxPackageSnapshot {
  readonly architecture: string;
  readonly conffiles: readonly string[];
  readonly files: readonly LinuxPackageFileIdentity[];
  readonly name: string;
  readonly status: string;
  readonly version: string;
}

export interface LinuxAlphaPackagePort {
  assertNoActivePackageProcess(): Promise<void>;
  captureInstalledPackage(expectedArchive: LinuxPackageSnapshot): Promise<LinuxPackageSnapshot | null>;
  inspectPackageArchive(packagePath: string): Promise<LinuxPackageSnapshot>;
  requestAlphaInstallation(packagePath: string, deadlineEpochMilliseconds: number): Promise<void>;
}

function fail(code: string): never {
  throw new Error(`ALPHA_SMOKE_LINUX_PACKAGE_${code}`);
}

function canonicalStrings(values: readonly string[]): readonly string[] {
  const sorted = [...values].sort((left, right) => left.localeCompare(right, 'en'));
  if (sorted.some((value, index) => value.length === 0 || (index > 0 && value === sorted[index - 1]))) {
    fail('INVENTORY_INVALID');
  }
  return Object.freeze(sorted);
}

function canonicalFiles(values: readonly LinuxPackageFileIdentity[]): readonly LinuxPackageFileIdentity[] {
  if (values.length === 0) fail('INVENTORY_INVALID');
  const sorted = [...values]
    .map((value) => Object.freeze({ ...value }))
    .sort((left, right) => left.path.localeCompare(right.path, 'en'));
  if (
    sorted.some(
      (value, index) =>
        (value.kind !== 'file' && value.kind !== 'symlink') ||
        !Number.isSafeInteger(value.mode) ||
        value.mode < 0 ||
        value.mode > 0o7777 ||
        !value.path.startsWith('/') ||
        value.path.includes('\0') ||
        value.value.length === 0 ||
        (value.kind === 'file' && !SHA256_PATTERN.test(value.value)) ||
        (index > 0 && value.path === sorted[index - 1]?.path),
    )
  ) {
    fail('INVENTORY_INVALID');
  }
  return Object.freeze(sorted);
}

export function normalizeLinuxPackageSnapshot(snapshot: LinuxPackageSnapshot): LinuxPackageSnapshot {
  if (
    snapshot.name.length === 0 ||
    snapshot.version.length === 0 ||
    snapshot.architecture.length === 0 ||
    snapshot.status !== 'installed'
  ) {
    fail('SNAPSHOT_INVALID');
  }
  return Object.freeze({
    architecture: snapshot.architecture,
    conffiles: canonicalStrings(snapshot.conffiles),
    files: canonicalFiles(snapshot.files),
    name: snapshot.name,
    status: snapshot.status,
    version: snapshot.version,
  });
}

function sameSnapshot(left: LinuxPackageSnapshot, right: LinuxPackageSnapshot): boolean {
  return JSON.stringify(normalizeLinuxPackageSnapshot(left)) === JSON.stringify(normalizeLinuxPackageSnapshot(right));
}

function hasExpectedMetadata(snapshot: LinuxPackageSnapshot): boolean {
  return (
    snapshot.name === LINUX_GPT_VOICE_PACKAGE.name &&
    snapshot.version === LINUX_GPT_VOICE_PACKAGE.alphaDebianVersion &&
    snapshot.architecture === LINUX_GPT_VOICE_PACKAGE.architecture &&
    snapshot.status === 'installed'
  );
}

/** Proves exact public-alpha package equivalence and never removes or downgrades a package. */
export class LinuxAlphaPackageVerifier {
  public constructor(
    private readonly dependencies: Readonly<{
      debPath: string;
      deadlineEpochMilliseconds: number;
      expectedDeb: AlphaSmokeAssetIdentity;
      port: LinuxAlphaPackagePort;
    }>,
  ) {}

  public async prepare(): Promise<AlphaSmokePackageDisposition> {
    const archive = await this.verifiedArchive();
    await this.dependencies.port.assertNoActivePackageProcess();
    const installed = await this.dependencies.port.captureInstalledPackage(archive);
    if (installed === null) return 'clean-host';
    this.assertExactInstalled(installed, archive, 'INSTALLED_PACKAGE_UNSUPPORTED');
    return 'exact-alpha';
  }

  public async ensureReady(disposition: AlphaSmokePackageDisposition): Promise<void> {
    const archive = await this.verifiedArchive();
    await this.dependencies.port.assertNoActivePackageProcess();
    const before = await this.dependencies.port.captureInstalledPackage(archive);
    if (disposition === 'clean-host') {
      if (before !== null) fail('PACKAGE_STATE_DRIFT');
      await this.dependencies.port.requestAlphaInstallation(
        this.dependencies.debPath,
        this.dependencies.deadlineEpochMilliseconds,
      );
    } else {
      if (before === null) fail('PACKAGE_STATE_DRIFT');
      this.assertExactInstalled(before, archive, 'PACKAGE_STATE_DRIFT');
    }
    const installed = await this.dependencies.port.captureInstalledPackage(archive);
    this.assertExactInstalled(installed, archive, 'ALPHA_INSTALL_VERIFICATION_FAILED');
  }

  public async revalidateBeforeAttempt(disposition: AlphaSmokePackageDisposition): Promise<void> {
    const archive = await this.verifiedArchive();
    await this.dependencies.port.assertNoActivePackageProcess();
    const installed = await this.dependencies.port.captureInstalledPackage(archive);
    if (disposition === 'clean-host') {
      if (installed !== null) fail('PACKAGE_STATE_DRIFT');
      return;
    }
    if (installed === null) fail('PACKAGE_STATE_DRIFT');
    this.assertExactInstalled(installed, archive, 'PACKAGE_STATE_DRIFT');
  }

  public async assertRetained(): Promise<void> {
    await this.dependencies.port.assertNoActivePackageProcess();
    await this.assertInstalledEquivalent();
  }

  public async assertInstalledEquivalent(): Promise<void> {
    const archive = await this.verifiedArchive();
    this.assertExactInstalled(
      await this.dependencies.port.captureInstalledPackage(archive),
      archive,
      'RETAINED_ALPHA_VERIFICATION_FAILED',
    );
  }

  public async observeStatus(): Promise<AlphaSmokePackageStatus> {
    try {
      const archive = await this.verifiedArchive();
      const installed = await this.dependencies.port.captureInstalledPackage(archive);
      if (installed === null) return 'absent';
      return hasExpectedMetadata(installed) && sameSnapshot(installed, archive)
        ? 'retained-alpha'
        : 'different-package';
    } catch {
      return 'unverified';
    }
  }

  private async verifiedArchive(): Promise<LinuxPackageSnapshot> {
    await this.assertDebIdentity();
    const archive = normalizeLinuxPackageSnapshot(
      await this.dependencies.port.inspectPackageArchive(this.dependencies.debPath),
    );
    if (!hasExpectedMetadata(archive)) fail('PUBLIC_ALPHA_METADATA_INVALID');
    return archive;
  }

  private assertExactInstalled(
    installed: LinuxPackageSnapshot | null,
    archive: LinuxPackageSnapshot,
    code: string,
  ): void {
    if (installed === null || !hasExpectedMetadata(installed) || !sameSnapshot(installed, archive)) fail(code);
  }

  private async assertDebIdentity(): Promise<void> {
    const expected = this.dependencies.expectedDeb;
    const before = await lstat(this.dependencies.debPath).catch(() => null);
    if (
      expected.fileName !== LINUX_GPT_VOICE_PACKAGE.fileName ||
      path.basename(this.dependencies.debPath) !== expected.fileName ||
      !before ||
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size !== expected.length
    ) {
      fail('PUBLIC_ALPHA_DEB_INVALID');
    }

    const handle = await open(this.dependencies.debPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const hash = createHash('sha256');
    let length = 0;
    try {
      const openedBefore = await handle.stat();
      if (
        !openedBefore.isFile() ||
        openedBefore.dev !== before.dev ||
        openedBefore.ino !== before.ino ||
        openedBefore.size !== before.size ||
        openedBefore.mtimeMs !== before.mtimeMs
      ) {
        fail('PUBLIC_ALPHA_DEB_INVALID');
      }
      for await (const chunk of handle.createReadStream({ autoClose: false })) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        length += bytes.length;
        if (length > expected.length) fail('PUBLIC_ALPHA_DEB_INVALID');
        hash.update(bytes);
      }
      const openedAfter = await handle.stat();
      if (
        openedAfter.dev !== before.dev ||
        openedAfter.ino !== before.ino ||
        openedAfter.size !== before.size ||
        openedAfter.mtimeMs !== before.mtimeMs
      ) {
        fail('PUBLIC_ALPHA_DEB_INVALID');
      }
    } finally {
      await handle.close();
    }
    const after = await lstat(this.dependencies.debPath).catch(() => null);
    const actualDigest = hash.digest();
    const expectedDigest = Buffer.from(expected.sha256, 'hex');
    if (
      !after ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      length !== expected.length ||
      actualDigest.length !== expectedDigest.length ||
      !timingSafeEqual(actualDigest, expectedDigest)
    ) {
      fail('PUBLIC_ALPHA_DEB_INVALID');
    }
  }
}
